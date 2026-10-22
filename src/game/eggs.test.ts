import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { HATCHLING_IDS, HATCHLINGS, PLAYABLE } from '../data/hatchlings'
import type { EvolutionStage } from '../data/starters'
import { POKE_TYPES } from '../data/types'
import { MYTHICALS } from '../data/waves'
import manifest from '../data/sprites.generated.json'
import { regionOf } from '../site/pokedex'
import {
  bossEggSource,
  depositEggs,
  EGG_SOURCES,
  EGG_TIERS,
  EGGS,
  grantEgg,
  hatchEgg,
  hatchOdds,
  hatchPool,
  isUnlocked,
  parseEggs,
  parseHatched,
  rollEgg,
  type Egg,
} from './eggs'
import { dexStatus } from './dex'
import { starterStats } from './leveling'
import { EMPTY_SAVE, parseSave, type Save } from './meta'

const ready = (tier: Egg['tier']): Egg => ({ tier, steps: EGG_TIERS[tier].steps })
const withEggs = (eggs: Egg[], extra: Partial<Save> = {}): Save => ({ ...EMPTY_SAVE, eggs, ...extra })

describe('egg drops', () => {
  it('stop at the per-run cap, even for a sure source', () => {
    const rng = createRng(1)
    const found = Array.from({ length: EGGS.perRun }, () => ({ tier: 'common' as const, at: 0 }))
    expect(rollEgg(rng, 'final', { found, lucky: true, boost: 1 })).toBeNull()
    expect(rollEgg(rng, 'final', { found: [], lucky: false, boost: 1 })).not.toBeNull()
  })

  it('never miss for a player who never had an egg', () => {
    for (let seed = 0; seed < 50; seed++) expect(rollEgg(createRng(seed), 'chest', { found: [], lucky: true, boost: 1 })).not.toBeNull()
  })

  it('drop about twice as often with an Incense', () => {
    const drops = (boost: number) => {
      const rng = createRng(11)
      return Array.from({ length: 4000 }, () => rollEgg(rng, 'chest', { found: [], lucky: false, boost })).filter((e) => e !== null).length
    }
    expect(drops(2) / drops(1)).toBeGreaterThan(1.8)
    expect(drops(2) / drops(1)).toBeLessThan(2.2)
  })

  it('only give the tiers a source lists', () => {
    const rng = createRng(7)
    for (let i = 0; i < 200; i++) expect(['rare', 'ultra']).toContain(rollEgg(rng, 'rift', { found: [], lucky: true, boost: 1 }))
  })

  it('give rift legendaries, Arceus, Mewtwo and the mythicals their own rule', () => {
    expect(bossEggSource('onix')).toBe('boss')
    expect(bossEggSource('raikou')).toBe('boss')
    expect(bossEggSource('kyogre')).toBe('rift')
    expect(bossEggSource('deoxys')).toBe('rift')
    expect(bossEggSource('arceus')).toBe('reaper')
    expect(bossEggSource('mewtwo')).toBe('final')
    for (const id of MYTHICALS) expect(bossEggSource(id)).toBe('final')
  })
})

describe('incubator', () => {
  it('walks every incubating egg, capped at its hatch distance', () => {
    const { save } = depositEggs(withEggs([{ tier: 'common', steps: 1900 }, { tier: 'ultra', steps: 0 }]), 500, [])
    expect(save.eggs).toEqual([{ tier: 'common', steps: 2000 }, { tier: 'ultra', steps: 500 }])
  })

  it('fills free slots with new eggs and pays out the rest in ₽', () => {
    const { save, converted, refund } = depositEggs(withEggs([ready('common'), ready('common')], { wallet: 10 }), 0, [
      { tier: 'rare', steps: 120 },
      { tier: 'ultra', steps: 0 },
    ])
    expect(save.eggs).toEqual([ready('common'), ready('common'), { tier: 'rare', steps: 120 }])
    expect(converted).toEqual(['ultra'])
    expect(save.wallet).toBe(10 + EGG_TIERS.ultra.refund)
    expect(refund).toBe(EGG_TIERS.ultra.refund)
  })

  it('grants mission eggs with no steps', () => {
    expect(grantEgg(EMPTY_SAVE, 'rare').save.eggs).toEqual([{ tier: 'rare', steps: 0 }])
  })
})

