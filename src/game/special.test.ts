import { describe, expect, it } from 'vitest'
import { POKE_TYPES } from '../data/types'
import {
  beginJump, CHAIN_IFRAMES, CHAIN_WINDOW, comboCasts, createSpecialState, dashStep, endChain, jumpStep, landJump, MIN_SPECIAL_COOLDOWN, rechargeSpecial, resolveSpecial, SPECIAL_IDS, SPECIALS,
  specialCooldown, specialIdFor, specialOfType, specialReady, tickChain, triggerSpecial, type SpecialDef,
} from './special'
import { stanceStats, STANCES } from './stance'
import { BASE_STATS } from './stats'

const DT = 1 / 60

describe('special trigger', () => {
  it('fires on a press when ready, never while on cooldown or busy', () => {
    const s = createSpecialState()
    expect(triggerSpecial(s, true, DT)).toBe(true)
    s.cooldown = 5
    expect(triggerSpecial(s, true, DT)).toBe(false)
    s.cooldown = 0
    s.charge = 0.3
    expect(triggerSpecial(s, true, DT)).toBe(false)
  })

  it('buffers an early press until the cooldown runs out, then drops it', () => {
    const s = { ...createSpecialState(), cooldown: 0.1 }
    expect(triggerSpecial(s, true, DT)).toBe(false)
    let fired = 0
    for (let i = 0; i < 10; i++) fired += Number(triggerSpecial(s, false, DT))
    expect(fired).toBe(1)

    const late = { ...createSpecialState(), cooldown: 1 }
    triggerSpecial(late, true, DT)
    for (let i = 0; i < 90; i++) expect(triggerSpecial(late, false, DT)).toBe(false)
  })

  it('scales the cooldown with the cooldown stat, down to a floor', () => {
    const def = SPECIALS.blastBurn
    expect(specialCooldown(def, { ...BASE_STATS, cooldown: 0.8 })).toBeCloseTo(def.cooldown * 0.8)
    expect(specialCooldown(def, { ...BASE_STATS, cooldown: 0.1 })).toBe(MIN_SPECIAL_COOLDOWN)
  })
})

describe('special resolution', () => {
  it('gives every type its own special, picked by the first type', () => {
    expect(new Set(POKE_TYPES.map(specialOfType)).size).toBe(POKE_TYPES.length)
    for (const type of POKE_TYPES) expect(SPECIALS[specialOfType(type)].type).toBe(type)
    expect(specialIdFor('bulbasaur', ['grass', 'poison'])).toBe('frenzyPlant')
    expect(specialIdFor('toxel', ['electric', 'poison'])).toBe('boltStrike')
  })

  it('upgrades to the signature hyper move at the final stage', () => {
    expect(resolveSpecial('charmander', 0).tier.name).toBe('Flare Blitz')
    expect(resolveSpecial('charmander', 2).tier.name).toBe('Blast Burn')
    expect(resolveSpecial('squirtle', 2).tier.name).toBe('Hydro Cannon')
    expect(resolveSpecial('bulbasaur', 2).tier.name).toBe('Frenzy Plant')
    expect(resolveSpecial('pichu', 0).tier.name).toBe('Thunderbolt')
    expect(resolveSpecial('pichu', 2).tier.name).toBe('Bolt Strike')
  })
})

describe('special motion', () => {
  it('carries a chain jump exactly its reach along the aim, never past it', () => {
    let active = 0.1
    let moved = 0
    while (active > 0) {
      const step = jumpStep(Math.PI / 2, 70, active, DT)
      expect(step.dx).toBeCloseTo(0, 9)
      moved += step.dy
      active = Math.max(0, active - DT)
    }
    expect(moved).toBeCloseTo(70, 9)
  })

  it('dashes at a steady pace along the aim, its length the step it moved', () => {
    const a = dashStep(Math.PI, 130, DT)
    const b = dashStep(Math.PI, 130, 2 * DT)
    expect(a.dx).toBeLessThan(0)
    expect(b.dx).toBeCloseTo(2 * a.dx, 9)
    expect(Math.hypot(a.dx, a.dy)).toBeCloseTo(a.dist, 9)
  })
})

describe('chain dash', () => {
  it('keeps the cooldown off while the chain runs and opens a window after each hit', () => {
    const s = createSpecialState()
    beginJump(s, 3)
    expect([s.chaining, s.jumps, s.cooldown]).toEqual([true, 2, 0])
    landJump(s, true, 8)
    expect(s.window).toBe(CHAIN_WINDOW)
    expect(s.cooldown).toBe(0)
    expect(specialReady(s)).toBe(true)
  })

  it('starts the cooldown when the window runs out', () => {
    const s = createSpecialState()
    beginJump(s, 3)
    landJump(s, true, 8)
    let ticks = 0
    while (s.chaining) {
      tickChain(s, DT, 8)
      ticks++
    }
    expect(ticks).toBeCloseTo(CHAIN_WINDOW / DT, -1)
    expect([s.cooldown, s.total, s.jumps]).toEqual([8, 8, 0])
  })

  it('ends after its last jump or at once on a miss', () => {
    const s = createSpecialState()
    for (let i = 0; i < 3; i++) {
      beginJump(s, 3)
      landJump(s, true, 8)
    }
    expect([s.chaining, s.cooldown]).toEqual([false, 8])

    const miss = createSpecialState()
    beginJump(miss, 3)
    landJump(miss, false, 8)
    expect([miss.chaining, miss.window, miss.cooldown]).toEqual([false, 0, 8])
  })

  it('never stacks i-frames into permanent invulnerability', () => {
    const chains = SPECIAL_IDS.map((id): SpecialDef => SPECIALS[id]).filter((def) => def.kind === 'chain')
    expect(chains.length).toBeGreaterThan(0)
    // A whole chain at its most jumps stays invulnerable for under half the shortest possible cooldown.
    for (const def of chains) expect(def.final.count * CHAIN_IFRAMES).toBeLessThan(MIN_SPECIAL_COOLDOWN / 2)
    expect(specialCooldown(chains[0]!, { ...BASE_STATS, cooldown: 0.05 })).toBe(MIN_SPECIAL_COOLDOWN)
  })
})

