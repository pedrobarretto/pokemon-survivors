import { blitCentered, blitEllipse, blitRotated, canvasCache, context2d, createCanvas, lazy, onCanvasReset, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import type { ArenaShape, FloorPlan, Pt } from '../data/arenas'
import { CAVE, GRAVEYARD, PLACE, PLACES, SKY, type PlaceId, type WingId } from '../data/places'
import { fits } from '../game/arenaFloor'
import { caveLight } from '../game/cave'
import type { PlaceEntrance, PlaceInterior, PlaceInteriorOf } from '../game/place'
import type { Game } from '../game/types'
import { art, toIconUrl } from './art'
import { PLACE_PIECES } from './placePieces'
import { dashedRing } from './strokes'
import { bodyOf } from '../data/bodies'
import { ENEMIES, type EnemyDef } from '../data/enemies'

type Ctx = CanvasRenderingContext2D

/**
 * Places on screen: the entrances' moving parts on the map (the updraft's
 * wind, the graveyard's fog, the door's charge ring), the arrow to an
 * entrance off screen, and the insides: the dungeon's floors and its dark,
 * the graveyard under the moon, the sky above the clouds and its wings.
 * The static scenery is sculpted in `placePieces.ts`.
 */

const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
const bayer = (x: number, y: number) => (BAYER[((y & 3) << 2) | (x & 3)]! + 0.5) / 16

/* ---------------- Floor bakes ---------------- */

type Baked = { canvas: HTMLCanvasElement; x: number; y: number }

/** Which pixels of the box around `floor` (plus `margin`) are floor, in room px. */
const rasterize = (floor: readonly ArenaShape[], margin: number) => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of floor) {
    const box = s.kind === 'circle' ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] : [Math.min(...s.pts.map((p) => p[0])), Math.min(...s.pts.map((p) => p[1])), Math.max(...s.pts.map((p) => p[0])), Math.max(...s.pts.map((p) => p[1]))]
    x0 = Math.min(x0, box[0]!)
    y0 = Math.min(y0, box[1]!)
    x1 = Math.max(x1, box[2]!)
    y1 = Math.max(y1, box[3]!)
  }
  x0 = Math.floor(x0 - margin)
  y0 = Math.floor(y0 - margin)
  const w = Math.ceil(x1 + margin) - x0
  const h = Math.ceil(y1 + margin) - y0
  const mask = new Uint8Array(w * h)
  for (const s of floor) {
    const box = s.kind === 'circle' ? [s.x - s.r, s.y - s.r, s.x + s.r, s.y + s.r] : [Math.min(...s.pts.map((p) => p[0])), Math.min(...s.pts.map((p) => p[1])), Math.max(...s.pts.map((p) => p[0])), Math.max(...s.pts.map((p) => p[1]))]
    for (let py = Math.floor(box[1]! - y0); py <= Math.ceil(box[3]! - y0); py++) {
      for (let px = Math.floor(box[0]! - x0); px <= Math.ceil(box[2]! - x0); px++) {
        if (px < 0 || py < 0 || px >= w || py >= h || mask[py * w + px]) continue
        if (fits(s, px + x0 + 0.5, py + y0 + 0.5, 0)) mask[py * w + px] = 1
      }
    }
  }
  return { mask, w, h, x0, y0, at: (px: number, py: number) => px >= 0 && py >= 0 && px < w && py < h && mask[py * w + px] === 1 }
}

/** Paints `color(px, py)` over every pixel of a `w` × `h` canvas (null leaves it clear). */
const paint = (w: number, h: number, color: (px: number, py: number) => string | null) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(w, h)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const c = color(px, py)
      if (!c) continue
      const [r, g, b] = rgb(c)
      const i = (py * w + px) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

const CAVE_FACE = ['#7a6654', '#6a5848', '#5a4a3e', '#4c3e34', '#40342c', '#362c25', '#2e251f', '#271f1a', '#211a16'] as const
const FACE = CAVE_FACE.length
/**
 * How far a south wall's top reaches over the floor, in px: the walls stand
 * up toward the camera, so the floor's last px before one are hidden behind
 * its top. It matches where a body's feet stop (its radius, 6 to 8 px for most),
 * so walking into a south wall reads as touching it.
 */
const SOUTH_LIP = 6

/** The rock of a wall's top at (x, y). */
const wallTop = (x: number, y: number) => {
  const n = hash2(Math.floor(x / 6), Math.floor(y / 5), 3) * 0.6 + hash2(x, y, 4) * 0.4
  return n > 0.62 ? '#241c1a' : n < 0.25 ? '#140f0f' : '#1c1515'
}

/**
 * A dungeon floor: rock all around, its wall's face showing above each north
 * edge (strata and cracks, lit at the top), each south wall's top over the
 * floor's last px (`SOUTH_LIP`), and the floor itself, dirt with pebbles and a
 * few pits.
 */
