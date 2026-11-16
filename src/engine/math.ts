import * as dm from './dmath'
export type Vec = { x: number; y: number }

export const TAU = Math.PI * 2

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t

export const dist2 = (ax: number, ay: number, bx: number, by: number) => dm.sq(ax - bx) + dm.sq(ay - by)

/** Unit vector from (ax, ay) to (bx, by); falls back to `fallback` when both points coincide. */
export const dirTo = (ax: number, ay: number, bx: number, by: number, fallback: Vec = { x: 1, y: 0 }): Vec => {
  const dx = bx - ax
  const dy = by - ay
  const len = dm.hypot(dx, dy)
  return len > 1e-6 ? { x: dx / len, y: dy / len } : fallback
}

export const fromAngle = (angle: number, length = 1): Vec => ({ x: dm.cos(angle) * length, y: dm.sin(angle) * length })

/**
 * PMD sprite sheets store 8 directions as rows:
 * 0 Down, 1 DownRight, 2 Right, 3 UpRight, 4 Up, 5 UpLeft, 6 Left, 7 DownLeft.
 */
export type Dir8 = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7

/** tan(22.5°): the slope where a direction turns from straight to diagonal. */
const TAN_EIGHTH = Math.SQRT2 - 1

/**
 * The sprite row facing (x, y): the nearest of the 8 directions, by comparing
 * the slope with 22.5° rather than taking the angle (every moving foe asks
 * every tick, and `dm.atan2` is a software arctangent). Still (0, 0) faces Right.
 */
export const dir8 = (x: number, y: number): Dir8 => {
  const ax = Math.abs(x)
  const ay = Math.abs(y)
  if (ay <= ax * TAN_EIGHTH) return x < 0 ? 6 : 2
  if (ax <= ay * TAN_EIGHTH) return y < 0 ? 4 : 0
  return y < 0 ? (x < 0 ? 5 : 3) : x < 0 ? 7 : 1
}

/** In-place removal of items that fail `keep`, preserving order. Avoids per-frame allocations. */
export const retain = <T>(items: T[], keep: (item: T) => boolean) => {
  let w = 0
  for (let r = 0; r < items.length; r++) {
    const item = items[r]!
    if (keep(item)) items[w++] = item
  }
  items.length = w
}

export const formatTime = (seconds: number) => {
  const s = Math.floor(seconds)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
