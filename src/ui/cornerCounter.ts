import { accountState } from '../account'
import { HATCHLINGS } from '../data/hatchlings'
import { CORNER_PRIZE_IDS, CORNER_PRIZES, prizeOnce, ROCKET_FRAME, ROCKET_TITLE, type CornerPrize, type CornerPrizeId } from '../data/rocketCorner'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { formatNumber, t } from '../i18n'
import type { CornerState } from '../net/realmApi'
import { isFailure, realmFaked } from '../realm/api'
import { buyTokens, fetchCorner, redeemPrize } from '../realm/cornerApi'
import { CORNER } from '../realm/games/corner.rules'
import { bagIcon, coinIcon, medalIcon } from '../render/art'
import { tokenIcon } from '../render/cornerArt'
import { frameIcon } from '../render/cosmetics'
import { portraitUrl } from '../render/sprites'
import { standingCanvas } from '../render/shadowAura'
import { dialogue, type DialogueLine, type Speaker } from './dialogue'
import { h, later, setText } from './dom'
import { loadSave } from './save'
import type { Screen } from './screens'

/**
 * The Rocket Game Corner's counter (`openCornerCounter`): Meowth's sheet, laid
 * out as the carpentry's (`.shop-sheet`), with two pages: the prizes (the
 * player picks one; `data/rocketCorner.ts`) and the token packs (₽ only, a
 * day's cap). The API takes the tokens and sends the prize as a gift
 * (`cornerApi.ts`), which waits in the gift box. Esc goes back.
 */

/** Meowth (#52), Team Rocket's talking cat, keeps the counter. */
const CLERK = { dex: 52, name: 'Meowth', color: '#d8a838' } as const

const clerk = (): Speaker => ({
  name: CLERK.name,
  color: CLERK.color,
  portrait: () => h('img', { src: portraitUrl(CLERK.dex), alt: '', width: 40, height: 40 }),
})

export type CornerTab = 'prizes' | 'tokens'

/** The prize page's sections, by kind: the families, their Shadows, the Bag's items, and the card's title and frame. */
const SECTIONS: readonly (readonly CornerPrize['kind'][])[] = [['family'], ['shadow'], ['bag'], ['title', 'frame']]

export type CornerCounterOpts = { tab: CornerTab; close: () => void }

/**
 * A prize's picture: the family standing (a Shadow in its aura), the Bag item, the title's medal or the frame. The
 * family's canvas is cut short under its feet, so a small one (Cleffa, Gimmighoul) stands whole inside the card's box.
 */
const prizeArt = (id: CornerPrizeId): HTMLElement => {
  const def = CORNER_PRIZES[id]
  if (def.kind === 'family' || def.kind === 'shadow') return standingCanvas(HATCHLINGS[def.family].line[0].dex, def.kind === 'shadow', 56, 42)
  return h('img', { src: prizeIcon(id), alt: '' })
}

const prizeIcon = (id: CornerPrizeId) => {
  const def = CORNER_PRIZES[id]
  switch (def.kind) {
    case 'family':
    case 'shadow':
      return portraitUrl(HATCHLINGS[def.family].line[0].dex)
    case 'bag':
      return bagIcon(def.item)
    case 'title':
      return medalIcon('gold')
    case 'frame':
      return frameIcon(ROCKET_FRAME)
  }
}

/** Whether the save already has what a once-only prize gives (a family, its Shadow, the title, the frame). */
const ownedHere = (id: CornerPrizeId) => {
  const save = loadSave()
  const def = CORNER_PRIZES[id]
  switch (def.kind) {
    case 'family':
      return save.hatched[def.family] !== undefined
    case 'shadow':
      return save.shadows[def.family] !== undefined
    case 'title':
      return save.titles.includes(ROCKET_TITLE)
    case 'frame':
      return save.style.owned.frame.includes(ROCKET_FRAME)
    case 'bag':
      return false
  }
}

