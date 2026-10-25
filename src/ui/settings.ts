import { playSfx, setMix } from '../engine/audio'
import { BUTTON_SIDES, STICK_EDGES, STICK_HEIGHTS, STICK_MODES, type Input } from '../engine/input'
import { clamp } from '../engine/math'
import { locale, LOCALE_IDS, LOCALES, setLocale, t, type Locale } from '../i18n'
import { TRANSLATORS } from '../data/translators'
import { bugReportsEnabled } from '../bugReport'
import { bugReportForm } from './bugReport'
import { openControls } from './controls'
import { h, later } from './dom'
import { DAMAGE_NUMBERS } from '../render/damageNumbers'
import { FLASH_MODES } from '../render/flashes'
import { RUN_TOASTS } from './toastQueue'
import { loadSettings, MIN_ATTACK_OPACITY, MINIMAP_MODES, writeSettings, type Settings } from './save'
import { coopUrl } from '../coopShell'
import { hint, menu, type Screen } from './screens'
import { backButton, shellBody, tabStrip, topBar, segmented } from './shell'
import { REPO_URL, ROUTES, SOCIAL_IDS, SOCIALS } from '../site/routes'
import { applyUiScale, maxUiZoom, UI_SCALES, uiZoom, type UiScale } from './uiScale'
import { safeModeOn, setSafeMode } from '../safeMode'
import { currentInstallOffer, installHelpScreen, onInstallChange, promptInstall } from './install'

/* ---------------- Live settings ---------------- */

/**
 * Pushes settings out to where they act: the audio mix, `data-stick` for the
 * HUD's CSS (the status box moves off the fixed stick), `data-hand`,
 * `data-stick-height` and `data-stick-edge` (the touch buttons' side and the
 * fixed stick's place), `data-flashes` (reduced hides the shell's white screen
 * flash), and the UI size.
 */
const apply = (s: Settings) => {
  setMix(s)
  const root = document.documentElement.dataset
  root.stick = s.joystick
  root.hand = s.buttonSide
  root.stickHeight = s.stickHeight
  root.stickEdge = s.stickEdge
  root.flashes = s.flashes
  applyUiScale(s.uiScale)
}

let current = loadSettings()
apply(current)
// The UI size depends on the viewport too (`auto`, and the room it leaves).
window.addEventListener('resize', () => applyUiScale(current.uiScale))

/** Redraws the open settings screen when a change comes from elsewhere (the M key). */
let refresh: (() => void) | null = null

/** Current settings. Read them where they apply (render options, audio mix): they change mid-run. */
export const settings = (): Settings => current

/** Applies, persists and shows a change. */
export const updateSettings = (patch: Partial<Settings>) => {
  current = { ...current, ...patch }
  writeSettings(current)
  apply(current)
  refresh?.()
}

/** The `M` key. */
export const toggleMute = () => updateSettings({ muted: !current.muted })

export const isSettingsOpen = () => refresh !== null

/* ---------------- Screen ---------------- */

/** One focusable line. `adjust` handles ← →, `activate` Enter or a tap, `sync` redraws its value. */
type Row = { el: HTMLElement; adjust: (dir: -1 | 1) => void; activate: () => void; sync: () => void }

const SLIDER_STEPS = 10

/** The settings a slider sets: fractions from 0 to 1. */
type SliderKey = 'musicVolume' | 'sfxVolume' | 'attackOpacity' | 'teamAttackOpacity'

/** A bar of growing pixel cells (volumes, opacities). Tap a cell or drag across it; ← → step by 10%, never under `min` cells. */
const slider = (label: string, key: SliderKey, preview?: () => void, min = 0): Row => {
  const cells = Array.from({ length: SLIDER_STEPS }, (_, i) => h('span', { class: 'slider-cell', style: `--h:${40 + i * 6}%` }))
  const value = h('b', { class: 'setting-value' })
  const bar = h('div', { class: 'slider', role: 'slider', 'aria-label': label, 'aria-valuemin': 0, 'aria-valuemax': 100 }, ...cells)
  const level = () => Math.round(current[key] * SLIDER_STEPS)
  const set = (next: number) => {
    const steps = clamp(next, min, SLIDER_STEPS)
    if (steps === level()) return
    const patch: Partial<Settings> = {}
    patch[key] = steps / SLIDER_STEPS
    updateSettings(patch)
    preview?.()
  }
  const fromPointer = (e: PointerEvent) => {
    const rect = bar.getBoundingClientRect()
    set(Math.round(((e.clientX - rect.left) / rect.width) * SLIDER_STEPS))
  }
  bar.addEventListener('pointerdown', (e) => (bar.setPointerCapture(e.pointerId), fromPointer(e)))
  bar.addEventListener('pointermove', (e) => bar.hasPointerCapture(e.pointerId) && fromPointer(e))
  const el = h('div', { class: 'setting-row setting-slider' }, h('span', { class: 'setting-label' }, label), value, bar)
  return {
    el,
    adjust: (dir) => set(level() + dir),
    activate: () => {},
    sync: () => {
      const n = level()
      cells.forEach((c, i) => c.classList.toggle('on', i < n))
      value.textContent = `${n * (100 / SLIDER_STEPS)}%`
      bar.setAttribute('aria-valuenow', String(n * (100 / SLIDER_STEPS)))
    },
  }
}

