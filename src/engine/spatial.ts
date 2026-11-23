/**
 * Uniform spatial hash for broad-phase collision. Stores indices into an
 * external array (e.g. `game.enemies`) and is rebuilt every tick.
 *
 * A pass that only needs the bodies close to a point (a hitbox's hits) can
 * also seal the grid (`sealBounds`): each cell then knows the box its bodies
 * stand in now, and `mayHold` tells which cells can't hold one close enough,
 * so their bodies go unread; and the grid keeps every body's x, y and radius
 * side by side (`xs`, `ys`, `rs`, by index), so a pass tests distances
 * without reaching into each body. The cells and their order stay those of
 * `query`, and the numbers are the bodies' own: a pass skips only bodies its
 * own test would have turned down, and every tick ends the same.
 */
export type Grid = {
  cell: number
  cells: Map<number, Bucket>
  used: Bucket[]
  /** The list the cells' boxes were sealed from (`sealBounds`), and how long it was; null when they aren't sealed. */
  sealed: readonly Body[] | null
  sealedCount: number
  /** While sealed: each index's body where it stands (kept by `widen`), and its radius. */
  xs: Float64Array
  ys: Float64Array
  rs: Float64Array
}

/** What the grid holds the indices of: a body at its feet (x, y). */
export type Body = { x: number; y: number; radius: number }

/**
 * A cell's indices, in the order they went in, and, while the grid is
 * sealed, the box (x0, y0)–(x1, y1) its bodies' feet stand in, their largest
 * radius `r`, and `pinned` when one of them may move without `widen` being
 * told (a boss's script), so the cell is always read.
 */
export type Bucket = { items: number[]; x0: number; y0: number; x1: number; y1: number; r: number; pinned: boolean }

export const createGrid = (cell: number): Grid => ({
  cell, cells: new Map(), used: [], sealed: null, sealedCount: 0,
  xs: new Float64Array(0), ys: new Float64Array(0), rs: new Float64Array(0),
})

const bucket = (): Bucket => ({ items: [], x0: 0, y0: 0, x1: 0, y1: 0, r: 0, pinned: true })

/**
 * A cell's key, kept a small integer (15 bits per axis, wrapping every 32768 cells,
 * about a million px) so Map lookups don't box a number on every query.
 */
const key = (cx: number, cy: number) => ((cx & 0x7fff) << 15) | (cy & 0x7fff)

/** Buckets kept past a clear: the cells a long run walked through would pile up for good. */
const KEEP_CELLS = 4096

export const clearGrid = (grid: Grid) => {
  for (const b of grid.used) b.items.length = 0
  grid.used.length = 0
  grid.sealed = null
  if (grid.cells.size > KEEP_CELLS) grid.cells.clear()
}

export const insert = (grid: Grid, index: number, x: number, y: number) => {
  const k = key(Math.floor(x / grid.cell), Math.floor(y / grid.cell))
  let b = grid.cells.get(k)
  if (!b) grid.cells.set(k, (b = bucket()))
  if (b.items.length === 0) grid.used.push(b)
  b.items.push(index)
}

/**
 * Collects indices of every bucket overlapping the square around (x, y) into `out`.
 * It's filled by index and cut to size at the end, never emptied first: `length = 0`
 * would drop its storage and every query would grow a new one.
 */
export const query = (grid: Grid, x: number, y: number, radius: number, out: number[]) => {
  let n = 0
  const minX = Math.floor((x - radius) / grid.cell)
  const maxX = Math.floor((x + radius) / grid.cell)
  const minY = Math.floor((y - radius) / grid.cell)
  const maxY = Math.floor((y + radius) / grid.cell)
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      const b = grid.cells.get(key(cx, cy))
      if (b) for (const i of b.items) out[n++] = i
    }
  }
  out.length = n
  return out
}

/**
 * Fills `out` with the buckets `query` reads for the same square, in its
 * order, and returns how many: a caller walks the first `n` (the array isn't
 * cut to size) and their `items`, and may skip a bucket first (`mayHold`).
 * Nothing inserts while a tick reads the grid, so the items are the ones
 * `query` would have copied.
 */