const bakeCave = (floor: readonly ArenaShape[]): Baked => {
  const r = rasterize(floor, 40)
  const canvas = paint(r.w, r.h, (px, py) => {
    const x = px + r.x0
    const y = py + r.y0
    if (!r.at(px, py)) {
      // The wall's top, with a lit lip where it drops to the floor.
      if (r.at(px, py + 1)) return '#3a302a'
      return wallTop(x, y)
    }
    // A south wall's top over the floor, lit along its edge, and the floor darkening up to it.
    let south = 0
    for (let d = 1; d <= SOUTH_LIP + 2 && !south; d++) if (!r.at(px, py + d)) south = d
    if (south && south < SOUTH_LIP - 1) return wallTop(x, y)
    if (south === SOUTH_LIP - 1) return '#3a302a'
    if (south === SOUTH_LIP) return '#5a4a3e'
    if (south === SOUTH_LIP + 1) return '#2a221c'
    if (south === SOUTH_LIP + 2) return '#352c26'
    let k = 0
    for (let d = 1; d <= FACE && !k; d++) if (!r.at(px, py - d)) k = d
    if (k) {
      const crack = hash2(Math.floor(x / 3), 0, 9) < 0.12 && k > 2
      const strata = (k + Math.floor(hash2(Math.floor(x / 7), 1, 5) * 2)) % 3 === 0
      return crack ? '#1e1814' : CAVE_FACE[Math.min(FACE - 1, k - 1 + (strata ? 1 : 0))]!
    }
    if (!r.at(px - 1, py) || !r.at(px + 1, py) || !r.at(px, py + 1)) return '#2a221c'
    if (!r.at(px - 2, py) || !r.at(px + 2, py) || !r.at(px, py + 2)) return '#352c26'
    const h = hash2(x, y, 6)
    if (h < 0.018) return '#2a221e'
    if (h > 0.993) return '#8a7462'
    const n = hash2(Math.floor((x + 400) / 9), Math.floor((y + 400) / 7), 1) * 0.6 + hash2(Math.floor((x + 400) / 4), Math.floor((y + 400) / 3), 2) * 0.4
    return n > 0.6 ? '#504438' : n < 0.3 ? '#3e342e' : '#463b33'
  })
  return { canvas, x: r.x0, y: r.y0 }
}

/** The graveyard: dark grass, a gravel path from the gate to the keystone's plaza, a mound before each grave, an iron fence and fog past it. */
const bakeGraveyard = (floor: readonly ArenaShape[], graves: readonly Pt[], keystone: Pt): { floor: Baked; fence: Baked } => {
  const r = rasterize(floor, 24)
  const R = floor[0]?.kind === 'circle' ? floor[0].r : 160
  const mound = (x: number, y: number) => graves.some(([gx, gy]) => ((x - gx) / 7) ** 2 + ((y - gy - 7) / 4) ** 2 <= 1)
  const canvas = paint(r.w, r.h, (px, py) => {
    const x = px + r.x0
    const y = py + r.y0
    if (!r.at(px, py)) {
      const band = Math.sin(y / 9 + Math.sin(x / 23) * 1.4) > 0.55 && hash2(Math.floor(x / 5), Math.floor(y / 3), 8) < 0.6
      return band ? '#241e30' : hash2(x, y, 7) < 0.012 ? '#3a3248' : '#17121f'
    }
    const kd = Math.hypot(x - keystone[0], y - keystone[1])
    const path = (Math.abs(x) < 11 + Math.sin(y / 13) * 2 && y > keystone[1] + 30) || (kd > 26 && kd < 40)
    if (mound(x, y)) return hash2(x, y, 3) < 0.15 ? '#2c2420' : '#3a3028'
    if (path) {
      // Grey gravel.
      const h = hash2(x, y, 5)
      return h < 0.05 ? '#5e5c68' : h > 0.97 ? '#74727e' : hash2(Math.floor(x / 3), Math.floor(y / 2), 4) < 0.5 ? '#4a4854' : '#44424e'
    }
    const blade = hash2(x, Math.floor(y / 2), 2)
    if (blade < 0.06) return '#455a44'
    const n = hash2(Math.floor((x + 400) / 8), Math.floor((y + 400) / 6), 1)
    return n > 0.6 ? '#2e3c32' : n < 0.25 ? '#222c25' : '#28342b'
  })
  // The fence along the rim: the far half stands behind everything, the near half in front.
  const fenceAt = (front: boolean) => {
    const c = createCanvas(r.w, r.h + 20)
    const ctx = context2d(c)
    const steps = Math.round((R * TAU) / 5)
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU
      const fx = Math.round(Math.cos(a) * (R - 2) - r.x0)
      const fy = Math.round(Math.sin(a) * (R - 2) - r.y0)
      if (fy + r.y0 > 0 !== front) continue
      ctx.fillStyle = '#0c0a12'
      ctx.fillRect(fx - 1, fy - 13, 3, 14)
      ctx.fillStyle = i % 2 ? '#46404e' : '#3a3444'
      ctx.fillRect(fx, fy - 12, 1, 12)
      ctx.fillStyle = '#625a6c'
      ctx.fillRect(fx, fy - 13, 1, 1)
    }
    // Two rails, plotted all the way round.
    for (let i = 0; i < steps * 4; i++) {
      const a = (i / (steps * 4)) * TAU
      if (Math.sin(a) > 0 !== front) continue
      for (const h of [3, 9]) {
        ctx.fillStyle = '#2a2634'
        ctx.fillRect(Math.round(Math.cos(a) * (R - 2) - r.x0), Math.round(Math.sin(a) * (R - 2) - r.y0) - h, 1, 1)
      }
    }
    return c
  }
  const back = context2d(canvas)
  back.drawImage(fenceAt(false), 0, 0)
  return { floor: { canvas, x: r.x0, y: r.y0 }, fence: { canvas: fenceAt(true), x: r.x0, y: r.y0 } }
}

