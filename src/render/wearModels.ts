import type { WearableSlot } from '../data/cosmetics'
import type { WearableId } from '../data/wearables'
import { box, capsule, cone, cylinder, ellipsoid, extrude, heart, sphere, star, torus, triangle, blend, type Ramp, type Scene } from './wearArt'
import type { Layer } from './wearFit'

/**
 * The Arena's wearables as models (`render/wearArt.ts` renders them): one per
 * id of `WEARABLES`. Each is built around its slot's pivot, the point the
 * anchors give in every direction (`render/wearFit.ts`):
 *
 * - head: the top of the head's axis; the head is a sphere of `head / 2` below it.
 * - face: the head's center at the eyes' height; the face is that sphere's front (+z).
 * - neck: the neck's axis under the chin; the neck a cylinder of `neck / 2` around it.
 * - back: the body's axis at the shoulders; the back `body / 2` behind it (−z), the
 *   feet `drop` below and the top of the head `rise` above.
 *
 * Bands, rings and lenses carry the head or neck as an occluder, so their far
 * side hides behind it as the Pokémon turns. Sizes are px; a part thinner
 * than a pixel vanishes, so lines are at least 0.5 px in radius.
 */

/**
 * What a model is sized from (px), measured on the wearer facing south
 * (`render/wearFit.ts`): widths are the sprite's, outline included, so a
 * model's own radius is `radius(w)`, half a width less its outline.
 */
export type WearSize = { head: number; neck: number; body: number; drop: number; rise: number }

export type WearModel = {
  /** The scene for a size and a frame of its animation (0 when still). */
  scene: (size: WearSize, frame: number) => Scene
  /** An animated model's frames and how long each shows (s). */
  frames?: { count: number; every: number }
  /** Its own layer per art direction (S, SE, E, NE, N), where its slot's (`SLOT_LAYERS`) doesn't suit. */
  layers?: readonly [Layer, Layer, Layer, Layer, Layer]
}

/* ---------------- Palette (PMD-like ramps: shadow, base, light, glint) ---------------- */

const RED: Ramp = ['#8a2030', '#c83840', '#f06050', '#f8b0a0']
const CRIMSON: Ramp = ['#681828', '#a82838', '#d84850', '#f09090']
const PINK: Ramp = ['#a03070', '#e05898', '#f890c0', '#ffd8ec']
const ORANGE: Ramp = ['#a04010', '#e07020', '#f8a040', '#f8d8a0']
const YELLOW: Ramp = ['#a07808', '#e0b818', '#f8e050', '#fff8c0']
const GOLD: Ramp = ['#7a4c10', '#c08820', '#f0c838', '#fff4b0']
const BRASS: Ramp = ['#684018', '#a07028', '#d0a048', '#f0d890']
const STRAW: Ramp = ['#8a5c20', '#c89040', '#e8c068', '#f8e8b0']
const BROWN: Ramp = ['#4c2818', '#7c4828', '#a87040', '#d8a870']
const LEATHER: Ramp = ['#382018', '#5c3424', '#844c30', '#b07850']
const GREEN: Ramp = ['#205828', '#389040', '#60c058', '#b0e890']
const LEAF: Ramp = ['#185020', '#287830', '#48a040', '#90d070']
const TEAL: Ramp = ['#185858', '#209088', '#40c0b0', '#a8f0e0']
const SKY: Ramp = ['#2858a0', '#4888d8', '#78b8f0', '#d0ecff']
const BLUE: Ramp = ['#1c3070', '#2c50b0', '#4c80e0', '#a0c8f8']
const PURPLE: Ramp = ['#381450', '#602890', '#9048c0', '#c890f0']
const VIOLET: Ramp = ['#2c1838', '#48285c', '#684080', '#9870b0']
const BLACK: Ramp = ['#101018', '#22222e', '#383848', '#606078']
const STEEL: Ramp = ['#404858', '#707a8c', '#a0aabc', '#e0e8f4']
const WHITE: Ramp = ['#8c94a4', '#c4ccd8', '#eceff4', '#ffffff']
const CREAM: Ramp = ['#a08860', '#d8c098', '#f4e8c8', '#fffaf0']
const IVORY: Ramp = ['#907858', '#c8b088', '#ece0c0', '#fffcf0']
const SKIN: Ramp = ['#b05860', '#e07880', '#f8a8a8', '#ffe0e0']
/** Lenses and glows: lit flat (`Scene.flat`). */
const GLASS: Ramp = ['#3c6c94', '#78b0d8', '#b8e0f8', '#ffffff']
const SHADE: Ramp = ['#0c0c18', '#1c1c30', '#34385c', '#a0b0e0']
const FLAME: Ramp = ['#c83010', '#f87818', '#f8c030', '#fff8c0']
const HALO: Ramp = ['#c89820', '#f0c838', '#f8e878', '#fffce0']
const FAIRY: Ramp = ['#78a8d0', '#a8d8f0', '#d8f4ff', '#ffffff']

/* ---------------- Building blocks ---------------- */

/** A model's radius for a measured width: the art adds a 1 px outline around the shape. */
const radius = (w: number) => (w - 1) / 2

type Dist = (x: number, y: number, z: number) => number
/** A part of a model: its distance and its ramp (an index into the scene's `ramps`, `OCCLUDER` for one, or a function of the point for patterns). */
type Part = readonly [Dist, number | ((x: number, y: number, z: number) => number)]
const OCCLUDER = -1

/** A scene from parts: the nearest part paints. */
const scene = (ramps: readonly Ramp[], parts: readonly Part[], bounds: { r: number; top: number; bottom: number }, extra: Partial<Scene> = {}): Scene => ({
  sdf: (x, y, z) => {
    let d = Infinity
    for (const [dist] of parts) d = Math.min(d, dist(x, y, z))
    return d
  },
  paint: (x, y, z) => {
    let d = Infinity
    let m: Part[1] = OCCLUDER
    for (const [dist, ramp] of parts) {
      const e = dist(x, y, z)
      if (e < d) [d, m] = [e, ramp]
    }
    return typeof m === 'number' ? m : m(x, y, z)
  },
  part: (x, y, z) => {
    let d = Infinity
    let k = 0
    for (let i = 0; i < parts.length; i++) {
      const e = parts[i]![0](x, y, z)
      if (e < d) [d, k] = [e, i]
    }
    return k
  },
  ramps,
  ...bounds,
  ...extra,
})

/** The head under a hat: a sphere of radius `r` whose top is the origin. */
const headUnder = (r: number): Part => [(x, y, z) => sphere(x, y + r, z, r * 0.98), OCCLUDER]
/** The head behind face items: a sphere of radius `r` around the origin. */
const headAround = (r: number): Part => [(x, y, z) => sphere(x, y, z, r * 0.96), OCCLUDER]
/**
 * The neck inside neck items, and the head above it (about 1.6 necks wide, a
 * little forward): facing the camera the chin hides the back of a scarf.
 */
const neckIn = (r: number): Part => [(x, y, z) => Math.min(cylinder(x, y, z, r * 0.95, -r * 2.2, r * 1.6), sphere(x, y - r * 1.5, z - r * 0.3, r * 1.4)), OCCLUDER]

