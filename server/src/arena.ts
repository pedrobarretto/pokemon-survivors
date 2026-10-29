import { createHmac, timingSafeEqual } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { ARENA_RANKED, type Conduct, type MatchKind } from '../../src/data/arenaRanked'
import { isVersusPick, type Team, type VersusPick } from '../../src/data/versus'
import {
  conductOf,
  countsForRank,
  fairPlayAfter,
  fairPlayCounts,
  freshRating,
  parseArenaResult,
  rateMatch,
  seasonAt,
  seasonById,
  seasonReset,
  tierOf,
  type ArenaHistoryEntry,
  type ArenaLeaderboard,
  type ArenaLeaderboardRow,
  type ArenaProfile,
  type ArenaResult,
  type FairPlayPenalty,
  type RatedSeat,
  type Rating,
  type RatingChange,
  type Season,
} from '../../src/game/arenaRank'
import { ARENA_REWARDS, seasonReward } from '../../src/game/arenaRewards'
import { isRecord } from '../../src/game/parse'
import type { ArenaReport, ArenaReportResponse, ArenaTicketsResponse } from '../../src/net/arena'
import type { Sql } from './db'
import { sendGift } from './gifts'
import { rateLimiter } from './rateLimit'

/**
 * The Arena's competitive layer: match reports from the relay, ratings per
 * season, Fair Play, history, the season's board and its end-of-season
 * titles. The rules (seasons, MMR, RP, tiers, Fair Play, the protection
 * meter) are `game/arenaRank.ts`; this file stores what they decide, from
 * the relay's reports only. The relay signs what it sends
 * (`verifyArenaSignature`).
 */

type Q = Sql | TransactionSql

/* ---------------- Signing ---------------- */

/** Hex HMAC-SHA256 of `body` with the relay's shared secret (`ARENA_REPORT_SECRET`). */
export const arenaSignature = (body: string, secret: string) => createHmac('sha256', secret).update(body).digest('hex')

/** Whether `header` (`x-arena-signature`) signs the raw `body`, compared in constant time. */
export const verifyArenaSignature = (body: string, header: string | undefined, secret: string) => {
  if (!header) return false
  const given = Buffer.from(header.trim().toLowerCase())
  const expected = Buffer.from(arenaSignature(body, secret))
  return given.length === expected.length && timingSafeEqual(given, expected)
}

/* ---------------- Reading a report ---------------- */

/** A report's seat: the slot's account (null for a bot) and whether that human left. */
export type ReportSeat = { slot: number; userId: string | null; left: boolean }

/** A report checked field by field, its result parsed (`parseArenaResult`), `confirmed` read as true when absent. */
export type ParsedReport = Omit<ArenaReport, 'seats' | 'result' | 'confirmed'> & { seats: ReportSeat[]; result: ArenaResult; confirmed: boolean }

const REPORT_KINDS = ['casual', 'ranked', 'room'] as const

const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)

const slotOf = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < 64 ? v : null)

/**
 * A relay's report, or null when anything is off: every seat a slot of the
 * result (each once), every account in one seat at most.
 */
export const parseArenaReport = (raw: unknown): ParsedReport | null => {
  if (!isRecord(raw) || raw.v !== 1 || !Array.isArray(raw.seats)) return null
  const room = text(raw.room, 32)
  const region = text(raw.region, 16)
  const kind = REPORT_KINDS.find((k) => k === raw.kind)
  const { run, endedAt } = raw
  const confirmed = raw.confirmed === undefined ? true : raw.confirmed
  if (!room || !region || !kind || typeof run !== 'number' || !Number.isSafeInteger(run) || run < 0 || typeof confirmed !== 'boolean') return null
  if (typeof endedAt !== 'number' || !Number.isFinite(endedAt) || endedAt <= 0) return null
  const result = parseArenaResult(raw.result)
  if (!result) return null
  const seats: ReportSeat[] = []
  for (const s of raw.seats) {
    const slot = isRecord(s) ? slotOf(s.slot) : null
    if (!isRecord(s) || slot === null || typeof s.left !== 'boolean' || (s.userId !== null && !text(s.userId, 64))) return null
    seats.push({ slot, userId: typeof s.userId === 'string' ? s.userId : null, left: s.left })
  }
  const slots = new Set(result.seats.map((s) => s.slot))
  const users = seats.flatMap((s) => (s.userId ? [s.userId] : []))
  if (slots.size !== result.seats.length || seats.some((s) => !slots.has(s.slot))) return null
  if (new Set(seats.map((s) => s.slot)).size !== seats.length || new Set(users).size !== users.length) return null
  return { v: 1, room, run, kind, region, endedAt, seats, result, confirmed }
}

