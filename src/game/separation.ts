/** A body the horde's separation pushes: at its feet, with a mass that sets its share of each push. */
export type Separable = { x: number; y: number; radius: number; mass: number }

/**
 * Per index, for this pass (scratch, never state): what it is (skipped, a
 * pusher, or a wall pushers bump off) and where it stands, kept side by
 * side so a candidate is turned down without reaching into its body.
 */
const SKIP = 0
const PUSH = 1
const WALL = 2
let kinds = new Uint8Array(0)
let xs = new Float64Array(0)
let ys = new Float64Array(0)
let rs = new Float64Array(0)
/** The pass's own grid: each body's cell, then the bodies sorted by cell (row by row, by index within a cell) and where each cell's run starts. */
let cellOf = new Int32Array(0)
let sorted = new Int32Array(0)
let starts = new Int32Array(0)

/** The grid's cell (px), and the most cells it spans before it coarsens (bodies spread far apart, a co-op team split up). */
const CELL = 32
const MAX_CELLS = 1 << 16

/**
 * One separation pass: overlapping bodies (closer than 0.8 of their radii
 * summed) push each other apart, so a horde forms rings, not blobs. Bodies
 * are filed in cells where they stand as the pass starts; a body reads the
 * cells within twice its radius and settles the pairs it finds with the
 * bodies after it in `bodies`: both move apart by their share of the
 * overlap (the heavier one less), half the overlap per tick between them.
 * Twice its radius takes in any overlap with a body up to 1.5 times its
 * size, so a body bigger than that also settles its pairs with the smaller
 * ones before it (now and then one the smaller had found too, which then
 * pushes a little harder). A wall (a body that stands but isn't pushed) only
 * pushes whoever finds it. Each pair used to be settled from both sides,
 * read twice, through the spatial grid's buckets: on a screen packed with
 * the late horde that was the run's dearest loop. Earlier first, rather than
 * bigger first, keeps the loop's test in index order, which a cell's run is.
 *
 * `pushes(b)`: whether `b` is pushed (a dying, airborne or avatar body
 * isn't). `solid(b)`: whether one that isn't still stands in the way (an
 * avatar; a dying or airborne one doesn't). Both are read again for each
 * overlapping pair, as a body may faint meanwhile. `touch(e, o)` hears every
 * overlapping pair, both ways for two pushers, before the push: body blows
 * go through it. Nothing it calls may move a body. `settles(b)`: whether
 * `b` settles its pairs this pass (it's still pushed by the ones that do).
 */
export const separate = <T extends Separable>(
  bodies: readonly T[], pushes: (b: T) => boolean, solid: (b: T) => boolean, touch: (e: T, o: T) => void, settles: (b: T) => boolean = () => true,
) => {
  const count = bodies.length
  if (kinds.length < count) {
    kinds = new Uint8Array(count * 2)
    xs = new Float64Array(count * 2)
    ys = new Float64Array(count * 2)
    rs = new Float64Array(count * 2)
    cellOf = new Int32Array(count * 2)
    sorted = new Int32Array(count * 2)
  }
  // Locals, not the module's bindings: the loop below reads them a hundred thousand times a tick.
  const kind = kinds
  const px = xs
  const py = ys
  const pr = rs
  for (let i = 0; i < count; i++) {
    const b = bodies[i]
    // A body somewhere absurd (never in play) would stretch the grid without end.
    const k = b === undefined || !(Math.abs(b.x) < 1e9 && Math.abs(b.y) < 1e9) ? SKIP : pushes(b) ? PUSH : solid(b) ? WALL : SKIP
    kind[i] = k
    if (k === SKIP) continue
    px[i] = b!.x
    py[i] = b!.y
    pr[i] = b!.radius
  }
  // File them: the span they stand in, in cells (coarser when that's too many), counted, then sorted by cell.
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (let i = 0; i < count; i++) {
    if (kind[i] === SKIP) continue
    if (px[i]! < x0) x0 = px[i]!
    if (px[i]! > x1) x1 = px[i]!
    if (py[i]! < y0) y0 = py[i]!
    if (py[i]! > y1) y1 = py[i]!
  }
  if (x0 > x1) return
  let cell = CELL
  let cx0 = Math.floor(x0 / cell)
  let cy0 = Math.floor(y0 / cell)
  let w = Math.floor(x1 / cell) - cx0 + 1
  let h = Math.floor(y1 / cell) - cy0 + 1
  while (w * h > MAX_CELLS) {
    cell *= 2
    cx0 = Math.floor(x0 / cell)
    cy0 = Math.floor(y0 / cell)
    w = Math.floor(x1 / cell) - cx0 + 1
    h = Math.floor(y1 / cell) - cy0 + 1
  }
  if (starts.length < w * h + 1) starts = new Int32Array((w * h + 1) * 2)
  const start = starts
  const at = cellOf
  const order = sorted
  start.fill(0, 0, w * h + 1)
  for (let i = 0; i < count; i++) {
    if (kind[i] === SKIP) continue
    const c = (Math.floor(py[i]! / cell) - cy0) * w + (Math.floor(px[i]! / cell) - cx0)
    at[i] = c
    start[c + 1]!++
  }
  for (let c = 0; c < w * h; c++) start[c + 1]! += start[c]!
  // Each cell's run in index order: filled from its start, which the next loop leaves at the run's end.
  for (let i = 0; i < count; i++) if (kind[i] !== SKIP) order[start[at[i]!]!++] = i
  for (let c = w * h; c > 0; c--) start[c] = start[c - 1]!
  start[0] = 0
  for (let i = 0; i < count; i++) {
    if (kind[i] !== PUSH) continue
    const e = bodies[i]!
    // It may have fainted to a body blow since, or sit this pass out.
    if (!pushes(e) || !settles(e)) continue
    const r = pr[i]!
    let ex = px[i]!
    let ey = py[i]!
    // The cells within twice its radius, clipped to the span: one run of `order` per row.
    const reach = r * 2
    const ca = Math.max(0, Math.floor((ex - reach) / cell) - cx0)
    const cb = Math.min(w - 1, Math.floor((ex + reach) / cell) - cx0)
    const ra = Math.max(0, Math.floor((ey - reach) / cell) - cy0)
    const rb = Math.min(h - 1, Math.floor((ey + reach) / cell) - cy0)
    for (let row = ra; row <= rb; row++) {
      const end = start[row * w + cb + 1]!
      for (let n = start[row * w + ca]!; n < end; n++) {
        const j = order[n]!
        const other = kind[j]
        // An earlier pusher settled it, unless this one is too big for the earlier one's reach.
        if (other === SKIP || j === i || (other === PUSH && j < i && r <= pr[j]! * 1.5)) continue
        const dx = ex - px[j]!
        const dy = ey - py[j]!
        const min = (r + pr[j]!) * 0.8
        const d2 = dx * dx + dy * dy
        if (d2 >= min * min) continue
        const o = bodies[j]!
        if (other === WALL ? !solid(o) : !pushes(o)) continue
        const both = other === PUSH
        touch(e, o)
        if (both) touch(o, e)
        if (d2 === 0) continue
        const d = Math.sqrt(d2)
        const share = ((min - d) / d / (e.mass + o.mass)) * 0.5
        const pe = share * o.mass
        ex += dx * pe
        ey += dy * pe
        e.x = ex
        e.y = ey
        if (!both) continue
        const po = share * e.mass
        o.x -= dx * po
        o.y -= dy * po
        px[j] = o.x
        py[j] = o.y
      }
    }
    px[i] = ex
    py[i] = ey
  }
}
