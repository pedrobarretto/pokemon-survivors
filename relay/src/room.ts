import { ARENA_RANKED } from '../../src/data/arenaRanked'
import type { ArenaReport, MatchedSettings } from '../../src/net/arena'
import { countsForRank, humansOnBothSides } from '../../src/net/arenaQueue'
import {
  COALESCED_KINDS,
  MAX_ARENA_PLAYERS,
  MAX_PLAYERS,
  PROTOCOL,
  TICK_HZ,
  type ClientMessage,
  type CloseReason,
  type Entry,
  type Hello,
  type Loadout,
  type Phase,
  type Refusal,
  type RoomView,
  type Rtts,
  type RunStart,
  type ServerMessage,
  type Settings,
  type SnapshotRef,
  type TickEntries,
} from '../../src/net/protocol'

/**
 * One co-op room as a pure state machine: no sockets, storage, timers, clock or
 * randomness (the caller passes `now`, in ms, and a `Gen`). Every function
 * mutates the plain state and returns the effects to apply, in order. The
 * relay never simulates: in a run it stamps inputs into ticks derived from its
 * clock and relays them, compares the players' state hashes and keeps the
 * latest agreed snapshot.
 *
 * What the shell must store, two ways (see `Effect`):
 * - Durable (`save`, the room as JSON): rare (seats, run start and end, the
 *   agreed snapshot, pauses). Nothing that follows it goes out before it is
 *   on disk.
 * - Lazy (`log`, `chunk`, `keepSnapshot`, `dropSnapshot`, `dropRun`): never
 *   holds a message back. Lazy writes land in order, before any durable one
 *   that follows; a crash may lose only the newest of them (about a second of
 *   log). Clients keep what they saw, `bound` keeps the restarted clock past
 *   every tick sent, and the hash check heals anyone who rebuilt without it.
 * After a restart the shell passes `loadState` the room and the `bound` of the
 * newest log batch it kept.
 */

export type ConnId = string

/** How long things wait, in ms. */
export const TIMES = {
  /** From `start` to tick 0, for everyone to load the run. */
  startDelay: 3000,
  /** A seat silent this long in a run (no socket, or no message) is stamped `away`. */
  away: 5000,
  /** A host offline this long hands the room to the next seat online. */
  hostHandoff: 30_000,
  /** Outside a run, a seat offline this long is dropped (only while someone else is online). */
  lobbyDrop: 120_000,
  /** A room nobody is connected to lives this long. */
  idle: 600_000,
  /** A room lives this long at most, whatever happens in it. */
  maxAge: 6 * 3_600_000,
  /** A tick's hashes are compared at the latest this long after the first one came in. */
  hashWait: 10_000,
} as const

/**
 * The persisted clock bound: written `BOUND_AHEAD` ticks past the last frame
 * sent, again at each second's batch that would otherwise let fewer than
 * `BOUND_REFRESH` remain before the next one (in practice every second). So a
 * frame never goes out within 2 s of the bound, and a batch lost in a crash
 * (its commit not done 2 s on; the worst measured took 1.1 s) still leaves the
 * one before it past every tick sent. The price: a restarted room resumes
 * 2 to 3 s ahead of where its clients are, ticks they play without input.
 */
export const BOUND_AHEAD = 3 * TICK_HZ
export const BOUND_REFRESH = 2 * TICK_HZ

/** The log goes to storage in batches, one per this many ticks of the clock (a second). */
export const LOG_BATCH = TICK_HZ

/** A reconnecting client resumes from its own state when at most this many ticks behind; past that, from a newer snapshot. */
export const RESUME_TAIL_MAX = 60 * TICK_HZ

/** Decided hashes and undecided reports older than this many ticks behind the clock are forgotten. */
const HASH_WINDOW = 10 * 60 * TICK_HZ

/** Desync dumps recorded per run, at most. */
export const MAX_DUMPS = 3

/** Snapshots a seat may call bad (`badSnap`) per run, at most: past that it can't make the team drop another. */
export const MAX_BAD_SNAPS = 2

/** Per-socket token bucket: burst and refill per second, a token per message (each of a `batch`'s too). The stick, at most 30/s, stays well inside. */
export const BUCKET = { capacity: 120, perSecond: 60 } as const

/** Dropped messages within `window` ms past which a socket is closed as abusive. */
export const ABUSE = { drops: 600, window: 10_000 } as const

/** Randomness, injected: a seat secret (`[A-Za-z0-9_-]{16,64}`) and a uint32 seed. */
export type Gen = { secret: () => string; seed: () => number }

/** Who a verified `hello` belongs to: `u:<clerk user id>` or `g:<guest id>`. */
export type Identity = { id: string; account: boolean }

export type Seat = {
  seat: number
  identity: string
  secret: string
  name: string
  account: boolean
  loadout: Loadout | null
  ready: boolean
  build: string
  ua: string
  /** Since when the seat has no socket, or null while connected. */
  offlineSince: number | null
  /** In a run: the last presence entry stamped for the seat is `away`. */
  away: boolean
  /** Its round trips to the relays (`rtt`), or null until it reported them. */
  rtt?: Rtts | null
}

export type Run = {
  start: RunStart
  /** Relay clock (ms) of tick 0's start: tick `t` goes out once `now >= clockBase + (t + 1) * 1000 / TICK_HZ`. */
  clockBase: number
  /** The next tick to send: every tick below it went out. */
  next: number
  /** No frame ever reached this tick: after a restart the clock resumes here, so no sent tick is reused. */
  bound: number
  /** No seat in the run is here to play (all offline or away): the clock stands still (and resumes where it stopped). */
  paused: boolean
  /** Seats that left the run for good. */
  left: number[]
  agreed: SnapshotRef | null
  /** The seat that uploaded `agreed`. */
  agreedBy: number | null
  /** Seats whose snapshot restored wrong for someone (`badSnap`): they upload only when nobody else can. */
  demoted: number[]
  /** Where each seat's simulation said the run ended (an Arena match's `result` with it). */
  overs: Record<number, Over>
  /** The end the majority agreed on; `result`: the Arena result a majority of them sent too, else null. */
  ended: { tick: number; h: string; result?: string | null } | null
  dumps: number
  /** The identity (`Identity.id`) of each of `start.players`, by slot: the Arena report's accounts (a seat that left is gone from the room). */
  who: string[]
}

/** A seat's `over`: the tick and state hash its simulation ended at, and an Arena match's result (JSON, opaque here). */
export type Over = { tick: number; h: string; result?: string }

/**
 * A room the Arena's matchmaker made (`matchmakerObject.ts`): only the matched
 * accounts sit down, each on the team it was given, its settings are the
 * match's (`MatchedSettings`) for good, and the run starts by itself once
 * everyone has a loadout in, or at `startBy` with whoever does (the game
 * plays the others' seats as bots).
 */
export type ArenaLock = {
  queue: MatchedSettings['queue']
  /** Rated: the matchmaker matched enough humans (`minHumansRanked`); still checked against who played. */
  ranked: boolean
  /** The matched identities (`u:<clerk id>`, or `g:<guest id>` on a dev relay) and their teams. */
  players: { id: string; team: 0 | 1 }[]
  /** Relay clock (ms) at which the run starts with whoever joined. */
  startBy: number
}

