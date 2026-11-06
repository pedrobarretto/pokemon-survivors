import { BASE_GRID } from './realmMap'
import { FURNITURE, footprint, isFurnitureId, type FurnitureCounts, type FurnitureId } from './furniture'

/**
 * Secret bases: every account with a @handle has one, a room on the realm's
 * trail (`REALM_ROOMS.trail`'s `myBase`), furnished on a grid (`BASE_GRID`)
 * with the furniture it owns (`data/furniture.ts`). The API keeps the layout
 * and checks it with `checkLayout` (the editor checks the same before saving),
 * and decides who may come in (`BaseVisibility`). In the realm a base is a
 * room of the city (`base:<handle>`): the relay asks the API whether a
 * visitor may enter (`POST /realm/visit`) and everyone inside sees each other.
 */

/** The look of the way in and of the walls and floor until a wallpaper or flooring covers them: Emerald's secret base spots. */
export const BASE_EXTERIORS = ['cave', 'tree', 'bush', 'sand'] as const

export type BaseExterior = (typeof BASE_EXTERIORS)[number]

export const isBaseExterior = (v: unknown): v is BaseExterior => typeof v === 'string' && (BASE_EXTERIORS as readonly string[]).includes(v)

/** Who may come in: anyone (and it shows on the trail's board), mutual friends (`server/src/friends.ts`), or only the owner. */
export const BASE_VISIBILITY = ['public', 'friends', 'private'] as const

export type BaseVisibility = (typeof BASE_VISIBILITY)[number]

export const isBaseVisibility = (v: unknown): v is BaseVisibility => typeof v === 'string' && (BASE_VISIBILITY as readonly string[]).includes(v)

/** A placed piece: its id, the tile of its top-left corner, and whether it's turned a quarter. */
export type Placed = { id: FurnitureId; x: number; y: number; turned: boolean }

/** A base as saved. `wallpaper`, `flooring`: a piece of that kind, or null for the exterior's own. */
export type BaseLayout = { exterior: BaseExterior; wallpaper: FurnitureId | null; flooring: FurnitureId | null; items: readonly Placed[] }

export const EMPTY_BASE: BaseLayout = { exterior: 'cave', wallpaper: null, flooring: null, items: [] }

/** Pieces a base holds at most. */
export const BASE_MAX_ITEMS = 60

/** The door tile (bottom row, middle) and the one above it stay clear, so a visitor always gets in. */
export const DOOR = { x: Math.floor(BASE_GRID.cols / 2), y: BASE_GRID.rows - 1 } as const

/** The doorway: the door's tile and the one above it (tiles), where a visitor lands (`BASE_ROOM.spawn`) and leaves. */
export const DOORWAY = { x: DOOR.x, y: DOOR.y - 1, w: 1, h: 2 } as const

/** The tiles around the doorway: beside both of its tiles and above it. One of them stays free, so the door opens onto the room. */
const DOOR_SIDES = [
  { x: DOOR.x - 1, y: DOOR.y },
  { x: DOOR.x + 1, y: DOOR.y },
  { x: DOOR.x - 1, y: DOOR.y - 1 },
  { x: DOOR.x + 1, y: DOOR.y - 1 },
  { x: DOOR.x, y: DOOR.y - 2 },
] as const

/** Why a layout is refused, and which item (its index in `items`) when it's one. */
export type LayoutError =
  | { error: 'unknown' | 'kind' | 'owned' | 'bounds' | 'overlap' | 'support' | 'door'; item: number }
  | { error: 'style' | 'tooMany' }

type Box = { x: number; y: number; w: number; h: number }

const boxOf = (p: Placed): Box => {
  const [w, h] = footprint(p.id, p.turned)
  return { x: p.x, y: p.y, w, h }
}

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

const inside = (inner: Box, outer: Box) => inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

/** Whether a piece keeps walkers off its tiles: it `blocks` and stands off the doorway (one a layout put on it never does, so no base can shut its door). */
export const walksInto = (p: Placed) => FURNITURE[p.id].blocks === true && !overlaps(boxOf(p), DOORWAY)