/** The floor of the place the player is in, baked once per floor (a dungeon's next floor is a new layout). */
let baked: { layout: FloorPlan; floor: Baked; fence: Baked | null } | null = null
onCanvasReset(
  () => (baked = null),
  () => [baked?.floor, baked?.fence],
)

/** Frees the last place's baked floor (a few MB) once the player is back outside (`warmScenery`). */
export const dropPlaceFloor = () => {
  if (!baked) return
  for (const b of [baked.floor, baked.fence]) if (b) b.canvas.width = b.canvas.height = 0
  baked = null
}

const bakedFloor = (inside: PlaceInterior) => {
  if (baked?.layout === inside.layout) return baked
  if (inside.id === 'graveyard') {
    const both = bakeGraveyard(inside.layout.floor, inside.state.graves, inside.state.keystone)
    baked = { layout: inside.layout, floor: both.floor, fence: both.fence }
  } else {
    baked = { layout: inside.layout, floor: bakeCave(inside.layout.floor), fence: null }
  }
  return baked
}

/* ---------------- Sky ---------------- */

const SKY_BANDS = ['#4878d0', '#5486d8', '#6094e0', '#6ca2e6', '#7ab0ec', '#8abef0', '#9acaf4', '#acd6f8'] as const

/** One cloud: lumps of white with a pale blue underside, sculpted from a seed. */
const cloud = (seed: number, size: number): PixelSprite => {
  const w = Math.round(size * 2.6)
  const h = Math.round(size * 1.3)
  const lumps = Array.from({ length: 5 }, (_, i) => ({
    x: w * (0.2 + i * 0.15) + (hash2(i, 1, seed) - 0.5) * size * 0.4,
    y: h * 0.6 - hash2(i, 2, seed) * size * 0.35 - (i === 2 ? size * 0.2 : 0),
    r: size * (0.32 + hash2(i, 3, seed) * 0.22),
  }))
  return paint(w, h, (px, py) => {
    let inside = false
    let top = false
    for (const l of lumps) {
      const d = Math.hypot(px + 0.5 - l.x, py + 0.5 - l.y)
      if (d <= l.r) {
        inside = true
        if (py + 0.5 - l.y < -l.r * 0.35) top = true
      }
    }
    if (!inside || py > h * 0.82) return null
    if (py > h * 0.68) return bayer(px, py) < 0.5 ? '#c8dcf4' : '#dae8f8'
    return top ? '#ffffff' : bayer(px, py) < 0.15 ? '#e8f0fc' : '#f4f8ff'
  })
}

let gradient: { w: number; h: number; canvas: HTMLCanvasElement } | null = null
onCanvasReset(
  () => (gradient = null),
  () => gradient,
)

/** The sky behind the clouds: deep blue on top to pale at the bottom, in bands dithered into each other. */
const skyGradient = (w: number, h: number) => {
  if (gradient?.w === w && gradient.h === h) return gradient.canvas
  const n = SKY_BANDS.length
  const canvas = paint(w, h, (px, py) => {
    const v = (py / h) * (n - 1)
    const i = Math.floor(v)
    return SKY_BANDS[Math.min(n - 1, v - i > bayer(px, py) ? i + 1 : i)]!
  })
  gradient = { w, h, canvas }
  return canvas
}

const CLOUDS = lazy(() => Array.from({ length: 6 }, (_, i) => cloud(i * 7 + 1, 10 + (i % 3) * 6)))

