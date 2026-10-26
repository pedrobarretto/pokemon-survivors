import { createRng } from '../engine/rng'
import { MAZE, type LandmarkGround, type LandmarkId, type LandmarkPiece } from '../data/landmarks'
import { SOLID_FOOT, type Ellipse, type SolidKind } from '../data/terrain'
import * as dm from '../engine/dmath'

/**
 * Where each landmark's pieces stand, around its anchor (world px, before
 * `game/terrain.ts` places it in its cell). Pure: the same id and variant
 * always build the same layout, so the replay rebuilds the same map.
 */

type Pos = { x: number; y: number }

/**
 * A piece of a landmark: what it is (its own art, or the map's trees and
 * bushes), where its art stands and what it blocks. `loot` marks the ones that
 * change once the treasure is taken (the treasure itself, the ruins' glyphs);
 * `gone` the ones that leave then (the Snorlax, woken), `game/terrain.ts`
 * building the cell without them.
 */
export type PiecePlan = { kind: LandmarkPiece | SolidKind; x: number; y: number; variant: number; foot: readonly Ellipse[]; loot?: true; gone?: true }

export type LandmarkPlan = {
  pieces: readonly PiecePlan[]
  /** Flat art under it (a floor, gravel paths), its art anchored at (x, y). */
  ground: { kind: LandmarkGround; variant: number; x: number; y: number }
  /** Where its treasure stands, if it has one: the player opens it standing close (`LANDMARK.treasureRadius`). */
  treasure: Pos | null
  /** The tunnel's mouths, west then east: the spot in front of each one. */
  mouths: readonly Pos[]
  /** Water at the anchor, one of the map's lakes (`LAKES`): the pier's, the glitched coast's. */
  lake?: number
}

/** Looks of each landmark (`landmarkPlan`'s `variant`). */
export const LANDMARK_VARIANTS: Record<LandmarkId, number> = { cottage: 2, tunnel: 1, maze: MAZE.patterns, ruins: 2, camp: 2, snorlax: 2, center: 2, rocket: 2, truck: 2, glitch: 2 }

/** A straight wall from (x0, y0) to (x1, y1), along x or along y, as a chain of ellipses `half` px thick. */
export const wallFoot = (x0: number, y0: number, x1: number, y1: number, half: number): Ellipse[] => {
  const len = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))
  const n = Math.max(1, Math.ceil(len / 14))
  const step = len / n
  const along = Math.abs(x1 - x0) >= Math.abs(y1 - y0)
  return Array.from({ length: n }, (_, i) => {
    const t = (i + 0.5) / n
    return along
      ? { x: x0 + (x1 - x0) * t, y: y0, rx: step / 2 + 3, ry: half }
      : { x: x0, y: y0 + (y1 - y0) * t, rx: half, ry: step / 2 + 3 }
  })
}

const ellipseAt = (x: number, y: number, rx: number, ry: number): Ellipse => ({ x, y, rx, ry })

/** A piece whose foot is one ellipse around its anchor. */
const single = (kind: LandmarkPiece, x: number, y: number, rx: number, ry: number, variant = 0): PiecePlan => ({ kind, x, y, variant, foot: [ellipseAt(x, y - 1, rx, ry)] })

/* ---------------- The cottage ---------------- */

/** The cottage's size: half its width, its depth, half its door and half a wall's thickness. */
export const COTTAGE = { half: 58, depth: 68, door: 13, wall: 4 } as const

/**
 * An abandoned cottage without its roof, anchored at its door: four stone
 * walls (the south one split by the door), a bed, a table and a crate with the
 * treasure inside; a well in the yard (left or right) and what's left of a fence.
 */
