import { describe, expect, it } from 'vitest'
import { GATES, PALKIA_DOMAIN } from '../data/domains/palkia'
import { foldAt, gateExit, SQUEEZE } from './palkiaDomain'

describe('Palkia’s Folded Space', () => {
  it('sends a twisted portal back where the player last landed, the first one to the start', () => {
    expect(gateExit(0, false)).toEqual(GATES[0]!.to)
    expect(gateExit(0, true)).toEqual(PALKIA_DOMAIN.crossing.start)
    expect(gateExit(2, true)).toEqual(GATES[1]!.to)
  })

  it('folds the hall’s walls in after their warning, holds them and opens them again', () => {
    const { warn, close, hold, open } = SQUEEZE
    expect(foldAt(warn * 0.5)).toBe(0)
    expect(foldAt(warn + close / 2)).toBeCloseTo(0.5)
    expect(foldAt(warn + close + hold / 2)).toBe(1)
    expect(foldAt(warn + close + hold + open / 2)).toBeCloseTo(0.5)
    expect(foldAt(warn + close + hold + open + 1)).toBe(0)
  })
})