/** An ON/OFF switch over any boolean: Enter, a tap or ← → flips it. */
const switchRow = (label: string, read: () => boolean, set: (on: boolean) => void): Row => {
  const pill = h('b', { class: 'setting-pill' })
  const el = h('button', { class: 'setting-row', role: 'switch' }, h('span', { class: 'setting-label' }, label), pill)
  const flip = () => {
    set(!read())
    playSfx('select')
    sync()
  }
  const sync = () => {
    const on = read()
    pill.textContent = on ? t().settings.on : t().settings.off
    pill.classList.toggle('off', !on)
    el.setAttribute('aria-checked', String(on))
  }
  return { el, adjust: flip, activate: flip, sync }
}

/** A switch over one of the settings. */
const toggle = (label: string, read: (s: Settings) => boolean, write: (on: boolean) => Partial<Settings>): Row =>
  switchRow(label, () => read(current), (on) => updateSettings(write(on)))

/** `◀ Reduced ▶`: ← → step through `options`, Enter or a tap goes to the next one (wrapping). `changed` runs after each step. */
const choiceRow = <K extends keyof Settings>(label: string, key: K, options: readonly Settings[K][], name: (v: Settings[K]) => string, changed?: () => void): Row => {
  const value = h('b', { class: 'setting-choice' })
  const el = h('button', { class: 'setting-row' }, h('span', { class: 'setting-label' }, label), value)
  const step = (dir: -1 | 1) => {
    const n = options.length
    const patch: Partial<Settings> = {}
    patch[key] = options[(options.indexOf(current[key]) + dir + n) % n]
    updateSettings(patch)
    playSfx('select')
    changed?.()
  }
  return {
    el,
    adjust: step,
    activate: () => step(1),
    sync: () => {
      value.textContent = `◀ ${name(current[key])} ▶`
    },
  }
}

const percent = (zoom: number) => `${Math.round(zoom * 100)}%`

/**
 * `◀ Auto (125%) ▶`: the UI size steps that fit this viewport (`maxUiZoom`), or
 * no row where only 100% does (phones, small windows). Shows the zoom in use,
 * so a stored size the window can't fit reads as what it got.
 */
const uiScaleRows = (label: string, auto: string): Row[] => {
  const room = maxUiZoom(window.innerWidth, window.innerHeight)
  if (room <= 1) return []
  const options = UI_SCALES.filter((s) => s === 'auto' || s <= room)
  return [choiceRow(label, 'uiScale', options, (s: UiScale) => (s === 'auto' ? `${auto} (${percent(uiZoom())})` : percent(uiZoom())))]
}

/** PT / EN / ES, picked on a tap or ← →. `pick` switches the language and must rebuild the screen. */
const languageRow = (pick: (next: Locale) => void): Row => {
  const seg = segmented(
    LOCALE_IDS.map((id) => ({ id, label: LOCALES[id].short, lang: LOCALES[id].tag, title: LOCALES[id].name })),
    locale(),
    pick,
  )
  const el = h('div', { class: 'setting-row column', role: 'group', 'aria-label': t().language }, h('span', { class: 'setting-label' }, t().language), seg.el)
  const step = (dir: -1 | 1) => pick(LOCALE_IDS[(LOCALE_IDS.indexOf(locale()) + dir + LOCALE_IDS.length) % LOCALE_IDS.length]!)
  return { el, adjust: step, activate: () => step(1), sync: () => seg.set(locale()) }
}

/** Opens a screen on top (the remap screen, the bug report form): Enter, a tap or →. */
const openRow = (label: string, open: () => void): Row => {
  const el = h('button', { class: 'setting-row' }, h('span', { class: 'setting-label' }, label), h('b', { class: 'setting-choice' }, '▶'))
  return { el, adjust: (dir) => dir > 0 && open(), activate: open, sync: () => {} }
}

/** A link out of the game (Sobre): Enter or a tap follows it (the menu's tap, so a fresh screen's guard applies). */
const linkRow = (label: string, href: string, external = false): Row => {
  const el = h(
    'a',
    { class: 'setting-row', href, onclick: (e: Event) => e.preventDefault() },
    h('span', { class: 'setting-label' }, label),
    h('b', { class: 'setting-choice' }, '▶'),
  )
  return { el, adjust: () => {}, activate: () => (external ? window.open(href, '_blank', 'noopener') : location.assign(href)), sync: () => {} }
}

