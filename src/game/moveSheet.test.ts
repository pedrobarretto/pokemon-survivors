import { describe, expect, it } from 'vitest'
import { moveSheet, sheetStats } from './moveSheet'
import { BASE_STATS } from './stats'

describe('move sheet', () => {
  it('lists only the stats a move plays with', () => {
    expect(sheetStats('whirlpool')).toEqual(['damage', 'cooldown', 'area', 'status'])
    expect(sheetStats('ember')).toEqual(['damage', 'cooldown', 'amount', 'area', 'pierce', 'status'])
    expect(sheetStats('quickAttack')).toEqual(['damage', 'cooldown', 'area'])
    expect(sheetStats('fireBlast')).toContain('duration')
  })

  it("applies the player's modifiers, as the cast does", () => {
    const player = { ...BASE_STATS, might: 1.5, cooldown: 0.8, typeDamage: { fire: 0.1 } }
    const rows = moveSheet('ember', 3, player)
    expect(rows.find((r) => r.stat === 'damage')?.value).toBeCloseTo((10 + 4) * 1.5 * 1.1)
    expect(rows.find((r) => r.stat === 'cooldown')?.value).toBeCloseTo(0.8)
    expect(rows.find((r) => r.stat === 'amount')?.value).toBe(2)
  })

  it('marks what the last level changed', () => {
    const rows = moveSheet('ember', 3, BASE_STATS, 2)
    expect(rows.find((r) => r.stat === 'damage')).toEqual({ stat: 'damage', value: 14, before: 10 })
    expect(rows.find((r) => r.stat === 'status')?.before).toBeCloseTo(0.3)
    expect(rows.find((r) => r.stat === 'amount')).toEqual({ stat: 'amount', value: 2 })
  })
})
