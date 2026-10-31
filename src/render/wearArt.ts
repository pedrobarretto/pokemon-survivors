import { PITCH } from './wearFit'

/**
 * A tiny 3D-to-pixel-art renderer for the Arena's wearables
 * (`render/wearables.ts`). Each wearable is a small model (`render/wearModels.ts`):
 * a signed distance function in px, y up and z toward the wearer's front, and
 * a paint function that picks one of its color ramps at a point of the
 * surface. Rendering it turned toward a direction gives that direction's art,
 * so one model fits every direction and every head size, the way PMD's artists
 * turn a Pokémon around: an orthographic camera looking down at the sprites'
 * own angle, light from the top left, every pixel taking one of its ramp's
 * four tones (shadow, base, light, glint), a 1 px dark outline around the
 * shape and a darker line where a nearer part overlaps a farther one. A pixel
 * on the shape's edge is solid when at least half of its 3×3 samples hit, so
 * curves come out the hard-edged pixel-art way, never blended.
 */

/** A color ramp, darkest to lightest: shadow, base, light and glint. */
export type Ramp = readonly [string, string, string, string]

export type Scene = {
  /** Signed distance to the surface (px) at local (x, y, z): y up, z the wearer's front, x its left (screen right facing south). */
  sdf: (x: number, y: number, z: number) => number
  /**
   * The index (in `ramps`) of the color at a point of the surface, or a negative
   * number where the surface is an occluder: drawn as nothing, it hides what's
   * behind it (the head behind a band, the neck behind a scarf's back half).
   */
  paint: (x: number, y: number, z: number) => number
  ramps: readonly Ramp[]
  /** Which part of the model a point of the surface belongs to: where a nearer part overlaps another, the farther one gets a dark line. */
  part?: (x: number, y: number, z: number) => number
  /** Ramps lit evenly (their base and light tones only by facing): glass, a glow. */
  flat?: readonly number[]
  /** The outline's color; by default each ramp's shadow, darkened. */
  ink?: string
  /** A ramp's own outline color by index, or null for none (a glow, a flame, a string). */
  inks?: Readonly<Record<number, string | null>>
  /** How much of each distance the march trusts (0..1): below 1 for bent shapes, whose distances overshoot. */
  step?: number
  /** The model's bounds (px): its radius around the y axis and its height range. */
  r: number
  top: number
  bottom: number
}

/**
 * One direction's art: `px` holds indexes into `colors` (0 is clear), and
 * (`ox`, `oy`) is the pixel the model's origin lands on. For the dresser
 * (`render/wearDress.ts`), per pixel: `edge` marks the outline around the
 * shape (its own, which the dresser redraws around the dressed frame), `ink`
 * the outline color a shape's pixel takes (0: none), and `back` a pixel of its
 * far half, seen from the camera (what grows from the head shows through a
 * crown's far side; a scarf's far half goes behind the neck).
 */
export type PixelArt = { w: number; h: number; ox: number; oy: number; px: Uint8Array; colors: readonly string[]; edge: Uint8Array; ink: Uint8Array; back: Uint8Array }

/** Where the light comes from, on screen: the top left, a little toward the viewer. */
const LIGHT = (() => {
  const [x, y, z] = [-0.5, 0.8, 0.35]
  const n = Math.hypot(x, y, z)
  return [x / n, y / n, z / n] as const
})()

/** Samples per pixel side. */
const SS = 3
/** Depth (px) by which a neighbor of another part must be nearer for this pixel to get a line. */
const EDGE = 1
/** Depth (px) past which a part folding over itself (a bent tip) gets a line too: more than a horizontal surface drops per pixel (cot 30° ≈ 1.7). */
const FOLD = 4.5

const hex = (c: string) => parseInt(c.slice(1, 7), 16)
const toHex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
/** A color darkened toward black by `k` (0..1), keeping a hint of its hue. */
export const darken = (c: string, k: number) => {
  const n = hex(c)
  const f = (v: number) => Math.round(v * (1 - k))
  return toHex((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255))
}

/** Which ramp tone a surface lit at `lambert` (−1..1) takes. */
const tone = (lambert: number, flat: boolean) => (flat ? (lambert > 0.2 ? 2 : 1) : lambert > 0.9 ? 3 : lambert > 0.5 ? 2 : lambert > -0.15 ? 1 : 0)

/**
 * Renders `scene` turned by `yaw` (radians; 0 faces the camera, π/2 faces
 * screen right, π faces away) into pixel art.
 */
