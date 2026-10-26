import { pick, weightedPick, type Rng } from '../engine/rng'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { areaAt, BIOMES, plannedRoute, ROUTE, type BiomeId } from '../data/biomes'
import type { Tier } from '../data/roster'
import { isSummoner, SUMMONS } from '../data/traits'
import { bossKit } from '../data/bosses'
import type { PokeType } from '../data/types'
import { hasFlavor, SPIT_FROM } from './spitters'
import { bossOf, EVENTS, MYTHICALS, RUNNER, STAGES, stageIndexAt, stageStart, TRIO_IDS, TRIOS, type TrioId, type WaveEvent, type WaveStage } from '../data/waves'

/** Weighted spawn pool of one stage, as `weightedPick` takes it. */
export type StagePool = ReadonlyArray<readonly [EnemyId, number]>

/** A run's cast, drawn once when the run starts. */
export type Roster = {
  /** One pool per `STAGES` entry. */
  stages: readonly StagePool[]
  /** Species of each event, aligned with `EVENTS`: the boss (fixed, the trio's member or the mythical), or the swarm's or ring's. */
  events: readonly (EnemyId | null)[]
  /** The legendary trio that takes the 7:00, 9:30 and 12:00 slots (`TRIOS`). */
  trio: TrioId
  /** Per stage, the species whose regular spawns are runners (`RUNNER`), or null. */
  runners: readonly (EnemyId | null)[]
  /** Per stage, the species the spawner sends in as spitters (`game/spitters.ts`), outside the stage's pool, or null. */
  spitters: readonly (EnemyId | null)[]
}

/**
 * Optional draw bias, such as a biome's type affinity: relative odds of `def`
 * joining stage `stage` (index into `STAGES`). 1 = neutral, 0 = never (unless
 * nothing else of that tier is left).
 */
export type SpeciesWeight = (def: EnemyDef, stage: number) => number

export type RosterOptions = {
  weight?: SpeciesWeight
  stages?: readonly WaveStage[]
  events?: readonly WaveEvent[]
}

/** Spawn weight of a species new to the stage vs one kept from the previous stage. */
const FRESH = 4
const CARRIED = 3

/**
 * Species with a behavior trait are seasoning: a stage holds at most
 * `TRAIT_CAP` of them, none before stage `TRAIT_FROM` (minute 1), and each
 * spawns with `TRAIT_SPAWN` weight instead of `FRESH`/`CARRIED`. `TRAIT_ODDS`
 * makes up for how few they are, so most runs still meet a few. Tanky ones
 * (Bronzong under its own wards) pile up over a long stage, so the spawner
 * also stops at `TRAIT_ALIVE` of them alive (`pickSpawn`).
 */
export const TRAIT_CAP = 1
export const TRAIT_FROM = 1
export const TRAIT_ALIVE = 6
const TRAIT_SPAWN = 1
const TRAIT_ODDS = 6

type Entry = readonly [EnemyId, EnemyDef & { tier: Tier }]

/** Every species that can be drawn: anything in `ENEMIES` with a tier. */
const TIERED: readonly Entry[] = (Object.entries(ENEMIES) as Array<[EnemyId, EnemyDef]>).flatMap(([id, def]) =>
  def.tier === undefined ? [] : [[id, { ...def, tier: def.tier }] as const],
)

const TIER_OF = new Map(TIERED.map(([id, def]) => [id, def.tier]))
const TRAITED = new Set(TIERED.flatMap(([id, def]) => (def.trait ? [id] : [])))
/** True for species with a behavior trait (`data/traits.ts`). */
export const hasTrait = (id: EnemyId) => TRAITED.has(id)

/** Draw odds of a spitter whose type has its own spit flavor (`hasFlavor`). */
const FLAVOR_ODDS = 3

const isFlyer = (def: EnemyDef) => def.types.includes('flying')

/** One regular spawn from a stage's pool, skipping trait species while `traitsAlive` is at `TRAIT_ALIVE`. */
export const pickSpawn = (rng: Rng, pool: StagePool, traitsAlive: number): EnemyId | null => {
  const open = traitsAlive < TRAIT_ALIVE ? pool : pool.filter(([id]) => !hasTrait(id))
  return open.length > 0 ? weightedPick(rng, open) : null
}

/** Weighted pick of one entry; when every weight is 0 they all count the same. */
const drawOne = (rng: Rng, entries: readonly Entry[], weight: (def: EnemyDef) => number): EnemyId => {
  const weighted = entries.map(([id, def]) => [id, Math.max(0, weight(def))] as const)
  const total = weighted.reduce((sum, [, w]) => sum + w, 0)
  return weightedPick(rng, total > 0 ? weighted : weighted.map(([id]) => [id, 1] as const))
}

