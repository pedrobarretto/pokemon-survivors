import { describe, expect, it } from 'vitest'
import type { PlayableId } from '../data/hatchlings'
import { hurtPlayer } from './combat'
import { createGame, step } from './game'
import { createKitB, eggHeal, eggTaken, faded, galeOn, KIT_B, kitBDeltas, launcherShot, stackUp } from './gaKitBRules'
import { snapshot } from './snapshot'
import type { Game } from './types'

const run = (starter: PlayableId): Game => createGame(starter, { w: 480, h: 270 }, 7)

const hit = (g: Game, amount: number) => {
  g.player.iframes = 0
  hurtPlayer(g, amount)
}

const idle = { move: { x: 0, y: 0 }, special: false }

describe('second batch rules', () => {
  it('gives a kit only to its families', () => {
    expect(createKitB('charmander')).toBeNull()
    expect(createKitB('onix')?.kind).toBe('serpent')
    expect(createKitB('tynamo')).toBeNull()
  })

  it('fires the Mega Launcher blast every 4th Aura Sphere, every 3rd as Clawitzer', () => {
    const blasts = (stage: number) => {
      let shots = 0
      return Array.from({ length: 6 }, () => {
        const next = launcherShot(shots, stage)
        shots = next.shots
        return next.blast
      })
    }
    expect(blasts(0)).toEqual([false, false, false, true, false, false])
    expect(blasts(1)).toEqual([false, false, true, false, false, true])
  })

  it('holds Gale Wings at full HP only', () => {
    expect(galeOn(100, 100)).toBe(true)
    expect(galeOn(95, 100)).toBe(false)
  })

  it('fades stacks one at a time after the hold, never below zero', () => {
    expect(faded(3, 1, 1 / 60, 4, 1.5)).toBe(3)
    expect(faded(3, 4 + 1.5, 1 / 60, 4, 1.5)).toBe(2)
    expect(faded(0, 99, 1 / 60, 4, 1.5)).toBe(0)
    expect(stackUp(6, 6)).toBe(6)
  })

  it('lets an egg be taken from its reach plus the body, and heals by stage', () => {
    expect(eggTaken(0, 0, KIT_B.eggs.reach + 6, 0, 6)).toBe(true)
    expect(eggTaken(0, 0, KIT_B.eggs.reach + 7, 0, 6)).toBe(false)
    expect(eggHeal(200, 2)).toBeCloseTo(200 * KIT_B.eggs.heal[2])
  })

  it('pays salt and Stamina in armor, capped by the cap the system holds them to', () => {
    expect(kitBDeltas({ kind: 'salt', layers: 2, last: 0 }, 0)).toEqual([{ armor: 1, damageTaken: -0.04 }])
    expect(kitBDeltas({ kind: 'gale', on: false }, 2)).toEqual([])
  })
})

describe('second batch kits in a run', () => {
  it('Water Bubble takes one hit, then the next lands until its cooldown runs', () => {
    const g = run('dewpider')
    const full = g.player.hp
    hit(g, 20)
    expect(g.player.hp).toBe(full)
    expect(g.player.kitB?.kind === 'bubble' && g.player.kitB.down).toBe(KIT_B.bubble.cooldown[0])
    hit(g, 20)
    expect(g.player.hp).toBeLessThan(full)
  })

  it('Stamina stacks on hits and pays in armor, capped by the stage', () => {
    const g = run('duraludon')
    const armor = g.player.stats.armor
    for (let i = 0; i < 10; i++) hit(g, 1)
    expect(g.player.kitB?.kind === 'stamina' && g.player.kitB.stacks).toBe(KIT_B.stamina.cap[0])
    expect(g.player.stats.armor).toBeGreaterThan(armor)
  })

  it('Gale Wings drops on a hit and its speed with it', () => {
    const g = run('fletchling')
    const fast = g.player.stats.speed
    hit(g, 5)
    step(g, idle, 1 / 60)
    expect(g.player.kitB?.kind === 'gale' && g.player.kitB.on).toBe(false)
    expect(g.player.stats.speed).toBeLessThan(fast)
  })

  it("Happiny's egg heals whoever walks over it", () => {
    const g = run('happiny')
    const kit = g.player.kitB
    if (kit?.kind !== 'eggs') throw new Error('no eggs')
    g.player.hp = 10
    kit.eggs.push({ x: g.player.x, y: g.player.y, left: 5 })
    step(g, idle, 1 / 60)
    expect(g.player.hp).toBeGreaterThan(10)
    expect(kit.eggs).toHaveLength(0)
  })

  it('keeps its state plain, so snapshots and co-op hashes take it', () => {
    for (const id of ['onix', 'happiny', 'skorupi', 'golett'] as const) {
      const g = run(id)
      for (let i = 0; i < 120; i++) step(g, { move: { x: 1, y: 0 }, special: false }, 1 / 60)
      expect(() => snapshot(g)).not.toThrow()
    }
  })
})