const cottage = (variant: number): LandmarkPlan => {
  const { half: W, depth: D, door, wall: T } = COTTAGE
  const side = variant % 2 === 0 ? 1 : -1
  const crate = { x: 38 * side, y: -D + 14 }
  return {
    pieces: [
      { kind: 'wallN', x: 0, y: -D, variant: 0, foot: wallFoot(-W, -D, W, -D, T) },
      { kind: 'wallW', x: -W, y: 0, variant: 0, foot: wallFoot(-W, -D, -W, 0, T) },
      { kind: 'wallE', x: W, y: 0, variant: 0, foot: wallFoot(W, -D, W, 0, T) },
      { kind: 'wallS', x: -dm.round((W + door) / 2), y: 0, variant: 0, foot: wallFoot(-W, 0, -door, 0, T) },
      { kind: 'wallS', x: dm.round((W + door) / 2), y: 0, variant: 1, foot: wallFoot(door, 0, W, 0, T) },
      { ...single('crate', crate.x, crate.y, 8, 4), loot: true },
      single('bed', -34 * side, -D + 18, 12, 6),
      single('table', -8 * side, -30, 9, 4),
      single('well', 86 * side, -24, 11, 6),
      { kind: 'fence', x: -60 * side, y: 30, variant: 0, foot: wallFoot(-80 * side, 30, -40 * side, 30, 2) },
    ],
    ground: { kind: 'floor', variant, x: 0, y: 0 },
    treasure: crate,
    mouths: [],
  }
}

/* ---------------- The tunnel ---------------- */

/** The tunnel's ridge, as terraced footprints (the map's mountains, stretched long), and its mouths. */
export const RIDGE = {
  tiers: [
    {
      foot: [
        { x: 0, y: -24, rx: 112, ry: 20 },
        { x: -80, y: -12, rx: 32, ry: 18 },
        { x: 80, y: -12, rx: 32, ry: 18 },
        { x: -30, y: -38, rx: 58, ry: 16 },
        { x: 40, y: -40, rx: 52, ry: 14 },
      ],
      h: 30,
    },
    { foot: [{ x: -12, y: -34, rx: 64, ry: 12 }, { x: 46, y: -34, rx: 30, ry: 10 }], h: 20 },
    { foot: [{ x: -16, y: -38, rx: 30, ry: 8 }], h: 14 },
  ],
  /** Mouths at the foot of its two ends (x of each). */
  mouthX: 80,
} as const

/** A long ridge with a mine tunnel through it: a timbered mouth at each end, rails out of both and a mine cart left by one. */
const tunnel = (): LandmarkPlan => {
  const mouthY = 14
  return {
    pieces: [
      { kind: 'ridge', x: 0, y: 0, variant: 0, foot: RIDGE.tiers[0].foot },
      single('cart', -40, 16, 8, 4),
    ],
    ground: { kind: 'rails', variant: 0, x: 0, y: 0 },
    treasure: null,
    mouths: [
      { x: -RIDGE.mouthX, y: mouthY },
      { x: RIDGE.mouthX, y: mouthY },
    ],
  }
}

/* ---------------- The hedge maze ---------------- */

/** A maze's walls: `h[r][c]` the wall on the north side of cell (c, r) (row `size` is the south edge), `v[r][c]` the one on its west side. */
export type MazeWalls = { h: boolean[][]; v: boolean[][] }

/**
 * A perfect maze carved from the center cell outward (depth first, seeded),
 * so every corridor reaches the heart; the middle of the south side is the way in.
 */
export const carveMaze = (seed: number, n = MAZE.size): MazeWalls => {
  const h = Array.from({ length: n + 1 }, () => Array<boolean>(n).fill(true))
  const v = Array.from({ length: n }, () => Array<boolean>(n + 1).fill(true))
  const rng = createRng(seed)
  const seen = Array.from({ length: n }, () => Array<boolean>(n).fill(false))
  const mid = Math.floor(n / 2)
  const stack: (readonly [number, number])[] = [[mid, mid]]
  seen[mid]![mid] = true
  while (stack.length > 0) {
    const [c, r] = stack[stack.length - 1]!
    const next = ([[0, -1], [1, 0], [0, 1], [-1, 0]] as const).filter(([dx, dy]) => seen[r + dy]?.[c + dx] === false)
    if (next.length === 0) {
      stack.pop()
      continue
    }
    const [dx, dy] = next[Math.floor(rng() * next.length)]!
    if (dy === -1) h[r]![c] = false
    if (dy === 1) h[r + 1]![c] = false
    if (dx === -1) v[r]![c] = false
    if (dx === 1) v[r]![c + 1] = false
    seen[r + dy]![c + dx] = true
    stack.push([c + dx, r + dy])
  }
  h[n]![mid] = false
  return { h, v }
}

