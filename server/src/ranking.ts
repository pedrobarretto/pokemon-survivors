import { challengeProblem } from '../../src/game/challenge'
import type { DayKey } from '../../src/game/day'
import type { Difficulty } from '../../src/game/difficulty'
import { dexCounts } from '../../src/game/dex'
import { parseSaveData } from '../../src/game/meta'
import {
  BOARD_SIZE,
  BOARD_TIME_ZONE,
  clockAllows,
  freeHandle,
  RANKED,
  type Board,
  type BoardEntry,
  type ChallengeBoard,
  type ChallengePlace,
  type BoardPeriod,
  type ProfileName,
  type ProfileRun,
  type PublicProfile,
  type RunResult,
  type RunRanks,
} from '../../src/game/ranking'
import type { PlayableId } from '../../src/data/hatchlings'
import { RIBBON_TIERS, type RibbonTier } from '../../src/game/ribbons'
import type { Replay } from '../../src/game/replay'
import type { Sql } from './db'

/** Which board: a difficulty and a period, optionally one Pokémon or only the friends of `viewer`. */
export type BoardQuery = { difficulty: Difficulty; period: BoardPeriod; starter: PlayableId | null; friends: boolean; viewer: string | null }

/** Why a run's end was refused. `challenge`: a challenge run whose replay isn't its day's challenge (or came without one). */
export type FinishError = 'unknown' | 'mismatch' | 'clock' | 'challenge'

/** A run's end that went in, with its challenge day and whether it's the official attempt (null for any other run). */
export type Finished = { ok: true; challenge: DayKey | null; official: boolean | null }

type RunRow = { starter: PlayableId; stage: number; difficulty: Difficulty; survived: number; outcome: ProfileRun['outcome']; started_at: Date; verified: boolean | null }

const toRun = (r: RunRow): ProfileRun => ({
  starter: r.starter,
  stage: r.stage,
  difficulty: r.difficulty,
  time: r.survived,
  outcome: r.outcome,
  at: r.started_at.toISOString(),
  verified: r.verified,
})

type EntryRow = RunRow & { user_id: string; handle: string; name: string; rank: number }

const toEntry = (r: EntryRow): BoardEntry => ({ ...toRun(r), rank: r.rank, handle: r.handle, name: r.name })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres' unique violation. */
const isUniqueViolation = (err: unknown) => typeof err === 'object' && err !== null && 'code' in err && err.code === '23505'

/**
 * Ranked runs, boards, profiles and follows. Boards rank each player once, by
 * their best run (ties go to who did it first), and only list players with a
 * handle. Runs whose re-simulation failed (`checks.ts`) count nowhere; runs
 * still waiting for it count, marked. Day and week start at midnight and on Monday in `BOARD_TIME_ZONE`,
 * and a run counts for the period it started in.
 */
