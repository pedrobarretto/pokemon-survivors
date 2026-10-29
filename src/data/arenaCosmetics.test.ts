import { describe, expect, it } from 'vitest'
import { ARENA_COSMETICS, COSMETIC_IDS, RARITY_PRICE, cosmeticPrice, parseLook } from './arenaCosmetics'

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
      const def: { price?: number | null; rarity: keyof typeof RARITY_PRICE } = ARENA_COSMETICS[id]
      expect(cosmeticPrice(id)).toBe(def.price === undefined ? RARITY_PRICE[def.rarity] : def.price)
    }
  })
})
