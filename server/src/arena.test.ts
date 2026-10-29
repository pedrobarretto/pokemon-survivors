import { describe, expect, it } from 'vitest'
import { freshRating, seasonById, seasonReset, type ArenaResult, type ArenaSeatResult } from '../../src/game/arenaRank'
import { arenaSignature, createArenaRewards, parseArenaReport, planMatch, ratingSeason, startingRating, verifyArenaSignature, type ReportSeat } from './arena'

const seat = (slot: number, team: 0 | 1, bot = false, extra: Partial<ArenaSeatResult> = {}): ArenaSeatResult => ({
  slot,
  team,
  starter: 'charmander',
  form: 'Charmander',
  bot,
  kos: 2,
  deaths: 1,
  scored: 10,
  damage: 500,
  assists: 1,
  dealt: 300,
  taken: 250,
  healed: 0,
  interrupts: 0,
  ...extra,
})

/** Blue (slots 0, 1) beats Red (slots 2, 3), 2v2. */
const result: ArenaResult = { v: 1, score: [40, 20], winner: 0, seconds: 420, objective: 0, surrender: null, seats: [seat(0, 0), seat(1, 0), seat(2, 1), seat(3, 1)] }

const humans = (...ids: (string | null)[]): ReportSeat[] => ids.map((userId, slot) => ({ slot, userId, left: false }))

const report = (over: Record<string, unknown> = {}) => ({
  v: 1,
  room: 'K7QF2',
  run: 1,
  kind: 'ranked',
  region: 'sa',
  endedAt: seasonById(1).startMs + 60_000,
  seats: [
    { slot: 0, userId: 'u_a', handle: 'a', left: false },
    { slot: 2, userId: 'u_b', handle: 'b', left: false },
  ],
  result,
  ...over,
})

describe('verifyArenaSignature', () => {
  const body = JSON.stringify(report())

  it('takes the hex HMAC of the raw body with the shared secret, in any case', () => {
    expect(verifyArenaSignature(body, arenaSignature(body, 's3cret'), 's3cret')).toBe(true)
    expect(verifyArenaSignature(body, arenaSignature(body, 's3cret').toUpperCase(), 's3cret')).toBe(true)
  })

  it('refuses another secret, a changed body or no header', () => {
    expect(verifyArenaSignature(body, arenaSignature(body, 'other'), 's3cret')).toBe(false)
    expect(verifyArenaSignature(`${body} `, arenaSignature(body, 's3cret'), 's3cret')).toBe(false)
    expect(verifyArenaSignature(body, undefined, 's3cret')).toBe(false)
    expect(verifyArenaSignature(body, 'abc', 's3cret')).toBe(false)
  })
})

describe('parseArenaReport', () => {
  it('reads a report and its result', () => {
    expect(parseArenaReport(report())).toMatchObject({ room: 'K7QF2', run: 1, kind: 'ranked', seats: [{ slot: 0, userId: 'u_a', left: false }, { slot: 2, userId: 'u_b', left: false }] })
  })

  it('refuses seats that are no slot of the result, a slot twice or an account twice', () => {
    expect(parseArenaReport(report({ seats: [{ slot: 7, userId: 'u_a', handle: null, left: false }] }))).toBeNull()
    expect(parseArenaReport(report({ seats: [{ slot: 0, userId: 'u_a', handle: null, left: false }, { slot: 0, userId: 'u_b', handle: null, left: false }] }))).toBeNull()
    expect(parseArenaReport(report({ seats: [{ slot: 0, userId: 'u_a', handle: null, left: false }, { slot: 1, userId: 'u_a', handle: null, left: false }] }))).toBeNull()
    expect(parseArenaReport(report({ kind: 'practice' }))).toBeNull()
    expect(parseArenaReport(report({ result: { ...result, v: 2 } }))).toBeNull()
  })

  it('reads a report without `confirmed` as confirmed, and refuses one that isn’t a boolean', () => {
    expect(parseArenaReport(report())?.confirmed).toBe(true)
    expect(parseArenaReport(report({ confirmed: false }))?.confirmed).toBe(false)
    expect(parseArenaReport(report({ confirmed: 'no' }))).toBeNull()
  })
})

