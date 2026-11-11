import { describe, expect, it } from 'vitest'
import { tableGame } from '../../net/realmTables'
import { DECK, UNOWN, cardOf, drawOne, passTurn, play, playable, startUnown, unownRules as R, viewUnown, type UnownState } from './unown.rules'

/** The first card of `type` and `face` in the deck. */
const find = (type: string | null, face: string) => DECK.find((c) => c.type === type && c.face === face)!.id

/** A state with these hands, `top` on the pile, seat 0 to play. */
const table = (hands: number[][], top: number, over: Partial<UnownState> = {}): UnownState => ({
  ...startUnown(3),
  hands,
  pile: [top],
  type: cardOf(top).type ?? 'fire',
  turn: 0,
  dir: 1,
  drawn: null,
  ...over,
})

const fireA = find('fire', 'A')
const waterA = find('water', 'A')
const waterB = find('water', 'B')
const grassC = find('grass', 'C')
const elecF = find('electric', 'F')

describe('unown', () => {
  it('has the deck it says: 104 cards, 2 of each typed card, 4 of each wild', () => {
    expect(DECK).toHaveLength(104)
    expect(DECK.filter((c) => c.type === 'fire' && c.face === 'K')).toHaveLength(UNOWN.copies)
    expect(DECK.filter((c) => c.face === 'mew')).toHaveLength(UNOWN.wilds)
  })

  it('deals 7 each and turns up a letter, the same from the same seed', () => {
    const s = startUnown(77)
    expect(startUnown(77)).toEqual(s)
    expect(s.hands.map((h) => h.length)).toEqual([7, 7, 7, 7])
    expect(s.deck.length + s.pile.length + 28).toBe(104)
    expect(['A', 'B', 'C', 'F', 'J', 'K', 'N', 'O', 'U']).toContain(cardOf(s.pile[0]!).face)
  })

  it('matches by type or by letter, and a wild on anything', () => {
    const s = table([[]], fireA)
    expect(playable(s, waterA)).toBe(true)
    expect(playable(s, find('fire', 'U'))).toBe(true)
    expect(playable(s, waterB)).toBe(false)
    expect(playable(s, find(null, 'ditto'))).toBe(true)
  })

  it('skips with Protect, turns round with Trick Room, makes the next draw with Double Kick and Mew', () => {
    const others = [[grassC, elecF], [grassC + 1, elecF + 1], [waterB, waterB + 1]]
    const protect = find('fire', 'protect')
    expect(play(table([[protect, fireA, waterA], ...others], fireA), 0, protect)).toMatchObject({ turn: 2 })
    const trick = find('fire', 'trickRoom')
    expect(play(table([[trick, fireA, waterA], ...others], fireA), 0, trick)).toMatchObject({ turn: 3, dir: -1 })
    const kick = find('fire', 'doubleKick')
    const kicked = play(table([[kick, fireA, waterA], ...others], fireA), 0, kick)!
    expect(kicked.turn).toBe(2)
    expect(kicked.hands[1]).toHaveLength(4)
    const mew = find(null, 'mew')
    expect(play(table([[mew, fireA, waterA], ...others], fireA), 0, mew)).toBeNull()
    const mewed = play(table([[mew, fireA, waterA], ...others], fireA), 0, mew, 'grass')!
    expect(mewed).toMatchObject({ turn: 2, type: 'grass' })
    expect(mewed.hands[1]).toHaveLength(6)
  })

  it('catches a seat that goes down to one card without calling UNOWN!', () => {
    const hands = [[waterA, waterB], [grassC], [grassC + 1], [elecF]]
    expect(play(table(hands, fireA), 0, waterA, undefined, true)!.hands[0]).toEqual([waterB])
    const caught = play(table(hands, fireA), 0, waterA)!
    expect(caught.hands[0]).toHaveLength(3)
    expect(caught.events.some((e) => e.k === 'draw' && e.why === 'caught' && e.seat === 0)).toBe(true)
  })

  it('draws one that plays, then plays it or passes; one that doesn’t passes at once', () => {
    const hands = [[grassC], [elecF], [elecF + 1], [grassC + 1]]
    const playsOn = table(hands, fireA, { deck: [waterA] })
    const drawn = drawOne(playsOn, 0)!
    expect(drawn).toMatchObject({ drawn: waterA, turn: 0 })
    expect(play(drawn, 0, grassC)).toBeNull()
    expect(passTurn(drawn, 0)).toMatchObject({ turn: 1, drawn: null })
    expect(play(drawn, 0, waterA)).toMatchObject({ turn: 1 })
    expect(drawOne(table(hands, fireA, { deck: [waterB] }), 0)).toMatchObject({ turn: 1, drawn: null })
  })

  it('wins on the last card, and shows a hand only to its owner', () => {
    expect(play(table([[waterA], [grassC], [elecF], [waterB]], fireA), 0, waterA)).toMatchObject({ winner: 0 })
    const s = startUnown(5)
    const kick = viewUnown({ ...s, events: [{ n: 0, k: 'draw', seat: 1, count: 2, why: 'kick', cards: [1, 2] }] }, 2)
    expect(kick.hand).toEqual(s.hands[2])
    expect(kick.events[0]).toMatchObject({ cards: [] })
    expect(viewUnown(s, null).hand).toEqual([])
    expect('deck' in viewUnown(s, 0) && typeof viewUnown(s, 0).deck).toBe('number')
    expect(R.parseView(JSON.parse(JSON.stringify(viewUnown(s, 1))))).toEqual(viewUnown(s, 1))
  })

  it('plays out bot against bot, every seat winning sometimes', () => {
    const wins = [0, 0, 0, 0]
    let moves = 0
    for (let seed = 1; seed <= 80; seed++) {
      const m = tableGame(R).start(seed)
      let i = 0
      for (; i < 2000 && !m.result(); i++) {
        const seat = m.pending()[0]!
        expect(m.play(seat, m.bot(seat, seed * 31 + i))).toBe(true)
      }
      wins[m.result()!.winner!]!++
      moves += i
    }
    for (const w of wins) expect(w).toBeGreaterThan(5)
    // A short round: about 30–80 moves.
    expect(moves / 80).toBeLessThan(120)
  })
})
