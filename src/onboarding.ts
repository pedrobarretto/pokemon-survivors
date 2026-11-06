/**
 * A new visitor's way into the first run, and the sign-in asks around it:
 * a device that never played skips the lobby, the sign-in gate and the
 * partner select (`firstRunDue`); a guest who chose to play as one isn't
 * asked again for a while (`guestGateDue`); and an app's in-app browser
 * (Instagram, Facebook, TikTok…), where Google refuses to sign in, plays
 * as a guest with a hint to open the game in a real browser (`inAppBrowser`).
 */

/** The apps whose in-app browsers we recognize, and `webview` for any other Android WebView. */
export type InAppApp = 'instagram' | 'facebook' | 'threads' | 'tiktok' | 'x' | 'line' | 'snapchat' | 'linkedin' | 'wechat' | 'kakao' | 'pinterest' | 'webview'

export type InAppBrowser = { app: InAppApp; os: 'android' | 'ios' | 'other' }

/** Checked in order: Threads and Messenger's agents also carry Facebook's and Instagram's markers. */
const IN_APP: readonly (readonly [InAppApp, RegExp])[] = [
  ['threads', /\bBarcelona\b|\bThreads\b/],
  ['instagram', /\bInstagram\b/],
  ['facebook', /\bFBAN\/|\bFBAV\/|\bFB_IAB\/|\bFBIOS\b|\bFB4A\b|\bMessenger(?:ForiOS|Lite)?\b/],
  ['tiktok', /\bmusical_ly\b|\bBytedanceWebview\b|\bTikTok\b|\btrill_\d|\bByteLocale\b/],
  ['x', /\bTwitter(?:Android)?\b/],
  ['line', /\bLine\/\d/],
  ['snapchat', /\bSnapchat\b/],
  ['linkedin', /\bLinkedInApp\b/],
  ['wechat', /\bMicroMessenger\b/],
  ['kakao', /\bKAKAOTALK\b/i],
  ['pinterest', /\bPinterest\b/],
  // Any other app's Android WebView marks itself `; wv)` (Chrome, a PWA and Custom Tabs don't).
  ['webview', /; wv\)/],
]

/** The in-app browser a user agent belongs to, or null for a real browser. */
export const inAppBrowser = (ua: string): InAppBrowser | null => {
  const app = IN_APP.find(([, re]) => re.test(ua))?.[0]
  if (!app) return null
  const os = /\bAndroid\b/.test(ua) ? 'android' : /\b(?:iPhone|iPad|iPod)\b/.test(ua) ? 'ios' : 'other'
  return { app, os }
}

/** This page's in-app browser, read once. */
export const hostApp = (): InAppBrowser | null => (typeof navigator === 'undefined' ? null : inAppBrowser(navigator.userAgent))

/**
 * The Android intent that opens `url` in Chrome, out of the app's WebView.
 * The URL's query and hash go along (a `?ref=`, a room).
 */
export const chromeIntent = (url: URL) => `intent://${url.host}${url.pathname}${url.search}${url.hash}#Intent;scheme=https;package=com.android.chrome;end`

/** A device whose save never finished a run, and that isn't signed in to an account (whose save may still be on its way). */
export const firstRunDue = (runs: number, signedIn: boolean) => runs === 0 && !signedIn

/** How long "Jogar como convidado" holds: the gate asks again after it. */
export const GUEST_GATE_PAUSE = 3 * 24 * 60 * 60 * 1000

/** Whether the play gate asks a guest again, `chosenAt` being when they last picked "Jogar como convidado" (null: never). */
export const guestGateDue = (chosenAt: number | null, now: number) => chosenAt === null || now - chosenAt >= GUEST_GATE_PAUSE || now < chosenAt

/** Guests see the results' "save your progress" card in their first runs (counted after the run is banked). */
export const SAVE_PROMPT_RUNS = 3

/** Whether a guest's results show the "save your progress" card, `runs` counting the run just banked. */
export const savePromptDue = (runs: number) => runs >= 1 && runs <= SAVE_PROMPT_RUNS

const GUEST_KEY = 'ps:guestChosen'

/** When this device last chose to play as a guest at the gate, or null. */
export const guestChosenAt = (): number | null => {
  try {
    const v = Number(localStorage.getItem(GUEST_KEY))
    return Number.isFinite(v) && v > 0 ? v : null
  } catch {
    return null
  }
}

/** Remembers "Jogar como convidado" on this device (`guestGateDue`). */
export const rememberGuest = (now = Date.now()) => {
  try {
    localStorage.setItem(GUEST_KEY, String(now))
  } catch {}
}

/**
 * The onboarding's moments, for whoever listens (analytics, `onOnboarding`):
 * the fast lane starting a first run, the gate skipped or answered as a guest,
 * the results' save card shown or pressed, the in-app hint shown or its
 * browser link pressed, and a sign in an in-app browser held back.
 */
export type OnboardingStep =
  | 'fastLane'
  | 'gateSkipped'
  | 'gateGuest'
  | 'savePromptShown'
  | 'savePromptSignIn'
  | 'inAppHintShown'
  | 'inAppOpenBrowser'
  | 'inAppSignInHeld'

type Listener = (step: OnboardingStep) => void
const listeners = new Set<Listener>()

/** Calls `fn` on every onboarding moment; returns the unsubscribe. */
export const onOnboarding = (fn: Listener) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

export const onboardingStep = (step: OnboardingStep) => {
  for (const fn of listeners) fn(step)
}
