import { connect, createRoom, deadline, disconnect, hello, loadState, looked, message, nextTickAt, reattach, running, tick, type ConnId, type Effect, type Gen, type Identity, type State } from '../../relay/src/room'
import { parseCreate, randomCode } from '../../relay/src/codes'
import { parseRoom, persist, readBound, syncTexts, type Store, type Stored } from '../../relay/src/store'
import { CLOSE_CODES, parseClientMessage, parseRoomCode, type Auth, type CloseReason, type ServerMessage } from '../net/protocol'
import type { CoopDeps, SocketHandlers, SocketLike } from './client'

/**
 * A co-op relay inside the tab: the relay's own room (`relay/src/room.ts`, the
 * pure state machine both real shells run) behind a fake socket and `fetch`,
 * so a run against AI teams plays through the very same client, runner and
 * lockstep as a real room, with no network. Its shell does what the Node
 * relay's does (`relay/node/src/rooms.ts`): effects applied in order (storage
 * in memory, through the shared `store.ts`), the frame timer at the next
 * tick's due time while a run's clock runs, the alarm at `deadline`. Messages
 * go out as the real relays write them (JSON text, a sync's chunks and frames
 * from `syncTexts`), always asynchronously and in order.
 *
 * Wire a client to it with `url: LOCAL_RELAY_URL` and its `socket`/`fetch`.
 */

export const LOCAL_RELAY_URL = 'local://relay'

/** Room codes tried before giving up (a clash is all but impossible in one tab). */
const CREATE_TRIES = 8

/** The standard "service restart" close: a client reconnects at once and resumes (`relay/node/src/rooms.ts`). */
const RESTART_CLOSE = 1012

/** Timers, injected for tests (the globals by default). */
export type RelayTimers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void }

export type LocalRelayOptions = {
  now: () => number
  /** Uniform in [0, 1): room codes, seat secrets and run seeds. */
  random: () => number
  timers?: RelayTimers
  /** The room's events (`room.created`, `run.desync`…), for the console; dropped by default. */
  log?: (ev: string, data: Record<string, unknown>) => void
}

export type LocalRelay = {
  socket: CoopDeps['socket']
  fetch: CoopDeps['fetch']
  /** Stops every timer and closes every socket as the room expiring (`expired`); the relay takes nothing more. */
  dispose: () => void
}

type FakeSocket = { id: ConnId; on: SocketHandlers; open: boolean }

type Shell = {
  code: string
  state: State
  store: Store
  /** The room as last saved (`save`): what a step that throws starts over from, as a real relay reloads its own. */
  saved: string | null
  sockets: Map<ConnId, FakeSocket>
  timer: unknown
  alarm: unknown
  alarmAt: number | null
}

const SECRET_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

/** A room's storage in memory, the keys sorted as the real ones list them. */
const memoryStore = (saveRoom: (json: string) => void): Store => {
  const data = new Map<string, Stored>()
  return {
    saveRoom,
    lazy: {
      put: (key, value) => void data.set(key, value),
      delete: (keys) => keys.forEach((k) => data.delete(k)),
      list: (prefix, opts = {}) => {
        const start = opts.start ?? ''
        const keys = [...data.keys()].filter((k) => k.startsWith(prefix) && k >= start).sort()
        if (opts.reverse) keys.reverse()
        return keys.slice(0, opts.limit ?? keys.length).flatMap((k) => {
          const v = data.get(k)
          return v === undefined ? [] : [[k, v] as [string, Stored]]
        })
      },
    },
  }
}

