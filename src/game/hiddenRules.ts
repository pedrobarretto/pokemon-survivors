import { hash2, weightedPick, type Rng } from '../engine/rng'
import type { BiomeId } from '../data/biomes'
import { DIG_FINDS, HIDDEN, HIDDEN_PLACE_IDS, PLACES, type DigFind, type LuckyEntry, type PlaceDef, type PlaceId } from '../data/places'
import { EVENTS } from '../data/waves'
import * as dm from '../engine/dmath'

/**
 * Pure rules of hidden zones (`data/places.ts`, `hidden`): whether a run has
 * one and when, when it may open, which one, and what its Pokémon and glints
 * are worth. The game side lives in `hidden.ts`.
 */

/** Salt of the hidden zone's roll, so it draws apart from the seed's other uses. */
const SALT = 0x6e0770

/**
 * The run's hidden zone, rolled from its seed without touching the run's rng:
 * the run time it's due at, or null for none this run (`HIDDEN.odds`).
 */
export const rollHidden = (seed: number): number | null => {
  if (hash2(seed, 1, SALT) >= HIDDEN.odds) return null
  return HIDDEN.from + dm.round(hash2(seed, 2, SALT) * (HIDDEN.until - HIDDEN.from))
}

/** The wave bosses' times, in order: a hidden zone never opens just before one. */
const BOSS_TIMES = EVENTS.flatMap((e) => (e.kind === 'boss' ? [e.at] : [])).sort((a, b) => a - b)

/** The next wave boss at or after `time` (Infinity past the last). */
export const nextBossAt = (time: number) => BOSS_TIMES.find((at) => at >= time) ?? Infinity

/**
 * Whether the hidden zone opens now: due, not past `HIDDEN.last`, with
 * nothing else on (another entrance, a place, a rift, a boss) and no wave
 * boss nor rift omen (`riftAt`) due within `HIDDEN.clear` s.
 */
export const hiddenDue = (s: { time: number; at: number | null; busy: boolean; bossAlive: boolean; riftAt: number }) =>
  s.at !== null &&
  s.time >= s.at &&
  s.time < HIDDEN.last &&
  !s.busy &&
  !s.bossAlive &&
  nextBossAt(s.time) - s.time > HIDDEN.clear &&
  s.riftAt - s.time > HIDDEN.clear

/** Which hidden zone opens, weighted by the biome the run is in. */
export const pickHidden = (rng: Rng, biome: BiomeId): PlaceId =>
  weightedPick(
    rng,
    HIDDEN_PLACE_IDS.map((id) => {
      const def: PlaceDef = PLACES[id]
      return [id, def.biomes[biome] ?? 1] as const
    }),
  )

/** A lucky one's (or the rare dweller's) EXP at run time `time`: far more than the horde, growing with the clock. */
export const luckyXp = (base: number, time: number) => base * (1 + time / HIDDEN.xpRamp)

/** Which lucky one pops out. */
export const rollLucky = (rng: Rng, lucky: readonly LuckyEntry[]): LuckyEntry => weightedPick(rng, lucky.map((entry) => [entry, entry[1]] as const))

const DIG_IDS = Object.keys(DIG_FINDS) as DigFind[]

/** What a glint gives: an evolution stone only while the player lacks one (`stone`), Old Amber only once a visit (`fossil`). */
export const rollDig = (rng: Rng, s: { stone: boolean; fossil: boolean }): DigFind =>
  weightedPick(
    rng,
    DIG_IDS.filter((f) => (f !== 'stone' || s.stone) && (f !== 'fossil' || s.fossil)).map((f) => [f, DIG_FINDS[f]] as const),
  )

/** When the rare dweller shows up this visit (place age), or null: it doesn't. */
export const rollRare = (rng: Rng): number | null => {
  if (rng() >= HIDDEN.rare.chance) return null
  const [a, b] = HIDDEN.rare.at
  return a + rng() * (b - a)
}
