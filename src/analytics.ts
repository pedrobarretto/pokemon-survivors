import type { PostHog } from 'posthog-js'
import type { AbilityId, HitKind } from './data/abilities'
import type { BranchId } from './data/branches'
import type { EnemyId } from './data/enemies'
import type { PlayableId } from './data/hatchlings'
import type { MegaId } from './data/megas'
import type { BagItem } from './data/shop'
import type { SurveyAnswer } from './data/survey'
import type { Difficulty } from './game/difficulty'
import type { RunMode } from './game/ranking'
import type { RelayHome, VpsHome } from './net/protocol'
import { timeoutSignal } from './net/timeout'
import { isRecord } from './game/parse'
import type { LobbyFocus } from './ui/title'
import type { NetSummary } from './coop/netStats'
import type { CrumbMoment, Quality } from './crumb'
import type { DeviceInfo } from './telemetry'

/**
 * Analytics and error reports. Events go to PostHog (product analytics and
 * error tracking, through our `/ingest` proxy) and, while we compare the two,
 * to our self-hosted Umami. PostHog loads after the game is up, so play never
 * waits on it; events and errors from before it loads wait in a short queue.
 * Only production domains report (or a device with `ps:analytics` set to `on`, for testing).
 */

/**
 * How the device coped with a run, and which device it was (`telemetry.ts`). Memory in MB (w×h×4),
 * at the end and at its peak (sampled every 5 s and at key moments): the canvases the game's caches
 * hold (`heldCanvases`, not every canvas made: those include garbage not yet collected) and the
 * downloaded sprite sheets' decoded pixels (`sheetStats`). Then the quality the governor drew at
 * by the end, `navigator.deviceMemory` (GB), and the frames while playing (ms; long: past 50 ms).
 */
export type RunPerf = {
  liveCanvasMb: number
  peakLiveCanvasMb: number
  liveCanvases: number
  sheetMb: number
  peakSheetMb: number
  sheets: number
  quality: Quality
  deviceMemory: number | null
  frameAvg: number | null
  frameP95: number | null
  longFrames: number
} & DeviceInfo

