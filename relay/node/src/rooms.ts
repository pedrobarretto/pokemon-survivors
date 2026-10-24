import { randomUUID } from 'node:crypto'
import type { RawData, WebSocket } from 'ws'
import { CLOSE_CODES, LIMITS, parseClientMessage, type Auth, type CloseReason, type ServerMessage, type VpsHome } from '../../../src/net/protocol'
import { gen, randomCode, randomToken } from '../../src/codes'
import { gzip } from '../../src/gzip'
import {
  connect,
  createRoom,
  deadline,
  disconnect,
  flushLog,
  hello,
  loadState,
  message,
  nextTickAt,
  reattach,
  running,
  tick,
  type ConnId,
  type Effect,
  type Identity,
  type Room,
  type State,
} from '../../src/room'
import { createSchema, dumpJson, persist, readBound, readRoom, syncTexts, type Store } from '../../src/store'
import { openRoomDb, roomCodes, type RoomDb, type Vault } from './db'

/**
 * The rooms of a VPS relay: what the Durable Object (`roomObject.ts`)
 * does for one room, done here for every room in one process. Each room is
 * the same pure state machine (`room.ts`) with its own SQLite file, frame
 * timer (60 Hz while a run's clock runs, the same tick math) and alarm. A
 * restart (a deploy, a crash) loses only the sockets: the rooms load back
 * from disk, and the players reconnect and resume from their own tick.
 */

export type Log = (ev: string, data?: Record<string, unknown>) => void

/** A socket not seated within this long is closed (no valid `hello`, or its auth still being checked). */
const HELLO_TIMEOUT_MS = 10_000

/** The standard "service restart" close: not one of ours (`CLOSE_CODES`), so clients reconnect at once and resume. */
export const RESTART_CLOSE = 1012

/** Room codes tried before giving up. */
const CREATE_TRIES = 8

/** Node's longest timer (about 24.8 days); room deadlines are hours away at most. */
const MAX_TIMER_MS = 2 ** 31 - 1

type Shell = {
  code: string
  /** Null for a code with no room on this relay: its sockets are refused, and nothing is written. */
  db: RoomDb | null
  state: State
  sockets: Map<ConnId, WebSocket>
  authing: Set<ConnId>
  timer: NodeJS.Timeout | null
  alarm: NodeJS.Timeout | null
  alarmAt: number | null
}

export type RoomsDeps = {
  /** This relay's home: its room codes, and the rooms' `region`. */
  home: VpsHome
  dataDir: string
  vault: Vault
  log: Log
  /** Checks a hello's auth: who it is, or null when it fails. */
  identify: (auth: Auth) => Promise<Identity | null>
  guests: boolean
  now: () => number
}

/** The storage effects: a batch with none of them writes nothing (most frames). */
const STORED = new Set<Effect['k']>(['save', 'log', 'chunk', 'keepSnapshot', 'dropSnapshot', 'dropRun'])

/** The clock bound of a loaded room's run, from its newest log batch: the clock resumes past every tick sent. */
const boundOf = (store: Store, room: Room | null) => (room?.run ? readBound(store, room.run.start.id) : 0)

const textOf = (data: RawData) => (Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data))).toString('utf8')

