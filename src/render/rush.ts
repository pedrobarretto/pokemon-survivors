import { blitEllipse, blitRing, context2d, createCanvas, lazy } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { RUSH } from '../data/rush'
import { rushGate, type RushState } from '../game/rush'
import type { Game } from '../game/types'
import { rgb } from './rift'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * Hoopa's Rings on screen (`game/rush.ts`): Hoopa's stage, a round slab of
 * desert sand floating in a starry night (its own room, `RushState.room`),
 * rimmed in gold and inlaid with ring portals; the golden circle the rush is
 * fought in, Hoopa's ring portals standing round it, the big ring at its north
 * opening on each legend, and Hoopa floating behind it until the last ring,
 * when it comes through itself.
 */

const GOLD = '#f8d048'
const DEEP_GOLD = '#a87010'
const VOID = '#28103c'

/** The stage's radius past the rings' circle (the standing rings sit on it), and how deep its sandstone side shows under its south rim, px. */
const STAGE = { margin: 28, cliff: 22, rim: 8 } as const
const STAGE_R = RUSH.arena + STAGE.margin

/** The ring portals inlaid in the sand, as angles round the middle (none at the north, where the gate stands), and how far out. */
const INLAYS = { at: [-30, 30, 90, 150, -150].map((deg) => (deg * Math.PI) / 180), r: 100, rx: 6, ry: 8 } as const

/** The sand's colors: base, its grain, the ripples' crests and troughs, the rim's shadow on it, the sigil's gold and its dark line. */
const SAND = { base: '#c49c64', dark: '#b48a54', light: '#d6b07a', crest: '#e0be84', trough: '#9a7442', shade: '#a8804c', pebble: '#8a6a48', gold: '#c8962c', line: '#8a6020' } as const
/** The rim's gold blocks (lit, mid, shaded), its mortar, its inner lip and its outline. */
const RIM = { lit: '#f0c858', mid: '#d8a838', shaded: '#b08020', mortar: '#6a4210', lip: '#8a5a14', outline: '#4a2a08' } as const
/** The sandstone side under the south rim, top to bottom. */
const STRATA = ['#9a6434', '#845430', '#6e4428', '#583420', '#442818', '#34200f'] as const
/** The night around the stage. */
const NIGHT = '#0b0720'

/** Which color the stage has at (x, y) from its middle, or null (open night). */
const stageColor = (x: number, y: number): string | null => {
  const d = Math.hypot(x, y)
  if (d <= STAGE_R) {
    const edge = STAGE_R - d
    if (edge < STAGE.rim) {
      if (edge < 1.2) return RIM.outline
      if (edge > STAGE.rim - 1.2) return RIM.lip
      const a = Math.atan2(y, x)
      const seg = (((a / TAU) * 48) % 1 + 1) % 1
      if (seg < 0.07 || Math.abs(edge - 4.6) < 0.5) return RIM.mortar
      const light = (-y / d) * 0.6 - (x / d) * 0.3
      return light > 0.2 ? RIM.lit : light > -0.25 ? RIM.mid : RIM.shaded
    }
    if (edge < STAGE.rim + 3 && (y < 0 || x < 0)) return SAND.shade
    for (const at of INLAYS.at) {
      const ix = Math.cos(at) * INLAYS.r
      const iy = Math.sin(at) * INLAYS.r
      const k = ((x - ix) / INLAYS.rx) ** 2 + ((y - iy) / INLAYS.ry) ** 2
      if (k <= 1.6) return k > 1.15 ? (y - iy < 0 ? RIM.lit : RIM.mid) : k > 0.95 ? RIM.outline : k > 0.5 ? '#2a1040' : '#3c1a58'
    }
    const sigil = Math.abs(d - 48)
    if (sigil < 1.5 || Math.abs(d - 22) < 1) return SAND.gold
    if (sigil < 2.5) return SAND.line
    const v = y + 5 * Math.sin(x / 19) + 2 * Math.sin(x / 7 + y / 31)
    const m = ((v % 9) + 9) % 9
    if (m < 2 && hash2(Math.floor(x / 10), Math.floor(v / 9), 3) < 0.72) return m < 1 ? SAND.crest : SAND.trough
    const grain = hash2(Math.floor(x), Math.floor(y), 1)
    return grain > 0.997 ? SAND.pebble : grain < 0.08 ? SAND.dark : grain > 0.94 ? SAND.light : SAND.base
  }
  // Under the south rim: the slab's sandstone side, its underside broken.
  if (y <= 0 || Math.abs(x) >= STAGE_R) return null
  const below = y - Math.sqrt(STAGE_R * STAGE_R - x * x)
  if (below <= 0 || below > STAGE.cliff - 4 * hash2(Math.floor(x / 3), 0, 9)) return null
  const band = Math.min(STRATA.length - 1, Math.floor((below / STAGE.cliff) * STRATA.length))
  return hash2(Math.floor(x / 5), band, 7) < 0.14 ? STRATA[Math.min(STRATA.length - 1, band + 1)]! : STRATA[band]!
}

