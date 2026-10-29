import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../data/arenaRanked'
import { createVersusGame } from './versus'
import { arenaResult, clampToFloor, countsForRank, freshRating, parseArenaResult, rateMatch, seasonAt, seasonById, seasonReset, splitTeams, tierOf, type QueueGroup, type RatedSeat } from './arenaRank'

const human = (team: 0 | 1, mmr = 1000, extra: Partial<RatedSeat> = {}): RatedSeat => ({ rating: { ...freshRating(), mmr }, team, scored: 0, kos: 0, objective: false, ...extra })
const bot = (team: 0 | 1): RatedSeat => ({ rating: null, team, scored: 0, kos: 0, objective: false })

describe('seasons', () => {
  it('start at 00:00 Brasília and last two weeks, back to back', () => {
    const s1 = seasonById(1)
    expect(new Date(s1.startMs).toISOString()).toBe('2026-11-02T03:00:00.000Z')
    expect(s1.endMs - s1.startMs).toBe(ARENA_RANKED.season.days * 86_400_000)
    expect(seasonAt(s1.startMs - 1)).toBeNull()
    expect(seasonAt(s1.endMs - 1)?.id).toBe(1)
    expect(seasonAt(s1.endMs)?.id).toBe(2)
  })
})

describe('tiers', () => {
  it('climb Poké Ball III → I, then Great, Ultra and Master', () => {
    expect(tierOf(0)).toMatchObject({ tier: 'poke', division: 3 })
    expect(tierOf(250)).toMatchObject({ tier: 'poke', division: 1, from: 200, next: 300 })
    expect(tierOf(300)).toMatchObject({ tier: 'great', division: 3 })
    expect(tierOf(899)).toMatchObject({ tier: 'ultra', division: 1 })
    expect(tierOf(5000)).toMatchObject({ tier: 'master', division: null, next: null })
  })

  it('never drops RP below the floor of the tier reached', () => {
    expect(clampToFloor(280, 320)).toBe(300)
    expect(clampToFloor(-10, 50)).toBe(0)
  })

  it('reset a season one tier down, MMR a quarter of the way home', () => {
    const next = seasonReset({ mmr: 1400, rp: 950, peak: 950, games: 40 })
    expect(next).toEqual({ mmr: 1300, rp: 600, peak: 600, games: 0 })
  })
})

describe('rateMatch', () => {
  it('moves even teams by the same amount both ways and gives the winners RP', () => {
    const seats = [human(0), human(0), human(1), human(1)]
    const [a, , c] = rateMatch(seats, 0)
    expect(a!.mmr).toBe(-c!.mmr)
    expect(a!.mmr).toBeGreaterThan(0)
    expect(a!.rp).toBe(ARENA_RANKED.rp.win)
  })

  it('scales everything by the share of humans and skips bots', () => {
    const seats = [human(0), bot(0), bot(0), bot(0), human(1), bot(1), bot(1), bot(1)]
    const changes = rateMatch(seats, 0)
    expect(changes[1]).toBeNull()
    expect(changes[0]!.rp).toBe(Math.round(ARENA_RANKED.rp.win * 0.25))
  })

  it('rewards performance and softens a loss with it', () => {
    const mid = { ...freshRating(), rp: 150, peak: 150 }
    const seats = [human(0, 1000, { scored: 100, kos: 5, rating: mid }), human(0, 1000, { rating: mid }), human(1), human(1)]
    const [carry, quiet] = rateMatch(seats, 1)
    expect(quiet!.rp).toBe(ARENA_RANKED.rp.loss)
    expect(carry!.rp).toBeGreaterThan(quiet!.rp)
  })
})

describe('the queue', () => {
  const solos = (...mmrs: number[]) => mmrs.map((mmr, i) => ({ id: String(i), mmrs: [mmr] }))
  /** Humans on Blue and on Red. */
  const sides = (groups: readonly QueueGroup[]) => {
    const { teams } = splitTeams(groups)!
    return [0, 1].map((t) => groups.reduce((n, g, i) => (teams[i] === t ? n + g.mmrs.length : n), 0))
  }

  it('keeps parties together and balances the teams', () => {
    const split = splitTeams([
      { id: 'a', mmrs: [1500, 1500] },
      { id: 'b', mmrs: [1000] },
      { id: 'c', mmrs: [1000] },
      { id: 'd', mmrs: [1500, 1500] },
    ])
    expect(split).toEqual({ teams: [0, 1, 0, 1], gap: 0, score: 0 })
  })

  it('splits two solo players across the teams instead of against bots together', () => {
    expect(splitTeams(solos(1000, 1000))!.teams).toEqual([0, 1])
    // Together would balance these exactly (2000 against two bots); apart still wins.
    expect(splitTeams(solos(900, 1100))!.teams).toEqual([0, 1])
    // As far apart as the queue ever matches them.
    expect(splitTeams(solos(700, 1300))!.teams).toEqual([0, 1])
  })

  it('splits six humans three a side for a 3v3, and refuses a party bigger than its team', () => {
    const six = solos(1000, 1100, 1200, 1300, 1400, 1500)
    const split = splitTeams(six, 3)!
    expect(split.teams.filter((t) => t === 0)).toHaveLength(3)
    expect(split.gap).toBeLessThanOrEqual(100)
    expect(splitTeams([{ id: 'p', mmrs: [1000, 1000, 1000, 1000] }], 3)).toBeNull()
  })

  it('never separates a party, even to spread its humans', () => {
    expect(splitTeams([{ id: 'p', mmrs: [1000, 1000] }])!.teams).toEqual([0])
    expect(sides([{ id: 'p', mmrs: [1000, 1000] }, ...solos(1000)])).toEqual([2, 1])
  })

  it('splits four humans two and two', () => {
    expect(sides(solos(1000, 1000, 1000, 1000))).toEqual([2, 2])
    expect(sides(solos(1300, 1200, 800, 700))).toEqual([2, 2])
    expect(sides([{ id: 'p', mmrs: [1000, 1000] }, ...solos(1100, 900)])).toEqual([2, 2])
  })

  it('refuses a split that can’t fit', () => {
    expect(splitTeams([{ id: 'a', mmrs: [1, 1, 1] }, { id: 'b', mmrs: [1, 1, 1] }, { id: 'c', mmrs: [1, 1, 1] }])).toBeNull()
  })

  it('rates only ranked matches with enough humans', () => {
    expect(countsForRank('ranked', 2)).toBe(true)
    expect(countsForRank('ranked', 1)).toBe(false)
    expect(countsForRank('ranked', 6, 'quick')).toBe(false)
    expect(countsForRank('casual', 8)).toBe(false)
  })
})

describe('arenaResult', () => {
  it('reports a finished match and reads back from the wire, rejecting junk', () => {
    const g = createVersusGame(3, [])
    expect(arenaResult(g)).toBeNull()
    g.versus!.result = { winner: 1 }
    g.versus!.score = [40, 60]
    const r = arenaResult(g, 1)!
    expect(r.seats).toHaveLength(8)
    expect(parseArenaResult(JSON.parse(JSON.stringify(r)))).toEqual(r)
    expect(parseArenaResult({ ...r, winner: 2 })).toBeNull()
    expect(parseArenaResult({ ...r, seats: [{ ...r.seats[0], starter: 'mewtwo' }] })).toBeNull()
  })
})
