import { DurableObject } from 'cloudflare:workers'
import { CLOSE_CODES, LIMITS, parseClientMessage, parseRoomCode, type ServerMessage } from '../../src/net/protocol'
import type { Env } from './env'
import { gen, randomToken } from './codes'
import { gzip } from './gzip'
import {
  connect,
  createRoom,
  deadline,
  disconnect,
  hello,
  loadState,
  looked,
  message,
  nextTickAt,
  reattach,
  running,
  tick,
  type ArenaLock,
  type ConnId,
  type Effect,
  type Room,
  type State,
} from './room'
import { arenaApiOf, createOutbox, lookUpLooks, parseOutgoing, type ArenaApi, type Outbox } from './report'
import { DELETE_MAX, HELLO_TIMEOUT_MS, LAZY, WHERE_WAIT_MS, identify, isRecord, log, noSuchRoom, whereOnce } from './shell'
import { admits, capOf, createMeter, due, earliest, shardCode, shardName, shardOf, tally, weighs, type Shard } from './shards'
import { dumpJson, parseRoom, persist, readBound, syncTexts, type DumpRequest, type Store, type Stored } from './store'
import {
  EDGE_HEADER,
  addLateness,
  connClosed,
  connOpened,
  createLateness,
  createTelemetry,
  lateQuantile,
  noteEffects,
  noteInbound,
  noteLateness,
  noteSent,
  parseEdge,
  welcomeNet,
  type LabRun,
  type LogLine,
  type Telemetry,
  type Where,
} from './telemetry'

/**
 * Many co-op rooms in one Durable Object (a shard, `shards.ts`), as the VPS
 * relay holds its rooms (`relay/node/src/rooms.ts`). Each room is the same
 * pure state machine (`room.ts`) with its own keys, sockets (tagged with its
 * code), telemetry and 60 Hz frame timer; the shard's one alarm is the
 * earliest of its rooms' deadlines.
 *
 * Storage: a room is the key `room:<code>` (its JSON) and its log batches and
 * snapshot chunks are `r:<code>:<key>` (`store.ts`'s keys). A shard restart
 * loads every `room:` key back; a room that expires has all its keys deleted.
 *
 * The output gate is the whole object's: a write that takes it holds every
 * room's frames until it commits (19–33 ms p50, up to 1.1 s measured). So every
 * write here, the room saves included, goes with `allowUnconfirmed`, and the
 * alarm too. As on the VPS relay, a step's writes are all issued before
 * anything it sends, in one synchronous turn: the runtime commits them as one
 * atomic batch, batches in order, so what a crash keeps is every room as it
 * was after some step a commit's time ago. The window this opens: a crash
 * may lose a room's newest steps that clients already heard (as on the VPS
 * relay, where only losing the machine does): its seats, its run's start or end, its
 * agreed snapshot, as it could already lose its newest second of log. Each
 * is healed the way a lost log batch is: a seat lost rejoins, a start lost
 * leaves the room in its lobby, an agreed snapshot lost leaves the one
 * before it (its chunks deleted in the same batch, or not at all). The clock
 * bound still covers it: it only grows, rides on every save and log batch,
 * and is never within 2 s of a frame sent, so the newest step kept (a commit
 * under 2 s ago) is past every tick sent.
 */

/** A socket's attachment: survives WebSocket hibernation, so the shard finds each room's sockets again. */
type Attachment = { id: ConnId; ua: string; seat: number | null; code: string }

/** The key of a room's JSON (listed at boot); the rest of a room's keys are under `roomPrefix`. */
const ROOM_KEY = 'room:'
/** An Arena report waiting for the API (`report.ts`): outlives its room, retried by the shard's alarm. */
const OUT_KEY = 'out:'
const roomPrefix = (code: string) => `r:${code}:`

/** The standard "service restart" close: not one of ours (`CLOSE_CODES`), so clients reconnect at once and resume. */
const RESTART_CLOSE = 1012

/** Codes tried within the shard before it says no (2 883 a shard, a few dozen taken at most). */
const CODE_TRIES = 8

/** How often the shard logs `shard.stats` while a frame timer runs. */
const STATS_MS = 60_000

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n))

const isAttachment = (v: unknown): v is Attachment =>
  isRecord(v) && typeof v.id === 'string' && typeof v.ua === 'string' && typeof v.code === 'string' && (v.seat === null || typeof v.seat === 'number')

const attachmentOf = (ws: WebSocket): Attachment | null => {
  const a: unknown = ws.deserializeAttachment()
  return isAttachment(a) ? a : null
}