/** Hoopa's stage, painted once: the sand, its gold rim and inlays, its sandstone side. Its middle is at (`STAGE_R` + 1, `STAGE_R` + 1). */
const STAGE_ART = lazy(() => {
  const w = STAGE_R * 2 + 3
  const h = STAGE_R * 2 + STAGE.cliff + 3
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(w, h)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const color = stageColor(px - STAGE_R - 1 + 0.5, py - STAGE_R - 1 + 0.5)
      if (!color) continue
      const [r, g, b] = rgb(color)
      const i = (py * w + px) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
})

/** The night's stars, a tile of them; a few bright ones, most dim, and faint haze. */
const STAR_TILE = 160
const STARS = lazy(() => {
  const canvas = createCanvas(STAR_TILE, STAR_TILE)
  const ctx = context2d(canvas)
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = '#140c2e'
    const x = Math.floor(hash2(i, 1, 41) * STAR_TILE)
    const y = Math.floor(hash2(i, 2, 41) * STAR_TILE)
    for (let k = 0; k < 18; k++) ctx.fillRect((x + Math.floor(hash2(i, k, 42) * 18)) % STAR_TILE, (y + Math.floor(hash2(i, k, 43) * 10)) % STAR_TILE, 2, 1)
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash2(i, 3, 41) * STAR_TILE)
    const y = Math.floor(hash2(i, 4, 41) * STAR_TILE)
    const kind = hash2(i, 5, 41)
    ctx.fillStyle = kind < 0.7 ? '#4c4478' : kind < 0.92 ? '#9c9ccc' : '#f8f0d0'
    ctx.fillRect(x, y, 1, 1)
    if (kind > 0.97) {
      ctx.fillStyle = '#8c84b8'
      ctx.fillRect(x - 1, y, 1, 1)
      ctx.fillRect(x + 1, y, 1, 1)
      ctx.fillRect(x, y - 1, 1, 1)
      ctx.fillRect(x, y + 1, 1, 1)
    }
  }
  return canvas
})

/** Far off in the night, Hoopa's other rings drift: a tile with one, dim with distance. */
const FAR_TILE = 260
const FAR_RINGS = lazy(() => {
  const canvas = createCanvas(FAR_TILE, FAR_TILE)
  const ctx = context2d(canvas)
  const [x, y] = [70, 90]
  blitEllipse(ctx, 13, 17, '#5a3e14', x, y)
  blitEllipse(ctx, 12, 16, '#7a5820', x, y)
  blitEllipse(ctx, 10, 14, '#150b2c', x, y)
  blitEllipse(ctx, 9, 13, '#1d1038', x, y)
  ctx.fillStyle = '#a07c30'
  ctx.fillRect(x - 9, y - 12, 2, 2)
  blitEllipse(ctx, 6, 8, '#4a3410', 200, 210)
  blitEllipse(ctx, 5, 7, '#140a28', 200, 210)
  return canvas
})

/** Fills the view with a tile scrolled at `k` of the camera's pace (parallax). */
const tileView = (ctx: Ctx, tile: HTMLCanvasElement, size: number, camX: number, camY: number, w: number, h: number, k: number) => {
  const ox = -((((Math.round(camX * k) % size) + size) % size))
  const oy = -((((Math.round(camY * k) % size) + size) % size))
  for (let y = oy; y < h; y += size) for (let x = ox; x < w; x += size) ctx.drawImage(tile, x, y)
}

/**
 * The rush's floor, under everything (screen space): the night, its far rings
 * and its stars sliding behind, a few stars twinkling, and Hoopa's stage.
 */
