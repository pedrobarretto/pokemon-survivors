import { canvasCache, context2d, createCanvas, dropKept, drawPacked, ellipse, keepPacked, lazy, onCanvasReset, type Packed, type PixelSprite } from '../engine/pixelart'
import { BIOMES, type BiomeId } from '../data/biomes'
import { CLIFF_CRESTS, CLIFFS, LAKES, TERRAIN as RULES, type SolidKind, type Tier } from '../data/terrain'
import { featuresNear, groundAt, type Solid } from '../game/terrain'
import { roomOf } from '../game/room'
import type { ArenaPiece } from '../data/arenas'
import { ARENA_PIECES, ARENA_SHADOW, ARENA_TALL } from './arenaPieces'
import { PLACE_PIECES, PLACE_SHADOW, PLACE_TALL } from './placePieces'
import type { PlacePiece } from '../data/places'
import { LANDMARK_GROUNDS, LANDMARK_PIECES, LANDMARK_SHADOW, LANDMARK_TALL, LANDMARK_WARM, LOG_SKINS, logPiece } from './landmarkPieces'
import type { LandmarkGround, LandmarkPiece } from '../data/landmarks'
import type { Game } from '../game/types'
import { hasScenery, keepScenery, sceneryPiece } from './scenery'
import { localPlayer } from '../game/players'
import {
  cone,
  cylinder,
  get,
  grid,
  inFoot,
  lambert,
  limb,
  noise,
  outline,
  put,
  sculpt,
  shade,
  shard,
  stamp,
  tagAt,
  toSprite,
  type Blob,
  type Grid,
  type Ramp,
  wobble,
} from './sculpt'

/**
 * Terrain art: scenery with height that blocks whoever walks (rocks, trees,
 * mountains, towers) and lakes that slow them (`game/terrain.ts`). One
 * footprint (ellipses on the ground, `data/terrain.ts`) wears every biome's
 * skin: the meadow's grassy hill is the cave's rock wall and the tower's crypt.
 * Sprites are sculpted once per biome and cached; towers, trees, rocks, bushes
 * and some landmark pieces wear painted art instead (`render/scenery.ts`).
 */

/** A built sprite and the pixel in it that stands on the world anchor. */
export type Piece = { sprite: PixelSprite; ax: number; ay: number }

const piece = (g: Grid, ax: number, ay: number): Piece => ({ sprite: toSprite(g), ax: Math.round(ax), ay: Math.round(ay) })

/* ---------------- Rocks ---------------- */

export type RockSkin = { stone: Ramp; outline: string; moss?: Ramp; snow?: Ramp; crystal?: Ramp }

