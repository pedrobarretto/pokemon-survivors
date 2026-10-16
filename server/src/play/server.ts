import { randomBytes, randomInt } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer, type RawData, type WebSocket } from 'ws'
import { FRAME_TICKS, parseClientMessage, PROTOCOL, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type ClientMessage, type ServerMessage } from '../../../src/net/protocol'
import type { Verify } from '../auth'
import type { FriendStore, MutualFriend } from '../friends'
import { createPresence, invite, prunePresence, reloadFriends, signIn, signOut, userOf, type Profile } from './presence'
import { createRooms, disconnect, handleRoom, roomOf, tickRooms, type Conn, type ConnId, type Gen, type Out } from './rooms'

/** Abuse limits, per socket unless said otherwise. */
export const LIMITS = {
  /** Token bucket: a burst of 120 messages, refilled at 60 a second. Running dry closes the socket. */
  burst: 120,
  perSecond: 60,
  /** Bytes per message; bigger ones close the socket (`ws` does it). */
  maxPayload: 4 * 1024,
  /** Messages that don't parse before the socket is closed. */
  badMessages: 20,
  socketsPerIp: 20,
  /** Rooms one IP may create a minute. */
  createsPerMinute: 10,
  /** Ms to send `hello` after connecting. */
  helloTimeout: 10_000,
  /** Ms between WebSocket pings; a socket that missed the last pong is dropped. */
  heartbeat: 15_000,
  /** Ms between two friend reloads (each one hits the database). */
  friendsInterval: 2_000,
  /** Bytes queued to a socket that doesn't read before it's dropped (it rejoins with the backlog). */
  maxBuffered: 8 * 1024 * 1024,
} as const

export type PlayDeps = {
  port: number
  allowedOrigin: (origin: string) => boolean
  verify: Verify
  friends: Pick<FriendStore, 'profile' | 'mutual'>
  log?: (line: string) => void
}

type Socket = {
  id: ConnId
  ws: WebSocket
  ip: string
  openedAt: number
  /** Set once `hello` is answered. */
  conn: Conn | null
  greeting: boolean
  tokens: number
  refilledAt: number
  bad: number
  alive: boolean
  closed: boolean
  friendsAt: number
}

const gen: Gen = {
  code: () => Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_CODE_ALPHABET.charAt(randomInt(ROOM_CODE_ALPHABET.length))).join(''),
  secret: () => randomBytes(16).toString('hex'),
  seed: () => randomBytes(4).readUInt32LE(0),
}

/**
 * The client's IP. Behind Traefik, which sets `X-Real-Ip` and rewrites
 * `X-Forwarded-For` from untrusted clients; the socket's address otherwise (local dev).
 */
const clientIp = (req: IncomingMessage) => {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0]?.trim()
  return first(req.headers['x-real-ip']) || first(req.headers['x-forwarded-for']) || req.socket.remoteAddress || 'unknown'
}

const reject = (socket: Duplex, status: number, text: string) => {
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)
}

/**
 * The realtime co-op server: WebSockets on `/ws` (rooms, presence, invites)
 * and `GET /health`. One global interval drives every room's clock and the
 * timers (`tickRooms`), so rooms cost nothing between frames. Rooms live in
 * memory only: a restart ends the runs in progress.
 */
