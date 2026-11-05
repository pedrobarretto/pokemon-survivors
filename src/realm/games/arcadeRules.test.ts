import { describe, expect, it } from 'vitest'
import { MINIGAMES, coinsFor, trophiesEarned } from '../../data/minigames'
import {
  BERRIES,
  BERRY_FEATS,
  BERRY_ROUND,
  WHACK_FEATS,
  WHACK_ROUND,
  berryFeats,
  berryPace,
  comboMult,
  goldenGap,
  pickBerry,
  whackFeats,
  whackPace,
  whackScore,
} from './arcadeRules'

describe('the arcade games', () => {
  it('multiplies a combo a step at a time, up to its cap', () => {
    expect([0, 9, 10, 19, 20, 30, 99].map((c) => comboMult(c))).toEqual([1, 1, 2, 2, 3, 4, 4])
    expect([0, 4, 5, 20, 100].map((c) => comboMult(c, 5, 5))).toEqual([1, 1, 2, 5, 5])
    expect(whackScore('dugtrio', 0)).toBe(40)
    expect(whackScore('diglett', 12)).toBe(30)
  })

  it('draws every regular berry and never the golden one from the rain', () => {
    const drawn = new Set(Array.from({ length: 1000 }, (_, i) => pickBerry(i / 1000)))
    expect(drawn).toEqual(new Set(['oran', 'pecha', 'razz', 'sitrus']))
    expect(pickBerry(0.9999)).toBe('sitrus')
    expect(BERRIES.golden.points).toBeGreaterThan(BERRIES.sitrus.points)
  })

  it('ramps both games from gentle to a rush, and holds there past the round', () => {
    const [b0, b1] = [berryPace(0), berryPace(BERRY_ROUND)]
    expect(b1.every).toBeLessThan(b0.every)
    expect(b1.fall).toBeGreaterThan(b0.fall)
    expect(b1.voltorb).toBeGreaterThan(b0.voltorb)
    expect(berryPace(BERRY_ROUND * 2)).toEqual(b1)
    expect(goldenGap(BERRY_ROUND)).toBeLessThan(goldenGap(0))
    const [w0, w1] = [whackPace(0), whackPace(WHACK_ROUND)]
    expect(w1.up).toBeLessThan(w0.up)
    expect(w1.most).toBeGreaterThan(w0.most)
    expect(w0.every).toBeGreaterThan(0)
  })

  it('earns feats only for what happened', () => {
    expect(berryFeats({ livesLost: 0, finished: true, goldens: 3, bestCombo: 50 })).toEqual(['flawless', 'goldRush', 'combo50'])
    expect(berryFeats({ livesLost: 0, finished: false, goldens: 2, bestCombo: 49 })).toEqual([])
    expect(whackFeats({ bestCombo: 30, dugtrios: 4 })).toEqual(['combo30'])
    expect(whackFeats({ bestCombo: 3, dugtrios: 5 })).toEqual(['dugtrio'])
  })

  it('brags only feats the relay accepts, and pays and grants trophies off a good round', () => {
    expect([...MINIGAMES.berryCatch.feats].sort()).toEqual(Object.values(BERRY_FEATS).sort())
    expect([...MINIGAMES.whackDiglett.feats].sort()).toEqual(Object.values(WHACK_FEATS).sort())
    expect(coinsFor('berryCatch', { score: 2500 }, BERRY_ROUND * 1000)).toBe(200)
    expect(coinsFor('whackDiglett', { score: 800 }, WHACK_ROUND * 1000)).toBe(80)
    expect(trophiesEarned('berryCatch', { plays: 1, wins: 0, best: 2500, feats: [] })).toEqual(['berryBasket'])
    expect(trophiesEarned('whackDiglett', { plays: 9, wins: 0, best: 2499, feats: [] })).toEqual([])
  })
})
