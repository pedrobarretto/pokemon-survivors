import { createHash, randomInt } from 'node:crypto'
import { challengeProblem, dailyChallenge } from '../../src/game/challenge'
import type { DayKey } from '../../src/game/day'
import type { Difficulty } from '../../src/game/difficulty'
import { dexCounts } from '../../src/game/dex'
import { parseSaveData } from '../../src/game/meta'
import {
  BOARD_PERIODS,
  BOARD_SIZE,
  BOARD_TIME_ZONE,
  clockAllows,
  runMode,
  freeHandle,
  RANKED,
  reportProblem,
  type Board,
  type BoardEntry,
  type ChallengeBoard,
  type ChallengePlace,
  type BoardPeriod,
  type ProfileName,
  type ProfileRun,
  type PublicProfile,
  type RunResult,
  type RunMode,
  type RunRanks,
} from '../../src/game/ranking'
import type { BranchId } from '../../src/data/branches'
import type { PlayableId } from '../../src/data/hatchlings'
import { RIBBON_TIERS, type RibbonTier } from '../../src/game/ribbons'
import { RULES_VERSION, TICK, type Replay } from '../../src/game/replay'
import { parseBagItems } from '../../src/game/bag'
import { boardListed, commitLag, sameSegment, settleReport, STREAM, streamedInTime, type ReplayChunk } from '../../src/game/replayStream'
import { supporterTier } from '../../src/game/supporters'
import type { TransactionSql } from 'postgres'
import { CHECKED, checkRank, rankOnShow, type BoardLine } from './checkRank'
import type { Sql } from './db'
import type { TokenRules } from './rulesGrace'

/** Which board: a mode (regular or Legend), a difficulty and a period, optionally one Pokémon or only the friends of `viewer`. */
export type BoardQuery = { mode: RunMode; difficulty: Difficulty; period: BoardPeriod; starter: PlayableId | null; friends: boolean; viewer: string | null }

/**
 * Why a run's end was refused. `challenge`: a challenge run whose replay isn't its day's challenge (or came without one).
 * `seed`: a replay of another seed than the one dealt with the token. `replaced`: a newer start token took its place.
 * `rewrite`: a replay that changes inputs its stream already committed (`settleReport`).
 */
export type FinishError = 'unknown' | 'replaced' | 'mismatch' | 'seed' | 'clock' | 'challenge' | 'rewrite'

/**
 * A run's end that went in, with its challenge day and whether it's the official attempt (null for any other run).
 * `listed`: whether it's on the public boards (with `STREAM_ENFORCE` on, only runs streamed in time are).
 * `ranks`: where the player stands on the day, week and total boards of its mode and difficulty (null off them,
 * and before they pick a handle).
 */
export type Finished = { ok: true; challenge: DayKey | null; official: boolean | null; listed: boolean; ranks: RunRanks }

/** A query of the pool, or of a transaction. */
type Q = Sql | TransactionSql

/** A run's `Standing` (`checkRank.ts`), each line with its board's period, and whether its player has a handle (`named`: only then are they listed). */
type Placed = { official: boolean; lines: readonly (BoardLine & { period: BoardPeriod })[]; named: boolean }

/**
 * Why a chunk was refused. `unknown`: no such run of the player's still playing (a finished one only takes
 * chunks after a victory, as endless mode goes on). `replaced`: a newer token took its place. `committed`:
 * another chunk already holds that `seq`. `gap`: it doesn't start where the stream is. `clock`: more play
 * than the wall clock since the start allows.
 */
export type ChunkError = 'unknown' | 'replaced' | 'committed' | 'gap' | 'clock'

type ChunkRow = { from_tick: number; to_tick: number; moves: number[]; events: ReplayChunk['events'] }

const toChunk = (r: ChunkRow): ReplayChunk => ({ from: r.from_tick, to: r.to_tick, moves: r.moves, events: r.events })

const sha256 = (key: string) => createHash('sha256').update(key).digest('hex')