/** Far and near cloud layers scrolling under the player at their own parallax, drifting with the wind. */
const drawSky = (ctx: Ctx, inside: PlaceInteriorOf<'sky'>, camX: number, camY: number, w: number, h: number, t: number) => {
  ctx.drawImage(skyGradient(w, h), 0, 0)
  const { wind } = inside.state
  const clouds = CLOUDS()
  for (const [depth, tile, count, alpha] of [[0.3, 220, 5, 0.7], [0.7, 180, 6, 1]] as const) {
    ctx.globalAlpha = alpha
    const dx = camX * depth - wind.x * t * 14 * depth
    const dy = camY * depth - wind.y * t * 14 * depth
    for (let i = 0; i < count; i++) {
      const sprite = clouds[(i + (depth > 0.5 ? 3 : 0)) % clouds.length]!
      const bx = hash2(i, depth > 0.5 ? 1 : 2, 31) * tile
      const by = hash2(i, depth > 0.5 ? 3 : 4, 31) * tile
      const x0 = ((((bx - dx) % tile) + tile) % tile) - sprite.width
      const y0 = ((((by - dy) % tile) + tile) % tile) - sprite.height
      for (let y = y0; y < h; y += tile) for (let x = x0; x < w; x += tile) ctx.drawImage(sprite, Math.round(x), Math.round(y))
    }
  }
  ctx.globalAlpha = 1
}

/** The wall of cloud at the sky's edge, where the wind pushes back. */
const drawCloudWall = (ctx: Ctx, inside: PlaceInterior, camX: number, camY: number, w: number, h: number) => {
  const clouds = CLOUDS()
  const R = SKY.radius
  const n = 44
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    const sprite = clouds[i % clouds.length]!
    const x = inside.x + Math.cos(a) * (R + 26) - sprite.width / 2
    const y = inside.y + Math.sin(a) * (R + 22) - sprite.height / 2
    if (x > camX + w + 20 || y > camY + h + 20 || x + sprite.width < camX - 20 || y + sprite.height < camY - 20) continue
    ctx.drawImage(sprite, Math.round(x), Math.round(y))
  }
}

/* ---------------- Interiors ---------------- */

/** The ground under a place: the sky, or the baked floor over its surroundings. Replaces the map while inside. */
export const drawPlaceFloor = (ctx: Ctx, inside: PlaceInterior, camX: number, camY: number, w: number, h: number, t: number) => {
  if (inside.id === 'sky') return drawSky(ctx, inside, camX, camY, w, h, t)
  ctx.fillStyle = inside.id === 'graveyard' ? '#17121f' : '#1c1515'
  ctx.fillRect(0, 0, w, h)
  const b = bakedFloor(inside).floor
  ctx.drawImage(b.canvas, Math.round(inside.x + b.x - camX), Math.round(inside.y + b.y - camY))
}

/** PMD's stairs: a stone frame around steps going down to the right, each with a lit tread and a dark riser. */
const STAIRS = lazy(() =>
  art(
    [
      '1111111111111111',
      '1222222222222221',
      '1233333333333321',
      '1244333333333321',
      '1255443333333321',
      '1266554433333321',
      '1277665544333321',
      '1288776655443321',
      '1288887766554421',
      '1288888877665521',
      '1288888888776621',
      '1288888888887721',
      '1222222222222221',
      '1111111111111111',
    ],
    { 1: '#1c1410', 2: '#b8a080', 3: '#8a7460', 4: '#d8c8a8', 5: '#5a4838', 6: '#b8a488', 7: '#3c3024', 8: '#1a120c' },
  ),
)

/** Ground-level parts of a place: the stairs and the chest's ring, the keystone's spirit count. */
export const drawPlaceGround = (ctx: Ctx, g: Game, t: number) => {
  const inside = g.place.inside
  if (!inside) return
  if (inside.id === 'cave') {
    const s = inside.state
    if (s.stairs) {
      const x = inside.x + s.stairs[0]
      const y = inside.y + s.stairs[1]
      // A soft glow under the stairs, then the stairs, with a glint running down the steps so they catch the eye in the dark.
      ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.12
      blitEllipse(ctx, 14, 10, '#f8e8b0', x, y)
      ctx.globalAlpha = 1
      blitCentered(ctx, STAIRS(), x, y)
      const k = Math.floor(t * 10) % 16
      ctx.fillStyle = '#ffffff'
      if (k < 10) ctx.fillRect(Math.round(x - 5 + k), Math.round(y - 4 + k * 0.9), 2, 1)
    }
    const c = s.chest
    if (c && !c.open && c.progress > 0) chargeArc(ctx, inside.x + c.x, inside.y + c.y, 24, c.progress)
    return
  }
  if (inside.id === 'graveyard') drawKeystoneAura(ctx, inside, t)
}

const SPIRITS = ['#e0d0ff', '#a890e8', '#ffffff'] as const

/** The spirits the keystone holds circle it, more and faster as it fills, over a violet glow. */
const drawKeystoneAura = (ctx: Ctx, inside: PlaceInteriorOf<'graveyard'>, t: number) => {
  const s = inside.state
  if (s.bossId !== null) return
  const x = inside.x + s.keystone[0]
  const y = inside.y + s.keystone[1]
  const k = s.spirits / GRAVEYARD.spirits
  ctx.globalAlpha = 0.25 + k * 0.35 + Math.sin(t * (2 + k * 6)) * 0.08
  blitEllipse(ctx, 16 + Math.round(k * 8), 6 + Math.round(k * 3), '#7860a8', x, y)
  ctx.globalAlpha = 1
  const n = Math.ceil(s.spirits / 2)
  for (let i = 0; i < n; i++) {
    const a = t * (1.2 + k * 2.5) + (i / Math.max(1, n)) * TAU
    const r = 16 + (i % 3) * 3
    ctx.fillStyle = SPIRITS[i % SPIRITS.length]!
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y - 14 + Math.sin(a) * r * 0.4 - Math.sin(t * 3 + i) * 2), i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1)
  }
}

