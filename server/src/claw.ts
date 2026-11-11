import { randomInt } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { PLUSH_POOL, plushPiece, type PlushFamily } from '../../src/data/plushes'
import type { Deed } from '../../src/data/realmStamps'
import { brasiliaDay, weekStart, type DayKey } from '../../src/game/day'
import { donateFrom } from '../../src/game/festival'
import { parseSaveData, type Save } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import type { ClawDropped, ClawPlay, ClawState } from '../../src/net/realmApi'
import { clawDeeds } from '../../src/realm/gameDeeds'
import { CLAW, clampToPit, creditPrice, pitLayout, resolveDrop, weeklyPrizes, type PitPoint } from '../../src/realm/games/claw.rules'
import type { Sql } from './db'
import type { EarnDeeds } from './realmDeeds'
import { rateLimiter } from './rateLimit'

/**
 * The Máquina de Pelúcias' API side: the server decides. A credit is charged
 * here (free or out of the stored save, like the carpentry) and gets a seed;
 * a drop is recomputed here from that seed, the player's claw position and the
 * misses this account has on each plush (`claw.rules.ts`). The client only
 * animates the answer. A credit paid and never dropped stays open for its
 * owner, and a repeated drop reads the stored result back. A win's deeds
 * (`clawDeeds`) go to the Estampas once the drop is stored, only from the
 * drop that decided it.
 */

type Q = Sql | TransactionSql

const LIMIT = { n: 40, ms: 60_000 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `POST /realm/claw/insert`'s body: the save revision it spends from, when it's a paid credit. */
export const parseClawInsert = (v: unknown): { base: number | null } | null => {
  if (!isRecord(v)) return null
  if (v.base === undefined || v.base === null) return { base: null }
  return typeof v.base === 'number' && Number.isSafeInteger(v.base) ? { base: v.base } : null
}

/** `POST /realm/claw/drop`'s body: the credit and where the claw came down, held inside the pit. */
export const parseClawDrop = (v: unknown): { id: string; at: PitPoint } | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || !UUID.test(v.id) || typeof v.x !== 'number' || typeof v.y !== 'number' || !Number.isFinite(v.x) || !Number.isFinite(v.y)) return null
  return { id: v.id, at: clampToPit({ x: v.x, y: v.y }) }
}

const prizesOf = (week: DayKey) => weeklyPrizes(week, PLUSH_POOL)

type PlayRow = { id: string; seed: number; week: Date | string; result: unknown; dropped_at: Date | null }

/** A `date` column as a day key, whichever way the driver brought it. */
const dayOf = (v: Date | string): DayKey => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)) as DayKey

const toPlay = (r: PlayRow): ClawPlay => ({ id: r.id, seed: r.seed, week: dayOf(r.week) })

const missesOn = async (q: Q, userId: string, prizes: readonly PlushFamily[]) => {
  const rows = await q<{ family: string; misses: number }[]>`select family, misses from claw_progress where user_id = ${userId} and family = any(${[...prizes]}::text[])`
  return prizes.map((f) => rows.find((r) => r.family === f)?.misses ?? 0)
}

const usedOn = async (q: Q, userId: string, day: DayKey) => (await q<{ n: number }[]>`select count(*)::int as n from claw_plays where user_id = ${userId} and day = ${day}::date`)[0]?.n ?? 0

const openPlay = async (q: Q, userId: string) => (await q<PlayRow[]>`select id, seed, week, result, dropped_at from claw_plays where user_id = ${userId} and dropped_at is null`)[0] ?? null

export type ClawRefusal = 'profile' | 'banned' | 'cap' | 'funds' | 'nosave' | 'stale'

export type ClawInserted = { ok: true; play: ClawPlay; used: number; paid: { save: Save; revision: number } | null } | { ok: false; error: ClawRefusal }

export type ClawDrop = { ok: true; dropped: ClawDropped } | { ok: false; error: 'profile' | 'banned' | 'missing' }

