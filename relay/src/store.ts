import type { Phase, ServerMessage, TickEntries } from '../../src/net/protocol'
import type { Effect, Room } from './room'

/**
 * A room's storage, the same for every relay shell: each room has its own
 * SQLite (a one-room Durable Object's, or one file per room on a VPS relay)
 * or its own key prefix in a shard's (`ShardObject`) behind this small
 * adapter, so what the room's effects write, the keys they use and how a
 * restart, a sync or a dump reads them back are written once.
 *
 * Two ways to write, as the room asks (the doc block atop `room.ts`):
 * - Durable: the room (rare: seats, run start and end, the agreed snapshot,
 *   pauses), a row of the SQL table `kv`. Nothing that follows it goes out
 *   before it is on disk: the Durable Object's output gate holds the messages
 *   until `sql.exec` commits; a VPS relay commits before it sends.
 * - Lazy (`Lazy`): the run's log batches (once a second, with the clock
 *   bound) and snapshot chunks, as keys. They never hold a message back; they
 *   land in order, before any durable write that follows. The Durable Object
 *   writes them as KV keys with `allowUnconfirmed`; a VPS relay as rows of
 *   `kv` in the same transaction as the rest (a local commit takes
 *   microseconds), so only losing the machine loses any.
 * A shard writes the room lazily too (`saveRoom`): the output gate is the
 * whole object's, and one room's save must not hold the others' frames (the
 * crash window this opens: `shardObject.ts`).
 * After a restart a shell loads the room with the `bound` of its run's newest
 * log batch (`readBound`): the clock resumes past every tick sent.
 *
 * - `log:<run>:<at>:<n>` → `LogBatch` (numbers zero-padded, so keys sort as the batches do)
 * - `snap:<run>:<tick>:<part>` → the chunk's base64
 */

export type Bind = string | number | null

/** One room's SQLite: `run` for writes, `all` for reads (rows as the driver gives them). */
export type Sql = {
  run: (query: string, ...args: Bind[]) => void
  all: (query: string, ...args: Bind[]) => Record<string, unknown>[]
}

/** A log batch as stored: the clock bound, the ticks with entries, the hashes decided. */
export type LogBatch = { b: number; l: TickEntries[]; h: [number, Record<number, string>][] }

/** What a lazy key holds: a log batch or a snapshot chunk's base64. */
export type Stored = LogBatch | string

/** The lazy writes' keys, in key order. `list` reads what `put` wrote, at once (before it is durable). */
export type Lazy = {
  put: (key: string, value: Stored) => void
  delete: (keys: readonly string[]) => void
  /** The keys under `prefix` (from `start` on), in key order or `reverse`, at most `limit`. */
  list: (prefix: string, opts?: { start?: string; reverse?: boolean; limit?: number }) => [string, Stored][]
}

/**
 * `saveRoom`: where the room is saved instead of the row `room` of `kv`. A
 * shard (`ShardObject`, many rooms in one Durable Object) keeps each room as a
 * lazy key of its own: `sql.exec` takes the output gate, which would hold every
 * room's messages behind one room's save.
 */
export type Store = { sql: Sql; lazy: Lazy; saveRoom?: (json: string) => void }

export const SCHEMA = 'CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)'

/** Ticks of the log per catch-up frame. */
export const TAIL_FRAME_TICKS = 600

const PHASES: readonly Phase[] = ['lobby', 'playing', 'ended']

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** The room as saved (its own JSON), checked for the fields everything else relies on. */
export const isRoom = (v: unknown): v is Room =>
  isRecord(v) && typeof v.code === 'string' && typeof v.build === 'string' && PHASES.some((p) => p === v.phase) && Array.isArray(v.seats) && Array.isArray(v.banned)

const text = (row: Record<string, unknown> | undefined, k: string) => (typeof row?.[k] === 'string' ? row[k] : '')
const whole = (row: Record<string, unknown> | undefined, k: string) => (typeof row?.[k] === 'number' ? row[k] : 0)

const pad = (n: number, width = 10) => String(n).padStart(width, '0')
export const logPrefix = (run: number) => `log:${run}:`
const logKey = (run: number, at: number, n: number) => `${logPrefix(run)}${pad(at)}:${pad(n, 6)}`
export const snapPrefix = (run: number, tick?: number) => `snap:${run}:${tick === undefined ? '' : `${pad(tick)}:`}`

