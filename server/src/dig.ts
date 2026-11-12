import { randomInt } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { DIG_BOX_REPEAT, DIG_FOSSIL_FAMILIES, DIG_FOSSIL_REPEAT, DIG_HALF_REPEAT, DIG_TREASURES, isGalarHalf, type DigPiece, type FossilFamily, type GalarHalf } from '../../src/data/digTreasures'
import { MELTAN } from '../../src/data/legendPaths'
import { PLAYABLE } from '../../src/data/hatchlings'
import type { Deed } from '../../src/data/realmStamps'
import { canPlay, isCaptured } from '../../src/game/capture'
import { brasiliaDay, weekStart, type DayKey } from '../../src/game/day'
import { donateFrom } from '../../src/game/festival'
import type { GiftContent, GiftReason } from '../../src/game/gifts'
import { parseSaveData, type Save } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import { isPlayable } from '../../src/game/ranking'
import type { DigEnd, DigGift, DigHitAnswer, DigReward, DigState, DigWallView } from '../../src/net/realmApi'
import { digDeeds } from '../../src/realm/gameDeeds'
import { buildWall, DIG, digPowers, fossilStreak, hitWall, labHalf, NO_POWERS, sortOut, startProgress, tileAt, treasureFree, wallPrice, type DigPowers, type DigTool, type DigWall } from '../../src/realm/games/dig.rules'
import type { Sql } from './db'
import { sendGift } from './gifts'
import type { EarnDeeds } from './realmDeeds'
import { rateLimiter } from './rateLimit'

/**
 * The Escavação's API side: the server decides everything. It builds the wall
 * from a seed the client never sees and stores it, charges the day's price
 * from the stored save, answers each hit with only the cells it opened and
 * the crack, and pays out in one transaction when the wall ends, through the
 * shared gift path (the client applies those gifts on the spot, so sync stays
 * correct; a client that drops gets them from the gift box at the next sync).
 * A wall that was paid for and never ended stays open for its owner, and a
 * repeated hit or stop reads its stored answer back. A wall's deeds
 * (`digDeeds`) go to the Estampas once its end is stored, only from the
 * request that ended it.
 */

type Q = Sql | TransactionSql

/** A script's limit, never a player's: a wall is a few dozen hits. */
const LIMIT = { n: 300, ms: 60_000 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `POST /realm/dig/start`'s body: the partner walking with the player, and the save revision a paid wall spends from. */
export const parseDigStart = (v: unknown): { base: number | null; partner: string | null } | null => {
  if (!isRecord(v)) return null
  const partner = typeof v.partner === 'string' ? v.partner : null
  if (v.base === undefined || v.base === null) return { base: null, partner }
  return typeof v.base === 'number' && Number.isSafeInteger(v.base) ? { base: v.base, partner } : null
}

/** `POST /realm/dig/hit`'s body. */
export const parseDigHit = (v: unknown): { id: string; seq: number; tool: DigTool; cell: number } | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || !UUID.test(v.id) || typeof v.seq !== 'number' || !Number.isSafeInteger(v.seq) || v.seq < 1) return null
  if ((v.tool !== 'pick' && v.tool !== 'hammer') || typeof v.cell !== 'number' || !Number.isSafeInteger(v.cell) || v.cell < 0 || v.cell >= DIG.cols * DIG.rows) return null
  return { id: v.id, seq: v.seq, tool: v.tool, cell: v.cell }
}

/** `POST /realm/dig/stop`'s body. */
export const parseDigStop = (v: unknown): { id: string } | null => (isRecord(v) && typeof v.id === 'string' && UUID.test(v.id) ? { id: v.id } : null)

/** What's stored with a wall and never leaves the API: the lab's halves as it was built (absent on walls from before the halves). */
type Built = { wall: DigWall; powers: DigPowers; lacking: FossilFamily[]; held?: GalarHalf[] }

type WallRow = { id: string; week: Date | string; seed: number; built: Built; left_layers: number[]; crack: number; seq: number; result: DigEnd | null; ended_at: Date | null }

const dayOf = (v: Date | string): DayKey => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)) as DayKey

