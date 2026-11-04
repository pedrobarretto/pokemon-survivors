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
export type SpotKind = 'coopPortal' | 'arenaPortal' | 'board' | 'bases' | 'myBase' | 'carpenter' | 'pool' | 'counter' | 'bench'

/** The town's rooms (their shapes are `REALM_ROOMS`). */
export const TOWN_ROOMS = ['plaza', 'pier', 'cafe', 'trail'] as const

export type TownRoomId = (typeof TOWN_ROOMS)[number]

export const isTownRoomId = (v: unknown): v is TownRoomId => typeof v === 'string' && (TOWN_ROOMS as readonly string[]).includes(v)

export type Door = { at: Rect; to: TownRoomId; spawn: Point }

export type Spot = { kind: SpotKind; at: Point; reach: number }

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
 * others wade) and a bench; the sea around it does block. The café has its
 * counter and two sofas, and the trail the secret bases: a way into your own
 * base at each of the four doors (cave, tree, bush, sand), the board of
 * public bases between them and Bibarel's carpentry to the south.
 */
export const REALM_ROOMS = {
  plaza: {
    w: 640,
    h: 480,
    spawn: { x: 320, y: 404 },
    solid: [
      rect(260, 56, 120, 52),
      rect(170, 100, 52, 12),
      rect(432, 98, 32, 10),
      rect(100, 212, 100, 22),
      rect(436, 208, 108, 26),
      oval(320, 296, 54, 24),
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
      { at: { x: 304, y: 108, w: 32, h: 10 }, to: 'cafe', spawn: { x: 200, y: 272 } },
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
      rect(574, 0, 66, 146),
      rect(574, 194, 66, 286),
      rect(0, 446, 640, 34),
      oval(600, 470, 80, 60),
      oval(506, 100, 24, 10),
      oval(470, 106, 14, 7),
      oval(540, 110, 14, 7),
      rect(590, 158, 44, 14),
      oval(220, 374, 20, 6),
      oval(470, 394, 20, 6),
      oval(296, 200, 8, 4),
      oval(408, 180, 8, 4),
      rect(76, 320, 32, 10),
      post(168, 222),
      post(168, 300),
      post(24, 216),
      ...[trunk(40, 100), trunk(104, 70), shrub(160, 100), trunk(260, 64), shrub(330, 96), trunk(40, 430), shrub(100, 424)],
    ],
    doors: [{ at: { x: 0, y: 226, w: 10, h: 60 }, to: 'plaza', spawn: { x: 600, y: 256 } }],
    spots: [
      { kind: 'pool', at: { x: 340, y: 304 }, reach: 120 },
      { kind: 'bench', at: { x: 92, y: 344 }, reach: 20 },
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
      oval(96, 146, 34, 12),
      oval(222, 140, 42, 16),
      rect(304, 150, 52, 12),
      oval(442, 146, 34, 14),
      oval(562, 150, 40, 12),
      rect(222, 340, 100, 46),
      rect(174, 380, 44, 14),
      post(400, 238),
      post(180, 292),
      rect(404, 320, 32, 10),
      post(616, 232),
      oval(610, 324, 14, 7),
      oval(360, 466, 14, 7),
      ...[trunk(160, 96), trunk(286, 84), trunk(384, 92), trunk(502, 96), trunk(620, 120), shrub(30, 200), trunk(40, 380), trunk(112, 336)],
      ...[shrub(150, 452), trunk(500, 372), trunk(566, 430), shrub(440, 452), trunk(620, 474), trunk(30, 476)],
    ],
    doors: [{ at: { x: 630, y: 226, w: 10, h: 60 }, to: 'plaza', spawn: { x: 40, y: 256 } }],
    spots: [
      { kind: 'myBase', at: { x: 96, y: 172 }, reach: 24 },
      { kind: 'myBase', at: { x: 222, y: 170 }, reach: 24 },
      { kind: 'bases', at: { x: 330, y: 176 }, reach: 24 },
      { kind: 'myBase', at: { x: 442, y: 174 }, reach: 24 },
      { kind: 'myBase', at: { x: 562, y: 176 }, reach: 24 },
      { kind: 'carpenter', at: { x: 272, y: 404 }, reach: 28 },
      { kind: 'bench', at: { x: 420, y: 344 }, reach: 20 },
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
