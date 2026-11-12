import { randomInt } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { PLAYABLE } from '../../src/data/hatchlings'
import { CONTEST_GIFTS, DEX_ALL_GIFT, DEX_GIFT, HABITAT_REWARDS, SAFARI_HABITAT_IDS, SAFARI_ONLY, dexRewardKey, habitatDone, habitatResidents, isSafariHabitat, lackingFamilies, markLacking, openGated, sessionPool, type SafariHabitat } from '../../src/data/safari'
import { isCaptured } from '../../src/game/capture'
import { addDays, brasiliaDay, weekStart, type DayKey } from '../../src/game/day'
import { donateFrom } from '../../src/game/festival'
import type { Gift, GiftContent, GiftReason } from '../../src/game/gifts'
import { parseSaveData, type Save } from '../../src/game/meta'
import { isRecord } from '../../src/game/parse'
import type { HatchlingId } from '../../src/data/hatchlings'
import type { Deed } from '../../src/data/realmStamps'
import type { SafariActed, SafariSession, SafariState } from '../../src/net/realmApi'
import { safariDeeds } from '../../src/realm/gameDeeds'
import {
  CONTEST,
  SAFARI,
  SAFARI_ACTIONS,
  applyAction,
  bestCatch,
  contestPrize,
  daypartOf,
  encountersLeft,
  guaranteedEntry,
  habitatOfWeek,
  isContestDay,
  isUtcOffset,
  localHour,
  nextInGrass,
  pickVisible,
  rollQueue,
  sessionPrice,
  startRun,
  wanderersOf,
  type SafariAction,
  type SafariCatch,
  type SafariDaypart,
  type SafariEncounter,
  type SafariMode,
  type SafariRun,
  type SafariSlot,
  type SafariTurn,
} from '../../src/realm/games/safari.rules'
import type { Sql } from './db'
import { sendGift } from './gifts'
import type { EarnDeeds } from './realmDeeds'
import { rateLimiter } from './rateLimit'

/**
 * The Zona Safári's API side: the server rolls everything. A session is
 * charged here (free or out of the stored save, like the claw), its encounters
 * are rolled here and kept here: a client learns one only when it reports a
 * rustle in the tall grass, and the next in line comes whatever it walked, so
 * walking can't pick or re-roll one. A session paid for and never finished
 * stays open for its owner; repeating an action (`turn`) reads the stored
 * answer back. A catch's deeds (`safariDeeds`) go to the Estampas once its
 * turn is stored, only from the action that rolled it.
 *
 * Who's about follows the time of day at the player's place, from the UTC
 * offset the client sends (`daypartOf`): a false offset only changes the
 * pool, never the odds. The wanderers are slots of the same rolled queue the
 * client is told about: meeting one (`stalk`) brings it a berry's calm, which
 * a client skipping the sneak could claim for at most `SAFARI.visible` of a
 * session's encounters. Every catch fills its habitat's Pokédex
 * (`safari_dex`), a full one sends its gifts (`DEX_GIFT` and the habitat's
 * `HABITAT_REWARDS`, the cove's Ovo de Manaphy among them). A habitat whose
 * gift went out stays completed when new residents join it, and a read sends
 * whatever reward it was completed before (`backfill`). Who lives there
 * follows the stored save: Phione only for an account owning Manaphy
 * (`SAFARI_GATED`), and the Safari-only families it lacks weigh more. A contest entry
 * (`mode: 'contest'`) is free, one a contest day, bugs only; its catches only
 * score, and as it ends its best catch is kept if it's new to the account and
 * goes on the week's board (`realm_game_boards`, game `safari`), whose prizes
 * go out once the week is over, on the first read after it (`settleContest`).
 */

type Q = Sql | TransactionSql

/** Enough for a whole session's worth of actions in a minute, not a script's. */
const LIMIT = { n: 60, ms: 60_000 } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Where the client's clock is when it doesn't say: Brasília. */
const BRASILIA_OFFSET = -180