const summonsOf = (id: EnemyId): readonly EnemyId[] => (isSummoner(id) ? SUMMONS[id] : [])

/** Who a boss calls in with its `summon` patterns (Banette's Shuppet, Honchkrow's Murkrow). */
export const bossSummons = (id: EnemyId): readonly EnemyId[] => bossKit(id).flatMap((p) => (p.kind === 'summon' ? p.enemies : []))

const firstNonEmpty = <T>(...lists: ReadonlyArray<readonly T[]>) => lists.find((l) => l.length > 0) ?? []

/**
 * Draws a run's cast from `rng`: each stage's slots are filled from their tier
 * (species new to the run first), keeping up to `cast.length - fresh` of the
 * previous stage's newest species. Swarms take a flyer of their tier the run
 * has already met (else any flyer of the tier, else the fastest met), rings a
 * species of their tier the run has already met; neither ever takes a trait
 * species, which stay within `TRAIT_CAP` per stage. From stage `RUNNER.from`,
 * one of each stage's new species without a trait is its runner (spawning at
 * `RUNNER.weight`). Then come the run's legendary trio and the mythical its
 * rare finale slot would bring, and last, from the first stage that can have
 * spitters, each stage's spitter: a species of the stage's lowest tier from
 * outside its cast, leaning `FLAVOR_ODDS` towards types with their own spit.
 * Same seed, same cast.
 */
export const drawRoster = (rng: Rng, { weight = () => 1, stages = STAGES, events = EVENTS }: RosterOptions = {}): Roster => {
  const used = new Set<EnemyId>()
  const ofTier = (tier: Tier, traits: boolean) => {
    const all = TIERED.filter(([id, def]) => def.tier === tier && (traits || !hasTrait(id)))
    return firstNonEmpty(
      all.filter(([id]) => !used.has(id)),
      all,
      TIERED.filter(([id]) => !used.has(id) && (traits || !hasTrait(id))),
    )
  }
  const draw = (entries: readonly Entry[], stage: number) => {
    const id = drawOne(rng, entries, (def) => weight(def, stage) * (def.trait ? TRAIT_ODDS : 1))
    used.add(id)
    return id
  }

  let previous: EnemyId[] = []
  const casts = stages.map((stage, i) => {
    const open: Tier[] = [...stage.cast]
    const carried: EnemyId[] = []
    for (const id of [...previous].reverse()) {
      if (carried.length >= stage.cast.length - stage.fresh) break
      const slot = open.indexOf(TIER_OF.get(id) ?? 1)
      if (slot < 0) continue
      open.splice(slot, 1)
      carried.unshift(id)
    }
    let traitRoom = i >= TRAIT_FROM ? TRAIT_CAP - carried.filter(hasTrait).length : 0
    const fresh = open.map((tier) => {
      const id = draw(ofTier(tier, traitRoom > 0), i)
      if (hasTrait(id)) traitRoom--
      return id
    })
    previous = [...carried, ...fresh]
    return { carried, fresh }
  })

  /** Species without a trait the run has met by stage `index`, by tier (a ring of healers would be no seasoning). */
  const metBy = (index: number, tier: Tier): Entry[] => {
    const ids = new Set(casts.slice(0, index + 1).flatMap((c) => [...c.carried, ...c.fresh]))
    return TIERED.filter(([id, def]) => ids.has(id) && def.tier === tier && !hasTrait(id))
  }

  const eventSpecies = events.map((e): EnemyId | null => {
    if (e.kind === 'boss') return null
    if ('enemy' in e) return e.enemy
    const stage = stageIndexAt(e.at)
    const met = metBy(stage, e.tier)
    if (e.kind === 'ring') return met.length > 0 ? pick(rng, met)[0] : draw(ofTier(e.tier, false), stage)
    const flyers = met.filter(([, def]) => isFlyer(def))
    if (flyers.length > 0) return pick(rng, flyers)[0]
    const wildFlyers = ofTier(e.tier, false).filter(([, def]) => isFlyer(def))
    if (wildFlyers.length > 0) return draw(wildFlyers, stage)
    const fastest = [...met].sort((a, b) => b[1].speed - a[1].speed)[0]
    return fastest ? fastest[0] : draw(ofTier(e.tier, false), stage)
  })

  // Drawn last, so the cast itself is the same with or without runners.
  const runners = casts.map(({ fresh }, i) => {
    const plain = fresh.filter((id) => !hasTrait(id))
    return i >= RUNNER.from && plain.length > 0 ? pick(rng, plain) : null
  })

  const trio = pick(rng, TRIO_IDS)
  const mythical = pick(rng, MYTHICALS)

  // Drawn after everything else, so the rest of the roster is the same with or without spitters.
  const firstSpitter = stageIndexAt(SPIT_FROM)
  const spitters = casts.map(({ carried, fresh }, i) => {
    const stage = stages[i]
    if (i < firstSpitter || !stage) return null
    const cast = new Set([...carried, ...fresh])
    const open = ofTier(Math.min(...stage.cast) as Tier, false).filter(([id]) => !cast.has(id))
    if (open.length === 0) return null
    const id = drawOne(rng, open, (def) => weight(def, i) * (hasFlavor(def.types) ? FLAVOR_ODDS : 1))
    used.add(id)
    return id
  })

  return {
    stages: casts.map(({ carried, fresh }, i) => [
      ...carried.map((id) => [id, hasTrait(id) ? TRAIT_SPAWN : CARRIED] as const),
      ...fresh.map((id) => [id, hasTrait(id) ? TRAIT_SPAWN : id === runners[i] ? RUNNER.weight : FRESH] as const),
    ]),
    events: events.map((e, i) => (e.kind === 'boss' ? bossOf(e, trio, mythical) : eventSpecies[i] ?? null)),
    runners,
    spitters,
    trio,
  }
}

