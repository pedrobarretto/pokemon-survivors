import { describe, expect, it } from 'vitest'
import { TERRAIN } from '../data/terrain'
import { spawnEnemy } from './enemies'
import { createGame } from './game'
import { createTerrain, featureAt, footOf, groundAt, inSolid, nearestOpen, PLAYER_FOOT, pushOut, updateTerrain, type Solid } from './terrain'
import { ARENA_FEET } from '../data/arenas'
import { DOMAINS } from '../data/domains'
import { LANDMARK, LANDMARK_IDS } from '../data/landmarks'
import type { Ellipse } from '../data/terrain'
import { fits } from './arenaFloor'
import { LANDMARK_VARIANTS, landmarkPlan } from './landmarkLayout'
import * as dm from '../engine/dmath'

const SEED = createTerrain(1234).seed

/** Every feature in a square of cells around the origin. */
const sweep = (seed: number, span = 12) =>
  Array.from({ length: (span * 2 + 1) ** 2 }, (_, i) => {
    const cx = (i % (span * 2 + 1)) - span
    const cy = Math.floor(i / (span * 2 + 1)) - span
    return { cx, cy, f: featureAt(seed, cx, cy) }
  })

/** The first solid of a kind on the map. */
const findSolid = (seed: number, kind: Solid['kind']) => sweep(seed).flatMap(({ f }) => f?.solids ?? []).find((s) => s.kind === kind)!

describe('terrain layout', () => {
  it('builds the same map from the same seed, a different one from another, and keeps the start open', () => {
    expect(sweep(SEED)).toEqual(sweep(SEED))
    expect(sweep(SEED)).not.toEqual(sweep(createTerrain(99).seed))
    for (const { f } of sweep(SEED)) {
      for (const e of [...(f?.solids.flatMap((s) => s.foot) ?? []), ...(f?.lake?.foot ?? [])]) {
        expect(Math.hypot(e.x, e.y) - Math.max(e.rx, e.ry)).toBeGreaterThan(TERRAIN.clearStart - TERRAIN.cell)
      }
    }
  })

  it('keeps every footprint inside its cell, clear of the edges, so neighbors never close a passage', () => {
    const C = TERRAIN.cell
    const m = TERRAIN.margin - 1
    for (const { cx, cy, f } of sweep(SEED)) {
      for (const e of [...(f?.solids.flatMap((s) => s.foot) ?? []), ...(f?.lake?.foot ?? [])]) {
        expect(e.x - e.rx).toBeGreaterThanOrEqual(cx * C + m)
        expect(e.x + e.rx).toBeLessThanOrEqual((cx + 1) * C - m)
        expect(e.y - e.ry).toBeGreaterThanOrEqual(cy * C + m)
        expect(e.y + e.ry).toBeLessThanOrEqual((cy + 1) * C - m)
      }
    }
  })

  it('puts every kind of feature on the map', () => {
    const kinds = new Set(sweep(SEED).flatMap(({ f }) => (f?.landmark ? [] : [...(f?.solids.map((s) => s.kind) ?? []), ...(f?.lake ? ['lake'] : [])])))
    expect([...kinds].sort()).toEqual(['bush', 'cliff', 'lake', 'log', 'rock', 'tower', 'tree'])
  })
})

describe('terrain collision', () => {
  it('pushes a circle out of an ellipse to its grown edge and leaves one outside alone', () => {
    const e = { x: 0, y: 0, rx: 20, ry: 10 }
    const o = { x: 5, y: 0 }
    expect(pushOut(o, 4, e)).toBe(true)
    expect(o).toEqual({ x: 24, y: 0 })
    const far = { x: 0, y: 30 }
    expect(pushOut(far, 4, e)).toBe(false)
    expect(far).toEqual({ x: 0, y: 30 })
  })

  it('keeps the player and walkers out of solids, while flyers and bosses go over them', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const rock = findSolid(g.terrain.seed, 'cliff')
    const walker = spawnEnemy(g, 'rattata', rock.x, rock.y)
    const flyer = spawnEnemy(g, 'pidgey', rock.x + 4, rock.y)
    g.player.x = rock.x - 6
    g.player.y = rock.y
    updateTerrain(g, 1 / 60)
    expect(inSolid(g, g.player.x, g.player.y, g.player.radius - 0.5)).toBe(false)
    expect(inSolid(g, walker.x, walker.y, walker.radius * 0.8 - 0.5)).toBe(false)
    expect(flyer.x).toBe(rock.x + 4)
  })

  it('makes lakes water, and ice in the snow', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lake = sweep(g.terrain.seed).find(({ f }) => f?.lake)!.f!.lake!
    expect(groundAt(g, lake.x, lake.y)).toBe('water')
    g.biome.id = 'snow'
    expect(groundAt(g, lake.x, lake.y)).toBe('ice')
    expect(groundAt(g, lake.x, lake.y - 200)).toBe('land')
  })
})