/** Everything about a room that is persisted (the Durable Object saves it as JSON on every change). */
export type Room = {
  code: string
  build: string
  region: string
  createdAt: number
  phase: Phase
  host: number | null
  seats: Seat[]
  settings: Settings
  /** Identities kicked from the room. */
  banned: string[]
  runs: number
  run: Run | null
  /** Since when nobody is connected, or null. */
  emptySince: number | null
  /** Whoever says this in a `hello` becomes the host (`CreateResponse.claim`); null once taken. */
  claim: string | null
  /** The room the group moved to (`move`): every `hello` is told it (`moved`) until the room expires. */
  movedTo: string | null
  /** A matchmade Arena room (`ArenaLock`), or null. */
  lock: ArenaLock | null
}

/** A socket, as the room knows it. Not persisted: sockets don't survive a restart. */
export type Conn = {
  id: ConnId
  seat: number | null
  ua: string
  tokens: number
  refilledAt: number
  warned: boolean
  drops: number[]
}

type Upload = { seat: number; tick: number; h: string; parts: number; got: Set<number> }

/** What only lives in memory: rebuilt empty after a restart, which costs at most a few comparisons. */
export type Live = {
  conns: Map<ConnId, Conn>
  lastSeen: Map<number, number>
  /** Entries stamped since the last frame: they go out in the next tick. */
  pending: Entry[]
  reports: Map<number, Map<number, string>>
  firstReport: Map<number, number>
  decided: Map<number, string>
  /** Seats being healed, with the tick their hashes count from again. */
  healing: Map<number, number>
  upload: Upload | null
  uploader: number | null
  /** `badSnap`s each seat sent this run (`MAX_BAD_SNAPS`). */
  badSnaps: Map<number, number>
  /** Ticks sent and hashes decided since the last log batch: written at the next one (`flush`). */
  unlogged: { ticks: TickEntries[]; hashes: [number, Record<number, string>][] }
  /** Log batches written since this object started (half of a batch's key). */
  batches: number
}

export type State = { room: Room | null; live: Live; gen: Gen }

export type SyncReason = 'join' | 'resume' | 'heal'

export type Effect =
  /** Durable: store the room (`state.room`) as JSON before any message that follows goes out. */
  | { k: 'save' }
  /**
   * Lazy: a batch of the run's log. `ticks` (only those with entries) were all
   * sent below `at`, the clock's `next` when written; `hashes` were decided
   * since the last batch; `bound` is the clock bound now. Key it by
   * (`run`, `at`, `n`): batches sort that way, and a reader of ticks from `t`
   * on reads every batch with `at > t`.
   */
  | { k: 'log'; run: number; at: number; n: number; ticks: TickEntries[]; hashes: [number, Record<number, string>][]; bound: number }
  | { k: 'chunk'; run: number; tick: number; part: number; data: string }
  /** Delete every snapshot of `run` but the one at `tick`. */
  | { k: 'keepSnapshot'; run: number; tick: number }
  /** Delete the snapshot of `run` at `tick` (an upload replaced or turned down, a bad agreed one). */
  | { k: 'dropSnapshot'; run: number; tick: number }
  /** Delete the log, hashes and snapshots of `run`. */
  | { k: 'dropRun'; run: number }
  | { k: 'send'; to: ConnId; msg: ServerMessage }
  /** Send `msg`, then the base snapshot's chunks, then the log's frames from `msg.from` to `msg.to`. */
  | { k: 'sync'; to: ConnId; msg: Extract<ServerMessage, { t: 'sync' }> }
  | { k: 'close'; to: ConnId; reason: CloseReason }
  | { k: 'dump'; reason: 'desync' | 'badSnap'; run: number; tick: number; reports: Record<number, string>; majority: string; minority: number[] }
  | { k: 'event'; ev: string; data: Record<string, string | number | boolean | null> }
  /** The room is over: delete everything and close every socket. */
  | { k: 'wipe' }
  /** An Arena match ended with an agreed result: post it to the API (`report.ts`), retrying until it lands. */
  | { k: 'report'; report: ArenaReport }

export const emptyLive = (): Live => ({
  conns: new Map(),
  lastSeen: new Map(),
  pending: [],
  reports: new Map(),
  firstReport: new Map(),
  decided: new Map(),
  healing: new Map(),
  upload: null,
  uploader: null,
  badSnaps: new Map(),
  unlogged: { ticks: [], hashes: [] },
  batches: 0,
})

/**
 * A state with `room` as persisted, and `bound` the newest log batch's (it may
 * be newer than the room's). After a restart a run's clock waits at its bound
 * until someone reconnects, and every seat gets the usual grace before going
 * `away` (they all lost their socket at once, through no fault of theirs).
 */
export const loadState = (room: Room | null, gen: Gen, now: number, bound = 0): State => {
  const live = emptyLive()
  if (room) {
    // Rooms saved before these fields existed.
    room.claim ??= null
    room.movedTo ??= null
    room.lock ??= null
  }
  if (room?.run) {
    room.run.agreedBy ??= null
    room.run.demoted ??= []
    room.run.who ??= []
  }
  if (room?.run && !room.run.ended) {
    room.run.bound = Math.max(room.run.bound, bound)
    room.run.next = Math.max(room.run.next, room.run.bound)
    room.run.paused = true
  }
  if (room) {
    for (const s of room.seats) {
      s.offlineSince ??= now
      live.lastSeen.set(s.seat, now)
    }
    room.emptySince ??= now
  }
  return { room, live, gen }
}

/** Ticks due at `now`: tick `t` is due once its window `[t, t + 1) / TICK_HZ` s after `clockBase` has passed. */
export const ticksDue = (clockBase: number, now: number) => Math.max(0, Math.floor(((now - clockBase) * TICK_HZ) / 1000))

/** When the tick after `next - 1` falls due: the frame timer's next deadline. */
export const nextTickAt = (run: Run) => run.clockBase + ((run.next + 1) * 1000) / TICK_HZ

/** Whether the frame clock runs (a run is on, a seat in it is here to play). */
export const running = (state: State) => {
  const run = state.room?.run
  return state.room?.phase === 'playing' && !!run && !run.paused && !run.ended
}

/* ---------------- Views and messages ---------------- */

const online = (state: State, s: Seat) => s.offlineSince === null && [...state.live.conns.values()].some((c) => c.seat === s.seat)

const connOf = (state: State, seat: number) => [...state.live.conns.values()].find((c) => c.seat === seat) ?? null

export const roomView = (state: State, room: Room): RoomView => ({
  code: room.code,
  phase: room.phase,
  members: room.seats.map((s) => ({
    seat: s.seat,
    name: s.name,
    account: s.account,
    host: room.host === s.seat,
    online: online(state, s),
    away: s.away,
    ready: s.ready,
    loadout: s.loadout,
    ...(s.rtt ? { rtt: s.rtt } : {}),
  })),
  settings: room.settings,
  run: room.run?.start.id ?? 0,
})

const send = (to: ConnId, msg: ServerMessage): Effect => ({ k: 'send', to, msg })

const toSeated = (state: State, msg: ServerMessage): Effect[] =>
  [...state.live.conns.values()].flatMap((c) => (c.seat === null ? [] : [send(c.id, msg)]))

