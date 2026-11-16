import { describe, expect, it } from 'vitest'
import { atStage, clawLink, clawPower, createKitF, crossReady, divePrey, faded, KIT_F, kitFDeltas, rootedAfter, smashReady, voltCharge } from './fossilKitRules'

describe('the fossil families’ mechanics', () => {
  it('give only the fossil families a kit', () => {
    expect(createKitF('aerodactyl')?.kind).toBe('dive')
    expect(createKitF('dracovish')?.kind).toBe('frenzy')
    expect(createKitF('kabuto')).toBeNull()
    expect(createKitF('charmander')).toBeNull()
  })

  it('dive on a boss or an elite before the foe with the most HP', () => {
    const foe = (hp: number, elite = false, boss = false) => ({ hp, elite, boss })
    expect(divePrey([foe(90), foe(20, true), foe(50)])).toEqual(foe(20, true))
    expect(divePrey([foe(20, true), foe(5, false, true)])).toEqual(foe(5, false, true))
    expect(divePrey([foe(30), foe(60)])).toEqual(foe(60))
    expect(divePrey([])).toBeNull()
  })

  it('smash the shell only whole, with a crowd, and trade armor for power while it lasts', () => {
    expect(smashReady(0, 0, KIT_F.smash.crowd)).toBe(true)
    expect(smashReady(0, 0, KIT_F.smash.crowd - 1)).toBe(false)
    expect(smashReady(3, 0, 9)).toBe(false)
    const [smashed] = kitFDeltas({ kind: 'smash', shell: 0, left: 2 }, 1)
    expect(smashed?.armor).toBeLessThan(0)
    expect(smashed?.might).toBe(atStage(KIT_F.smash.might, 1))
    expect(kitFDeltas({ kind: 'smash', shell: 5, left: 0 }, 1)).toEqual([])
  })

  it('root Lileep once it stands still, with regen and armor', () => {
    expect(rootedAfter(KIT_F.roots.settle - 0.01)).toBe(false)
    expect(rootedAfter(KIT_F.roots.settle)).toBe(true)
    expect(kitFDeltas({ kind: 'roots', walked: 0, still: 1, rooted: true, next: 0, tendrils: [] }, 0)).toEqual([{ regen: 1, armor: 1 }])
  })

  it('build the claw combo to the stage’s cap, and cross only as Armaldo', () => {
    let links = 0
    for (let i = 0; i < 9; i++) links = clawLink(links, 1)
    expect(links).toBe(atStage(KIT_F.claws.cap, 1))
    expect(clawPower(2)).toBeCloseTo(1 + 2 * KIT_F.claws.perLink)
    expect(crossReady(links, 1)).toBe(true)
    expect(crossReady(atStage(KIT_F.claws.cap, 0), 0)).toBe(false)
  })

  it('discharge Dracozolt’s tail every few first strikes', () => {
    let charge = 0
    let bursts = 0
    for (let i = 0; i < KIT_F.volt.need * 2; i++) {
      const next = voltCharge(charge)
      charge = next.charge
      if (next.burst) bursts++
    }
    expect(bursts).toBe(2)
  })

  it('let the frenzy fade one stack at a time once it holds no more', () => {
    const F = KIT_F.frenzy
    expect(faded(4, F.hold - 0.1, 0.1, F.hold, F.decayEvery)).toBe(4)
    expect(faded(4, F.hold + F.decayEvery + 0.05, 0.1, F.hold, F.decayEvery)).toBe(3)
  })
})
