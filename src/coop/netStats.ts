import { TICK_HZ } from '../net/protocol'

/**
 * A co-op run's network and pacing numbers as this client lived them, kept in
 * fixed histograms (bounded memory over a 30-minute run: nothing grows per
 * frame) and summed up once at the end (`coop_net`, `netSummary`). The client
 * notes the wire (frames, pongs, reconnects, `client.ts`), its own display
 * frames and the lockstep's pace; the shell notes what it draws (render time,
 * prediction errors, shake). Pure: the callers pass the clock.
 *
 * Time with the page hidden (`noteHidden`) is the player's, not the link's:
 * it counts toward none of the stalls, jitter, hold or catch-up, and neither
 * does the catch-up right after it (the run simulated while away). It is
 * summed apart (`hiddenSec`), and the rates are per minute of visible time.
 */

/** A linear histogram: `counts[i]` holds samples in `[i, i + 1) * step`, the last bucket everything past it. */
export type Hist = { step: number; counts: Uint32Array; n: number; max: number }

export const hist = (step: number, buckets: number): Hist => ({ step, counts: new Uint32Array(buckets), n: 0, max: 0 })

export const addSample = (h: Hist, v: number) => {
  if (!(v >= 0)) return
  h.counts[Math.min(h.counts.length - 1, Math.floor(v / h.step))]!++
  h.n++
  if (v > h.max) h.max = v
}

const tenths = (v: number) => Math.round(v * 10) / 10

/** The `q` quantile (its bucket's middle, never past the max seen; the max itself past the last bucket), or null without samples. */
export const quantile = (h: Hist, q: number): number | null => {
  if (h.n === 0) return null
  const target = Math.max(1, Math.ceil(h.n * q))
  let seen = 0
  const last = h.counts.length - 1
  for (let i = 0; i < last; i++) {
    seen += h.counts[i]!
    if (seen >= target) return tenths(Math.min(h.max, (i + 0.5) * h.step))
  }
  return tenths(h.max)
}

/** Why the client opened a new socket (`client.ts`). */
export const RECONNECT_REASONS = ['drop', 'hello', 'dead', 'uplink', 'gap', 'jump', 'snapshot', 'rejoin', 'manual'] as const
export type ReconnectReason = (typeof RECONNECT_REASONS)[number]

/** A live frame later than this after the previous one (ms) is a stall (60 Hz frames come every ~17). */
export const STALL_MS = 50

/** Arrivals per jitter window: the "no delay" line is the earliest arrival of this window and the last (drift-proof). */
const JITTER_WINDOW = 600

/** A gap this long (ms) between live frames is a pause or a dead link, not jitter: the arrival line starts over. */
const GAP_MS = 1000

const TICK_MS = 1000 / TICK_HZ

export type NetStats = {
  /** The run these numbers are for (0 before one), and when this client met it (ms). */
  run: number
  startedAt: number
  rtt: Hist
  /** Frame arrival delay past the earliest one (ms): all live frames, and split by whether they carried inputs. */
  jitter: Hist
  jitterInputs: Hist
  jitterEmpty: Hist
  arrivals: { minCur: number; minPrev: number; n: number; last: number }
  stalls: number
  /** The hold in ticks, weighted by time (tick·ms over ms), its peak, and how often it changed. */
  hold: { sum: number; ms: number; max: number; changes: number; last: number }
  display: Hist
  lastFrameAt: number
  long50: number
  long100: number
  /** Ms of simulation per tick (per display frame that ran any), and of drawing per frame. */
  simTick: Hist
  render: Hist
  /** |predicted − confirmed| (px), and the corrections too big to blend (snaps). */
  predErr: Hist
  snaps: number
  /** Seconds: the screen shaking, the team paused (a pick, the world held) and catching up (syncing, a snapshot, behind). */
  shakeSec: number
  pauseSec: number
  catchUpSec: number
  reconnects: Record<ReconnectReason, number>
  /** When the last `net` report went to the relay (ms). */
  reportedAt: number
  /** Seconds the page spent hidden, since when it is hidden now (ms, or null), and whether it is still catching up from it. */
  hiddenSec: number
  hiddenAt: number | null
  recovering: boolean
}

