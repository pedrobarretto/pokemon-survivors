import { coopOver } from '../game/coop'
import { stepTick } from '../game/lockstep'
import { setLocalSlot } from '../game/players'
import { TICK } from '../game/replay'
import { deflate, inflate, restore, snapshot, stateHash } from '../game/snapshot'
import type { Game, GameEvent } from '../game/types'
import { HASH_EVERY, SNAPSHOT_EVERY, type ClientMessage, type Entry, type Frame, type RunStart, type ServerMessage } from '../net/protocol'
import { slotsOf, toTickEntries } from './entries'
import { commitArrivals, createHold, onArrival, onUnderrun, resetArrivals, updateHold, type HoldState } from './hold'
import { startGame } from './start'
import { chunks, fromBase64, toBase64 } from './wire'

/**
 * The lockstep runner: one co-op run as this client simulates it. Frames from
 * the relay fill a buffer of ticks; every display frame `advance` simulates
 * what the local clock says is due, keeping `hold` ticks in hand against
 * jitter (`hold.ts`), slowing a little when the buffer runs thin and catching
 * up smoothly when it's fat (+25% speed and more the further behind, never a
 * jump), within a CPU budget. Far behind (a hidden tab, a fresh join) it runs
 * as fast as the budget allows and says it's syncing. Every 60 ticks it sends
 * the state hash; every 600, if the relay asked, a compressed snapshot (taken
 * at once, compressed and sent later). A `sync` brings it to the run's
 * present: from its own state (a resume), the agreed snapshot (a join, a
 * heal) or the seed. Plain state and functions; it runs in the browser and in
 * Node (the soak bots) alike. The caller owns the socket (`send`).
 */

/** Ticks behind (past the hold) where catching up turns into syncing: the progress bar shows and sounds wait. */
export const SYNC_FAR = 300

/** Catch-up speed on top of real time: +25% once the smoothed buffer is `from` ticks past the hold, up to +100% at `SYNC_FAR`. */
export const CATCH_UP = { from: 1.5, min: 0.25, max: 1 } as const

/** The buffer `under` ticks thinner than the hold: the run plays `rate` slower until it fills (imperceptible, unlike a stall). */
const SLOW_DOWN = { under: 0.5, rate: 0.1 } as const

/** The playback rate on top of real time (−0.1 to +1) for a smoothed buffer `excess` ticks past the hold. */
const playbackRate = (excess: number) => {
  if (excess > CATCH_UP.from) return CATCH_UP.min + (CATCH_UP.max - CATCH_UP.min) * Math.min(1, excess / SYNC_FAR)
  return excess < -SLOW_DOWN.under ? -SLOW_DOWN.rate : 0
}

/** CPU per display frame for simulation (ms): live, and while syncing. Past it, up to `BUDGET_FLOOR` ticks still run. */
export const BUDGET = { live: 8, sync: 14 } as const

/**
 * Ticks a display frame runs when due, past the budget: live, real time's own
 * (a few); syncing, as many, so a device whose ticks cost more than the budget
 * (a phone late in a run) still syncs faster than the run goes on.
 */
const BUDGET_FLOOR = 4

export type Pending = {
  reason: 'join' | 'resume' | 'heal'
  from: number
  base: { tick: number; h: string; parts: number } | null
  parts: string[]
  got: number
  /** Inflating and restoring the snapshot (async). */
  busy: boolean
}

export type RunnerStats = {
  ticks: number
  underruns: number
  /** Syncs by reason, and the ticks each replayed (a snapshot's tail, a resume's tail, or from the seed). */
  syncs: { reason: Pending['reason']; from: number; to: number; base: number | null; at: number }[]
  heals: { tick: number; ms: number }[]
  snapshots: { tick: number; bytes: number; takeMs: number; packMs: number }[]
  hashes: number
  /** Most ticks run in one display frame, and the frame sim time (ms) at its worst. */
  maxRun: number
  maxFrameMs: number
  /** Snapshots that failed to restore (or restored to another hash than agreed), and why. */
  failures: string[]
}