const broadcastRoom = (state: State, room: Room): Effect[] => toSeated(state, { t: 'room', room: roomView(state, room) })

const event = (room: Room, ev: string, data: Record<string, string | number | boolean | null> = {}): Effect => ({
  k: 'event',
  ev,
  data: { code: room.code, ...data },
})

const refuse = (conn: ConnId, code: Refusal, build?: string): Effect[] => [
  send(conn, build === undefined ? { t: 'refused', code } : { t: 'refused', code, build }),
  { k: 'close', to: conn, reason: 'refused' },
]

/* ---------------- Room lifecycle ---------------- */

/**
 * Reserves a fresh room for `code`. Not ok when the code is taken (the caller tries another). `claim`: the
 * secret that makes its sayer the host (`CreateResponse`), for the shell to hand the creator.
 */
export const createRoom = (
  state: State,
  init: { code: string; build: string; region: string; lock?: Omit<ArenaLock, 'startBy'> },
  now: number,
): { ok: false; effects: Effect[] } | { ok: true; claim: string; effects: Effect[] } => {
  if (state.room) return { ok: false, effects: [] }
  const claim = state.gen.secret()
  const lock: ArenaLock | null = init.lock ? { ...init.lock, startBy: now + ARENA_RANKED.queue.joinTimeout * 1000 } : null
  const settings: Settings = lock ? ({ difficulty: 'normal', mode: 'versus', queue: lock.queue, locked: true } satisfies MatchedSettings) : {}
  const room: Room = {
    code: init.code,
    build: init.build,
    region: init.region,
    createdAt: now,
    phase: 'lobby',
    host: null,
    seats: [],
    settings,
    banned: [],
    runs: 0,
    run: null,
    emptySince: now,
    claim,
    movedTo: null,
    lock,
  }
  state.room = room
  return { ok: true, claim, effects: [{ k: 'save' }, event(room, 'room.created', { build: init.build, region: init.region, locked: lock !== null })] }
}

/** An Arena room: its settings say `mode: 'versus'` (a friends' room, or a matchmade one). */
const isArena = (room: Room) => room.settings.mode === 'versus'

/** The most seats the room takes: the matched players in a locked room, two teams in an Arena room, else a co-op party. */
export const seatCap = (room: Room) => (room.lock ? room.lock.players.length : isArena(room) ? MAX_ARENA_PLAYERS : MAX_PLAYERS)

/** A new socket (before its `hello`). */
export const connect = (state: State, id: ConnId, ua: string, now: number): Conn => {
  const conn: Conn = { id, seat: null, ua: ua.slice(0, 200), tokens: BUCKET.capacity, refilledAt: now, warned: false, drops: [] }
  state.live.conns.set(id, conn)
  return conn
}

/** Sockets that outlived the object's memory (WebSocket hibernation), back on their seats. */
export const reattach = (state: State, sockets: readonly { id: ConnId; ua: string; seat: number | null }[], now: number): Effect[] => {
  const room = state.room
  for (const s of sockets) {
    const conn = connect(state, s.id, s.ua, now)
    const seat = room?.seats.find((x) => x.seat === s.seat)
    if (!seat || connOf(state, seat.seat)) continue
    conn.seat = seat.seat
    seat.offlineSince = null
    state.live.lastSeen.set(seat.seat, now)
  }
  if (!room) return []
  // The upload under way was lost with the memory: only the agreed snapshot is worth its storage.
  const out: Effect[] = room.run ? [{ k: 'keepSnapshot', run: room.run.start.id, tick: room.run.agreed?.tick ?? -1 }] : []
  if (room.seats.some((s) => online(state, s))) room.emptySince = null
  return [...out, ...settle(state, room, now)]
}

const liveSeats = (state: State, room: Room) => {
  const run = room.run
  if (!run) return []
  return run.start.players
    .map((p) => p.seat)
    .filter((seat) => {
      const s = room.seats.find((x) => x.seat === seat)
      return !run.left.includes(seat) && !!s && online(state, s) && !s.away
    })
}

/** The snapshot uploader: the lowest live seat that isn't being healed, one never demoted first. Tells the old and new one. */
const updateUploader = (state: State, room: Room): Effect[] => {
  const run = room.run
  const live = room.phase === 'playing' && run && !run.ended ? liveSeats(state, room).filter((seat) => !state.live.healing.has(seat)) : []
  const next = live.find((seat) => !run?.demoted.includes(seat)) ?? live[0] ?? null
  const prev = state.live.uploader
  if (next === prev) return []
  state.live.uploader = next
  const out: Effect[] = []
  const prevConn = prev === null ? null : connOf(state, prev)
  if (prevConn) out.push(send(prevConn.id, { t: 'role', snapshots: false }))
  const nextConn = next === null ? null : connOf(state, next)
  if (nextConn) out.push(send(nextConn.id, { t: 'role', snapshots: true }))
  return out
}

const removeSeat = (state: State, room: Room, seat: Seat, now: number): Effect[] => {
  room.seats = room.seats.filter((s) => s !== seat)
  if (room.host === seat.seat) room.host = (room.seats.find((s) => online(state, s)) ?? room.seats[0])?.seat ?? null
  if (room.seats.length === 0) return wipe(state, room, 'empty', now)
  return [{ k: 'save' }, ...broadcastRoom(state, room), ...evaluateOver(state, room, now), ...settle(state, room, now)]
}

/** Ends the room: nothing about it is saved again. A matchmade match still unfinished in it is reported as abandoned (`abandonedReport`). */
const wipe = (state: State, room: Room, why: string, now: number): Effect[] => {
  state.room = null
  const report = abandonedReport(room, now)
  return [event(room, 'room.ended', { why, runs: room.runs }), ...(report ? [event(room, 'arena.abandoned', { run: report.run, kind: report.kind }), { k: 'report' as const, report }] : []), { k: 'wipe' }]
}

/* ---------------- Hello ---------------- */

/** Picks how a (re)joining seat gets to the run's present: its own state, the agreed snapshot or the seed. */
const syncFor = (run: Run, resume: Hello['resume']): { reason: SyncReason; from: number; base: SnapshotRef | null } => {
  const own = resume && resume.run === run.start.id && resume.from <= run.next ? resume.from : null
  const agreed = run.agreed
  if (own !== null && (run.next - own <= RESUME_TAIL_MAX || !agreed || agreed.tick <= own)) return { reason: 'resume', from: own, base: null }
  if (agreed) return { reason: 'join', from: agreed.tick, base: agreed }
  return { reason: 'join', from: 0, base: null }
}

/**
 * Writes the log held in memory and the clock bound as one batch: once a
 * second of ticks, when the bound moves, and before anything reads the log
 * back (a sync, a dump) or the room may sleep (a pause, the end). `force`
 * writes the bound even with nothing else to write.
 */
const flush = (state: State, run: Run, force = false): Effect[] => {
  const live = state.live
  const { ticks, hashes } = live.unlogged
  if (!force && ticks.length === 0 && hashes.length === 0) return []
  live.unlogged = { ticks: [], hashes: [] }
  return [{ k: 'log', run: run.start.id, at: run.next, n: live.batches++, ticks, hashes, bound: run.bound }]
}

