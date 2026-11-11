import type { WeatherId } from '../data/biomes'

/**
 * Numbers and pure rules of the gallop batch (`gallopMoves.ts`): Ponyta's
 * kit from the community's list. High Horsepower and Headlong Rush hit
 * harder the more ground the player covered since the last cast, Low Kick and
 * Axe Kick hit heavy foes harder (`HEAVY_MASS` in `kitRules.ts`), Horn Drill and Hyper Drill bore into one
 * foe and finish it, Morning Sun and Revival Blessing heal by the run's sky,
 * Bounce and Sky Drop land in a crescendo. Import-free beyond types, so the
 * tests read them as they are.
 */

export const GALLOP = {
  /** High Horsepower: eruptions `gap` px apart, one every `step` s; full momentum after `full` px walked. */
  horsepower: { gap: 17, step: 0.055, r: 11, full: 220, floor: 0.35, lines: 1 },
  /** Headlong Rush: three lines fanned `spread` rad apart, each eruption a pillar that lingers `pillar` s. */
  headlong: { gap: 18, step: 0.05, r: 12, full: 220, floor: 0.45, spread: 0.32, pillar: 0.55, haste: 0.25, hasteFor: 1.2 },
  /** Low Kick: a low arc `arc` rad wide, `length` px out; heavy foes (`HEAVY_MASS`) take `heavy` ×, bosses `boss` × more on top. */
  lowKick: { arc: 2.4, time: 0.18, length: 34, segments: 4, r: 8, heavy: 1.5, boss: 1.3 },
  /** Axe Kick: a heel dropped on the heaviest foe within `reach`, `delay` s after the warning; a ring as it lands. */
  axeKick: { reach: 130, delay: 0.32, r: 20, ring: 34 },
  /** Horn Drill: bores `bores` times, one every `every` s, then the finishing blow fells a regular foe at or under `execute` of its HP. */
  hornDrill: { reach: 120, every: 0.09, bores: 6, execute: 0.4, finish: 2.4, boss: 1.6, hitstop: 0.06 },
  /** Hyper Drill: the same bore, then a lance through and `lance` px past the foe, felling what it leaves at or under `pierceExecute`. */
  hyperDrill: { reach: 140, every: 0.075, bores: 6, execute: 0.45, finish: 2.6, boss: 1.8, lance: 110, speed: 520, pierceExecute: 0.25, hitstop: 0.08 },
  /** Morning Sun: the halo's reach; the heal is `SUN_HEAL` by the sky, grown by level. */
  morningSun: { r: 36, ttl: 0.7 },
  /** Revival Blessing: heals `heal` × Morning Sun's, and what the heal can't fit flares out at `overflow` × the HP left over. */
  revival: { r: 46, ttl: 0.8, heal: 1.4, overflow: 1.6, flare: 64 },
  /** Bounce: a landing every `hop` s, each `crescendo` wider than the last. */
  bounce: { hop: 0.42, r: 22, crescendo: 0.22, lift: 14 },
  /** Sky Drop: the hops, then a dive on the thickest crowd within `reach` that pulls it together. */
  skyDrop: { hop: 0.4, r: 24, crescendo: 0.2, lift: 16, reach: 150, dive: 0.55, diveR: 34, pull: 140, finish: 2.2 },
} as const

/**
 * Max HP Morning Sun heals a cast, by the run's sky, as in the games: the sun
 * the most, a clear sky half of it, rain, sand, snow and fog a quarter.
 */
export const SUN_HEAL: Record<WeatherId, number> = { sun: 0.12, clear: 0.075, rain: 0.035, sand: 0.035, snow: 0.035, fog: 0.035 }

/** Each level's heal multiplier (Lv 1 … Lv 8; evolved moves read Lv 1 … Lv 5). */
const HEAL_BY_LEVEL = [1, 1.1, 1.1, 1.2, 1.3, 1.3, 1.4, 1.5] as const

/** The share of max HP a Morning Sun cast heals at `level` under `weather`. */
export const sunHeal = (weather: WeatherId, level: number) => SUN_HEAL[weather] * (HEAL_BY_LEVEL[Math.min(HEAL_BY_LEVEL.length, Math.max(1, level)) - 1] ?? 1)

/** Momentum from the px walked since the last cast: `floor` standing still, 1 at `full` px and past. */
export const momentum = (walked: number, full: number, floor: number) => floor + (1 - floor) * Math.min(1, Math.max(0, walked) / full)

/** Revival Blessing's split: what the heal fits under max HP, and the flare's damage from what's left over. */
export const blessing = (heal: number, hp: number, maxHp: number, overflow: number) => {
  const fits = Math.max(0, Math.min(heal, maxHp - hp))
  return { heal: fits, flare: (heal - fits) * overflow }
}
