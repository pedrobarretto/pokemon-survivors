import { worldHeld } from '../game/coop'
import { moveCode } from '../game/replay'
import type { Game } from '../game/types'
import type { Vec } from '../engine/math'
import { LIMITS, NET_REPORT_MS, PROTOCOL, REGIONS, VPS_HOMES, homeOf, isRelayHome, parseRoomCode, type BatchedMessage, type ClientMessage, type CloseReason, type CreateResponse, type Loadout, type NetReport, type Refusal, type Region, type RelayHome, type RoomView, type Rtts, type Settings, type VpsHome, type RunStart, type ServerMessage } from '../net/protocol'
import { addSample, createNetStats, noteArrival, noteFrame, noteHidden, quantile, resetArrivalLine, NO_WHERE, type NetStats, type NetWhere, type ReconnectReason } from './netStats'
import type { Store } from './bank'
import type { Input } from './entries'
import { ack, createOutbox, due, onReconnect, onSlow, push, queued, slowed, type Outbox } from './outbox'
import { advance, backlog, onEnded, onFrame, onSnapPart, onSync, syncProgress, createRunner, type Runner, type RunnerDeps } from './runner'
import { createStickPace, paceStick, type StickPace } from './stickPace'
import { groupHome, measureRtt, median, pickHome, relayFor, type VpsUrls } from './relays'
import { closeReason, parseServerMessage } from './wire'
import { loadoutOf, settingsOf, type CoopPick, type CoopSettings } from './start'
import { timeoutSignal } from '../net/timeout'

/**
 * The co-op client: one room, its socket and the run's lockstep, as plain
 * state and functions (`createCoopClient` returns them bound to one client).
 * DOM-free: the browser passes its WebSocket, localStorage and Clerk token;
 * the soak bots pass Node's. Nothing here ever blocks solo play.
 *
 * - Identity: a signed-in player sends a fresh Clerk token on every
 *   (re)connect (co-op is for accounts: a production relay refuses guests
 *   with `signIn`); a guest, on the dev and local relays only (bots, the
 *   soak, dev builds), a persistent id. The seat secret the relay gives is
 *   kept by room code, so any tab opened from the link takes the same seat.
 * - Reconnects on its own with backoff and jitter, resuming from the last tick
 *   it knows (`resume.from`), keeping its state. It rides out TCP stalls:
 *   "stalled" after `CONNECT.stalled` ms without a message (the overlay),
 *   a fresh socket after `CONNECT.dead` without one or `CONNECT.uplink` without a pong.
 * - Final closes (`replaced`, `kicked`, `left`, `expired`, a refused build…)
 *   end the client with a typed reason and never reconnect.
 * - The room runs where it's best for the group: in the lobby every client
 *   reports its round trips to the relays (`rtt`), and the host's Start
 *   first moves the room to the relay with the best worst round trip when it
 *   clearly beats where it is (`groupHome`): the host makes a room there, the
 *   old one tells everyone `moved`, they follow with their Pokémon and ready,
 *   and the run starts once they're in (`MOVE`). Any failure starts it where it is.
 * - Few messages up (the relay's Durable Object is billed per message it
 *   receives): at most one a display frame, a `batch` of everything due
 *   (`frame`). Inputs go at once; the hash, the ping and the heartbeat wait to
 *   ride along with them (`CONNECT.lazy`, `CONNECT.heartbeat`), and the stick
 *   goes out only when it changed enough (`stickPace.ts`).
 */

export const CONNECT = {
  /** Backoff: the first retry after about `first` ms, doubling to `max`, ±`jitter` of it. */
  first: 250,
  max: 5000,
  jitter: 0.3,
  /** No message for this long in a run: show "reconnecting" (frames stalled). */
  stalled: 1000,
  /** No message for this long: the socket is dead, open another. */
  dead: 8000,
  /**
   * A ping unanswered this long while frames still come: the uplink stalled, open another. Under the relay's
   * 5 s `away`, past the 2.8–4.3 s single-socket stalls measured on home Wi-Fi (those ride out on the same socket).
   */
  uplink: 4500,
  /** The run's end (`over`) is said again this often (ms) until the relay confirms it: one sent on a dying socket is lost. */
  over: 2000,
  /** A ping rides along with what goes out once this long (ms) after the last one. */
  ping: 1000,
  /** Nothing sent for this long (ms): a message goes anyway, ping and all (the relay calls a seat silent for 5 s `away`). */
  heartbeat: 1500,
  /** A state hash waits at most this long (ms) for something to ride along with. */
  lazy: 1000,
  /** Walking, the stick in play is said again (an anchor for prediction) at least this often (ms). */
  anchor: 1000,
  /** The hello must be answered within this long, or the socket is dropped and retried. */
  hello: 8000,
  /** Far behind (ticks): a resume would replay too much, a fresh join takes the agreed snapshot instead. */
  jump: 1800,
} as const

/** Moving the room for the group (the host's Start), in ms. */
export const MOVE = {
  /** The new room must be made within this long, or the run starts where the room is. */
  create: 4000,
  /** The old room must say `moved` within this long of the host's `move`, or the run starts where it is. */
  echo: 3000,
  /** The host's Start waits this long at most for everyone to be in the new room and ready, then goes with whoever made it. */
  gather: 8000,
} as const

/** Round trips measured in the lobby: socket pings kept, how many make a report, how fast the first ones go, how often a report may go (ms) and the change worth saying (ms). */
const LOBBY = { pings: 9, enough: 3, probe: 500, every: 2000, change: 15 } as const