/** The roster with `trio` in the trio slots instead of the one drawn (the dev console's `ps.trio`). */
export const withTrio = (roster: Roster, trio: TrioId, events: readonly WaveEvent[] = EVENTS): Roster => ({
  ...roster,
  trio,
  events: roster.events.map((id, i) => {
    const e = events[i]
    return e?.kind === 'boss' && 'trio' in e ? TRIOS[trio][e.trio] : id
  }),
})

/**
 * Type affinity as a `SpeciesWeight`: a species takes the highest factor among
 * its types listed in `affinity`, or 1 when none is listed.
 * `byTypes({ rock: 3, ground: 3, water: 0.2 })` makes a cave full of Geodude.
 */
export const byTypes =
  (affinity: Partial<Record<PokeType, number>>): SpeciesWeight =>
  (def) => {
    const factors = def.types.flatMap((t) => (affinity[t] === undefined ? [] : [affinity[t]]))
    return factors.length > 0 ? Math.max(...factors) : 1
  }

/** Draw odds of a species with a type its stage's biome favors (`BIOMES[id].affinity`). */
export const AFFINITY_ODDS = 3

/** The area a stage draws for: the one it starts in (`areaAt`), so a fork is always decided before the stages it weighs start. */
export const stageArea = (stage: number) => areaAt(stageStart(stage), false)

const AFFINITY = Object.fromEntries(
  Object.entries(BIOMES).map(([id, biome]) => [id, byTypes(Object.fromEntries(biome.affinity.map((type) => [type, AFFINITY_ODDS])))]),
) as Record<BiomeId, SpeciesWeight>

/**
 * The run's draw bias along a planned route (one biome per area, `plannedRoute`):
 * each stage pulls its new species towards the types of the biome of its area.
 */
export const routeWeight =
  (route: readonly BiomeId[]): SpeciesWeight =>
  (def, stage) =>
    AFFINITY[route[stageArea(stage)] ?? ROUTE.start](def, stage)

/** The draw bias of a seed's default route, the one the run is drawn for before any fork is taken. */
export const seedWeight = (seed: number) => routeWeight(plannedRoute(seed))

/**
 * Every species a run needs (horde, swarms, rings, bosses, what its summoners and bosses call in) with the run time
 * it first shows up at, soonest first. The shell loads `at === 0` before the
 * run starts and streams the rest in this order.
 */
export const rosterSchedule = (roster: Roster, events: readonly WaveEvent[] = EVENTS) => {
  const needs = [
    ...roster.stages.flatMap((pool, i) => pool.flatMap(([id]) => [id, ...summonsOf(id)].map((need) => ({ id: need, at: stageStart(i) })))),
    ...events.flatMap((e, i) => {
      const id = roster.events[i]
      return id ? [id, ...(e.kind === 'boss' ? bossSummons(id) : [])].map((need) => ({ id: need, at: e.at })) : []
    }),
    ...roster.spitters.flatMap((id, i) => (id ? [{ id, at: stageStart(i) }] : [])),
  ].sort((a, b) => a.at - b.at)
  const seen = new Set<number>()
  return needs.flatMap(({ id, at }) => {
    const dex = ENEMIES[id].dex
    if (seen.has(dex)) return []
    seen.add(dex)
    return [{ dex, at }]
  })
}
