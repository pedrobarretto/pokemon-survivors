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

/** Internal canvas size (world px) and the CSS px per world px for a viewport. */
export const fitView = (cssW: number, cssH: number, dpr: number) => {
  const scale = deviceScale(cssW, cssH, dpr)
  return {
    w: side((cssW * dpr) / scale),
    h: side((cssH * dpr) / scale),
    cssScale: scale / dpr,
  }
}
