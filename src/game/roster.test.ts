import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { BIOMES } from '../data/biomes'
import { bossCandidates, EVENTS, MYTHICALS, RUNNER, STAGES, stageIndexAt, stageStart, TRIO_IDS, TRIOS } from '../data/waves'
import { SPIT_FROM } from './spitters'
import { byTypes, drawRoster, pickSpawn, rosterSchedule, routeWeight, seedWeight, stageArea, TRAIT_ALIVE, TRAIT_CAP, TRAIT_FROM, withTrio, type SpeciesWeight } from './roster'

const def = (id: EnemyId): EnemyDef => ENEMIES[id]
const ids = (pool: ReadonlyArray<readonly [EnemyId, number]>) => pool.map(([id]) => id)

describe('drawRoster', () => {
  it('draws the same cast for the same seed and different casts for different seeds', () => {
    expect(drawRoster(createRng(7))).toEqual(drawRoster(createRng(7)))
    const openers = new Set([1, 2, 3, 4, 5].map((seed) => ids(drawRoster(createRng(seed)).stages[0]!).join()))
    expect(openers.size).toBe(5)
  })

  it('fills every slot from its tier and only brings a few new species per stage', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { stages } = drawRoster(createRng(seed))
      const seen = new Set<EnemyId>()
      stages.forEach((pool, i) => {
        const tiers = ids(pool).map((id) => def(id).tier)
        expect([...tiers].sort()).toEqual([...STAGES[i]!.cast].sort())
        const fresh = ids(pool).filter((id) => !seen.has(id))
        expect(fresh.length).toBeLessThanOrEqual(3)
        expect(new Set(ids(pool)).size).toBe(pool.length)
        for (const id of ids(pool)) seen.add(id)
      })
    }
  })

  it('picks each stage’s runner among its plain species, none in the opening stage', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = drawRoster(createRng(seed))
      r.runners.forEach((runner, i) => {
        if (i < RUNNER.from) return expect(runner).toBeNull()
        expect(runner).not.toBeNull()
        expect(ids(r.stages[i]!)).toContain(runner)
        expect(def(runner!).trait).toBeUndefined()
      })
    }
  })

  it('draws each stage’s spitter from its lowest tier, outside its cast, from the first stage spitters can play in', () => {
    const first = stageIndexAt(SPIT_FROM)
    for (let seed = 1; seed <= 50; seed++) {
      const r = drawRoster(createRng(seed))
      r.spitters.forEach((spitter, i) => {
        if (i < first) return expect(spitter).toBeNull()
        expect(spitter).not.toBeNull()
        expect(ids(r.stages[i]!)).not.toContain(spitter)
        expect(def(spitter!).tier).toBe(Math.min(...STAGES[i]!.cast))
        expect(def(spitter!).trait).toBeUndefined()
      })
    }
  })

  it('sends flyers of the right tier in swarms and met species in rings', () => {
    for (let seed = 1; seed <= 50; seed++) {
      const r = drawRoster(createRng(seed))
      const met = new Set(r.stages.flatMap(ids))
      EVENTS.forEach((e, i) => {
        const id = r.events[i]
        if (e.kind === 'boss') return expect(bossCandidates(e)).toContain(id)
        if ('enemy' in e) return expect(id).toBe(e.enemy)
        expect(id && def(id).tier).toBe(e.tier)
        if (e.kind === 'swarm') expect(def(id!).types).toContain('flying')
        else expect(met.has(id!)).toBe(true)
      })
    }
  })

  it('biases fresh draws with the weight function', () => {
    const onlyGeodude = drawRoster(createRng(3), { weight: (d) => (d.name === 'Geodude' ? 1 : 0) })
    expect(ids(onlyGeodude.stages[2]!)).toContain('geodude')
    const rocky = (seed: number, weight?: SpeciesWeight) =>
      drawRoster(createRng(seed), { weight }).stages.flatMap(ids).filter((id) => def(id).types.includes('rock')).length
    const seeds = Array.from({ length: 40 }, (_, i) => i + 1)
    const plain = seeds.reduce((n, s) => n + rocky(s), 0)
    const cave = seeds.reduce((n, s) => n + rocky(s, byTypes({ rock: 6 })), 0)
    expect(cave).toBeGreaterThan(plain * 2)
  })
})

describe('routeWeight', () => {
  const seeds = Array.from({ length: 60 }, (_, i) => i + 1)
  const route = ['meadow', 'beach', 'plant', 'desert', 'volcano'] as const

  it('weighs each stage for the area it starts in, so a fork is decided before its stages begin', () => {
    expect(STAGES.map((_, i) => stageArea(i))).toEqual([0, 0, 0, 1, 1, 2, 3, 4])
  })

  it('pulls new species towards the route biome types without filling the stage with them', () => {
    const beach = STAGES.findIndex((_, i) => stageArea(i) === 1)
    const affinity: readonly string[] = BIOMES.beach.affinity
    const fits = (weight?: SpeciesWeight) =>
      seeds.flatMap((seed) => ids(drawRoster(createRng(seed), { weight }).stages[beach]!)).map((id) => def(id).types.some((t) => affinity.includes(t)))
    const share = (list: boolean[]) => list.filter(Boolean).length / list.length
    expect(share(fits(routeWeight(route)))).toBeGreaterThan(share(fits()) * 1.3)
    expect(share(fits(routeWeight(route)))).toBeLessThan(0.85)
  })
})

