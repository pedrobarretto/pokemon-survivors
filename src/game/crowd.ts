import * as dm from '../engine/dmath'

type Foe = { x: number; y: number; id: number }

/** Scratch reused between calls (never state): the cells' pool indices, the candidates' order and upper bounds. */
const cells = new Map<number, number[]>()
const spare: number[][] = []
const order: number[] = []
const bound: number[] = []

/** A cell's key: 16 bits per axis, wrapping 65536 cells apart, far wider than any crowd a move looks at. */
const key = (cx: number, cy: number) => (cx & 0xffff) * 65536 + (cy & 0xffff)

/** Files `pool`'s indices in `cells`, by cells of `cell` px. */
const file = (pool: readonly Foe[], cell: number) => {
  for (let i = 0; i < pool.length; i++) {
    const o = pool[i]!
    const k = key(Math.floor(o.x / cell), Math.floor(o.y / cell))
    let b = cells.get(k)
    if (!b) cells.set(k, (b = spare.pop() ?? []))
    b.push(i)
  }
}

/** Empties `cells`, keeping its lists for the next call. */
const unfile = () => {
  for (const b of cells.values()) {
    b.length = 0
    spare.push(b)
  }
  cells.clear()
}

/**
 * The candidate with the most other `pool` foes within `radius` of it, then
 * the one nearest (x, y), then the lower id: a total order, so the answer
 * doesn't depend on the order foes are looked at. Every candidate must be in
 * `pool` (it doesn't count itself), and `pool` must hold every foe that may
 * stand within `radius` of a candidate. The same pick, and the same distance
 * sums, as comparing every pair, but the pool is bucketed into cells of
 * `radius` px so a candidate only reads the 3×3 cells around it, and the
 * candidates go from the most crowded cells down, so one whose cells can't
 * beat the best so far is never counted. `densestFoe` (both of them) and
 * every crowd-seeking move's aim go through here: on a screen full of foes
 * the pairwise count was a third of a late run's tick.
 */
export const densestOf = <T extends Foe>(candidates: readonly T[], pool: readonly T[], x: number, y: number, radius: number): T | null => {
  if (candidates.length === 0) return null
  // A px wider than `radius`: a foe a rounding error past it still sits within one cell.
  const cell = Math.max(radius, 0) + 1
  const r2 = radius * radius
  file(pool, cell)
  // A candidate's count can't pass what its 3×3 cells hold besides itself.
  order.length = candidates.length
  bound.length = candidates.length
  for (let c = 0; c < candidates.length; c++) {
    const e = candidates[c]!
    const cx = Math.floor(e.x / cell)
    const cy = Math.floor(e.y / cell)
    let n = -1
    for (let ix = cx - 1; ix <= cx + 1; ix++) for (let iy = cy - 1; iy <= cy + 1; iy++) n += cells.get(key(ix, iy))?.length ?? 0
    bound[c] = n
    order[c] = c
  }
  order.sort((a, b) => bound[b]! - bound[a]!)
  let best: T | null = null
  let bestCount = -1
  let bestD = Infinity
  for (const c of order) {
    // Counts only fall from here on: none can pass the best, and a tie on count still needs its distance read.
    if (bound[c]! < bestCount) break
    const e = candidates[c]!
    const cx = Math.floor(e.x / cell)
    const cy = Math.floor(e.y / cell)
    let count = 0
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iy = cy - 1; iy <= cy + 1; iy++) {
        const b = cells.get(key(ix, iy))
        if (!b) continue
        for (const i of b) {
          const o = pool[i]!
          if (o !== e && dm.sq(o.x - e.x) + dm.sq(o.y - e.y) <= r2) count++
        }
      }
    }
    const d = dm.sq(e.x - x) + dm.sq(e.y - y)
    if (count > bestCount || (count === bestCount && (d < bestD || (d === bestD && best !== null && e.id < best.id)))) {
      best = e
      bestCount = count
      bestD = d
    }
  }
  unfile()
  return best
}

/** `crowdPicks`' scratch: each candidate's count, whether it's still free, and the ones a pick just took out. */
const counts: number[] = []
const free: boolean[] = []
const gone: number[] = []

/**
 * Up to `count` foes among `foes` within `range` of (x, y), each the densest
 * of those still free (most others still free within `radius`, then the
 * nearest, then the lower id, as `densestOf`), where a pick frees up nothing
 * within `apart` px of it, itself included: what picking `densestOf` over
 * the free foes again and again picks, but the counts are made once and each
 * pick only takes its neighbors' share off them (a crowd move aims six
 * stingers through here).
 */
export const crowdPicks = <T extends Foe & { dying: number }>(foes: readonly T[], x: number, y: number, range: number, radius: number, count: number, apart: number): T[] => {
  const near = foes.filter((e) => e.dying < 0 && dm.sq(e.x - x) + dm.sq(e.y - y) <= range * range)
  const picked: T[] = []
  if (near.length === 0 || count <= 0) return picked
  const cell = Math.max(radius, 0) + 1
  const r2 = radius * radius
  file(near, cell)
  counts.length = near.length
  free.length = near.length
  free.fill(true)
  /** Calls `f` with every other foe of `near` within `radius` of `near[i]`. */
  const around = (i: number, f: (j: number) => void) => {
    const e = near[i]!
    const cx = Math.floor(e.x / cell)
    const cy = Math.floor(e.y / cell)
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iy = cy - 1; iy <= cy + 1; iy++) {
        const b = cells.get(key(ix, iy))
        if (!b) continue
        for (const j of b) if (j !== i && dm.sq(near[j]!.x - e.x) + dm.sq(near[j]!.y - e.y) <= r2) f(j)
      }
    }
  }
  for (let i = 0; i < near.length; i++) {
    let n = 0
    around(i, () => n++)
    counts[i] = n
  }
  while (picked.length < count) {
    let best = -1
    let bestD = Infinity
    for (let i = 0; i < near.length; i++) {
      if (!free[i]) continue
      const e = near[i]!
      const d = dm.sq(e.x - x) + dm.sq(e.y - y)
      if (best < 0 || counts[i]! > counts[best]! || (counts[i] === counts[best] && (d < bestD || (d === bestD && e.id < near[best]!.id)))) {
        best = i
        bestD = d
      }
    }
    if (best < 0) break
    const b = near[best]!
    picked.push(b)
    if (picked.length >= count) break
    // Everything within `apart` of the pick leaves the pool first, then each takes itself off the counts of those still in it.
    gone.length = 0
    for (let i = 0; i < near.length; i++) {
      if (free[i] && !(dm.sq(b.x - near[i]!.x) + dm.sq(b.y - near[i]!.y) > apart * apart)) {
        free[i] = false
        gone.push(i)
      }
    }
    for (const j of gone) around(j, (k) => { if (free[k]) counts[k]!-- })
  }
  unfile()
  return picked
}