export type Runner = {
  start: RunStart
  room: string
  seat: number
  slot: number
  slots: ReadonlyMap<number, number>
  game: Game
  /** The next tick to simulate: the game is the state after ticks `0..next - 1`. */
  next: number
  /** Ticks received: every tick below it is known (`ticks` holds those with entries, from `next` on). */
  known: number
  ticks: Map<number, readonly Entry[]>
  /** A sync waiting on its snapshot's chunks or their restore. */
  pending: Pending | null
  /** Below this tick the frames are a sync's tail, not live. */
  tailTo: number
  hold: HoldState
  /** The run's clock: time (s) past the last tick simulated, the draw's `alpha` (×60). Real time, bent by the playback rate. */
  acc: number
  /** Ticks in hand, smoothed (`LEVEL_SMOOTH`): what the playback rate reacts to. NaN until the first live frame. */
  level: number
  starving: boolean
  /** Ms a tick costs here (moving average). */
  tickMs: number
  /** Syncing: far behind, running as fast as the budget allows. `from` is where it started (for the progress). */
  syncing: { from: number } | null
  /** Asked to upload snapshots (`role`). */
  uploader: boolean
  /**
   * Where the run ended in this simulation (sent as `over`), and whether the
   * relay confirmed it. The runner keeps stepping (and hashing) after its
   * `over` until `ended`: a client that ended wrongly is still healed. Once
   * the relay confirms, a client still behind steps on to the end's tick
   * (`endedAt`) and stops there.
   */
  over: { tick: number; h: string } | null
  ended: boolean
  endedAt: number | null
  /** Events of the ticks simulated, in order, for the shell (drained after every tick, so the state hashes alike everywhere). */
  events: GameEvent[]
  /** Who was acting (`g.player.slot`) when each of `events` was pushed: a player's own events are theirs to see and hear. */
  actors: number[]
  /** Slots recorded as the game pushes its events (`watchEvents`), drained with them. */
  pushedBy: number[]
  /** This seat's last stick stamped and simulated: the tick and the input sample it carried (prediction anchors on it). */
  anchor: { tick: number; sample: number } | null
  /** The input sample of this seat's last special press stamped and simulated (-1 before one): prediction presses the later ones itself. */
  pressed: number
  /** A heal under way: when it was asked (ms) and its tick. */
  healing: { at: number; tick: number } | null
  /** Positions before the last tick simulated, for drawing between ticks: players by slot, enemies by id (no objects made per tick). */
  before: { players: { x: number; y: number }[]; ex: Map<number, number>; ey: Map<number, number> }
  stats: RunnerStats
}

export type RunnerDeps = {
  send: (msg: ClientMessage) => void
  now: () => number
  /** Called after the game object changed (a restore): the shell re-links what it shares with it. */
  onGame?: (r: Runner, why: 'heal' | 'join' | 'seed') => void
  /** A heal finished: the run is back with the team. */
  onHealed?: (r: Runner, tick: number, ms: number) => void
  /** A snapshot didn't restore, or not to its agreed hash (the relay was told, `badSnap`): the caller joins afresh for another. */
  onFailed?: (r: Runner, error: string) => void
}

const newStats = (): RunnerStats => ({ ticks: 0, underruns: 0, syncs: [], heals: [], snapshots: [], hashes: 0, maxRun: 0, maxFrameMs: 0, failures: [] })

/**
 * Records who was acting as each event is pushed: the game's `events` array
 * behind a proxy that notes `g.player.slot` on every append. Draw-side only:
 * the simulation never reads it, and the array stays an array (the proxy
 * passes everything through, and the events are drained before any hash).
 */
const watchEvents = (r: Pick<Runner, 'game' | 'pushedBy'>) => {
  const g = r.game
  const raw = g.events
  g.events = new Proxy(raw, {
    set: (target, key, value, receiver) => {
      if (typeof key === 'string' && key !== 'length' && Number(key) >= target.length) r.pushedBy.push(g.player.slot)
      return Reflect.set(target, key, value, receiver)
    },
  })
}

const linkGame = (r: Pick<Runner, 'game' | 'slot' | 'pushedBy'>) => {
  setLocalSlot(r.game.players, r.slot)
  r.pushedBy.length = 0
  watchEvents(r)
}

