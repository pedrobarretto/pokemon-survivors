import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync, type StatementSync } from 'node:sqlite'
import type { Room } from '../../src/room'
import { parseRoom, parseStored, type DumpInfo, type Lazy, type Store } from '../../src/store'

/**
 * SQLite on the `/data` volume, through `node:sqlite` (synchronous: a write
 * is a few microseconds, so a room persists what it asks before it sends,
 * like the Durable Object). One file per room (`rooms/<CODE>.db`, its
 * table `kv` holding the room and the lazy keys, `store.ts`) and one for the
 * dumps (`vault.db`). WAL with `synchronous = NORMAL`: a committed write
 * survives the process dying (a crash, `kill -9`, a deploy); only losing the
 * machine itself can cost the last moments, which the room's clock bound
 * covers.
 */

/** A room's database: its storage, the room it holds (`readRoom`, null for none), transactions, close and delete. */
export type RoomDb = { store: Store; readRoom: () => Room | null; tx: (fn: () => void) => void; close: () => void; remove: () => void }

type Bind = string | number | null

/** One SQLite file: `run` for writes, `all` for reads (rows as the driver gives them). */
type Sql = {
  run: (query: string, ...args: Bind[]) => void
  all: (query: string, ...args: Bind[]) => Record<string, unknown>[]
}

const open = (path: string) => {
  const db = new DatabaseSync(path)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA synchronous = NORMAL')
  db.exec('PRAGMA busy_timeout = 1000')
  const statements = new Map<string, StatementSync>()
  const statement = (query: string) => {
    let s = statements.get(query)
    if (!s) {
      s = db.prepare(query)
      statements.set(query, s)
    }
    return s
  }
  const sql: Sql = {
    run: (query, ...args) => void statement(query).run(...args),
    all: (query, ...args) => statement(query).all(...args),
  }
  return { db, sql }
}

/**
 * The lazy keys (`store.ts`) as rows of the room's `kv`, values as JSON: here
 * they are written in the same transaction as the room, before anything goes
 * out (a local commit takes microseconds), and read back in key order.
 */
const lazyOf = (sql: Sql): Lazy => ({
  put: (key, value) => sql.run('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)', key, JSON.stringify(value)),
  delete: (keys) => keys.forEach((k) => sql.run('DELETE FROM kv WHERE k = ?', k)),
  // Keys are ASCII: every key under `prefix` sorts below `prefix` + U+FFFF.
  list: (prefix, { start, reverse = false, limit = -1 } = {}) =>
    sql
      .all(`SELECT k, v FROM kv WHERE k >= ? AND k < ? ORDER BY k ${reverse ? 'DESC' : 'ASC'} LIMIT ?`, start !== undefined && start > prefix ? start : prefix, `${prefix}\uffff`, limit)
      .flatMap((r) => {
        const v = typeof r.k === 'string' && typeof r.v === 'string' ? parseStored(r.v) : null
        return v === null ? [] : [[String(r.k), v] as [string, typeof v]]
      }),
})

const roomsDir = (dataDir: string) => join(dataDir, 'rooms')

/**
 * Makes this process the only one using `dataDir`: an exclusive SQLite lock
 * on `relay.lock`, held until `release` or the process dying (the OS lets go
 * then, `kill -9` included). A second container on the same volume (a deploy
 * that starts the new one before the old one stops) waits here instead of
 * loading rooms the other one is still running.
 */
export const lockDataDir = async (dataDir: string, onWait: () => void): Promise<{ release: () => void }> => {
  mkdirSync(dataDir, { recursive: true })
  for (let waited = false; ; waited = true) {
    const db = new DatabaseSync(join(dataDir, 'relay.lock'))
    try {
      db.exec('PRAGMA locking_mode = EXCLUSIVE')
      db.exec('BEGIN EXCLUSIVE')
      return { release: () => db.close() }
    } catch {
      db.close()
      if (!waited) onWait()
      await new Promise((r) => setTimeout(r, 250))
    }
  }
}