/** A match its humans all left before its end (`ArenaReport.abandoned`): no result, every account a leaver. */
export type AbandonedReport = { room: string; run: number; kind: 'casual' | 'ranked' | 'room'; endedAt: number; users: string[] }

/** An abandoned match's report, or null when anything is off (or it isn't one). */
export const parseAbandonedReport = (raw: unknown): AbandonedReport | null => {
  if (!isRecord(raw) || raw.v !== 1 || raw.abandoned !== true || !Array.isArray(raw.seats)) return null
  const room = text(raw.room, 32)
  const kind = REPORT_KINDS.find((k) => k === raw.kind)
  const { run, endedAt } = raw
  if (!room || !kind || typeof run !== 'number' || !Number.isSafeInteger(run) || run < 0 || typeof endedAt !== 'number' || !Number.isFinite(endedAt) || endedAt <= 0) return null
  const users: string[] = []
  for (const s of raw.seats) {
    if (!isRecord(s) || slotOf(s.slot) === null || (s.userId !== null && !text(s.userId, 64))) return null
    if (typeof s.userId === 'string') users.push(s.userId)
  }
  if (raw.seats.length > 64 || new Set(users).size !== users.length) return null
  return { room, run, kind, endedAt, users: [...users].sort() }
}

/* ---------------- Rating a match ---------------- */

export type Outcome = ArenaHistoryEntry['outcome']

/** A seat's outcome from its side; a human who left lost, whatever the score. */
export const outcomeOf = (team: Team, winner: Team | null, left: boolean): Outcome => (left ? 'loss' : winner === null ? 'draw' : winner === team ? 'win' : 'loss')

const rival = (t: Team): Team => (t === 0 ? 1 : 0)

/** One human's line in a match, with what it moved when rated and how they played it out (Fair Play's `conduct`). */
export type ArenaLine = {
  userId: string
  slot: number
  team: Team
  starter: VersusPick
  form: string
  kos: number
  deaths: number
  scored: number
  damage: number
  left: boolean
  outcome: Outcome
  conduct: Conduct
  change: RatingChange | null
}

/**
 * Every human's line of a match. With `ratings` (the humans' current ones,
 * by user id) the match is rated with `rateMatch`: seats without an account
 * are bots, and a human who left is rated as if their team lost (the rest
 * keep the real result). An unconfirmed result (`ArenaReport.confirmed`)
 * rates only the leavers: the stayers' lines go to history unrated. Without
 * `ratings`, nothing moves. Each line's `conduct` (`conductOf`) decides its
 * Fair Play, and only a seat that `finished` fills or spends its protection.
 */
export const planMatch = (result: ArenaResult, seats: readonly ReportSeat[], ratings: ReadonlyMap<string, Rating> | null, confirmed = true): ArenaLine[] => {
  const human = new Map(seats.flatMap((s) => (s.userId ? [[s.slot, { userId: s.userId, left: s.left }] as const] : [])))
  const conducts = result.seats.map((s) => {
    const h = human.get(s.slot)
    return h ? conductOf(h.left, s.afk, confirmed) : 'finished'
  })
  const rated = ratings
    ? result.seats.map((s, i): RatedSeat => {
        const h = human.get(s.slot)
        return { rating: h ? (ratings.get(h.userId) ?? freshRating()) : null, team: s.team, scored: s.scored, kos: s.kos, objective: result.objective === s.team, fair: conducts[i] === 'finished' }
      })
    : null
  const changes = rated ? rateMatch(rated, result.winner) : null
  /** Seat `i`'s change: a leaver's as if their team lost, a stayer's by the result when it's confirmed. */
  const changeOf = (i: number, team: Team, left: boolean) => {
    if (!rated) return null
    if (left) return (result.winner === rival(team) ? changes : rateMatch(rated, rival(team)))?.[i] ?? null
    return confirmed ? (changes?.[i] ?? null) : null
  }
  return result.seats.flatMap((s, i) => {
    const h = human.get(s.slot)
    if (!h) return []
    const change = changeOf(i, s.team, h.left)
    const { slot, team, starter, form, kos, deaths, scored, damage } = s
    return [{ userId: h.userId, slot, team, starter, form, kos, deaths, scored, damage, left: h.left, outcome: outcomeOf(team, result.winner, h.left), conduct: conducts[i] ?? 'finished', change }]
  })
}

