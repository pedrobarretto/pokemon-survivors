import type { VersusPick } from '../data/versus'
import { PLAYABLE } from '../data/hatchlings'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { gemsSignedIn, onGems } from '../gems'
import { t } from '../i18n'
import { gemIconUrl, slotIconUrl } from '../render/gemArt'
import { wearsLooks } from '../render/wearables'
import { dialogue } from './dialogue'
import { h, later } from './dom'
import { gemChip, lockerTab, pickWearer, shopTab, type GemTab, type GemTabId, type GemTabsContext, type Wearer } from './gemShop'
import { loadSave } from './save'
import { hint, type Screen } from './screens'
import { tailorSpeaker } from './visitors'

/** Set once the player first opens the Boutique on this device: its NOVO tags (the Kecleon shop's button, the Trainer Card's row) and Leavanny's long hello go for good. */
const SEEN = 'ps:boutiqueSeen'

export const boutiqueSeen = () => {
  try {
    return localStorage.getItem(SEEN) !== null
  } catch {
    return true
  }
}

export const markBoutiqueSeen = () => {
  try {
    localStorage.setItem(SEEN, '1')
  } catch {
    // Private modes may refuse: the tags and the long hello just show again next time.
  }
}

/** A NOVO tag for the Boutique's ways in, until it's first opened (null after). */
export const boutiqueFresh = () => (boutiqueSeen() ? null : h('em', { class: 'lobby-new boutique-new' }, t().coop.fresh))

export const BOUTIQUE_TABS = ['shop', 'locker'] as const satisfies readonly GemTabId[]
export type BoutiqueTab = (typeof BOUTIQUE_TABS)[number]

/**
 * `close`: Voltar (the lobby pans home). `signIn`: the way to an account
 * (null in a build without accounts). `pick`: the Arena's Pokémon, who wears
 * the previews when the partner can't (no anchors), and `keepPick` saves the
 * one Visual's picker takes. `checkout`: the ref the page came back from a gem
 * pack's checkout with (`?gems=<ref>`), so Loja opens on its return sheet.
 */
export type BoutiqueOpts = {
  close: () => void
  tab: BoutiqueTab
  signIn: (() => void) | null
  pick: VersusPick
  keepPick: (id: VersusPick) => void
  checkout: string | null
}

/**
 * Leavanny's Boutique over the plaza (`TitleActions.boutique`): the gem shop
 * as a standalone sheet laid out as the Kecleon shop's (`.shop-sheet`), with
 * its Loja and Visual tabs (`ui/gemShop.ts`, the same pages the Arena hub
 * leads to), the gem chip in its head, and Leavanny's passive box beside it.
 * The previews dress the lobby's partner when it can wear looks, the Arena
 * pick otherwise; picking a Pokémon in Visual dresses that one instead.
 * Guests browse and try things on; buying or wearing asks them to sign in.
 * Q E (or ← →) switch tabs, ↑ ↓ scroll, Esc goes back.
 */
