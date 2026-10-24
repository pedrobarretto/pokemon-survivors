import { TICK_HZ, type ClientMessage, type NetReport, type WelcomeNet } from '../../src/net/protocol'
import type { ConnId, Effect, Room } from './room'

/**
 * What the relay notes to make every co-op run diagnosable, kept out of the
 * room's rules: where the Durable Object runs and where each socket meets
 * Cloudflare, per-socket open and close lines, and per run the frame timer's
 * lateness, the messages in by kind, inputs coalesced and dropped, bytes per
 * seat, storage writes, snapshot sizes and each client's own link report
 * (`net`). The Durable Object logs what these functions return as JSON lines
 * (Workers observability) and keeps the laggiest runs' input logs for the lab
 * (`Vault`). Bounded: counters and one fixed histogram, nothing per frame.
 */

/** Where a socket meets Cloudflare, from the Worker's request (`EDGE_HEADER`). */
export type Edge = { colo: string | null; country: string | null; asn: number | null; rtt: number | null }

/** The header the Worker sets on a socket's request for its room (overwriting any a client sent). */
export const EDGE_HEADER = 'X-PS-Edge'

const str = (v: unknown, max = 8) => (typeof v === 'string' && v.length > 0 ? v.slice(0, max) : null)
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The edge of a request, from its `cf` (`clientTcpRtt` is 0 or missing over QUIC: null then). */
export const edgeOf = (cf: { colo?: unknown; country?: unknown; asn?: unknown; clientTcpRtt?: unknown } | undefined): Edge => ({
  colo: str(cf?.colo),
  country: str(cf?.country),
  asn: num(cf?.asn),
  rtt: num(cf?.clientTcpRtt) || null,
})

export const parseEdge = (raw: string | null): Edge => {
  let v: unknown = null
  try {
    v = raw ? JSON.parse(raw) : null
  } catch {
    v = null
  }
  return isRecord(v) ? { colo: str(v.colo), country: str(v.country), asn: num(v.asn), rtt: num(v.rtt) } : { colo: null, country: null, asn: null, rtt: null }
}

/**
 * Where this Durable Object runs: the `colo=MIA` line of Cloudflare's trace as seen from inside it (its
 * `loc` line geolocates the original client, not the object, so it's left out).
 */
export type Where = { colo: string | null }

export const parseTrace = (text: string): Where => ({ colo: str(/^colo=(.+)$/m.exec(text)?.[1]?.trim()) })

type ConnMeta = { edge: Edge; openedAt: number; seat: number | null }

/** One link report per seat, as the client last sent it. */
export type Report = Omit<NetReport, 't'>

/** Timer lateness by whole ms; the last bucket holds everything past it. */
const LATE_BUCKETS = 256

/** How late the frame timer fired: a fixed histogram (whole ms), how many and the worst. */
export type Lateness = { late: Uint32Array; lateN: number; lateMax: number }

export const createLateness = (): Lateness => ({ late: new Uint32Array(LATE_BUCKETS), lateN: 0, lateMax: 0 })

/** Notes a timer that fired `ms` after its deadline. */
export const addLateness = (h: Lateness, ms: number) => {
  if (!(ms >= 0)) return
  h.late[Math.min(LATE_BUCKETS - 1, Math.floor(ms))]!++
  h.lateN++
  h.lateMax = Math.max(h.lateMax, ms)
}

/** The `q` quantile of `h` (whole ms; the worst past the last bucket), null when empty. */
export const lateQuantile = (h: Lateness, q: number) => {
  if (h.lateN === 0) return null
  const target = Math.max(1, Math.ceil(h.lateN * q))
  let seen = 0
  for (let i = 0; i < LATE_BUCKETS - 1; i++) if ((seen += h.late[i]!) >= target) return i
  return h.lateMax
}

