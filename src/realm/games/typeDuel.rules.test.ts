import { describe, expect, it } from 'vitest'
import { tableGame } from '../../net/realmTables'
import { bankWins, dealDeck, DUEL, duelWinner, typeDuelRules as R, type DuelCard, type DuelState } from './typeDuel.rules'

const card = (type: DuelCard['type'], power: number, id = 0): DuelCard => ({ id, type, power, dex: 1 })

/** Plays both seats' first card each round until the match ends. */
const playOut = (s: DuelState, pick: (s: DuelState, seat: number) => number = (x, seat) => x.seats[seat]!.hand[0]!.id) => {
  let rounds = 0
  while (!s.over) {
    s = R.play(s, 0, pick(s, 0))!
    s = R.play(s, 1, pick(s, 1))!
    rounds++
  }
  return { s, rounds }
}

describe('type duel', () => {
  it('resolves by the type triangle, then power, then nobody', () => {
    expect(duelWinner(card('fire', 2), card('grass', 12))).toBe(0)
    expect(duelWinner(card('fire', 12), card('water', 2))).toBe(1)
    expect(duelWinner(card('grass', 3), card('water', 11))).toBe(0)
    expect(duelWinner(card('water', 5), card('water', 9))).toBe(1)
    expect(duelWinner(card('grass', 7), card('grass', 7))).toBeNull()
  })

  it('wins with three of a type or one of each', () => {
    expect(bankWins([card('fire', 2), card('fire', 3), card('fire', 4)])).toBe(true)
    expect(bankWins([card('fire', 2), card('water', 3), card('grass', 4)])).toBe(true)
    expect(bankWins([card('fire', 2), card('fire', 3), card('water', 4)])).toBe(false)
  })

  it('deals the same decks from the same seed, with every type and legal powers', () => {
    const deck = dealDeck(42)
    expect(dealDeck(42)).toEqual(deck)
    expect(deck).toHaveLength(DUEL.deck)
    expect(new Set(deck.map((c) => c.id)).size).toBe(DUEL.deck)
    for (const type of ['fire', 'water', 'grass'] as const) expect(deck.filter((c) => c.type === type).length).toBeGreaterThanOrEqual(6)
    for (const c of deck) expect(c.power).toBeGreaterThanOrEqual(DUEL.power.min), expect(c.power).toBeLessThanOrEqual(DUEL.power.max)
  })

  it('waits for both picks, refuses a second pick or a card not in hand, then reveals', () => {
    const s0 = R.start(7)
    expect(R.pending(s0)).toEqual([0, 1])
    const a = s0.seats[0].hand[0]!
    expect(R.play(s0, 0, 99)).toBeNull()
    const s1 = R.play(s0, 0, a.id)!
    expect(R.pending(s1)).toEqual([1])
    expect(R.play(s1, 0, s0.seats[0].hand[1]!.id)).toBeNull()
    const b = s1.seats[1].hand[0]!
    const s2 = R.play(s1, 1, b.id)!
    expect(s2.last).toEqual({ duel: 1, round: 1, cards: [a, b], winner: duelWinner(a, b), end: null })
    expect(s2.round).toBe(2)
    expect(s2.seats[0].hand).toHaveLength(DUEL.hand)
    expect(s2.seats[0].hand.some((c) => c.id === a.id)).toBe(false)
    expect(R.pending(s2)).toEqual([0, 1])
  })

  it('settles a duel on a winning bank and deals both seats fresh hands', () => {
    for (let seed = 0; seed < 40; seed++) {
      let s = R.start(seed)
      while (s.duel === 1 && !s.over) s = R.play(R.play(s, 0, s.seats[0].hand[0]!.id)!, 1, s.seats[1].hand[0]!.id)!
      const end = s.last!.end!
      expect(end).not.toBeNull()
      if (end.winner !== null && s.last!.round < DUEL.rounds) expect(bankWins(end.banks[end.winner === 0 ? 0 : 1])).toBe(true)
      expect(s.score[0] + s.score[1]).toBe(end.winner === null ? 0 : 1)
      if (!s.over) {
        expect(s.duel).toBe(2)
        expect(s.round).toBe(1)
        for (const seat of s.seats) expect(seat.bank).toEqual([]), expect(seat.hand).toHaveLength(DUEL.hand)
      }
    }
  })

  it('wins the match at two duels, within the cap', () => {
    for (let seed = 0; seed < 60; seed++) {
      const { s } = playOut(R.start(seed))
      const res = R.result(s)!
      expect(s.duel).toBeLessThanOrEqual(DUEL.duels)
      expect(s.score[0] + s.score[1]).toBeLessThanOrEqual(s.duel)
      if (s.duel < DUEL.duels) expect(Math.max(...s.score)).toBe(DUEL.toWin)
      if (res.winner !== null) expect(s.score[res.winner === 0 ? 0 : 1]).toBeGreaterThan(s.score[res.winner === 0 ? 1 : 0])
    }
  })

  /** A match on its duel's last round with one card each in hand, `banks` already banked. */
  const lastRound = (a: DuelCard, b: DuelCard, over: Partial<DuelState>, banks: readonly [DuelCard[], DuelCard[]] = [[], []]): DuelState => {
    const s = R.start(5)
    const seat = (c: DuelCard, bank: DuelCard[]) => ({ deck: [], hand: [c], pick: null, bank })
    return { ...s, seats: [seat(a, banks[0]), seat(b, banks[1])], round: DUEL.rounds, ...over }
  }
  const turn = (s: DuelState) => R.play(R.play(s, 0, s.seats[0].hand[0]!.id)!, 1, s.seats[1].hand[0]!.id)!

  it('counts a drawn duel for nobody and deals the next', () => {
    const s = turn(lastRound(card('fire', 5), card('fire', 5), { score: [1, 0] }))
    expect(s.last!.end).toEqual({ winner: null, banks: [[], []] })
    expect(s.score).toEqual([1, 0])
    expect(s.over).toBe(false)
    expect(s.duel).toBe(2)
  })

  it('ends the match on a second duel won', () => {
    const s = turn(lastRound(card('fire', 9), card('fire', 3, 1), { duel: 2, score: [1, 0] }, [[card('fire', 4, 5), card('fire', 6, 6)], []]))
    expect(s.score).toEqual([2, 0])
    expect(R.result(s)).toEqual({ winner: 0, forfeit: null })
  })

  it('settles the match after the last duel: most duels won, else a draw', () => {
    const drawn = turn(lastRound(card('water', 5), card('water', 5), { duel: DUEL.duels, score: [1, 1] }))
    expect(R.result(drawn)).toEqual({ winner: null, forfeit: null })
    const ahead = turn(lastRound(card('water', 5), card('water', 5), { duel: DUEL.duels, score: [0, 1] }))
    expect(R.result(ahead)).toEqual({ winner: 1, forfeit: null })
  })

  it('hides the rival’s hand and pick until the reveal', () => {
    const s0 = R.start(11)
    const s1 = R.play(s0, 1, s0.seats[1].hand[2]!.id)!
    const mine = R.view(s1, 0)
    expect(mine.hand).toEqual(s0.seats[0].hand)
    expect(mine.pick).toBeNull()
    expect(mine.picked).toEqual([false, true])
    expect(JSON.stringify(mine)).not.toContain(JSON.stringify(s0.seats[1].hand[2]))
    const watcher = R.view(s1, null)
    expect(watcher.hand).toEqual([])
    expect(watcher.you).toBeNull()
    expect(R.view(s1, 1).pick).toEqual(s0.seats[1].hand[2])
    expect(Object.keys(watcher)).not.toContain('seed')
    // Through the wire and back.
    expect(R.parseView(JSON.parse(JSON.stringify(mine)))).toEqual(mine)
    expect(R.parseView({ ...mine, hand: [{ id: 0, type: 'dark', power: 3, dex: 1 }] })).toBeNull()
  })

  it('has a bot whose every move is legal, and that beats one playing its first card', () => {
    let botWins = 0
    let naiveWins = 0
    for (let seed = 0; seed < 300; seed++) {
      const match = tableGame(R).start(seed)
      let n = 0
      while (match.result() === null) {
        expect(match.play(0, match.bot(0, seed * 31 + n))).toBe(true)
        expect(match.play(1, R.parseMove((match.view(1) as { hand: DuelCard[] }).hand[0]!.id))).toBe(true)
        n++
      }
      const w = match.result()!.winner
      if (w === 0) botWins++
      if (w === 1) naiveWins++
    }
    expect(botWins).toBeGreaterThan(naiveWins)
  })
})
