import { DurableObject } from 'cloudflare:workers'
import { CLOSE_CODES, LIMITS, parseClientMessage, type Auth, type ServerMessage } from '../../src/net/protocol'
import { jwksKeys, verifyClerkToken } from './auth'
import type { Env } from './env'
import { gen, randomToken } from './codes'
import { gzip } from './gzip'
import { allowedOrigin } from './origins'
import {
  EDGE_HEADER,
  connClosed,
  connOpened,
  createTelemetry,
  noteEffects,
  noteInbound,
  noteLateness,
  noteSent,
  parseEdge,
  parseTrace,
  welcomeNet,
  type LabRun,
  type LogLine,
  type Where,
} from './telemetry'
import {
  connect,
  createRoom,
  deadline,
  disconnect,
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
} from './room'
import { createSchema, dumpJson, persist, readBound, readRoom, syncTexts, type DumpRequest, type Store, type Stored } from './store'

/** A socket's attachment: survives WebSocket hibernation, so the room finds its sockets again. */
type Attachment = { id: ConnId; ua: string; seat: number | null }

/** A socket not seated within this long is closed: no valid `hello`, or one whose auth is still being checked. */
const HELLO_TIMEOUT_MS = 10_000

/** Lazy writes (`store.ts`): never held by the output gate. */
const LAZY = { allowUnconfirmed: true } as const

/** Keys a delete takes at most. */
const DELETE_MAX = 128

/**
 * The Durable Object's storage as the shared storage code sees it
 * (`store.ts`): the room a row of the SQL table `kv` (`sql.exec` always takes
 * the output gate), the log batches and snapshot chunks KV keys written with
 * `allowUnconfirmed`, so no frame or pong ever waits on a commit. Both live in
 * the same SQLite database: writes land in order, and a room save commits
 * every lazy write before it.
 */
const storeOf = (storage: DurableObjectStorage): Store => ({
  sql: {
    run: (query, ...args) => void storage.sql.exec(query, ...args),
    all: (query, ...args) => storage.sql.exec(query, ...args).toArray(),
  },
  lazy: {
    put: (key, value) => void storage.put(key, value, LAZY),
    delete: (keys) => {
      for (let i = 0; i < keys.length; i += DELETE_MAX) void storage.delete(keys.slice(i, i + DELETE_MAX), LAZY)
    },
    list: (prefix, opts = {}) => [...storage.kv.list<Stored>({ prefix, ...opts })],
  },
})

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const isAttachment = (v: unknown): v is Attachment =>
  isRecord(v) && typeof v.id === 'string' && typeof v.ua === 'string' && (v.seat === null || typeof v.seat === 'number')

/** One JWKS cache per isolate, shared by the rooms it runs. */
let jwks: ReturnType<typeof jwksKeys> | null = null

/** Where this isolate runs (Cloudflare's trace from inside it), asked once per isolate. */
let where: Promise<Where> | null = null
const whereOnce = () =>
  (where ??= fetch('https://www.cloudflare.com/cdn-cgi/trace')
    .then((res) => res.text())
    .then(parseTrace)
    .catch(() => ({ colo: null })))

/** Waits for `where` at most this long before a welcome goes out without it. */
const WHERE_WAIT_MS = 500

const log = (line: LogLine) => console.log(JSON.stringify(line))

/**
 * One co-op room. A class only because the Durable Object runtime asks for
 * one: it is a thin shell over the pure room (`room.ts`), doing the storage,
 * the sockets and the timers the room's effects ask for.
 */
