import { playSfx } from '../engine/audio'
import type { InputKind } from '../game/bugReport'
import { t } from '../i18n'
import { chromeIntent, moveHint, onboardingStep, type InAppBrowser } from '../onboarding'
import { h, rich } from './dom'
import { boundMoveKeys } from './inputLabels'

/** Closed once, the lobby's in-app hint stays away for the rest of the visit (a sign in held back still shows it). */
const DISMISSED = 'ps:inAppHint'

const dismissed = () => {
  try {
    return sessionStorage.getItem(DISMISSED) === '1'
  } catch {
    return false
  }
}

/**
 * The way out of an app's browser: on Android a link that opens the page in
 * Chrome (`chromeIntent`), elsewhere how to do it from the app's ⋯ menu.
 */
const openWay = (app: InAppBrowser) => {
  const m = t().onboarding
  return app.os === 'android'
    ? h('a', { class: 'btn inapp-open', href: chromeIntent(new URL(location.href)), onclick: () => onboardingStep('inAppOpenBrowser') }, m.inAppOpen)
    : rich(m.inAppIos, { class: 'inapp-how' })
}

/**
 * The small strip over the top of the screen inside an app's browser: open
 * the game in a real browser to sign in and keep the progress. It never
 * blocks play; × closes it. `signIn`: a sign in was just held back
 * (`account.ts` refuses Google in a WebView), so it says why, whatever was
 * closed before. One at a time: a new one replaces the last.
 */
export const showInAppHint = (root: HTMLElement, app: InAppBrowser, signIn = false) => {
  if (!signIn && dismissed()) return null
  hideInAppHint()
  const m = t().onboarding
  const close = h('button', { class: 'inapp-close', type: 'button', 'aria-label': m.close }, '×')
  const el = h('div', { class: 'inapp-hint box pop', role: 'status' }, h('div', { class: 'inapp-text' }, h('b', {}, signIn ? m.inAppSignIn : m.inAppTitle), openWay(app)), close)
  close.addEventListener('click', (e) => {
    e.stopPropagation()
    playSfx('select')
    el.remove()
    try {
      sessionStorage.setItem(DISMISSED, '1')
    } catch {}
  })
  // A tap on the strip is its own, never the title's "press start" under it.
  el.addEventListener('click', (e) => e.stopPropagation())
  root.append(el)
  onboardingStep('inAppHintShown')
  return el
}

/** Takes the in-app hint down (the lobby opening: the intro was its place). */
export const hideInAppHint = () => {
  for (const el of document.querySelectorAll('.inapp-hint')) el.remove()
}

/** The first run's opening toast: how to move with the input at hand, and that the moves fire on their own. */
export const firstRunTip = (kind: InputKind | null, touch: boolean) => {
  const m = t().onboarding
  const hint = moveHint(kind, touch)
  const move = hint === 'pad' ? m.movePad : hint === 'touch' ? m.moveTouch : m.moveKeys(boundMoveKeys())
  return h('span', { class: 'item-toast first-run-tip' }, h('span', {}, rich(move), h('small', {}, m.auto)))
}

export type SaveCard = { el: HTMLElement; buttons: readonly { button: HTMLButtonElement; run: () => void }[] }

/**
 * The results' "save your progress" card in a guest's first runs: what an
 * account keeps (the ₽, the Pokédex, the ranking) and one button, which the
 * results put in their row: `ask` opens the choice of ways to sign in
 * (`askSignIn`), so a phone shows one clear button here and the three ways
 * (Google, Discord, email) laid out in the sheet, email the one an app's
 * browser and mainland China can use.
 */
export const saveCard = (wallet: string, dexSeen: number, ask: () => void): SaveCard => {
  const m = t().onboarding
  const button = h('button', { class: 'btn confirm save-ask', type: 'button' }, m.saveButton)
  const el = h(
    'div',
    { class: 'save-card' },
    h('b', { class: 'save-title' }, m.saveTitle),
    // The amount never breaks between ₽ and its number.
    rich(m.saveText(wallet.replace(/ /g, '\u00a0'), dexSeen), { class: 'save-text' }),
    h('div', { class: 'save-buttons' }, button),
  )
  onboardingStep('savePromptShown')
  return { el, buttons: [{ button, run: () => (onboardingStep('savePromptSignIn'), ask()) }] }
}
