import { describe, expect, it } from 'vitest'
import { createGame, step } from './game'
import { hurtPlayer } from './combat'
import { snapshot } from './snapshot'
import { KIT } from './seasonOneKitRules'
import type { PlayableId } from '../data/hatchlings'
import type { Game } from './types'

const run = (starter: PlayableId): Game => createGame(starter, { w: 480, h: 270 }, 7)

const hit = (g: Game, amount: number) => {
  g.player.iframes = 0
  hurtPlayer(g, amount)
}

describe('Temporada 1 kits in a run', () => {
  it("Mimikyu's Disguise takes one hit, then the next lands until its cooldown runs", () => {
    const g = run('mimikyu')
    const full = g.player.hp
    hit(g, 20)
    expect(g.player.hp).toBe(full)
    expect(g.player.kit?.kind === 'disguise' && g.player.kit.down).toBe(KIT.disguise.cooldown)
    hit(g, 20)
    expect(g.player.hp).toBeLessThan(full)
  })

  it('Rage stacks on hits and pays in might, capped by the stage', () => {
    const g = run('mankey')
    const might = g.player.stats.might
    for (let i = 0; i < 20; i++) hit(g, 1)
    expect(g.player.kit?.kind === 'rage' && g.player.kit.stacks).toBe(KIT.rage.cap[0])
    expect(g.player.stats.might).toBeGreaterThan(might)
  })

  it('Zero to Hero holds only once a run, and only for Palafin', () => {
    const finizen = run('finizen')
    finizen.player.hp = 1
    hit(finizen, 500)
    expect(finizen.phase).toBe('gameover')

    const palafin = run('finizen')
    palafin.player.stage = 1
    palafin.player.hp = 1
    hit(palafin, 500)
    expect(palafin.phase).toBe('playing')
    expect(palafin.player.hp).toBeGreaterThan(0)
    palafin.player.hp = 1
    hit(palafin, 500)
    expect(palafin.phase).toBe('gameover')
  })

  it('Tatsugiri rides out its Commander and stays locked out after', () => {
    const g = run('tatsugiri')
    g.phase = 'playing'
    if (g.player.kit?.kind === 'commander') g.player.kit.meter = KIT.commander.need
    const input = { move: { x: 0, y: 0 }, special: false }
    for (let t = 0; t < KIT.commander.left + 1; t += 1 / 60) step(g, input, 1 / 60)
    const kit = g.player.kit
    expect(kit?.kind === 'commander' && kit.left).toBe(0)
    expect(kit?.kind === 'commander' && kit.lockout).toBeGreaterThan(0)
  })

  it('keeps its state plain, so snapshots and co-op hashes take it', () => {
    for (const id of ['tandemaus', 'goomy', 'darumaka'] as const) expect(() => snapshot(run(id))).not.toThrow()
  })
})
