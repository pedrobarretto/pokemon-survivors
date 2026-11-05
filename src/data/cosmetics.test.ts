import { describe, expect, it } from 'vitest'
import { COSMETICS, COSMETIC_IDS, RARITY_PRICE, arenaOnly, cosmeticPrice, lookIn, parseLook, skinFor } from './cosmetics'

describe('parseLook', () => {
  it('keeps known ids in their own slot only', () => {
    expect(parseLook({ head: 'strawHat', trail: 'sparkTrail' })).toEqual({ head: 'strawHat', trail: 'sparkTrail' })
    expect(parseLook({ face: 'strawHat', head: 'nope', trail: 7 })).toEqual({})
    expect(parseLook(null)).toEqual({})
  })

  it('keeps known skins, one per line (the first), and reads an old look without any', () => {
    expect(parseLook({ head: 'strawHat', skins: ['bulbasaurAutumn', 'nope', 'charmanderSuit', 'bulbasaurWinter', 7] })).toEqual({ head: 'strawHat', skins: ['bulbasaurAutumn', 'charmanderSuit'] })
    expect(parseLook({ skins: 'charmanderSuit' })).toEqual({})
    expect(parseLook({ skins: [] })).toEqual({})
    expect(parseLook({ skin: 'charmanderSuit' })).toEqual({})
  })
})

describe('skinFor', () => {
  const look = parseLook({ skins: ['bulbasaurAutumn', 'gengarSuit'] })

  it('dresses every stage a skin covers, and nothing else', () => {
    expect([1, 2, 3].map((dex) => skinFor(look, dex))).toEqual(['bulbasaurAutumn', 'bulbasaurAutumn', 'bulbasaurAutumn'])
    expect(skinFor(look, 94)).toBe('gengarSuit')
    expect(skinFor(look, 92)).toBeNull()
    expect(skinFor(look, 4)).toBeNull()
    expect(skinFor({}, 1)).toBeNull()
  })

  it('shows in every mode', () => {
    expect(lookIn(look, 'run')).toEqual(look)
    expect(lookIn(look, 'arena')).toEqual(look)
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
  const look = parseLook({ head: 'strawHat', trail: 'sparkTrail', emote: 'victoryEmote', ko: 'koSupernova' })

  it('wears and trails in a run, and keeps the Arena-only slots for the Arena', () => {
    expect(lookIn(look, 'run')).toEqual({ head: 'strawHat', trail: 'sparkTrail' })
    expect(lookIn(look, 'arena')).toEqual(look)
  })

  it('marks the items that only show in the Arena', () => {
    expect(arenaOnly('koSupernova')).toBe(true)
    expect(arenaOnly('victoryEmote')).toBe(true)
    expect(arenaOnly('strawHat')).toBe(false)
    expect(arenaOnly('sparkTrail')).toBe(false)
  })
})
