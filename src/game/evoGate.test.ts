import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { EVO_FIND } from '../data/shop'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import type { EvolutionStage } from '../data/starters'
import { killEnemy } from './combat'
import { collectEvoItem, dropEvoItem, missingEvoItems } from './evoGate'
import { advancePhase, chooseOffer, step } from './game'
import { recomputeStats } from './leveling'
import { NO_RANKS } from './meta'
import { startGame, TICK, type ReplayStart } from './replay'
import { spawnWaveBoss } from './spawner'
import type { Game } from './types'

const START: ReplayStart = { seed: 5, starter: 'ralts', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }
const STILL = { move: { x: 0, y: 0 }, special: false }

/** A run of `starter` at `stage`, its level at that stage's evolution: the evolution's turn comes up next. */
const atEvolution = (starter: PlayableId, start: Partial<ReplayStart> = {}, stage = 0): Game => {
  const g = startGame({ ...START, ...start, starter })
  // Past the opening draft first.
  if (g.phase === 'levelup') chooseOffer(g, g.player.offers[0]!)
  const from: EvolutionStage = PLAYABLE[starter].line[stage]!
  g.player.stage = stage
  g.player.level = from.evolveAt!
  recomputeStats(g)
  return g
}

/** Picks the first card of every screen that waits on one (the Ability's), until the run plays on. */
const settle = (g: Game) => {
  for (let i = 0; i < 20 && (g.phase === 'ability' || g.phase === 'levelup'); i++) chooseOffer(g, g.player.offers[0]!)
}

describe('item-locked branches', () => {
  it('keep Gallade closed without a Dawn Stone: Kirlia becomes Gardevoir without asking', () => {
    const g = atEvolution('ralts', {}, 1)
    advancePhase(g)
    expect(g.phase).toBe('evolving')
    expect(g.player.branch).toBe('gardevoir')
    expect(g.events.some((e) => e.kind === 'branchChoice')).toBe(false)
  })

  it('open with an owned item: Kirlia chooses, Gallade marked by its item', () => {
    const g = atEvolution('ralts', { evo: ['dawnStone'] }, 1)
    advancePhase(g)
    expect(g.phase).toBe('branch')
    expect(g.player.offers).toEqual([{ kind: 'form', id: 'gardevoir', favor: null }, { kind: 'form', id: 'gallade', favor: 'item' }])
  })

  it('open with a found item too, for that run only', () => {
    const g = atEvolution('snorunt')
    expect(missingEvoItems(g)).toEqual(['dawnStone'])
    collectEvoItem(g, 'dawnStone')
    expect(g.events).toContainEqual({ kind: 'evoItem', item: 'dawnStone' })
    expect(missingEvoItems(g)).toEqual([])
    advancePhase(g)
    expect(g.phase).toBe('branch')
    expect(g.player.offers).toContainEqual({ kind: 'form', id: 'froslass', favor: 'item' })
    // The next run starts without it: only owned items ride in the replay's start.
    expect(startGame({ ...START, starter: 'snorunt' }).player.evoFound).toEqual([])
  })
})

describe('a family with no free branch (Scyther, Charcadet)', () => {
  it('stays in its form without items, picks its Ability, and is 15% stronger while it waits', () => {
    const g = atEvolution('scyther')
    advancePhase(g)
    settle(g)
    expect(g.phase).toBe('playing')
    expect(g.player.stage).toBe(0)
    expect(g.player.evoHeld).toBe(true)
    expect(g.player.ability.id).not.toBeNull()
    expect(g.events).toContainEqual({ kind: 'evoHeld', items: ['metalCoat', 'blackAugurite'] })
    const held = g.player.stats.maxHp
    g.player.evoHeld = false
    recomputeStats(g)
    expect(held).toBe(Math.round(g.player.stats.maxHp * 1.15))
    g.player.evoHeld = true
    recomputeStats(g)
    // Further level-ups keep it waiting, without telling again.
    g.player.pendingLevelUps = 1
    advancePhase(g)
    settle(g)
    expect([g.player.stage, g.player.evoHeld, g.events.filter((e) => e.kind === 'evoHeld').length]).toEqual([0, true, 1])
  })

  it('evolves as soon as an item turns up, and loses the bonus', () => {
    const g = atEvolution('charcadet')
    advancePhase(g)
    settle(g)
    const held = g.player.stats.maxHp
    collectEvoItem(g, 'auspiciousArmor')
    step(g, STILL, TICK)
    expect(g.phase).toBe('evolving')
    expect(g.player.branch).toBe('armarouge')
    expect(g.player.evoHeld).toBe(false)
    for (let i = 0; i < 600 && g.phase === 'evolving'; i++) step(g, STILL, TICK)
    expect(g.player.stage).toBe(1)
    const evolved = g.player.stats.maxHp
    expect(evolved).toBeLessThan(Math.round(held + PLAYABLE.charcadet.line[1].bonus.maxHp! * 1.15))
  })

  it('offers the choice when both items are held', () => {
    const g = atEvolution('scyther', { evo: ['metalCoat'] })
    collectEvoItem(g, 'blackAugurite')
    advancePhase(g)
    expect(g.phase).toBe('branch')
    expect(g.player.offers.map((o) => o.kind === 'form' && o.id)).toEqual(['scizor', 'kleavor'])
  })
})

