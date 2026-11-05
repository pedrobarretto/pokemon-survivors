import { accountState } from '../account'
import { RARITY_PRICE } from '../data/cosmetics'
import { FURNITURE, type FurnitureCounts, type FurnitureId, type FurnitureSet } from '../data/furniture'
import { LEGEND_PAINTINGS } from '../data/furnitureSets/pokemon'
import { LEGENDS, type LegendId } from '../data/legends'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { isCaptured } from '../game/capture'
import { brasiliaDay } from '../game/day'
import { formatNumber, t } from '../i18n'
import { fetchMe, isFailure, realmFaked } from '../realm/api'
import { collectionsOn, filterPage, isFresh, pageOf, payOf, SHELVES, shelfOf, type PayFilter, type ShelfFilter } from '../realm/catalog'
import { buyPiece, pieceName } from '../realm/furniture'
import { dollLegend } from '../realm/placement'
import { coinIcon } from '../render/art'
import { pieceIcon, piecePreview } from '../render/base'
import { gemIconUrl } from '../render/gemArt'
import { portraitUrl } from '../render/sprites'
import { dialogue, type DialogueLine, type Speaker } from './dialogue'
import { h, later, setText } from './dom'
import { gemChip } from './gemShop'
import { loadSave, today } from './save'
import { hint, type Screen } from './screens'

/**
 * Bibarel's carpentry (`openCarpentry`): the secret bases' furniture shop,
 * laid out as the Kecleon shop's sheet (`.shop-sheet`) with Bibarel's box
 * beside it, like Leavanny's Boutique. Its pages are the collections
 * (`FURNITURE_SETS`, `realm/catalog.ts`), Club Penguin catalog style: a rail
 * of covers on top, then where a piece goes (all, floor, rugs, tops, wall,
 * styles) and what it costs (₽ or gems) as filters. Each card shows the
 * piece in a corner of a room (`piecePreview`), NOVO on a fresh one; tapping
 * it opens it up close with its price, which buys it (₽ out of the stored
 * save, a ₽ sink, or gems). The earned pieces (the legends' dolls and
 * paintings) say what earns them: never sold. Guests browse; buying asks
 * them to sign in. Q E (or ← →) switch collections, ↑ ↓ scroll, Esc closes
 * the close-up, then goes back.
 */

/** The carpenter: Bibarel (#400). */
const CARPENTER = { dex: 400, name: 'Bibarel', color: '#a8682c' } as const

/** Bibarel as a dialogue speaker (one portrait for every mood). */
const carpenterSpeaker = (): Speaker => ({
  name: CARPENTER.name,
  color: CARPENTER.color,
  portrait: () => h('img', { src: portraitUrl(CARPENTER.dex), alt: '', width: 40, height: 40 }),
})

const SHELF_FILTERS = ['all', ...SHELVES] as const satisfies readonly ShelfFilter[]
const PAY_FILTERS = ['all', 'coins', 'gems'] as const satisfies readonly PayFilter[]

/** The legends an earned piece shows (a doll its own, a painting the ones `LEGEND_PAINTINGS` lists). */
const earnedBy = (id: FurnitureId): readonly LegendId[] => {
  const legend = dollLegend(id)
  if (legend) return [legend]
  const known = (k: string): k is keyof typeof LEGEND_PAINTINGS => Object.hasOwn(LEGEND_PAINTINGS, k)
  return known(id) ? LEGEND_PAINTINGS[id] : []
}

/** A collection's cover on the rail: its most precious piece (a legend's doll for the trophies). */
const coverOf = (set: FurnitureSet, ids: readonly FurnitureId[]): FurnitureId | undefined =>
  set === 'trophies' ? ids.find((id) => dollLegend(id) !== null) : [...ids].sort((a, b) => RARITY_PRICE[FURNITURE[b].rarity] - RARITY_PRICE[FURNITURE[a].rarity])[0]

/** `close`: back where it opened from. `signIn`: the way to an account (null in a build without accounts). */
export type CarpentryOpts = { close: () => void; signIn: (() => void) | null }