/** A pile of two or three chiseled stones, with moss or snow on the faces that look up. */
export const boulder = (skin: RockSkin, size: number, seed: number): Piece => {
  const w = Math.ceil(size * 1.9) + 4
  const h = Math.ceil(size * 1.3) + 4
  const cx = w / 2
  const ground = h - 2
  const g = grid(w, h)
  const s = size
  const blobs: Blob[] = [
    { x: cx + s * 0.32, y: ground - s * 0.62, rx: s * 0.5, ry: s * 0.48 },
    { x: cx - s * 0.28, y: ground - s * 0.55, rx: s * 0.62, ry: s * 0.55 },
    { x: cx + s * 0.45, y: ground - s * 0.25, rx: s * 0.38, ry: s * 0.26 },
  ]
  sculpt(g, blobs, skin.stone, {
    tag: 20,
    facets: 2.5,
    seed,
    rough: 0.12,
    paint: (x, y, n, light) => {
      if (skin.snow && n.y < -0.25) return shade(skin.snow, light + 0.2, x, y)
      if (skin.moss && n.y < -0.35 && noise(x, y, seed + 3) < 0.75) return shade(skin.moss, light, x, y)
      return null
    },
  })
  if (skin.crystal) {
    shard(g, cx - s * 0.75, ground - s * 0.3, s * 0.7, 4, -0.5, skin.crystal)
    shard(g, cx - s * 0.5, ground - s * 0.2, s * 0.45, 3, -0.15, skin.crystal)
  }
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** A broken fluted column with rubble at its foot (the graveyard's rock). */
export const brokenPillar = (skin: RockSkin, seed: number): Piece => {
  const g = grid(26, 34)
  const cx = 13
  const ground = 31
  cylinder(g, cx, ground, 6.5, 22, skin.stone, {
    top: null,
    paint: (x, y, nx, elev, light) => {
      if (elev > 22 - Math.floor(noise(x, 0, seed) * 6)) return 'clear'
      if (elev < 3) return shade(skin.stone, light - 0.15, x, y)
      if (elev > 18 && elev < 20) return shade(skin.stone, light + 0.2, x, y)
      return Math.round((nx + 1) * 3.5) % 2 === 0 ? shade(skin.stone, light - 0.3, x, y) : null
    },
  })
  for (let i = 0; i < g.px.length; i++) if (g.px[i] === 'clear') g.px[i] = null
  sculpt(g, [{ x: cx + 9, y: ground - 1, rx: 3.5, ry: 2.5 }, { x: cx - 9, y: ground, rx: 3, ry: 2 }], skin.stone, { tag: 30, facets: 2 })
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/* ---------------- Trees ---------------- */

export type TreeSkin = { leaves: Ramp; trunk: Ramp; outline: string; fruit?: string; snow?: Ramp }

const bark = (ramp: Ramp) => (x: number, y: number, _nx: number, elev: number, light: number) =>
  shade(ramp, light - (noise(x, Math.floor(elev / 3), 5) < 0.25 ? 0.3 : 0), x, y)

/** A broad leafy tree: clumps of leaves on one dome, so the whole crown is lit as one. */
const roundTree = (skin: TreeSkin, r: number, trunkH: number, seed: number): Piece => {
  const w = Math.ceil(r * 2.5) + 4
  const h = Math.ceil(trunkH + r * 2.1) + 4
  const cx = w / 2
  const ground = h - 3
  const g = grid(w, h)
  const tw = Math.max(2.5, r * 0.22)
  limb(g, cx - tw - 1.5, ground + 0.5, cx - 1, ground - 3, 1.2, 1.5, skin.trunk)
  limb(g, cx + tw + 1.5, ground + 0.5, cx + 1, ground - 3, 1.2, 1.5, skin.trunk)
  cylinder(g, cx, ground, tw, trunkH + r * 0.6, skin.trunk, { ry: 1.2, top: null, paint: bark(skin.trunk) })
  const cy = ground - trunkH - r * 0.82
  const k = r
  const blobs: Blob[] = [
    { x: cx - k * 0.42, y: cy - k * 0.48, rx: k * 0.55, ry: k * 0.48 },
    { x: cx + k * 0.42, y: cy - k * 0.52, rx: k * 0.55, ry: k * 0.48 },
    { x: cx, y: cy - k * 0.72, rx: k * 0.5, ry: k * 0.42 },
    { x: cx - k * 0.78, y: cy, rx: k * 0.5, ry: k * 0.45 },
    { x: cx + k * 0.78, y: cy - k * 0.04, rx: k * 0.5, ry: k * 0.45 },
    { x: cx, y: cy - k * 0.15, rx: k * 0.5, ry: k * 0.45 },
    { x: cx - k * 0.38, y: cy + k * 0.28, rx: k * 0.52, ry: k * 0.42 },
    { x: cx + k * 0.4, y: cy + k * 0.3, rx: k * 0.5, ry: k * 0.42 },
  ]
  sculpt(g, blobs, skin.leaves, {
    tag: 10,
    seed,
    rough: 0.22,
    paint: (x, y, n, _l, i) => {
      // Mix the clump's normal with the crown's, so light falls across the whole tree.
      const b = blobs[i]!
      const dx = (x + 0.5 - cx) / (k * 1.3)
      const dy = (y + 0.5 - (cy - k * 0.2)) / (k * 1.1)
      const big = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))
      const light = lambert(n.x * 0.45 + dx * 0.55, n.y * 0.45 + dy * 0.55, n.z * 0.45 + big * 0.55) + (noise(x, y, seed) - 0.5) * 0.22
      if (skin.snow && n.y < -0.4 && dy < 0.2) return shade(skin.snow, light + 0.25, x, y)
      if (skin.fruit && noise(x >> 1, y >> 1, seed + 9) < 0.06 && n.z > 0.5 && b.y > cy - k * 0.6) return skin.fruit
      return shade(skin.leaves, light, x, y)
    },
  })
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** A pine in stacked tiers, snow resting on top of each one. */
const pine = (skin: TreeSkin, height: number, width: number, seed: number): Piece => {
  const w = Math.ceil(width) + 6
  const h = Math.ceil(height) + 6
  const cx = w / 2
  const ground = h - 3
  const g = grid(w, h)
  cylinder(g, cx, ground, 2.5, 8, skin.trunk, { ry: 1, top: null })
  const tiers = 4
  const top = ground - height
  for (let i = tiers - 1; i >= 0; i--) {
    const apex = top + i * height * 0.19
    const base = apex + height * 0.36
    const half = (width / 2) * (0.42 + (0.58 * i) / (tiers - 1))
    for (let y = Math.floor(apex); y <= Math.ceil(base); y++) {
      const t = (y + 0.5 - apex) / (base - apex)
      const hw = half * t + 0.6
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const dx = x + 0.5 - cx
        if (Math.abs(dx) > hw) continue
        if (y >= base - 1 && (x + i) % 3 === 0) continue // bristly hem
        const n = dx / hw
        const light = lambert(n * 0.85, -0.25, Math.sqrt(Math.max(0, 1 - n * n * 0.72))) + (noise(x, y, seed) - 0.5) * 0.15
        const snowy = skin.snow && y - apex < hw * 0.5 + 1.5 + noise(x, i, seed) * 2
        put(g, x, y, snowy ? shade(skin.snow!, light + 0.15, x, y) : shade(skin.leaves, light, x, y), 40 + i)
      }
    }
  }
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** A bare, twisted tree with a hollow knot (the tower biome's trees, the graveyard's). */
export const deadTree = (skin: TreeSkin): Piece => {
  const g = grid(40, 46)
  const cx = 20
  const ground = 43
  const ramp = skin.trunk
  limb(g, cx - 6, ground, cx - 1, ground - 4, 1.2, 2, ramp)
  limb(g, cx + 6, ground, cx + 1, ground - 4, 1.2, 2, ramp)
  limb(g, cx, ground, cx - 1, ground - 20, 3.4, 2.4, ramp)
  limb(g, cx - 1, ground - 20, cx - 11, ground - 31, 2.2, 1, ramp)
  limb(g, cx - 7, ground - 27, cx - 9, ground - 38, 1.2, 0.6, ramp)
  limb(g, cx - 1, ground - 20, cx + 3, ground - 36, 2, 0.8, ramp)
  limb(g, cx + 2, ground - 30, cx + 10, ground - 37, 1, 0.6, ramp)
  limb(g, cx, ground - 14, cx + 12, ground - 22, 1.8, 0.7, ramp)
  limb(g, cx + 8, ground - 20, cx + 14, ground - 18, 0.9, 0.5, ramp)
  // A hollow knot in the trunk.
  stamp(g, ['.1.', '121', '.1.'], { 1: ramp[0]!, 2: '#100818' }, cx - 2, ground - 13)
  outline(g, skin.outline)
  if (skin.fruit) stamp(g, ['.1.', '121', '.1.'], { 1: skin.fruit, 2: '#ffffff' }, cx + 9, ground - 25)
  return piece(g, cx, ground)
}

/* ---------------- Bushes ---------------- */

export type BushSkin = { leaves: Ramp; outline: string; bloom?: readonly string[]; snow?: Ramp }

/**
 * A low round bush, clumps of leaves on one dome like the trees' crowns;
 * variant 1 flowers, variant 2 berries (where the biome has them).
 */
const bush = (skin: BushSkin, variant: number): Piece => {
  const g = grid(28, 22)
  const cx = 14
  const ground = 19
  const blobs: Blob[] = [
    { x: cx - 5, y: ground - 5, rx: 6.5, ry: 5 },
    { x: cx + 5.5, y: ground - 5, rx: 6, ry: 5 },
    { x: cx - 1, y: ground - 10, rx: 7, ry: 6 },
    { x: cx + 1, y: ground - 4, rx: 7.5, ry: 4.2 },
  ]
  const bloom = variant > 0 && skin.bloom ? skin.bloom[(variant - 1) % skin.bloom.length]! : null
  sculpt(g, blobs, skin.leaves, {
    tag: 10,
    seed: variant + 3,
    rough: 0.2,
    paint: (x, y, n, light) => {
      const dx = (x + 0.5 - cx) / 12
      const dy = (y + 0.5 - (ground - 7)) / 9
      const l = light * 0.5 + lambert(dx, dy, Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy))) * 0.5
      if (skin.snow && n.y < -0.35) return shade(skin.snow, l + 0.25, x, y)
      if (bloom && n.z > 0.45 && noise(x >> 1, y >> 1, variant + 9) < 0.14) return bloom
      return shade(skin.leaves, l, x, y)
    },
  })
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** Glowing mushrooms in a clump: the cave's bushes. */
const mushrooms = (variant: number): Piece => {
  const g = grid(26, 20)
  const caps: readonly Ramp[] = [['#183868', '#2c68b0', '#58a8e8', '#a8e0ff'], ['#3c1868', '#6c34b0', '#a070e8', '#d8b8ff'], ['#185838', '#2c9060', '#58d098', '#b0f8d0']]
  const cap = caps[variant % caps.length]!
  const stem: Ramp = ['#a8988c', '#d0c4b8', '#f0e8dc']
  for (const [x, h, r] of [[7, 7, 4.5], [17, 10, 5.5], [12, 4, 3.5], [21, 4, 3]] as const) {
    cylinder(g, x, 17, 1.4, h, stem, { top: null })
    sculpt(g, [{ x, y: 17 - h - 1, rx: r, ry: r * 0.62 }], cap, { tag: 20 + x, seed: x })
    put(g, Math.round(x - r * 0.4), Math.round(17 - h - 2), cap[3]!)
  }
  outline(g, '#100a0c')
  return piece(g, 13, 17)
}

/** A thorny dead bush with a few purple berries: the graveyard's. */
const thornBush = (skin: TreeSkin, variant: number): Piece => {
  const g = grid(28, 22)
  const cx = 14
  const ground = 19
  for (const [dx, dy] of [[-9, -7], [-4, -12], [3, -13], [9, -8], [11, -3], [-11, -2]] as const) {
    limb(g, cx + dx * 0.2, ground, cx + dx, ground + dy, 1.1, 0.5, skin.trunk)
    limb(g, cx + dx * 0.6, ground + dy * 0.6, cx + dx * 0.6 + (dx > 0 ? 3 : -3), ground + dy * 0.6 - 3, 0.6, 0.4, skin.trunk)
  }
  for (const [x, y] of [[cx - 7, ground - 9], [cx + 6, ground - 11], [cx + 10, ground - 5]] as const) if (noise(x, y, variant) < 0.8) put(g, x, y, skin.fruit ?? '#b070c8')
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** Stalagmites: the cave's trees. */
export const stalagmites = (skin: RockSkin, seed: number): Piece => {
  const g = grid(30, 48)
  const cx = 15
  const ground = 45
  cone(g, cx + 6, ground - 1, 5, 22, skin.stone, { rows: 4 })
  cone(g, cx - 1, ground, 7.5, 40, skin.stone, { rows: 5 })
  sculpt(g, [{ x: cx - 7, y: ground - 1, rx: 4, ry: 3 }, { x: cx + 3, y: ground + 0.5, rx: 3.5, ry: 2 }], skin.stone, { tag: 30, facets: 2, seed })
  if (skin.crystal) shard(g, cx + 10, ground, 9, 3.5, 0.45, skin.crystal)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/* ---------------- Cliffs (mountains) ---------------- */


type CliffSkin = {
  face: Ramp
  top: Ramp
  lip: string
  outline: string
  /** Px between rock layers on the face. */
  strata?: number
  /** Masonry instead of rock (crypts). */
  mortar?: string
  icicles?: string
  roots?: string
}

const TOP = 100
const FACE = 200

/**
 * A terraced mountain sculpted from its footprint: each tier is extruded
 * straight up (only the south face shows), with rock strata, cracks and a lit
 * lip. (ax, ay) is the footprint origin at ground level.
 */
const cliff = (tiers: readonly Tier[], skin: CliffSkin, seed: number): Piece => {
  const foot0 = tiers[0]!.foot
  const minX = Math.min(...foot0.map((e) => e.x - e.rx))
  const maxX = Math.max(...foot0.map((e) => e.x + e.rx))
  const minY = Math.min(...foot0.map((e) => e.y - e.ry))
  const maxY = Math.max(...foot0.map((e) => e.y + e.ry))
  const total = tiers.reduce((s, t) => s + t.h, 0)
  const w = Math.ceil(maxX - minX) + 6
  const h = Math.ceil(maxY - minY) + total + 6
  const ax = Math.round(-minX + 3)
  const ay = Math.round(-minY + total + 3)
  const g = grid(w, h)
  const amp = skin.mortar ? 2 : 5
  let base = 0
  tiers.forEach((tier, ti) => {
    // The footprint on the ground, row `r` standing where screen row `r` would be at elevation 0.
    // Edges wobble a little around the ellipses, so a mountain never looks like a cake.
    // The wobble along x depends on the column alone and the one along y on the row alone: worked out once each.
    const mask = new Uint8Array(w * h)
    const wobbleX = Array.from({ length: w }, (_, sx) => (wobble((sx + 0.5 - ax) / 7, seed + ti) - 0.5) * amp)
    for (let r = 0; r < h; r++) {
      const fy = r + 0.5 - ay
      const wobbleY = (wobble((fy + 300) / 5, seed + 9) - 0.5) * amp * 0.4
      for (let sx = 0; sx < w; sx++) mask[r * w + sx] = inFoot(tier.foot, sx + 0.5 - ax, fy, wobbleX[sx]! + wobbleY) ? 1 : 0
    }
    /** Whether the footprint reaches screen pixel (sx, sy) at elevation `e`. */
    const on = (sx: number, sy: number, e: number) => sy + e < h && mask[(sy + e) * w + sx] === 1
    for (let sy = 0; sy < h; sy++) {
      for (let sx = 0; sx < w; sx++) {
        const fx = sx + 0.5 - ax
        const gy = sy + 0.5 - ay
        if (on(sx, sy, base + tier.h)) {
          const l = 0.55 + (noise(sx, sy, seed) - 0.5) * 0.5 + (noise(sx >> 2, sy >> 2, seed + 1) - 0.5) * 0.3
          put(g, sx, sy, shade(skin.top, l, sx, sy), TOP + ti)
          continue
        }
        for (let e = base + tier.h - 1; e >= base; e--) {
          if (!on(sx, sy, e)) continue
          const fy = gy + e
          // Which ellipse this bit of wall belongs to tells which way it faces.
          let nx = 0
          let best = -Infinity
          for (const el of tier.foot) {
            const dx = (fx - el.x) / el.rx
            const dy = (fy - el.y) / el.ry
            if (dx * dx + dy * dy <= 1.02 && dy > best) {
              best = dy
              nx = dx
            }
          }
          const k = (e - base) / tier.h
          let l = 0.6 - 0.34 * nx + 0.18 * k
          if (ti === 0 && e - base < 2) l -= 0.22
          const elev = Math.round(e)
          if (skin.mortar) {
            const row = Math.floor(elev / 4)
            if (elev % 4 === 0 || (Math.floor(fx) + (row % 2) * 4 + 400) % 8 === 0) {
              put(g, sx, sy, skin.mortar, FACE + ti)
              break
            }
            l += (noise(Math.floor((fx + (row % 2) * 4) / 8), row, seed) - 0.5) * 0.3
          } else {
            // Vertical ribs of rock, nudged sideways every few px of height, with a crease between them.
            const nudge = Math.floor(noise(Math.floor(elev / 6), ti, seed + 6) * 3)
            const col = Math.floor(fx) + nudge + 400
            const rib = Math.floor(col / 5)
            l += (noise(rib, Math.floor(elev / 9), seed) - 0.5) * 0.34
            if (col % 5 === 0) l -= 0.2
            if (skin.strata && elev % skin.strata === 0 && noise(rib, elev, seed + 1) < 0.5) l -= 0.18
          }
          put(g, sx, sy, shade(skin.face, l, sx, sy), FACE + ti)
          break
        }
      }
    }
    base += tier.h
  })
  // Lit rim along each top's north edge, a bright lip where it drops off to the south.
  const rim: Array<[number, number, string]> = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tagAt(g, x, y)
      if (t < TOP || t >= FACE) continue
      if (tagAt(g, x, y + 1) !== t) rim.push([x, y, skin.lip])
      else if (tagAt(g, x, y - 1) !== t) rim.push([x, y, skin.top[skin.top.length - 1]!])
    }
  }
  for (const [x, y, c] of rim) put(g, x, y, c, tagAt(g, x, y))
  // Icicles and roots hang from the lip down the face.
  const hang = skin.icicles ?? skin.roots
  if (hang) {
    for (let x = 0; x < w; x++) {
      for (let y = 0; y < h; y++) {
        const t = tagAt(g, x, y)
        if (t < TOP || t >= FACE || tagAt(g, x, y + 1) < FACE) continue
        const len = noise(x, t, seed + 4) < 0.35 ? 1 + Math.floor(noise(x, t, seed + 5) * 4) : 0
        for (let k = 1; k <= len; k++) if (tagAt(g, x, y + k) >= FACE) put(g, x, y + k, k === len && skin.icicles ? '#ffffff' : hang, tagAt(g, x, y + k))
      }
    }
  }
  outline(g, skin.outline)
  return piece(g, ax, ay)
}

/* ---------------- Lakes ---------------- */

type LakeSkin = {
  deep: string
  mid: string
  edge: string
  /** The bank's earth face showing under the north shore. */
  bank: Ramp
  shore: Ramp
  sparkle: string
  ice?: { crack: string; streak: string }
}

/** A flat body of water (or ice, or mire) with its shore, banks and glints. (ax, ay) is the footprint origin. */
type LakeDecor = (g: Grid, at: (x: number, y: number) => readonly [number, number] | null) => void

const lake = (foot: readonly Blob[], skin: LakeSkin, seed: number, decor?: LakeDecor): Piece => {
  const minX = Math.min(...foot.map((e) => e.x - e.rx))
  const maxX = Math.max(...foot.map((e) => e.x + e.rx))
  const minY = Math.min(...foot.map((e) => e.y - e.ry))
  const maxY = Math.max(...foot.map((e) => e.y + e.ry))
  const pad = 5
  const w = Math.ceil(maxX - minX) + pad * 2
  const h = Math.ceil(maxY - minY) + pad * 2
  const ax = -minX + pad
  const ay = -minY + pad
  const g = grid(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const fx = x + 0.5 - ax
      const fy = y + 0.5 - ay
      const jitter = (noise(x, y, seed) - 0.5) * 1.2
      if (!inFoot(foot, fx, fy)) {
        if (inFoot(foot, fx, fy, 2.6 + jitter)) put(g, x, y, shade(skin.shore, inFoot(foot, fx, fy, 1.2) ? 0.15 : 0.55 + jitter * 0.3, x, y))
        continue
      }
      const north = !inFoot(foot, fx, fy - 1) ? 1 : !inFoot(foot, fx, fy - 2) ? 2 : !inFoot(foot, fx, fy - 3) ? 3 : 0
      if (!skin.ice && (north === 1 || north === 2)) put(g, x, y, shade(skin.bank, north === 1 ? 0.8 : 0.2, x, y))
      else if (!skin.ice && north === 3) put(g, x, y, skin.deep)
      else if (!inFoot(foot, fx, fy, -2.2 + jitter * 0.6)) put(g, x, y, skin.edge)
      else if (!inFoot(foot, fx, fy, -7 + jitter)) put(g, x, y, skin.mid)
      else put(g, x, y, skin.deep)
    }
  }
  // Glints: short horizontal ripples on open water, long diagonal streaks on ice.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const c = get(g, x, y)
      if (c !== skin.mid && c !== skin.deep) continue
      if (skin.ice) {
        if (noise(Math.floor((x + y) / 7), 0, seed) < 0.3 && (x + y) % 7 < 2 && noise(x >> 3, y >> 3, seed + 1) < 0.5) put(g, x, y, skin.ice.streak)
      } else if (noise(x >> 3, y >> 2, seed + 2) < 0.1 && (x & 7) < 3 && (y & 3) === 0) {
        put(g, x, y, skin.sparkle)
      }
    }
  }
  if (skin.ice) {
    // Cracks: a few short random walks.
    for (let i = 0; i < 5; i++) {
      let x = Math.floor(noise(i, 1, seed) * w)
      let y = Math.floor(noise(i, 2, seed) * h)
      for (let s = 0; s < 18; s++) {
        const c = get(g, x, y)
        if (c && c !== skin.edge && !skin.shore.includes(c)) put(g, x, y, skin.ice.crack)
        x += noise(i, s, seed + 3) < 0.5 ? 1 : -1
        y += noise(i, s, seed + 4) < 0.6 ? 1 : 0
      }
    }
  }
  // Decor only goes where this footprint has water.
  decor?.(g, (x, y) => (inFoot(foot, x, y, -4) ? ([Math.round(x + ax), Math.round(y + ay)] as const) : null))
  return piece(g, ax, ay)
}