/**
 * Instalar o app (Sobre), only while the game can be installed and isn't
 * running installed: Chromium's own prompt, or on iOS the Share → "Add to
 * Home Screen" how-to (`openHelp`).
 */
const installRows = (label: string, openHelp: () => void): Row[] => {
  const offer = currentInstallOffer()
  if (!offer) return []
  const go = () => (offer === 'prompt' ? (playSfx('select'), void promptInstall()) : openHelp())
  const el = h('button', { class: 'setting-row install-row' }, h('span', { class: 'setting-label' }, label), h('b', { class: 'setting-choice' }, '▶'))
  return [{ el, adjust: (dir) => dir > 0 && go(), activate: go, sync: () => {} }]
}

/** A touchscreen without a mouse: the on-screen buttons and the stick show. Same query as `finePointer` in main.ts. */
const touchControls = () => !matchMedia('(hover: hover) and (pointer: fine)').matches

const TABS = ['sound', 'game', 'controls', 'about'] as const

type Tab = (typeof TABS)[number]

/** The tab Settings opened on last, so the pause menu comes back to the same place. */
let lastTab: Tab = 'sound'

/**
 * Settings in four tabs: Som (music and effects volume, mute), Jogo
 * (language, damage numbers, screen shake, flashes, run alerts, the mini map, move opacity, UI size, safe mode), Controles
 * (touch joystick, the buttons' side and the fixed stick's place on touchscreens, and the remap screen) and Sobre
 * (installing the app, what the game is, legal and
 * credits, GitHub, the official profiles, and the bug report form when there's an API to send it to).
 * Changes apply and persist immediately.
 *
 * Opens on top of whatever is on screen (`root` is `#ui`, `input` the shared
 * input), with a top bar whose ◀ closes it like Esc or Backspace (gamepad B):
 * it removes itself, then calls `onClose` after the current key dispatch. The
 * tab strip is the first line: ← → on it switch tabs, ↑ ↓ walk the rows. The
 * language may have changed by then, so `onClose` should rebuild any text it
 * owns. `dispose` closes it without calling `onClose` (e.g. when the caller's
 * own screen goes away).
 */