/** A ring standing upright, facing +z (around the z axis), centered at (cx, cy, cz). */
const ringZ = (x: number, y: number, z: number, cx: number, cy: number, cz: number, big: number, small: number) => Math.hypot(Math.hypot(x - cx, y - cy) - big, z - cz) - small

/** An angle around the y axis, 0 at the front (+z), growing toward +x. */
const around = (x: number, z: number) => Math.atan2(x, z)

/** Turns (x, z) by `a` around the y axis. */
const turnY = (x: number, z: number, a: number): [number, number] => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]

/** Where the face's surface is at `x` across it, for a head of radius `r`. */
const faceZ = (r: number, x: number, y = 0) => Math.sqrt(Math.max(r * r - x * x - y * y, 0))

/** The frame's offset along a loop of `count`: 0, ½, 1, ½ for four frames (a bob). */
const bob = (frame: number, count: number) => (1 - Math.cos((frame / count) * Math.PI * 2)) / 2

const FACE_LAYERS = ['front', 'front', 'front', 'hidden', 'hidden'] as const satisfies WearModel['layers']

/* ---------------- Head (origin: the top of the head) ---------------- */

const strawHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const crownR = r * 0.7
    return scene([STRAW, RED], [
      headUnder(r),
      [(x, y, z) => cylinder(x, y, z, r * 1.32, -1.4, -0.5), 0],
      [(x, y, z) => cylinder(x, y, z, crownR - 0.8, -0.8, r * 0.45) - 0.8, 0],
      [(x, y, z) => cylinder(x, y, z, crownR + 0.15, -0.6, r * 0.18), 1],
    ], { r: r * 1.4, top: r * 0.6, bottom: -2 })
  },
}

const cap: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    return scene([RED, WHITE, GREEN], [
      headUnder(r),
      [(x, y, z) => Math.max(sphere(x, y + r * 0.62, z, r * 1.06), -(y + r * 0.3)), (x, y, z) => (z > r * 0.45 && y > -r * 0.2 ? (Math.abs(x) < r * 0.16 && y > 0 && y < r * 0.26 ? 2 : 1) : 0)],
      [(x, y, z) => Math.max(ellipsoid(x, y + r * 0.3, z - r * 0.82, r * 0.74, 0.55, r * 0.72), -(z - r * 0.4)), 0],
      [(x, y, z) => sphere(x, y - r * 0.44, z, 0.9), 0],
    ], { r: r * 1.6, top: r * 0.55, bottom: -r * 0.6 })
  },
}

const beanie: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    // Knit ribs on the folded cuff.
    const rib = (x: number, _y: number, z: number) => (Math.floor(((around(x, z) + Math.PI) / (Math.PI * 2)) * 16) % 2 === 0 ? 1 : 2)
    const pom = Math.max(1.5, r * 0.3)
    return scene([TEAL, CREAM, WHITE], [
      headUnder(r),
      [(x, y, z) => Math.max(sphere(x, y + r * 0.66, z, r * 1.06), -(y + r * 0.52)), 0],
      [(x, y, z) => cylinder(x, y, z, r * 1.1 - 0.7, -r * 0.86, -r * 0.4) - 0.7, rib],
      [(x, y, z) => sphere(x, y - r * 0.32 - pom * 0.7, z, pom), 2],
    ], { r: r * 1.15, top: r * 0.4 + pom * 2, bottom: -r * 1.1 })
  },
}

const partyHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const h = r * 1.7
    const stripe = (x: number, y: number, z: number) => (Math.floor((y + around(x, z) * 0.9) / Math.max(1.6, r * 0.34)) % 2 === 0 ? 0 : 1)
    return scene([PINK, YELLOW, SKY], [
      headUnder(r),
      [(x, y, z) => cone(x, y, z, r * 0.62, 0.25, -r * 0.3, h), stripe],
      [(x, y, z) => sphere(x, y - h - 0.6, z, Math.max(1.3, r * 0.22)), 2],
    ], { r: r * 0.7, top: h + 2.4, bottom: -r * 0.4 })
  },
}

const hairBow: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const cy = r * 0.22
    const lobe = (x: number, y: number, z: number, side: number) => {
      // Each lobe leans out and up from the knot.
      const dx = x - side * r * 0.5
      const dy = y - cy - r * 0.06
      return ellipsoid(dx * 0.95 - dy * side * 0.3, dy * 0.95 + dx * side * 0.3, z, r * 0.5, r * 0.38, r * 0.3)
    }
    return scene([PINK, CRIMSON], [
      headUnder(r),
      [(x, y, z) => Math.min(lobe(x, y, z, 1), lobe(x, y, z, -1)), 0],
      [(x, y, z) => sphere(x, y - cy, z - r * 0.08, r * 0.22 + 0.5), 1],
    ], { r: r * 1.2, top: cy + r * 0.7, bottom: -r * 0.3 })
  },
}

const headband: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const y0 = -r * 0.5
    const tail = (side: number): Dist => (x, y, z) => capsule(x, y, z, side * r * 0.12, y0, -r * 0.98, side * r * 0.42, y0 - r * 0.62, -r * 1.42, 0.62)
    return scene([RED, WHITE], [
      headUnder(r),
      [(x, y, z) => torus(x, y - y0, z, r * 0.98, 0.8), (x, _y, z) => (z > r * 0.75 && Math.abs(x) < r * 0.28 ? 1 : 0)],
      [tail(1), 0],
      [tail(-1), 0],
    ], { r: r * 1.6, top: 0, bottom: -r * 1.4 })
  },
}

const topHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const h = r * 1.3
    return scene([BLACK, RED], [
      headUnder(r),
      [(x, y, z) => cylinder(x, y, z, r * 1.12, -1.3, -0.4), 0],
      [(x, y, z) => cone(x, y, z, r * 0.62, r * 0.68, -0.6, h), 0],
      [(x, y, z) => cylinder(x, y, z, r * 0.64 + 0.35, -0.2, r * 0.3), 1],
    ], { r: r * 1.2, top: h + 0.5, bottom: -1.6 })
  },
}

const flowerCrown: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const y0 = -r * 0.28
    const ring = r * 0.9
    const count = 8
    const flowers = [PINK, YELLOW, WHITE] as const
    const bloom: Dist = (x, y, z) => {
      const a = around(x, z)
      const k = Math.round((a / (Math.PI * 2)) * count)
      const b = (k / count) * Math.PI * 2
      return sphere(x - Math.sin(b) * ring, y - y0 - 0.3, z - Math.cos(b) * ring, Math.max(1.1, r * 0.2))
    }
    const which = (x: number, _y: number, z: number) => 1 + (((Math.round((around(x, z) / (Math.PI * 2)) * count) % 3) + 3) % 3)
    return scene([LEAF, ...flowers], [
      headUnder(r),
      [(x, y, z) => torus(x, y - y0, z, ring, 0.62), 0],
      [bloom, which],
    ], { r: ring + 2, top: 2, bottom: y0 - 2 })
  },
}

const chefHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const top = r * 0.95
    const puff: Dist = (x, y, z) => {
      let d = sphere(x, y - top, z, r * 0.62)
      for (const [px, pz] of [[r * 0.45, 0], [-r * 0.45, 0], [0, r * 0.4], [0, -r * 0.4]] as const) d = blend(d, sphere(x - px, y - top + r * 0.12, z - pz, r * 0.48), 1.2)
      return d
    }
    return scene([WHITE, CREAM], [
      headUnder(r),
      [(x, y, z) => cylinder(x, y, z, r * 0.8, -r * 0.42, r * 0.5), (x, _y, z) => (Math.floor(((around(x, z) + Math.PI) / (Math.PI * 2)) * 12) % 2 === 0 ? 1 : 0)],
      [puff, 0],
    ], { r: r * 1.15, top: top + r * 0.7, bottom: -r * 0.5 })
  },
}

const cowboyHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const brimR = r * 1.38
    const brim: Dist = (x, y, z) => {
      // The brim curls up at the sides.
      const curl = -0.9 + r * 0.42 * (x / brimR) * (x / brimR)
      return Math.max(Math.abs(y - curl) - 0.5, Math.hypot(x, z) - brimR)
    }
    const crown: Dist = (x, y, z) => {
      const dent = r * 0.2 * Math.max(0, 1 - Math.abs(x) / (r * 0.32))
      return Math.max(cylinder(x, y, z, r * 0.6, -0.8, r * 0.82), y - (r * 0.82 - dent))
    }
    return scene([BROWN, LEATHER], [
      headUnder(r),
      [brim, 0],
      [crown, 0],
      [(x, y, z) => cylinder(x, y, z, r * 0.6 + 0.3, -0.4, r * 0.18), 1],
    ], { r: brimR + 1, top: r + 1, bottom: -1.5 }, { step: 0.6 })
  },
}

const gradCap: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const boardY = r * 0.36
    const tassel: Dist = (x, y, z) =>
      Math.min(capsule(x, y, z, 0, boardY + 0.6, 0, r * 0.86, boardY + 0.5, r * 0.35, 0.5), capsule(x, y, z, r * 0.9, boardY + 0.3, r * 0.38, r * 0.95, boardY - r * 0.75, r * 0.4, 0.62))
    return scene([BLACK, GOLD], [
      headUnder(r),
      [(x, y, z) => cylinder(x, y, z, r * 0.74, -r * 0.45, boardY), 0],
      // Turned a quarter, so facing south it shows the diamond a mortarboard is drawn as.
      [(x, y, z) => box((x + z) * Math.SQRT1_2, y - boardY, (z - x) * Math.SQRT1_2, r * 0.92, 0.5, r * 0.92, 0.2), 0],
      [tassel, 1],
    ], { r: r * 1.5, top: boardY + 1.5, bottom: -r * 0.9 })
  },
}

const santaHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const h = r * 1.25
    // The tip flops over toward +x and down.
    const sock: Dist = (x, y, z) => {
      const t = Math.min(Math.max(y / h, 0), 1)
      return cone(x - r * 0.75 * t * t, y + r * 0.35 * t * t * t, z, r * 0.74, 0.5, -r * 0.2, h)
    }
    const tipX = r * 0.75
    const tipY = h - r * 0.35
    return scene([RED, WHITE], [
      headUnder(r),
      [sock, 0],
      [(x, y, z) => torus(x, y + r * 0.22, z, r * 0.8, Math.max(1.1, r * 0.24)), 1],
      [(x, y, z) => sphere(x - tipX - 0.5, y - tipY + 0.6, z, Math.max(1.3, r * 0.22)), 1],
    ], { r: r * 1.35, top: h + 1, bottom: -r * 0.6 }, { step: 0.6 })
  },
}

const witchHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const h = r * 2
    // The tip bends back.
    const point: Dist = (x, y, z) => {
      const t = Math.min(Math.max(y / h, 0), 1)
      return cone(x, y, z + r * 0.7 * t * t, r * 0.72, 0.3, -0.6, h)
    }
    return scene([PURPLE, ORANGE, GOLD], [
      headUnder(r),
      [(x, y, z) => cylinder(x, y, z, r * 1.36, -1.3, -0.4), 0],
      [point, 0],
      [(x, y, z) => cylinder(x, y, z, r * 0.7 + 0.35, -0.3, r * 0.28), (x, y, z) => (z > r * 0.5 && Math.abs(x) < r * 0.2 && y > -0.1 ? 2 : 1)],
    ], { r: r * 1.42, top: h + 1, bottom: -1.6 }, { step: 0.7 })
  },
}

const pirateHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const w = r * 1.5
    const body: Dist = (x, y, z) => Math.max(ellipsoid(x, y + r * 0.05, z, w, r * 0.8, r * 0.62), -(y + r * 0.38))
    const paint = (x: number, y: number, z: number) => {
      const top = r * 0.8 * Math.sqrt(Math.max(0, 1 - (x / w) * (x / w))) - r * 0.05
      if (y > top - 0.55 && z > -0.2) return 1
      return z > 0 && Math.abs(x) < r * 0.24 && y > r * 0.02 && y < r * 0.44 ? 2 : 0
    }
    return scene([BLACK, GOLD, WHITE], [headUnder(r), [body, paint]], { r: w + 1, top: r, bottom: -r * 0.5 })
  },
}

const vikingHelmet: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const horn = (side: number): Dist => (x, y, z) =>
      Math.min(
        capsule(x, y, z, side * r * 0.82, -r * 0.3, 0, side * r * 1.22, -r * 0.08, 0, r * 0.26),
        capsule(x, y, z, side * r * 1.22, -r * 0.08, 0, side * r * 1.42, r * 0.42, 0, r * 0.16),
        capsule(x, y, z, side * r * 1.42, r * 0.42, 0, side * r * 1.36, r * 0.78, 0, 0.5),
      )
    return scene([STEEL, BRASS, IVORY], [
      headUnder(r),
      [(x, y, z) => Math.max(sphere(x, y + r * 0.5, z, r * 1.04), -(y + r * 0.62)), (x) => (Math.abs(x) < r * 0.14 ? 1 : 0)],
      [(x, y, z) => cylinder(x, y, z, r * 1.08, -r * 0.66, -r * 0.4), 1],
      [horn(1), 2],
      [horn(-1), 2],
    ], { r: r * 1.6, top: r * 0.9, bottom: -r * 0.8 })
  },
}

const bunnyEars: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const ear = (side: number): Dist => (x, y, z) => {
      const lx = x - side * r * 0.42
      const ly = y - r * 0.82
      // Leaning out a little.
      return ellipsoid(lx * 0.98 - ly * side * 0.16, ly * 0.98 + lx * side * 0.16, z, r * 0.24 + 0.3, r * 0.72, r * 0.16 + 0.3)
    }
    const inner = (x: number, y: number, z: number) => (z > 0.2 && Math.abs(Math.abs(x) - r * 0.42 - (y - r * 0.82) * 0.16) < r * 0.1 + 0.2 && y > r * 0.35 ? 1 : 0)
    return scene([WHITE, PINK, BLACK], [
      headUnder(r),
      [(x, y, z) => Math.max(ringZ(x, y, z, 0, -r, 0, r * 1.0, 0.55), -(y + r * 0.6)), 2],
      [ear(1), inner],
      [ear(-1), inner],
    ], { r: r * 1.2, top: r * 1.6, bottom: -r * 0.7 })
  },
}