/* ---------------- Towers (landmarks) ---------------- */

type Window = { at: number; glow?: string; dark: string }

/** Arched windows on a tower's face at the given heights. */
const windows = (ramp: Ramp, list: readonly Window[], mortar?: string) => (x: number, y: number, nx: number, elev: number, light: number) => {
  for (const win of list) {
    if (elev < win.at || elev > win.at + 6) continue
    if (nx < -0.32 || nx > 0.12) continue
    const arch = elev === win.at + 6 && (nx < -0.25 || nx > 0.05)
    if (arch) continue
    return win.glow && elev < win.at + 3 ? win.glow : win.dark
  }
  if (mortar) {
    const row = Math.floor(elev / 4)
    const s = Math.asin(Math.max(-1, Math.min(1, nx))) * 12
    if (elev % 4 === 0 || Math.floor(s + (row % 2) * 3 + 60) % 6 === 0) return mortar
  }
  return shade(ramp, light + (noise(x, Math.floor(elev / 4), 7) - 0.5) * 0.2, x, y)
}

const door = (dark: string) => (_x: number, _y: number, nx: number, elev: number) => (elev < 9 && Math.abs(nx + 0.08) < 0.22 && !(elev === 8 && Math.abs(nx + 0.08) > 0.14) ? dark : null)

