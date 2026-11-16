import { describe, expect, it } from 'vitest'
import { blessing, momentum, sunHeal } from './gallopRules'
import { bonusApplies } from './kitRules'
import type { Enemy } from './types'

describe('the gallop batch', () => {
  it('heals by the sky as in the games: the sun the most, clear half-ish, the rest a quarter', () => {
    expect(sunHeal('sun', 1)).toBeGreaterThan(sunHeal('clear', 1))
    expect(sunHeal('clear', 1)).toBeGreaterThan(sunHeal('rain', 1))
    for (const sky of ['rain', 'sand', 'snow', 'fog'] as const) expect(sunHeal(sky, 1)).toBe(sunHeal('rain', 1))
    expect(sunHeal('sun', 8)).toBeGreaterThan(sunHeal('sun', 1))
    expect(sunHeal('sun', 99)).toBe(sunHeal('sun', 8))
  })

  it('charges High Horsepower with the ground covered, from a floor standing still', () => {
    expect(momentum(0, 220, 0.35)).toBe(0.35)
    expect(momentum(110, 220, 0.35)).toBeCloseTo(0.675)
    expect(momentum(10_000, 220, 0.35)).toBe(1)
  })

  it('turns what Revival Blessing cannot fit under max HP into its flare', () => {
    expect(blessing(30, 50, 100, 1.6)).toEqual({ heal: 30, flare: 0 })
    expect(blessing(30, 90, 100, 1.6)).toEqual({ heal: 10, flare: 32 })
    expect(blessing(30, 100, 100, 1.6)).toEqual({ heal: 0, flare: 48 })
  })

  it('counts a foe as heavy for Low Kick from its mass', () => {
    const foe = (mass: number) => ({ mass }) as Enemy
    expect(bonusApplies('heavy', foe(1))).toBe(false)
    expect(bonusApplies('heavy', foe(1.8))).toBe(true)
    expect(bonusApplies('heavy', foe(30))).toBe(true)
  })
})
