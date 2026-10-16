import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { context2d } from '../engine/pixelart'
import { locale, t, type Locale } from '../i18n'
import { ENEMIES } from '../data/enemies'
import { sparkleIcon } from '../render/art'
import { logoScale, titleLogo } from '../render/logo'
import { drawPokemon, loadedSprites, loadSpecies } from '../render/sprites'
import { accountState, accountsEnabled } from '../account'
import { eggIcon } from '../render/art'
import { inviterName } from '../ranking'
import { accountChip } from './account'
import { h, later, rich } from './dom'
import { languageSwitch } from './language'
import { titleBadge } from './missions'
import { loadSave, outbreakToday } from './save'
import { menu, type Screen } from './screens'

/** Static site pages, one URL per language (they live outside the game bundle). */
const SITE_PAGES = {
  pt: { guide: '/guia/', legal: '/legal/' },
  en: { guide: '/en/guide/', legal: '/en/legal/' },
} as const satisfies Record<Locale, Record<string, string>>

const GITHUB_URL = 'https://github.com/pedrobarretto/pokemon-survivors'

export type TitleActions = {
  play: () => void
  /** Opens co-op (rooms with friends). No action (no play server), no entry. */
  coop?: () => void
  /** Opens the Desafio do dia. */
  challenge: () => void
  missions: () => void
  /** Opens the egg incubator. */
  incubator: () => void
  /** Must rebuild the title in the picked language (without the intro). */
  language: (next: Locale) => void
  /** The menu is up: after the "press start" gesture, so the browser lets audio play. */
  ready: () => void
  /**
   * Opens Settings over the title. Closing them must rebuild the title (the
   * language may have changed), highlighting `focus`. No action, no button.
   */
  settings?: (focus: number) => Screen
  /** Opens the in-game Pokédex over the title; closing it rebuilds the title on `focus`, like `settings`. */
  pokedex: (focus: number) => Screen
  /** Opens the account dialog over the title, like `settings`. No action (accounts off), no button. */
  account?: (focus: number) => Screen
  /** Opens the boards over the title, like `settings`. No action (no API), no entry. */
  ranking?: (focus: number) => Screen
}

/**
 * "Surto de hoje": the day's outbreak species, walking in its normal and
 * shiny colors side by side, with what it means. `tick` animates the sprites.
 */
