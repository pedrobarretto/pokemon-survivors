import { randomInt } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { PLAYABLE } from '../../src/data/hatchlings'
import { SAFARI_HABITAT_IDS, SAFARI_ONLY, habitatPool, isSafariHabitat, lackingFamilies, type SafariHabitat } from '../../src/data/safari'
import { brasiliaDay, weekStart, type DayKey } from '../../src/game/day'
import { donateFrom } from '../../src/game/festival'
import type { Gift, GiftContent, GiftReason } from '../../src/game/gifts'
import { parseSaveData, type Save } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import type { HatchlingId } from '../../src/data/hatchlings'
import type { SafariActed, SafariSession, SafariState } from '../../src/net/realmApi'
import { SAFARI, applyAction, encountersLeft, guaranteedEntry, habitatOfWeek, rollQueue, sessionPrice, startRun, type SafariAction, type SafariRun, type SafariTurn } from '../../src/realm/games/safari.rules'
import type { Sql } from './db'
import { sendGift } from './gifts'
import { rateLimiter } from './rateLimit'

/**
 * The Zona Safári's API side: the server rolls everything. A session is
 * charged here (free or out of the stored save, like the claw), its encounters
 * are rolled here and kept here: a client learns one only when it reports a
 * rustle in the tall grass, and the next in line comes whatever it walked, so
 * walking can't pick or re-roll one. A session paid for and never finished
 * stays open for its owner; repeating an action (`turn`) reads the stored
 * answer back.
 */

type Q = Sql | TransactionSql

/** Enough for a whole session's worth of actions in a minute, not a script's. */
const LIMIT = { n: 60, ms: 60_000 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const ACTIONS: readonly SafariAction['kind'][] = ['grass', 'ball', 'berry', 'leave', 'finish']

/** A uniform roll from the OS's generator, the shape the rules take. */
const roll = () => randomInt(0, 2 ** 32) / 2 ** 32

/** `POST /realm/safari/start`'s body: the save revision it spends from, when the session is paid. */
export const parseSafariStart = (v: unknown): { base: number | null } | null => {
  if (!isRecord(v)) return null
  if (v.base === undefined || v.base === null) return { base: null }
  return typeof v.base === 'number' && Number.isSafeInteger(v.base) ? { base: v.base } : null
}

/** `POST /realm/safari/act`'s body: the session, how many turns the client has seen and what it does. */
export const parseSafariAct = (v: unknown): { id: string; turn: number; action: SafariAction } | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || !UUID.test(v.id) || typeof v.turn !== 'number' || !Number.isSafeInteger(v.turn) || v.turn < 0) return null
  const kind = ACTIONS.find((a) => a === v.action)
  return kind ? { id: v.id, turn: v.turn, action: { kind } } : null
}

/** What's stored of a turn: the answer as given, gift included, so a repeat reads the same. */
type StoredTurn = { turn: SafariTurn<HatchlingId>; gift: Gift | null }

/** A session's jsonb: the run, each turn's answer, and whether a new family came (the guarantee's count). */
type Stored = { run: SafariRun<HatchlingId>; log: StoredTurn[]; fresh: boolean }

type SessionRow = { id: string; week: Date | string; habitat: string; state: Stored; finished_at: Date | null }

/** A `date` column as a day key, whichever way the driver brought it. */
const dayOf = (v: Date | string): DayKey => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)) as DayKey

const habitatFor = (row: SessionRow): SafariHabitat => (isSafariHabitat(row.habitat) ? row.habitat : SAFARI_HABITAT_IDS[0]!)

/** A session as its owner sees it: how many encounters are left, never who. */
const viewOf = (row: SessionRow): SafariSession => {
  const { run, log } = row.state
  return {
    id: row.id,
    week: dayOf(row.week),
    habitat: habitatFor(row),
    balls: run.balls,
    berries: run.berries,
    left: encountersLeft(run),
    sureNext: run.queue[run.met]?.sure ?? false,
    encounter: run.encounter && { family: run.encounter.family, shiny: run.encounter.shiny, calm: run.encounter.calm, sure: run.encounter.sure },
    catches: [...run.catches],
    over: run.over,
    turn: log.length,
  }
}

