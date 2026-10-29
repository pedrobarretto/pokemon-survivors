import { createHash, timingSafeEqual } from 'node:crypto'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Duplex } from 'node:stream'
import { WebSocketServer } from 'ws'
import { LIMITS as WIRE, PROTOCOL, parseRoomCode, type CreateResponse, type Region, type VpsHome } from '../../../src/net/protocol'
import { jwksKeys, verifyClerkToken } from '../../src/auth'
import { parseCreate } from '../../src/codes'
import { allowedOrigin } from '../../src/origins'
import { arenaApiOf, createOutbox, lookUpLooks, type Fetcher } from '../../src/report'
import { RETENTION } from '../../src/store'
import { fullWhy, type Load } from './capacity'
import type { Config } from './config'
import { lockDataDir, openVault } from './db'
import { LIMITS, clientIp, createLimiter } from './limits'
import { createRooms, type Log } from './rooms'

/**
 * A VPS relay's HTTP server, the Worker's routes (`index.ts`) on Node:
 *
 * - `POST /rooms` `{ v, build, region? }` → `{ code, region, claim }` (codes of this relay's home, `RELAY_HOMES`),
 *   or `{ error: 'full' }` (503) past its capacity (`capacity.ts`): the game then creates on Cloudflare
 * - `GET /rooms/<code>/ws` → WebSocket (first message: `hello`)
 * - `GET /health` → `{ ok, protocol, home, version, rooms, full }` (`rooms`: those its capacity counts; `full`: it takes no new one)
 * - `GET /admin/dumps`, `GET /admin/dumps/<id>` (gzipped JSON), `Authorization: Bearer <ADMIN_TOKEN>`
 */

/** The region each VPS relay answers `POST /rooms` with (the protocol's location names). */
const REGION_OF = { sa: 'sam' } as const satisfies Record<VpsHome, Region>

/** A `POST /rooms` body past this is refused unread. */
const MAX_BODY = 2048

const DAY_MS = 86_400_000

const isAdmin = (config: Config, header: string | undefined) => {
  const given = header?.replace(/^Bearer /, '') ?? ''
  if (!config.adminToken || !given) return false
  const digest = (s: string) => createHash('sha256').update(s).digest()
  return timingSafeEqual(digest(config.adminToken), digest(given))
}

const cors = (origin: string | undefined): Record<string, string> =>
  origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {}

