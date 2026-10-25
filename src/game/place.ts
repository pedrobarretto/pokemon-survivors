import { range, weightedPick, type Rng } from '../engine/rng'
import type { BiomeId } from '../data/biomes'
import { ENEMIES, type EnemyDef, type EnemyId } from '../data/enemies'
import { PLACE, PLACE_IDS, PLACES, PRETTY_WING_COINS, WINGS, WING_IDS, type PlaceDef, type PlaceId, type WingId } from '../data/places'
import { RUN_LENGTH, STAGES, stageIndexAt } from '../data/waves'
import type { CaveState } from './cave'
import type { GraveyardState } from './graveyard'
import type { Room, Stash } from './room'
import type { SkyState } from './sky'
import type { StatDelta } from './stats'
import type { Feature } from './terrain'
import * as dm from '../engine/dmath'

/**
 * Pure rules and state of places (`data/places.ts`): when an entrance opens
 * and which, who lives inside, what wings are worth. The map side lives in
 * `placeEntrance.ts`, the inside in `placeInterior.ts`.
 */

export type PlaceOutcome = 'done' | 'timeout' | 'fallen'

/** What the shell hears about a place (sounds, toasts, the dungeon's title card), carried by the `place` GameEvent. */
export type PlaceNotice =
  /** An entrance appeared on the map (it gets an arrow), or closed unused. */
  | { kind: 'open' }
  | { kind: 'sealed' }
  /** Someone who isn't a Flying type stood in the updraft. */
  | { kind: 'blocked' }
  | { kind: 'enter' }
  /** A dungeon floor's title card ("Dark Cave B1F"); `floor` counts from 0. */
  | { kind: 'floor'; floor: number }
  /** The cave's wind: 1 "Something's stirring…", 2 "It's getting closer!", 3 "It's right nearby!". */
  | { kind: 'wind'; level: number }
  | { kind: 'monsterHouse' }
  | { kind: 'chestTick' }
  | { kind: 'treasure'; coins: number }
  /** A ghost's spirit flew into the Odd Keystone (`count` of the ones it needs). */
  | { kind: 'spirit'; count: number }
  | { kind: 'keystone'; shiny: boolean }
  | { kind: 'spiritomb'; shiny: boolean }
  /** Ten seconds left: the dawn breaks, the wind calms. */
  | { kind: 'warn' }
  | { kind: 'wing'; wing: WingId }
  | { kind: 'flock' }
  /** The sky's wind calmed with `wings` picked up on the flight. */
  | { kind: 'landed'; wings: number }
  /** The player fainted inside: a rescue brings them back out (the world waits meanwhile). */
  | { kind: 'fall' }
  /** Back on the map: `done` after the goal (or the sky's calm), `timeout` thrown out, `fallen` rescued. */
  | { kind: 'exit'; outcome: PlaceOutcome }

/** An entrance on the map: open until `left` runs out, `charge` counts the seconds the player has stood in its door. */
export type PlaceEntrance = { id: PlaceId; x: number; y: number; left: number; charge: number; open: boolean; terrain: Feature }

/** Each place's own state inside. */
export type PlaceStates = { cave: CaveState; graveyard: GraveyardState; sky: SkyState }

export type PlaceInteriorOf<K extends PlaceId> = Room & {
  id: K
  age: number
  /** Seconds before the place throws the player back out. */
  left: number
  /** Seconds the world holds still behind a title card (a dungeon floor's). */
  intro: number
  /** Seconds left to grab the loot once the goal is reached; null until then. */
  loot: number | null
  /** Seconds left on the rescue once the player fainted inside; null while they stand. */
  fall: number | null
  stash: Stash
  /** The entrance's door on the map: the player comes back out here. */
  door: { x: number; y: number }
  spawnBudget: number
  state: PlaceStates[K]
}

export type PlaceInterior = { [K in PlaceId]: PlaceInteriorOf<K> }[PlaceId]

export type PlaceState = {
  /** Game time the next entrance is due. */
  nextAt: number
  entrance: PlaceEntrance | null
  inside: PlaceInterior | null
  /** Places whose entrance opened, that the team went into, and whose goal they reached this run, in order. (The wings picked up are each player's, `Player.wings`.) */
  offered: PlaceId[]
  visited: PlaceId[]
  cleared: PlaceId[]
}