/**
 * The log held in memory, written now: for a shell stopping on purpose (a VPS
 * relay's deploy), so its restart loses none of what went out. A crash may
 * still lose the newest second of it (the doc block above).
 */
export const flushLog = (state: State): Effect[] => {
  const run = state.room?.run
  return run && !run.ended ? flush(state, run) : []
}

/** Brings `conn` to the present: the log written first, so the sync reads all of it. */
const syncEffect = (state: State, conn: ConnId, run: Run, s: { reason: SyncReason; from: number; base: SnapshotRef | null }): Effect[] => [
  ...flush(state, run),
  { k: 'sync', to: conn, msg: { t: 'sync', reason: s.reason, run: run.start, from: s.from, to: run.next, base: s.base } },
]

/** Starts the clock again where it stopped: tick `next` falls due one tick from now. */
const resumeClock = (room: Room, run: Run, now: number): Effect[] => {
  if (!run.paused) return []
  run.clockBase = Math.max(run.clockBase, now - (run.next * 1000) / TICK_HZ)
  run.paused = false
  return [event(room, 'run.resumed', { run: run.start.id, tick: run.next })]
}

/**
 * After anything that changes who's here: with nobody connected the room's
 * idle countdown starts (`TIMES.idle`); in a run the clock stops while no seat
 * in it is here to play (all offline or away: locked phones, hidden tabs) and
 * starts again where it stopped as soon as one is.
 */
const settle = (state: State, room: Room, now: number): Effect[] => {
  const out: Effect[] = []
  if (room.emptySince === null && !room.seats.some((s) => online(state, s))) {
    room.emptySince = now
    out.push({ k: 'save' })
  }
  const run = room.run
  if (room.phase !== 'playing' || !run || run.ended) return out
  const here = liveSeats(state, room).length > 0
  if (!here && !run.paused) {
    run.paused = true
    // Nothing went out past `next`: a restart while paused resumes right there. The room may sleep now, so the log goes too.
    run.bound = run.next
    out.push(...flush(state, run, true), { k: 'save' }, event(room, 'run.paused', { run: run.start.id, tick: run.next, why: room.emptySince === null ? 'away' : 'empty' }))
  } else if (here && run.paused) out.push({ k: 'save' }, ...resumeClock(room, run, now))
  return out
}

const stamp = (state: State, entry: Entry) => {
  const [seat, kind] = entry
  if ((COALESCED_KINDS as readonly string[]).includes(kind)) {
    const i = state.live.pending.findIndex((e) => e[0] === seat && e[1] === kind)
    if (i >= 0) state.live.pending.splice(i, 1)
  }
  state.live.pending.push(entry)
}

const inRun = (run: Run, seat: number) => run.start.players.some((p) => p.seat === seat) && !run.left.includes(seat)

/** A seat was heard from: in a run it comes back from `away`. */
const heard = (state: State, room: Room, seat: Seat, now: number): Effect[] => {
  state.live.lastSeen.set(seat.seat, now)
  const run = room.run
  if (room.phase !== 'playing' || !run || run.ended || !seat.away || !inRun(run, seat.seat)) return []
  seat.away = false
  stamp(state, [seat.seat, 'back'])
  return [{ k: 'save' }, ...settle(state, room, now), ...broadcastRoom(state, room), ...updateUploader(state, room)]
}

/**
 * A `hello` whose auth the caller already checked (`identity` is null when it
 * failed). Takes the identity's seat back (a guest also needs the seat
 * secret), any older socket on it is told it was replaced; or seats a new
 * member outside a run. In a run the seat is brought up to the present.
 * `guests`: whether guests may play here at all (`ALLOW_GUESTS`); otherwise a
 * guest is told to sign in, before anything is said about the room.
 */
export const hello = (state: State, connId: ConnId, h: Hello, identity: Identity | null, now: number, policy: { guests: boolean }): Effect[] => {
  const conn = state.live.conns.get(connId)
  const room = state.room
  if (!conn || conn.seat !== null) return []
  if (h.v !== PROTOCOL) return refuse(connId, 'version')
  if (h.auth.kind === 'guest' && !policy.guests) return refuse(connId, 'signIn')
  if (!room || h.room !== room.code) return refuse(connId, 'unavailable')
  // A room the group left: an old link or a late player goes where it went (a client before `moved` only hears the refusal).
  if (room.movedTo) return [send(connId, { t: 'moved', code: room.movedTo }), ...refuse(connId, 'unavailable')]
  if (!identity) return refuse(connId, 'auth')
  if (h.build !== room.build) return refuse(connId, 'build', room.build)
  const out: Effect[] = []
  let seat = room.seats.find((s) => s.identity === identity.id)
  if (seat) {
    if (!identity.account && h.secret !== seat.secret) return refuse(connId, 'unavailable')
    const old = connOf(state, seat.seat)
    if (old) {
      old.seat = null
      out.push(send(old.id, { t: 'bye', reason: 'replaced' }), { k: 'close', to: old.id, reason: 'replaced' })
      out.push(event(room, 'seat.replaced', { seat: seat.seat }))
    }
  } else {
    const stranger = room.lock !== null && !room.lock.players.some((p) => p.id === identity.id)
    if (room.phase === 'playing' || room.seats.length >= seatCap(room) || room.banned.includes(identity.id) || stranger) return refuse(connId, 'unavailable')
    let n = 0
    while (room.seats.some((s) => s.seat === n)) n++
    seat = { seat: n, identity: identity.id, secret: state.gen.secret(), name: h.name, account: identity.account, loadout: null, ready: false, build: h.build, ua: conn.ua, offlineSince: now, away: false }
    room.seats.push(seat)
    room.seats.sort((a, b) => a.seat - b.seat)
    room.host ??= seat.seat
    out.push(event(room, 'seat.joined', { seat: n, account: identity.account }))
  }
  conn.seat = seat.seat
  seat.offlineSince = null
  seat.name = h.name
  seat.ua = conn.ua
  room.emptySince = null
  // The creator of a room the group moved to takes the crown, whoever got here first.
  if (room.claim !== null && h.claim === room.claim && room.phase === 'lobby') {
    room.claim = null
    if (room.host !== seat.seat) out.push(event(room, 'room.host', { seat: seat.seat, why: 'claim' }))
    room.host = seat.seat
  }
  state.live.lastSeen.set(seat.seat, now)
  out.push({ k: 'save' })
  const run = room.run
  if (room.phase === 'playing' && run && !run.ended) out.push(...heard(state, room, seat, now), ...settle(state, room, now))
  out.push(send(connId, { t: 'welcome', seat: seat.seat, secret: seat.secret, room: roomView(state, room), batch: true, moves: true }))
  out.push(...broadcastRoom(state, room).filter((e) => e.k !== 'send' || e.to !== connId))
  if (room.phase === 'playing' && run && !run.ended && inRun(run, seat.seat)) {
    const s = syncFor(run, h.resume)
    out.push(...syncEffect(state, connId, run, s), event(room, 'seat.sync', { seat: seat.seat, reason: s.reason, from: s.from, to: run.next }))
    out.push(send(connId, { t: 'role', snapshots: false }))
    // The role is re-sent if this seat is (still) the uploader.
    if (state.live.uploader === seat.seat) state.live.uploader = null
    out.push(...updateUploader(state, room))
  }
  return out
}

