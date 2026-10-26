import type { LandmarkPiece } from './landmarks'

/**
 * Scenery that gets in the way: rocks, trees, bushes, fallen logs, mountains,
 * ridges, columns and towers block whoever walks, lakes and bays slow them.
 * Every shape here is a union of ellipses on the ground (world px, relative
 * to the feature's anchor), the same in every biome: the biome only dresses
 * it (`render/terrain.ts`; ridges are drawn as mountains and bays as lakes, so
 * every biome's skin covers them). How much of each a run's map holds comes
 * from its archetype (`data/mapArchetypes.ts`). Placement and collision live
 * in `game/terrain.ts`.
 */

/** An ellipse on the ground. */
export type Ellipse = { x: number; y: number; rx: number; ry: number }

/** One step of a terraced mountain: a footprint raised `h` px over the step below. The first tier is the hitbox. */
export type Tier = { foot: readonly Ellipse[]; h: number }

export type SolidKind = 'rock' | 'tree' | 'bush' | 'log' | 'tower' | 'cliff'

/** What a single rock, tree trunk, bush, log or tower stands on. */
export const SOLID_FOOT = {
  rock: { x: 0, y: -3, rx: 13, ry: 6 },
  tree: { x: 0, y: -1, rx: 7, ry: 4 },
  bush: { x: 0, y: -2, rx: 10, ry: 4 },
  log: { x: 0, y: -2, rx: 19, ry: 5 },
  tower: { x: 0, y: -1, rx: 15, ry: 7 },
} as const satisfies Record<Exclude<SolidKind, 'cliff'>, Ellipse>

/** Mountains, as terraced footprints. Kept close to convex so the horde slides around them instead of getting stuck. */
const MOUNTAINS: readonly (readonly Tier[])[] = [
  [
    {
      foot: [
        { x: -6, y: 2, rx: 58, ry: 24 },
        { x: -50, y: -6, rx: 30, ry: 20 },
        { x: 44, y: -8, rx: 34, ry: 22 },
        { x: 12, y: -20, rx: 40, ry: 18 },
        { x: -30, y: -22, rx: 26, ry: 14 },
      ],
      h: 20,
    },
    { foot: [{ x: -14, y: -14, rx: 36, ry: 13 }, { x: 20, y: -16, rx: 28, ry: 12 }, { x: -40, y: -16, rx: 14, ry: 8 }], h: 16 },
    { foot: [{ x: 2, y: -20, rx: 20, ry: 8 }, { x: -14, y: -20, rx: 12, ry: 6 }], h: 12 },
  ],
  [
    { foot: [{ x: 0, y: 0, rx: 44, ry: 22 }, { x: 26, y: -8, rx: 28, ry: 18 }, { x: -24, y: -6, rx: 26, ry: 16 }], h: 18 },
    { foot: [{ x: 4, y: -8, rx: 26, ry: 11 }, { x: -14, y: -6, rx: 14, ry: 8 }], h: 14 },
  ],
  [
    {
      foot: [
        { x: 0, y: 0, rx: 70, ry: 16 },
        { x: -40, y: -4, rx: 34, ry: 15 },
        { x: 38, y: -6, rx: 36, ry: 16 },
      ],
      h: 22,
    },
    { foot: [{ x: -20, y: -6, rx: 30, ry: 8 }, { x: 22, y: -8, rx: 26, ry: 8 }], h: 14 },
  ],
]

/** Ellipses of one size strung along a path: the long shapes (ridges, channels) are chains of them. */
const chain = (points: readonly (readonly [number, number])[], rx: number, ry: number): Ellipse[] => points.map(([x, y]) => ({ x, y, rx, ry }))

/**
 * Ridges: long walls of rock spanning a cell (the canyon's, `data/mapArchetypes.ts`).
 * Each reaches a cell's margins, so neighbors line up into long walls with a
 * gap (a chokepoint) at every cell edge; the broken one has a pass in its middle.
 */
