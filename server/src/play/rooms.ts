import { DEFAULT_DIFFICULTY, type Difficulty } from '../../../src/game/difficulty'
import {
  MAX_PLAYERS,
  roomView,
  VIEW_LIMITS,
  type ClientMessage,
  type Loadout,
  type Member,
  type RoomPhase,
  type ServerMessage,
  type TickEntry,
  type View,
} from '../../../src/net/protocol'

/**
 * Co-op rooms as a pure state machine: no sockets, timers, clock or randomness
 * (the caller passes `now`, in ms of a monotonic clock, and a `Gen`). Every
 * function mutates the plain `Rooms` state and returns the messages to send,
 * addressed to connections. The server never simulates: in a run it only
 * stamps inputs into numbered ticks (`tickRooms`) and relays them.
 */

export type ConnId = number

export type Out = { to: ConnId; msg: ServerMessage }

/** Who is behind a connection, as the handshake (`hello`) told. */
export type Conn = { id: ConnId; name: string; handle: string | null; build: string }

/** Randomness, injected: a room code (`ROOM_CODE_ALPHABET`), a slot secret (`[a-z0-9]{16,64}`) and a uint32 seed. */
export type Gen = { code: () => string; secret: () => string; seed: () => number }

/** Simulation ticks per second. */
export const TICK_HZ = 60

/** How long things wait, in ms. */
export const ROOM_TIMES = {
  /** A dropped member keeps their lobby seat this long. */
  lobbyGrace: 15_000,
  /** A dropped player keeps their slot in a run this long, then leaves for good. */
  runGrace: 90_000,
  /** The clock starts without whoever hasn't loaded by then. */
  loadTimeout: 30_000,
  /** A room nobody is connected to is deleted after this long. */
  quiet: 120_000,
} as const

/** Checksums older than this many ticks behind the clock are forgotten (clients send one every 120 ticks). */
const SUM_WINDOW = 60 * TICK_HZ

const DEFAULT_LOADOUT: Loadout = { starter: 'bulbasaur', shiny: false, ranks: {} }

const DEFAULT_VIEW: View = { w: VIEW_LIMITS.min, h: VIEW_LIMITS.min }

type Seat = {
  slot: number
  /** Join order: slots are compacted in it when a run starts or ends. */
  order: number
  secret: string
  /** Null while their connection is down. */
  conn: ConnId | null
  offlineSince: number | null
  name: string
  handle: string | null
  loadout: Loadout
  view: View
  ready: boolean
  loaded: boolean
  /** Whether the last presence entry stamped for them is `away`. */
  away: boolean
}

type StartMessage = Extract<ServerMessage, { t: 'start' }>

export type Room = {
  code: string
  /** The creator's game build: only the same build joins (mixed builds would desync). */
  build: string
  difficulty: Difficulty
  phase: RoomPhase
  /** Sorted by slot. */
  seats: Seat[]
  host: Seat | null
  joins: number
  /** The run's `start` message, re-sent as is on rejoin (its roster includes who left since). */
  start: StartMessage | null
  loadingSince: number
  goAt: number
  /** The next tick to emit: ticks `0..nextTick - 1` went out. */
  nextTick: number
  finished: boolean
  /** Entries queued since the last frame, stamped into the next tick emitted. */
  pending: TickEntry[]
  /** Every entry of the run by tick, in order: exactly the entries of a backlog frame from tick 0. */
  history: Array<readonly [tick: number, entry: TickEntry]>
  /** Checksums by tick, then slot. */
  sums: Map<number, Map<number, number>>
  desynced: boolean
  /** Since when no member is connected. */
  quietSince: number | null
}

export type Rooms = {
  byCode: Map<string, Room>
  byConn: Map<ConnId, Room>
  gen: Gen
  log: (line: string) => void
  /** Counts since boot, for the server's log. */
  stats: { created: number; started: number; closed: number; desyncs: number }
}

/** The messages `handleRoom` takes; the server answers the rest (handshake, presence, ping) itself. */
export type RoomMessage = Exclude<ClientMessage, { t: 'hello' | 'invite' | 'friends' | 'ping' }>

