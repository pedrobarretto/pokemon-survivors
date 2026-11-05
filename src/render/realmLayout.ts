import type { Point, Shape, TownRoomId } from '../data/realmMap'
import type { Dir8 } from '../engine/math'

/**
 * Where the Poké Realm's town art stands, room by room (`render/realmArt.ts`
 * draws it), as plain data so a test can hold it against the rooms' geometry
 * (`REALM_ROOMS` in `data/realmMap.ts`: what blocks walking, the doors and
 * the spots). World px from the room's top-left, like the geometry.
 *
 * - `ground`: what's painted over the grass, in order (`Surface`): paving with
 *   a curb, dirt paths, sand, water, a boardwalk, an indoor floor and wall.
 * - `props`: PNGs standing with the bottom middle of what they paint at
 *   (`x`, `y`), sorted by `y` among the walkers (`TownArt` names the file);
 *   `flip` mirrors one.
 */

/** The frames after the first of a portal's swirl turning (`realm/portal-<name>-<k>.png`, the swirl rotated k/12 of a turn). */
const SWIRL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const
type SwirlFrame = (typeof SWIRL)[number]

/** A portal's swirl frames as `TOWN_ART` entries: `<key><k>` → `<path>-<k>`. */
const swirlArt = <K extends string>(key: K, path: string) =>
  Object.fromEntries(SWIRL.map((k) => [`${key}${k}`, `${path}-${k}`])) as Record<`${K}${SwirlFrame}`, string>

/** The PNGs the town draws: its own (`public/assets/realm/`), and the lobby's it reuses (`shop/`, `scenery/`). */
export const TOWN_ART = {
  portalCoop: 'realm/portal-coop',
  portalArena: 'realm/portal-arena',
  ...swirlArt('portalCoop', 'realm/portal-coop'),
  ...swirlArt('portalArena', 'realm/portal-arena'),
  fountain: 'shop/festival-fountain-s0-f0',
  fountain1: 'shop/festival-fountain-s0-f1',
  fountain2: 'shop/festival-fountain-s0-f2',
  board: 'realm/board',
  signpost: 'realm/signpost',
  cafe: 'realm/cafe',
  lighthouse: 'realm/lighthouse',
  boat: 'realm/boat',
  umbrella: 'realm/umbrella',
  counter: 'realm/cafe-counter',
  shelf: 'realm/cafe-shelf',
  table: 'realm/cafe-table',
  /** The café's two game tables (`gameTable` spots): its round table with a Four in a Row stand and two Type Duel cards on top. */
  gameTable: 'realm/cafe-gametable',
  sofa: 'realm/cafe-sofa',
  menu: 'realm/cafe-menu',
  doorCave: 'realm/door-cave',
  doorTree: 'realm/door-tree',
  doorBush: 'realm/door-bush',
  doorSand: 'realm/door-sand',
  carpentry: 'shop/carpentry',
  bed: 'shop/prop-bed',
  bench: 'shop/prop-bench',
  benchW: 'shop/prop-bench-w',
  lamp: 'shop/prop-lantern',
  flowers: 'shop/prop-flowers',
  crates: 'shop/prop-crates',
  tree0: 'scenery/meadow-tree-0',
  tree1: 'scenery/meadow-tree-1',
  tree2: 'scenery/meadow-tree-2',
  bush: 'scenery/meadow-bush-0',
  bush1: 'scenery/meadow-bush-1',
  rock: 'scenery/meadow-rock-0',
  rock1: 'scenery/meadow-rock-1',
  plant: 'furniture/pottedPlant',
  palm: 'realm/palm',
  sandcastle: 'realm/sandcastle',
  beachball: 'realm/beachball',
  palm2: 'realm/palm-2',
  surfboards: 'realm/surfboards',
  rocksRound: 'realm/rocks-00',
  rocksTall: 'realm/rocks-03',
  rocksWide: 'realm/rocks-06',
  rocksFlat: 'realm/rocks-14',
  mural: 'realm/mural',
  groveSign: 'realm/grove-sign',
} as const satisfies Record<string, string>

export type TownArt = keyof typeof TOWN_ART

/**
 * Pieces that play frames (the art named in a layout is the first; the
 * others follow at `TOWN_FPS`): the plaza's fountain is the lobby's festival
 * one, water running, and the portals' swirls turn (a turn every 12 frames).
 */
