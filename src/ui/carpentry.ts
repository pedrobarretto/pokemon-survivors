import { accountState } from '../account'
import { FURNITURE, type FurnitureCounts, type FurnitureId } from '../data/furniture'
import { LEGEND_IDS, LEGENDS } from '../data/legends'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { isCaptured } from '../game/capture'
import { brasiliaDay } from '../game/day'
import { formatNumber, formatPokeDollars, t } from '../i18n'
import { fetchMe, isFailure, realmFaked } from '../realm/api'
import { buyPiece, pieceName } from '../realm/furniture'
import { dollLegend, onSale } from '../realm/placement'
import { coinIcon } from '../render/art'
import { pieceIcon } from '../render/base'
import { gemIconUrl } from '../render/gemArt'
import { portraitUrl } from '../render/sprites'
import { dialogue, type DialogueLine, type Speaker } from './dialogue'
import { h, later, setText } from './dom'
import { gemChip } from './gemShop'
import { loadSave, today } from './save'
import { confirmDialog, hint, type Screen } from './screens'

/**
 * Bibarel's carpentry (`openCarpentry`): the secret bases' furniture shop,
 * laid out as the Kecleon shop's sheet (`.shop-sheet`) with Bibarel's box
 * beside it, like Leavanny's Boutique. Its shelves follow `data/furniture.ts`
 * by kind (what stands on the floor, rugs, what sits on a table, the wall's,
 * the room's styles), each piece with its price in ₽ (out of the stored save,
 * a ₽ sink) or gems, and how many the account has; the Troféus shelf shows
 * the legends' dolls, earned by capturing each and never sold. Guests browse;
 * buying asks them to sign in. Q E (or ← →) switch shelves, ↑ ↓ scroll,
 * Esc goes back.
 */

/** The carpenter: Bibarel (#400). */
const CARPENTER = { dex: 400, name: 'Bibarel', color: '#a8682c' } as const

/** Bibarel as a dialogue speaker (one portrait for every mood). */
const carpenterSpeaker = (): Speaker => ({
  name: CARPENTER.name,
  color: CARPENTER.color,
  portrait: () => h('img', { src: portraitUrl(CARPENTER.dex), alt: '', width: 40, height: 40 }),
})

const SHELVES = ['floor', 'rug', 'top', 'wall', 'style', 'trophy'] as const
type Shelf = (typeof SHELVES)[number]

const shelfOf = (id: FurnitureId): Shelf => {
  const f = FURNITURE[id]
  if (f.source === 'trophy') return 'trophy'
  return f.kind === 'wallpaper' || f.kind === 'flooring' ? 'style' : f.kind
}

/** `close`: back where it opened from. `signIn`: the way to an account (null in a build without accounts). */
export type CarpentryOpts = { close: () => void; signIn: (() => void) | null }

