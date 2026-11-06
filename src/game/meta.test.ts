import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import {
  buyUpgrade,
  coinDrops,
  EMPTY_SAVE,
  NO_RANKS,
  parseSave,
  rankDeltas,
  refundAll,
  runBonus,
  totalSpent,
  UPGRADE_IDS,
  UPGRADES,
  upgradePrice,
  type Save,
} from './meta'
import { applyDeltas, BASE_STATS } from './stats'

const rich = (wallet: number): Save => ({ ...EMPTY_SAVE, wallet })

describe('upgrade prices', () => {
  it('escalate with every rank and stay rounded to ₽10', () => {
    for (const id of UPGRADE_IDS) {
      const prices = Array.from({ length: UPGRADES[id].maxRank }, (_, r) => upgradePrice(id, r))
      expect(prices[0]).toBe(UPGRADES[id].basePrice)
      prices.slice(1).forEach((p, i) => expect(p).toBeGreaterThan(prices[i]!))
      prices.forEach((p) => expect(p % 10).toBe(0))
    }
  })

  it('refunds exactly what was spent', () => {
    let save = rich(10_000)
    for (const id of ['hpUp', 'hpUp', 'protein', 'escapeRope'] as const) save = buyUpgrade(save, id)!
    expect(save.wallet + totalSpent(save.ranks)).toBe(10_000)
    expect(refundAll(save)).toEqual(rich(10_000))
  })

  it('doubles the Shiny Charm with every rank', () => {
    expect([0, 1, 2].map((r) => upgradePrice('shinyCharm', r))).toEqual([6000, 12_000, 24_000])
  })

  it('refuses purchases past max rank or without enough ₽', () => {
    expect(buyUpgrade(rich(upgradePrice('hpUp', 0) - 1), 'hpUp')).toBeNull()
    const maxed = { ...rich(1_000_000), ranks: { ...NO_RANKS, ppUp: UPGRADES.ppUp.maxRank } }
    expect(buyUpgrade(maxed, 'ppUp')).toBeNull()
  })
})

describe('applying ranks', () => {
  it('stacks each stat upgrade per rank on top of the base stats', () => {
    const stats = applyDeltas(BASE_STATS, rankDeltas({ ...NO_RANKS, hpUp: 3, zinc: 2, amuletCoin: 1 }))
    expect(stats.maxHp).toBe(BASE_STATS.maxHp + 30)
    expect(stats.cooldown).toBeCloseTo(0.95)
    expect(stats.greed).toBeCloseTo(1.1)
    expect(stats.might).toBe(BASE_STATS.might)
  })

  it('adds no stat layers for charges or unowned upgrades', () => {
    expect(rankDeltas({ ...NO_RANKS, abilityCapsule: 2, escapeRope: 3 })).toEqual([])
  })
})