/** Custom events, with their payloads. Keep this list short: every event counts against the free tier. */
type AnalyticsEvents = {
  /**
   * How a run ended, with what it was built from: the build and the cause of a faint are what tuning needs.
   * The run's only event (no `run_start`): `mode` is a regular run or the Legend mode's (`runMode`), and
   * `left` is a page closed or reloaded mid-run. Runs left or quit in their first minute send nothing; the
   * next run that reports counts the quits (`rerolls`). Co-op runs report through `coop` and `coop_net`.
   */
  run_end: {
    starter: PlayableId
    difficulty: Difficulty
    mode: RunMode
    outcome: 'victory' | 'gameover' | 'endless' | 'quit' | 'left'
    minute: number
    level: number
    kills: number
    stage: number
    branch: BranchId | null
    ability: AbilityId | null
    /** The Mega Stone found, and how many times the run Mega Evolved. */
    mega: MegaId | null
    megas: number
    /** `id:level` of each move and held item at the end. */
    moves: string[]
    items: string[]
    bosses: number
    /** What landed the last hit of a faint: the foe's species (null for a hazard) and the kind of hit. */
    foe: EnemyId | null
    hit: HitKind | null
    /** ₽ the run banked (coins, plus the end bonus when it got it), to tune the economy. */
    coins: number
    /** The Bag items the run took (`ReplayStart.bag`). */
    bag: BagItem[]
    challenge?: 'official' | 'practice'
    /** A haunted run's (Noite das Bruxas) candies, to tune the candy jar. */
    candies?: number
    /** Runs quit in their first minute since the last report (restarts hunting for a good start). */
    rerolls: number
    /** The lobby entries opened since the last report (`lobbyPress`), each once. */
    opened: LobbyFocus[]
    /** Whether the device played it in safe mode (`safeMode.ts`, on after a crash). */
    safeMode: boolean
  } & RunPerf
  /**
   * The page died mid-run last time (the crash watch, `takeCrash` in `bugReport.ts`), sent once
   * by the next boot whether or not the player files a report. Rare, so it fits the budget.
   * The memory fields are the breadcrumb's (`crumb.ts`, as `RunPerf` has them), null from a
   * build before it; the device is this boot's (the same phone).
   */
  run_crash: {
    version: string
    sameVersion: boolean
    /** When the watch last wrote (ISO): the crash came within 5 s of it (1 s after a key moment). */
    at: string
    partner: string | null
    phase: string | null
    minute: number | null
    /** Seconds into the run when the watch last wrote. */
    seconds: number | null
    enemies: number | null
    projectiles: number | null
    wave: string | null
    boss: string | null
    place: string | null
    biome: string | null
    /** The run's last key moment before the crash (a boss, a rift, a pick…) and the run's second it came at. */
    moment: CrumbMoment | null
    momentAt: number | null
    heapMb: number | null
    liveCanvasMb: number | null
    peakLiveCanvasMb: number | null
    liveCanvases: number | null
    sheetMb: number | null
    peakSheetMb: number | null
    sheets: number | null
    quality: Quality | null
    frameMs: number | null
    deviceMemory: number | null
    /** The session's last error, if one came first. */
    error: string | null
    /** Whether safe mode was on for the run that died (`safeMode.ts`). */
    safeMode: boolean
  } & DeviceInfo
  /**
   * The page went away mid-run last time while the player was elsewhere (`takeCrash`'s `away`):
   * `hidden`, another tab or app (where the phone may close it to free memory); `blur`, out of the
   * window (Android's Recents, where a swipe closes the browser). Not a crash: no safe mode, no prompt.
   * At most one per run, and only for runs that ended that way.
   */
  run_closed: {
    version: string
    away: 'hidden' | 'blur'
    partner: string | null
    phase: string | null
    minute: number | null
    seconds: number | null
    deviceMemory: number | null
  } & DeviceInfo
  /** A share card left the game (the run's or the Trainer Card), or the invite link, through the share sheet, the clipboard or a download. */
  share: { kind: 'run' | 'trainer' | 'invite'; method: 'share' | 'copy' | 'download' }
  /** The game opened from a link carrying a handle this device didn't hold (`?ref=` or a profile's `?u=`); `first`: the device had no inviter yet. */
  ref_land: { ref: string; via: 'ref' | 'profile'; first: 0 | 1 }
  /** A new account signed up with an invite and the API counted it (`POST /referral`). */
  ref_signup: { ref: string }
  /**
   * Installing the app (`ui/install.ts`): Chromium's prompt shown from Settings (`prompt`) and the
   * answer (`accepted`, `dismissed`), the iOS how-to opened (`ios`), and any install at all,
   * from our button or the browser's menu (`installed`).
   */
  install: { step: 'prompt' | 'accepted' | 'dismissed' | 'ios' | 'installed' }
  /** The lobby's survey (`ui/survey.ts`): how each difficulty feels, with the runs and wins the player had when answering. */
  survey_difficulty: Record<Difficulty, SurveyAnswer> & { runs: number; wins: number }
  /** A co-op client diverged and was healed from the agreed snapshot: the room, the tick it was told at, and how long until it was back in step. */
  coop_heal: { room: string; tick: number; ms: number }
  /**
   * How a co-op run's link and pacing went for this player (`coop/netStats.ts`), one per player per run,
   * flat: where the relay ran and this player met Cloudflare, round trip, frame jitter, the hold, underruns,
   * stalls, reconnects by reason, heals and syncs, the display, simulation and render times, prediction
   * errors, shake, the network type and platform, and the device's run perf (as `run_end` has it; co-op
   * sends no `run_end`). Sent at the run's end (`final` 1), or once with what it has when the page hides
   * mid-run (`hidden`, `final` 0: the run may go on, and a final one follows) or unloads (`unload`).
   */
  coop_net: NetSummary &
    RunPerf & {
      room: string
      run: number
      seat: number
      seats: number
      outcome: 'victory' | 'wipe' | 'endless' | 'left' | 'hidden' | 'unload'
      final: 0 | 1
      minute: number
      difficulty: Difficulty
      effectiveType: string | null
      platform: string | null
      mobile: 0 | 1
    }
  /**
   * Co-op's beta, one event per step: a room created (on which relay: Cloudflare's `cf` or São Paulo's `sa`), a
   * room joined (by a typed code, a link or a friend's invite), a run started (by the host, once per run), a run
   * ended for this player (how, how long, how many), a failure to create, join or stay (`why`: the client's
   * `CloseWhy` or the create refusal), and a guest
   * stopped at the door to sign in (`gate`: from the lobby's tile or a room's link).
   */
  coop:
    | { step: 'gate'; via: 'tile' | 'link' }
    /** `overflow`: the near VPS relay was full, so the room went to Cloudflare. */
    | { step: 'create'; relay: RelayHome; overflow?: VpsHome }
    | { step: 'join'; via: 'code' | 'link' | 'invite' }
    | { step: 'start'; players: number; difficulty: Difficulty }
    | { step: 'end'; players: number; minute: number; outcome: 'victory' | 'wipe' | 'endless' | 'left'; difficulty: Difficulty }
    | { step: 'fail'; at: 'create' | 'join' | 'room' | 'run'; why: string }
}

