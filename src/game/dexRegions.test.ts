import { describe, expect, it } from 'vitest'
import { DEX_REGIONS, dexRegionOf, MYTHICAL_DEX, type DexRegion } from '../data/nationalDex'
import { GAME_SPECIES } from '../data/species'
import { markSeen, type Pokedex } from './dex'
import { dexGiftId, dexGifts, dexGoal, regionDone, regionProgress } from './dexRegions'
import { applyGift, keepGiven } from './gifts'
import { gameGiftsApplied, isGameGift } from './gameGifts'
import { EMPTY_SAVE, type Save } from './meta'

const seeing = (...regions: DexRegion[]): Pokedex => regions.flatMap((r) => dexGoal(r)).reduce(markSeen, {})

const withDex = (dex: Pokedex): Save => ({ ...EMPTY_SAVE, dex })

describe('the regional Pokédexes', () => {
  it('ask every region for the species a run can bring from it, never a mythical or Darkrai', () => {
    for (const region of DEX_REGIONS) {
      const goal = dexGoal(region)
      expect(goal.length).toBeGreaterThan(30)
      expect(goal.every((n) => GAME_SPECIES.has(n) && dexRegionOf(n) === region && !MYTHICAL_DEX.has(n))).toBe(true)
    }
    expect(dexGoal('sinnoh')).not.toContain(491)
    expect(dexGoal('kanto')).toEqual(expect.arrayContaining([1, 19, 144, 150]))
    expect(dexGoal('kanto')).not.toContain(151)
  })

  it('complete a region only once all of it is seen', () => {
    const goal = dexGoal('johto')
    const almost = goal.slice(1).reduce(markSeen, {})
    expect(regionProgress(almost, 'johto')).toEqual({ seen: goal.length - 1, total: goal.length })
    expect(regionDone(almost, 'johto')).toBe(false)
    expect(regionDone(markSeen(almost, goal[0]!), 'johto')).toBe(true)
  })

  it('give a region’s title once, and the National Dex frame only with every region', () => {
    const kanto = withDex(seeing('kanto'))
    const gifts = dexGifts(kanto)
    expect(gifts.map((g) => g.id)).toEqual([dexGiftId('kanto')])
    expect(gifts.every((g) => isGameGift(g.id))).toBe(true)
    const out = applyGift(kanto, gifts[0]!)
    if (out.status !== 'applied') throw new Error(out.status)
    expect(out.save.titles).toContain('kantoDex')
    expect(dexGifts(out.save)).toEqual([])
    expect(keepGiven(out.save, gameGiftsApplied(out.save))).toEqual(out.save)

    const all = withDex(seeing(...DEX_REGIONS))
    expect(dexGifts(all).map((g) => g.id)).toEqual([...DEX_REGIONS.map(dexGiftId), dexGiftId('national')])
  })

  it('keep a title already given when the region later asks for new species', () => {
    const out = applyGift(withDex({}), dexGifts(withDex(seeing('hoenn')))[0]!)
    if (out.status !== 'applied') throw new Error(out.status)
    // The save no longer has Hoenn complete (a new species joined it), but the title stays.
    expect(keepGiven(out.save, gameGiftsApplied(out.save)).titles).toContain('hoennDex')
  })
})
