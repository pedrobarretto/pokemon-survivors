import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../../src/data/arenaRanked'
import { formMatches, parseQueueMessage, parseTickets, type Ticket } from '../src/matchmaker'

const T0 = 1_000_000
const { players: SIZE, botsAfter } = ARENA_RANKED.queue

let n = 0
const ticket = (over: Partial<Ticket> = {}): Ticket => {
  n++
  return { conn: `c${n}`, user: `u:user_${n}`, kind: 'casual', party: null, size: null, build: 'b1', since: T0, mmr: 1000, hint: 'enam', ...over }
}
const many = (count: number, over: Partial<Ticket> = {}) => Array.from({ length: count }, () => ticket(over))

describe('matchmaking', () => {
  it('makes a match as soon as eight humans are close in MMR, four a side', () => {
    const { matches, waiting } = formMatches([...many(SIZE), ticket({ mmr: 3000 })], T0 + 1000)
    expect(matches).toHaveLength(1)
    const [m] = matches
    expect(m?.players).toHaveLength(SIZE)
    expect(m?.players.filter((p) => p.team === 0)).toHaveLength(SIZE / 2)
    expect(m).toMatchObject({ kind: 'casual', ranked: false, build: 'b1', hint: 'enam' })
    expect(waiting).toEqual([expect.objectContaining({ found: 1 })])
  })

  it('widens the MMR window as the oldest ticket waits', () => {
    const old = ticket({ mmr: 1000 })
    const far = ticket({ mmr: 1300, since: T0 + 9000 })
    const fill = many(SIZE - 2, { mmr: 1000, since: T0 + 9000 })
    expect(formMatches([old, far, ...fill], T0 + 1000 * 2).matches).toHaveLength(0)
    // 100 + 25/s: a 300 MMR gap is in the window after 8 s.
    expect(formMatches([old, far, ...fill], T0 + 1000 * 8).matches[0]?.players).toHaveLength(SIZE)
  })

  it('fills with bots once the oldest waited long enough, and plays a lone ranked human unrated', () => {
    const solo = ticket({ kind: 'ranked' })
    const before = formMatches([solo], T0 + (botsAfter.ranked - 1) * 1000)
    expect(before.matches).toHaveLength(0)
    expect(before.waiting).toEqual([{ conn: solo.conn, kind: 'ranked', waited: botsAfter.ranked - 1, found: 1, botsIn: 1 }])
    expect(formMatches([solo], T0 + botsAfter.ranked * 1000).matches).toEqual([expect.objectContaining({ kind: 'ranked', ranked: false })])
    const pair = many(2, { kind: 'ranked' })
    expect(formMatches(pair, T0 + botsAfter.ranked * 1000).matches).toEqual([expect.objectContaining({ ranked: true })])
  })

  it('keeps a party on one team, and never mixes kinds, builds or tickets without an MMR', () => {
    const party = many(3, { party: 'FRIENDS', mmr: 2000 })
    const { matches } = formMatches([...party, ...many(5, { mmr: 2000 })], T0)
    const teams = new Set(matches[0]?.players.filter((p) => party.some((t) => t.conn === p.conn)).map((p) => p.team))
    expect(teams.size).toBe(1)

    const mixed = [...many(4), ...many(4, { build: 'b2' })]
    expect(formMatches(mixed, T0).matches).toHaveLength(0)
    expect(formMatches([...many(4), ...many(4, { kind: 'ranked' })], T0).matches).toHaveLength(0)
    const waitingForMmr = formMatches([...many(7), ticket({ mmr: null })], T0)
    expect(waitingForMmr.matches).toHaveLength(0)
  })

  it("holds a rematch's party for the rest of its team, up to the grace", () => {
    const first = ticket({ party: 'r-K7QF2-1-0', size: 2 })
    const solos = many(SIZE)
    const early = formMatches([first, ...solos], T0 + 1000)
    expect(early.matches[0]?.players.map((p) => p.conn)).not.toContain(first.conn)
    expect(early.waiting).toEqual([expect.objectContaining({ conn: first.conn, found: 1 })])
    // Its teammate comes in: the whole party plays, on one team.
    const mate = ticket({ party: 'r-K7QF2-1-0', size: 2, since: T0 + 5000 })
    const both = formMatches([first, mate, ...many(SIZE - 2)], T0 + 6000).matches[0]?.players.filter((p) => p.conn === first.conn || p.conn === mate.conn)
    expect(both).toHaveLength(2)
    expect(new Set(both?.map((p) => p.team)).size).toBe(1)
    // Nobody else came: past the grace it matches as it stands.
    const late = formMatches([first, ...many(SIZE - 1)], T0 + ARENA_RANKED.queue.partyGrace * 1000)
    expect(late.matches[0]?.players.map((p) => p.conn)).toContain(first.conn)
  })

  it('reads only well-formed queue messages and ratings', () => {
    const auth = { kind: 'guest', id: 'guest-aaaaaaaaaaaaaaaa' }
    const queue = { t: 'queue', kind: 'ranked', starter: 'pikachu', party: null, build: 'b1', auth }
    expect(parseQueueMessage(JSON.stringify(queue))).toEqual(queue)
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'practice' }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, auth: undefined }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, party: 'a b' }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, party: 'r-K7QF2', size: 3 }))).toEqual({ ...queue, party: 'r-K7QF2', size: 3 })
    expect(parseQueueMessage(JSON.stringify({ ...queue, party: 'r-K7QF2', size: 9 }))).toBeNull()
    expect(parseQueueMessage('{"t":"cancel"}')).toEqual({ t: 'cancel' })
    expect(parseTickets({ season: 1, ratings: { user_1: { mmr: 1200, rp: 30, games: 2 }, user_2: { mmr: 'x' } } })).toEqual({ user_1: { mmr: 1200, rp: 30, games: 2 } })
  })
})
