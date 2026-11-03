import { hash2 } from '../engine/rng'
import { BIOME_IDS, BIOME_MAP, BIOME_TIERS, START_BIOME, type BiomeId } from '../data/biomes'
import type { Game } from './types'

/**
 * The map's biomes, Minecraft style: a pure function of world position and
 * the run's terrain seed, so every client, the replay and the renderer agree
 * without keeping anything. Regions grow around points jittered off a grid
 * (`BIOME_MAP.region` apart), borders bent by a warp; each region's biome
 * comes from its tier (how far its point is from the start, `BIOME_TIERS`)
 * and a hash. Only `hash2`, `Math.floor` and plain arithmetic,
 * which every JS engine computes to the same bits.
 */

/** Salts for the map's hashes, apart from the terrain's own. */
const SALT = { warpX: 9101, warpY: 9102, fineX: 9103, fineY: 9104, jitterX: 9105, jitterY: 9106, pick: 9107, ring: 9108 } as const

const R = BIOME_MAP.region
/** The start region's head start in a power diagram: `start` px of border pushed out against a neighbor `region` px away. */
const START_WEIGHT = 2 * R * BIOME_MAP.start
/** Past the last ring: every biome but the meadow (the start is what makes it feel like home). */
const FAR = BIOME_IDS.filter((b) => b !== START_BIOME)

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Bilinear value noise in [0, 1). */
const noise = (x: number, y: number, scale: number, seed: number) => {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = smooth(gx - x0)
  const ty = smooth(gy - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

/** Where region (i, j)'s point stands, px. The start's sits on the origin. */
const siteX = (seed: number, i: number, j: number) => (i === 0 && j === 0 ? 0 : (i + (hash2(i, j, seed + SALT.jitterX) - 0.5) * BIOME_MAP.jitter) * R)
const siteY = (seed: number, i: number, j: number) => (i === 0 && j === 0 ? 0 : (j + (hash2(i, j, seed + SALT.jitterY) - 0.5) * BIOME_MAP.jitter) * R)

/** The tier of a region whose point is `d2` px² from the start: 0 nearest, `BIOME_TIERS.length` past the last ring. Each ring wobbles ±10% per region. */
const tierOf = (seed: number, i: number, j: number, d2: number) => {
  const wobble = 0.9 + hash2(i, j, seed + SALT.ring) * 0.2
  let tier = 0
  for (const ring of BIOME_MAP.rings) {
    const r = ring * wobble
    if (d2 < r * r) return tier
    tier++
  }
  return tier
}

/** Region (i, j)'s biome: the start's is the meadow; any other draws one of its tier's. */
export const regionBiome = (seed: number, i: number, j: number): BiomeId => {
  if (i === 0 && j === 0) return START_BIOME
  const x = siteX(seed, i, j)
  const y = siteY(seed, i, j)
  const tier = tierOf(seed, i, j, x * x + y * y)
  const list: readonly BiomeId[] = BIOME_TIERS[tier] ?? FAR
  return list[Math.floor(hash2(i, j, seed + SALT.pick) * list.length)]!
}

/**
 * What the map holds at a spot: its biome `a`, the nearest other biome `b`
 * across a border, and `t`, about how far (px, in the warped plane the borders
 * are drawn in; exact where the two regions' points are a grid step apart) the
 * spot sits inside `a` from that border (Infinity when no other biome is near).
 */
export type BiomeSample = { a: BiomeId; b: BiomeId; t: number }

/** One sample reused by `biomeAt` and the hot callers (no allocation per call). */
const SCRATCH: BiomeSample = { a: START_BIOME, b: START_BIOME, t: Infinity }

/** Power distance from (qx, qy) to region (i, j)'s point: the start's has its head start. */
const powerTo = (seed: number, qx: number, qy: number, i: number, j: number) => {
  const dx = qx - siteX(seed, i, j)
  const dy = qy - siteY(seed, i, j)
  return dx * dx + dy * dy - (i === 0 && j === 0 ? START_WEIGHT : 0)
}

/**
 * Samples the map at (x, y) for the run whose terrain seed is `seed` (into
 * `out`, which it returns). The spot is warped first, so borders wave; then
 * the nearest region point wins, the start's with a head start
 * (`BIOME_MAP.start`). With a jitter under 0.6 of the grid the nearest point
 * is always within the 3×3 regions around the spot. The border is looked for
 * among the regions around that winner (not around the spot), so `t` runs
 * smoothly across a whole region: no seams.
 */
export const sampleBiome = (seed: number, x: number, y: number, out: BiomeSample = SCRATCH): BiomeSample => {
  const { warp } = BIOME_MAP
  // The warp eases in away from the start, so the run always opens well inside the meadow.
  const calm = Math.min(1, (x * x + y * y) / (warp.calm * warp.calm))
  const amp = warp.amp * 2 * calm
  const fine = warp.fine.amp * 2 * calm
  const qx = x + (noise(x, y, warp.scale, seed + SALT.warpX) - 0.5) * amp + (noise(x, y, warp.fine.scale, seed + SALT.fineX) - 0.5) * fine
  const qy = y + (noise(x, y, warp.scale, seed + SALT.warpY) - 0.5) * amp + (noise(x, y, warp.fine.scale, seed + SALT.fineY) - 0.5) * fine
  const ci = Math.floor(qx / R + 0.5)
  const cj = Math.floor(qy / R + 0.5)
  let bi = ci
  let bj = cj
  let best = Infinity
  for (let j = cj - 1; j <= cj + 1; j++) {
    for (let i = ci - 1; i <= ci + 1; i++) {
      const p = powerTo(seed, qx, qy, i, j)
      if (p < best) {
        best = p
        bi = i
        bj = j
      }
    }
  }
  const a = regionBiome(seed, bi, bj)
  // The nearest point of another biome among the winner's neighbors. The border runs where the two
  // powers meet; their gap over twice the grid's spacing measures how far off it lies, smoothly
  // everywhere (both are minimums of smooth functions), even across regions of one biome.
  let other = Infinity
  let b: BiomeId = a
  for (let j = bj - 1; j <= bj + 1; j++) {
    for (let i = bi - 1; i <= bi + 1; i++) {
      const biome = regionBiome(seed, i, j)
      if (biome === a) continue
      const p = powerTo(seed, qx, qy, i, j)
      if (p < other) {
        other = p
        b = biome
      }
    }
  }
  out.a = a
  out.b = b
  out.t = (other - best) / (2 * R)
  return out
}

/** The biome at (x, y) for the run whose terrain seed is `seed`. */
export const biomeAt = (seed: number, x: number, y: number): BiomeId => sampleBiome(seed, x, y).a

/** The biome at (x, y) of this run's map. Inside a room (a rift, a place) the spot is no map spot: callers ask a player's `biome` instead. */
export const biomeOf = (g: Game, x: number, y: number): BiomeId => biomeAt(g.terrain.seed, x, y)
