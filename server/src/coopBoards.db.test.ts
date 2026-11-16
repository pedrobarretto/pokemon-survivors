import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GEM_PLAY } from '../../src/data/gems'
import { dailyCoopChallenge } from '../../src/game/coopBoard'
import type { CoopReport } from '../../src/net/coopReport'
import { coopBoardStore, coopListing } from './coopBoards'
import type { Sql } from './db'
import { ownTestDatabase } from './testDatabase'

/**
 * The co-op boards' store against a real Postgres: the same throwaway
 * database as `arena.db.test.ts` (`ARENA_TEST_DATABASE_URL`, wiped). Skipped
 * without it.
 */
const url = process.env.ARENA_TEST_DATABASE_URL

const DAY = '2026-11-02'

/** Noon in Brasília on `DAY`. */
const NOON = Date.UTC(2026, 10, 2, 15)

/** A run of `ids` (by slot) that lasted `time` s and ended at `endedAt`, as the relay reports it. */
const report = (ids: string[], time: number, endedAt = NOON, over: { run?: number; challenge?: string; difficulty?: string } = {}): CoopReport => ({
  v: 1,
  room: 'K7QF2',
  run: over.run ?? 1,
  region: 'sam',
  endedAt,
  seats: ids.map((userId, slot) => ({ slot, userId, handle: userId, left: false })),
  result: {
    v: 1,
    difficulty: over.difficulty ?? 'normal',
    challenge: over.challenge ?? null,
    time,
    outcome: 'wipe',
    kills: 0,
    players: ids.map((_, slot) => ({ slot, starter: 'charmander', stage: 0, branch: null, shiny: false, level: 10, kills: 0 })),
  },
  votes: ids.length,
})

describe.skipIf(!url)('co-op boards (Postgres)', () => {
  let sql: Sql
  let coop: ReturnType<typeof coopBoardStore>

  const put = (r: CoopReport) => coop.report(r, coopListing(r)!)

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(await ownTestDatabase(url!, 'coopboards'), 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
    coop = coopBoardStore(sql)
  })

  beforeEach(async () => {
    await sql`truncate coop_run_members, coop_runs, follows, users cascade`
    await sql`insert into users (id, handle, name) values ('a', 'a', 'Ash'), ('b', 'b', 'Brock'), ('c', 'c', 'Misty'), ('d', 'd', null)`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('stores a run once per room, run and end, even sent twice at the same time', async () => {
    const [x, y] = await Promise.all([put(report(['a', 'b'], 300)), put(report(['a', 'b'], 300))])
    expect([x.duplicate, y.duplicate].sort()).toEqual([false, true])
    expect(x.run).toBe(y.run)
    // The room code came back for another group later: a new run.
    expect((await put(report(['c', 'd'], 300, NOON + 60_000))).duplicate).toBe(false)
  })

  it("brings the day's run gems to the seats that stayed through a run of 5 minutes or more", async () => {
    const gems = async () => Object.fromEntries((await sql<{ id: string; gems: number }[]>`select id, gems from users where id in ('a', 'b', 'c')`).map((r) => [r.id, r.gems]))
    await put(report(['a', 'b'], GEM_PLAY.run.seconds - 1, NOON, { run: 1 }))
    expect(await gems()).toEqual({ a: 0, b: 0, c: 0 })
    const left = report(['a', 'b', 'c'], GEM_PLAY.run.seconds, NOON, { run: 2 })
    await put({ ...left, seats: left.seats.map((s) => (s.userId === 'c' ? { ...s, left: true } : s)) })
    // The day's first only: another long run that day adds nothing.
    await put(report(['a', 'b'], 900, NOON + 1000, { run: 3 }))
    expect(await gems()).toEqual({ a: GEM_PLAY.run.gems, b: GEM_PLAY.run.gems, c: 0 })
  })

  it('ranks each team once by its best run, ties to the earlier, with its members by slot', async () => {
    await put(report(['a', 'b'], 300, NOON, { run: 1 }))
    await put(report(['b', 'a'], 500, NOON + 1000, { run: 2 }))
    await put(report(['c', 'd'], 500, NOON + 500, { run: 3 }))
    await put(report(['a', 'c'], 100, NOON, { run: 4 }))
    const board = await coop.board({ size: 2, difficulty: 'normal', period: 'era1', friends: false, viewer: 'a' })
    expect(board.entries.map((e) => [e.rank, e.time, e.members.map((m) => m.handle)])).toEqual([
      [1, 500, ['c', 'd']],
      [2, 500, ['b', 'a']],
      [3, 100, ['a', 'c']],
    ])
    expect(board.entries[0]?.members[1]).toMatchObject({ handle: 'd', name: 'd', starter: 'charmander', supporter: null, og: false })
    expect(board.me?.rank).toBe(2)
    expect((await coop.board({ size: 3, difficulty: 'normal', period: 'era1', friends: false, viewer: 'a' })).entries).toEqual([])
  })

  it('keeps out teams with a banned member or one without a handle, and narrows to friends', async () => {
    await sql`insert into users (id) values ('e')`
    await put(report(['a', 'b'], 300, NOON, { run: 1 }))
    await put(report(['c', 'd'], 400, NOON, { run: 2 }))
    await put(report(['a', 'e'], 900, NOON, { run: 3 }))
    await sql`update users set banned_at = now() where id = 'c'`
    expect((await coop.board({ size: 2, difficulty: 'normal', period: 'era1', friends: false, viewer: null })).entries.map((e) => e.time)).toEqual([300])
    await sql`update users set banned_at = null where id = 'c'`
    await sql`insert into follows (follower_id, followee_id) values ('b', 'd')`
    const friends = await coop.board({ size: 2, difficulty: 'normal', period: 'era1', friends: true, viewer: 'b' })
    expect(friends.entries.map((e) => e.time)).toEqual([400, 300])
    expect((await coop.board({ size: 2, difficulty: 'normal', period: 'era1', friends: true, viewer: 'c' })).entries.map((e) => e.time)).toEqual([400])
  })

  it('keeps challenge runs on their day’s board only, counting its teams', async () => {
    const { difficulty } = dailyCoopChallenge(DAY)
    await put(report(['a', 'b'], 300, NOON, { run: 1, challenge: DAY, difficulty }))
    await put(report(['a', 'b'], 350, NOON, { run: 2, challenge: DAY, difficulty }))
    await put(report(['c', 'd'], 200, NOON, { run: 3, challenge: DAY, difficulty }))
    const day = await coop.challengeBoard(DAY, 2, false, 'c')
    expect(day).toMatchObject({ day: DAY, size: 2, difficulty, total: 2 })
    expect(day.entries.map((e) => e.time)).toEqual([350, 200])
    expect(day.me?.rank).toBe(2)
    expect((await coop.board({ size: 2, difficulty, period: 'era1', friends: false, viewer: null })).entries).toEqual([])
  })
})
