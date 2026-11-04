import { FURNITURE, FURNITURE_IDS, footprint, type FurnitureCounts, type FurnitureId } from '../data/furniture'
import { LEGEND_IDS, type LegendId } from '../data/legends'
import { BASE_GRID } from '../data/realmMap'
import { checkLayout, type BaseLayout, type Placed } from '../data/secretBases'
import type { DayKey } from '../game/day'

/**
 * Where a secret base's pieces go, as pure rules over the data (the editor,
 * `ui/baseEditor.ts`, and the drawing, `render/base.ts`): what the carpentry
 * sells today, what's left in the tray, the tiles a dragged piece may take,
 * the first free spot for a new one, and the order pieces are drawn in.
 */

/** The legend a doll stands for, or null for any other piece. */
export const dollLegend = (id: FurnitureId): LegendId | null => {
  if (!id.startsWith('doll:')) return null
  const legend = id.slice(5)
  return LEGEND_IDS.find((l) => l === legend) ?? null
}

/** What Bibarel's carpentry has on its shelves on `day` (Brasília): every piece with a price, a dated one from its day on. */
export const onSale = (day: DayKey): FurnitureId[] => FURNITURE_IDS.filter((id) => FURNITURE[id].price !== null && (FURNITURE[id].from ?? '') <= day)

/** How many of each piece a layout uses (its wallpaper and flooring included). */
export const placedCounts = (layout: BaseLayout): Map<FurnitureId, number> => {
  const used = new Map<FurnitureId, number>()
  for (const p of layout.items) used.set(p.id, (used.get(p.id) ?? 0) + 1)
  return used
}

/** What's still in the tray: each piece owned minus the ones placed (style pieces are never placed, so they all count). */
export const trayCounts = (owned: FurnitureCounts, layout: BaseLayout): Map<FurnitureId, number> => {
  const used = placedCounts(layout)
  const out = new Map<FurnitureId, number>()
  for (const id of FURNITURE_IDS) {
    const left = (owned[id] ?? 0) - (used.get(id) ?? 0)
    if (left > 0) out.set(id, left)
  }
  return out
}

/** The tiles a piece's top-left may take while it's moved: kept inside the grid and on its own band (the wall's, or the floor's). */
export const clampSpot = (id: FurnitureId, turned: boolean, x: number, y: number): { x: number; y: number } => {
  const [w, h] = footprint(id, turned)
  const wall = FURNITURE[id].kind === 'wall'
  const top = wall ? 0 : BASE_GRID.wallRows
  const bottom = (wall ? BASE_GRID.wallRows : BASE_GRID.rows) - h
  return { x: Math.max(0, Math.min(BASE_GRID.cols - w, x)), y: Math.max(top, Math.min(Math.max(top, bottom), y)) }
}

/** Whether `checkLayout` finds nothing wrong with item `i` (other pieces may still be). */
export const fitsAt = (layout: BaseLayout, owned: FurnitureCounts, i: number) => {
  const error = checkLayout(layout, owned)
  return error === null || !('item' in error) || error.item !== i
}

/**
 * Where a new piece goes when it's tapped in the tray: the first free spot
 * from the room's middle outward where `checkLayout` takes it (on a table, for
 * what sits on one), else the room's middle (the editor then marks it).
 */
export const firstSpot = (layout: BaseLayout, owned: FurnitureCounts, id: FurnitureId): Placed => {
  const middle = clampSpot(id, false, Math.floor(BASE_GRID.cols / 2) - 1, Math.floor((BASE_GRID.rows + BASE_GRID.wallRows) / 2) - 1)
  const spots: { x: number; y: number; d: number }[] = []
  for (let y = 0; y < BASE_GRID.rows; y++)
    for (let x = 0; x < BASE_GRID.cols; x++) {
      const at = clampSpot(id, false, x, y)
      if (at.x === x && at.y === y) spots.push({ x, y, d: Math.abs(x - middle.x) + Math.abs(y - middle.y) })
    }
  spots.sort((a, b) => a.d - b.d)
  for (const s of spots) {
    const piece: Placed = { id, x: s.x, y: s.y, turned: false }
    const next = { ...layout, items: [...layout.items, piece] }
    if (fitsAt(next, owned, next.items.length - 1)) return piece
  }
  return { id, ...middle, turned: false }
}

export type Box = { x: number; y: number; w: number; h: number }

export const boxOf = (p: Placed): Box => {
  const [w, h] = footprint(p.id, p.turned)
  return { x: p.x, y: p.y, w, h }
}

const within = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h

/** The surface a top piece sits on (its index), or -1. */
export const supportOf = (items: readonly Placed[], i: number) => {
  const own = boxOf(items[i]!)
  return items.findIndex((s, j) => j !== i && FURNITURE[s.id].surface === true && within(own, boxOf(s)))
}

/**
 * The order pieces are drawn in (indices into `items`): rugs, then the wall's,
 * then floor pieces by their bottom row, each surface's tops right after it.
 */
export const drawOrder = (items: readonly Placed[]): number[] => {
  const key = (p: Placed, i: number) => {
    const kind = FURNITURE[p.id].kind
    if (kind === 'rug') return -2000 + i * 0.001
    if (kind === 'wall') return -1000 + i * 0.001
    const b = boxOf(p)
    if (kind !== 'top') return b.y + b.h + i * 0.0001
    const s = supportOf(items, i)
    const under = s >= 0 ? boxOf(items[s]!) : b
    return under.y + under.h + 0.5 + i * 0.0001
  }
  return items.map((p, i) => ({ i, k: key(p, i) })).sort((a, b) => a.k - b.k).map((e) => e.i)
}

