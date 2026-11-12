import { describe, expect, it } from 'vitest'
import { HATCHLINGS, type HatchlingId } from './hatchlings'
import { CONTEST_POOL, SAFARI_FAMILIES, SAFARI_HABITAT_IDS, SAFARI_ONLY, habitatPool, habitatResidents, lackingFamilies, poolAt, whenAbout } from './safari'
import { regionFamilies, regionOfWeek } from '../game/travel'

const WEEK = '2026-11-16'

const SEASON_ONE: readonly HatchlingId[] = ['snom', 'joltik', 'applin', 'hatenna', 'salandit', 'darumaka', 'wimpod', 'finizen', 'pawniard', 'frigibax']

describe('who the Safari holds', () => {
  it('has at least four habitats, each with a Safari-only family and a real pool', () => {
    expect(SAFARI_HABITAT_IDS.length).toBeGreaterThanOrEqual(4)
    for (const habitat of SAFARI_HABITAT_IDS) {
      const pool = habitatPool(habitat, WEEK)
      expect(pool.length).toBeGreaterThan(8)
      expect(pool.filter((e) => e.rarity === 'special').length).toBeGreaterThanOrEqual(1)
    }
  })

  it('brings every Safari-only family and every Season 1 egg family', () => {
    const everywhere = new Set(SAFARI_HABITAT_IDS.flatMap((h) => habitatPool(h, WEEK).map((e) => e.family)))
    for (const id of [...SAFARI_ONLY, ...SEASON_ONE]) expect(everywhere).toContain(id)
  })

  it('never holds a family promised elsewhere or tied to another source', () => {
    for (const id of SAFARI_FAMILIES) {
      if ((SAFARI_ONLY as readonly string[]).includes(id)) continue
      expect(['common', 'rare', 'ultra']).toContain(HATCHLINGS[id].egg)
    }
    for (const promised of ['munchlax', 'togepi', 'gastly', 'noibat', 'dratini']) expect(SAFARI_FAMILIES).not.toContain(promised)
  })

  it("brings the week's trip into every habitat, and only that region's families", () => {
    for (const habitat of SAFARI_HABITAT_IDS) {
      const pool = habitatPool(habitat, WEEK).map((e) => e.family)
      for (const id of regionFamilies('alola')) expect(pool).toContain(id)
      for (const id of regionFamilies('galar')) expect(pool).not.toContain(id)
    }
    expect(habitatPool('meadow', '2026-11-23').map((e) => e.family)).toContain('meowthGalar')
  })

  it('leaves out what the account has hatched or has waiting as a gift', () => {
    const lacking = lackingFamilies({ snom: { shiny: false } }, ['joltik']).map((e) => e.family)
    expect(lacking).not.toContain('snom')
    expect(lacking).not.toContain('joltik')
    expect(lacking).toContain('applin')
  })
})

describe('day and night', () => {
  it('gives every habitat night owls and early birds, and dawn and dusk both', () => {
    for (const habitat of SAFARI_HABITAT_IDS) {
      const day = new Set(poolAt(habitat, 'day', WEEK).map((e) => e.family))
      const night = new Set(poolAt(habitat, 'night', WEEK).map((e) => e.family))
      expect([...night].some((f) => !day.has(f))).toBe(true)
      for (const f of day) expect(whenAbout(f)).not.toBe('night')
      for (const f of night) expect(whenAbout(f)).not.toBe('day')
      const dusk = new Set(poolAt(habitat, 'dusk', WEEK).map((e) => e.family))
      for (const f of [...day, ...night]) expect(dusk).toContain(f)
      expect(poolAt(habitat, 'night', WEEK).filter((e) => e.rarity === 'special').length).toBeGreaterThanOrEqual(1)
    }
  })

  it("lists in each Pokédex everyone met there at any hour, but the week's trip's visitors", () => {
    const trip = new Set(regionFamilies(regionOfWeek(WEEK)))
    for (const habitat of SAFARI_HABITAT_IDS) {
      const dex = new Set(habitatResidents(habitat).map((e) => e.family))
      for (const part of ['dawn', 'day', 'dusk', 'night'] as const) for (const e of poolAt(habitat, part, WEEK)) if (!trip.has(e.family)) expect(dex).toContain(e.family)
      for (const f of trip) expect(dex.has(f)).toBe(false)
      expect(dex.size).toBe(habitatResidents(habitat).length)
    }
  })

  it('fills the contest with Bug types only', () => {
    expect(CONTEST_POOL.length).toBeGreaterThanOrEqual(5)
    for (const e of CONTEST_POOL) expect(e.types).toContain('bug')
  })
})