export const TOWN_FRAMES: Partial<Record<TownArt, readonly TownArt[]>> = {
  fountain: ['fountain', 'fountain1', 'fountain2'],
  portalCoop: ['portalCoop', ...SWIRL.map((k) => `portalCoop${k}` as const)],
  portalArena: ['portalArena', ...SWIRL.map((k) => `portalArena${k}` as const)],
}
export const TOWN_FPS = 7

/**
 * A piece standing with the bottom middle of what it paints at (`x`, `y`).
 * `mine`: the player's own secret base entrance, drawn in the exterior their
 * base wears (`ENTRANCE_ART`), whatever `art` names (the one drawn until
 * their base is known).
 */
export type Prop = { art: TownArt; x: number; y: number; flip?: true; mine?: true }

/** Each base exterior's entrance (`BASE_EXTERIORS`), and how far (px) to shift it so its opening lands on the spot in front of it. */
export const ENTRANCE_ART = {
  cave: { art: 'doorCave', dx: 14 },
  tree: { art: 'doorTree', dx: 0 },
  bush: { art: 'doorBush', dx: 0 },
  sand: { art: 'doorSand', dx: 0 },
} as const satisfies Record<string, { art: TownArt; dx: number }>

/** A dirt path: a line through `points`, `r` px each side of it. A `dirt` surface is a patch of the same dirt in a shape. */
type Path = { kind: 'path'; points: readonly Point[]; r: number }

/**
 * What's painted over the grass: `paving` (cobblestones, a curb framing
 * them where they meet anything else and a band of darker stones inside it;
 * paving reaching the room's edge runs on past it), `path` and `dirt`,
 * `sand`, `water` (`pool`: a lagoon, its shore wandering like the sea's, foam
 * at its edge and shallows going deeper toward its middle; several pool
 * shapes melt into one), `boards` (a boardwalk's planks running across), and
 * indoors, `floor` (wooden planks, sunlit below the windows, side walls at
 * its edges), a doormat (`mat`) and a `wall` (the room's back wall, windows
 * along it).
 */
export type Surface =
  | Path
  | { kind: 'paving' | 'dirt' | 'sand' | 'water' | 'boards' | 'floor' | 'mat'; shape: Shape; pool?: true }
  | { kind: 'wall'; h: number; windows: readonly number[] }

/** A Pokémon that stands in a room (its SpriteCollab sprite, idling) with its feet at (`x`, `y`), facing `facing`: the trail's host. */
export type Host = { dex: number; x: number; y: number; facing: Dir8 }

/** The grove's host: Sudowoodo, the Pokémon that passes for a tree, keeps the secret bases' grove. */
export const GROVE_HOST = { dex: 185, x: 556, y: 292, facing: 7 } as const satisfies Host

export type RoomLayout = { indoor: boolean; ground: readonly Surface[]; props: readonly Prop[]; hosts?: readonly Host[] }

const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h })
const oval = (x: number, y: number, rx: number, ry: number): Shape => ({ kind: 'oval', x, y, rx, ry })

/**
 * The plaza, where everyone lands: a curbed oval square with the fountain in
 * the middle ringed by lamps, the co-op portal on the west (a sandstone gate
 * hung with pennants, its swirl warm) and the Arena's on the east (slate, a
 * blue swirl, the trophy on top), a matching pair on round daises, two
 * blossoming flower beds and benches on the south, the café on the north (its door is the café's; its own tables, chalkboard and plants
 * stand out front) with the town's board beside it, and
 * dirt paths out west (the trail) and east (the pier), where the curb opens.
 */