/** The wall as its owner sees it: the rock's look, what was already dug out and nothing of what wasn't. */
const viewOf = (r: WallRow): DigWallView => {
  const { wall, powers } = r.built
  return {
    id: r.id,
    week: dayOf(r.week),
    golden: wall.golden,
    pattern: wall.pattern,
    cap: wall.cap,
    powers,
    hint: wall.hint,
    depths: wall.depths,
    left: r.left_layers,
    crack: r.crack,
    seq: r.seq,
    tiles: r.left_layers.flatMap((left, i) => {
      if (left !== 0) return []
      const tile = tileAt(wall, i)
      return tile ? [{ i, left: 0, tile }] : []
    }),
    freed: wall.treasures.flatMap((_, t) => (treasureFree(wall, r.left_layers, t) ? [t] : [])),
  }
}

const usedOn = async (q: Q, userId: string, day: DayKey) => (await q<{ n: number }[]>`select count(*)::int as n from dig_walls where user_id = ${userId} and day = ${day}::date`)[0]?.n ?? 0

const openWall = async (q: Q, userId: string) => (await q<WallRow[]>`select id, week, seed, built, left_layers, crack, seq, result, ended_at from dig_walls where user_id = ${userId} and ended_at is null`)[0] ?? null

const dryOf = async (q: Q, userId: string) => (await q<{ dry: number }[]>`select dry from dig_progress where user_id = ${userId}`)[0]?.dry ?? 0

/** The Galar halves waiting in the account's lab. */
const heldOf = async (q: Q, userId: string): Promise<GalarHalf[]> => ((await q<{ halves: string[] }[]>`select halves from dig_progress where user_id = ${userId}`)[0]?.halves ?? []).filter(isGalarHalf)

/** The fossil families this account has neither hatched nor been sent (a gift on its way counts). */
const lackingOf = async (q: Q, userId: string, save: Save | null) => {
  const sent = await q<{ family: string | null }[]>`select payload->>'family' as family from gifts where user_id = ${userId} and kind in ('family', 'shinyHatch')`
  return DIG_FOSSIL_FAMILIES.filter((family) => save?.hatched[family] === undefined && !sent.some((g) => g.family === family))
}

/** Whether the account still lacks Meltan: not captured in the stored save, and no gift bringing it sent (one on its way counts). */
const lacksMeltan = async (q: Q, userId: string, save: Save | null) => {
  if (save && isCaptured(save.legends, 'meltan')) return false
  const sent = await q<{ n: number }[]>`select count(*)::int as n from gifts where user_id = ${userId} and kind = 'legend' and payload->>'legend' = 'meltan'`
  return (sent[0]?.n ?? 0) === 0
}

/** Whether a new wall holds Meltan's Mystery Box: only while the account lacks Meltan, by chance (`MELTAN.box`), and surely every `MELTAN.boxGuarantee`th wall. */
const boxDue = async (q: Q, userId: string, save: Save | null) => {
  if (!(await lacksMeltan(q, userId, save))) return false
  const walls = (await q<{ n: number }[]>`select count(*)::int as n from dig_walls where user_id = ${userId}`)[0]?.n ?? 0
  return (walls + 1) % MELTAN.boxGuarantee === 0 || randomInt(0, 1_000_000) < MELTAN.box * 1_000_000
}

/** The partner's powers: the one the player walks with, if the stored save may play it, else the save's own. */
const powersFor = (save: Save | null, partner: string | null): DigPowers => {
  if (!save) return NO_POWERS
  const id = partner !== null && isPlayable(partner) && canPlay(save, partner) ? partner : save.partner
  return digPowers(PLAYABLE[id].line[0].types)
}

export type DigRefusal = 'profile' | 'banned' | 'cap' | 'funds' | 'nosave' | 'stale'

export type DigStarted = { ok: true; wall: DigWallView; used: number; paid: { save: Save; revision: number } | null } | { ok: false; error: DigRefusal }

export type DigHitResult = { ok: true; answer: DigHitAnswer } | { ok: false; error: 'profile' | 'banned' | 'missing' | 'seq' | 'empty' | 'over' }