export type RunTally = Lateness & {
  run: number
  startedAt: number
  /** Begun mid-run (the object restarted): the counts cover only the run's last part. */
  restarted: boolean
  /** Live frames sent, and those carrying more than one tick (the timer ran late by a tick or more). */
  frames: number
  multiTick: number
  inbound: Record<string, number>
  /** Stick inputs taken, stick entries sent in frames (the difference was coalesced), and messages the rate limit dropped. */
  moveIn: number
  moveOut: number
  dropped: number
  bytesOut: Record<number, number>
  bytesIn: Record<number, number>
  /** Log batches (the ticks with inputs and the hashes decided, about one a second), room saves, snapshot chunks, deletes. */
  writes: { log: number; save: number; chunks: number; deletes: number }
  /** Snapshot uploads (base64 characters): how many, the biggest and the last; `cur` is the one coming in. */
  snaps: { count: number; max: number; last: number; cur: { tick: number; size: number } | null }
  pauses: number
  reports: Record<number, Report>
  /** Each seat's edge, and how many times it was welcomed this run (1 + its reconnects). */
  edges: Record<number, Edge>
  opens: Record<number, number>
}

export type Telemetry = {
  where: Where | null
  conns: Map<ConnId, ConnMeta>
  run: RunTally | null
  /** The room as last seen: a run dropped with its room (`room.ended`) is summed up from it. */
  room: Room | null
}

export const createTelemetry = (): Telemetry => ({ where: null, conns: new Map(), run: null, room: null })

/** A run's counts from `now`, with the seats connected then (each welcomed once so far). */
const newTally = (t: Telemetry, run: number, now: number, restarted: boolean): RunTally => {
  const r = emptyTally(run, now, restarted)
  for (const meta of t.conns.values()) {
    if (meta.seat === null) continue
    r.edges[meta.seat] = meta.edge
    r.opens[meta.seat] = 1
  }
  return r
}

const emptyTally = (run: number, now: number, restarted: boolean): RunTally => ({
  run,
  startedAt: now,
  restarted,
  frames: 0,
  multiTick: 0,
  ...createLateness(),
  inbound: {},
  moveIn: 0,
  moveOut: 0,
  dropped: 0,
  bytesOut: {},
  bytesIn: {},
  writes: { log: 0, save: 0, chunks: 0, deletes: 0 },
  snaps: { count: 0, max: 0, last: 0, cur: null },
  pauses: 0,
  reports: {},
  edges: {},
  opens: {},
})

/** A log line: one JSON object per line, picked up by Workers observability. */
export type LogLine = Record<string, unknown> & { ev: string }

export const connOpened = (t: Telemetry, id: ConnId, edge: Edge, now: number, code: string | null): LogLine => {
  t.conns.set(id, { edge, openedAt: now, seat: null })
  return { ev: 'conn.open', code: code ?? t.room?.code ?? null, conn: id.slice(0, 8), ...edge }
}

/** A socket went (`closeCode`/`reason` from the peer, or the relay's own reason); null when it was already logged. `code`: the room's, else the last one seen (gone with a wipe). */
export const connClosed = (t: Telemetry, id: ConnId, now: number, code: string | null, how: { closeCode: number | null; reason: string }): LogLine | null => {
  const meta = t.conns.get(id)
  if (!meta) return null
  t.conns.delete(id)
  return { ev: 'conn.close', code: code ?? t.room?.code ?? null, conn: id.slice(0, 8), seat: meta.seat, ...how, ms: now - meta.openedAt, colo: meta.edge.colo, country: meta.edge.country }
}

/** What `welcome` tells a socket about where things run. */
export const welcomeNet = (t: Telemetry, id: ConnId, room: Room | null): WelcomeNet => {
  const edge = t.conns.get(id)?.edge
  return { colo: t.where?.colo ?? null, region: room?.region ?? null, edge: edge?.colo ?? null, edgeRtt: edge?.rtt ?? null }
}

/**
 * A message from a seat (null: not seated); `dropped`: the rate limit turned it (or some of a batch) away. A
 * `batch` counts as one and each message it carries by its own kind too.
 */