const RIDGES: readonly (readonly Tier[])[] = [
  // East to west.
  [
    { foot: chain([[-92, 2], [-46, -2], [0, 1], [46, -3], [92, 1]], 28, 20), h: 20 },
    { foot: chain([[-68, -6], [-22, -8], [24, -7], [68, -8]], 22, 11), h: 14 },
    { foot: chain([[-30, -10], [30, -11]], 16, 6), h: 10 },
  ],
  // North to south.
  [
    { foot: chain([[2, -92], [-2, -46], [1, 0], [-3, 46], [1, 92]], 24, 28), h: 20 },
    { foot: chain([[0, -70], [-2, -24], [1, 22], [-1, 68]], 15, 22), h: 14 },
  ],
  // A corner: a wall along the north and down the west.
  [
    { foot: [...chain([[-96, -94], [-50, -96], [-4, -94], [40, -96]], 26, 18), ...chain([[-98, -54], [-96, -8], [-98, 38], [-96, 84]], 22, 26)], h: 20 },
    { foot: [...chain([[-80, -100], [-34, -101], [12, -100]], 20, 8), ...chain([[-98, -66], [-97, -20], [-98, 26]], 14, 20)], h: 14 },
  ],
  // East to west, broken by a pass in the middle.
  [
    { foot: [...chain([[-96, 0], [-56, -2]], 26, 20), ...chain([[56, 1], [96, -1]], 26, 20)], h: 20 },
    { foot: [...chain([[-84, -6]], 20, 9), ...chain([[84, -6]], 20, 9)], h: 14 },
  ],
  // A gorge: two walls east to west with a corridor between them.
  [
    { foot: [...chain([[-92, -64], [-46, -66], [0, -63], [46, -66], [92, -64]], 28, 18), ...chain([[-92, 66], [-46, 63], [0, 66], [46, 64], [92, 66]], 28, 18)], h: 20 },
    { foot: [...chain([[-60, -70], [0, -69], [60, -70]], 26, 9), ...chain([[-60, 60], [0, 61], [60, 60]], 26, 9)], h: 12 },
  ],
  // A gorge north to south.
  [
    { foot: [...chain([[-64, -92], [-66, -46], [-63, 0], [-66, 46], [-64, 92]], 20, 28), ...chain([[66, -92], [63, -46], [66, 0], [64, 46], [66, 92]], 20, 28)], h: 20 },
    { foot: [...chain([[-64, -60], [-65, 0], [-64, 60]], 12, 28), ...chain([[64, -60], [65, 0], [64, 60]], 12, 28)], h: 12 },
  ],
]

/** Mountains, then ridges: one list so every biome's skin and the minimap draw them alike. */
export const CLIFFS: readonly (readonly Tier[])[] = [...MOUNTAINS, ...RIDGES]

/** How many of `CLIFFS` are mountains (the rest are ridges). */
export const MOUNTAIN_COUNT = MOUNTAINS.length
export const RIDGE_COUNT = RIDGES.length

/** Where something can grow on each mountain's top (and each ridge's): [x, y, tier] (the tier it stands on, counting from 1). */
export const CLIFF_CRESTS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[-36, -16, 1], [30, -16, 1], [-2, -21, 3]],
  [[24, -12, 1], [2, -9, 2]],
  [[-44, -6, 1], [10, -9, 2]],
  [[-90, -4, 1], [86, -6, 1], [-4, -12, 3]],
  [[0, -96, 1], [-1, 2, 2], [1, 70, 1]],
  [[30, -98, 1], [-100, 70, 1], [-60, -102, 2]],
  [[-100, -4, 1], [100, -6, 1]],
  [[-80, -70, 2], [70, -70, 1], [-20, 58, 2], [88, 62, 1]],
  [[-64, -84, 1], [-64, 30, 2], [64, -40, 2], [66, 84, 1]],
]

/** Ponds: flat footprints that slow walkers (ice in the snow, where they slide instead). */
const PONDS: readonly (readonly Ellipse[])[] = [
  [{ x: 0, y: 0, rx: 56, ry: 20 }, { x: -38, y: 8, rx: 28, ry: 14 }, { x: 32, y: -6, rx: 32, ry: 15 }],
  [{ x: 0, y: 0, rx: 40, ry: 20 }, { x: 22, y: 6, rx: 26, ry: 14 }],
  [{ x: 0, y: 0, rx: 70, ry: 14 }, { x: -30, y: 4, rx: 36, ry: 13 }, { x: 34, y: -3, rx: 30, ry: 12 }],
]

