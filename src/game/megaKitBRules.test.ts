import { describe, expect, it } from 'vitest'
import type { PlayableId } from '../data/hatchlings'
import { spawnEnemy } from './enemies'
import { createGame, step } from './game'
import type { Game } from './types'
import {
  crashCost, createMegaKitB, eruptionBombs, gardenCap, gardenerOf, gardenHeal, hopReady, leapLift, MEGA_KIT_B, megaKitBDeltas, petalEvery, pureAfter,
  pureCap, venomMult, venomSizes,
} from './megaKitBRules'

describe('Pure Power', () => {
  it('adds a stack per landing up to the cap, and a crash takes them all, but for the Mega', () => {
    expect(pureAfter(2, true, 3, false)).toBe(3)
    expect(pureAfter(3, true, 3, false)).toBe(3)
    expect(pureAfter(3, false, 3, false)).toBe(0)
    expect(pureAfter(6, false, pureCap(1, true), true)).toBe(6)
    expect(pureCap(1, true)).toBeGreaterThan(pureCap(1, false))
  })

  it('makes a crash cost its share of max HP, never the last point', () => {
    expect(crashCost(100, 80, MEGA_KIT_B.pure.crash)).toBe(6)
    expect(crashCost(100, 4, MEGA_KIT_B.pure.crash)).toBe(3)
    expect(crashCost(100, 1, MEGA_KIT_B.pure.crash)).toBe(0)
  })

  it('turns stacks into might, and nothing for a family without the kit', () => {
    const kit = createMegaKitB('meditite')
    expect(megaKitBDeltas(kit ?? undefined)).toEqual([])
    expect(megaKitBDeltas({ kind: 'pure', stacks: 4, leap: 0, total: 0, resolve: 0, landed: false })).toEqual([{ might: 4 * MEGA_KIT_B.pure.might }])
    expect(createMegaKitB('charmander')).toBeNull()
    expect(createMegaKitB('skrelp')).toBeNull()
  })

  it('lifts the leap up and back down', () => {
    expect(leapLift(0.3, 0.3, 14)).toBe(0)
    expect(leapLift(0.15, 0.3, 14)).toBe(14)
    expect(leapLift(0, 0.3, 14)).toBe(0)
  })
})

describe('Eruption', () => {
  it('throws more bombs the more HP is left, and more still as the Mega', () => {
    expect(eruptionBombs(0, 0, false)).toBe(MEGA_KIT_B.erupt.bombs[0][0])
    expect(eruptionBombs(1, 0, false)).toBe(MEGA_KIT_B.erupt.bombs[0][1])
    expect(eruptionBombs(0.5, 1, false)).toBeGreaterThan(eruptionBombs(0.2, 1, false))
    expect(eruptionBombs(1, 1, true)).toBeGreaterThan(eruptionBombs(1, 1, false))
    // HP past full (a shield, a rounding) never throws more than the top.
    expect(eruptionBombs(1.4, 1, false)).toBe(MEGA_KIT_B.erupt.bombs[1][1])
  })
})

describe('the hop', () => {
  it('goes only recharged, on the ground and with a foe about to touch', () => {
    expect(hopReady(0, 0, 4)).toBe(true)
    expect(hopReady(1, 0, 4)).toBe(false)
    expect(hopReady(0, 0.1, 4)).toBe(false)
    expect(hopReady(0, 0, MEGA_KIT_B.hop.near + 1)).toBe(false)
    expect(hopReady(0, 0, null)).toBe(false)
  })
})

describe('the garden', () => {
  it('grows by the form: Florges keeps the biggest garden and heals most, the Mega fires fastest', () => {
    expect(gardenerOf(0, null)).toBe('flabebe')
    expect(gardenerOf(1, 'floetteEternal')).toBe('eternal')
    expect(gardenerOf(1, 'florges')).toBe('florges')
    expect(gardenCap('florges')).toBeGreaterThan(gardenCap('eternal'))
    expect(gardenCap('eternal')).toBeGreaterThan(gardenCap('flabebe'))
    expect(gardenHeal('florges')).toBeGreaterThan(gardenHeal('eternal'))
    expect(petalEvery('eternal', true)).toBeLessThan(petalEvery('eternal', false))
  })
})

describe('long-range venom', () => {
  it('grows from ×1 up close to the stage’s most far away, the Mega’s further', () => {
    const V = MEGA_KIT_B.venom
    expect(venomMult(V.near, 0, false)).toBe(1)
    expect(venomMult(V.far, 0, false)).toBeCloseTo(V.max[0])
    expect(venomMult(V.far * 3, 1, false)).toBeCloseTo(V.max[1])
    expect(venomMult(V.far, 1, true)).toBeCloseTo(V.megaMax)
    expect(venomMult((V.near + V.far) / 2, 1, false)).toBeGreaterThan(1)
    expect(venomSizes(V.far).splash).toBe(V.splash[1])
    expect(venomSizes(0).r).toBe(V.r[0])
  })
})

describe('in a run', () => {
  const run = (starter: PlayableId): Game => createGame(starter, { w: 480, h: 270 }, 7)
  const idle = { move: { x: 0, y: 0 }, special: false }
  const ticks = (g: Game, n: number) => {
    for (let i = 0; i < n; i++) step(g, idle, 1 / 60)
  }
  const count = (g: Game, visual: string) => g.attacks.filter((a) => a.visual === visual).length

  it('lets Numel’s humps blow on their clock, a bomb and a pool each', () => {
    const g = run('numel')
    ticks(g, Math.ceil(MEGA_KIT_B.erupt.every[0] * 60) + 1)
    expect(count(g, 'mbBomb')).toBeGreaterThan(0)
    expect(count(g, 'mbMagma')).toBe(count(g, 'mbBomb'))
  })

  it('plants Flabébé’s blossoms, never past the cap', () => {
    const g = run('flabebe')
    ticks(g, 60 * 30)
    const alive = g.attacks.filter((a) => a.visual === 'mbBlossom' && a.age < a.ttl - 0.5).length
    expect(alive).toBeGreaterThan(0)
    expect(alive).toBeLessThanOrEqual(gardenCap('flabebe'))
  })

  it('hops Buneary away from a foe about to touch, and readies the counter', () => {
    const g = run('buneary')
    spawnEnemy(g, 'rattata', g.player.x + 12, g.player.y)
    const from = g.player.x
    ticks(g, 30)
    const kit = g.player.megaB
    expect(kit?.kind === 'hop' && kit.down > 0).toBe(true)
    expect(g.player.x).toBeLessThan(from)
  })
})