/** The south half of the graveyard's fence, in front of whoever stands inside it. */
export const drawPlaceOver = (ctx: Ctx, g: Game, camX: number, camY: number) => {
  const inside = g.place.inside
  if (!inside) return
  const fence = inside.id === 'graveyard' ? bakedFloor(inside).fence : null
  if (fence) ctx.drawImage(fence.canvas, Math.round(inside.x + fence.x), Math.round(inside.y + fence.y))
  if (inside.id === 'sky') drawCloudWall(ctx, inside, camX, camY, g.view.w, g.view.h)
}

/* ---------------- Wings ---------------- */

/** A feather, quill at the bottom left. */
const WING_ROWS = ['.......111', '......1231', '.....12331', '....123321', '...123321.', '..123321..', '.123321...', '12221.....', '121.......', '1.........']

const WING_COLORS: Record<WingId, readonly [string, string, string]> = {
  healthWing: ['#802838', '#f05870', '#f8c0c8'],
  muscleWing: ['#804018', '#f08838', '#f8d0a8'],
  resistWing: ['#205030', '#48b860', '#c0f0c8'],
  swiftWing: ['#203878', '#5890f0', '#c8e0ff'],
  prettyWing: ['#806010', '#f8d030', '#fff8c0'],
}

const wingArt = canvasCache<WingId, PixelSprite>()

const wingSprite = (id: WingId) => {
  let sprite = wingArt.get(id)
  if (!sprite) {
    const [dark, mid, light] = WING_COLORS[id]
    wingArt.set(id, (sprite = art(WING_ROWS, { 1: dark, 2: mid, 3: light }, '#101018')))
  }
  return sprite
}

/** The wings drifting through the sky, fluttering, with a glint. */
export const drawWings = (ctx: Ctx, g: Game, t: number) => {
  const inside = g.place.inside
  if (inside?.id !== 'sky') return
  for (const w of inside.state.wings) {
    const tilt = Math.sin(w.age * 3 + w.id) * 0.5
    const y = w.y - 4 + Math.sin(w.age * 2.2) * 2
    // A soft halo so it stands out against the clouds.
    ctx.globalAlpha = 0.45 + Math.sin(t * 4 + w.id) * 0.15
    blitEllipse(ctx, 8, 8, WING_COLORS[w.wing][2], w.x, y)
    ctx.globalAlpha = 1
    blitRotated(ctx, wingSprite(w.wing), w.x, y, tilt)
    if (Math.floor(t * 6 + w.id) % 7 === 0) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(w.x + 4), Math.round(y - 7), 1, 1)
      ctx.fillRect(Math.round(w.x + 3), Math.round(y - 6), 3, 1)
    }
  }
}

/* ---------------- The dark (cave) and the night (graveyard) ---------------- */

const lights = canvasCache<number, PixelSprite>()
/**
 * Light discs kept, the least recently drawn going first: a light easing between
 * two sizes (Darkrai's dark between phases, its capture) passes through every
 * radius on the way, and would otherwise keep a canvas for each.
 */
const LIGHTS_KEPT = 40

/** The radius a light is drawn at: whole px up close, even px past 96 and every 4 px past 160, so an easing light makes fewer discs. */
const lightRadius = (r: number) => {
  const step = r > 160 ? 4 : r > 96 ? 2 : 1
  return Math.max(4, Math.round(r / step) * step)
}

/**
 * A light's cut-out: a solid core, then dithered rings that let less and
 * less through, so the dark ends in a hard-edged pixel falloff. Painted as
 * one image (a big one is tens of thousands of pixels: one `fillRect` each
 * hitched weak phones every time a light took a new size).
 */
