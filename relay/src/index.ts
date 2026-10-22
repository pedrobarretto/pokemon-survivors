import { PROTOCOL, parseRoomCode, type CreateResponse, type Region } from '../../src/net/protocol'
import { parseCreate, randomCode } from './codes'
import type { Env } from './env'
import { allowedOrigin } from './origins'
import { EDGE_HEADER, edgeOf } from './telemetry'

export { RoomObject } from './roomObject'
export { Vault } from './vault'

/**
 * The relay's Worker: creates rooms, routes each room's sockets to its Durable
 * Object (`idFromName(code)`), and serves `/health` and the admin dumps.
 *
 * - `POST /rooms` `{ v, build, region? }` → `{ code, region, claim }`
 * - `GET /rooms/<code>/ws` → WebSocket (first message: `hello`)
 * - `GET /health`
 * - `GET /admin/dumps`, `GET /admin/dumps/<id>` (gzipped JSON), `Authorization: Bearer <ADMIN_TOKEN>`
 */

/** Room codes tried before giving up (a collision in 28.6 million codes is rare already). */
const CREATE_TRIES = 8

type Hint = Exclude<Region, 'auto'>

/**
 * The location hint nearest a request (its continent, and longitude in North
 * America). No Durable Object runs in South America (`sam` lands anywhere from
 * Miami to Chicago): from São Paulo the US east coast answers first (EWR
 * 116 ms, MIA 131 ms).
 */
export const hintFor = (cf: { continent?: string; longitude?: string } | undefined): Hint | null => {
  switch (cf?.continent) {
    case 'SA':
      return 'enam'
    case 'NA':
      return Number(cf.longitude) < -100 ? 'wnam' : 'enam'
    case 'EU':
      return 'weur'
    case 'AS':
      return 'apac'
    case 'OC':
      return 'oc'
    default:
      return null
  }
}

const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

const cors = (origin: string | null): Record<string, string> =>
  origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', Vary: 'Origin' } : {}

const ipOf = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown'

const createRoom = async (request: Request<unknown, IncomingRequestCfProperties>, env: Env, headers: Record<string, string>): Promise<Response> => {
  const reply = (body: CreateResponse, status = 200) => json(body, status, headers)
  if (!(await env.CREATE_LIMIT.limit({ key: ipOf(request) })).success) return reply({ error: 'rate' }, 429)
  const body = parseCreate(await request.text())
  if ('error' in body) return reply({ error: body.error }, body.status)
  const { build, region: asked } = body
  const hint = asked === 'auto' ? hintFor(request.cf) : asked
  const region: Region = hint ?? 'auto'
  for (let i = 0; i < CREATE_TRIES; i++) {
    // Cloudflare's codes start with a letter: a digit names a VPS relay (`RELAY_HOMES`).
    const code = randomCode('cf')
    const stub = env.ROOMS.get(env.ROOMS.idFromName(code), hint ? { locationHint: hint } : undefined)
    const claim = await stub.create({ code, build, region })
    if (claim !== null) return reply({ code, region, claim })
  }
  return reply({ error: 'busy' }, 503)
}

/** Constant-time check of the admin bearer token. */
const isAdmin = async (request: Request, env: Env) => {
  const token = env.ADMIN_TOKEN
  const given = request.headers.get('Authorization')?.replace(/^Bearer /, '') ?? ''
  if (!token || !given) return false
  const digest = async (s: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return crypto.subtle.timingSafeEqual(await digest(token), await digest(given))
}

const admin = async (request: Request, env: Env, path: string): Promise<Response> => {
  if (!(await isAdmin(request, env))) return new Response('Not found', { status: 404 })
  const vault = env.VAULT.getByName('dumps')
  if (path === '/admin/dumps') return json(await vault.list(100))
  const id = decodeURIComponent(path.slice('/admin/dumps/'.length))
  const bytes = /^[\w-]{1,80}$/.test(id) ? await vault.get(id) : null
  if (!bytes) return new Response('Not found', { status: 404 })
  return new Response(bytes, { headers: { 'Content-Type': 'application/gzip', 'Content-Disposition': `attachment; filename="${id}.json.gz"` } })
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const origin = request.headers.get('Origin')
    // Browsers always say where the page came from; other clients (bots, tests) send no Origin.
    if (origin !== null && !allowedOrigin(env, origin)) return new Response('Forbidden', { status: 403 })
    const headers = cors(origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers })
    // The Worker answering is the check: no Durable Object is touched, so a flood of these costs nothing past the edge.
    if (path === '/health' && request.method === 'GET') return json({ ok: true, protocol: PROTOCOL }, 200, headers)
    if (path === '/rooms' && request.method === 'POST') return createRoom(request, env, headers)
    const ws = path.match(/^\/rooms\/([^/]+)\/ws$/)
    if (ws && request.method === 'GET') {
      if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
      if (!(await env.CONNECT_LIMIT.limit({ key: ipOf(request) })).success) return new Response('Too many connections', { status: 429 })
      const code = parseRoomCode(ws[1])
      if (!code) return new Response('Bad room code', { status: 400 })
      // Where this socket meets Cloudflare, for the room's telemetry (set here, so a client can't say it).
      const headers = new Headers(request.headers)
      headers.set(EDGE_HEADER, JSON.stringify(edgeOf(request.cf)))
      return env.ROOMS.getByName(code).fetch(new Request(request, { headers }))
    }
    if (path.startsWith('/admin/dumps') && request.method === 'GET') return admin(request, env, path)
    return new Response('Not found', { status: 404, headers })
  },
} satisfies ExportedHandler<Env>
