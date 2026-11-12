import { describe, expect, it } from 'vitest'
import { HATCHLINGS, type HatchlingId } from './hatchlings'
import { CONTEST_POOL, HABITAT_REWARDS, SAFARI_FAMILIES, SAFARI_GATED, SAFARI_HABITAT_IDS, SAFARI_HABITATS, SAFARI_ONLY, habitatDone, habitatDexDone, habitatOnly, habitatPool, habitatResidents, lackingFamilies, markLacking, openGated, poolAt, whenAbout } from './safari'
import { regionFamilies, regionOfWeek } from '../game/travel'

const WEEK = '2026-11-16'

const SEASON_ONE: readonly HatchlingId[] = ['snom', 'joltik', 'applin', 'hatenna', 'salandit', 'darumaka', 'wimpod', 'finizen', 'pawniard', 'frigibax']

describe('who the Safari holds', () => {
  it('has at least four habitats, each with its Safari-only families and a real pool', () => {
    expect(SAFARI_HABITAT_IDS.length).toBeGreaterThanOrEqual(4)
    for (const habitat of SAFARI_HABITAT_IDS) {
      const pool = habitatPool(habitat, WEEK)
      expect(pool.length).toBeGreaterThan(8)
      expect(pool.filter((e) => e.rarity === 'special').map((e) => e.family)).toEqual(habitatOnly(habitat))
    }
  })

  it('brings every Safari-only family (the gated ones once opened) and every Season 1 egg family', () => {
    const open = openGated(() => true)
    const everywhere = new Set(SAFARI_HABITAT_IDS.flatMap((h) => habitatPool(h, WEEK, open).map((e) => e.family)))
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

describe('the Safari-only families behind a legend', () => {
  it('keeps Phione out of the cove, its Pokédex and the guarantee until Manaphy is owned', () => {
    expect(SAFARI_GATED.phione).toBe('manaphy')
    const shut = openGated(() => false)
    const open = openGated((legend) => legend === 'manaphy')
    expect(habitatPool('cove', WEEK, shut).map((e) => e.family)).not.toContain('phione')
    expect(habitatPool('cove', WEEK, open).map((e) => e.family)).toContain('phione')
    expect(habitatResidents('cove').map((e) => e.family)).not.toContain('phione')
    expect(lackingFamilies({}, [], shut).map((e) => e.family)).not.toContain('phione')
    expect(lackingFamilies({}, [], open).map((e) => e.family)).toContain('phione')
  })
})

describe('completing a habitat', () => {
  it('stays completed once its gifts went out, however many residents joined since', () => {
    const all = habitatResidents('meadow').map((e) => e.family)
    expect(habitatDone('meadow', all.slice(1), [])).toBe(false)
    expect(habitatDone('meadow', all.slice(1), ['meadow'])).toBe(true)
    expect(habitatDexDone('meadow', all)).toBe(true)
  })

  it('rewards every habitat with its title and a shiny of its first exclusive, and the cove with the Manaphy Egg', () => {
    for (const habitat of SAFARI_HABITAT_IDS) {
      const kinds = HABITAT_REWARDS[habitat].map((c) => c.kind)
      expect(kinds).toContain('title')
      expect(HABITAT_REWARDS[habitat]).toContainEqual({ kind: 'shinyHatch', family: SAFARI_HABITATS[habitat].only[0] })
    }
    expect(HABITAT_REWARDS.cove).toContainEqual({ kind: 'legend', legend: 'manaphy' })
  })

  it('marks only the Safari-only families the account lacks', () => {
    const marked = markLacking(habitatPool('cove', WEEK), (id) => id === 'lapras' || id === 'snom')
    expect(marked.find((e) => e.family === 'lapras')?.lacking).toBe(true)
    expect(marked.filter((e) => e.lacking).map((e) => e.family)).toEqual(['lapras'])
  })
})
