import { describe, expect, it } from 'vitest'
import { MAP_ARCHETYPE_IDS, MAP_ARCHETYPES, type MapArchetypeId } from '../data/mapArchetypes'
import { TERRAIN, type Ellipse } from '../data/terrain'
import { createGame } from './game'
import { archetypeOf, clearSpot, createTerrain, crossings, featureAt, groundPace, isOpen, PLAYER_FOOT, runArchetype, slidesOnIce, type Feature } from './terrain'
import { hash2 } from '../engine/rng'

const C = TERRAIN.cell
const SEEDS = [createTerrain(1234).seed, createTerrain(77).seed]

/** Cells from -SPAN to SPAN - 1 on each axis: the start and a few screens around it. */
const SPAN = 4

const solidFeet = (f: Feature | null): readonly Ellipse[] => f?.solids.flatMap((s) => s.foot) ?? []

describe('map archetypes', () => {
  it('draws every archetype from some seed, and the same one from the same seed', () => {
    const drawn = new Set(Array.from({ length: 400 }, (_, i) => archetypeOf(createTerrain(i).seed)))
    expect([...drawn].sort()).toEqual([...MAP_ARCHETYPE_IDS].sort())
    expect(runArchetype(1234)).toBe(createTerrain(1234).archetype)
  })

  it('only weighs features each archetype can draw, and brings its own shapes', () => {
    const sweep = (archetype: MapArchetypeId) =>
      Array.from({ length: 24 * 24 }, (_, i) => featureAt(SEEDS[0]!, (i % 24) - 12, Math.floor(i / 24) - 12, archetype)).filter((f) => f && !f.landmark)
    const columns = sweep('ruins').flatMap((f) => f!.solids).filter((s) => s.kind === 'column' || s.kind === 'menhir')
    expect(columns.length).toBeGreaterThan(20)
    expect(sweep('route').some((f) => f!.solids.some((s) => s.kind === 'column'))).toBe(false)
    const water = (archetype: MapArchetypeId) => sweep(archetype).filter((f) => f!.lake).length
    expect(water('archipelago')).toBeGreaterThan(water('route') * 3)
    const trees = (archetype: MapArchetypeId) => sweep(archetype).flatMap((f) => f!.solids).filter((s) => s.kind === 'tree').length
    expect(trees('forest')).toBeGreaterThan(trees('plains') * 4)
  })

  for (const archetype of MAP_ARCHETYPE_IDS) {
    it(`keeps every ${archetype} cell's footprints off its edges and the start open`, () => {
      for (const seed of SEEDS) {
        for (let cy = -12; cy < 12; cy++) {
          for (let cx = -12; cx < 12; cx++) {
            const f = featureAt(seed, cx, cy, archetype)
            for (const e of [...solidFeet(f), ...(f?.lake?.foot ?? [])]) {
              expect(e.x - e.rx).toBeGreaterThanOrEqual(cx * C + TERRAIN.margin - 1)
              expect(e.x + e.rx).toBeLessThanOrEqual((cx + 1) * C - TERRAIN.margin + 1)
              expect(e.y - e.ry).toBeGreaterThanOrEqual(cy * C + TERRAIN.margin - 1)
              expect(e.y + e.ry).toBeLessThanOrEqual((cy + 1) * C - TERRAIN.margin + 1)
              expect(Math.hypot(e.x, e.y) - Math.max(e.rx, e.ry)).toBeGreaterThan(TERRAIN.clearStart - C)
            }
          }
        }
      }
    })

    it(`lets a player walk from the start to every open spot of a ${archetype} map`, () => {
      // A grid of spots STEP px apart; a spot is open when a player's foot fits there.
      // Footprints stay inside their cell's margins, so only a spot's own cell can block it.
      const STEP = 4
      const N = (SPAN * 2 * C) / STEP
      const origin = -SPAN * C
      for (const seed of SEEDS) {
        const feet = new Map<number, readonly Ellipse[]>()
        const footAt = (cx: number, cy: number) => {
          const key = (cx + SPAN) * 64 + cy + SPAN
          let list = feet.get(key)
          if (!list) feet.set(key, (list = solidFeet(featureAt(seed, cx, cy, archetype))))
          return list
        }
        const open = new Uint8Array(N * N)
        for (let j = 0; j < N; j++) {
          for (let i = 0; i < N; i++) {
            const x = origin + i * STEP + STEP / 2
            const y = origin + j * STEP + STEP / 2
            const r = PLAYER_FOOT
            const blocked = footAt(Math.floor(x / C), Math.floor(y / C)).some((e) => (x - e.x) ** 2 / (e.rx + r) ** 2 + (y - e.y) ** 2 / (e.ry + r) ** 2 < 1)
            open[j * N + i] = blocked ? 0 : 1
          }
        }
        // Flood from the start, four ways.
        const seen = new Uint8Array(N * N)
        const start = (N / 2) * N + N / 2
        expect(open[start]).toBe(1)
        const queue = [start]
        seen[start] = 1
        while (queue.length > 0) {
          const k = queue.pop()!
          const i = k % N
          const j = (k - i) / N
          for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
            const ni = i + di
            const nj = j + dj
            if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue
            const n = nj * N + ni
            if (seen[n] || !open[n]) continue
            seen[n] = 1
            queue.push(n)
          }
        }
        let stranded = 0
        let total = 0
        for (let k = 0; k < N * N; k++) {
          if (!open[k]) continue
          total++
          if (!seen[k]) stranded++
        }
        // Slivers between overlapping pieces may be cut off; anything bigger than a few spots would be a pocket.
        expect(stranded / total).toBeLessThan(0.0002)
      }
    })
  }

  it('finds open ground for map events and portals on every archetype, even in a bay or a thicket', () => {
    for (const archetype of MAP_ARCHETYPE_IDS) {
      const g = createGame('charmander', { w: 480, h: 270 }, 99)
      g.terrain.archetype = archetype
      g.terrain.cells.clear()
      for (let i = 0; i < 300; i++) {
        const spot = clearSpot(g, { x: (hash2(i, 1, 5) - 0.5) * 20000, y: (hash2(i, 2, 5) - 0.5) * 20000 }, 40)
        expect(isOpen(g, spot.x, spot.y, 40)).toBe(true)
      }
    }
  })

  it('says what each archetype is good for with types that have a way across', () => {
    const crossingTypes = new Set(['water', 'flying', 'ice', 'ghost'])
    for (const id of MAP_ARCHETYPE_IDS) for (const type of MAP_ARCHETYPES[id].goodFor) expect(crossingTypes.has(type)).toBe(true)
  })
})

describe('traversal by type', () => {
  it('lets Water surf, Flying hover and Ice skate, and slows and slides everyone else', () => {
    const squirtle = createGame('squirtle', { w: 480, h: 270 }, 1)
    expect(groundPace(squirtle, 'water')).toBe(TERRAIN.surfPace)
    expect(crossings(squirtle)).toEqual(['surf'])
    const charmander = createGame('charmander', { w: 480, h: 270 }, 1)
    expect(groundPace(charmander, 'water')).toBe(TERRAIN.waterPace)
    expect(groundPace(charmander, 'land')).toBe(1)
    expect(slidesOnIce(charmander)).toBe(true)
    expect(crossings(charmander)).toEqual([])
    const rowlet = createGame('rowlet', { w: 480, h: 270 }, 1)
    expect(groundPace(rowlet, 'water')).toBe(1)
    expect(slidesOnIce(rowlet)).toBe(false)
    expect(crossings(rowlet)).toEqual(['hover'])
  })
})
