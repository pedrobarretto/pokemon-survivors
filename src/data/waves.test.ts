import { describe, expect, it } from 'vitest'
import { bossKit, type BossStance } from './bosses'
import { ENEMIES, type EnemyDef, type EnemyId } from './enemies'
import { RIFT_LEGENDS } from './rifts'
import { bossWaveAt, fleesFrom, LATE_PRESSURE, latePressure, MYTHICALS, scaling, TRIO_IDS, TRIOS } from './waves'

const at = (enemy: Parameters<typeof bossWaveAt>[0]) => bossWaveAt(enemy)!

describe('wave bosses have until the next boss', () => {
  it('an earlier wave boss flees when a later one arrives', () => {
    expect(fleesFrom('onix', at('snorlax'))).toBe(true)
    expect(fleesFrom('articuno', at('moltres'))).toBe(true)
    expect(fleesFrom('raikou', at('suicune'))).toBe(true)
    expect(fleesFrom('registeel', at('mewtwo'))).toBe(true)
    expect(fleesFrom('moltres', at('mewtwo'))).toBe(true)
  })

  it('bosses of the same wave stay together, and nobody flees from an earlier wave', () => {
    for (const id of MYTHICALS) expect(at(id)).toBe(at('mewtwo'))
    expect(fleesFrom('mew', at('mewtwo'))).toBe(false)
    expect(fleesFrom('mewtwo', at('mew'))).toBe(false)
    expect(fleesFrom('snorlax', at('onix'))).toBe(false)
  })

  it('bosses off the schedule (rift legends, Arceus) never flee', () => {
    for (const enemy of [...RIFT_LEGENDS, 'arceus'] as const) {
      expect(bossWaveAt(enemy)).toBeNull()
      expect(fleesFrom(enemy, at('mewtwo'))).toBe(false)
    }
  })
})

describe('legendary trios', () => {
  const stats = (id: EnemyId) => {
    const { hp, damage, speed, xp }: EnemyDef = ENEMIES[id]
    return { hp, damage, speed, xp }
  }
  const stances = (id: EnemyId) => new Set(bossKit(id).flatMap((p): BossStance[] => (p.stance ? [p.stance] : [])))

  it('every trio takes the same slots, and a slot has the same stats whichever trio comes', () => {
    for (const slot of [0, 1, 2] as const) {
      const [first, ...rest] = TRIO_IDS.map((t) => TRIOS[t][slot])
      for (const id of rest) expect(stats(id)).toEqual(stats(first!))
      for (const id of rest) expect(at(id)).toBe(at(first!))
    }
  })

  it('the mythicals share their stats', () => {
    for (const id of MYTHICALS) expect(stats(id)).toEqual(stats('mew'))
  })

  it('every trio member and mythical fights in both stances', () => {
    for (const id of [...TRIO_IDS.flatMap((t) => TRIOS[t]), ...MYTHICALS]) expect(stances(id)).toEqual(new Set(['close', 'ranged']))
  })
})

describe('late pressure', () => {
  it('leaves every regular minute alone and compounds past the threshold', () => {
    expect(latePressure(0)).toBe(1)
    expect(latePressure(LATE_PRESSURE.from)).toBe(1)
    expect(latePressure(LATE_PRESSURE.from + 10)).toBeCloseTo(LATE_PRESSURE.growth ** 10, 6)
    expect(latePressure(1e6)).toBe(LATE_PRESSURE.max)
  })

  it('reaches the damage the longest run survived about an hour in', () => {
    const longest = scaling(479 * 60).damage / latePressure(479)
    expect(scaling(45 * 60).damage).toBeLessThan(longest)
    expect(scaling(65 * 60).damage).toBeGreaterThan(longest)
  })
})
