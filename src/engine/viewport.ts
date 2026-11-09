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

/** A side of the internal canvas: at least 1 px, as webviews can report a 0 (or negative) viewport while they lay out. */
const side = (px: number) => (px >= 1 ? Math.ceil(px) : 1)

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

/**
 * How far the camera zooms out (`zoomScales`): at most `farthest` times the
 * resting view, and never past `maxShort` world px across the short side, as
 * spawns and despawns follow the view (`replay.ts`, `VIEW_LIMIT`): a zoom keeps
 * a run inside what big monitors already played.
 */
export const ZOOM = { farthest: 1.7, maxShort: 500, levels: 3 } as const

/**
 * The upscale factors a screen can zoom through, closest first (the first is
 * always `deviceScale`). Whole device px only, so the zoom stays pixel-perfect:
 * a 1080p monitor has few, a phone's dense screen more, up to `ZOOM.levels`.
 * `reach` caps the view's half diagonal (co-op simulates a fixed view, and past
 * its spawn ring the horde would pop in on screen).
 */
export const zoomScales = (cssW: number, cssH: number, dpr: number, reach = Infinity): readonly number[] => {
  const rest = deviceScale(cssW, cssH, dpr)
  const fits = (s: number) => rest / s <= ZOOM.farthest && (Math.min(cssW, cssH) * dpr) / s <= ZOOM.maxShort && Math.hypot(cssW * dpr, cssH * dpr) / s / 2 <= reach
  const scales = [rest]
  for (let s = rest - 1; s >= 2 && fits(s); s--) scales.push(s)
  return scales.length <= ZOOM.levels ? scales : [scales[0]!, scales[(scales.length - 1) >> 1]!, scales[scales.length - 1]!]
}

/** Internal canvas size (world px) and the CSS px per world px for a viewport, at `scale` device px per world px (a zoom's, `zoomScales`). */
export const fitView = (cssW: number, cssH: number, dpr: number, scale = deviceScale(cssW, cssH, dpr)) => {
  return {
    w: side((cssW * dpr) / scale),
    h: side((cssH * dpr) / scale),
    cssScale: scale / dpr,
  }
}
