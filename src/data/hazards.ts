import type { Difficulty } from '../game/difficulty'
import type { BiomeId, WeatherId } from './biomes'
import type { HazardVisual } from './bosses'

/**
 * World hazards: past a minute of the run the map itself strikes where the
 * player stands (`game/hazards.ts`), so standing still is a losing plan
 * whatever the horde does. Each attack is one of `WORLD_PATTERNS`, telegraphed
 * like a boss's strikes and drawn with the same `HazardVisual`s.
 */
export type HazardPace = {
  /** Run time (s) the world starts striking. */
  start: number
  /** Seconds between attacks when they start and once the ramp is done, and the ramp's length in minutes. */
  every: readonly [number, number]
  ramp: number
  /** Seconds a telegraph shows before it lands (never under `MIN_TELEGRAPH`). */
  telegraph: number
  /** A strike's damage as a multiple of the minute's contact damage (`HAZARD_HIT`). */
  damage: number
  /** Pace multiplier while the finale boss (Mewtwo) lives; 0 keeps the world quiet for the duel. */
  finale: number
}

/** Per difficulty: Normal starts late and slow, Nightmare early, tight and quick to land. */
export const HAZARD_PACE = {
  normal: { start: 540, every: [12, 7], ramp: 6, telegraph: 1.2, damage: 1.2, finale: 0 },
  hard: { start: 420, every: [10, 5.5], ramp: 7, telegraph: 1.05, damage: 1.5, finale: 0.4 },
  nightmare: { start: 300, every: [9, 4], ramp: 8, telegraph: 0.9, damage: 1.6, finale: 0.6 },
} as const satisfies Record<Difficulty, HazardPace>

/** Telegraphs never land quicker than this (s): every hazard must stay readable on a phone. */
export const MIN_TELEGRAPH = 0.8

/**
 * The minute's contact damage a strike scales from: a tier-3 body (`data/roster.ts`)
 * times `scaling`'s damage. `foes` is the share of a tier-3 foe's HP of the minute a
 * landing strike takes off each regular enemy it hits (bosses shrug it off).
 */
export const HAZARD_HIT = { contact: 9, foeHp: 50, foes: 0.35 } as const

/**
 * Pace multipliers: while a boss is in the fight or an Alpha charges (their own attacks must stay readable),
 * and how many seconds after a boss arrives the world holds still (its entrance banner).
 * In endless mode attacks keep quickening by `endless` per minute past the run, down to `floor` of the ramp's end.
 */
export const HAZARD_RULES = { bossFight: 0.5, entrance: 4, endless: 0.04, floor: 0.55 } as const

export type WorldPatternId = 'volley' | 'line' | 'zone'

/**
 * The attacks, picked by `weight`. Sizes in px; `count` ramps from its first value
 * to its second with the pace's ramp.
 * - volley: strikes around and under the player (the first lands right on them).
 * - line: a wall of strikes across the player's path, `lead` seconds ahead of their
 *   velocity, landing one after the other `sweep` s apart (through the player when still).
 * - zone: lingering patches dropped under the player (Stealth Rock), `ttl` s once landed,
 *   hurting at `damage` of a strike on touch, at most `max` patches alive.
 */
export const WORLD_PATTERNS = {
  volley: { weight: 3, count: [3, 5], spread: 48, radius: 13 },
  line: { weight: 2, count: [5, 7], gap: 22, lead: 1.1, radius: 11, sweep: 0.06 },
  zone: { weight: 2, count: [2, 3], spread: 20, radius: 12, ttl: 6, damage: 0.5, max: 9 },
} as const

/** What the strikes and the patches look like (and their type, `HAZARD_TYPES`). */
export type HazardFlavor = { strike: HazardVisual; zone: HazardVisual }

/** By weather: Thunder in the rain, hail in the snow, Rock Slide in the sandstorm, flares under the sun. */
export const WEATHER_FLAVOR: Partial<Record<WeatherId, HazardFlavor>> = {
  rain: { strike: 'thunder', zone: 'thunder' },
  snow: { strike: 'ice', zone: 'ice' },
  sand: { strike: 'rock', zone: 'rock' },
  sun: { strike: 'fire', zone: 'fire' },
}

/** Clear skies and fog: meteors and Stealth Rock, or Toxic Spikes where poison feels at home; spouts on the beach, sparks in the Power Plant, lava bombs on Mt. Chimney. */
export const BIOME_FLAVOR: Record<BiomeId, HazardFlavor> = {
  meadow: { strike: 'rock', zone: 'rock' },
  forest: { strike: 'rock', zone: 'poison' },
  cave: { strike: 'rock', zone: 'rock' },
  snow: { strike: 'ice', zone: 'ice' },
  tower: { strike: 'rock', zone: 'poison' },
  beach: { strike: 'water', zone: 'water' },
  plant: { strike: 'thunder', zone: 'steel' },
  desert: { strike: 'rock', zone: 'rock' },
  volcano: { strike: 'fire', zone: 'fire' },
}
