import { hash2 } from '../engine/rng'
import type { ThemeId } from './music'
import type { PokeType } from './types'
import { RUN_LENGTH } from './waves'

/** Weather that can roll in a biome. `clear` is the absence of weather. */
export const WEATHER_IDS = ['clear', 'sun', 'rain', 'sand', 'snow', 'fog'] as const
export type WeatherId = (typeof WEATHER_IDS)[number]

export type BiomeDef = {
  /**
   * Types that feel at home here. `routeWeight` (`game/roster.ts`) makes new
   * species of these types likelier in the stages played here (forest →
   * grass/bug), so the horde matches the scenery.
   */
  affinity: readonly PokeType[]
  /** Relative odds of each weather spell while in this biome (missing = never). */
  weather: Partial<Record<WeatherId, number>>
  /** Run theme while no boss is alive. */
  theme: ThemeId
}

/**
 * The places a run can walk through. Visuals live in `render/world.ts`,
 * `render/props.ts` and `render/terrain.ts`; names in `i18n` (`world.biomes`).
 * Which ones a run sees is the route's call (`ROUTE`).
 */
export const BIOMES = {
  meadow: { affinity: ['normal', 'flying', 'bug', 'grass'], weather: { clear: 5, sun: 3, rain: 2 }, theme: 'run' },
  forest: { affinity: ['grass', 'bug', 'poison'], weather: { clear: 3, rain: 4, fog: 2, sun: 1 }, theme: 'forest' },
  /** Route 109's beach: Wingull over the waves, Krabby in the tide pools. */
  beach: { affinity: ['water', 'flying', 'normal'], weather: { clear: 3, sun: 4, rain: 3 }, theme: 'beach' },
  cave: { affinity: ['rock', 'ground', 'fighting', 'poison'], weather: { clear: 3, sand: 4, fog: 1 }, theme: 'cave' },
  /** Kanto's Power Plant: Magnemite and Voltorb among the generators, Koffing in the fumes. */
  plant: { affinity: ['electric', 'steel', 'poison'], weather: { clear: 3, rain: 4, fog: 3 }, theme: 'plant' },
  snow: { affinity: ['ice', 'water', 'flying'], weather: { clear: 2, snow: 5, fog: 1 }, theme: 'snow' },
  /** Route 111's desert: a sandstorm that never quite stops, Trapinch pits and Cacnea. */
  desert: { affinity: ['ground', 'rock', 'dragon'], weather: { sand: 6, sun: 3, clear: 1 }, theme: 'desert' },
  tower: { affinity: ['ghost', 'psychic', 'dark', 'poison'], weather: { clear: 2, fog: 5, rain: 2 }, theme: 'tower' },
  /** Mt. Chimney: cracked basalt, hot springs and a harsh sun. */
  volcano: { affinity: ['fire', 'rock', 'ground'], weather: { sun: 5, clear: 2, sand: 2 }, theme: 'volcano' },
} as const satisfies Record<string, BiomeDef>

export type BiomeId = keyof typeof BIOMES

export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

/**
 * The route graph. A run starts on Route 1 and, at each of its four
 * milestones, forks between the two biomes of the next tier: two route gates
 * stand on the map near the end of an area (`game/route.ts`) and the first
 * one a player stands in picks where the run goes next. Five areas, sixteen
 * routes; the Pokémon Tower and Mt. Chimney are the two finales.
 */
export const ROUTE = {
  start: 'meadow',
  tiers: [
    ['forest', 'beach'],
    ['cave', 'plant'],
    ['snow', 'desert'],
    ['tower', 'volcano'],
  ],
} as const satisfies { start: BiomeId; tiers: readonly (readonly [BiomeId, BiomeId])[] }

/** Areas in a regular run: the start and one per fork. */
export const AREAS = ROUTE.tiers.length + 1

/** Seconds each area of the regular run lasts. */
export const BIOME_LENGTH = RUN_LENGTH / AREAS

/** In the endless mode, a fork every this many seconds past 15:00 takes the run somewhere else. */
export const ENDLESS_LEG = 5 * 60

/** Start of area `k` (0 the run's start): five equal slices of the run, then the endless mode's legs from 20:00. */
export const areaStart = (k: number) => (k < AREAS ? k * BIOME_LENGTH : RUN_LENGTH + (k - AREAS + 1) * ENDLESS_LEG)

/** The area at run time `time` (seconds). The last regular one holds after 15:00 unless the endless mode is on. */
export const areaAt = (time: number, endless: boolean) => {
  if (endless && time >= areaStart(AREAS)) return AREAS - 1 + Math.floor((time - RUN_LENGTH) / ENDLESS_LEG)
  return Math.min(AREAS - 1, Math.max(0, Math.floor(time / BIOME_LENGTH)))
}

/** Salt of the route's own draws, so they never share the terrain's hashes. */
const ROUTE_SALT = 7331

/**
 * The two biomes the fork into area `k` (from 1) offers, given the biome the
 * run is in: a tier of `ROUTE`, or in the endless mode any two others, drawn
 * from the seed. The first is the default, the one the run takes when nobody
 * picks; it's drawn from the seed too, so everyone on a seed (the Desafio do
 * dia) faces the same forks with the same default.
 */
export const forkOptions = (seed: number, k: number, from: BiomeId): readonly [BiomeId, BiomeId] => {
  const tier = ROUTE.tiers[k - 1]
  if (tier) return hash2(seed, k, ROUTE_SALT) < 0.5 ? tier : [tier[1], tier[0]]
  const others = BIOME_IDS.filter((b) => b !== from)
  const a = others[Math.floor(hash2(seed, k, ROUTE_SALT + 1) * others.length)]!
  const rest = others.filter((b) => b !== a)
  return [a, rest[Math.floor(hash2(seed, k, ROUTE_SALT + 2) * rest.length)]!]
}

/** `path` (the biomes decided so far, from area 0) filled up to the last regular area with the seed's defaults. */
export const plannedRoute = (seed: number, path: readonly BiomeId[] = [ROUTE.start]): BiomeId[] => {
  const planned = [...path]
  for (let k = planned.length; k < AREAS; k++) planned.push(forkOptions(seed, k, planned[k - 1]!)[0])
  return planned
}

/** The route gates (`game/route.ts`): when a fork's gates go up and close, how one is taken and where they stand. */
export const FORK = {
  /** Seconds before an area starts that its fork's gates go up. */
  lead: 60,
  /** Seconds before it starts that the fork closes: nobody picked, so the default goes (and the next horde's sheets get time to load). */
  close: 8,
  /** Seconds a player stands in a gate to take it. */
  charge: 1,
  /** How close (px) to a gate's foot counts as standing in it. */
  radius: 16,
  /** Clear ground (px) a gate needs around its foot. */
  clearance: 22,
  /** Once every player is this far (px) from both gates, they go up again near the team. */
  stray: 560,
} as const

/** Seconds of clear sky at the start of a run, before the first weather roll. */
export const FIRST_WEATHER = 40

/** How long one weather spell (or a clear spell) lasts, in seconds. */
export const WEATHER_SPELL = { min: 50, max: 85 } as const