declare global {
  interface Window {
    /** Umami's tracker, set by the script in the page head. Missing in dev, offline or behind an ad blocker. */
    umami?: { track: (event: string, data?: Record<string, string | number>) => void }
  }
}

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY
const LIVE_HOSTS = ['www.pokemonsurvivors.com', 'www.pokemonsurvivors.com.br']
/** Errors one page load reports at most: a bug in the game loop throws every frame. */
const MAX_ERRORS = 20
/** Longest replay attached to an error report, in characters; PostHog drops events past 1 MB. */
const MAX_REPLAY = 400_000

let posthog: PostHog | null = null
/** Calls waiting for PostHog to load, with what to do if it never does; null once it won't (not a live domain, failed to load). */
let pending: { fn: (ph: PostHog) => void; never?: () => void }[] | null = []

/** Runs `fn` with PostHog once it's loaded; `never` runs instead where it won't load (or too many calls already wait). */
const withPosthog = (fn: (ph: PostHog) => void, never?: () => void) => {
  if (posthog) return fn(posthog)
  if (pending && pending.length < 100) pending.push({ fn, never })
  else never?.()
}

/** PostHog won't load: whoever waits on it hears so. */
const giveUp = () => {
  const waiting = pending ?? []
  pending = null
  for (const p of waiting) p.never?.()
}

/** Umami takes flat data only. */
const flat = (data: object) => Object.fromEntries(Object.entries(data).filter((e): e is [string, string | number] => typeof e[1] === 'string' || typeof e[1] === 'number'))

/**
 * Sends a custom event. Silently does nothing where analytics don't run. Dev builds log it to the console.
 * `beacon`: the page may be going away (`pagehide`, hidden), so PostHog sends it at once by `sendBeacon`.
 */
export const track = <E extends keyof AnalyticsEvents>(event: E, data: AnalyticsEvents[E], opts: { beacon?: boolean } = {}) => {
  if (import.meta.env.DEV) console.debug('[analytics]', event, data)
  window.umami?.track(event, flat(data))
  withPosthog((ph) => ph.capture(event, data, opts.beacon ? { transport: 'sendBeacon', send_instantly: true } : undefined))
}

/** The lobby entries opened since the last run report (`takeOpened`). */
const opened = new Set<LobbyFocus>()

/**
 * An entry pressed in the lobby: what players open. A press per event would be a third of
 * PostHog's budget, so Umami (self-hosted) counts each press and PostHog gets the set on the next `run_end`.
 */
export const lobbyPress = (entry: LobbyFocus) => {
  window.umami?.track('lobby_press', { entry })
  opened.add(entry)
}

/** The lobby entries opened since the last call, for a run's report. */
export const takeOpened = () => {
  const list = [...opened]
  opened.clear()
  return list
}

let identity: { userId: string | null; handle: string | null } | null = null

