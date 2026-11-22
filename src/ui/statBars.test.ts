import { describe, expect, it } from 'vitest'
import { starterStats } from '../game/leveling'
import { BASE_STATS } from '../game/stats'
import { otherBonuses } from './statBars'

describe('otherBonuses', () => {
  it('reports what a final stage raises outside the bars', () => {
    // Hydreigon's three heads: one more projectile than a plain Pokémon.
    expect(otherBonuses(starterStats('deino', 2), BASE_STATS)).toContainEqual({ key: 'amount', value: 1 })
    expect(otherBonuses(starterStats('kubfu', 0), BASE_STATS)).toContainEqual({ key: 'specialRecharge', value: 1 })
  })

  it('reports nothing for a line that raises none of them', () => {
    expect(otherBonuses(starterStats('charmander', 2), BASE_STATS)).toEqual([])
  })
})