/**
 * Bays: water filling most of a cell (the archipelago's), so the land between
 * neighbors is a narrow bridge along every cell edge. The ring leaves an
 * island in its middle; the channels line up into long rivers.
 */
const BAYS: readonly (readonly Ellipse[])[] = [
  // A wide bay.
  [{ x: 0, y: 0, rx: 108, ry: 92 }, { x: -60, y: 40, rx: 60, ry: 60 }, { x: 62, y: -40, rx: 58, ry: 62 }, { x: 20, y: 60, rx: 80, ry: 46 }, { x: -40, y: -60, rx: 70, ry: 44 }],
  // A channel, east to west.
  chain([[-90, 0], [-45, 4], [0, -2], [45, 3], [90, -1]], 32, 40),
  // A channel, north to south.
  chain([[0, -90], [4, -45], [-2, 0], [3, 45], [-1, 90]], 40, 32),
  // Two channels crossing.
  [...chain([[-86, 0], [-40, 2], [40, -2], [86, 0]], 34, 28), ...chain([[0, -86], [2, -40], [-2, 40], [0, 86]], 28, 34), { x: 0, y: 0, rx: 54, ry: 52 }],
  // A ring of water around an island.
  chain([[74, 0], [37, 64], [-37, 64], [-74, 0], [-37, -64], [37, -64]], 44, 40),
  // A lagoon in two lobes.
  [{ x: -50, y: -50, rx: 70, ry: 60 }, { x: 50, y: 50, rx: 70, ry: 60 }, { x: 0, y: 0, rx: 56, ry: 52 }],
]

/** Ponds, then bays: one list so every biome's skin and the minimap draw them alike. */
export const LAKES: readonly (readonly Ellipse[])[] = [...PONDS, ...BAYS]

/** How many of `LAKES` are ponds (the rest are bays). */
export const POND_COUNT = PONDS.length
export const BAY_COUNT = BAYS.length

/** Spots for the trees of a grove and the stones of a rock pile, around the feature's anchor. */
export const CLUSTER_SLOTS: readonly (readonly [number, number])[] = [
  [-36, -10], [0, -24], [34, -8], [-16, 16], [22, 18],
]

/** A piece of a drawn arrangement: what stands there and where, around the feature's anchor. */
export type Spot<K extends string> = readonly [kind: K, x: number, y: number]

/** `n` pieces of `kind` from (x, y), each `dx`, `dy` px on from the last; `wobble` px off the line, alternating sides. */
const row = <K extends string>(kind: K, n: number, x: number, y: number, dx: number, dy: number, wobble = 0): Spot<K>[] =>
  Array.from({ length: n }, (_, i) => [kind, x + dx * i + (dy !== 0 ? (i % 2 === 0 ? -wobble : wobble) : 0), y + dy * i + (dx !== 0 ? (i % 2 === 0 ? -wobble : wobble) : 0)] as const)

/**
 * Thickets: walls of trees close enough that nobody slips between their
 * trunks, with a bush at each end (the forest's, `data/mapArchetypes.ts`).
 * Neighbors' walls turn the woods into a maze of trails.
 */
export const THICKETS: readonly (readonly Spot<'tree' | 'bush'>[])[] = [
  // East to west.
  [...row('tree', 11, -90, 0, 18, 0, 3), ['bush', -110, 0], ['bush', 110, 0]],
  // North to south.
  [...row('tree', 13, 0, -96, 0, 16, 3), ['bush', 0, -114], ['bush', 0, 114]],
  // A corner.
  [...row('tree', 9, -96, -90, 18, 0, 2), ...row('tree', 10, -96, -72, 0, 16, 2), ['bush', 70, -90], ['bush', -96, 92]],
  // A clearing open to the south.
  [...row('tree', 9, -80, -80, 20, 0, 2), ...row('tree', 7, -92, -60, 0, 16, 2), ...row('tree', 7, 92, -60, 0, 16, 2), ['bush', -92, 54], ['bush', 92, 54]],
  // A trail between two walls.
  [...row('tree', 11, -90, -48, 18, 0, 2), ...row('tree', 11, -90, 48, 18, 0, 2), ['bush', -110, -48], ['bush', 110, 48]],
]

