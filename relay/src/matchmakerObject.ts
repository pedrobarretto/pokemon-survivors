import { DurableObject } from 'cloudflare:workers'
import { ARENA_RANKED } from '../../src/data/arenaRanked'
import type { ArenaTicketsRequest, ArenaTicketsResponse, QueueServerMessage } from '../../src/net/arena'
import { LIMITS, parseWireLook } from '../../src/net/protocol'
import type { Env } from './env'
import { fairPlayGate, formMatches, parseQueueMessage, parseTickets, type Match, type Ticket } from './matchmaker'
import { arenaApiOf, postSigned } from './report'
import { HINT_HEADER, identify, isRecord, log, shardStub } from './shell'
import { SHARD_INDEXES, SHARD_REGIONS, shardName, type Shard } from './shards'

/**
 * The Arena's matchmaker (`GET /arena/queue`): one Durable Object, its
 * tickets in memory (a restart drops the sockets, and the clients queue
 * again). A socket's first message is `queue` with its auth (checked like a
 * room's `hello`); every second the queue asks the API for the new tickets'
 * MMR (`POST /arena/tickets`, signed), makes the matches the rules allow
 * (`matchmaker.ts`), creates each one's locked room in a shard near most of
 * its players and tells them `matched`, then tells everyone still waiting
 * how their match is forming (`queued`). The API's answer carries each
 * account's Fair Play too: a Ranqueada under its minimum is refused and a low
 * score's ticket held (`fairPlayGate`). Cloudflare only in v1: the VPS
 * relays seat Arena rooms but have no queue.
 */

/** A socket's attachment: survives hibernation (an idle queue sleeps; a queued ticket keeps it awake). */
type Attachment = { id: string; hint: string | null }

/** How often the queue matches and tells its tickets. */
const TICK_MS = 1000

/** A socket that hasn't queued within this long is closed. */
const QUEUE_TIMEOUT_MS = 10_000

/** Messages a socket may send per `RATE.window` ms before it is closed. */
const RATE = { max: 40, window: 10_000 } as const

/**
 * The site's build (`SIM_BUILD_URL`) is trusted this long, or only `recheck`
 * long against a ticket on another build (a deploy may have just landed).
 */
const SITE_BUILD_MS = { trust: 60_000, recheck: 5_000 } as const

/** The close code after `matched` (normal: the client goes to its room) and after a refusal (`CLOSE_CODES.refused`). */
const CLOSE_MATCHED = 1000
const CLOSE_REFUSED = 4004

const isAttachment = (v: unknown): v is Attachment => isRecord(v) && typeof v.id === 'string' && (v.hint === null || typeof v.hint === 'string')

const regionOf = (hint: string | null) => SHARD_REGIONS.find((r) => r === hint) ?? 'auto'

/**
 * The matchmaker. A class only because the Durable Object runtime asks for
 * one: a thin shell doing the sockets, the API calls and the room creation
 * around the pure rules.
 */