/**
 * Ties this device's events to an account (its Clerk user id and public handle),
 * or back to a fresh anonymous id after signing out. Each call can cost an event,
 * so a device already tied to the account only sends a handle picked since the page loaded.
 */
export const identify = (userId: string | null, handle: string | null) => {
  const before = identity
  if (before?.userId === userId && before.handle === handle) return
  identity = { userId, handle }
  withPosthog((ph) => {
    if (!userId) return void (ph.get_property('$user_state') === 'identified' && ph.reset())
    if (ph.get_distinct_id() !== userId) ph.identify(userId, handle ? { handle } : undefined)
    else if (handle && before?.userId === userId) ph.setPersonProperties({ handle })
  })
}

/**
 * Evaluates one feature flag for this device's person, or null where PostHog
 * doesn't run (the promise waits for it to load, and gets null if it never
 * does). PostHog's own flags stay off (`advanced_disable_flags`: they'd fetch
 * the remote config, whose `/array/<key>/config` gets Vercel's trailing-slash
 * 308 and a 404, and could turn on features from the dashboard), so this asks
 * `/flags/` itself, a path that already ends in a slash, for the one key. The
 * handle goes along so a flag can target players before PostHog has ingested
 * their person.
 */
export const featureFlag = (key: string): Promise<boolean | null> =>
  new Promise((resolve) => {
    withPosthog(
      (ph) => {
        const body = { token: POSTHOG_KEY, distinct_id: ph.get_distinct_id(), person_properties: identity?.handle ? { handle: identity.handle } : {}, flag_keys: [key] }
        fetch('/ingest/flags/?v=2', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: timeoutSignal(8000) })
          .then((res) => (res.ok ? res.json() : null))
          .then((json: unknown) => resolve(flagIn(json, key)))
          .catch(() => resolve(null))
      },
      () => resolve(null),
    )
  })

/** A flag's answer in a `/flags/?v=2` response (`flags[key].enabled`, or the older `featureFlags[key]`), or null. */
export const flagIn = (json: unknown, key: string): boolean | null => {
  if (!isRecord(json)) return null
  const flag = isRecord(json.flags) ? json.flags[key] : undefined
  if (isRecord(flag) && 'enabled' in flag) return flag.enabled === true
  const legacy = isRecord(json.featureFlags) ? json.featureFlags[key] : undefined
  return legacy === undefined ? null : Boolean(legacy)
}

/** What an error report carries besides the error: where the player was, and the run's replay (see `game/replay.ts`). */
export type ErrorContext = { [key: string]: string | number | boolean | null }

/** The first URL in a stack trace (Chrome's `at f (url:1:2)` or Safari's `f@url:1:2`), without its line and column. */
const stackUrl = (stack: string) => /(?:https?|[a-z-]+-extension):\/\/[^\s)]+?(?=:\d+:\d+)/.exec(stack)?.[0] ?? null

/**
 * Whether an error was thrown by the game's own scripts, from where it was
 * thrown (an error event's `filename`, else the top of its stack). In-app
 * browsers inject their own scripts into the page (the Google app and Chrome
 * on iOS throw "Maximum call stack size exceeded." and "La" from theirs), and
 * WebKit names the page itself as their file; extensions throw from theirs.
 * None of that is ours to fix. Those scripts may run in a JavaScript world
 * of their own, whose errors aren't this page's `Error`s (no `instanceof`)
 * though they are errors: the game's never are. With nothing to go on, it counts as ours.
 */
export const isOwnError = (error: unknown, filename: string | undefined, origin: string) => {
  if (!(error instanceof Error) && Object.prototype.toString.call(error) === '[object Error]') return false
  const stack = error instanceof Error ? error.stack : undefined
  const url = filename || (stack ? stackUrl(stack) : null)
  if (!url) return true
  try {
    const u = new URL(url)
    return u.origin === origin && /\.[cm]?[jt]sx?$/.test(u.pathname)
  } catch {
    return true
  }
}

const reported = new Set<string>()