const readBody = (req: IncomingMessage) =>
  new Promise<string | null>((resolve) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (c: Buffer) => {
      size += c.length
      if (size > MAX_BODY) {
        resolve(null)
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', () => resolve(null))
  })

/** Refuses an upgrade with a bare HTTP answer. */
const refuseUpgrade = (socket: Duplex, status: number, text: string) =>
  socket.end(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`)

/** One JSON line per event, as the Workers logs (Dokploy's Logs tab shows them). */
export const jsonLog: Log = (ev, data = {}) => process.stdout.write(`${JSON.stringify({ ev, ...data })}\n`)

/**
 * Starts the relay: takes the data dir (waiting for any other relay on it to stop), loads its rooms, then listens. `close` is the
 * graceful stop (a deploy). `fetcher`: the Arena reports' HTTP client (tests pass their own).
 */
export const startRelay = async (config: Config, log: Log = jsonLog, fetcher: Fetcher = fetch) => {
  const lock = await lockDataDir(config.dataDir, () => log('relay.waiting', { why: 'another relay holds the data dir' }))
  const vault = openVault(config.dataDir)
  vault.prune(Date.now(), RETENTION)
  // Arena match reports: posted at once, and retried from the vault on a timer (as a shard's alarm does) until the API takes them.
  let retry: NodeJS.Timeout | null = null
  // A post still out when the relay stops finds the vault closed: the report waits in it as last saved (tried again at the next boot).
  let open = true
  const api = arenaApiOf(config.arenaApiUrl ?? undefined, config.arenaReportSecret ?? undefined)
  const outbox = createOutbox(
    {
      api,
      save: (o) => void (open && vault.outbox.put(o)),
      remove: (id) => void (open && vault.outbox.delete(id)),
      log,
      now: Date.now,
      fetcher,
      changed: () => {
        if (retry) clearTimeout(retry)
        if (!open) return
        const at = outbox.next()
        retry = at === null ? null : setTimeout(() => void outbox.flush(), Math.max(0, at - Date.now()))
        retry?.unref()
      },
    },
    vault.outbox.list(),
  )
  if (outbox.size() > 0) void outbox.flush()
  const jwks = jwksKeys(`${config.clerkIssuer}/.well-known/jwks.json`)
  const origins = { ALLOWED_ORIGINS: config.allowedOrigins }
  const rooms = createRooms({
    home: config.home,
    dataDir: config.dataDir,
    vault,
    log,
    guests: config.allowGuests,
    now: Date.now,
    report: (r) => void outbox.add(r),
    looks: (ids) => lookUpLooks(api, ids, fetcher),
    identify: async (auth) => {
      if (auth.kind === 'guest') return { id: `g:${auth.id}`, account: false }
      const sub = await verifyClerkToken(auth.token, { keys: jwks, issuer: config.clerkIssuer, allowedParty: (o) => allowedOrigin(origins, o), now: Date.now() })
      return sub ? { id: `u:${sub}`, account: true } : null
    },
  })
  rooms.boot()
  // The last minute's load (`setLoad`, from `main.ts`'s stats): none known yet is no starvation.
  let load: Load = { loopP99Ms: null, hostBusyPct: null }
  const full = () => fullWhy(rooms.counts().live, config.maxRooms, load)

  const createLimit = createLimiter(LIMITS.create.limit, LIMITS.create.periodMs)
  const connectLimit = createLimiter(LIMITS.connect.limit, LIMITS.connect.periodMs)
  const ipOf = (req: IncomingMessage) => clientIp(req.headers, req.socket.remoteAddress, config.ipHeader)

  const json = (res: ServerResponse, body: unknown, status: number, headers: Record<string, string>) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers })
    res.end(JSON.stringify(body))
  }

  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const path = new URL(req.url ?? '/', 'http://relay').pathname
    const origin = req.headers.origin
    // Browsers always say where the page came from; other clients (bots, tests, the health check) send no Origin.
    if (origin !== undefined && !allowedOrigin(origins, origin)) return json(res, { error: 'origin' }, 403, {})
    const headers = cors(origin)
    if (req.method === 'OPTIONS') {
      res.writeHead(204, headers)
      return res.end()
    }
    if (path === '/health' && req.method === 'GET') return json(res, { ok: true, protocol: PROTOCOL, home: config.home, version: config.version, rooms: rooms.counts().live, full: full() !== null }, 200, headers)
    if (path === '/rooms' && req.method === 'POST') {
      const reply = (body: CreateResponse, status = 200) => json(res, body, status, headers)
      if (!createLimit.hit(ipOf(req), Date.now())) return reply({ error: 'rate' }, 429)
      const text = await readBody(req)
      const body = text === null ? ({ error: 'invalid', status: 400 } as const) : parseCreate(text)
      if ('error' in body) return reply({ error: body.error }, body.status)
      const why = full()
      if (why) {
        log('room.refused', { why, rooms: rooms.counts().live, maxRooms: config.maxRooms, ...load })
        return reply({ error: 'full' }, 503)
      }
      const made = rooms.create(body.build)
      return made ? reply({ ...made, region: REGION_OF[config.home] }) : reply({ error: 'busy' }, 503)
    }
    if (/^\/rooms\/[^/]+\/ws$/.test(path)) return json(res, { error: 'Expected a WebSocket' }, 426, headers)
    if (path.startsWith('/admin/dumps') && req.method === 'GET') {
      if (!isAdmin(config, req.headers.authorization)) return json(res, { error: 'Not found' }, 404, {})
      if (path === '/admin/dumps') return json(res, vault.list(100), 200, {})
      const id = decodeURIComponent(path.slice('/admin/dumps/'.length))
      const bytes = /^[\w-]{1,80}$/.test(id) ? vault.get(id) : null
      if (!bytes) return json(res, { error: 'Not found' }, 404, {})
      res.writeHead(200, { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${id}.json.gz"` })
      return res.end(bytes)
    }
    return json(res, { error: 'Not found' }, 404, headers)
  }

  const server = createServer((req, res) =>
    void handle(req, res).catch((err: unknown) => {
      log('http.error', { error: String(err) })
      if (!res.headersSent) json(res, { error: 'internal' }, 500, {})
    }),
  )
  // Longer than the proxy's keep-alive to us, so the proxy always closes an idle connection first.
  server.keepAliveTimeout = 65_000
  server.headersTimeout = 66_000

  // Far past any message of ours (a snapshot chunk is ~270 KB): bigger frames are cut by the library.
  const wss = new WebSocketServer({ noServer: true, maxPayload: WIRE.chunkMessage * 4, perMessageDeflate: false })
  let stopping = false
  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    const path = new URL(req.url ?? '/', 'http://relay').pathname
    const match = path.match(/^\/rooms\/([^/]+)\/ws$/)
    if (!match || req.method !== 'GET') return refuseUpgrade(socket, 404, 'Not Found')
    if (stopping) return refuseUpgrade(socket, 503, 'Service Unavailable')
    const origin = req.headers.origin
    if (origin !== undefined && !allowedOrigin(origins, origin)) return refuseUpgrade(socket, 403, 'Forbidden')
    if (!connectLimit.hit(ipOf(req), Date.now())) return refuseUpgrade(socket, 429, 'Too Many Requests')
    const code = parseRoomCode(match[1])
    if (!code) return refuseUpgrade(socket, 400, 'Bad Request')
    wss.handleUpgrade(req, socket, head, (ws) => rooms.accept(code, ws, (req.headers['user-agent'] ?? '').toString()))
  })

  const sweeps = setInterval(() => {
    createLimit.sweep(Date.now())
    connectLimit.sweep(Date.now())
  }, 60_000)
  const prunes = setInterval(() => vault.prune(Date.now(), RETENTION), DAY_MS)

  await new Promise<void>((resolve) => server.listen(config.port, config.host, resolve))
  const address = server.address()
  const port = typeof address === 'object' && address ? address.port : config.port
  log('relay.listening', { port, version: config.version, guests: config.allowGuests })

  /** The graceful stop: no new sockets, every open one closed as a restart, files closed. */
  const close = async () => {
    stopping = true
    clearInterval(sweeps)
    clearInterval(prunes)
    open = false
    if (retry) clearTimeout(retry)
    server.close()
    const counts = rooms.counts()
    await rooms.shutdown()
    wss.close()
    vault.close()
    lock.release()
    server.closeAllConnections()
    log('relay.stopped', counts)
  }

  /** The last minute's load, for the starvation guard (`main.ts` sets it with each `relay.stats`). */
  const setLoad = (next: Load) => {
    load = next
  }

  return { port, close, counts: rooms.counts, setLoad, full }
}

export type Relay = Awaited<ReturnType<typeof startRelay>>
