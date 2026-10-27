import { context2d, createCanvas, ellipse, fromStrings, onCanvasReset, type PixelSprite, drawPacked } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { WeatherId } from '../data/biomes'
import { WEATHER } from '../data/weather'
import type { Game } from '../game/types'
import { art, lazy, toIconUrl } from './art'
import { roomOf } from '../game/room'
import { localPlayer } from '../game/players'
import { detail } from './quality'

/**
 * Weather overlays, drawn in screen space over the world. Every particle is a
 * pure function of its index and the clock (no state, no allocation), anchored
 * to the world so it scrolls with the camera, and snapped to whole pixels.
 */

type Ctx = CanvasRenderingContext2D

/** Seconds a weather takes to roll in (and the previous one to roll out). */
const FADE = 2.5
/** Reference view area for particle counts: phones in portrait get fewer drops. */
const AREA = 480 * 270

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Particles for a view; drawing lean (`render/quality.ts`), a quarter of them. */
const count = (w: number, h: number, base: number) => Math.round((base * w * h * (detail.lean ? 0.25 : 1)) / AREA)

const DROP = lazy(() => fromStrings(['..1', '.1.', '.1.', '1..'], { 1: '#c8dcff' }))
const SPLASH = lazy(() => [fromStrings(['1.1'], { 1: '#c8dcff' }), fromStrings(['1...1', '.....'], { 1: '#a8c0f0' })])
const STREAK = lazy(() => [fromStrings(['1112'], { 1: '#e8c888', 2: '#fff0c0' }), fromStrings(['111111'], { 1: '#c8a060' })])
const FLAKE = lazy(() => [
  fromStrings(['1'], { 1: '#ffffff' }),
  fromStrings(['11', '12'], { 1: '#ffffff', 2: '#b8d0f0' }),
  fromStrings(['.1.', '121', '.1.'], { 1: '#c8e0ff', 2: '#ffffff' }),
])
const MOTE = lazy(() => fromStrings(['1'], { 1: '#fff4c0' }))

const rain = (ctx: Ctx, w: number, h: number, camX: number, camY: number, t: number) => {
  ctx.fillStyle = 'rgba(32,48,96,0.2)'
  ctx.fillRect(0, 0, w, h)
  const drop = DROP()
  const n = count(w, h, 110)
  for (let i = 0; i < n; i++) {
    const speed = 220 + hash2(i, 3, 7) * 80
    const x = mod(hash2(i, 1, 7) * 2048 - camX - t * speed * 0.3, w + 16) - 8
    const y = mod(hash2(i, 2, 7) * 2048 - camY + t * speed, h + 16) - 8
    ctx.drawImage(drop, Math.round(x), Math.round(y))
  }
  // Splashes pop at fixed spots on the ground, each on its own beat.
  const [small, big] = SPLASH()
  const splashes = count(w, h, 40)
  for (let i = 0; i < splashes; i++) {
    const phase = mod(t * 2.2 + hash2(i, 4, 7), 1)
    if (phase > 0.16) continue
    const x = mod(hash2(i, 5, 7) * 4096 + Math.floor(t * 2.2 + hash2(i, 4, 7)) * 97 - camX, w)
    const y = mod(hash2(i, 6, 7) * 4096 + Math.floor(t * 2.2 + hash2(i, 4, 7)) * 61 - camY, h)
    ctx.drawImage(phase < 0.08 ? small! : big!, Math.round(x), Math.round(y))
  }
}

const snow = (ctx: Ctx, w: number, h: number, camX: number, camY: number, t: number) => {
  // An overcast grey-blue sky, so the flakes still show over snowfields.
  ctx.fillStyle = 'rgba(72,92,136,0.2)'
  ctx.fillRect(0, 0, w, h)
  const flakes = FLAKE()
  const n = count(w, h, 90)
  for (let i = 0; i < n; i++) {
    const r = hash2(i, 3, 11)
    const fall = 18 + r * 26
    const x = mod(hash2(i, 1, 11) * 2048 - camX + Math.sin(t * (0.8 + r) + i) * 7 - t * 6, w + 8) - 4
    const y = mod(hash2(i, 2, 11) * 2048 - camY + t * fall, h + 8) - 4
    ctx.drawImage(flakes[r < 0.55 ? 0 : r < 0.92 ? 1 : 2]!, Math.round(x), Math.round(y))
  }
}

const sand = (ctx: Ctx, w: number, h: number, camX: number, camY: number, t: number) => {
  ctx.fillStyle = 'rgba(184,128,56,0.24)'
  ctx.fillRect(0, 0, w, h)
  const [bright, dull] = STREAK()
  const n = count(w, h, 120)
  for (let i = 0; i < n; i++) {
    const r = hash2(i, 3, 13)
    const speed = 160 + r * 140
    const x = mod(hash2(i, 1, 13) * 2048 - camX + t * speed, w + 16) - 8
    const y = mod(hash2(i, 2, 13) * 2048 - camY + t * 24 + Math.sin(t * 3 + i) * 3, h + 8) - 4
    ctx.drawImage(r < 0.4 ? bright! : dull!, Math.round(x), Math.round(y))
  }
}