export const createRooms = (deps: RoomsDeps) => {
  const { log, now } = deps
  const rooms = new Map<string, Shell>()
  let closing = false

  const shellFor = (code: string, db: RoomDb | null, state: State): Shell => ({
    code,
    db,
    state,
    sockets: new Map(),
    authing: new Set(),
    timer: null,
    alarm: null,
    alarmAt: null,
  })

  const send = (shell: Shell, id: ConnId, text: string) => {
    const ws = shell.sockets.get(id)
    if (ws && ws.readyState === ws.OPEN) ws.send(text)
  }

  const closeSocket = (shell: Shell, id: ConnId, reason: CloseReason) => shell.sockets.get(id)?.close(CLOSE_CODES[reason], reason)

  const clearTimers = (shell: Shell) => {
    if (shell.timer) clearTimeout(shell.timer)
    if (shell.alarm) clearTimeout(shell.alarm)
    shell.timer = null
    shell.alarm = null
    shell.alarmAt = null
  }

  /** Forgets a shell that holds nothing: no room and no socket. */
  const release = (shell: Shell) => {
    if (!shell.state.room && shell.sockets.size === 0 && rooms.get(shell.code) === shell) rooms.delete(shell.code)
  }

  /**
   * Applies the room's effects as the Durable Object does: every storage
   * write first (`persist`: the lazy ones, then the room saved once), then the
   * messages and closes in order. There is no output gate here: the writes go
   * in one local transaction (microseconds) before anything is sent, so the
   * durable ones are on disk first and the lazy ones (the log batch a second
   * and its clock bound, `room.ts`) come along. Then the timers.
   */
  const apply = (shell: Shell, effects: readonly Effect[]) => {
    const db = shell.db
    if (db && effects.some((e) => STORED.has(e.k))) db.tx(() => persist(db.store, effects, shell.state.room))
    const texts = new Map<ServerMessage, string>()
    let wiped = false
    for (const e of effects) {
      if (e.k === 'send') {
        // A welcome says where the room runs (`WelcomeNet`), as the Durable Object's does: this VPS, no Cloudflare edge.
        const text = e.msg.t === 'welcome' ? JSON.stringify({ ...e.msg, net: { colo: `vps:${deps.home}`, region: shell.state.room?.region ?? null, edge: null, edgeRtt: null } }) : (texts.get(e.msg) ?? JSON.stringify(e.msg))
        texts.set(e.msg, text)
        send(shell, e.to, text)
      } else if (e.k === 'sync') {
        if (db) for (const text of syncTexts(db.store, e)) send(shell, e.to, text)
      } else if (e.k === 'close') closeSocket(shell, e.to, e.reason)
      else if (e.k === 'event') log(e.ev, e.data)
      else if (e.k === 'dump') void dump(shell, e).catch((err: unknown) => log('dump.failed', { code: shell.code, error: String(err) }))
      else if (e.k === 'wipe') wiped = true
    }
    if (wiped) return wipe(shell)
    schedule(shell)
  }

  /**
   * Runs one of the room's steps. A step that throws (a bug) never takes the
   * other rooms down: this room starts over from its file, as a Durable
   * Object would, and its players reconnect and resume.
   */
  const step = (shell: Shell, fn: () => readonly Effect[]) => {
    if (closing) return
    try {
      apply(shell, fn())
    } catch (err) {
      log('room.error', { code: shell.code, error: err instanceof Error ? (err.stack ?? err.message) : String(err) })
      reload(shell)
    }
  }

  const reload = (shell: Shell) => {
    clearTimers(shell)
    for (const ws of shell.sockets.values()) ws.close(RESTART_CLOSE, 'restart')
    shell.sockets.clear()
    shell.authing.clear()
    const room = shell.db ? readRoom(shell.db.store.sql) : null
    shell.state = loadState(room, gen, now(), shell.db ? boundOf(shell.db.store, room) : 0)
    if (!room) {
      shell.db?.remove()
      shell.db = null
      return release(shell)
    }
    try {
      apply(shell, reattach(shell.state, [], now()))
    } catch (err) {
      // It fails again from its own file: it stays on disk (the next boot tries it) but leaves memory.
      log('room.error', { code: shell.code, error: String(err), fatal: true })
      clearTimers(shell)
      shell.db?.close()
      rooms.delete(shell.code)
    }
  }

  /** The frame timer while a run's clock runs; the alarm for everything else time does. */
  const schedule = (shell: Shell) => {
    const run = shell.state.room?.run
    if (running(shell.state) && run) {
      shell.timer ??= setTimeout(() => {
        shell.timer = null
        step(shell, () => tick(shell.state, now()))
      }, Math.max(0, Math.ceil(nextTickAt(run) - now())))
    } else if (shell.timer) {
      clearTimeout(shell.timer)
      shell.timer = null
    }
    const at = deadline(shell.state)
    if (at === shell.alarmAt) return
    if (shell.alarm) clearTimeout(shell.alarm)
    shell.alarm = null
    shell.alarmAt = at
    if (at === null) return
    shell.alarm = setTimeout(() => {
      shell.alarm = null
      shell.alarmAt = null
      step(shell, () => tick(shell.state, now()))
    }, Math.min(MAX_TIMER_MS, Math.max(0, at - now())))
  }

  /** Records a dump in the vault (the room's log and hashes are read now, before anything else can change them). */
  const dump = async (shell: Shell, e: Extract<Effect, { k: 'dump' }>) => {
    const room = shell.state.room
    const at = now()
    const json = room && shell.db ? dumpJson(shell.db.store, room, e, at) : null
    if (!room || !json) return
    const bytes = await gzip(json.body)
    const id = `${room.code}-${e.run}-${e.tick}-${randomToken(3)}`
    deps.vault.put({ id, code: room.code, run: e.run, tick: e.tick, at, size: bytes.byteLength, kind: e.reason, score: 0 }, bytes)
    log('dump.saved', { id, bytes: bytes.byteLength, logTicks: json.logTicks })
  }

  /** The room is over: its file, timers and sockets go. */
  const wipe = (shell: Shell) => {
    clearTimers(shell)
    for (const id of [...shell.sockets.keys()]) {
      send(shell, id, JSON.stringify({ t: 'bye', reason: 'expired' } satisfies ServerMessage))
      closeSocket(shell, id, 'expired')
    }
    shell.state = loadState(null, gen, now())
    shell.db?.remove()
    shell.db = null
    release(shell)
  }

  /** Loads every room on disk (after a restart): each waits, clock paused, for its players to come back. */
  const boot = () => {
    const at = now()
    let loaded = 0
    for (const code of roomCodes(deps.dataDir)) {
      const db = openRoomDb(deps.dataDir, code)
      const room = readRoom(db.store.sql)
      if (!room) {
        db.remove()
        continue
      }
      const shell = shellFor(code, db, loadState(room, gen, at, boundOf(db.store, room)))
      rooms.set(code, shell)
      step(shell, () => reattach(shell.state, [], at))
      loaded++
    }
    log('relay.loaded', { rooms: loaded })
  }

  /** Reserves a new room (`POST /rooms`): its code and its host's claim, or null when no free code turned up. */
  const create = (build: string): { code: string; claim: string } | null => {
    for (let i = 0; i < CREATE_TRIES; i++) {
      const code = randomCode(deps.home)
      const existing = rooms.get(code)
      if (existing?.state.room) continue
      const shell = existing ?? shellFor(code, null, loadState(null, gen, now()))
      const r = createRoom(shell.state, { code, build, region: `vps:${deps.home}` }, now())
      if (!r.ok) continue
      shell.db = openRoomDb(deps.dataDir, code)
      createSchema(shell.db.store.sql)
      rooms.set(code, shell)
      step(shell, () => r.effects)
      return { code, claim: r.claim }
    }
    return null
  }

  const drop = (shell: Shell, id: ConnId) => {
    if (closing || !shell.sockets.delete(id)) return
    step(shell, () => disconnect(shell.state, id, now()))
    release(shell)
  }

  const receive = async (shell: Shell, id: ConnId, data: RawData, isBinary: boolean) => {
    if (closing) return
    const text = isBinary ? null : textOf(data)
    // Far past any limit: no client of ours sends that.
    if (text !== null && text.length > LIMITS.chunkMessage * 2) return closeSocket(shell, id, 'abuse')
    const msg = text === null ? null : parseClientMessage(text)
    const conn = shell.state.live.conns.get(id)
    if (msg?.t === 'hello' && conn && conn.seat === null && !shell.authing.has(id)) {
      shell.authing.add(id)
      const identity = await deps.identify(msg.auth).catch(() => null)
      shell.authing.delete(id)
      // The socket left (or the room started over) while its token was checked: nothing to seat.
      if (!shell.sockets.has(id)) return
      return step(shell, () => hello(shell.state, id, msg, identity, now(), { guests: deps.guests }))
    }
    step(shell, () => message(shell.state, id, msg, now()))
  }

  /** A player's socket for room `code` (a code with no room here gets a shell that only refuses). */
  const accept = (code: string, ws: WebSocket, ua: string) => {
    let shell = rooms.get(code)
    if (!shell) {
      shell = shellFor(code, null, loadState(null, gen, now()))
      rooms.set(code, shell)
    }
    const room = shell
    const id = randomUUID()
    room.sockets.set(id, ws)
    connect(room.state, id, ua.slice(0, 200), now())
    ws.on('message', (data, isBinary) => void receive(room, id, data, isBinary))
    ws.on('close', () => drop(room, id))
    // A socket error is followed by its close.
    ws.on('error', () => undefined)
    setTimeout(() => {
      const conn = room.state.live.conns.get(id)
      if (closing || !room.sockets.has(id) || (conn && conn.seat !== null)) return
      closeSocket(room, id, 'refused')
    }, HELLO_TIMEOUT_MS).unref()
  }

  /**
   * The relay's rooms: `rooms` open ones, `playing` with a run's clock
   * running, `sockets`, and `live`, what its capacity counts (`capacity.ts`):
   * every room holding a lobby or a run, but not one the group moved away
   * from (a husk answering `moved`). A lobby costs nothing yet but is about to
   * play, and an empty room leaves within the idle limit (10 minutes).
   */
  const counts = () => {
    let open = 0
    let live = 0
    let playing = 0
    let sockets = 0
    for (const s of rooms.values()) {
      if (s.state.room) open++
      if (s.state.room && s.state.room.movedTo === null) live++
      if (running(s.state)) playing++
      sockets += s.sockets.size
    }
    return { rooms: open, live, playing, sockets }
  }

  /**
   * Stops for a restart or a deploy: the log each room still holds in
   * memory (under a second of it, `flushLog`) is written, every socket is
   * closed as a restart (clients reconnect at once and resume), nothing more
   * is written, the files are closed.
   */
  const shutdown = async (graceMs = 2000) => {
    closing = true
    const sockets = [...rooms.values()].flatMap((s) => {
      clearTimers(s)
      const db = s.db
      const log = flushLog(s.state)
      if (db && log.length > 0) db.tx(() => persist(db.store, log, s.state.room))
      return [...s.sockets.values()]
    })
    const closed = Promise.all(sockets.map((ws) => new Promise<void>((resolve) => (ws.readyState === ws.CLOSED ? resolve() : ws.once('close', () => resolve())))))
    for (const ws of sockets) ws.close(RESTART_CLOSE, 'restart')
    await Promise.race([closed, new Promise((r) => setTimeout(r, graceMs))])
    for (const ws of sockets) ws.terminate()
    for (const s of rooms.values()) s.db?.close()
    rooms.clear()
  }

  return { boot, create, accept, counts, shutdown }
}

export type Rooms = ReturnType<typeof createRooms>