describe('hatching', () => {
  it('only hatches ready eggs', () => {
    expect(hatchEgg(withEggs([{ tier: 'common', steps: 10 }]), 0, createRng(1))).toBeNull()
    expect(hatchEgg(withEggs([]), 0, createRng(1))).toBeNull()
  })

  it('unlocks a family of the egg tier and frees the slot', () => {
    const result = hatchEgg(withEggs([ready('rare'), ready('common')]), 0, createRng(3))!
    expect(HATCHLINGS[result.hatch.id].egg).toBe('rare')
    expect(result.save.eggs).toEqual([ready('common')])
    expect(isUnlocked(result.save.hatched, result.hatch.id)).toBe(true)
  })

  it('catches what came out in the Pokédex, shiny if it is, and sees its whole line', () => {
    for (let seed = 0; seed < 300; seed++) {
      const { save, hatch } = hatchEgg(withEggs([ready('common')]), 0, createRng(seed))!
      const [first, ...rest] = HATCHLINGS[hatch.id].line
      expect(dexStatus(save.dex, first!.dex)).toMatchObject({ caught: true, shiny: hatch.shiny })
      for (const stage of rest) expect(dexStatus(save.dex, stage.dex)).toMatchObject({ seen: true, caught: false })
    }
  })

  it('pays duplicates in ₽, but a shiny upgrades a family owned in normal colors', () => {
    const ultra = HATCHLING_IDS.filter((id) => HATCHLINGS[id].egg === 'ultra')
    const owned = Object.fromEntries(ultra.map((id) => [id, { shiny: false }]))
    for (let seed = 0; seed < 300; seed++) {
      const { save, hatch } = hatchEgg(withEggs([ready('ultra')], { hatched: owned }), 0, createRng(seed))!
      expect(hatch.duplicate).toBe(!hatch.shiny)
      expect(save.wallet).toBe(hatch.duplicate ? EGG_TIERS.ultra.refund : 0)
      if (hatch.shiny) expect(save.hatched[hatch.id]).toEqual({ shiny: true })
    }
  })

  it('favors families not hatched yet', () => {
    const pool = hatchPool('common', { pichu: { shiny: false } })
    expect(pool.find(([id]) => id === 'pichu')?.[1]).toBe(1)
    expect(pool.find(([id]) => id === 'eevee')?.[1]).toBe(EGGS.newWeight)
  })

  it('hatches the Haunted Egg’s four ghosts at even odds, owned or not, and only from it', () => {
    const haunted = HATCHLING_IDS.filter((id) => HATCHLINGS[id].egg === 'haunted')
    expect(haunted).toEqual(['litwick', 'phantump', 'drifloon', 'sandygast'])
    for (const hatched of [{}, { litwick: { shiny: false } }]) expect(hatchOdds('haunted', hatched).map(([, share]) => share)).toEqual([0.25, 0.25, 0.25, 0.25])
    // The same seed draws the same ghost (and shininess).
    const draw = (seed: number) => hatchEgg(withEggs([ready('haunted')]), 0, createRng(seed))!.hatch
    for (let seed = 0; seed < 50; seed++) expect(draw(seed)).toEqual(draw(seed))
    const out = new Set(Array.from({ length: 200 }, (_, seed) => draw(seed).id))
    expect(out).toEqual(new Set(haunted))
    // No egg dropped in runs is haunted.
    for (const rule of Object.values(EGG_SOURCES)) expect(Object.keys(rule.odds)).not.toContain('haunted')
  })

  it('hatches the Kecleon Egg’s four at even odds, only from it (and its shiny twin, always shiny)', () => {
    const kecleon = HATCHLING_IDS.filter((id) => HATCHLINGS[id].egg === 'kecleon')
    expect(kecleon).toEqual(['porygon', 'exeggcute', 'scraggy', 'smeargle'])
    for (const hatched of [{}, { porygon: { shiny: false } }]) expect(hatchOdds('kecleon', hatched).map(([, share]) => share)).toEqual([0.25, 0.25, 0.25, 0.25])
    expect(hatchOdds('kecleonShiny', {})).toEqual(hatchOdds('kecleon', {}))
    const draw = (tier: 'kecleon' | 'kecleonShiny', seed: number) => hatchEgg(withEggs([ready(tier)]), 0, createRng(seed))!.hatch
    for (let seed = 0; seed < 50; seed++) expect(draw('kecleon', seed)).toEqual(draw('kecleon', seed))
    expect(new Set(Array.from({ length: 200 }, (_, seed) => draw('kecleon', seed).id))).toEqual(new Set(kecleon))
    expect(Array.from({ length: 50 }, (_, seed) => draw('kecleonShiny', seed).shiny).every(Boolean)).toBe(true)
    // No egg dropped in runs is a Kecleon Egg.
    for (const rule of Object.values(EGG_SOURCES)) expect(Object.keys(rule.odds).filter((tier) => tier.startsWith('kecleon'))).toEqual([])
  })

  it('keeps starters always playable and egg families locked until hatched', () => {
    expect(isUnlocked({}, 'charmander')).toBe(true)
    expect(isUnlocked({}, 'gible')).toBe(false)
    expect(isUnlocked({ gible: { shiny: false } }, 'gible')).toBe(true)
  })
})