describe('ratingSeason', () => {
  const parsed = (over: Record<string, unknown> = {}) => parseArenaReport(report(over))!

  it('rates a ranked match with enough humans, in the season it ended', () => {
    expect(ratingSeason(parsed())?.id).toBe(1)
    expect(ratingSeason(parsed({ endedAt: seasonById(3).startMs }))?.id).toBe(3)
  })

  it('never rates casual, friends’ rooms, a lone human or a match before the first season', () => {
    expect(ratingSeason(parsed({ kind: 'casual' }))).toBeNull()
    expect(ratingSeason(parsed({ kind: 'room' }))).toBeNull()
    expect(ratingSeason(parsed({ seats: [{ slot: 0, userId: 'u_a', handle: 'a', left: false }] }))).toBeNull()
    expect(ratingSeason(parsed({ endedAt: seasonById(1).startMs - 1 }))).toBeNull()
  })

  it('rates an unconfirmed match only when an account left it', () => {
    const left = [
      { slot: 0, userId: 'u_a', handle: 'a', left: false },
      { slot: 2, userId: 'u_b', handle: 'b', left: true },
    ]
    expect(ratingSeason(parsed({ confirmed: false, seats: left }))?.id).toBe(1)
    expect(ratingSeason(parsed({ confirmed: false }))).toBeNull()
  })
})

describe('planMatch', () => {
  const ratings = new Map([
    ['a', freshRating()],
    ['b', freshRating()],
    ['c', freshRating()],
  ])

  it('lines up only the humans, and moves nothing unrated', () => {
    const lines = planMatch(result, humans('a', null, 'c', null), null)
    expect(lines.map((l) => [l.userId, l.outcome, l.change])).toEqual([
      ['a', 'win', null],
      ['c', 'loss', null],
    ])
  })

  it('rates winners up and losers down, bots filling the rest', () => {
    const [a, c] = planMatch(result, humans('a', null, 'c', null), ratings)
    expect(a?.change?.rp).toBeGreaterThan(0)
    expect(a?.change?.mmr).toBeGreaterThan(0)
    expect(c?.change?.mmr).toBeLessThan(0)
    expect(c?.change?.after.games).toBe(1)
  })

  it('rates a human who left as a loss, even on the winning side', () => {
    const seats: ReportSeat[] = [
      { slot: 0, userId: 'a', left: false },
      { slot: 1, userId: 'b', left: true },
      { slot: 2, userId: 'c', left: false },
    ]
    const [a, b] = planMatch(result, seats, ratings)
    expect(a?.outcome).toBe('win')
    expect(b?.outcome).toBe('loss')
    expect(b?.change?.mmr).toBeLessThan(0)
    expect(b?.change?.after.games).toBe(1)
    // A draw is a loss for whoever left too.
    const [, left] = planMatch({ ...result, winner: null }, seats, ratings)
    expect(left?.outcome).toBe('loss')
    expect(left?.change?.mmr).toBeLessThan(0)
  })

  it('rates only the leavers of an unconfirmed match, each as a loss, the stayers unrated', () => {
    // Red's c left; Blue's a reported a loss nobody can confirm.
    const seats: ReportSeat[] = [
      { slot: 0, userId: 'a', left: false },
      { slot: 2, userId: 'c', left: true },
    ]
    const lost = { ...result, winner: 1 as const }
    const [a, c] = planMatch(lost, seats, ratings, false)
    expect(a).toMatchObject({ outcome: 'loss', change: null })
    expect(c?.outcome).toBe('loss')
    // The same change a confirmed match gives a leaver: human share and tier floor included.
    expect(c?.change).toEqual(planMatch(result, seats, ratings)[1]?.change)
    expect(c?.change?.mmr).toBeLessThan(0)
    expect(c?.change?.after.games).toBe(1)
    // A leaver at their tier's floor stays there.
    const floored = new Map([['c', { mmr: 1000, rp: 300, peak: 300, games: 20 }]])
    expect(planMatch(lost, seats, floored, false)[1]?.change?.after.rp).toBe(300)
  })
})

describe('startingRating', () => {
  it('resets from the previous season, else starts fresh', () => {
    const last = { mmr: 1400, rp: 950, peak: 1000, games: 80 }
    expect(startingRating(last)).toEqual(seasonReset(last))
    expect(startingRating(last).games).toBe(0)
    expect(startingRating(null)).toEqual(freshRating())
  })
})

describe('createArenaRewards', () => {
  const { due } = createArenaRewards({ rewardSeason: async () => 0 })

  it('owes a season’s titles an hour after it ends, never before the first one ends', () => {
    expect(due(seasonById(1).startMs + 1)).toBeNull()
    expect(due(seasonById(2).startMs + 1)).toBeNull()
    expect(due(seasonById(2).startMs + 3_600_000)).toBe(1)
    expect(due(seasonById(5).endMs - 1)).toBe(4)
  })
})
