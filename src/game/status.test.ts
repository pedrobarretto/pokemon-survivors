import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BASE_STATS } from './stats'
import { moveStats } from './moves'
import {
  applyStatus,
  createStatus,
  DOT_INTERVAL,
  dotDps,
  PARALYSIS_STUN,
  scaleStatus,
  statusAttack,
  statusPace,
  tickStatus,
  type StatusSpec,
} from './status'

const poison: StatusSpec = { kind: 'poison', chance: 1, duration: 3, power: 0.5 }
const burn: StatusSpec = { kind: 'burn', chance: 1, duration: 2, power: 0.5 }
const paralysis: StatusSpec = { kind: 'paralysis', chance: 1, duration: 2, power: 0 }

describe('status conditions', () => {
  it('stacks poison up to the cap and refreshes its duration', () => {
    const st = createStatus()
    for (let i = 0; i < 8; i++) applyStatus(st, poison, 10, false, 'sludgeBomb')
    expect(st.poison.stacks).toBe(5)
    expect(dotDps(st.poison)).toBe(25) // 5 stacks × 50% of 10
    tickStatus(st, 1, false, createRng(1))
    applyStatus(st, poison, 10, false, 'sludgeBomb')
    expect(st.poison.time).toBe(3)
  })

  it('does not stack burn but keeps the strongest one', () => {
    const st = createStatus()
    applyStatus(st, burn, 20, false, 'ember')
    applyStatus(st, burn, 10, false, 'fireSpin')
    expect(st.burn.stacks).toBe(1)
    expect(dotDps(st.burn)).toBe(10)
    expect(st.burn.move).toBe('ember')
    expect(statusAttack(st)).toBeLessThan(1)
  })

  it('ticks DoT on an interval and clears afflictions when they expire', () => {
    const st = createStatus()
    const rng = createRng(1)
    applyStatus(st, burn, 10, false, 'ember')
    expect(tickStatus(st, DOT_INTERVAL / 2, false, rng)).toBe(false)
    expect(tickStatus(st, DOT_INTERVAL / 2, false, rng)).toBe(true)
    tickStatus(st, 5, false, rng)
    expect(st.burn).toMatchObject({ time: 0, power: 0, stacks: 0, move: null })
    expect(statusAttack(st)).toBe(1)
  })

  it('gives bosses shorter paralysis and stuns', () => {
    const normal = createStatus()
    const boss = createStatus()
    applyStatus(normal, paralysis, 10, false, 'thunder')
    applyStatus(boss, paralysis, 10, true, 'thunder')
    expect(normal.stun).toBe(PARALYSIS_STUN)
    expect(boss.stun).toBeLessThan(normal.stun)
    expect(boss.paralysis.time).toBeLessThan(normal.paralysis.time)
    expect(statusPace(normal)).toBe(0)
  })

  it('slows by its power', () => {
    const st = createStatus()
    applyStatus(st, { kind: 'slow', chance: 1, duration: 0.6, power: 0.4 }, 10, false, 'whirlpool')
    expect(statusPace(st)).toBeCloseTo(0.6)
  })
})

describe('scaleStatus', () => {
  it('caps chance at 100% and only boosts DoT power', () => {
    const slow: StatusSpec = { kind: 'slow', chance: 1, duration: 1, power: 0.4 }
    expect(scaleStatus(slow, { chance: 0.5, damage: 1, duration: 1.5 })).toEqual({ ...slow, duration: 1.5 })
    expect(scaleStatus(burn, { chance: 0.2, damage: 0.5, duration: 1 })).toEqual({ ...burn, power: 0.75 })
  })

  it('applies move upgrades and held items through moveStats', () => {
    const base = moveStats('ember', 1, BASE_STATS).status!
    const boosted = moveStats('ember', 3, { ...BASE_STATS, statusChance: 0.1, statusDamage: 0.2 }).status!
    expect(base.kind).toBe('burn')
    expect(boosted.chance).toBeCloseTo(base.chance + 0.2) // +10% upgrade, +10% item
    expect(boosted.power).toBeCloseTo(base.power * 1.2)
    expect(moveStats('swift', 1, BASE_STATS).status).toBeNull()
  })
})
