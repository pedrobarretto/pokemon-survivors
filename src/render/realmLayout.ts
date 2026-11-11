import { CORNER_FLOOR, type Point, type Shape, type TownRoomId } from '../data/realmMap'
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
  /** The café's round tables of four (Ludo, Unown): a stool on each side, a Ludo board and Unown cards on top. */
  gameTable4: 'realm/cafe-gametable4',
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
  safariGate: 'realm/safari-gate',
  arcade: 'realm/arcade',
  cabinetBerry: 'realm/arcade/cabinet-berry',
  cabinetBerry2: 'realm/arcade/cabinet-berry-2',
  cabinetDiglett: 'realm/arcade/cabinet-diglett',
  cabinetDiglett2: 'realm/arcade/cabinet-diglett-2',
  prizeCounter: 'realm/arcade/prize-counter',
  prizeShelf: 'realm/arcade/prize-shelf',
  claw: 'realm/arcade/claw',
  claw2: 'realm/arcade/claw-2',
  jukebox: 'furniture/jukebox',
  mine: 'realm/mine',
  /** The Rocket Game Corner: its building on the plaza and its pieces inside (`realm/corner/`). */
  gameCorner: 'realm/game-corner',
  slotRed: 'realm/corner/slot-red',
  slotPurple: 'realm/corner/slot-purple',
  sweepTable: 'realm/corner/sweep-table',
  tokenMachine: 'realm/corner/token-machine',
  cornerCounter: 'realm/corner/prize-counter',
  cornerShelf: 'realm/corner/prize-shelf',
  rocketPoster: 'realm/corner/poster',
  cornerStool: 'realm/corner/stool',
  rocketBanner: 'realm/corner/banner',
  rocketRug: 'realm/corner/rug',
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
 * their base is known). `busy`: a slot machine someone plays (its reels spin
 * now and then, and sometimes pay).
 */
export type Prop = { art: TownArt; x: number; y: number; flip?: true; mine?: true; busy?: true }

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
  | { kind: 'wall'; h: number; windows: readonly number[]; neon?: true; casino?: true }
  /** `casino`: the Game Corner's, red with gold coins and diamonds instead of the arcade's night blue. */
  | { kind: 'carpet'; shape: Shape; casino?: true }
  /** A red velvet runner in a gold border, a diamond woven every few steps (the Game Corner's aisle). */
  | { kind: 'runner'; shape: Shape }
  /** A round rug woven as a Poké Ball (its top red, its bottom white, the band and the button dark), lying on the floor. */
  | { kind: 'ballRug'; shape: Shape }

/** The arcade's prize clerk: Porygon, the Pokémon made of code, by the till at the counter's west end (no spot of its own: the counter is the prizes'). */
export const PRIZE_CLERK = { dex: 137, x: 264, y: 112, facing: 1 } as const

/** A Pokémon that stands in a room (its SpriteCollab sprite, idling) with its feet at (`x`, `y`), facing `facing`: the trail's host. */
export type Host = { dex: number; x: number; y: number; facing: Dir8; keeper?: true }

/** The Game Corner's clerk: Meowth, Team Rocket's own talking cat, by the till at the prize counter's west end (the counter's spot is the prizes'). */
export const CORNER_CLERK = { dex: 52, ...CORNER_FLOOR.clerk, facing: 1 } as const

/** Team Rocket's Pokémon at play in the Game Corner, for show: on the slots' stools facing their machine, beside the Koffing Sweep tables facing the felt. */
const CORNER_FIGURES: readonly Host[] = CORNER_FLOOR.taken.map(({ dex, x, y, facing }) => ({ dex, x, y, facing }))

/** The grove's host: Sudowoodo, the Pokémon that passes for a tree, keeps the secret bases' grove. */
export const GROVE_HOST = { dex: 185, x: 556, y: 292, facing: 7 } as const satisfies Host

