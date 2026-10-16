import { describe, expect, it } from 'vitest'
import { statSheet, upgradeCards } from './statSheet'
import { applyDeltas, BASE_STATS } from './stats'

describe('upgradeCards', () => {
  it('counts one card per item level, for every stat the item touches', () => {
    const { stats, types } = upgradeCards([
      { id: 'muscleBand', level: 3 },
      { id: 'assaultVest', level: 2 },
      { id: 'charcoal', level: 1 },
    ])
    expect(stats).toEqual({ might: 3, maxHp: 2, armor: 2 })
    expect(types).toEqual({ fire: 1 })
  })
})

describe('statSheet', () => {
  it('lists only the core stats on a fresh run', () => {
    const rows = statSheet(BASE_STATS, [])
    expect(rows.map((r) => r.stat)).not.toContain('greed')
    expect(rows.every((r) => r.cards === 0)).toBe(true)
  })

  it('adds stats and type bonuses that something moved, with their cards', () => {
    const stats = applyDeltas(BASE_STATS, [{ greed: 0.2 }, { statusChance: 0.06, typeDamage: { water: 0.1 } }])
    const rows = statSheet(stats, [{ id: 'kingsRock', level: 1 }, { id: 'mysticWater', level: 1 }])
    expect(rows).toContainEqual({ stat: 'greed', value: 1.2, cards: 0 })
    expect(rows).toContainEqual({ stat: 'statusChance', value: 0.06, cards: 1 })
    expect(rows).toContainEqual({ stat: 'typeDamage', type: 'water', value: 0.1, cards: 1 })
  })
})