/**
 * The room moving for the group. `host`: this client's Start asked for it (it
 * then starts the run in the new room); `code`: the new room, null while it
 * is being made; `claim`: its host's claim; `expect`: the players online when
 * it moved; `at`: when the current step began (ms).
 */
export type Moving = { host: boolean; code: string | null; claim: string | null; expect: number; at: number }

/** What a player brings into the room the group moved to, said again once welcomed there. */
type Carry = { loadout: Loadout | null; ready: boolean; settings: Settings | null; claim: string | null }

/** Why a client stopped for good. `build`: the room runs another version of the game (update to play together); `signIn`: the relay takes accounts only. */
export type CloseWhy = CloseReason | Exclude<Refusal, 'unavailable'> | 'unavailable' | 'offline'

export type Status =
  | { kind: 'idle' }
  | { kind: 'connecting'; attempt: number }
  /** In the room, outside a run (the lobby, or after a run). */
  | { kind: 'room' }
  | { kind: 'playing' }
  | { kind: 'closed'; why: CloseWhy }

export type CreateResult = { ok: true; code: string; region: Region; home: RelayHome; claim: string | null } | { ok: false; why: Extract<CreateResponse, { error: string }>['error'] | 'offline' }

export type JoinResult = { ok: true; seat: number; room: RoomView } | { ok: false; why: CloseWhy }

export type Quality = 'good' | 'fair' | 'poor' | 'offline'

/** What the UI reads to draw the connection pip and the overlays. */
export type Connection = {
  quality: Quality
  /** Round trip (ms, smoothed), 0 before the first pong. */
  rtt: number
  /** Ticks held against jitter. */
  hold: number
  /** No message for a while: the reconnecting overlay shows. */
  stalled: boolean
  /** Far behind and catching up: 0..1, or null. */
  syncing: number | null
  reconnects: number
}

export type CoopEvent =
  | { kind: 'status'; status: Status }
  | { kind: 'room'; room: RoomView }
  /** A run began (tick 0 in `startsIn` ms), or this client joined one mid-way: `runner` holds its game. */
  | { kind: 'run'; runner: Runner; why: 'start' | 'join' | 'seed' | 'heal' }
  /** The runner's game object was replaced (a restore): re-link what the shell shares with it. */
  | { kind: 'game'; runner: Runner; why: 'join' | 'heal' | 'seed' }
  /** The relay is bringing this client to the run's present: from its own state (`resume`), the agreed snapshot (`base`) or the seed. */
  | { kind: 'sync'; reason: 'join' | 'resume' | 'heal'; from: number; to: number; base: number | null }
  /** A heal finished: the client is back in step with the team. */
  | { kind: 'healed'; tick: number; ms: number }
  | { kind: 'ended'; run: number; tick: number }
  | { kind: 'denied'; why: 'notHost' | 'notReady' }
  | { kind: 'slow' }
  /** The room is being moved for the group (`moving` in the state), or not any more. */
  | { kind: 'moving'; on: boolean }
  /** The room moved: the client is joining `to` (the shell's link follows). */
  | { kind: 'moved'; from: string; to: string }

/** What the client hears from its socket. */
export type SocketHandlers = { open: () => void; message: (data: unknown) => void; close: (code: number) => void }

/** A socket, as the client uses it (`webSocket` wraps the browser's and Node's `WebSocket`). */
export type SocketLike = { send: (data: string) => void; close: () => void; isOpen: () => boolean; buffered: () => number }

/** The standard `WebSocket` (browsers, Node 22+) as a `SocketLike`. */
export const webSocket = (url: string, on: SocketHandlers): SocketLike => {
  const ws = new WebSocket(url)
  ws.onopen = () => on.open()
  ws.onmessage = (e) => on.message(e.data)
  ws.onclose = (e) => on.close(e.code)
  ws.onerror = () => {}
  return {
    send: (d) => ws.send(d),
    close: () => {
      try {
        ws.close()
      } catch {
        // Closed already.
      }
    },
    isOpen: () => ws.readyState === WebSocket.OPEN,
    buffered: () => ws.bufferedAmount,
  }
}