export const rasterize = (scene: Scene, yaw: number): PixelArt => {
  const { sdf, paint, ramps, r, top, bottom } = scene
  const cp = Math.cos(PITCH)
  const sp = Math.sin(PITCH)
  const cy = Math.cos(yaw)
  const sy = Math.sin(yaw)
  // The art's size: the bounds projected, plus the outline.
  const half = Math.ceil(r) + 2
  const up = Math.ceil(top * cp + r * sp) + 2
  const down = Math.ceil(-bottom * cp + r * sp) + 2
  const w = half * 2 + 1
  const h = up + down + 1
  const n = w * h
  // The light turned into the model's frame.
  const lx = LIGHT[0] * cy - LIGHT[2] * sy
  const lz = LIGHT[0] * sy + LIGHT[2] * cy
  const ly = LIGHT[1]
  const reach = Math.hypot(r, Math.max(top, -bottom)) + 1
  const trust = scene.step ?? 1
  const far = reach * 3
  const q = [0, 0, 0]
  /** Marches the ray through the camera plane at (u, v): its depth at the surface (the point in `q`), or −1 for a miss or an occluder. */
  const march = (u: number, v: number) => {
    // The camera plane through the origin, looking down at PITCH.
    const oy = v * cp + far * sp
    const oz = -v * sp + far * cp
    let t = far - reach
    for (let step = 0; step < 64 && t < far + reach; step++) {
      const wy = oy - sp * t
      const wz = oz - cp * t
      q[0] = u * cy - wz * sy
      q[1] = wy
      q[2] = u * sy + wz * cy
      const d = sdf(q[0], q[1], q[2])
      if (d < 0.01) return paint(q[0], q[1], q[2]) < 0 ? -1 : t
      t += Math.max(d * trust, 0.02)
    }
    return -1
  }
  // First a ray through each pixel's center; then, only where a pixel's center and a neighbor's disagree
  // (the shape's edges), 3×3 samples decide its coverage. A pixel takes the surface its center sees, or
  // its nearest sample's.
  const depth = new Float32Array(n).fill(-1)
  // A point farther from the camera than the model's origin is on its far side (`PixelArt.back`).
  const farther = far + 0.3
  const point = new Float32Array(n * 3)
  const keep = (k: number, t: number) => {
    depth[k] = t
    point[k * 3] = q[0]!
    point[k * 3 + 1] = q[1]!
    point[k * 3 + 2] = q[2]!
  }
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const t = march(i - half, up - j)
    if (t >= 0) keep(j * w + i, t)
  }
  const seen = (i: number, j: number) => i >= 0 && j >= 0 && i < w && j < h && depth[j * w + i]! >= 0
  const solid = new Uint8Array(n)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      const center = depth[k]! >= 0
      let edge = false
      for (let dj = -1; dj <= 1 && !edge; dj++) for (let di = -1; di <= 1; di++) if (seen(i + di, j + dj) !== center) edge = true
      if (!edge) {
        solid[k] = center ? 1 : 0
        continue
      }
      let count = center ? 1 : 0
      let nearest = Infinity
      for (let b = 0; b < SS; b++) {
        for (let a = 0; a < SS; a++) {
          if (a === 1 && b === 1) continue
          const t = march(i - half + (a + 0.5) / SS - 0.5, up - j - (b + 0.5) / SS + 0.5)
          if (t < 0) continue
          count++
          const off = (a - 1) * (a - 1) + (b - 1) * (b - 1)
          if (!center && off < nearest) {
            nearest = off
            keep(k, t)
          }
        }
      }
      solid[k] = count * 2 >= SS * SS ? 1 : 0
    }
  }
  // The surface each solid pixel shows: its ramp, its part and its tone.
  const mat = new Int16Array(n).fill(-1)
  const parts = new Int16Array(n)
  const shade = new Uint8Array(n)
  const back = new Uint8Array(n)
  const e = 0.04
  for (let k = 0; k < n; k++) {
    if (!solid[k]) continue
    const x = point[k * 3]!
    const y = point[k * 3 + 1]!
    const z = point[k * 3 + 2]!
    const m = paint(x, y, z)
    if (m < 0) {
      solid[k] = 0
      continue
    }
    mat[k] = m
    back[k] = depth[k]! > farther ? 1 : 0
    parts[k] = scene.part?.(x, y, z) ?? 0
    const nx = sdf(x + e, y, z) - sdf(x - e, y, z)
    const ny = sdf(x, y + e, z) - sdf(x, y - e, z)
    const nz = sdf(x, y, z + e) - sdf(x, y, z - e)
    const len = Math.hypot(nx, ny, nz) || 1
    shade[k] = tone((nx * lx + ny * ly + nz * lz) / len, scene.flat?.includes(m) ?? false)
  }
  // A lone pixel with no solid side is a speck and goes.
  const at = (i: number, j: number) => (i >= 0 && j >= 0 && i < w && j < h ? j * w + i : -1)
  const NB = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      if (solid[k] && NB.every(([dx, dy]) => solid[at(i + dx, j + dy)] !== 1)) solid[k] = 0
    }
  }
  // Colors: each ramp's four tones, then each ramp's ink.
  const inks = ramps.map((ramp, m) => {
    const own = scene.inks?.[m]
    return own === undefined ? (scene.ink ?? darken(ramp[0], 0.6)) : own
  })
  const colors = ['', ...ramps.flat(), ...inks.map((ink) => ink ?? '')]
  // A ramp without an outline draws its shadow where its depth lines would go.
  const inkOf = (m: number) => (inks[m] === null ? 1 + m * 4 : 1 + ramps.length * 4 + m)
  const px = new Uint8Array(n)
  const edge = new Uint8Array(n)
  const ink = new Uint8Array(n)
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i
      if (solid[k]) {
        const m = mat[k]!
        if (inks[m] !== null) ink[k] = inkOf(m)
        // A nearer neighbor in front of this pixel: a line on this, the farther, side.
        const behind = NB.some(([dx, dy]) => {
          const o = at(i + dx, j + dy)
          return o >= 0 && solid[o] === 1 && depth[o]! < depth[k]! - (parts[o] === parts[k] ? FOLD : EDGE)
        })
        px[k] = behind ? inkOf(m) : 1 + m * 4 + shade[k]!
        continue
      }
      // The outline: a clear pixel beside the shape takes the ink of its first solid neighbor that has one.
      for (const [dx, dy] of NB) {
        const o = at(i + dx, j + dy)
        if (o >= 0 && solid[o] && inks[mat[o]!] !== null) {
          px[k] = inkOf(mat[o]!)
          edge[k] = 1
          break
        }
      }
    }
  }
  return { w, h, ox: half, oy: up, px, colors, edge, ink, back: Uint8Array.from(back, (b, k) => (solid[k] ? b : 0)) }
}

