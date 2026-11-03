import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../data/arenaRanked'
import { createVersusGame } from './versus'
import {
  arenaResult,
  clampToFloor,
  conductOf,
  countsForRank,
  fairPlayAfter,
  fairPlayCounts,
  freshRating,
  humansOnBothSides,
  matchesToRanked,
  mayQueue,
  parseArenaResult,
  protectionAfter,
  queueHold,
  rateMatch,
  seasonAt,
  seasonById,
  seasonReset,
  splitTeams,
  tierOf,
  type QueueGroup,
  type RatedSeat,
} from './arenaRank'

const human = (team: 0 | 1, mmr = 1000, extra: Partial<RatedSeat> = {}): RatedSeat => ({ rating: { ...freshRating(), mmr }, team, scored: 0, kos: 0, objective: false, fair: true, ...extra })
const bot = (team: 0 | 1): RatedSeat => ({ rating: null, team, scored: 0, kos: 0, objective: false, fair: true })

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
    const next = seasonReset({ mmr: 1400, rp: 950, peak: 950, games: 40, protection: 80 })
    expect(next).toEqual({ mmr: 1300, rp: 600, peak: 600, games: 0, protection: 0 })
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

describe('the protection meter', () => {
  const { max, fill } = ARENA_RANKED.protection
  const rated = (protection: number, extra: Partial<RatedSeat> = {}) => human(0, 1000, { rating: { ...freshRating(), rp: 150, peak: 150, protection }, ...extra })

  it('fills by performance, up to the top, and stands still for a seat that left or idled', () => {
    expect(protectionAfter(10, 1, true, false)).toBe(10 + fill)
    expect(protectionAfter(10, 0.5, true, false)).toBe(10 + Math.round(fill / 2))
    expect(protectionAfter(max - 5, 1, true, false)).toBe(max)
    expect(protectionAfter(30, 1, false, false)).toBe(30)
  })

  it('full, takes a fair loss’s RP and empties, while MMR still moves', () => {
    const [shielded, , plain] = rateMatch([rated(max), human(0), rated(max - 1, { team: 1 }), human(1)], 1)
    expect(shielded).toMatchObject({ rp: 0, protected: true })
    expect(shielded!.after.protection).toBe(0)
    expect(shielded!.mmr).toBeLessThan(0)
    // One point short: no protection, and the loss fills it.
    const [short] = rateMatch([rated(max - 1), human(0), human(1), human(1)], 1)
    expect(short).toMatchObject({ protected: false })
    expect(short!.rp).toBeLessThan(0)
    expect(plain!.protected).toBe(false)
  })

  it('stays full through a win or a draw, and never covers a seat that left', () => {
    const [win] = rateMatch([rated(max), human(0), human(1), human(1)], 0)
    expect(win).toMatchObject({ protected: false })
    expect(win!.after.protection).toBe(max)
    const [left] = rateMatch([rated(max, { fair: false }), human(0), human(1), human(1)], 1)
    expect(left).toMatchObject({ protected: false })
    expect(left!.rp).toBeLessThan(0)
    expect(left!.after.protection).toBe(max)
  })

  it('isn’t spent on a loss the tier floor already holds', () => {
    const floor = human(0, 1000, { rating: { ...freshRating(), rp: 300, peak: 300, protection: max } })
    const [held] = rateMatch([floor, human(0), human(1), human(1)], 1)
    expect(held).toMatchObject({ rp: 0, protected: false })
    expect(held!.after.protection).toBe(max)
  })
})

describe('Fair Play', () => {
  const F = ARENA_RANKED.fairPlay

  it('counts public matches with another human, never bots alone, rooms or practice', () => {
    expect(fairPlayCounts('casual', 2)).toBe(true)
    expect(fairPlayCounts('ranked', 8)).toBe(true)
    expect(fairPlayCounts('casual', 1)).toBe(false)
    expect(fairPlayCounts('room', 8)).toBe(false)
    expect(fairPlayCounts('practice', 1)).toBe(false)
  })

  it('reads leaving from the relay and AFK only from a confirmed result', () => {
    expect(conductOf(true, 0, false)).toBe('left')
    expect(conductOf(false, F.afkAfter, true)).toBe('afk')
    expect(conductOf(false, F.afkAfter - 1, true)).toBe('finished')
    // A lone client's result can't call anyone AFK.
    expect(conductOf(false, 400, false)).toBe('finished')
  })

  it('costs leaving and idling, gives a little back per match finished, within 0 and the max', () => {
    expect(fairPlayAfter(F.max, 'left')).toBe(F.max + F.left)
    expect(fairPlayAfter(F.max, 'afk')).toBe(F.max + F.afk)
    expect(fairPlayAfter(F.max, 'finished')).toBe(F.max)
    expect(fairPlayAfter(50, 'finished')).toBe(50 + F.finish)
    expect(fairPlayAfter(5, 'left')).toBe(0)
  })

  it('two leaves shut the Ranqueada until enough matches are finished', () => {
    const twice = fairPlayAfter(fairPlayAfter(F.max, 'left'), 'left')
    expect(mayQueue('ranked', twice)).toBe(false)
    expect(mayQueue('casual', twice)).toBe(true)
    const need = matchesToRanked(twice)
    expect(need).toBeGreaterThan(0)
    let score = twice
    for (let i = 0; i < need; i++) score = fairPlayAfter(score, 'finished')
    expect(mayQueue('ranked', score)).toBe(true)
    expect(matchesToRanked(score)).toBe(0)
  })

  it('holds the queue per point under the hold line, never above it', () => {
    expect(queueHold(F.holdBelow)).toBe(0)
    expect(queueHold(F.max)).toBe(0)
    expect(queueHold(F.holdBelow - 1)).toBe(F.holdPerPoint)
    expect(queueHold(0)).toBe(F.holdBelow * F.holdPerPoint)
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

  it('takes humans on both sides for a Ranqueada (a party alone against bots isn’t one)', () => {
    expect(humansOnBothSides([0, 1])).toBe(true)
    expect(humansOnBothSides([0, 0])).toBe(false)
    expect(humansOnBothSides([])).toBe(false)
  })
})

describe('arenaResult', () => {
  it('reports a finished match and reads back from the wire, rejecting junk', () => {
    const g = createVersusGame(3, [])
    expect(arenaResult(g)).toBeNull()
    g.versus!.result = { winner: 1, surrender: null }
    g.versus!.score = [40, 60]
    const r = arenaResult(g, 1)!
    expect(r.seats).toHaveLength(8)
    expect(parseArenaResult(JSON.parse(JSON.stringify(r)))).toEqual(r)
    expect(parseArenaResult({ ...r, winner: 2 })).toBeNull()
    expect(parseArenaResult({ ...r, seats: [{ ...r.seats[0], starter: 'mewtwo' }] })).toBeNull()
    // An older build's result has no `afk`: none.
    const { afk: _, ...old } = r.seats[0]!
    expect(parseArenaResult({ ...r, seats: [old] })?.seats[0]?.afk).toBe(0)
  })

  it('reports a human’s longest stretch without acting, away time included', () => {
    const g = createVersusGame(3, [{ starter: 'charmander', name: 'A', team: 0 }])
    const me = g.players[0]!
    me.versus!.afk = 73.4
    g.versus!.result = { winner: 0, surrender: null }
    expect(arenaResult(g)!.seats[0]!.afk).toBe(73)
  })
})