/** Sprout Tower: a three-story wooden pagoda (meadow). */
const sproutTower = (): Piece => {
  const g = grid(50, 104)
  const cx = 25
  const ground = 98
  const wood: Ramp = ['#3c2414', '#5c3820', '#7c5030', '#9c6c40', '#b88850']
  const roof: Ramp = ['#1c2838', '#2c3c50', '#3c5468', '#587890', '#7898b0']
  const d = door('#140c08')
  const planks = windows(wood, [{ at: 14, dark: '#1c1008', glow: '#f8d878' }])
  cylinder(g, cx, ground, 13, 24, wood, { top: null, paint: (x, y, nx, e, l) => d(x, y, nx, e) ?? (Math.round((nx + 1) * 6) % 3 === 0 ? shade(wood, l - 0.3, x, y) : planks(x, y, nx, e, l)) })
  cone(g, cx, ground - 22, 21, 12, roof, { flare: 2.2, rows: 3, ry: 7 })
  cylinder(g, cx, ground - 30, 9.5, 18, wood, { top: null, paint: windows(wood, [{ at: 6, dark: '#1c1008', glow: '#f8d878' }]) })
  cone(g, cx, ground - 46, 17, 11, roof, { flare: 2.2, rows: 3, ry: 5.5 })
  cylinder(g, cx, ground - 53, 6.5, 14, wood, { top: null })
  cone(g, cx, ground - 65, 13, 20, roof, { flare: 1.6, rows: 3, ry: 4.5 })
  limb(g, cx, ground - 84, cx, ground - 92, 1.2, 0.6, ['#806010', '#c09020', '#f8d048'])
  outline(g, '#140c08')
  return piece(g, cx, ground)
}

/** An ancient hollow tree big enough to be a tower (forest). */
const hollowTree = (): Piece => {
  const g = grid(84, 112)
  const cx = 42
  const ground = 106
  const bark: Ramp = ['#24160c', '#3c2814', '#583c20', '#74522c', '#8c6838']
  const leaves: Ramp = ['#0c2410', '#163c1c', '#24582a', '#3c7c38', '#5c9c48']
  for (const [dx, len] of [[-1, 1], [1, 1], [-0.6, 0.7], [0.7, 0.8]] as const) {
    limb(g, cx + dx * 26 * len, ground + 1, cx + dx * 8, ground - 12, 2, 4, bark)
  }
  cylinder(g, cx, ground, 13, 56, bark, {
    top: null,
    paint: (x, y, nx, e, l) => {
      if (e < 16 && Math.abs(nx + 0.05) < 0.38 && !(e > 13 && Math.abs(nx + 0.05) > 0.22)) return e < 3 ? '#e8c860' : '#100804'
      if (e > 28 && e < 33 && Math.abs(nx - 0.35) < 0.12) return '#100804'
      return shade(bark, l - (Math.round((nx + 1) * 7) % 3 === 0 ? 0.3 : 0) + (noise(x, e >> 2, 3) - 0.5) * 0.2, x, y)
    },
  })
  const cy = ground - 72
  const blobs: Blob[] = [
    { x: cx - 18, y: cy - 14, rx: 17, ry: 13 },
    { x: cx + 16, y: cy - 16, rx: 18, ry: 13 },
    { x: cx, y: cy - 22, rx: 17, ry: 12 },
    { x: cx - 30, y: cy + 2, rx: 13, ry: 11 },
    { x: cx + 30, y: cy, rx: 13, ry: 11 },
    { x: cx - 12, y: cy + 4, rx: 15, ry: 11 },
    { x: cx + 12, y: cy + 6, rx: 15, ry: 11 },
  ]
  sculpt(g, blobs, leaves, { tag: 10, rough: 0.25, seed: 7 })
  // Vines down the trunk and glowing mushrooms at its foot.
  for (const vx of [cx - 9, cx + 6, cx + 10]) for (let y = cy + 12; y < cy + 12 + (vx % 7) * 3 + 10; y++) put(g, vx + ((y >> 2) % 2), y, '#3c7c38')
  stamp(g, ['.11.', '1221', '.33.'], { 1: '#78e0c8', 2: '#c8fff0', 3: '#e8e0c0' }, cx + 13, ground - 3)
  stamp(g, ['.1.', '121', '.3.'], { 1: '#78e0c8', 2: '#c8fff0', 3: '#e8e0c0' }, cx - 18, ground - 2)
  outline(g, '#0c0804')
  return piece(g, cx, ground)
}

/** A rock spire crowned with moon-colored crystals (cave, Mt. Moon). */
const crystalSpire = (): Piece => {
  const g = grid(56, 104)
  const cx = 28
  const ground = 98
  const stone: Ramp = ['#241c1e', '#3e3436', '#5c5052', '#7c6e6e', '#9c8e8a']
  const crystal: Ramp = ['#382878', '#6050c0', '#9890f0', '#d8d8ff', '#ffffff']
  cone(g, cx + 9, ground - 1, 7, 26, stone, { rows: 4 })
  cone(g, cx - 1, ground, 15, 74, stone, { rows: 6, ry: 5 })
  cone(g, cx - 12, ground + 1, 6, 18, stone, { rows: 4 })
  sculpt(g, [{ x: cx - 16, y: ground, rx: 5, ry: 3 }, { x: cx + 15, y: ground + 1, rx: 4, ry: 2.5 }], stone, { tag: 30, facets: 2, seed: 3 })
  shard(g, cx - 1, ground - 66, 24, 9, 0, crystal)
  shard(g, cx - 6, ground - 62, 16, 6, -0.5, crystal)
  shard(g, cx + 4, ground - 61, 15, 6, 0.55, crystal)
  shard(g, cx - 9, ground - 34, 10, 4, -0.9, crystal)
  shard(g, cx + 12, ground - 10, 9, 4, 0.7, crystal)
  outline(g, '#140e10')
  return piece(g, cx, ground)
}

