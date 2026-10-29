import * as dm from '../engine/dmath'
import { took } from './kitRules'
import type { OwnedMove } from './types'

/**
 * Pure rules behind the "verb" moves (`moveVerbs.ts` casts them): who Brine,
 * Venoshock and Bonemerang go for, where Future Sight lands, how Electro Ball
 * and Gyro Ball read the player's speed, Self-Destruct's price, Roost's and
 * Sheer Cold's numbers per level, Dragon Tail's arc and Stealth Rock's ring.
 * No game state is touched, so each is tested on its own (`moveVerbRules.test.ts`).
 */

type Point = { x: number; y: number }
type Foe = { id: number; x: number; y: number; dying: number }
type Hurt = Foe & { hp: number; maxHp: number }

/** The entry of a per-level table for a move at `level` (1-based), holding at the last one. */
export const atLevel = <T>(table: readonly T[], level: number): T => table[Math.max(0, Math.min(table.length, level) - 1)]!

const d2 = (a: Point, b: Point) => dm.sq(a.x - b.x) + dm.sq(a.y - b.y)

/* ---------------- Targeting ---------------- */

/**
 * Brine's picks: up to `count` living foes within `range` of `from`, the most
 * hurt first (lowest HP share), ties to the nearer one, then the lower id.
 */
export const mostHurt = <T extends Hurt>(foes: readonly T[], from: Point, count: number, range: number): T[] =>
  foes
    .filter((e) => e.dying < 0 && d2(e, from) <= range * range)
    .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp || d2(a, from) - d2(b, from) || a.id - b.id)
    .slice(0, count)

/** Bonemerang's picks: up to `count` living foes within `range`, the farthest first (ties to the lower id). */
export const farthest = <T extends Foe>(foes: readonly T[], from: Point, count: number, range: number): T[] =>
  foes
    .filter((e) => e.dying < 0 && d2(e, from) <= range * range)
    .sort((a, b) => d2(b, from) - d2(a, from) || a.id - b.id)
    .slice(0, count)

/**
 * The nearest living foe within `range` that `prefer` accepts (Venoshock: a
 * poisoned one), or the nearest of all when none does. Skips `taken` ids.
 */
export const nearestPreferring = <T extends Foe>(
  foes: readonly T[], from: Point, range: number, prefer: (e: T) => boolean, taken: ReadonlySet<number>,
): T | null => {
  let best: T | null = null
  let bestD = Infinity
  let liked = false
  for (const e of foes) {
    if (e.dying >= 0 || taken.has(e.id)) continue
    const d = d2(e, from)
    if (d > range * range) continue
    const ok = prefer(e)
    if (liked && !ok) continue
    if (ok === liked && (d > bestD || (d === bestD && best && e.id > best.id))) continue
    best = e
    bestD = d
    liked = ok
  }
  return best
}

/** A grid cell's key from its column and row; two far cells may share one, which only adds foes the distance check drops. */
const cellKey = (cx: number, cy: number) => ((cx & 0xffff) << 16) | (cy & 0xffff)

/** `foes` bucketed by `size`-wide grid cells. */
const cellsOf = <T extends Point>(foes: readonly T[], size: number) => {
  const cells = new Map<number, T[]>()
  for (const e of foes) {
    const key = cellKey(Math.floor(e.x / size), Math.floor(e.y / size))
    const cell = cells.get(key)
    if (cell) cell.push(e)
    else cells.set(key, [e])
  }
  return cells
}

/** How many foes in `cells` (bucketed at `size`, at least `reach` wide) lie within `reach` of `e` (`r2` = reach²), `e` itself included. */
const neighbors = (cells: ReadonlyMap<number, readonly Point[]>, e: Point, size: number, r2: number) => {
  const cx = Math.floor(e.x / size)
  const cy = Math.floor(e.y / size)
  let n = 0
  for (let x = cx - 1; x <= cx + 1; x++) {
    for (let y = cy - 1; y <= cy + 1; y++) {
      const cell = cells.get(cellKey(x, y))
      if (cell) for (const o of cell) if (d2(e, o) <= r2) n++
    }
  }
  return n
}

/**
 * Future Sight's landing spots: up to `count` points over the densest groups of
 * `foes`. Each pick is the foe with the most neighbors within `radius` (ties to
 * the lower id); the spot is its neighbors' centroid, and the foes it covers
 * can't seed another spot. Neighbors are counted from a grid of `radius`-wide
 * cells (only the 3×3 around a foe can hold one in reach), so a late-game horde
 * of a thousand in view stays cheap; the counts are the same as checking all.
 */
