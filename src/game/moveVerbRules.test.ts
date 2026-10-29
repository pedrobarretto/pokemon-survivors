import { describe, expect, it } from 'vitest'
import {
  atLevel, clusterSpots, electroMult, farthest, gyroMult, inArc, mostHurt, nearestPreferring, ringPoints, roostLands, selfDestructCost,
  SPEED_MULT, SPEED_REF,
} from './moveVerbRules'
import { createRng } from '../engine/rng'

const foe = (id: number, x: number, y: number, hp = 10, maxHp = 10, dying = -1) => ({ id, x, y, hp, maxHp, dying })
const origin = { x: 0, y: 0 }

describe('targeting', () => {
  it('Brine goes for the most hurt foes in range, nearer first on a tie', () => {
    const foes = [foe(1, 10, 0, 9), foe(2, 50, 0, 2), foe(3, 30, 0, 5), foe(4, 20, 0, 5), foe(5, 500, 0, 1), foe(6, 5, 0, 1, 10, 0)]
    expect(mostHurt(foes, origin, 3, 100).map((e) => e.id)).toEqual([2, 4, 3])
  })

  it('Bonemerang goes for the farthest foes in range', () => {
    const foes = [foe(1, 10, 0), foe(2, 90, 0), foe(3, 0, 60), foe(4, 400, 0)]
    expect(farthest(foes, origin, 2, 100).map((e) => e.id)).toEqual([2, 3])
  })

  it('Venoshock prefers a poisoned foe even when another is nearer', () => {
    const foes = [foe(1, 10, 0), foe(2, 80, 0), foe(3, 60, 0)]
    const poisoned = (e: { id: number }) => e.id !== 1
    expect(nearestPreferring(foes, origin, 200, poisoned, new Set())?.id).toBe(3)
    expect(nearestPreferring(foes, origin, 200, poisoned, new Set([3]))?.id).toBe(2)
    expect(nearestPreferring(foes, origin, 200, () => false, new Set())?.id).toBe(1)
    expect(nearestPreferring(foes, origin, 5, () => true, new Set())).toBeNull()
  })

  it('Future Sight lands on the densest groups, each foe counted once', () => {
    const crowd = [foe(1, 100, 100), foe(2, 104, 100), foe(3, 100, 104), foe(4, 104, 104)]
    const pair = [foe(5, -200, 0), foe(6, -204, 0)]
    const spots = clusterSpots([...pair, ...crowd, foe(7, 0, 400)], 2, 20)
    expect(spots).toEqual([{ x: 102, y: 102 }, { x: -202, y: 0 }])
    expect(clusterSpots([], 3, 20)).toEqual([])
  })

  it('Future Sight counts neighbors on its grid as checking every pair would', () => {
    // The pick it made before the grid: every foe against every other.
    const brute = (foes: ReturnType<typeof foe>[], count: number, radius: number) => {
      const left = [...foes]
      const spots: { x: number; y: number }[] = []
      const near = (a: { x: number; y: number }, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= radius * radius
      while (spots.length < count && left.length > 0) {
        const counts = left.map((e) => left.filter((o) => near(e, o)).length)
        const top = Math.max(...counts)
        const best = left.filter((_, i) => counts[i] === top).sort((a, b) => a.id - b.id)[0]!
        const covered = left.filter((o) => near(best, o)).reverse()
        spots.push({ x: covered.reduce((s, o) => s + o.x, 0) / covered.length, y: covered.reduce((s, o) => s + o.y, 0) / covered.length })
        for (const o of covered) left.splice(left.indexOf(o), 1)
      }
      return spots
    }
    const rng = createRng(7)
    // A horde on whole pixels, so some pairs sit exactly at the reach, across cell edges and negative coordinates.
    const horde = Array.from({ length: 300 }, (_, i) => foe(i, Math.round((rng() - 0.5) * 400), Math.round((rng() - 0.5) * 300)))
    for (const radius of [20, 26, 34.5]) expect(clusterSpots(horde, 6, radius)).toEqual(brute(horde, 6, radius))
  })

  it('Dragon Tail only catches foes in the arc behind', () => {
    const foes = [foe(1, -30, 0), foe(2, 30, 0), foe(3, -20, 20), foe(4, -300, 0)]
    expect(inArc(foes, origin, Math.PI, 1, 50).map((e) => e.id)).toEqual([1, 3])
  })
})

describe('speed readings', () => {
  it('Electro Ball grows with speed and Gyro Ball with slowness, both bounded', () => {
    expect(electroMult(SPEED_REF)).toBe(1)
    expect(gyroMult(SPEED_REF)).toBe(1)
    expect(electroMult(SPEED_REF * 1.3)).toBeGreaterThan(1.5)
    expect(electroMult(1000)).toBe(SPEED_MULT.max)
    expect(electroMult(0)).toBe(SPEED_MULT.min)
    expect(gyroMult(0)).toBe(SPEED_MULT.max)
    expect(gyroMult(1000)).toBe(SPEED_MULT.min)
  })
})

describe('Self-Destruct', () => {
  it('costs a fifth of the current HP and never the last point', () => {
    expect(selfDestructCost(100)).toBe(20)
    expect(selfDestructCost(12.5)).toBe(2)
    expect(selfDestructCost(3)).toBe(0)
    expect(selfDestructCost(1)).toBe(0)
  })
})

describe('Roost', () => {
  it('lands once, on the cast that crosses the settle time', () => {
    expect(roostLands(0.9, 0.25, 1)).toBe(false)
    expect(roostLands(1.1, 0.25, 1)).toBe(true)
    expect(roostLands(1.4, 0.25, 1)).toBe(false)
  })
})

describe('tables and rings', () => {
  it('reads a level table and holds at its end', () => {
    expect(atLevel([1, 2, 3], 1)).toBe(1)
    expect(atLevel([1, 2, 3], 3)).toBe(3)
    expect(atLevel([1, 2, 3], 9)).toBe(3)
  })

  it('lays ring points evenly around a center', () => {
    const pts = ringPoints({ x: 10, y: 10 }, 4, 5)
    expect(pts).toHaveLength(4)
    for (const p of pts) expect(Math.hypot(p.x - 10, p.y - 10)).toBeCloseTo(5)
    expect(pts[0]!.x).toBeCloseTo(15)
  })
})