/**
 * Whether a layout may be saved by an account owning `owned`: every piece
 * known and owned (counting repeats), each where its kind may go (`wall` on
 * the wall rows, `floor`, `rug` below them, a `top` wholly on one `surface`),
 * inside the grid, floors not overlapping floors, rugs not rugs, tops not
 * tops, the doorway clear of anything that blocks and opening onto the room
 * (`DOOR_SIDES`: not all of them blocked), and at most `BASE_MAX_ITEMS`.
 * Null when it's fine. Shared by the API (`PUT /realm/base`) and the editor.
 */
export const checkLayout = (layout: BaseLayout, owned: FurnitureCounts): LayoutError | null => {
  if (layout.items.length > BASE_MAX_ITEMS) return { error: 'tooMany' }
  const styleOk = (id: FurnitureId | null, kind: 'wallpaper' | 'flooring') => id === null || (isFurnitureId(id) && FURNITURE[id].kind === kind && (owned[id] ?? 0) > 0)
  if (!styleOk(layout.wallpaper, 'wallpaper') || !styleOk(layout.flooring, 'flooring')) return { error: 'style' }
  const used = new Map<FurnitureId, number>()
  const grid: Box = { x: 0, y: 0, w: BASE_GRID.cols, h: BASE_GRID.rows }
  const wall: Box = { x: 0, y: 0, w: BASE_GRID.cols, h: BASE_GRID.wallRows }
  const room: Box = { x: 0, y: BASE_GRID.wallRows, w: BASE_GRID.cols, h: BASE_GRID.rows - BASE_GRID.wallRows }
  const boxes = layout.items.map(boxOf)
  for (const [i, p] of layout.items.entries()) {
    if (!isFurnitureId(p.id) || !Number.isInteger(p.x) || !Number.isInteger(p.y)) return { error: 'unknown', item: i }
    const def = FURNITURE[p.id]
    if (def.kind === 'wallpaper' || def.kind === 'flooring') return { error: 'kind', item: i }
    const count = (used.get(p.id) ?? 0) + 1
    used.set(p.id, count)
    if (count > (owned[p.id] ?? 0)) return { error: 'owned', item: i }
    const box = boxes[i]!
    if (!inside(box, grid) || !inside(box, def.kind === 'wall' ? wall : room)) return { error: 'bounds', item: i }
    if (def.blocks && overlaps(box, DOORWAY)) return { error: 'door', item: i }
    for (let j = 0; j < i; j++) {
      const other = layout.items[j]!
      if (FURNITURE[other.id].kind === def.kind && overlaps(box, boxes[j]!)) return { error: 'overlap', item: i }
    }
    if (def.kind === 'top') {
      const on = layout.items.some((s, j) => FURNITURE[s.id].surface === true && inside(box, boxes[j]!))
      if (!on) return { error: 'support', item: i }
    }
  }
  // The doorway opens onto the room: the last piece to shut its last side is the one to move.
  const shut = DOOR_SIDES.map((t) => layout.items.findLastIndex((p, i) => FURNITURE[p.id].blocks === true && overlaps({ ...t, w: 1, h: 1 }, boxes[i]!)))
  if (shut.every((i) => i >= 0)) return { error: 'door', item: Math.max(...shut) }
  return null
}

/** A layout from the wire or the database: anything malformed drops out (the API then checks the rest with `checkLayout`). */
export const parseLayout = (raw: unknown): BaseLayout => {
  if (typeof raw !== 'object' || raw === null) return EMPTY_BASE
  const r = raw as Record<string, unknown>
  const items = Array.isArray(r.items)
    ? r.items.flatMap((v): Placed[] => {
        if (typeof v !== 'object' || v === null) return []
        const p = v as Record<string, unknown>
        return isFurnitureId(p.id) && typeof p.x === 'number' && typeof p.y === 'number' ? [{ id: p.id, x: p.x, y: p.y, turned: p.turned === true }] : []
      })
    : []
  const style = (v: unknown) => (isFurnitureId(v) ? v : null)
  return { exterior: isBaseExterior(r.exterior) ? r.exterior : 'cave', wallpaper: style(r.wallpaper), flooring: style(r.flooring), items }
}
