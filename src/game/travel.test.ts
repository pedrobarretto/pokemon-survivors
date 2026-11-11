import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { HATCHLINGS } from '../data/hatchlings'
import { REGION_IDS } from '../data/regionalForms'
import { VITRINE } from '../data/shop'
import { evolutionOffers } from './branch'
import { addDays } from './day'
import { hatchPool } from './eggs'
import { EMPTY_SAVE } from './meta'
import { vitrineOf } from './shop'
import { buyTravelEgg, nextTrip, regionFamilies, regionOfWeek, travelEggBlock, TRAVEL } from './travel'

const ctx = { weather: 'clear', biome: 'meadow' } as const

describe('the trip of the week', () => {
  it('goes to each region in turn, a Brasília week each, Monday to Sunday', () => {
    const weeks = REGION_IDS.map((_, i) => regionOfWeek(addDays(TRAVEL.epoch, i * 7)))
    expect(weeks).toEqual(['alola', 'galar', 'hisui', 'paldea'])
    expect(regionOfWeek(addDays(TRAVEL.epoch, 6))).toBe('alola')
    expect(regionOfWeek(addDays(TRAVEL.epoch, 28))).toBe('alola')
    // Before the epoch the turn runs backwards, never off the list.
    expect(regionOfWeek(addDays(TRAVEL.epoch, -1))).toBe('paldea')
  })

  it("names next Monday's trip", () => {
    expect(nextTrip(addDays(TRAVEL.epoch, 2))).toEqual({ day: addDays(TRAVEL.epoch, 7), region: 'galar' })
    expect(nextTrip(TRAVEL.epoch)).toEqual({ day: addDays(TRAVEL.epoch, 7), region: 'galar' })
  })

  it("gives every region families of its own, which only its egg hatches", () => {
    for (const region of REGION_IDS) {
      expect(regionFamilies(region).length).toBeGreaterThanOrEqual(2)
      expect(hatchPool(region, {}).map(([id]) => id).every((id) => HATCHLINGS[id].egg === region)).toBe(true)
    }
  })
})

describe("the Vitrine's Ovo de Viagem", () => {
  const v = vitrineOf(addDays(TRAVEL.epoch, 8))
  const rich = { ...EMPTY_SAVE, wallet: 50_000 }

  it("sells the week's region's egg, one a day", () => {
    const bought = buyTravelEgg(rich, v)!
    expect(bought.eggs).toEqual([{ tier: 'galar', steps: 0 }])
    expect([bought.wallet, bought.spent]).toEqual([50_000 - VITRINE.travelEgg.price, VITRINE.travelEgg.price])
    expect(travelEggBlock(bought, v)).toBe('soldOut')
    expect(buyTravelEgg(bought, vitrineOf(addDays(v.day, 1)))?.eggs.length).toBe(2)
  })

  it('waits for room in the incubator and for the ₽', () => {
    expect(travelEggBlock({ ...rich, wallet: VITRINE.travelEgg.price - 1 }, v)).toBe('poor')
    const full = { ...rich, eggs: [0, 1, 2].map(() => ({ tier: 'common' as const, steps: 0 })) }
    expect(travelEggBlock(full, v)).toBe('full')
  })
})

describe('regional evolutions', () => {
  it("keep the line's own form free, and open the region's with its stone", () => {
    expect(evolutionOffers(createRng(1), ['raichu', 'raichuAlola'], ctx, []).map((o) => o.id)).toEqual(['raichu'])
    expect(evolutionOffers(createRng(1), ['raichu', 'raichuAlola'], ctx, ['sparklingStone'])).toEqual([
      { id: 'raichu', favor: null },
      { id: 'raichuAlola', favor: 'item' },
    ])
    expect(evolutionOffers(createRng(1), ['typhlosion', 'typhlosionHisui'], ctx, ['blackAugurite']).map((o) => o.id)).toEqual(['typhlosion', 'typhlosionHisui'])
  })

  it("let Paldean Tauros' breed show by the weather", () => {
    const draws = (weather: 'sun' | 'rain') =>
      Array.from({ length: 300 }, (_, i) => evolutionOffers(createRng(i + 1), ['taurosCombat', 'taurosBlaze', 'taurosAqua'], { weather, biome: 'snow' }, [])[0]!.id)
    expect(draws('sun').filter((id) => id === 'taurosBlaze').length).toBeGreaterThan(130)
    expect(draws('rain').filter((id) => id === 'taurosAqua').length).toBeGreaterThan(130)
  })
})
