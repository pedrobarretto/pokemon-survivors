import type { WearableSlot } from '../data/cosmetics'
import type { WearableId } from '../data/wearables'
import { box, capsule, cone, cylinder, ellipsoid, sphere, torus, blend, type Ramp, type Scene } from './wearArt'
import { depthOf, PITCH, radius, type ArtDir, type Layer, type WearSize } from './wearFit'

/**
 * The Arena's wearables as models (`render/wearArt.ts` renders them): one per
 * id of `WEARABLES`. Each is built around its slot's pivot, the point the
 * anchors give in every direction (`render/wearFit.ts`):
 *
 * - head: the top of the head's axis; the head is a sphere of `head / 2` below it.
 * - back: the body's axis at the shoulders; the back `body / 2` behind it (−z), the
 *   feet `drop` below and the top of the head `rise` above.
 *
 * Bands and rings carry the head as an occluder, so their far side hides
 * behind it as the Pokémon turns, and the parts that wrap the wearer are
 * marked `HUG`: the dresser keeps them on the sprite's head, whatever its shape. Sizes are px;
 * a part thinner than a pixel vanishes, so lines are at least 0.5 px in radius.
 */

export type WearModel = {
  /** The scene for a size, a frame of its animation (0 when still) and an art direction (what's flat on a hat turns toward the camera in profile). */
  scene: (size: WearSize, frame: number, dir: ArtDir) => Scene
  /** Open on top (a ring, a band): what grows from the head (a leaf, a horn) shows through its far side. */
  open?: true
  /** An animated model's frames and how long each shows (s). */
  frames?: { count: number; every: number }
  /** Its own layer per art direction (S, SE, E, NE, N), where its slot's (`SLOT_LAYERS`) doesn't suit. */
  layers?: readonly [Layer, Layer, Layer, Layer, Layer]
  /** A hat that sits on the forehead by itself, from the wearer's brow (`WearSize.brow`): never pressed (`squashOf`). */
  unpressed?: true
  /** A hat that sits on top of the head rather than round it: sized by `perch`, so a wide skull's is a hat, not a tent. */
  perched?: true
  /**
   * The hat worn another way on a head with no forehead, where pressed as far
   * as it goes and lifted it would still come down over the eyes (`squashOf`):
   * a cap turned back to front, a beanie pushed up. Never pressed.
   */
  tight?: WearModel['scene']
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
const SKY: Ramp = ['#2858a0', '#4888d8', '#78b8f0', '#d0ecff']
const BLUE: Ramp = ['#1c3070', '#2c50b0', '#4c80e0', '#a0c8f8']
const PURPLE: Ramp = ['#381450', '#602890', '#9048c0', '#c890f0']
const BLACK: Ramp = ['#101018', '#22222e', '#383848', '#606078']
const STEEL: Ramp = ['#404858', '#707a8c', '#a0aabc', '#e0e8f4']
const WHITE: Ramp = ['#8c94a4', '#c4ccd8', '#eceff4', '#ffffff']
const CREAM: Ramp = ['#a08860', '#d8c098', '#f4e8c8', '#fffaf0']
const IVORY: Ramp = ['#907858', '#c8b088', '#ece0c0', '#fffcf0']
const HALO: Ramp = ['#c89820', '#f0c838', '#f8e878', '#fffce0']

/* ---------------- Building blocks ---------------- */

type Dist = (x: number, y: number, z: number) => number
/**
 * A part of a model: its distance, its ramp (an index into the scene's
 * `ramps`, `OCCLUDER` for one, or a function of the point for patterns) and
 * `HUG` for a part that wraps the wearer (`Scene.hug`).
 */
type Part = readonly [Dist, number | ((x: number, y: number, z: number) => number), typeof HUG?]
const OCCLUDER = -1
const HUG = 'hug'

/** The index of the part nearest a point. */
const nearest = (parts: readonly Part[], x: number, y: number, z: number) => {
  let d = Infinity
  let k = 0
  for (let i = 0; i < parts.length; i++) {
    const e = parts[i]![0](x, y, z)
    if (e < d) [d, k] = [e, i]
  }
  return k
}

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
  part: (x, y, z) => nearest(parts, x, y, z),
  ...(parts.some((p) => p[2] === HUG) && { hug: (x: number, y: number, z: number) => parts[nearest(parts, x, y, z)]![2] === HUG }),
  ramps,
  ...bounds,
  ...extra,
})