export const openBoutique = (root: HTMLElement, input: Input, opts: BoutiqueOpts): Screen => {
  const m = t().boutique
  markBoutiqueSeen()
  const el = h('div', { class: 'shop-layer boutique-layer' })
  root.append(el)
  const talk = dialogue(root, input, { speaker: tailorSpeaker(), lines: [{ text: gemsSignedIn() ? m.browse : m.guest, emotion: 'Happy' }], onDone: () => {}, className: 'shop-talk', passive: true })

  const form = PLAYABLE[loadSave().partner].line[0]
  const partner: Wearer = { dex: form.dex, name: form.name }
  /** The roster Pokémon Visual's picker took, which then wears the previews; null: the partner (or the Arena pick) does. */
  let chosen: VersusPick | null = null
  let tab: BoutiqueTab = opts.tab
  let closed = false

  const ctx: GemTabsContext = {
    root,
    input,
    signIn: opts.signIn,
    // The partner tries things on when its species can wear looks (it has anchors), the Arena pick otherwise (and while the wearables' engine loads).
    wearer: () => (chosen ? pickWearer(chosen) : wearsLooks(partner.dex) ? partner : pickWearer(opts.pick)),
    pick: () => chosen,
    setPick: (id) => {
      chosen = id
      opts.keepPick(id)
    },
    goTab: (id) => switchTab(id),
  }
  // Each page is made the first time it shows and kept (with its preview) across tab switches.
  const pages: Partial<Record<BoutiqueTab, GemTab>> = {}
  const page = (id: BoutiqueTab) => (pages[id] ??= id === 'shop' ? shopTab(ctx, opts.checkout) : lockerTab(ctx))
  const busy = () => pages.shop?.busy() === true || pages.locker?.busy() === true

  const icons = { shop: gemIconUrl(), locker: slotIconUrl('head') } as const satisfies Record<BoutiqueTab, string>
  const tabs = BOUTIQUE_TABS.map((id) =>
    h(
      'button',
      { class: `shop-tab boutique-page ${id}`, type: 'button', role: 'tab', onclick: () => !busy() && switchTab(id) },
      h('img', { src: icons[id], alt: '' }),
      m.tabs[id],
    ),
  )
  const body = h('div', { class: 'boutique-body', tabIndex: -1 })
  const back = h('button', { class: 'btn shop-back', type: 'button', 'aria-label': t().mart.back, onclick: () => !busy() && leave() }, '◀', h('span', { class: 'shop-back-label' }, ` ${t().mart.back}`))
  const chip = gemChip(() => switchTab('shop'))
  el.append(
    h(
      'section',
      { class: 'shop-sheet box boutique-sheet', 'aria-label': m.title },
      h('header', { class: 'shop-head' }, back, h('h2', { class: 'shop-title' }, m.title), ...(chip ? [chip] : [])),
      h('nav', { class: 'shop-tabs', role: 'tablist' }, ...tabs),
      body,
      h('footer', { class: 'shop-foot' }, hint(m.hintKeys, m.hintTouch)),
    ),
  )

  const paint = () => {
    tabs.forEach((b, i) => {
      const on = BOUTIQUE_TABS[i] === tab
      b.classList.toggle('on', on)
      b.setAttribute('aria-selected', String(on))
    })
    const shown = page(tab)
    if (body.firstChild !== shown.el || body.childNodes.length !== 1) body.replaceChildren(shown.el)
    shown.enter()
  }

  function switchTab(id: BoutiqueTab) {
    if (id === tab || closed) return
    playSfx('move')
    tab = id
    body.scrollTop = 0
    paint()
  }

  function leave() {
    if (closed) return
    closed = true
    playSfx('select')
    later(opts.close)
  }

  const off = input.onKey((key) => {
    // A page's sheet or dialog (a checkout, a confirm) has the keys meanwhile.
    if (closed || busy()) return
    const at = BOUTIQUE_TABS.indexOf(tab)
    if (key === 'KeyQ' || key === 'PageUp' || key === 'ArrowLeft') switchTab(BOUTIQUE_TABS[(at + BOUTIQUE_TABS.length - 1) % BOUTIQUE_TABS.length]!)
    else if (key === 'KeyE' || key === 'PageDown' || key === 'ArrowRight') switchTab(BOUTIQUE_TABS[(at + 1) % BOUTIQUE_TABS.length]!)
    else if (key === 'ArrowUp' || key === 'ArrowDown') body.scrollBy({ top: key === 'ArrowUp' ? -80 : 80 })
    else if (key === 'Escape' || key === 'Backspace') leave()
  })
  // Signing in (or out) meanwhile: Leavanny says the line for it.
  let signedIn = gemsSignedIn()
  const offGems = onGems(() => {
    if (gemsSignedIn() === signedIn) return
    signedIn = gemsSignedIn()
    talk.say([{ text: signedIn ? m.browse : m.guest, emotion: 'Happy' }], tailorSpeaker())
  })

  paint()
  return {
    el,
    tick: (time) => talk.tick?.(time),
    dispose: () => {
      closed = true
      off()
      offGems()
      pages.shop?.dispose()
      pages.locker?.dispose()
      talk.dispose()
      el.remove()
    },
  }
}