export const noteInbound = (t: Telemetry, seat: number | null, msg: ClientMessage | null, bytes: number, dropped: boolean) => {
  const r = t.run
  if (!r) return
  if (dropped) r.dropped++
  if (seat !== null) r.bytesIn[seat] = (r.bytesIn[seat] ?? 0) + bytes
  const count = (kind: string) => (r.inbound[kind] = (r.inbound[kind] ?? 0) + 1)
  if (msg?.t === 'batch') count('batch')
  for (const m of msg?.t === 'batch' ? msg.m : [msg]) {
    count(m?.t ?? 'bad')
    if (seat === null || dropped) continue
    if (m?.t === 'in' && m.k === 'move') r.moveIn++
    if (m?.t === 'net') r.reports[seat] = { rtt: m.rtt, rtt95: m.rtt95, hold: m.hold, underruns: m.underruns, stalls: m.stalls, reconnects: m.reconnects }
  }
}

export const noteSent = (t: Telemetry, seat: number | null, bytes: number) => {
  if (t.run && seat !== null) t.run.bytesOut[seat] = (t.run.bytesOut[seat] ?? 0) + bytes
}

/** The frame timer fired `ms` after its deadline. */
export const noteLateness = (t: Telemetry, ms: number) => {
  if (t.run) addLateness(t.run, ms)
}

const closeSnap = (r: RunTally) => {
  const cur = r.snaps.cur
  if (!cur) return
  r.snaps.count++
  r.snaps.max = Math.max(r.snaps.max, cur.size)
  r.snaps.last = cur.size
  r.snaps.cur = null
}

/** Runs shorter than this (ticks) aren't worth keeping for the lab. */
export const LAB_MIN_TICKS = 60 * TICK_HZ

/**
 * How laggy a run was, for keeping its input log (the laggiest runs win the
 * day's places): the worst seat's round trip p95 (ms; its edge's TCP round
 * trip without a report), plus 20 per underrun and 50 per reconnect.
 */
export const labScore = (r: Pick<RunTally, 'reports' | 'edges'>) => {
  let worst = 0
  for (const seat of new Set([...Object.keys(r.reports), ...Object.keys(r.edges)].map(Number))) {
    const rep = r.reports[seat]
    const rtt = rep?.rtt95 ?? r.edges[seat]?.rtt ?? 0
    worst = Math.max(worst, rtt + 20 * (rep?.underruns ?? 0) + 50 * (rep?.reconnects ?? 0))
  }
  return worst
}

/** A finished (or dropped) run to keep for the lab: the Durable Object reads its log and offers it to the vault. */
export type LabRun = { room: Room; run: number; tick: number; score: number; why: string; seats: Record<number, { edge: Edge | null; report: Report | null }> }

const summary = (t: Telemetry, r: RunTally, room: Room | null, now: number, why: string, final: boolean): LogLine => {
  closeSnap(r)
  const run = room?.run
  const seats = [...new Set([...Object.keys(r.edges), ...Object.keys(r.reports)].map(Number))].map((seat) => ({
    seat,
    opens: r.opens[seat] ?? 0,
    colo: r.edges[seat]?.colo ?? null,
    country: r.edges[seat]?.country ?? null,
    asn: r.edges[seat]?.asn ?? null,
    edgeRtt: r.edges[seat]?.rtt ?? null,
    ...(r.reports[seat] ?? {}),
    bytesOut: r.bytesOut[seat] ?? 0,
    bytesIn: r.bytesIn[seat] ?? 0,
  }))
  return {
    ev: 'run.summary',
    code: room?.code ?? null,
    run: r.run,
    why,
    final,
    colo: t.where?.colo ?? null,
    region: room?.region ?? null,
    ticks: run?.ended?.tick ?? run?.next ?? null,
    ms: now - r.startedAt,
    restarted: r.restarted,
    frames: r.frames,
    multiTick: r.multiTick,
    lateP50: lateQuantile(r, 0.5),
    lateP99: lateQuantile(r, 0.99),
    lateMax: r.lateMax,
    inbound: r.inbound,
    moveIn: r.moveIn,
    moveOut: r.moveOut,
    coalesced: Math.max(0, r.moveIn - r.moveOut),
    dropped: r.dropped,
    writes: r.writes,
    snapshots: { count: r.snaps.count, max: r.snaps.max, last: r.snaps.last },
    pauses: r.pauses,
    score: labScore(r),
    seats,
  }
}

