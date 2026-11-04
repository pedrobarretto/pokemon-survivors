import type { Point, Shape, TownRoomId } from '../data/realmMap'

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

/** The PNGs the town draws: its own (`public/assets/realm/`), and the lobby's it reuses (`shop/`, `scenery/`). */
export const TOWN_ART = {
  portalCoop: 'realm/portal-coop',
  portalArena: 'realm/portal-arena',
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
} as const satisfies Record<string, string>

export type TownArt = keyof typeof TOWN_ART

/** Pieces that play frames (the art named in a layout is the first; the others follow at `TOWN_FPS`): the plaza's fountain is the lobby's festival one, water running. */
export const TOWN_FRAMES: Partial<Record<TownArt, readonly TownArt[]>> = { fountain: ['fountain', 'fountain1', 'fountain2'] }
export const TOWN_FPS = 7

export type Prop = { art: TownArt; x: number; y: number; flip?: true }

/** A dirt path: a line through `points`, `r` px each side of it. */
type Path = { kind: 'path'; points: readonly Point[]; r: number }

/**
 * What's painted over the grass: `paving` (cobblestones, a curb framing
 * them where they meet anything else and a band of darker stones inside it;
 * paving reaching the room's edge runs on past it), `path`, `sand`, `water` (`pool`: a lagoon, lighter,
 * with a stone rim), `boards` (a boardwalk's planks running across), and
 * indoors, `floor` (wooden planks, sunlit below the windows, side walls at
 * its edges), a doormat (`mat`) and a `wall` (the room's back wall, windows
 * along it).
 */
export type Surface =
  | Path
  | { kind: 'paving' | 'sand' | 'water' | 'boards' | 'floor' | 'mat'; shape: Shape; pool?: true }
  | { kind: 'wall'; h: number; windows: readonly number[] }

export type RoomLayout = { indoor: boolean; ground: readonly Surface[]; props: readonly Prop[] }

const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h })
const oval = (x: number, y: number, rx: number, ry: number): Shape => ({ kind: 'oval', x, y, rx, ry })

/**
 * The plaza, where everyone lands: a curbed oval square with the fountain in
 * the middle ringed by lamps, the co-op portal on the west and the Arena's on
 * the east, two blossoming flower beds and benches on the south, the café on
 * the north (its door is the café's; its own tables, chalkboard and plants
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
 * over the sea to a jetty; the sheltered lagoon in the middle is the pool
 * Water types swim in; the lighthouse stands on the rocks up north.
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
    { kind: 'water', shape: oval(340, 304, 112, 66), pool: true },
    { kind: 'boards', shape: rect(470, 148, 170, 44) },
  ],
  props: [
    { art: 'signpost', x: 24, y: 216 },
    { art: 'bench', x: 92, y: 330 },
    { art: 'lamp', x: 168, y: 222 },
    { art: 'lamp', x: 168, y: 300 },
    { art: 'lighthouse', x: 506, y: 108 },
    { art: 'rock', x: 470, y: 112 },
    { art: 'rock1', x: 540, y: 116 },
    { art: 'crates', x: 612, y: 170 },
    { art: 'boat', x: 600, y: 320 },
    { art: 'umbrella', x: 220, y: 380 },
    { art: 'umbrella', x: 470, y: 400 },
    { art: 'palm', x: 296, y: 204 },
    { art: 'palm', x: 408, y: 184 },
    { art: 'sandcastle', x: 436, y: 240 },
    { art: 'beachball', x: 516, y: 312 },
    { art: 'tree1', x: 40, y: 100 },
    { art: 'tree0', x: 104, y: 70 },
    { art: 'bush', x: 160, y: 100 },
    { art: 'tree2', x: 260, y: 64 },
    { art: 'bush1', x: 330, y: 96 },
    { art: 'tree0', x: 40, y: 430 },
    { art: 'bush', x: 100, y: 424 },
  ],
}

/** The café inside: the counter along the back wall, two sofas with tables by the side walls, two more tables by the door. */
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
    { art: 'table', x: 110, y: 262 },
    { art: 'table', x: 290, y: 262 },
    { art: 'menu', x: 150, y: 300 },
    { art: 'plant', x: 22, y: 96 },
    { art: 'plant', x: 378, y: 96 },
    { art: 'plant', x: 22, y: 296 },
    { art: 'plant', x: 378, y: 296 },
  ],
}

