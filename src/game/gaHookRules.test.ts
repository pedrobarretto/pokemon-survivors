import { describe, expect, it } from 'vitest'
import { GA_FAMILY_HOOK_IDS } from '../data/gaFamiliesHook'
import { patternFor } from '../vivillonRegion'
import { updatePlusMinus } from './coop'
import { createCoopGame, type CoopLoadout } from './game'
import { coreOpen, createKitH, fighterBranch, fighterScore, KIT_H, linkDeltas, plusCharged, powderOf, SCALE_SLOW, segmentDist2, VIVILLON_POWDERS } from './gaHookRules'
import { NO_RANKS } from './meta'

describe('the hook families', () => {
  it('each have a kit of their own', () => {
    const kinds = GA_FAMILY_HOOK_IDS.map((id) => createKitH(id)?.kind)
    expect(kinds.every((k) => k !== undefined)).toBe(true)
    expect(new Set(kinds).size).toBe(GA_FAMILY_HOOK_IDS.length)
  })

  it('Shields Down: breaks below half HP, holds in the gap, closes once healed past it', () => {
    expect(coreOpen(false, 51, 100)).toBe(false)
    expect(coreOpen(false, 49, 100)).toBe(true)
    // In the gap the shell stays as it was, so a hit and a heal around half don't flicker it.
    expect(coreOpen(true, 55, 100)).toBe(true)
    expect(coreOpen(false, 55, 100)).toBe(false)
    expect(coreOpen(true, 100 * KIT_H.shields.closeAt, 100)).toBe(false)
  })

  it("Tyrogue evolves by the build: Attack over Defense, Hitmonlee; Defense over, Hitmonchan; even, Hitmontop", () => {
    const base = { might: 1, armor: 0 }
    // Two Muscle Band levels against one Assault Vest level.
    expect(fighterScore(base, { might: 1.2, armor: 1 })).toEqual({ attack: 20, defense: 10 })
    expect(fighterBranch(fighterScore(base, { might: 1.2, armor: 1 }))).toBe('hitmonlee')
    expect(fighterBranch(fighterScore(base, { might: 1.1, armor: 3 }))).toBe('hitmonchan')
    expect(fighterBranch(fighterScore(base, { might: 1.1, armor: 1 }))).toBe('hitmontop')
    expect(fighterBranch(fighterScore(base, base))).toBe('hitmontop')
  })

  it("Scatterbug's and Spewpa's scales slow; Vivillon's cycle its three powders", () => {
    expect(powderOf(0, 5)).toBe(SCALE_SLOW)
    expect(powderOf(1, 5)).toBe(SCALE_SLOW)
    expect([0, 1, 2, 3].map((n) => powderOf(2, n))).toEqual([...VIVILLON_POWDERS, VIVILLON_POWDERS[0]])
  })

  it('Plus bursts on the KO that fills it, and starts over', () => {
    let charge = 0
    let bursts = 0
    for (let i = 0; i < KIT_H.plus.need * 2; i++) {
      const next = plusCharged(charge)
      charge = next.charge
      if (next.burst) bursts++
    }
    expect([bursts, charge]).toEqual([2, 0])
  })

  it("the link's current hits along the line between them, not past its ends", () => {
    expect(segmentDist2(50, 3, 0, 0, 100, 0)).toBe(9)
    expect(segmentDist2(-10, 0, 0, 0, 100, 0)).toBe(100)
    expect(linkDeltas(true, 'plusle')).toEqual([KIT_H.link.bonus])
    expect(linkDeltas(true, 'charmander')).toEqual([])
    expect(linkDeltas(false, 'minun')).toEqual([])
  })
})

describe('Plus and Minus in co-op', () => {
  const loadout = (starter: CoopLoadout['starter'], name: string): CoopLoadout => ({ starter, ranks: NO_RANKS, shiny: false, name })

  it('link a Plusle and a Minun on one team, lifting both and nobody else', () => {
    const g = createCoopGame(7, [loadout('plusle', 'A'), loadout('minun', 'B'), loadout('charmander', 'C')], { draft: false })
    const before = g.players.map((p) => p.stats.might)
    updatePlusMinus(g, 0.1)
    expect(g.coop?.plusMinus.on).toBe(true)
    const lift = g.players.map((p, i) => p.stats.might - before[i]!)
    expect(lift[0]).toBeCloseTo(KIT_H.link.bonus.might)
    expect(lift[1]).toBeCloseTo(KIT_H.link.bonus.might)
    expect(lift[2]).toBe(0)
  })

  it('stay unlinked without the pair', () => {
    const g = createCoopGame(7, [loadout('plusle', 'A'), loadout('plusle', 'B')], { draft: false })
    updatePlusMinus(g, 0.1)
    expect(g.coop?.plusMinus.on).toBe(false)
  })
})

describe("Vivillon's pattern by the device's region", () => {
  it('reads the time zone first, then the locale, then the continent, else Meadow', () => {
    expect(patternFor('America/Sao_Paulo', 'en-US')).toBe('savanna')
    expect(patternFor('Asia/Tokyo', null)).toBe('elegant')
    expect(patternFor('Etc/UTC', 'pt-BR')).toBe('savanna')
    expect(patternFor('Europe/Ljubljana', 'sl')).toBe('continental')
    expect(patternFor(null, null)).toBe('meadow')
  })
})