export const createRooms = (gen: Gen, log: (line: string) => void = () => {}): Rooms => ({
  byCode: new Map(),
  byConn: new Map(),
  gen,
  log,
  stats: { created: 0, started: 0, closed: 0, desyncs: 0 },
})

/**
 * How many ticks the clock allows `now`: tick `t` covers `[t, t + 1) / 60` s
 * after `goAt`, and goes out once that window has fully passed, so a client
 * stepping every tick it has never runs ahead of the server's clock. Computed
 * from `goAt` every time, so it never drifts however late the interval fires.
 */
export const ticksDue = (goAt: number, now: number) => Math.max(0, Math.floor(((now - goAt) * TICK_HZ) / 1000))

/** The room code of a connection's room, or null. */
export const roomOf = (rooms: Rooms, conn: ConnId) => rooms.byConn.get(conn)?.code ?? null

/* ---------------- Messages ---------------- */

const online = (s: Seat) => s.conn !== null

const memberOf = (s: Seat): Member => ({ ...s.loadout, slot: s.slot, name: s.name, handle: s.handle, ready: s.ready, online: online(s), view: s.view })

const lobbyMsg = (room: Room): ServerMessage => ({
  t: 'lobby',
  code: room.code,
  host: room.host?.slot ?? 0,
  difficulty: room.difficulty,
  phase: room.phase,
  members: room.seats.map(memberOf),
})

const toAll = (room: Room, msg: ServerMessage): Out[] => room.seats.flatMap((s) => (s.conn === null ? [] : [{ to: s.conn, msg }]))

const toSeat = (s: Seat, msg: ServerMessage): Out[] => (s.conn === null ? [] : [{ to: s.conn, msg }])

const roomMsg = (room: Room, s: Seat): Out[] => toSeat(s, { t: 'room', code: room.code, slot: s.slot, secret: s.secret })

const refuse = (conn: ConnId, code: Extract<ServerMessage, { t: 'refused' }>['code']): Out[] => [{ to: conn, msg: { t: 'refused', code } }]

/* ---------------- Ticks ---------------- */

const sameEntry = (a: TickEntry, b: TickEntry) => a.length === b.length && a.every((v, i) => v === b[i])

/**
 * Queues an entry for the next tick emitted: a slot's newer `move` replaces its
 * older one, and a repeated press, choice or pick is dropped. Presence entries
 * (`away`, `back`, `leave`) always keep their order.
 */
const stamp = (room: Room, entry: TickEntry) => {
  const [slot, kind] = entry
  if (kind === 'move') {
    const i = room.pending.findIndex((e) => e[0] === slot && e[1] === 'move')
    if (i >= 0) room.pending.splice(i, 1)
  } else if (kind !== 'away' && kind !== 'back' && kind !== 'leave' && room.pending.some((e) => sameEntry(e, entry))) {
    return
  }
  room.pending.push(entry)
}

const setAway = (room: Room, s: Seat, away: boolean) => {
  if (s.away === away) return
  s.away = away
  stamp(room, [s.slot, away ? 'away' : 'back'])
}

/** Emits every tick the clock allows since the last frame, with the queued entries in the first one. */
const emit = (room: Room, now: number): Out[] => {
  const due = ticksDue(room.goAt, now)
  if (due <= room.nextTick) return []
  const first = room.nextTick
  for (const e of room.pending) room.history.push([first, e])
  const entries = room.pending.map((e) => [0, e] as const)
  room.pending = []
  room.nextTick = due
  return toAll(room, { t: 'frame', first, count: due - first, entries })
}

/* ---------------- Lifecycle ---------------- */

const updateQuiet = (room: Room, now: number) => {
  room.quietSince = room.seats.some(online) ? null : (room.quietSince ?? now)
}

/** Reassigns slots 0..n-1 in join order. Returns the seats whose slot changed. */
const compact = (room: Room) => {
  room.seats.sort((a, b) => a.order - b.order)
  return room.seats.filter((s, i) => {
    const moved = s.slot !== i
    s.slot = i
    return moved
  })
}

const closeRoom = (rooms: Rooms, room: Room) => {
  rooms.byCode.delete(room.code)
  for (const s of room.seats) if (s.conn !== null) rooms.byConn.delete(s.conn)
  rooms.stats.closed++
}

