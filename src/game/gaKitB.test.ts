import { describe, expect, it } from 'vitest'
import type { PlayableId } from '../data/hatchlings'
import { hurtPlayer } from './combat'
import { createGame, step } from './game'
import { createKitB, diveReady, eggHeal, eggTaken, eruptPower, faded, galeOn, KIT_B, kitBDeltas, launcherShot, stackUp, stepSerpent, type SerpentBody } from './gaKitBRules'
import { spawnEnemy } from './enemies'
import { kitBKill } from './gaKitBSystem'
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

  it("lays Onix's body behind it, folds it after a turn and coils it, never stacked, when standing", () => {
    const body: SerpentBody = { segs: [], still: 0, coil: 0, turn: 1 }
    let x = 0
    const at = (i: number) => ({ x: body.segs[i * 2]!, y: body.segs[i * 2 + 1]! })
    for (let i = 0; i < 60; i++) stepSerpent(body, (x += 2), 0, 1, 0, 1, 1 / 60)
    for (let i = 0; i < 5; i++) expect(at(i).x).toBeLessThan(x)
    // Back the other way: the head passes through, and the body ends up trailing to its right.
    for (let i = 0; i < 120; i++) stepSerpent(body, (x -= 2), 0, -1, 0, 1, 1 / 60)
    for (let i = 0; i < 5; i++) expect(at(i).x).toBeGreaterThan(x)
    for (let t = 0; t < 180; t++) {
      body.still += 1 / 60
      stepSerpent(body, x, 0, -1, 0, 1, 1 / 60)
    }
    for (let i = 0; i < 5; i++) for (let j = i + 1; j < 5; j++) expect(Math.hypot(at(i).x - at(j).x, at(i).y - at(j).y)).toBeGreaterThan(5)
    for (let i = 0; i < 5; i++) expect(Math.hypot(at(i).x - x, at(i).y)).toBeLessThan(KIT_B.serpent.coil[1] + 1)
  })

  it('dives with a foe close once recharged, and erupts harder with Moxie', () => {
    expect(diveReady(0, false, KIT_B.burrow.near)).toBe(true)
    expect(diveReady(0.1, false, 1)).toBe(false)
    expect(diveReady(0, true, 1)).toBe(false)
    expect(diveReady(0, false, KIT_B.burrow.near + 1)).toBe(false)
    expect(eruptPower(2, 10)).toBeCloseTo(KIT_B.burrow.power[2] * (1 + 10 * KIT_B.burrow.moxie.erupt))
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

  it('Moxie stacks on every KO up to the stage cap, and pays in might', () => {
    const g = run('sandile')
    const might = g.player.stats.might
    for (let i = 0; i < 9; i++) kitBKill(g, 'crunch')
    expect(g.player.kitB?.kind === 'burrow' && g.player.kitB.stacks).toBe(KIT_B.burrow.moxie.cap[0])
    expect(g.player.stats.might).toBeCloseTo(might + KIT_B.burrow.moxie.cap[0] * KIT_B.burrow.moxie.might)
  })

  it("Stufful's hug grabs a foe in reach, carries it, then hurls it", () => {
    const g = run('stufful')
    const kit = g.player.kitB
    if (kit?.kind !== 'hug') throw new Error('no hug')
    kit.next = 0
    spawnEnemy(g, 'geodude', g.player.x + 20, g.player.y)
    const e = g.enemies[g.enemies.length - 1]!
    // Tough enough to outlast Hammer Arm's casts meanwhile.
    e.hp = 1e9
    step(g, idle, 1 / 60)
    expect(kit.held?.id).toBe(e.id)
    for (let i = 0; i < 60 && kit.held; i++) step(g, idle, 1 / 60)
    expect(kit.held).toBeNull()
    expect(kit.flying?.id).toBe(e.id)
    expect(e.thrown).not.toBeNull()
  })

  it('keeps its state plain, so snapshots and co-op hashes take it', () => {
    for (const id of ['onix', 'happiny', 'skorupi', 'golett', 'sandile', 'stufful'] as const) {
      const g = run(id)
      for (let i = 0; i < 120; i++) step(g, { move: { x: 1, y: 0 }, special: false }, 1 / 60)
      expect(() => snapshot(g)).not.toThrow()
    }
  })
})
