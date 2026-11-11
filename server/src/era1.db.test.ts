import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { SEASON_ONE } from '../../src/data/seasons'
import { coopBoardStore, coopListing } from './coopBoards'
import type { Sql } from './db'
import { createEra1Rewards } from './era1'
import { rankingStore } from './ranking'
import { ownTestDatabase } from './testDatabase'

/**
 * The Era 1 Hall da Fama's rewards against a real Postgres: the same
 * throwaway database as `arena.db.test.ts` (`ARENA_TEST_DATABASE_URL`,
 * wiped). Skipped without it.
 */
const url = process.env.ARENA_TEST_DATABASE_URL

const START = Date.parse(SEASON_ONE.start)

/** An hour before Temporada 1, and an hour into it. */
const BEFORE = new Date(START - 3600_000)
const AFTER = new Date(START + 3600_000)

describe.skipIf(!url)('Era 1 rewards (Postgres)', () => {
  let sql: Sql
  let job: ReturnType<typeof createEra1Rewards>
  let coop: ReturnType<typeof coopBoardStore>

  /** A finished Normal run of `user` that lasted `seconds`, started `at`. */
  const run = (user: string, seconds: number, at: Date, over: { verified?: boolean | null; unlisted?: boolean; mode?: string } = {}) =>
    sql`insert into runs (user_id, started_at, finished_at, survived, outcome, difficulty, starter, stage, mode, verified, unlisted)
      values (${user}, ${at}, ${at}, ${seconds}, 'death', 'normal', 'charmander', 2, ${over.mode ?? 'standard'}, ${over.verified ?? null}, ${over.unlisted ?? false})`

  /** Players `p1`…`pN` with a handle; each `pK` ran `10000 - K` seconds before the season. */
  const field = async (n: number, mode = 'standard') => {
    for (let k = 1; k <= n; k++) {
      await sql`insert into users (id, handle, name) values (${`p${k}`}, ${`p${k}`}, ${`P${k}`}) on conflict do nothing`
      await run(`p${k}`, 10_000 - k, BEFORE, { mode })
    }
  }

  const gifts = async (user: string) => (await sql<{ key: string }[]>`select key from gifts where user_id = ${user} order by key`).map((r) => r.key)

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(await ownTestDatabase(url!, 'era1'), 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
    coop = coopBoardStore(sql)
    job = createEra1Rewards(sql, [rankingStore(sql), coop])
  })

  beforeEach(async () => {
    await sql`truncate gifts, coop_run_members, coop_runs, runs, follows, users cascade`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('sends nothing before it is due', async () => {
    await field(40)
    await job.tick(START + 3600_000)
    expect(await gifts('p1')).toEqual([])
  })

  it('crowns each board’s #1 and makes its top Legends, once, from runs before the season only', async () => {
    await field(40)
    // A season run longer than any: it isn't Era 1's.
    await run('p40', 99_999, AFTER)
    await job.tick(START + 25 * 3600_000)
    expect(await gifts('p1')).toEqual(['era1:champion:0', 'era1:champion:1', 'era1:champion:2'])
    expect(await gifts('p10')).toEqual(['era1:hall:0', 'era1:hall:1'])
    expect(await gifts('p11')).toEqual([])
    expect(await gifts('p40')).toEqual([])
    // Again: nothing doubles.
    expect(await job.award()).toBe(0)
  })

  it('follows the boards: a banned player, a failed or unlisted run and a player without a handle count nowhere', async () => {
    await field(40)
    await sql`update users set banned_at = now() where id = 'p1'`
    await sql`update runs set verified = false where user_id = 'p2'`
    await sql`update runs set unlisted = true where user_id = 'p3'`
    await sql`update users set handle = null where id = 'p4'`
    await job.award()
    expect(await gifts('p5')).toEqual(['era1:champion:0', 'era1:champion:1', 'era1:champion:2'])
    for (const id of ['p1', 'p2', 'p3', 'p4']) expect(await gifts(id)).toEqual([])
    // 36 players left on the board: a quarter of them, 9 places (p5 to p13).
    expect(await gifts('p13')).toEqual(['era1:hall:0', 'era1:hall:1'])
    expect(await gifts('p14')).toEqual([])
  })

  it('rewards a thin board’s first few, and nobody on a board under the minimum', async () => {
    await field(12, 'legend')
    await job.award()
    expect(await gifts('p1')).toHaveLength(3)
    expect(await gifts('p3')).toHaveLength(2)
    expect(await gifts('p4')).toEqual([])
    await sql`truncate gifts, runs cascade`
    await field(9)
    await job.award()
    expect(await gifts('p1')).toEqual([])
  })

  it('makes Legends of a co-op board’s top teams, never Champions', async () => {
    const ids = Array.from({ length: 24 }, (_, i) => `c${i}`)
    await sql`insert into users (id, handle) select unnest(${ids}::text[]), unnest(${ids}::text[])`
    for (let team = 0; team < 12; team++) {
      const seats = [ids[team * 2]!, ids[team * 2 + 1]!]
      const report = {
        v: 1 as const,
        room: `R${team}`,
        run: 1,
        region: 'sam',
        endedAt: BEFORE.getTime(),
        seats: seats.map((userId, slot) => ({ slot, userId, handle: userId, left: false })),
        result: { v: 1, difficulty: 'normal', challenge: null, time: 5000 - team, outcome: 'wipe', kills: 0, players: seats.map((_, slot) => ({ slot, starter: 'charmander', stage: 0, branch: null, shiny: false, level: 10, kills: 0 })) },
        votes: 2,
      }
      await coop.report(report, coopListing(report)!)
    }
    await job.award()
    expect(await gifts('c0')).toEqual(['era1:hall:0', 'era1:hall:1'])
    expect(await gifts('c1')).toEqual(['era1:hall:0', 'era1:hall:1'])
    // 12 teams: a quarter of them, 3.
    expect(await gifts('c5')).toEqual(['era1:hall:0', 'era1:hall:1'])
    expect(await gifts('c6')).toEqual([])
  })
})
