import { describe, expect, it } from 'vitest'
import * as dm from '../engine/dmath'
import { createRng } from '../engine/rng'
import { crowdPicks, densestOf } from './crowd'

type Foe = { x: number; y: number; id: number; dying: number }

/** The pairwise count `densestOf` stands in for: most neighbors, then nearest, then lower id. */
const brute = (candidates: readonly Foe[], pool: readonly Foe[], x: number, y: number, radius: number) => {
  let best: Foe | null = null
  let bestCount = -1
  let bestD = Infinity
  for (const e of candidates) {
    let count = 0
    for (const o of pool) if (o !== e && dm.sq(o.x - e.x) + dm.sq(o.y - e.y) <= radius * radius) count++
    const d = dm.sq(e.x - x) + dm.sq(e.y - y)
    if (count > bestCount || (count === bestCount && (d < bestD || (d === bestD && best !== null && e.id < best.id)))) {
      best = e
      bestCount = count
      bestD = d
    }
  }
  return best
}

/** A crowd around (-5000, 3000): some foes share a spot and some sit on cell edges, so ties and boundaries get exercised. */
const crowd = (rng: () => number, n: number, spread: number): Foe[] =>
  Array.from({ length: n }, (_, id) => {
    const snap = rng() < 0.3
    const x = (rng() - 0.5) * spread
    const y = (rng() - 0.5) * spread
    return { x: (snap ? Math.round(x / 10) * 10 : x) - 5000, y: (snap ? Math.round(y / 10) * 10 : y) + 3000, id: (id * 7) % 1000, dying: rng() < 0.05 ? 0.1 : -1 }
  })

describe('densestOf', () => {
  it('picks what comparing every pair picks', () => {
    const rng = createRng(7)
    for (let round = 0; round < 300; round++) {
      const pool = crowd(rng, 1 + Math.floor(rng() * 220), 40 + rng() * 600)
      const candidates = pool.filter(() => rng() < 0.6)
      const radius = [0, 10, 30, 50, 12.5][round % 5]!
      expect(densestOf(candidates, pool, -5000, 3000, radius)).toBe(brute(candidates, pool, -5000, 3000, radius))
    }
  })
})

describe('crowdPicks', () => {
  it('picks what picking the densest of the free foes again and again picks', () => {
    const rng = createRng(11)
    for (let round = 0; round < 300; round++) {
      const foes = crowd(rng, Math.floor(rng() * 260), 40 + rng() * 700)
      const [range, radius, apart] = ([[260, 50, 20], [240, 50, 70], [200, 30, 0], [120, 12.5, 90]] as const)[round % 4]!
      const count = 1 + (round % 7)
      const near = foes.filter((e) => e.dying < 0 && dm.sq(e.x + 5000) + dm.sq(e.y - 3000) <= range * range)
      const picked: Foe[] = []
      while (picked.length < count) {
        const free = near.filter((e) => picked.every((o) => dm.sq(o.x - e.x) + dm.sq(o.y - e.y) > apart * apart))
        const best = brute(free, free, -5000, 3000, radius)
        if (!best) break
        picked.push(best)
      }
      expect(crowdPicks(foes, -5000, 3000, range, radius, count, apart)).toEqual(picked)
    }
  })
})