/** The humans of a report (accounts on its seats, leavers included), each once, in id order. */
export const reportUsers = (r: Pick<ParsedReport, 'seats'>) => [...new Set(r.seats.flatMap((s) => (s.userId ? [s.userId] : [])))].sort()

/**
 * The season a report rates, or null when it doesn't count (`countsForRank`),
 * ended before the first season, or is unconfirmed with no account that left
 * (then nobody moves).
 */
export const ratingSeason = (r: Pick<ParsedReport, 'seats' | 'kind' | 'endedAt' | 'confirmed'>) => {
  const season = seasonAt(r.endedAt)
  const anyone = r.confirmed || r.seats.some((s) => s.left && s.userId !== null)
  return season && anyone && countsForRank(r.kind, reportUsers(r).length) ? season : null
}

/** A player's starting rating in a season: reset from the previous season's when they had one, else fresh. */
export const startingRating = (previous: Rating | null): Rating => (previous ? seasonReset(previous) : freshRating())

/** The season the Arena shows at `ms`: the running one, or the first before it starts. */
export const shownSeason = (ms: number): Season => seasonAt(ms) ?? seasonById(1)

/* ---------------- The store ---------------- */

/** Practice matches a player may store per hour (a match runs 7 minutes): only a brake for a script. */
const PRACTICE_LIMIT = { n: 12, ms: 3_600_000 } as const

/** History entries per page: the default and the most. */
const HISTORY = { page: 20, max: 50 } as const

/** Board rows: the default and the most. */
const BOARD = { rows: 50, max: 100 } as const

type RatingRow = { user_id: string; season: number; mmr: number; rp: number; peak: number; games: number; protection: number }

const toRating = (r: RatingRow): Rating => ({ mmr: r.mmr, rp: r.rp, peak: r.peak, games: r.games, protection: r.protection })

/** Each player's rating in `season` as it stands, written or not (`startingRating` when they have no row yet). */
const ratingsOf = async (q: Q, userIds: readonly string[], season: number) => {
  const rows = await q<RatingRow[]>`
    select user_id, season, mmr, rp, peak, games, protection from arena_ratings
    where user_id = any(${userIds}::text[]) and season in (${season}, ${season - 1})`
  const row = (id: string, s: number) => rows.find((r) => r.user_id === id && r.season === s)
  return new Map(
    userIds.map((id) => {
      const own = row(id, season)
      const previous = row(id, season - 1)
      return [id, own ? toRating(own) : startingRating(previous ? toRating(previous) : null)] as const
    }),
  )
}

/**
 * Seeds the players' rows of `season` (the first rated match of a season
 * creates them) and locks them, in user id order so two reports sharing
 * players take turns instead of deadlocking. Their ratings, by user id.
 */
const lockRatings = async (tx: TransactionSql, userIds: readonly string[], season: number) => {
  const start = await ratingsOf(tx, userIds, season)
  for (const id of userIds) {
    const r = start.get(id) ?? freshRating()
    await tx`
      insert into arena_ratings (user_id, season, mmr, rp, peak, games, protection)
      values (${id}, ${season}, ${r.mmr}, ${r.rp}, ${r.peak}, ${r.games}, ${r.protection})
      on conflict (user_id, season) do nothing`
  }
  const rows = await tx<RatingRow[]>`
    select user_id, season, mmr, rp, peak, games, protection from arena_ratings
    where season = ${season} and user_id = any(${userIds}::text[]) order by user_id for update`
  return new Map(rows.map((r) => [r.user_id, toRating(r)] as const))
}