const usedOn = async (q: Q, userId: string, day: DayKey) => (await q<{ n: number }[]>`select count(*)::int as n from safari_sessions where user_id = ${userId} and day = ${day}::date`)[0]?.n ?? 0

const openSession = async (q: Q, userId: string) => (await q<SessionRow[]>`select id, week, habitat, state, finished_at from safari_sessions where user_id = ${userId} and finished_at is null`)[0] ?? null

const dryOf = async (q: Q, userId: string) => (await q<{ dry: number }[]>`select dry from safari_progress where user_id = ${userId}`)[0]?.dry ?? 0

const saveOf = async (q: Q, userId: string): Promise<Save | null> => {
  const [row] = await q<{ data: unknown }[]>`select data from saves where user_id = ${userId}`
  return row ? parseSaveData(row.data) : null
}

/** The families gifted to the account that the save may not hold yet (a family or shiny gift not opened or not synced), so the guarantee doesn't bring one twice. */
const giftedFamilies = async (q: Q, userId: string) => (await q<{ family: string }[]>`select payload->>'family' as family from gifts where user_id = ${userId} and kind in ('family', 'shinyHatch')`).map((r) => r.family)

/** The partner the API goes by: the stored save's, never the client's word. */
const partnerOf = (save: Save | null) => (save && Object.hasOwn(PLAYABLE, save.partner) ? save.partner : null)

const partnerTypes = (save: Save | null): readonly string[] => {
  const partner = partnerOf(save)
  return partner ? PLAYABLE[partner].line[0].types : []
}

export type SafariRefusal = 'profile' | 'banned' | 'cap' | 'funds' | 'nosave' | 'stale'

export type SafariStarted = { ok: true; session: SafariSession; used: number; paid: { save: Save; revision: number } | null } | { ok: false; error: SafariRefusal }

export type SafariActResult = { ok: true; acted: SafariActed } | { ok: false; error: 'profile' | 'banned' | 'missing' | 'stale' | 'illegal' }

