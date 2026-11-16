import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { branchesAt } from '../data/branches'
import { evolutionOffers, formAt } from './branch'
import { guardWard, GUARD_UPTIME } from './kitRules'
import { pendingEvolution } from './leveling'
import { NO_RANKS } from './meta'
import { MOVES } from './moves'
import { startGame, type ReplayStart } from './replay'
import { spawnHazard } from './bosses'
import { killEnemy } from './combat'
import { spawnEnemy } from './enemies'
import { applyStatus } from './status'
import { reflectShots } from './seasonOneEggMoves'
import { BLITZ, blitzPower, biteMult, reflectedVelocity, shieldAnswer, veilFreeze, veilRadius, VEIL, venomJump, VENOM } from './seasonOneEggRules'

describe('venom spread', () => {
  it('jumps weaker, lasts at least its minimum, and dies out', () => {
    const jump = venomJump({ time: 0.4, power: 8 })
    expect(jump).toEqual({ kind: 'poison', chance: 1, duration: VENOM.minTime, power: 8 * VENOM.decay })
    expect(venomJump({ time: 3, power: 0.4 })).toBeNull()
  })
})

describe('reflected shots', () => {
  it('leave straight back, faster', () => {
    const v = reflectedVelocity(100, 0)
    expect(v.vx).toBeLessThan(-100)
    expect(v.vy === 0).toBe(true)
  })
  it('still fly when the shot was hovering', () => expect(Math.abs(reflectedVelocity(0, 0).vx)).toBeGreaterThan(0))
})

describe('bite and veil', () => {
  it('grows with the marks on the target, up to three', () => {
    expect(biteMult(0)).toBe(1)
    expect(biteMult(1)).toBeGreaterThan(1)
    expect(biteMult(9)).toBe(biteMult(3))
  })
  it('keeps the aurora from filling the screen and its freeze capped', () => {
    expect(veilRadius(3)).toBe(VEIL.maxR)
    expect(veilFreeze(0.9)).toBe(VEIL.maxFreeze)
  })
})

describe('protective windows', () => {
  it('stand at most the guard share of the cooldown however long the duration gets', () => {
    expect(guardWard({ duration: 99, cooldown: MOVES.ironDefense.base.cooldown })).toBe(MOVES.ironDefense.base.cooldown * GUARD_UPTIME)
    expect(guardWard({ duration: 99, cooldown: MOVES.magicCoat.base.cooldown })).toBe(MOVES.magicCoat.base.cooldown * GUARD_UPTIME)
  })
  it('answers harder with armor, never less without it', () => {
    expect(shieldAnswer(10, 2)).toBeGreaterThan(10)
    expect(shieldAnswer(10, -3)).toBe(10)
  })
})

describe('Applin line', () => {
  const ctx = { weather: 'clear', biome: 'meadow' } as const
  const options = branchesAt('applin', 1)
  const start: ReplayStart = { seed: 3, starter: 'applin', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

  it('evolves into Dipplin with no apple, and offers the choice with one', () => {
    expect(evolutionOffers(createRng(1), options, ctx, []).map((o) => o.id)).toEqual(['dipplin'])
    expect(evolutionOffers(createRng(1), options, ctx, ['tartApple']).map((o) => o.id)).toEqual(['dipplin', 'flapple'])
    expect(evolutionOffers(createRng(1), options, ctx, ['tartApple', 'sweetApple']).map((o) => o.id)).toEqual(['dipplin', 'flapple', 'appletun'])
  })

  it('goes on to Hydrapple from Dipplin, and ends at the Apple branches', () => {
    expect(formAt('applin', 'dipplin', 2).name).toBe('Hydrapple')
    expect(formAt('applin', 'flapple', 2).name).toBe('Flapple')
    const g = startGame(start)
    g.player.stage = 1
    g.player.level = 40
    g.player.branch = 'dipplin'
    expect(pendingEvolution(g)).toEqual({ from: 1011, to: 1019 })
    g.player.branch = 'flapple'
    expect(pendingEvolution(g)).toBeNull()
  })
})

describe('in a run', () => {
  const start: ReplayStart = { seed: 3, starter: 'hatenna', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

  it('sends a shot back as the player\'s own and spends the cast', () => {
    const g = startGame(start)
    const p = g.player
    spawnHazard(g, { kind: 'shot', visual: 'rock', x: p.x + 10, y: p.y, vx: -200, vy: 0, r: 3, damage: 4, ttl: 3 })
    g.attacks.length = 0
    MOVES.magicCoat.fire(g, { ...MOVES.magicCoat.base, status: null, mods: 0 })
    const mirror = g.attacks.find((a) => a.visual === 'protect')!
    reflectShots(g, mirror)
    expect(g.hazards[0]!.ttl).toBe(g.hazards[0]!.age)
    expect(mirror.memo).toBe(1)
    const back = g.attacks.find((a) => a.visual === 'psy')!
    expect(back.motion).toMatchObject({ kind: 'linear' })
    expect(back.motion.kind === 'linear' && back.motion.vx).toBeGreaterThan(200)
  })

  it('jumps its poison to the neighbors of a foe that falls poisoned', () => {
    const g = startGame(start)
    const p = g.player
    const a = spawnEnemy(g, 'rattata', p.x + 200, p.y)
    const b = spawnEnemy(g, 'rattata', p.x + 220, p.y)
    applyStatus(a.status, { kind: 'poison', chance: 1, duration: 4, power: 4 }, 1, false, 'corrosiveGas', p.slot)
    killEnemy(g, a, 'corrosiveGas')
    expect(b.status.poison.time).toBeGreaterThan(0)
    expect(b.status.poison.power).toBeCloseTo(4 * VENOM.decay)
  })
})

describe('Flare Blitz', () => {
  it('burns harder the faster you run, up to its cap, and barely standing still', () => {
    expect(blitzPower(BLITZ.walk, true)).toBe(1)
    expect(blitzPower(BLITZ.walk + 20, true)).toBeCloseTo(1.4)
    expect(blitzPower(500, true)).toBe(BLITZ.max)
    expect(blitzPower(500, false)).toBe(BLITZ.still)
  })
})