/** The mazes a run picks from, carved once. */
export const MAZE_PATTERNS: readonly MazeWalls[] = Array.from({ length: MAZE.patterns }, (_, i) => carveMaze(7001 + i * 31))

/** Where the maze's corridors start (its north-west corner), around its anchor at the middle of the way in. */
const mazeOrigin = () => ({ x: -(MAZE.size * MAZE.cell) / 2, y: -MAZE.size * MAZE.cell })

/**
 * The hedges of one row line of a maze (`row` 0 is its north edge, `size` its
 * south one): the walls along it, the walls of the row of cells above it and
 * a post wherever walls meet. One piece per line, so the player walks behind
 * the hedges south of them and in front of the rest.
 */
export const hedgeRow = (walls: MazeWalls, row: number): Ellipse[] => {
  const { cell: S, wall: T, size: n } = MAZE
  const o = mazeOrigin()
  const foot: Ellipse[] = []
  const y = o.y + row * S
  for (let c = 0; c < n; c++) if (walls.h[row]![c]) foot.push(ellipseAt(o.x + (c + 0.5) * S, y, S / 2 + 1, T))
  if (row > 0) for (let c = 0; c <= n; c++) if (walls.v[row - 1]![c]) foot.push(ellipseAt(o.x + c * S, y - S / 2, T, S / 2 + 1))
  for (let c = 0; c <= n; c++) {
    const touches = walls.h[row]![c - 1] === true || walls.h[row]![c] === true || walls.v[row - 1]?.[c] === true || walls.v[row]?.[c] === true
    if (touches) foot.push(ellipseAt(o.x + c * S, y, T + 1, T))
  }
  return foot
}

/** A hedge maze with a chest at its heart, one of `MAZE_PATTERNS`. */
const maze = (variant: number): LandmarkPlan => {
  const walls = MAZE_PATTERNS[variant % MAZE.patterns]!
  const o = mazeOrigin()
  const heart = { x: 0, y: o.y + (MAZE.size * MAZE.cell) / 2 - 2 }
  return {
    pieces: [
      ...Array.from({ length: MAZE.size + 1 }, (_, row): PiecePlan => ({ kind: 'hedge', x: 0, y: o.y + row * MAZE.cell, variant: variant * 8 + row, foot: hedgeRow(walls, row) })),
      { ...single('chest', heart.x, heart.y, 8, 4), loot: true },
    ],
    ground: { kind: 'gravel', variant, x: 0, y: 0 },
    treasure: heart,
    mouths: [],
  }
}

/* ---------------- The ruins ---------------- */

/** Standing stones around the altar, and the ring they stand on. */
export const RUINS = { stones: 7, rx: 62, ry: 46, gap: 1.1 } as const

/**
 * Unown ruins: standing stones carved with glyphs in a ring open to the
 * south, a stone altar in the middle (the treasure) and broken columns outside.
 */
const ruins = (variant: number): LandmarkPlan => {
  const { stones, rx, ry, gap } = RUINS
  const span = Math.PI * 2 - gap
  const ring = Array.from({ length: stones }, (_, i) => {
    const a = Math.PI / 2 + gap / 2 + (span * i) / (stones - 1)
    return { ...single('menhir', dm.round(dm.cos(a) * rx), dm.round(dm.sin(a) * ry), 6, 3.5, (i + variant * 3) % 8), loot: true as const }
  })
  const side = variant % 2 === 0 ? 1 : -1
  const altar = { x: 0, y: -8 }
  return {
    pieces: [
      ...ring,
      { ...single('altar', altar.x, altar.y, 12, 5), loot: true },
      single('column', -88 * side, -24, 7, 4, 0),
      single('column', 90 * side, 16, 7, 4, 1),
    ],
    ground: { kind: 'plaza', variant, x: 0, y: 0 },
    treasure: altar,
    mouths: [],
  }
}

