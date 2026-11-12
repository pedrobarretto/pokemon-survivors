import { describe, expect, it } from 'vitest'
import { babyEvery, babyShare, createKitMA, featherCap, feathersShed, KIT_MA, kitMADeltas, rageAt, roars, snapEvery, tunnelCaves, tunnelFinds } from './gaKitMARules'

describe('the Mega families', () => {
  it('give a mechanic to their five families and to nobody else', () => {
    expect(['kangaskhan', 'pinsir', 'skarmory', 'drilbur', 'drampa'].map((id) => createKitMA(id as 'kangaskhan')?.kind)).toEqual(['baby', 'pincers', 'feathers', 'dig', 'berserk'])
    expect(createKitMA('charmander')).toBeNull()
  })

  it("grow Kangaskhan's baby with the level, up to its cap, and let Mega Kangaskhan's out of the pouch", () => {
    expect(babyShare(1, false)).toBeCloseTo(KIT_MA.baby.share)
    expect(babyShare(20, false)).toBeGreaterThan(babyShare(1, false))
    expect(babyShare(200, false)).toBe(KIT_MA.baby.cap)
    expect(babyShare(200, true)).toBeCloseTo(KIT_MA.baby.cap + KIT_MA.baby.mega)
    expect(babyEvery(true)).toBeLessThan(babyEvery(false))
  })

  it("snap Pinsir's pincers faster as Mega Pinsir", () => {
    expect(snapEvery(true)).toBeLessThan(snapEvery(false))
  })

  it('shed a feather per gap walked, and let more lie as Skarmory levels up (twice as many for the Mega)', () => {
    const gap = KIT_MA.feathers.gap
    expect(feathersShed(0, gap - 1)).toBe(0)
    expect(feathersShed(gap - 1, gap)).toBe(1)
    expect(feathersShed(0, gap * 3)).toBe(3)
    expect(featherCap(1, false)).toBe(KIT_MA.feathers.cap)
    expect(featherCap(30, false)).toBeGreaterThan(featherCap(1, false))
    expect(featherCap(999, false)).toBe(KIT_MA.feathers.maxCap)
    expect(featherCap(1, true)).toBe(KIT_MA.feathers.cap * KIT_MA.feathers.megaCap)
  })

  it("cave in only Excadrill's tunnels long enough, and turn up a find every few", () => {
    expect(tunnelCaves(0, 200)).toBe(false)
    expect(tunnelCaves(1, KIT_MA.dig.minTunnel - 1)).toBe(false)
    expect(tunnelCaves(1, KIT_MA.dig.minTunnel)).toBe(true)
    const every = KIT_MA.dig.findEvery
    expect([every - 1, every, every * 2].map(tunnelFinds)).toEqual([false, true, true])
    expect(tunnelFinds(0)).toBe(false)
  })

  it("climb Drampa's rage as its HP falls, in steps, never under half as Mega Drampa", () => {
    const B = KIT_MA.berserk
    expect(rageAt(1, false)).toBe(0)
    expect(rageAt(B.from, false)).toBe(0)
    expect(rageAt(0.45, false)).toBeGreaterThan(rageAt(0.6, false))
    expect(rageAt(B.to, false)).toBe(1)
    expect(rageAt(0, false)).toBe(1)
    expect((rageAt(0.5, false) * B.steps) % 1).toBe(0)
    expect(rageAt(1, true)).toBe(B.megaFloor)
    expect(kitMADeltas({ kind: 'berserk', rage: 0, roar: 0, above: true })).toEqual([])
    const [full] = kitMADeltas({ kind: 'berserk', rage: 1, roar: 0, above: false })
    expect(full).toEqual({ might: B.might, area: B.area, cooldown: B.haste })
  })

  it('roar once as Drampa falls under half, when the roar is ready', () => {
    expect(roars(true, 0.49, 0)).toBe(true)
    expect(roars(false, 0.49, 0)).toBe(false)
    expect(roars(true, 0.49, 3)).toBe(false)
    expect(roars(true, 0.6, 0)).toBe(false)
  })
})
