import { accountState, API_URL } from './account'
import { apiCall } from './api'
import { BUG_REPORT, clip, parseBugCrash, type BugCrash, type BugError, type BugPerf, type BugReport, type BugRun, type BugTech } from './game/bugReport'
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
 *   error. A run that ends, or a page closed on purpose, clears it; a page the
 *   phone killed mid-run leaves it, and the next boot finds it (`takeCrash`).
 *   Its breadcrumb (`crumb.ts`) adds the memory held and the run's last key
 *   moment (`runMoment`), which writes the watch at once.
 */

/** Whether reports can go anywhere: they need the API. */
export const bugReportsEnabled = Boolean(API_URL)

const WATCH_KEY = 'ps:runWatch'

/** How often the crash watch rewrites the run's state. */
const WATCH_MS = 5000

/** The least time between two writes for key moments (a chain of level-up picks writes once). */
const MOMENT_GAP_MS = 1000

const errors: BugError[] = []

/** What the shell has on screen and how the device copes, set by `main.ts` (`describeWith`). */
type Context = { view: string; run: BugRun | null; perf: BugPerf | null; memory: Memory | null }

let describe = (): Context => ({ view: '', run: null, perf: null, memory: null })

/** The crash watch as stored: the run, the session's last error, whether the page was in the background, and the breadcrumb. */
type Watch = BugCrash & { hidden: boolean; crumb: Crumb | null }

let watch: Watch | null = null

const readWatch = (): Watch | null => {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(WATCH_KEY) ?? 'null')
    const crash = parseBugCrash(v)
    return crash && isRecord(v) ? { ...crash, hidden: v.hidden === true, crumb: parseCrumb(v.crumb) } : null
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
  writeWatch({ at: new Date().toISOString(), version: __GAME_VERSION__, run, heapMb: heapMb(), perf, error: watch?.error ?? null, hidden: document.hidden, crumb })
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

const record = (e: BugError) => {
  errors.push(e)
  if (errors.length > BUG_REPORT.errors) errors.shift()
  if (watch) writeWatch({ ...watch, error: e })
}

window.addEventListener('error', (e) => {
  const error: unknown = e.error
  record({
    kind: 'error',
    message: clip(e.message || String(error), BUG_REPORT.message),
    source: e.filename ? `${e.filename}:${e.lineno}:${e.colno}` : '',
    stack: error instanceof Error ? clip(error.stack ?? '', BUG_REPORT.stack) : '',
    at: new Date().toISOString(),
  })
})

window.addEventListener('unhandledrejection', (e) => {
  const reason: unknown = e.reason
  record({
    kind: 'rejection',
    message: clip(reason instanceof Error ? reason.message : String(reason), BUG_REPORT.message),
    source: '',
    stack: reason instanceof Error ? clip(reason.stack ?? '', BUG_REPORT.stack) : '',
    at: new Date().toISOString(),
  })
})

// The game pauses in the background, where the phone may close the tab to free memory: that's not a crash.
document.addEventListener('visibilitychange', syncRunWatch)

// Closing or reloading on purpose isn't a crash either, unless an error came first (a frozen game reloaded).
window.addEventListener('pagehide', () => watch && !watch.error && writeWatch(null))

// Back from the back/forward cache, the run is still there.
window.addEventListener('pageshow', (e) => e.persisted && syncRunWatch())

setInterval(syncRunWatch, WATCH_MS)

/**
 * The run the page died in last time and its breadcrumb, once: the watch is
 * cleared as it's read. Null when the last session ended cleanly, or the page
 * was in the background without an error (the phone freeing memory).
 */
export const takeCrash = (): { crash: BugCrash; crumb: Crumb | null } | null => {
  const found = readWatch()
  if (!found) return null
  writeWatch(null)
  const { hidden, crumb, ...crash } = found
  return hidden && !crash.error ? null : { crash, crumb }
}

/** Tells the reports what's on screen: `main.ts` hands in the run (plain numbers and ids), the top screen's name and the device's load. */
export const describeWith = (fn: () => Context) => {
  describe = fn
}

/** `412x915`. */
const size = (w: number, h: number) => `${Math.round(w)}x${Math.round(h)}`

/** The technical info right now, with the crashed run when the report is about one. */
export const techInfo = (crash: BugCrash | null): BugTech => {
  const { view, run, perf } = describe()
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