/** A snowed-in stone watchtower with icicles (snow, Mt. Silver). */
const frozenTower = (): Piece => {
  const g = grid(44, 104)
  const cx = 22
  const ground = 98
  const stone: Ramp = ['#1e2a3c', '#34445c', '#4e6280', '#6c84a4', '#90a8c8']
  const snow: Ramp = ['#90a8c8', '#c8d8f0', '#e8f0fa', '#ffffff']
  const d = door('#0c1420')
  const face = windows(stone, [{ at: 34, dark: '#0c1420', glow: '#a8e8ff' }, { at: 56, dark: '#0c1420' }], '#1a2434')
  cylinder(g, cx, ground, 13, 72, stone, { top: snow, paint: (x, y, nx, e, l) => d(x, y, nx, e) ?? face(x, y, nx, e, l) })
  // Battlements under a thick snow cap.
  for (let i = -2; i <= 2; i++) cylinder(g, cx + i * 5.5, ground - 72 + Math.abs(i) * -1 + 5, 2, 6, stone, { top: snow, ry: 1 })
  sculpt(g, [{ x: cx - 5, y: ground - 79, rx: 9, ry: 5 }, { x: cx + 6, y: ground - 78, rx: 9, ry: 5 }, { x: cx, y: ground - 76, rx: 13, ry: 5 }], snow, { tag: 30, rough: 0.1 })
  for (let x = cx - 12; x <= cx + 12; x += 2) {
    const len = 1 + Math.floor(noise(x, 1, 9) * 5)
    for (let k = 0; k < len; k++) put(g, x, ground - 71 + k, k === len - 1 ? '#ffffff' : '#c8e8ff')
  }
  outline(g, '#0c1420')
  return piece(g, cx, ground)
}

/** Pokémon Tower: tall, purple, a ghostly light in every window (tower biome). */
const ghostTower = (): Piece => {
  const g = grid(46, 124)
  const cx = 23
  const ground = 118
  const stone: Ramp = ['#241c30', '#3c3048', '#584870', '#7a6a90', '#9a8cb0']
  const roof: Ramp = ['#140c1c', '#241830', '#3c2848', '#583c68']
  const d = door('#0c0814')
  const glow = '#c890f8'
  const face = windows(stone, [{ at: 22, dark: '#0c0814', glow }, { at: 46, dark: '#0c0814', glow }, { at: 70, dark: '#0c0814', glow }], '#1c1428')
  cylinder(g, cx, ground, 14, 88, stone, { top: null, paint: (x, y, nx, e, l) => d(x, y, nx, e) ?? face(x, y, nx, e, l) })
  for (const at of [32, 58, 84]) cylinder(g, cx, ground - at, 15.5, 3, stone, { ry: 6.2, top: null, paint: (x, y, _nx, _e, l) => shade(stone, l + 0.15, x, y) })
  cone(g, cx, ground - 88, 15, 18, roof, { rows: 3, ry: 6 })
  limb(g, cx, ground - 104, cx, ground - 112, 1, 0.5, stone)
  outline(g, '#0c0814')
  return piece(g, cx, ground)
}

/* ---------------- Biome skins ---------------- */

/** How a biome dresses each kind of terrain. */
type TerrainSet = {
  rock: (seed: number) => Piece
  tree: (seed: number) => Piece
  bush: (variant: number) => Piece
  log: (variant: number) => Piece
  cliff: (tiers: readonly Tier[], seed: number) => Piece
  lake: (foot: readonly Blob[], seed: number) => Piece
  tower: () => Piece
  /** What grows on a mountain's top. */
  crest: (seed: number) => Piece
}

const LILY = ['.111.', '12221', '1222.', '.111.']
const REEDS = ['.2..2', '.2.12', '12.1.', '1.11.', '.111.']
const BUBBLE = ['.1.', '1.1', '.1.']

const place = (g: Grid, spot: readonly [number, number] | null, rows: readonly string[], palette: Readonly<Record<string, string>>) => spot && stamp(g, rows, palette, ...spot)
const shardAt = (g: Grid, spot: readonly [number, number] | null, length: number, width: number, angle: number, ramp: Ramp) =>
  spot && shard(g, spot[0], spot[1], length, width, angle, ramp)

const MEADOW_ROCK: RockSkin = { stone: ['#4c4c58', '#6e6e7c', '#9090a0', '#b4b4c4', '#d8d8e4'], outline: '#1c1c24', moss: ['#3a7a30', '#58a040', '#80c058'] }
const MEADOW_TREE: TreeSkin = {
  leaves: ['#1a4c20', '#2c7030', '#45983a', '#69b84c', '#94d468'],
  trunk: ['#3c2414', '#5c3c20', '#7c5430', '#9c6c40'],
  outline: '#122a12',
}

const FOREST_ROCK: RockSkin = { stone: ['#343c38', '#505a54', '#707a72', '#949e94'], outline: '#0c140e', moss: ['#24582a', '#3c7c38', '#5c9c48'] }
const FOREST_TREE: TreeSkin = {
  leaves: ['#0c2812', '#163e1c', '#24582a', '#387838', '#56984a'],
  trunk: ['#24160c', '#3c2814', '#583c20', '#74522c'],
  outline: '#081408',
}

const CAVE_ROCK: RockSkin = {
  stone: ['#2c2426', '#4a3e40', '#6c5e5e', '#8c7e7c', '#b0a4a0'],
  outline: '#140e10',
  crystal: ['#283878', '#4868c8', '#88b0f8', '#d0e4ff'],
}

const SNOW_ROCK: RockSkin = { stone: ['#2c3648', '#46546c', '#66788f', '#8a9cb4'], outline: '#101a28', snow: ['#a8c0dc', '#d8e6f6', '#f4f8ff', '#ffffff'] }
const SNOW_PINE: TreeSkin = {
  leaves: ['#0c2420', '#163a34', '#245a4c', '#367a62'],
  trunk: ['#2c1c14', '#4a3020', '#6a4630'],
  outline: '#0a1820',
  snow: ['#9cb4d4', '#d0e0f4', '#f0f6ff', '#ffffff'],
}

const TOWER_STONE: RockSkin = { stone: ['#2c2638', '#4a4258', '#6a6280', '#8e86a4', '#b0a8c4'], outline: '#120c18' }
export const TOWER_TREE: TreeSkin = { leaves: [], trunk: ['#1c1424', '#342840', '#4c3c5c', '#6a5878'], outline: '#0c0814', fruit: '#b070c8' }

/** Each biome's stone, for scenery that borrows it (landmarks' columns). */
export const ROCK_SKINS: Record<BiomeId, RockSkin> = { meadow: MEADOW_ROCK, forest: FOREST_ROCK, cave: CAVE_ROCK, snow: SNOW_ROCK, tower: TOWER_STONE }

