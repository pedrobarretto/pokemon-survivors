import type { BranchId } from '../../src/data/branches'
import type { PlayableId } from '../../src/data/hatchlings'
import {
  coopChallengeCounts,
  dailyCoopChallenge,
  isTeamSize,
  parseCoopResult,
  type CoopBoard,
  type CoopBoardEntry,
  type CoopChallengeBoard,
  type CoopMember,
  type CoopOutcome,
  type CoopResult,
  type CoopResultPlayer,
  type TeamSize,
} from '../../src/game/coopBoard'
import type { DayKey } from '../../src/game/day'
import type { Difficulty } from '../../src/game/difficulty'
import { isRecord } from '../../src/game/parse'
import { BOARD_SIZE, BOARD_TIME_ZONE, type BoardPeriod } from '../../src/game/ranking'
import type { CoopReport, CoopReportResponse } from '../../src/net/coopReport'
import type { Fragment } from 'postgres'
import type { Sql } from './db'
import { badgeOf, type SupporterRow } from './ranking'

/**
 * The co-op boards (Duplas, Trios, Squads) and the Desafio co-op do dia's:
 * runs the relay reports (`POST /coop/report`, signed like the Arena's), kept
 * when every seat is an account and the result checks out (`coopListing`),
 * and boards that rank each team (the same set of accounts) once, by its best
 * run. The rules are `game/coopBoard.ts`; this file stores and reads them.
 */

/* ---------------- Reading a report ---------------- */

const text = (v: unknown, max: number) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : null)

/** Seats a report may carry: a room seats at most 8 (the Arena's), co-op 4. */
const MAX_SEATS = 8

/**
 * A relay's co-op report, field by field (its `result` left as sent, for
 * `coopListing`), or null when its shape is off: seats in slot order, each
 * with an account id or null and whether it left.
 */
export const parseCoopReport = (raw: unknown): CoopReport | null => {
  if (!isRecord(raw) || raw.v !== 1 || !Array.isArray(raw.seats) || raw.seats.length > MAX_SEATS) return null
  const room = text(raw.room, 32)
  const region = text(raw.region, 16)
  const { run, endedAt, votes } = raw
  if (!room || !region || typeof run !== 'number' || !Number.isSafeInteger(run) || run < 0) return null
  if (typeof endedAt !== 'number' || !Number.isFinite(endedAt) || endedAt <= 0 || typeof votes !== 'number' || !Number.isInteger(votes) || votes < 0) return null
  const seats: CoopReport['seats'] = []
  for (const [slot, s] of raw.seats.entries()) {
    if (!isRecord(s) || s.slot !== slot || typeof s.left !== 'boolean' || (s.userId !== null && !text(s.userId, 64)) || (s.handle !== null && !text(s.handle, 64))) return null
    seats.push({ slot, userId: typeof s.userId === 'string' ? s.userId : null, handle: typeof s.handle === 'string' ? s.handle : null, left: s.left })
  }
  return { v: 1, room, run, region, endedAt, seats, result: raw.result, votes }
}

/** A seat of a listed run: its account, whether it left and what it played. */
export type CoopListingMember = CoopResultPlayer & { userId: string; left: boolean }

/** What a listed run stores: its parsed result, team size, team key and members by slot. */
export type CoopListing = { result: CoopResult; size: TeamSize; team: string; members: CoopListingMember[] }

/** At least this many clients agreed on the result: no lone client lists a run. */
export const MIN_VOTES = 2

/**
 * Whether a report goes on the boards, and how: 2 to 4 seats, every one a
 * distinct account, at least `MIN_VOTES` clients agreeing, a result that
 * parses for that many seats (`parseCoopResult`) and, for a challenge run,
 * the day's difficulty and a start on its day (`coopChallengeCounts`). Null
 * when it doesn't (the API answers `run: null`).
 */
export const coopListing = (r: CoopReport): CoopListing | null => {
  const size = r.seats.length
  if (!isTeamSize(size) || r.votes < MIN_VOTES) return null
  const users = r.seats.flatMap((s) => (s.userId ? [s.userId] : []))
  if (users.length !== size || new Set(users).size !== size) return null
  const result = parseCoopResult(r.result, size)
  if (!result) return null
  const day = result.challenge
  if (day !== null && (result.difficulty !== dailyCoopChallenge(day).difficulty || !coopChallengeCounts(day, r.endedAt, result.time))) return null
  const members = result.players.map((p, slot): CoopListingMember => ({ ...p, userId: users[slot]!, left: r.seats[slot]?.left ?? false }))
  return { result, size, team: teamKey(users), members }
}

/** A team's key: its members' user ids, sorted, joined by commas (ids never hold one). */
export const teamKey = (userIds: readonly string[]) => [...userIds].sort().join(',')

/* ---------------- The store ---------------- */

/** Which co-op board: a team size, a difficulty and a period, optionally only teams with `viewer` or someone they follow. */
export type CoopBoardQuery = { size: TeamSize; difficulty: Difficulty; period: BoardPeriod; friends: boolean; viewer: string | null }

type RankedRow = { id: string; difficulty: Difficulty; survived: number; outcome: CoopOutcome; ended_at: Date; mine: boolean; rank: number; total: number }

type MemberRow = SupporterRow & { run_id: string; starter: PlayableId; stage: number; branch: BranchId | null; shiny: boolean; handle: string; name: string | null }

const toMember = (r: MemberRow): CoopMember => {
  const { supporter, og } = badgeOf(r)
  return { handle: r.handle, name: r.name ?? r.handle, starter: r.starter, stage: r.stage, branch: r.branch, shiny: r.shiny, supporter, og }
}

