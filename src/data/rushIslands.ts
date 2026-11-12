import { ARENA_FEET, circle, type ArenaPiece, type Circle } from './arenas'
import type { BiomeId } from './biomes'
import { COLONNADE_FOOT, SOLID_FOOT, type Ellipse } from './terrain'
import type { PokeType } from './types'

/**
 * The islands Hoopa's rings open on (`game/rush.ts`): each ring of a rush is
 * fought on a floating island of its own, picked by its legend's type
 * (`ISLAND_OF_TYPE`), and the last ring, Hoopa's, on its golden island.
 *
 * Coordinates are px around the middle of the rings (the rush's `home`): the
 * gate, where each legend steps through, is `RUSH.enter` px north of it, and
 * the team lands `start` px south of it. The floor is a union of circles
 * (`game/arenaFloor.ts` keeps everyone on it); what stands on it is real
 * terrain: players and the legends' shots collide with it, the legends float
 * over it, as bosses do everywhere. Map pieces (`tree`, `rock`, `bush`,
 * `menhir`) wear the island's `biome` (its painted or sculpted scenery);
 * arena pieces look the same anywhere. `rushIslands.test.ts` keeps the
 * middle and the gate clear (`ISLAND_CLEAR`) and floods every island from the
 * start and from the gate: no pocket a player can't walk to.
 *
 * `render/rush.ts` paints each island's ground and underside from the same
 * floor (`look`), and stands Hoopa's small rings on its `rings` spots.
 */

export const ISLAND_IDS = ['grove', 'crag', 'dunes', 'floe', 'caldera', 'shrine', 'atoll', 'hoopa'] as const
export type IslandId = (typeof ISLAND_IDS)[number]

/** What can stand on an island: the map's pieces in the island's biome, or the arenas' own. */
export type IslandPiece = 'tree' | 'rock' | 'bush' | 'menhir' | ArenaPiece

export type IslandSolid = { piece: IslandPiece; x: number; y: number }

export type IslandDef = {
  /** Which biome's scenery its map pieces wear. */
  biome: BiomeId
  floor: readonly Circle[]
  solids: readonly IslandSolid[]
  /** Where Hoopa's small rings stand on its rim (scenery only). */
  rings: readonly (readonly [number, number])[]
}

/** Kept clear of every footprint (grown by a player's foot): `middle` px round the middle (the team lands there), `gate` px round the gate. */
export const ISLAND_CLEAR = { middle: 46, gate: 38 } as const

/** Where the team lands on an island, south of the middle. */
export const ISLAND_START = 30

/** What each piece stands on, around its anchor. */
export const islandFoot = (piece: IslandPiece): Ellipse =>
  piece === 'tree' || piece === 'rock' || piece === 'bush' ? SOLID_FOOT[piece] : piece === 'menhir' ? COLONNADE_FOOT.menhir : ARENA_FEET[piece]

const s = (piece: IslandPiece, x: number, y: number): IslandSolid => ({ piece, x, y })

