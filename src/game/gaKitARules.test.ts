import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { GA_FAMILY_A_IDS } from '../data/gaFamiliesA'
import { evolutionOffers } from './branch'
import {
  atStage, beatUpStrikes, bindSpirit, blessingHp, createGaKitA, danceHit, danceStep, furCharged, furHolds, GA_KIT, gaKitADeltas, guillotineReady,
  heatCast, huntKill, mischiefFed, plateSoak, poisonCash, shellOut, soulReady, teaPuddles, teaRefill, wispsOf, wonderGuardHolds,
} from './gaKitARules'

describe('the big update families’ kits', () => {
  it('gives every family a kit of its own, and nobody else one', () => {
    const kinds = GA_FAMILY_A_IDS.map((id) => createGaKitA(id)?.kind)
    expect(kinds.every((k) => k !== undefined)).toBe(true)
    expect(new Set(kinds).size).toBe(GA_FAMILY_A_IDS.length)
    expect(createGaKitA('charmander')).toBeNull()
  })

  it('pays for Clangorous Soul only when healthy and recharged', () => {
    expect(soulReady(0.7, 0, 0)).toBe(true)
    expect(soulReady(0.69, 0, 0)).toBe(false)
    expect(soulReady(1, 0, 1)).toBe(false)
    expect(soulReady(1, 2, 0)).toBe(false)
    // Paying never takes the player under the line it needs, so it can't kill.
    expect(GA_KIT.soul.minHp - GA_KIT.soul.cost).toBeGreaterThan(0.5)
  })

  it('grows the dance untouched, halves it on a hit, and lets only a full Haxorus swing the Guillotine', () => {
    let s = { stacks: 0, calm: 0 }
    for (let i = 0; i < 100; i++) s = danceStep(s.stacks, s.calm, 0.5, 2)
    expect(s.stacks).toBe(atStage(GA_KIT.dance.cap, 2))
    expect(danceStep(0, 0, GA_KIT.dance.every - 0.01, 0).stacks).toBe(0)
    expect(danceHit(5)).toBe(2)
    expect(guillotineReady(5, 2)).toBe(true)
    expect(guillotineReady(4, 2)).toBe(false)
    expect(guillotineReady(3, 0)).toBe(false)
  })

  it('chains the hunt only while kills keep coming, up to the stage’s cap', () => {
    expect(huntKill(3, 1, 0)).toBe(4)
    expect(huntKill(3, 0, 0)).toBe(1)
    expect(huntKill(6, 1, 0)).toBe(6)
    expect(huntKill(9, 1, 1)).toBe(10)
    expect(beatUpStrikes(0)).toBe(2)
    expect(beatUpStrikes(100)).toBe(GA_KIT.hunt.maxStrikes)
  })

  it('binds spirits twice as fast in the dark, a wisp per dozen, never past 108', () => {
    expect(bindSpirit(0, false)).toBe(1)
    expect(bindSpirit(0, true)).toBe(2)
    expect(bindSpirit(107, true)).toBe(108)
    expect(wispsOf(108)).toBe(9)
    expect(wispsOf(11)).toBe(0)
  })

  it('cashes in a few seconds of poison at most', () => {
    expect(poisonCash(10, 2)).toBeCloseTo(18)
    expect(poisonCash(10, 60)).toBeCloseTo(10 * GA_KIT.sacs.cash * GA_KIT.sacs.share)
    expect(poisonCash(10, -1)).toBe(0)
  })

  it('keeps the tea’s heal to one second of its rate, and pours by form', () => {
    expect(teaRefill(0, 100, 100, 0.012)).toBeCloseTo(1.2)
    expect(teaRefill(0.2, 0.5, 100, 0.012)).toBeCloseTo(0.8)
    expect(teaPuddles(0, null)).toBe(2)
    expect(teaPuddles(1, 'polteageist')).toBe(4)
    expect(teaPuddles(1, 'polteageistAntique')).toBe(3)
  })

  it('feeds mischief only between coils', () => {
    expect(mischiefFed(10, 9, 0, 0)).toBe(10 + GA_KIT.mischief.maxPerTick)
    expect(mischiefFed(10, 9, 1, 0)).toBe(10)
    expect(mischiefFed(10, 9, 0, 1)).toBe(10)
    expect(mischiefFed(29, 9, 0, 0)).toBe(GA_KIT.mischief.need)
  })

  it('lets Pawmot rise once with half a charge or more', () => {
    expect(furCharged(0, GA_KIT.fur.full * 2)).toBe(1)
    expect(furHolds(2, false)).toBe(true)
    expect(furHolds(1, false)).toBe(false)
    expect(furHolds(2, true)).toBe(false)
    expect(blessingHp(2, false, 0.5)).toBeCloseTo(0.5)
    expect(blessingHp(2, false, 0.49)).toBeNull()
    expect(blessingHp(2, true, 1)).toBeNull()
    expect(blessingHp(1, false, 1)).toBeNull()
  })

  it('soaks most of a hit with a plate and vents the cannon at the top', () => {
    expect(plateSoak(10, 1)).toBeCloseTo(4)
    expect(plateSoak(10, 0)).toBe(10)
    expect(heatCast(atStage(GA_KIT.heat.need, 0) - 1, 0)).toEqual({ heat: 0, vented: true })
    expect(heatCast(3, 0)).toEqual({ heat: 4, vented: false })
  })

  it('guards Shedinja from all but super-effective and typeless hits, and floats it beside Ninjask', () => {
    expect(wonderGuardHolds(['water'])).toBe(true)
    expect(wonderGuardHolds(['normal', 'grass'])).toBe(true)
    expect(wonderGuardHolds(['fire'])).toBe(false)
    expect(wonderGuardHolds(['dark'])).toBe(false)
    expect(wonderGuardHolds([])).toBe(false)
    expect(shellOut(1, null)).toBe(true)
    expect(shellOut(1, 'ninjask')).toBe(true)
    expect(shellOut(1, 'shedinja')).toBe(false)
    expect(shellOut(0, null)).toBe(false)
  })

  it('caps every bonus a kit adds', () => {
    expect(gaKitADeltas({ kind: 'dance', stacks: 5, calm: 0 }, 2)).toEqual([{ might: 5 * GA_KIT.dance.might, speed: 5 * GA_KIT.dance.speed }])
    expect(gaKitADeltas({ kind: 'spirits', spirits: 108, wisps: 9, tick: 0 }, 0)[0]?.might).toBeCloseTo(0.18)
    expect(gaKitADeltas({ kind: 'heat', heat: 0, vent: 0, rival: false, check: 0 }, 0)).toEqual([])
    expect(gaKitADeltas(undefined, 0)).toEqual([])
  })

  it('opens Shedinja only with a Shed Shell, and the Antique Form only with a Chipped Pot', () => {
    const ctx = { weather: 'clear', biome: 'meadow' } as const
    expect(evolutionOffers(createRng(1), ['ninjask', 'shedinja'], ctx, []).map((o) => o.id)).toEqual(['ninjask'])
    expect(evolutionOffers(createRng(1), ['ninjask', 'shedinja'], ctx, ['shedShell']).map((o) => o.id)).toEqual(['ninjask', 'shedinja'])
    expect(evolutionOffers(createRng(1), ['polteageist', 'polteageistAntique'], ctx, []).map((o) => o.id)).toEqual(['polteageist'])
    expect(evolutionOffers(createRng(1), ['polteageist', 'polteageistAntique'], ctx, ['chippedPot']).map((o) => o.id)).toEqual(['polteageist', 'polteageistAntique'])
  })
})