/** One room of the shard: its storage under its prefix, its sockets, timer and telemetry. */
type Shell = {
  code: string
  state: State
  store: Store
  sockets: Map<ConnId, WebSocket>
  attached: Map<ConnId, Attachment>
  authing: Set<ConnId>
  timer: ReturnType<typeof setTimeout> | null
  /** `deadline(state)` as of the room's last step: the shard's alarm is the earliest. */
  deadline: number | null
  tele: Telemetry
}

/** A room's storage inside the shard (`store.ts`): its keys under its prefix, all written lazily, the room as `room:<code>`. */
const storeOf = (storage: DurableObjectStorage, code: string): Store => {
  const p = roomPrefix(code)
  return {
    lazy: {
      put: (key, value) => void storage.put(p + key, value, LAZY),
      delete: (keys) => {
        for (let i = 0; i < keys.length; i += DELETE_MAX) void storage.delete(keys.slice(i, i + DELETE_MAX).map((k) => p + k), LAZY)
      },
      list: (prefix, { start, reverse, limit } = {}) =>
        [...storage.kv.list<Stored>({ prefix: p + prefix, ...(start === undefined ? {} : { start: p + start }), reverse, limit })].map(([k, v]): [string, Stored] => [k.slice(p.length), v]),
    },
    saveRoom: (json) => void storage.put(ROOM_KEY + code, json, LAZY),
  }
}

/**
 * A shard of co-op rooms. A class only because the Durable Object runtime asks
 * for one: a thin shell over the pure rooms (`room.ts`), doing each one's
 * storage, sockets and timers, and keeping one room's failure from the others.
 */