const SKINS: Record<BiomeId, () => TerrainSet> = {
  meadow: () => ({
    rock: (seed) => boulder(MEADOW_ROCK, 14, seed),
    tree: (seed) => roundTree(MEADOW_TREE, 15, 9, seed),
    bush: (v) => bush({ leaves: MEADOW_TREE.leaves, outline: MEADOW_TREE.outline, bloom: ['#f87890', '#d83838'] }, v),
    log: (v) => logPiece(LOG_SKINS.meadow, 34 + v * 4, 4.5, 3 + v),
    crest: (seed) => roundTree(MEADOW_TREE, 10, 6, seed),
    cliff: (tiers, seed) =>
      cliff(tiers, { face: ['#5a3a20', '#7c5230', '#a07040', '#c08c50', '#d8a868'], top: ['#5c9c40', '#74b452', '#86c860', '#9cd874'], lip: '#c8f098', outline: '#24180c', strata: 6 }, seed),
    lake: (foot, seed) =>
      lake(foot, { deep: '#2c5cb0', mid: '#3c74cc', edge: '#64a0e8', bank: ['#6a4a28', '#8c6638'], shore: ['#a89060', '#c8b078', '#d8c490'], sparkle: '#d8f0ff' }, seed, (g, at) => {
        for (const [x, y] of [[-30, 2], [-22, 8], [18, -2], [30, 6]] as const) place(g, at(x, y), LILY, { 1: '#2a6a30', 2: '#5ca444' })
        place(g, at(-21, 8), ['.1.', '121', '.1.'], { 1: '#f8a0c8', 2: '#fff8c0' })
      }),
    tower: sproutTower,
  }),
  forest: () => ({
    rock: (seed) => boulder(FOREST_ROCK, 14, seed),
    tree: (seed) => roundTree(FOREST_TREE, 17, 12, seed),
    bush: (v) => bush({ leaves: FOREST_TREE.leaves, outline: FOREST_TREE.outline, bloom: ['#e04838', '#f8e0d0'] }, v),
    log: (v) => logPiece(LOG_SKINS.forest, 34 + v * 4, 4.5, 3 + v),
    crest: (seed) => roundTree(FOREST_TREE, 11, 7, seed),
    cliff: (tiers, seed) =>
      cliff(tiers, { face: ['#20140c', '#382618', '#523a22', '#6c4e2e', '#86643a'], top: ['#2c5a2a', '#386c34', '#447c3c', '#548c46'], lip: '#6ca054', outline: '#100a06', strata: 7, roots: '#4a3018' }, seed),
    lake: (foot, seed) =>
      lake(foot, { deep: '#1a3a30', mid: '#244c40', edge: '#386a54', bank: ['#2c2014', '#4a3420'], shore: ['#4a3c26', '#5c4c30', '#6c5a3a'], sparkle: '#88c0a0' }, seed, (g, at) => {
        for (const [x, y] of [[-34, -6], [26, -8], [36, 2], [-40, 2]] as const) place(g, at(x, y), REEDS, { 1: '#2c5a2a', 2: '#7a4c24' })
        for (const [x, y] of [[-10, 6], [14, 4]] as const) place(g, at(x, y), LILY, { 1: '#1c4c24', 2: '#3c7a38' })
      }),
    tower: hollowTree,
  }),
  cave: () => ({
    rock: (seed) => boulder(CAVE_ROCK, 14, seed),
    tree: (seed) => stalagmites(CAVE_ROCK, seed),
    bush: (v) => mushrooms(v),
    log: (v) => logPiece(LOG_SKINS.cave, 34 + v * 4, 4.5, 3 + v),
    crest: (seed) => boulder({ ...CAVE_ROCK, crystal: undefined }, 8, seed),
    cliff: (tiers, seed) =>
      cliff(tiers, { face: ['#1c1416', '#342a2c', '#4e4244', '#6a5c5c', '#88797a'], top: ['#5e5254', '#746666', '#867878', '#9a8c8a'], lip: '#b8aca8', outline: '#100a0c', strata: 5 }, seed),
    lake: (foot, seed) =>
      lake(foot, { deep: '#0a2438', mid: '#123a54', edge: '#1c5874', bank: ['#241c1e', '#3c3234'], shore: ['#4a3e40', '#5a4e50', '#6a5e5e'], sparkle: '#68d0ff' }, seed, (g, at) => {
        shardAt(g, at(-44, 0), 8, 3, -0.4, ['#283878', '#4868c8', '#88b0f8', '#d0e4ff'])
        shardAt(g, at(40, -4), 10, 3.5, 0.4, ['#582878', '#a058d8', '#d8a8ff', '#f8e0ff'])
      }),
    tower: crystalSpire,
  }),
  snow: () => ({
    rock: (seed) => boulder(SNOW_ROCK, 14, seed),
    tree: (seed) => pine(SNOW_PINE, 40, 24, seed),
    bush: (v) => bush({ leaves: SNOW_PINE.leaves, outline: SNOW_PINE.outline, snow: SNOW_PINE.snow }, v),
    log: (v) => logPiece(LOG_SKINS.snow, 34 + v * 4, 4.5, 3 + v),
    crest: (seed) => pine(SNOW_PINE, 26, 16, seed),
    cliff: (tiers, seed) =>
      cliff(tiers, { face: ['#1a2436', '#2e3e56', '#465a78', '#627a9a', '#869ebe'], top: ['#c4d4ea', '#d8e4f4', '#eaf2fc', '#ffffff'], lip: '#ffffff', outline: '#0c1422', strata: 6, icicles: '#c8e8ff' }, seed),
    lake: (foot, seed) =>
      lake(foot, { deep: '#7cb0dc', mid: '#98c6ec', edge: '#c0e0f8', bank: ['#a8c0dc', '#c8d8f0'], shore: ['#c8d6ea', '#e0eaf6', '#f4f8ff'], sparkle: '#ffffff', ice: { crack: '#5888b8', streak: '#e8f6ff' } }, seed),
    tower: frozenTower,
  }),
  tower: () => ({
    rock: (seed) => brokenPillar(TOWER_STONE, seed),
    tree: () => deadTree(TOWER_TREE),
    bush: (v) => thornBush(TOWER_TREE, v),
    log: (v) => logPiece(LOG_SKINS.tower, 34 + v * 4, 4.5, 3 + v),
    crest: (seed) => brokenPillar(TOWER_STONE, seed + 1),
    cliff: (tiers, seed) =>
      cliff(tiers, { face: ['#2c2638', '#423a52', '#5a5270', '#746c8c', '#8c84a4'], top: ['#463e56', '#524a64', '#5e5672', '#6c6482'], lip: '#a098b4', outline: '#100c18', mortar: '#1e1828' }, seed),
    lake: (foot, seed) =>
      lake(foot, { deep: '#241634', mid: '#342248', edge: '#4c3666', bank: ['#1c1628', '#2c2438'], shore: ['#3c3448', '#4a4058', '#564c66'], sparkle: '#b888e0' }, seed, (g, at) => {
        for (const [x, y] of [[-20, 2], [8, -4], [24, 6], [-6, 9]] as const) place(g, at(x, y), BUBBLE, { 1: '#8a68b0' })
      }),
    tower: ghostTower,
  }),
}

/** The footprint's shadow on the ground, offset toward the lower right (the sun is upper left). */
export const footShadow = (foot: readonly Blob[], grow = 1): Piece => {
  const minX = Math.min(...foot.map((e) => e.x - e.rx)) - grow - 2
  const maxX = Math.max(...foot.map((e) => e.x + e.rx)) + grow + 2
  const minY = Math.min(...foot.map((e) => e.y - e.ry)) - grow - 2
  const maxY = Math.max(...foot.map((e) => e.y + e.ry)) + grow + 2
  const g = grid(maxX - minX, maxY - minY)
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) if (inFoot(foot, x + 0.5 + minX, y + 0.5 + minY, grow)) put(g, x, y, '#000000')
  return piece(g, -minX, -minY)
}

/* ---------------- Drawing ---------------- */

const sets = canvasCache<BiomeId, TerrainSet>()
const setOf = (biome: BiomeId) => {
  let set = sets.get(biome)
  if (!set) sets.set(biome, (set = SKINS[biome]()))
  return set
}

/** A terraced hill in `biome`'s skin, without crests: the cave's mouth is carved into one. */
export const cliffOf = (biome: BiomeId, tiers: readonly Tier[], seed: number) => setOf(biome).cliff(tiers, seed)

const raised = (tiers: readonly Tier[], tier: number) => tiers.slice(0, tier).reduce((s, t) => s + t.h, 0)

/** A mountain of any footprint in `biome`'s skin, with what grows on its top at `crests` ([x, y, tier]): the tunnel's ridge. */
export const mountainOf = (biome: BiomeId, tiers: readonly Tier[], crests: readonly (readonly [number, number, number])[], seed: number) => mountain(setOf(biome), tiers, crests, seed)

/** A mountain with what grows on its top, baked into one sprite. `crests` are [x, y, tier] spots on its tops. */
const mountain = (set: TerrainSet, tiers: readonly Tier[], crestSpots: readonly (readonly [number, number, number])[], seed: number): Piece => {
  // (Shared by the map's mountains and the tunnel's ridge, `mountainOf`.)
  const base = set.cliff(tiers, seed)
  const crests = crestSpots.map(([x, y, tier], i) => ({ p: set.crest(30 + i), x, y: y - raised(tiers, tier) }))
  const parts = [{ p: base, x: 0, y: 0 }, ...crests.sort((a, b) => a.y - b.y)]
  const x0 = Math.min(...parts.map((c) => c.x - c.p.ax))
  const y0 = Math.min(...parts.map((c) => c.y - c.p.ay))
  const x1 = Math.max(...parts.map((c) => c.x - c.p.ax + c.p.sprite.width))
  const y1 = Math.max(...parts.map((c) => c.y - c.p.ay + c.p.sprite.height))
  const canvas = createCanvas(x1 - x0, y1 - y0)
  const ctx = context2d(canvas)
  for (const c of parts) ctx.drawImage(c.p.sprite, c.x - c.p.ax - x0, c.y - c.p.ay - y0)
  return { sprite: canvas, ax: -x0, ay: -y0 }
}

type PieceKind = SolidKind | 'lake'
type AnyPiece = PieceKind | ArenaPiece | PlacePiece | LandmarkPiece

const isArenaPiece = (kind: AnyPiece): kind is ArenaPiece => kind in ARENA_PIECES
const isPlacePiece = (kind: AnyPiece): kind is PlacePiece => kind in PLACE_PIECES
const isLandmarkPiece = (kind: AnyPiece): kind is LandmarkPiece => kind in LANDMARK_PIECES

const VARIANTS: Record<PieceKind, number> = {
  rock: RULES.rockVariants,
  tree: RULES.treeVariants,
  bush: RULES.bushVariants,
  log: RULES.logVariants,
  tower: 1,
  cliff: CLIFFS.length,
  lake: LAKES.length,
}

