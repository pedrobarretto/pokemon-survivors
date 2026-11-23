import { describe, expect, it } from 'vitest'
import roster from './roster.generated.json'
import { ENEMIES } from './enemies'
import { baseStatTotal, deriveEnemy, RAREST, rarityOf, ROSTER, TIER_FLOORS, TIERS, tierOf, type RosterSpecies } from './roster'
import { STAGES } from './waves'

const species = (stats: Partial<RosterSpecies['stats']>, types: RosterSpecies['types'] = ['normal']): RosterSpecies => ({
  dex: 1,
  name: 'Test',
  types,
  stats: { hp: 50, attack: 50, defense: 50, spAttack: 50, spDefense: 50, speed: 50, ...stats },
  capture: 255,
})

describe('tierOf', () => {
  it('bands species by base stat total', () => {
    expect([195, 269, 270, 329, 330, 399, 400, 469, 470, 600].map(tierOf)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 5])
    expect(TIER_FLOORS).toHaveLength(TIERS.length - 1)
  })
})

describe('rarityOf', () => {
  it('makes rarer species (lower capture rates) less likely, never below RAREST', () => {
    expect(rarityOf(255)).toBe(1)
    expect(rarityOf(45)).toBeCloseTo(0.35, 2)
    expect(rarityOf(3)).toBe(RAREST)
    expect(ROSTER.rattata.rarity).toBeGreaterThan(ROSTER.dratini.rarity ?? 1)
  })
})

describe('deriveEnemy', () => {
  it('keeps the old Kanto openers close to their hand-tuned stats', () => {
    // Before: Rattata 8 HP / 5 dmg / 40 px/s, Pidgey 9 / 5 / 44, Caterpie 10 / 4 / 26, Oddish 22 / 7 / 30.
    const { rattata, pidgey, caterpie, oddish } = ROSTER
    expect([rattata.hp, pidgey.hp, caterpie.hp, oddish.hp]).toEqual([7, 8, 10, 20])
    expect([rattata.damage, pidgey.damage, caterpie.damage, oddish.damage]).toEqual([5, 4, 4, 8])
    expect([rattata.speed, pidgey.speed, caterpie.speed, oddish.speed]).toEqual([41, 43, 35, 32])
  })

  it('gives bulkier species more HP and flyers more speed and less mass', () => {
    const balanced = deriveEnemy(species({}))
    const tank = deriveEnemy(species({ hp: 80, defense: 80, attack: 20, speed: 20 }))
    const bird = deriveEnemy(species({}, ['normal', 'flying']))
    expect(baseStatTotal(species({}).stats)).toBe(baseStatTotal(species({ hp: 80, defense: 80, attack: 20, speed: 20 }).stats))
    expect(tank.hp).toBeGreaterThan(balanced.hp)
    expect(tank.speed).toBeLessThan(balanced.speed)
    expect(bird.speed).toBeGreaterThan(balanced.speed)
    expect(bird.mass).toBeLessThan(balanced.mass)
  })

  it('pays EXP by toughness and never less than 1', () => {
    const weak = deriveEnemy(species({ hp: 20, defense: 20, spDefense: 20 }))
    const strong = deriveEnemy(species({ hp: 100, defense: 100, spDefense: 100 }))
    expect(weak.xp).toBeGreaterThanOrEqual(1)
    expect(strong.xp).toBeGreaterThan(weak.xp)
  })
})

describe('ROSTER', () => {
  it('keeps every generated type and gives every species a tier', () => {
    for (const [id, s] of Object.entries(roster)) {
      const def = ROSTER[id as keyof typeof ROSTER]
      expect(def.types).toHaveLength(s.types.length)
      expect(def.tier).toBeDefined()
    }
  })

  it('has enough species per tier for a run never to repeat a face', () => {
    const slots = TIERS.map((tier) => STAGES.reduce((n, s) => n + s.cast.filter((t) => t === tier).length, 0))
    for (const [i, tier] of TIERS.entries()) {
      const count = Object.values(ENEMIES).filter((e) => 'tier' in e && e.tier === tier).length
      expect(count).toBeGreaterThan(slots[i]!)
    }
  })
})
