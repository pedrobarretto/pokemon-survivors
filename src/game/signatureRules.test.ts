import { describe, expect, it } from 'vitest'
import {
  aquaSpeed, aquaStacks, AQUA_STEP_MAX, beatOf, chargeScale, CHARGE_MAX, densestFoe, ERUPTION_FLOOR, eruptionScale,
  petalTempo, recoilFor, snipeScale, SNIPE_MAX,
} from './signatureRules'

const foe = (id: number, x: number, y: number, dying = -1) => ({ id, x, y, dying })

describe('densestFoe', () => {
  it('picks the heart of the biggest cluster in range', () => {
    const lone = foe(1, 20, 0)
    const pack = [foe(2, 100, 0), foe(3, 110, 5), foe(4, 105, -6), foe(5, 95, 4)]
    expect(densestFoe([lone, ...pack], 0, 0, 150, 30)?.id).toBeGreaterThanOrEqual(2)
  })

  it('ignores fainted foes and foes out of range', () => {
    const foes = [foe(1, 30, 0), foe(2, 300, 0), foe(3, 302, 0), foe(4, 35, 0, 0.1)]
    expect(densestFoe(foes, 0, 0, 150, 30)?.id).toBe(1)
    expect(densestFoe([], 0, 0, 150, 30)).toBeNull()
  })

  it('breaks ties by distance, then by id', () => {
    expect(densestFoe([foe(7, 50, 0), foe(3, 20, 0)], 0, 0, 150, 10)?.id).toBe(3)
    expect(densestFoe([foe(7, 0, 20), foe(3, 20, 0)], 0, 0, 150, 10)?.id).toBe(3)
  })

  it('while walking, only counts the crowds ahead of the stick', () => {
    const behind = [foe(1, -60, 0), foe(2, -62, 4), foe(3, -58, -4)]
    const ahead = foe(4, 0, 80)
    expect(densestFoe([...behind, ahead], 0, 0, 150, 30)?.id).not.toBe(4)
    expect(densestFoe([...behind, ahead], 0, 0, 150, 30, { x: 0, y: 1 })?.id).toBe(4)
    expect(densestFoe(behind, 0, 0, 150, 30, { x: 1, y: 0 })).toBeNull()
  })
})

describe('HP scaling', () => {
  it('Eruption is full power at full HP and never under the floor', () => {
    expect(eruptionScale(1)).toBe(1)
    expect(eruptionScale(0)).toBe(ERUPTION_FLOOR)
    expect(eruptionScale(0.5)).toBeCloseTo(0.65)
  })

  it('Flame Charge grows with max HP, capped', () => {
    expect(chargeScale(80)).toBe(1)
    expect(chargeScale(200)).toBe(2)
    expect(chargeScale(900)).toBe(CHARGE_MAX)
  })

  it('Wood Hammer recoil never takes the last HP', () => {
    expect(recoilFor(100, 100)).toBe(4)
    expect(recoilFor(3, 100)).toBe(2)
    expect(recoilFor(1, 100)).toBe(0)
  })
})

describe('streaks', () => {
  it('Petal Dance speeds up and the third dance in a row makes you dizzy', () => {
    expect(petalTempo(0)).toEqual({ spin: 1, dizzy: false })
    expect(petalTempo(1).spin).toBeGreaterThan(1)
    expect(petalTempo(2).dizzy).toBe(true)
    expect(petalTempo(3)).toEqual(petalTempo(0))
  })

  it('Aqua Step stacks while its speed holds and starts over after', () => {
    expect(aquaStacks(0, false)).toBe(1)
    expect(aquaStacks(2, true)).toBe(3)
    expect(aquaStacks(4, false)).toBe(1)
    expect(aquaSpeed(3)).toBeCloseTo(0.09)
    expect(aquaSpeed(AQUA_STEP_MAX + 4)).toBe(aquaSpeed(AQUA_STEP_MAX))
  })

  it('a bar of three beats ends on the strong one', () => {
    expect([0, 1, 2].map((n) => beatOf(n, 3).strong)).toEqual([false, false, true])
    expect(beatOf(2, 3).next).toBe(0)
  })

  it('Snipe Shot gains with distance, capped', () => {
    expect(snipeScale(0)).toBe(1)
    expect(snipeScale(160)).toBe(2)
    expect(snipeScale(10000)).toBe(1 + SNIPE_MAX)
  })
})
