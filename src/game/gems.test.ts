import { describe, expect, it } from 'vitest'
import { GEM_PLAY } from '../data/gems'
import { playGems, refundedGems, wearableLook } from './gems'

describe('playGems', () => {
  it('gives the match and the win until the daily cap', () => {
    expect(playGems(false, 0)).toBe(GEM_PLAY.match)
    expect(playGems(true, 0)).toBe(GEM_PLAY.match + GEM_PLAY.win)
    expect(playGems(true, GEM_PLAY.daily - 3)).toBe(3)
    expect(playGems(true, GEM_PLAY.daily)).toBe(0)
    expect(playGems(false, GEM_PLAY.daily + 10)).toBe(0)
  })
})

describe('refundedGems', () => {
  it('takes back in proportion, the whole pack on a full refund', () => {
    expect(refundedGems(550, 2490, 2490)).toBe(550)
    expect(refundedGems(550, 2490, 1245)).toBe(275)
    expect(refundedGems(550, 2490, 1)).toBe(1)
    expect(refundedGems(550, 2490, 9999)).toBe(550)
  })
})

describe('wearableLook', () => {
  it('keeps only owned ids in their own slot', () => {
    expect(wearableLook({ head: 'strawHat', trail: 'sparkTrail' }, new Set(['strawHat']))).toEqual({ head: 'strawHat' })
    expect(wearableLook({ head: 'sparkTrail' }, new Set(['sparkTrail']))).toEqual({})
    expect(wearableLook('nope', new Set())).toEqual({})
  })
})