describe('line steps that need an item (Porygon, Exeggcute)', () => {
  /** Plays the evolution scene out, then the screens after it. */
  const evolveOut = (g: Game) => {
    for (let i = 0; i < 600 && g.phase === 'evolving'; i++) step(g, STILL, TICK)
    settle(g)
  }

  it('hold Porygon without the Up-Grade, 15% stronger, and missing only the next step’s item', () => {
    const g = atEvolution('porygon')
    expect(missingEvoItems(g)).toEqual(['upgrade'])
    advancePhase(g)
    settle(g)
    expect([g.phase, g.player.stage, g.player.evoHeld]).toEqual(['playing', 0, true])
    expect(g.player.ability.id).not.toBeNull()
    expect(g.events).toContainEqual({ kind: 'evoHeld', items: ['upgrade'] })
  })

  it('evolve with the owned Up-Grade, then hold Porygon2 for the Dubious Disc and evolve on finding it', () => {
    const g = atEvolution('porygon', { evo: ['upgrade'] })
    advancePhase(g)
    expect(g.phase).toBe('evolving')
    evolveOut(g)
    expect([g.player.stage, g.player.evoHeld]).toEqual([1, false])
    // Lv 28: the second step waits on its disc.
    g.player.level = 28
    advancePhase(g)
    settle(g)
    expect([g.phase, g.player.stage, g.player.evoHeld]).toEqual(['playing', 1, true])
    expect(missingEvoItems(g)).toEqual(['dubiousDisc'])
    collectEvoItem(g, 'dubiousDisc')
    step(g, STILL, TICK)
    expect([g.phase, g.player.evoHeld]).toEqual(['evolving', false])
    evolveOut(g)
    expect(g.player.stage).toBe(2)
    expect(missingEvoItems(g)).toEqual([])
  }, 30_000)

  it('evolve a held Porygon as soon as an Up-Grade is found', () => {
    const g = atEvolution('porygon')
    advancePhase(g)
    settle(g)
    collectEvoItem(g, 'upgrade')
    step(g, STILL, TICK)
    expect(g.phase).toBe('evolving')
    evolveOut(g)
    expect(g.player.stage).toBe(1)
  }, 30_000)

  it('need the Leaf Stone for Exeggutor (the one that opens Leafeon too), or the Sparkling Stone for Alolan Exeggutor', () => {
    const held = atEvolution('exeggcute')
    expect(missingEvoItems(held)).toEqual(['leafStone', 'sparklingStone'])
    advancePhase(held)
    settle(held)
    expect([held.player.stage, held.player.evoHeld]).toEqual([0, true])
    const g = atEvolution('exeggcute', { evo: ['leafStone'] })
    advancePhase(g)
    expect(g.phase).toBe('evolving')
    evolveOut(g)
    expect([g.player.stage, g.player.branch]).toEqual([1, 'exeggutor'])
    const alolan = atEvolution('exeggcute', { evo: ['sparklingStone'] })
    advancePhase(alolan)
    expect(alolan.player.branch).toBe('exeggutorAlola')
    // Scraggy's step is a plain level one.
    const scraggy = atEvolution('scraggy')
    expect(missingEvoItems(scraggy)).toEqual([])
    advancePhase(scraggy)
    expect(scraggy.phase).toBe('evolving')
  }, 30_000)

  it('let a boss drop only the next step’s item', () => {
    const g = startGame({ ...START, starter: 'porygon' })
    const drops = new Set<string>()
    for (let seed = 1; seed <= 200; seed++) {
      g.rng = createRng(seed)
      g.pickups = []
      dropEvoItem(g, 0, 0)
      for (const k of g.pickups) if (k.kind === 'evoItem') drops.add(k.item)
    }
    expect([...drops]).toEqual(['upgrade'])
    // Under an Everstone it never evolves, so nothing is missing.
    expect(missingEvoItems(startGame({ ...START, starter: 'porygon', bag: ['everstone'] }))).toEqual([])
  })
})