export const createNetStats = (run = 0, now = 0, hidden = false): NetStats => ({
  run,
  startedAt: now,
  rtt: hist(2, 500),
  jitter: hist(1, 500),
  jitterInputs: hist(1, 500),
  jitterEmpty: hist(1, 500),
  arrivals: { minCur: Infinity, minPrev: Infinity, n: 0, last: -Infinity },
  stalls: 0,
  hold: { sum: 0, ms: 0, max: 0, changes: 0, last: -1 },
  display: hist(0.25, 400),
  lastFrameAt: -Infinity,
  long50: 0,
  long100: 0,
  simTick: hist(0.05, 400),
  render: hist(0.1, 400),
  predErr: hist(0.25, 240),
  snaps: 0,
  shakeSec: 0,
  pauseSec: 0,
  catchUpSec: 0,
  reconnects: { drop: 0, hello: 0, dead: 0, uplink: 0, gap: 0, jump: 0, snapshot: 0, rejoin: 0, manual: 0 },
  reportedAt: now,
  hiddenSec: 0,
  hiddenAt: hidden ? now : null,
  recovering: false,
})

/** Forgets where frames used to land (a sync: the run's clock may have paused, which shifts every arrival). */
export const resetArrivalLine = (n: NetStats) => {
  n.arrivals.minCur = Infinity
  n.arrivals.minPrev = Infinity
  n.arrivals.n = 0
  n.arrivals.last = -Infinity
}

/**
 * The page went hidden (`true`) or came back at `now` (ms). Back, the arrival
 * line starts over, and until the run caught up the frames aren't counted.
 */
export const noteHidden = (n: NetStats, hidden: boolean, now: number) => {
  if (hidden) {
    n.hiddenAt ??= now
    return
  }
  if (n.hiddenAt === null) return
  n.hiddenSec += Math.max(0, now - n.hiddenAt) / 1000
  n.hiddenAt = null
  n.recovering = true
  n.lastFrameAt = -Infinity
  resetArrivalLine(n)
}

/** Seconds hidden by `now`, the time hidden right now included. */
const hiddenBy = (n: NetStats, now: number) => n.hiddenSec + (n.hiddenAt === null ? 0 : Math.max(0, now - n.hiddenAt) / 1000)

/**
 * A live frame whose last tick is `tick` arrived at `at` (ms). Its delay is
 * how much later than the earliest arrival (on the run's clock) of this
 * window and the last one it came: the jitter, drift-proof over a long run.
 */
export const noteArrival = (n: NetStats, tick: number, at: number, inputs: boolean) => {
  // Hidden (the socket still delivers, throttled) or catching up from it: the page's, not the link's.
  if (n.hiddenAt !== null || n.recovering) return
  const a = n.arrivals
  const gap = at - a.last
  if (gap > GAP_MS) resetArrivalLine(n)
  else if (gap > STALL_MS) n.stalls++
  a.last = at
  const offset = at - tick * TICK_MS
  a.minCur = Math.min(a.minCur, offset)
  const delay = offset - Math.min(a.minCur, a.minPrev)
  addSample(n.jitter, delay)
  addSample(inputs ? n.jitterInputs : n.jitterEmpty, delay)
  if (++a.n >= JITTER_WINDOW) {
    a.minPrev = a.minCur
    a.minCur = Infinity
    a.n = 0
  }
}

/** One display frame of a run at `now` (ms): its length, the hold, and whether the team is paused or this client catching up. */
export const noteFrame = (n: NetStats, now: number, s: { hold: number; paused: boolean; catchingUp: boolean }) => {
  const ms = now - n.lastFrameAt
  n.lastFrameAt = now
  if (n.hiddenAt !== null) return
  // Back from hidden: the catch-up is the time away's, and the first frame that isn't one ends it.
  if (n.recovering && s.catchingUp) return
  n.recovering = false
  if (!(ms > 0) || ms >= GAP_MS) return
  addSample(n.display, ms)
  if (ms > 50) n.long50++
  if (ms > 100) n.long100++
  const h = n.hold
  h.sum += s.hold * ms
  h.ms += ms
  h.max = Math.max(h.max, s.hold)
  if (h.last >= 0 && s.hold !== h.last) h.changes++
  h.last = s.hold
  if (s.paused) n.pauseSec += ms / 1000
  if (s.catchingUp) n.catchUpSec += ms / 1000
}

