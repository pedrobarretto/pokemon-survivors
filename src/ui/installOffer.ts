/** What the browser says about installing the game (`install.ts` reads it). */
export type InstallEnv = {
  /** Running as the installed app (`display-mode` fullscreen or standalone, iOS's `navigator.standalone`), or just installed. */
  installed: boolean
  /** Chromium handed over its install prompt (`beforeinstallprompt`). */
  prompt: boolean
  ios: boolean
}

/** How Settings offers the app: Chromium's own `prompt`, the `ios` how-to sheet (Safari has no prompt API), or not at all. */
export type InstallOffer = 'prompt' | 'ios' | null

export const installOffer = (env: InstallEnv): InstallOffer => (env.installed ? null : env.prompt ? 'prompt' : env.ios ? 'ios' : null)

/** iPhone, iPod and iPad, iPadOS's Safari included: it says Macintosh, but Macs have no touch screen. */
export const isIos = (userAgent: string, touchPoints: number) => /iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && touchPoints > 1)

/**
 * A social app's own browser (Instagram, Facebook, TikTok, X, Line,
 * Snapchat, an Android WebView…): it can't install the game, and its share
 * sheet isn't Safari's, so the lobby never offers there.
 * TODO: reuse the in-app check of feat/first-run-fast-lane once it lands.
 */
export const isInAppBrowser = (userAgent: string) =>
  /FBAN|FBAV|FB_IAB|FBIOS|Instagram|TikTok|musical_ly|Bytedance|Twitter|Line\/|Snapchat|Pinterest|LinkedInApp|MicroMessenger|GSA\/|; wv\)/i.test(userAgent)

/** The lobby's own install offer: proactive, once per device, never in a run (`installNudgeDue`). */
export const INSTALL_NUDGE = {
  /** Visits to the game (`countVisit`) before it may ask… */
  sessions: 2,
  /** …or runs played, whichever comes first. */
  runs: 3,
  /** Minutes away from the game that make the next page load a new visit. */
  gapMinutes: 30,
} as const

/** The device's visits, as `countVisit` keeps them: how many, and when the game was last opened (ms). */
export type Visits = { count: number; last: number }

/** The visits after a page load at `now`: a new one after `gapMinutes` away, else the same one going on. */
export const countVisit = (v: Visits | null, now: number): Visits =>
  !v ? { count: 1, last: now } : { count: now - v.last >= INSTALL_NUDGE.gapMinutes * 60_000 ? v.count + 1 : v.count, last: now }

/**
 * Whether the lobby offers to install by itself: something to offer
 * (`installOffer`), not in an app's browser, never asked on this device, and
 * the player came back (`sessions`) or played a few runs.
 */
export const installNudgeDue = (n: { offer: InstallOffer; inApp: boolean; asked: boolean; sessions: number; runs: number }) =>
  n.offer !== null && !n.inApp && !n.asked && (n.sessions >= INSTALL_NUDGE.sessions || n.runs >= INSTALL_NUDGE.runs)