/** Stepped light shafts from the top-left, built once per view size. */
const sunRays = (() => {
  let cache: PixelSprite | null = null
  onCanvasReset(
    () => (cache = null),
    () => cache,
  )
  return (w: number, h: number) => {
    if (cache && cache.width === w && cache.height === h) return cache
    const c = createCanvas(w, h)
    const rctx = context2d(c)
    rctx.fillStyle = 'rgba(255,244,200,0.16)'
    for (const [start, width] of [[0.08, 26], [0.3, 14], [0.52, 34], [0.8, 12]] as const) {
      // Rows two pixels tall slide right as they go down: a hard-edged slanted band.
      for (let y = 0; y < h; y += 2) rctx.fillRect(Math.round(start * w + y * 0.55 - h * 0.2), y, width, 2)
    }
    return (cache = c)
  }
})()

const sun = (ctx: Ctx, w: number, h: number, camX: number, camY: number, t: number) => {
  ctx.fillStyle = 'rgba(255,196,88,0.14)'
  ctx.fillRect(0, 0, w, h)
  ctx.save()
  ctx.globalAlpha *= 0.75 + Math.sin(t * 0.7) * 0.25
  ctx.drawImage(sunRays(w, h), 0, 0)
  ctx.restore()
  // Warm motes drifting up through the light.
  const mote = MOTE()
  const n = count(w, h, 24)
  for (let i = 0; i < n; i++) {
    const x = mod(hash2(i, 1, 17) * 2048 - camX + Math.sin(t * 0.9 + i) * 5, w)
    const y = mod(hash2(i, 2, 17) * 2048 - camY - t * (8 + hash2(i, 3, 17) * 8), h)
    if (mod(t * 0.6 + hash2(i, 4, 17), 1) < 0.7) ctx.drawImage(mote, Math.round(x), Math.round(y))
  }
}

/* ---------------- Fog ---------------- */

/**
 * The Fog setting (Settings → Game). `normal` draws the fog as designed; `light`
 * widens the clear circle and thins the veil, for eyes that tire of squinting
 * through it; `off` drops the veil and keeps only the faint haze and wisps.
 * Pure presentation: the simulation never reads it.
 */
export const FOG_MODES = ['normal', 'light', 'off'] as const

export type FogMode = (typeof FOG_MODES)[number]

/** The veil per mode: its clear circle (a fraction of the view's shorter side) and its opacity at the edge of the view. */
const FOG_VEIL = {
  normal: { sight: WEATHER.fog.sight ?? 0.42, max: 0.86 },
  light: { sight: 0.62, max: 0.5 },
} as const satisfies Record<Exclude<FogMode, 'off'>, { sight: number; max: number }>

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const FOG_RGB = [200, 194, 216] as const
const FOG_LEVELS = 4

/**
 * A view-sized veil twice as big as the screen with a clear hole in the middle.
 * Opacity comes in a few flat bands with a Bayer-dithered edge between them,
 * the GBA way to do a soft gradient. Built once per view size.
 */
const fogVeil = (() => {
  let cache: { w: number; h: number; mode: FogMode; canvas: PixelSprite } | null = null
  onCanvasReset(
    () => (cache = null),
    () => cache,
  )
  const ready = (w: number, h: number, mode: Exclude<FogMode, 'off'>) => cache !== null && cache.w === w && cache.h === h && cache.mode === mode
  const veil = (w: number, h: number, mode: Exclude<FogMode, 'off'>) => {
    if (cache && ready(w, h, mode)) return cache.canvas
    const { sight, max } = FOG_VEIL[mode]
    const cw = w * 2
    const ch = h * 2
    const canvas = createCanvas(cw, ch)
    const vctx = context2d(canvas)
    const img = vctx.createImageData(cw, ch)
    const radius = Math.min(w, h) * sight
    // The distance only depends on how far a pixel is from the center on each axis: one quarter's worth, mirrored.
    const dist = new Float64Array((w + 1) * (h + 1))
    for (let dy = 0; dy <= h; dy++) for (let dx = 0; dx <= w; dx++) dist[dy * (w + 1) + dx] = Math.hypot(dx, dy * 1.25) / radius
    // Each band's opacity, worked out once.
    const alphas = Array.from({ length: FOG_LEVELS + 2 }, (_, band) => Math.round((Math.min(band, FOG_LEVELS) / FOG_LEVELS) * max * 255))
    const data = img.data
    const [r, gr, b] = FOG_RGB
    for (let y = 0; y < ch; y++) {
      const row = Math.abs(y - h) * (w + 1)
      const dither = (y % 4) * 4
      for (let x = 0; x < cw; x++) {
        const d = dist[row + Math.abs(x - w)]!
        const k = Math.min(1, Math.max(0, (d - 0.55) / 0.75))
        const level = k * FOG_LEVELS
        const band = Math.floor(level) + ((level % 1) * 16 > BAYER[dither + (x % 4)]! ? 1 : 0)
        const i = (y * cw + x) * 4
        data[i] = r
        data[i + 1] = gr
        data[i + 2] = b
        data[i + 3] = alphas[band]!
      }
    }
    vctx.putImageData(img, 0, 0)
    return (cache = { w, h, mode, canvas }).canvas
  }
  /** Lets the veil go (2 MB on a phone) until fog can roll in again. */
  const drop = () => {
    if (cache) cache.canvas.width = cache.canvas.height = 0
    cache = null
  }
  return Object.assign(veil, { ready, drop })
})()

