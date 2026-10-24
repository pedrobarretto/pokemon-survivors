/**
 * Shelf packing for a square atlas page: sprites sit on rows ("shelves") filled left to right,
 * and a sprite takes the first shelf as tall as it (or up to `slack` px taller) with room left,
 * or opens a new shelf under the last one. Pure bookkeeping, no canvas: `engine/pixelart.ts`
 * draws into the spots it hands out.
 */
export type Shelves = {
  readonly size: number
  /** Where the next shelf starts. */
  top: number
  readonly rows: { readonly y: number; readonly h: number; end: number }[]
}

/** An empty `size`×`size` page. */
export const shelves = (size: number): Shelves => ({ size, top: 0, rows: [] })

/** Px between sprites, so a rotated or scaled draw never samples its neighbor. */
const GAP = 1

/** How much taller than a sprite a shelf may be and still take it: a little waste for fewer shelves. */
const slack = (h: number) => Math.max(2, h >> 2)

/** A spot for a `w`×`h` sprite on `page`, claimed, or null when the page has none (or the sprite is bigger than the page). */
export const place = (page: Shelves, w: number, h: number): { x: number; y: number } | null => {
  if (w > page.size || h > page.size) return null
  for (const row of page.rows) {
    if (row.h < h || row.h - h > slack(h) || row.end + w > page.size) continue
    const x = row.end
    row.end += w + GAP
    return { x, y: row.y }
  }
  if (page.top + h > page.size) return null
  const y = page.top
  page.rows.push({ y, h, end: w + GAP })
  page.top += h + GAP
  return { x: 0, y }
}

/** Empties `page` for reuse. */
export const clearShelves = (page: Shelves) => {
  page.top = 0
  page.rows.length = 0
}