/** Spots on a `step` px grid over a box reachable from `from` through spots where `free` holds (4-connected). */
const flood = (box: { x0: number; y0: number; x1: number; y1: number }, step: number, from: readonly [number, number], free: (x: number, y: number) => boolean) => {
  const w = Math.floor((box.x1 - box.x0) / step) + 1
  const h = Math.floor((box.y1 - box.y0) / step) + 1
  const seen = new Uint8Array(w * h)
  const start = Math.round((from[1] - box.y0) / step) * w + Math.round((from[0] - box.x0) / step)
  const todo = [start]
  seen[start] = 1
  while (todo.length > 0) {
    const k = todo.pop()!
    const i = k % w
    const j = (k - i) / w
    for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]] as const) {
      if (a < 0 || b < 0 || a >= w || b >= h || seen[b * w + a] || !free(box.x0 + a * step, box.y0 + b * step)) continue
      seen[b * w + a] = 1
      todo.push(b * w + a)
    }
  }
  return (x: number, y: number) => seen[Math.round((y - box.y0) / step) * w + Math.round((x - box.x0) / step)] === 1
}

const clear = (feet: readonly Ellipse[], x: number, y: number, r: number) => feet.every((e) => dm.sq((x - e.x) / (e.rx + r)) + dm.sq((y - e.y) / (e.ry + r)) >= 1)

describe('the player’s foot', () => {
  it('walks to every landmark’s treasure (a maze’s corridors, the cottage’s door) at the widest foot', () => {
    for (const id of LANDMARK_IDS) {
      for (let variant = 0; variant < LANDMARK_VARIANTS[id]; variant++) {
        const plan = landmarkPlan(id, variant)
        if (!plan.treasure) continue
        const feet = plan.pieces.flatMap((p) => p.foot)
        const box = {
          x0: Math.min(...feet.map((e) => e.x - e.rx)) - 30,
          y0: Math.min(...feet.map((e) => e.y - e.ry)) - 30,
          x1: Math.max(...feet.map((e) => e.x + e.rx)) + 30,
          y1: Math.max(...feet.map((e) => e.y + e.ry)) + 30,
        }
        const reached = flood(box, 1, [box.x0, box.y0], (x, y) => clear(feet, x, y, PLAYER_FOOT))
        const { x, y } = plan.treasure
        const near = Math.floor(LANDMARK.treasureRadius + PLAYER_FOOT * 0.5)
        let opens = false
        for (let sy = y - near; sy <= y + near && !opens; sy++) for (let sx = x - near; sx <= x + near; sx++) opens ||= dm.sq(sx - x) + dm.sq(sy - y) < near * near && reached(sx, sy)
        expect(opens, `${id} ${variant}`).toBe(true)
      }
    }
  })

  it('crosses every domain from its start to its gate at the widest foot', () => {
    for (const [legend, def] of Object.entries(DOMAINS)) {
      const { floor, holes = [], solids, start, gate } = def.crossing
      const feet = solids.map((s) => ({ ...ARENA_FEET[s.piece], x: s.x + ARENA_FEET[s.piece].x, y: s.y + ARENA_FEET[s.piece].y }))
      const box = { x0: -320, y0: gate - 20, x1: 320, y1: start[1] + 40 }
      const free = (x: number, y: number) =>
        floor.some((s) => fits(s, x, y, PLAYER_FOOT)) && holes.every((h) => dm.sq(x - h.x) + dm.sq(y - h.y) >= dm.sq(h.r + PLAYER_FOOT)) && clear(feet, x, y, PLAYER_FOOT)
      const reached = flood(box, 2, start, free)
      let through = false
      for (let y = box.y0; y < gate && !through; y += 2) for (let x = box.x0; x <= box.x1; x += 2) through ||= reached(x, y)
      expect(through, legend).toBe(true)
    }
  })

  it('caps the foot, not the hitbox, and finds the nearest open spot for one wedged in', () => {
    expect(footOf({ radius: 13 })).toBe(PLAYER_FOOT)
    expect(footOf({ radius: 6 })).toBe(6)
    const spot = nearestOpen(0, 0, (x) => x >= 9)!
    expect(spot.x).toBeGreaterThanOrEqual(9)
    expect(dm.hypot(spot.x, spot.y)).toBeLessThanOrEqual(10)
    expect(nearestOpen(0, 0, () => false)).toBeNull()
  })
})