export const openCarpentry = (root: HTMLElement, input: Input, opts: CarpentryOpts): Screen => {
  const m = t().carpentry
  const day = brasiliaDay(today())
  const signedIn = () => realmFaked() || accountState().kind === 'signedIn'
  const el = h('div', { class: 'shop-layer carpentry-layer' })
  root.append(el)
  const say = (text: string) => [{ text, emotion: 'Normal' }] as const satisfies readonly DialogueLine[]
  const talk = dialogue(root, input, { speaker: carpenterSpeaker(), lines: say(signedIn() ? m.browse : m.guest), onDone: () => {}, className: 'shop-talk', passive: true })

  const sets = collectionsOn(day)
  let set: FurnitureSet = sets[0] ?? 'trophies'
  let shelf: ShelfFilter = 'all'
  let currency: PayFilter = 'all'
  let owned: FurnitureCounts = {}
  let busy = false
  let open: FurnitureId | null = null
  let closed = false

  /** Art still waiting on its PNG or sprite, painted again as it lands: what draws it, by its canvas. */
  const pending = new Map<HTMLCanvasElement, (time: number) => { canvas: HTMLCanvasElement; ready: boolean }>()
  const art = (draw: (time: number) => { canvas: HTMLCanvasElement; ready: boolean }, className: string) => {
    const got = draw(0)
    got.canvas.classList.add(className)
    if (!got.ready) pending.set(got.canvas, draw)
    return got.canvas
  }

  /* ---------- The sheet ---------- */

  const covers = sets.map((s) => {
    const page = pageOf(s, day)
    const cover = coverOf(s, page)
    return h(
      'button',
      { class: `carpentry-set ${s}`, type: 'button', role: 'tab', onclick: () => !busy && switchSet(s) },
      h('span', { class: 'carpentry-set-art' }, cover ? art((time) => pieceIcon(cover, time), 'carpentry-set-icon') : null),
      h('span', { class: 'carpentry-set-name' }, t().furniture.sets[s]),
      page.some((id) => isFresh(id, day)) ? h('span', { class: 'carpentry-fresh' }, m.fresh) : null,
    )
  })
  const rail = h('nav', { class: 'carpentry-rail', role: 'tablist', 'aria-label': m.collections }, ...covers)
  const chip = (label: string, on: () => void) => h('button', { class: 'carpentry-chip', type: 'button', onclick: () => !busy && on() }, label)
  const shelfChips = SHELF_FILTERS.map((s) => chip(s === 'all' ? m.all : m.tabs[s], () => setShelf(s)))
  const payChips = PAY_FILTERS.map((p) => chip(m.pay[p], () => setPay(p)))
  const filters = h('div', { class: 'carpentry-filters' }, h('div', { class: 'carpentry-chips kinds' }, ...shelfChips), h('div', { class: 'carpentry-chips pays' }, ...payChips))
  const pageHead = h('div', { class: 'carpentry-page-head' })
  const grid = h('div', { class: 'carpentry-grid' })
  const body = h('div', { class: 'carpentry-body', tabIndex: -1 }, pageHead, grid)
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => leave() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const wallet = h('span', {})
  const gem = gemChip(() => {})
  const detail = h('div', { class: 'carpentry-detail', hidden: true })
  el.append(
    h(
      'section',
      { class: 'shop-sheet box carpentry-sheet', 'aria-label': m.title },
      h('header', { class: 'shop-head' }, back, h('h2', { class: 'shop-title' }, m.title), h('span', { class: 'shop-wallet' }, h('img', { src: coinIcon(0), alt: '' }), wallet), ...(gem ? [gem] : [])),
      rail,
      filters,
      body,
      detail,
      h('footer', { class: 'shop-foot' }, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  /* ---------- Buying ---------- */

  /** Bibarel's line for a refused purchase (the API's word, `PieceBought`). */
  const failure = (error: string) => {
    const known = (e: string): e is keyof typeof m.errors => Object.hasOwn(m.errors, e)
    return known(error) ? m.errors[error] : m.errors.offline
  }

  /** Buys the piece in the close-up (its button is the confirmation): a guest is asked to sign in, short ₽ hears Bibarel. */
  const buy = (id: FurnitureId) => {
    const how = payOf(id)
    const price = FURNITURE[id].price
    if (busy || !how || !price) return
    if (!signedIn()) {
      playSfx('denied')
      talk.say(say(m.guest), carpenterSpeaker())
      opts.signIn?.()
      return
    }
    if ('coins' in price && loadSave().wallet < price.coins) {
      playSfx('denied')
      return talk.say(say(m.errors.funds), carpenterSpeaker())
    }
    playSfx('select')
    void pay(id, how)
  }

  const pay = async (id: FurnitureId, how: 'gems' | 'coins') => {
    busy = true
    paint()
    const done = await buyPiece(id, how)
    busy = false
    if (closed) return
    if (done.ok) {
      playSfx('buy')
      owned = done.furniture
      talk.say(say(m.thanks(pieceName(id))), carpenterSpeaker())
    } else {
      playSfx('denied')
      talk.say(say(failure(done.error)), carpenterSpeaker())
    }
    paint()
  }

  /* ---------- Cards ---------- */

  const priceTag = (id: FurnitureId) => {
    const price = FURNITURE[id].price
    if (!price) return null
    return 'gems' in price
      ? h('span', { class: 'carpentry-price gems' }, h('img', { src: gemIconUrl(), alt: '' }), formatNumber(price.gems))
      : h('span', { class: 'carpentry-price' }, h('img', { src: coinIcon(0), alt: '' }), formatNumber(price.coins))
  }

  /** Whether the account has an earned piece: the API's count, or its legends captured on this device. */
  const earned = (id: FurnitureId) => (owned[id] ?? 0) > 0 || earnedBy(id).every((l) => isCaptured(loadSave().legends, l))

  /** What earns a piece that's never sold: capturing its legends. */
  const earnLine = (id: FurnitureId) => m.locked(earnedBy(id).map((l) => LEGENDS[l].name).join(m.and))

  /** Under a card's name: how many the account has, or, for an earned piece, whether it's in or what earns it. */
  const status = (id: FurnitureId) => {
    if (FURNITURE[id].price) return (owned[id] ?? 0) > 0 ? m.owned(owned[id] ?? 0) : ''
    return earned(id) ? m.captured : earnLine(id)
  }

  const card = (id: FurnitureId) => {
    const f = FURNITURE[id]
    const locked = f.price === null && !earned(id)
    return h(
      'button',
      { class: `carpentry-card ${f.rarity}${f.price ? '' : ' trophy'}${locked ? ' locked' : ''}`, type: 'button', onclick: () => !busy && show(id) },
      h('span', { class: 'carpentry-art' }, art((time) => piecePreview(id, time), 'carpentry-icon')),
      isFresh(id, day) ? h('span', { class: 'carpentry-fresh' }, m.fresh) : null,
      h('b', { class: 'carpentry-name' }, pieceName(id)),
      h('span', { class: 'carpentry-owned' }, status(id)),
      f.price ? h('span', { class: 'carpentry-tag' }, priceTag(id)) : null,
    )
  }

  /** The close-up: the piece in its corner of a room, bigger, with what it is and its price (the buy button). */
  const paintDetail = () => {
    detail.hidden = open === null
    if (open === null) return detail.replaceChildren()
    const id = open
    const f = FURNITURE[id]
    const [w, hh] = f.size
    const kind = shelfOf(id) === 'style' ? t().furniture.kinds[f.kind] : `${t().furniture.kinds[f.kind]} · ${w}×${hh}`
    const locked = f.price === null && !earned(id)
    const close = h('button', { class: 'btn carpentry-detail-close', type: 'button', 'aria-label': t().mart.back, onclick: () => hide() }, '✕')
    detail.replaceChildren(
      h(
        'div',
        { class: `carpentry-detail-box box pop ${f.rarity}${locked ? ' locked' : ''}`, role: 'dialog', 'aria-label': pieceName(id) },
        close,
        h('div', { class: 'carpentry-detail-art' }, art((time) => piecePreview(id, time), 'carpentry-detail-icon')),
        h(
          'div',
          { class: 'carpentry-detail-text' },
          h('b', { class: 'carpentry-detail-name' }, pieceName(id)),
          h('span', { class: 'carpentry-detail-meta' }, `${t().furniture.sets[f.set]} · ${kind}`),
          h('span', { class: `carpentry-rarity ${f.rarity}` }, m.rarity[f.rarity]),
          h('span', { class: 'carpentry-owned' }, status(id)),
          f.price
            ? h('button', { class: 'btn carpentry-buy', type: 'button', disabled: busy, onclick: () => buy(id) }, busy ? m.buying : m.buy, ' ', priceTag(id))
            : h('p', { class: 'carpentry-note' }, earnedBy(id).length > 1 || !dollLegend(id) ? m.paintingNote : m.dollNote),
        ),
      ),
    )
  }

  const paint = () => {
    if (closed) return
    for (const c of pending.keys()) if (!c.isConnected) pending.delete(c)
    covers.forEach((b, i) => {
      const on = sets[i] === set
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    const page = pageOf(set, day)
    // Only the filters this page can use.
    shelfChips.forEach((c, i) => {
      const s = SHELF_FILTERS[i]!
      c.hidden = s !== 'all' && !page.some((id) => shelfOf(id) === s)
      c.classList.toggle('on', s === shelf)
    })
    payChips.forEach((c, i) => {
      const p = PAY_FILTERS[i]!
      c.hidden = p !== 'all' && !page.some((id) => payOf(id) === p)
      c.classList.toggle('on', p === currency)
    })
    setText(wallet, formatNumber(loadSave().wallet))
    const ids = filterPage(page, shelf, currency)
    pageHead.replaceChildren(h('b', { class: 'carpentry-page-name' }, t().furniture.sets[set]), h('span', { class: 'carpentry-page-blurb' }, m.blurbs[set]), h('span', { class: 'carpentry-page-count' }, m.count(ids.length)))
    grid.replaceChildren(...(ids.length > 0 ? ids.map(card) : [h('p', { class: 'carpentry-note carpentry-empty' }, m.empty)]))
    paintDetail()
  }

  function switchSet(s: FurnitureSet) {
    if (s === set || closed) return
    playSfx('move')
    set = s
    shelf = 'all'
    currency = 'all'
    body.scrollTop = 0
    paint()
    covers[sets.indexOf(s)]?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }

  function setShelf(s: ShelfFilter) {
    playSfx('move')
    shelf = shelf === s ? 'all' : s
    paint()
  }

  function setPay(p: PayFilter) {
    playSfx('move')
    currency = currency === p ? 'all' : p
    paint()
  }

  function show(id: FurnitureId) {
    playSfx('select')
    open = id
    paintDetail()
  }

  function hide() {
    if (open === null || busy) return
    playSfx('select')
    open = null
    paintDetail()
  }

  function leave() {
    if (closed || busy) return
    if (open !== null) return hide()
    playSfx('select')
    dispose()
    later(opts.close)
  }

  const off = input.onKey((key) => {
    if (closed || busy) return
    if (key === 'Escape' || key === 'Backspace') return leave()
    if (open !== null) return
    const at = sets.indexOf(set)
    if (key === 'KeyQ' || key === 'PageUp' || key === 'ArrowLeft') switchSet(sets[(at + sets.length - 1) % sets.length]!)
    else if (key === 'KeyE' || key === 'PageDown' || key === 'ArrowRight') switchSet(sets[(at + 1) % sets.length]!)
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
  })

  // Bibarel's box types on, and art that lands meanwhile is painted in.
  let raf = 0
  const frame = (now: number) => {
    if (closed) return
    talk.tick?.(now)
    for (const [c, draw] of pending) {
      const got = draw(now / 1000)
      if (!got.ready) continue
      got.canvas.className = c.className
      c.replaceWith(got.canvas)
      pending.delete(c)
    }
    raf = requestAnimationFrame(frame)
  }
  raf = requestAnimationFrame(frame)

  function dispose() {
    if (closed) return
    closed = true
    cancelAnimationFrame(raf)
    off()
    talk.dispose()
    el.remove()
  }

  paint()
  if (signedIn())
    void fetchMe().then((me) => {
      if (closed || isFailure(me)) return
      owned = me.furniture
      paint()
    })

  return { el, dispose }
}