/** The codes of the rooms on disk (each one's file). */
export const roomCodes = (dataDir: string) => {
  mkdirSync(roomsDir(dataDir), { recursive: true })
  return readdirSync(roomsDir(dataDir)).flatMap((f) => (/^[A-Z0-9]+\.db$/.test(f) ? [f.slice(0, -3)] : []))
}

/** Room `code`'s database (made if missing): one table, `kv`, the room as its row `room`. */
export const openRoomDb = (dataDir: string, code: string): RoomDb => {
  mkdirSync(roomsDir(dataDir), { recursive: true })
  const path = join(roomsDir(dataDir), `${code}.db`)
  const { db, sql } = open(path)
  db.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)')
  let closed = false
  const close = () => {
    if (!closed) db.close()
    closed = true
  }
  return {
    store: { lazy: lazyOf(sql), saveRoom: (json) => sql.run("INSERT OR REPLACE INTO kv (k, v) VALUES ('room', ?)", json) },
    readRoom: () => {
      const v = sql.all("SELECT v FROM kv WHERE k = 'room'")[0]?.v
      return typeof v === 'string' ? parseRoom(v) : null
    },
    tx: (fn) => {
      db.exec('BEGIN')
      try {
        fn()
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
    close,
    // The room is over: its file goes, with the WAL beside it.
    remove: () => {
      close()
      for (const suffix of ['', '-wal', '-shm']) rmSync(path + suffix, { force: true })
    },
  }
}

export type Vault = {
  put: (info: DumpInfo, bytes: Uint8Array) => void
  list: (limit: number) => DumpInfo[]
  get: (id: string) => Uint8Array | null
  /** Drops dumps older than `days` or past the newest `max`. */
  prune: (now: number, keep: { days: number; max: number }) => void
  close: () => void
}

const isDumpInfo = (r: Record<string, unknown>): r is DumpInfo =>
  typeof r.id === 'string' && typeof r.code === 'string' && typeof r.run === 'number' && typeof r.tick === 'number' && typeof r.at === 'number' && typeof r.size === 'number' && ['desync', 'badSnap', 'run'].includes(String(r.kind)) && typeof r.score === 'number'

/** Desync dumps, kept after their room is gone (the Durable Object `Vault`'s twin). */
export const openVault = (dataDir: string): Vault => {
  mkdirSync(dataDir, { recursive: true })
  const { db, sql } = open(join(dataDir, 'vault.db'))
  db.exec('CREATE TABLE IF NOT EXISTS dumps (id TEXT PRIMARY KEY, code TEXT NOT NULL, run INTEGER NOT NULL, tick INTEGER NOT NULL, at INTEGER NOT NULL, size INTEGER NOT NULL, data BLOB NOT NULL)')
  // Vaults made before dumps had a kind: theirs are all desyncs or bad snapshots.
  for (const column of ["kind TEXT NOT NULL DEFAULT 'desync'", 'score REAL NOT NULL DEFAULT 0']) {
    try {
      db.exec(`ALTER TABLE dumps ADD COLUMN ${column}`)
    } catch {
      // The column is there already.
    }
  }
  return {
    put: (info, bytes) =>
      void db
        .prepare('INSERT OR REPLACE INTO dumps (id, code, run, tick, at, size, kind, score, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(info.id, info.code, info.run, info.tick, info.at, info.size, info.kind, info.score, bytes),
    list: (limit) => sql.all('SELECT id, code, run, tick, at, size, kind, score FROM dumps ORDER BY at DESC LIMIT ?', limit).filter(isDumpInfo),
    get: (id) => {
      const data = sql.all('SELECT data FROM dumps WHERE id = ?', id)[0]?.data
      return data instanceof Uint8Array ? data : null
    },
    prune: (now, keep) =>
      sql.run('DELETE FROM dumps WHERE at < ? OR id NOT IN (SELECT id FROM dumps ORDER BY at DESC LIMIT ?)', now - keep.days * 86_400_000, keep.max),
    close: () => db.close(),
  }
}