const build = (biome: BiomeId, kind: PieceKind, variant: number): Piece => {
  const set = setOf(biome)
  switch (kind) {
    case 'rock':
      return set.rock(variant + 1)
    case 'tree':
      return set.tree(variant + 1)
    case 'bush':
      return set.bush(variant)
    case 'log':
      return set.log(variant)
    case 'tower':
      return set.tower()
    case 'cliff':
      return mountain(set, CLIFFS[variant]!, CLIFF_CRESTS[variant]!, 21 + variant)
    case 'lake':
      return set.lake(LAKES[variant]!, 11 + variant)
  }
}

/** A cached piece: its sprite packed on its biome's pages (`keepPacked`), anchored like a `Piece`. */
export type KeptPiece = { packed: Packed; ax: number; ay: number }

/** The atlas group of a biome's sculpted pieces (`arena` for the arenas'), dropped with the biome (`keepTerrain`). */
const groupOf = (biome: BiomeId | 'arena') => `terrain:${biome}`

/** Hands a freshly built piece over to its biome's pages. */
const keepPiece = (biome: BiomeId | 'arena', p: Piece): KeptPiece => ({ packed: keepPacked(groupOf(biome), p.sprite), ax: p.ax, ay: p.ay })

const pieces = canvasCache<string, KeptPiece>()

/** A piece's sprite: its painted art once loaded (`render/scenery.ts`), else sculpted once per biome (and once more `open`, for a landmark's looted treasure). */
const pieceOf = (biome: BiomeId, kind: AnyPiece, variant: number, open = false): KeptPiece => {
  const art = isArenaPiece(kind) ? null : sceneryPiece(biome, kind, variant, open)
  if (art) return art
  // The arenas' scenery looks the same whatever the biome outside; places' entrances and landmarks wear the biome's.
  const key = isArenaPiece(kind) ? `arena:${kind}:${variant}` : `${biome}:${kind}:${variant}${open ? ':open' : ''}`
  let piece = pieces.get(key)
  if (!piece) {
    piece = isArenaPiece(kind)
      ? keepPiece('arena', ARENA_PIECES[kind](variant))
      : keepPiece(
          biome,
          isPlacePiece(kind)
            ? PLACE_PIECES[kind](variant, biome)
            : isLandmarkPiece(kind)
              ? LANDMARK_PIECES[kind](variant, biome, open)
              : build(biome, kind, variant),
        )
    pieces.set(key, piece)
  }
  return piece
}

const grounds = canvasCache<string, KeptPiece>()

/** A landmark's ground art, built once per biome. */
const groundOf = (biome: BiomeId, kind: LandmarkGround, variant: number) => {
  const key = `${biome}:${kind}:${variant}`
  let piece = grounds.get(key)
  if (!piece) grounds.set(key, (piece = keepPiece(biome, LANDMARK_GROUNDS[kind](variant, biome))))
  return piece
}

/** Builds at most one missing sprite of `biome`, so a biome's terrain is ready before it shows. True if it built one. */
export const warmTerrain = (biome: BiomeId) => {
  for (const kind of Object.keys(VARIANTS) as PieceKind[]) {
    for (let v = 0; v < VARIANTS[kind]; v++) {
      // Painted pieces only start loading; the sculpted one is built only if a picture is late.
      if (hasScenery(kind)) {
        sceneryPiece(biome, kind, v)
        continue
      }
      if (pieces.has(`${biome}:${kind}:${v}`)) continue
      pieceOf(biome, kind, v)
      return true
    }
  }
  // Landmarks' big pieces (the ridge, walls, hedges) take longer than a frame to sculpt.
  for (const [kind, v] of LANDMARK_WARM) {
    if (hasScenery(kind)) {
      sceneryPiece(biome, kind, v)
      continue
    }
    if (pieces.has(`${biome}:${kind}:${v}`)) continue
    pieceOf(biome, kind, v)
    return true
  }
  return false
}

let kept = ''

/**
 * Drops the sculpted sprites of every biome not in `keep` (the arenas' scenery stays). A run
 * never walks back into a biome it left, so its terrain would only sit in memory. Cheap when
 * `keep` didn't change.
 */
export const keepTerrain = (keep: readonly BiomeId[]) => {
  const id = keep.join()
  if (id === kept) return
  kept = id
  keepScenery(keep)
  for (const cache of [pieces, grounds, skirts]) {
    for (const key of cache.keys()) {
      const biome = key.slice(0, key.indexOf(':'))
      if (biome !== 'arena' && !(keep as readonly string[]).includes(biome)) cache.delete(key)
    }
  }
  // Their pages go now, not whenever the collector comes by: the next biome's are being built.
  for (const biome of Object.keys(BIOMES) as BiomeId[]) if (!keep.includes(biome)) dropKept(groupOf(biome))
}

const mountainShadows = CLIFFS.map((tiers) => lazy(() => footShadow(tiers[0]!.foot, 1)))

const blit = (ctx: CanvasRenderingContext2D, p: KeptPiece, x: number, y: number) => drawPacked(ctx, p.packed, Math.round(x - p.ax), Math.round(y - p.ay))

/** The solids around the view, for the depth sort with the Pokémon. */
export const solidsInView = (g: Game, camX: number, camY: number, w: number, h: number, out: { push: (s: Solid) => unknown }) => {
  // Generous margins: towers and mountains reach far above their footprint.
  for (const f of featuresNear(g, camX + w / 2, camY + h / 2 + 60, w / 2 + 90, h / 2 + 150)) for (const s of f.solids) out.push(s)
}

/* ---------------- Skirts ---------------- */

type Tuft = { rows: readonly string[]; palette: Readonly<Record<string, string>> }

/** What grows at the foot of scenery in each biome: grass and flowers, ferns and mushrooms, pebbles, drifts, dead tufts. */
const SKIRT_TUFTS: Record<BiomeId, readonly Tuft[]> = {
  meadow: [
    { rows: ['1.1.1', '12121'], palette: { 1: '#2f7a3a', 2: '#4f9e48' } },
    { rows: ['1.1', '.1.'], palette: { 1: '#5a9a40' } },
    { rows: ['.1.', '121', '.1.'], palette: { 1: '#f87890', 2: '#f8e048' } },
    { rows: ['.1.', '121', '.1.'], palette: { 1: '#ffffff', 2: '#f8b030' } },
  ],
  forest: [
    { rows: ['1...1', '.1.1.', '..1..'], palette: { 1: '#2a6a30' } },
    { rows: ['1.1.1', '12121'], palette: { 1: '#1c4a24', 2: '#2f7032' } },
    { rows: ['.11.', '1221', '.33.'], palette: { 1: '#902820', 2: '#e04838', 3: '#e8d8c0' } },
    { rows: ['1..', '.2.', '..1'], palette: { 1: '#c87830', 2: '#e8a040' } },
  ],
  cave: [
    { rows: ['1..', '..2', '.1.'], palette: { 1: '#4a3e40', 2: '#a89a98' } },
    { rows: ['.1', '12'], palette: { 1: '#3c3234', 2: '#867878' } },
    { rows: ['.1.', '121'], palette: { 1: '#283878', 2: '#88b0f8' } },
  ],
  snow: [
    { rows: ['.111.', '12221'], palette: { 1: '#f8fcff', 2: '#ffffff' } },
    { rows: ['1.1', '.1.', '1.1'], palette: { 1: '#90b0d0' } },
    { rows: ['.11.', '1221'], palette: { 1: '#d8e6f6', 2: '#b8c8e0' } },
  ],
  tower: [
    { rows: ['1...1', '.1.1.', '.121.'], palette: { 1: '#4c4060', 2: '#6c6080' } },
    { rows: ['1.1', '.2.', '1.1'], palette: { 1: '#b070c8', 2: '#f0d0ff' } },
    { rows: ['1..', '..2', '.1.'], palette: { 1: '#3c3448', 2: '#8a80a0' } },
  ],
}

const SKIRT_LOOKS = 4