const batchOf = (v: Stored): LogBatch | null => (typeof v === 'string' ? null : v)
const chunkOf = (v: Stored): string | null => (typeof v === 'string' ? v : null)

/** A lazy value a shell kept as JSON text (a VPS relay), or null when it isn't one. */
export const parseStored = (json: string): Stored | null => {
  const v: unknown = JSON.parse(json)
  if (typeof v === 'string') return v
  return isRecord(v) && typeof v.b === 'number' && Array.isArray(v.l) && Array.isArray(v.h) ? { b: v.b, l: v.l, h: v.h } : null
}

export const createSchema = (sql: Sql) => sql.run(SCHEMA)

const hasTable = (sql: Sql, name: string) => sql.all("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", name).length > 0

/** A room saved as JSON, or null when it isn't one. */
export const parseRoom = (json: string): Room | null => {
  const v: unknown = JSON.parse(json)
  return isRoom(v) ? v : null
}

/** The room this storage holds, or null (none made yet, or wiped). */
export const readRoom = (sql: Sql): Room | null => {
  if (!hasTable(sql, 'kv')) return null
  const row = sql.all("SELECT v FROM kv WHERE k = 'room'")[0]
  return row ? parseRoom(text(row, 'v')) : null
}

/** The clock bound of the run's newest log batch (0 without one), for `loadState`. */
export const readBound = (store: Store, run: number): number => {
  for (const [, v] of store.lazy.list(logPrefix(run), { reverse: true, limit: 1 })) return batchOf(v)?.b ?? 0
  return 0
}

/** The log's batches of `run` that may hold ticks from `from` on (all of them by default), in order. */
const batches = (store: Store, run: number, from = -1): LogBatch[] =>
  store.lazy.list(logPrefix(run), { start: logKey(run, from + 1, 0) }).flatMap(([, v]) => batchOf(v) ?? [])

/**
 * Rows of the SQL tables (`log`, `hashes`, `snaps`) a Durable Object room
 * created before the log moved to keys still holds, as `[tick, JSON or data]`
 * in order (none on a VPS relay). Rooms live 6 hours at most: this goes once
 * that deploy is older than that.
 */
const legacy = (sql: Sql, table: 'log' | 'hashes' | 'snaps', run: number): [number, string][] => {
  if (!hasTable(sql, table)) return []
  const q = { log: 'SELECT tick, e AS v FROM log', hashes: 'SELECT tick, v FROM hashes', snaps: 'SELECT tick, data AS v FROM snaps' }[table]
  return sql.all(`${q} WHERE run = ? ORDER BY tick${table === 'snaps' ? ', part' : ''}`, run).map((r) => [whole(r, 'tick'), text(r, 'v')])
}

/** The ticks with entries in `[from, to)`, each with its entries as JSON, in order. */
const readLog = (store: Store, run: number, from: number, to: number): [number, string][] => {
  const rows = legacy(store.sql, 'log', run).filter(([tick]) => tick >= from && tick < to)
  for (const b of batches(store, run, from)) for (const [tick, entries] of b.l) if (tick >= from && tick < to) rows.push([tick, JSON.stringify(entries)])
  return rows
}

/** The chunks of the snapshot of `run` at `tick`, in order. */
const readChunks = (store: Store, run: number, tick: number): string[] => {
  const chunks = store.lazy.list(snapPrefix(run, tick)).flatMap(([, v]) => chunkOf(v) ?? [])
  return chunks.length > 0 ? chunks : legacy(store.sql, 'snaps', run).filter(([t]) => t === tick).map(([, data]) => data)
}

const keys = (store: Store, prefix: string) => store.lazy.list(prefix).map(([k]) => k)

/** Writes what `effects` ask of storage: the lazy writes as they come, then the room once if any asked for a `save` (`saveRoom`, else its row). */
export const persist = (store: Store, effects: readonly Effect[], room: Room | null) => {
  let save = false
  for (const e of effects) {
    if (e.k === 'save') save = true
    else if (e.k === 'log') store.lazy.put(logKey(e.run, e.at, e.n), { b: e.bound, l: e.ticks, h: e.hashes })
    else if (e.k === 'chunk') store.lazy.put(`${snapPrefix(e.run, e.tick)}${pad(e.part, 4)}`, e.data)
    else if (e.k === 'keepSnapshot') store.lazy.delete(keys(store, snapPrefix(e.run)).filter((k) => !k.startsWith(snapPrefix(e.run, e.tick))))
    else if (e.k === 'dropSnapshot') store.lazy.delete(keys(store, snapPrefix(e.run, e.tick)))
    else if (e.k === 'dropRun') store.lazy.delete([...keys(store, logPrefix(e.run)), ...keys(store, snapPrefix(e.run))])
  }
  if (!save || !room) return
  if (store.saveRoom) store.saveRoom(JSON.stringify(room))
  else store.sql.run("INSERT OR REPLACE INTO kv (k, v) VALUES ('room', ?)", JSON.stringify(room))
}

