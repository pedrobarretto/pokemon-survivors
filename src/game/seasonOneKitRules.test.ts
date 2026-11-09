import { describe, expect, it } from 'vitest'
import {
  createSeasonKit, exitTrips, heroHolds, KIT, kitMeter, meterFed, miceRoom, rageCap, rageFaded, rageHit, seasonKitDeltas, seasonKitForm, slimeRefill, supremeUp, zenNext,
} from './seasonOneKitRules'

describe('Rage', () => {
  it('caps by stage and fades only after the hold, one stack each `decayEvery`', () => {
    expect([rageCap(0), rageCap(1), rageCap(2), rageCap(9)]).toEqual([6, 9, 12, 12])
    expect(rageHit(6, 0)).toBe(6)
    expect(rageFaded(5, KIT.rage.hold - 0.1, 0.1)).toBe(5)
    expect(rageFaded(5, KIT.rage.hold + KIT.rage.decayEvery, 0.1)).toBe(4)
  })

  it('never pays more than the cap holds', () => {
    expect(seasonKitDeltas({ kind: 'rage', stacks: rageCap(9), last: 0 })).toEqual([{ might: 12 * KIT.rage.might, speed: 12 * KIT.rage.speed }])
  })
})

describe('meters', () => {
  it('stop filling while the form runs and through its lockout', () => {
    expect(meterFed(3, 40, 0, 0)).toBe(4)
    expect(meterFed(40, 40, 0, 0)).toBe(40)
    expect(meterFed(3, 40, 2, 0)).toBe(3)
    expect(meterFed(3, 40, 0, 2)).toBe(3)
  })

  it('reads the timer while on, the kills while off', () => {
    expect(kitMeter({ kind: 'school', meter: 20, left: 0, lockout: 0 })).toEqual({ fill: 0.5, on: false, locked: false })
    expect(kitMeter({ kind: 'school', meter: 0, left: KIT.school.left / 2, lockout: 0 })?.fill).toBe(0.5)
    expect(kitMeter({ kind: 'hero', spent: false })).toBeNull()
  })
})

describe('protections', () => {
  it('Zero to Hero holds only for Palafin, once', () => {
    expect(heroHolds(false, 0)).toBe(false)
    expect(heroHolds(false, 1)).toBe(true)
    expect(heroHolds(true, 1)).toBe(false)
  })

  it('Emergency Exit trips only on crossing the line with the cooldown spent', () => {
    expect(exitTrips(0.6, 0.4, 0)).toBe(true)
    expect(exitTrips(0.45, 0.4, 0)).toBe(false)
    expect(exitTrips(0.6, 0.4, 1)).toBe(false)
  })

  it('Zen holds between its two lines, so HP on the line does not flicker it', () => {
    expect([zenNext(false, 0.55), zenNext(false, 0.49), zenNext(true, 0.6), zenNext(true, 0.7)]).toEqual([false, true, true, false])
  })

  it('the slime heals from a budget of one second of its rate', () => {
    const cap = 100 * KIT.slime.healRate
    expect(slimeRefill(0, 10, 100)).toBe(cap)
    expect(slimeRefill(0, 0.5, 100)).toBeCloseTo(cap / 2)
  })
})

describe('caps', () => {
  it('holds Supreme Overlord and the mice', () => {
    expect(supremeUp(KIT.supreme.cap)).toBe(KIT.supreme.cap)
    expect(miceRoom(KIT.mice.cap - 1, 3)).toBe(1)
    expect(miceRoom(KIT.mice.cap, 3)).toBe(0)
  })
})

describe('forms', () => {
  it('shows only the stages with sheets', () => {
    expect(seasonKitForm({ kind: 'zen', on: true, orb: 0 }, 0, 'clear')).toBeUndefined()
    expect(seasonKitForm({ kind: 'zen', on: true, orb: 0 }, 1, 'clear')).toBe('zen')
    expect(seasonKitForm({ kind: 'hero', spent: true }, 1, 'clear')).toBe('hero')
  })

  it("follows the weather on Castform, base in sand and fog", () => {
    const kit = createSeasonKit('castform')!
    expect([seasonKitForm(kit, 0, 'rain'), seasonKitForm(kit, 0, 'sun'), seasonKitForm(kit, 0, 'snow'), seasonKitForm(kit, 0, 'sand')]).toEqual(['rainy', 'sunny', 'snowy', undefined])
  })

  it('leaves everyone else without state', () => {
    expect(createSeasonKit('charmander')).toBeNull()
    expect(createSeasonKit('rotom')).toBeNull()
  })
})