export class Matchmaker extends DurableObject<Env> {
  private readonly sockets = new Map<string, WebSocket>()
  private readonly tickets = new Map<string, Ticket>()
  /** Tickets whose room is being made: out of the matching until it is (or fails, and they wait again). */
  private readonly placing = new Set<string>()
  private readonly authing = new Set<string>()
  private readonly rates = new Map<string, { since: number; n: number }>()
  /** The site's build as last read, and when: null while unknown (every build is taken). */
  private site: { build: string | null; at: number } = { build: null, at: 0 }
  private siteAsk: Promise<string | null> | null = null
  private timer: ReturnType<typeof setTimeout> | null = null
  private fetching = false

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    for (const ws of ctx.getWebSockets()) {
      const a: unknown = ws.deserializeAttachment()
      if (isAttachment(a)) this.sockets.set(a.id, ws)
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    const id = crypto.randomUUID()
    this.ctx.acceptWebSocket(server)
    server.serializeAttachment({ id, hint: request.headers.get(HINT_HEADER) || null } satisfies Attachment)
    this.sockets.set(id, server)
    setTimeout(() => {
      if (this.sockets.has(id) && !this.tickets.has(id) && !this.authing.has(id)) this.close(id, CLOSE_REFUSED, 'refused')
    }, QUEUE_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const a: unknown = ws.deserializeAttachment()
    if (!isAttachment(a)) return
    this.sockets.set(a.id, ws)
    if (!this.admit(a.id)) return this.close(a.id, 4008, 'abuse')
    const msg = typeof raw === 'string' && raw.length <= LIMITS.message ? parseQueueMessage(raw) : null
    if (!msg) return
    if (msg.t === 'cancel') return this.forget(a.id)
    if (msg.t === 'rtt') return
    if (this.tickets.has(a.id) || this.authing.has(a.id)) return
    if (this.env.ARENA_QUEUE === 'off') return this.refuse(a.id, 'closed')
    if (msg.auth.kind === 'guest' && this.env.ALLOW_GUESTS !== 'on') return this.refuse(a.id, 'auth')
    this.authing.add(a.id)
    const [identity, site] = await Promise.all([identify(this.env, msg.auth).catch(() => null), this.siteBuild(msg.build)])
    this.authing.delete(a.id)
    if (!this.sockets.has(a.id)) return
    if (!identity) return this.refuse(a.id, 'auth')
    if ([...this.tickets.values()].some((t) => t.user === identity.id)) return this.refuse(a.id, 'duplicate')
    if (site !== null && msg.build !== site) return this.refuse(a.id, 'build')
    const now = Date.now()
    // Guests (a dev relay) have no rating: they match at the start.
    const mmr = identity.account ? null : ARENA_RANKED.mmr.start
    const format = msg.format ?? 'standard'
    this.tickets.set(a.id, { conn: a.id, user: identity.id, kind: msg.kind, format, party: msg.party, size: msg.size ?? null, build: msg.build, since: now, mmr, holdUntil: 0, hint: a.hint })
    log({ ev: 'queue.joined', kind: msg.kind, format, party: msg.party !== null, account: identity.account, tickets: this.tickets.size })
    this.send(a.id, { t: 'queued', kind: msg.kind, waited: 0, found: 1, botsIn: ARENA_RANKED.queue.botsAfter[msg.kind] })
    this.schedule()
  }

  async webSocketClose(ws: WebSocket) {
    this.dropSocket(ws)
  }

  async webSocketError(ws: WebSocket) {
    this.dropSocket(ws)
  }

  private dropSocket(ws: WebSocket) {
    const a: unknown = ws.deserializeAttachment()
    if (!isAttachment(a)) return
    this.sockets.delete(a.id)
    this.rates.delete(a.id)
    this.forget(a.id)
  }

  /** A message's share of the socket's budget: false once it sent too many. */
  private admit(id: string) {
    const now = Date.now()
    const r = this.rates.get(id)
    if (!r || now - r.since >= RATE.window) {
      this.rates.set(id, { since: now, n: 1 })
      return true
    }
    r.n++
    return r.n <= RATE.max
  }

  private forget(id: string) {
    this.tickets.delete(id)
    this.placing.delete(id)
  }

  private send(id: string, msg: QueueServerMessage) {
    try {
      this.sockets.get(id)?.send(JSON.stringify(msg))
    } catch {
      // Closing; its close event cleans up.
    }
  }

  private close(id: string, code: number, reason: string) {
    const ws = this.sockets.get(id)
    this.sockets.delete(id)
    this.forget(id)
    try {
      ws?.close(code, reason)
    } catch {
      // Already closed.
    }
  }

  private refuse(id: string, why: Exclude<Extract<QueueServerMessage, { t: 'refused' }>['why'], 'fairPlay'> | { fairPlay: number }) {
    this.send(id, typeof why === 'string' ? { t: 'refused', why } : { t: 'refused', why: 'fairPlay', fairPlay: why.fairPlay })
    this.close(id, CLOSE_REFUSED, 'refused')
  }

  /** The second's timer, while anyone waits. */
  private schedule() {
    if (this.timer !== null || this.tickets.size === 0) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.step()
      this.schedule()
    }, TICK_MS)
  }

  /**
   * The build the site serves now (`/sim-build.json` at `SIM_BUILD_URL`):
   * read at most once a minute, or after 5 s when `against` isn't it. Null
   * without the var or before a first answer, and then every build is taken;
   * a failed read keeps the last answer. Only the site knows which build is
   * newest: the order builds reach the queue says nothing (a tab left open
   * since yesterday can be the first to queue after a restart).
   */
  private siteBuild(against?: string): Promise<string | null> {
    const url = this.env.SIM_BUILD_URL
    if (!url) return Promise.resolve(null)
    const age = Date.now() - this.site.at
    if (age < SITE_BUILD_MS.trust && (against === undefined || against === this.site.build || age < SITE_BUILD_MS.recheck)) return Promise.resolve(this.site.build)
    this.siteAsk ??= fetch(url, { cache: 'no-store' })
      .then(async (res) => {
        const raw: unknown = res.ok ? await res.json() : null
        return isRecord(raw) && typeof raw.build === 'string' && raw.build !== '' ? raw.build : null
      })
      .catch(() => null)
      .then((build) => {
        if (build === null) log({ ev: 'queue.siteBuildFailed' })
        this.site = { build: build ?? this.site.build, at: Date.now() }
        this.siteAsk = null
        return this.site.build
      })
    return this.siteAsk
  }

  /** One second of the queue: MMRs asked, old builds told, matches made, the rest told how theirs is forming. */
  private step() {
    const now = Date.now()
    this.lookUpMmr()
    if (now - this.site.at >= SITE_BUILD_MS.trust) void this.siteBuild()
    const site = this.site.build
    if (site !== null) for (const t of [...this.tickets.values()]) if (t.build !== site) this.refuse(t.conn, 'build')
    const open = [...this.tickets.values()].filter((t) => !this.placing.has(t.conn))
    const { matches, waiting } = formMatches(open, now)
    for (const m of matches) this.ctx.waitUntil(this.place(m))
    for (const w of waiting) this.send(w.conn, { t: 'queued', kind: w.kind, waited: w.waited, found: w.found, botsIn: w.botsIn, ...(w.hold > 0 && { hold: w.hold }) })
  }

  /**
   * Asks the API for the MMR and Fair Play of the accounts waiting without an
   * MMR (one request at a time), and applies Fair Play (`fairPlayGate`: a
   * Ranqueada refused, a ticket held). No answer: they match at the start,
   * their Fair Play unchecked (the API that would take it is down too).
   */
  private lookUpMmr() {
    const asking = [...this.tickets.values()].filter((t) => t.mmr === null)
    if (this.fetching || asking.length === 0) return
    const api = arenaApiOf(this.env.ARENA_API_URL, this.env.ARENA_REPORT_SECRET)
    const settle = (ratings: ArenaTicketsResponse['ratings']) => {
      const now = Date.now()
      for (const t of asking) {
        const live = this.tickets.get(t.conn)
        const r = ratings[t.user.slice(2)]
        if (!live || live.mmr !== null) continue
        live.mmr = r && Number.isFinite(r.mmr) ? r.mmr : ARENA_RANKED.mmr.start
        if (!r) continue
        const look = parseWireLook(r.look)
        if (look) live.look = look
        const gate = fairPlayGate(live.kind, r.fairPlay, now)
        if (!gate.ok) {
          log({ ev: 'queue.fairPlay', kind: live.kind, fairPlay: r.fairPlay, refused: true })
          this.refuse(live.conn, { fairPlay: r.fairPlay })
          continue
        }
        live.holdUntil = gate.holdUntil
        if (gate.holdUntil > 0) log({ ev: 'queue.fairPlay', kind: live.kind, fairPlay: r.fairPlay, refused: false })
      }
    }
    if (!api) return settle({})
    this.fetching = true
    const body = JSON.stringify({ userIds: asking.map((t) => t.user.slice(2)) } satisfies ArenaTicketsRequest)
    this.ctx.waitUntil(
      postSigned(api, '/arena/tickets', body)
        .then(async (res) => {
          if (!res.ok) log({ ev: 'queue.mmrFailed', status: res.status })
          settle(res.ok ? parseTickets(await res.json()) : {})
        })
        .catch((err: unknown) => {
          log({ ev: 'queue.mmrFailed', error: String(err) })
          settle({})
        })
        .finally(() => {
          this.fetching = false
        }),
    )
  }

  /** Makes a match's locked room (the region most of its players are nearest, its shards in order) and tells its players. */
  private async place(m: Match) {
    const conns = m.players.map((p) => p.conn)
    for (const c of conns) this.placing.add(c)
    const region = regionOf(m.hint)
    const lock = { queue: m.kind, ...(m.format !== 'standard' && { format: m.format }), ranked: m.ranked, players: m.players.map((p) => ({ id: p.user, team: p.team, ...(p.look && { look: p.look }) })) }
    let code: string | null = null
    for (let index = 0; index < SHARD_INDEXES && code === null; index++) {
      const shard: Shard = { region, index }
      const made = await shardStub(this.env, shard)
        .create({ shard, build: m.build, lock })
        .catch((err: unknown) => {
          log({ ev: 'shard.createFailed', shard: shardName(shard), error: String(err), arena: true })
          return null
        })
      code = made?.code ?? null
    }
    const here = conns.filter((c) => this.placing.has(c) && this.tickets.has(c))
    for (const c of conns) this.placing.delete(c)
    if (code === null) return log({ ev: 'queue.placeFailed', kind: m.kind, format: m.format, humans: m.players.length })
    const oldest = Math.min(...here.map((c) => this.tickets.get(c)?.since ?? Date.now()))
    log({ ev: 'queue.matched', code, kind: m.kind, format: m.format, ranked: m.ranked, humans: m.players.length, region, waited: Math.round((Date.now() - oldest) / 1000) })
    for (const p of m.players) {
      if (!here.includes(p.conn)) continue
      this.send(p.conn, { t: 'matched', room: code, team: p.team, ranked: m.ranked, humans: m.players.length })
      this.close(p.conn, CLOSE_MATCHED, 'matched')
    }
  }
}
