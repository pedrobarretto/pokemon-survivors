import * as dm from '../engine/dmath'
import type { RiftLegend } from './rifts'
import type { Ellipse } from './terrain'

/**
 * The floor plan behind each rift: its shape, what stands on it and the rule
 * its ground plays by. Coordinates are arena px around the portal. Floors are
 * unions of circles and convex polygons, so `game/arenaFloor.ts` keeps
 * everyone on them with the same data `render/rift.ts` draws them from.
 */

export type Pt = readonly [number, number]
export type Circle = { kind: 'circle'; x: number; y: number; r: number }
/** A convex polygon. */
export type Poly = { kind: 'poly'; pts: readonly Pt[] }
export type ArenaShape = Circle | Poly

/** Scenery standing in an arena (cover against the legendary's shots). */
export type ArenaPiece = 'seaRock' | 'redPillar' | 'bell' | 'stalagmite' | 'basalt' | 'jadeStump' | 'column' | 'marbleStump' | 'palm' | 'meteorCrystal' | 'nightSpire'

/** What each piece stands on, around its anchor. */
export const ARENA_FEET: Record<ArenaPiece, Ellipse> = {
  seaRock: { x: 0, y: -3, rx: 13, ry: 6 },
  redPillar: { x: 0, y: 0, rx: 8, ry: 4 },
  bell: { x: 0, y: -2, rx: 17, ry: 7 },
  stalagmite: { x: 0, y: -1, rx: 8, ry: 4 },
  basalt: { x: 0, y: -3, rx: 12, ry: 6 },
  jadeStump: { x: 0, y: -1, rx: 8, ry: 4 },
  column: { x: 0, y: 0, rx: 10, ry: 4 },
  marbleStump: { x: 0, y: -1, rx: 8, ry: 4 },
  palm: { x: 0, y: 0, rx: 7, ry: 4 },
  meteorCrystal: { x: 0, y: -1, rx: 9, ry: 4 },
  nightSpire: { x: 0, y: -1, rx: 9, ry: 4 },
}

/** Every few seconds a rule steps the arena (the tide rises, the edge falls), with a warning before. */
export type ArenaStepRule = { every: number; warn: number; max: number; px: number }

export type FloorPattern = 'rings' | 'planks' | 'wetRock' | 'basalt' | 'jade' | 'slabs' | 'sand' | 'craters' | 'garden'

/**
 * The ground of a closed space (a rift's arena, a place's interior): the floor
 * everyone keeps to and where water and lava are. `game/arenaFloor.ts` reads it.
 */
export type FloorPlan = {
  floor: readonly ArenaShape[]
  /** Cut out of the floor (deep water): only flyers and swimmers cross it. */
  holes?: readonly Circle[]
  /** Shallow water that slows walkers, except on the islands. */
  shallow?: readonly ArenaShape[]
  islands?: readonly Circle[]
  /** Lava rivers that burn walkers (Fire types are fine), crossed on the bridges. */
  lava?: readonly { pts: readonly Pt[]; w: number }[]
  bridges?: readonly { x: number; y: number; w: number; h: number }[]
  /** The holes grow by `px` each step (Kyogre's tide). */
  tide?: ArenaStepRule
  /** The floor shrinks toward the center by `px` each step (Sky Pillar crumbling). */
  crumble?: ArenaStepRule
  /** Ground turned to lava by an arena transform (`data/domains.ts`), except on `cool` spots: it burns walkers like the rivers. */
  lavaFields?: readonly ArenaShape[]
  cool?: readonly Circle[]
}

export type ArenaLayout = FloorPlan & {
  solids: readonly { piece: ArenaPiece; x: number; y: number }[]
  pattern: FloorPattern
  /** Where the legendary and the player appear. */
  boss: Pt
  player: Pt
}

const R = 150