export const lightDisc = (radius: number) => {
  const r = lightRadius(radius)
  let c = lights.get(r)
  if (c) {
    lights.delete(r)
    lights.set(r, c)
    return c
  }
  const size = r * 2 + 1
  c = createCanvas(size, size)
  const ctx = context2d(c)
  const img = ctx.createImageData(size, size)
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      const d = Math.sqrt(x * x + y * y) / r
      if (d > 1) continue
      const keep = d < 0.62 ? 1 : d < 0.76 ? 0.75 : d < 0.88 ? 0.45 : 0.18
      // Opaque black: what `destination-out` cuts away.
      if (bayer(x + r, y + r) < keep) img.data[((y + r) * size + x + r) * 4 + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  if (lights.size >= LIGHTS_KEPT) lights.delete(lights.keys().next().value!)
  lights.set(r, c)
  return c
}

let dark: { canvas: HTMLCanvasElement; ctx: Ctx } | null = null

/** A screen-sized layer to paint a dark on and cut its lights out of (the cave's, Darkrai's nightmare). */
export const darkLayer = (w: number, h: number) => {
  if (!dark || dark.canvas.width !== w || dark.canvas.height !== h) {
    const canvas = createCanvas(w, h)
    dark = { canvas, ctx: context2d(canvas) }
  }
  return dark
}

const EYES = '#f8f0a0'

/**
 * The cave's dark over everything: light around the player (wider for Fire and
 * Electric types, flickering with a flame), around crystals, the stairs, the
 * chest and fire or electric attacks. Wild Pokémon out in the dark show only
 * their eyes. The graveyard gets a lighter night.
 */
export const drawPlaceDark = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const inside = g.place.inside
  if (!inside || inside.id === 'sky') return
  const { w, h } = g.view
  const layer = darkLayer(w, h)
  const d = layer.ctx
  d.globalCompositeOperation = 'source-over'
  d.clearRect(0, 0, w, h)
  d.fillStyle = inside.id === 'cave' ? 'rgba(6,4,10,0.94)' : 'rgba(14,8,30,0.5)'
  d.fillRect(0, 0, w, h)
  d.globalCompositeOperation = 'destination-out'
  const cut = (x: number, y: number, r: number) => {
    const disc = lightDisc(Math.max(4, Math.round(r)))
    d.drawImage(disc, Math.round(x - camX - disc.width / 2), Math.round(y - camY - disc.height / 2))
  }
  const p = g.player
  const reach = inside.id === 'cave' ? caveLight(g) : 110
  // A flame flickers.
  const flicker = inside.id === 'cave' && reach === CAVE.fireLight ? Math.round(Math.sin(t * 9) + Math.sin(t * 23)) : 0
  cut(p.x, p.y - 10, reach + flicker)
  const litBy: Array<readonly [number, number, number]> = [[p.x, p.y - 10, reach * 0.8]]
  if (inside.id === 'cave') {
    const s = inside.state
    for (const [lx, ly] of s.lights) {
      cut(inside.x + lx, inside.y + ly - 6, 34 + Math.round(Math.sin(t * 2 + lx) * 1.5))
      litBy.push([inside.x + lx, inside.y + ly - 6, 26])
    }
    if (s.stairs) cut(inside.x + s.stairs[0], inside.y + s.stairs[1], 24 + Math.round(Math.sin(t * 3) * 2))
    if (s.chest) cut(inside.x + s.chest.x, inside.y + s.chest.y - 6, 30)
    let n = 0
    for (const a of g.attacks) {
      if (n > 24 || a.age < 0 || (a.type !== 'fire' && a.type !== 'electric')) continue
      if (a.x < camX - 20 || a.y < camY - 20 || a.x > camX + w + 20 || a.y > camY + h + 20) continue
      cut(a.x, a.y - 6, 16)
      n++
    }
  } else {
    // The keystone glows with the spirits it holds.
    const s = inside.state
    if (s.bossId === null) cut(inside.x + s.keystone[0], inside.y + s.keystone[1] - 12, 22 + Math.round((s.spirits / GRAVEYARD.spirits) * 22 + Math.sin(t * 3) * 2))
  }
  d.globalCompositeOperation = 'source-over'
  ctx.drawImage(layer.canvas, 0, 0)
  if (inside.id !== 'cave') return
  // Eyes in the dark.
  for (const e of g.enemies) {
    if (e.dying >= 0 || e.x < camX - 8 || e.y < camY - 8 || e.x > camX + w + 8 || e.y > camY + h + 40) continue
    if (litBy.some(([lx, ly, r]) => (e.x - lx) ** 2 + (e.y - 10 - ly) ** 2 < r * r)) continue
    // A blink now and then.
    if (hash2(e.id, Math.floor(t * 2.5), 5) < 0.12) continue
    const def: EnemyDef = ENEMIES[e.kind]
    const top = Math.round(e.y - bodyOf(def.dex).bodyH * 0.62)
    const facing = e.dir === 2 || e.dir === 1 || e.dir === 3 ? 1 : e.dir === 6 || e.dir === 5 || e.dir === 7 ? -1 : 0
    if (e.dir === 4) continue
    ctx.fillStyle = EYES
    ctx.fillRect(Math.round(e.x - camX - 2 + facing), top - camY, 1, 1)
    ctx.fillRect(Math.round(e.x - camX + 2 + facing), top - camY, 1, 1)
  }
}

/* ---------------- Entrances on the map ---------------- */

/** A ring that closes around a spot as the player stands in it (doors, the chest). */
const chargeArc = (ctx: Ctx, x: number, y: number, r: number, k: number) => {
  const steps = Math.ceil(r * TAU * Math.min(1, k))
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + i / r
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.4), 2, 1)
  }
}