const PROPELLER_FRAMES = 4
const propellerCap: WearModel = {
  frames: { count: PROPELLER_FRAMES, every: 0.06 },
  scene: ({ head }, frame) => {
    const r = radius(head)
    const spin = (frame / PROPELLER_FRAMES) * (Math.PI / 2)
    const quarter = (x: number, _y: number, z: number) => [0, 1, 2, 3][Math.floor(((around(x, z) + Math.PI + Math.PI / 4) / (Math.PI * 2)) * 4) % 4]!
    const postTop = r * 0.42 + 1.6
    const blades: Dist = (x, y, z) => {
      const [bx, bz] = turnY(x, z, spin)
      return box(bx, y - postTop, bz, r * 0.85, 0.45, 0.7, 0.3)
    }
    return scene([RED, YELLOW, BLUE, GREEN, STEEL], [
      headUnder(r),
      [(x, y, z) => Math.max(sphere(x, y + r * 0.58, z, r * 1.02), -(y + r * 0.48)), quarter],
      [(x, y, z) => capsule(x, y, z, 0, r * 0.3, 0, 0, postTop, 0, 0.55), 4],
      [blades, 4],
    ], { r: r * 1.1, top: postTop + 1, bottom: -r * 0.55 })
  },
}

const CROWN_FRAMES = 6
const crown: WearModel = {
  frames: { count: CROWN_FRAMES, every: 0.12 },
  scene: ({ head }, frame) => {
    const r = radius(head)
    const ring = r * 0.8
    const points = 5
    const tri = (a: number) => {
      const f = (((a / (Math.PI * 2)) * points) % 1 + 1) % 1
      return 1 - Math.abs(f * 2 - 1)
    }
    const base = -r * 0.32
    const rim = r * 0.12
    const wall: Dist = (x, y, z) => {
      const top = rim + r * 0.55 * tri(around(x, z) + Math.PI / points)
      return Math.max(Math.abs(Math.hypot(x, z) - ring) - 0.55, base - y, y - top)
    }
    // Gems on the band, one of them glinting each frame.
    const gem: Dist = (x, y, z) => {
      const a = around(x, z)
      const k = Math.round((a / (Math.PI * 2)) * points)
      const b = (k / points) * Math.PI * 2
      return sphere(x - Math.sin(b) * (ring + 0.3), y - (base + rim) / 2, z - Math.cos(b) * (ring + 0.3), 0.85)
    }
    const shine = (frame * 2) % points
    const gemPaint = (x: number, _y: number, z: number) => {
      const k = ((Math.round((around(x, z) / (Math.PI * 2)) * points) % points) + points) % points
      return k === shine && frame % 3 === 0 ? 3 : k % 2 === 0 ? 1 : 2
    }
    return scene([GOLD, RED, BLUE, HALO], [headUnder(r), [wall, 0], [gem, gemPaint]], { r: ring + 2, top: rim + r * 0.6 + 1, bottom: base - 1 }, { step: 0.6, flat: [3], inks: { 3: '#c08820' } })
  },
}

const HALO_FRAMES = 4
const halo: WearModel = {
  frames: { count: HALO_FRAMES, every: 0.22 },
  scene: ({ head }, frame) => {
    const r = radius(head)
    const y0 = r * 0.6 + 1 + bob(frame, HALO_FRAMES)
    return scene([HALO], [[(x, y, z) => torus(x, y - y0, z, Math.max(2.2, r * 0.66), 0.62), 0]], { r: r * 0.8 + 2, top: y0 + 2, bottom: y0 - 2 }, { flat: [0], ink: '#e8b830' })
  },
}

/* ---------------- Face (origin: the head's center at the eyes) ---------------- */

/** The eyes' distance from the face's middle, for a head of radius `r`. */
const eyeX = (r: number) => r * 0.42

/** Temples from a frame's outer edge back to the ears. */
const temples = (r: number, from: number, y: number): Dist => (x, yy, z) =>
  Math.min(capsule(x, yy, z, from, y, faceZ(r, from) - 0.4, r * 0.98, y, -r * 0.1, 0.5), capsule(x, yy, z, -from, y, faceZ(r, from) - 0.4, -r * 0.98, y, -r * 0.1, 0.5))

const roundGlasses: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r)
    const lens = Math.max(1.7, r * 0.32)
    const zf = faceZ(r, e) + 0.5
    const rims: Dist = (x, y, z) => Math.min(ringZ(x, y, z, e, 0, zf, lens, 0.5), ringZ(x, y, z, -e, 0, zf, lens, 0.5))
    const glass: Dist = (x, y, z) => Math.min(extrude(Math.hypot(x - e, y) - lens, z, zf, 0.2), extrude(Math.hypot(x + e, y) - lens, z, zf, 0.2))
    // Wire frames are their own line: no outline around them or the lenses.
    return scene([LEATHER, GLASS], [
      headAround(r),
      [rims, 0],
      [glass, 1],
      [(x, y, z) => capsule(x, y, z, -e + lens, 0.4, zf + 0.2, e - lens, 0.4, zf + 0.2, 0.5), 0],
      [temples(r, e + lens, 0.2), 0],
    ], { r: r + 1, top: lens + 1, bottom: -lens - 1 }, { flat: [1], inks: { 0: null, 1: null } })
  },
}

const sunglasses: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r)
    const zf = faceZ(r, e) + 0.4
    const lw = Math.max(1.8, r * 0.36)
    const lh = Math.max(1.2, r * 0.22)
    const lens: Dist = (x, y, z) => Math.min(box(x - e, y + 0.2, z - zf, lw, lh, 0.5, 0.6), box(x + e, y + 0.2, z - zf, lw, lh, 0.5, 0.6))
    const glint = (x: number, y: number) => (Math.abs(Math.abs(x) - e + lw * 0.5) < 0.7 && y > lh * 0.2 ? 1 : 0)
    return scene([SHADE, WHITE, BLACK], [
      headAround(r),
      [lens, glint],
      [(x, y, z) => capsule(x, y, z, -e, lh * 0.7, zf + 0.3, e, lh * 0.7, zf + 0.3, 0.55), 2],
      [temples(r, e + lw, lh * 0.5), 2],
    ], { r: r + 1, top: lh + 1.5, bottom: -lh - 1.5 }, { flat: [0, 1], ink: '#08080c' })
  },
}