export const createPlaceState = (): PlaceState => ({ nextAt: PLACE.firstAt, entrance: null, inside: null, offered: [], visited: [], cleared: [] })

/** The longest a place keeps the player inside. */
const LONGEST = Math.max(...PLACE_IDS.map((id) => PLACES[id].time))

/**
 * When the entrance after the one due at `slot` (opening at `time`) is due:
 * counted from the schedule like the rifts', never before this one could be over.
 */
export const nextPlaceAt = (slot: number, time: number, rng: Rng) =>
  Math.max(slot + PLACE.every + range(rng, -PLACE.jitter, PLACE.jitter), time + PLACE.openTime + LONGEST)

/**
 * Whether an entrance opens now: not while a rift or another place has the
 * player's attention, after a boss fight (waiting up to `PLACE.bossWait` in a
 * regular run, for the reaper in the endless mode), and in a regular run
 * never so late that being inside could overlap Mewtwo.
 */
export const placeDue = (s: { time: number; nextAt: number; busy: boolean; bossAlive: boolean; endless: boolean }) =>
  s.time >= s.nextAt &&
  !s.busy &&
  (!s.bossAlive || (!s.endless && s.time >= s.nextAt + PLACE.bossWait)) &&
  (s.endless || s.time + PLACE.openTime + LONGEST < RUN_LENGTH)

/**
 * Which place opens: one not offered yet this run if any (else any), weighted
 * by the biome the run is in. The sky only for a Flying type.
 */
export const pickPlace = (rng: Rng, s: { offered: readonly PlaceId[]; biome: BiomeId; flyer: boolean }): PlaceId => {
  const open = PLACE_IDS.filter((id) => {
    const def: PlaceDef = PLACES[id]
    return !def.flyers || s.flyer
  })
  const fresh = open.filter((id) => !s.offered.includes(id))
  const pool = fresh.length > 0 ? fresh : open
  return weightedPick(
    rng,
    pool.map((id) => {
      const def: PlaceDef = PLACES[id]
      return [id, def.biomes[s.biome] ?? 1] as const
    }),
  )
}

/**
 * Who comes out in a place at run time `time`: its species whose tier is in
 * the current stage's cast (else the closest tier it has), all equally likely.
 */
export const placePool = (id: PlaceId, time: number): ReadonlyArray<readonly [EnemyId, number]> => {
  const tiers = STAGES[stageIndexAt(time)]!.cast
  const species: readonly EnemyId[] = PLACES[id].species
  const tierOf = (e: EnemyId) => {
    const def: EnemyDef = ENEMIES[e]
    return def.tier ?? 1
  }
  const inCast = species.filter((e) => tiers.includes(tierOf(e)))
  if (inCast.length > 0) return inCast.map((e) => [e, 1] as const)
  const top = Math.max(...tiers)
  const gap = (e: EnemyId) => Math.abs(tierOf(e) - top)
  const best = Math.min(...species.map(gap))
  return species.filter((e) => gap(e) === best).map((e) => [e, 1] as const)
}

/** A wing drifting into the sky. */
export const rollWing = (rng: Rng): WingId => weightedPick(rng, WING_IDS.map((id) => [id, WINGS[id].weight] as const))

/** The number a wing's line shows (its stat, a percent for damage, or the Pretty Wing's ₽). */
export const wingAmount = (id: WingId) => {
  const s: { maxHp?: number; might?: number; armor?: number; speed?: number } = WINGS[id].stats
  return id === 'prettyWing' ? PRETTY_WING_COINS : (s.maxHp ?? s.armor ?? s.speed ?? dm.round((s.might ?? 0) * 100))
}

/** What the wings picked up this run add to the player's stats. */
export const wingDeltas = (wings: Partial<Record<WingId, number>>): StatDelta[] =>
  WING_IDS.flatMap((id) => Array.from({ length: wings[id] ?? 0 }, (): StatDelta => WINGS[id].stats))

/** A place's boss (Spiritomb) is tuned for 1:30 and grows with the run clock, about half as fast as a rift legendary. */
export const placeBossScale = (time: number) => {
  const late = Math.max(0, time / 60 - 1.5)
  return { hp: 1 + late * 0.55, damage: 1 + late * 0.05 }
}