export class RoomObject extends DurableObject<Env> {
  private state: State = loadState(null, gen, 0)
  private sockets = new Map<ConnId, WebSocket>()
  private attached = new Map<ConnId, Attachment>()
  private authing = new Set<ConnId>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private alarmAt: number | null = null
  private tele = createTelemetry()
  private readonly store: Store

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    this.store = storeOf(ctx.storage)
    void ctx.blockConcurrencyWhile(async () => {
      const now = Date.now()
      const room = readRoom(this.store.sql)
      this.state = loadState(room, gen, now, room?.run ? readBound(this.store, room.run.start.id) : 0)
      const back = ctx.getWebSockets().flatMap((ws) => {
        const a: unknown = ws.deserializeAttachment()
        if (!isAttachment(a)) return []
        this.sockets.set(a.id, ws)
        this.attached.set(a.id, a)
        return [a]
      })
      this.alarmAt = await ctx.storage.getAlarm()
      this.apply(reattach(this.state, back, now))
      void whereOnce().then((w) => {
        this.tele.where = w
        const room = this.state.room
        log({ ev: 'do.boot', code: room?.code ?? null, ...w, phase: room?.phase ?? null, run: room?.run?.start.id ?? null, tick: room?.run?.next ?? null, sockets: back.length })
      })
    })
  }

  /** Reserves the room (the Worker's `POST /rooms`): its host's claim (`CreateResponse`), or null when the code is taken. */
  async create(init: { code: string; build: string; region: string }): Promise<string | null> {
    const r = createRoom(this.state, init, Date.now())
    if (r.ok) createSchema(this.store.sql)
    this.apply(r.effects)
    return r.ok ? r.claim : null
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    const id = crypto.randomUUID()
    const ua = (request.headers.get('User-Agent') ?? '').slice(0, 200)
    this.ctx.acceptWebSocket(server)
    const attachment: Attachment = { id, ua, seat: null }
    server.serializeAttachment(attachment)
    this.sockets.set(id, server)
    this.attached.set(id, attachment)
    log(connOpened(this.tele, id, parseEdge(request.headers.get(EDGE_HEADER)), Date.now(), this.state.room?.code ?? null))
    connect(this.state, id, ua, Date.now())
    setTimeout(() => {
      const conn = this.state.live.conns.get(id)
      if (!conn || conn.seat !== null) return
      // A hello still authenticating is given up too: its late answer finds no socket (`hello` ignores it).
      this.closeSocket(id, 'refused')
      const ws = this.sockets.get(id)
      if (ws) this.dropSocket(ws, { closeCode: null, reason: 'helloTimeout' })
    }, HELLO_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const a: unknown = ws.deserializeAttachment()
    if (!isAttachment(a)) return
    const text = typeof raw === 'string' ? raw : null
    // Far past any limit: no client of ours sends that.
    if (text !== null && text.length > LIMITS.chunkMessage * 2) return this.closeSocket(a.id, 'abuse')
    const msg = text === null ? null : parseClientMessage(text)
    const conn = this.state.live.conns.get(a.id)
    if (msg?.t === 'hello' && conn && conn.seat === null && !this.authing.has(a.id)) {
      this.authing.add(a.id)
      // The welcome says where this room runs: the trace asked at boot is nearly always back by now.
      const wait = new Promise((resolve) => setTimeout(resolve, WHERE_WAIT_MS))
      const [identity] = await Promise.all([this.identify(msg.auth).catch(() => null), Promise.race([whereOnce(), wait])])
      this.authing.delete(a.id)
      this.apply(hello(this.state, a.id, msg, identity, Date.now(), { guests: this.env.ALLOW_GUESTS === 'on' }))
      return
    }
    // The rate limit drops a message by starting its list of drops over (`admit` in `room.ts`).
    const drops = conn?.drops
    const effects = message(this.state, a.id, msg, Date.now())
    noteInbound(this.tele, conn?.seat ?? null, msg, text?.length ?? 0, !!conn && conn.drops !== drops)
    this.apply(effects)
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.dropSocket(ws, { closeCode: code, reason: reason.slice(0, 40) })
  }

  async webSocketError(ws: WebSocket) {
    this.dropSocket(ws, { closeCode: null, reason: 'error' })
  }

  async alarm() {
    this.alarmAt = null
    this.apply(tick(this.state, Date.now()))
  }

  private dropSocket(ws: WebSocket, how: { closeCode: number | null; reason: string }) {
    const a: unknown = ws.deserializeAttachment()
    if (!isAttachment(a)) return
    const line = connClosed(this.tele, a.id, Date.now(), this.state.room?.code ?? null, how)
    if (line) log(line)
    this.sockets.delete(a.id)
    this.attached.delete(a.id)
    this.apply(disconnect(this.state, a.id, Date.now()))
  }

  private async identify(auth: Auth): Promise<Identity | null> {
    if (auth.kind === 'guest') return { id: `g:${auth.id}`, account: false }
    jwks ??= jwksKeys(`${this.env.CLERK_ISSUER}/.well-known/jwks.json`)
    const sub = await verifyClerkToken(auth.token, {
      keys: jwks,
      issuer: this.env.CLERK_ISSUER,
      allowedParty: (origin) => allowedOrigin(this.env, origin),
      now: Date.now(),
    })
    return sub ? { id: `u:${sub}`, account: true } : null
  }

  private send(id: ConnId, text: string) {
    noteSent(this.tele, this.state.live.conns.get(id)?.seat ?? null, text.length)
    try {
      this.sockets.get(id)?.send(text)
    } catch {
      // The socket is closing; its close event cleans up.
    }
  }

  private closeSocket(id: ConnId, reason: keyof typeof CLOSE_CODES) {
    const ws = this.sockets.get(id)
    if (!ws) return
    const line = connClosed(this.tele, id, Date.now(), this.state.room?.code ?? null, { closeCode: CLOSE_CODES[reason], reason })
    if (line) log(line)
    try {
      ws.close(CLOSE_CODES[reason], reason)
    } catch {
      // Already closed.
    }
  }

  /**
   * Applies the room's effects: every storage write first (`persist`: lazy
   * ones as they come, then the room saved once), then the messages and
   * closes in order. Only a room save holds the messages (the output gate)
   * until it is durable, with every lazy write before it. Then sets the timers.
   */
  private apply(effects: readonly Effect[]) {
    const room = this.state.room
    persist(this.store, effects, room)
    // Telemetry reads the batch with its writes done and before a wipe empties the storage.
    const noted = noteEffects(this.tele, room, effects, Date.now())
    noted.logs.forEach(log)
    if (noted.lab) this.keepRun(noted.lab)
    const texts = new Map<ServerMessage, string>()
    let wiped = false
    for (const e of effects) {
      if (e.k === 'send') {
        // A welcome also says where things run (`WelcomeNet`): its own text.
        const text = e.msg.t === 'welcome' ? JSON.stringify({ ...e.msg, net: welcomeNet(this.tele, e.to, room) }) : (texts.get(e.msg) ?? JSON.stringify(e.msg))
        texts.set(e.msg, text)
        this.send(e.to, text)
      } else if (e.k === 'sync') for (const text of syncTexts(this.store, e)) this.send(e.to, text)
      else if (e.k === 'close') this.closeSocket(e.to, e.reason)
      else if (e.k === 'event') console.log(JSON.stringify({ ev: e.ev, ...e.data }))
      else if (e.k === 'dump') this.ctx.waitUntil(this.dump(e, this.state.room).catch((err: unknown) => log({ ev: 'dump.failed', error: String(err) })))
      else if (e.k === 'wipe') wiped = true
    }
    if (wiped) return this.wipe()
    for (const [id, a] of this.attached) {
      const seat = this.state.live.conns.get(id)?.seat ?? null
      if (a.seat === seat) continue
      const next = { ...a, seat }
      this.attached.set(id, next)
      this.sockets.get(id)?.serializeAttachment(next)
    }
    this.schedule()
  }

  /** The frame timer while a run's clock runs; the alarm for everything else time does. */
  private schedule() {
    const run = this.state.room?.run
    if (running(this.state) && run) {
      if (this.timer === null) {
        const due = nextTickAt(run)
        this.timer = setTimeout(() => {
          this.timer = null
          const now = Date.now()
          noteLateness(this.tele, now - Math.ceil(due))
          this.apply(tick(this.state, now))
        }, Math.max(0, Math.ceil(due - Date.now())))
      }
    } else if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    const at = deadline(this.state)
    if (at === this.alarmAt) return
    this.alarmAt = at
    void (at === null ? this.ctx.storage.deleteAlarm() : this.ctx.storage.setAlarm(at))
  }

  /**
   * Records a dump (a desync, a bad snapshot, or a finished run kept for the lab: room, run start, the
   * whole input log, hashes per seat, builds and user agents) in the vault. The log is read at once,
   * before anything awaits (a wipe right after empties the storage); a kept run (`lab`) also says how
   * the link went for each seat, and is packed only if the vault takes it.
   */
  private async dump(e: DumpRequest, room: Room | null, lab: Pick<LabRun, 'score' | 'why' | 'seats'> | null = null) {
    if (!room?.run) return
    const at = Date.now()
    const json = dumpJson(this.store, room, e, at, lab ? { why: lab.why, score: lab.score, colo: this.tele.where?.colo ?? null, net: lab.seats } : {})
    if (!json) return
    const vault = this.env.VAULT.getByName('dumps')
    if (lab && !(await vault.wantsRun(lab.score))) return
    const bytes = await gzip(json.body)
    // A kept run has one id (offered again as it goes on, the newer replaces it); a dump one per divergence.
    const id = e.reason === 'run' ? `${room.code}-${e.run}-run-${room.createdAt.toString(36)}` : `${room.code}-${e.run}-${e.tick}-${randomToken(3)}`
    await vault.put({ id, code: room.code, run: e.run, tick: e.tick, at, size: bytes.byteLength, kind: e.reason, score: lab?.score ?? 0 }, bytes)
    log({ ev: 'dump.saved', id, kind: e.reason, bytes: bytes.byteLength, logTicks: json.logTicks })
  }

  /** A run that ended (or was dropped with its room) offered to the lab: its input log, if the vault takes it. */
  private keepRun(lab: LabRun) {
    const run = lab.room.run
    if (!run) return
    const req: DumpRequest = { reason: 'run', run: lab.run, tick: lab.tick, reports: {}, majority: run.ended?.h ?? '', minority: [] }
    this.ctx.waitUntil(this.dump(req, lab.room, lab).catch((err: unknown) => log({ ev: 'dump.failed', kind: 'run', error: String(err) })))
  }

  /** The room is over: storage, alarm and sockets go. */
  private wipe() {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.alarmAt = null
    for (const id of [...this.sockets.keys()]) {
      this.send(id, JSON.stringify({ t: 'bye', reason: 'expired' } satisfies ServerMessage))
      this.closeSocket(id, 'expired')
    }
    this.state = loadState(null, gen, Date.now())
    // Atomic, and (compatibility date 2026-02-24 on) the alarm goes too.
    void this.ctx.storage.deleteAll()
  }
}