export const bucketsNear = (grid: Grid, x: number, y: number, radius: number, out: Bucket[]) => {
  let n = 0
  const minX = Math.floor((x - radius) / grid.cell)
  const maxX = Math.floor((x + radius) / grid.cell)
  const minY = Math.floor((y - radius) / grid.cell)
  const maxY = Math.floor((y + radius) / grid.cell)
  for (let cx = minX; cx <= maxX; cx++) {
    for (let cy = minY; cy <= maxY; cy++) {
      const b = grid.cells.get(key(cx, cy))
      if (b !== undefined && b.items.length > 0) out[n++] = b
    }
  }
  return n
}

/**
 * Seals every cell's box from where `list`'s bodies stand now (see `Bucket`):
 * until the grid is cleared or `unseal`ed, a body that moves must `widen` its
 * cell, unless `pinned` said it may move on its own.
 */
export const sealBounds = <T extends Body>(grid: Grid, list: readonly T[], pinned: (body: T) => boolean) => {
  if (grid.xs.length < list.length) {
    const size = Math.max(64, list.length * 2)
    grid.xs = new Float64Array(size)
    grid.ys = new Float64Array(size)
    grid.rs = new Float64Array(size)
  }
  const { xs, ys, rs } = grid
  for (const b of grid.used) {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    let r = 0
    let pin = false
    for (const i of b.items) {
      const o = list[i]
      if (o === undefined) continue
      xs[i] = o.x
      ys[i] = o.y
      rs[i] = o.radius
      if (o.x < x0) x0 = o.x
      if (o.x > x1) x1 = o.x
      if (o.y < y0) y0 = o.y
      if (o.y > y1) y1 = o.y
      if (o.radius > r) r = o.radius
      if (!pin && pinned(o)) pin = true
    }
    b.x0 = x0
    b.y0 = y0
    b.x1 = x1
    b.y1 = y1
    b.r = r
    b.pinned = pin
  }
  grid.sealed = list
  grid.sealedCount = list.length
}

export const unseal = (grid: Grid) => {
  grid.sealed = null
}

/** Tells a sealed grid that index `i`'s body, in bucket `b`, moved: the bucket's box grows to hold it where it stands now. */
export const widen = (grid: Grid, b: Bucket, i: number, o: Body) => {
  // Only while index `i` still holds this body (a list swapped meanwhile was sealed anew).
  if (i < grid.xs.length && grid.sealed?.[i] === o) {
    grid.xs[i] = o.x
    grid.ys[i] = o.y
    grid.rs[i] = o.radius
  }
  if (o.x < b.x0) b.x0 = o.x
  if (o.x > b.x1) b.x1 = o.x
  if (o.y < b.y0) b.y0 = o.y
  if (o.y > b.y1) b.y1 = o.y
  if (o.radius > b.r) b.r = o.radius
}

/** Whether the cells' boxes and `xs`/`ys`/`rs` hold for `list` now (sealed from it, and it hasn't shrunk since). */
export const sealedFor = (grid: Grid, list: readonly Body[]) => grid.sealed === list && list.length >= grid.sealedCount

/**
 * Re-reads index `i`'s body into `xs`/`ys`/`rs`: in a pinned cell it may have
 * moved on its own since the grid was sealed. Call it right before reading them.
 */
export const reread = (grid: Grid, i: number, list: readonly Body[]) => {
  const o = list[i]
  if (o === undefined || i >= grid.xs.length) return
  grid.xs[i] = o.x
  grid.ys[i] = o.y
  grid.rs[i] = o.radius
}

/**
 * Whether bucket `b` may hold a body whose center comes within
 * `(hx + radius) * scale` across and `(hy + radius) * scale` down of (x, y),
 * its center taken `lift` radii above its feet. False only when the sealed box
 * rules every body of it out, with a pixel to spare for rounding; ask it only
 * while `sealedFor` holds.
 */
export const mayHold = (b: Bucket, x: number, y: number, hx: number, hy: number, scale: number, lift: number) => {
  if (b.pinned) return true
  const px = (hx + b.r) * scale + 1
  if (x <= b.x0 - px || x >= b.x1 + px) return false
  const py = (hy + b.r) * scale + 1
  return y > b.y0 - lift * b.r - py && y < b.y1 + py
}