/** The Zona Safári's keeper, Kangaskhan, by its gate: scenery, no talk of its own (the gate's spot opens the Safari). */
export const SAFARI_KEEPER = { dex: 115, x: 626, y: 218, facing: 0, keeper: true } as const satisfies Host

/** The mine's keeper: Excadrill, the Pokémon that digs for a living, stands by the Escavação's entrance. */
export const MINE_KEEPER = { dex: 530, x: 160, y: 304, facing: 6 } as const satisfies Host

/** `figures`: Pokémon standing in a room for show, with no spot of their own (the mine's keeper). */
export type RoomLayout = { indoor: boolean; ground: readonly Surface[]; props: readonly Prop[]; hosts?: readonly Host[]; figures?: readonly Host[] }

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
    { kind: 'path', r: 11, points: [{ x: 470, y: 118 }, { x: 466, y: 150 }, { x: 452, y: 172 }] },
  ],
  props: [
    { art: 'cafe', x: 333, y: 124 },
    { art: 'board', x: 196, y: 112 },
    { art: 'gameCorner', x: 470, y: 122 },
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
    { art: 'tree0', x: 560, y: 58 },
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
 * over the sea to a jetty under the lighthouse (a fishing platform juts south
 * off its end, lanterns at its corners), which stands on the rocks of
 * the north-east point; the lagoon in the middle, where Water types swim, is
 * a tide pool the sea fills through a channel to the south, rocks on its rim;
 * palms, parasols, a sandcastle and surfboards dot the sand. The arcade
 * stands on the north shore on a deck of boards, its double doors the way
 * in (the `arcade` door).
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
    { kind: 'boards', shape: rect(334, 134, 116, 20) },
    { kind: 'boards', shape: rect(588, 210, 44, 52) },
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
    { art: 'lamp', x: 591, y: 258 },
    { art: 'lamp', x: 629, y: 258 },
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
    { art: 'bush1', x: 298, y: 112 },
    { art: 'arcade', x: 392, y: 138 },
    { art: 'tree0', x: 40, y: 430 },
  ],
}