/**
 * The trail of secret bases: a dirt path from the plaza west through the
 * woods, the four ways into a base along its north side (Emerald's: a cave,
 * a tree, a bush, a sand mound), the board of public bases in their middle,
 * and Bibarel's carpentry with its porch to the south.
 */
const TRAIL: RoomLayout = {
  indoor: false,
  ground: [
    {
      kind: 'path',
      r: 12,
      points: [
        { x: 650, y: 258 },
        { x: 560, y: 250 },
        { x: 470, y: 266 },
        { x: 380, y: 258 },
        { x: 290, y: 246 },
        { x: 200, y: 260 },
        { x: 140, y: 266 },
      ],
    },
    { kind: 'path', r: 8, points: [{ x: 146, y: 266 }, { x: 118, y: 234 }, { x: 100, y: 192 }, { x: 96, y: 170 }] },
    { kind: 'path', r: 8, points: [{ x: 196, y: 258 }, { x: 214, y: 216 }, { x: 222, y: 168 }] },
    { kind: 'path', r: 8, points: [{ x: 312, y: 248 }, { x: 326, y: 210 }, { x: 330, y: 174 }] },
    { kind: 'path', r: 8, points: [{ x: 470, y: 264 }, { x: 448, y: 220 }, { x: 442, y: 172 }] },
    { kind: 'path', r: 8, points: [{ x: 520, y: 256 }, { x: 552, y: 214 }, { x: 562, y: 174 }] },
    { kind: 'path', r: 9, points: [{ x: 340, y: 256 }, { x: 362, y: 310 }, { x: 352, y: 384 }, { x: 318, y: 406 }, { x: 272, y: 410 }] },
  ],
  props: [
    { art: 'doorTree', x: 96, y: 158 },
    { art: 'doorCave', x: 222, y: 156 },
    { art: 'board', x: 330, y: 162 },
    { art: 'doorBush', x: 442, y: 160 },
    { art: 'doorSand', x: 562, y: 162 },
    { art: 'carpentry', x: 272, y: 390 },
    { art: 'crates', x: 182, y: 394 },
    { art: 'flowers', x: 236, y: 420 },
    { art: 'flowers', x: 310, y: 424 },
    { art: 'lamp', x: 400, y: 238 },
    { art: 'lamp', x: 180, y: 292 },
    { art: 'benchW', x: 420, y: 330, flip: true },
    { art: 'signpost', x: 616, y: 232, flip: true },
    { art: 'tree0', x: 160, y: 96 },
    { art: 'tree2', x: 286, y: 84 },
    { art: 'tree1', x: 384, y: 92 },
    { art: 'tree0', x: 502, y: 96 },
    { art: 'tree2', x: 620, y: 120 },
    { art: 'bush', x: 30, y: 200 },
    { art: 'tree1', x: 40, y: 380 },
    { art: 'tree0', x: 112, y: 336 },
    { art: 'bush1', x: 150, y: 452 },
    { art: 'tree2', x: 500, y: 372 },
    { art: 'tree0', x: 566, y: 430 },
    { art: 'bush', x: 440, y: 452 },
    { art: 'rock', x: 610, y: 330 },
    { art: 'tree1', x: 620, y: 474 },
    { art: 'tree0', x: 30, y: 476 },
    { art: 'rock1', x: 360, y: 470 },
  ],
}

export const TOWN_LAYOUT = { plaza: PLAZA, pier: PIER, cafe: CAFE, trail: TRAIL } as const satisfies Record<TownRoomId, RoomLayout>
