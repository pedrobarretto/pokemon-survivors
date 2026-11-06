import { accountsEnabled } from '../account'
import { track } from '../analytics'
import { playSfx } from '../engine/audio'
import type { Input } from '../engine/input'
import { isRecord } from '../game/parse'
import { hostApp } from '../onboarding'
import { t } from '../i18n'
import { addHomeIcon, shareIcon } from '../render/art'
import { h, later, rich } from './dom'
import { countVisit, installNudgeDue, installOffer, isIos, type InstallOffer, type Visits } from './installOffer'
import { loadSave } from './save'
import { hint, menu, type Screen } from './screens'

/** Chromium's `beforeinstallprompt` event, which TypeScript's DOM types don't have. */
type PromptEvent = Event & { prompt: () => Promise<unknown>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

const isPromptEvent = (e: Event): e is PromptEvent => 'prompt' in e && typeof e.prompt === 'function' && 'userChoice' in e

/** The prompt Chromium handed over, kept for the player's tap in Settings. */
let held: PromptEvent | null = null
/** `appinstalled` fired: the tab is still a tab, but there's nothing left to offer. */
let installedNow = false
const watchers = new Set<() => void>()
const changed = () => watchers.forEach((w) => w())

// Chromium fires this once the page qualifies (manifest, icons, HTTPS; no service worker needed).
// preventDefault keeps its own mini-infobar away: Settings offers the app instead.
window.addEventListener('beforeinstallprompt', (e) => {
  if (!isPromptEvent(e)) return
  e.preventDefault()
  held = e
  changed()
})

window.addEventListener('appinstalled', () => {
  held = null
  installedNow = true
  track('install', { step: 'installed' })
  changed()
})

const runningInstalled = () =>
  matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches || ('standalone' in navigator && navigator.standalone === true)

/** How Settings → Sobre offers the app right now (see `installOffer`). */
export const currentInstallOffer = (): InstallOffer =>
  installOffer({ installed: installedNow || runningInstalled(), prompt: held !== null, ios: isIos(navigator.userAgent, navigator.maxTouchPoints) })

/** Calls `fn` whenever the offer may have changed (a prompt arrived, the app got installed). Returns the unsubscribe. */
export const onInstallChange = (fn: () => void) => {
  watchers.add(fn)
  return () => void watchers.delete(fn)
}

/**
 * Shows Chromium's install dialog. It needs a tap, click or key press: a
 * gamepad press isn't one, so `prompt()` refuses and the event stays kept for
 * the next try. Once shown, the event is spent whatever the answer (Chromium
 * may hand over a new one later).
 */
export const promptInstall = async () => {
  const e = held
  if (!e) return
  try {
    await e.prompt()
  } catch {
    return
  }
  held = null
  track('install', { step: 'prompt' })
  const { outcome } = await e.userChoice
  track('install', { step: outcome })
  changed()
}

/**
 * The iOS how-to (Settings → Sobre on an iPhone or iPad, whose Safari has no
 * install prompt): Share, then "Add to Home Screen". Home screen apps on iOS
 * keep their own storage, apart from Safari's, so with accounts it suggests
 * signing in to bring the progress along. OK, Esc or Backspace call
 * `onClose` after the key dispatch.
 */
export const installHelpScreen = (root: HTMLElement, input: Input, onClose: () => void): Screen => {
  const m = t().install
  track('install', { step: 'ios' })
  const step = (icon: string, text: string) => h('li', { class: 'install-step' }, h('img', { src: icon, alt: '' }), rich(text))
  const ok = h('button', { class: 'btn' }, m.ok)
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop account install-dialog' },
      h('div', { class: 'dialog-title' }, m.title),
      h('p', { class: 'account-line' }, m.pitch),
      h('ol', { class: 'install-steps' }, step(shareIcon(), m.share), step(addHomeIcon(), m.addHome)),
      accountsEnabled && h('p', { class: 'account-line account-note' }, m.iosStorage),
      h('div', { class: 'buttons account-buttons' }, ok),
      hint(t().account.hintKeys, t().account.hintTouch),
    ),
  )
  const nav = menu(input, [ok], () => close())
  const offKeys = input.onKey((key) => (key === 'Escape' || key === 'Backspace') && close())

  let closed = false
  const dispose = () => {
    closed = true
    nav.off()
    offKeys()
    el.remove()
  }
  const close = () => {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  return { el, dispose }
}