const addSeat = (rooms: Rooms, room: Room, conn: Conn): Seat => {
  let slot = 0
  while (room.seats.some((s) => s.slot === slot)) slot++
  const seat: Seat = {
    slot,
    order: room.joins++,
    secret: rooms.gen.secret(),
    conn: conn.id,
    offlineSince: null,
    name: conn.name,
    handle: conn.handle,
    loadout: DEFAULT_LOADOUT,
    view: DEFAULT_VIEW,
    ready: false,
    loaded: false,
    away: false,
  }
  room.seats.push(seat)
  room.seats.sort((a, b) => a.slot - b.slot)
  rooms.byConn.set(conn.id, room)
  room.quietSince = null
  return seat
}

/** The clock starts once every connected player loaded the run, or at the load timeout. */
const maybeGo = (room: Room, now: number): Out[] => {
  if (room.phase !== 'loading') return []
  if (!room.seats.filter(online).every((s) => s.loaded) && now - room.loadingSince < ROOM_TIMES.loadTimeout) return []
  room.phase = 'playing'
  room.goAt = now
  room.nextTick = 0
  return toAll(room, { t: 'go' })
}

/**
 * Takes a seat out of the room: `reason` tells them why (null when their
 * connection is gone or they joined another room). In a run their slot gets a
 * `leave` entry and stays empty. The lowest slot left inherits the host.
 */
const removeSeat = (rooms: Rooms, room: Room, seat: Seat, now: number, reason: 'leave' | 'kicked' | null): Out[] => {
  const out: Out[] = reason ? toSeat(seat, { t: 'left', reason }) : []
  if (seat.conn !== null) rooms.byConn.delete(seat.conn)
  room.seats = room.seats.filter((s) => s !== seat)
  if (room.phase !== 'lobby') stamp(room, [seat.slot, 'leave'])
  const hostLeft = room.host === seat
  if (hostLeft) room.host = room.seats[0] ?? null
  if (room.seats.length === 0) {
    closeRoom(rooms, room)
    return out
  }
  updateQuiet(room, now)
  // In a run the lobby message only goes out again when the host moved.
  if (room.phase === 'lobby' || hostLeft) out.push(...toAll(room, lobbyMsg(room)))
  return [...out, ...maybeGo(room, now)]
}

/** Leaves whatever room `conn` is in without a word to them (they're joining another). */
const detach = (rooms: Rooms, conn: ConnId, now: number): Out[] => {
  const room = rooms.byConn.get(conn)
  const seat = room?.seats.find((s) => s.conn === conn)
  return room && seat ? removeSeat(rooms, room, seat, now, null) : []
}

const create = (rooms: Rooms, conn: Conn, now: number): Out[] => {
  const out = detach(rooms, conn.id, now)
  let code = rooms.gen.code()
  while (rooms.byCode.has(code)) code = rooms.gen.code()
  const room: Room = {
    code,
    build: conn.build,
    difficulty: DEFAULT_DIFFICULTY,
    phase: 'lobby',
    seats: [],
    host: null,
    joins: 0,
    start: null,
    loadingSince: 0,
    goAt: 0,
    nextTick: 0,
    finished: false,
    pending: [],
    history: [],
    sums: new Map(),
    desynced: false,
    quietSince: null,
  }
  rooms.byCode.set(code, room)
  room.host = addSeat(rooms, room, conn)
  rooms.stats.created++
  return [...out, ...roomMsg(room, room.host), ...toAll(room, lobbyMsg(room))]
}

/** Takes a held seat back after a drop, and catches the connection up on the room's phase. */
const rejoin = (rooms: Rooms, room: Room, seat: Seat, conn: Conn, now: number): Out[] => {
  const mine = room.seats.find((s) => s.conn === conn.id)
  const out = mine === seat ? [] : detach(rooms, conn.id, now)
  // A connection still holding the seat (a socket not yet known dead) loses it.
  if (seat.conn !== null && seat.conn !== conn.id) rooms.byConn.delete(seat.conn)
  seat.conn = conn.id
  seat.offlineSince = null
  rooms.byConn.set(conn.id, room)
  room.quietSince = null
  out.push(...roomMsg(room, seat))
  if (room.phase === 'lobby') return [...out, ...toAll(room, lobbyMsg(room))]
  out.push(...toSeat(seat, lobbyMsg(room)))
  if (room.start) out.push(...toSeat(seat, room.start))
  setAway(room, seat, false)
  if (room.phase === 'loading') {
    seat.loaded = false
    return out
  }
  return [...out, ...toSeat(seat, { t: 'go' }), ...toSeat(seat, { t: 'frame', first: 0, count: room.nextTick, entries: room.history })]
}