export const coopBoardStore = (sql: Sql) => {
  /**
   * Each team's best run among the runs `scope` picks (a fragment on `coop_runs r`), ranked
   * (longest first, ties to the one that ended first), with `mine` (the viewer is on it) and
   * how many teams there are. Runs with a banned member or one without a handle count nowhere.
   */
  const ranked = (size: TeamSize, scope: Fragment, friends: boolean, viewer: string | null) => sql`
    with best as (
      select distinct on (r.team) r.id, r.difficulty, r.survived, r.outcome, r.ended_at
      from coop_runs r
      where r.size = ${size} and ${scope}
        and not exists (select 1 from coop_run_members m join users u on u.id = m.user_id where m.run_id = r.id and (u.handle is null or u.banned_at is not null))
        ${friends && viewer ? sql`and exists (select 1 from coop_run_members m where m.run_id = r.id and (m.user_id = ${viewer} or m.user_id in (select followee_id from follows where follower_id = ${viewer})))` : sql``}
      order by r.team, r.survived desc, r.ended_at
    )
    select b.*, exists (select 1 from coop_run_members m where m.run_id = b.id and m.user_id = ${viewer ?? ''}) as mine,
      (row_number() over (order by b.survived desc, b.ended_at, b.id))::int as rank,
      (count(*) over ())::int as total
    from best b`

  /** The top `BOARD_SIZE` of a ranking, the viewer's best team's line wherever it is, and how many teams it holds. */
  const read = async (size: TeamSize, scope: Fragment, friends: boolean, viewer: string | null) => {
    const rows = await sql<RankedRow[]>`
      select * from (
        select x.*, (row_number() over (partition by x.mine order by x.rank))::int as mine_n from (${ranked(size, scope, friends, viewer)}) x
      ) y
      where y.rank <= ${BOARD_SIZE} or (y.mine and y.mine_n = 1)
      order by y.rank`
    const ids = rows.map((r) => r.id)
    const members = ids.length
      ? await sql<MemberRow[]>`
          select m.run_id, m.starter, m.stage, m.branch, m.shiny, u.handle, u.name, u.supporter_points, u.og_tier, u.patreon_tier, u.patreon_best, u.supporter_public, u.supporter_since
          from coop_run_members m join users u on u.id = m.user_id
          where m.run_id = any(${ids}::uuid[])
          order by m.run_id, m.slot`
      : []
    const toEntry = (r: RankedRow): CoopBoardEntry => ({
      rank: r.rank,
      run: r.id,
      size,
      difficulty: r.difficulty,
      time: r.survived,
      outcome: r.outcome,
      at: r.ended_at.toISOString(),
      members: members.filter((m) => m.run_id === r.id).map(toMember),
    })
    const mine = rows.find((r) => r.mine)
    return { entries: rows.filter((r) => r.rank <= BOARD_SIZE).map(toEntry), me: mine ? toEntry(mine) : null, total: rows[0]?.total ?? 0 }
  }

  return {
    /**
     * Stores a listed run once per (room, run, end): a retry gets the stored
     * run back (`duplicate`). Members' accounts are made if new, so a run
     * never waits on a save sync.
     */
    report: (r: CoopReport, l: CoopListing): Promise<CoopReportResponse> =>
      sql.begin(async (tx) => {
        const at = new Date(r.endedAt)
        const [row] = await tx<{ id: string }[]>`
          insert into coop_runs (room, run, region, size, difficulty, challenge, survived, outcome, kills, votes, team, ended_at, result)
          values (${r.room}, ${r.run}, ${r.region}, ${l.size}, ${l.result.difficulty}, ${l.result.challenge}::date, ${l.result.time}, ${l.result.outcome},
            ${l.result.kills}, ${r.votes}, ${l.team}, ${at}, ${tx.json(l.result)})
          on conflict (room, run, ended_at) do nothing
          returning id`
        if (!row) {
          const [old] = await tx<{ id: string }[]>`select id from coop_runs where room = ${r.room} and run = ${r.run} and ended_at = ${at}`
          return { run: old?.id ?? null, duplicate: true }
        }
        const users = l.members.map((m) => m.userId)
        await tx`insert into users (id) select unnest(${users}::text[]) on conflict (id) do nothing`
        for (const m of l.members) {
          await tx`
            insert into coop_run_members (run_id, slot, user_id, starter, stage, branch, shiny, level, kills, "left")
            values (${row.id}, ${m.slot}, ${m.userId}, ${m.starter}, ${m.stage}, ${m.branch}, ${m.shiny}, ${m.level}, ${m.kills}, ${m.left})`
        }
        return { run: row.id, duplicate: false }
      }),

    /** `GET /coop/boards/:difficulty`: a size and difficulty's regular runs (never the challenge's) of the period, by team. */
    board: async ({ size, difficulty, period, friends, viewer }: CoopBoardQuery): Promise<CoopBoard> => {
      const since = period === 'all' ? sql`` : sql`and r.ended_at >= (date_trunc(${period}, now() at time zone ${BOARD_TIME_ZONE}) at time zone ${BOARD_TIME_ZONE})`
      const { entries, me } = await read(size, sql`r.challenge is null and r.difficulty = ${difficulty} ${since}`, friends, viewer)
      return { size, difficulty, period, entries, me }
    },

    /** `GET /coop/challenge/:day`: a day's Desafio co-op board for a size, each team's best try. */
    challengeBoard: async (day: DayKey, size: TeamSize, friends: boolean, viewer: string | null): Promise<CoopChallengeBoard> => {
      const { difficulty } = dailyCoopChallenge(day)
      const { entries, me, total } = await read(size, sql`r.challenge = ${day}::date and r.difficulty = ${difficulty}`, friends, viewer)
      return { day, size, difficulty, total, entries, me }
    },
  }
}

export type CoopBoardStore = ReturnType<typeof coopBoardStore>
