/**
 * The quality governor. When a phone struggles (frames running long or missing
 * vsync, or a device with very little memory), the renderer goes lean and sheds
 * cosmetic work: particles are capped, the regular horde drops its shadows,
 * damage numbers show reduced, weather draws a quarter of its particles and
 * the biggest legendary effects draw thinner.
 * Full detail comes back once frames stay calm for a while. Presentation only:
 * the simulation never reads it, so replays and the ranking are untouched.
 */

/**
 * What the renderers read each frame. `safe`: the device's safe mode
 * (`safeMode.ts`, after a crash), which pins lean and keeps fewer silhouettes.
 */
export const detail = { lean: false, safe: false }

export type Governor = {
  /** Share of recent frames that struggled (an average over about a second). */
  struggle: number
  /** Frames in a row calm enough to bring full detail back, and how many it takes (doubling each time lean comes back). */
  calm: number
  calmNeeded: number
  /** The display's frame time as seen lately (ms): the shortest gap, slowly forgotten. */
  best: number
  /** JS work (ms) a frame may take before it counts as struggling. */
  budget: number
  lean: boolean
}

/** Share of struggling frames that turns lean on, and the one under which it may turn off. */
const ENTER = 0.35
const EXIT = 0.05
/** Calm frames in a row (about 5 s) before full detail first comes back; at most 8 times that. */
const CALM_FRAMES = 300
/** Weight of the newest frame in `struggle`. */
const SMOOTH = 1 / 60
/** A gap this many times the display's frame time missed a vsync. */
const MISSED = 1.4
/** Gaps past this (ms) are a pause, a tab switch or a hitch, not load. */
const PAUSE = 250

/**
 * A governor for a device with `memory` GB (`navigator.deviceMemory`, when the browser tells).
 * 2 GB or less starts lean; 4 GB or less counts a frame as struggling sooner.
 */
export const createGovernor = (memory?: number): Governor => ({
  struggle: 0,
  calm: 0,
  calmNeeded: CALM_FRAMES,
  best: 1000 / 60,
  budget: memory !== undefined && memory <= 4 ? 8 : 11,
  lean: memory !== undefined && memory <= 2,
})

/**
 * Feeds one drawn frame: `work` ms of JS (simulation, render, HUD) and `gap` ms since the
 * frame drawn before it (NaN when the one before wasn't drawn). Returns whether to draw lean.
 */
export const observeFrame = (gov: Governor, work: number, gap: number) => {
  const timed = gap > 0 && gap < PAUSE
  if (timed) gov.best = Math.min(gap, gov.best + 0.02)
  const struggling = work > gov.budget || (timed && gap > gov.best * MISSED)
  gov.struggle += ((struggling ? 1 : 0) - gov.struggle) * SMOOTH
  if (!gov.lean) {
    if (gov.struggle > ENTER) {
      gov.lean = true
      gov.calm = 0
    }
  } else {
    gov.calm = gov.struggle < EXIT ? gov.calm + 1 : 0
    if (gov.calm >= gov.calmNeeded) {
      gov.lean = false
      // If full detail brings the struggle back, the next try waits longer: no flickering between the two.
      gov.calmNeeded = Math.min(gov.calmNeeded * 2, CALM_FRAMES * 8)
    }
  }
  return gov.lean
}
