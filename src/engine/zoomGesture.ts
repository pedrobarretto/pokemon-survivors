import type { Vec } from './math'

/** A zoom step: 1 farther out, -1 closer in, 0 none. */
export type ZoomStep = -1 | 0 | 1

/** Scrolled px (a mouse notch is about 100) that make one step; a trackpad's pinch reports far smaller deltas, so `pinched` counts them more. */
const WHEEL_STEP = 90
const PINCH_WHEEL_GAIN = 10

/**
 * Adds one wheel event to `acc`, the scroll not yet spent: rolling down zooms
 * out, like every map. A full step spends it all, so a trackpad's long flick
 * doesn't run through every level.
 */
export const wheelStep = (acc: number, deltaY: number, pinched: boolean): { acc: number; step: ZoomStep } => {
  const next = acc + (pinched ? deltaY * PINCH_WHEEL_GAIN : deltaY)
  return Math.abs(next) < WHEEL_STEP ? { acc: next, step: 0 } : { acc: 0, step: next > 0 ? 1 : -1 }
}

/** How much the fingers' spread must change for a step, and how far (CSS px) each finger must have moved: a thumb steering beside a resting finger is no pinch. */
const PINCH_RATIO = 1.25
const PINCH_MOVED = 12

/** Two fingers from where they started: spreading them zooms in, bringing them together out. */
export const pinchStep = (from: readonly [Vec, Vec], to: readonly [Vec, Vec]): ZoomStep => {
  const moved = (i: 0 | 1) => Math.hypot(to[i].x - from[i].x, to[i].y - from[i].y) >= PINCH_MOVED
  if (!moved(0) || !moved(1)) return 0
  const before = Math.hypot(from[0].x - from[1].x, from[0].y - from[1].y)
  const now = Math.hypot(to[0].x - to[1].x, to[0].y - to[1].y)
  return now >= before * PINCH_RATIO ? -1 : now * PINCH_RATIO <= before ? 1 : 0
}