/* ---------------- Messages ---------------- */

const refill = (conn: Conn, now: number) => {
  conn.tokens = Math.min(BUCKET.capacity, conn.tokens + ((now - conn.refilledAt) * BUCKET.perSecond) / 1000)
  conn.refilledAt = now
}

/** Takes a token for a message; past the bucket it is dropped (told once), and a flood closes the socket. */
const admit = (state: State, conn: Conn, msg: ClientMessage | null, now: number): { ok: boolean; effects: Effect[] } => {
  refill(conn, now)
  // Leaving always gets through (the end of the run is said again until confirmed, so it pays like the rest).
  if (msg?.t === 'leave') return { ok: true, effects: [] }
  if (conn.tokens >= 1 && msg) {
    conn.tokens -= 1
    return { ok: true, effects: [] }
  }
  conn.drops = conn.drops.filter((t) => now - t < ABUSE.window)
  conn.drops.push(now)
  const effects: Effect[] = []
  if (conn.drops.length > ABUSE.drops) {
    const room = state.room
    if (room) effects.push(event(room, 'conn.abuse', { seat: conn.seat }))
    effects.push(send(conn.id, { t: 'bye', reason: 'abuse' }), { k: 'close', to: conn.id, reason: 'abuse' })
  } else if (msg && !conn.warned) {
    conn.warned = true
    effects.push(send(conn.id, { t: 'slow' }))
  }
  return { ok: false, effects }
}

/**
 * A message from a socket (`null` when it didn't parse: it only costs the sender tokens). A `batch` is its
 * messages one by one, in order, at the same instant: its inputs land in the same tick, and each pays a token.
 */
export const message = (state: State, connId: ConnId, msg: ClientMessage | null, now: number): Effect[] => {
  if (msg?.t === 'batch') return msg.m.flatMap((m) => message(state, connId, m, now))
  const conn = state.live.conns.get(connId)
  const room = state.room
  if (!conn || !room) return []
  const gate = admit(state, conn, msg, now)
  if (!gate.ok || !msg) return gate.effects
  if (msg.t === 'ping') return [send(connId, { t: 'pong', at: msg.at, tick: room.run?.next ?? 0 })]
  const seat = conn.seat === null ? undefined : room.seats.find((s) => s.seat === conn.seat)
  // A room the group left takes nothing more (its sockets are closing).
  if (!seat || msg.t === 'hello' || room.movedTo) return []
  const out = heard(state, room, seat, now)
  const isHost = room.host === seat.seat
  const outside = room.phase !== 'playing'
  const run = room.run
  const live = room.phase === 'playing' && run && !run.ended && inRun(run, seat.seat) ? run : null
  switch (msg.t) {
    case 'loadout': {
      if (!outside) return out
      // A matched player plays on the team the matchmaker gave them, whatever the loadout asks.
      const team = room.lock?.players.find((p) => p.id === seat.identity)?.team
      seat.loadout = team === undefined ? msg.loadout : { ...msg.loadout, team }
      return [...out, { k: 'save' }, ...broadcastRoom(state, room), ...autoStart(state, room, now)]
    }
    case 'ready':
      if (!outside) return out
      seat.ready = msg.ready && seat.loadout !== null
      return [...out, { k: 'save' }, ...broadcastRoom(state, room)]
    case 'settings':
      // A matched room's settings are the match's; a full Arena room can't turn into a co-op one.
      if (!outside || !isHost || room.lock || (room.seats.length > MAX_PLAYERS && msg.settings.mode !== 'versus')) return out
      room.settings = msg.settings
      return [...out, { k: 'save' }, ...broadcastRoom(state, room)]
    case 'kick': {
      const target = room.seats.find((s) => s.seat === msg.seat)
      if (!outside || !isHost || !target || target === seat || room.lock) return out
      room.banned.push(target.identity)
      const c = connOf(state, target.seat)
      if (c) {
        c.seat = null
        out.push(send(c.id, { t: 'bye', reason: 'kicked' }), { k: 'close', to: c.id, reason: 'kicked' })
      }
      return [...out, event(room, 'seat.kicked', { seat: target.seat }), ...removeSeat(state, room, target, now)]
    }
    case 'start':
      // A matched room starts by itself (`autoStart`), once.
      if (!outside || room.lock) return out
      if (!isHost) return [...out, send(connId, { t: 'denied', what: 'start', why: 'notHost' })]
      if (!seat.loadout || room.seats.some((s) => s !== seat && online(state, s) && (!s.ready || !s.loadout))) {
        return [...out, send(connId, { t: 'denied', what: 'start', why: 'notReady' })]
      }
      return [...out, ...startRun(state, room, now)]
    case 'rtt': {
      if (!outside || sameRtts(seat.rtt ?? null, msg.ms)) return out
      seat.rtt = msg.ms
      return [...out, { k: 'save' }, ...broadcastRoom(state, room)]
    }
    case 'move':
      if (room.phase !== 'lobby' || !isHost || msg.code === room.code || room.lock) return out
      return [...out, ...moveRoom(state, room, msg.code)]
    case 'in':
      if (live) stamp(state, [seat.seat, msg.k, ...msg.d])
      return out
    case 'hb':
    // A client's link report: the Durable Object's telemetry reads it (`telemetry.ts`); here it only says the seat is here.
    case 'net':
      return out
    case 'hash':
      return live ? [...out, ...onHash(state, room, live, seat.seat, msg.tick, msg.h, now)] : out
    case 'snap':
      return live ? [...out, ...onSnap(state, room, live, seat.seat, msg)] : out
    case 'over': {
      if (!live) return out
      // Said again every couple of seconds until the relay confirms: only a vote that changed is saved.
      const was = live.overs[seat.seat]
      if (was && was.tick === msg.tick && was.h === msg.h && was.result === msg.result) return out
      live.overs[seat.seat] = { tick: msg.tick, h: msg.h, ...(msg.result !== undefined && { result: msg.result }) }
      return [...out, { k: 'save' }, ...evaluateOver(state, room, now)]
    }
    case 'badSnap':
      return live ? [...out, ...onBadSnap(state, room, live, seat.seat, msg.tick)] : out
    case 'leave': {
      conn.seat = null
      out.push(send(connId, { t: 'bye', reason: 'left' }), { k: 'close', to: connId, reason: 'left' })
      out.push(event(room, 'seat.left', { seat: seat.seat, phase: room.phase }))
      if (live) {
        live.left.push(seat.seat)
        stamp(state, [seat.seat, 'leave'])
      }
      out.push(...removeSeat(state, room, seat, now))
      return [...out, ...(state.room ? updateUploader(state, room) : [])]
    }
  }
}

const sameRtts = (a: Rtts | null, b: Rtts) => a !== null && JSON.stringify(a) === JSON.stringify(b)

/**
 * The group moves to room `code` on another relay (the host made it, picked
 * for everyone's round trips): every socket is told and closed, and from now
 * on every `hello` is told too (`moved`), until the room expires.
 */
const moveRoom = (state: State, room: Room, code: string): Effect[] => {
  room.movedTo = code
  const out: Effect[] = [{ k: 'save' }, event(room, 'room.moved', { to: code, seats: room.seats.filter((s) => online(state, s)).length })]
  for (const c of state.live.conns.values()) out.push(send(c.id, { t: 'moved', code }), { k: 'close', to: c.id, reason: 'refused' })
  return out
}

