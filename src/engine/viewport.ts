/** Screens whose short side is below this (CSS px) are treated as phones. */
const PHONE_SHORT_SIDE = 600
/** World pixels a phone shows across its short side, so sprites stay big enough to read. */
const PHONE_WORLD_SHORT = 220
/** World pixels shown across the short side on tablets and desktops. */
const WORLD_SHORT = 300

/**
 * Upscale factor in *device* pixels per world pixel. Keeping it an integer in
 * device pixels keeps every world pixel crisp, even at fractional DPRs (2.625…).
 * Desktop keeps the classic "integer CSS scale, ~300px tall world" behaviour.
 */
export const deviceScale = (cssW: number, cssH: number, dpr: number) => {
  const short = Math.min(cssW, cssH)
  if (short < PHONE_SHORT_SIDE) return Math.max(2, Math.round((short * dpr) / PHONE_WORLD_SHORT))
  return Math.max(2, Math.round(Math.max(2, Math.round(short / WORLD_SHORT)) * dpr))
}

/**
 * A side of the internal canvas: at least 1 px, as webviews can report a 0 (or negative) viewport while they lay out.
 * A real side is rounded up to even: the camera sits at `player - side / 2`, so on an odd side it holds a half pixel the
 * player doesn't, the two round apart, and a walking Pokémon shakes by a pixel against the screen.
 */
const side = (px: number) => {
  if (!(px >= 1)) return 1
  const whole = Math.ceil(px)
  return whole + (whole % 2)
}

/** Below this (CSS px) a side is no screen the game could be on: even a landscape phone under its keyboard keeps more. */
const MIN_VIEWPORT = 100

/** A viewport's size in CSS px: `window.visualViewport` is one. */
export type ViewportSize = { width: number; height: number }

const onScreen = (s: ViewportSize) => s.width >= MIN_VIEWPORT && s.height >= MIN_VIEWPORT

/**
 * The size to fit the game to: the visual viewport (it follows iOS' toolbars and the keyboard), or
 * the layout viewport when that one reads as no screen at all, or null when neither does and the
 * game should stay as it is. A page coming back from the background can read 0: fitted, the canvas
 * shrank to under a pixel, so the world was gone and no touch could land on it, and nothing said so
 * once the browser's numbers came right, which it does without a `resize`.
 */
export const pickViewport = <V extends ViewportSize>(visual: V | null, layout: ViewportSize): V | ViewportSize | null =>
  visual && onScreen(visual) ? visual : onScreen(layout) ? layout : null

/** Internal canvas size (world px) and the CSS px per world px for a viewport. */
export const fitView = (cssW: number, cssH: number, dpr: number) => {
  const scale = deviceScale(cssW, cssH, dpr)
  return {
    w: side((cssW * dpr) / scale),
    h: side((cssH * dpr) / scale),
    cssScale: scale / dpr,
  }
}