export const ISLANDS = {
  /** Grass and wildflowers, a copse to the north-west, trees and bushes round the rim. */
  grove: {
    biome: 'meadow',
    floor: [circle(0, 6, 118), circle(-86, -44, 58), circle(92, -30, 50), circle(70, 78, 52), circle(-72, 74, 50)],
    solids: [
      s('tree', -108, -48), s('tree', -90, -76), s('tree', -56, -54), s('bush', -100, 8),
      s('tree', 104, -34), s('bush', 60, -56), s('rock', 98, 22),
      s('tree', 86, 88), s('bush', 50, 96),
      s('rock', -86, 70), s('tree', -56, 100),
    ],
    rings: [[-34, -96], [34, -96]],
  },
  /** Bare rock: spires with crystals at their feet, boulders, a mushroom patch. */
  crag: {
    biome: 'cave',
    floor: [circle(0, 0, 122), circle(-96, -26, 50), circle(88, 56, 56), circle(38, -104, 38)],
    solids: [
      s('tree', -100, -30), s('rock', -60, -86), s('tree', 64, -84), s('rock', 104, -6),
      s('tree', 96, 72), s('rock', -92, 48), s('bush', -40, 102), s('menhir', 44, 98),
    ],
    rings: [[-36, -98], [30, -112]],
  },
  /** Sand and the broken colonnade of something old, sandstone stumps and a standing stone. */
  dunes: {
    biome: 'desert',
    floor: [circle(0, 0, 124), circle(-100, 30, 48), circle(96, -40, 46), circle(30, 108, 44)],
    solids: [
      s('sandPillar', -72, -64), s('sandPillar', 72, -64), s('sandPillar', -104, -10), s('sandPillar', 104, -12),
      s('sandPillar', -78, 72), s('sandPillar', 82, 66), s('rock', -104, 44), s('menhir', 36, 108),
    ],
    rings: [[-38, -100], [38, -100]],
  },
  /** Snow: pines, frosted rocks and spires of blue ice. */
  floe: {
    biome: 'snow',
    floor: [circle(0, 4, 120), circle(-84, -60, 46), circle(98, 10, 48), circle(-40, 100, 48), circle(64, 90, 40)],
    solids: [
      s('tree', -92, -64), s('tree', -58, -84), s('rock', -106, 6), s('iceSpire', 82, -64),
      s('tree', 112, 14), s('bush', -48, 108), s('iceSpire', 70, 94), s('tree', -88, 62),
    ],
    rings: [[-30, -100], [36, -98]],
  },
  /** Basalt, lava glowing in its cracks: boulders and spires of cooling magma. */
  caldera: {
    biome: 'volcano',
    floor: [circle(0, 0, 120), circle(-90, -50, 50), circle(86, -60, 44), circle(-60, 92, 48), circle(94, 64, 46)],
    solids: [
      s('basalt', -98, -46), s('magmaSpire', -68, -84), s('basalt', 92, -62), s('magmaSpire', 108, 2),
      s('basalt', -100, 16), s('magmaSpire', -58, 98), s('basalt', 86, 78),
    ],
    rings: [[-34, -98], [34, -98]],
  },
  /** Dark flagstones: dead trees, gravestones, brambles and standing stones with a violet glow. */
  shrine: {
    biome: 'tower',
    floor: [circle(0, 0, 122), circle(-94, -40, 46), circle(90, -48, 46), circle(-80, 72, 48), circle(86, 74, 44)],
    solids: [
      s('tree', -100, -46), s('menhir', -60, -82), s('menhir', 60, -82), s('tree', 100, -52),
      s('rock', -108, 10), s('rock', 108, 14), s('bush', -84, 80), s('tree', 84, 84), s('menhir', 0, 108),
    ],
    rings: [[-30, -100], [30, -100]],
  },
  /** A sandy cay in the night: palms, sea-worn rocks and tide pools. */
  atoll: {
    biome: 'beach',
    floor: [circle(0, 0, 124), circle(-100, -30, 46), circle(96, 40, 48), circle(-30, 104, 42)],
    solids: [
      s('palm', -96, -36), s('palm', -58, -76), s('seaRock', 70, -76), s('palm', 106, -8),
      s('palm', 98, 50), s('seaRock', -100, 40), s('palm', -34, 104), s('seaRock', 60, 96),
    ],
    rings: [[-30, -102], [34, -100]],
  },
  /** Hoopa's own: the round slab of gold-rimmed sand, its ring plinths and the circle of its rings. */
  hoopa: {
    biome: 'desert',
    floor: [circle(0, 0, 132)],
    solids: [s('ringPlinth', -104, 0), s('ringPlinth', 104, 0), s('ringPlinth', -52, 90), s('ringPlinth', 52, 90)],
    rings: [],
  },
} as const satisfies Record<IslandId, IslandDef>

/** Which island a ring's legend draws by its types (the first that isn't the last ring's): grass on the grove, fire in the caldera. */
export const ISLAND_OF_TYPE = {
  normal: 'grove', grass: 'grove', bug: 'grove', fairy: 'grove',
  rock: 'crag', fighting: 'crag', steel: 'crag', electric: 'crag',
  ground: 'dunes', dragon: 'dunes',
  ice: 'floe',
  fire: 'caldera',
  ghost: 'shrine', psychic: 'shrine', dark: 'shrine', poison: 'shrine',
  water: 'atoll', flying: 'atoll',
} as const satisfies Record<PokeType, Exclude<IslandId, 'hoopa'>>

/** The islands a ring's legend may draw, in the order it falls back to when its types' islands were the last ring's. */
export const ISLAND_CYCLE = ISLAND_IDS.filter((id): id is Exclude<IslandId, 'hoopa'> => id !== 'hoopa')