/** A ring of tufts around a footprint's edge (`look` picks one of a few arrangements). Anchored at the foot's center. */
const skirt = (biome: BiomeId, look: number): Piece => {
  const g = grid(48, 18)
  const tufts = SKIRT_TUFTS[biome]
  for (let i = 0; i < 7; i++) {
    const a = noise(i, look, 3) * Math.PI * 2
    const r = 0.85 + noise(i, look, 4) * 0.35
    const tuft = tufts[Math.floor(noise(i, look, 5) * tufts.length)]!
    // Mostly in front and to the sides, where the foot meets the ground in sight.
    const x = 24 + Math.cos(a) * 17 * r
    const y = 9 + Math.abs(Math.sin(a)) * 5 * r * (noise(i, look, 6) < 0.75 ? 1 : -1)
    stamp(g, tuft.rows, tuft.palette, x - (tuft.rows[0]!.length >> 1), y - tuft.rows.length + 1)
  }
  return piece(g, 24, 9)
}

const skirts = canvasCache<string, KeptPiece>()

const skirtOf = (biome: BiomeId, look: number) => {
  const key = `${biome}:${look}`
  let p = skirts.get(key)
  if (!p) skirts.set(key, (p = keepPiece(biome, skirt(biome, look))))
  return p
}

const SKIRTED: ReadonlySet<string> = new Set<SolidKind>(['rock', 'tree', 'bush', 'log'])

const SHADOW = 'rgba(16,40,16,0.3)'
const SHADOW_RX: Record<Exclude<SolidKind, 'cliff'>, number> = { rock: 10, tree: 9, bush: 10, log: 15, tower: 17 }

const shadowOf = (kind: Exclude<AnyPiece, 'cliff' | 'lake'>) =>
  isArenaPiece(kind) ? ARENA_SHADOW[kind] : isPlacePiece(kind) ? PLACE_SHADOW[kind] : isLandmarkPiece(kind) ? LANDMARK_SHADOW[kind] : SHADOW_RX[kind]

/** Ground layer: landmarks' floors and paths, lakes and the shadows the solids cast. */
export const drawTerrainGround = (ctx: CanvasRenderingContext2D, g: Game, biome: BiomeId, camX: number, camY: number) => {
  const { w, h } = g.view
  for (const f of featuresNear(g, camX + w / 2, camY + h / 2, w / 2 + 90, h / 2 + 90)) {
    const ground = f.landmark?.ground
    if (ground) blit(ctx, groundOf(biome, ground.kind, ground.variant), ground.x, ground.y)
    if (f.lake) blit(ctx, pieceOf(biome, 'lake', f.lake.variant), f.lake.x, f.lake.y)
    for (const s of f.solids) {
      if (s.kind === 'cliff') {
        ctx.globalAlpha = 0.22
        const shade = mountainShadows[s.variant]!()
        ctx.drawImage(shade.sprite, Math.round(s.x + 5 - shade.ax), Math.round(s.y + 3 - shade.ay))
        ctx.globalAlpha = 1
      } else {
        const art = isArenaPiece(s.kind) ? null : sceneryPiece(biome, s.kind, s.variant)
        if (shadowOf(s.kind) > 0) {
          // Painted art is shaded by its own foot, tucked under where it meets the ground.
          const rx = art ? art.foot + 1 : shadowOf(s.kind)
          const ry = Math.round(rx * 0.4)
          drawPacked(ctx, ellipse(rx, ry, SHADOW), Math.round(s.x + 2 - rx), Math.round(art ? s.y + 2 - ry * 2 : s.y - ry))
        }
        if (SKIRTED.has(s.kind)) blit(ctx, skirtOf(biome, (s.x * 7 + s.y * 13) & (SKIRT_LOOKS - 1)), s.x, s.y + 1)
      }
    }
  }
}

/* See-through: a dithered window in tall scenery where the player stands behind it. */

const HOLE = 16

/** Two checkerboard discs, one per parity, so the dither stays locked to the world grid as the hole moves. */
const holes = [0, 1].map((parity) => {
  let disc: PixelSprite | null = null
  onCanvasReset(
    () => (disc = null),
    () => disc,
  )
  return () => {
    if (disc) return disc
    disc = createCanvas(HOLE * 2 + 1, HOLE * 2 + 1)
    const ctx = context2d(disc)
    ctx.fillStyle = '#000'
    for (let y = -HOLE; y <= HOLE; y++) for (let x = -HOLE; x <= HOLE; x++) if (x * x + y * y <= HOLE * HOLE && ((x + y + HOLE * 2 + parity) & 1) === 0) ctx.fillRect(x + HOLE, y + HOLE, 1, 1)
    return disc
  }
})

let scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null
onCanvasReset(
  () => (scratch = null),
  () => scratch,
)

const TALL: Record<SolidKind, boolean> = { rock: false, tree: true, bush: false, log: false, tower: true, cliff: true }

const tallOf = (kind: AnyPiece) =>
  isArenaPiece(kind) ? ARENA_TALL[kind] : isPlacePiece(kind) ? PLACE_TALL[kind] : isLandmarkPiece(kind) ? LANDMARK_TALL[kind] : kind !== 'lake' && TALL[kind]

/**
 * Whether solid `s` stands in front of a body `w`×`h` px with its feet at (x, y),
 * its art reaching over it: a player there stays in the depth sort (`render/draw.ts`).
 */
export const solidCovers = (g: Game, s: Solid, biome: BiomeId, x: number, y: number, w: number, h: number) => {
  if (y >= s.y) return false
  const piece = pieceOf(biome, s.kind, s.variant, s.loot !== undefined && g.landmarks.looted.has(s.loot))
  const left = s.x - piece.ax
  const top = s.y - piece.ay
  return x + w / 2 > left && x - w / 2 < left + piece.packed.w && y > top && y - h < top + piece.packed.h
}

/** Draws one solid; a tall one goes see-through around the player when they walk behind it. A looted landmark treasure shows open. */
export const drawSolid = (ctx: CanvasRenderingContext2D, g: Game, s: Solid, biome: BiomeId) => {
  const piece = pieceOf(biome, s.kind, s.variant, s.loot !== undefined && g.landmarks.looted.has(s.loot))
  const x = Math.round(s.x - piece.ax)
  const y = Math.round(s.y - piece.ay)
  const p = localPlayer(g)
  const hx = Math.round(p.x) - HOLE - x
  const hy = Math.round(p.y) - 12 - HOLE - y
  const { w, h } = piece.packed
  const behind = tallOf(s.kind) && p.y < s.y && hx > -HOLE * 2 && hy > -HOLE * 2 && hx < w && hy < h
  if (!behind) return drawPacked(ctx, piece.packed, x, y)
  if (!scratch || scratch.canvas.width < w || scratch.canvas.height < h) {
    const canvas = createCanvas(Math.max(w, scratch?.canvas.width ?? 0), Math.max(h, scratch?.canvas.height ?? 0))
    scratch = { canvas, ctx: context2d(canvas) }
  }
  const sc = scratch.ctx
  sc.clearRect(0, 0, w, h)
  drawPacked(sc, piece.packed, 0, 0)
  sc.globalCompositeOperation = 'destination-out'
  sc.drawImage(holes[(x + y + hx + hy) & 1]!(), hx, hy)
  sc.globalCompositeOperation = 'source-over'
  if (w > 0) ctx.drawImage(scratch.canvas, 0, 0, w, h, x, y, w, h)
}

const ripples = canvasCache<string, PixelSprite>()

/** A 1 px ellipse outline, cached per size. */
const ripple = (rx: number, ry: number) => {
  const key = `${rx},${ry}`
  let sprite = ripples.get(key)
  if (sprite) return sprite
  sprite = createCanvas(rx * 2 + 1, ry * 2 + 1)
  const ctx = context2d(sprite)
  ctx.fillStyle = '#d8f0ff'
  for (let a = 0; a < 64; a++) ctx.fillRect(Math.round(rx + Math.cos((a / 64) * Math.PI * 2) * rx), Math.round(ry + Math.sin((a / 64) * Math.PI * 2) * ry), 1, 1)
  ripples.set(key, sprite)
  return sprite
}

/** Rings spreading from the player's feet while they wade. */
export const drawWading = (ctx: CanvasRenderingContext2D, g: Game, width: number, t: number) => {
  const p = localPlayer(g)
  if (roomOf(g) || groundAt(g, p.x, p.y) !== 'water') return
  for (const k of [0, 0.5]) {
    const ph = (t * 1.2 + k) % 1
    const rx = Math.round(width * (0.3 + ph * 0.35))
    ctx.globalAlpha = 0.8 * (1 - ph)
    ctx.drawImage(ripple(rx, Math.max(1, Math.round(rx * 0.4))), Math.round(p.x - rx), Math.round(p.y - rx * 0.4))
  }
  ctx.globalAlpha = 1
}