/** Chunks of a run that never reported (a closed tab, a replaced token) are swept after this many hours. */
const CHUNK_HOURS = 24

/** `bag`: the Bag items the run took (`ReplayStart.bag`), empty for runs from before the column. */
type RunRow = { starter: PlayableId; stage: number; branch: BranchId | null; difficulty: Difficulty; survived: number; outcome: ProfileRun['outcome']; started_at: Date; bag: string[] | null }

/** A profile record: a run row and the mode of the boards it's on. */
type RecordRow = RunRow & { mode: RunMode }

/** A profile's records of one mode, by difficulty. */
const recordsOf = (rows: readonly RecordRow[], mode: RunMode) => Object.fromEntries(rows.filter((r) => r.mode === mode).map((r) => [r.difficulty, toRun(r)]))

const toRun = (r: RunRow): ProfileRun => ({
  starter: r.starter,
  stage: r.stage,
  branch: r.branch,
  difficulty: r.difficulty,
  time: r.survived,
  outcome: r.outcome,
  at: r.started_at.toISOString(),
  bag: parseBagItems(r.bag),
})

type SupporterRow = { supporter_points: number; supporter_public: boolean; supporter_since: Date | null }

/** A player's supporter badge, if they donated and show it. */
const badgeOf = (r: SupporterRow) => (r.supporter_public ? supporterTier(r.supporter_points) : null)

type EntryRow = RunRow & SupporterRow & { id: string; user_id: string; handle: string; name: string; rank: number }

const toEntry = (r: EntryRow): BoardEntry => {
  const supporter = badgeOf(r)
  return { ...toRun(r), rank: r.rank, handle: r.handle, name: r.name, supporter, supporterSince: supporter ? (r.supporter_since?.toISOString() ?? null) : null, run: r.id }
}

/**
 * How far apart two run times can be and still be the same report. Through
 * Supabase's transaction pooler the connection reads float8 with
 * `extra_float_digits = 0`, so `survived` comes back with 15 digits
 * (231.2333333334095 reads as 231.233333333409). A tick is 1/60 s, so this
 * still tells a run that grew apart.
 */
export const TIME_EPSILON = 1e-6

/** A replay's time and a stored one are the same report (`TIME_EPSILON`). */
export const sameTime = (a: number, b: number) => Math.abs(a - b) < TIME_EPSILON

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Postgres' unique violation. */
const isUniqueViolation = (err: unknown) => typeof err === 'object' && err !== null && 'code' in err && err.code === '23505'

/**
 * Ranked runs, boards, profiles and follows. Boards rank each player once, by
 * their best run (ties go to who did it first), and only list players with a
 * handle and never a banned one. A run counts as soon as it's reported: only one whose re-simulation
 * failed (`checks.ts`), or that an admin took off (`moderation.ts`), counts nowhere, and one kept off for its
 * stream (`unlisted`, with `streamEnforce`) only counts for its player. Day and week start at midnight and on Monday in `BOARD_TIME_ZONE`,
 * and a run counts for the period it started in.
 */