/** A socket closed. Its seat is kept; in a run it goes `away` once silent long enough, and the clock stops when nobody in the run is left (`settle`). */
export const disconnect = (state: State, connId: ConnId, now: number): Effect[] => {
  const conn = state.live.conns.get(connId)
  state.live.conns.delete(connId)
  const room = state.room
  if (!conn || conn.seat === null || !room) return []
  const seat = room.seats.find((s) => s.seat === conn.seat)
  if (!seat || connOf(state, seat.seat)) return []
  seat.offlineSince = now
  return [{ k: 'save' }, ...settle(state, room, now), ...broadcastRoom(state, room), ...updateUploader(state, room), ...evaluateOver(state, room, now)]
}

/* ---------------- Runs ---------------- */

const startRun = (state: State, room: Room, now: number): Effect[] => {
  const out: Effect[] = []
  if (room.run) out.push({ k: 'dropRun', run: room.run.start.id })
  // Seats offline without a loadout can't play: they leave the room.
  room.seats = room.seats.filter((s) => s.loadout !== null)
  room.runs += 1
  const players = room.seats.flatMap((s) => (s.loadout ? [{ seat: s.seat, name: s.name, account: s.account, loadout: s.loadout }] : []))
  const start: RunStart = { id: room.runs, seed: state.gen.seed() >>> 0, build: room.build, settings: room.settings, players }
  const who = players.map((p) => room.seats.find((s) => s.seat === p.seat)?.identity ?? '')
  room.run = { start, clockBase: now + TIMES.startDelay, next: 0, bound: BOUND_AHEAD, paused: false, left: [], agreed: null, agreedBy: null, demoted: [], overs: {}, ended: null, dumps: 0, who }
  room.phase = 'playing'
  const live = state.live
  live.pending = []
  live.unlogged = { ticks: [], hashes: [] }
  live.reports.clear()
  live.firstReport.clear()
  live.decided.clear()
  live.healing.clear()
  live.upload = null
  live.uploader = null
  live.badSnaps.clear()
  for (const s of room.seats) {
    s.away = !online(state, s)
    if (s.away) stamp(state, [s.seat, 'away'])
    else live.lastSeen.set(s.seat, now)
  }
  out.push({ k: 'save' }, event(room, 'run.started', { run: start.id, players: players.length }))
  out.push(...toSeated(state, { t: 'start', run: start, startsIn: TIMES.startDelay }))
  out.push(...broadcastRoom(state, room), ...updateUploader(state, room))
  return out
}

/**
 * A matchmade room's run starts by itself: once every matched player sat down
 * with a loadout, or at `startBy` with whoever did. Nobody did: the room goes.
 */
const autoStart = (state: State, room: Room, now: number): Effect[] => {
  const lock = room.lock
  if (!lock || room.phase !== 'lobby') return []
  const everyone = lock.players.every((p) => room.seats.some((s) => s.identity === p.id && s.loadout !== null))
  if (everyone) return startRun(state, room, now)
  if (now < lock.startBy) return []
  return room.seats.some((s) => s.loadout !== null) ? startRun(state, room, now) : wipe(state, room, 'unjoined', now)
}

/** The Arena result most of the end's voters sent (more than half of them), with its count, or null. */
const agreedResult = (run: Run, voters: readonly number[]): { result: string; votes: number } | null => {
  const counts = new Map<string, number>()
  for (const seat of voters) {
    const r = run.overs[seat]?.result
    if (r !== undefined) counts.set(r, (counts.get(r) ?? 0) + 1)
  }
  const top = [...counts].sort((a, b) => b[1] - a[1])[0]
  return top && top[1] * 2 > voters.length ? { result: top[0], votes: top[1] } : null
}

/**
 * The kind of match a run is, for its report: a friends' room, or the queue
 * it was matched in, ranked only with enough humans in the run and some on
 * each team (`humansOnBothSides`: humans together against bots only play it
 * as casual, so they can't farm RP).
 */
const reportKind = (room: Room, run: Run): ArenaReport['kind'] => {
  if (!room.lock) return 'room'
  const lock = room.lock
  const sides = run.who.flatMap((id) => lock.players.filter((p) => p.id === id).map((p) => p.team))
  return lock.ranked && countsForRank('ranked', run.start.players.length) && humansOnBothSides(sides) ? 'ranked' : 'casual'
}

/** The report's seats: each slot's account (bots' slots after the humans', null), `left` as `gone` says. */
const reportSeats = (run: Run, gone: (seat: number) => boolean): ArenaReport['seats'] => {
  const humans = run.start.players.length
  return Array.from({ length: Math.max(ARENA_RANKED.queue.players, humans) }, (_, slot): ArenaReport['seats'][number] => {
    const p = run.start.players[slot]
    const id = run.who[slot] ?? ''
    if (!p) return { slot, userId: null, handle: null, left: false }
    return { slot, userId: id.startsWith('u:') ? id.slice(2) : null, handle: p.account && p.name.startsWith('@') ? p.name.slice(1) : null, left: gone(p.seat) }
  })
}

/**
 * What the relay tells the API about an Arena match (`ArenaReport`): the kind
 * (`reportKind`), whether enough of them agreed on the result
 * (`confirmed`: when not, the API rates only who left, so no lone client
 * rates a match and no leaver dodges a loss), each slot's account (bots'
 * slots after the humans', null) and the agreed result as the clients built
 * it. Null when that result isn't JSON.
 */
export const arenaReport = (room: Room, run: Run, agreed: { result: string; votes: number }, now: number): ArenaReport | null => {
  let result: unknown
  try {
    result = JSON.parse(agreed.result)
  } catch {
    return null
  }
  const seats = reportSeats(run, (seat) => run.left.includes(seat))
  return { v: 1, room: room.code, run: run.start.id, kind: reportKind(room, run), region: room.region, endedAt: now, seats, result, confirmed: agreed.votes >= ARENA_RANKED.queue.minHumansRanked }
}

/**
 * A matchmade match whose room closes before its end (every human left or
 * went quiet for good): reported as abandoned, every human a leaver, so the
 * API takes their Fair Play (`ArenaReport.abandoned`). Null for any other
 * room, or a run that ended or never started.
 */
export const abandonedReport = (room: Room, now: number): ArenaReport | null => {
  const run = room.run
  if (!room.lock || !isArena(room) || !run || run.ended || room.phase !== 'playing') return null
  return { v: 1, room: room.code, run: run.start.id, kind: reportKind(room, run), region: room.region, endedAt: now, seats: reportSeats(run, () => true), result: null, abandoned: true }
}

/**
 * Ends the run once a majority of the connected players report the same end
 * (tick and hash), and at least two of them while two are still in the run:
 * a lone client can't end it for everyone. An Arena match whose voters agree
 * on its result too is reported (`arenaReport`), once. An Arena match ends on
 * its clock, so a seat gone silent (`away`: tab closed, connection lost)
 * without voting has abandoned it: it doesn't hold the end, and it's
 * reported as having left.
 */
