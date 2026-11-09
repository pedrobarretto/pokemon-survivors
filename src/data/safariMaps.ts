import type { SafariHabitat } from './safari'

/**
 * The Zona Safári's four preserves, as data (`realm/games/safariWorld.ts` builds
 * them, `safariArt.ts` bakes them). A map is painted on a grid of vertices (one
 * every `TILE` px, the corners of the Wang tiles): each `Paint` lays a terrain
 * over what's there, in order, so trails cut through the grass painted before
 * them. Coordinates are in vertices. Everything is plain numbers and strings.
 */

export const TILE = 16
/** Vertices across and down: the map is one tile less each way. */
export const MAP_W = 42
export const MAP_H = 34

export const TERRAIN = { ground: 0, tall: 1, path: 2, block: 3, forest: 4 } as const
export type Terrain = (typeof TERRAIN)[keyof typeof TERRAIN]

/** A terrain over an oval (its edge wobbles by `rough` vertices) or along a trail `width` vertices wide. */
export type Paint =
  | { put: keyof typeof TERRAIN; oval: readonly [x: number, y: number, rx: number, ry: number]; rough?: number }
  | { put: keyof typeof TERRAIN; trail: readonly (readonly [x: number, y: number])[]; width: number }

export type PropKind = 'tree' | 'tree2' | 'rock' | 'shrub' | 'accent' | 'fence'

/** A walkable plank crossing a blocking terrain, from vertex to vertex (axis-aligned). */
export type Bridge = { x0: number; y0: number; x1: number; y1: number }

export type SafariMapDef = {
  seed: number
  /** How thick the forest around the map is, in vertices. */
  border: number
  paint: readonly Paint[]
  bridges: readonly Bridge[]
  /** Props placed by hand. */
  props: readonly (readonly [kind: PropKind, x: number, y: number])[]
  /** How many of each to scatter on open ground. */
  scatter: Partial<Record<PropKind, number>>
}

/** The plaza every preserve shares at its south end: the gate, the Ranger's booth and the notice board. */
export const PLAZA = {
  spawn: { x: 21, y: 31.2 },
  /** The arch you walk under into the preserve, facing the plaza. */
  gate: { x: 21, y: 27.4 },
  kiosk: { x: 16.5, y: 31 },
  ranger: { x: 18.9, y: 31.9 },
  board: { x: 25.6, y: 30.6 },
} as const

/** The low fence either side of the arch, in vertices (its posts are solid). */
export const FENCE = { y: 27.2, spans: [[12.5, 18.2], [23.8, 29.5]] } as const

const PLAZA_PAINT: readonly Paint[] = [
  { put: 'path', oval: [21, 31, 8.5, 3.2], rough: 0.5 },
  { put: 'path', trail: [[21, 24], [21, 34]], width: 3 },
]