/* ---------------- The lobby's own offer ---------------- */

/** This device's visits (`countVisit`) and whether the lobby already offered the app (`asked`). */
const NUDGE = 'ps:installNudge'

type NudgeState = Visits & { asked: boolean }

const readNudge = (): NudgeState | null => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(NUDGE) ?? 'null')
    if (!isRecord(v) || typeof v.count !== 'number' || typeof v.last !== 'number') return null
    return { count: v.count, last: v.last, asked: v.asked === true }
  } catch {
    return null
  }
}

const writeNudge = (n: NudgeState) => {
  try {
    localStorage.setItem(NUDGE, JSON.stringify(n))
  } catch {}
}

/** This page load is a visit (counted once, as the module loads). Without storage it stays the first, so the visits alone never ask. */
const visit: NudgeState = (() => {
  const before = readNudge()
  const now = { ...countVisit(before, Date.now()), asked: before?.asked ?? false }
  writeNudge(now)
  return now
})()

/**
 * Whether the lobby opens the install offer by itself now (`installNudgeDue`):
 * once per device, so asking marks it. The offer it found, or null.
 */
export const takeInstallNudge = (): InstallOffer => {
  const offer = currentInstallOffer()
  const state = readNudge() ?? visit
  if (!installNudgeDue({ offer, inApp: hostApp() !== null, asked: state.asked, sessions: state.count, runs: loadSave().achievements.lifetime.runs })) return null
  writeNudge({ ...state, asked: true })
  return offer
}

/** Forgets that the lobby offered the app (dev tools), counting this as a second visit so it asks again at the next lobby. */
export const forgetInstallNudge = () => writeNudge({ count: 2, last: Date.now(), asked: false })

/**
 * The lobby's install offer (`takeInstallNudge`): the pitch, Instalar and
 * Agora não. Instalar shows Chromium's prompt (the press is the gesture it
 * needs) or, on iOS, the how-to in its place. Agora não, Esc or Backspace
 * close it, and Settings → Sobre keeps offering. `onClose` runs after the
 * key dispatch.
 */
export const installNudgeScreen = (root: HTMLElement, input: Input, offer: Exclude<InstallOffer, null>, onClose: () => void): Screen => {
  const m = t().install
  const yes = h('button', { class: 'btn confirm' }, m.install)
  const no = h('button', { class: 'btn' }, m.later)
  const el = h(
    'div',
    { class: 'screen dim' },
    h(
      'div',
      { class: 'dialog box pop account install-dialog install-nudge' },
      h('div', { class: 'dialog-title' }, m.title),
      h('img', { class: 'install-nudge-icon', src: '/icons/icon-192.png', alt: '' }),
      h('p', { class: 'account-line' }, m.nudge),
      h('div', { class: 'buttons account-buttons' }, yes, no),
      hint(t().account.hintKeys, t().account.hintTouch),
    ),
  )
  /** The iOS how-to, open in this screen's place. */
  let sub: Screen | null = null
  let closed = false
  const nav = menu(input, [yes, no], (i) => (i === 0 ? install() : close()), { horizontal: true })
  const offKeys = input.onKey((key) => !sub && (key === 'Escape' || key === 'Backspace') && close())

  const install = () => {
    if (offer === 'prompt') {
      // Straight from the press: Chromium shows its dialog only for a user gesture.
      void promptInstall()
      return close()
    }
    playSfx('select')
    nav.off()
    offKeys()
    el.classList.add('hidden')
    sub = installHelpScreen(root, input, () => ((sub = null), finish()))
  }

  const dispose = () => {
    closed = true
    sub?.dispose()
    nav.off()
    offKeys()
    el.remove()
  }
  const finish = () => {
    if (closed) return
    dispose()
    onClose()
  }
  function close() {
    if (closed) return
    playSfx('select')
    dispose()
    later(onClose)
  }

  root.append(el)
  return { el, dispose }
}