export type DigStopped = { ok: true; end: DigEnd } | { ok: false; error: 'profile' | 'banned' | 'missing' }

/** The deeds of a wall that just ended (`digDeeds`). */
const deedsOf = (row: WallRow, end: DigEnd) => digDeeds(row.built.wall.golden, end.kept.map((r) => r.id))

export const digStore = (sql: Sql, deps: { closed: (q: Q, userId: string) => Promise<boolean>; earn: EarnDeeds; now?: () => Date }) => {
  const now = deps.now ?? (() => new Date())
  const limit = rateLimiter(LIMIT.n, LIMIT.ms)
  const today = () => brasiliaDay(now())

  /** Who may play now: a @handle and no ban. Locks the account, so its hits take turns. */
  const gate = async (tx: TransactionSql, userId: string): Promise<'profile' | 'banned' | null> => {
    const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
    if (!user?.handle) return 'profile'
    return (await deps.closed(tx, userId)) ? 'banned' : null
  }

  /**
   * Ends a wall: every treasure dug out completely goes to its owner, in this
   * one transaction. Gifts carry a key per wall and treasure, so a retry can't
   * pay twice; a lacked fossil is a family (the rest pay ₽), Meltan's
   * Mystery Box is Meltan while the account lacks it, furniture goes straight
   * in, a Galar half meets the lab (`labHalf`: a family with the half waiting
   * there, a place in the lab, or ₽), and the dry streak moves (`fossilStreak`).
   */
  const finish = async (tx: TransactionSql, userId: string, row: WallRow, left: number[], outcome: DigEnd['outcome']): Promise<DigEnd> => {
    const { wall, lacking } = row.built
    const sorted = sortOut(wall, left)
    const [stored] = await tx<{ data: unknown }[]>`select data from saves where user_id = ${userId}`
    const still = new Set<FossilFamily>(await lackingOf(tx, userId, stored ? parseSaveData(stored.data) : null))
    let held = await heldOf(tx, userId)
    const keys: string[] = []
    const kept: DigReward[] = []
    for (const [i, t] of sorted.kept.entries()) {
      const def = DIG_TREASURES[t.id]
      const prize = def.prize
      const send = async (content: GiftContent) => {
        const key = `dig:${row.id}:${i}`
        keys.push(key)
        await sendGift(tx, userId, content, { kind: 'season', way: 'dig' }, key)
      }
      if (prize.kind === 'furniture') {
        await tx`
          insert into furniture_owned (user_id, furniture, source, count) values (${userId}, ${prize.piece satisfies DigPiece}, 'dig', 1)
          on conflict (user_id, furniture, source) do update set count = furniture_owned.count + 1`
        kept.push({ id: t.id, prize, repeat: false, coins: 0 })
        continue
      }
      if (prize.kind === 'legend') {
        // Meltan's Mystery Box: Meltan for an account still without it, ₽ for one that has it by now.
        const fresh = await lacksMeltan(tx, userId, stored ? parseSaveData(stored.data) : null)
        const key = `dig:${row.id}:${i}`
        keys.push(key)
        await sendGift(tx, userId, fresh ? { kind: 'legend', legend: prize.legend } : { kind: 'coins', amount: DIG_BOX_REPEAT }, fresh ? { kind: 'path', path: 'meltan' } : { kind: 'season', way: 'dig' }, key)
        kept.push({ id: t.id, prize, repeat: !fresh, coins: fresh ? 0 : DIG_BOX_REPEAT })
        continue
      }
      if (prize.kind === 'fossil') {
        const fresh = still.delete(prize.family)
        await send(fresh ? { kind: 'family', family: prize.family } : { kind: 'coins', amount: DIG_FOSSIL_REPEAT })
        kept.push({ id: t.id, prize, repeat: !fresh, coins: fresh ? 0 : DIG_FOSSIL_REPEAT })
        continue
      }
      if (prize.kind === 'half') {
        const lab = labHalf(prize.half, held, [...still])
        held = lab.held
        if (lab.kind === 'restored') {
          still.delete(lab.family)
          await send({ kind: 'family', family: lab.family })
          kept.push({ id: t.id, prize, repeat: false, coins: 0, restored: lab.family })
        } else if (lab.kind === 'stored') kept.push({ id: t.id, prize, repeat: false, coins: 0, stored: true })
        else {
          await send({ kind: 'coins', amount: DIG_HALF_REPEAT })
          kept.push({ id: t.id, prize, repeat: true, coins: DIG_HALF_REPEAT })
        }
        continue
      }
      await send(prize.kind === 'coins' ? { kind: 'coins', amount: prize.amount } : prize.kind === 'bag' ? { kind: 'bag', item: prize.item, count: 1 } : { kind: 'evoItem', item: prize.item })
      kept.push({ id: t.id, prize, repeat: false, coins: prize.kind === 'coins' ? prize.amount : 0 })
    }
    const gifts = keys.length === 0 ? [] : await tx<{ id: string; kind: string; payload: unknown; reason: unknown; created_at: Date }[]>`select id, kind, payload, reason, created_at from gifts where user_id = ${userId} and key = any(${keys}::text[])`
    const out: DigGift[] = gifts.map((g) => ({ id: g.id, content: g.payload as GiftContent, reason: g.reason as GiftReason | null, at: g.created_at.toISOString() }))
    const dry = fossilStreak(await dryOf(tx, userId), wall, left, lacking, row.built.held)
    await tx`insert into dig_progress (user_id, dry, halves) values (${userId}, ${dry}, ${held}) on conflict (user_id) do update set dry = ${dry}, halves = ${held}`
    const end: DigEnd = { outcome, kept, buried: sorted.buried, treasures: wall.treasures, gifts: out, dry }
    await tx`update dig_walls set ended_at = now(), outcome = ${outcome}, left_layers = ${tx.json(left)}, result = ${tx.json(end)} where id = ${row.id}::uuid`
    console.log(`dig: ${userId} ${outcome}, kept ${sorted.kept.length}/${wall.treasures.length}`)
    return end
  }

  return {
    /** Counts a call against the account's limit; false past it. */
    take: (userId: string) => limit.take([userId], now().getTime()),

    /** `GET /realm/dig`: the mine as this account sees it, the open wall included. Null without a @handle. */
    state: async (userId: string): Promise<DigState | null> => {
      const [user] = await sql<{ handle: string | null }[]>`select handle from users where id = ${userId}`
      if (!user?.handle) return null
      const day = today()
      const [stored] = await sql<{ data: unknown }[]>`select data from saves where user_id = ${userId}`
      const lacking = await lackingOf(sql, userId, stored ? parseSaveData(stored.data) : null)
      const open = await openWall(sql, userId)
      return { week: open ? dayOf(open.week) : weekStart(day), used: await usedOn(sql, userId, day), dry: await dryOf(sql, userId), lacking, held: await heldOf(sql, userId), open: open ? viewOf(open) : null }
    },

    /**
     * `POST /realm/dig/start`: a wall. One already open comes back uncharged.
     * Otherwise the day's price is charged, a paid one from the stored save at
     * revision `base`, and the wall is built and stored. The partner is
     * checked against that save.
     */
    start: (userId: string, base: number | null, partner: string | null): Promise<DigStarted> =>
      sql.begin(async (tx): Promise<DigStarted> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const day = today()
        const used = await usedOn(tx, userId, day)
        const [row] = await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
        const open = await openWall(tx, userId)
        if (open) return { ok: true, wall: viewOf(open), used, paid: base !== null && row ? { save: parseSaveData(row.data), revision: row.revision } : null }
        const price = wallPrice(used)
        if (price === null) return { ok: false, error: 'cap' }
        let paid: { save: Save; revision: number } | null = null
        const saved = row ? parseSaveData(row.data) : null
        if (price > 0) {
          if (base === null) return { ok: false, error: 'stale' }
          if (!row || !saved) return { ok: false, error: 'nosave' }
          if (base !== row.revision) return { ok: false, error: 'stale' }
          if (saved.wallet < price) return { ok: false, error: 'funds' }
          const next = donateFrom(saved, price)
          const revision = row.revision + 1
          await tx`update saves set version = ${next.version}, revision = ${revision}, data = ${tx.json(next)}, updated_at = now() where user_id = ${userId}`
          paid = { save: next, revision }
        }
        const week = weekStart(day)
        const seed = randomInt(1, 2 ** 31)
        const lacking = await lackingOf(tx, userId, saved)
        const dry = await dryOf(tx, userId)
        const powers = powersFor(saved, partner)
        const box = await boxDue(tx, userId, saved)
        const held = await heldOf(tx, userId)
        const wall = buildWall(seed, { week, powers, lacking, held, due: dry >= DIG.fossilGuarantee, box })
        const built: Built = { wall, powers, lacking, held }
        const [inserted] = await tx<WallRow[]>`
          insert into dig_walls (user_id, day, week, seed, price, built, left_layers)
          values (${userId}, ${day}::date, ${week}::date, ${seed}, ${price}, ${tx.json(built)}, ${tx.json(startProgress(wall).left)})
          returning id, week, seed, built, left_layers, crack, seq, result, ended_at`
        return { ok: true, wall: viewOf(inserted!), used: used + 1, paid }
      }),

    /**
     * `POST /realm/dig/hit`: one hit, numbered. A number already answered gets
     * that answer back; anything but the next one is refused. The hit that
     * fills the crack ends the wall in the same transaction, and its deeds
     * follow.
     */
    hit: async (userId: string, id: string, seq: number, tool: DigTool, cell: number): Promise<DigHitResult> => {
      let deeds: ReadonlyMap<Deed, number> = new Map()
      const result = await sql.begin(async (tx): Promise<DigHitResult> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const [row] = await tx<WallRow[]>`select id, week, seed, built, left_layers, crack, seq, result, ended_at from dig_walls where id = ${id}::uuid and user_id = ${userId} for update`
        if (!row) return { ok: false, error: 'missing' }
        if (seq <= row.seq) {
          const [stored] = await tx<{ answer: DigHitAnswer }[]>`select answer from dig_hits where wall_id = ${id}::uuid and seq = ${seq}`
          return stored ? { ok: true, answer: stored.answer } : { ok: false, error: 'seq' }
        }
        if (row.ended_at) return { ok: false, error: 'over' }
        if (seq !== row.seq + 1) return { ok: false, error: 'seq' }
        const hit = hitWall(row.built.wall, { left: row.left_layers, crack: row.crack }, tool, cell, row.built.powers)
        if (!hit) return { ok: false, error: 'empty' }
        const end = hit.collapsed ? await finish(tx, userId, row, hit.progress.left, 'collapse') : null
        if (end) deeds = deedsOf(row, end)
        const answer: DigHitAnswer = { seq, cells: hit.cells, crack: hit.progress.crack, freed: hit.freed, end }
        await tx`insert into dig_hits (wall_id, seq, answer) values (${id}::uuid, ${seq}, ${tx.json(answer)})`
        await tx`update dig_walls set left_layers = ${tx.json(hit.progress.left)}, crack = ${hit.progress.crack}, seq = ${seq} where id = ${id}::uuid`
        return { ok: true, answer }
      })
      if (deeds.size > 0) await deps.earn(userId, deeds)
      return result
    },

    /** `POST /realm/dig/stop`: leaves with what's dug out, and the wall's deeds follow. A wall already ended answers its stored end and counts nothing. */
    stop: async (userId: string, id: string): Promise<DigStopped> => {
      let deeds: ReadonlyMap<Deed, number> = new Map()
      const stopped = await sql.begin(async (tx): Promise<DigStopped> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const [row] = await tx<WallRow[]>`select id, week, seed, built, left_layers, crack, seq, result, ended_at from dig_walls where id = ${id}::uuid and user_id = ${userId} for update`
        if (!row) return { ok: false, error: 'missing' }
        if (row.ended_at && row.result) return { ok: true, end: row.result }
        const end = await finish(tx, userId, row, row.left_layers, 'stopped')
        deeds = deedsOf(row, end)
        return { ok: true, end }
      })
      if (deeds.size > 0) await deps.earn(userId, deeds)
      return stopped
    },
  }
}

export type DigStore = ReturnType<typeof digStore>
