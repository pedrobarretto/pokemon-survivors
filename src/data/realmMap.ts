/**
 * The Poké Realm's town: its rooms, as plain geometry. Every city
 * (`REALM_CITIES` in `net/realm.ts`) is a copy of the same town. Import-free,
 * like `net/realm.ts`, because the relay reads the bounds to check steps;
 * what a room looks like (its art, props, NPCs, music) is the game's,
 * `render/realm.ts`, keyed by the same ids.
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

/**
 * The town (first draft: the art pass sets the final shapes). The plaza is
 * where every trainer lands: the portals to co-op and the Arena, the board
 * (today's Desafio, the Festival, events) and the roads to the other rooms.
 * The pier has the pool Water types swim in, the café its counter and
 * benches, and the trail the secret bases: your own door and the board of
 * public bases.
 */
export const REALM_ROOMS = {
  plaza: {
    w: 640,
    h: 480,
    spawn: { x: 320, y: 300 },
    solid: [{ kind: 'oval', x: 320, y: 220, rx: 40, ry: 26 }],
    doors: [
      { at: { x: 0, y: 200, w: 12, h: 80 }, to: 'trail', spawn: { x: 600, y: 240 } },
      { at: { x: 628, y: 200, w: 12, h: 80 }, to: 'pier', spawn: { x: 40, y: 240 } },
      { at: { x: 290, y: 0, w: 60, h: 12 }, to: 'cafe', spawn: { x: 200, y: 260 } },
    ],
    spots: [
      { kind: 'coopPortal', at: { x: 180, y: 140 }, reach: 28 },
      { kind: 'arenaPortal', at: { x: 460, y: 140 }, reach: 28 },
      { kind: 'board', at: { x: 320, y: 120 }, reach: 24 },
    ],
  },
  pier: {
    w: 640,
    h: 480,
    spawn: { x: 40, y: 240 },
    solid: [],
    doors: [{ at: { x: 0, y: 200, w: 12, h: 80 }, to: 'plaza', spawn: { x: 600, y: 240 } }],
    spots: [
      { kind: 'pool', at: { x: 380, y: 260 }, reach: 120 },
      { kind: 'bench', at: { x: 160, y: 120 }, reach: 20 },
    ],
  },
  cafe: {
    w: 400,
    h: 300,
    spawn: { x: 200, y: 260 },
    solid: [{ kind: 'rect', x: 120, y: 60, w: 160, h: 28 }],
    doors: [{ at: { x: 170, y: 288, w: 60, h: 12 }, to: 'plaza', spawn: { x: 320, y: 40 } }],
    spots: [
      { kind: 'counter', at: { x: 200, y: 96 }, reach: 24 },
      { kind: 'bench', at: { x: 80, y: 180 }, reach: 20 },
      { kind: 'bench', at: { x: 320, y: 180 }, reach: 20 },
    ],
  },
  trail: {
    w: 640,
    h: 480,
    spawn: { x: 600, y: 240 },
    solid: [],
    doors: [{ at: { x: 628, y: 200, w: 12, h: 80 }, to: 'plaza', spawn: { x: 40, y: 240 } }],
    spots: [
      { kind: 'myBase', at: { x: 200, y: 160 }, reach: 24 },
      { kind: 'bases', at: { x: 360, y: 140 }, reach: 24 },
      { kind: 'carpenter', at: { x: 480, y: 320 }, reach: 28 },
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
