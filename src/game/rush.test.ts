import { describe, expect, it } from 'vitest'
import { BOSS_PATTERNS, BOSS_PHASES } from '../data/bosses'
import { RUSH, RUSH_ORDER } from '../data/rush'
import { DIFFICULTY_IDS } from './difficulty'
import { rushHp, rushLineup } from './rush'

describe('Hoopa’s Rings', () => {
  it('open a level only with as many captured legends as its rings, and always bring that many, in the rings’ order, then Hoopa', () => {
    const four = ['kyogre', 'articuno', 'palkia', 'mew'] as const
    expect(rushLineup(four.slice(0, 3), 'normal', 1)).toBeNull()
    // Cresselia is never fought, and Hoopa only ever comes last: neither counts.
    expect(rushLineup([...four.slice(0, 3), 'cresselia', 'hoopa'], 'normal', 1)).toBeNull()
    expect(rushLineup(four, 'normal', 1)).toEqual(['articuno', 'mew', 'kyogre', 'palkia', 'hoopa'])
    expect(rushLineup(four, 'hard', 1)).toBeNull()
    const all = ['articuno', 'zapdos', 'moltres', 'raikou', 'kyogre', 'lugia', 'dialga', 'palkia', 'mewtwo', 'arceus', 'uxie', 'cobalion'] as const
    for (const difficulty of DIFFICULTY_IDS) {
      expect(rushLineup(all.slice(0, RUSH.rings[difficulty] - 1), difficulty, 7)).toBeNull()
      const lineup = rushLineup(all, difficulty, 7)!
      expect(lineup).toHaveLength(RUSH.rings[difficulty] + 1)
      expect(lineup.at(-1)).toBe('hoopa')
      // The seed draws who comes from more captures, the same every time.
      expect(rushLineup(all, difficulty, 7)).toEqual(lineup)
    }
  })

  it('bring every captured legend that fights somewhere, and none a fight never brings', () => {
    const fought = ['kartana', 'guzzlord', 'regigigas', 'terapagos', 'keldeo', 'mew', 'celebi', 'zeraora', 'jirachi', 'azelf'] as const
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