const outbreakBanner = () => {
  const m = t().outbreak
  const def = ENEMIES[outbreakToday()]
  const canvas = h('canvas', { class: 'outbreak-sprites', width: 76, height: 40, 'aria-hidden': 'true' })
  void Promise.allSettled([loadSpecies(def.dex), loadSpecies(def.dex, true)])
  const el = h(
    'div',
    { class: 'outbreak-banner box' },
    canvas,
    h(
      'div',
      { class: 'outbreak-text' },
      h('small', {}, m.title),
      h('b', {}, def.name, h('img', { src: sparkleIcon(), alt: '' })),
      h('span', {}, m.blurb),
    ),
  )
  const tick = (time: number) => {
    const ctx = context2d(canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const normal = loadedSprites(def.dex)
    const shiny = loadedSprites(def.dex, true)
    if (normal) drawPokemon(ctx, normal, 'Walk', 0, time, 19, canvas.height - 4)
    if (shiny) drawPokemon(ctx, shiny, 'Walk', 0, time + 0.3, 57, canvas.height - 4)
  }
  return { el, tick }
}

/**
 * "<Name> te convidou!": a guest who came by a friend's link sees who and
 * what signing up brings (a Friendship Egg each). It shows once the
 * inviter's name comes back, and never offline; tapping it opens the account.
 */
const inviteBanner = (head: HTMLElement, open: (() => void) | null) => {
  if (!accountsEnabled || accountState().kind === 'signedIn') return
  void inviterName().then((name) => {
    if (!name || !head.isConnected || accountState().kind === 'signedIn') return
    const m = t().invite
    const el = h(
      'button',
      { class: 'invite-banner box pop', type: 'button' },
      h('img', { src: eggIcon('friend'), alt: '' }),
      h('span', { class: 'invite-text' }, rich(m.banner(name), { class: 'invite-head' }), h('span', { class: 'invite-blurb' }, m.blurb)),
    )
    if (open) el.addEventListener('click', (e) => (e.stopPropagation(), open()))
    head.append(el)
  })
}

/** Fits the logo to the viewport in whole device pixels per logo pixel. */
const fitLogo = (canvas: HTMLCanvasElement) => {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const dpr = window.devicePixelRatio || 1
  // Phones in landscape put the logo beside the menu (see CSS), so it gets half the width instead.
  const phoneLandscape = vh <= 500 && vw > vh
  const [maxW, maxH] = phoneLandscape ? [vw * 0.46, vh * 0.6] : [Math.min(vw * 0.9, 640), vh * 0.3]
  const k = logoScale(canvas.width, canvas.height, maxW, maxH, dpr)
  const width = `${(canvas.width * k) / dpr}px`
  if (canvas.style.width !== width) {
    canvas.style.width = width
    canvas.style.height = `${(canvas.height * k) / dpr}px`
  }
}

/**
 * Title screen over the live meadow: pixel logo, the day's outbreak, a blinking "press start",
 * then the main menu (Play, Daily Challenge, Incubator, Missions, Pokédex, Ranking, How to play, Settings) with the language
 * switch, the account chip (when accounts are on) and footer links. `intro: false` opens straight on the menu (coming
 * back from another screen, or after a language switch).
 */
export const titleScreen = (root: HTMLElement, input: Input, actions: TitleActions, opts: { intro?: boolean; focus?: number }): Screen => {
  const m = t().home
  const pages = SITE_PAGES[locale()]
  const { settings, account, ranking } = actions
  const items = [
    { label: m.play, run: actions.play },
    ...(actions.coop ? [{ label: m.coop, run: actions.coop }] : []),
    { label: m.challenge, run: actions.challenge },
    { label: m.incubator, run: actions.incubator },
    { label: m.missions, run: actions.missions },
    { label: m.pokedex, run: () => openOver(actions.pokedex) },
    ...(ranking ? [{ label: m.ranking, run: () => openOver(ranking) }] : []),
    { label: m.guide, run: () => location.assign(pages.guide) },
    ...(settings ? [{ label: m.settings, run: () => openOver(settings) }] : []),
  ]

  const logo = h('canvas', { class: 'title-logo', width: 1, height: 1, 'aria-hidden': 'true' })
  void titleLogo().then((sprite) => {
    logo.width = sprite.width
    logo.height = sprite.height
    context2d(logo).drawImage(sprite, 0, 0)
    fitLogo(logo)
    logo.classList.add('shown')
  })

  const prompt = h('p', { class: 'press-start blink' }, h('span', { class: 'keys-only' }, m.pressKeys), h('span', { class: 'touch-only' }, m.pressTouch))
  const menuBox = h('nav', { class: 'title-menu box pop', 'aria-label': 'Menu' })
  const footer = h(
    'footer',
    { class: 'title-footer' },
    m.fanGame,
    ' · ',
    h('a', { href: pages.legal }, m.legal),
    ' · ',
    h('a', { href: GITHUB_URL, target: '_blank', rel: 'noopener' }, 'GitHub'),
  )
  const badge = titleBadge(loadSave().title)
  const outbreak = outbreakBanner()
  const head = h('div', { class: 'title-head' }, logo, badge, outbreak.el)
  inviteBanner(head, account ? () => openOver(account) : null)
  const el = h('div', { class: 'screen title-home' }, h('h1', { class: 'sr-only' }, 'Pokémon Survivors'), head, prompt, footer)

  let nav: ReturnType<typeof menu> | null = null
  let closeLanguage: (() => void) | null = null
  let closeAccount: (() => void) | null = null
  let offIntro: (() => void) | null = null
  /** Settings or the Pokédex, open over the meadow. */
  let overScreen: Screen | null = null

  /** (Re)builds the menu buttons and their key/pointer handlers, with `focus` highlighted. */
  const showMenu = (focus: number) => {
    const buttons = items.map((item) => h('button', { class: 'title-item' }, item.label))
    nav = menu(input, buttons, (i) => {
      playSfx('select')
      // After this key dispatch, or the next screen would receive the same Enter.
      later(items[i]!.run)
    }, { initial: focus })
    closeLanguage = languageSwitch(root, input, actions.language)
    closeAccount = account ? accountChip(root, input, () => openOver(account)) : null
    menuBox.replaceChildren(...buttons)
  }

  /** Settings and the Pokédex replace the title (only the meadow stays): its keys and language switch stay off until they close and the title is rebuilt. */
  const openOver = (open: (focus: number) => Screen) => {
    const at = nav?.index ?? 0
    nav?.off()
    closeLanguage?.()
    closeAccount?.()
    nav = closeLanguage = closeAccount = null
    el.classList.add('hidden')
    overScreen = open(at)
  }

  const enterMenu = () => {
    prompt.replaceWith(menuBox)
    showMenu(Math.min(opts.focus ?? 0, items.length - 1))
    actions.ready()
  }

  if (opts.intro) {
    // Any key, pad button or tap. `later` keeps that same press from also picking "Play".
    const start = () => {
      if (!offIntro) return
      playSfx('select')
      later(enterMenu)
      offIntro()
      offIntro = null
    }
    const offKey = input.onKey(start)
    const onTap = (e: Event) => e.target instanceof Element && !e.target.closest('a') && start()
    el.addEventListener('click', onTap)
    offIntro = () => (offKey(), el.removeEventListener('click', onTap))
  } else {
    enterMenu()
  }

  root.append(el)
  return {
    el,
    dim: 0.12,
    tick: (time: number) => (overScreen?.tick?.(time), outbreak.tick(time), logo.width > 1 && fitLogo(logo)),
    dispose: () => (overScreen?.dispose(), offIntro?.(), nav?.off(), closeLanguage?.(), closeAccount?.(), el.remove()),
  }
}

/**
 * "◀ Title" entry in the starter select's top-left corner (twin of the Poké
 * Mart entry). Esc and Backspace (pad B) do the same. Returns a disposer.
 */
export const titleButton = (root: HTMLElement, input: Input, onBack: () => void) => {
  const back = () => (playSfx('move'), later(onBack))
  const el = h('button', { class: 'back-entry box', onclick: back }, h('span', { class: 'back-arrow' }, '◀'), t().home.back, h('span', { class: 'key-hint' }, 'ESC'))
  const off = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && back())
  root.append(el)
  return () => (off(), el.remove())
}