/** Stores a match's lines and applies their rating changes to `season`'s rows. */
const writeLines = async (tx: TransactionSql, match: string, kind: MatchKind, season: number | null, at: Date, lines: readonly ArenaLine[]) => {
  for (const l of lines) {
    const c = l.change
    if (c && season !== null) {
      await tx`
        update arena_ratings set mmr = ${c.after.mmr}, rp = ${c.after.rp}, peak = ${c.after.peak}, games = ${c.after.games}, protection = ${c.after.protection},
          wins = wins + ${l.outcome === 'win' ? 1 : 0}, losses = losses + ${l.outcome === 'loss' ? 1 : 0}, draws = draws + ${l.outcome === 'draw' ? 1 : 0},
          updated_at = now()
        where user_id = ${l.userId} and season = ${season}`
    }
    await tx`
      insert into arena_lines (match_id, user_id, slot, team, starter, form, kos, deaths, scored, damage, "left", outcome, kind, season, at, mmr_change, rp_change, protected)
      values (${match}, ${l.userId}, ${l.slot}, ${l.team}, ${l.starter}, ${l.form}, ${l.kos}, ${l.deaths}, ${l.scored}, ${l.damage}, ${l.left},
        ${l.outcome}, ${kind}, ${season}, ${at}, ${c?.mmr ?? null}, ${c?.rp ?? null}, ${c?.protected ?? false})`
  }
}

/** Each player's Fair Play score as it stands (a full one without a row). */
const fairPlayOf = async (q: Q, userIds: readonly string[]) => {
  const rows = userIds.length > 0 ? await q<{ user_id: string; score: number }[]>`select user_id, score from arena_fair_play where user_id = any(${userIds}::text[])` : []
  return new Map(userIds.map((id) => [id, rows.find((r) => r.user_id === id)?.score ?? ARENA_RANKED.fairPlay.max] as const))
}

/**
 * Applies each player's conduct in match (`room`, `run`) to their Fair Play
 * (`fairPlayAfter`), once per match and player (`arena_conduct`'s key): the
 * scores' rows are made and locked first, in user id order (like the
 * ratings, so two reports sharing players take turns).
 */
const writeConduct = async (tx: TransactionSql, room: string, run: number, kind: 'casual' | 'ranked', at: Date, conducts: ReadonlyMap<string, Conduct>) => {
  const ids = [...conducts.keys()].sort()
  if (ids.length === 0) return
  const { max } = ARENA_RANKED.fairPlay
  await tx`insert into arena_fair_play (user_id, score) select unnest(${ids}::text[]), ${max} on conflict (user_id) do nothing`
  const rows = await tx<{ user_id: string; score: number }[]>`select user_id, score from arena_fair_play where user_id = any(${ids}::text[]) order by user_id for update`
  for (const id of ids) {
    const conduct = conducts.get(id)!
    const before = rows.find((r) => r.user_id === id)?.score ?? max
    const after = fairPlayAfter(before, conduct)
    const [landed] = await tx<{ user_id: string }[]>`
      insert into arena_conduct (room, run, user_id, kind, conduct, change, score, at)
      values (${room}, ${run}, ${id}, ${kind}, ${conduct}, ${after - before}, ${after}, ${at})
      on conflict (room, run, user_id) do nothing
      returning user_id`
    if (landed && after !== before) await tx`update arena_fair_play set score = ${after}, updated_at = now() where user_id = ${id}`
  }
}

type BoardRow = { user_id: string; handle: string; name: string | null; rp: number; wins: number; games: number; favorite: string | null }

const toBoardRow = (r: BoardRow, place: number): ArenaLeaderboardRow => ({
  place,
  handle: r.handle,
  name: r.name ?? '',
  rp: r.rp,
  tier: tierOf(r.rp),
  wins: r.wins,
  matches: r.games,
  favorite: r.favorite !== null && isVersusPick(r.favorite) ? r.favorite : null,
})

/** The board's rows of `season`: rated players with a handle, never a banned one. `who` narrows it to one player. */
const boardRows = (q: Q, season: number, limit: number, who: string | null = null) => q<BoardRow[]>`
  select r.user_id, u.handle, u.name, r.rp, r.wins, r.games,
    (select l.starter from arena_lines l where l.user_id = r.user_id and l.season = r.season
     group by l.starter order by count(*) desc, max(l.at) desc limit 1) as favorite
  from arena_ratings r join users u on u.id = r.user_id
  where r.season = ${season} and r.games > 0 and u.handle is not null and u.banned_at is null ${who ? q`and r.user_id = ${who}` : q``}
  order by r.rp desc, r.peak desc, r.updated_at, r.user_id
  limit ${limit}`