const PLAZA: RoomLayout = {
  indoor: false,
  ground: [
    { kind: 'paving', shape: oval(320, 286, 236, 150) },
    { kind: 'path', r: 13, points: [{ x: -10, y: 254 }, { x: 40, y: 258 }, { x: 96, y: 264 }] },
    { kind: 'path', r: 13, points: [{ x: 650, y: 254 }, { x: 600, y: 258 }, { x: 544, y: 264 }] },
    { kind: 'path', r: 12, points: [{ x: 320, y: 112 }, { x: 320, y: 146 }] },
  ],
  props: [
    { art: 'cafe', x: 333, y: 124 },
    { art: 'board', x: 196, y: 112 },
    { art: 'benchW', x: 448, y: 108, flip: true },
    { art: 'portalCoop', x: 150, y: 236 },
    { art: 'portalArena', x: 490, y: 236 },
    { art: 'fountain', x: 320, y: 318 },
    { art: 'lamp', x: 246, y: 262 },
    { art: 'lamp', x: 394, y: 262 },
    { art: 'lamp', x: 270, y: 372 },
    { art: 'lamp', x: 370, y: 372 },
    { art: 'bench', x: 172, y: 300 },
    { art: 'benchW', x: 468, y: 300 },
    { art: 'bed', x: 204, y: 410 },
    { art: 'bed', x: 436, y: 410 },
    { art: 'signpost', x: 28, y: 236 },
    { art: 'signpost', x: 612, y: 236, flip: true },
    { art: 'tree2', x: 40, y: 104 },
    { art: 'tree0', x: 92, y: 64 },
    { art: 'bush', x: 128, y: 120 },
    { art: 'tree1', x: 600, y: 104 },
    { art: 'tree0', x: 548, y: 64 },
    { art: 'bush1', x: 512, y: 120 },
    { art: 'tree1', x: 44, y: 400 },
    { art: 'tree0', x: 36, y: 470 },
    { art: 'bush', x: 92, y: 462 },
    { art: 'tree2', x: 600, y: 404 },
    { art: 'tree2', x: 604, y: 474 },
    { art: 'bush1', x: 548, y: 466 },
    { art: 'flowers', x: 300, y: 474 },
    { art: 'flowers', x: 340, y: 474 },
  ],
}

/**
 * The pier: the road from the plaza ends on a beach; a boardwalk runs east
 * over the sea to a jetty under the lighthouse, which stands on the rocks of
 * the north-east point; the lagoon in the middle, where Water types swim, is
 * a tide pool the sea fills through a channel to the south, rocks on its rim;
 * palms, parasols, a sandcastle and surfboards dot the sand.
 */
const PIER: RoomLayout = {
  indoor: false,
  ground: [
    { kind: 'sand', shape: oval(400, 312, 318, 226) },
    { kind: 'sand', shape: oval(566, 250, 150, 214) },
    { kind: 'sand', shape: oval(330, 470, 340, 96) },
    { kind: 'path', r: 13, points: [{ x: -10, y: 256 }, { x: 80, y: 258 }, { x: 150, y: 254 }, { x: 196, y: 262 }] },
    { kind: 'water', shape: rect(560, -20, 120, 520) },
    { kind: 'water', shape: rect(-20, 434, 680, 80) },
    { kind: 'water', shape: oval(600, 470, 90, 70) },
    { kind: 'water', shape: oval(326, 298, 92, 50), pool: true },
    { kind: 'water', shape: oval(394, 322, 60, 38), pool: true },
    { kind: 'water', shape: oval(444, 364, 30, 20), pool: true },
    { kind: 'water', shape: oval(468, 398, 22, 24), pool: true },
    { kind: 'water', shape: oval(482, 428, 22, 20), pool: true },
    { kind: 'boards', shape: rect(470, 170, 170, 44) },
  ],
  props: [
    { art: 'signpost', x: 24, y: 216 },
    { art: 'bench', x: 92, y: 330 },
    { art: 'lamp', x: 168, y: 222 },
    { art: 'lamp', x: 168, y: 300 },
    { art: 'lighthouse', x: 514, y: 150 },
    { art: 'rocksWide', x: 468, y: 156 },
    { art: 'rocksRound', x: 558, y: 162 },
    { art: 'crates', x: 612, y: 192 },
    { art: 'surfboards', x: 452, y: 232 },
    { art: 'boat', x: 606, y: 334 },
    { art: 'palm', x: 252, y: 214 },
    { art: 'palm2', x: 528, y: 300, flip: true },
    { art: 'palm2', x: 180, y: 412 },
    { art: 'umbrella', x: 256, y: 404 },
    { art: 'umbrella', x: 548, y: 410, flip: true },
    { art: 'sandcastle', x: 392, y: 240 },
    { art: 'beachball', x: 340, y: 408 },
    { art: 'rocksFlat', x: 252, y: 290 },
    { art: 'rocksTall', x: 430, y: 296 },
    { art: 'rocksRound', x: 410, y: 376 },
    { art: 'tree1', x: 40, y: 100 },
    { art: 'tree0', x: 104, y: 70 },
    { art: 'bush', x: 160, y: 100 },
    { art: 'tree2', x: 260, y: 64 },
    { art: 'bush1', x: 330, y: 96 },
    { art: 'tree0', x: 40, y: 430 },
  ],
}

