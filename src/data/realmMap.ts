/**
 * The Poké Realm's town: its rooms, as plain geometry. Every city
 * (`REALM_CITIES` in `net/realm.ts`) is a copy of the same town. Import-free,
 * like `net/realm.ts`, because the relay reads the bounds to check steps;
 * what a room looks like (its art, props, NPCs, music) is the game's,
 * `render/realmArt.ts` (where each piece stands: `render/realmLayout.ts`),
 * keyed by the same ids.
 *
 * Units are world px (the game's low internal resolution, as the lobby's).
 * `solid` shapes block walking (the client keeps its trainer out of them; the
 * relay only checks the bounds and the speed). A `door` is a rect that, walked
 * into, takes the trainer to `to`, landing at `spawn`. A `spot` is something
 * to walk up to and press E or tap: a portal, a board, a counter.
 */

export type Rect = { x: number; y: number; w: number; h: number }

export type Point = { x: number; y: number }

export type Shape = ({ kind: 'rect' } & Rect) | { kind: 'oval'; x: number; y: number; rx: number; ry: number }

/** What a spot does when used. */
export type SpotKind =
  | 'coopPortal'
  | 'arenaPortal'
  | 'board'
  | 'bases'
  | 'myBase'
  | 'carpenter'
  | 'host'
  | 'pool'
  | 'counter'
  | 'bench'
  /** Mini games (`data/minigames.ts`): a fishing spot, a game table (its `id` is the table's, `games` what it plays), an arcade cabinet. */
  | 'fishing'
  | 'gameTable'
  | 'cabinet'

/** The town's rooms (their shapes are `REALM_ROOMS`). */
export const TOWN_ROOMS = ['plaza', 'pier', 'cafe', 'trail'] as const

export type TownRoomId = (typeof TOWN_ROOMS)[number]

export const isTownRoomId = (v: unknown): v is TownRoomId => typeof v === 'string' && (TOWN_ROOMS as readonly string[]).includes(v)

export type Door = { at: Rect; to: TownRoomId; spawn: Point }

/**
 * `id`: a game table's id (`net/realmTables.ts`, unique in its room).
 * `games`: the mini games it opens (`MinigameId`s; one opens at once, more
 * ask which): a cabinet's or a table's.
 */
export type Spot = {
  kind: SpotKind
  at: Point
  reach: number
  id?: string
  games?: readonly string[]
  /** Where a trainer using it faces (a `Facing`, 0 down … 4 up): a fishing spot, toward the water. */
  face?: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export type TownRoom = { w: number; h: number; spawn: Point; solid: readonly Shape[]; doors: readonly Door[]; spots: readonly Spot[] }

const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h })
const oval = (x: number, y: number, rx: number, ry: number): Shape => ({ kind: 'oval', x, y, rx, ry })
/** What a tree, a bush, a lamp post and a signpost standing with their feet at (x, y) keep walkers off: their trunk, their mass, their post. */
const trunk = (x: number, y: number) => oval(x, y - 4, 10, 5)
const shrub = (x: number, y: number) => oval(x, y - 6, 14, 7)
const post = (x: number, y: number) => oval(x, y - 1, 5, 3)

/**
 * The town, matching its art (`render/realmLayout.ts`, where each piece
 * stands; `render/realmLayout.test.ts` holds the two together). The plaza is
 * where every trainer lands: the co-op portal on the west and the Arena's on
 * the east, the board (today's Desafio, the Festival, events) by the café,
 * whose door is the café's, and the roads west to the trail and east to the
 * pier. The pier has the lagoon Water types swim in (it doesn't block: the
 * others wade), a bench and, off the boardwalk's end, a fishing platform with
 * two fishing spots; the sea around it does block. The café has its
 * counter and two sofas, and the trail is the Secret Base Grove: your own
 * base's entrance at the head of its clearing (one `myBase` spot; the art
 * shows the exterior your base wears), the board of public bases on the
 * west, Bibarel's carpentry to the south and the grove's host (`host`),
 * who explains it all, by the road in.
 */
