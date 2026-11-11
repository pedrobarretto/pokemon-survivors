import { describe, expect, it } from 'vitest'
import { createRng, range } from '../engine/rng'
import { separate, type Separable } from './separation'

type Body = Separable & { id: number; pushes: boolean }

/** Pairs of overlapping bodies, each pair 400 px from the next so no push reaches another pair. */
const pairs = (seed: number, n: number, small = 8, big = 12) => {
  const rng = createRng(seed)
  const bodies: Body[] = []
  for (let k = 0; k < n; k++) {
    const x = (k % 10) * 400 + range(rng, 0, 32)
    const y = Math.floor(k / 10) * 400 + range(rng, 0, 32)
    const a = { id: bodies.length, x, y, radius: range(rng, small, big), mass: range(rng, 0.5, 4), pushes: true }
    const b = { id: bodies.length + 1, x: 0, y: 0, radius: range(rng, small, big), mass: range(rng, 0.5, 4), pushes: rng() < 0.85 }
    // Somewhere inside the overlap; some pairs share a radius.
    if (rng() < 0.2) b.radius = a.radius
    const angle = range(rng, 0, Math.PI * 2)
    const d = range(rng, 0.05, 0.75) * (a.radius + b.radius)
    b.x = x + Math.cos(angle) * d
    b.y = y + Math.sin(angle) * d
    // Either one may come first.
    if (rng() < 0.5) bodies.push(a, b)
    else bodies.push(b, a)
  }
  return { bodies }
}

describe('separate', () => {
  it('settles every overlapping pair of like sizes once, pushing both apart by their mass shares, whichever comes first', () => {
    const { bodies } = pairs(3, 300)
    const before = bodies.map((b) => ({ ...b }))
    const touches = new Map<string, number>()
    separate(bodies, (b) => b.pushes, () => true, (e, o) => touches.set(`${e.id}>${o.id}`, (touches.get(`${e.id}>${o.id}`) ?? 0) + 1))
    for (let i = 0; i < bodies.length; i += 2) {
      const [a, b] = [before[i]!, before[i + 1]!]
      const dx = a.x - b.x
      const dy = a.y - b.y
      const d = Math.sqrt(dx * dx + dy * dy)
      const share = ((((a.radius + b.radius) * 0.8 - d) / d / (a.mass + b.mass)) * 0.5)
      // A body that doesn't push stays put, and its partner takes only its own share.
      const pa = a.pushes ? share * b.mass : 0
      const pb = b.pushes ? share * a.mass : 0
      expect(bodies[i]!.x).toBeCloseTo(a.x + dx * pa, 9)
      expect(bodies[i]!.y).toBeCloseTo(a.y + dy * pa, 9)
      expect(bodies[i + 1]!.x).toBeCloseTo(b.x - dx * pb, 9)
      expect(bodies[i + 1]!.y).toBeCloseTo(b.y - dy * pb, 9)
      // Each pusher hears the pair once.
      expect(touches.get(`${a.id}>${b.id}`) ?? 0).toBe(a.pushes ? 1 : 0)
      expect(touches.get(`${b.id}>${a.id}`) ?? 0).toBe(b.pushes ? 1 : 0)
    }
  })

  it('pushes a small body off a much bigger one, whichever comes first', () => {
    const { bodies } = pairs(9, 200, 4, 30)
    const gap = (i: number) => Math.hypot(bodies[i]!.x - bodies[i + 1]!.x, bodies[i]!.y - bodies[i + 1]!.y)
    const before = bodies.map((_, i) => (i % 2 === 0 ? gap(i) : 0))
    separate(bodies, () => true, () => true, () => {})
    for (let i = 0; i < bodies.length; i += 2) expect(gap(i)).toBeGreaterThan(before[i]!)
  })

  it('still separates bodies spread far apart (a team split across the map)', () => {
    const body = (x: number, y: number) => ({ id: 0, x, y, radius: 10, mass: 1, pushes: true })
    const bodies = [body(0, 0), body(5, 0), body(400_000, -300_000), body(400_000, -299_995)]
    separate(bodies, () => true, () => true, () => {})
    expect(bodies[1]!.x - bodies[0]!.x).toBeGreaterThan(5)
    expect(bodies[3]!.y - bodies[2]!.y).toBeGreaterThan(5)
  })

  it('lets a pusher walk through a body that neither pushes nor stands in the way', () => {
    const { bodies } = pairs(5, 200)
    const before = bodies.map((b) => ({ x: b.x, y: b.y }))
    separate(bodies, (b) => b.pushes, () => false, () => {})
    for (let i = 0; i < bodies.length; i += 2) {
      const moved = bodies[i]!.x !== before[i]!.x || bodies[i + 1]!.x !== before[i + 1]!.x
      expect(moved).toBe(bodies[i]!.pushes && bodies[i + 1]!.pushes)
    }
  })
})