describe('trait species', () => {
  it('appear at most once per stage, never in the first minute, and spawn less than the rest', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { stages } = drawRoster(createRng(seed), { weight: seedWeight(seed) })
      stages.forEach((pool, i) => {
        const traited = pool.filter(([id]) => def(id).trait)
        expect(traited.length).toBeLessThanOrEqual(i < TRAIT_FROM ? 0 : TRAIT_CAP)
        for (const [, w] of traited) expect(w).toBeLessThan(Math.min(...pool.filter(([id]) => !def(id).trait).map(([, x]) => x)))
      })
    }
  })

  it('stop spawning once enough of them are alive', () => {
    const rng = createRng(5)
    const pool = [['bronzong', 100], ['rattata', 1]] as const
    expect(pickSpawn(rng, pool, TRAIT_ALIVE - 1)).toBe('bronzong')
    for (let i = 0; i < 20; i++) expect(pickSpawn(rng, pool, TRAIT_ALIVE)).toBe('rattata')
    expect(pickSpawn(rng, [['bronzong', 1]], TRAIT_ALIVE)).toBeNull()
  })

  it('never lead a drawn swarm or ring', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const { events } = drawRoster(createRng(seed))
      EVENTS.forEach((e, i) => {
        const id = events[i]
        if (id && e.kind !== 'boss' && !('enemy' in e)) expect(def(id).trait).toBeUndefined()
      })
    }
  })
})

describe('the legendary trio and the rare mythical', () => {
  const trioBosses = (events: readonly (EnemyId | null)[]) => EVENTS.flatMap((e, i) => (e.kind === 'boss' && 'trio' in e ? [events[i]] : []))
  const mythical = (events: readonly (EnemyId | null)[]) => events[EVENTS.findIndex((e) => e.kind === 'boss' && 'mythical' in e)]

  it('draws one trio per run, the same for the same seed, and puts its members in the slots in order', () => {
    expect(drawRoster(createRng(42)).trio).toBe(drawRoster(createRng(42)).trio)
    for (let seed = 1; seed <= 30; seed++) {
      const r = drawRoster(createRng(seed), { weight: seedWeight(seed) })
      expect(trioBosses(r.events)).toEqual(TRIOS[r.trio])
    }
  })

  it('covers every trio and every mythical across seeds', () => {
    const runs = Array.from({ length: 60 }, (_, i) => drawRoster(createRng(i + 1)))
    expect(new Set(runs.map((r) => r.trio))).toEqual(new Set(TRIO_IDS))
    expect(new Set(runs.map((r) => mythical(r.events)))).toEqual(new Set(MYTHICALS))
  })

  it('withTrio swaps only the trio slots', () => {
    const r = drawRoster(createRng(5))
    const other = TRIO_IDS.find((t) => t !== r.trio)!
    const swapped = withTrio(r, other)
    expect(trioBosses(swapped.events)).toEqual(TRIOS[other])
    EVENTS.forEach((e, i) => {
      if (!(e.kind === 'boss' && 'trio' in e)) expect(swapped.events[i]).toBe(r.events[i])
    })
  })
})

describe('byTypes', () => {
  it('takes the best listed factor among a species types, 1 when none is listed', () => {
    const weight = byTypes({ rock: 3, ground: 2, water: 0.2 })
    expect(weight(def('geodude'), 0)).toBe(3)
    expect(weight(def('wooper'), 0)).toBe(2)
    expect(weight(def('rattata'), 0)).toBe(1)
    expect(weight(def('tentacool'), 0)).toBe(0.2)
  })
})

describe('rosterSchedule', () => {
  it('lists every needed species once, soonest first, with the opening stage at 0 and the bosses', () => {
    const r = drawRoster(createRng(11))
    const schedule = rosterSchedule(r)
    expect(schedule.filter((s) => s.at === 0).map((s) => s.dex).sort()).toEqual(ids(r.stages[0]!).map((id) => def(id).dex).sort())
    expect(new Set(schedule.map((s) => s.dex)).size).toBe(schedule.length)
    expect(schedule.map((s) => s.at)).toEqual([...schedule.map((s) => s.at)].sort((a, b) => a - b))
    expect(schedule.map((s) => s.dex)).toContain(ENEMIES.mewtwo.dex)
    const second = ids(r.stages[1]!).find((id) => !ids(r.stages[0]!).includes(id))!
    expect(schedule.find((s) => s.dex === def(second).dex)?.at).toBe(stageStart(1))
  })
})