export const REALM_ROOMS = {
  plaza: {
    w: 640,
    h: 480,
    spawn: { x: 320, y: 404 },
    solid: [
      rect(270, 60, 122, 52),
      rect(272, 108, 40, 14),
      rect(331, 112, 14, 10),
      rect(352, 108, 34, 14),
      rect(170, 100, 52, 12),
      rect(432, 98, 32, 10),
      rect(106, 206, 88, 26),
      rect(446, 206, 88, 26),
      oval(320, 300, 42, 18),
      post(246, 262),
      post(394, 262),
      post(270, 372),
      post(370, 372),
      rect(156, 290, 32, 10),
      rect(452, 290, 32, 10),
      oval(204, 390, 40, 20),
      oval(436, 390, 40, 20),
      post(28, 236),
      post(612, 236),
      ...[trunk(40, 104), trunk(92, 64), shrub(128, 120), trunk(600, 104), trunk(548, 64), shrub(512, 120), trunk(44, 400), trunk(36, 470), shrub(92, 462)],
      ...[trunk(600, 404), trunk(604, 474), shrub(548, 466)],
    ],
    doors: [
      { at: { x: 0, y: 236, w: 10, h: 40 }, to: 'trail', spawn: { x: 600, y: 256 } },
      { at: { x: 630, y: 236, w: 10, h: 40 }, to: 'pier', spawn: { x: 40, y: 256 } },
      { at: { x: 308, y: 108, w: 26, h: 10 }, to: 'cafe', spawn: { x: 200, y: 272 } },
    ],
    spots: [
      { kind: 'coopPortal', at: { x: 150, y: 252 }, reach: 28 },
      { kind: 'arenaPortal', at: { x: 490, y: 252 }, reach: 28 },
      { kind: 'board', at: { x: 196, y: 128 }, reach: 24 },
      { kind: 'bench', at: { x: 172, y: 314 }, reach: 20 },
      { kind: 'bench', at: { x: 468, y: 314 }, reach: 20 },
    ],
  },
  pier: {
    w: 640,
    h: 480,
    spawn: { x: 40, y: 256 },
    solid: [
      rect(574, 0, 66, 168),
      // The sea south of the boardwalk, around the fishing platform.
      rect(574, 216, 14, 264),
      rect(632, 216, 8, 264),
      rect(588, 262, 44, 218),
      rect(0, 446, 640, 34),
      oval(600, 470, 80, 60),
      oval(514, 142, 28, 10),
      oval(468, 150, 24, 8),
      oval(558, 156, 20, 7),
      rect(590, 180, 44, 14),
      oval(452, 228, 14, 5),
      oval(256, 398, 20, 6),
      oval(548, 404, 20, 6),
      oval(392, 236, 16, 6),
      oval(252, 285, 24, 7),
      oval(430, 290, 22, 8),
      oval(410, 371, 20, 7),
      rect(76, 320, 32, 10),
      post(168, 222),
      post(168, 300),
      post(24, 216),
      post(591, 258),
      post(629, 258),
      ...[trunk(252, 214), trunk(528, 300), trunk(180, 412)],
      ...[trunk(40, 100), trunk(104, 70), shrub(160, 100), trunk(260, 64), shrub(330, 96), trunk(40, 430)],
    ],
    doors: [{ at: { x: 0, y: 226, w: 10, h: 60 }, to: 'plaza', spawn: { x: 600, y: 256 } }],
    spots: [
      { kind: 'pool', at: { x: 340, y: 304 }, reach: 120 },
      { kind: 'bench', at: { x: 92, y: 344 }, reach: 20 },
      // The fishing platform off the boardwalk's end (`MINIGAMES.fishing`): two places at its edge, facing the sea.
      { kind: 'fishing', at: { x: 603, y: 254 }, reach: 12, face: 0 },
      { kind: 'fishing', at: { x: 618, y: 254 }, reach: 12, face: 0 },
    ],
  },
  cafe: {
    w: 400,
    h: 300,
    spawn: { x: 200, y: 272 },
    solid: [
      rect(0, 0, 400, 64),
      rect(110, 64, 180, 36),
      rect(44, 128, 52, 22),
      rect(304, 128, 52, 22),
      oval(70, 190, 24, 9),
      oval(330, 190, 24, 9),
      oval(110, 256, 24, 9),
      oval(290, 256, 24, 9),
      oval(150, 296, 10, 4),
      ...[22, 378].flatMap((x) => [oval(x, 92, 9, 5), oval(x, 292, 9, 5)]),
      rect(0, 64, 6, 236),
      rect(394, 64, 6, 236),
    ],
    doors: [{ at: { x: 170, y: 290, w: 60, h: 10 }, to: 'plaza', spawn: { x: 320, y: 136 } }],
    spots: [
      { kind: 'counter', at: { x: 200, y: 112 }, reach: 24 },
      { kind: 'bench', at: { x: 70, y: 166 }, reach: 20 },
      { kind: 'bench', at: { x: 330, y: 166 }, reach: 20 },
    ],
  },
  trail: {
    w: 640,
    h: 480,
    spawn: { x: 600, y: 256 },
    solid: [
      oval(322, 166, 56, 14),
      post(244, 196),
      post(400, 196),
      rect(100, 192, 92, 14),
      post(500, 236),
      post(364, 324),
      rect(274, 346, 102, 52),
      rect(258, 390, 28, 12),
      rect(200, 388, 44, 14),
      rect(430, 300, 32, 10),
      rect(180, 290, 32, 10),
      oval(556, 289, 8, 4),
      oval(610, 324, 14, 7),
      oval(232, 466, 14, 7),
      ...[trunk(160, 96), trunk(236, 70), trunk(404, 72), trunk(486, 104), trunk(600, 120), shrub(552, 170), shrub(70, 170), trunk(40, 110)],
      ...[trunk(40, 380), trunk(112, 330), shrub(150, 452), trunk(500, 390), trunk(566, 440), shrub(440, 452), trunk(620, 474), trunk(30, 476)],
    ],
    doors: [{ at: { x: 630, y: 226, w: 10, h: 60 }, to: 'plaza', spawn: { x: 40, y: 256 } }],
    spots: [
      { kind: 'myBase', at: { x: 318, y: 196 }, reach: 26 },
      { kind: 'bases', at: { x: 146, y: 222 }, reach: 26 },
      { kind: 'carpenter', at: { x: 318, y: 420 }, reach: 28 },
      { kind: 'host', at: { x: 556, y: 310 }, reach: 24 },
      { kind: 'bench', at: { x: 446, y: 324 }, reach: 20 },
      { kind: 'bench', at: { x: 196, y: 314 }, reach: 20 },
    ],
  },
} as const satisfies Record<TownRoomId, TownRoom>

/** Where every trainer lands in a city. */
export const LANDING: TownRoomId = 'plaza'

/**
 * A secret base's interior as a grid (`data/secretBases.ts` places furniture
 * on it): `cols` × `rows` tiles of `tile` px, the top `wallRows` the back wall
 * (wall furniture only), the door on the bottom row's middle tile.
 */
export const BASE_GRID = { cols: 12, rows: 9, tile: 24, wallRows: 2 } as const

/** A base room's bounds and where a visitor lands (just inside the door). */
export const BASE_ROOM = {
  w: BASE_GRID.cols * BASE_GRID.tile,
  h: BASE_GRID.rows * BASE_GRID.tile,
  spawn: { x: (BASE_GRID.cols * BASE_GRID.tile) / 2, y: (BASE_GRID.rows - 1) * BASE_GRID.tile },
} as const

/** A room's bounds (w × h, from 0,0), for a town room id or a base. */
export const roomBounds = (room: string): { w: number; h: number } | null =>
  room.startsWith('base:') ? BASE_ROOM : isTownRoomId(room) ? REALM_ROOMS[room] : null