export const drawRushFloor = (ctx: Ctx, g: Game, camX: number, camY: number, w: number, h: number, t: number) => {
  const r = g.rush
  if (!r) return
  ctx.fillStyle = NIGHT
  ctx.fillRect(0, 0, w, h)
  tileView(ctx, FAR_RINGS(), FAR_TILE, camX, camY, w, h, 0.15)
  tileView(ctx, STARS(), STAR_TILE, camX, camY, w, h, 0.35)
  for (let i = 0; i < 14; i++) {
    if (Math.floor(t * 2 + hash2(i, 1, 51) * 7) % 5 !== 0) continue
    const x = Math.floor(hash2(i, 2, 51) * w)
    const y = Math.floor(hash2(i, 3, 51) * h)
    ctx.fillStyle = '#fff8e0'
    ctx.fillRect(x, y, 1, 1)
    ctx.fillStyle = '#b8b0e0'
    ctx.fillRect(x - 1, y, 1, 1)
    ctx.fillRect(x + 1, y, 1, 1)
    ctx.fillRect(x, y - 1, 1, 1)
    ctx.fillRect(x, y + 1, 1, 1)
  }
  ctx.drawImage(STAGE_ART(), Math.round(r.room.x) - STAGE_R - 1 - camX, Math.round(r.room.y) - STAGE_R - 1 - camY)
}

/** One of Hoopa's rings standing on the ground: a golden hoop around a dark portal, its glint running round it. */
const standingRing = (ctx: Ctx, x: number, y: number, size: number, t: number, open = 1) => {
  const rx = Math.max(2, Math.round(size * 0.6 * open))
  const ry = Math.max(2, Math.round(size * open))
  const cy = y - ry - 2
  blitEllipse(ctx, rx + 3, 3, 'rgba(16,8,24,0.35)', x, y)
  blitEllipse(ctx, rx + 2, ry + 2, DEEP_GOLD, x, cy)
  blitEllipse(ctx, rx, ry, GOLD, x, cy)
  blitEllipse(ctx, Math.max(1, rx - 3), Math.max(1, ry - 3), VOID, x, cy)
  const a = t * 3 + x * 0.01
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(Math.round(x + Math.cos(a) * (rx - 1)), Math.round(cy + Math.sin(a) * (ry - 1)), 2, 2)
  // Motes drifting into the portal.
  ctx.fillStyle = '#c890f0'
  for (let i = 0; i < 3; i++) {
    const q = (t * 0.7 + i / 3 + x * 0.003) % 1
    ctx.fillRect(Math.round(x + Math.cos(i * 2.1 + t) * (rx - 3) * (1 - q)), Math.round(cy + Math.sin(i * 2.1 + t) * (ry - 3) * (1 - q)), 1, 1)
  }
}

/** Ground layer: the rush's circle and the rings standing round it, the gate's ring last (behind whoever steps out of it). */
export const drawRushGround = (ctx: Ctx, g: Game, t: number) => {
  const r = g.rush
  if (!r) return
  const { x, y } = r.home
  blitRing(ctx, RUSH.arena + 2, 1, DEEP_GOLD, x, y)
  blitRing(ctx, RUSH.arena, 2, GOLD, x, y)
  ctx.globalAlpha = 0.3
  blitRing(ctx, RUSH.arena - 4, 3, '#f8e8a8', x, y)
  ctx.globalAlpha = 1
  // Seven rings round the circle (the north spot is the gate's).
  for (let i = 1; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * TAU
    standingRing(ctx, Math.round(x + Math.cos(a) * (RUSH.arena + 8)), Math.round(y + Math.sin(a) * (RUSH.arena + 8)), 10, t)
  }
  const gate = rushGate(r)
  const opening = r.stage === 'gate' ? Math.min(1, 1 - r.clock / RUSH.gate + 0.15) : r.stage === 'fight' ? 1 : 0.55
  standingRing(ctx, Math.round(gate.x), Math.round(gate.y - 6), 22, t, opening)
  drawHost(ctx, r, gate, t)
}

/**
 * Hoopa floating behind the gate, watching, until it comes through on the
 * last ring: drawn with the ground, so the ring's legend (a Palkia stands
 * tall) is never under it.
 */
const drawHost = (ctx: Ctx, r: RushState, gate: { x: number; y: number }, t: number) => {
  if (r.lineup[r.ring] === 'hoopa' || r.stage === 'cleared') return
  const bob = Math.round(Math.sin(t * 2.4) * 2)
  drawPokemon(ctx, sprites(ENEMIES.hoopa.dex), 'Idle', 0, t, Math.round(gate.x + 40), Math.round(gate.y - 44 + bob))
}