/* ---------------- The camp ---------------- */

/** An abandoned camp around a campfire: a tent, log benches and a backpack someone left behind. */
const camp = (variant: number): LandmarkPlan => {
  const s = variant % 2 === 0 ? 1 : -1
  const pack = { x: -14 * s, y: 6 }
  return {
    pieces: [
      single('campfire', 0, 0, 7, 4),
      single('tent', -38 * s, -24, 20, 8, variant),
      single('log', 4 * s, -22, 13, 4),
      single('log', 30 * s, 8, 11, 4, 1),
      { ...single('pack', pack.x, pack.y, 5, 3), loot: true },
    ],
    ground: { kind: 'camp', variant, x: 0, y: 0 },
    treasure: pack,
    mouths: [],
  }
}

/* ---------------- The games' nods ---------------- */

/** One of the map's own trees, bushes or rocks standing in a landmark. */
const scenery = (kind: 'tree' | 'bush' | 'rock', x: number, y: number, variant: number): PiecePlan => ({
  kind,
  x,
  y,
  variant: variant % 3,
  foot: [{ ...SOLID_FOOT[kind], x: SOLID_FOOT[kind].x + x, y: SOLID_FOOT[kind].y + y }],
})

/** The Snorlax: how far its body reaches on the ground. */
export const SNORLAX_FOOT = { rx: 24, ry: 10 } as const

/**
 * A Snorlax asleep across a path (Routes 12 and 16): a dirt road between two
 * hedgerows, their bushes set close enough that nobody slips between them,
 * trees at the corners, and the Snorlax lying across its middle. Its belly
 * is the treasure: stand by it long enough and it wakes (`SNORLAX`), leaving
 * the way open.
 */
const snorlax = (variant: number): LandmarkPlan => {
  const rows = [-56, -40, -24, -8, 8, 24, 40]
  const sway = (i: number, side: number) => [0, 2, -1, 1, -2, 1, 0][(i + (side > 0 ? 3 : 0) + variant) % 7]!
  const s = variant % 2 === 0 ? 1 : -1
  return {
    pieces: [
      { kind: 'snorlax', x: 0, y: 0, variant, foot: [{ x: 0, y: -2, ...SNORLAX_FOOT }], loot: true, gone: true },
      ...[-1, 1].flatMap((side) => rows.map((y, i) => scenery('bush', side * (37 + sway(i, side)), y, i + variant + (side > 0 ? 1 : 0)))),
      scenery('tree', -64 * s, -76, variant),
      scenery('tree', 62 * s, -70, variant + 1),
      scenery('tree', 66 * s, 56, variant + 2),
    ],
    ground: { kind: 'route', variant, x: 0, y: 0 },
    treasure: { x: 0, y: -2 },
    mouths: [],
  }
}

/** The Pokémon Center's size: half its width, its depth and half its door. */
export const CENTER = { half: 40, depth: 34, door: 8 } as const

/**
 * A Pokémon Center: red roof, white walls, the Poké Ball over the sliding
 * door and Chansey by it. Standing at the door heals the Pokémon back to
 * full, once (`LANDMARK_LOOT.center`). Anchored at the door's foot.
 */