const noseGlasses: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r)
    const lens = Math.max(1.6, r * 0.3)
    const zf = faceZ(r, e) + 0.5
    const nose: Dist = (x, y, z) => sphere(x, y + lens * 1.15, z - r * 0.98, Math.max(1.4, r * 0.28))
    const stache: Dist = (x, y, z) => ellipsoid(x, y + lens * 1.15 + Math.max(1.4, r * 0.28) + 0.4, z - r * 0.9, r * 0.6, 0.9, 0.9)
    return scene([BLACK, SKIN, BROWN], [
      headAround(r),
      [(x, y, z) => Math.min(ringZ(x, y, z, e, 0, zf, lens, 0.6), ringZ(x, y, z, -e, 0, zf, lens, 0.6)), 0],
      [(x, y, z) => capsule(x, y, z, -e + lens, 0.4, zf + 0.2, e - lens, 0.4, zf + 0.2, 0.55), 0],
      [temples(r, e + lens, 0), 0],
      [nose, 1],
      [stache, 2],
    ], { r: r + 1, top: lens + 1, bottom: -lens * 1.15 - r * 0.6 - 2 })
  },
}

const heartShades: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r) + 0.2
    const s = Math.max(4.2, r * 0.82)
    const zf = faceZ(r, e) + 0.4
    const lens: Dist = (x, y, z) => Math.min(extrude(heart(x - e, y, s), z, zf, 0.4), extrude(heart(x + e, y, s), z, zf, 0.4))
    return scene([RED, PINK], [
      headAround(r),
      [lens, (x, y) => (Math.abs(Math.abs(x) - e + s * 0.22) < 0.6 && y > s * 0.12 ? 1 : 0)],
      [(x, y, z) => capsule(x, y, z, -e + s * 0.3, s * 0.25, zf + 0.2, e - s * 0.3, s * 0.25, zf + 0.2, 0.5), 1],
      [temples(r, e + s * 0.5, s * 0.15), 1],
    ], { r: r + 1, top: s * 0.7 + 1, bottom: -s * 0.7 - 1 }, { flat: [0] })
  },
}

const monocle: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r)
    const lens = Math.max(1.9, r * 0.36)
    const zf = faceZ(r, e) + 0.5
    const chain: Dist = (x, y, z) => Math.min(capsule(x, y, z, e + lens * 0.6, -lens * 0.8, zf, e + lens * 0.9, -lens - r * 0.5, zf - 0.6, 0.5), capsule(x, y, z, e + lens * 0.9, -lens - r * 0.5, zf - 0.6, r * 0.95, -lens - r * 0.6, 0, 0.5))
    return scene([GOLD, GLASS], [
      headAround(r),
      [(x, y, z) => ringZ(x, y, z, e, 0, zf, lens, 0.6), 0],
      [(x, y, z) => extrude(Math.hypot(x - e, y) - lens, z, zf, 0.2), 1],
      [chain, 0],
    ], { r: r + 1, top: lens + 1, bottom: -lens - r * 0.7 - 1 }, { flat: [1], inks: { 1: null } })
  },
}

const eyePatch: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r)
    const tilt = 0.42
    const strap: Dist = (x, y, z) => {
      // A ring around the head, tilted across the brow.
      const ty = y * Math.cos(tilt) + x * Math.sin(tilt)
      return Math.hypot(Math.hypot(x * Math.cos(tilt) - y * Math.sin(tilt), z) - r * 1.0, ty - r * 0.08) - 0.5
    }
    return scene([BLACK], [
      headAround(r),
      [(x, y, z) => ellipsoid(x - e, y, z - faceZ(r, e) - 0.2, Math.max(1.8, r * 0.36), Math.max(1.5, r * 0.3), 0.8), 0],
      [strap, 0],
    ], { r: r * 1.1 + 1, top: r * 0.9, bottom: -r * 0.9 })
  },
}

const goggles: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r) + 0.3
    const lens = Math.max(1.7, r * 0.33)
    const zf = faceZ(r, e)
    const housing: Dist = (x, y, z) => {
      const tube = (cx: number) => {
        const dr = Math.hypot(x - cx, y) - lens - 0.5
        const dz = Math.abs(z - zf - 0.3) - 0.8
        return Math.min(Math.max(dr, dz), 0) + Math.hypot(Math.max(dr, 0), Math.max(dz, 0))
      }
      return Math.min(tube(e), tube(-e))
    }
    const strap: Dist = (x, y, z) => Math.max(Math.abs(Math.hypot(x, z) - r * 0.98) - 0.5, Math.abs(y) - Math.max(0.9, r * 0.2))
    return scene([BRASS, GLASS, LEATHER], [
      headAround(r),
      [housing, (x, y, z) => (z > zf + 0.9 && Math.hypot(Math.abs(x) - e, y) < lens - 0.2 ? 1 : 0)],
      [strap, 2],
    ], { r: r + 1.5, top: lens + 1.5, bottom: -lens - 1.5 }, { flat: [1] })
  },
}

const starShades: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r) + 0.3
    const s = Math.max(2.4, r * 0.5)
    const zf = faceZ(r, e) + 0.4
    const lens: Dist = (x, y, z) => Math.min(extrude(star(x - e, y, s), z, zf, 0.4), extrude(star(x + e, y, s), z, zf, 0.4))
    return scene([YELLOW, PINK], [
      headAround(r),
      [lens, 0],
      [(x, y, z) => capsule(x, y, z, -e + s * 0.4, 0.3, zf + 0.2, e - s * 0.4, 0.3, zf + 0.2, 0.5), 1],
      [temples(r, e + s * 0.7, 0), 1],
    ], { r: r + 1.5, top: s + 1, bottom: -s - 1 }, { flat: [0] })
  },
}

const masquerade: WearModel = {
  layers: FACE_LAYERS,
  scene: ({ head }) => {
    const r = radius(head)
    const e = eyeX(r)
    const mask: Dist = (x, y, z) => {
      const shell = Math.abs(sphere(x, y, z, r * 1.02)) - 0.5
      // A band across the eyes, flaring at the sides, with holes for the eyes.
      const band = Math.abs(y + 0.2) - (r * 0.28 + Math.abs(x) * 0.22)
      const holes = Math.min(Math.hypot(x - e, y + 0.1) - r * 0.17, Math.hypot(x + e, y + 0.1) - r * 0.17)
      return Math.max(shell, band, -holes, -(z - r * 0.25), Math.abs(x) - r * 0.98)
    }
    const feather: Dist = (x, y, z) => ellipsoid(x - r * 0.9, y - r * 0.55, z - r * 0.42, 0.9, r * 0.55, 0.7)
    return scene([PURPLE, GOLD, PINK], [
      headAround(r),
      [mask, (x, y) => (Math.abs(y + 0.2) > r * 0.28 + Math.abs(x) * 0.22 - 0.9 ? 1 : 0)],
      [feather, 2],
    ], { r: r * 1.1 + 1, top: r * 1.2, bottom: -r * 0.6 }, { step: 0.7 })
  },
}

/* ---------------- Neck (origin: the neck's axis under the chin) ---------------- */

/** A scarf's wrap: a ring hugging the neck, hanging just under the chin (the pivot). */
const scarfRing = (r: number, tube: number): Dist => (x, y, z) => torus(x, y + tube * 0.7, z, r + tube * 0.3, tube)

