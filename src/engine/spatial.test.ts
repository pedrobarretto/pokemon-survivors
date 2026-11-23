import { describe, expect, it } from 'vitest'
import { bucketsNear, createGrid, insert, mayHold, query, sealBounds, widen, type Body, type Bucket } from './spatial'
import { createRng, range } from './rng'

/** A crowd of bodies in a 400 px square, inserted by feet as `rebuildGrid` does. */
const crowd = (seed: number, n: number) => {
  const rng = createRng(seed)
  const bodies: Body[] = Array.from({ length: n }, () => ({ x: range(rng, 0, 400), y: range(rng, 0, 400), radius: range(rng, 4, 26) }))
  const grid = createGrid(32)
  bodies.forEach((b, i) => insert(grid, i, b.x, b.y))
  sealBounds(grid, bodies, () => false)
  return { rng, bodies, grid }
}

const sq = (v: number) => v * v

/** Every index in a bucket `mayHold` turns down, for a hitbox of half extents (hx, hy) at (x, y). */
const skipped = (grid: ReturnType<typeof createGrid>, x: number, y: number, hx: number, hy: number, scale: number, lift: number) => {
  const out: Bucket[] = []
  const n = bucketsNear(grid, x, y, Math.max(hx, hy) + 40, out)
  return out.slice(0, n).filter((b) => !mayHold(b, x, y, hx, hy, scale, lift)).flatMap((b) => b.items)
}

describe('sealed grid', () => {
  it('reads the same cells, in the same order, as query', () => {
    const { rng, grid } = crowd(1, 600)
    const out: Bucket[] = []
    for (let k = 0; k < 200; k++) {
      const x = range(rng, -20, 420)
      const y = range(rng, -20, 420)
      const r = range(rng, 2, 80)
      const n = bucketsNear(grid, x, y, r, out)
      expect(out.slice(0, n).flatMap((b) => b.items)).toEqual(query(grid, x, y, r, []))
    }
  })

  it('skips only cells with no body a circle hitbox overlaps', () => {
    const { rng, bodies, grid } = crowd(2, 800)
    let unread = 0
    for (let k = 0; k < 400; k++) {
      const x = range(rng, -20, 420)
      const y = range(rng, -20, 420)
      const r = range(rng, 2, 40)
      for (const i of skipped(grid, x, y, r, r, 1, 1)) {
        const o = bodies[i]!
        expect(sq(x - o.x) + sq(y - (o.y - o.radius))).toBeGreaterThanOrEqual(sq(r + o.radius))
        unread++
      }
    }
    expect(unread).toBeGreaterThan(0)
  })

  it('skips only cells with no body a hitbox overlaps after bodies moved and widened their cells', () => {
    const { rng, bodies, grid } = crowd(3, 800)
    for (let k = 0; k < 300; k++) {
      const i = Math.floor(rng() * bodies.length)
      const o = bodies[i]!
      const b = grid.used.find((u) => u.items.includes(i))!
      o.x += range(rng, -30, 30)
      o.y += range(rng, -30, 30)
      widen(grid, b, i, o)
      expect(grid.xs[i]).toBe(o.x)
      const x = range(rng, 0, 400)
      const y = range(rng, 0, 400)
      const r = range(rng, 2, 40)
      for (const j of skipped(grid, x, y, r, r, 1, 1)) {
        const p = bodies[j]!
        expect(sq(x - p.x) + sq(y - (p.y - p.radius))).toBeGreaterThanOrEqual(sq(r + p.radius))
      }
    }
  })

})