/** The café inside: the counter along the back wall, two sofas with tables by the side walls, the two round tables of four in the middle (Ludo, Unown) and by the door the two game tables (Four in a Row, Type Duel). */
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
    { art: 'gameTable4', x: 150, y: 214 },
    { art: 'gameTable4', x: 250, y: 214 },
    { art: 'menu', x: 150, y: 300 },
    { art: 'plant', x: 22, y: 96 },
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
    { kind: 'path', r: 9, points: [{ x: 198, y: 232 }, { x: 150, y: 270 }, { x: 96, y: 302 }] },
  ],
  hosts: [GROVE_HOST, SAFARI_KEEPER],
  figures: [MINE_KEEPER],
  props: [
    { art: 'mine', x: 84, y: 288 },
    { art: 'doorCave', x: 318, y: 178, mine: true },
    { art: 'lamp', x: 244, y: 196 },
    { art: 'lamp', x: 400, y: 196 },
    { art: 'mural', x: 146, y: 206 },
    { art: 'groveSign', x: 500, y: 236 },
    { art: 'safariGate', x: 562, y: 216 },
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

/**
 * The arcade (its door on the pier's boardwalk): the neon-lit back wall, a
 * row of four cabinets along it (two Berry Rain, two Whack-a-Diglett: the
 * room's `cabinet` spots), the prize counter on the east with its shelf of
 * prizes on the wall and Porygon minding it by the till, a Poké Ball rug in
 * the middle, two claw machines by the west
 * wall, a jukebox and a sofa on the east, on the arcade's star-strewn carpet.
 */
const ARCADE: RoomLayout = {
  indoor: true,
  ground: [
    { kind: 'carpet', shape: rect(0, 0, 400, 300) },
    { kind: 'ballRug', shape: oval(200, 196, 50, 25) },
    { kind: 'mat', shape: rect(176, 286, 48, 14) },
    { kind: 'wall', h: 64, windows: [], neon: true },
  ],
  hosts: [PRIZE_CLERK],
  props: [
    { art: 'cabinetBerry', x: 52, y: 100 },
    { art: 'cabinetBerry2', x: 92, y: 100 },
    { art: 'cabinetDiglett', x: 132, y: 100 },
    { art: 'cabinetDiglett2', x: 172, y: 100 },
    { art: 'prizeShelf', x: 322, y: 60 },
    { art: 'prizeCounter', x: 322, y: 120 },
    { art: 'claw', x: 28, y: 162 },
    { art: 'claw2', x: 28, y: 208 },
    { art: 'jukebox', x: 380, y: 162 },
    { art: 'sofa', x: 320, y: 206 },
    { art: 'plant', x: 22, y: 96 },
    { art: 'plant', x: 22, y: 296 },
    { art: 'plant', x: 378, y: 296 },
  ],
}

/** The slot machines, red and purple in turn, each with its stool; the ones Team Rocket's Pokémon play are `busy`. */
const CORNER_SLOTS: readonly Prop[] = CORNER_FLOOR.rows.flatMap((y, row) =>
  CORNER_FLOOR.slots.flatMap((x, i): Prop[] => {
    const busy = CORNER_FLOOR.taken.some((s) => s.x === x && s.y === y + 14)
    return [{ art: (i + row) % 2 ? 'slotPurple' : 'slotRed', x, y, ...(busy ? { busy: true as const } : {}) }, { art: 'cornerStool', x, y: y + 14 }]
  }),
)

/**
 * The Rocket Game Corner (`REALM_ROOMS.gameCorner`, its door on the plaza's
 * north-east), where everything stands by `CORNER_FLOOR`: a casino's red
 * carpet under a black wall lit by neon (the GAME CORNER sign, the bulbs and
 * the slots' glow are `drawCornerLights` in `render/realmArt.ts`), three rows
 * of slot machines with their stools, a red runner from the door to Team
 * Rocket's poster between two banners and the R rug before it, the prize
 * counter with its shelf on the wall and Meowth by the till, four Koffing
 * Sweep tables with two stools before each and the token machines by the door.
 */
const GAME_CORNER: RoomLayout = {
  indoor: true,
  ground: [
    { kind: 'carpet', shape: rect(0, 0, 440, 320), casino: true },
    { kind: 'runner', shape: rect(206, 64, 28, 256) },
    { kind: 'mat', shape: rect(196, 306, 48, 14) },
    { kind: 'wall', h: 64, windows: [], neon: true, casino: true },
  ],
  hosts: [CORNER_CLERK],
  figures: CORNER_FIGURES,
  props: [
    ...CORNER_SLOTS,
    { art: 'rocketRug', x: 220, y: 92 },
    { art: 'rocketPoster', x: 220, y: 58 },
    { art: 'rocketBanner', x: 190, y: 54 },
    { art: 'rocketBanner', x: 250, y: 54 },
    { art: 'cornerShelf', x: 350, y: 60 },
    { art: 'cornerCounter', x: 350, y: 124 },
    ...CORNER_FLOOR.tables.flatMap((t): Prop[] => [
      { art: 'sweepTable', x: t.x, y: t.y },
      { art: 'cornerStool', x: t.x - 12, y: t.y + 12 },
      { art: 'cornerStool', x: t.x + 12, y: t.y + 12 },
    ]),
    ...CORNER_FLOOR.tokens.map((x): Prop => ({ art: 'tokenMachine', x, y: CORNER_FLOOR.tokenY })),
    { art: 'plant', x: 110, y: 312 },
    { art: 'plant', x: 424, y: 150 },
    { art: 'plant', x: 424, y: 312 },
  ],
}

export const TOWN_LAYOUT = { plaza: PLAZA, pier: PIER, cafe: CAFE, trail: TRAIL, arcade: ARCADE, gameCorner: GAME_CORNER } as const satisfies Record<TownRoomId, RoomLayout>