/** A uniform roll from the OS's generator, the shape the rules take. */
const roll = () => randomInt(0, 2 ** 32) / 2 ** 32

/** What starting a session asks for: the save revision a paid one spends from, a contest entry or a regular session, and the player's UTC offset in minutes. */
export type SafariStartBody = { base: number | null; mode: SafariMode; offset: number }

/** `POST /realm/safari/start`'s body: `{ base?, mode?, offset? }` (a regular session at Brasília's hour when left out). */
export const parseSafariStart = (v: unknown): SafariStartBody | null => {
  if (!isRecord(v)) return null
  const base = v.base === undefined || v.base === null ? null : typeof v.base === 'number' && Number.isSafeInteger(v.base) ? v.base : undefined
  const mode = v.mode === undefined || v.mode === 'safari' ? 'safari' : v.mode === 'contest' ? 'contest' : undefined
  const offset = v.offset === undefined ? BRASILIA_OFFSET : isUtcOffset(v.offset) ? v.offset : undefined
  return base === undefined || mode === undefined || offset === undefined ? null : { base, mode, offset }
}

/** `POST /realm/safari/act`'s body: the session, how many turns the client has seen and what it does (a `stalk` names the wanderer's slot). */
export const parseSafariAct = (v: unknown): { id: string; turn: number; action: SafariAction } | null => {
  if (!isRecord(v) || typeof v.id !== 'string' || !UUID.test(v.id) || typeof v.turn !== 'number' || !Number.isSafeInteger(v.turn) || v.turn < 0) return null
  const kind = SAFARI_ACTIONS.find((a) => a === v.action)
  if (kind === 'stalk') return typeof v.slot === 'number' && Number.isInteger(v.slot) && v.slot >= 0 && v.slot < SAFARI.encounters ? { id: v.id, turn: v.turn, action: { kind, slot: v.slot } } : null
  return kind ? { id: v.id, turn: v.turn, action: { kind } } : null
}

/** What's stored of a turn: the answer as given, gift included, so a repeat reads the same. */
type StoredTurn = { turn: SafariTurn<HatchlingId>; gift: Gift | null }

/** A session's jsonb: the run, each turn's answer, and whether a new family came (the guarantee's count). */
type Stored = { run: SafariRun<HatchlingId>; log: StoredTurn[]; fresh: boolean }

type SessionRow = { id: string; week: Date | string; habitat: string; mode: string; daypart: string; state: Stored; finished_at: Date | null }


const isDaypart = (v: unknown): v is SafariDaypart => v === 'dawn' || v === 'day' || v === 'dusk' || v === 'night'

const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback)

/**
 * A stored run as these rules read it: sessions stored before the contest,
 * day and night (a met count, no levels, shinies rolled in advance) are
 * filled in, so one left open across the rollout plays on.
 */
export const reviveRun = (raw: SafariRun<HatchlingId> & { met?: number }): SafariRun<HatchlingId> => {
  const queue: SafariSlot<HatchlingId>[] = raw.queue.map((slot) => ({ family: slot.family, rarity: slot.rarity, level: num(slot.level, SAFARI.levelBase[slot.rarity]), sure: slot.sure === true }))
  const met = num(raw.met, 0)
  const seen = Array.isArray(raw.seen) && raw.seen.length === queue.length ? raw.seen.map((s) => s === true) : queue.map((_, i) => i < met)
  const e = raw.encounter as (Partial<SafariEncounter<HatchlingId>> & SafariSlot<HatchlingId>) | null
  const encounter: SafariEncounter<HatchlingId> | null = e && {
    family: e.family,
    rarity: e.rarity,
    level: num(e.level, SAFARI.levelBase[e.rarity]),
    sure: e.sure === true,
    shiny: e.shiny === true,
    calm: num(e.calm, 0),
    mood: e.mood === 'angry' || e.mood === 'eating' ? e.mood : null,
    moodTurns: num(e.moodTurns, 0),
    chain: num(e.chain, 1),
    stalked: e.stalked === true,
  }
  const catches: SafariCatch<HatchlingId>[] = raw.catches.map((c) => ({ family: c.family, shiny: c.shiny === true, level: num(c.level, 0), score: num(c.score, 0) }))
  return {
    mode: raw.mode === 'contest' ? 'contest' : 'safari',
    balls: raw.balls,
    berries: raw.berries,
    queue,
    seen,
    visible: Array.isArray(raw.visible) ? raw.visible.filter((i) => Number.isInteger(i) && i >= 0 && i < queue.length) : [],
    encounter,
    catches,
    chain: raw.chain ?? null,
    over: raw.over === true,
  }
}