const join = (rooms: Rooms, conn: Conn, code: string, secret: string | null, now: number): Out[] => {
  const room = rooms.byCode.get(code)
  if (!room) return refuse(conn.id, 'notFound')
  if (room.build !== conn.build) return refuse(conn.id, 'version')
  const held = secret === null ? undefined : room.seats.find((s) => s.secret === secret)
  if (held) return rejoin(rooms, room, held, conn, now)
  if (room.phase !== 'lobby') return refuse(conn.id, 'started')
  if (rooms.byConn.get(conn.id) === room) return toAll(room, lobbyMsg(room))
  if (room.seats.length >= MAX_PLAYERS) return refuse(conn.id, 'full')
  const out = detach(rooms, conn.id, now)
  const seat = addSeat(rooms, room, conn)
  return [...out, ...roomMsg(room, seat), ...toAll(room, lobbyMsg(room))]
}

/**
 * Starts the run: slots compacted 0..n-1 in join order, a fresh seed, the
 * view every member's screen fits in. Dropped members still in their grace
 * come along, stamped `away` from tick 0.
 */
const startRun = (rooms: Rooms, room: Room, now: number): Out[] => {
  const moved = compact(room)
  room.phase = 'loading'
  room.loadingSince = now
  room.finished = false
  room.pending = []
  room.history = []
  room.nextTick = 0
  room.sums.clear()
  room.desynced = false
  for (const s of room.seats) {
    s.loaded = false
    s.away = false
    if (!online(s)) setAway(room, s, true)
  }
  room.start = {
    t: 'start',
    seed: rooms.gen.seed() >>> 0,
    difficulty: room.difficulty,
    view: roomView(room.seats.map((s) => s.view)),
    members: room.seats.map(memberOf),
  }
  rooms.stats.started++
  return [...moved.flatMap((s) => roomMsg(room, s)), ...toAll(room, lobbyMsg(room)), ...toAll(room, room.start)]
}

/** Back to the lobby after a run: the clock stops, slots are compacted again and nobody is ready. */
const toLobby = (room: Room): Out[] => {
  room.phase = 'lobby'
  room.start = null
  room.finished = false
  room.pending = []
  room.history = []
  room.nextTick = 0
  room.sums.clear()
  room.desynced = false
  const moved = compact(room)
  for (const s of room.seats) {
    s.ready = false
    s.loaded = false
    s.away = false
  }
  return [...moved.flatMap((s) => roomMsg(room, s)), ...toAll(room, lobbyMsg(room))]
}

/** Records a checksum; the first two that disagree on a tick flag the room as desynced, once. */
const checkSum = (rooms: Rooms, room: Room, seat: Seat, tick: number, sum: number): Out[] => {
  if (tick >= room.nextTick || tick < room.nextTick - SUM_WINDOW) return []
  for (const t of room.sums.keys()) if (t < room.nextTick - SUM_WINDOW) room.sums.delete(t)
  const sums = room.sums.get(tick) ?? new Map<number, number>()
  sums.set(seat.slot, sum)
  room.sums.set(tick, sums)
  if (room.desynced || [...sums.values()].every((s) => s === sum)) return []
  room.desynced = true
  rooms.stats.desyncs++
  rooms.log(`room ${room.code} desync at tick ${tick}: ${[...sums].map(([slot, s]) => `${slot}=${s}`).join(' ')}`)
  return toAll(room, { t: 'desync', tick })
}

/* ---------------- Events ---------------- */