export const clawStore = (sql: Sql, deps: { closed: (q: Q, userId: string) => Promise<boolean>; earn: EarnDeeds; now?: () => Date }) => {
  const now = deps.now ?? (() => new Date())
  const limit = rateLimiter(LIMIT.n, LIMIT.ms)
  const today = () => brasiliaDay(now())

  /** Who may play now: a @handle and no ban. Locks the account, so its credits take turns. */
  const gate = async (tx: TransactionSql, userId: string): Promise<'profile' | 'banned' | null> => {
    const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
    if (!user?.handle) return 'profile'
    return (await deps.closed(tx, userId)) ? 'banned' : null
  }

  return {
    /** Counts a call against the account's limit; false past it (a script's, never a player's). */
    take: (userId: string) => limit.take([userId], now().getTime()),

    /** `GET /realm/claw`: the machine as this account sees it, on the open credit's week if one waits. Null without a @handle. */
    state: async (userId: string): Promise<ClawState | null> => {
      const [user] = await sql<{ handle: string | null }[]>`select handle from users where id = ${userId}`
      if (!user?.handle) return null
      const day = today()
      const open = await openPlay(sql, userId)
      const week = open ? dayOf(open.week) : weekStart(day)
      const prizes = prizesOf(week)
      return { week, prizes, misses: await missesOn(sql, userId, prizes), used: await usedOn(sql, userId, day), open: open ? toPlay(open) : null }
    },

    /**
     * `POST /realm/claw/insert`: a credit. One already open comes back
     * uncharged. Otherwise the day's price (`creditPrice`) is charged, a paid
     * one out of the stored save at revision `base` (moved to `spent`, so a
     * merge never refunds it), and the credit gets its seed.
     */
    insert: (userId: string, base: number | null): Promise<ClawInserted> =>
      sql.begin(async (tx): Promise<ClawInserted> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const day = today()
        const used = await usedOn(tx, userId, day)
        const [row] = base === null ? [] : await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
        const open = await openPlay(tx, userId)
        if (open) return { ok: true, play: toPlay(open), used, paid: row ? { save: parseSaveData(row.data), revision: row.revision } : null }
        const price = creditPrice(used)
        if (price === null) return { ok: false, error: 'cap' }
        let paid: { save: Save; revision: number } | null = null
        if (price > 0) {
          if (base === null) return { ok: false, error: 'stale' }
          if (!row) return { ok: false, error: 'nosave' }
          if (base !== row.revision) return { ok: false, error: 'stale' }
          const save = parseSaveData(row.data)
          if (save.wallet < price) return { ok: false, error: 'funds' }
          const next = donateFrom(save, price)
          const revision = row.revision + 1
          await tx`update saves set version = ${next.version}, revision = ${revision}, data = ${tx.json(next)}, updated_at = now() where user_id = ${userId}`
          paid = { save: next, revision }
        }
        const week = weekStart(day)
        const seed = randomInt(1, 2 ** 31)
        const [play] = await tx<PlayRow[]>`insert into claw_plays (user_id, day, week, seed, price) values (${userId}, ${day}::date, ${week}::date, ${seed}, ${price}) returning id, seed, week, result, dropped_at`
        return { ok: true, play: toPlay(play!), used: used + 1, paid }
      }),

    /**
     * `POST /realm/claw/drop`: decides the credit from its seed and `at`. A
     * miss moves that plush one step toward the chute; a win starts it over
     * and gives the piece (source `claw`). Then the win's deeds, from this
     * drop only: a repeat reads the stored result and counts nothing.
     */
    drop: async (userId: string, id: string, at: PitPoint): Promise<ClawDrop> => {
      let deeds: ReadonlyMap<Deed, number> = new Map()
      const drop = await sql.begin(async (tx): Promise<ClawDrop> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const [play] = await tx<PlayRow[]>`select id, seed, week, result, dropped_at from claw_plays where id = ${id}::uuid and user_id = ${userId}`
        if (!play) return { ok: false, error: 'missing' }
        if (play.dropped_at) return { ok: true, dropped: play.result as ClawDropped }
        const prizes = prizesOf(dayOf(play.week))
        const misses = await missesOn(tx, userId, prizes)
        const { target, grip, won } = resolveDrop(at, pitLayout(dayOf(play.week), misses, play.seed), misses)
        const family = prizes[target]!
        await tx`
          insert into claw_progress (user_id, family, misses, wins) values (${userId}, ${family}, ${won ? 0 : 1}, ${won ? 1 : 0})
          on conflict (user_id, family) do update set misses = ${won ? 0 : (misses[target] ?? 0) + 1}, wins = claw_progress.wins + ${won ? 1 : 0}`
        if (won) {
          await tx`
            insert into furniture_owned (user_id, furniture, source, count) values (${userId}, ${plushPiece(family)}, 'claw', 1)
            on conflict (user_id, furniture, source) do update set count = furniture_owned.count + 1`
          console.log(`claw: ${userId} won ${family}`)
        }
        const after = misses.map((m, i) => (i !== target ? m : won ? 0 : Math.min(m + 1, CLAW.guarantee - 1)))
        const dropped: ClawDropped = { target, grip, won, family, misses: after }
        await tx`update claw_plays set dropped_at = now(), result = ${tx.json(dropped)} where id = ${play.id}::uuid`
        deeds = clawDeeds(won, misses[target] ?? 0)
        return { ok: true, dropped }
      })
      if (deeds.size > 0) await deps.earn(userId, deeds)
      return drop
    },
  }
}

export type ClawStore = ReturnType<typeof clawStore>
