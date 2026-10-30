import { accountState, API_URL } from './account'
import { isExpectedFailure, isOwnError } from './analytics'
import { apiCall } from './api'
import { BUG_REPORT, clip, parseBugCrash, type BugCrash, type BugError, type BugPerf, type BugInput, type BugReport, type BugRun, type BugTech } from './game/bugReport'
import { isRecord } from './game/parse'
import { parseCrumb, type Crumb, type CrumbMoment, type Memory } from './crumb'
import { locale } from './i18n'

/**
 * What a bug report carries besides the player's words, gathered on the
 * device, and the report's side of the API. Imported first by `main.ts`, so
 * the error listeners are on before anything else runs:
 * - the last few uncaught errors and unhandled rejections, in memory;
 * - a crash watch: while a run is on, `ps:runWatch` in localStorage holds
 *   what it looks like (refreshed every few seconds) and the session's last
 *   error of the game's own. A run that ends, or a page closed on purpose, clears it; a page the
 *   phone killed mid-run leaves it, and the next boot finds it (`takeCrash`).
 *   Its breadcrumb (`crumb.ts`) adds the memory held and the run's last key
 *   moment (`runMoment`), which writes the watch at once.
 *   A page that went away while the player was away from it (in the background,
 *   or the window out of focus) isn't a crash: Android's Recents swipe kills
 *   Chrome with only a `blur` before it, no `visibilitychange` nor `pagehide`.
 */

/** Whether reports can go anywhere: they need the API. */
export const bugReportsEnabled = Boolean(API_URL)

const WATCH_KEY = 'ps:runWatch'

/** How often the crash watch rewrites the run's state. */
const WATCH_MS = 5000

/** The least time between two writes for key moments (a chain of level-up picks writes once). */
const MOMENT_GAP_MS = 1000

const errors: BugError[] = []

/** What the shell has on screen, how the device copes and what the player plays with (`Input.lastKind`, `Input.pads`), set by `main.ts` (`describeWith`). */
type Context = { view: string; run: BugRun | null; perf: BugPerf | null; memory: Memory | null; input: { last: BugInput['last']; pads: readonly string[] } | null }

let describe = (): Context => ({ view: '', run: null, perf: null, memory: null, input: null })

/**
 * The crash watch as stored: the run, the session's last error, whether the page was in the
 * background or the window had lost focus (`blurred`), and the breadcrumb.
 */
type Watch = BugCrash & { hidden: boolean; blurred: boolean; crumb: Crumb | null }

let watch: Watch | null = null

/**
 * Whether the window lost focus and the player hasn't come back to it: set by `blur`, cleared by
 * `focus` or any press in the page. From events, not `document.hasFocus()`, which a page framed by
 * a portal may never have.
 */
let blurred = false

const readWatch = (): Watch | null => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(WATCH_KEY) ?? 'null')
    const crash = parseBugCrash(v)
    return crash && isRecord(v) ? { ...crash, hidden: v.hidden === true, blurred: v.blurred === true, crumb: parseCrumb(v.crumb) } : null
  } catch {
    return null
  }
}

const writeWatch = (next: Watch | null) => {
  watch = next
  try {
    if (next) localStorage.setItem(WATCH_KEY, JSON.stringify(next))
    else localStorage.removeItem(WATCH_KEY)
  } catch {
    // Private mode or a full storage: the watch is best effort.
  }
}

/** The JS heap in MB, where the browser says (Chrome). */
const heapMb = () => {
  const memory: unknown = Reflect.get(performance, 'memory')
  return isRecord(memory) && typeof memory.usedJSHeapSize === 'number' ? Math.round(memory.usedJSHeapSize / 1_048_576) : null
}

const numberOf = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

/** `navigator.deviceMemory` (GB, rounded down by the browser), where it says (Chromium only). */
export const deviceMemory = () => numberOf(Reflect.get(navigator, 'deviceMemory'))

/** The run's last key moment and its second, the one waiting for the next write, and when the watch last wrote (`performance.now()`). */
let moment: { kind: CrumbMoment; at: number } | null = null
let pendingMoment: CrumbMoment | null = null
let momentTimer: ReturnType<typeof setTimeout> | null = null
let wroteAt = 0

/**
 * Brings the crash watch up to date with the run on screen (`describeWith`):
 * written while one is on, cleared once it's over. `main.ts` calls it as a
 * run starts and ends; a timer keeps it fresh in between.
 */
export const syncRunWatch = () => {
  const { run, perf, memory } = describe()
  if (!run) {
    moment = null
    return watch && writeWatch(null)
  }
  if (pendingMoment) moment = { kind: pendingMoment, at: run.time }
  pendingMoment = null
  wroteAt = performance.now()
  const crumb = memory && { ...memory, moment: moment?.kind ?? null, momentAt: moment?.at ?? null }
  writeWatch({ at: new Date().toISOString(), version: __GAME_VERSION__, run, heapMb: heapMb(), perf, error: watch?.error ?? null, hidden: document.hidden, blurred, crumb })
}

/**
 * A key moment of the run (a boss arriving, a rift entered, a pick): the watch writes it
 * on the next task, or a second after its last write, so a crash right after says what
 * just happened. Cheap enough for the event loop: the write itself waits.
 */
export const runMoment = (kind: CrumbMoment) => {
  pendingMoment = kind
  if (momentTimer !== null || !watch) return
  momentTimer = setTimeout(
    () => {
      momentTimer = null
      syncRunWatch()
    },
    Math.max(0, wroteAt + MOMENT_GAP_MS - performance.now()),
  )
}