/** A Clerk session token's `sub`, unverified: in the player's own tab there is nobody to keep out, only a stable seat to give back. */
const subOf = (token: string): string | null => {
  try {
    const part = token.split('.')[1] ?? ''
    const payload: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload === 'object' && payload !== null && 'sub' in payload && typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

const identify = (auth: Auth): Identity | null => {
  if (auth.kind === 'guest') return { id: `g:${auth.id}`, account: false }
  const sub = subOf(auth.token)
  return sub ? { id: `u:${sub}`, account: true } : null
}

const reply = (body: unknown) => Promise.resolve({ json: () => Promise.resolve(body) })

/** The in-page relay (`LocalRelay`): rooms made by its `fetch`, joined through its `socket`. */
export const createLocalRelay = (opts: LocalRelayOptions): LocalRelay => {
  const { now, random, log } = opts
  const timers: RelayTimers = opts.timers ?? { set: (fn, ms) => setTimeout(fn, ms), clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>) }
  const rooms = new Map<string, Shell>()
  let nextConn = 1
  let disposed = false

  const bytes = (n: number) => Uint8Array.from({ length: n }, () => Math.floor(random() * 256))
  const gen: Gen = {
    secret: () => Array.from({ length: 24 }, () => SECRET_ALPHABET[Math.floor(random() * SECRET_ALPHABET.length)]).join(''),
    seed: () => Math.floor(random() * 2 ** 32) >>> 0,
  }

  /* ---------- Delivery: one ordered queue, flushed on a later task (never inside a client's call) ---------- */

  const queue: (() => void)[] = []
  let flushing: unknown = null
  const later = (fn: () => void) => {
    queue.push(fn)
    flushing ??= timers.set(() => {
      flushing = null
      // A handler that throws loses nothing else, as each real socket event stands alone.
      for (const fn of queue.splice(0)) {
        try {
          fn()
        } catch (err) {
          console.error('[localRelay] socket handler failed', err)
        }
      }
    }, 0)
  }

  const deliver = (ws: FakeSocket, text: string) => later(() => ws.open && ws.on.message(text))

  /** Closes a socket from the relay's side: what was sent before arrives first, then the close. */
  const shut = (shell: Shell | null, ws: FakeSocket, code: number) => {
    shell?.sockets.delete(ws.id)
    later(() => {
      if (!ws.open) return
      ws.open = false
      ws.on.close(code)
    })
  }

  /* ---------- A room's shell ---------- */

  const clearTimers = (shell: Shell) => {
    if (shell.timer !== null) timers.clear(shell.timer)
    if (shell.alarm !== null) timers.clear(shell.alarm)
    shell.timer = null
    shell.alarm = null
    shell.alarmAt = null
  }

  /** Applies a step's effects as the real shells do: storage first, then messages and closes in order, then the timers. */
  const apply = (shell: Shell, effects: readonly Effect[]) => {
    persist(shell.store, effects, shell.state.room)
    const texts = new Map<ServerMessage, string>()
    let wiped = false
    for (const e of effects) {
      if (e.k === 'send') {
        const ws = shell.sockets.get(e.to)
        // A welcome says where the room runs (`WelcomeNet`), as the real shells' do: here, in the tab.
        const text = e.msg.t === 'welcome' ? JSON.stringify({ ...e.msg, net: { colo: 'local', region: shell.state.room?.region ?? null, edge: null, edgeRtt: null } }) : (texts.get(e.msg) ?? JSON.stringify(e.msg))
        texts.set(e.msg, text)
        if (ws) deliver(ws, text)
      } else if (e.k === 'sync') {
        const ws = shell.sockets.get(e.to)
        if (ws) for (const text of syncTexts(shell.store, e)) deliver(ws, text)
      } else if (e.k === 'close') {
        const ws = shell.sockets.get(e.to)
        if (ws) closeConn(shell, ws, e.reason)
      } else if (e.k === 'event') log?.(e.ev, e.data)
      else if (e.k === 'dump') log?.('dump', { reason: e.reason, run: e.run, tick: e.tick, minority: e.minority })
      else if (e.k === 'wipe') wiped = true
      // No API in the tab: nobody else's look is vouched (each client previews its own).
      else if (e.k === 'looks') later(() => rooms.get(shell.code) === shell && step(shell, () => looked(shell.state, e.ask, {}, now())))
    }
    if (wiped) return wipe(shell)
    schedule(shell)
  }

  /** A close the room asked for: the client hears it after what was sent before, and the room its socket's end, as a real socket's `close` event tells it. */
  const closeConn = (shell: Shell, ws: FakeSocket, reason: CloseReason) => {
    shut(shell, ws, CLOSE_CODES[reason])
    later(() => {
      if (rooms.get(shell.code) === shell) step(shell, () => disconnect(shell.state, ws.id, now()))
    })
  }

  /** Runs one of the room's steps; one that throws (a bug) starts the room over from its last save, its sockets told to reconnect. */
  const step = (shell: Shell, fn: () => readonly Effect[]) => {
    if (disposed) return
    try {
      apply(shell, fn())
    } catch (err) {
      console.error('[localRelay] room step failed', err)
      reload(shell)
    }
  }

  const reload = (shell: Shell) => {
    clearTimers(shell)
    for (const ws of [...shell.sockets.values()]) shut(shell, ws, RESTART_CLOSE)
    const room = shell.saved === null ? null : parseRoom(shell.saved)
    shell.state = loadState(room, gen, now(), room?.run ? readBound(shell.store, room.run.start.id) : 0)
    if (!room) return void rooms.delete(shell.code)
    try {
      apply(shell, reattach(shell.state, [], now()))
    } catch (err) {
      console.error('[localRelay] room reload failed', err)
      clearTimers(shell)
      rooms.delete(shell.code)
    }
  }

  /** The frame timer while a run's clock runs (at the next tick's due time); the alarm for everything else time does. */
  const schedule = (shell: Shell) => {
    const run = shell.state.room?.run
    if (running(shell.state) && run) {
      shell.timer ??= timers.set(() => {
        shell.timer = null
        step(shell, () => tick(shell.state, now()))
      }, Math.max(0, Math.ceil(nextTickAt(run) - now())))
    } else if (shell.timer !== null) {
      timers.clear(shell.timer)
      shell.timer = null
    }
    const at = deadline(shell.state)
    if (at === shell.alarmAt) return
    if (shell.alarm !== null) timers.clear(shell.alarm)
    shell.alarm = null
    shell.alarmAt = at
    if (at === null) return
    shell.alarm = timers.set(() => {
      shell.alarm = null
      shell.alarmAt = null
      step(shell, () => tick(shell.state, now()))
    }, Math.max(0, at - now()))
  }

  /** The room is over: its sockets told (`expired`), its timers and memory gone. */
  const wipe = (shell: Shell) => {
    clearTimers(shell)
    const bye = JSON.stringify({ t: 'bye', reason: 'expired' } satisfies ServerMessage)
    for (const ws of [...shell.sockets.values()]) {
      deliver(ws, bye)
      shut(shell, ws, CLOSE_CODES.expired)
    }
    rooms.delete(shell.code)
  }

  /* ---------- The relay's two doors ---------- */

  /** `POST <url>/rooms` `{ v, build, region }` → `{ code, region, claim }`, as the Worker answers; anything else an error the client reads as offline. */
  const fetch: CoopDeps['fetch'] = (url, init) => {
    if (disposed || init.method !== 'POST' || url.replace(/\/$/, '') !== `${LOCAL_RELAY_URL}/rooms`) return reply({ error: 'unavailable' })
    const body = parseCreate(init.body ?? '')
    if ('error' in body) return reply({ error: body.error })
    for (let i = 0; i < CREATE_TRIES; i++) {
      const code = randomCode('cf', bytes)
      if (rooms.has(code)) continue
      const shell: Shell = { code, state: loadState(null, gen, now()), store: memoryStore((json) => (shell.saved = json)), saved: null, sockets: new Map(), timer: null, alarm: null, alarmAt: null }
      const made = createRoom(shell.state, { code, build: body.build, region: 'local' }, now())
      if (!made.ok) continue
      rooms.set(code, shell)
      step(shell, () => made.effects)
      return reply({ code, region: 'auto', claim: made.claim })
    }
    return reply({ error: 'busy' })
  }

  /** A socket on `<url>/rooms/<code>/ws`: opens on a later task; a room that isn't here refuses it (`unavailable`), as a real relay does. */
  const socket: CoopDeps['socket'] = (url, on) => {
    const code = parseRoomCode(/\/rooms\/([^/]+)\/ws$/.exec(url)?.[1])
    const ws: FakeSocket = { id: `local-${nextConn++}`, on, open: false }
    later(() => {
      if (disposed) return on.close(CLOSE_CODES.expired)
      const shell = code === null ? undefined : rooms.get(code)
      ws.open = true
      if (shell) {
        shell.sockets.set(ws.id, ws)
        connect(shell.state, ws.id, 'local', now())
      }
      on.open()
      if (shell) return
      deliver(ws, JSON.stringify({ t: 'refused', code: 'unavailable' } satisfies ServerMessage))
      shut(null, ws, CLOSE_CODES.refused)
    })
    const shellOf = () => (code === null ? undefined : rooms.get(code))
    const like: SocketLike = {
      send: (text) => {
        const shell = shellOf()
        if (!ws.open || !shell?.sockets.has(ws.id)) return
        const msg = parseClientMessage(text)
        const conn = shell.state.live.conns.get(ws.id)
        if (msg?.t === 'hello' && conn && conn.seat === null) return step(shell, () => hello(shell.state, ws.id, msg, identify(msg.auth), now(), { guests: true }))
        step(shell, () => message(shell.state, ws.id, msg, now()))
      },
      close: () => {
        if (!ws.open) return
        const shell = shellOf()
        const known = shell?.sockets.delete(ws.id) === true
        ws.open = false
        if (shell && known) step(shell, () => disconnect(shell.state, ws.id, now()))
        // A WebSocket closed by its own side still hears its close.
        later(() => on.close(1000))
      },
      isOpen: () => ws.open,
      buffered: () => 0,
    }
    return like
  }

  const dispose = () => {
    if (disposed) return
    for (const shell of rooms.values()) wipe(shell)
    disposed = true
  }

  return { socket, fetch, dispose }
}