/** The art mirrored left to right (the west-facing directions are the east-facing ones flipped, like the sheets). */
export const mirror = (art: PixelArt): PixelArt => {
  const flip = (a: Uint8Array) => {
    const out = new Uint8Array(a.length)
    for (let j = 0; j < art.h; j++) for (let i = 0; i < art.w; i++) out[j * art.w + i] = a[j * art.w + art.w - 1 - i]!
    return out
  }
  return { ...art, ox: art.w - 1 - art.ox, px: flip(art.px), edge: flip(art.edge), ink: flip(art.ink), back: flip(art.back) }
}

/* ---------------- Shapes (signed distances, px) ---------------- */

export const sphere = (x: number, y: number, z: number, r: number) => Math.hypot(x, y, z) - r

/** An upright cylinder of radius `r` from `y0` to `y1`. */
export const cylinder = (x: number, y: number, z: number, r: number, y0: number, y1: number) => {
  const dr = Math.hypot(x, z) - r
  const dy = Math.max(y0 - y, y - y1)
  return Math.min(Math.max(dr, dy), 0) + Math.hypot(Math.max(dr, 0), Math.max(dy, 0))
}

/** An upright cone frustum: radius `r0` at `y0` narrowing to `r1` at `y1`. */
export const cone = (x: number, y: number, z: number, r0: number, r1: number, y0: number, y1: number) => {
  const q = Math.hypot(x, z)
  const hh = (y1 - y0) / 2
  const py = y - (y0 + y1) / 2
  // Inigo Quilez's capped cone.
  const k1x = r1
  const k1y = hh
  const k2x = r1 - r0
  const k2y = 2 * hh
  const cax = q - Math.min(q, py < 0 ? r0 : r1)
  const cay = Math.abs(py) - hh
  const dot2 = k2x * k2x + k2y * k2y
  const t = Math.min(Math.max(((k1x - q) * k2x + (k1y - py) * k2y) / dot2, 0), 1)
  const cbx = q - k1x + k2x * t
  const cby = py - k1y + k2y * t
  const s = cbx < 0 && cay < 0 ? -1 : 1
  return s * Math.sqrt(Math.min(cax * cax + cay * cay, cbx * cbx + cby * cby))
}

/** A box centered on the origin with half sizes `bx`, `by`, `bz`, its edges rounded by `rr`. */
export const box = (x: number, y: number, z: number, bx: number, by: number, bz: number, rr = 0) => {
  const qx = Math.abs(x) - bx + rr
  const qy = Math.abs(y) - by + rr
  const qz = Math.abs(z) - bz + rr
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - rr
}