/** The updraft's platform: a ring of pale stone around trampled grass, a wind spiral inlaid in the middle. */
const WIND_DISC = lazy(() => {
  const R = 32
  return paint(R * 2 + 1, R + 2, (px, py) => {
    const x = px - R
    const y = (py - R / 2) * 2
    const d = Math.sqrt(x * x + y * y)
    if (d > R) return null
    if (d > R - 1.5) return '#5c6680'
    if (d > R - 6) return (Math.floor((Math.atan2(y, x) / TAU) * 28) % 2 === 0 ? '#c8d0e0' : '#aab4c8')
    if (d > R - 7) return '#7e88a0'
    const a = Math.atan2(y, x)
    const swirl = Math.abs((((a + d / 6) * 3) % TAU) - Math.PI) < 0.3 && d > 4 && d < R - 9
    if (swirl) return '#e8f8ff'
    return hash2(px, py, 3) < 0.5 ? '#86a874' : '#7a9c68'
  })
})

const VOID_SHADES = ['rgba(8,4,4,0.55)', 'rgba(8,4,4,0.35)'] as const

/** Ground-level parts of the entrance on the map: the updraft's disc and the door's charge ring. */
export const drawEntranceGround = (ctx: Ctx, g: Game, t: number) => {
  const ent = g.place.entrance
  if (!ent || g.place.inside) return
  if (ent.id === 'sky') blitCentered(ctx, WIND_DISC(), ent.x, ent.y)
  if (ent.open) {
    const door = PLACES[ent.id].door
    dashedRing(ctx, ent.x, ent.y, door + 3, t * 4, ENTRANCE_COLORS[ent.id], 0.35, 0.4)
    if (ent.charge > 0) chargeArc(ctx, ent.x, ent.y, door + 5, ent.charge / PLACE.enterTime)
  }
}

const ENTRANCE_COLORS: Record<PlaceId, readonly string[]> = {
  cave: ['#f8d878', '#c89848', '#ffffff'],
  graveyard: ['#c8a8f8', '#7860a8', '#ffffff'],
  sky: ['#d8f0f8', '#78c8f0', '#ffffff'],
}

/** Rocks heaped in the cave's mouth once it closes. */
const ROCKFALL = lazy(() =>
  art(
    ['....1111.111....', '..11222112221...', '.1223332133321..', '12333332233331..', '1233332223333211', '12222111222222221', '1112111111211111'],
    { 1: '#140e10', 2: '#5a4a44', 3: '#86746a' },
  ),
)

/**
 * The entrance's moving parts, over the scenery: the dark breathing in the
 * cave's mouth (rocks once it closes), fog rolling out of the graveyard's gate
 * and will-o'-wisps over its graves (its gates shut once closed), the wind
 * spiraling up the updraft with leaves in it.
 */
export const drawEntranceAir = (ctx: Ctx, g: Game, t: number) => {
  const ent = g.place.entrance
  if (!ent || g.place.inside) return
  if (ent.id === 'cave') return drawCaveMouth(ctx, ent, t)
  if (ent.id === 'graveyard') return drawGateFog(ctx, ent, t)
  drawUpdraft(ctx, ent, t)
}

const drawCaveMouth = (ctx: Ctx, ent: PlaceEntrance, t: number) => {
  const x = Math.round(ent.x)
  const y = Math.round(ent.y - 6)
  if (!ent.open) return blitCentered(ctx, ROCKFALL(), x, y - 4)
  // Dust drifting out of the dark.
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.4 + i / 4) % 1
    ctx.fillStyle = VOID_SHADES[i % 2]!
    ctx.fillRect(Math.round(x - 8 + hash2(i, Math.floor(t * 0.4 + i / 4), 3) * 16), Math.round(y - 4 - k * 18), 1, 1)
  }
}

const drawGateFog = (ctx: Ctx, ent: PlaceEntrance, t: number) => {
  const x = Math.round(ent.x)
  const y = Math.round(ent.y - 6)
  // Wisps floating over the graves behind the fence.
  for (let i = 0; i < 3; i++) {
    const wx = x - 50 + i * 46 + Math.sin(t * 0.9 + i * 2) * 6
    const wy = y - 34 - Math.sin(t * 1.7 + i) * 4
    blitEllipse(ctx, 2, 3, 'rgba(184,152,248,0.45)', wx, wy)
    blitEllipse(ctx, 1, 2, '#e0d0ff', wx, wy)
  }
  // Fog rolling out under the gate.
  ctx.globalAlpha = 0.35
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.15 + i / 5) % 1
    blitEllipse(ctx, 10 + Math.round(k * 8), 3, '#b8b0c8', x - 12 + (i % 3) * 12 + Math.sin(t + i) * 3, y + 2 + k * 10)
  }
  ctx.globalAlpha = 1
  if (!ent.open) {
    ctx.fillStyle = '#2a2634'
    for (let bx = x - 13; bx <= x + 13; bx += 3) ctx.fillRect(bx, y - 22, 1, 22)
    ctx.fillRect(x - 13, y - 18, 27, 1)
    ctx.fillRect(x - 13, y - 6, 27, 1)
  }
}

