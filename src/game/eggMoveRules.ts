import * as dm from '../engine/dmath'
import { scaleBy } from './kitRules'

/**
 * Pure rules behind the egg families' signature moves (`eggMoves.ts` casts
 * them): the numbers and target picks that keep each one fair, free of game
 * state so they're tested on their own (`eggMoveRules.test.ts`). Timings the
 * renderer also needs (leap, windups) live here too, so `render/` never
 * imports the casting code.
 */

type Point = { x: number; y: number }
type Foe = Point & { id: number; dying: number; boss: boolean; maxHp: number }

/* ---------------- Dream Eater ---------------- */

/** Dream Eater's bite hits sleeping foes this many times harder (and the bite wakes them). */
export const DREAM_BONUS = 3
/** Share of a bite's damage that heals the player (through the drain budget). */
export const DREAM_DRAIN = 0.3
/** Px around the player the Hypnosis wave reaches (scaled by area). */
export const HYPNOSIS_R = 62
/** Seconds from the cast until the bites land. */
export const DREAM_WINDUP = 0.32

/* ---------------- Force Palm ---------------- */

/** The aura wave that goes through a paralyzed foe: its share of the palm's damage, speed and life. */
export const AURA_SHARE = 0.8
export const AURA_SPEED = 230
export const AURA_TTL = 0.34

/* ---------------- Dig ---------------- */

/** How far from where the player burrowed Dig looks for its foe to come up under. */
export const DIG_REACH = 160
/** Radius of the quake when it comes up (scaled by area), and the i-frames it leaves. */
export const DIG_BLAST = 52
export const DIG_IFRAMES = 0.45

/**
 * The foe to come up under (Dig): within `reach` of `from`, a boss before
 * anyone, then the most max HP, then the nearest, then the lower id (the same
 * on every engine). Null when nobody is in reach.
 */
export const biggestFoe = <T extends Foe>(foes: readonly T[], from: Point, reach: number): T | null => {
  let best: T | null = null
  let bestD = Infinity
  for (const e of foes) {
    if (e.dying >= 0) continue
    const d = dm.sq(e.x - from.x) + dm.sq(e.y - from.y)
    if (d > reach * reach) continue
    if (best) {
      if (e.boss !== best.boss) {
        if (!e.boss) continue
      } else if (e.maxHp !== best.maxHp) {
        if (e.maxHp < best.maxHp) continue
      } else if (d > bestD || (d === bestD && e.id > best.id)) continue
    }
    best = e
    bestD = d
  }
  return best
}

/* ---------------- Twister, Sand Tomb ---------------- */

/** Px/s Twister drags the foes it touches toward its eye (÷ mass). */
export const TWISTER_PULL = 150
/** Sand Tomb's vortex radius (scaled by area) and the chance a foe in it misses its contact hit. */
export const SAND_R = 38
export const SAND_BLIND = 0.5

/* ---------------- Meteor Mash ---------------- */

/** Seconds a meteor takes to fall: its shadow is the warning. */
export const MASH_FALL = 0.42
/** Each Meteor Mash hit adds a stack (up to `MASH_MAX`, gone when the player gets hurt); each stack is +`MASH_STEP` damage. */
export const MASH_STEP = 0.06
export const MASH_MAX = 10
export const mashMult = (stacks: number) => 1 + MASH_STEP * Math.min(MASH_MAX, stacks)

/* ---------------- Zen Headbutt ---------------- */

/** How far ahead a foe must be, the hop's length cap and how long it carries the player. */
export const ZEN_SEEK = 72
export const ZEN_HOP = 46
export const ZEN_TIME = 0.12

/* ---------------- Foul Play ---------------- */

/** Foul Play turns the target's own strength against it: ×contact damage ÷ `FOUL_REF`, within [`FOUL_MIN`, `FOUL_MAX`]. */
export const FOUL_REF = 9
export const FOUL_MIN = 0.75
export const FOUL_MAX = 5
export const FOUL_REACH = 150
export const FOUL_WINDUP = 0.18
export const foulMult = (contact: number) => Math.min(FOUL_MAX, Math.max(FOUL_MIN, contact / FOUL_REF))

/* ---------------- Body Slam ---------------- */

/** Seconds in the air, how far it looks for a crowd, how close counts as the same crowd, and the hop with nobody around. */
export const SLAM_LEAP = 0.42
export const SLAM_REACH = 120
export const SLAM_CLUSTER = 34
export const SLAM_HOP = 36
/** How high the player flies at the top of the leap, in px (drawn only). */
export const SLAM_LIFT = 26
/** The landing's shockwave radius (scaled by area). */
export const SLAM_R = 50

/**
 * The foe at the heart of the thickest crowd within `reach` of `from` (Body
 * Slam lands on it): the most other foes within `radius` of it, then the
 * nearest to `from`, then the lower id. Null when nobody is in reach.
 */
export const densestFoe = <T extends Point & { id: number; dying: number }>(foes: readonly T[], from: Point, reach: number, radius: number): T | null => {
  let best: T | null = null
  let bestCount = -1
  let bestD = Infinity
  for (const e of foes) {
    if (e.dying >= 0) continue
    const d = dm.sq(e.x - from.x) + dm.sq(e.y - from.y)
    if (d > reach * reach) continue
    let count = 0
    for (const o of foes) if (o !== e && o.dying < 0 && dm.sq(o.x - e.x) + dm.sq(o.y - e.y) <= radius * radius) count++
    if (count < bestCount || (count === bestCount && (d > bestD || (d === bestD && best && e.id > best.id)))) continue
    best = e
    bestCount = count
    bestD = d
  }
  return best
}