/** A room message from connection `conn`. Messages that don't fit the room's phase, or from outside a room, are ignored. */
export const handleRoom = (rooms: Rooms, conn: Conn, msg: RoomMessage, now: number): Out[] => {
  if (msg.t === 'create') return create(rooms, conn, now)
  if (msg.t === 'join') return join(rooms, conn, msg.code, msg.secret, now)
  const room = rooms.byConn.get(conn.id)
  const seat = room?.seats.find((s) => s.conn === conn.id)
  if (!room || !seat) return []
  const isHost = room.host === seat
  const lobby = room.phase === 'lobby'
  const playing = room.phase === 'playing'
  const changed = () => toAll(room, lobbyMsg(room))
  switch (msg.t) {
    case 'leave':
      return removeSeat(rooms, room, seat, now, 'leave')
    case 'loadout':
      if (!lobby) return []
      seat.loadout = msg.loadout
      seat.view = msg.view
      return changed()
    case 'ready':
      if (!lobby) return []
      seat.ready = msg.ready
      return changed()
    case 'difficulty':
      if (!lobby) return []
      if (!isHost) return refuse(conn.id, 'notHost')
      room.difficulty = msg.difficulty
      return changed()
    case 'kick': {
      if (!isHost) return refuse(conn.id, 'notHost')
      const target = room.seats.find((s) => s.slot === msg.slot)
      return target && target !== seat ? removeSeat(rooms, room, target, now, 'kicked') : []
    }
    case 'start':
      if (!lobby) return []
      if (!isHost) return refuse(conn.id, 'notHost')
      // The host's own start says they're ready.
      if (!room.seats.every((s) => s === seat || !online(s) || s.ready)) return refuse(conn.id, 'notReady')
      return startRun(rooms, room, now)
    case 'loaded':
      if (room.phase !== 'loading') return []
      seat.loaded = true
      return maybeGo(room, now)
    case 'move':
      if (playing) stamp(room, [seat.slot, 'move', msg.code, msg.sample])
      return []
    case 'press':
      if (playing) stamp(room, [seat.slot, msg.press])
      return []
    case 'choice':
      if (playing) stamp(room, [seat.slot, msg.choice])
      return []
    case 'offer':
      if (playing) stamp(room, [seat.slot, 'offer', msg.index, msg.round])
      return []
    case 'away':
      if (playing) setAway(room, seat, msg.away)
      return []
    case 'sum':
      return playing ? checkSum(rooms, room, seat, msg.tick, msg.sum) : []
    case 'over':
      if (playing) room.finished = true
      return []
    case 'lobby':
      return !lobby && (room.finished || isHost) ? toLobby(room) : []
  }
}

/** A connection closed. Its seat is held (`ROOM_TIMES`); in a run the player is stamped `away` meanwhile. */
export const disconnect = (rooms: Rooms, conn: ConnId, now: number): Out[] => {
  const room = rooms.byConn.get(conn)
  rooms.byConn.delete(conn)
  const seat = room?.seats.find((s) => s.conn === conn)
  if (!room || !seat) return []
  seat.conn = null
  seat.offlineSince = now
  updateQuiet(room, now)
  if (room.phase === 'lobby') return toAll(room, lobbyMsg(room))
  setAway(room, seat, true)
  return maybeGo(room, now)
}

/**
 * The server's heartbeat (every frame, ~33 ms, one call for all rooms): drops
 * seats past their grace, deletes quiet rooms, starts clocks past the load
 * timeout and emits the ticks each running clock allows.
 */
export const tickRooms = (rooms: Rooms, now: number): Out[] => {
  const out: Out[] = []
  for (const room of [...rooms.byCode.values()]) {
    const grace = room.phase === 'lobby' ? ROOM_TIMES.lobbyGrace : ROOM_TIMES.runGrace
    for (const s of room.seats.filter((s) => s.offlineSince !== null && now - s.offlineSince >= grace)) {
      if (rooms.byCode.has(room.code)) out.push(...removeSeat(rooms, room, s, now, null))
    }
    if (!rooms.byCode.has(room.code)) continue
    if (room.quietSince !== null && now - room.quietSince >= ROOM_TIMES.quiet) {
      closeRoom(rooms, room)
      continue
    }
    if (room.phase === 'loading') out.push(...maybeGo(room, now))
    if (room.phase === 'playing') out.push(...emit(room, now))
  }
  return out
}
