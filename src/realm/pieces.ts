import { FURNITURE, isFurnitureId, type FurnitureId } from '../data/furniture'
import { placedTurn } from '../data/furnitureDef'
import { JUKEBOX, pieceKey, seatsOf, turnedSize, type FurnitureUse, type SeatPose } from '../data/furnitureUse'
import { THEMES, type ThemeId } from '../data/music'
import { BASE_GRID, BASE_ROOM, REALM_ROOMS, isTownRoomId, type Point, type Rect, type Spot } from '../data/realmMap'
import type { BaseLayout } from '../data/secretBases'
import type { Facing, PieceRef, RoomFurniture, RoomKey } from '../net/realm'

/**
 * The furniture a trainer can use in the room it stands in, as pure rules
 * over the data (`data/furnitureUse.ts`; the screen is `ui/realm.ts`, the
 * relay checks the same, `relay/src/realm.ts`): a town room's benches, a
 * base's pieces that seat, light up or play music; which seat to take; what
 * the prompt offers; and the theme a base's music piece plays.
 */

/** A seat as placed in the room (world px: its front edge), its facing and pose. */
export type RoomSeat = { x: number; y: number; facing: Facing; pose: SeatPose }

/**
 * A usable piece: how the relay knows it (`ref`, and `key` for the room's
 * lights and music), where a trainer walks to use it (`at`), how near it
 * must be (`reach`: of `at` for a town bench, of the footprint for a base
 * piece, `reaches`), what a tap on it hits (`box`), what it does and its seats in
 * world px. `id`: a base piece's (null for a town bench), `lift`: how far
 * its art rises off its footprint (a lamp on a table), for its glow;
 * `mirrored`: turned the other way (`turnOf`), its glow mirrored with it.
 */
export type UsePiece = { ref: PieceRef; id: FurnitureId | null; key: string; at: Point; reach: number; box: Rect; use: FurnitureUse; seats: readonly RoomSeat[]; lift: number; mirrored: boolean }

/** Where a trainer walks to use a base piece (px in front of it, inside the room), and how near its footprint it must be (px; the relay allows `REALM.useReach`). */
const FRONT = 8
const REACH = 14

/** A town bench's tap box around its spot (the bench stands just above it). */
const benchBox = (s: Spot): Rect => ({ x: s.at.x - 20, y: s.at.y - 36, w: 40, h: 40 })

/**
 * The room's usable pieces: a town room's benches (`seats` of its `bench`
 * spots), or every piece of a base's layout with a `use`. `lifts`: how far
 * each item's art rises (`render/base.ts`'s `liftOf`), by index.
 */
export const usePieces = (room: RoomKey, layout: BaseLayout | null, lifts: (i: number) => number = () => 0): UsePiece[] => {
  if (isTownRoomId(room)) {
    const spots: readonly Spot[] = REALM_ROOMS[room].spots
    return spots.flatMap((s, i): UsePiece[] =>
      s.seats ? [{ ref: { spot: i }, id: null, key: `s${i}`, at: s.at, reach: s.reach, box: benchBox(s), use: { sit: [] }, seats: s.seats.map((seat) => ({ x: seat.x, y: seat.y, facing: seat.face, pose: 'sit' })), lift: 0, mirrored: false }] : [],
    )
  }
  if (!layout) return []
  const tile = BASE_GRID.tile
  return layout.items.flatMap((p, i): UsePiece[] => {
    if (!isFurnitureId(p.id)) return []
    const def = FURNITURE[p.id]
    if (!def.use) return []
    const turn = placedTurn(def, p.turned)
    const [w, h] = turnedSize(def.size, turn)
    const box = { x: p.x * tile, y: p.y * tile, w: w * tile, h: h * tile }
    const seats = seatsOf(def.use, def.size, turn, tile).map((s) => ({ ...s, x: box.x + s.x, y: box.y + s.y }))
    const at = { x: box.x + box.w / 2, y: Math.min(box.y + box.h + FRONT, BASE_ROOM.h - 4) }
    return [{ ref: { id: p.id, x: p.x, y: p.y, turned: p.turned }, id: p.id, key: pieceKey(p), at, reach: REACH, box, use: def.use, seats, lift: lifts(i), mirrored: turn === 'mirror' }]
  })
}