/** A `date` column as a day key, whichever way the driver brought it. */
const dayOf = (v: Date | string): DayKey => (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)) as DayKey

const habitatFor = (row: SessionRow): SafariHabitat => (isSafariHabitat(row.habitat) ? row.habitat : SAFARI_HABITAT_IDS[0]!)

/** A session as its owner sees it: how many encounters are left and who wanders in the open, never who hides in the grass. */
export const viewOf = (row: SessionRow): SafariSession => {
  const { log } = row.state
  const run = reviveRun(row.state.run)
  const e = run.encounter
  return {
    id: row.id,
    week: dayOf(row.week),
    habitat: habitatFor(row),
    mode: run.mode,
    daypart: isDaypart(row.daypart) ? row.daypart : 'day',
    balls: run.balls,
    berries: run.berries,
    left: encountersLeft(run),
    sureNext: run.queue[nextInGrass(run)]?.sure ?? false,
    wanderers: wanderersOf(run),
    chain: run.chain,
    encounter: e && { family: e.family, shiny: e.shiny, calm: e.calm, sure: e.sure, level: e.level, mood: e.mood, moodTurns: e.moodTurns, chain: e.chain, stalked: e.stalked },
    catches: [...run.catches],
    over: run.over,
    turn: log.length,
  }
}

const usedOn = async (q: Q, userId: string, day: DayKey, mode: SafariMode = 'safari') =>
  (await q<{ n: number }[]>`select count(*)::int as n from safari_sessions where user_id = ${userId} and day = ${day}::date and mode = ${mode}`)[0]?.n ?? 0

const openSession = async (q: Q, userId: string) => (await q<SessionRow[]>`select id, week, habitat, mode, daypart, state, finished_at from safari_sessions where user_id = ${userId} and finished_at is null`)[0] ?? null

/** The families caught in each habitat (its Pokédex). */
const dexOf = async (q: Q, userId: string): Promise<Record<SafariHabitat, HatchlingId[]>> => {
  const dex = Object.fromEntries(SAFARI_HABITAT_IDS.map((h) => [h, [] as HatchlingId[]])) as Record<SafariHabitat, HatchlingId[]>
  for (const row of await q<{ habitat: string; family: string }[]>`select habitat, family from safari_dex where user_id = ${userId} order by at`) {
    if (isSafariHabitat(row.habitat) && Object.hasOwn(PLAYABLE, row.family)) dex[row.habitat].push(row.family as HatchlingId)
  }
  return dex
}

/** This week's best contest entry, null without one. */
const contestBest = async (q: Q, userId: string, week: DayKey) =>
  (await q<{ score: number }[]>`select score from realm_game_boards where game = 'safari' and period = 'week' and start = ${week}::date and user_id = ${userId}`)[0]?.score ?? null

const dryOf = async (q: Q, userId: string) => (await q<{ dry: number }[]>`select dry from safari_progress where user_id = ${userId}`)[0]?.dry ?? 0

const saveOf = async (q: Q, userId: string): Promise<Save | null> => {
  const [row] = await q<{ data: unknown }[]>`select data from saves where user_id = ${userId}`
  return row ? parseSaveData(row.data) : null
}

/** The gated families (`SAFARI_GATED`) the stored save opened: Phione once Manaphy hatched. */
const openOf = (save: Save | null) => openGated((legend) => save !== null && isCaptured(save.legends, legend))