const evaluateOver = (state: State, room: Room, now: number): Effect[] => {
  const run = room.run
  if (room.phase !== 'playing' || !run || run.ended) return []
  const gone = isArena(room) ? run.start.players.map((p) => p.seat).filter((seat) => !run.left.includes(seat) && !run.overs[seat] && room.seats.find((x) => x.seat === seat)?.away) : []
  const remaining = run.start.players.map((p) => p.seat).filter((seat) => !run.left.includes(seat) && !gone.includes(seat))
  const connected = remaining.filter((seat) => {
    const s = room.seats.find((x) => x.seat === seat)
    return !!s && online(state, s)
  })
  const votes = new Map<string, number>()
  for (const seat of connected) {
    const o = run.overs[seat]
    if (o) votes.set(`${o.tick}:${o.h}`, (votes.get(`${o.tick}:${o.h}`) ?? 0) + 1)
  }
  const best = [...votes].sort((a, b) => b[1] - a[1])[0]
  if (!best || best[1] * 2 <= connected.length || best[1] < Math.min(2, remaining.length)) return []
  const [tick, h] = best[0].split(':') as [string, string]
  const voters = connected.filter((seat) => {
    const o = run.overs[seat]
    return !!o && `${o.tick}:${o.h}` === best[0]
  })
  const agreed = isArena(room) ? agreedResult(run, voters) : null
  run.left.push(...gone)
  run.ended = { tick: Number(tick), h, result: agreed?.result ?? null }
  const report = agreed ? arenaReport(room, run, agreed, now) : null
  room.phase = 'ended'
  for (const s of room.seats) {
    s.ready = false
    s.away = false
  }
  state.live.pending = []
  state.live.uploader = null
  return [
    ...flush(state, run),
    { k: 'save' },
    event(room, 'run.over', { run: run.start.id, tick: run.ended.tick, votes: best[1], connected: connected.length }),
    ...toSeated(state, { t: 'ended', run: run.start.id, tick: run.ended.tick, h }),
    ...broadcastRoom(state, room),
    ...(report ? [event(room, 'arena.result', { run: run.start.id, kind: report.kind, confirmed: report.confirmed !== false, votes: agreed?.votes ?? 0, humans: run.start.players.length }), { k: 'report' as const, report }] : []),
  ]
}

/* ---------------- Hashes and snapshots ---------------- */

/** The hash most seats reported; a tie goes to the group with the lowest seat. */
export const majority = (reports: ReadonlyMap<number, string>): string | null => {
  const groups = new Map<string, number[]>()
  for (const [seat, h] of reports) groups.set(h, [...(groups.get(h) ?? []), seat])
  const ranked = [...groups].sort((a, b) => b[1].length - a[1].length || Math.min(...a[1]) - Math.min(...b[1]))
  return ranked[0]?.[0] ?? null
}

/** Tells a diverged seat to restore the agreed state, and records the divergence (a few dumps per run). */
const heal = (state: State, room: Room, run: Run, seats: number[], tick: number, reports: Record<number, string>, agreedHash: string): Effect[] => {
  // The dump and the syncs read the log back: all of it is written first.
  const out: Effect[] = flush(state, run)
  for (const seat of seats) {
    const conn = connOf(state, seat)
    state.live.healing.set(seat, run.next)
    if (!conn) continue
    const s = run.agreed ? { reason: 'heal' as const, from: run.agreed.tick, base: run.agreed } : { reason: 'heal' as const, from: 0, base: null }
    out.push(send(conn.id, { t: 'heal', tick }), ...syncEffect(state, conn.id, run, s))
  }
  out.push(event(room, 'run.desync', { run: run.start.id, tick, seats: seats.join(','), dump: run.dumps < MAX_DUMPS }))
  if (run.dumps < MAX_DUMPS) {
    run.dumps += 1
    out.push({ k: 'save' }, { k: 'dump', reason: 'desync', run: run.start.id, tick, reports, majority: agreedHash, minority: seats })
  }
  return [...out, ...updateUploader(state, room)]
}

const acceptSnapshot = (room: Room, run: Run, up: Upload): Effect[] => {
  run.agreed = { tick: up.tick, h: up.h, parts: up.parts }
  run.agreedBy = up.seat
  return [{ k: 'save' }, { k: 'keepSnapshot', run: run.start.id, tick: up.tick }, event(room, 'snapshot.agreed', { run: run.start.id, tick: up.tick, parts: up.parts })]
}

/** Compares the reports of `tick`: the majority's hash is decided, the minority healed, a matching upload agreed. */
const decide = (state: State, room: Room, run: Run, tick: number): Effect[] => {
  const live = state.live
  const reports = live.reports.get(tick)
  live.reports.delete(tick)
  live.firstReport.delete(tick)
  if (!reports || reports.size === 0) return []
  // Seats being healed only vote when nobody else reported: a still-diverged seat never drags the others along.
  const healthy = new Map([...reports].filter(([seat]) => !live.healing.has(seat)))
  const h = majority(healthy.size > 0 ? healthy : reports)
  if (h === null) return []
  live.decided.set(tick, h)
  for (const t of live.decided.keys()) if (t < tick - HASH_WINDOW) live.decided.delete(t)
  const bySeat = Object.fromEntries(reports)
  live.unlogged.hashes.push([tick, bySeat])
  const out: Effect[] = []
  for (const [seat, v] of reports) if (v === h) live.healing.delete(seat)
  // The snapshot first: accepting it drops the older one's chunks, which a heal sent in this same batch would read.
  const up = live.upload
  if (up && up.tick === tick && up.got.size === up.parts) {
    live.upload = null
    out.push(...(up.h === h ? acceptSnapshot(room, run, up) : [dropSnapshot(run, up)]))
  }
  // A seat told to heal after this tick reported it before the heal reached it: it's already being healed.
  const minority = [...reports].filter(([seat, v]) => v !== h && !((live.healing.get(seat) ?? -1) > tick)).map(([seat]) => seat)
  if (minority.length > 0) out.push(...heal(state, room, run, minority, tick, bySeat, h))
  return [...out, ...updateUploader(state, room)]
}

const onHash = (state: State, room: Room, run: Run, seat: number, tick: number, h: string, now: number): Effect[] => {
  const live = state.live
  if (tick >= run.next || tick < run.next - HASH_WINDOW) return []
  const healingFrom = live.healing.get(seat)
  if (healingFrom !== undefined && tick < healingFrom) return []
  const decided = live.decided.get(tick)
  if (decided !== undefined) {
    if (decided === h) {
      live.healing.delete(seat)
      return updateUploader(state, room)
    }
    return heal(state, room, run, [seat], tick, { [seat]: h }, decided)
  }
  const reports = live.reports.get(tick) ?? new Map<number, string>()
  reports.set(seat, h)
  live.reports.set(tick, reports)
  if (!live.firstReport.has(tick)) live.firstReport.set(tick, now)
  const expected = liveSeats(state, room).filter((s) => !live.healing.has(s))
  return expected.every((s) => reports.has(s)) ? decide(state, room, run, tick) : []
}