const scarf: WearModel = {
  scene: ({ neck }) => {
    const r = radius(neck)
    const tube = Math.max(1, r * 0.26)
    const tail = (dx: number, len: number): Dist => (x, y, z) => box(x - dx, y + tube + len / 2, z - r - tube * 0.6, 0.8, len / 2, 0.4, 0.3)
    return scene([RED, CRIMSON], [
      neckIn(r),
      [scarfRing(r, tube), 0],
      [tail(r * 0.35, r * 0.9 + 1.5), 0],
      [tail(r * 0.35 + 1.6, r * 0.6 + 1.2), 1],
    ], { r: r + tube * 2 + 1, top: tube + 1, bottom: -r * 1.3 - 3 })
  },
}

const stripedScarf: WearModel = {
  scene: ({ neck }) => {
    const r = radius(neck)
    const tube = Math.max(1, r * 0.26)
    const stripes = (x: number, _y: number, z: number) => (Math.floor(((around(x, z) + Math.PI) / (Math.PI * 2)) * 10) % 2 === 0 ? 0 : 1)
    // A long end down the back.
    const end: Dist = (x, y, z) => box(x + r * 0.3, y + r * 0.9 + 1, z + r + tube * 0.5, 0.9, r * 0.9 + 1.4, 0.45, 0.3)
    const endStripes = (_x: number, y: number) => (Math.floor(-y / 1.6) % 2 === 0 ? 0 : 1)
    return scene([GREEN, CREAM], [neckIn(r), [scarfRing(r, tube), stripes], [end, endStripes]], { r: r + tube * 2 + 1, top: tube + 1, bottom: -r * 2 - 4 })
  },
}

const bandana: WearModel = {
  scene: ({ neck }) => {
    const r = radius(neck)
    const flap: Dist = (x, y, z) => {
      const d2 = triangle(x, y, -r * 1.05, 0.3, r * 1.05, 0.3, 0, -r * 1.25 - 1.5)
      // Curved around the chest.
      return extrude(d2, z, faceZ(r * 1.25, Math.min(Math.abs(x), r * 1.2)) + 0.2, 0.45)
    }
    const dots = (x: number, y: number) => ((Math.round(x * 0.7) + Math.round(y * 0.7)) % 3 === 0 && Math.round(y) % 2 === 0 ? 1 : 0)
    return scene([BLUE, WHITE], [
      neckIn(r),
      [(x, y, z) => torus(x, y, z, r + 0.5, 0.9), 0],
      [flap, dots],
      [(x, y, z) => sphere(x, y, z + r + 0.9, 1.1), 0],
    ], { r: r * 1.3 + 2, top: 2, bottom: -r * 1.3 - 3 }, { step: 0.7 })
  },
}

const bowTie: WearModel = {
  layers: ['front', 'front', 'front', 'hidden', 'hidden'],
  scene: ({ neck }) => {
    const r = radius(neck)
    const w = Math.max(3, r * 0.95)
    const h = Math.max(1.6, r * 0.5)
    const zf = r + 0.4
    const lobes: Dist = (x, y, z) =>
      Math.min(extrude(triangle(x, y, 0, 0, w, h, w, -h), z, zf, 0.55), extrude(triangle(x, y, 0, 0, -w, -h, -w, h), z, zf, 0.55)) - 0.15
    return scene([BLACK, CRIMSON], [
      neckIn(r),
      [lobes, 0],
      [(x, y, z) => box(x, y, z - zf - 0.3, 0.8, h * 0.55, 0.6, 0.2), 1],
    ], { r: Math.max(w, r) + 2, top: h + 1, bottom: -h - 1 })
  },
}

const bellCollar: WearModel = {
  scene: ({ neck }) => {
    const r = radius(neck)
    const bell = Math.max(1.4, r * 0.4)
    const bellZ = r + 0.6 + bell * 0.6
    return scene([RED, GOLD, BLACK], [
      neckIn(r),
      [(x, y, z) => torus(x, y, z, r + 0.4, 0.75), 0],
      [(x, y, z) => sphere(x, y + bell * 0.9, z - bellZ, bell), (x, y) => (y < -bell * 1.15 && Math.abs(x) < 0.6 ? 2 : 1)],
    ], { r: r + bell * 2 + 1, top: 2, bottom: -bell * 2 - 2 })
  },
}

const lei: WearModel = {
  scene: ({ neck }) => {
    const r = radius(neck)
    const ring = r + 1
    const count = 12
    const petal = Math.max(1.05, r * 0.3)
    // Lower at the front, as a garland hangs.
    const sag = (a: number) => -r * 0.55 * (1 + Math.cos(a)) * 0.5
    const flower: Dist = (x, y, z) => {
      const k = Math.round((around(x, z) / (Math.PI * 2)) * count)
      const b = (k / count) * Math.PI * 2
      return sphere(x - Math.sin(b) * ring, y - sag(b), z - Math.cos(b) * ring, petal)
    }
    const which = (x: number, _y: number, z: number) => (((Math.round((around(x, z) / (Math.PI * 2)) * count) % 3) + 3) % 3)
    return scene([PINK, ORANGE, YELLOW], [neckIn(r), [flower, which]], { r: ring + petal + 1, top: petal + 1, bottom: -r * 0.6 - petal - 1 })
  },
}

const pearls: WearModel = {
  scene: ({ neck }) => {
    const r = radius(neck)
    const ring = r + 0.5
    const count = 14
    const sag = (a: number) => -r * 0.5 * (1 + Math.cos(a)) * 0.5
    const pearl: Dist = (x, y, z) => {
      const k = Math.round((around(x, z) / (Math.PI * 2)) * count)
      const b = (k / count) * Math.PI * 2
      return sphere(x - Math.sin(b) * ring, y - sag(b), z - Math.cos(b) * ring, 0.95)
    }
    return scene([CREAM], [neckIn(r), [pearl, 0]], { r: ring + 2, top: 2, bottom: -r * 0.6 - 2 }, { ink: '#6c5840' })
  },
}

const medal: WearModel = {
  layers: ['front', 'front', 'front', 'hidden', 'hidden'],
  scene: ({ neck }) => {
    const r = radius(neck)
    const disc = Math.max(1.7, r * 0.45)
    const drop = r * 0.8 + 2
    const zf = r * 0.9 + 0.6
    const ribbon: Dist = (x, y, z) => Math.min(capsule(x, y, z, r * 0.7, 0.2, r * 0.7, 0.4, -drop, zf, 0.6), capsule(x, y, z, -r * 0.7, 0.2, r * 0.7, -0.4, -drop, zf, 0.6))
    const coin: Dist = (x, y, z) => extrude(Math.hypot(x, y + drop + disc * 0.8) - disc, z, zf + 0.2, 0.45)
    return scene([BLUE, GOLD], [neckIn(r), [ribbon, 0], [coin, 1]], { r: r + 2, top: 1.5, bottom: -drop - disc * 2 - 1 })
  },
}