/** A player's place on `season`'s board: one past everyone ahead of them (RP, then peak, then who got there first). */
const placeOf = async (q: Q, season: number, userId: string) => {
  const [row] = await q<{ ahead: number }[]>`
    select count(*)::int as ahead
    from arena_ratings me, arena_ratings x join users u on u.id = x.user_id
    where me.user_id = ${userId} and me.season = ${season} and x.season = ${season} and x.games > 0 and u.handle is not null and u.banned_at is null
      and (-x.rp, -x.peak, x.updated_at, x.user_id) < (-me.rp, -me.peak, me.updated_at, me.user_id)`
  return (row?.ahead ?? 0) + 1
}

export const arenaStore = (sql: Sql) => {
  const practiceLimit = rateLimiter(PRACTICE_LIMIT.n, PRACTICE_LIMIT.ms)

  return {
    /**
     * Stores a relay's report once per (room, run): a retry gets the stored
     * match back (`duplicate`). Rated when `ratingSeason` says so (only the
     * leavers when unconfirmed), in one transaction that locks the players'
     * season rows first. Lines are stored for history either way.
     */
    report: (r: ParsedReport): Promise<ArenaReportResponse> =>
      sql.begin(async (tx) => {
        const season = seasonAt(r.endedAt)
        const users = reportUsers(r)
        const rating = ratingSeason(r)
        const rated = rating !== null
        const at = new Date(r.endedAt)
        const [match] = await tx<{ id: string }[]>`
          insert into arena_matches (room, run, kind, region, season, rated, ended_at, score_blue, score_red, winner, seconds, result)
          values (${r.room}, ${r.run}, ${r.kind}, ${r.region}, ${season?.id ?? null}, ${rated}, ${at}, ${r.result.score[0]}, ${r.result.score[1]},
            ${r.result.winner}, ${r.result.seconds}, ${tx.json(r.result)})
          on conflict (room, run) do nothing
          returning id`
        if (!match) {
          const [old] = await tx<{ id: string; rated: boolean }[]>`select id, rated from arena_matches where room = ${r.room} and run = ${r.run}`
          return { match: old?.id ?? '', rated: old?.rated ?? false, duplicate: true }
        }
        if (users.length > 0) await tx`insert into users (id) select unnest(${users}::text[]) on conflict (id) do nothing`
        const ratings = rating ? await lockRatings(tx, users, rating.id) : null
        const lines = planMatch(r.result, r.seats, ratings, r.confirmed)
        await writeLines(tx, match.id, r.kind, season?.id ?? null, at, lines)
        if (r.kind !== 'room' && fairPlayCounts(r.kind, users.length)) await writeConduct(tx, r.room, r.run, r.kind, at, new Map(lines.map((l) => [l.userId, l.conduct])))
        return { match: match.id, rated, duplicate: false }
      }),

    /**
     * A match every human left before its end (the relay reports it as its
     * room closes): each account loses Fair Play as a leaver, once, when the
     * match counts for it (`fairPlayCounts`). Nothing is rated or kept for
     * history (there's no result): `rated` is false.
     */
    abandoned: (r: AbandonedReport): Promise<ArenaReportResponse> =>
      sql.begin(async (tx) => {
        const key = `abandoned:${r.room}:${r.run}`
        if (r.kind === 'room' || !fairPlayCounts(r.kind, r.users.length)) return { match: key, rated: false, duplicate: false }
        await tx`insert into users (id) select unnest(${r.users}::text[]) on conflict (id) do nothing`
        const [seen] = await tx<{ n: number }[]>`select count(*)::int as n from arena_conduct where room = ${r.room} and run = ${r.run}`
        await writeConduct(tx, r.room, r.run, r.kind, new Date(r.endedAt), new Map(r.users.map((id) => [id, 'left' as const])))
        return { match: key, rated: false, duplicate: (seen?.n ?? 0) > 0 }
      }),

    /** Counts a practice upload against the player's hourly limit; false when they're past it. */
    takePractice: (userId: string, now = Date.now()) => practiceLimit.take([userId], now),

    /**
     * A quick match against bots (`kind` practice), for the player's history
     * and totals: one line, theirs, never rated. With a `key`, a retry lands
     * once. Null when `slot` isn't one of the result's human seats.
     */
    practice: (userId: string, result: ArenaResult, slot: number, key: string | null, now = Date.now()) => {
      const seat = result.seats.find((s) => s.slot === slot)
      if (!seat || seat.bot) return Promise.resolve(null)
      return sql.begin(async (tx) => {
        const season = seasonAt(now)
        const at = new Date(now)
        const [match] = await tx<{ id: string }[]>`
          insert into arena_matches (room, run, kind, region, season, rated, ended_at, score_blue, score_red, winner, seconds, result)
          values (${key ? `practice:${userId}:${key}` : null}, 0, 'practice', 'device', ${season?.id ?? null}, false, ${at},
            ${result.score[0]}, ${result.score[1]}, ${result.winner}, ${result.seconds}, ${tx.json(result)})
          on conflict (room, run) do nothing
          returning id`
        if (!match) return { match: null, duplicate: true }
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        await writeLines(tx, match.id, 'practice', season?.id ?? null, at, planMatch(result, [{ slot, userId, left: false }], null))
        return { match: match.id, duplicate: false }
      })
    },

    /** Each player's current-season numbers and Fair Play, for the matchmaker (fresh and full for anyone without a row yet). */
    tickets: async (userIds: readonly string[], now = Date.now()): Promise<ArenaTicketsResponse> => {
      const season = shownSeason(now)
      const [ratings, fair] = userIds.length > 0 ? await Promise.all([ratingsOf(sql, userIds, season.id), fairPlayOf(sql, userIds)]) : [new Map<string, Rating>(), new Map<string, number>()]
      return {
        season: season.id,
        ratings: Object.fromEntries([...ratings].map(([id, r]) => [id, { mmr: r.mmr, rp: r.rp, games: r.games, fairPlay: fair.get(id) ?? ARENA_RANKED.fairPlay.max }])),
      }
    },

    /** `GET /arena/me`: the player's standing in the shown season, its totals (practice included) and favorites. */
    profile: async (userId: string, now = Date.now()): Promise<ArenaProfile> => {
      const season = shownSeason(now)
      const [ratings, mine, totals, favorites, fair, penalties, preseason] = await Promise.all([
        ratingsOf(sql, [userId], season.id),
        boardRows(sql, season.id, 1, userId),
        sql<ArenaProfile['totals'][]>`
          select count(*)::int as matches, count(*) filter (where outcome = 'win')::int as wins, count(*) filter (where outcome = 'loss')::int as losses,
            count(*) filter (where outcome = 'draw')::int as draws, coalesce(sum(kos), 0)::int as kos, coalesce(sum(scored), 0)::int as scored
          from arena_lines where user_id = ${userId} and season = ${season.id}`,
        sql<{ starter: string; matches: number; wins: number }[]>`
          select starter, count(*)::int as matches, count(*) filter (where outcome = 'win')::int as wins
          from arena_lines where user_id = ${userId} and season = ${season.id}
          group by starter order by matches desc, wins desc, starter limit 3`,
        fairPlayOf(sql, [userId]),
        sql<{ conduct: FairPlayPenalty['conduct']; change: number; at: Date }[]>`
          select conduct, change, at from arena_conduct where user_id = ${userId} and conduct <> 'finished' order by at desc limit 5`,
        sql<{ n: number }[]>`select count(*)::int as n from arena_lines where user_id = ${userId} and kind = 'ranked' and season is null`,
      ])
      const rating = ratings.get(userId) ?? freshRating()
      const row = mine[0]
      return {
        season,
        rating,
        tier: tierOf(rating.rp),
        place: row ? await placeOf(sql, season.id, userId) : null,
        totals: totals[0] ?? { matches: 0, wins: 0, losses: 0, draws: 0, kos: 0, scored: 0 },
        favorites: favorites.flatMap((f) => (isVersusPick(f.starter) ? [{ starter: f.starter, matches: f.matches, wins: f.wins }] : [])),
        fairPlay: { score: fair.get(userId) ?? ARENA_RANKED.fairPlay.max, penalties: penalties.map((p) => ({ conduct: p.conduct, change: p.change, at: p.at.getTime() })) },
        preseason: preseason[0]?.n ?? 0,
      }
    },

    /** `GET /arena/history`: the player's own matches ended before `before` (ms), newest first. */
    history: async (userId: string, before: number, limit: number): Promise<ArenaHistoryEntry[]> => {
      const rows = await sql<
        { id: string; at: Date; kind: MatchKind; team: number; outcome: Outcome; score_blue: number; score_red: number; starter: string; kos: number; deaths: number; scored: number; damage: number; rp_change: number | null; protected: boolean }[]
      >`
        select l.match_id as id, l.at, l.kind, l.team, l.outcome, m.score_blue, m.score_red, l.starter, l.kos, l.deaths, l.scored, l.damage, l.rp_change, l.protected
        from arena_lines l join arena_matches m on m.id = l.match_id
        where l.user_id = ${userId} and l.at < ${new Date(before)}
        order by l.at desc, l.match_id desc
        limit ${Math.min(Math.max(1, limit), HISTORY.max)}`
      return rows.flatMap((r) =>
        isVersusPick(r.starter)
          ? [{ id: r.id, at: r.at.getTime(), kind: r.kind, team: r.team === 1 ? 1 : 0, outcome: r.outcome, score: [r.score_blue, r.score_red], starter: r.starter, kos: r.kos, deaths: r.deaths, scored: r.scored, damage: r.damage, rp: r.rp_change, protected: r.protected }]
          : [],
      )
    },

    /** `GET /arena/leaderboard`: `season`'s top `limit` rows and the viewer's own (with their place), when they're on it. */
    leaderboard: async (season: number, limit: number, viewer: string | null): Promise<ArenaLeaderboard> => {
      const top = await boardRows(sql, season, Math.min(Math.max(1, limit), BOARD.max))
      const rows = top.map((r, i) => toBoardRow(r, i + 1))
      const shown = top.findIndex((r) => r.user_id === viewer)
      const own = viewer && shown < 0 ? (await boardRows(sql, season, 1, viewer))[0] : undefined
      const me = shown >= 0 ? (rows[shown] ?? null) : own ? toBoardRow(own, await placeOf(sql, season, own.user_id)) : null
      return { season: seasonById(season), rows, me }
    },

    /**
     * Sends `season`'s titles (`seasonReward`) to every player who earned one
     * and doesn't have it yet. Keys keep it once per player and season, so
     * it's safe on every instance and every tick. How many it sent.
     */
    rewardSeason: (season: number) =>
      sql.begin(async (tx) => {
        const key = `arena:season:${season}`
        const rows = await tx<RatingRow[]>`
          select user_id, season, mmr, rp, peak, games, protection from arena_ratings r
          where season = ${season} and games >= ${ARENA_REWARDS.minGames}
            and not exists (select 1 from gifts g where g.user_id = r.user_id and g.key = ${key})`
        let sent = 0
        for (const row of rows) {
          const reward = seasonReward(season, toRating(row))
          if (reward && (await sendGift(tx, row.user_id, reward.content, reward.reason, reward.key))) sent++
        }
        return sent
      }),
  }
}