export const safariStore = (sql: Sql, deps: { closed: (q: Q, userId: string) => Promise<boolean>; now?: () => Date; dice?: () => number }) => {
  const now = deps.now ?? (() => new Date())
  const dice = deps.dice ?? roll
  const limit = rateLimiter(LIMIT.n, LIMIT.ms)
  const today = () => brasiliaDay(now())

  /** Who may play now: a @handle and no ban. Locks the account, so its sessions take turns. */
  const gate = async (tx: TransactionSql, userId: string): Promise<'profile' | 'banned' | null> => {
    const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
    if (!user?.handle) return 'profile'
    return (await deps.closed(tx, userId)) ? 'banned' : null
  }

  /** The guarantee's family for an account `dry` sessions without a new one, or null (not there yet, or nothing left to get). */
  const sureFor = async (q: Q, userId: string, dry: number, save: Save | null) => {
    if (dry < SAFARI.guarantee) return null
    return guaranteedEntry(lackingFamilies(save?.hatched ?? {}, await giftedFamilies(q, userId)), SAFARI_ONLY, dice)
  }

  /** Sends a catch's prize: a shiny hatch or the family, either way through the gift path, under a key of its own. */
  const giftFor = async (tx: TransactionSql, userId: string, session: string, n: number, family: HatchlingId, shiny: boolean): Promise<Gift | null> => {
    const content: GiftContent = shiny ? { kind: 'shinyHatch', family } : { kind: 'family', family }
    const reason: GiftReason = { kind: 'season', way: 'safari' }
    const key = `safari:${session}:${n}`
    await sendGift(tx, userId, content, reason, key)
    const [row] = await tx<{ id: string }[]>`select id from gifts where user_id = ${userId} and key = ${key}`
    return row ? { id: row.id, content, reason } : null
  }

  return {
    /** Counts a call against the account's limit; false past it (a script's, never a player's). */
    take: (userId: string) => limit.take([userId], now().getTime()),

    /** `GET /realm/safari`: the week's habitat as this account sees it, on the open session's week if one waits. Null without a @handle. */
    state: async (userId: string): Promise<SafariState | null> => {
      const [user] = await sql<{ handle: string | null }[]>`select handle from users where id = ${userId}`
      if (!user?.handle) return null
      const day = today()
      const open = await openSession(sql, userId)
      const week = open ? dayOf(open.week) : weekStart(day)
      const save = await saveOf(sql, userId)
      const dry = await dryOf(sql, userId)
      const sure = dry >= SAFARI.guarantee && lackingFamilies(save?.hatched ?? {}, await giftedFamilies(sql, userId)).length > 0
      return { week, habitat: open ? habitatFor(open) : habitatOfWeek(week, SAFARI_HABITAT_IDS), used: await usedOn(sql, userId, day), dry, sure, partner: partnerOf(save), open: open ? viewOf(open) : null }
    },

    /**
     * `POST /realm/safari/start`: a session. One already open comes back
     * uncharged. Otherwise the day's price is charged, a paid one out of the
     * stored save at revision `base` (moved to `spent`, so a merge never
     * refunds it), and its encounters are rolled: the partner's type weighed
     * in from the stored save, the guarantee's family first if it's due.
     */
    start: (userId: string, base: number | null): Promise<SafariStarted> =>
      sql.begin(async (tx): Promise<SafariStarted> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const day = today()
        const used = await usedOn(tx, userId, day)
        const [row] = base === null ? [] : await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
        const open = await openSession(tx, userId)
        if (open) return { ok: true, session: viewOf(open), used, paid: row ? { save: parseSaveData(row.data), revision: row.revision } : null }
        const price = sessionPrice(used)
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
        const habitat = habitatOfWeek(week, SAFARI_HABITAT_IDS)
        const save = paid?.save ?? (await saveOf(tx, userId))
        const sure = await sureFor(tx, userId, await dryOf(tx, userId), save)
        const state: Stored = { run: startRun(rollQueue(habitatPool(habitat), partnerTypes(save), dice, sure)), log: [], fresh: false }
        const [session] = await tx<SessionRow[]>`
          insert into safari_sessions (user_id, day, week, habitat, price, state)
          values (${userId}, ${day}::date, ${week}::date, ${habitat}, ${price}, ${tx.json(state)})
          returning id, week, habitat, state, finished_at`
        return { ok: true, session: viewOf(session!), used: used + 1, paid }
      }),

    /**
     * `POST /realm/safari/act`: one action, rolled here. `turn` is how many
     * answers the client has seen: an action already answered reads that
     * answer back (a retry changes nothing), an action from the future is
     * refused. A catch sends its gift; when the session ends, the guarantee's
     * count moves.
     */
    act: (userId: string, id: string, turn: number, action: SafariAction): Promise<SafariActResult> =>
      sql.begin(async (tx): Promise<SafariActResult> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const [row] = await tx<SessionRow[]>`select id, week, habitat, state, finished_at from safari_sessions where id = ${id}::uuid and user_id = ${userId}`
        if (!row) return { ok: false, error: 'missing' }
        const stored = row.state
        if (turn < stored.log.length) return { ok: true, acted: { ...stored.log[turn]!, session: viewOf(row) } }
        if (turn > stored.log.length) return { ok: false, error: 'stale' }
        const got = applyAction(stored.run, action, dice)
        if (!got) return { ok: false, error: 'illegal' }
        let gift: Gift | null = null
        let fresh = stored.fresh
        if (got.turn.kind === 'ball' && got.turn.caught) {
          gift = await giftFor(tx, userId, row.id, stored.log.length, got.turn.family, got.turn.shiny)
          const save = await saveOf(tx, userId)
          if (save?.hatched[got.turn.family] === undefined) fresh = true
          console.log(`safari: ${userId} caught ${got.turn.family}${got.turn.shiny ? ' (shiny)' : ''}`)
        }
        const state: Stored = { run: got.run, log: [...stored.log, { turn: got.turn, gift }], fresh }
        const finished = got.run.over
        const [next] = await tx<SessionRow[]>`
          update safari_sessions set state = ${tx.json(state)}, finished_at = ${finished ? now() : null}
          where id = ${row.id}::uuid
          returning id, week, habitat, state, finished_at`
        if (finished) {
          await tx`
            insert into safari_progress (user_id, dry) values (${userId}, ${fresh ? 0 : 1})
            on conflict (user_id) do update set dry = ${fresh ? 0 : tx`safari_progress.dry + 1`}`
        }
        return { ok: true, acted: { turn: got.turn, gift, session: viewOf(next!) } }
      }),
  }
}

export type SafariStore = ReturnType<typeof safariStore>
