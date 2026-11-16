import { describe, expect, it } from 'vitest'
import { BETS, cappedWin, CORNER, canBuy, cleared, dealBoard, hintsOf, nextLevel, slotsReturn, spinWins, STRIP, SWEEP, sweepPay, sweepView, type Tile } from './corner.rules'

/** A seeded stand-in for the API's dice. */
const dice = (seed: number) => {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), a | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('the slots', () => {
  it('give back about what they take over a long day, at every bet', () => {
    for (const bet of BETS) {
      expect(slotsReturn(bet)).toBeGreaterThan(0.97)
      expect(slotsReturn(bet)).toBeLessThan(1.04)
    }
  })

  it('pay three of a kind on a played line and an Oran Berry on the left square', () => {
    const seven = STRIP.indexOf('seven')
    expect(spinWins([seven, seven, seven], 1)).toEqual([{ line: 0, symbol: 'seven', tokens: 300 }])
    const oran = STRIP.indexOf('oran')
    const other = STRIP.indexOf('poke')
    expect(spinWins([oran, other, other + 1], 1).map((w) => w.symbol)).toEqual(['oran'])
  })
})

describe('Koffing Sweep', () => {
  it('deals each level its Koffing and piles, the rest 1s', () => {
    SWEEP.levels.forEach((def, i) => {
      const board = dealBoard((i + 1) as 1 | 2 | 3 | 4 | 5, dice(i + 7))
      const count = (t: Tile) => board.filter((x) => x === t).length
      expect([count(0), count(2), count(3), board.length]).toEqual([def.koffing, def.twos, def.threes, 25])
    })
  })

  it('hints each row and column with its coins and Koffing', () => {
    const board = dealBoard(3, dice(3))
    const { rows, cols } = hintsOf(board)
    const sum = (h: { coins: number }[]) => h.reduce((a, x) => a + x.coins, 0)
    expect(sum(rows)).toBe(sum(cols))
    expect(rows.reduce((a, h) => a + h.koffing, 0)).toBe(SWEEP.levels[2]!.koffing)
  })

  it('never shows a face-down tile before the round is over', () => {
    const board = dealBoard(1, dice(1))
    expect(sweepView(1, board, [], null).flipped).toEqual([])
    expect(sweepView(1, board, [], 'bank').flipped).toHaveLength(25)
  })

  it('clears once every 2 and 3 is up, pays pot times level, and moves the level', () => {
    const board = dealBoard(2, dice(9))
    const gold = board.flatMap((t, i) => (t >= 2 ? [i] : []))
    expect(cleared(board, gold)).toBe(true)
    expect(cleared(board, gold.slice(1))).toBe(false)
    expect(sweepPay(10, 2, true)).toBe(20 + SWEEP.clearBonus * 2)
    expect(nextLevel(2, 'clear', 9)).toBe(3)
    expect(nextLevel(4, 'koffing', 2)).toBe(2)
    expect(nextLevel(5, 'koffing', 0)).toBe(1)
    expect(nextLevel(3, 'bank', 1)).toBe(3)
  })
})

describe('the day', () => {
  it('caps what the games pay and what the counter sells', () => {
    expect(cappedWin(100, CORNER.wonDaily - 30)).toBe(30)
    expect(cappedWin(100, CORNER.wonDaily)).toBe(0)
    expect(canBuy(1, CORNER.buyDaily - 250)).toBe(true)
    expect(canBuy(1, CORNER.buyDaily - 200)).toBe(false)
    expect(canBuy(9, 0)).toBe(false)
  })
})