/** The habitats whose Pokédex gift went out (`safariDex:<habitat>`): completed for good. */
const rewardedOf = async (q: Q, userId: string): Promise<SafariHabitat[]> =>
  (await q<{ key: string }[]>`select key from gifts where user_id = ${userId} and key like 'safariDex:%'`).flatMap((r) => {
    const habitat = r.key.slice('safariDex:'.length)
    return isSafariHabitat(habitat) ? [habitat] : []
  })

/** The families gifted to the account that the save may not hold yet (a family or shiny gift not opened or not synced), so the guarantee doesn't bring one twice. */
const giftedFamilies = async (q: Q, userId: string) => (await q<{ family: string }[]>`select payload->>'family' as family from gifts where user_id = ${userId} and kind in ('family', 'shinyHatch')`).map((r) => r.family)

/** The partner the API goes by: the stored save's, never the client's word. */
const partnerOf = (save: Save | null) => (save && Object.hasOwn(PLAYABLE, save.partner) ? save.partner : null)

const partnerTypes = (save: Save | null): readonly string[] => {
  const partner = partnerOf(save)
  return partner ? PLAYABLE[partner].line[0].types : []
}

export type SafariRefusal = 'profile' | 'banned' | 'cap' | 'funds' | 'nosave' | 'stale' | 'closed'

export type SafariStarted = { ok: true; session: SafariSession; used: number; paid: { save: Save; revision: number } | null } | { ok: false; error: SafariRefusal }

export type SafariActResult = { ok: true; acted: SafariActed } | { ok: false; error: 'profile' | 'banned' | 'missing' | 'stale' | 'illegal' }