/** The piece whose box a tap at (`x`, `y`) hits, the frontmost (lowest) first. */
export const pieceAt = (pieces: readonly UsePiece[], x: number, y: number): UsePiece | null =>
  [...pieces].sort((a, b) => b.box.y + b.box.h - (a.box.y + a.box.h)).find((p) => x >= p.box.x && x <= p.box.x + p.box.w && y >= p.box.y - p.lift - 12 && y <= p.box.y + p.box.h) ?? null

/** How far a trainer at (`x`, `y`) is from using a piece: from a town bench's spot, or from a base piece's footprint. */
const distance = (p: UsePiece, x: number, y: number) =>
  p.id === null ? Math.hypot(p.at.x - x, p.at.y - y) : Math.hypot(Math.max(p.box.x - x, 0, x - p.box.x - p.box.w), Math.max(p.box.y - y, 0, y - p.box.y - p.box.h))

/** Whether a trainer at (`x`, `y`) can use a piece from there. */
export const reaches = (p: UsePiece, x: number, y: number) => distance(p, x, y) <= p.reach

/** The piece in reach of a trainer at (`x`, `y`), the nearest. */
export const pieceNear = (pieces: readonly UsePiece[], x: number, y: number): UsePiece | null => {
  let best: UsePiece | null = null
  let d = Infinity
  for (const p of pieces) {
    const dd = distance(p, x, y)
    if (dd <= p.reach && dd < d) {
      best = p
      d = dd
    }
  }
  return best
}

/** The free seat of a piece nearest to (`x`, `y`) (its index), or null when every one is `taken` (spots of seated trainers). */
export const freeSeat = (piece: UsePiece, taken: readonly Point[], x: number, y: number): number | null => {
  let best: number | null = null
  let d = Infinity
  piece.seats.forEach((s, i) => {
    if (taken.some((o) => Math.round(o.x) === Math.round(s.x) && Math.round(o.y) === Math.round(s.y))) return
    const dd = Math.hypot(s.x - x, s.y - y)
    if (dd < d) {
      best = i
      d = dd
    }
  })
  return best
}

/** Whether (`x`, `y`) is one of the pieces' seats (to the whole px): a trainer seated there sits inside its piece's footprint, not stuck in it. */
export const onASeat = (pieces: readonly UsePiece[], x: number, y: number) =>
  pieces.some((p) => p.seats.some((s) => Math.round(s.x) === Math.round(x) && Math.round(s.y) === Math.round(y)))

/** What using a piece does now, for its prompt: sit (lie, soak) down, a seat taken, a light on or off, the music on, on to its next track, or off. */
export type PieceAction = SeatPose | 'taken' | 'on' | 'off' | 'play' | 'next' | 'stop'

export const actionOf = (piece: UsePiece, state: RoomFurniture | null, taken: readonly Point[], x: number, y: number): PieceAction => {
  if ('toggle' in piece.use) return state?.lit.includes(piece.key) ? 'off' : 'on'
  if ('music' in piece.use) return state?.music?.piece !== piece.key ? 'play' : state.music.track + 1 < JUKEBOX.length ? 'next' : 'stop'
  const seat = freeSeat(piece, taken, x, y)
  return seat === null ? 'taken' : piece.seats[seat]!.pose
}

const isThemeId = (v: string): v is ThemeId => Object.hasOwn(THEMES, v)

/** The theme a track of `JUKEBOX` plays. */
export const trackTheme = (track: number): ThemeId | null => {
  const id = JUKEBOX[track]
  return id !== undefined && isThemeId(id) ? id : null
}

/** The theme a base's music plays for this trainer: only from a music piece its own copy of the layout holds. */
export const roomTheme = (pieces: readonly UsePiece[], state: RoomFurniture | null): ThemeId | null => {
  const music = state?.music
  if (!music || !pieces.some((p) => p.key === music.piece && 'music' in p.use)) return null
  return trackTheme(music.track)
}