export const SAFARI_MAPS: Record<SafariHabitat, SafariMapDef> = {
  meadow: {
    seed: 11,
    border: 2,
    paint: [
      { put: 'tall', oval: [9, 24, 6.5, 3.8], rough: 1.2 },
      { put: 'tall', oval: [33, 24.5, 6, 3.6], rough: 1.2 },
      { put: 'tall', oval: [8, 11, 5.5, 6.5], rough: 1.5 },
      { put: 'tall', oval: [34, 10, 5.5, 6.5], rough: 1.5 },
      { put: 'tall', oval: [21, 5.5, 8, 2.8], rough: 1 },
      { put: 'block', oval: [21, 15, 6, 3.6], rough: 1 },
      { put: 'path', trail: [[21, 30], [21, 23], [14, 20], [14.5, 10], [21, 9], [28, 10], [28, 20], [21, 23]], width: 2.5 },
      ...PLAZA_PAINT,
    ],
    bridges: [],
    props: [['tree', 12, 18], ['tree', 30, 18.5], ['tree2', 17, 4], ['rock', 16, 21.5], ['rock', 26.5, 21]],
    scatter: { tree: 7, tree2: 5, rock: 8, shrub: 14 },
  },
  marsh: {
    seed: 23,
    border: 2,
    paint: [
      { put: 'block', oval: [21, 17, 20, 13], rough: 1.5 },
      { put: 'ground', oval: [10, 24, 7.5, 4.5], rough: 1 },
      { put: 'ground', oval: [32, 22.5, 7, 4.5], rough: 1 },
      { put: 'ground', oval: [10, 10, 7, 5.5], rough: 1.2 },
      { put: 'ground', oval: [32, 9.5, 7, 5.5], rough: 1.2 },
      { put: 'ground', oval: [21, 15.5, 5, 3.5], rough: 0.8 },
      { put: 'tall', oval: [9, 24.5, 5.5, 2.8], rough: 0.8 },
      { put: 'tall', oval: [33, 22.5, 5, 2.8], rough: 0.8 },
      { put: 'tall', oval: [9.5, 9.5, 5, 3.8], rough: 0.8 },
      { put: 'tall', oval: [32.5, 9, 5, 3.8], rough: 0.8 },
      { put: 'tall', oval: [21, 15.5, 3.3, 1.8], rough: 0.4 },
      ...PLAZA_PAINT,
    ],
    bridges: [
      { x0: 21, y0: 18.5, x1: 21, y1: 27.5 },
      { x0: 8, y0: 14.5, x1: 8, y1: 21 },
      { x0: 33, y0: 13.8, x1: 33, y1: 19 },
      { x0: 15.5, y0: 15.5, x1: 26.5, y1: 15.5 },
    ],
    props: [['tree', 6, 28], ['tree2', 36, 28], ['accent', 14, 23], ['accent', 28.5, 25]],
    scatter: { tree: 6, tree2: 6, rock: 3, shrub: 12, accent: 6 },
  },
  ridge: {
    seed: 37,
    border: 3,
    paint: [
      { put: 'block', oval: [21, 14, 4.5, 8], rough: 1.3 },
      { put: 'block', oval: [7.5, 17.5, 4.5, 2.2], rough: 0.8 },
      { put: 'block', oval: [34.5, 17, 4.5, 2.2], rough: 0.8 },
      { put: 'tall', oval: [9, 24.5, 5.5, 3.2], rough: 1.6 },
      { put: 'tall', oval: [33, 24.5, 5.5, 3.2], rough: 1.6 },
      { put: 'tall', oval: [9, 10, 5.5, 5], rough: 1.8 },
      { put: 'tall', oval: [33, 10, 5.5, 5], rough: 1.8 },
      { put: 'tall', oval: [21, 4.8, 6.5, 1.8], rough: 0.8 },
      { put: 'path', trail: [[21, 30], [21, 24], [14, 23], [13.5, 8], [20, 3.8]], width: 2.2 },
      { put: 'path', trail: [[21, 24], [28, 23], [28.5, 8], [22, 3.8]], width: 2.2 },
      ...PLAZA_PAINT,
    ],
    bridges: [],
    props: [['accent', 16.5, 26], ['accent', 26, 26], ['rock', 11, 20], ['rock', 31, 20]],
    scatter: { tree: 4, tree2: 4, rock: 16, shrub: 10, accent: 4 },
  },
  cove: {
    seed: 53,
    border: 2,
    paint: [
      { put: 'block', oval: [40, 14, 8.5, 19], rough: 1.4 },
      { put: 'block', oval: [21, 3, 15, 3.2], rough: 1 },
      { put: 'block', oval: [19, 15, 3.6, 2.4], rough: 0.7 },
      { put: 'block', oval: [10, 8.5, 2.6, 1.8], rough: 0.5 },
      { put: 'ground', oval: [32.5, 10, 3.2, 2.8], rough: 0.7 },
      { put: 'tall', oval: [9, 24, 6, 3.4], rough: 1.2 },
      { put: 'tall', oval: [26, 23.5, 4.5, 2.8], rough: 1 },
      { put: 'tall', oval: [8.5, 14.5, 5, 3.2], rough: 1.2 },
      { put: 'tall', oval: [26, 12, 3.8, 4.5], rough: 1.2 },
      { put: 'tall', oval: [32.5, 10, 2.2, 1.8], rough: 0.4 },
      { put: 'path', trail: [[21, 30], [20.5, 21], [14.5, 19], [14, 11], [20, 8]], width: 2.5 },
      { put: 'path', trail: [[20.5, 21], [24, 18], [29.5, 18]], width: 2.2 },
      ...PLAZA_PAINT,
    ],
    bridges: [{ x0: 29, y0: 13, x1: 29, y1: 17.5 }],
    props: [['accent', 14, 28], ['accent', 28.5, 30], ['rock', 21.5, 12]],
    scatter: { tree: 6, tree2: 5, rock: 10, shrub: 8, accent: 5 },
  },
}