export const startPlayServer = ({ port, allowedOrigin, verify, friends, log = console.log }: PlayDeps) => {
  const rooms = createRooms(gen, log)
  const presence = createPresence()
  const sockets = new Map<ConnId, Socket>()
  const perIp = new Map<string, number>()
  const creates = new Map<string, number[]>()
  let nextId = 1
  let closing = false

  const send = (out: Out[]) => {
    // A broadcast is one message object for every member: stringify it once.
    const texts = new Map<ServerMessage, string>()
    for (const { to, msg } of out) {
      const s = sockets.get(to)
      if (!s || s.ws.readyState !== s.ws.OPEN) continue
      if (s.ws.bufferedAmount > LIMITS.maxBuffered) {
        s.ws.terminate()
        continue
      }
      const text = texts.get(msg) ?? JSON.stringify(msg)
      texts.set(msg, text)
      s.ws.send(text)
    }
  }

  const refuse = (s: Socket, code: Extract<ServerMessage, { t: 'refused' }>['code']) => send([{ to: s.id, msg: { t: 'refused', code } }])

  /** Token bucket: whether the socket may send one more message now. */
  const allow = (s: Socket, now: number) => {
    s.tokens = Math.min(LIMITS.burst, s.tokens + ((now - s.refilledAt) * LIMITS.perSecond) / 1000)
    s.refilledAt = now
    if (s.tokens < 1) return false
    s.tokens--
    return true
  }

  const allowCreate = (ip: string, now: number) => {
    const recent = (creates.get(ip) ?? []).filter((at) => now - at < 60_000)
    if (recent.length >= LIMITS.createsPerMinute) return false
    creates.set(ip, [...recent, now])
    return true
  }

  /** The handshake: checks the protocol, verifies the token and loads the player's profile and mutual friends. */
  const hello = async (s: Socket, msg: Extract<ClientMessage, { t: 'hello' }>) => {
    if (s.conn || s.greeting) return
    if (msg.protocol !== PROTOCOL) {
      refuse(s, 'version')
      s.ws.close(4000, 'version')
      return
    }
    s.greeting = true
    let userId: string | null = null
    let profile: Profile | null = null
    let mutual: MutualFriend[] = []
    try {
      userId = msg.token ? await verify(msg.token) : null
      if (userId) [profile, mutual] = await Promise.all([friends.profile(userId), friends.mutual(userId)])
    } catch (err) {
      log(`hello failed, playing as a guest: ${String(err)}`)
      userId = null
    }
    if (s.closed) return
    s.conn = { id: s.id, name: msg.name, handle: profile?.handle ?? null, build: msg.build }
    send(signIn(presence, s.id, userId, profile, mutual, msg.name))
  }

  const refreshFriends = async (s: Socket, now: number) => {
    const userId = userOf(presence, s.id)
    if (!userId || now - s.friendsAt < LIMITS.friendsInterval) return
    s.friendsAt = now
    try {
      const fresh = await friends.mutual(userId)
      if (!s.closed) send(reloadFriends(presence, s.id, fresh))
    } catch (err) {
      log(`friends reload failed: ${String(err)}`)
    }
  }

  const onMessage = (s: Socket, data: RawData, binary: boolean) => {
    const now = performance.now()
    if (!allow(s, now)) {
      s.ws.close(1008, 'rate')
      return
    }
    const msg = !binary && Buffer.isBuffer(data) ? parseClientMessage(data.toString('utf8')) : null
    if (!msg) {
      if (++s.bad > LIMITS.badMessages) s.ws.close(1008, 'invalid')
      return
    }
    if (msg.t === 'hello') return void hello(s, msg)
    // Anything before the handshake is answered is dropped: clients wait for `welcome`.
    if (!s.conn) return
    if (msg.t === 'create' && !allowCreate(s.ip, now)) return refuse(s, 'rate')
    switch (msg.t) {
      case 'ping':
        return send([{ to: s.id, msg: { t: 'pong', at: msg.at } }])
      case 'invite':
        return send(invite(presence, s.id, msg.handle, roomOf(rooms, s.id), now))
      case 'friends':
        return void refreshFriends(s, now)
      default:
        return send(handleRoom(rooms, s.conn, msg, now))
    }
  }

  const accept = (ws: WebSocket, ip: string) => {
    const now = performance.now()
    const s: Socket = { id: nextId++, ws, ip, openedAt: now, conn: null, greeting: false, tokens: LIMITS.burst, refilledAt: now, bad: 0, alive: true, closed: false, friendsAt: -Infinity }
    sockets.set(s.id, s)
    perIp.set(ip, (perIp.get(ip) ?? 0) + 1)
    ws.on('message', (data, binary) => onMessage(s, data, binary))
    ws.on('pong', () => {
      s.alive = true
    })
    ws.on('error', () => ws.terminate())
    ws.on('close', () => {
      s.closed = true
      sockets.delete(s.id)
      const left = (perIp.get(ip) ?? 1) - 1
      if (left > 0) perIp.set(ip, left)
      else perIp.delete(ip)
      send([...disconnect(rooms, s.id, performance.now()), ...signOut(presence, s.id)])
    })
  }

  const http = createServer((req, res) => {
    if (req.method === 'GET' && req.url?.split('?')[0] === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: true, rooms: rooms.byCode.size, sockets: sockets.size }))
      return
    }
    res.writeHead(404).end()
  })

  const wss = new WebSocketServer({ noServer: true, maxPayload: LIMITS.maxPayload })

  http.on('upgrade', (req, socket, head) => {
    socket.on('error', () => socket.destroy())
    if (closing) return reject(socket, 503, 'Service Unavailable')
    if (req.url?.split('?')[0] !== '/ws') return reject(socket, 404, 'Not Found')
    const origin = req.headers.origin
    if (!origin || !allowedOrigin(origin)) return reject(socket, 403, 'Forbidden')
    const ip = clientIp(req)
    if ((perIp.get(ip) ?? 0) >= LIMITS.socketsPerIp) return reject(socket, 429, 'Too Many Requests')
    wss.handleUpgrade(req, socket, head, (ws) => accept(ws, ip))
  })

  let lastSlow = 0
  let lastBeat = performance.now()
  let lastLog = performance.now()
  let logged = ''

  const slow = (now: number) => {
    prunePresence(presence, now)
    for (const [ip, times] of creates) if (times.every((at) => now - at >= 60_000)) creates.delete(ip)
    for (const s of sockets.values()) if (!s.conn && !s.greeting && now - s.openedAt > LIMITS.helloTimeout) s.ws.close(4001, 'hello')
    if (now - lastBeat >= LIMITS.heartbeat) {
      lastBeat = now
      for (const s of sockets.values()) {
        if (!s.alive) s.ws.terminate()
        else {
          s.alive = false
          s.ws.ping()
        }
      }
    }
    if (now - lastLog >= 60_000) {
      lastLog = now
      const { created, started, closed, desyncs } = rooms.stats
      const playing = [...rooms.byCode.values()].filter((r) => r.phase === 'playing').length
      const line = `play: ${rooms.byCode.size} rooms (${playing} playing), ${sockets.size} sockets; since boot ${created} created, ${started} runs, ${closed} closed, ${desyncs} desyncs`
      if (line !== logged) log(line)
      logged = line
    }
  }

  // One interval for everything, at the frame rate (30 Hz).
  const timer = setInterval(() => {
    const now = performance.now()
    send(tickRooms(rooms, now))
    if (now - lastSlow >= 1000) {
      lastSlow = now
      slow(now)
    }
  }, (1000 * FRAME_TICKS) / 60)

  http.listen(port, () => log(`play listening on :${port}`))

  /** Stops taking sockets, tells the connected ones to come back later and closes. */
  const close = () =>
    new Promise<void>((resolve) => {
      closing = true
      clearInterval(timer)
      for (const s of sockets.values()) s.ws.close(1012, 'restart')
      wss.close()
      http.close(() => resolve())
      http.closeAllConnections()
      // Sockets that don't finish their closing handshake are cut.
      setTimeout(() => {
        for (const s of sockets.values()) s.ws.terminate()
      }, 2000).unref()
    })

  return { close }
}