/** The café inside: the counter along the back wall, two sofas with tables by the side walls, and by the door the two game tables (Four in a Row, Type Duel). */
const CAFE: RoomLayout = {
  indoor: true,
  ground: [
    { kind: 'floor', shape: rect(0, 0, 400, 300) },
    { kind: 'mat', shape: rect(176, 286, 48, 14) },
    { kind: 'wall', h: 64, windows: [60, 340] },
  ],
  props: [
    { art: 'shelf', x: 200, y: 50 },
    { art: 'counter', x: 200, y: 100 },
    { art: 'sofa', x: 70, y: 150 },
    { art: 'table', x: 70, y: 196 },
    { art: 'sofa', x: 330, y: 150 },
    { art: 'table', x: 330, y: 196 },
    { art: 'gameTable', x: 110, y: 262 },
    { art: 'gameTable', x: 290, y: 262 },
    { art: 'menu', x: 150, y: 300 },
    { art: 'plant', x: 22, y: 96 },
    { art: 'plant', x: 378, y: 96 },
    { art: 'plant', x: 22, y: 296 },
    { art: 'plant', x: 378, y: 296 },
  ],
}

/**
 * The Secret Base Grove (the trail's room): the dirt road from the plaza
 * comes in from the east past Sudowoodo, the grove's host (the room's
 * `host` spot), and a signpost, into a clearing. At the clearing's head
 * stands the player's own secret base entrance (`mine`: drawn in the
 * exterior their base wears), flanked by two lanterns; the board of bases
 * (the Mural de bases) stands on the west and Bibarel's carpentry down the
 * path to the south, a second signpost at the fork.
 */
const TRAIL: RoomLayout = {
  indoor: false,
  ground: [
    { kind: 'dirt', shape: oval(318, 226, 98, 40) },
    { kind: 'path', r: 12, points: [{ x: 650, y: 258 }, { x: 590, y: 254 }, { x: 520, y: 262 }, { x: 460, y: 250 }, { x: 400, y: 236 }] },
    { kind: 'path', r: 10, points: [{ x: 236, y: 230 }, { x: 190, y: 232 }, { x: 160, y: 224 }, { x: 146, y: 214 }] },
    { kind: 'path', r: 10, points: [{ x: 318, y: 260 }, { x: 330, y: 316 }, { x: 322, y: 380 }, { x: 318, y: 412 }] },
  ],
  hosts: [GROVE_HOST],
  props: [
    { art: 'doorCave', x: 318, y: 178, mine: true },
    { art: 'lamp', x: 244, y: 196 },
    { art: 'lamp', x: 400, y: 196 },
    { art: 'mural', x: 146, y: 206 },
    { art: 'groveSign', x: 500, y: 236 },
    { art: 'groveSign', x: 364, y: 324, flip: true },
    { art: 'carpentry', x: 318, y: 404 },
    { art: 'crates', x: 222, y: 400 },
    { art: 'flowers', x: 276, y: 424 },
    { art: 'flowers', x: 362, y: 424 },
    { art: 'benchW', x: 446, y: 310, flip: true },
    { art: 'bench', x: 196, y: 300 },
    { art: 'flowers', x: 216, y: 172 },
    { art: 'flowers', x: 428, y: 172 },
    { art: 'tree0', x: 160, y: 96 },
    { art: 'tree2', x: 236, y: 70 },
    { art: 'tree1', x: 404, y: 72 },
    { art: 'tree0', x: 486, y: 104 },
    { art: 'tree2', x: 600, y: 120 },
    { art: 'bush', x: 552, y: 170 },
    { art: 'bush1', x: 70, y: 170 },
    { art: 'tree1', x: 40, y: 110 },
    { art: 'tree1', x: 40, y: 380 },
    { art: 'tree0', x: 112, y: 330 },
    { art: 'bush1', x: 150, y: 452 },
    { art: 'tree2', x: 500, y: 390 },
    { art: 'tree0', x: 566, y: 440 },
    { art: 'bush', x: 440, y: 452 },
    { art: 'rock', x: 610, y: 330 },
    { art: 'tree1', x: 620, y: 474 },
    { art: 'tree0', x: 30, y: 476 },
    { art: 'rock1', x: 232, y: 470 },
  ],
}

export const TOWN_LAYOUT = { plaza: PLAZA, pier: PIER, cafe: CAFE, trail: TRAIL } as const satisfies Record<TownRoomId, RoomLayout>
