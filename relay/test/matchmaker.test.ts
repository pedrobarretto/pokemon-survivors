import { describe, expect, it } from 'vitest'
import { ARENA_RANKED } from '../../src/data/arenaRanked'
import { fairPlayGate, formMatches, parseQueueMessage, parseTickets, type Ticket } from '../src/matchmaker'

const T0 = 1_000_000
const { players: SIZE, botsAfter } = ARENA_RANKED.queue

let n = 0
const ticket = (over: Partial<Ticket> = {}): Ticket => {
  n++
  return { conn: `c${n}`, user: `u:user_${n}`, kind: 'casual', format: 'standard', party: null, size: null, build: 'b1', since: T0, mmr: 1000, holdUntil: 0, hint: 'enam', ...over }
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

  it("holds a 3v3 rematch's party for a team of three at most, and a held party's grace starts after its hold", () => {
    // A party that says 4 in a 3v3 waits for no more than a team: three of it play.
    const trio = many(3, { party: 'r-Q', size: 4, format: 'quick' })
    const quick = formMatches([...trio, ...many(3, { format: 'quick' })], T0 + 1000).matches[0]
    expect(quick?.players.filter((p) => trio.some((t) => t.conn === p.conn))).toHaveLength(3)
    // Fair Play holds one of a rematch's party: the whole party waits, then its grace for the rest runs from the hold's end.
    const hold = 30_000
    const pair = ticket({ party: 'r-H', size: 3, holdUntil: T0 + hold })
    const mate = ticket({ party: 'r-H', size: 3, since: T0 + hold })
    expect(formMatches([pair, mate, ...many(SIZE - 2)], T0 + hold - 1000).matches.flatMap((m) => m.players.map((p) => p.conn))).not.toContain(mate.conn)
    const after = formMatches([pair, mate, ...many(SIZE - 2)], T0 + hold + 2000)
    expect(after.matches.flatMap((m) => m.players.map((p) => p.conn))).not.toContain(pair.conn)
    expect(after.waiting.filter((w) => w.conn === pair.conn || w.conn === mate.conn)).toHaveLength(2)
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
    // A 3v3 party is at most a team of three.
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'casual', format: 'quick', party: 'r-K7QF2', size: 4 }))).toBeNull()
    expect(parseQueueMessage('{"t":"cancel"}')).toEqual({ t: 'cancel' })
    // A 3v3 ticket says so; a ticket without a format (any client before formats) is a 4v4 one, and the 3v3 has no ranked queue.
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'casual', format: 'quick' }))).toEqual({ ...queue, kind: 'casual', format: 'quick' })
    expect(parseQueueMessage(JSON.stringify({ ...queue, format: 'standard' }))).toEqual(queue)
    expect(parseQueueMessage(JSON.stringify({ ...queue, format: 'quick' }))).toBeNull()
    expect(parseQueueMessage(JSON.stringify({ ...queue, kind: 'casual', format: 'blitz' }))).toBeNull()
    expect(parseTickets({ season: 1, ratings: { user_1: { mmr: 1200, rp: 30, games: 2, fairPlay: 55 }, user_2: { mmr: 'x' } } })).toEqual({ user_1: { mmr: 1200, rp: 30, games: 2, fairPlay: 55 } })
    // An API from before Fair Play: a full score.
    expect(parseTickets({ ratings: { user_1: { mmr: 1200 } } }).user_1?.fairPlay).toBe(ARENA_RANKED.fairPlay.max)
  })
})