export const circle = (x: number, y: number, r: number): Circle => ({ kind: 'circle', x, y, r })
export const poly = (...pts: Pt[]): Poly => ({ kind: 'poly', pts })
/** `n` points evenly around a circle of radius `r`, starting `turn` rad round. */
export const around = (n: number, r: number, turn = 0) =>
  Array.from({ length: n }, (_, i): Pt => [Math.round(dm.cos(turn + (i / n) * Math.PI * 2) * r), Math.round(dm.sin(turn + (i / n) * Math.PI * 2) * r)])

/** A straight stretch of floor `w` px wide from `a` to `b` (a convex quad), for corridors between rooms. */
export const lane = ([ax, ay]: Pt, [bx, by]: Pt, w: number): Poly => {
  const d = Math.sqrt((bx - ax) * (bx - ax) + (by - ay) * (by - ay)) || 1
  const nx = (-(by - ay) / d) * (w / 2)
  const ny = ((bx - ax) / d) * (w / 2)
  return poly([ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny])
}

const LUGIA_ISLANDS = around(6, 104, 0.5).map(([x, y]) => circle(x, Math.round(y * 0.96), 28))

/** Southern Island: a sandy island with palms for cover, ringed by surf that slows whoever wades. Latias and Latios share it. */
const SOUTHERN_ISLAND: ArenaLayout = {
  floor: [circle(0, 0, R)],
  shallow: [circle(0, 0, R)],
  islands: [circle(0, 4, 108), circle(-96, -80, 22), circle(100, 76, 20)],
  solids: [
    { piece: 'palm', x: -72, y: -24 },
    { piece: 'palm', x: 74, y: -38 },
    { piece: 'palm', x: -50, y: 60 },
    { piece: 'palm', x: 58, y: 54 },
  ],
  pattern: 'sand',
  boss: [0, -60],
  player: [0, 50],
}