export const safariStore = (sql: Sql, deps: { closed: (q: Q, userId: string) => Promise<boolean>; earn: EarnDeeds; now?: () => Date; dice?: () => number }) => {
  const now = deps.now ?? (() => new Date())
  const dice = deps.dice ?? roll
  const limit = rateLimiter(LIMIT.n, LIMIT.ms)
  const today = () => brasiliaDay(now())
  /** The weeks this process already saw settled, so a read doesn't ask every time. */
  const settled = new Set<string>()

  /** Who may play now: a @handle and no ban. Locks the account, so its sessions take turns. */
  const gate = async (tx: TransactionSql, userId: string): Promise<'profile' | 'banned' | null> => {
    const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
    if (!user?.handle) return 'profile'
    return (await deps.closed(tx, userId)) ? 'banned' : null
  }

  /** The guarantee's family for an account `dry` sessions without a new one, or null (not there yet, or nothing left to get). */
  const sureFor = async (q: Q, userId: string, dry: number, save: Save | null) => {
    if (dry < SAFARI.guarantee) return null
    return guaranteedEntry(lackingFamilies(save?.hatched ?? {}, await giftedFamilies(q, userId), openOf(save)), SAFARI_ONLY, dice)
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

  /** Whether the account still lacks what keeping `c` would bring: the family, or its shiny. */
  const keeps = async (tx: TransactionSql, userId: string, c: SafariCatch<HatchlingId>) => {
    const save = await saveOf(tx, userId)
    const had = save?.hatched[c.family]
    const gifted = await tx<{ kind: string }[]>`select kind from gifts where user_id = ${userId} and kind in ('family', 'shinyHatch') and payload->>'family' = ${c.family}`
    if (c.shiny) return had?.shiny !== true && !gifted.some((g) => g.kind === 'shinyHatch')
    return had === undefined && gifted.length === 0
  }

  /** Sends a completed habitat's gifts, each under its own key (sent once, so a repeat is a no-op): the Ultra egg, then its `HABITAT_REWARDS`. */
  const rewardHabitat = async (tx: TransactionSql, userId: string, habitat: SafariHabitat) => {
    const reason: GiftReason = { kind: 'safariDex', habitat }
    await sendGift(tx, userId, DEX_GIFT, reason, `safariDex:${habitat}`)
    const rewards: readonly GiftContent[] = HABITAT_REWARDS[habitat]
    for (const [i, content] of rewards.entries()) await sendGift(tx, userId, content, reason, dexRewardKey(habitat, i))
  }

  /** Every habitat completed (now or before it grew): the Guarda-Parque title. */
  const rewardAll = async (tx: TransactionSql, userId: string) => {
    const dex = await dexOf(tx, userId)
    const rewarded = await rewardedOf(tx, userId)
    if (SAFARI_HABITAT_IDS.every((h) => habitatDone(h, dex[h], rewarded))) await sendGift(tx, userId, DEX_ALL_GIFT, { kind: 'safariDex', habitat: null }, 'safariDex:all')
  }

  /** Puts a catch in its habitat's Pokédex; a first one that fills the habitat (or every habitat) sends its gifts. */
  const fillDex = async (tx: TransactionSql, userId: string, habitat: SafariHabitat, family: HatchlingId) => {
    if (!habitatResidents(habitat).some((e) => e.family === family)) return
    const fresh = await tx`insert into safari_dex (user_id, habitat, family) values (${userId}, ${habitat}, ${family}) on conflict do nothing returning family`
    if (fresh.length === 0) return
    const dex = await dexOf(tx, userId)
    if (!habitatDone(habitat, dex[habitat], await rewardedOf(tx, userId))) return
    await rewardHabitat(tx, userId, habitat)
    await rewardAll(tx, userId)
  }

  /**
   * A habitat completed before a reward joined it (its egg sent, a later gift
   * not yet: the titles, the shinies and the Ovo de Manaphy came with the
   * Safári's second wave) gets what it's missing. Only reads unless something's missing.
   */
  const backfill = async (userId: string, rewarded: readonly SafariHabitat[]) => {
    if (rewarded.length === 0) return
    const keys = new Set((await sql<{ key: string }[]>`select key from gifts where user_id = ${userId} and key like 'safariDex:%:%'`).map((r) => r.key))
    const missing = rewarded.filter((h) => HABITAT_REWARDS[h].some((_, i) => !keys.has(dexRewardKey(h, i))))
    if (missing.length === 0) return
    await sql.begin(async (tx) => {
      for (const habitat of missing) await rewardHabitat(tx, userId, habitat)
      await rewardAll(tx, userId)
    })
  }

  /** Puts a finished contest entry's score on the day's and the week's boards, each keeping its best. */
  const postScore = async (tx: TransactionSql, userId: string, day: DayKey, score: number) => {
    for (const [period, start] of [['day', day], ['week', weekStart(day)]] as const) {
      await tx`
        insert into realm_game_boards (game, period, start, user_id, score) values ('safari', ${period}, ${start}::date, ${userId}, ${score})
        on conflict (game, period, start, user_id) do update set score = excluded.score, at = now() where realm_game_boards.score < excluded.score`
    }
  }

  /**
   * Sends a finished week's contest prizes (`contestPrize`), once: the week's
   * board as it shows (trainers with a handle, not banned), each place's gifts
   * under their own keys. The first read after the week does it.
   */
  const settleContest = async (week: DayKey) => {
    if (settled.has(week)) return
    await sql.begin(async (tx) => {
      const [first] = await tx`insert into safari_contest_settled (week) values (${week}::date) on conflict do nothing returning week`
      if (!first) return
      const rows = await tx<{ user_id: string; rank: number; total: number }[]>`
        select b.user_id, (row_number() over (order by b.score desc, b.at, b.user_id))::int as rank, (count(*) over ())::int as total
        from realm_game_boards b join users u on u.id = b.user_id
        where b.game = 'safari' and b.period = 'week' and b.start = ${week}::date and b.score > 0
          and u.handle is not null and u.banned_at is null
          and not exists (select 1 from realm_bans rb where rb.user_id = b.user_id and (rb.until is null or rb.until > now()))
        order by rank`
      for (const row of rows) {
        const prize = contestPrize(row.rank, row.total)
        if (!prize) continue
        const gifts: readonly GiftContent[] = CONTEST_GIFTS[prize]
        for (const [i, content] of gifts.entries()) await sendGift(tx, row.user_id, content, { kind: 'bugContest', rank: row.rank }, `bugContest:${week}:${i}`)
      }
      if (rows.length > 0) console.log(`safari: contest of ${week} settled, ${rows.length} entrants`)
    })
    settled.add(week)
  }

  return {
    /** Counts a call against the account's limit; false past it (a script's, never a player's). */
    take: (userId: string) => limit.take([userId], now().getTime()),

    /** `GET /realm/safari`: the week's habitat as this account sees it, on the open session's week if one waits, the contest and the Pokédex. Null without a @handle. */
    state: async (userId: string): Promise<SafariState | null> => {
      const [user] = await sql<{ handle: string | null }[]>`select handle from users where id = ${userId}`
      if (!user?.handle) return null
      const day = today()
      await settleContest(addDays(weekStart(day), -7)).catch((err: unknown) => console.error('safari: contest not settled', err))
      const open = await openSession(sql, userId)
      const week = open ? dayOf(open.week) : weekStart(day)
      const save = await saveOf(sql, userId)
      const dry = await dryOf(sql, userId)
      const sure = dry >= SAFARI.guarantee && lackingFamilies(save?.hatched ?? {}, await giftedFamilies(sql, userId), openOf(save)).length > 0
      const done = await rewardedOf(sql, userId)
      await backfill(userId, done).catch((err: unknown) => console.error('safari: rewards not backfilled', err))
      const contestOpen = isContestDay(day)
      const contest = { open: contestOpen, left: contestOpen ? Math.max(0, CONTEST.entries - (await usedOn(sql, userId, day, 'contest'))) : 0, best: await contestBest(sql, userId, weekStart(day)) }
      return {
        week,
        habitat: open ? habitatFor(open) : habitatOfWeek(week, SAFARI_HABITAT_IDS),
        used: await usedOn(sql, userId, day),
        dry,
        sure,
        partner: partnerOf(save),
        open: open ? viewOf(open) : null,
        contest,
        dex: await dexOf(sql, userId),
        done,
      }
    },

    /**
     * `POST /realm/safari/start`: a session. One already open comes back
     * uncharged. A contest entry is free on a contest day while the day's
     * entry is left. Otherwise the day's price is charged, a paid one out of
     * the stored save at revision `base` (moved to `spent`, so a merge never
     * refunds it), and its encounters are rolled: the partner's type weighed
     * in from the stored save, the guarantee's family first if it's due, who's
     * about from the hour at the player's `offset`.
     */
    start: (userId: string, body: SafariStartBody): Promise<SafariStarted> =>
      sql.begin(async (tx): Promise<SafariStarted> => {
        const { base, mode, offset } = body
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const day = today()
        const used = await usedOn(tx, userId, day)
        const [row] = base === null ? [] : await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
        const open = await openSession(tx, userId)
        if (open) return { ok: true, session: viewOf(open), used, paid: row ? { save: parseSaveData(row.data), revision: row.revision } : null }
        const price = mode === 'contest' ? 0 : sessionPrice(used)
        if (mode === 'contest' && !isContestDay(day)) return { ok: false, error: 'closed' }
        if (mode === 'contest' && (await usedOn(tx, userId, day, 'contest')) >= CONTEST.entries) return { ok: false, error: 'cap' }
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
        const daypart = daypartOf(localHour(now().getTime(), offset))
        const save = paid?.save ?? (await saveOf(tx, userId))
        // The contest neither brings the guarantee nor counts toward it.
        const sure = mode === 'contest' ? null : await sureFor(tx, userId, await dryOf(tx, userId), save)
        const gifted = await giftedFamilies(tx, userId)
        const pool = markLacking(sessionPool(mode, habitat, daypart, week, openOf(save)), (id) => save?.hatched[id] === undefined && !gifted.includes(id))
        const queue = rollQueue(pool, partnerTypes(save), dice, sure)
        const state: Stored = { run: startRun(queue, pickVisible(queue, dice), mode), log: [], fresh: false }
        const [session] = await tx<SessionRow[]>`
          insert into safari_sessions (user_id, day, week, habitat, price, state, mode, daypart)
          values (${userId}, ${day}::date, ${week}::date, ${habitat}, ${price}, ${tx.json(state)}, ${mode}, ${daypart})
          returning id, week, habitat, mode, daypart, state, finished_at`
        return { ok: true, session: viewOf(session!), used: mode === 'contest' ? used : used + 1, paid }
      }),

    /**
     * `POST /realm/safari/act`: one action, rolled here. `turn` is how many
     * answers the client has seen: an action already answered reads that
     * answer back (a retry changes nothing), an action from the future is
     * refused. A regular catch sends its gift and fills the Pokédex; when a
     * regular session ends, the guarantee's count moves; when a contest entry
     * ends, its best catch is kept if new and posts its score. Then a catch's
     * deeds, from this action only.
     */
    act: async (userId: string, id: string, turn: number, action: SafariAction): Promise<SafariActResult> => {
      let deeds: ReadonlyMap<Deed, number> = new Map()
      const acted = await sql.begin(async (tx): Promise<SafariActResult> => {
        const refused = await gate(tx, userId)
        if (refused) return { ok: false, error: refused }
        const [row] = await tx<SessionRow[]>`select id, week, habitat, mode, daypart, state, finished_at from safari_sessions where id = ${id}::uuid and user_id = ${userId}`
        if (!row) return { ok: false, error: 'missing' }
        const stored = row.state
        if (turn < stored.log.length) return { ok: true, acted: { ...stored.log[turn]!, session: viewOf(row) } }
        if (turn > stored.log.length) return { ok: false, error: 'stale' }
        const got = applyAction(reviveRun(stored.run), action, dice)
        if (!got) return { ok: false, error: 'illegal' }
        const habitat = habitatFor(row)
        const contest = got.run.mode === 'contest'
        let gift: Gift | null = null
        let fresh = stored.fresh
        if (got.turn.kind === 'ball' && got.turn.caught) {
          if (!contest) {
            gift = await giftFor(tx, userId, row.id, stored.log.length, got.turn.family, got.turn.shiny)
            const save = await saveOf(tx, userId)
            if (save?.hatched[got.turn.family] === undefined) fresh = true
          }
          await fillDex(tx, userId, habitat, got.turn.family)
          console.log(`safari: ${userId} caught ${got.turn.family}${got.turn.shiny ? ' (shiny)' : ''}${contest ? ` (contest, ${got.turn.score})` : ''}`)
          deeds = safariDeeds(true, got.turn.shiny)
        }
        const finished = got.run.over
        if (finished && contest) {
          const best = bestCatch(got.run.catches)
          if (best) {
            await postScore(tx, userId, today(), best.score)
            if (await keeps(tx, userId, best)) gift = await giftFor(tx, userId, row.id, stored.log.length, best.family, best.shiny)
          }
        }
        const state: Stored = { run: got.run, log: [...stored.log, { turn: got.turn, gift }], fresh }
        const [next] = await tx<SessionRow[]>`
          update safari_sessions set state = ${tx.json(state)}, finished_at = ${finished ? now() : null}
          where id = ${row.id}::uuid
          returning id, week, habitat, mode, daypart, state, finished_at`
        if (finished && !contest) {
          await tx`
            insert into safari_progress (user_id, dry) values (${userId}, ${fresh ? 0 : 1})
            on conflict (user_id) do update set dry = ${fresh ? 0 : tx`safari_progress.dry + 1`}`
        }
        return { ok: true, acted: { turn: got.turn, gift, session: viewOf(next!) } }
      })
      if (deeds.size > 0) await deps.earn(userId, deeds)
      return acted
    },
  }
}

export type SafariStore = ReturnType<typeof safariStore>
