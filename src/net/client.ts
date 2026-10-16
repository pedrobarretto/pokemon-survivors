import { accountState, API_URL, sessionToken } from '../account'
import { parseDisplayName } from '../game/ranking'
import { PROTOCOL, type ClientMessage, type ServerMessage } from './protocol'

/**
 * The realtime connection (co-op rooms, presence, invites) to the play server
 * (`server/src/play`). Opened on demand: by a signed-in player on boot (so
 * friends see them online), or when anyone opens co-op. Like the accounts,
 * nothing here blocks the game: offline it just keeps retrying in the
 * background, and solo play never touches it.
 */

/** `VITE_PLAY_URL`, else the API's host at `/ws` (production routes it to the play server). */
const PLAY_URL = import.meta.env.VITE_PLAY_URL ?? (API_URL ? `${API_URL.replace(/^http/, 'ws')}/ws` : undefined)

/** Without a play server the co-op entry doesn't show. */
export const coopEnabled = Boolean(PLAY_URL)

export type Connection = 'off' | 'connecting' | 'online'

const GUEST_KEY = 'ps:guest'
const NAME_KEY = 'ps:coopName'

const randomId = (length: number) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')
}

const stored = (key: string, make: () => string) => {
  try {
    const v = localStorage.getItem(key)
    if (v) return v
    const fresh = make()
    localStorage.setItem(key, fresh)
    return fresh
  } catch {
    return make()
  }
}

/** This device's guest id: lets a guest take their slot back after a drop. */
const guestId = () => stored(GUEST_KEY, () => randomId(16))

/** The name teammates see: the profile's when signed in, else the one picked in the lobby (or "Trainer 1234"). */
export const playerName = () => {
  const s = accountState()
  if (s.kind === 'signedIn' && s.name) return s.name
  return stored(NAME_KEY, () => `Trainer ${Math.floor(1000 + Math.random() * 9000)}`)
}

/** Sets the guest's name for the next connection. Returns the name kept, or null if it was invalid. */
export const setPlayerName = (raw: string) => {
  const name = parseDisplayName(raw)
  if (!name) return null
  try {
    localStorage.setItem(NAME_KEY, name)
  } catch {
    // Storage blocked: it lasts this session.
  }
  return name
}

let socket: WebSocket | null = null
let state: Connection = 'off'
/** Messages sent before the server's `welcome`: they go out right after it. */
let outbox: ClientMessage[] = []
let welcomed = false
let retry = 0
let retryTimer: ReturnType<typeof setTimeout> | null = null
let pingTimer: ReturnType<typeof setInterval> | null = null
/** Last measured round trip, ms. */
let rtt = 0
/** Kept wanted: reconnects after drops until `disconnect`. */
let wanted = false

const listeners = new Set<(m: ServerMessage) => void>()
const stateListeners = new Set<(c: Connection) => void>()

const setState = (next: Connection) => {
  state = next
  stateListeners.forEach((fn) => fn(next))
}

export const connection = () => state

/** Round trip to the play server, ms (0 before the first ping). */
export const roundTrip = () => rtt

/** Calls `fn` with every server message. Returns the unsubscribe. */
export const onServer = (fn: (m: ServerMessage) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Calls `fn` on every connection change. Returns the unsubscribe. */
export const onConnection = (fn: (c: Connection) => void) => {
  stateListeners.add(fn)
  return () => void stateListeners.delete(fn)
}

/** Sends now, or right after the handshake while it's still going. */
export const send = (m: ClientMessage) => {
  if (!coopEnabled) return
  if (socket && welcomed && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(m))
  else outbox.push(m)
}

const deliver = (m: ServerMessage) => {
  if (m.t === 'welcome') {
    welcomed = true
    retry = 0
    setState('online')
    const queued = outbox
    outbox = []
    for (const q of queued) socket?.send(JSON.stringify(q))
  }
  if (m.t === 'pong') rtt = Math.max(1, performance.now() - m.at)
  listeners.forEach((fn) => fn(m))
}

const open = async () => {
  if (!PLAY_URL || socket || !wanted) return
  setState('connecting')
  welcomed = false
  const ws = new WebSocket(PLAY_URL)
  socket = ws
  const token = await sessionToken()
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ t: 'hello', protocol: PROTOCOL, build: __GAME_VERSION__, name: playerName(), guest: guestId(), token } satisfies ClientMessage))
  })
  ws.addEventListener('message', (e) => {
    if (typeof e.data !== 'string') return
    // Our own server: the shapes are the protocol's.
    deliver(JSON.parse(e.data) as ServerMessage)
  })
  ws.addEventListener('close', () => {
    if (socket !== ws) return
    socket = null
    welcomed = false
    setState('off')
    if (!wanted) return
    // Back off up to 15 s; a hidden tab retries when it comes back.
    retry = Math.min(retry + 1, 6)
    retryTimer = setTimeout(() => void open(), Math.min(15_000, 500 * 2 ** retry))
  })
}

/** Opens the connection (and keeps it open, reconnecting after drops). Safe to call again. */
export const connect = () => {
  if (!coopEnabled) return
  wanted = true
  pingTimer ??= setInterval(() => welcomed && send({ t: 'ping', at: performance.now() }), 2000)
  void open()
}

/** Reconnects with fresh credentials (signed in or out, a new name). */
export const reconnect = () => {
  if (!wanted) return connect()
  socket?.close()
  socket = null
  if (retryTimer) clearTimeout(retryTimer)
  void open()
}

/** Closes the connection for good (until the next `connect`). */
export const disconnect = () => {
  wanted = false
  if (retryTimer) clearTimeout(retryTimer)
  if (pingTimer) clearInterval(pingTimer)
  pingTimer = null
  outbox = []
  socket?.close()
  socket = null
  setState('off')
}

// A tab coming back from the background retries at once instead of waiting out the backoff.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && wanted && !socket) {
    if (retryTimer) clearTimeout(retryTimer)
    void open()
  }
})