/** The head under a hat: a sphere of radius `r` whose top is the origin. */
const headUnder = (r: number): Part => [(x, y, z) => sphere(x, y + r, z, r * 0.98), OCCLUDER]

/** A ring standing upright, facing +z (around the z axis), centered at (cx, cy, cz). */
const ringZ = (x: number, y: number, z: number, cx: number, cy: number, cz: number, big: number, small: number) => Math.hypot(Math.hypot(x - cx, y - cy) - big, z - cz) - small

/** An angle around the y axis, 0 at the front (+z), growing toward +x. */
const around = (x: number, z: number) => Math.atan2(x, z)

/** Turns (x, z) by `a` around the y axis. */
const turnY = (x: number, z: number, a: number): [number, number] => [x * Math.cos(a) - z * Math.sin(a), x * Math.sin(a) + z * Math.cos(a)]

/**
 * A point in the frame of a part turned `a` about the vertical through (cx, cz),
 * its front (+z) toward the camera's side in profile (−x): artists cheat what's
 * flat toward the viewer (a bow, bunny ears), which edge-on is a line.
 */
const facing = (x: number, z: number, cx: number, cz: number, a: number): readonly [number, number] => {
  const [tx, tz] = turnY(x - cx, z - cz, -a)
  return [cx + tx, cz + tz]
}

/** The frame's offset along a loop of `count`: 0, ½, 1, ½ for four frames (a bob). */
const bob = (frame: number, count: number) => (1 - Math.cos((frame / count) * Math.PI * 2)) / 2

/* ---------------- Head (origin: the top of the head) ---------------- */

/** The head width (px) past which what sits on top grows slower (`perch`). */
const PERCH_FROM = 12

/**
 * The width a hat that sits on top of the head is sized for (`WearModel.perched`), and
 * what rises over a hat that fits round it (horns, a propeller, a pompom): the
 * head's up to `PERCH_FROM` px, then a third as fast. A wide skull (Gengar's,
 * Snorlax's, a crest read as skull) wears a hat, not a tent.
 */
const perch = (w: number) => (w <= PERCH_FROM ? w : PERCH_FROM + (w - PERCH_FROM) * 0.35)

/** `perch` for a radius. */
const above = (r: number) => radius(perch(r * 2 + 1))

const strawHat: WearModel = {
  perched: true,
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

/** A cap's crown, its seam just under the seat (`low` of the head's radius down). */
const capCrown = (r: number, low: number): Dist => (x, y, z) => Math.max(sphere(x, y + r * 0.62, z, r * 1.06), -(y + r * low))

const cap: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    return scene([RED, WHITE, GREEN], [
      headUnder(r),
      [capCrown(r, 0.3), (x, y, z) => (z > r * 0.45 && y > -r * 0.2 ? (Math.abs(x) < r * 0.16 && y > 0 && y < r * 0.26 ? 2 : 1) : 0)],
      [(x, y, z) => Math.max(ellipsoid(x, y + r * 0.3, z - r * 0.82, r * 0.74, 0.55, r * 0.72), -(z - r * 0.4)), 0],
      [(x, y, z) => sphere(x, y - r * 0.44, z, 0.9), 0],
    ], { r: r * 1.6, top: r * 0.55, bottom: -r * 0.6 })
  },
  // Back to front: the brim out behind, over the nape, and the crown shallow on top.
  tight: ({ head }) => {
    const r = radius(head)
    return scene([RED, WHITE], [
      headUnder(r),
      [capCrown(r, 0.12), (_x, y, z) => (z < -r * 0.5 && y > -r * 0.1 ? 1 : 0)],
      [(x, y, z) => Math.max(ellipsoid(x, y + r * 0.12, z + r * 0.82, r * 0.7, 0.55, r * 0.66), z + r * 0.4), 0],
      [(x, y, z) => sphere(x, y - r * 0.44, z, 0.9), 0],
    ], { r: r * 1.6, top: r * 0.55, bottom: -r * 0.4 })
  },
}