/**
 * A chunk loaded on demand that the server no longer has (each deploy renames
 * them) or that the network dropped, in each browser's words. Expected: the
 * shell reloads into the new build on `vite:preloadError` (`watchDeploys` in `main.ts`).
 */
export const isStaleChunk = (error: unknown) =>
  error instanceof Error && /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/.test(error.message)

/**
 * Clerk couldn't load its UI script from its CDN (`loadClerkUIScript`, a
 * blocker or a dropped connection). Clerk keeps the failed load in promises
 * of its own nobody awaits, so it surfaces as unhandled rejections; accounts
 * are optional and only Clerk's own modals need it (`loadClerkUI` in `account.ts`).
 */
const isClerkLoadFailure = (error: unknown) => error instanceof Error && 'code' in error && error.code === 'failed_to_load_clerk_ui'

/**
 * A request the network dropped or that timed out, in each browser's words,
 * left unhandled somewhere: the game never waits on the network, so it's noise, not a bug report.
 */
const isNetworkFailure = (error: unknown) =>
  (error instanceof TypeError && /^(Load failed|Failed to fetch|NetworkError when attempting to fetch resource\.?)$/.test(error.message)) ||
  (error instanceof DOMException && (error.name === 'TimeoutError' || error.name === 'AbortError'))

/** Failures the game expects and recovers from on its own, which never go out as error reports. */
export const isExpectedFailure = (error: unknown) => isStaleChunk(error) || isClerkLoadFailure(error) || isNetworkFailure(error)

/** Reports an error once per message and place, up to `MAX_ERRORS` per page load; never an expected failure. */
const reportError = (error: unknown, context: () => ErrorContext) => {
  if (isExpectedFailure(error)) return
  const key = error instanceof Error ? `${error.message}\n${error.stack?.split('\n')[1] ?? ''}` : String(error)
  if (reported.has(key) || reported.size >= MAX_ERRORS) return
  reported.add(key)
  let props: ErrorContext = {}
  try {
    props = context()
  } catch {}
  if (typeof props.replay === 'string' && props.replay.length > MAX_REPLAY) props.replay = null
  withPosthog((ph) => ph.captureException(error, props))
}

const live = () => {
  if (!POSTHOG_KEY) return false
  if (LIVE_HOSTS.includes(location.hostname)) return true
  try {
    return localStorage.getItem('ps:analytics') === 'on'
  } catch {
    return false
  }
}

/**
 * Starts reporting: catches uncaught errors and rejections right away (with
 * `context`, read when one happens) and loads PostHog once the browser is idle.
 * Call once, first thing at boot.
 */
export const startAnalytics = (context: () => ErrorContext) => {
  const key = POSTHOG_KEY
  if (!key || !live()) return giveUp()
  // "Script error." comes from other origins (extensions) with nothing to go on.
  addEventListener('error', (e) => e.error && isOwnError(e.error, e.filename, location.origin) && reportError(e.error, context))
  addEventListener('unhandledrejection', (e) => isOwnError(e.reason, undefined, location.origin) && reportError(e.reason, context))
  const load = () =>
    import('posthog-js')
      .then(({ default: ph }) => {
        ph.init(key, {
          api_host: '/ingest',
          ui_host: 'https://us.posthog.com',
          persistence: 'localStorage',
          persistence_name: 'ps',
          // The game is a canvas: clicks, scrolls and replays of the DOM say little and cost events.
          autocapture: false,
          capture_pageleave: false,
          capture_dead_clicks: false,
          capture_performance: false,
          disable_session_recording: true,
          disable_surveys: true,
          // No feature flags, and so no remote config: its `/array/<key>/config` would get Vercel's trailing slash and a 404. The co-op beta's one flag goes through `featureFlag`.
          advanced_disable_flags: true,
          // Our listeners above report errors, with the run's context.
          capture_exceptions: false,
        })
        ph.register({ version: __GAME_VERSION__ })
        posthog = ph
        pending?.forEach((p) => p.fn(ph))
        pending = null
      })
      .catch(giveUp)
  if ('requestIdleCallback' in window) requestIdleCallback(() => void load(), { timeout: 4000 })
  else setTimeout(() => void load(), 2000)
}