/** A ring lying flat (around the y axis): radius `big`, tube `small`. */
export const torus = (x: number, y: number, z: number, big: number, small: number) => Math.hypot(Math.hypot(x, z) - big, y) - small

/** An ellipsoid with radii `rx`, `ry`, `rz` (a bound, close enough near the surface for these sizes). */
export const ellipsoid = (x: number, y: number, z: number, rx: number, ry: number, rz: number) => {
  const k0 = Math.hypot(x / rx, y / ry, z / rz)
  const k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz))
  return k1 === 0 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1
}

/** A capsule between two points, radius `r`. */
export const capsule = (x: number, y: number, z: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number) => {
  const px = x - ax
  const py = y - ay
  const pz = z - az
  const dx = bx - ax
  const dy = by - ay
  const dz = bz - az
  const h = Math.min(Math.max((px * dx + py * dy + pz * dz) / (dx * dx + dy * dy + dz * dz), 0), 1)
  return Math.hypot(px - dx * h, py - dy * h, pz - dz * h) - r
}

/** Smooth union of two distances (`k` px of blending). */
export const blend = (a: number, b: number, k: number) => {
  const h = Math.min(Math.max(0.5 + (0.5 * (b - a)) / k, 0), 1)
  return b * (1 - h) + a * h - k * h * (1 - h)
}

/* ---------------- Flat shapes (2D signed distances, px), to extrude ---------------- */

/** A flat shape `d2` (its 2D distance at the point) given `half` px of thickness around z = `z0`. */
export const extrude = (d2: number, z: number, z0: number, half: number) => {
  const dz = Math.abs(z - z0) - half
  return Math.min(Math.max(d2, dz), 0) + Math.hypot(Math.max(d2, 0), Math.max(dz, 0))
}

/** A triangle a, b, c (Inigo Quilez's exact 2D distance). */
export const triangle = (px: number, py: number, ax: number, ay: number, bx: number, by: number, cx: number, cy: number) => {
  const e0x = bx - ax, e0y = by - ay, e1x = cx - bx, e1y = cy - by, e2x = ax - cx, e2y = ay - cy
  const v0x = px - ax, v0y = py - ay, v1x = px - bx, v1y = py - by, v2x = px - cx, v2y = py - cy
  const c = (v: number) => Math.min(Math.max(v, 0), 1)
  const h0 = c((v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y))
  const h1 = c((v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y))
  const h2 = c((v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y))
  const q0 = Math.hypot(v0x - e0x * h0, v0y - e0y * h0)
  const q1 = Math.hypot(v1x - e1x * h1, v1y - e1y * h1)
  const q2 = Math.hypot(v2x - e2x * h2, v2y - e2y * h2)
  const s = Math.sign(e0x * e2y - e0y * e2x)
  const inside = s * (v0x * e0y - v0y * e0x) >= 0 && s * (v1x * e1y - v1y * e1x) >= 0 && s * (v2x * e2y - v2y * e2x) >= 0
  return Math.min(q0, q1, q2) * (inside ? -1 : 1)
}

/** A five-pointed star of outer radius `r`, its inner corners at `inner` × r, a point up (Inigo Quilez's exact distance). */
export const star = (px: number, py: number, r: number, inner = 0.45) => {
  const k1x = 0.809016994375
  const k1y = -0.587785252292
  let x = Math.abs(px)
  let y = py
  let d = Math.max(k1x * x + k1y * y, 0)
  x -= 2 * d * k1x
  y -= 2 * d * k1y
  d = Math.max(-k1x * x + k1y * y, 0)
  x -= 2 * d * -k1x
  y -= 2 * d * k1y
  x = Math.abs(x)
  y -= r
  const bax = inner * -k1y
  const bay = inner * k1x - 1
  const h = Math.min(Math.max((x * bax + y * bay) / (bax * bax + bay * bay), 0), r)
  return Math.hypot(x - bax * h, y - bay * h) * Math.sign(y * bax - x * bay)
}

/** A heart about `s` px across, its point down. */
export const heart = (px: number, py: number, s: number) => {
  const x = Math.abs(px) / s
  const y = py / s + 0.45
  const d =
    y + x > 1
      ? Math.hypot(x - 0.25, y - 0.75) - Math.SQRT2 / 4
      : Math.sign(x - y) * Math.min(Math.hypot(x, y - 1), Math.hypot(x - 0.5 * Math.max(x + y, 0), y - 0.5 * Math.max(x + y, 0)))
  return d * s
}