export const openCarpentry = (root: HTMLElement, input: Input, opts: CarpentryOpts): Screen => {
  const m = t().carpentry
  const signedIn = () => realmFaked() || accountState().kind === 'signedIn'
  const el = h('div', { class: 'shop-layer carpentry-layer' })
  root.append(el)
  const say = (text: string) => [{ text, emotion: 'Normal' }] as const satisfies readonly DialogueLine[]
  const talk = dialogue(root, input, { speaker: carpenterSpeaker(), lines: say(signedIn() ? m.browse : m.guest), onDone: () => {}, className: 'shop-talk', passive: true })

  let shelf: Shelf = 'floor'
  let owned: FurnitureCounts = {}
  let busy = false
  let sub: Screen | null = null
  let closed = false

  const tabs = SHELVES.map((id) => h('button', { class: `shop-tab carpentry-tab ${id}`, type: 'button', role: 'tab', onclick: () => !busy && switchShelf(id) }, m.tabs[id]))
  const body = h('div', { class: 'carpentry-body', tabIndex: -1 })
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => leave() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const wallet = h('span', {})
  const chip = gemChip(() => {})
  el.append(
    h(
      'section',
      { class: 'shop-sheet box carpentry-sheet', 'aria-label': m.title },
      h('header', { class: 'shop-head' }, back, h('h2', { class: 'shop-title' }, m.title), h('span', { class: 'shop-wallet' }, h('img', { src: coinIcon(0), alt: '' }), wallet), ...(chip ? [chip] : [])),
      h('nav', { class: 'shop-tabs', role: 'tablist' }, ...tabs),
      body,
      h('footer', { class: 'shop-foot' }, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  /** Cards' art still waiting on its PNG or sprite, painted again as it lands. */
  const pending = new Map<HTMLElement, FurnitureId>()

  const art = (id: FurnitureId) => {
    const icon = pieceIcon(id)
    icon.canvas.classList.add('carpentry-icon')
    if (!icon.ready) pending.set(icon.canvas, id)
    return h('div', { class: 'carpentry-art' }, icon.canvas)
  }

  /* ---------- Buying ---------- */

  /** Bibarel's line for a refused purchase (the API's word, `PieceBought`). */
  const failure = (error: string) => {
    const known = (e: string): e is keyof typeof m.errors => Object.hasOwn(m.errors, e)
    return known(error) ? m.errors[error] : m.errors.offline
  }

  const buy = (id: FurnitureId) => {
    const price = FURNITURE[id].price
    if (busy || sub || !price) return
    if (!signedIn()) {
      playSfx('denied')
      talk.say(say(m.guest), carpenterSpeaker())
      opts.signIn?.()
      return
    }
    const gems = 'gems' in price
    const label = gems ? `${formatNumber(price.gems)} ${m.gems}` : formatPokeDollars(price.coins)
    if (!gems && loadSave().wallet < price.coins) {
      playSfx('denied')
      return talk.say(say(m.errors.funds), carpenterSpeaker())
    }
    playSfx('select')
    sub = confirmDialog(
      root,
      input,
      m.confirm(pieceName(id), label),
      (yes) => {
        sub?.dispose()
        sub = null
        if (yes) void pay(id, gems ? 'gems' : 'coins')
      },
      { class: 'shop-confirm' },
    )
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

  const card = (id: FurnitureId) => {
    const f = FURNITURE[id]
    const have = owned[id] ?? 0
    const [w, hh] = f.size
    return h(
      'article',
      { class: `carpentry-card ${f.rarity}` },
      art(id),
      h('b', { class: 'carpentry-name' }, pieceName(id)),
      h('span', { class: 'carpentry-meta' }, f.kind === 'wallpaper' || f.kind === 'flooring' ? t().furniture.kinds[f.kind] : `${t().furniture.kinds[f.kind]} · ${w}×${hh}`),
      h('span', { class: 'carpentry-owned' }, have > 0 ? m.owned(have) : ''),
      h('button', { class: 'btn carpentry-buy', type: 'button', disabled: busy, onclick: () => buy(id) }, priceTag(id)),
    )
  }

  /** A legend's doll: in the collection once captured, else what earns it. */
  const trophy = (id: FurnitureId) => {
    const legend = dollLegend(id)
    if (!legend) return null
    const have = (owned[id] ?? 0) > 0 || isCaptured(loadSave().legends, legend)
    return h(
      'article',
      { class: `carpentry-card trophy${have ? '' : ' locked'}` },
      art(id),
      h('b', { class: 'carpentry-name' }, pieceName(id)),
      h('span', { class: 'carpentry-owned' }, have ? m.captured : m.locked(LEGENDS[legend].name)),
    )
  }

  const paint = () => {
    if (closed) return
    pending.clear()
    tabs.forEach((b, i) => {
      const on = SHELVES[i] === shelf
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    setText(wallet, formatNumber(loadSave().wallet))
    if (shelf === 'trophy') {
      body.replaceChildren(h('p', { class: 'carpentry-note' }, m.trophies), h('div', { class: 'carpentry-grid' }, ...LEGEND_IDS.map((l) => trophy(`doll:${l}`))))
      return
    }
    const ids = onSale(brasiliaDay(today())).filter((id) => shelfOf(id) === shelf)
    body.replaceChildren(h('div', { class: 'carpentry-grid' }, ...ids.map(card)))
  }

  function switchShelf(id: Shelf) {
    if (id === shelf || closed) return
    playSfx('move')
    shelf = id
    body.scrollTop = 0
    paint()
  }

  function leave() {
    if (closed || busy || sub) return
    playSfx('select')
    dispose()
    later(opts.close)
  }

  const off = input.onKey((key) => {
    if (closed || busy || sub) return
    const at = SHELVES.indexOf(shelf)
    if (key === 'KeyQ' || key === 'PageUp' || key === 'ArrowLeft') switchShelf(SHELVES[(at + SHELVES.length - 1) % SHELVES.length]!)
    else if (key === 'KeyE' || key === 'PageDown' || key === 'ArrowRight') switchShelf(SHELVES[(at + 1) % SHELVES.length]!)
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
    else if (key === 'Escape' || key === 'Backspace') leave()
  })

  // Bibarel's box types on, and art that lands meanwhile is painted in.
  let raf = 0
  const frame = (now: number) => {
    if (closed) return
    talk.tick?.(now)
    for (const [c, id] of pending) {
      const icon = pieceIcon(id, now / 1000)
      if (!icon.ready) continue
      icon.canvas.className = c.className
      c.replaceWith(icon.canvas)
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
    sub?.dispose()
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