export const openSettings = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const el = h('div', { class: 'screen shell dim settings-screen' })
  let rows: Row[] = []
  let nav: ReturnType<typeof menu> | null = null
  /** The remap screen open on top: this one hides and ignores keys until it closes. */
  let sub: Screen | null = null
  let away = false
  let tab: Tab = lastTab

  const sync = () => rows.forEach((r) => r.sync())

  const pickLanguage = (next: Locale) => {
    if (next === locale()) return
    setLocale(next)
    playSfx('select')
    // Rebuild after this key dispatch, or the new rows would receive the same press.
    later(() => build(nav?.index ?? 0, false))
  }

  const showTab = (next: Tab, focus: number) => {
    if (next === tab) return
    tab = lastTab = next
    playSfx('move')
    later(() => build(focus, false))
  }

  /** The rows of each tab. */
  const tabRows = (which: Tab): Row[] => {
    const m = t().settings
    const lang = locale()
    switch (which) {
      case 'sound':
        return [
          slider(m.music, 'musicVolume'),
          slider(m.sfx, 'sfxVolume', () => playSfx('pickup', 90)),
          toggle(m.sound, (s) => !s.muted, (on) => ({ muted: !on })),
        ]
      case 'game':
        return [
          languageRow(pickLanguage),
          choiceRow(m.damageNumbers, 'damageNumbers', DAMAGE_NUMBERS, (mode) => m.damageModes[mode]),
          toggle(m.screenShake, (s) => s.screenShake, (on) => ({ screenShake: on })),
          choiceRow(m.flashes, 'flashes', FLASH_MODES, (mode) => m.flashModes[mode]),
          choiceRow(m.runToasts, 'runToasts', RUN_TOASTS, (mode) => m.runToastModes[mode]),
          choiceRow(m.minimap, 'minimap', MINIMAP_MODES, (mode) => m.minimapModes[mode]),
          slider(m.attackOpacity, 'attackOpacity', undefined, MIN_ATTACK_OPACITY * SLIDER_STEPS),
          // Teammates' moves only matter in a build with co-op.
          ...(coopUrl() ? [slider(m.teamAttackOpacity, 'teamAttackOpacity', undefined, MIN_ATTACK_OPACITY * SLIDER_STEPS)] : []),
          ...uiScaleRows(m.uiScale, m.uiScaleAuto),
          // Safe mode is the device's, not a setting (`safeMode.ts`): a crash turns it on by itself.
          switchRow(m.safeMode, safeModeOn, (on) => setSafeMode(on ? 'on' : 'off')),
        ]
      case 'controls':
        return [
          // The joystick mode shows or hides the fixed stick's place: rebuild after this key dispatch.
          choiceRow(m.joystick, 'joystick', STICK_MODES, (mode) => m.joystickModes[mode], () => later(() => build(nav?.index ?? 0, false))),
          ...(touchControls()
            ? [
                choiceRow(m.buttonSide, 'buttonSide', BUTTON_SIDES, (side) => m.buttonSides[side]),
                ...(current.joystick === 'fixed'
                  ? [
                      choiceRow(m.stickHeight, 'stickHeight', STICK_HEIGHTS, (step) => m.stickHeights[step]),
                      choiceRow(m.stickEdge, 'stickEdge', STICK_EDGES, (step) => m.stickEdges[step]),
                    ]
                  : []),
              ]
            : []),
          openRow(t().controls.open, () => showSub(openControls)),
        ]
      case 'about':
        return [
          ...(bugReportsEnabled ? [openRow(m.reportBug, () => showSub(bugReportForm))] : []),
          ...installRows(m.install, () => showSub(installHelpScreen)), linkRow(m.guide, ROUTES.guide[lang]), linkRow(m.legal, ROUTES.legal[lang]), linkRow(m.github, REPO_URL, true),
          ...SOCIAL_IDS.map((id) => linkRow(t().socials.follow(SOCIALS[id].name), SOCIALS[id].url, true))]
    }
  }

  /** `opening` plays the pop-in; rebuilds after a language or tab switch don't. */
  const build = (focus: number, opening: boolean) => {
    const m = t().settings
    const strip = tabStrip(TABS.map((id) => m.tabs[id]), TABS.indexOf(tab), (i) => showTab(TABS[i]!, 0))
    const at = TABS.indexOf(tab)
    const tabsRow: Row = {
      el: strip.el,
      adjust: (dir) => showTab(TABS[(at + dir + TABS.length) % TABS.length]!, 0),
      activate: () => rows.length > 1 && nav?.focus(1),
      sync: () => {},
    }
    const content = tabRows(tab)
    rows = [tabsRow, ...content]
    nav?.off()
    nav = menu(input, rows.map((r) => r.el), (i) => rows[i]?.activate(), { initial: Math.min(focus, rows.length - 1) })
    el.replaceChildren(
      topBar({ left: backButton(close), title: m.title }),
      shellBody(
        h(
          'div',
          { class: opening ? 'settings-panel pop' : 'settings-panel' },
          strip.el,
          h(
            'div',
            { class: 'box settings-rows', role: 'tabpanel' },
            tab === 'about'
              ? h('p', { class: 'settings-about' }, m.about, h('small', {}, t().title.credits), ...TRANSLATORS.map((tr) => h('small', {}, m.reviewedBy(m.languages[tr.locale], tr.name, tr.handle))))
              : null,
            ...content.map((r) => r.el),
          ),
          hint(m.hintKeys, m.hintTouch),
        ),
      ),
    )
    sync()
  }

  /** Opens a screen on top (the remap screen, the iOS install how-to); this one comes back when it closes. */
  const showSub = (open: (root: HTMLElement, input: Input, onClose: () => void) => Screen) => {
    playSfx('select')
    nav?.off()
    away = true
    el.classList.add('hidden')
    // Open after this key dispatch, or the new screen would receive the same press.
    later(() => {
      if (!el.isConnected) return
      sub = open(root, input, () => {
        sub = null
        away = false
        el.classList.remove('hidden')
        build(nav?.index ?? 0, false)
      })
    })
  }

  const offKeys = input.onKey((key) => {
    if (away) return
    const row = nav && rows[nav.index]
    if (key === 'ArrowLeft' || key === 'KeyA') row?.adjust(-1)
    else if (key === 'ArrowRight' || key === 'KeyD') row?.adjust(1)
    else if (key === 'Escape' || key === 'Backspace') close() // Backspace is also the gamepad's B
  })

  // A prompt arriving or the app getting installed while Sobre is open shows or hides its row.
  const offInstall = onInstallChange(() => !away && tab === 'about' && build(nav?.index ?? 0, false))

  const dispose = () => {
    sub?.dispose()
    nav?.off()
    offKeys()
    offInstall()
    el.remove()
    if (refresh === sync) refresh = null
  }

  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    playSfx('select')
    dispose()
    later(onClose)
  }

  // The first row, not the tab strip: ← → there adjust it right away.
  build(1, true)
  refresh = sync
  root.append(el)
  return { el, dispose }
}