/**
 * The room's effects of one batch, before they are applied (`room` as the
 * room is now, null once wiped): counts frames, writes and snapshots, follows
 * the run's start and end, and returns the log lines to print and the run to
 * offer the lab. A run is summed up and offered when it ends, when its room
 * goes, and also when everyone left it (`run.paused`, `empty`; not final:
 * an idle room's object is usually evicted before it expires, and its counts
 * with it). Players coming back make it go on, and its end offers it again.
 */
export const noteEffects = (t: Telemetry, room: Room | null, effects: readonly Effect[], now: number): { logs: LogLine[]; lab: LabRun | null } => {
  const last = room ?? t.room
  t.room = last
  const logs: LogLine[] = []
  let lab: LabRun | null = null
  let saved = false
  let frame: unknown = null
  // A batch that starts a run counts from its `run.started` (its effects before that already see the run on).
  const starting = effects.some((e) => e.k === 'event' && e.ev === 'run.started')
  /**
   * Sums up the run being counted (`why`; `final`: it stopped) and, if it ran long enough, offers it to the
   * lab: not a tally that only saw the end of a run its restart had already left (it was offered before).
   */
  const sumUp = (why: string, final = true): LabRun | null => {
    const r = t.run
    if (final) t.run = null
    if (!r || !last?.run || last.run.start.id !== r.run) return null
    logs.push(summary(t, r, last, now, why, final))
    const tick = last.run.ended?.tick ?? last.run.next
    if (tick < LAB_MIN_TICKS || (r.restarted && r.frames === 0)) return null
    const seats = Object.fromEntries(last.run.start.players.map((p) => [p.seat, { edge: r.edges[p.seat] ?? null, report: r.reports[p.seat] ?? null }] as const))
    return { room: last, run: r.run, tick, score: labScore(r), why, seats }
  }
  for (const e of effects) {
    if (e.k === 'event') {
      if (e.ev === 'run.started') {
        lab = sumUp('replaced') ?? lab
        t.run = newTally(t, Number(e.data.run), now, false)
      } else if (e.ev === 'run.over') lab = sumUp('over') ?? lab
      else if (e.ev === 'room.ended') lab = sumUp(String(e.data.why)) ?? lab
      else if (e.ev === 'run.paused' && t.run) {
        t.run.pauses++
        if (e.data.why === 'empty') lab = sumUp('left', false) ?? lab
      }
      continue
    }
    if (e.k === 'send' && e.msg.t === 'welcome') {
      const meta = t.conns.get(e.to)
      if (meta) meta.seat = e.msg.seat
    }
    // A run already on when this object (re)started: counted from here.
    if (!t.run && !starting && last?.phase === 'playing' && last.run && !last.run.ended) t.run = newTally(t, last.run.start.id, now, true)
    const r = t.run
    if (!r) continue
    if (e.k === 'send' && e.msg.t === 'frame' && e.msg !== frame) {
      // One frame goes to every seat as the same message: counted once.
      frame = e.msg
      r.frames++
      if (e.msg.to - e.msg.from > 1) r.multiTick++
      for (const [, entries] of e.msg.ticks) for (const entry of entries) if (entry[1] === 'move') r.moveOut++
    } else if (e.k === 'send' && e.msg.t === 'welcome') {
      const edge = t.conns.get(e.to)?.edge
      if (edge) r.edges[e.msg.seat] = edge
      r.opens[e.msg.seat] = (r.opens[e.msg.seat] ?? 0) + 1
    } else if (e.k === 'save') saved = true
    else if (e.k === 'log') r.writes.log++
    else if (e.k === 'chunk') {
      r.writes.chunks++
      if (r.snaps.cur?.tick !== e.tick) {
        closeSnap(r)
        r.snaps.cur = { tick: e.tick, size: 0 }
      }
      r.snaps.cur.size += e.data.length
    } else if (e.k === 'keepSnapshot' || e.k === 'dropSnapshot' || e.k === 'dropRun') r.writes.deletes++
  }
  if (saved && t.run) t.run.writes.save++
  return { logs, lab }
}