/** A sync's messages, in order: the `sync`, the base snapshot's chunks, then the log from `from` to `to` in frames. */
export const syncTexts = (store: Store, e: Extract<Effect, { k: 'sync' }>): string[] => {
  const run = e.msg.run.id
  let msg = e.msg
  const base = msg.base
  const chunks = base ? readChunks(store, run, base.tick) : []
  // A snapshot that isn't all there (it never should be) falls back to the seed.
  if (base && chunks.length !== base.parts) msg = { ...msg, base: null, from: 0 }
  const out = [JSON.stringify(msg)]
  const sent = msg.base
  if (sent) chunks.forEach((data, part) => out.push(JSON.stringify({ t: 'snapPart', tick: sent.tick, part, data } satisfies ServerMessage)))
  // The tail in frames of `TAIL_FRAME_TICKS`, entries spliced in as their JSON.
  const frames: string[][] = []
  for (const [tick, entries] of readLog(store, run, msg.from, msg.to)) (frames[Math.floor((tick - msg.from) / TAIL_FRAME_TICKS)] ??= []).push(`[${tick},${entries}]`)
  for (let from = msg.from, i = 0; from < msg.to; from += TAIL_FRAME_TICKS, i++) {
    const to = Math.min(msg.to, from + TAIL_FRAME_TICKS)
    out.push(`{"t":"frame","from":${from},"to":${to},"ticks":[${(frames[i] ?? []).join(',')}]}`)
  }
  return out
}

/** What a dump is: a desync, a bad snapshot, or a finished run's input log kept for the lab (`run`). */
export type DumpKind = 'desync' | 'badSnap' | 'run'

/** `score`: how laggy a kept run was (`labScore`), 0 for the rest. */
export type DumpInfo = { id: string; code: string; run: number; tick: number; at: number; size: number; kind: DumpKind; score: number }

/** A dump to record: a desync or bad snapshot the room asked for, or a finished run kept for the lab. */
export type DumpRequest = Omit<Extract<Effect, { k: 'dump' }>, 'k' | 'reason'> & { reason: DumpKind }

/** Dumps kept: the newest `max`, none older than `days`, pruned once a day while any are held. */
export const RETENTION = { days: 30, max: 500 } as const

/**
 * A dump's JSON (a desync, a bad snapshot, a kept run): `meta` (room, run
 * start, the hashes reported, seats with builds and user agents, and `extra`),
 * the run's whole input `log` and its `hashes` per seat. Null when the room
 * has no run. Reads the storage at once: a wipe right after empties it.
 */
export const dumpJson = (store: Store, room: Room, e: DumpRequest, at: number, extra: Record<string, unknown> = {}): { body: string; logTicks: number } | null => {
  if (!room.run) return null
  const all = batches(store, e.run)
  const log = [...legacy(store.sql, 'log', e.run), ...all.flatMap((b) => b.l.map(([tick, entries]): [number, string] => [tick, JSON.stringify(entries)]))]
  const hashes = [...legacy(store.sql, 'hashes', e.run), ...all.flatMap((b) => b.h.map(([tick, bySeat]): [number, string] => [tick, JSON.stringify(bySeat)]))]
  const meta = {
    code: room.code,
    build: room.build,
    region: room.region,
    createdAt: room.createdAt,
    at,
    reason: e.reason,
    tick: e.tick,
    reports: e.reports,
    majority: e.majority,
    minority: e.minority,
    run: room.run.start,
    clock: { next: room.run.next, bound: room.run.bound, agreed: room.run.agreed },
    seats: room.seats.map((s) => ({ seat: s.seat, account: s.account, name: s.name, build: s.build, ua: s.ua })),
    ...extra,
  }
  const pairs = (rows: [number, string][]) => rows.map(([t, v]) => `[${t},${v}]`).join(',')
  return { body: `{"meta":${JSON.stringify(meta)},"log":[${pairs(log)}],"hashes":[${pairs(hashes)}]}`, logTicks: log.length }
}
