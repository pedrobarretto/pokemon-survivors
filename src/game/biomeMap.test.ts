import { describe, expect, it } from 'vitest'
import { BIOME_IDS, BIOME_MAP, BIOME_TIERS, START_BIOME, type BiomeId } from '../data/biomes'
import { biomeAt, sampleBiome } from './biomeMap'
import { updateBiomes } from './biomes'
import { createGame } from './game'

const SEEDS = [1, 7, 42, 1234, 99991]
const TAU = Math.PI * 2

/** Biomes at `n` spots around a circle of radius `r`. */
const ring = (seed: number, r: number, n = 48) => Array.from({ length: n }, (_, k) => biomeAt(seed, Math.cos((k / n) * TAU) * r, Math.sin((k / n) * TAU) * r))

const tierOf = (b: BiomeId) => BIOME_TIERS.findIndex((t) => (t as readonly BiomeId[]).includes(b))

describe('the biome map', () => {
  it('is a pure function of the seed and the spot', () => {
    for (const seed of SEEDS) expect(ring(seed, 2500)).toEqual(ring(seed, 2500))
    expect(SEEDS.map((s) => ring(s, 4000).join()).length).toBe(new Set(SEEDS.map((s) => ring(s, 4000).join())).size)
  })

  it('always starts in the meadow, with room around the start', () => {
    for (let seed = 1; seed <= 200; seed++) {
      expect(biomeAt(seed, 0, 0)).toBe(START_BIOME)
      for (const b of ring(seed, 240, 16)) expect(b).toBe(START_BIOME)
    }
  })

  it('tiers the biomes by distance from the start', () => {
    const share = (r: number, tier: number) => {
      const all = SEEDS.flatMap((s) => ring(s, r))
      return all.filter((b) => tierOf(b) === tier).length / all.length
    }
    expect(share(900, 0)).toBeGreaterThan(0.9)
    expect(share(3400, 1)).toBeGreaterThan(0.5)
    expect(share(5800, 2)).toBeGreaterThan(0.7)
    // Past the last ring every tier mixes (the meadow stays home's).
    const far = SEEDS.flatMap((s) => ring(s, 12000, 96))
    expect(new Set(far.map(tierOf))).toEqual(new Set([0, 1, 2]))
    expect(far).not.toContain(START_BIOME)
  })

  it('shows every biome on a run-sized map', () => {
    for (const seed of SEEDS) {
      const seen = new Set<BiomeId>()
      for (let y = -8000; y <= 8000; y += 400) for (let x = -8000; x <= 8000; x += 400) seen.add(biomeAt(seed, x, y))
      expect([...seen].sort()).toEqual([...BIOME_IDS].sort())
    }
  })

  it('makes regions several screens across', () => {
    // Walking straight out, a biome holds for a good stretch before the next.
    for (const seed of SEEDS) {
      let runs = 0
      let last: BiomeId | null = null
      for (let x = 0; x <= 8000; x += 8) {
        const b = biomeAt(seed, x, 300)
        if (b !== last) runs++
        last = b
      }
      expect(8000 / runs).toBeGreaterThan(480 * 1.2)
    }
  })

  it('measures the border: the biome only changes where both sides sit on the line', () => {
    for (const seed of SEEDS) {
      let prev = sampleBiome(seed, 0, 777, { a: START_BIOME, b: START_BIOME, t: Infinity })
      for (let x = 2; x <= 6000; x += 2) {
        const s = sampleBiome(seed, x, 777, { a: START_BIOME, b: START_BIOME, t: Infinity })
        if (s.a !== prev.a) {
          expect(s.t).toBeLessThan(6)
          expect(prev.t).toBeLessThan(6)
          expect(prev.b).toBe(s.a)
        }
        if (s.t < BIOME_MAP.blend) expect(s.b).not.toBe(s.a)
        // No seams: inside a region, the way to its border shrinks or grows smoothly.
        if (s.a === prev.a && s.b === prev.b && s.t < 400) expect(Math.abs(s.t - prev.t)).toBeLessThan(6)
        prev = s
      }
    }
  })
})

describe('updateBiomes', () => {
  it('enters a biome a few steps past its border, once, with the player as the actor', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 5)
    const p = g.player
    expect(p.biome).toBe(START_BIOME)
    const changes: BiomeId[] = []
    for (let x = 0; x <= 6000; x += 4) {
      p.x = x
      updateBiomes(g)
      for (const e of g.events.splice(0)) if (e.kind === 'biome') changes.push(e.biome)
      const s = sampleBiome(g.terrain.seed, x, p.y)
      if (s.t >= BIOME_MAP.enter) expect(p.biome).toBe(s.a)
    }
    expect(changes.length).toBeGreaterThan(1)
    // Pacing on the line doesn't flicker: a step back and forth across a border changes nothing.
    const at = changes.length
    let x = 0
    while (sampleBiome(g.terrain.seed, x + 4, p.y).a === sampleBiome(g.terrain.seed, x, p.y).a) x += 4
    for (let k = 0; k < 20; k++) {
      p.x = x + (k % 2) * 4
      updateBiomes(g)
    }
    expect(g.events.filter((e) => e.kind === 'biome').length).toBeLessThanOrEqual(1)
    expect(changes.length).toBe(at)
  })
})