/** A runner for a run starting at tick 0 (the relay's `start`, or a sync from the seed). */
export const createRunner = (start: RunStart, room: string, seat: number): Runner => {
  const slots = slotsOf(start)
  const slot = slots.get(seat) ?? 0
  const r: Runner = {
    start,
    room,
    seat,
    slot,
    slots,
    game: startGame(start),
    next: 0,
    known: 0,
    ticks: new Map(),
    pending: null,
    tailTo: 0,
    hold: createHold(),
    acc: 0,
    level: Number.NaN,
    starving: false,
    tickMs: 1,
    syncing: null,
    uploader: false,
    over: null,
    ended: false,
    endedAt: null,
    events: [],
    actors: [],
    pushedBy: [],
    anchor: null,
    pressed: -1,
    healing: null,
    before: { players: [], ex: new Map(), ey: new Map() },
    stats: newStats(),
  }
  linkGame(r)
  return r
}

/** Ticks received and not simulated yet. */
export const backlog = (r: Runner) => r.known - r.next

/** How far a sync has come (0..1), or null when not syncing. */
export const syncProgress = (r: Runner): number | null => {
  if (r.pending) return 0
  if (!r.syncing) return null
  const span = r.known - r.syncing.from
  return span <= 0 ? 1 : Math.min(1, (r.next - r.syncing.from) / span)
}

/**
 * A frame from the relay, `live` unless it belongs to a sync's tail. Ticks
 * already known are skipped (a resume may overlap); a gap returns false (the
 * caller resyncs). `onEntry` sees each entry once, as it arrives.
 */
export const onFrame = (r: Runner, f: Frame, at: number, onEntry: (e: Entry) => void): boolean => {
  if (f.to <= r.known) return true
  if (f.from > r.known) return false
  for (const [tick, entries] of f.ticks) {
    if (tick < r.known) continue
    r.ticks.set(tick, entries)
    for (const e of entries) onEntry(e)
  }
  r.known = f.to
  if (f.from >= r.tailTo && !r.pending) onArrival(r.hold, f.to - 1, at)
  return true
}

/**
 * A `sync`: how this client gets to the run's present. A resume keeps the
 * state (its tail follows); a join or heal restores the agreed snapshot (its
 * chunks follow) or starts from the seed (only before the run's first agreed
 * snapshot). Returns the runner to use (a new one for another run), or
 * `rejoin` when the relay offers a resume this client has no state for (the
 * caller joins afresh, getting the snapshot).
 */
export const onSync = (r: Runner | null, msg: Extract<ServerMessage, { t: 'sync' }>, room: string, seat: number, deps: RunnerDeps): Runner | 'rejoin' => {
  const at = deps.now()
  const same = r !== null && r.start.id === msg.run.id
  let runner: Runner
  if (msg.reason === 'resume') {
    if (!r || !same || r.pending || msg.from > r.known || msg.from < r.next) return 'rejoin'
    runner = r
    for (const t of [...runner.ticks.keys()]) if (t >= msg.from) runner.ticks.delete(t)
    runner.known = msg.from
  } else if (msg.base === null) {
    runner = createRunner(msg.run, room, seat)
    if (r && same) carry(r, runner)
    deps.onGame?.(runner, 'seed')
  } else {
    runner = r && same ? r : createRunner(msg.run, room, seat)
    runner.ticks.clear()
    runner.known = msg.from
    runner.next = msg.from
    runner.over = null
    runner.pending = { reason: msg.reason, from: msg.from, base: msg.base, parts: [], got: 0, busy: false }
  }
  if (msg.reason === 'heal') runner.healing ??= { at, tick: msg.from }
  runner.tailTo = msg.to
  runner.acc = 0
  runner.level = Number.NaN
  runner.starving = false
  resetArrivals(runner.hold)
  runner.stats.syncs.push({ reason: msg.reason, from: msg.from, to: msg.to, base: msg.base?.tick ?? null, at })
  if (msg.to - msg.from > SYNC_FAR) runner.syncing ??= { from: msg.from }
  return runner
}

/** What a fresh runner keeps of the one it replaces (same run): the role, stats, a heal under way. */
const carry = (from: Runner, to: Runner) => {
  to.uploader = from.uploader
  to.stats = from.stats
  to.healing = from.healing
  to.hold = from.hold
}