/**
 * Keeps an error for the reports and, when it's the game's own (`ours`), in the crash watch: a page
 * closed after one counts as a crash (a frozen game reloaded). An in-app browser's script failing
 * (Instagram's `iabjs://` "Java object is gone"), a blocked Clerk or a dropped request can't freeze the game.
 */
const record = (e: BugError, ours: boolean) => {
  errors.push(e)
  if (errors.length > BUG_REPORT.errors) errors.shift()
  if (watch && ours) writeWatch({ ...watch, error: e })
}

window.addEventListener('error', (e) => {
  const error: unknown = e.error
  record(
    {
      kind: 'error',
      message: clip(e.message || String(error), BUG_REPORT.message),
      source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '',
      stack: error instanceof Error ? clip(error.stack ?? '', BUG_REPORT.stack) : '',
      at: new Date().toISOString(),
    },
    // "Script error." (another origin, no error object) has nothing of the game's in it.
    error != null && isOwnError(error, e.filename, location.origin) && !isExpectedFailure(error),
  )
})

window.addEventListener('unhandledrejection', (e) => {
  const reason: unknown = e.reason
  record(
    {
      kind: 'rejection',
      message: clip(reason instanceof Error ? reason.message : String(reason), BUG_REPORT.message),
      source: '',
      stack: reason instanceof Error ? clip(reason.stack ?? '', BUG_REPORT.stack) : '',
      at: new Date().toISOString(),
    },
    isOwnError(reason, undefined, location.origin) && !isExpectedFailure(reason),
  )
})

// The game pauses in the background, where the phone may close the tab to free memory: that's not a crash.
document.addEventListener('visibilitychange', syncRunWatch)

/** Writes `blurred` into the watch when it changes. */
const setBlurred = (next: boolean) => {
  if (blurred === next) return
  blurred = next
  syncRunWatch()
}

// Out of focus, the player is elsewhere: on Android, swiping Chrome away in Recents fires only this before the kill.
window.addEventListener('blur', () => setBlurred(true))
// Back: the focus, or a press if the browser left the focus event out.
window.addEventListener('focus', () => setBlurred(false))
window.addEventListener('pointerdown', () => setBlurred(false), { capture: true, passive: true })
window.addEventListener('keydown', () => setBlurred(false), { capture: true, passive: true })

// Closing or reloading on purpose isn't a crash either, unless an error came first (a frozen game reloaded).
window.addEventListener('pagehide', () => watch && !watch.error && writeWatch(null))

// Back from the back/forward cache, the run is still there.
window.addEventListener('pageshow', (e) => e.persisted && syncRunWatch())

setInterval(syncRunWatch, WATCH_MS)

/**
 * Where the player was when a page went away mid-run without an error of the game's: elsewhere
 * (`hidden`: another tab or app, where the phone may close it to free memory) or out of the window
 * (`blur`: Recents, where a swipe closes the browser). Null: looking at the game, so a crash.
 */
export type Away = 'hidden' | 'blur' | null

/**
 * The run the page went away in last time and its breadcrumb, once: the watch is
 * cleared as it's read. Null when the last session ended cleanly. `away` tells a
 * crash (null) from a page the player had left, which isn't one; an error of the game's first makes it a crash anyway.
 */
export const takeCrash = (): { crash: BugCrash; crumb: Crumb | null; away: Away } | null => {
  const found = readWatch()
  if (!found) return null
  writeWatch(null)
  const { hidden, blurred, crumb, ...crash } = found
  const away: Away = crash.error ? null : hidden ? 'hidden' : blurred ? 'blur' : null
  return { crash, crumb, away }
}

/** Tells the reports what's on screen: `main.ts` hands in the run (plain numbers and ids), the top screen's name and the device's load. */
export const describeWith = (fn: () => Context) => {
  describe = fn
}

/** `412x915`. */
const size = (w: number, h: number) => `${Math.round(w)}x${Math.round(h)}`

/** The technical info right now, with the crashed run when the report is about one. */
export const techInfo = (crash: BugCrash | null): BugTech => {
  const { view, run, perf, input } = describe()
  return {
    version: __GAME_VERSION__,
    locale: locale(),
    userAgent: navigator.userAgent,
    screen: size(screen.width, screen.height),
    viewport: size(window.innerWidth, window.innerHeight),
    dpr: window.devicePixelRatio,
    memory: deviceMemory(),
    cores: numberOf(navigator.hardwareConcurrency),
    heapMb: heapMb(),
    standalone: matchMedia('(display-mode: standalone)').matches,
    touch: navigator.maxTouchPoints > 0,
    input: input && { last: input.last, pads: input.pads.slice(0, BUG_REPORT.pads).map((id) => id.trim()) },
    uptime: Math.round(performance.now() / 1000),
    perf,
    view,
    run,
    errors: [...errors],
    crash,
  }
}

/** What sending came to: sent, too many lately, or the API out of reach. */
export type BugSent = 'sent' | 'limit' | 'invalid' | 'offline'

/** Sends a report, with the player's token when signed in (the thread then shows their handle). */
export const sendBugReport = async (report: BugReport): Promise<BugSent> => {
  const { status } = await apiCall('/bug-reports', { method: 'POST', body: report, auth: accountState().kind === 'signedIn' })
  if (status === 201) return 'sent'
  if (status === 429) return 'limit'
  if (status === 400) return 'invalid'
  return 'offline'
}
