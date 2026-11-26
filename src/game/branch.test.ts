import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { BRANCH_IDS, BRANCHES, branchesAt, branchesOf } from '../data/branches'
import manifest from '../data/sprites.generated.json'
import { canBranch, evolutionOffers, formAt } from './branch'
import { runLearnset } from './learnsets'
import { advancePhase, chooseOffer } from './game'
import { NO_RANKS } from './meta'
import { resimulate, startGame, type Replay, type ReplayStart } from './replay'
import { resolveSpecial } from './special'

const EEVEE = branchesAt('eevee', 1)

describe('branch data', () => {
  it('has sprites for every branch, and Eevee all eight', () => {
    const sheets: Record<string, unknown> = manifest
    for (const id of BRANCH_IDS) expect(sheets[String(BRANCHES[id].dex)], id).toBeDefined()
    expect(EEVEE).toHaveLength(8)
  })

  it('swaps the form, the special and the learnset from the branch on', () => {
    expect(formAt('eevee', 'vaporeon', 0).name).toBe('Eevee')
    expect(formAt('eevee', 'vaporeon', 1).name).toBe('Vaporeon')
    expect(formAt('ralts', 'gallade', 1).name).toBe('Kirlia')
    expect(formAt('ralts', 'gallade', 2).name).toBe('Gallade')
    expect(resolveSpecial('eevee', 1, null, 'vaporeon').id).toBe('hydroCannon')
    expect(resolveSpecial('ralts', 2, null, 'gallade').id).toBe('closeCombat')
    expect(runLearnset('eevee', 'flareon')).toContain('willOWisp')
    expect(runLearnset('eevee', null)).not.toContain('willOWisp')
  })
})

describe('evolutionOffers', () => {
  const ctx = { weather: 'clear', biome: 'meadow' } as const
  const ids = (offers: readonly { id: string }[]) => offers.map((o) => o.id)

  it("without items, draws one of Eevee's three free branches, the same for the same seed, the weather pulling one in", () => {
    const seen = new Set<string>()
    for (let seed = 1; seed < 60; seed++) {
      const offers = evolutionOffers(createRng(seed), EEVEE, ctx, [])
      expect(offers).toHaveLength(1)
      expect(evolutionOffers(createRng(seed), EEVEE, ctx, [])).toEqual(offers)
      seen.add(offers[0]!.id)
    }
    expect([...seen].sort()).toEqual(['flareon', 'jolteon', 'vaporeon'])
    const rainy = Array.from({ length: 300 }, (_, i) => evolutionOffers(createRng(i + 1), EEVEE, { weather: 'rain', biome: 'meadow' }, [])[0]!)
    const vaporeon = rainy.filter((o) => o.id === 'vaporeon')
    expect(vaporeon.length).toBeGreaterThan(rainy.length / 2)
    expect(vaporeon.every((o) => o.favor === 'weather')).toBe(true)
  })

  it('opens a choice with items: the free draw plus every branch an item unlocks, marked, in data order', () => {
    for (let seed = 1; seed < 40; seed++) {
      const offers = evolutionOffers(createRng(seed), EEVEE, ctx, ['iceStone', 'moonStone'])
      expect(offers).toHaveLength(3)
      expect(offers.filter((o) => o.favor === 'item').map((o) => o.id)).toEqual(['umbreon', 'glaceon'])
      expect(['vaporeon', 'jolteon', 'flareon']).toContain(offers[0]!.id)
      // A free branch's stone puts it in the choice beside another free one.
      const water = evolutionOffers(createRng(seed), EEVEE, ctx, ['waterStone'])
      expect(water).toHaveLength(2)
      expect(water[0]).toEqual({ id: 'vaporeon', favor: 'item' })
    }
    expect(ids(evolutionOffers(createRng(1), EEVEE, ctx, ['waterStone', 'thunderStone', 'fireStone']))).toEqual(['vaporeon', 'jolteon', 'flareon'])
  })

  it('keeps an item branch closed without its item, and the default one free', () => {
    expect(ids(evolutionOffers(createRng(1), branchesOf('ralts'), ctx, []))).toEqual(['gardevoir'])
    expect(ids(evolutionOffers(createRng(1), branchesOf('snorunt'), ctx, []))).toEqual(['glalie'])
    expect(ids(evolutionOffers(createRng(1), branchesOf('poliwag'), ctx, ['metalCoat']))).toEqual(['poliwrath'])
    expect(evolutionOffers(createRng(1), branchesOf('ralts'), ctx, ['dawnStone'])).toEqual([{ id: 'gardevoir', favor: null }, { id: 'gallade', favor: 'item' }])
    expect(evolutionOffers(createRng(1), branchesOf('scyther'), ctx, [])).toEqual([])
    expect(ids(evolutionOffers(createRng(1), branchesOf('charcadet'), ctx, ['maliciousArmor']))).toEqual(['ceruledge'])
    expect(canBranch(branchesOf('scyther'), [])).toBe(false)
    expect(canBranch(branchesOf('scyther'), ['blackAugurite'])).toBe(true)
  })

  it('only draws from the rng between two or more free branches', () => {
    const rng = createRng(9)
    evolutionOffers(rng, branchesOf('ralts'), ctx, ['dawnStone'])
    evolutionOffers(rng, branchesOf('scyther'), ctx, [])
    expect(rng()).toBe(createRng(9)())
  })

  it("offers every free branch marked `pick` (Galarian Slowpoke's) without drawing, and leaves Eevee's draw as it was", () => {
    const rng = createRng(9)
    expect(evolutionOffers(rng, branchesOf('slowpokeGalar'), { weather: 'fog', biome: 'meadow' }, [])).toEqual([
      { id: 'slowbroGalar', favor: null },
      { id: 'slowkingGalar', favor: 'weather' },
    ])
    expect(rng()).toBe(createRng(9)())
    for (let seed = 1; seed < 30; seed++) expect(evolutionOffers(createRng(seed), EEVEE, ctx, [])).toHaveLength(1)
  })
})

describe('replays', () => {
  // Two stones: Eevee gets a choice of three (the free draw, Umbreon and Glaceon).
  const start: ReplayStart = { seed: 11, starter: 'eevee', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], evo: ['moonStone', 'iceStone'], view: { w: 480, h: 270 } }
  /** Eevee at its evolution level, the branch pick open. */
  const staged = () => {
    const g = startGame(start)
    // Past the opening draft first.
    if (g.phase === 'levelup') chooseOffer(g, g.player.offers[0]!)
    g.player.level = 20
    advancePhase(g)
    return g
  }
  // Pick the second branch at once, wait out the evolution, then pick the Hidden Ability.
  const replay: Replay = { rules: 1, start, moves: [0, 400], events: [[0, 'offer', 1], [330, 'offer', 2]] }

  it('re-simulate the branch and ability picks to the same run', () => {
    const drawn = staged()
    expect(drawn.phase).toBe('branch')
    const branch = drawn.player.offers[1]
    const a = staged()
    const b = staged()
    // The boards show the branch the replay took, so it comes back with the result.
    expect(resimulate(replay, a).branch).toBe(a.player.branch)
    resimulate(replay, b)
    expect(a.phase).toBe('playing')
    expect(branch?.kind === 'form' && a.player.branch).toBe(branch?.kind === 'form' && branch.id)
    expect(a.player.ability.id).not.toBeNull()
    expect([b.player.branch, b.player.ability.id, b.player.stage, b.time]).toEqual([a.player.branch, a.player.ability.id, a.player.stage, a.time])
  })
})