export type ArenaStore = ReturnType<typeof arenaStore>

/** Defaults the routes read: history page size and board rows. */
export const ARENA_PAGES = { history: HISTORY.page, board: BOARD.rows } as const

/** How long after a season ends its titles go out, so reports the relay retries still count. */
const REWARD_GRACE_MS = 3_600_000

/** How often the season-end check runs. */
const REWARD_EVERY_MS = 3_600_000

/**
 * The season-end titles: every hour (and on boot), once the last season
 * ended `REWARD_GRACE_MS` ago, sends its rewards (`rewardSeason`).
 */
export const createArenaRewards = (arena: Pick<ArenaStore, 'rewardSeason'>) => {
  /** The season whose rewards are due at `now`, or null while none is. */
  const due = (now: number) => {
    const settled = seasonAt(now - REWARD_GRACE_MS)
    return settled && settled.id > 1 ? settled.id - 1 : null
  }
  const tick = async (now = Date.now()) => {
    const season = due(now)
    if (season === null) return
    try {
      const n = await arena.rewardSeason(season)
      if (n > 0) console.log(`arena season ${season}: ${n} titles sent`)
    } catch (err) {
      console.error('arena rewards failed', season, err)
    }
  }
  return {
    due,
    tick,
    /** Runs `tick` now and every `REWARD_EVERY_MS`, without keeping the process alive. */
    start: () => {
      void tick()
      setInterval(() => void tick(), REWARD_EVERY_MS).unref()
    },
  }
}