describe('Eevee', () => {
  it('evolves straight into one of its three free branches without items', () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 12; seed++) {
      const g = atEvolution('eevee', { seed })
      advancePhase(g)
      expect(g.phase).toBe('evolving')
      seen.add(g.player.branch!)
    }
    expect([...seen].every((id) => ['vaporeon', 'jolteon', 'flareon'].includes(id))).toBe(true)
    expect(seen.size).toBeGreaterThan(1)
  }, 30_000)

  it('chooses with items: the free draw and every branch its stones open', () => {
    const g = atEvolution('eevee', { evo: ['sunStone', 'thunderStone'] })
    collectEvoItem(g, 'shinyStone')
    advancePhase(g)
    expect(g.phase).toBe('branch')
    const offers = g.player.offers.flatMap((o) => (o.kind === 'form' ? [o] : []))
    expect(offers.filter((o) => o.favor === 'item').map((o) => o.id)).toEqual(['jolteon', 'espeon', 'sylveon'])
    expect(offers).toHaveLength(4)
    expect(['vaporeon', 'flareon']).toContain(offers.find((o) => o.favor !== 'item')!.id)
  })
})

describe('evolution items dropped by bosses', () => {
  it('drop one missing item with the data chance, the same for the same seed', () => {
    const g = startGame({ ...START, starter: 'eevee' })
    const roll = (seed: number) => {
      g.rng = createRng(seed)
      g.pickups = []
      dropEvoItem(g, 0, 0)
      return g.pickups.flatMap((k) => (k.kind === 'evoItem' ? [k.item] : []))
    }
    const runs = Array.from({ length: 1000 }, (_, i) => roll(i + 1))
    expect(runs.map((_, i) => roll(i + 1)).join()).toBe(runs.join())
    const dropped = runs.filter((r) => r.length > 0)
    expect(dropped.length / runs.length).toBeGreaterThan(EVO_FIND.chance - 0.05)
    expect(dropped.length / runs.length).toBeLessThan(EVO_FIND.chance + 0.05)
    // Only the items of Eevee's locked branches: never a free branch's stone.
    expect(new Set(dropped.flat())).toEqual(new Set(['sunStone', 'moonStone', 'leafStone', 'iceStone', 'shinyStone']))
  })

  it("drop nothing once nothing is missing: a branch taken, an Everstone, a family without item branches", () => {
    const branched = startGame({ ...START, starter: 'ralts' })
    branched.player.branch = 'gardevoir'
    const everstone = startGame({ ...START, starter: 'ralts', bag: ['everstone'] })
    const owned = startGame({ ...START, starter: 'ralts', evo: ['dawnStone'] })
    for (const g of [branched, everstone, owned, startGame({ ...START, starter: 'charmander' })]) expect(missingEvoItems(g)).toEqual([])
  })

  it('come from a wave boss defeated in the run, and a held Scyther evolves on picking one up', () => {
    let g: Game | null = null
    for (let seed = 1; seed < 40 && !g; seed++) {
      const run = atEvolution('scyther', { seed })
      advancePhase(run)
      settle(run)
      killEnemy(run, spawnWaveBoss(run, 'onix', run.time))
      if (run.pickups.some((k) => k.kind === 'evoItem')) g = run
    }
    expect(g).not.toBeNull()
    const drop = g!.pickups.find((k) => k.kind === 'evoItem')!
    Object.assign(g!.player, { x: drop.x, y: drop.y + 6 })
    // The boss's Poké Ball and TM disc open their screens on the way: the first card, like a tap.
    for (let i = 0; i < 240 && g!.phase !== 'evolving' && g!.phase !== 'branch'; i++) {
      if (g!.phase === 'playing') step(g!, STILL, TICK)
      else chooseOffer(g!, g!.player.offers[0]!)
    }
    expect(g!.player.evoFound).toHaveLength(1)
    expect(['evolving', 'branch']).toContain(g!.phase)
    expect(g!.player.evoHeld).toBe(false)
  }, 30_000)
})
