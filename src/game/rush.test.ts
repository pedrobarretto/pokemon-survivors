import { describe, expect, it } from 'vitest'
import { RUSH } from '../data/rush'
import { rushHp, rushLineup } from './rush'

describe('Hoopa’s Rings', () => {
  it('open with enough captured legends, bring them in the rings’ order and end on Hoopa', () => {
    expect(rushLineup(['kyogre', 'articuno'], 'normal', 1)).toBeNull()
    // Cresselia is never fought, and Hoopa only ever comes last.
    expect(rushLineup(['kyogre', 'articuno', 'cresselia', 'hoopa'], 'normal', 1)).toBeNull()
    expect(rushLineup(['kyogre', 'articuno', 'palkia'], 'normal', 1)).toEqual(['articuno', 'kyogre', 'palkia', 'hoopa'])
    const all = ['articuno', 'zapdos', 'moltres', 'raikou', 'kyogre', 'lugia', 'dialga', 'palkia', 'mewtwo', 'arceus', 'uxie', 'cobalion'] as const
    const hard = rushLineup(all, 'hard', 7)!
    expect(hard).toHaveLength(RUSH.rings.hard + 1)
    expect(hard.at(-1)).toBe('hoopa')
    expect(rushLineup(all, 'hard', 7)).toEqual(hard)
  })

  it('give every ring’s legend the same HP whatever its species, growing ring by ring, Hoopa the most', () => {
    expect(rushHp('normal', 1, false)).toBeGreaterThan(rushHp('normal', 0, false))
    expect(rushHp('hard', 0, false)).toBeGreaterThan(rushHp('normal', 0, false))
    expect(rushHp('normal', 4, true)).toBeGreaterThan(rushHp('normal', 4, false))
  })
})