const HERO_FRAMES = 6
const heroScarf: WearModel = {
  frames: { count: HERO_FRAMES, every: 0.1 },
  scene: ({ neck }, frame) => {
    const r = radius(neck)
    const tube = Math.max(1, r * 0.26)
    const phase = (frame / HERO_FRAMES) * Math.PI * 2
    // The end streams out behind and waves.
    const links = 5
    const pts = Array.from({ length: links + 1 }, (_, i) => [r * 0.3 + i * 0.4, -0.4 - i * 0.45 + Math.sin(phase - i * 1.1) * (0.3 + i * 0.25), -r - tube * 0.3 - i * 1.5] as const)
    const end: Dist = (x, y, z) => {
      let d = Infinity
      for (let i = 0; i < links; i++) {
        const [ax, ay, az] = pts[i]!
        const [bx, by, bz] = pts[i + 1]!
        d = Math.min(d, capsule(x, y, z, ax, ay, az, bx, by, bz, Math.max(0.6, tube * 0.75 - i * 0.08)))
      }
      return d
    }
    return scene([CRIMSON, GOLD], [neckIn(r), [scarfRing(r, tube), 0], [end, (_x, _y, z) => (z < -r - tube * 0.3 - (links - 0.7) * 1.5 ? 1 : 0)]], { r: r + links * 1.6 + 3, top: tube + 3, bottom: -links - 3 })
  },
}

/* ---------------- Back (origin: the body's axis at the shoulders) ---------------- */

/** A cloth hanging from the shoulders down the back, flaring a little as it falls; `wave` ripples its hem. */
const cloak = (body: number, drop: number, wave: (a: number, t: number) => number): Dist => {
  const r = radius(body)
  const len = Math.max(4, drop * 0.82)
  return (x, y, z) => {
    const t = Math.min(Math.max(-y / len, 0), 1)
    const a = around(x, -z)
    const sheet = Math.abs(Math.hypot(x, z) - cloakR(r, t) - wave(a, t)) - 0.45
    // Only the back, wrapping a little further round as it falls.
    const spread = Math.abs(a) - (0.95 + t * 0.15)
    // Its top rises behind the neck, as a collar does.
    return Math.max(sheet, spread * r * 0.7, y - r * 0.4 - 0.6, -y - len)
  }
}
/** The cloth's distance from the spine `t` of the way down. */
const cloakR = (r: number, t: number) => r * 0.8 + 0.5 + t * r * 0.12
/** Whether a point of the cloth is on its outer side (the lining faces the body). */
const outside = (body: number, drop: number) => (x: number, y: number, z: number) =>
  Math.hypot(x, z) > cloakR(radius(body), Math.min(Math.max(-y / Math.max(4, drop * 0.82), 0), 1))

const cape: WearModel = {
  scene: ({ body, drop }) => {
    const out = outside(body, drop)
    return scene([RED, GOLD], [[cloak(body, drop, () => 0), (x, y, z) => (out(x, y, z) ? 0 : 1)]], { r: body * 0.8 + 2, top: 1.5, bottom: -drop - 1 }, { step: 0.6 })
  },
}

const ROYAL_FRAMES = 6
const royalCape: WearModel = {
  frames: { count: ROYAL_FRAMES, every: 0.12 },
  scene: ({ body, drop }, frame) => {
    const r = radius(body)
    const phase = (frame / ROYAL_FRAMES) * Math.PI * 2
    const len = Math.max(4, drop * 0.82)
    const cloth = cloak(body, drop, (a, t) => Math.sin(a * 3 + phase) * 0.7 * t)
    const out = outside(body, drop)
    const paint = (x: number, y: number, z: number) => (-y > len - 1.2 ? 2 : out(x, y, z) ? 0 : 1)
    const collar: Dist = (x, y, z) => Math.max(torus(x, y - 0.4, z, r * 0.72, Math.max(1.1, r * 0.2)), z - r * 0.4)
    return scene([PURPLE, CRIMSON, GOLD, WHITE], [[cloth, paint], [collar, 3]], { r: body * 0.85 + 2, top: 2.5, bottom: -drop - 1 }, { step: 0.6 })
  },
}

const backpack: WearModel = {
  scene: ({ body, drop }) => {
    const r = radius(body)
    const h = Math.max(3, Math.min(drop * 0.55, r * 1.3))
    const w = Math.max(2.6, r * 0.62)
    const zc = -r - 1.2
    const pack: Dist = (x, y, z) => box(x, y + h * 0.55, z - zc, w, h * 0.62, 1.4, 1)
    const pocket: Dist = (x, y, z) => box(x, y + h * 0.82, z - zc + 1.5, w * 0.65, h * 0.28, 0.6, 0.5)
    return scene([YELLOW, ORANGE], [
      [pack, (_x, y) => (y > -h * 0.18 ? 1 : 0)],
      [pocket, 1],
    ], { r: r + 4, top: h * 0.2 + 1, bottom: -h * 1.3 - 1 })
  },
}

const BALLOON_FRAMES = 4
const balloon: WearModel = {
  frames: { count: BALLOON_FRAMES, every: 0.25 },
  scene: ({ body, rise }, frame) => {
    const r = radius(body)
    const size = 3.2
    const bx = r * 0.55 + 1
    const bz = -r - 1.5
    const by = rise + size + 3 + bob(frame, BALLOON_FRAMES)
    const string: Dist = (x, y, z) =>
      Math.min(capsule(x, y, z, r * 0.3, 0, -r * 0.8, bx - 0.4, by * 0.5, bz, 0.55), capsule(x, y, z, bx - 0.4, by * 0.5, bz, bx, by - size, bz, 0.55))
    return scene([RED, WHITE], [
      [(x, y, z) => ellipsoid(x - bx, y - by, z - bz, size, size * 1.12, size), (x, y) => (Math.hypot(x - bx + 1.2, y - by - 1.3) < 0.9 ? 1 : 0)],
      [(x, y, z) => sphere(x - bx, y - by + size + 0.3, z - bz, 0.8), 0],
      [string, 1],
    ], { r: Math.hypot(bx, bz) + size + 1, top: by + size * 1.2 + 1, bottom: -1 }, { inks: { 1: null } })
  },
}

const JET_FRAMES = 4
const jetpack: WearModel = {
  frames: { count: JET_FRAMES, every: 0.07 },
  scene: ({ body, drop }, frame) => {
    const r = radius(body)
    const tank = Math.max(1.3, r * 0.3)
    const tx = tank + 0.4
    const zc = -r - tank - 0.4
    const h = Math.max(3.5, Math.min(drop * 0.5, r * 1.2))
    const flame = 1.6 + [0, 1, 0.4, 1.4][frame % 4]!
    const tanks: Dist = (x, y, z) => Math.min(cylinder(x - tx, y, z - zc, tank, -h, 0.4) - 0.1, cylinder(x + tx, y, z - zc, tank, -h, 0.4) - 0.1)
    const nozzles: Dist = (x, y, z) => Math.min(cone(x - tx, y, z - zc, tank * 0.5, tank * 0.85, -h - 1.4, -h), cone(x + tx, y, z - zc, tank * 0.5, tank * 0.85, -h - 1.4, -h))
    const fire: Dist = (x, y, z) => Math.min(cone(x - tx, y, z - zc, 0.3, tank * 0.6, -h - 1.4 - flame, -h - 1.2), cone(x + tx, y, z - zc, 0.3, tank * 0.6, -h - 1.4 - flame, -h - 1.2))
    return scene([STEEL, RED, FLAME], [[tanks, (_x, y) => (y > -0.6 ? 1 : 0)], [nozzles, 0], [fire, 2]], { r: r + tank * 2 + 3, top: 1.5, bottom: -h - 4 - flame }, { flat: [2], inks: { 2: null } })
  },
}