/* ---------------- Dynamic Punch, Giga Impact ---------------- */

/** Seconds Dynamic Punch winds up before it lands. */
export const PUNCH_WINDUP = 0.2
/** Giga Impact: the charge's length cap and time, the impact's radius (scaled by area). */
export const GIGA_DASH = 72
export const GIGA_TIME = 0.18
export const GIGA_R = 64
export const GIGA_SEEK = 110

/* ---------------- Rollout, Ice Ball ---------------- */

/** A rolling hit doubles the next one, up to ×`RAMP_MAX` the cast's damage. */
export const RAMP_MAX = 5
export const rampDamage = (current: number, base: number) => Math.min(base * RAMP_MAX, current * 2)
/** Whether a ramping hitbox already hits at full power. */
export const rampFull = (current: number, base: number) => current >= base * RAMP_MAX * 0.999
/** Px an Ice Ball grows per hit, and the most it can grow (both before area). */
export const ICE_GROW = 1.5
export const ICE_MAX_R = 13

/* ---------------- Fury Cutter ---------------- */

/** Fury Cutter's streak: each cast that hits adds one (×1 → ×4 at `FURY_MAX`), a cast that hits nothing starts over. */
export const FURY_MAX = 3
export const furyNext = (stacks: number, hit: boolean) => (hit ? Math.min(FURY_MAX, stacks + 1) : 0)
/** How close a foe must be for Fury Cutter to swing at all (no swing, no miss). */
export const FURY_SEEK = 80

/* ---------------- Sacred Sword ---------------- */

export const SWORD_ARC = 2.4
export const SWORD_TIME = 0.2

/* ---------------- Dragon Darts ---------------- */

/**
 * How many of `darts` darts each of the `targets` nearest foes gets: one each
 * while there are enough foes, the rest doubling up from the nearest
 * (2 darts, 1 foe → [2]; 2 darts, 3 foes → [1, 1]).
 */
export const splitDarts = (darts: number, targets: number): number[] => {
  const k = Math.min(darts, targets)
  return Array.from({ length: k }, (_, i) => Math.floor(darts / k) + (i < darts % k ? 1 : 0))
}

/* ---------------- Snarl ---------------- */

/** Each of Snarl's chained waves (one per head) hits ×`SNARL_RAMP` the one before. */
export const SNARL_RAMP = 1.15
export const SNARL_TIME = 0.16

/* ---------------- Flail ---------------- */

/** Flail hits harder the lower the player's HP: ×1 at full, ×3 at 20% or less. */
export const flailMult = (hp: number) => scaleBy(1 - hp, 2.5, 3)
/** Extra wild whacks as HP drops: +1 under ~67%, +2 under ~33%. */
export const flailExtra = (hp: number) => Math.min(2, Math.floor((1 - hp) * 3))

/* ---------------- Bone Rush ---------------- */

/** Bone Rush hits 2–5 times like the games (35%, 35%, 15%, 15%), from a roll in [0, 1). */
export const boneHits = (roll: number) => (roll < 0.35 ? 2 : roll < 0.7 ? 3 : roll < 0.85 ? 4 : 5)

/* ---------------- Metronome ---------------- */

/** Chance Metronome reaches for an evolved move instead of a base one. */
export const METRONOME_RARE = 0.15
/** Metronome's damage stat at which the picked move hits as hard as its own. */
export const METRONOME_REF = 10

/** Metronome's pick from two rolls in [0, 1): the first decides common or rare, the second which one. */
export const metronomePick = <T>(rare: number, which: number, common: readonly T[], evolved: readonly T[]): T => {
  const list = rare < METRONOME_RARE ? evolved : common
  return list[Math.min(list.length - 1, Math.floor(which * list.length))]!
}

/* ---------------- Echoed Voice ---------------- */

/** Echoed Voice grows with each cast in a row (up to `ECHO_MAX`, reset when the player gets hurt). */
export const ECHO_MAX = 5
export const ECHO_R = 46
export const ECHO_GROW = 8
export const ECHO_TIME = 0.42
export const echoMult = (stacks: number) => 1 + 0.25 * Math.min(ECHO_MAX, stacks)

/* ---------------- Curse ---------------- */

/** Curse costs this share of the player's current HP (never the last point). */
export const CURSE_COST = 0.15
/** Curse waits while the player's HP is under this share of max HP. */
export const CURSE_FLOOR = 0.25
export const curseCost = (hp: number) => Math.max(0, Math.min(Math.ceil(hp) - 1, dm.round(hp * CURSE_COST)))
/** Seconds between a curse's ticks, and the max HP above which it stops counting (Arceus stays a reaper). */
export const CURSE_EVERY = 0.5
export const CURSE_HP_CAP = 40000
/** One tick of a curse that takes `pct`% of max HP per second. */
export const curseTick = (maxHp: number, pct: number, every = CURSE_EVERY) => (Math.min(maxHp, CURSE_HP_CAP) * pct * every) / 100

/**
 * Curse's victims, strongest first: bosses, then the most max HP, then the
 * lower id. Bosses and big elites before anyone else.
 */
export const strongestFirst = <T extends { id: number; boss: boolean; maxHp: number }>(a: T, b: T) =>
  Number(b.boss) - Number(a.boss) || b.maxHp - a.maxHp || a.id - b.id