describe('save parsing', () => {
  it('falls back to an empty save on missing, corrupt or unknown data', () => {
    expect(parseSave(null)).toEqual(EMPTY_SAVE)
    expect(parseSave('{not json')).toEqual(EMPTY_SAVE)
    expect(parseSave('[1,2]')).toEqual(EMPTY_SAVE)
    expect(parseSave(JSON.stringify({ version: 99, wallet: 500 }))).toEqual(EMPTY_SAVE)
  })

  it('sanitizes wallet and ranks and drops unknown upgrades', () => {
    const raw = JSON.stringify({ version: 1, wallet: -40.5, ranks: { hpUp: 99, protein: 2.7, iron: 'x', masterBall: 3 } })
    const save = parseSave(raw)
    expect(save.wallet).toBe(0)
    expect(save.ranks).toEqual({ ...NO_RANKS, hpUp: UPGRADES.hpUp.maxRank, protein: 2 })
  })

  it('round-trips a valid save', () => {
    const save = buyUpgrade(rich(2000), 'carbos')!
    expect(parseSave(JSON.stringify(save))).toEqual(save)
  })
  it("keeps only a family's own branches", () => {
    const raw = JSON.stringify({ version: 1, branches: { eevee: 'sylveon', ralts: 'vaporeon', pichu: 'gallade', snorunt: 'froslass', scyther: 'mega' } })
    expect(parseSave(raw).branches).toEqual({ eevee: 'sylveon', snorunt: 'froslass' })
  })

  /** `ps:save` as each Phase 2 PR wrote it on its own, before they were merged. */
  const OLD = { version: 1, wallet: 1234, ranks: { hpUp: 2, carbos: 1 } }
  const PR_SAVES = {
    dex: { ...OLD, dex: { 16: [42, 3], 19: [7, 0] } },
    eggs: { ...OLD, eggs: [{ tier: 'rare', steps: 1200 }], hatched: { gible: { shiny: true } } },
    missions: {
      ...OLD,
      missions: { daily: { key: '2026-10-13', progress: { 'kills:500': 120 } }, weekly: { key: '2026-10-12', progress: {} } },
      achievements: { unlocked: ['firstRun', 'champion'], lifetime: { runs: 3, wins: 1, starters: ['charmander'] } },
      title: 'champion',
    },
  }

  it('loads a save from before Phase 2 and one from each of its PRs without losing anything', () => {
    const old = parseSave(JSON.stringify(OLD))
    expect(old).toEqual({ ...EMPTY_SAVE, wallet: 1234, ranks: { ...NO_RANKS, hpUp: 2, carbos: 1 } })
    for (const raw of Object.values(PR_SAVES)) expect(parseSave(JSON.stringify(raw))).toMatchObject({ wallet: 1234, ranks: old.ranks })
    expect(parseSave(JSON.stringify(PR_SAVES.dex)).dex).toEqual(PR_SAVES.dex.dex)
    expect(parseSave(JSON.stringify(PR_SAVES.eggs))).toMatchObject({ eggs: PR_SAVES.eggs.eggs, hatched: PR_SAVES.eggs.hatched })
    const missions = parseSave(JSON.stringify(PR_SAVES.missions))
    expect(missions).toMatchObject({ missions: PR_SAVES.missions.missions, title: 'champion' })
    expect(missions.achievements).toMatchObject({ unlocked: ['firstRun', 'champion'], lifetime: { runs: 3, wins: 1, starters: ['charmander'] } })
    // All of them together, as the merged game writes it.
    const merged = parseSave(JSON.stringify({ ...PR_SAVES.dex, ...PR_SAVES.eggs, ...PR_SAVES.missions }))
    expect(parseSave(JSON.stringify(merged))).toEqual(merged)
    expect(merged).toMatchObject({ dex: PR_SAVES.dex.dex, eggs: PR_SAVES.eggs.eggs, title: 'champion' })
  })
})

describe('earning ₽', () => {
  it('bosses and shinies always pay out, bosses the most', () => {
    const sum = (v: readonly number[]) => v.reduce((a, b) => a + b, 0)
    const rng = createRng(3)
    expect(sum(coinDrops(rng, { boss: true, xp: 60 }))).toBeGreaterThan(sum(coinDrops(rng, { boss: false, xp: 1, shiny: true })))
    expect(sum(coinDrops(rng, { boss: false, xp: 1, shiny: true }))).toBeGreaterThan(0)
  })

  it('a foe standing for many past the endless ceiling drops as often as they would', () => {
    const drops = (weight: number) => {
      const rng = createRng(5)
      let n = 0
      for (let i = 0; i < 4000; i++) n += coinDrops(rng, { boss: false, xp: 2, weight }, true).length
      return n
    }
    expect(drops(4) / drops(1)).toBeCloseTo(4, 0)
  })

  it('regular enemies drop coins only occasionally', () => {
    const rng = createRng(7)
    const drops = Array.from({ length: 2000 }, () => coinDrops(rng, { boss: false, xp: 1 }).length)
    const rate = drops.reduce((a, b) => a + b, 0) / drops.length
    expect(rate).toBeGreaterThan(0.01)
    expect(rate).toBeLessThan(0.08)
  })

  it('regular enemies drop coins half as often in endless mode', () => {
    const count = (endless: boolean) => {
      const rng = createRng(7)
      return Array.from({ length: 100_000 }, () => coinDrops(rng, { boss: false, xp: 4 }, endless).length).reduce((a, b) => a + b, 0)
    }
    const ratio = count(true) / count(false)
    expect(ratio).toBeGreaterThan(0.45)
    expect(ratio).toBeLessThan(0.55)
  })

  it('pays a bigger bonus for longer runs, more kills, victory and greed', () => {
    const base = { time: 300, kills: 400, victory: false, greed: 1 }
    expect(runBonus(base)).toBe(250)
    expect(runBonus({ ...base, time: 600 })).toBeGreaterThan(runBonus(base))
    expect(runBonus({ ...base, victory: true })).toBe(1250)
    expect(runBonus({ ...base, greed: 1.5 })).toBe(375)
  })

  it('pays every endless minute past Mewtwo double, plus a fortune per defeated Arceus', () => {
    const won = { time: 900, kills: 0, victory: true, greed: 1 }
    const fiveMore = runBonus({ ...won, time: 900 + 300 })
    expect(fiveMore - runBonus(won)).toBe(5 * 60)
    expect(runBonus({ ...won, reaperDefeats: 1 }) - runBonus(won)).toBe(2500)
    // Overtime only counts after a victory.
    expect(runBonus({ ...won, time: 1200, victory: false })).toBe(600)
  })
})