const LEAF = ['#68b048', '#88c858', '#b8e078', '#f8f8ff'] as const

const drawUpdraft = (ctx: Ctx, ent: PlaceEntrance, t: number) => {
  if (!ent.open) return
  const x = ent.x
  const y = ent.y
  // A glow on the platform, then arcs of wind spiraling up out of it, widening as they rise.
  ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.1
  blitEllipse(ctx, 22, 8, '#e8f8ff', x, y)
  for (let i = 0; i < 7; i++) {
    const k = (t * 0.45 + i / 7) % 1
    const r = 14 + k * 16
    const cy = y - 4 - k * 110
    const spin = t * 3 + i * 2.1
    ctx.globalAlpha = Math.min(1, (1 - k) * 1.8) * 0.85
    ctx.fillStyle = i % 2 ? '#ffffff' : '#c8ecf8'
    for (let s = 0; s < 12; s++) {
      const a = spin + s * 0.16
      ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r * 0.32), 2, 1)
    }
  }
  // Leaves and a feather caught in it.
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.32 + i / 5) % 1
    const a = t * 3 + i * 2.2
    ctx.globalAlpha = Math.min(1, (1 - k) * 2)
    ctx.fillStyle = LEAF[i % LEAF.length]!
    ctx.fillRect(Math.round(x + Math.cos(a) * (12 + k * 10)), Math.round(y - 8 - k * 90 + Math.sin(a) * 3), 2, 1)
  }
  ctx.globalAlpha = 1
}

/** A place's icon for the DOM (the results, its toasts): the stairs, the Odd Keystone, a wing. */
export const placeIcon = (id: PlaceId) =>
  toIconUrl(`place:${id}`, () => (id === 'cave' ? STAIRS() : id === 'graveyard' ? PLACE_PIECES.keystone(0, 'tower').sprite : wingSprite('swiftWing')))

/* ---------------- Fainting inside ---------------- */

const clamp01 = (k: number) => Math.min(1, Math.max(0, k))

/** The rescue's progress, 0 → 1 (null while the player stands). */
const fallProgress = (g: Game) => {
  const fall = g.place.inside?.fall
  return fall == null ? null : 1 - fall / PLACE.fallTime
}

/** How the fainted player looks while the rescue comes (the Hurt pose, blinking at first, then fading); null while they stand. */
export const placeFallLook = (g: Game) => {
  const k = fallProgress(g)
  if (k === null) return null
  return { seconds: k * PLACE.fallTime, lift: 0, alpha: 1 - clamp01((k - 0.6) / 0.3), flash: k < 0.3 && Math.floor(k * 24) % 2 === 0 ? 0.7 : 0, tint: { color: '#000000', amount: 0 }, bar: k < 0.5 }
}

/** Over everything: the screen fades out as the rescue takes the player away (to black, or to white up in the sky). */
export const drawPlaceFallOut = (ctx: Ctx, g: Game) => {
  const k = fallProgress(g)
  if (k === null || k < 0.5) return
  const a = clamp01((k - 0.5) / 0.45).toFixed(2)
  ctx.fillStyle = g.place.inside?.id === 'sky' ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${a})`
  ctx.fillRect(0, 0, g.view.w, g.view.h)
}

/* ---------------- Arrow ---------------- */

const ARROWS = {
  cave: lazy(() => art(['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....'], { 1: '#f8d878', 2: '#a86c30' }, '#281408')),
  graveyard: lazy(() => art(['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....'], { 1: '#d8c8f8', 2: '#6c4ca8' }, '#180c30')),
  sky: lazy(() => art(['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....'], { 1: '#e8f8ff', 2: '#4898d8' }, '#0c2040')),
} satisfies Record<PlaceId, () => PixelSprite>

/** Screen-space arrow on the edge pointing at an open entrance off screen. */
export const drawPlaceArrow = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const ent = g.place.entrance
  if (!ent?.open || g.place.inside) return
  const { w, h } = g.view
  const sx = ent.x - camX
  const sy = ent.y - camY
  if (sx > 0 && sx < w && sy > -20 && sy < h) return
  const cx = w / 2
  const cy = h / 2
  const angle = Math.atan2(sy - cy, sx - cx)
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  // The same margins as the rift's arrow: clear of the timer, the pills and the status box.
  const k = Math.min(dx > 0 ? (w - 16 - cx) / dx : dx < 0 ? (16 - cx) / dx : Infinity, dy > 0 ? (h - 40 - cy) / dy : dy < 0 ? (72 - cy) / dy : Infinity)
  const bob = Math.sin(t * 8) * 2
  blitRotated(ctx, ARROWS[ent.id](), cx + dx * (k + bob), cy + dy * (k + bob), angle, 2)
}
