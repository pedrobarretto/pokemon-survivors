import { describe, expect, it } from 'vitest'
import { HATCHLINGS, type HatchlingId } from './hatchlings'
import { SAFARI_FAMILIES, SAFARI_HABITAT_IDS, SAFARI_ONLY, habitatPool, lackingFamilies } from './safari'

const SEASON_ONE: readonly HatchlingId[] = ['snom', 'joltik', 'applin', 'hatenna', 'salandit', 'darumaka', 'wimpod', 'finizen', 'pawniard', 'frigibax']

describe('who the Safari holds', () => {
  it('has at least four habitats, each with a Safari-only family and a real pool', () => {
    expect(SAFARI_HABITAT_IDS.length).toBeGreaterThanOrEqual(4)
    for (const habitat of SAFARI_HABITAT_IDS) {
      const pool = habitatPool(habitat)
      expect(pool.length).toBeGreaterThan(8)
      expect(pool.filter((e) => e.rarity === 'special')).toHaveLength(1)
    }
  })

  it('brings every Safari-only family and every Season 1 egg family', () => {
    const everywhere = new Set(SAFARI_HABITAT_IDS.flatMap((h) => habitatPool(h).map((e) => e.family)))
    for (const id of [...SAFARI_ONLY, ...SEASON_ONE]) expect(everywhere).toContain(id)
  })

  it('never holds a family promised elsewhere or tied to another source', () => {
    for (const id of SAFARI_FAMILIES) {
      if ((SAFARI_ONLY as readonly string[]).includes(id)) continue
      expect(['common', 'rare', 'ultra']).toContain(HATCHLINGS[id].egg)
    }
    for (const promised of ['munchlax', 'togepi', 'gastly', 'noibat', 'dratini']) expect(SAFARI_FAMILIES).not.toContain(promised)
  })

  it('leaves out what the account has hatched or has waiting as a gift', () => {
    const lacking = lackingFamilies({ snom: { shiny: false } }, ['joltik']).map((e) => e.family)
    expect(lacking).not.toContain('snom')
    expect(lacking).not.toContain('joltik')
    expect(lacking).toContain('applin')
  })
})