export const ARENA_LAYOUTS: Record<RiftLegend, ArenaLayout> = {
  /** Whirl Islands: a sunken temple, islands of floor in shallow water that slows whoever wades. */
  lugia: {
    floor: [circle(0, 0, R)],
    shallow: [circle(0, 0, R)],
    islands: [circle(0, 0, 54), ...LUGIA_ISLANDS],
    solids: [0, 2, 4].map((i) => ({ piece: 'seaRock', x: LUGIA_ISLANDS[i]!.x + 6, y: LUGIA_ISLANDS[i]!.y + 6 })),
    pattern: 'rings',
    boss: [0, -66],
    player: [0, 40],
  },
  /** Bell Tower: an octagonal hall, red pillars for cover and the great bell in the middle. */
  hoOh: {
    floor: [poly(...around(8, R + 4, Math.PI / 8))],
    solids: [
      { piece: 'redPillar', x: -70, y: -66 },
      { piece: 'redPillar', x: 70, y: -66 },
      { piece: 'redPillar', x: -70, y: 58 },
      { piece: 'redPillar', x: 70, y: 58 },
      { piece: 'bell', x: 0, y: 6 },
    ],
    pattern: 'planks',
    boss: [0, -70],
    player: [0, 74],
  },
  /** Seafloor Cavern: a ring of wet rock around a deep pool where Kyogre swims; the tide rises and squeezes the ring. */
  kyogre: {
    floor: [circle(0, 0, R)],
    holes: [circle(0, -6, 58)],
    shallow: [circle(-92, 70, 24), circle(104, 46, 20), circle(-40, -116, 18)],
    tide: { every: 15, warn: 3, max: 3, px: 13 },
    solids: [
      { piece: 'stalagmite', x: -122, y: -20 },
      { piece: 'stalagmite', x: 118, y: -50 },
      { piece: 'stalagmite', x: 40, y: 120 },
      { piece: 'stalagmite', x: -70, y: 112 },
    ],
    pattern: 'wetRock',
    boss: [0, -6],
    player: [0, 100],
  },
  /** Magma core: a cave of basalt split by lava rivers; cross on the bridges or burn. */
  groudon: {
    floor: [circle(0, 0, 122), circle(-74, -62, 66), circle(84, -54, 64), circle(70, 78, 66), circle(-84, 72, 58)],
    lava: [
      { pts: [[-190, -14], [-96, -34], [-10, 8], [82, 30], [190, 6]], w: 15 },
      { pts: [[-10, 8], [6, 80], [-6, 190]], w: 11 },
    ],
    bridges: [
      { x: -60, y: -21, w: 20, h: 34 },
      { x: 104, y: 25, w: 20, h: 34 },
      { x: 2, y: 96, w: 32, h: 16 },
    ],
    solids: [
      { piece: 'basalt', x: -110, y: 16 },
      { piece: 'basalt', x: 52, y: -96 },
      { piece: 'basalt', x: 122, y: -8 },
      { piece: 'basalt', x: -30, y: -100 },
      { piece: 'basalt', x: 74, y: 104 },
    ],
    pattern: 'basalt',
    boss: [30, -60],
    player: [-30, 54],
  },
  /** Sky Pillar: a diamond of jade tiles over the sky; ring by ring, its edge falls away. */
  rayquaza: {
    floor: [poly([0, -R], [R, 0], [0, R], [-R, 0])],
    crumble: { every: 15, warn: 3, max: 3, px: 21 },
    solids: [
      { piece: 'jadeStump', x: 0, y: -80 },
      { piece: 'jadeStump', x: 80, y: 0 },
      { piece: 'jadeStump', x: -80, y: 0 },
      { piece: 'jadeStump', x: 0, y: 80 },
    ],
    pattern: 'jade',
    boss: [0, -50],
    player: [0, 44],
  },
  /** Spear Pillar: a marble nave with an apse, colonnades to hide behind and a clock inlaid in the floor. */
  dialga: {
    floor: [poly([-R, -90], [R, -90], [R, 110], [-R, 110]), circle(0, -90, 84)],
    solids: [
      ...[-112, 112].flatMap((x) => [-52, 24, 100].map((y, i) => ({ piece: x > 0 && i === 1 ? ('marbleStump' as const) : ('column' as const), x, y }))),
      { piece: 'column', x: -54, y: -150 },
      { piece: 'column', x: 54, y: -150 },
    ],
    pattern: 'slabs',
    boss: [0, -100],
    player: [0, 70],
  },
  latias: SOUTHERN_ISLAND,
  latios: SOUTHERN_ISLAND,
  /** A meteorite adrift in space: a lumpy, cratered rock with clusters of crystal to hide behind. */
  deoxys: {
    floor: [circle(0, 0, 112), circle(-78, -58, 62), circle(88, -40, 58), circle(66, 82, 56), circle(-86, 64, 54), circle(4, -104, 44)],
    solids: [
      { piece: 'meteorCrystal', x: -98, y: -56 },
      { piece: 'meteorCrystal', x: 104, y: -34 },
      { piece: 'meteorCrystal', x: 74, y: 96 },
      { piece: 'meteorCrystal', x: -96, y: 74 },
      { piece: 'meteorCrystal', x: -46, y: -6 },
      { piece: 'meteorCrystal', x: 48, y: 18 },
    ],
    pattern: 'craters',
    boss: [0, -60],
    player: [0, 50],
  },
  /** Darkrai's Nightmare without its domain (co-op): a slab of dark dream adrift, spires of black crystal to hide behind. */
  darkrai: {
    floor: [circle(0, 0, R)],
    solids: [
      { piece: 'nightSpire', x: -84, y: -44 },
      { piece: 'nightSpire', x: 86, y: -40 },
      { piece: 'nightSpire', x: -60, y: 70 },
      { piece: 'nightSpire', x: 64, y: 72 },
    ],
    pattern: 'slabs',
    boss: [0, -60],
    player: [0, 50],
  },
}

/** How far an arena reaches from its center, for culling shots and sizing the floor art. */
export const ARENA_REACH = 160