const partyHat: WearModel = {
  perched: true,
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

/**
 * How far what's flat and faces front on a hat (a bow, bunny ears) turns
 * toward the camera in profile (radians): edge-on it's a stick.
 */
const FLAT_TURN = (50 * Math.PI) / 180

const hairBow: WearModel = {
  perched: true,
  scene: ({ head }, _frame, dir) => {
    const r = radius(head)
    const cy = r * 0.22
    const turn = dir === 2 ? FLAT_TURN : 0
    const lobe = (x0: number, y: number, z0: number, side: number) => {
      const [x, z] = facing(x0, z0, 0, r * 0.08, turn)
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

const topHat: WearModel = {
  perched: true,
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

const chefHat: WearModel = {
  perched: true,
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
  perched: true,
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
  perched: true,
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

/** Where a Santa hat's tip flops (x, z): to the wearer's left and back. */
const FLOP = [0.8, -0.6] as const

const santaHat: WearModel = {
  scene: ({ head }) => {
    const r = radius(head)
    const a = above(r)
    const h = a * 1.25
    // The tip flops over and down, to the side and back (`FLOP`): turned, it shows behind the head.
    const sock: Dist = (x, y, z) => {
      const t = Math.min(Math.max(y / h, 0), 1)
      const f = a * 0.75 * t * t
      return cone(x - f * FLOP[0], y + a * 0.35 * t * t * t, z - f * FLOP[1], r * 0.74, 0.5, -r * 0.2, h)
    }
    const tipX = a * 0.75
    const tipY = h - a * 0.35
    return scene([RED, WHITE], [
      headUnder(r),
      [sock, 0],
      [(x, y, z) => torus(x, y + r * 0.22, z, r * 0.8, Math.max(1.1, r * 0.24)), 1],
      [(x, y, z) => sphere(x - (tipX + 0.5) * FLOP[0], y - tipY + 0.6, z - (tipX + 0.5) * FLOP[1], Math.max(1.3, a * 0.22)), 1],
    ], { r: r * 1.35, top: h + 1, bottom: -r * 0.6 }, { step: 0.6 })
  },
}

const witchHat: WearModel = {
  perched: true,
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
  perched: true,
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
    // The horns from the helmet's sides, as long as a perched hat is tall (`above`).
    const a = above(r)
    const [hx, hy] = [r * 0.82, -r * 0.3]
    const horn = (side: number): Dist => (x, y, z) =>
      Math.min(
        capsule(x, y, z, side * hx, hy, 0, side * (hx + a * 0.4), hy + a * 0.22, 0, a * 0.26),
        capsule(x, y, z, side * (hx + a * 0.4), hy + a * 0.22, 0, side * (hx + a * 0.6), hy + a * 0.72, 0, a * 0.16),
        capsule(x, y, z, side * (hx + a * 0.6), hy + a * 0.72, 0, side * (hx + a * 0.54), hy + a * 1.08, 0, 0.5),
      )
    return scene([STEEL, BRASS, IVORY], [
      headUnder(r),
      [(x, y, z) => Math.max(sphere(x, y + r * 0.5, z, r * 1.04), -(y + r * 0.62)), (x) => (Math.abs(x) < r * 0.14 ? 1 : 0)],
      [(x, y, z) => cylinder(x, y, z, r * 1.08, -r * 0.66, -r * 0.4), 1],
      [horn(1), 2],
      [horn(-1), 2],
    ], { r: hx + a * 0.8, top: hy + a * 1.2, bottom: -r * 0.8 })
  },
}

const bunnyEars: WearModel = {
  open: true,
  scene: ({ head }, _frame, dir) => {
    const r = radius(head)
    // The band fits round the head; the ears are as tall as a perched hat (`above`).
    const a = above(r)
    // In profile each ear turns toward the camera (`FLAT_TURN`), the far one a little ahead, so both show.
    const [turn, apart] = dir === 2 ? [FLAT_TURN, r * 0.28] : [0, 0]
    /** A point in the frame of the ear on `side`: (lx, lz) from its center. */
    const local = (x: number, z: number, side: number) => {
      const [tx, tz] = facing(x, z, side * r * 0.42, side * apart, turn)
      return [tx - side * r * 0.42, tz - side * apart] as const
    }
    const ear = (side: number): Dist => (x, y, z) => {
      const [lx, lz] = local(x, z, side)
      const ly = y - a * 0.82
      // Leaning out a little.
      return ellipsoid(lx * 0.98 - ly * side * 0.16, ly * 0.98 + lx * side * 0.16, lz, a * 0.24 + 0.3, a * 0.72, a * 0.16 + 0.3)
    }
    const inner = (x: number, y: number, z: number) => {
      const side = x < 0 ? -1 : 1
      const [lx, lz] = local(x, z, side)
      return lz > 0.2 && Math.abs(lx * side - (y - a * 0.82) * 0.16) < a * 0.1 + 0.2 && y > a * 0.35 ? 1 : 0
    }
    return scene([WHITE, PINK, BLACK], [
      headUnder(r),
      [(x, y, z) => Math.max(ringZ(x, y, z, 0, -r, 0, r * 1.0, 0.55), -(y + r * 0.6)), 2],
      [ear(1), inner],
      [ear(-1), inner],
    ], { r: r * 1.2, top: a * 1.6, bottom: -r * 0.7 })
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
      return box(bx, y - postTop, bz, above(r) * 0.85, 0.45, 0.7, 0.3)
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
  perched: true,
  open: true,
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
  perched: true,
  open: true,
  frames: { count: HALO_FRAMES, every: 0.22 },
  scene: ({ head }, frame) => {
    const r = radius(head)
    const y0 = r * 0.6 + 1 + bob(frame, HALO_FRAMES)
    return scene([HALO], [[(x, y, z) => torus(x, y - y0, z, Math.max(2.2, r * 0.66), 0.62), 0]], { r: r * 0.8 + 2, top: y0 + 2, bottom: y0 - 2 }, { flat: [0], ink: '#e8b830' })
  },
}

/* ---------------- Back (origin: the body's axis at the shoulders) ---------------- */

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

export const WEAR_MODELS = {
  strawHat,
  cap,
  partyHat,
  hairBow,
  topHat,
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
  balloon,
} as const satisfies Record<WearableId, WearModel>

/**
 * A model's scene for a wearer (`render/wearDress.ts` renders it): a hat
 * stretched front to back as deep as the head is (`depthOf`), drawn at the
 * sprites' pitch (`PITCH`), its part under its seat pressed down to `squash`
 * (0..1) of its height, so its band stays over the eyes of a head whose eyes
 * sit high (Snorlax's), or at 0 worn its tight way (`WearModel.tight`); a hat
 * that sits on top sized by `perch`.
 */
export const sceneOf = (id: WearableId, slot: WearableSlot, size: WearSize, frame: number, squash = 1, dir: ArtDir = 0): Scene => {
  const model = WEAR_MODELS[id]
  const build = squash === 0 && model.tight ? model.tight : model.scene
  const s = { ...build(model.perched ? { ...size, head: perch(size.head) } : size, frame, dir), pitch: PITCH }
  const kz = slot === 'head' ? depthOf(size) : 1
  const sq = slot === 'head' && !model.unpressed && squash > 0 ? squash : 1
  if (kz === 1 && sq === 1) return s
  const Y = (y: number) => (y < 0 ? y / sq : y)
  // Stretching space by a factor shrinks distances by up to its inverse: the march steps that much shorter.
  const k = Math.min(1, sq, kz)
  return {
    ...s,
    sdf: (x, y, z) => s.sdf(x, Y(y), z / kz) * k,
    paint: (x, y, z) => s.paint(x, Y(y), z / kz),
    ...(s.part && { part: (x: number, y: number, z: number) => s.part!(x, Y(y), z / kz) }),
    ...(s.hug && { hug: (x: number, y: number, z: number) => s.hug!(x, Y(y), z / kz) }),
    r: s.r * Math.max(1, kz),
    bottom: s.bottom * sq,
  }
}