/**
 * What the shell drew this frame: the render's ms, whether the screen shook,
 * and the prediction's errors and snaps since the last frame (taken: the
 * prediction's list is emptied, so it never grows over the run).
 */
export const noteDraw = (n: NetStats, d: { renderMs: number; dt: number; shake: boolean; prediction: { errors: number[]; snaps: number } }) => {
  addSample(n.render, d.renderMs)
  if (d.shake) n.shakeSec += d.dt
  for (const e of d.prediction.errors) addSample(n.predErr, e)
  d.prediction.errors.length = 0
  n.snaps += d.prediction.snaps
  d.prediction.snaps = 0
}

/** Where the relay runs and where this client meets Cloudflare, from `welcome` (null on an older relay). */
export type NetWhere = { relayColo: string | null; relayRegion: string | null; edgeColo: string | null; edgeRtt: number | null }

/** Where nothing is known yet (before a welcome, or from a relay that doesn't say). */
export const NO_WHERE: NetWhere = { relayColo: null, relayRegion: null, edgeColo: null, edgeRtt: null }

/** What the runner knows that goes into the summary. */
export type RunnerNet = { underruns: number; heals: number; syncs: number }

/**
 * One run's numbers, flat (PostHog and Umami take them as they are): rates
 * per minute of visible wall time (`wallSec` less `hiddenSec`), times in ms to a tenth.
 */
export const netSummary = (n: NetStats, now: number, runner: RunnerNet, where: NetWhere) => {
  const wallSec = Math.max(0, (now - n.startedAt) / 1000)
  const hiddenSec = Math.min(wallSec, hiddenBy(n, now))
  const perMin = (v: number) => tenths(v / Math.max(1 / 60, (wallSec - hiddenSec) / 60))
  const median = quantile(n.display, 0.5)
  const rc = n.reconnects
  return {
    wallSec: Math.round(wallSec),
    hiddenSec: Math.round(hiddenSec),
    pauseSec: Math.round(n.pauseSec),
    catchUpSec: tenths(n.catchUpSec),
    ...where,
    rttP50: quantile(n.rtt, 0.5),
    rttP95: quantile(n.rtt, 0.95),
    rttMax: n.rtt.n ? Math.round(n.rtt.max) : null,
    jitterP50: quantile(n.jitter, 0.5),
    jitterP90: quantile(n.jitter, 0.9),
    jitterP98: quantile(n.jitter, 0.98),
    jitterInputsP90: quantile(n.jitterInputs, 0.9),
    jitterInputsP98: quantile(n.jitterInputs, 0.98),
    jitterEmptyP90: quantile(n.jitterEmpty, 0.9),
    jitterEmptyP98: quantile(n.jitterEmpty, 0.98),
    holdMean: n.hold.ms > 0 ? tenths(n.hold.sum / n.hold.ms) : null,
    holdMax: n.hold.max,
    holdChangesPerMin: perMin(n.hold.changes),
    underruns: runner.underruns,
    stalls: n.stalls,
    stallsPerMin: perMin(n.stalls),
    reconnects: RECONNECT_REASONS.reduce((s, r) => s + rc[r], 0),
    rcDrop: rc.drop,
    rcHello: rc.hello,
    rcDead: rc.dead,
    rcUplink: rc.uplink,
    rcGap: rc.gap,
    rcJump: rc.jump,
    rcSnapshot: rc.snapshot,
    rcRejoin: rc.rejoin,
    rcManual: rc.manual,
    heals: runner.heals,
    syncs: runner.syncs,
    displayHz: median ? Math.round(1000 / median) : null,
    frameP50: median,
    long50: n.long50,
    long100: n.long100,
    simTickP95: quantile(n.simTick, 0.95),
    renderP95: quantile(n.render, 0.95),
    predErrP50: quantile(n.predErr, 0.5),
    predErrP95: quantile(n.predErr, 0.95),
    predErrMax: n.predErr.n ? tenths(n.predErr.max) : null,
    snaps: n.snaps,
    shakeSecPerMin: perMin(n.shakeSec),
  }
}

export type NetSummary = ReturnType<typeof netSummary>