export class ShardObject extends DurableObject<Env> {
  /** The rooms this shard holds, by code. */
  readonly rooms = new Map<string, Shell>()
  private alarmAt: number | null = null
  /** The shard's name (`shardName`): from the create that made it, or from a room's code after a restart. */
  private name: string | null = null
  private where: Where | null = null
  private window = { since: Date.now(), lateness: createLateness() }
  private lastWindow: ReturnType<ShardObject['summary']> | null = null
  /** Inbound socket messages, all rooms together: a busy shard turns new rooms away (`INBOUND_BUDGET`). */
  private inbound = createMeter(Date.now())
  /** The rooms' Arena match reports on their way to the API. */
  private readonly outbox: Outbox
  /** The API the Arena's reports and look lookups go to, or null when unset. */
  private readonly api: ArenaApi | null

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const kept = [...ctx.storage.kv.list<unknown>({ prefix: OUT_KEY })].flatMap(([, v]) => parseOutgoing(v) ?? [])
    this.api = arenaApiOf(env.ARENA_API_URL, env.ARENA_REPORT_SECRET)
    this.outbox = createOutbox(
      {
        api: this.api,
        save: (o) => void ctx.storage.put(OUT_KEY + o.id, o, LAZY),
        remove: (id) => void ctx.storage.delete(OUT_KEY + id, LAZY),
        log: (ev, data) => this.log({ ev, ...data }),
        now: Date.now,
        changed: () => this.scheduleAlarm(),
      },
      kept,
    )
    void ctx.blockConcurrencyWhile(async () => {
      const now = Date.now()
      // Read whole first: one `kv.list` iterator at a time, and each room's load lists its log.
      for (const [key, json] of [...ctx.storage.kv.list<string>({ prefix: ROOM_KEY })]) {
        const code = key.slice(ROOM_KEY.length)
        const room = this.parse(json)
        if (!room) {
          this.forget(code)
          continue
        }
        this.rooms.set(code, this.shellFor(code, room, now))
        const s = shardOf(code)
        if (s) this.name ??= shardName(s)
      }
      let sockets = 0
      for (const ws of ctx.getWebSockets()) {
        const a = attachmentOf(ws)
        const shell = a ? this.rooms.get(a.code) : undefined
        if (!a || !shell) {
          try {
            ws.close(CLOSE_CODES.expired, 'expired')
          } catch {
            // Already closed.
          }
          continue
        }
        shell.sockets.set(a.id, ws)
        shell.attached.set(a.id, a)
        sockets++
      }
      this.alarmAt = await ctx.storage.getAlarm()
      for (const shell of this.rooms.values()) this.step(shell, () => reattach(shell.state, [...shell.attached.values()], now))
      this.scheduleAlarm()
      void whereOnce().then((w) => {
        this.where = w
        this.log({ ev: 'shard.boot', ...w, rooms: this.rooms.size, sockets })
        for (const shell of this.rooms.values()) {
          shell.tele.where = w
          const room = shell.state.room
          this.log({ ev: 'do.boot', code: shell.code, ...w, phase: room?.phase ?? null, run: room?.run?.start.id ?? null, tick: room?.run?.next ?? null, sockets: shell.sockets.size })
        }
      })
    })
  }

  /**
   * Makes a room in this shard (the Worker's `POST /rooms`): its code and its
   * host's claim, or null when the shard is full (`ROOMS_PER_SHARD`, or busier
   * than `INBOUND_BUDGET`: the Worker tries the next index) or no free code
   * turned up.
   */
  async create(init: { shard: Shard; build: string; lock?: Omit<ArenaLock, 'startBy'> }): Promise<{ code: string; claim: string } | null> {
    this.name ??= shardName(init.shard)
    const now = Date.now()
    tally(this.inbound, now)
    if (!admits([...this.rooms.values()].map((s) => s.state.room), capOf(this.env.ROOMS_PER_SHARD), this.inbound.rate)) return null
    for (let i = 0; i < CODE_TRIES; i++) {
      const code = shardCode(init.shard, randomBytes)
      if (this.rooms.has(code)) continue
      const shell = this.shellFor(code, null, now)
      const r = createRoom(shell.state, { code, build: init.build, region: init.shard.region, ...(init.lock && { lock: init.lock }) }, now)
      if (!r.ok) continue
      this.rooms.set(code, shell)
      this.step(shell, () => r.effects)
      return this.rooms.has(code) ? { code, claim: r.claim } : null
    }
    return null
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 })
    const code = parseRoomCode(/^\/rooms\/([^/]+)\/ws$/.exec(new URL(request.url).pathname)?.[1])
    const shell = code ? this.rooms.get(code) : undefined
    if (!code || !shell) return noSuchRoom()
    const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
    const id = crypto.randomUUID()
    const ua = (request.headers.get('User-Agent') ?? '').slice(0, 200)
    this.ctx.acceptWebSocket(server, [code])
    const attachment: Attachment = { id, ua, seat: null, code }
    server.serializeAttachment(attachment)
    shell.sockets.set(id, server)
    shell.attached.set(id, attachment)
    this.log(connOpened(shell.tele, id, parseEdge(request.headers.get(EDGE_HEADER)), Date.now(), code))
    connect(shell.state, id, ua, Date.now())
    setTimeout(() => {
      const s = this.rooms.get(code)
      const conn = s?.state.live.conns.get(id)
      if (!s || !conn || conn.seat !== null) return
      // A hello still authenticating is given up too: its late answer finds no socket (`hello` ignores it).
      this.closeSocket(s, id, 'refused')
      const ws = s.sockets.get(id)
      if (ws) this.dropSocket(ws, { closeCode: null, reason: 'helloTimeout' })
    }, HELLO_TIMEOUT_MS)
    return new Response(null, { status: 101, webSocket: client })
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    tally(this.inbound, Date.now(), 1)
    const a = attachmentOf(ws)
    const shell = a ? this.rooms.get(a.code) : undefined
    // A socket its room let go (a wipe or a restart closed it).
    if (!a || !shell || !shell.sockets.has(a.id)) return
    const text = typeof raw === 'string' ? raw : null
    // Far past any limit: no client of ours sends that.
    if (text !== null && text.length > LIMITS.chunkMessage * 2) return this.closeSocket(shell, a.id, 'abuse')
    const msg = text === null ? null : parseClientMessage(text)
    const conn = shell.state.live.conns.get(a.id)
    if (msg?.t === 'hello' && conn && conn.seat === null && !shell.authing.has(a.id)) {
      shell.authing.add(a.id)
      // The welcome says where this room runs: the trace asked at boot is nearly always back by now.
      const wait = new Promise((resolve) => setTimeout(resolve, WHERE_WAIT_MS))
      const [identity] = await Promise.all([identify(this.env, msg.auth).catch(() => null), Promise.race([whereOnce(), wait])])
      shell.authing.delete(a.id)
      // The room went, or started over, while the token was checked: nothing to seat.
      if (this.rooms.get(a.code) !== shell || !shell.sockets.has(a.id)) return
      return this.step(shell, () => hello(shell.state, a.id, msg, identity, Date.now(), { guests: this.env.ALLOW_GUESTS === 'on' }))
    }
    this.step(shell, () => {
      // The rate limit drops a message by starting its list of drops over (`admit` in `room.ts`).
      const drops = conn?.drops
      const effects = message(shell.state, a.id, msg, Date.now())
      noteInbound(shell.tele, conn?.seat ?? null, msg, text?.length ?? 0, !!conn && conn.drops !== drops)
      return effects
    })
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    this.dropSocket(ws, { closeCode: code, reason: reason.slice(0, 40) })
  }

  async webSocketError(ws: WebSocket) {
    this.dropSocket(ws, { closeCode: null, reason: 'error' })
  }

  /** The earliest room deadline came: every room whose own did is ticked, and the reports due are posted again. */
  async alarm() {
    this.alarmAt = null
    const now = Date.now()
    for (const shell of [...this.rooms.values()]) if (due(shell.deadline, now)) this.step(shell, () => tick(shell.state, now))
    if (due(this.outbox.next(), now)) this.ctx.waitUntil(this.outbox.flush())
    this.scheduleAlarm()
  }

  private log(line: LogLine) {
    log({ ...line, shard: this.name })
  }

  private parse(json: unknown): Room | null {
    try {
      return typeof json === 'string' ? parseRoom(json) : null
    } catch {
      return null
    }
  }

  private shellFor(code: string, room: Room | null, now: number): Shell {
    const store = storeOf(this.ctx.storage, code)
    const tele = createTelemetry()
    tele.where = this.where
    const state = loadState(room, gen, now, room?.run ? readBound(store, room.run.start.id) : 0)
    return { code, state, store, sockets: new Map(), attached: new Map(), authing: new Set(), timer: null, deadline: null, tele }
  }

  /**
   * Runs one of a room's steps. A step that throws (a bug) never takes the
   * shard's other rooms down: this room starts over from its storage, as a
   * restarted object would, and its players reconnect and resume.
   */
  private step(shell: Shell, fn: () => readonly Effect[]) {
    try {
      this.apply(shell, fn())
    } catch (err) {
      this.log({ ev: 'room.error', code: shell.code, error: err instanceof Error ? (err.stack ?? err.message) : String(err) })
      this.reload(shell)
    }
  }

  private reload(shell: Shell) {
    if (shell.timer !== null) clearTimeout(shell.timer)
    shell.timer = null
    const now = Date.now()
    for (const [id, ws] of shell.sockets) {
      const line = connClosed(shell.tele, id, now, shell.code, { closeCode: RESTART_CLOSE, reason: 'restart' })
      if (line) this.log(line)
      try {
        ws.close(RESTART_CLOSE, 'restart')
      } catch {
        // Already closed.
      }
    }
    shell.sockets.clear()
    shell.attached.clear()
    shell.authing.clear()
    const room = this.parse(this.ctx.storage.kv.get(ROOM_KEY + shell.code))
    if (!room) return this.remove(shell)
    shell.state = loadState(room, gen, now, room.run ? readBound(shell.store, room.run.start.id) : 0)
    try {
      this.apply(shell, reattach(shell.state, [], now))
    } catch (err) {
      // It fails again from its own storage: it stays there (the next boot tries it) but leaves memory.
      this.log({ ev: 'room.error', code: shell.code, error: String(err), fatal: true })
      if (shell.timer !== null) clearTimeout(shell.timer)
      shell.timer = null
      this.rooms.delete(shell.code)
      this.scheduleAlarm()
    }
  }

  private dropSocket(ws: WebSocket, how: { closeCode: number | null; reason: string }) {
    const a = attachmentOf(ws)
    const shell = a ? this.rooms.get(a.code) : undefined
    if (!a || !shell || !shell.sockets.has(a.id)) return
    const line = connClosed(shell.tele, a.id, Date.now(), shell.code, how)
    if (line) this.log(line)
    shell.sockets.delete(a.id)
    shell.attached.delete(a.id)
    this.step(shell, () => disconnect(shell.state, a.id, Date.now()))
  }

  private send(shell: Shell, id: ConnId, text: string) {
    noteSent(shell.tele, shell.state.live.conns.get(id)?.seat ?? null, text.length)
    try {
      shell.sockets.get(id)?.send(text)
    } catch {
      // The socket is closing; its close event cleans up.
    }
  }

  private closeSocket(shell: Shell, id: ConnId, reason: keyof typeof CLOSE_CODES) {
    const ws = shell.sockets.get(id)
    if (!ws) return
    const line = connClosed(shell.tele, id, Date.now(), shell.code, { closeCode: CLOSE_CODES[reason], reason })
    if (line) this.log(line)
    try {
      ws.close(CLOSE_CODES[reason], reason)
    } catch {
      // Already closed.
    }
  }

  /**
   * Applies a room's effects: every storage write first (`persist`, all of
   * them lazy here, the room's save included: the doc block above), then the
   * messages and closes in order, then its timers.
   */
  private apply(shell: Shell, effects: readonly Effect[]) {
    const room = shell.state.room
    persist(shell.store, effects, room)
    // Telemetry reads the batch with its writes done and before a wipe empties the storage.
    const noted = noteEffects(shell.tele, room, effects, Date.now())
    for (const line of noted.logs) this.log(line)
    if (noted.lab) this.keepRun(shell, noted.lab)
    const texts = new Map<ServerMessage, string>()
    let wiped = false
    for (const e of effects) {
      if (e.k === 'send') {
        // A welcome also says where things run (`WelcomeNet`): its own text.
        const text = e.msg.t === 'welcome' ? JSON.stringify({ ...e.msg, net: welcomeNet(shell.tele, e.to, room) }) : (texts.get(e.msg) ?? JSON.stringify(e.msg))
        texts.set(e.msg, text)
        this.send(shell, e.to, text)
      } else if (e.k === 'sync') for (const text of syncTexts(shell.store, e)) this.send(shell, e.to, text)
      else if (e.k === 'close') this.closeSocket(shell, e.to, e.reason)
      else if (e.k === 'event') this.log({ ev: e.ev, ...e.data })
      else if (e.k === 'dump') this.ctx.waitUntil(this.dump(shell, e, room).catch((err: unknown) => this.log({ ev: 'dump.failed', code: shell.code, error: String(err) })))
      else if (e.k === 'wipe') wiped = true
      else if (e.k === 'report') this.ctx.waitUntil(this.outbox.add(e.report))
      else if (e.k === 'looks') this.ctx.waitUntil(this.lookUp(shell, e))
    }
    if (wiped) return this.wipe(shell)
    for (const [id, a] of shell.attached) {
      const seat = shell.state.live.conns.get(id)?.seat ?? null
      if (a.seat === seat) continue
      const next = { ...a, seat }
      shell.attached.set(id, next)
      shell.sockets.get(id)?.serializeAttachment(next)
    }
    this.schedule(shell)
  }

  /** A friends' Arena start's looks, from the API (none when it fails), back to the room that asked, if it's still here. */
  private async lookUp(shell: Shell, e: Extract<Effect, { k: 'looks' }>) {
    const looks = await lookUpLooks(this.api, e.ids)
    this.log({ ev: 'arena.looks', code: shell.code, asked: e.ids.length, vouched: Object.keys(looks).length })
    if (this.rooms.get(shell.code) === shell) this.step(shell, () => looked(shell.state, e.ask, looks, Date.now()))
  }

  /** The room's frame timer while its run's clock runs; its deadline, for the shard's alarm. */
  private schedule(shell: Shell) {
    const run = shell.state.room?.run
    if (running(shell.state) && run) {
      if (shell.timer === null) {
        const at = nextTickAt(run)
        shell.timer = setTimeout(() => {
          shell.timer = null
          const now = Date.now()
          const late = now - Math.ceil(at)
          noteLateness(shell.tele, late)
          this.noteFrame(late, now)
          this.step(shell, () => tick(shell.state, now))
        }, Math.max(0, Math.ceil(at - Date.now())))
      }
    } else if (shell.timer !== null) {
      clearTimeout(shell.timer)
      shell.timer = null
    }
    const at = deadline(shell.state)
    if (at === shell.deadline) return
    shell.deadline = at
    this.scheduleAlarm()
  }

  /** The shard's one alarm, at the earliest of its rooms' deadlines and its reports' retries (lazy: it must not hold the frames either). */
  private scheduleAlarm() {
    const at = earliest([...[...this.rooms.values()].map((s) => s.deadline), this.outbox.next()])
    if (at === this.alarmAt) return
    this.alarmAt = at
    void (at === null ? this.ctx.storage.deleteAlarm(LAZY) : this.ctx.storage.setAlarm(at, LAZY))
  }

  /** The shard as it is now: its rooms, sockets and the frame timers' lateness since `since` (all rooms together). */
  private summary(now: number) {
    const shells = [...this.rooms.values()]
    const w = this.window
    return {
      colo: this.where?.colo ?? null,
      ms: now - w.since,
      rooms: shells.filter((x) => weighs(x.state.room)).length,
      running: shells.filter((x) => running(x.state)).length,
      sockets: shells.reduce((n, x) => n + x.sockets.size, 0),
      inboundPerSec: Math.round(this.inbound.rate),
      frames: w.lateness.lateN,
      lateP50: lateQuantile(w.lateness, 0.5),
      lateP99: lateQuantile(w.lateness, 0.99),
      lateMax: w.lateness.lateMax,
    }
  }

  /** Every frame timer's lateness, all rooms together: `shard.stats` once a minute while any run's clock runs. */
  private noteFrame(late: number, now: number) {
    addLateness(this.window.lateness, late)
    if (now - this.window.since < STATS_MS) return
    this.lastWindow = this.summary(now)
    this.log({ ev: 'shard.stats', ...this.lastWindow })
    this.window = { since: now, lateness: createLateness() }
  }

  /** What the shard holds now and its last minute's `shard.stats` (`GET /admin/shards/<name>`). */
  async stats() {
    const rooms = [...this.rooms.values()].map((s) => ({ code: s.code, phase: s.state.room?.phase ?? null, moved: s.state.room?.movedTo != null, running: running(s.state), sockets: s.sockets.size }))
    return { shard: this.name, rooms, now: this.summary(Date.now()), last: this.lastWindow }
  }

  /**
   * Records a dump (a desync, a bad snapshot, or a finished run kept for the
   * lab) in the vault: the log is read at once, before
   * anything awaits (a wipe right after deletes the room's keys).
   */
  private async dump(shell: Shell, e: DumpRequest, room: Room | null, lab: Pick<LabRun, 'score' | 'why' | 'seats'> | null = null) {
    if (!room?.run) return
    const at = Date.now()
    const json = dumpJson(shell.store, room, e, at, { shard: this.name, ...(lab ? { why: lab.why, score: lab.score, colo: shell.tele.where?.colo ?? null, net: lab.seats } : {}) })
    if (!json) return
    const vault = this.env.VAULT.getByName('dumps')
    if (lab && !(await vault.wantsRun(lab.score))) return
    const bytes = await gzip(json.body)
    // A kept run has one id (offered again as it goes on, the newer replaces it); a dump one per divergence.
    const id = e.reason === 'run' ? `${room.code}-${e.run}-run-${room.createdAt.toString(36)}` : `${room.code}-${e.run}-${e.tick}-${randomToken(3)}`
    await vault.put({ id, code: room.code, run: e.run, tick: e.tick, at, size: bytes.byteLength, kind: e.reason, score: lab?.score ?? 0 }, bytes)
    this.log({ ev: 'dump.saved', id, kind: e.reason, bytes: bytes.byteLength, logTicks: json.logTicks })
  }

  /** A run that ended (or was dropped with its room) offered to the lab: its input log, if the vault takes it. */
  private keepRun(shell: Shell, lab: LabRun) {
    const run = lab.room.run
    if (!run) return
    const req: DumpRequest = { reason: 'run', run: lab.run, tick: lab.tick, reports: {}, majority: run.ended?.h ?? '', minority: [] }
    this.ctx.waitUntil(this.dump(shell, req, lab.room, lab).catch((err: unknown) => this.log({ ev: 'dump.failed', kind: 'run', code: shell.code, error: String(err) })))
  }

  /** The room is over: its sockets, timer and keys go, and the shard's alarm moves on to the others. */
  private wipe(shell: Shell) {
    for (const id of [...shell.sockets.keys()]) {
      this.send(shell, id, JSON.stringify({ t: 'bye', reason: 'expired' } satisfies ServerMessage))
      this.closeSocket(shell, id, 'expired')
    }
    this.remove(shell)
  }

  private remove(shell: Shell) {
    if (shell.timer !== null) clearTimeout(shell.timer)
    shell.timer = null
    shell.deadline = null
    shell.state = loadState(null, gen, Date.now())
    this.forget(shell.code)
    if (this.rooms.get(shell.code) === shell) this.rooms.delete(shell.code)
    this.scheduleAlarm()
  }

  /** Deletes every key of room `code` (lazily, like everything here). */
  private forget(code: string) {
    const keys = [ROOM_KEY + code, ...[...this.ctx.storage.kv.list({ prefix: roomPrefix(code) })].map(([k]) => k)]
    for (let i = 0; i < keys.length; i += DELETE_MAX) void this.ctx.storage.delete(keys.slice(i, i + DELETE_MAX), LAZY)
  }
}
