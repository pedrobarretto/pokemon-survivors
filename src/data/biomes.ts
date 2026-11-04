import type { ThemeId } from './music'
import type { PokeType } from './types'

/** Weather that can roll in a biome. `clear` is the absence of weather. */
export const WEATHER_IDS = ['clear', 'sun', 'rain', 'sand', 'snow', 'fog'] as const
export type WeatherId = (typeof WEATHER_IDS)[number]

export type BiomeDef = {
  /**
   * Types that feel at home here. The spawner (`leanPick`, `game/roster.ts`)
   * makes the stage's species of these types likelier where a player stands
   * in this biome (forest → grass/bug), so the horde matches the scenery.
   */
  affinity: readonly PokeType[]
  /** Relative odds of each weather spell while the team's lead stands here (missing = never). */
  weather: Partial<Record<WeatherId, number>>
  /** Run theme while no boss is alive. */
  theme: ThemeId
}

/**
 * The places a run walks through. Visuals live in `render/world.ts`,
 * `render/props.ts` and `render/terrain.ts`; names in `i18n` (`world.biomes`).
 * Where each one lies on the map is `BIOME_MAP`'s call (`game/biomeMap.ts`).
 */
export const BIOMES = {
  meadow: { affinity: ['normal', 'flying', 'bug', 'grass'], weather: { clear: 5, sun: 3, rain: 2 }, theme: 'run' },
  forest: { affinity: ['grass', 'bug', 'poison'], weather: { clear: 3, rain: 4, fog: 2, sun: 1 }, theme: 'forest' },
  /** Route 109's beach: Wingull over the waves, Krabby in the tide pools. */
  beach: { affinity: ['water', 'flying', 'normal'], weather: { clear: 3, sun: 4, rain: 3 }, theme: 'beach' },
  cave: { affinity: ['rock', 'ground', 'fighting', 'poison'], weather: { clear: 3, sand: 4, fog: 1 }, theme: 'cave' },
  /** Kanto's Power Plant: Magnemite and Voltorb among the generators, Koffing in the fumes. */
  plant: { affinity: ['electric', 'steel', 'poison'], weather: { clear: 3, rain: 4, fog: 3 }, theme: 'plant' },
  /** Route 111's desert: a sandstorm that never quite stops, Trapinch pits, Cacnea and the old pyramids. */
  desert: { affinity: ['ground', 'rock', 'dragon'], weather: { sand: 6, sun: 3, clear: 1 }, theme: 'desert' },
  snow: { affinity: ['ice', 'water', 'flying'], weather: { clear: 2, snow: 5, fog: 1 }, theme: 'snow' },
  /** Mt. Chimney: cooled basalt, lava in the cracks, hot springs and a harsh sun. */
  volcano: { affinity: ['fire', 'rock', 'ground'], weather: { sun: 5, clear: 2, sand: 2 }, theme: 'volcano' },
  tower: { affinity: ['ghost', 'psychic', 'dark', 'poison'], weather: { clear: 2, fog: 5, rain: 2 }, theme: 'tower' },
} as const satisfies Record<string, BiomeDef>

export type BiomeId = keyof typeof BIOMES

export const BIOME_IDS = Object.keys(BIOMES) as BiomeId[]

/**
 * The map's patchwork (`game/biomeMap.ts`): the world is cut into regions
 * around points jittered off a square grid, `region` px apart; each region
 * wears one biome, borders wave through a low-frequency warp, and the ground
 * dithers from one biome into the next across `blend` px on each side.
 * Regions are tiered by how far their point lies from the run's start: the
 * calm biomes within `rings[0]`, the middle tier out to `rings[1]`, the far
 * one out to `rings[2]`; past that every tier mixes. The start's own region
 * is always the meadow, grown by `start` px so the run opens on Route 1.
 */
export const BIOME_MAP = {
  region: 1100,
  /** How far (share of `region`) a region's point strays from its grid spot; at most 0.6, so the nearest point always lies in the 3×3 regions around a spot. */
  jitter: 0.6,
  /** The warp that bends the borders: a broad sway and a finer ripple, easing in over `calm` px from the start. */
  warp: { scale: 760, amp: 270, fine: { scale: 120, amp: 24 }, calm: 900 },
  rings: [2400, 4400, 7200],
  start: 380,
  blend: 36,
  /** How far (px) past a border a player walks before the biome counts as entered (no banner flicker on the line). */
  enter: 20,
} as const

/** The tiers, nearest the start first. Past the last ring, any biome but the meadow. */
export const BIOME_TIERS = [
  ['meadow', 'forest', 'beach'],
  ['cave', 'plant', 'desert'],
  ['snow', 'volcano', 'tower'],
] as const satisfies readonly (readonly BiomeId[])[]

/** The run's first biome: where every run starts. */
export const START_BIOME = 'meadow' satisfies BiomeId

/** Seconds of clear sky at the start of a run, before the first weather roll. */
export const FIRST_WEATHER = 40

/** How long one weather spell (or a clear spell) lasts, in seconds. */
export const WEATHER_SPELL = { min: 50, max: 85 } as const