const center = (variant: number): LandmarkPlan => {
  const side = variant % 2 === 0 ? 1 : -1
  const { half: W, depth: D } = CENTER
  return {
    pieces: [
      { kind: 'center', x: 0, y: 0, variant: 0, foot: wallFoot(-W + 8, -D / 2, W - 8, -D / 2, D / 2), loot: true },
      scenery('bush', -(W + 16) * side, -6, variant),
      scenery('bush', (W + 14) * side, -10, variant + 1),
      scenery('tree', (W + 30) * side, -34, variant + 2),
    ],
    ground: { kind: 'court', variant, x: 0, y: 0 },
    treasure: { x: 0, y: 8 },
    mouths: [],
  }
}

/**
 * Team Rocket's hideout: a dark tent with the red R, crates of loot and the
 * Meowth balloon tied to a stake, ready to blast off again. Taking the
 * balloon's stake (the treasure) lets it go, Pay Day spilling behind it.
 */
const rocket = (variant: number): LandmarkPlan => {
  const s = variant % 2 === 0 ? 1 : -1
  const stake = { x: 38 * s, y: 4 }
  return {
    pieces: [
      single('rocketTent', -22 * s, -12, 22, 9),
      { ...single('balloon', stake.x, stake.y, 4, 3), loot: true },
      single('crate', -60 * s, 14, 8, 4),
      single('crate', -46 * s, 22, 8, 4),
      single('log', 8 * s, 26, 13, 4),
    ],
    ground: { kind: 'hideout', variant, x: 0, y: 0 },
    treasure: stake,
    mouths: [],
  }
}

/**
 * The truck by the pier (the S.S. Anne's, in Vermilion City): a quay on the
 * shore of a long stretch of water, the ship moored in it and an old truck
 * nobody ever moved. Searching by it (the treasure) is the rumor: once in a
 * long while Mew shows (`LANDMARK_LOOT.truck.rumor`), and nothing otherwise.
 * Anchored at the water's middle.
 */
const truck = (variant: number): LandmarkPlan => {
  const s = variant % 2 === 0 ? 1 : -1
  const at = { x: 38 * s, y: 50 }
  return {
    pieces: [
      { kind: 'ship', x: -18 * s, y: 4, variant, foot: [{ x: -18 * s, y: 0, rx: 30, ry: 6 }] },
      { kind: 'truck', x: at.x, y: at.y, variant, foot: [{ x: at.x, y: at.y - 2, rx: 20, ry: 8 }] },
      single('bollard', -44 * s, 26, 3, 2),
      single('bollard', 2 * s, 28, 3, 2, 1),
      single('crate', 72 * s, 34, 8, 4),
    ],
    ground: { kind: 'pier', variant, x: 0, y: 0 },
    treasure: { x: at.x, y: at.y - 2 },
    mouths: [],
    lake: 2,
  }
}

/**
 * MissingNo.'s coast (Cinnabar's east shore): a little bay whose shore tiles
 * came out garbled, and on them a backwards L of scrambled pixels. Standing
 * by it, the item it gives comes out twice (`LANDMARK_LOOT.glitch.copies`).
 * Anchored at the water's middle.
 */
const glitch = (variant: number): LandmarkPlan => {
  const s = variant % 2 === 0 ? 1 : -1
  const at = { x: -12 * s, y: 46 }
  return {
    pieces: [
      { ...single('missingno', at.x, at.y, 7, 3), loot: true },
      scenery('rock', 52 * s, 40, variant),
    ],
    ground: { kind: 'glitch', variant, x: 0, y: 0 },
    treasure: at,
    mouths: [],
    lake: 1,
  }
}

/** Every landmark's layout around its anchor. */
export const landmarkPlan = (id: LandmarkId, variant: number): LandmarkPlan => {
  switch (id) {
    case 'cottage':
      return cottage(variant)
    case 'tunnel':
      return tunnel()
    case 'maze':
      return maze(variant)
    case 'ruins':
      return ruins(variant)
    case 'camp':
      return camp(variant)
    case 'snorlax':
      return snorlax(variant)
    case 'center':
      return center(variant)
    case 'rocket':
      return rocket(variant)
    case 'truck':
      return truck(variant)
    case 'glitch':
      return glitch(variant)
  }
}