const onSnap = (state: State, room: Room, run: Run, seat: number, msg: Extract<ClientMessage, { t: 'snap' }>): Effect[] => {
  const live = state.live
  if (seat !== live.uploader || msg.tick >= run.next || msg.tick <= (run.agreed?.tick ?? -1)) return []
  let up = live.upload
  const out: Effect[] = []
  if (!up || up.tick !== msg.tick) {
    if (up && up.tick > msg.tick) return []
    // A newer upload replaces one that never made it: its chunks go.
    if (up) out.push(dropSnapshot(run, up))
    up = { seat, tick: msg.tick, h: msg.h, parts: msg.parts, got: new Set() }
    live.upload = up
  }
  if (up.seat !== seat || up.h !== msg.h || up.parts !== msg.parts || up.got.has(msg.part)) return out
  up.got.add(msg.part)
  out.push({ k: 'chunk', run: run.start.id, tick: msg.tick, part: msg.part, data: msg.data })
  if (up.got.size < up.parts) return out
  const decided = live.decided.get(up.tick)
  if (decided === undefined) return out
  live.upload = null
  return [...out, ...(decided === up.h ? acceptSnapshot(room, run, up) : [dropSnapshot(run, up)])]
}

const dropSnapshot = (run: Run, up: { tick: number }): Effect => ({ k: 'dropSnapshot', run: run.start.id, tick: up.tick })

/**
 * A seat restored the agreed snapshot and it didn't hash to its label (the
 * relay can't check the bytes, only the label the majority agreed on): it
 * goes, its uploader stops uploading while anyone else can, and a dump is
 * recorded. The seat joins afresh: from a newer snapshot, or the seed.
 */
const onBadSnap = (state: State, room: Room, run: Run, seat: number, tick: number): Effect[] => {
  const agreed = run.agreed
  const calls = state.live.badSnaps.get(seat) ?? 0
  if (!agreed || agreed.tick !== tick || calls >= MAX_BAD_SNAPS) return []
  state.live.badSnaps.set(seat, calls + 1)
  const by = run.agreedBy
  run.agreed = null
  run.agreedBy = null
  if (by !== null && !run.demoted.includes(by)) run.demoted.push(by)
  const out: Effect[] = [...flush(state, run), { k: 'save' }, dropSnapshot(run, agreed), event(room, 'snapshot.bad', { run: run.start.id, tick, seat, uploader: by })]
  if (run.dumps < MAX_DUMPS) {
    run.dumps += 1
    out.push({ k: 'dump', reason: 'badSnap', run: run.start.id, tick, reports: {}, majority: agreed.h, minority: [seat] })
  }
  return [...out, ...updateUploader(state, room)]
}

/* ---------------- Time ---------------- */

/**
 * Sends the ticks the clock allows since the last frame, the pending entries
 * stamped into the first one. The log batch (lazy) goes once a second of
 * ticks, with the bound when it runs short.
 */
const emit = (state: State, run: Run, now: number): Effect[] => {
  const due = ticksDue(run.clockBase, now)
  if (due <= run.next) return []
  const from = run.next
  const entries = state.live.pending
  state.live.pending = []
  run.next = due
  if (entries.length > 0) state.live.unlogged.ticks.push([from, entries])
  // Checked once a second, so the bound rides on that second's batch, early enough that `BOUND_REFRESH` ticks stay ahead until the next.
  const second = Math.floor(due / LOG_BATCH) !== Math.floor(from / LOG_BATCH)
  const short = second && run.bound - due < BOUND_REFRESH + LOG_BATCH
  if (short) run.bound = due + BOUND_AHEAD
  const out = second ? flush(state, run, short) : []
  out.push(...toSeated(state, { t: 'frame', from, to: due, ticks: entries.length > 0 ? [[from, entries]] : [] }))
  return out
}

/**
 * Everything time does: the frame clock (when running), seats going `away`,
 * overdue hash comparisons, the host handing over, lobby seats dropped and the
 * room expiring (idle, or past its maximum age). Called by the frame timer at 60 Hz in a run, and by the alarm
 * at `deadline` otherwise.
 */
export const tick = (state: State, now: number): Effect[] => {
  const room = state.room
  if (!room) return []
  // A room the group moved away from keeps answering old links (`moved`) until its maximum age.
  if (room.emptySince !== null && room.movedTo === null && now - room.emptySince >= TIMES.idle) return wipe(state, room, 'idle', now)
  if (now - room.createdAt >= TIMES.maxAge) return wipe(state, room, 'age', now)
  // A matchmade room's join window closed: it plays with whoever came (or goes).
  if (room.lock && room.phase === 'lobby' && now >= room.lock.startBy) return autoStart(state, room, now)
  const out: Effect[] = []
  const someoneOnline = room.seats.some((s) => online(state, s))
  const host = room.seats.find((s) => s.seat === room.host)
  if (host && host.offlineSince !== null && now - host.offlineSince >= TIMES.hostHandoff) {
    const next = room.seats.find((s) => online(state, s))
    if (next) {
      room.host = next.seat
      out.push({ k: 'save' }, event(room, 'room.host', { seat: next.seat, why: 'offline' }), ...broadcastRoom(state, room))
    }
  }
  if (room.phase !== 'playing' && someoneOnline) {
    for (const s of room.seats.filter((x) => x.offlineSince !== null && now - x.offlineSince >= TIMES.lobbyDrop)) {
      if (state.room) out.push(event(room, 'seat.dropped', { seat: s.seat }), ...removeSeat(state, room, s, now))
    }
  }
  const run = room.run
  if (state.room && room.phase === 'playing' && run && !run.ended && !run.paused) {
    let changed = false
    for (const seat of run.start.players.map((p) => p.seat)) {
      const s = room.seats.find((x) => x.seat === seat)
      if (!s || s.away || !inRun(run, seat) || now - (state.live.lastSeen.get(seat) ?? 0) < TIMES.away) continue
      s.away = true
      stamp(state, [seat, 'away'])
      changed = true
    }
    // An Arena match waiting on a seat that just went away may end now (`evaluateOver`).
    if (changed) out.push({ k: 'save' }, ...broadcastRoom(state, room), ...updateUploader(state, room), ...evaluateOver(state, room, now))
    for (const [t, first] of [...state.live.firstReport]) if (now - first >= TIMES.hashWait) out.push(...decide(state, room, run, t))
    for (const t of state.live.reports.keys()) {
      if (t < run.next - HASH_WINDOW) {
        state.live.reports.delete(t)
        state.live.firstReport.delete(t)
      }
    }
    out.push(...emit(state, run, now))
    // Everyone in the run just went away: the clock stops after their `away` went out.
    if (changed) out.push(...settle(state, room, now))
  }
  return out
}

/** When `tick` next has something to do outside the frame clock (for the alarm), or null. */
export const deadline = (state: State): number | null => {
  const room = state.room
  if (!room) return null
  const times: number[] = [room.createdAt + TIMES.maxAge]
  if (room.emptySince !== null && room.movedTo === null) times.push(room.emptySince + TIMES.idle)
  if (room.lock && room.phase === 'lobby') times.push(room.lock.startBy)
  const someoneOnline = room.seats.some((s) => online(state, s))
  if (someoneOnline) {
    const host = room.seats.find((s) => s.seat === room.host)
    if (host?.offlineSince != null) times.push(host.offlineSince + TIMES.hostHandoff)
    if (room.phase !== 'playing') for (const s of room.seats) if (s.offlineSince !== null) times.push(s.offlineSince + TIMES.lobbyDrop)
  }
  return Math.min(...times)
}
