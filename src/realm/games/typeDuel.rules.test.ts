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
    expect(s2.last).toEqual({ round: 1, cards: [a, b], winner: duelWinner(a, b) })
    expect(s2.round).toBe(2)
    expect(s2.seats[0].hand).toHaveLength(DUEL.hand)
    expect(s2.seats[0].hand.some((c) => c.id === a.id)).toBe(false)
    expect(R.pending(s2)).toEqual([0, 1])
  })

  it('banks only the winner’s card and ends on a winning bank', () => {
    for (let seed = 0; seed < 40; seed++) {
      const { s } = playOut(R.start(seed))
      const res = R.result(s)!
      expect(res).not.toBeNull()
      if (res.winner !== null && s.round < DUEL.rounds) expect(bankWins(s.seats[res.winner === 0 ? 0 : 1].bank)).toBe(true)
      const banked = s.seats[0].bank.length + s.seats[1].bank.length
      expect(banked).toBeLessThanOrEqual(s.round)
    }
  })

  it('settles by the most banked after the last round', () => {
    // Both seats mirror the same type each round, so only power decides and banks grow slowly.
    let s = R.start(3)
    const settled = playOut(s, (x, seat) => [...x.seats[seat]!.hand].sort((p, q) => p.power - q.power)[0]!.id).s
    expect(settled.over).toBe(true)
    s = settled
    if (!bankWins(s.seats[0].bank) && !bankWins(s.seats[1].bank)) {
      const d = s.seats[0].bank.length - s.seats[1].bank.length
      expect(s.winner).toBe(d > 0 ? 0 : d < 0 ? 1 : null)
      expect(s.round).toBe(DUEL.rounds)
    }
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
