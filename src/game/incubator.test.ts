import { describe, expect, it } from 'vitest'
import { INCUBATOR } from '../data/shop'
import { depositEggs, EGGS, freeSlots, grantEgg, incubatorSlots, stepsToWalk, type Egg } from './eggs'
import { buyQuick, buySlot, parseIncubator, quickBlock, quickCount, slotBlock, slotsInvested, useQuick } from './incubator'
import { EMPTY_SAVE, parseSaveData, type Save } from './meta'

const save = (patch: Partial<Save>): Save => ({ ...EMPTY_SAVE, ...patch })
const commons = (n: number): Egg[] => Array.from({ length: n }, () => ({ tier: 'common', steps: 0 }))
const atLevel = (level: Save['shop']['level'], wallet: number, slots = 0) => save({ wallet, shop: { ...EMPTY_SAVE.shop, level }, incubator: { ...EMPTY_SAVE.incubator, slots } })

describe('incubator slots', () => {
  it('are the base three plus the ones bought, and a bought slot takes an egg a full base incubator pays out', () => {
    expect(incubatorSlots(EMPTY_SAVE)).toBe(EGGS.slots)
    const four = atLevel(2, 0, 1)
    expect(incubatorSlots(four)).toBe(4)
    expect(freeSlots(commons(3), incubatorSlots(four))).toBe(1)
    expect(grantEgg({ ...four, eggs: commons(3) }, 'rare').save.eggs).toHaveLength(4)
    expect(grantEgg(save({ eggs: commons(3) }), 'rare')).toMatchObject({ converted: ['rare'], refund: 600 })
  })

  it("parse the eggs up to the save's own slots", () => {
    const raw = { version: 1, eggs: commons(6), incubator: { slots: 9, quick: { got: 2, used: 5 } } }
    const parsed = parseSaveData(raw)
    expect(parsed.incubator).toEqual({ slots: INCUBATOR.slots.length, quick: { got: 2, used: 2 } })
    expect(parsed.eggs).toHaveLength(EGGS.slots + INCUBATOR.slots.length)
    expect(parseSaveData({ version: 1, eggs: commons(6) }).eggs).toHaveLength(EGGS.slots)
    expect(parseIncubator('nope')).toEqual(EMPTY_SAVE.incubator)
  })

  it('sell the 4th from the Tent and the 5th from the Kecleon Mart, each after the one before, into the slot (not `spent`)', () => {
    expect(slotBlock(atLevel(1, 1_000_000))).toBe('level')
    expect(slotBlock(atLevel(2, 100_000))).toBe('poor')
    const bought = buySlot(atLevel(2, 150_000))!
    expect(bought).toMatchObject({ wallet: 0, spent: 0, incubator: { slots: 1 } })
    expect(slotBlock(atLevel(3, 1_000_000, 1))).toBe('level')
    expect(buySlot(atLevel(4, 500_000, 1))).toMatchObject({ wallet: 0, incubator: { slots: 2 } })
    expect(slotBlock(atLevel(5, 1_000_000, 2))).toBe('max')
    expect(buySlot(atLevel(1, 1_000_000))).toBeNull()
    expect(slotsInvested(2)).toBe(650_000)
  })
})

describe('Quick Incubator', () => {
  it('is bought into `spent` and used on one walking egg that has none', () => {
    const eggs: Egg[] = [{ tier: 'rare', steps: 4000 }, { tier: 'common', steps: 10 }]
    expect(quickBlock(save({ eggs }), 1)).toBe('none')
    const owned = buyQuick(save({ wallet: 10_000, eggs }))!
    expect(owned).toMatchObject({ wallet: 2000, spent: 8000 })
    expect(buyQuick(owned)).toBeNull()
    expect(quickBlock(owned, 0)).toBe('ready')
    expect(quickBlock(owned, 2)).toBe('empty')
    const used = useQuick(owned, 1)!
    expect(used.eggs[1]).toEqual({ tier: 'common', steps: 10, quick: true })
    expect(quickCount(used.incubator)).toBe(0)
    expect(quickBlock(buyQuick({ ...used, wallet: 8000 })!, 1)).toBe('quick')
  })

  it('makes its egg walk twice the steps until it hatches, and goes with it', () => {
    const quick: Egg = { tier: 'common', steps: 0, quick: true }
    expect(stepsToWalk(quick)).toBe(1000)
    const walked = depositEggs(save({ eggs: [quick, { tier: 'common', steps: 0 }] }), 300, []).save.eggs
    expect(walked).toEqual([{ tier: 'common', steps: 600, quick: true }, { tier: 'common', steps: 300 }])
    expect(depositEggs(save({ eggs: [quick] }), 5000, []).save.eggs).toEqual([{ tier: 'common', steps: 2000, quick: true }])
  })
})
