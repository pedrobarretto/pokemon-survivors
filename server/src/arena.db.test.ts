import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { seasonById, seasonReset, type ArenaResult } from '../../src/game/arenaRank'
import { arenaStore, parseArenaReport, planMatch, type ParsedReport } from './arena'
import type { Sql } from './db'

/**
 * The Arena's store against a real Postgres: set `ARENA_TEST_DATABASE_URL`
 * to a throwaway database (it's wiped), e.g. the README's local docker one.
 * Skipped without it. `db.ts` loads only then: CI's root tests run without
 * the server's packages.
 */
const url = process.env.ARENA_TEST_DATABASE_URL

const seat = (slot: number, team: 0 | 1) => ({ slot, team, starter: 'charmander', form: 'Charmander', bot: false, kos: 2, deaths: 1, scored: 10, damage: 500, assists: 1, dealt: 300, taken: 250, healed: 0, interrupts: 0 }) as const

/** Blue (slots 0, 1) beats Red (slots 2, 3). */
const result: ArenaResult = { v: 1, score: [40, 20], winner: 0, seconds: 420, objective: null, surrender: null, seats: [seat(0, 0), seat(1, 0), seat(2, 1), seat(3, 1)] }

const report = (over: Partial<Record<string, unknown>> = {}): ParsedReport =>
  parseArenaReport({
    v: 1,
    room: 'K7QF2',
    run: 1,
    kind: 'ranked',
    region: 'sa',
    endedAt: seasonById(1).startMs + 60_000,
    seats: [
      { slot: 0, userId: 'u_a', handle: null, left: false },
      { slot: 2, userId: 'u_b', handle: null, left: false },
    ],
    result,
    ...over,
  })!

/** A `before` past every test match. */
const LATER = seasonById(5).startMs

