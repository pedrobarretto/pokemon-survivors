import { describe, expect, it } from 'vitest'
import { ABILITIES, ABILITY, ABILITY_IDS, BRANCH_ABILITIES, FAMILY_ABILITIES } from '../data/abilities'
import { PLAYABLE_IDS } from '../data/hatchlings'
import { abilityKey, grantAbility, updateAbility } from './abilities'
import { hazardHit } from './bosses'
import { hurtPlayer } from './combat'
import { curseCast, updateCurses } from './curseSystem'
import { createGame } from './game'
import { recomputeStats } from './leveling'
import type { Game } from './types'

const VIEW = { w: 480, h: 270 }

/** A fresh run that picked `ability`, its stats rebuilt. */
const withAbility = (ability: keyof typeof ABILITIES, starter: Parameters<typeof createGame>[0] = 'charmander'): Game => {
  const g = createGame(starter, { ...VIEW }, 1)
  grantAbility(g, ability)
  recomputeStats(g)
  g.events.length = 0
  return g
}

/** Ticks the ability for `seconds` the way `step` does. */
const tick = (g: Game, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) if (updateAbility(g, dt)) recomputeStats(g)
}

describe('ability data', () => {
  it('gives every family two abilities and a Hidden one (Honedge keeps Stance Change alone), all described', () => {
    for (const id of PLAYABLE_IDS) expect(FAMILY_ABILITIES[id].length, id).toBe(id === 'honedge' ? 1 : 3)
    for (const set of Object.values(BRANCH_ABILITIES)) expect(new Set(set).size).toBe(3)
    for (const id of ABILITY_IDS) expect(ABILITIES[id].name.length).toBeGreaterThan(0)
  })
})

describe('pinch abilities', () => {
  it('boost their type only under a third of max HP', () => {
    const g = withAbility('blaze')
    const p = g.player
    p.hp = p.stats.maxHp * ABILITY.pinch + 1
    tick(g, 0.1)
    expect(p.stats.typeDamage.fire ?? 0).toBe(0)
    p.hp = p.stats.maxHp * ABILITY.pinch - 1
    tick(g, 0.1)
    expect(p.stats.typeDamage.fire).toBeCloseTo(0.5)
    p.hp = p.stats.maxHp
    tick(g, 0.1)
    expect(p.stats.typeDamage.fire ?? 0).toBe(0)
  })

  it('leave the stats alone while a Mega form lasts', () => {
    const g = withAbility('blaze')
    g.player.hp = 1
    const key = abilityKey(g)
    g.player.mega.active = 5
    expect(abilityKey(g)).not.toBe(key)
    recomputeStats(g)
    expect(g.player.stats.typeDamage.fire ?? 0).toBe(0)
  })
})

describe('Sturdy', () => {
  it('holds once a run at 1 HP, then the next lethal hit faints', () => {
    const g = withAbility('sturdy')
    const p = g.player
    hurtPlayer(g, p.stats.maxHp * 10)
    expect(p.hp).toBe(1)
    expect(g.phase).toBe('playing')
    expect(g.events).toContainEqual({ kind: 'ability', id: 'sturdy', moment: 'proc' })
    p.iframes = 0
    hurtPlayer(g, p.stats.maxHp * 10)
    expect(g.phase).toBe('gameover')
  })
})

describe('Speed Boost', () => {
  it('adds speed every 20 s and stops at its cap', () => {
    const g = withAbility('speedBoost')
    const base = g.player.stats.speed
    tick(g, 19.9)
    expect(g.player.stats.speed).toBe(base)
    tick(g, 0.2)
    expect(g.player.stats.speed).toBe(base + 3)
    tick(g, 20 * 15)
    expect(g.player.stats.speed).toBe(base + 30)
  })
})

describe('hits taken', () => {
  it('Water Absorb heals from Water attacks instead of hurting', () => {
    const g = withAbility('waterAbsorb', 'eevee')
    const p = g.player
    p.hp = 50
    hurtPlayer(g, 20, undefined, ['water'])
    expect(p.hp).toBeGreaterThan(50)
    p.iframes = 0
    hurtPlayer(g, 20, undefined, ['fire'])
    expect(p.hp).toBeLessThan(50)
  })

  it('Levitate floats over lava, traps and patches on the ground, but not over a strike', () => {
    const g = withAbility('levitate')
    const p = g.player
    const full = p.hp
    hurtPlayer(g, 30, undefined, ['fire'], 'lava')
    hurtPlayer(g, 30, undefined, [], 'trap')
    hurtPlayer(g, 30, undefined, ['fire'], hazardHit({ kind: 'zone' }))
    expect(p.hp).toBe(full)
    hurtPlayer(g, 30, undefined, [], 'hazard')
    expect(p.hp).toBeLessThan(full)
  })

  it('Magic Guard takes only direct hits: no lingering patch, no cursed item bite', () => {
    const g = withAbility('magicGuard', 'abra')
    const p = g.player
    const full = p.hp
    hurtPlayer(g, 30, undefined, ['poison'], hazardHit({ kind: 'zone' }))
    g.player.curses.held.push('lifeOrb', 'flameOrb')
    curseCast(g)
    updateCurses(g)
    expect(p.hp).toBe(full)
    hurtPlayer(g, 30, undefined, [], hazardHit({ kind: 'strike' }))
    expect(p.hp).toBeLessThan(full)
  })

  it('without Magic Guard, a lingering patch and a cursed item still hurt', () => {
    const g = withAbility('synchronize', 'abra')
    const p = g.player
    const full = p.hp
    hurtPlayer(g, 30, undefined, ['poison'], hazardHit({ kind: 'zone' }))
    expect(p.hp).toBeLessThan(full)
    const hurt = p.hp
    g.player.curses.held.push('lifeOrb')
    curseCast(g)
    expect(p.hp).toBeLessThan(hurt)
  })
})