export const openCornerCounter = (root: HTMLElement, input: Input, opts: CornerCounterOpts): Screen => {
  const c = () => t().rocket.corner
  const signedIn = () => realmFaked() || accountState().kind === 'signedIn'
  const el = h('div', { class: 'shop-layer carpentry-layer corner-layer' })
  root.append(el)
  const say = (text: string) => [{ text, emotion: 'Normal' }] as const satisfies readonly DialogueLine[]
  const first = signedIn() ? c().hello : [c().errors.guest]
  const talk = dialogue(root, input, { speaker: clerk(), lines: first.map((text) => ({ text, emotion: 'Happy' })), onDone: () => {}, className: 'shop-talk', passive: true })

  let tab: CornerTab = opts.tab
  let state: CornerState | null = null
  let busy = false
  let open: CornerPrizeId | null = null
  let closed = false

  const tabs = (['prizes', 'tokens'] as const).map((k) => h('button', { class: 'carpentry-set corner-tab', type: 'button', role: 'tab', onclick: () => switchTab(k) }, h('span', { class: 'carpentry-set-name' }, k === 'prizes' ? c().spots.prizes : c().spots.tokens)))
  const rail = h('nav', { class: 'carpentry-rail corner-rail', role: 'tablist' }, ...tabs)
  const pageHead = h('div', { class: 'carpentry-page-head' })
  const grid = h('div', { class: 'carpentry-grid corner-grid' })
  const body = h('div', { class: 'carpentry-body', tabIndex: -1 }, pageHead, grid)
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => leave() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const wallet = h('span', {})
  const tokens = h('span', {})
  const detail = h('div', { class: 'carpentry-detail', hidden: true })
  el.append(
    h(
      'section',
      { class: 'shop-sheet box carpentry-sheet corner-sheet', 'aria-label': c().name },
      h(
        'header',
        { class: 'shop-head' },
        back,
        h('h2', { class: 'shop-title' }, c().name),
        h('span', { class: 'shop-wallet corner-tokens-chip' }, h('img', { src: tokenIcon(), alt: '' }), tokens),
        h('span', { class: 'shop-wallet' }, h('img', { src: coinIcon(0), alt: '' }), wallet),
      ),
      rail,
      body,
      detail,
      h('footer', { class: 'shop-foot' }, h('span', { class: 'corner-only' }, c().onlyCoins)),
    ),
  )

  const failure = (error: string) => {
    const e = c().errors
    return error === 'funds' ? e.funds : error === 'cap' ? e.cap : error === 'tokens' ? e.tokens : error === 'owned' ? e.owned : error === 'profile' ? e.profile : error === 'guest' ? e.guest : e.failed
  }

  const taken = (id: CornerPrizeId) => prizeOnce(id) && ((state?.taken.includes(id) ?? false) || ownedHere(id))

  const tokenTag = (n: number) => h('span', { class: 'carpentry-price corner-price' }, h('img', { src: tokenIcon(), alt: '' }), formatNumber(n))

  const prizeCard = (id: CornerPrizeId) => {
    const def = CORNER_PRIZES[id]
    const have = taken(id)
    const short = (state?.tokens ?? 0) < def.price
    // A family the save doesn't have yet wears the NOVO tag, as the Safári's board does.
    const fresh = def.kind === 'family' && !have
    return h(
      'button',
      { class: `carpentry-card corner-card ${def.kind}${have ? ' owned' : ''}${short && !have ? ' short' : ''}`, type: 'button', onclick: () => !busy && show(id) },
      h('span', { class: `carpentry-art corner-art ${def.kind}` }, prizeArt(id)),
      h('span', { class: `corner-kind ${def.kind}` }, c().kinds[def.kind]),
      h('b', { class: 'carpentry-name' }, c().prizes[id]),
      h('span', { class: 'carpentry-owned' }, have ? c().owned : ''),
      h('span', { class: 'carpentry-tag' }, tokenTag(def.price)),
      fresh && h('em', { class: 'arc-tag new corner-new' }, t().minigames.safari.fresh),
    )
  }

  const blurbOf = (id: CornerPrizeId) => {
    const def = CORNER_PRIZES[id]
    const b = c().blurbs
    return def.kind === 'family' ? b[def.family] : def.kind === 'shadow' ? `${b.shadow} ${b[def.family]}` : b[def.kind]
  }

  const paintDetail = () => {
    detail.hidden = open === null
    if (open === null) return detail.replaceChildren()
    const id = open
    const def = CORNER_PRIZES[id]
    const have = taken(id)
    const short = Math.max(0, def.price - (state?.tokens ?? 0))
    const close = h('button', { class: 'btn carpentry-detail-close', type: 'button', 'aria-label': t().mart.back, onclick: () => hide() }, '✕')
    detail.replaceChildren(
      h(
        'div',
        { class: `carpentry-detail-box box pop corner-detail ${def.kind}`, role: 'dialog', 'aria-label': c().prizes[id] },
        close,
        h('div', { class: `carpentry-detail-art corner-art ${def.kind}` }, prizeArt(id)),
        h(
          'div',
          { class: 'carpentry-detail-text' },
          h('b', { class: 'carpentry-detail-name' }, c().prizes[id]),
          h('span', { class: 'carpentry-detail-meta' }, c().kinds[def.kind]),
          h('p', { class: 'carpentry-note' }, blurbOf(id)),
          have
            ? h('span', { class: 'carpentry-owned' }, c().owned)
            : h('button', { class: 'btn carpentry-buy', type: 'button', disabled: busy || short > 0, onclick: () => redeem(id) }, short > 0 ? c().short(formatNumber(short)) : c().redeem, ' ', tokenTag(def.price)),
        ),
      ),
    )
  }

  const packCard = (pack: number) => {
    const p = CORNER.packs[pack]!
    const left = CORNER.buyDaily - (state?.bought ?? 0)
    const off = p.tokens > left || p.price > loadSave().wallet
    return h(
      'button',
      { class: `carpentry-card corner-card pack${off ? ' short' : ''}`, type: 'button', disabled: busy, onclick: () => buy(pack) },
      h('span', { class: 'carpentry-art corner-art pack' }, h('img', { src: tokenIcon(), alt: '' })),
      h('b', { class: 'carpentry-name' }, `+${formatNumber(p.tokens)}`),
      h('span', { class: 'carpentry-tag' }, h('span', { class: 'carpentry-price' }, h('img', { src: coinIcon(0), alt: '' }), formatNumber(p.price))),
    )
  }

  const paint = () => {
    if (closed) return
    tabs.forEach((b, i) => {
      const on = (['prizes', 'tokens'] as const)[i] === tab
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    setText(wallet, formatNumber(loadSave().wallet))
    setText(tokens, formatNumber(state?.tokens ?? 0))
    if (tab === 'prizes') {
      pageHead.replaceChildren(h('b', { class: 'carpentry-page-name' }, c().prizesTitle), h('span', { class: 'carpentry-page-blurb' }, c().prizesNote))
      grid.replaceChildren(...SECTIONS.flatMap((kinds) => [h('b', { class: 'corner-section' }, kinds.map((k) => c().kinds[k]).join(' · ')), ...CORNER_PRIZE_IDS.filter((id) => kinds.includes(CORNER_PRIZES[id].kind)).map(prizeCard)]))
    } else {
      pageHead.replaceChildren(
        h('b', { class: 'carpentry-page-name' }, c().buyTitle),
        h('span', { class: 'carpentry-page-blurb' }, c().boughtToday(formatNumber(state?.bought ?? 0), formatNumber(CORNER.buyDaily))),
        h('span', { class: 'carpentry-page-blurb' }, c().wonToday(formatNumber(state?.won ?? 0), formatNumber(CORNER.wonDaily))),
      )
      grid.replaceChildren(...CORNER.packs.map((_, i) => packCard(i)))
    }
    paintDetail()
  }

  const fail = (error: string) => {
    playSfx('denied')
    talk.say(say(failure(error)), clerk())
  }

  const redeem = async (id: CornerPrizeId) => {
    if (busy) return
    if (!signedIn()) return fail('guest')
    busy = true
    paint()
    const got = await redeemPrize(id)
    busy = false
    if (closed) return
    if (isFailure(got)) fail(got.error)
    else {
      playSfx('buy')
      if (state) state = { ...state, tokens: got.tokens, taken: [...state.taken, id] }
      talk.say(say(c().redeemed(c().prizes[id])), clerk())
      open = null
    }
    paint()
  }

  const buy = async (pack: number) => {
    if (busy) return
    if (!signedIn()) return fail('guest')
    const p = CORNER.packs[pack]!
    if (p.price > loadSave().wallet) return fail('funds')
    busy = true
    paint()
    const got = await buyTokens(pack)
    busy = false
    if (closed) return
    if (isFailure(got)) fail(got.error)
    else {
      playSfx('buy')
      if (state) state = { ...state, tokens: got.tokens, bought: got.bought }
      talk.say(say(c().bought(formatNumber(p.tokens))), clerk())
    }
    paint()
  }

  function switchTab(k: CornerTab) {
    if (k === tab || closed) return
    playSfx('move')
    tab = k
    open = null
    body.scrollTop = 0
    paint()
  }

  function show(id: CornerPrizeId) {
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
    if (key === 'KeyQ' || key === 'KeyE' || key === 'ArrowLeft' || key === 'ArrowRight') switchTab(tab === 'prizes' ? 'tokens' : 'prizes')
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
  })

  let raf = 0
  const frame = (now: number) => {
    if (closed) return
    talk.tick?.(now)
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
    void fetchCorner().then((got) => {
      if (closed) return
      if (isFailure(got)) return fail(got.error)
      state = got
      paint()
    })

  return { el, dispose }
}