export type CoopDeps = {
  /** Cloudflare's relay (`https://…`): every room but the VPS relays', and the fallback. */
  url: string
  /** The VPS relays this build has (`relays.ts`), by home: São Paulo's for South American hosts' rooms. */
  vps?: VpsUrls
  /** The simulation's build id (`__SIM_BUILD__`). */
  build: string
  socket: (url: string, on: SocketHandlers) => SocketLike
  fetch: (url: string, init: { method: string; body?: string; headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ json: () => Promise<unknown> }>
  store: Store
  /** A fresh Clerk session token when signed in (asked on every connect), else null (a guest: dev and local relays only). */
  token: () => Promise<string | null>
  name: () => string
  now: () => number
  random: () => number
}

/** Stick samples kept for prediction: far more than any round trip. */
export const HISTORY = 256

/** Special presses kept for prediction: a round trip never holds more than a few. */
const SPECIALS_KEPT = 8

export type ClientState = {
  status: Status
  code: string | null
  seat: number | null
  room: RoomView | null
  runner: Runner | null
  outbox: Outbox
  socket: SocketLike | null
  welcomed: boolean
  /** Opened by `join`, kept until `leave` or a final close. */
  wanted: boolean
  attempt: number
  reconnects: number
  retryAt: number | null
  lastMessageAt: number
  /** The oldest ping not answered yet (ms), or null. */
  pingAt: number | null
  lastPingAt: number
  lastSentAt: number
  rtt: number
  hidden: boolean
  /**
   * The stick: input samples taken (60 a second while the run plays) and the code in play at each (the last
   * one sent, which is what the simulation reads), how it is paced, and when a stick last went out (ms).
   */
  sample: number
  history: Uint8Array
  /** The samples the last special presses went out at (`SPECIALS_KEPT` of them, oldest first), for prediction to press them before the run does. */
  specials: number[]
  pace: StickPace
  anchoredAt: number
  /** Messages waiting to ride along with the next ones (the state hashes), and when each was queued (ms). */
  later: { msg: BatchedMessage; at: number }[]
  /** The relay takes `batch` messages (its `welcome` said so). */
  batch: boolean
  /** Next rejoin should skip the resume (fresh: the agreed snapshot). */
  fresh: boolean
  /** A `role` that came before the run's runner. */
  uploader: boolean
  /** When `over` last went out (ms). */
  overAt: number
  /** The build the room runs, from a `build` refusal (else null): older or newer than this client's. */
  roomBuild: string | null
  /** The run's link and pacing numbers (`netStats.ts`), for its `coop_net` event; started over with each run. */
  net: NetStats
  /** Where the relay runs and where this client meets Cloudflare (`welcome`). */
  where: NetWhere
  /** The relay takes `rtt` and `move` (its `welcome` said `moves`). */
  moves: boolean
  /** The VPS relays' round trips measured for this room (`vpsFor`: the room they were asked for). */
  vpsRtts: ReadonlyMap<VpsHome, number | null> | null
  vpsFor: string | null
  /** This socket's ping round trips in the lobby (ms, the newest `LOBBY.pings`): a Cloudflare room's own. */
  lobbyPings: number[]
  /** The round trips last reported to the room (`rtt`), and when (ms). */
  reported: Rtts | null
  reportedAt: number
  moving: Moving | null
  /** What to say again once welcomed in the room the group moved to. */
  carry: Carry | null
  /** This client reached its room by a move: it never moves it again. */
  movedIn: boolean
}

/** The team is held: a pick screen up, or the world waiting on away players. */
const teamPaused = (g: Game) => (g.phase !== 'playing' && g.phase !== 'paused' && g.phase !== 'gameover' && g.phase !== 'victory') || worldHeld(g)

export const createCoopClient = (deps: CoopDeps) => {
  const s: ClientState = {
    status: { kind: 'idle' },
    code: null,
    seat: null,
    room: null,
    runner: null,
    outbox: createOutbox(),
    socket: null,
    welcomed: false,
    wanted: false,
    attempt: 0,
    reconnects: 0,
    retryAt: null,
    lastMessageAt: 0,
    pingAt: null,
    lastPingAt: 0,
    lastSentAt: 0,
    rtt: 0,
    hidden: false,
    sample: 0,
    history: new Uint8Array(HISTORY),
    specials: [],
    pace: createStickPace(),
    anchoredAt: -Infinity,
    later: [],
    batch: false,
    fresh: false,
    uploader: false,
    overAt: -Infinity,
    roomBuild: null,
    net: createNetStats(),
    where: NO_WHERE,
    moves: false,
    vpsRtts: null,
    vpsFor: null,
    lobbyPings: [],
    reported: null,
    reportedAt: -Infinity,
    moving: null,
    carry: null,
    movedIn: false,
  }
  const listeners = new Set<(e: CoopEvent) => void>()
  const emit = (e: CoopEvent) => listeners.forEach((fn) => fn(e))
  let joining: ((r: JoinResult) => void) | null = null

  /** A new socket for `why`: the count the indicator shows (unless the caller counts it), and the run's tally by reason. */
  const noteReconnect = (why: ReconnectReason, counts = true) => {
    if (counts) s.reconnects++
    s.net.reconnects[why]++
  }

  const setStatus = (status: Status) => {
    s.status = status
    emit({ kind: 'status', status })
  }

  const base = (url: string) => url.replace(/\/$/, '')
  const vps: VpsUrls = deps.vps ?? {}
  const relayUrl = (home: RelayHome) => base((home === 'cf' ? undefined : vps[home]) ?? deps.url)
  const wsUrl = (code: string) => `${base(relayFor(code, deps.url, vps)).replace(/^http/, 'ws')}/rooms/${code}/ws`
  const secretKey = (code: string) => `ps:coopSeat:${code}`
  const GUEST_KEY = 'ps:coopGuest'

  const guestId = () => {
    const kept = deps.store.get(GUEST_KEY)
    if (kept && /^[A-Za-z0-9_-]{16,64}$/.test(kept)) return kept
    const id = Array.from({ length: 24 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(deps.random() * 36)]).join('')
    deps.store.set(GUEST_KEY, id)
    return id
  }

  const send = (msg: ClientMessage) => {
    const ws = s.socket
    if (!ws || !s.welcomed || !ws.isOpen()) return false
    try {
      // Snapshot chunks start with `t` (the relay picks its size limit from that prefix): JSON keeps key order.
      ws.send(JSON.stringify(msg))
      s.lastSentAt = deps.now()
      return true
    } catch {
      return false
    }
  }

  /** Sends what's due as one message (a `batch` when the relay takes them), or one by one. */
  const sendAll = (msgs: readonly BatchedMessage[]) => {
    if (!s.batch || msgs.length === 1) return msgs.forEach((m) => send(m))
    for (let i = 0; i < msgs.length; i += LIMITS.batch) {
      const m = msgs.slice(i, i + LIMITS.batch)
      send(m.length === 1 ? m[0]! : { t: 'batch', m })
    }
  }

  const runnerDeps: RunnerDeps = {
    // Hashes ride along with the next inputs (at most `CONNECT.lazy` late); snapshots and the end go at once.
    send: (msg) => {
      if (msg.t !== 'hash') return void send(msg)
      s.later.push({ msg, at: deps.now() })
      if (s.later.length > 8) s.later.shift()
    },
    now: deps.now,
    onGame: (runner, why) => emit({ kind: 'game', runner, why }),
    onHealed: (_, tick, ms) => emit({ kind: 'healed', tick, ms }),
    onFailed: () => {
      s.fresh = true
      noteReconnect('snapshot', false)
      reconnect()
    },
  }

  /** Ends the client for good: no reconnect, and no run (nothing simulates it any more). */
  const finish = (why: CloseWhy) => {
    s.wanted = false
    s.retryAt = null
    s.runner = null
    const ws = s.socket
    s.socket = null
    s.welcomed = false
    ws?.close()
    if (why === 'left' || why === 'kicked' || why === 'expired') deps.store.remove(secretKey(s.code ?? ''))
    s.moving = null
    s.carry = null
    joining?.({ ok: false, why })
    joining = null
    setStatus({ kind: 'closed', why })
  }

  /** The next retry, with backoff and jitter. */
  const scheduleRetry = () => {
    const base = Math.min(CONNECT.max, CONNECT.first * 2 ** Math.min(s.attempt, 8))
    const wait = base * (1 + (deps.random() * 2 - 1) * CONNECT.jitter)
    s.attempt++
    s.retryAt = deps.now() + wait
    setStatus({ kind: 'connecting', attempt: s.attempt })
  }

  /** Drops the socket (no final reason) and reconnects. */
  const reconnect = () => {
    const ws = s.socket
    s.socket = null
    s.welcomed = false
    s.pingAt = null
    ws?.close()
    if (s.wanted) scheduleRetry()
  }

  const resumeFrom = () => {
    const r = s.runner
    if (s.fresh || !r || r.pending) return null
    return { run: r.start.id, from: r.known }
  }

  const open = async () => {
    const code = s.code
    if (!code || !s.wanted || s.socket) return
    s.retryAt = null
    const token = await deps.token().catch(() => null)
    if (!s.wanted || s.socket) return
    // Every handler checks it still speaks for the current socket: an old one's late events are ignored.
    let ws: SocketLike | null = null
    const handlers: SocketHandlers = {
      open: () => {
        if (!ws || s.socket !== ws) return
        const hello: ClientMessage = {
          t: 'hello',
          v: PROTOCOL,
          build: deps.build,
          room: code,
          auth: token ? { kind: 'clerk', token } : { kind: 'guest', id: guestId() },
          secret: deps.store.get(secretKey(code)),
          name: deps.name(),
          resume: resumeFrom(),
          ...(s.carry?.claim ? { claim: s.carry.claim } : {}),
        }
        ws.send(JSON.stringify(hello))
      },
      message: (data) => {
        if (!ws || s.socket !== ws) return
        s.lastMessageAt = deps.now()
        const m = parseServerMessage(data)
        if (m) receive(m)
      },
      close: (closeCode) => {
        if (!ws || s.socket !== ws) return
        s.socket = null
        s.welcomed = false
        s.pingAt = null
        const why = closeReason(closeCode)
        // Refused before a welcome: the `refused` message already said why.
        if (why === 'refused') return finish(lastRefusal ?? 'unavailable')
        if (why) return finish(why)
        noteReconnect('drop')
        if (s.wanted) scheduleRetry()
      },
    }
    try {
      ws = deps.socket(wsUrl(code), handlers)
    } catch {
      return scheduleRetry()
    }
    s.socket = ws
    s.welcomed = false
    s.lastMessageAt = deps.now()
  }

  let lastRefusal: CloseWhy | null = null

  const runnerFor = (start: RunStart) => {
    const r = createRunner(start, s.code ?? '', s.seat ?? 0)
    r.uploader = s.uploader
    return r
  }

  /** The room says the run is over (it ended while this client's socket was down, so it missed `ended`). */
  const endedWhileAway = (room: RoomView) => {
    const r = s.runner
    if (!r || r.ended || room.phase === 'playing' || room.run !== r.start.id) return
    onEnded(r, r.over?.tick ?? r.next)
    emit({ kind: 'ended', run: r.start.id, tick: r.endedAt ?? r.next })
  }

  const receive = (m: ServerMessage) => {
    const now = deps.now()
    switch (m.t) {
      case 'welcome': {
        s.welcomed = true
        s.seat = m.seat
        // Every welcome says where again: a room the group moved to runs elsewhere, and an older relay says nothing.
        s.where = m.net ? { relayColo: m.net.colo, relayRegion: m.net.region, edgeColo: m.net.edge, edgeRtt: m.net.edgeRtt } : NO_WHERE
        s.room = m.room
        s.attempt = 0
        s.fresh = false
        if (s.code) deps.store.set(secretKey(s.code), m.secret)
        onReconnect(s.outbox)
        s.batch = m.batch === true
        s.moves = m.moves === true
        s.pace = createStickPace()
        s.later = []
        bringAlong(m.room, m.seat)
        joining?.({ ok: true, seat: m.seat, room: m.room })
        joining = null
        setStatus({ kind: m.room.phase === 'playing' ? 'playing' : 'room' })
        emit({ kind: 'room', room: m.room })
        endedWhileAway(m.room)
        return
      }
      case 'moved': {
        const to = parseRoomCode(m.code)
        if (!to || to === s.code) return
        const mv = s.moving
        const mine = mv?.host === true && mv.code === to
        const room = s.room?.code === s.code ? s.room : null
        const me = room?.members.find((x) => x.seat === s.seat)
        s.carry = { loadout: me?.loadout ?? null, ready: me?.ready ?? false, settings: me?.host && room ? room.settings : null, claim: mine ? mv.claim : null }
        if (mine) s.moving = { ...mv, at: now }
        else setMoving({ host: false, code: to, claim: null, expect: 0, at: now })
        return follow(to)
      }
      case 'refused':
        lastRefusal = m.code
        if (m.code === 'build' && typeof m.build === 'string') s.roomBuild = m.build
        return
      case 'room': {
        s.room = m.room
        endedWhileAway(m.room)
        const playing = m.room.phase === 'playing'
        if (s.status.kind === 'room' && playing) setStatus({ kind: 'playing' })
        if (s.status.kind === 'playing' && !playing) setStatus({ kind: 'room' })
        return emit({ kind: 'room', room: m.room })
      }
      case 'start': {
        s.uploader = false
        s.net = createNetStats(m.run.id, now, s.hidden)
        const r = runnerFor(m.run)
        s.runner = r
        setStatus({ kind: 'playing' })
        return emit({ kind: 'run', runner: r, why: 'start' })
      }
      case 'sync': {
        emit({ kind: 'sync', reason: m.reason, from: m.from, to: m.to, base: m.base?.tick ?? null })
        const before = s.runner
        // The relay may order the same heal again for hashes sent before the first reached us: one restore is enough.
        if (m.reason === 'heal' && before && before.healing && m.base && before.stats.syncs.at(-1)?.base === m.base.tick && before.start.id === m.run.id) return
        const next = onSync(before, m, s.code ?? '', s.seat ?? 0, runnerDeps)
        if (s.net.run !== m.run.id) s.net = createNetStats(m.run.id, now, s.hidden)
        else resetArrivalLine(s.net)
        if (next === 'rejoin') {
          s.fresh = true
          noteReconnect('rejoin', false)
          return reconnect()
        }
        next.uploader = before === next ? next.uploader : s.uploader
        s.runner = next
        if (next !== before) emit({ kind: 'run', runner: next, why: m.reason === 'heal' ? 'heal' : m.base ? 'join' : 'seed' })
        if (s.status.kind !== 'playing') setStatus({ kind: 'playing' })
        return
      }
      case 'snapPart':
        if (s.runner) onSnapPart(s.runner, m, runnerDeps)
        return
      case 'frame': {
        const r = s.runner
        if (!r) return
        const seat = s.seat ?? -1
        // Live, not a sync's tail: its arrival says how the link is doing.
        const live = m.from >= r.tailTo && !r.pending
        if (!onFrame(r, m, now, (e) => ack(s.outbox, seat, e))) {
          // A gap (never expected on one ordered socket): resync from what we have.
          noteReconnect('gap', false)
          return reconnect()
        }
        if (live) noteArrival(s.net, m.to - 1, now, m.ticks.length > 0)
        return
      }
      case 'heal':
        return
      case 'role':
        s.uploader = m.snapshots
        if (s.runner) s.runner.uploader = m.snapshots
        return
      case 'ended': {
        const r = s.runner
        if (r && r.start.id === m.run) onEnded(r, m.tick)
        return emit({ kind: 'ended', run: m.run, tick: m.tick })
      }
      case 'denied':
        return emit({ kind: 'denied', why: m.why })
      case 'slow':
        onSlow(s.outbox, now)
        return emit({ kind: 'slow' })
      case 'pong':
        if (s.pingAt !== null && m.at <= now) {
          const rtt = now - m.at
          s.rtt = s.rtt === 0 ? rtt : s.rtt * 0.8 + rtt * 0.2
          addSample(s.net.rtt, rtt)
          if (s.room?.phase === 'lobby') {
            s.lobbyPings.push(rtt)
            if (s.lobbyPings.length > LOBBY.pings) s.lobbyPings.shift()
          }
        }
        s.pingAt = null
        return
      case 'bye':
        return
    }
  }

  /** Forgets what this client measured and reported for its last room. */
  const forgetRoom = () => {
    s.vpsRtts = null
    s.vpsFor = null
    s.lobbyPings = []
    s.reported = null
    s.reportedAt = -Infinity
  }

  /** Joins room `code` (a link, a typed code): resolves once the relay seats this client or refuses it. */
  const join = (code: string): Promise<JoinResult> => {
    if (s.socket) leaveQuietly()
    s.code = code
    s.wanted = true
    s.attempt = 0
    s.runner = null
    s.room = null
    s.fresh = false
    s.roomBuild = null
    s.moving = null
    s.carry = null
    s.movedIn = false
    forgetRoom()
    lastRefusal = null
    setStatus({ kind: 'connecting', attempt: 0 })
    return new Promise((resolve) => {
      joining = resolve
      void open()
    })
  }

  /** How long measured round trips hold (ms): a lobby visit, not a whole session (the player may move networks). */
  const RTT_FRESH_MS = 5 * 60_000
  let measured: { at: number; rtts: Promise<Map<VpsHome, number | null>> } | null = null

  /**
   * The VPS relays' round trips, measured once in a while (`warm` starts it
   * as the co-op screen opens, so creating a room never waits on it). Null
   * for one that doesn't answer within 3 s; empty in a build without them.
   */
  const measureVps = () => {
    if (!measured || deps.now() - measured.at > RTT_FRESH_MS) {
      const get = (u: string) => deps.fetch(u, { method: 'GET', signal: timeoutSignal(3000) })
      const relays = Object.entries(vps).flatMap(([home, url]) => (isRelayHome(home) && home !== 'cf' && url ? [{ home, url: base(url) }] : []))
      measured = {
        at: deps.now(),
        rtts: Promise.all(relays.map(async (r) => [r.home, await measureRtt(r.url, get, deps.now)] as const)).then((pairs) => new Map(pairs)),
      }
    }
    return measured.rtts
  }

  const reserve = async (home: RelayHome, region: Region, timeout?: number): Promise<CreateResult> => {
    try {
      const signal = timeout === undefined ? undefined : timeoutSignal(timeout)
      const res = await deps.fetch(`${relayUrl(home)}/rooms`, { method: 'POST', body: JSON.stringify({ v: PROTOCOL, build: deps.build, region }), headers: { 'Content-Type': 'application/json' }, signal })
      const body: unknown = await res.json()
      if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string') {
        const region = REGIONS.find((r) => 'region' in body && r === body.region) ?? 'auto'
        const claim = 'claim' in body && typeof body.claim === 'string' ? body.claim : null
        return { ok: true, code: body.code, region, home, claim }
      }
      const error = typeof body === 'object' && body !== null && 'error' in body ? body.error : null
      return { ok: false, why: error === 'version' || error === 'rate' || error === 'busy' || error === 'invalid' ? error : 'offline' }
    } catch {
      return { ok: false, why: 'offline' }
    }
  }

  /**
   * Reserves a room near this player: on the nearest VPS relay that answers
   * near (`pickHome`), else on Cloudflare (in `region`, if given), and on
   * Cloudflare too when that relay can't take it now.
   */
  const create = async (region: Region = 'auto'): Promise<CreateResult> => {
    const home = region === 'auto' ? pickHome(await measureVps()) : 'cf'
    if (home !== 'cf') {
      const made = await reserve(home, region)
      if (made.ok || (made.why !== 'offline' && made.why !== 'busy')) return made
    }
    return reserve('cf', region)
  }

  const leaveQuietly = () => {
    s.wanted = false
    const ws = s.socket
    s.socket = null
    ws?.close()
  }

  /** Leaves the room for good (in a run: the Pokémon leaves the field; the share was banked by the shell). */
  const leave = () => {
    if (s.welcomed) send({ t: 'leave' })
    if (s.code) deps.store.remove(secretKey(s.code))
    finish('left')
  }

  /* ---------------- The room's relay, for the group ---------------- */

  /**
   * The relay the room should move to before its first run, or null: only the
   * host asks, in a room whose relay takes moves, with company, never twice.
   */
  const moveTarget = (): RelayHome | null => {
    const room = s.room
    const code = s.code
    if (!s.moves || s.movedIn || !room || !code || room.code !== code || room.phase !== 'lobby') return null
    if (!room.members.some((m) => m.seat === s.seat && m.host)) return null
    const online = room.members.filter((m) => m.online)
    if (online.length < 2) return null
    return groupHome(homeOf(code), VPS_HOMES.filter((h) => vps[h]), online.map((m) => m.rtt ?? null))
  }

  const setMoving = (next: Moving | null) => {
    const was = s.moving !== null
    s.moving = next
    if (was !== (next !== null)) emit({ kind: 'moving', on: next !== null })
  }

  /** The run starts in the room the client is in now (a move done, or given up). */
  const startHere = () => {
    setMoving(null)
    send({ t: 'start' })
  }

  /**
   * The host's Start: the run starts at once, or the room first moves to the
   * relay best for the group (`moveTarget`): a room is made there and the old
   * one told to send everyone over. The run starts here if that can't be done.
   */
  const start = () => {
    if (s.moving) return
    const target = moveTarget()
    if (!target) return void send({ t: 'start' })
    const from = s.code
    setMoving({ host: true, code: null, claim: null, expect: s.room?.members.filter((m) => m.online).length ?? 1, at: deps.now() })
    void reserve(target, 'auto', MOVE.create).then((made) => {
      const mv = s.moving
      if (!mv?.host || mv.code !== null || s.code !== from) return
      // No claim: a relay from before moves, where the host might not get the crown back.
      if (!made.ok || !made.claim || !s.welcomed || s.room?.phase !== 'lobby') return startHere()
      s.moving = { ...mv, code: made.code, claim: made.claim, at: deps.now() }
      if (!send({ t: 'move', code: made.code })) startHere()
    })
  }

  /** Over to room `to` (the old room said `moved`): this socket goes, the new one says the claim and brings the player along. */
  const follow = (to: string) => {
    const from = s.code ?? ''
    const ws = s.socket
    s.socket = null
    s.welcomed = false
    s.pingAt = null
    ws?.close()
    s.code = to
    s.attempt = 0
    s.fresh = false
    s.roomBuild = null
    s.runner = null
    // Another relay: the round trip starts over.
    s.rtt = 0
    s.movedIn = true
    forgetRoom()
    lastRefusal = null
    emit({ kind: 'moved', from, to })
    setStatus({ kind: 'connecting', attempt: 0 })
    void open()
  }

  /** Welcomed in a room the group moved to: this player's Pokémon, ready and (the host's) settings, as they were. */
  const bringAlong = (room: RoomView, seat: number) => {
    const carry = s.carry
    s.carry = null
    if (s.moving && !s.moving.host) setMoving(null)
    if (!carry || room.phase === 'playing') return
    if (carry.loadout) send({ t: 'loadout', loadout: carry.loadout })
    if (carry.settings && room.members.some((m) => m.seat === seat && m.host)) send({ t: 'settings', settings: carry.settings })
    if (carry.ready && carry.loadout) send({ t: 'ready', ready: true })
  }

  /**
   * The host's move, each frame: given up when the old room never said
   * `moved` (the run starts there), and in the new room the run starts once
   * everyone who was online is in and ready, or at `MOVE.gather` with
   * whoever made it.
   */
  const tendMove = (now: number) => {
    const mv = s.moving
    if (!mv?.host || mv.code === null) return
    if (s.code !== mv.code) {
      if (now - mv.at > MOVE.echo) startHere()
      return
    }
    const room = s.room
    if (!s.welcomed || room?.code !== mv.code) {
      // The new room never let the host in: the client keeps trying like any reconnect, without the line.
      if (now - mv.at > 2 * MOVE.gather) setMoving(null)
      return
    }
    const online = room.members.filter((m) => m.online)
    const set = online.every((m) => m.loadout !== null && (m.host || m.ready))
    if ((online.length >= mv.expect && set) || now - mv.at > MOVE.gather) startHere()
  }

  /** Whether two reports say about the same (within `LOBBY.change` ms): not worth saying again. */
  const sameReport = (a: Rtts, b: Rtts) =>
    Object.keys(a).length === Object.keys(b).length &&
    Object.entries(b).every(([home, ms]) => {
      const was = isRelayHome(home) ? a[home] : undefined
      return was === ms || (typeof was === 'number' && typeof ms === 'number' && Math.abs(was - ms) < LOBBY.change)
    })

  /**
   * In a lobby whose relay takes moves: measures the VPS relays once and
   * reports them with the room's own pings (a Cloudflare room's round trip),
   * again when they change, so the host's Start can pick for everyone.
   */
  const reportRtts = (now: number) => {
    const room = s.room
    const code = s.code
    if (!s.moves || s.movedIn || !s.welcomed || !room || !code || room.phase !== 'lobby' || now - s.reportedAt < LOBBY.every) return
    if (s.vpsFor !== code) {
      s.vpsFor = code
      void measureVps().then((rtts) => {
        if (s.vpsFor === code) s.vpsRtts = rtts
      })
    }
    if (!s.vpsRtts) return
    const ms: { [H in RelayHome]?: number | null } = {}
    for (const [home, rtt] of s.vpsRtts) ms[home] = rtt === null ? null : Math.round(rtt)
    if (homeOf(code) === 'cf') {
      const cf = s.lobbyPings.length >= LOBBY.enough ? median(s.lobbyPings) : null
      if (cf === null) return
      ms.cf = Math.round(cf)
    }
    if (s.reported && sameReport(s.reported, ms)) return
    if (send({ t: 'rtt', ms })) {
      s.reported = ms
      s.reportedAt = now
    }
  }

  /** Queues an input of the player's for the run. */
  const input = (i: Input) => {
    if (s.status.kind !== 'playing' || s.hidden) return 0
    if (i.k === 'special') {
      s.specials.push(i.sample)
      if (s.specials.length > SPECIALS_KEPT) s.specials.shift()
    }
    return push(s.outbox, i, deps.now())
  }

  /**
   * Takes one 60 Hz sample of the stick (the shell calls it once per tick of
   * real time while the run plays): sent when it changed enough
   * (`paceStick`), and the code in play kept for prediction.
   */
  const stick = (move: Vec) => {
    const code = moveCode(move)
    s.sample++
    const live = s.status.kind === 'playing' && !s.hidden
    if (live && paceStick(s.pace, code, s.sample, slowed(s.outbox, deps.now()))) input({ k: 'move', code, sample: s.sample })
    // What the simulation will read for this sample: the code in play (this one when it just went out).
    s.history[s.sample % HISTORY] = s.pace.code >= 0 ? s.pace.code : code
  }

  /**
   * What goes out this frame: the inputs due, then whatever rides along with
   * them (the hashes, the link report, a ping, the stick in play as an anchor). Nothing when
   * nothing is due: the hashes wait up to `CONNECT.lazy`, the anchor
   * `CONNECT.anchor`, and silence ends at `CONNECT.heartbeat`.
   */
  const outgoing = (now: number): BatchedMessage[] => {
    // Only what the socket can take: a stalled one keeps the stick coalesced instead of piling up.
    if (!s.socket || s.socket.buffered() >= 64 * 1024) return []
    const out = due(s.outbox, now, s.rtt)
    const r = s.runner
    if (r?.over && !r.ended && now - s.overAt >= CONNECT.over) {
      s.overAt = now
      out.push({ t: 'over', ...r.over })
    }
    // The link report (every `NET_REPORT_MS`) rides along like the hashes.
    if (r && !r.ended && now - s.net.reportedAt >= NET_REPORT_MS) {
      s.net.reportedAt = now
      s.later.push({ msg: netReport(r), at: now })
    }
    const playing = r !== null && s.status.kind === 'playing' && s.pace.code >= 0
    const silent = now - s.lastSentAt >= CONNECT.heartbeat
    const stale = s.later.length > 0 && now - s.later[0]!.at >= CONNECT.lazy
    const unanchored = playing && s.pace.code !== 0 && now - s.anchoredAt >= CONNECT.anchor
    // A Cloudflare room's lobby: its first pings go quicker, its round trip being one the group's choice reads.
    const probing = s.moves && !s.movedIn && s.room?.phase === 'lobby' && s.code !== null && homeOf(s.code) === 'cf' && s.lobbyPings.length < LOBBY.pings && now - s.lastPingAt >= LOBBY.probe
    if (out.length === 0 && !silent && !stale && !unanchored && !probing) return out
    out.push(...s.later.splice(0).map((l) => l.msg))
    if (playing && !out.some((m) => m.t === 'in' && m.k === 'move')) out.push({ t: 'in', k: 'move', d: [s.pace.code, s.sample] })
    if (out.length === 0) out.push({ t: 'hb' })
    if (now - s.lastPingAt >= CONNECT.ping || probing) {
      s.lastPingAt = now
      s.pingAt ??= now
      out.push({ t: 'ping', at: now })
    }
    if (out.some((m) => m.t === 'in' && m.k === 'move')) s.anchoredAt = now
    return out
  }

  /** The tab went to the background (true) or came back. Hidden, the run isn't simulated and nothing is sent (the relay calls the seat away). */
  const setHidden = (hidden: boolean) => {
    if (s.hidden === hidden) return
    s.hidden = hidden
    noteHidden(s.net, hidden, deps.now())
    if (hidden) return
    s.lastMessageAt = Math.max(s.lastMessageAt, deps.now() - CONNECT.stalled)
    s.pingAt = null
    const r = s.runner
    // Gone long: the agreed snapshot is quicker than simulating it all.
    if (r && !r.ended && backlog(r) > CONNECT.jump) {
      s.fresh = true
      noteReconnect('jump', false)
      return reconnect()
    }
    if (s.wanted && !s.socket) {
      s.attempt = 0
      void open()
    }
  }

  /**
   * One display frame (`dt` seconds): retries a dropped socket when due,
   * watches for stalls, pings, flushes the inputs and simulates the run.
   * Returns how many ticks ran.
   */
  const frame = (dt: number): number => {
    const now = deps.now()
    if (s.wanted && !s.socket && s.retryAt !== null && now >= s.retryAt && !s.hidden) void open()
    const ws = s.socket
    if (ws && !s.hidden) {
      const silent = now - s.lastMessageAt
      if (!s.welcomed && silent > CONNECT.hello) return (noteReconnect('hello'), reconnect(), 0)
      if (s.welcomed && silent > CONNECT.dead) return (noteReconnect('dead'), reconnect(), 0)
      // Not while syncing: a client busy catching up answers its own pongs late.
      if (s.welcomed && s.pingAt !== null && now - s.pingAt > CONNECT.uplink && !s.runner?.syncing) return (noteReconnect('uplink'), reconnect(), 0)
      if (s.welcomed) sendAll(outgoing(now))
      reportRtts(now)
    }
    tendMove(now)
    const r = s.runner
    if (!r || s.hidden) return 0
    const t0 = deps.now()
    const ran = advance(r, dt, runnerDeps)
    const after = deps.now()
    if (ran > 0) addSample(s.net.simTick, (after - t0) / ran)
    noteFrame(s.net, after, { hold: r.hold.hold, paused: teamPaused(r.game), catchingUp: r.syncing !== null || r.pending !== null || backlog(r) > r.hold.hold + 2 })
    return ran
  }

  /** How the link looks from here, for the relay's run summary (`net`). */
  const netReport = (r: Runner): NetReport => {
    const n = s.net
    const total = Object.values(n.reconnects).reduce((a, b) => a + b, 0)
    return { t: 'net', rtt: Math.round(quantile(n.rtt, 0.5) ?? s.rtt), rtt95: Math.round(quantile(n.rtt, 0.95) ?? s.rtt), hold: r.hold.hold, underruns: r.stats.underruns, stalls: n.stalls, reconnects: total }
  }

  /** How the connection is doing, for the pip and the overlays. */
  const connection = (): Connection => {
    const now = deps.now()
    const r = s.runner
    const stalled = s.status.kind === 'playing' && !s.hidden && (!s.welcomed || now - s.lastMessageAt > CONNECT.stalled)
    const hold = r?.hold.hold ?? 0
    const quality: Quality = stalled || !s.welcomed ? 'offline' : s.rtt > 250 || hold >= 8 ? 'poor' : s.rtt > 140 || hold >= 5 ? 'fair' : 'good'
    return { quality, rtt: Math.round(s.rtt), hold, stalled, syncing: r ? syncProgress(r) : null, reconnects: s.reconnects }
  }

  return {
    state: (): Readonly<ClientState> => s,
    on: (fn: (e: CoopEvent) => void) => {
      listeners.add(fn)
      return () => void listeners.delete(fn)
    },
    create,
    /** Measures the VPS relays now (the co-op screen opened), so a `create` soon after has its answer. */
    warm: () => void measureVps(),
    join,
    leave,
    setLoadout: (pick: CoopPick) => send({ t: 'loadout', loadout: loadoutOf(pick) }),
    setReady: (ready: boolean) => send({ t: 'ready', ready }),
    setSettings: (settings: CoopSettings) => send({ t: 'settings', settings: settingsOf(settings) }),
    kick: (seat: number) => send({ t: 'kick', seat }),
    /** The host starts the run (or the next one, after a run: "Jogar de novo"); everyone else must be ready. The first may move the room first (`start`). */
    start,
    input,
    stick,
    setHidden,
    frame,
    connection,
    /** Inputs waiting to go out (bounded). */
    queued: () => queued(s.outbox),
    /** Test and soak hooks: drop the socket as a network failure would, or rejoin afresh (a new tab: the snapshot). */
    drop: () => (noteReconnect('manual'), reconnect()),
    rejoinFresh: () => {
      s.runner = null
      s.fresh = true
      noteReconnect('manual')
      reconnect()
    },
  }
}

export type CoopClient = ReturnType<typeof createCoopClient>
