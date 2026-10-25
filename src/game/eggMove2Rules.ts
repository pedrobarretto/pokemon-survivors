import * as dm from '../engine/dmath'
import type { WeatherId } from '../data/biomes'
import type { PokeType } from '../data/types'
import type { StatusSpec } from './status'

/**
 * Pure rules behind the second batch of egg-family signature moves
 * (`eggMoves2.ts` casts them): target picks, recoil, Weather Ball's forms and
 * the scalings, free of game state so they're tested on their own
 * (`eggMove2Rules.test.ts`). Timings the renderer also needs live here, so
 * `render/` never imports the casting code.
 */

type Point = { x: number; y: number }
type Foe = Point & { id: number; dying: number }

/** Whether (x, y) is within `r` px of the segment from `a` to `b`. */
export const nearSegment = (x: number, y: number, a: Point, b: Point, r: number) => {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = dx * dx + dy * dy
  const k = len > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / len)) : 0
  return dm.sq(x - (a.x + dx * k)) + dm.sq(y - (a.y + dy * k)) <= r * r
}

/**
 * The foe to aim a line through (Brave Bird): among the foes within `reach`,
 * the one whose line of `length` px from `from` (through it) crosses the most
 * foes within `width` px, the nearest on a tie, then the lower id. Null when nobody is in reach.
 */
export const bestLine = <T extends Foe>(foes: readonly T[], from: Point, reach: number, length: number, width: number): T | null => {
  let best: T | null = null
  let bestCount = -1
  let bestD = Infinity
  for (const e of foes) {
    if (e.dying >= 0) continue
    const d = dm.sq(e.x - from.x) + dm.sq(e.y - from.y)
    if (d > reach * reach) continue
    const dist = Math.max(1, dm.hypot(e.x - from.x, e.y - from.y))
    const end = { x: from.x + ((e.x - from.x) / dist) * length, y: from.y + ((e.y - from.y) / dist) * length }
    let count = 0
    for (const o of foes) if (o.dying < 0 && nearSegment(o.x, o.y, from, end, width)) count++
    if (count < bestCount || (count === bestCount && (d > bestD || (d === bestD && best !== null && e.id > best.id)))) continue
    best = e
    bestCount = count
    bestD = d
  }
  return best
}

/**
 * HP a recoil hit costs: `share` of max HP per foe hit, never past `cap` of
 * max HP for the whole cast (`paid` so far), and never the last HP point.
 */
export const recoilCost = (maxHp: number, hp: number, paid: number, share: number, cap: number) =>
  Math.max(0, Math.min(dm.round(maxHp * share), dm.round(maxHp * cap) - paid, Math.floor(hp) - 1))

/* ---------------- Brave Bird ---------------- */

/** The dive: how far it looks for a line, its length and seconds, the corridor it counts foes in, and its recoil. */
export const BRAVE = { reach: 140, length: 96, time: 0.2, width: 16, recoil: 0.02, cap: 0.06 } as const

/* ---------------- Wild Charge ---------------- */

/** The charge's speed boost, and the recoil each hit costs (capped per charge). */
export const WILD = { haste: 0.3, recoil: 0.01, cap: 0.05, hitInterval: 0.3 } as const

/* ---------------- Weather Ball ---------------- */

/** What Weather Ball turns into: its type, its damage multiplier, what it inflicts and how wide it bursts. */
export type WeatherForm = { form: number; type: PokeType; mult: number; status: StatusSpec | null; burst: number }

const FORMS = {
  clear: { form: 0, type: 'normal', mult: 1, status: null, burst: 1 },
  fog: { form: 0, type: 'normal', mult: 1, status: null, burst: 1 },
  sun: { form: 1, type: 'fire', mult: 1, status: { kind: 'burn', chance: 0.8, duration: 2.5, power: 0.3 }, burst: 1.35 },
  rain: { form: 2, type: 'water', mult: 1, status: { kind: 'slow', chance: 1, duration: 1.5, power: 0.5 }, burst: 1.2 },
  sand: { form: 3, type: 'rock', mult: 1.5, status: { kind: 'weaken', chance: 0.6, duration: 3, power: 0.3 }, burst: 1.1 },
  snow: { form: 4, type: 'ice', mult: 1.5, status: { kind: 'freeze', chance: 0.35, duration: 1.2, power: 0 }, burst: 1.2 },
} as const satisfies Record<WeatherId, WeatherForm>

/**
 * Weather Ball's form under `weather`: Normal in clear skies and fog, of the
 * weather's type otherwise and ×1.5 in all (sun and rain already boost Fire and
 * Water by that much, so their own multiplier is 1).
 */
export const weatherBallForm = (weather: WeatherId): WeatherForm => FORMS[weather]

/** Seconds Weather Ball is in the air. */
export const BALL_LOB = 0.36

/* ---------------- Accelerock, Aerial Ace ---------------- */

/** Accelerock's reach, and how close to its path another foe must be to be clipped. */
export const ACCEL = { reach: 150, clip: 10 } as const
/** Aerial Ace's reach (it never misses inside it). */
export const ACE_REACH = 170

/* ---------------- Zap Cannon ---------------- */

/** Zap Cannon's orb: radius (× area), seconds between its zaps on a foe, and how long it flies. */
export const ZAP = { r: 11, hitInterval: 0.5, ttl: 2.8 } as const

/* ---------------- Cross Poison ---------------- */

/** Chance a Cross Poison is a critical hit, and what it deals then. */
export const CROSS_CRIT = 0.25
export const CROSS_CRIT_MULT = 2
/** Whether a cast's roll (in [0, 1)) is a critical hit. */
export const crossCrit = (roll: number, chance = CROSS_CRIT) => roll < chance

/* ---------------- Bubble Beam, Rock Blast ---------------- */

/** How far a bubble of the stream may stray from the aim, in radians. */
export const BUBBLE_SPREAD = 0.14
/** Seconds between two rocks of a Rock Blast. */
export const ROCK_GAP = 0.09

/* ---------------- Cotton Spore, Spore, Play Rough ---------------- */

/** How far the cloud looks for a crowd, and the crowd radius that counts. */
export const COTTON = { reach: 170, crowd: 40, r: 30, hitInterval: 0.5 } as const
/** Spore's cloud radius around the player (× area). */
export const SPORE_R = 50
/** Play Rough's brawl: how far it looks, its radius (× area), how often it hits, how long it lasts. */
export const ROUGH = { reach: 110, r: 16, hitInterval: 0.22, ttl: 0.9 } as const

/* ---------------- Waterfall ---------------- */

/** Px between two pillars of the line, and the seconds between them rising. */
export const FALL_GAP = 18
export const FALL_STEP = 0.06
export const FALL_RISE = 0.12

/** Waterfall's damage by evolution stage: a splash as Magikarp, a torrent once evolved. */
export const waterfallMult = (stage: number) => (stage <= 0 ? 0.5 : stage === 1 ? 1.25 : 1.35)

/* ---------------- Last Resort ---------------- */

/** Other moves Last Resort needs to hit at full strength. */
export const RESORT_NEED = 4

/** Last Resort's damage with `others` other moves learned: a tap below `RESORT_NEED`, full power at it, a bit more past it. */
export const lastResortMult = (others: number) => (others < RESORT_NEED ? 0.2 : 1 + 0.15 * (others - RESORT_NEED))

/** Seconds Last Resort winds up before the star lands. */
export const RESORT_WINDUP = 0.22
