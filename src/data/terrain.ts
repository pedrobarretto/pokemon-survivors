import type { BiomeId } from './biomes'

/**
 * Scenery that gets in the way: rocks, trees, bushes, fallen logs, mountains
 * and towers block whoever walks, lakes slow them. Every shape here is a union of ellipses on
 * the ground (world px, relative to the feature's anchor), the same in every
 * biome but a tower's (`TOWER_FEET`): the biome only dresses it (`render/terrain.ts`). Placement and
 * collision live in `game/terrain.ts`.
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

/**
 * A biome's signature structure takes a tower's cell, on its own footprint
 * (one per variant, drawn from the seed): the desert's pyramids, Mt. Chimney's
 * cone, the Power Plant's generator hall beside its smokestack, a wreck on the
 * beach beside the lighthouse. Other biomes raise a tower on `SOLID_FOOT.tower`.
 */
export const TOWER_FEET: Partial<Record<BiomeId, readonly (readonly Ellipse[])[]>> = {
  beach: [[SOLID_FOOT.tower], [{ x: 0, y: -8, rx: 50, ry: 12 }]],
  plant: [[SOLID_FOOT.tower], [{ x: -26, y: -12, rx: 32, ry: 14 }, { x: 26, y: -12, rx: 32, ry: 14 }]],
  desert: [[{ x: 0, y: -14, rx: 58, ry: 18 }], [{ x: 0, y: -14, rx: 54, ry: 17 }]],
  volcano: [[{ x: 0, y: -14, rx: 54, ry: 18 }]],
}

/** Mountains, as terraced footprints. Kept close to convex so the horde slides around them instead of getting stuck. */
export const CLIFFS: readonly (readonly Tier[])[] = [
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

/** Where something can grow on each mountain's top: [x, y, tier] (the tier it stands on, counting from 1). */
export const CLIFF_CRESTS: readonly (readonly (readonly [number, number, number])[])[] = [
  [[-36, -16, 1], [30, -16, 1], [-2, -21, 3]],
  [[24, -12, 1], [2, -9, 2]],
  [[-44, -6, 1], [10, -9, 2]],
]

/** Lakes: flat footprints that slow walkers (ice in the snow, where they slide instead). */
export const LAKES: readonly (readonly Ellipse[])[] = [
  [{ x: 0, y: 0, rx: 56, ry: 20 }, { x: -38, y: 8, rx: 28, ry: 14 }, { x: 32, y: -6, rx: 32, ry: 15 }],
  [{ x: 0, y: 0, rx: 40, ry: 20 }, { x: 22, y: 6, rx: 26, ry: 14 }],
  [{ x: 0, y: 0, rx: 70, ry: 14 }, { x: -30, y: 4, rx: 36, ry: 13 }, { x: 34, y: -3, rx: 30, ry: 12 }],
]

/** Spots for the trees of a grove and the stones of a rock pile, around the feature's anchor. */
export const CLUSTER_SLOTS: readonly (readonly [number, number])[] = [
  [-36, -10], [0, -24], [34, -8], [-16, 16], [22, 18],
]

export type FeatureKind = 'none' | 'rocks' | 'grove' | 'bushes' | 'log' | 'cliff' | 'lake' | 'tower'

export const TERRAIN = {
  /** World px per cell; each cell holds at most one feature, kept clear of the cell's edges. */
  cell: 288,
  /** Free px kept between a feature's footprint and its cell's edge, so neighbors never close a passage. */
  margin: 22,
  /** No terrain within this distance of where the run starts. */
  clearStart: 320,
  /** Relative odds of what a cell holds (a landmark, `data/landmarks.ts`, takes its cell first). */
  weights: { none: 20, rocks: 15, grove: 18, bushes: 12, log: 7, cliff: 11, lake: 9, tower: 4 } satisfies Record<FeatureKind, number>,
  /**
   * Single bushes, rocks and trees strewn around a cell's feature (none
   * around a landmark): up to `max`, kept `clear` px from the feature and
   * from each other, picked by `weights`.
   */
  scatter: { max: 3, clear: 22, spacing: 40, weights: { bush: 5, rock: 3, tree: 3 } satisfies Partial<Record<SolidKind, number>> },
  /** Walking speed in water (Water types and flyers swim or fly over it). */
  waterPace: 0.62,
  /** How fast the player's speed follows the stick on ice (per second): low means sliding. */
  iceGrip: 2.6,
  /** Variants of the single pieces (each is drawn a little differently). */
  rockVariants: 3,
  treeVariants: 3,
  bushVariants: 3,
  logVariants: 2,
} as const
