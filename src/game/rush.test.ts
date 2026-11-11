import { describe, expect, it } from 'vitest'
import { BOSS_PATTERNS, BOSS_PHASES } from '../data/bosses'
import { RUSH, RUSH_ORDER } from '../data/rush'
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

  it('bring every captured legend that fights somewhere, and none a fight never brings', () => {
    const fought = ['kartana', 'guzzlord', 'regigigas', 'terapagos', 'keldeo'] as const
    expect(rushLineup([...fought, 'zygarde', 'solgaleo', 'lunala', 'kubfu', 'meltan', 'poipole', 'cresselia'], 'nightmare', 3)).toEqual([...fought.toSorted((a, b) => RUSH_ORDER.indexOf(a) - RUSH_ORDER.indexOf(b)), 'hoopa'])
    // Each fights in the rings with its own phases or patterns.
    for (const id of RUSH_ORDER) expect(BOSS_PHASES[id] ?? BOSS_PATTERNS[id], id).toBeTruthy()
  })

  it('give every ring’s legend the same HP whatever its species, growing ring by ring, Hoopa the most', () => {
    expect(rushHp('normal', 1, false)).toBeGreaterThan(rushHp('normal', 0, false))
    expect(rushHp('hard', 0, false)).toBeGreaterThan(rushHp('normal', 0, false))
    expect(rushHp('normal', 4, true)).toBeGreaterThan(rushHp('normal', 4, false))
  })
})