describe('species specials', () => {
  it('gives the agile lines the chain dash and Aegislash alone Stance Change', () => {
    for (const id of ['treecko', 'sprigatito', 'riolu', 'gible', 'starly'] as const) expect(resolveSpecial(id, 0).def.kind).toBe('chain')
    expect(resolveSpecial('honedge', 0).def.kind).toBe('chain')
    expect(resolveSpecial('honedge', 1).def.kind).toBe('chain')
    expect(resolveSpecial('honedge', 2).def.kind).toBe('stance')
  })

  it('moves lines that evolve out of Normal onto their new type’s special', () => {
    expect([0, 1, 2].map((stage) => resolveSpecial('azurill', stage).id)).toEqual(['boomburst', 'hydroCannon', 'hydroCannon'])
    expect([0, 1].map((stage) => resolveSpecial('swablu', stage).id)).toEqual(['boomburst', 'dracoMeteor'])
  })

  it('swaps stance on a short fixed cooldown, below the special floor', () => {
    expect(specialCooldown(SPECIALS.stanceChange, { ...BASE_STATS, cooldown: 1.5 })).toBe(2)
  })

  it('trades damage for defense between the two formes', () => {
    const stats = { ...BASE_STATS, might: 1.5 }
    const shield = stanceStats(stats, 'shield')
    const blade = stanceStats(stats, 'blade')
    expect(shield.might).toBeCloseTo(1.5 * STANCES.shield.might)
    expect(shield.damageTaken).toBeCloseTo(0.7)
    expect(blade.might).toBeCloseTo(1.5 * 1.3)
    expect(blade.damageTaken).toBeGreaterThan(shield.damageTaken)
    expect(stanceStats(stats, null)).toBe(stats)
  })
})

describe('Power Herb', () => {
  it('cuts the cooldown by each kill the special made', () => {
    const s = { ...createSpecialState(), cooldown: 10, total: 10, kills: 4 }
    rechargeSpecial(s, 0.5)
    expect([s.cooldown, s.kills]).toEqual([8, 0])
  })

  it('banks kills made mid-chain until the cooldown starts', () => {
    const s = createSpecialState()
    beginJump(s, 3)
    s.kills = 6
    rechargeSpecial(s, 0.5)
    expect([s.cooldown, s.kills]).toEqual([0, 6])
    endChain(s, 8)
    rechargeSpecial(s, 0.5)
    expect([s.cooldown, s.kills]).toEqual([5, 0])
  })

  it('never brings a use closer than the cooldown floor to the next', () => {
    const s = { ...createSpecialState(), cooldown: 6, total: 8, kills: 50 }
    rechargeSpecial(s, 0.75)
    // 2 s already went by, so 2 s are left before the 4 s floor.
    expect(s.cooldown).toBeCloseTo(MIN_SPECIAL_COOLDOWN - 2)
    const late = { ...createSpecialState(), cooldown: 1, total: 8, kills: 2 }
    rechargeSpecial(late, 0.25)
    expect(late.cooldown).toBeCloseTo(0.5)
  })

  it('holds the floor through every later batch of kills, not just the first', () => {
    const s = { ...createSpecialState(), cooldown: 8.3, total: 8.6, kills: 20 }
    rechargeSpecial(s, 0.75)
    expect(s.cooldown).toBeCloseTo(MIN_SPECIAL_COOLDOWN - 0.3)
    // The next tick's kills: still 3.7 s to go, as 0.3 s went by.
    triggerSpecial(s, false, DT)
    s.kills = 20
    rechargeSpecial(s, 0.75)
    expect(s.cooldown).toBeCloseTo(MIN_SPECIAL_COOLDOWN - 0.3 - DT)
    expect(s.total - s.cooldown).toBeCloseTo(0.3 + DT)
  })

  it('wastes kills while the special is ready', () => {
    const s = { ...createSpecialState(), kills: 3 }
    rechargeSpecial(s, 0.5)
    expect([s.cooldown, s.kills]).toEqual([0, 0])
  })
})

describe('Metronome', () => {
  it('fires one move per jump and saves the second for the chain\'s last jump', () => {
    expect(comboCasts(1, true)).toBe(1)
    expect(comboCasts(1, false)).toBe(1)
    expect(comboCasts(2, true)).toBe(1)
    expect(comboCasts(2, false)).toBe(2)
    expect(comboCasts(0, false)).toBe(0)
  })
})