export const clusterSpots = (foes: readonly Foe[], count: number, radius: number): Point[] => {
  const left = foes.filter((e) => e.dying < 0)
  const spots: Point[] = []
  const r2 = radius * radius
  // Cells at least as wide as the reach (a reach of 0 or less finds only foes on the very spot).
  const size = radius > 0 ? radius : 1
  while (spots.length < count && left.length > 0) {
    const cells = cellsOf(left, size)
    let best = left[0]!
    let bestN = -1
    for (const e of left) {
      const n = neighbors(cells, e, size, r2)
      if (n > bestN || (n === bestN && e.id < best.id)) {
        best = e
        bestN = n
      }
    }
    let sx = 0
    let sy = 0
    let n = 0
    for (let i = left.length - 1; i >= 0; i--) {
      const o = left[i]!
      if (d2(best, o) > r2) continue
      sx += o.x
      sy += o.y
      n++
      left.splice(i, 1)
    }
    spots.push({ x: sx / n, y: sy / n })
  }
  return spots
}

/** Signed angle (−π..π) from `a` to `b`. */
const angleDiff = (a: number, b: number) => {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

/**
 * Dragon Tail's victims: the living foes within `reach` of `from` whose
 * direction lies within `half` radians of `angle` (the arc behind the player).
 */
export const inArc = <T extends Foe>(foes: readonly T[], from: Point, angle: number, half: number, reach: number): T[] =>
  foes.filter((e) => e.dying < 0 && d2(e, from) <= reach * reach && Math.abs(angleDiff(angle, dm.atan2(e.y - from.y, e.x - from.x))) <= half)

/* ---------------- Speed readings ---------------- */

/** The speed stat both orbs are measured against (the base player's). */
export const SPEED_REF = 68
/** How far Electro Ball and Gyro Ball scale per unit of speed share, and their bounds. */
export const SPEED_SLOPE = 2.5
export const SPEED_MULT = { min: 0.7, max: 2.2 } as const

const clampMult = (m: number) => Math.min(SPEED_MULT.max, Math.max(SPEED_MULT.min, m))

/** Electro Ball's damage multiplier from the speed stat: faster than the base player hits harder (Choice Scarf builds). */
export const electroMult = (speed: number) => clampMult(1 + SPEED_SLOPE * (speed / SPEED_REF - 1))

/**
 * Gyro Ball's damage multiplier from the pace the player is moving at right
 * now (px/s): the mirror image, slower hits harder, so its gears grind hardest
 * while you stand your ground (or wade).
 */
export const gyroMult = (pace: number) => clampMult(1 + SPEED_SLOPE * (1 - pace / SPEED_REF))

/* ---------------- Self-Destruct ---------------- */

/** Share of the current HP Self-Destruct costs. */
export const SELF_DESTRUCT_COST = 0.2

/** HP Self-Destruct takes from a player at `hp`: a fifth, rounded down, never the last point. */
export const selfDestructCost = (hp: number) => Math.max(0, Math.min(Math.floor(hp * SELF_DESTRUCT_COST), Math.ceil(hp) - 1))

/* ---------------- Roost ---------------- */

/** Roost per level: seconds standing still before it settles, and max HP healed per second once settled. */
export const ROOST = {
  settle: [1, 1, 1, 0.8, 0.8, 0.8, 0.6, 0.6],
  heal: [0.02, 0.02, 0.025, 0.025, 0.025, 0.03, 0.03, 0.035],
} as const

/** Roost's fork branches that change the rest itself: Quick Perch (Lv 4) settles sooner but heals less, Deep Rest (Lv 7) the other way. */
export const ROOST_FORKS = { quick: { settle: 0.5, heal: 0.7 }, deep: { settle: 1.4, heal: 1.6 } } as const

/** Seconds standing still before Roost settles, after its branches. */
export const roostSettle = (owned: OwnedMove) =>
  atLevel(ROOST.settle, owned.level) * (took(owned, 4, 0) ? ROOST_FORKS.quick.settle : 1) * (took(owned, 7, 1) ? ROOST_FORKS.deep.settle : 1)

/** Max HP Roost heals per second once settled, after its branches. */
export const roostHeal = (owned: OwnedMove) =>
  atLevel(ROOST.heal, owned.level) * (took(owned, 4, 0) ? ROOST_FORKS.quick.heal : 1) * (took(owned, 7, 1) ? ROOST_FORKS.deep.heal : 1)

/** Whether Roost settles during a cast covering (`still` − `tick`, `still`]: the moment its landing gust blows. */
export const roostLands = (still: number, tick: number, settle: number) => still >= settle && still - tick < settle

/* ---------------- Sheer Cold ---------------- */

/** HP share under which Sheer Cold's ring shatters a regular foe, per level. */
export const SHEER_COLD_EXECUTE = [0.2, 0.2, 0.2, 0.24, 0.24, 0.27, 0.27, 0.3] as const

/* ---------------- Stealth Rock ---------------- */

/** Stones a ring may keep on the field: this many rings' worth, the oldest crumble first. */
export const STEALTH_RINGS = 3

/** `count` points evenly on a circle of `radius` around `at`, the first at `phase` radians. */
export const ringPoints = (at: Point, count: number, radius: number, phase = 0): Point[] =>
  Array.from({ length: count }, (_, i) => {
    const a = phase + (i / count) * Math.PI * 2
    return { x: at.x + dm.cos(a) * radius, y: at.y + dm.sin(a) * radius }
  })