export const rankingStore = (sql: Sql) => {
  const touchUser = (userId: string) => sql`insert into users (id) values (${userId}) on conflict (id) do update set seen_at = now()`

  /** Every player's best run on a board, ranked, as a fragment to select from. */
  const ranked = ({ difficulty, period, starter, friends, viewer }: BoardQuery) => sql`
    with best as (
      select distinct on (r.user_id) r.user_id, r.starter, r.stage, r.difficulty, r.survived, r.outcome, r.started_at, r.verified
      from runs r
      where r.finished_at is not null and r.verified is not false and r.difficulty = ${difficulty}
        ${period === 'all' ? sql`` : sql`and r.started_at >= (date_trunc(${period}, now() at time zone ${BOARD_TIME_ZONE}) at time zone ${BOARD_TIME_ZONE})`}
        ${starter ? sql`and r.starter = ${starter}` : sql``}
        ${friends && viewer ? sql`and (r.user_id = ${viewer} or r.user_id in (select followee_id from follows where follower_id = ${viewer}))` : sql``}
      order by r.user_id, r.survived desc, r.started_at
    )
    select b.*, u.handle, u.name, (row_number() over (order by b.survived desc, b.started_at))::int as rank
    from best b join users u on u.id = b.user_id
    where u.handle is not null`

  /**
   * A day's challenge board as a fragment: every player's official attempt
   * (their first challenge run to finish), ranked like the other boards, with
   * how many are on it.
   */
  const challengeRanked = (day: DayKey, friends: boolean, viewer: string | null) => sql`
    select r.user_id, r.starter, r.stage, r.difficulty, r.survived, r.outcome, r.started_at, r.verified, u.handle, u.name,
      (row_number() over (order by r.survived desc, r.started_at))::int as rank,
      (count(*) over ())::int as total
    from runs r join users u on u.id = r.user_id
    where r.challenge = ${day}::date and r.official and r.finished_at is not null and r.verified is not false and u.handle is not null
      ${friends && viewer ? sql`and (r.user_id = ${viewer} or r.user_id in (select followee_id from follows where follower_id = ${viewer}))` : sql``}`

  const rankOf = async (query: BoardQuery, userId: string) => {
    const [row] = await sql<{ rank: number }[]>`select rank from (${ranked(query)}) board where user_id = ${userId}`
    return row?.rank ?? null
  }

  /** The handles taken that start with `base`, for `freeHandle`. */
  const takenLike = async (base: string) =>
    new Set((await sql<{ handle: string }[]>`select handle from users where left(handle, ${base.length}) = ${base}`).map((r) => r.handle))

  return {
    /** The player's handle and name, or null before they pick one. */
    profileName: async (userId: string): Promise<ProfileName | null> => {
      const [row] = await sql<{ handle: string | null; name: string | null }[]>`select handle, name from users where id = ${userId}`
      return row?.handle ? { handle: row.handle, name: row.name ?? row.handle } : null
    },

    /** Sets the player's handle and name. A handle someone else has comes back with a free one to suggest. */
    setProfileName: async (userId: string, profile: ProfileName): Promise<{ ok: true } | { ok: false; suggestion: string | null }> => {
      try {
        await sql`
          insert into users (id, handle, name) values (${userId}, ${profile.handle}, ${profile.name})
          on conflict (id) do update set handle = excluded.handle, name = excluded.name, seen_at = now()`
        return { ok: true }
      } catch (err) {
        if (!isUniqueViolation(err)) throw err
        return { ok: false, suggestion: freeHandle(profile.handle, await takenLike(profile.handle)) }
      }
    },

    /**
     * A start token: the id of a new run row. Null when the player started too
     * many runs lately. Old tokens that never finished are dropped on the way.
     */
    startRun: async (userId: string, challenge: DayKey | null = null) => {
      await touchUser(userId)
      const [recent] = await sql<{ n: number }[]>`
        select count(*)::int as n from runs where user_id = ${userId} and started_at > now() - make_interval(secs => ${RANKED.window})`
      if ((recent?.n ?? 0) >= RANKED.startsPerWindow) return null
      await sql`delete from runs where user_id = ${userId} and finished_at is null and started_at < now() - make_interval(days => ${RANKED.tokenDays})`
      const [row] = await sql<{ id: string }[]>`insert into runs (user_id, challenge) values (${userId}, ${challenge}::date) returning id`
      return row!.id
    },

    /**
     * Records how the run of `token` ended, if the wall clock since the token
     * allows that much play (`clockAllows`). A victory that goes on into endless
     * mode ends again later: the same run may only grow, on the same Pokémon and level.
     * A challenge run must bring its day's challenge as its replay (`challengeProblem`);
     * the first one of the player's day to finish is their official attempt.
     */
    finishRun: (userId: string, token: string, result: RunResult, replay: Replay | null): Promise<Finished | { ok: false; error: FinishError }> =>
      sql.begin(async (tx) => {
        if (!UUID.test(token)) return { ok: false, error: 'unknown' } as const
        const [run] = await tx<{ elapsed: number; finished: boolean; starter: string | null; difficulty: string | null; survived: number | null; challenge: DayKey | null; official: boolean | null }[]>`
          select extract(epoch from now() - started_at)::float8 as elapsed, finished_at is not null as finished, starter, difficulty, survived,
            challenge::text as challenge, official
          from runs where id = ${token} and user_id = ${userId} for update`
        if (!run) return { ok: false, error: 'unknown' } as const
        if (run.finished && (run.starter !== result.starter || run.difficulty !== result.difficulty || (run.survived ?? 0) > result.time)) {
          return { ok: false, error: 'mismatch' } as const
        }
        if (!clockAllows(run.elapsed, result.time)) return { ok: false, error: 'clock' } as const
        if (run.challenge && (!replay || challengeProblem(replay.start, run.challenge))) return { ok: false, error: 'challenge' } as const
        let official = run.official
        if (run.challenge && !run.finished) {
          // The player's row makes two challenge runs finishing at once take turns.
          await tx`select id from users where id = ${userId} for update`
          const [taken] = await tx<{ taken: boolean }[]>`
            select exists (select 1 from runs where user_id = ${userId} and challenge = ${run.challenge}::date and official) as taken`
          official = !taken?.taken
        }
        await tx`
          update runs set finished_at = now(), starter = ${result.starter}, stage = ${result.stage}, difficulty = ${result.difficulty},
            survived = ${result.time}, outcome = ${result.outcome}, level = ${result.level}, kills = ${result.kills}, version = ${result.version},
            replay = ${replay ? tx.json(replay) : null}, verified = null, checked_at = null, check_ms = null, official = ${official}
          where id = ${token}`
        return { ok: true, challenge: run.challenge, official } as const
      }),

    /** A finished run waiting for its re-simulation: what it reported, when it started, and its replay. Null when there's nothing to check. */
    runToCheck: async (id: string) => {
      const [row] = await sql<{ user_id: string; survived: number; kills: number; level: number; started_at: Date; replay: unknown }[]>`
        select user_id, survived, kills, level, started_at, replay from runs where id = ${id} and finished_at is not null and replay is not null and verified is null`
      return row ? { userId: row.user_id, time: row.survived, kills: row.kills, level: row.level, startedAt: row.started_at, replay: row.replay } : null
    },

    /**
     * Stores a check's verdict, unless the run grew since (endless mode sent it
     * again: that newer report gets its own check). A verified run's replay
     * isn't needed anymore; a failed one keeps it, to look into.
     */
    setVerified: async (id: string, time: number, ok: boolean, ms: number | null) => {
      await sql`
        update runs set verified = ${ok}, checked_at = now(), check_ms = ${ms}, replay = case when ${ok} then null else replay end
        where id = ${id} and survived = ${time} and verified is null`
    },

    /** Forgets the replay of a run no check can judge (recorded under older rules): it stays unverified, like a run sent without one. */
    dropReplay: async (id: string) => {
      await sql`update runs set replay = null where id = ${id} and verified is null`
    },

    /** Runs still waiting for a check, oldest first (after a restart). */
    uncheckedRuns: async () =>
      (await sql<{ id: string }[]>`select id from runs where verified is null and replay is not null and finished_at is not null order by finished_at`).map((r) => r.id),

    /** Where the player stands on their difficulty's day, week and total boards. */
    runRanks: async (userId: string, difficulty: Difficulty): Promise<RunRanks> => {
      const at = (period: BoardPeriod) => rankOf({ difficulty, period, starter: null, friends: false, viewer: null }, userId)
      const [day, week, all] = await Promise.all([at('day'), at('week'), at('all')])
      return { day, week, all }
    },

    /**
     * Where the player stands on `day`'s challenge board after a challenge
     * run: `official` says whether that run was their attempt; `rank` is their
     * attempt's place (null when it's not on the board).
     */
    challengePlace: async (userId: string, day: DayKey, official: boolean): Promise<ChallengePlace> => {
      const board = challengeRanked(day, false, null)
      const [row] = await sql<{ rank: number | null; total: number }[]>`
        select (select rank from (${board}) b where user_id = ${userId}) as rank, (select count(*) from (${board}) b)::int as total`
      return { day, official, rank: row?.rank ?? null, total: row?.total ?? 0 }
    },

    /** A day's challenge board: the top, the viewer's own line, how many took part and whether the viewer has made their attempt. */
    challengeBoard: async (day: DayKey, friends: boolean, viewer: string | null): Promise<ChallengeBoard> => {
      const [rows, [mine]] = await Promise.all([
        sql<(EntryRow & { total: number })[]>`
          select * from (${challengeRanked(day, friends, viewer)}) board
          where rank <= ${BOARD_SIZE} or user_id = ${viewer ?? ''}
          order by rank`,
        sql<{ attempted: boolean }[]>`select exists (select 1 from runs where user_id = ${viewer ?? ''} and challenge = ${day}::date and official) as attempted`,
      ])
      const me = rows.find((r) => r.user_id === viewer)
      return {
        day,
        entries: rows.filter((r) => r.rank <= BOARD_SIZE).map(toEntry),
        me: me ? toEntry(me) : null,
        total: rows[0]?.total ?? 0,
        attempted: viewer ? (mine?.attempted ?? false) : null,
      }
    },

    /**
     * Places for `day`'s ribbons: each verified official attempt by a player
     * with a handle (the board's players), with a competition rank (ties
     * share the better place) and how many there are.
     */
    ribbonPlaces: (day: DayKey) =>
      sql<{ user_id: string; rank: number; total: number }[]>`
        select r.user_id, (rank() over (order by r.survived desc))::int as rank, (count(*) over ())::int as total
        from runs r join users u on u.id = r.user_id
        where r.challenge = ${day}::date and r.official and r.verified is true and r.finished_at is not null and u.handle is not null`,

    /** The top of a board, and the viewer's own line wherever they are. */
    board: async (query: BoardQuery): Promise<Board> => {
      const rows = await sql<EntryRow[]>`
        select * from (${ranked(query)}) board
        where rank <= ${BOARD_SIZE} or user_id = ${query.viewer ?? ''}
        order by rank`
      const mine = rows.find((r) => r.user_id === query.viewer)
      return { entries: rows.filter((r) => r.rank <= BOARD_SIZE).map(toEntry), me: mine ? toEntry(mine) : null }
    },

    /**
     * A public profile by handle, as `viewer` sees it, or null. The title and
     * the Pokédex come from the player's synced save.
     */
    profile: async (handle: string, viewer: string | null): Promise<PublicProfile | null> => {
      const [user] = await sql<{ id: string; handle: string; name: string | null }[]>`select id, handle, name from users where handle = ${handle}`
      if (!user) return null
      const [records, recent, [counts], [save], ribbons] = await Promise.all([
        sql<RunRow[]>`
          select distinct on (difficulty) starter, stage, difficulty, survived, outcome, started_at, verified
          from runs where user_id = ${user.id} and finished_at is not null and verified is not false
          order by difficulty, survived desc, started_at`,
        sql<RunRow[]>`
          select starter, stage, difficulty, survived, outcome, started_at, verified
          from runs where user_id = ${user.id} and finished_at is not null and verified is not false
          order by started_at desc limit 10`,
        sql<{ followers: number; following: number; followed: boolean; follows_you: boolean; brought: number }[]>`
          select
            (select count(*)::int from follows where followee_id = ${user.id}) as followers,
            (select count(*)::int from follows where follower_id = ${user.id}) as following,
            (select count(*)::int from users where referred_by = ${user.id} and referral_credited_at is not null) as brought,
            exists (select 1 from follows where follower_id = ${viewer ?? ''} and followee_id = ${user.id}) as followed,
            exists (select 1 from follows where follower_id = ${user.id} and followee_id = ${viewer ?? ''}) as follows_you`,
        sql<{ data: unknown }[]>`select data from saves where user_id = ${user.id}`,
        // Ribbons as the server sent them: they show before the game claims them.
        sql<{ tier: string; n: number }[]>`
          select payload->'ribbon'->>'tier' as tier, count(*)::int as n from gifts where user_id = ${user.id} and kind = 'ribbon' group by 1`,
      ])
      const data = parseSaveData(save?.data)
      const dex = dexCounts(data.dex)
      return {
        handle: user.handle,
        name: user.name ?? user.handle,
        title: data.title,
        dex: { seen: dex.seen, caught: dex.caught },
        records: Object.fromEntries(records.map((r) => [r.difficulty, toRun(r)])),
        recent: recent.map(toRun),
        followers: counts?.followers ?? 0,
        following: counts?.following ?? 0,
        followed: counts?.followed ?? false,
        followsYou: counts?.follows_you ?? false,
        brought: counts?.brought ?? 0,
        ribbons: Object.fromEntries(RIBBON_TIERS.map((tier) => [tier, ribbons.find((r) => r.tier === tier)?.n ?? 0])) as Record<RibbonTier, number>,
        self: viewer === user.id,
      }
    },

    /**
     * Follows (or stops following) the player with `handle`. Returns whether
     * `userId` follows them now and their follower count, or null when there's
     * no such player or it's `userId` themselves.
     */
    follow: async (userId: string, handle: string, follow: boolean) => {
      const [target] = await sql<{ id: string }[]>`select id from users where handle = ${handle}`
      if (!target || target.id === userId) return null
      await touchUser(userId)
      if (follow) await sql`insert into follows (follower_id, followee_id) values (${userId}, ${target.id}) on conflict do nothing`
      else await sql`delete from follows where follower_id = ${userId} and followee_id = ${target.id}`
      const [row] = await sql<{ followers: number }[]>`select count(*)::int as followers from follows where followee_id = ${target.id}`
      return { followed: follow, followers: row?.followers ?? 0 }
    },
  }
}

export type RankingStore = ReturnType<typeof rankingStore>
