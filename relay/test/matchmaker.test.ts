import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../../src/data/arenaRanked'
import { fairPlayGate, formMatches, parseQueueMessage, parseTickets, type Ticket } from '../src/matchmaker'

const T0 = 1_000_000
const { players: SIZE, botsAfter } = ARENA_RANKED.queue

let n = 0
const ticket = (over: Partial<Ticket> = {}): Ticket => {
  n++
  return { conn: `c${n}`, user: `u:user_${n}`, kind: 'casual', party: null, build: 'b1', since: T0, mmr: 1000, holdUntil: 0, hint: 'enam', ...over }
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
    expect(before.waiting).toEqual([{ conn: solo.conn, kind: 'ranked', waited: botsAfter.ranked - 1, found: 1, botsIn: 1, hold: 0 }])
    expect(formMatches([solo], T0 + botsAfter.ranked * 1000).matches).toEqual([expect.objectContaining({ kind: 'ranked', ranked: false })])
    const pair = many(2, { kind: 'ranked' })
    expect(formMatches(pair, T0 + botsAfter.ranked * 1000).matches).toEqual([expect.objectContaining({ ranked: true })])
    // A party of two against bots alone isn't a Ranqueada.
    const duo = many(2, { kind: 'ranked', party: 'DUO' })
    expect(formMatches(duo, T0 + botsAfter.ranked * 1000).matches).toEqual([expect.objectContaining({ ranked: false })])
  })

  it('holds a low Fair Play’s ticket (and its party) out of matches, its wait starting when the hold ends', () => {
    const hold = 30_000
    const held = ticket({ holdUntil: T0 + hold })
    const during = formMatches([held, ...many(SIZE)], T0 + 1000)
    expect(during.matches[0]?.players).toHaveLength(SIZE)
    expect(during.matches[0]?.players.some((p) => p.conn === held.conn)).toBe(false)
    expect(during.waiting).toContainEqual(expect.objectContaining({ conn: held.conn, hold: 29, botsIn: botsAfter.casual }))
    // Held for 30 s: bots come 90 s after the hold, not after the queue.
    expect(formMatches([held], T0 + hold + (botsAfter.casual - 1) * 1000).matches).toHaveLength(0)
    expect(formMatches([held], T0 + hold + botsAfter.casual * 1000).matches).toHaveLength(1)
    const party = [ticket({ party: 'P', holdUntil: T0 + hold }), ticket({ party: 'P' })]
    expect(formMatches(party, T0 + 1000).waiting.map((w) => w.hold)).toEqual([29, 29])
  })

  it('refuses a Ranqueada under the Fair Play minimum and holds a low score in either queue', () => {
    const { rankedMin, holdBelow, holdPerPoint, max } = ARENA_RANKED.fairPlay
    expect(fairPlayGate('ranked', rankedMin - 1, T0)).toEqual({ ok: false })
    expect(fairPlayGate('ranked', max, T0)).toEqual({ ok: true, holdUntil: 0 })
    expect(fairPlayGate('casual', rankedMin - 1, T0)).toEqual({ ok: true, holdUntil: 0 })
    expect(fairPlayGate('casual', holdBelow - 10, T0)).toEqual({ ok: true, holdUntil: T0 + 10 * holdPerPoint * 1000 })
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

  it('reads only well-formed queue messages and ratings', () => {
    const auth = { kind: 'guest', id: 'guest-aaaaaaaaaaaaaaaa' }
    const queue = { t: 'queue', kind: 'ranked', starter: 'pikachu', party: null, build: 'b1', auth }
    expect(parseQueueMessage(JSON.stringify(queue))).toEqual(queue)
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'practice' }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, auth: undefined }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, party: 'a b' }))).toBeNull()
    expect(parseQueueMessage('{"t":"cancel"}')).toEqual({ t: 'cancel' })
    expect(parseTickets({ season: 1, ratings: { user_1: { mmr: 1200, rp: 30, games: 2, fairPlay: 55 }, user_2: { mmr: 'x' } } })).toEqual({ user_1: { mmr: 1200, rp: 30, games: 2, fairPlay: 55 } })
    // An API from before Fair Play: a full score.
    expect(parseTickets({ ratings: { user_1: { mmr: 1200 } } }).user_1?.fairPlay).toBe(ARENA_RANKED.fairPlay.max)
  })
})