/**
 * A chunk of the sync's snapshot. Once all are in, the snapshot is inflated
 * and restored (async); frames keep buffering meanwhile. The relay agreed on
 * the snapshot's label (the majority's hash), not its bytes: a snapshot that
 * doesn't restore to that hash, or doesn't restore at all, is never played.
 * The relay hears it's bad (`badSnap`) and the caller joins afresh.
 */
export const onSnapPart = (r: Runner, msg: Extract<ServerMessage, { t: 'snapPart' }>, deps: RunnerDeps) => {
  const p = r.pending
  const base = p?.base
  if (!p || !base || msg.tick !== base.tick || p.parts[msg.part] !== undefined || msg.part >= base.parts) return
  p.parts[msg.part] = msg.data
  p.got++
  if (p.got < base.parts || p.busy) return
  p.busy = true
  const fail = (why: string) => {
    if (r.pending !== p) return
    r.stats.failures.push(why.slice(0, 200))
    deps.send({ t: 'badSnap', tick: base.tick })
    deps.onFailed?.(r, why)
  }
  void inflate(fromBase64(p.parts.join('')))
    .then((bytes) => {
      if (r.pending !== p) return
      const game = restore(bytes)
      const h = stateHash(game)
      if (h !== base.h) return fail(`hash ${h} is not ${base.h} at ${base.tick}`)
      r.game = game
      r.pending = null
      linkGame(r)
      r.anchor = null
      deps.onGame?.(r, p.reason === 'heal' ? 'heal' : 'join')
    })
    .catch((err: unknown) => fail(String(err)))
}

/** Remembers where the players and enemies stand before a tick, to draw between it and the next. */
const rememberPositions = (r: Runner) => {
  const g = r.game
  const b = r.before
  g.players.forEach((p, i) => {
    const at = (b.players[i] ??= { x: 0, y: 0 })
    at.x = p.x
    at.y = p.y
  })
  b.players.length = g.players.length
  b.ex.clear()
  b.ey.clear()
  for (const e of g.enemies) {
    b.ex.set(e.id, e.x)
    b.ey.set(e.id, e.y)
  }
}

/** Takes the snapshot of now, then compresses and sends it in chunks off the frame (measured). */
const uploadSnapshot = (r: Runner, h: string, deps: RunnerDeps) => {
  const t0 = deps.now()
  const raw = snapshot(r.game)
  const takeMs = deps.now() - t0
  const tick = r.next
  const run = r.start.id
  void deflate(raw).then((packed) => {
    const t1 = deps.now()
    const parts = chunks(toBase64(packed))
    // The run went on (or another began): the relay would refuse a stale upload anyway.
    if (r.start.id !== run || !r.uploader) return
    parts.forEach((data, part) => deps.send({ t: 'snap', tick, h, part, parts: parts.length, data }))
    r.stats.snapshots.push({ tick, bytes: packed.byteLength, takeMs, packMs: deps.now() - t1 })
  })
}

/** Simulates tick `next`: its entries, the step, the events out; then the hash, the snapshot and the end, when due. */
export const stepOne = (r: Runner, deps: RunnerDeps) => {
  const g = r.game
  const tick = r.next
  const entries = r.ticks.get(tick)
  if (entries) {
    r.ticks.delete(tick)
    for (const e of entries) {
      if (e[0] !== r.seat) continue
      if (e[1] === 'move' && typeof e[3] === 'number') r.anchor = { tick, sample: e[3] }
      else if (e[1] === 'special' && typeof e[2] === 'number') r.pressed = Math.max(r.pressed, e[2])
    }
    stepTick(g, toTickEntries(entries, r.slots))
  } else stepTick(g, [])
  r.next++
  r.stats.ticks++
  // Drained every tick on every client, so the events never sit in the state that's hashed.
  const by = r.pushedBy
  g.events.splice(0).forEach((e, i) => {
    r.events.push(e)
    r.actors.push(by[i] ?? 0)
  })
  by.length = 0
  const n = r.next
  if (n % HASH_EVERY === 0) {
    const h = stateHash(g)
    deps.send({ t: 'hash', tick: n, h })
    r.stats.hashes++
    if (n % SNAPSHOT_EVERY === 0 && r.uploader) uploadSnapshot(r, h, deps)
  }
  if (!r.over && coopOver(g)) {
    r.over = { tick: n, h: stateHash(g) }
    deps.send({ t: 'over', ...r.over })
  }
  if (r.healing && n >= r.tailTo) {
    const ms = deps.now() - r.healing.at
    r.stats.heals.push({ tick: r.healing.tick, ms })
    deps.onHealed?.(r, r.healing.tick, ms)
    r.healing = null
  }
}