describe.skipIf(!url)('arena store (Postgres)', () => {
  let sql: Sql
  let arena: ReturnType<typeof arenaStore>

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
    arena = arenaStore(sql)
  })

  beforeEach(async () => {
    await sql`truncate arena_lines, arena_matches, arena_ratings, gifts, users cascade`
  })

  afterAll(async () => {
    await sql?.end()
  })

  const rating = async (user: string, season = 1) => (await sql<{ mmr: number; rp: number; peak: number; games: number; wins: number; losses: number }[]>`
    select mmr, rp, peak, games, wins, losses from arena_ratings where user_id = ${user} and season = ${season}`)[0]

  it('stores a report once per room and run, even sent twice at the same time', async () => {
    const [x, y] = await Promise.all([arena.report(report()), arena.report(report())])
    expect([x.duplicate, y.duplicate].sort()).toEqual([false, true])
    expect(x.match).toBe(y.match)
    expect((await arena.report(report())).duplicate).toBe(true)
    expect((await rating('u_a'))?.games).toBe(1)
    const [lines] = await sql<{ n: number }[]>`select count(*)::int as n from arena_lines`
    expect(lines?.n).toBe(2)
  })

  it('applies concurrent matches of the same players one after the other', async () => {
    await Promise.all([1, 2, 3, 4].map((run) => arena.report(report({ room: `R${run}`, endedAt: seasonById(1).startMs + run * 60_000 }))))
    expect(await rating('u_a')).toMatchObject({ games: 4, wins: 4 })
    expect(await rating('u_b')).toMatchObject({ games: 4, losses: 4 })
  })

  it('rates only a ranked match with enough humans, and keeps every match in history', async () => {
    expect((await arena.report(report({ kind: 'casual' }))).rated).toBe(false)
    const lone = { run: 2, endedAt: seasonById(1).startMs + 120_000, seats: [{ slot: 0, userId: 'u_a', handle: null, left: false }] }
    expect((await arena.report(report(lone))).rated).toBe(false)
    expect(await rating('u_a')).toBeUndefined()
    expect((await arena.history('u_a', LATER, 10)).map((e) => [e.kind, e.outcome, e.rp])).toEqual([
      ['ranked', 'win', null],
      ['casual', 'win', null],
    ])
    expect((await arena.report(report({ run: 3 }))).rated).toBe(true)
    expect(await rating('u_a')).toMatchObject({ games: 1, wins: 1 })
    expect(await rating('u_b')).toMatchObject({ games: 1, losses: 1 })
  })

  it('rates a human who left as a loss', async () => {
    await arena.report(report({ seats: [{ slot: 0, userId: 'u_a', handle: null, left: true }, { slot: 2, userId: 'u_b', handle: null, left: false }] }))
    expect(await rating('u_a')).toMatchObject({ games: 1, wins: 0, losses: 1 })
    const [entry] = await arena.history('u_a', LATER, 1)
    expect(entry?.outcome).toBe('loss')
  })

  it('rates only who left an unconfirmed match, and keeps the stayer’s line unrated', async () => {
    const seats = [
      { slot: 0, userId: 'u_a', handle: null, left: false },
      { slot: 2, userId: 'u_b', handle: null, left: true },
    ]
    expect((await arena.report(report({ confirmed: false, seats }))).rated).toBe(true)
    expect(await rating('u_b')).toMatchObject({ games: 1, wins: 0, losses: 1 })
    expect(await rating('u_a')).toMatchObject({ games: 0, wins: 0, losses: 0, mmr: 1000, rp: 0 })
    expect((await arena.history('u_a', LATER, 1)).map((e) => [e.outcome, e.rp])).toEqual([['win', null]])
    // Nobody left: nothing to rate.
    expect((await arena.report(report({ run: 2, confirmed: false }))).rated).toBe(false)
    expect((await rating('u_b'))?.games).toBe(1)
  })

  it('starts a new season from the last one’s reset rating', async () => {
    const last = { mmr: 1400, rp: 950, peak: 1000, games: 40 }
    await sql`insert into users (id) values ('u_a')`
    await sql`insert into arena_ratings (user_id, season, mmr, rp, peak, games) values ('u_a', 1, ${last.mmr}, ${last.rp}, ${last.peak}, ${last.games})`
    const now = seasonById(2).startMs + 60_000
    expect((await arena.tickets(['u_a', 'u_new'], now)).ratings).toEqual({ u_a: { mmr: seasonReset(last).mmr, rp: seasonReset(last).rp, games: 0 }, u_new: { mmr: 1000, rp: 0, games: 0 } })
    await arena.report(report({ endedAt: now }))
    const start = seasonReset(last)
    const [line] = planMatch(result, [{ slot: 0, userId: 'u_a', left: false }, { slot: 2, userId: 'u_b', left: false }], new Map([['u_a', start]]))
    expect(await rating('u_a', 2)).toMatchObject({ mmr: line?.change?.after.mmr, rp: line?.change?.after.rp, games: 1 })
    expect(await rating('u_a', 1)).toMatchObject({ rp: last.rp, games: last.games })
  })

  it('orders the board by RP, then peak, then who got there first, without banned or nameless players', async () => {
    const at = (minutes: number) => new Date(seasonById(1).startMs + minutes * 60_000)
    const rows = [
      { id: 'u_a', handle: 'a', rp: 500, peak: 600, at: at(30) },
      { id: 'u_b', handle: 'b', rp: 500, peak: 700, at: at(40) },
      { id: 'u_c', handle: 'c', rp: 500, peak: 600, at: at(10) },
      { id: 'u_d', handle: 'd', rp: 800, peak: 800, at: at(50) },
      { id: 'u_e', handle: 'e', rp: 900, peak: 900, at: at(5), banned: true },
      { id: 'u_f', handle: null, rp: 990, peak: 990, at: at(5) },
    ]
    for (const r of rows) {
      await sql`insert into users (id, handle, name, banned_at) values (${r.id}, ${r.handle}, ${r.handle ?? ''}, ${r.banned ? new Date() : null})`
      await sql`insert into arena_ratings (user_id, season, mmr, rp, peak, games, wins, updated_at) values (${r.id}, 1, 1000, ${r.rp}, ${r.peak}, 3, 2, ${r.at})`
    }
    const board = await arena.leaderboard(1, 2, 'u_a')
    expect(board.rows.map((r) => [r.place, r.handle])).toEqual([
      [1, 'd'],
      [2, 'b'],
    ])
    expect(board.me).toMatchObject({ place: 4, handle: 'a', rp: 500, matches: 3, wins: 2 })
    expect((await arena.leaderboard(1, 10, null)).rows.map((r) => r.handle)).toEqual(['d', 'b', 'c', 'a'])
    expect((await arena.profile('u_c', seasonById(1).startMs + 3_600_000)).place).toBe(3)
  })

  it('sends a season’s title once', async () => {
    await sql`insert into users (id) values ('u_a'), ('u_b')`
    await sql`insert into arena_ratings (user_id, season, mmr, rp, peak, games) values ('u_a', 1, 1100, 350, 420, 12), ('u_b', 1, 1000, 0, 0, 1)`
    expect(await arena.rewardSeason(1)).toBe(1)
    expect(await arena.rewardSeason(1)).toBe(0)
    const gifts = await sql<{ user_id: string; payload: unknown }[]>`select user_id, payload from gifts`
    expect(gifts).toEqual([{ user_id: 'u_a', payload: { kind: 'title', title: 'arenaGreat' } }])
  })
})