export const rankingStore = (sql: Sql, { streamEnforce = false }: { streamEnforce?: boolean } = {}) => {
  const touchUser = (userId: string) => sql`insert into users (id) values (${userId}) on conflict (id) do update set seen_at = now()`

  /**
   * Every player's best run on a board, ranked, as a fragment to select from.
   * `self` ranks that player too before they pick a handle (where their run
   * would stand once they do), for the checks.
   */
  const ranked = ({ mode, difficulty, period, starter, friends, viewer }: BoardQuery, q: Q = sql, self: string | null = null) => q`
    with best as (
      select distinct on (r.user_id) r.id, r.user_id, r.starter, r.stage, r.branch, r.difficulty, r.survived, r.outcome, r.started_at, r.bag
      from runs r
      where r.finished_at is not null and r.verified is not false and not r.unlisted and r.mode = ${mode} and r.difficulty = ${difficulty}
        ${period === 'all' ? q`` : q`and r.started_at >= (date_trunc(${period}, now() at time zone ${BOARD_TIME_ZONE}) at time zone ${BOARD_TIME_ZONE})`}
        ${starter ? q`and r.starter = ${starter}` : q``}
        ${friends && viewer ? q`and (r.user_id = ${viewer} or r.user_id in (select followee_id from follows where follower_id = ${viewer}))` : q``}
      order by r.user_id, r.survived desc, r.started_at
    )
    select b.*, u.handle, u.name, u.supporter_points, u.supporter_public, u.supporter_since, (row_number() over (order by b.survived desc, b.started_at))::int as rank
    from best b join users u on u.id = b.user_id
    where (u.handle is not null ${self ? q`or u.id = ${self}` : q``}) and u.banned_at is null`

  /**
   * A day's challenge board as a fragment: every player's official attempt
   * (their first challenge run to finish), ranked like the other boards, with
   * how many are on it.
   */
  const challengeRanked = (day: DayKey, friends: boolean, viewer: string | null) => sql`
    select r.id, r.user_id, r.starter, r.stage, r.branch, r.difficulty, r.survived, r.outcome, r.started_at, r.bag, u.handle, u.name, u.supporter_points, u.supporter_public, u.supporter_since,
      (row_number() over (order by r.survived desc, r.started_at))::int as rank,
      (count(*) over ())::int as total
    from runs r join users u on u.id = r.user_id
    where r.challenge = ${day}::date and r.official and r.finished_at is not null and r.verified is not false and not r.unlisted and u.handle is not null and u.banned_at is null
      ${friends && viewer ? sql`and (r.user_id = ${viewer} or r.user_id in (select followee_id from follows where follower_id = ${viewer}))` : sql``}`

  /**
   * Where the finished run `id` stands (`Standing`): whether it's a challenge's
   * official attempt, and the player's line on each board it's on (its mode
   * and difficulty's, and its Pokémon's, for each period), ranked as if they
   * had a handle. `named`: whether they have one. Null for no such run.
   */
  const standingOf = async (q: Q, id: string): Promise<Placed | null> => {
    const [run] = await q<{ user_id: string; mode: RunMode; starter: PlayableId; difficulty: Difficulty; official: boolean; named: boolean }[]>`
      select r.user_id, r.mode, r.starter, r.difficulty, r.official is true as official, u.handle is not null as named
      from runs r join users u on u.id = r.user_id where r.id = ${id} and r.finished_at is not null`
    if (!run) return null
    const lines = await Promise.all(
      BOARD_PERIODS.flatMap((period) =>
        (['global', 'starter'] as const).map(async (board): Promise<BoardLine & { period: BoardPeriod }> => {
          const query = { mode: run.mode, difficulty: run.difficulty, period, starter: board === 'starter' ? run.starter : null, friends: false, viewer: null }
          const [line] = await q<{ rank: number; id: string }[]>`select rank, id from (${ranked(query, q, run.user_id)}) board where user_id = ${run.user_id}`
          return { period, board, rank: line?.rank ?? null, mine: line?.id === id }
        }),
      ),
    )
    return { official: run.official, lines, named: run.named }
  }

  /**
   * Whether the determinism sample is due: no other run was kept for it in the
   * last `CHECKED.sampleEvery` seconds. Kept in the database, so it holds
   * across restarts and instances (two reports at once may both take one).
   */
  const sampleDue = async (q: Q, id: string) => {
    const [row] = await q<{ due: boolean }[]>`
      select coalesce(max(finished_at) < now() - make_interval(secs => ${CHECKED.sampleEvery}), true) as due
      from runs where check_rank = ${CHECKED.sampleRank} and id <> ${id}`
    return row?.due ?? true
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
     * A start token (the id of a new run row) and the seed its run must play:
     * the day's challenge seed for a Desafio do dia run, else a random one.
     * Null when the player started too many runs lately. The player's other
     * unfinished tokens of the same kind (regular or challenge) are replaced,
     * so nobody holds two seeds to pick from; replaced rows still count for the
     * rate limit. A regular token whose run already streamed chunks is being
     * played and stays: its seed is spent, and another tab or device asking
     * ahead (its lobby prefetching) must not kill a run in play. Challenge
     * tokens are always replaced (one attempt at a time: the first to finish is
     * the official one). Old tokens that never finished are dropped on the way.
     * The token is pinned to this API's `RULES_VERSION` (`runs.rules`), so the
     * next API can take its run on these rules if it straddles a deploy (`rulesGrace.ts`).
     */
    startRun: async (userId: string, challenge: DayKey | null = null) => {
      await touchUser(userId)
      return sql.begin(async (tx) => {
        // Two starts at once take turns, so neither misses the other's token (nor the rate limit).
        await tx`select pg_advisory_xact_lock(hashtextextended(${`runs:${userId}`}, 0))`
        const [recent] = await tx<{ n: number }[]>`
          select count(*)::int as n from runs where user_id = ${userId} and started_at > now() - make_interval(secs => ${RANKED.window})`
        if ((recent?.n ?? 0) >= RANKED.startsPerWindow) return null
        await tx`delete from runs where user_id = ${userId} and finished_at is null and started_at < now() - make_interval(days => ${RANKED.tokenDays})`
        await tx`
          update runs set replaced_at = now()
          where user_id = ${userId} and finished_at is null and replaced_at is null and (challenge is not null or stream_seq = 0) and (challenge is null) = ${challenge === null}`
        const seed = challenge ? dailyChallenge(challenge).seed : randomInt(0, RANKED.seedSpan)
        const [row] = await tx<{ id: string }[]>`
          insert into runs (user_id, challenge, seed, rules) values (${userId}, ${challenge}::date, ${seed}, ${RULES_VERSION}) returning id`
        return { token: row!.id, seed }
      })
    },

    /** The rules the API pinned on the player's token as it dealt it, and the token's age in seconds; null for no such token. */
    tokenRules: async (userId: string, token: string): Promise<TokenRules | null> => {
      if (!UUID.test(token)) return null
      const [row] = await sql<TokenRules[]>`
        select rules, extract(epoch from now() - issued_at)::float8 as age from runs where id = ${token} and user_id = ${userId}`
      return row ?? null
    },

    /**
     * Moves the clock of `token`'s run to now, as it really starts (the game
     * asks for its token ahead, on the menus). It only ever shortens the time
     * the run may last, so the game needn't be trusted with it. `replaced` when
     * a newer token took its place: that run can't report.
     */
    stampRun: async (userId: string, token: string): Promise<'ok' | 'unknown' | 'replaced'> => {
      if (!UUID.test(token)) return 'unknown'
      const [row] = await sql<{ replaced: boolean }[]>`
        update runs set started_at = case when replaced_at is null then now() else started_at end
        where id = ${token} and user_id = ${userId} and finished_at is null
        returning replaced_at is not null as replaced`
      return !row ? 'unknown' : row.replaced ? 'replaced' : 'ok'
    },

    /**
     * Takes chunk `seq` of the stream of `token`'s run (`src/game/replayStream.ts`): it must start where
     * the stream is and fit the wall clock since the run started (`clockAllows`). The same chunk again
     * (a retry whose answer got lost) is fine. Returns how late it came (`commitLag`), from the last
     * commitment, or from when the seed was dealt for the first; the run keeps its worst, and counts
     * those past `STREAM.lagTolerance` (`stream_late`).
     */
    putChunk: (userId: string, token: string, seq: number, chunk: ReplayChunk): Promise<{ ok: true; lag: number | null } | { ok: false; error: ChunkError }> =>
      sql.begin(async (tx) => {
        if (!UUID.test(token)) return { ok: false, error: 'unknown' } as const
        const [run] = await tx<
          { finished: boolean; replaced: boolean; outcome: RunResult['outcome'] | null; seq: number; ticks: number; base: number; elapsed: number; arrived: number; last: number | null }[]
        >`
          select finished_at is not null as finished, replaced_at is not null as replaced, outcome, stream_seq as seq, stream_ticks as ticks, stream_base as base,
            extract(epoch from now() - started_at)::float8 as elapsed, extract(epoch from now() - issued_at)::float8 as arrived,
            extract(epoch from stream_at - issued_at)::float8 as last
          from runs where id = ${token} and user_id = ${userId} for update`
        // A finished run only goes on after a victory (endless mode).
        if (!run || (run.finished && run.outcome !== 'victory')) return { ok: false, error: 'unknown' } as const
        if (run.replaced) return { ok: false, error: 'replaced' } as const
        if (seq < run.seq) {
          const [had] = await tx<ChunkRow[]>`select from_tick, to_tick, moves, events from run_chunks where run_id = ${token} and seq = ${seq}`
          const same = had !== undefined && had.from_tick === chunk.from && had.to_tick === chunk.to && sameSegment(toChunk(had), chunk)
          return same ? ({ ok: true, lag: null } as const) : ({ ok: false, error: 'committed' } as const)
        }
        if (seq !== run.seq || chunk.from !== run.ticks) return { ok: false, error: 'gap' } as const
        if (!clockAllows(run.elapsed, chunk.to * TICK)) return { ok: false, error: 'clock' } as const
        const lag = commitLag(chunk, run.base, run.arrived, run.last ?? 0)
        await tx`
          insert into run_chunks (run_id, seq, from_tick, to_tick, moves, events)
          values (${token}, ${seq}, ${chunk.from}, ${chunk.to}, ${tx.json(chunk.moves)}, ${tx.json(chunk.events.map((e) => [...e]))})`
        const late = lag > STREAM.lagTolerance
        await tx`
          update runs set stream_seq = ${seq + 1}, stream_ticks = ${chunk.to}, stream_at = now(), stream_lag = greatest(stream_lag, ${lag}),
            stream_late = stream_late + ${late ? 1 : 0}
          where id = ${token}`
        if (late) console.log(`stream ${token}: chunk ${seq} came ${lag.toFixed(1)} s late`)
        return { ok: true, lag } as const
      }),

    /** Forgets the chunks of runs that never reported (a closed tab, a replaced token): a day after they came, no run waits for them. */
    sweepChunks: async () => {
      const swept = await sql`delete from run_chunks where received_at < now() - make_interval(hours => ${CHUNK_HOURS})`
      if (swept.count > 0) console.log(`swept ${swept.count} stale replay chunks`)
    },

    /**
     * Records how the run of `token` ended, if the wall clock since the token
     * allows that much play (`clockAllows`). A victory that goes on into endless
     * mode ends again later: the same run may only grow, on the same Pokémon and level.
     * The replay must play the seed dealt with the token (`reportProblem`), and a replaced token can't report.
     * A challenge run must bring its day's challenge as its replay (`challengeProblem`);
     * the first one of the player's day to finish is their official attempt.
     * The replay must keep every input its stream committed (`settleReport`, else `rewrite`); it then
     * pins all of its ticks and the chunks it covers are deleted. A victory's report is timed like a chunk
     * (endless mode may go on from it, and a late one counts in `stream_late`); a faint's or a quit's isn't,
     * its tail being capped. Whether the run was streamed in time is stored and logged; with `streamEnforce`
     * a run that wasn't stays off the public boards for good (`unlisted`), and still counts for the player.
     * Then, on every report, the run's replay is kept for its check only when it's on show or drawn for the
     * sample (`checkRank`, stored in `check_rank`, where the verifier finds it: `claimCheck`), and dropped
     * otherwise: off the boards now, it can't climb on later in the same period. The replay is still written
     * first, since `settleReport` pinned its ticks. A new report frees any claim on the run and its count of
     * attempts, so the verifier takes the grown run again.
     */
    finishRun: (userId: string, token: string, result: RunResult, replay: Replay): Promise<Finished | { ok: false; error: FinishError }> =>
      sql.begin(async (tx) => {
        if (!UUID.test(token)) return { ok: false, error: 'unknown' } as const
        const [run] = await tx<
          {
            elapsed: number
            finished: boolean
            replaced: boolean
            seed: number | null
            starter: PlayableId
            difficulty: Difficulty
            survived: number
            outcome: RunResult['outcome']
            challenge: DayKey | null
            official: boolean | null
            streamed: number
            base: number
            digest: string | null
            lag: number | null
            arrived: number
            last: number | null
            unlisted: boolean
          }[]
        >`
          select extract(epoch from now() - started_at)::float8 as elapsed, finished_at is not null as finished, replaced_at is not null as replaced,
            seed::float8 as seed, starter, difficulty, survived, outcome, challenge::text as challenge, official,
            stream_ticks as streamed, stream_base as base, stream_digest as digest, stream_lag as lag, unlisted,
            extract(epoch from now() - issued_at)::float8 as arrived, extract(epoch from stream_at - issued_at)::float8 as last
          from runs where id = ${token} and user_id = ${userId} for update`
        if (!run) return { ok: false, error: 'unknown' } as const
        if (run.replaced) return { ok: false, error: 'replaced' } as const
        // An unfinished row has no report yet (those columns are null).
        const reported = run.finished ? { starter: run.starter, difficulty: run.difficulty, time: run.survived, outcome: run.outcome } : null
        const problem = reportProblem({ seed: run.seed, reported }, result, replay.start.seed)
        if (problem) return { ok: false, error: problem } as const
        if (!clockAllows(run.elapsed, result.time)) return { ok: false, error: 'clock' } as const
        if (run.challenge && challengeProblem(replay.start, run.challenge)) return { ok: false, error: 'challenge' } as const
        const chunks = (await tx<ChunkRow[]>`select from_tick, to_tick, moves, events from run_chunks where run_id = ${token} order by seq`).map(toChunk)
        const settled = settleReport(replay, { pinned: { ticks: run.base, digest: run.digest }, chunks, streamed: run.streamed }, sha256)
        if (!settled.ok) return { ok: false, error: 'rewrite' } as const
        const committed = Math.max(run.base, run.streamed)
        const fresh = settled.total > committed
        const lag = fresh && result.outcome === 'victory' ? commitLag({ from: committed, to: settled.total }, run.base, run.arrived, run.last ?? 0) : null
        const stream = { tail: settled.tail, lag: lag === null ? run.lag : Math.max(lag, run.lag ?? lag) }
        const inTime = streamedInTime(stream)
        const listed = !run.unlisted && boardListed(stream, streamEnforce)
        let official = run.official
        if (run.challenge && !run.finished) {
          // The player's row makes two challenge runs finishing at once take turns.
          await tx`select id from users where id = ${userId} for update`
          const [taken] = await tx<{ taken: boolean }[]>`
            select exists (select 1 from runs where user_id = ${userId} and challenge = ${run.challenge}::date and official) as taken`
          official = !taken?.taken
        }
        await tx`
          update runs set finished_at = now(), starter = ${result.starter}, stage = ${result.stage}, branch = ${result.branch}, difficulty = ${result.difficulty},
            survived = ${result.time}, outcome = ${result.outcome}, level = ${result.level}, kills = ${result.kills}, version = ${result.version},
            replay = ${tx.json(replay)}, verified = null, checked_at = null, check_ms = null, check_claimed_at = null, check_attempts = 0, official = ${official}, bag = ${tx.array([...replay.start.bag])}::text[],
            stream_base = ${settled.pin.ticks}, stream_digest = ${settled.pin.digest}, stream_lag = ${stream.lag}, stream_ok = ${inTime}, unlisted = ${!listed},
            stream_late = stream_late + ${lag !== null && lag > STREAM.lagTolerance ? 1 : 0},
            mode = ${runMode(result.starter)}
            ${fresh ? tx`, stream_at = now()` : tx``}
          where id = ${token}`
        await tx`delete from run_chunks where run_id = ${token} and to_tick <= ${settled.total}`
        // Decided at the door, on every report (endless mode reports again as it grows): the replay is kept only for a check.
        const standing = (await standingOf(tx, token))!
        const rank = checkRank(standing, rankOnShow(standing) === null && (await sampleDue(tx, token)))
        await tx`update runs set check_rank = ${rank}${rank === null ? tx`, replay = null` : tx``} where id = ${token}`
        // The result screen's places, on the boards as they list players (with a handle).
        const placeOn = (period: BoardPeriod) => (standing.named ? (standing.lines.find((l) => l.board === 'global' && l.period === period)?.rank ?? null) : null)
        const ranks: RunRanks = { day: placeOn('day'), week: placeOn('week'), all: placeOn('all') }
        const late = stream.lag === null ? '-' : `${stream.lag.toFixed(1)} s`
        const kept = rank === null ? '' : `, replay kept for its check (rank ${rank})`
        console.log(`stream ${token}: ${chunks.length} chunks, tail ${settled.tail} ticks, worst lag ${late}${inTime ? '' : streamEnforce ? ', unlisted' : ', not in time (observing)'}${kept}`)
        return { ok: true, challenge: run.challenge, official, listed, ranks } as const
      }),

    /**
     * Claims the next finished run waiting for its re-simulation, in check order (`check_rank`: official
     * attempts, then the best places, then the samples, then runs from before it, oldest first), for
     * `leaseSeconds`: another verifier skips it until then (`for update skip locked` keeps two from taking
     * the same one), and a claim whose verifier died runs out. Each claim counts an attempt (`check_attempts`).
     * Returns what it reported, when it started, its replay, whether it's a determinism sample and which
     * attempt this is; null when nothing waits.
     */
    claimCheck: async (leaseSeconds: number) => {
      const [row] = await sql<
        { id: string; survived: number; kills: number; level: number; started_at: Date; replay: unknown; check_rank: number | null; check_attempts: number }[]
      >`
        update runs set check_claimed_at = now(), check_attempts = check_attempts + 1
        where id = (
          select id from runs
          where verified is null and replay is not null and finished_at is not null
            and (check_claimed_at is null or check_claimed_at < now() - make_interval(secs => ${leaseSeconds}))
          order by check_rank, finished_at
          limit 1 for update skip locked
        )
        returning id, survived, kills, level, started_at, replay, check_rank, check_attempts`
      return row
        ? { id: row.id, time: row.survived, kills: row.kills, level: row.level, startedAt: row.started_at, replay: row.replay, sample: row.check_rank === CHECKED.sampleRank, attempt: row.check_attempts }
        : null
    },

    /** Whether the run with `id` is on show now (`rankOnShow`): an official attempt, or a line within the top (with its margin) of a board it's on. */
    shown: async (id: string) => {
      const standing = await standingOf(sql, id)
      return standing !== null && rankOnShow(standing) !== null
    },

    /**
     * Stores a check's verdict, unless the run grew since (endless mode sent it
     * again: that newer report gets its own check). A verified run's replay
     * isn't needed anymore; a failed one keeps it, to look into. A verified
     * run takes the branch its replay took over the one the game reported.
     */
    setVerified: async (id: string, time: number, verdict: { ok: true; branch: BranchId | null } | { ok: false }, ms: number | null) => {
      await sql`
        update runs set verified = ${verdict.ok}, checked_at = now(), check_ms = ${ms}${verdict.ok ? sql`, replay = null, branch = ${verdict.branch}` : sql``}
        where id = ${id} and abs(survived - ${time}) < ${TIME_EPSILON} and verified is null`
    },

    /** Takes back the attempt a claim counted (`claimCheck`), for a check that couldn't start through no fault of the run's (a replay of newer rules than the verifier's). */
    giveBackAttempt: async (id: string) => {
      await sql`update runs set check_attempts = greatest(check_attempts - 1, 0) where id = ${id}`
    },

    /** Forgets the replay of a run that won't be checked (not on show, or recorded under older rules): it stays unverified, like a run sent without one. */
    dropReplay: async (id: string) => {
      await sql`update runs set replay = null where id = ${id} and verified is null`
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
     * Places for `day`'s ribbons: each official attempt on the board (by a
     * player with a handle, not banned, not failed), with a competition rank (ties share
     * the better place) and how many there are.
     */
    ribbonPlaces: (day: DayKey) =>
      sql<{ user_id: string; rank: number; total: number }[]>`
        select r.user_id, (rank() over (order by r.survived desc))::int as rank, (count(*) over ())::int as total
        from runs r join users u on u.id = r.user_id
        where r.challenge = ${day}::date and r.official and r.verified is not false and not r.unlisted and r.finished_at is not null and u.handle is not null and u.banned_at is null`,

    /** A day's top `n` official attempts like `ribbonPlaces` ranks them (ties share a place), for the Discord podium, and how many took part. */
    podium: async (day: DayKey, n = 3) => {
      const rows = await sql<{ rank: number; total: number; handle: string; name: string | null; survived: number }[]>`
        select * from (
          select (rank() over (order by r.survived desc))::int as rank, (count(*) over ())::int as total, u.handle, u.name, r.survived, r.started_at
          from runs r join users u on u.id = r.user_id
          where r.challenge = ${day}::date and r.official and r.verified is not false and not r.unlisted and r.finished_at is not null and u.handle is not null and u.banned_at is null
        ) p
        where rank <= ${n} order by rank, started_at limit ${n}`
      return { places: rows.map((r) => ({ rank: r.rank, handle: r.handle, name: r.name ?? r.handle, survived: r.survived })), total: rows[0]?.total ?? 0 }
    },

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
     * A public profile by handle, as `viewer` sees it, or null (also for a
     * banned player). The title and the Pokédex come from the player's synced save.
     */
    profile: async (handle: string, viewer: string | null): Promise<PublicProfile | null> => {
      const [user] = await sql<(SupporterRow & { id: string; handle: string; name: string | null })[]>`
        select id, handle, name, supporter_points, supporter_public, supporter_since from users where handle = ${handle} and banned_at is null`
      if (!user) return null
      const self = viewer === user.id
      // One's own badge shows even when hidden from others, so the profile says what they see.
      const supporter = self ? supporterTier(user.supporter_points) : badgeOf(user)
      const [records, recent, [counts], [save], ribbons] = await Promise.all([
        sql<RecordRow[]>`
          select distinct on (mode, difficulty) mode, starter, stage, branch, difficulty, survived, outcome, started_at, bag
          from runs where user_id = ${user.id} and finished_at is not null and verified is not false
          order by mode, difficulty, survived desc, started_at`,
        sql<RunRow[]>`
          select starter, stage, branch, difficulty, survived, outcome, started_at, bag
          from runs where user_id = ${user.id} and finished_at is not null and verified is not false
          order by started_at desc limit 10`,
        sql<{ followers: number; following: number; followed: boolean; brought: number }[]>`
          select
            (select count(*)::int from follows where followee_id = ${user.id}) as followers,
            (select count(*)::int from follows where follower_id = ${user.id}) as following,
            (select count(*)::int from users where referred_by = ${user.id} and referral_credited_at is not null) as brought,
            exists (select 1 from follows where follower_id = ${viewer ?? ''} and followee_id = ${user.id}) as followed`,
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
        records: recordsOf(records, 'standard'),
        legendRecords: recordsOf(records, 'legend'),
        recent: recent.map(toRun),
        followers: counts?.followers ?? 0,
        following: counts?.following ?? 0,
        followed: counts?.followed ?? false,
        brought: counts?.brought ?? 0,
        ribbons: Object.fromEntries(RIBBON_TIERS.map((tier) => [tier, ribbons.find((r) => r.tier === tier)?.n ?? 0])) as Record<RibbonTier, number>,
        supporter,
        supporterSince: supporter ? (user.supporter_since?.toISOString() ?? null) : null,
        self,
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