/** Seconds over which the buffer's level is smoothed before the playback rate follows it (a burst of frames is no reason to rush). */
const LEVEL_SMOOTH = 0.3

/**
 * One display frame of the run (`dt` seconds of real time): simulates what's
 * due, within the budget. Returns how many ticks ran.
 *
 * Live, the run's clock (`acc`) moves with real time bent by a playback rate
 * read off the smoothed buffer: faster when it's fat (`CATCH_UP`), slower when
 * it's thinner than the hold (`SLOW_DOWN`), real time in between. Changing
 * speed rather than adding or dropping whole ticks keeps what's drawn between
 * ticks (`acc` → alpha) continuous: the horde and the teammates speed up or
 * slow down a little, but never jump a tick, stand still for a frame or step
 * back. Only the ticks actually run come off the clock: starved, it waits a
 * hair under the next tick (the world holds still) and goes on from there.
 */
export const advance = (r: Runner, dt: number, deps: RunnerDeps): number => {
  if (r.pending || (r.endedAt !== null && r.next >= r.endedAt)) return 0
  const now = deps.now()
  commitArrivals(r.hold, dt)
  updateHold(r.hold, now)
  const have = backlog(r)
  // Far behind: sync at the budget's pace, with a progress bar.
  if (r.syncing || have - r.hold.hold > SYNC_FAR) r.syncing ??= { from: r.next }
  let due = have
  if (!r.syncing) {
    r.level = Number.isNaN(r.level) ? have : r.level + (have - r.level) * (1 - Math.exp(-dt / LEVEL_SMOOTH))
    // The rate bends a normal frame's worth of time: a long frame (the page busy) brings its real time, never more.
    r.acc += dt + Math.min(dt, 2 * TICK) * playbackRate(r.level - r.hold.hold)
    due = Math.floor(r.acc / TICK)
  }
  // The run ended at `endedAt`: nothing past it is simulated.
  const run = Math.min(have, due, r.endedAt === null ? Infinity : r.endedAt - r.next)
  // Starved: the buffer is empty when a tick is due (the frames stopped coming: a slow link, a stall). One underrun per episode.
  if (!r.syncing && have === 0 && due > 0 && r.next >= r.tailTo) {
    if (!r.starving) onUnderrun(r.hold, now)
    r.starving = true
    r.stats.underruns = r.hold.underruns
  } else if (run > 0) r.starving = false
  const budget = r.syncing ? BUDGET.sync : BUDGET.live
  const t0 = deps.now()
  let ran = 0
  // Real time's own ticks always run (a few at most); the catch-up and the sync past those only within the budget.
  for (; ran < run; ran++) {
    if (ran >= BUDGET_FLOOR && deps.now() - t0 + r.tickMs > budget) break
    if (!r.syncing) rememberPositions(r)
    stepOne(r, deps)
    if (r.pending) {
      ran++
      break
    }
  }
  if (!r.syncing) {
    r.acc -= ran * TICK
    // Ticks due but not run (starved, or past the budget) aren't banked: the clock waits just under the next one.
    if (r.acc >= TICK) r.acc = TICK * (1 - 1e-6)
  }
  const spent = deps.now() - t0
  if (ran > 0) r.tickMs = r.tickMs * 0.9 + (spent / ran) * 0.1
  r.stats.maxRun = Math.max(r.stats.maxRun, ran)
  r.stats.maxFrameMs = Math.max(r.stats.maxFrameMs, spent)
  // Caught up: live again, from a fresh clock.
  if (r.syncing && backlog(r) <= r.hold.hold + 2) {
    r.syncing = null
    r.acc = 0
    r.level = backlog(r)
  }
  return ran
}

/** The relay confirmed the end at `tick` (`ended`): a client behind still plays up to it. */
export const onEnded = (r: Runner, tick: number) => {
  r.ended = true
  r.endedAt = tick
}
