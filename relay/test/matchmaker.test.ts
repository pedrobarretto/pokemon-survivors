import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../../src/data/arenaRanked'
import { formMatches, parseQueueMessage, parseTickets, type Ticket } from '../src/matchmaker'

const T0 = 1_000_000
const { players: SIZE, botsAfter } = ARENA_RANKED.queue

let n = 0
const ticket = (over: Partial<Ticket> = {}): Ticket => {
  n++
  return { conn: `c${n}`, user: `u:user_${n}`, kind: 'casual', format: 'standard', party: null, build: 'b1', since: T0, mmr: 1000, hint: 'enam', ...over }
}
const many = (count: number, over: Partial<Ticket> = {}) => Array.from({ length: count }, () => ticket(over))

describe('matchmaking', () => {
  it('makes a match as soon as eight humans are close in MMR, four a side', () => {
    const { matches, waiting } = formMatches([...many(SIZE), ticket({ mmr: 3000 })], T0 + 1000)
    expect(matches).toHaveLength(1)
    const [m] = matches
    expect(m?.players).toHaveLength(SIZE)
    expect(m?.players.filter((p) => p.team === 0)).toHaveLength(SIZE / 2)
    expect(m).toMatchObject({ kind: 'casual', format: 'standard', ranked: false, build: 'b1', hint: 'enam' })
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

  it('makes a 3v3 of six, three a side, and never mixes formats', () => {
    const quick = many(6, { format: 'quick' })
    const { matches } = formMatches([...quick, ...many(2)], T0)
    expect(matches).toHaveLength(1)
    expect(matches[0]).toMatchObject({ format: 'quick', ranked: false })
    expect(matches[0]?.players.filter((p) => p.team === 0)).toHaveLength(3)
    expect(matches[0]?.players.filter((p) => p.team === 1)).toHaveLength(3)
    // Four of each format: neither pool is full.
    expect(formMatches([...many(4, { format: 'quick' }), ...many(4)], T0).matches).toHaveLength(0)
    // A party of four can't fit a team of three: it splits into a party of three and one more, still on one side each.
    const party = many(4, { party: 'BIG', format: 'quick' })
    const big = formMatches([...party, ...many(2, { format: 'quick' })], T0).matches[0]
    expect(big?.players).toHaveLength(6)
  })

  it('reads only well-formed queue messages and ratings', () => {
    const auth = { kind: 'guest', id: 'guest-aaaaaaaaaaaaaaaa' }
    const queue = { t: 'queue', kind: 'ranked', starter: 'pikachu', party: null, build: 'b1', auth }
    expect(parseQueueMessage(JSON.stringify(queue))).toEqual(queue)
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'practice' }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, auth: undefined }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, party: 'a b' }))).toBeNull()
    expect(parseQueueMessage('{"t":"cancel"}')).toEqual({ t: 'cancel' })
    // A 3v3 ticket says so; a ticket without a format (any client before formats) is a 4v4 one, and the 3v3 has no ranked queue.
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'casual', format: 'quick' }))).toEqual({ ...queue, kind: 'casual', format: 'quick' })
    expect(parseQueueMessage(JSON.stringify({ ...queue, format: 'standard' }))).toEqual(queue)
    expect(parseQueueMessage(JSON.stringify({ ...queue, format: 'quick' }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'casual', format: 'blitz' }))).toBeNull()
    expect(parseTickets({ season: 1, ratings: { user_1: { mmr: 1200, rp: 30, games: 2 }, user_2: { mmr: 'x' } } })).toEqual({ user_1: { mmr: 1200, rp: 30, games: 2 } })
  })
})
