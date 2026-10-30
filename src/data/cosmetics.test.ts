import { describe, expect, it } from 'vitest'
import { COSMETICS, COSMETIC_IDS, RARITY_PRICE, arenaOnly, cosmeticPrice, lookIn, parseLook } from './cosmetics'

describe('parseLook', () => {
  it('keeps known ids in their own slot only', () => {
    expect(parseLook({ head: 'strawHat', trail: 'sparkTrail' })).toEqual({ head: 'strawHat', trail: 'sparkTrail' })
    expect(parseLook({ face: 'strawHat', head: 'nope', trail: 7 })).toEqual({})
    expect(parseLook(null)).toEqual({})
  })
})

describe('cosmeticPrice', () => {
  it("falls back to the rarity's price", () => {
    for (const id of COSMETIC_IDS) {
      const def: { price?: number | null; rarity: keyof typeof RARITY_PRICE } = COSMETICS[id]
      expect(cosmeticPrice(id)).toBe(def.price === undefined ? RARITY_PRICE[def.rarity] : def.price)
    }
  })
})

describe('where a look shows', () => {
  const look = parseLook({ head: 'strawHat', trail: 'sparkTrail', follower: 'pichuFollower', emote: 'victoryEmote', ko: 'koSupernova' })

  it('wears, follows and trails in a run, and keeps the Arena-only slots for the Arena', () => {
    expect(lookIn(look, 'run')).toEqual({ head: 'strawHat', trail: 'sparkTrail', follower: 'pichuFollower' })
    expect(lookIn(look, 'arena')).toEqual(look)
  })

  it('marks the items that only show in the Arena', () => {
    expect(arenaOnly('koSupernova')).toBe(true)
    expect(arenaOnly('victoryEmote')).toBe(true)
    expect(arenaOnly('strawHat')).toBe(false)
    expect(arenaOnly('pichuFollower')).toBe(false)
  })
})