/** What stands in the ruins' colonnades: broken columns, standing stones and rubble. */
export type ColonnadePiece = 'column' | 'menhir' | 'rock'

/** The footprint of each colonnade piece, from its anchor (the landmarks' own sizes, `game/landmarkLayout.ts`). */
export const COLONNADE_FOOT = {
  column: { x: 0, y: -1, rx: 7, ry: 4 },
  menhir: { x: 0, y: -1, rx: 6, ry: 3.5 },
  rock: SOLID_FOOT.rock,
} as const satisfies Record<ColonnadePiece, Ellipse>

/**
 * Colonnades: old columns and standing stones in rows and rings (the ruins
 * field's, `data/mapArchetypes.ts`), cover that breaks enemy shots.
 */
export const COLONNADES: readonly (readonly Spot<ColonnadePiece>[])[] = [
  // Two rows of four.
  [...row('column', 4, -66, -34, 44, 0), ...row('column', 4, -66, 34, 44, 0)],
  // A ring of standing stones open to the south.
  [['menhir', 64, 0], ['menhir', 45, 31], ['menhir', -45, 31], ['menhir', -64, 0], ['menhir', -45, -31], ['menhir', 0, -44], ['menhir', 45, -31]],
  // Fallen and standing, here and there.
  [['column', -60, -40], ['column', 10, -56], ['column', 64, -10], ['column', -30, 30], ['column', 40, 48], ['rock', -72, 40]],
  // An avenue.
  [...row('column', 5, -90, -24, 45, 0), ...row('column', 5, -90, 24, 45, 0)],
]

/**
 * What a cell can hold (a landmark, `data/landmarks.ts`, takes its cell
 * first). The run's map archetype (`data/mapArchetypes.ts`) weighs them.
 * `ridge`, `bay`, `thicket` and `colonnade` are the long shapes the
 * archetypes bring: ridges are `cliff` solids and bays `lake`s, drawn by the
 * same skins.
 */
export type FeatureKind = 'none' | 'rocks' | 'grove' | 'bushes' | 'log' | 'cliff' | 'lake' | 'tower' | 'ridge' | 'bay' | 'thicket' | 'colonnade'

/**
 * The thin scenery a Ghost-type player slips through (`game/terrain.ts`,
 * `phases`): trees, bushes, rocks, logs, columns, standing stones, hedges and
 * fences. Mountains, ridges, towers and walls still stop it, so it can't hide
 * inside a hill where the horde can't follow.
 */
export const THIN_SOLIDS: ReadonlySet<string> = new Set<SolidKind | LandmarkPiece>(['rock', 'tree', 'bush', 'log', 'column', 'menhir', 'hedge', 'fence'])

/** The single pieces strewn about a cell (`TERRAIN.scatter`). */
export type ScatterKind = 'bush' | 'rock' | 'tree'

export const TERRAIN = {
  /** World px per cell; each cell holds at most one feature, kept clear of the cell's edges. */
  cell: 288,
  /** Free px kept between a feature's footprint and its cell's edge, so neighbors never close a passage. */
  margin: 22,
  /** No terrain within this distance of where the run starts. */
  clearStart: 320,
  /**
   * Single bushes, rocks and trees strewn around a cell's feature (none
   * around a landmark): kept `clear` px from the feature and from each other.
   * How many and which come from the run's map archetype.
   */
  scatter: { clear: 22, spacing: 40 },
  /** Walking speed in water for whoever wades (`game/terrain.ts`, `groundPace`). */
  waterPace: 0.62,
  /** A Water-type player surfs a lake this much faster than it walks. */
  surfPace: 1.25,
  /** An Ice-type player skates on ice this much faster than it walks, without sliding. */
  skatePace: 1.2,
  /** How fast the player's speed follows the stick on ice (per second): low means sliding. */
  iceGrip: 2.6,
  /** Variants of the single pieces (each is drawn a little differently). */
  rockVariants: 3,
  treeVariants: 3,
  bushVariants: 3,
  logVariants: 2,
} as const
