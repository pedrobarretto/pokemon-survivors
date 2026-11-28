import { describe, expect, it } from 'vitest'
import { drainHeal, showDrain } from './combat'
import { DRAIN } from './kitRules'
import { NO_RANKS } from './meta'
import { startGame, type ReplayStart } from './replay'
import type { Game } from './types'

const run = (difficulty: ReplayStart['difficulty'] = 'normal'): Game => {
  const g = startGame({ seed: 3, starter: 'squirtle', difficulty, ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } })
  g.player.hp = 1
  return g
}

/** HP one hit of `damage` drains at `fraction` from `move`'s budget, the player low enough not to top out. */
const heal = (g: Game, damage: number, fraction: number, move: Parameters<typeof drainHeal>[3] = 'drainPunch') => {
  const before = g.player.hp
  drainHeal(g, damage, fraction, move)
  return g.player.hp - before
}

describe('drainHeal', () => {
  it('heals the damage times the move’s share, at two damage levels', () => {
    const g = run()
    expect(heal(g, 20, 0.35)).toBeCloseTo(7)
    g.now += 1
    expect(heal(g, 30, 0.35)).toBeCloseTo(10.5)
    // Small heals aren't rounded away: HP is fractional.
    g.now += 1
    expect(heal(g, 1, 0.12)).toBeCloseTo(0.12)
  })

  it('tops out at the move’s own budget, refilling at DRAIN.rate of max HP per second', () => {
    const g = run()
    const cap = g.player.stats.maxHp * DRAIN.rate * DRAIN.hold
    // A horde of hits in the same instant: the first ones heal in full, the budget holds the rest.
    let total = 0
    for (let i = 0; i < 10; i++) total += heal(g, 20, 0.35)
    expect(total).toBeCloseTo(cap)
    g.now += 0.5
    expect(heal(g, 1000, 0.5)).toBeCloseTo(g.player.stats.maxHp * DRAIN.rate * 0.5)
  })

  it('gives every drain source a budget of its own, so two moves heal side by side', () => {
    const g = run()
    const cap = g.player.stats.maxHp * DRAIN.rate * DRAIN.hold
    expect(heal(g, 1000, 0.5, 'drainPunch')).toBeCloseTo(cap)
    expect(heal(g, 1000, 0.5, 'drainPunch')).toBe(0)
    expect(heal(g, 1000, 0.5, 'gigaDrain')).toBeCloseTo(cap)
    expect(heal(g, 20, 0.5, 'bitterBlade')).toBeCloseTo(10)
  })

  it('heals half as much in Nightmare', () => {
    const g = run('nightmare')
    expect(heal(g, 20, 0.35)).toBeCloseTo(3.5)
    g.now += 1
    expect(heal(g, 30, 0.35)).toBeCloseTo(5.25)
  })

  it('shows what it healed as one green "+N" every DRAIN.show seconds', () => {
    const g = run()
    g.now = 10
    const pluses = () => g.texts.filter((t) => t.text.startsWith('+')).map((t) => t.text)
    heal(g, 20, 0.35)
    heal(g, 10, 0.35, 'gigaDrain')
    expect(pluses()).toEqual(['+7'])
    g.now += DRAIN.show / 2
    heal(g, 10, 0.35)
    showDrain(g)
    expect(pluses()).toEqual(['+7'])
    g.now += DRAIN.show
    showDrain(g)
    expect(pluses()).toEqual(['+7', '+7'])
  })
})