describe('save fields', () => {
  it('fall back to empty, field by field', () => {
    const save = parseSave(JSON.stringify({ version: 1, wallet: 50, eggs: 'nope', hatched: [1] }))
    expect(save.wallet).toBe(50)
    expect(save.eggs).toEqual([])
    expect(save.hatched).toEqual({})
  })

  it('drop unknown tiers and families, clamp steps and cut the incubator to its slots', () => {
    const eggs = parseEggs([{ tier: 'common', steps: 99999 }, { tier: 'golden' }, { tier: 'rare', steps: -4 }, { tier: 'rare' }, { tier: 'ultra' }], EGGS.slots)
    expect(eggs).toEqual([{ tier: 'common', steps: 2000 }, { tier: 'rare', steps: 0 }, { tier: 'rare', steps: 0 }])
    expect(parseHatched({ eevee: { shiny: true }, missingno: {}, pichu: 3 })).toEqual({ eevee: { shiny: true } })
  })
})

describe('egg families', () => {
  it('cover every type and every generation', () => {
    const types = new Set(HATCHLING_IDS.flatMap((id) => PLAYABLE[id].line.flatMap((s) => s.types)))
    expect([...types].toSorted()).toEqual([...POKE_TYPES].toSorted())
    const gens = new Set(HATCHLING_IDS.flatMap((id) => PLAYABLE[id].line.map((s) => regionOf(s.dex).gen)))
    expect(gens.size).toBe(9)
  })

  it('evolve mid-run and grow stronger (Smeargle aside: one stage, it paints moves instead)', () => {
    expect(HATCHLING_IDS.filter((id) => PLAYABLE[id].line.length === 1)).toEqual(['smeargle'])
    for (const id of HATCHLING_IDS) {
      const line: readonly EvolutionStage[] = PLAYABLE[id].line
      if (line.length === 1) continue
      expect(line[0]!.evolveAt).toBeLessThanOrEqual(20)
      expect(starterStats(id, line.length - 1).maxHp).toBeGreaterThan(starterStats(id, 0).maxHp)
    }
  })

  it('have walk/idle/hurt sheets and a shiny form for every stage', () => {
    const sheets: Record<string, { anims: Record<string, unknown>; shiny?: unknown }> = manifest
    for (const id of HATCHLING_IDS)
      for (const stage of PLAYABLE[id].line) {
        expect(Object.keys(sheets[stage.dex]?.anims ?? {})).toEqual(expect.arrayContaining(['Hurt', 'Idle', 'Walk']))
        expect(sheets[stage.dex]?.shiny).toBeDefined()
      }
  })
})