/** Two wings spread from the shoulders: `shape` is one wing's flat outline (x out from the spine, y up), `open` how far they swing out (radians). */
const wings = (r: number, open: number, half: number, shape: (u: number, v: number) => number): Dist => (x, y, z) => {
  // Into the wing's plane: out along u, up along v, thickness along w, hinged behind the spine.
  const hx = Math.abs(x) - 0.4
  const hz = z + r * 0.75
  const u = hx * Math.cos(open) - hz * Math.sin(open)
  const w = hx * Math.sin(open) + hz * Math.cos(open)
  // Far off the wing's plane its distance is at least that far: skip the outline (most of the march).
  if (Math.abs(w) > half + 1.5) return Math.abs(w) - half
  return extrude(shape(u, y), w, 0, half)
}

/** A flat outline from the union of the triangles fanning from its first point through the rest (a wing's membrane). */
const fan = (u: number, v: number, pts: readonly (readonly [number, number])[]) => {
  let d = Infinity
  const [ox, oy] = pts[0]!
  for (let i = 1; i + 1 < pts.length; i++) d = Math.min(d, triangle(u, v, ox, oy, pts[i]![0], pts[i]![1], pts[i + 1]![0], pts[i + 1]![1]))
  return d
}

/** Distance (2D) to the segment a–b. */
const segment = (u: number, v: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax
  const dy = by - ay
  const h = Math.min(Math.max(((u - ax) * dx + (v - ay) * dy) / (dx * dx + dy * dy), 0), 1)
  return Math.hypot(u - ax - dx * h, v - ay - dy * h)
}

const batWings: WearModel = {
  scene: ({ body }) => {
    const r = radius(body)
    const S = Math.max(5, r * 1.25)
    // Shoulder, wrist, then the three finger tips and back along the trailing edge.
    const wrist = [0.5 * S, 0.62 * S] as const
    const tips = [[1.02 * S, 0.86 * S], [1.1 * S, 0.22 * S], [0.72 * S, -0.22 * S]] as const
    const outline = [[0, 0.1 * S], wrist, tips[0], tips[1], tips[2], [0.18 * S, -0.12 * S]] as const
    const shape = (u: number, v: number) => {
      let cut = Infinity
      // Scallops between the fingers.
      for (const [cx, cy, cr] of [[1.24, 0.55, 0.22], [1.02, -0.16, 0.22], [0.42, -0.36, 0.24]] as const) cut = Math.min(cut, Math.hypot(u - cx * S, v - cy * S) - cr * S)
      return Math.max(fan(u, v, outline), -cut)
    }
    const bones = (x: number, y: number) => {
      const u = Math.abs(x)
      let d = segment(u, y, 0, 0.1 * S, wrist[0], wrist[1])
      for (const [tx, ty] of tips) d = Math.min(d, segment(u, y, wrist[0], wrist[1], tx, ty))
      return d < 0.6 ? 1 : 0
    }
    return scene([VIOLET, BLACK], [[wings(r, 0.55, 0.4, shape), bones]], { r: r + S * 1.3 + 2, top: S + 1, bottom: -S * 0.5 - 1 }, { step: 0.6 })
  },
}

const FAIRY_FRAMES = 4
const fairyWings: WearModel = {
  frames: { count: FAIRY_FRAMES, every: 0.08 },
  scene: ({ body }, frame) => {
    const r = radius(body)
    const span = Math.max(4, r * 0.95)
    const flap = 0.35 + bob(frame, FAIRY_FRAMES) * 0.6
    const shape = (u: number, v: number) =>
      Math.min(ellipsoid(u - span * 0.5, v - span * 0.35, 0, span * 0.52, span * 0.42, 1), ellipsoid(u - span * 0.36, v + span * 0.28, 0, span * 0.36, span * 0.3, 1))
    return scene([FAIRY, PINK], [[wings(r, flap, 0.35, shape), (x, y) => (Math.hypot(Math.abs(x) - span * 0.5, y - span * 0.35) < span * 0.2 ? 1 : 0)]], { r: r + span * 1.2 + 2, top: span * 0.8 + 1, bottom: -span * 0.6 - 1 }, { flat: [0, 1], ink: '#5878a8', step: 0.6 })
  },
}

const ANGEL_FRAMES = 6
const angelWings: WearModel = {
  frames: { count: ANGEL_FRAMES, every: 0.14 },
  scene: ({ body }, frame) => {
    const r = radius(body)
    const S = Math.max(5.5, r * 1.3)
    const flap = 0.45 + bob(frame, ANGEL_FRAMES) * 0.3
    const shape = (u: number, v: number) => {
      // The arm sweeping up and out, its long feathers fanning down with round tips.
      let d = fan(u, v, [[0, 0.05 * S], [0.45 * S, 0.7 * S], [1.0 * S, 0.95 * S], [1.08 * S, 0.5 * S], [0.75 * S, -0.3 * S], [0.15 * S, -0.15 * S]])
      for (const [cx, cy] of [[0.95, 0.45], [0.78, 0.05], [0.52, -0.22], [0.25, -0.18]] as const) d = Math.min(d, Math.hypot(u - cx * S, v - cy * S) - 0.2 * S)
      return Math.max(d, -u)
    }
    // Rows of feathers across the wing.
    const rows = (x: number, y: number) => {
      const u = Math.abs(x)
      return Math.floor((Math.hypot(u, y - S * 0.95) / Math.max(1.8, S * 0.24))) % 2 === 0 ? 0 : 1
    }
    return scene([WHITE, CREAM], [[wings(r, flap, 0.45, shape), rows]], { r: r + S * 1.35 + 2, top: S * 1.1 + 1, bottom: -S * 0.5 - 1 }, { step: 0.6 })
  },
}

export const WEAR_MODELS = {
  strawHat,
  cap,
  beanie,
  partyHat,
  hairBow,
  headband,
  topHat,
  flowerCrown,
  chefHat,
  cowboyHat,
  gradCap,
  santaHat,
  witchHat,
  pirateHat,
  vikingHelmet,
  bunnyEars,
  propellerCap,
  crown,
  halo,
  roundGlasses,
  sunglasses,
  noseGlasses,
  heartShades,
  monocle,
  eyePatch,
  goggles,
  starShades,
  masquerade,
  scarf,
  bandana,
  bowTie,
  stripedScarf,
  bellCollar,
  lei,
  pearls,
  medal,
  heroScarf,
  backpack,
  cape,
  balloon,
  batWings,
  fairyWings,
  jetpack,
  angelWings,
  royalCape,
} as const satisfies Record<WearableId, WearModel>

/** Size classes (px) each slot's art is drawn in, so a handful of sizes cover the roster (`render/wearFit.ts` picks one). */
export const SIZE_CLASSES = {
  head: [10, 13, 16],
  face: [10, 13, 16],
  neck: [7, 9, 12],
  back: [12, 16, 22],
} as const satisfies Record<WearableSlot, readonly [number, number, number]>