/** Frees the fog veil when no fog is in the air nor can come (`warmScenery`); the next fog builds it again. */
export const dropFog = fogVeil.drop

/** Builds the fog veil for a view and mode ahead of time (it takes longer than a frame). True if it built it. */
export const warmFog = (w: number, h: number, mode: FogMode) => {
  if (mode === 'off') {
    dropFog()
    return false
  }
  if (fogVeil.ready(w, h, mode)) return false
  fogVeil(w, h, mode)
  return true
}

const fog = (ctx: Ctx, w: number, h: number, camX: number, camY: number, t: number, px: number, py: number, mode: FogMode) => {
  ctx.fillStyle = 'rgba(184,176,208,0.12)'
  ctx.fillRect(0, 0, w, h)
  // Wisps drifting across the clearing.
  ctx.save()
  ctx.globalAlpha *= 0.22
  const n = count(w, h, 10)
  for (let i = 0; i < n; i++) {
    const rx = 18 + Math.floor(hash2(i, 3, 19) * 22)
    const x = mod(hash2(i, 1, 19) * 2048 - camX + t * (6 + hash2(i, 4, 19) * 8), w + rx * 4) - rx * 2
    const y = mod(hash2(i, 2, 19) * 2048 - camY, h + 20) - 10
    drawPacked(ctx, ellipse(rx, Math.max(3, Math.round(rx * 0.22)), '#e8e4f0'), Math.round(x - rx), Math.round(y))
  }
  ctx.restore()
  if (mode !== 'off') ctx.drawImage(fogVeil(w, h, mode), Math.round(px - w), Math.round(py - h))
}

const DRAW: Record<Exclude<WeatherId, 'clear' | 'fog'>, typeof rain> = { rain, snow, sand, sun }

const drawOne = (ctx: Ctx, id: WeatherId, alpha: number, g: Game, camX: number, camY: number, t: number, fogMode: FogMode) => {
  if (id === 'clear' || alpha <= 0) return
  const { w, h } = g.view
  ctx.save()
  ctx.globalAlpha = alpha
  if (id === 'fog') fog(ctx, w, h, camX, camY, t, localPlayer(g).x - camX, localPlayer(g).y - 10 - camY, fogMode)
  else DRAW[id](ctx, w, h, camX, camY, t)
  ctx.restore()
}

/** Weather overlay for the frame, in screen space. The outgoing weather fades as the new one rolls in. */
export const drawWeather = (ctx: Ctx, g: Game, camX: number, camY: number, t: number, fogMode: FogMode) => {
  if (roomOf(g)) return
  const k = Math.min(1, (g.time - g.weather.since) / FADE)
  drawOne(ctx, g.weather.prev, 1 - k, g, camX, camY, t, fogMode)
  drawOne(ctx, g.weather.id, k, g, camX, camY, t, fogMode)
}

/* ---------------- Icons ---------------- */

const ICONS: Record<Exclude<WeatherId, 'clear'>, readonly [readonly string[], Record<string, string>]> = {
  sun: [
    ['....1....', '.1.....1.', '...222...', '..23332..', '1.23432.1', '..23332..', '...222...', '.1.....1.', '....1....'],
    { 1: '#f8d030', 2: '#e07818', 3: '#f8c830', 4: '#fff8c0' },
  ],
  rain: [
    ['...1111...', '.11222211.', '1222222221', '1333333331', '.11111111.', '.4..4..4..', '4..4..4...'],
    { 1: '#506080', 2: '#f0f4ff', 3: '#c0c8e0', 4: '#4888f0' },
  ],
  sand: [
    ['..11111111', '2.........', '11111111..', '.........2', '..11111111', '2...2.....'],
    { 1: '#d8a048', 2: '#f8e0a0' },
  ],
  snow: [
    ['....1....', '.1..1..1.', '..1.1.1..', '...121...', '111222111', '...121...', '..1.1.1..', '.1..1..1.', '....1....'],
    { 1: '#a8d8f8', 2: '#ffffff' },
  ],
  fog: [
    ['.11111111.', '..........', '11111111..', '..........', '..11111111', '..........', '.1111111..'],
    { 1: '#d8d0e8' },
  ],
}

/** HUD/toast icon of a weather (clear has none). */
export const weatherIcon = (id: Exclude<WeatherId, 'clear'>) =>
  toIconUrl(`weather:${id}`, () => art(ICONS[id][0], ICONS[id][1], '#282030'))
