import { describe, expect, it } from 'vitest'
import { areaAt, AREAS, areaStart, BIOME_LENGTH, ENDLESS_LEG, FORK, forkOptions, plannedRoute, ROUTE } from '../data/biomes'
import { RUN_LENGTH, stageStart } from '../data/waves'
import { createGame } from './game'
import { rerouteRoster, updateRoute } from './route'
import type { Game } from './types'

const SEEDS = Array.from({ length: 64 }, (_, i) => i * 7919 + 1)

const game = (seed = 1234) => createGame('charmander', { w: 480, h: 270 }, seed)

/** Ticks the route alone until `time`, the way the step would. */
const runTo = (g: Game, time: number, dt = 0.1) => {
  while (g.time < time) {
    g.time = Math.min(time, g.time + dt)
    updateRoute(g, dt)
  }
}

describe('route areas', () => {
  it('splits the run into five equal areas, then turns a leg every five minutes in the endless mode', () => {
    expect(Array.from({ length: AREAS }, (_, k) => areaStart(k))).toEqual([0, 180, 360, 540, 720])
    expect(areaAt(BIOME_LENGTH - 0.01, false)).toBe(0)
    expect(areaAt(RUN_LENGTH * 2, false)).toBe(AREAS - 1)
    expect(areaStart(AREAS)).toBe(RUN_LENGTH + ENDLESS_LEG)
    expect(areaAt(RUN_LENGTH + ENDLESS_LEG - 0.01, true)).toBe(AREAS - 1)
    expect(areaAt(RUN_LENGTH + ENDLESS_LEG * 2.5, true)).toBe(AREAS + 1)
  })
})

describe('forkOptions', () => {
  it('offers each tier of the route graph, in an order (and so a default) drawn from the seed', () => {
    ROUTE.tiers.forEach((tier, i) => {
      const firsts = new Set(SEEDS.map((seed) => forkOptions(seed, i + 1, 'meadow')[0]))
      expect(firsts).toEqual(new Set(tier))
      for (const seed of SEEDS) expect([...forkOptions(seed, i + 1, 'meadow')].sort()).toEqual([...tier].sort())
    })
    expect(forkOptions(42, 2, 'forest')).toEqual(forkOptions(42, 2, 'beach'))
  })

  it('offers two other biomes in the endless mode, never the one the run is in', () => {
    for (const seed of SEEDS) {
      const [a, b] = forkOptions(seed, AREAS + 2, 'volcano')
      expect(a).not.toBe(b)
      expect([a, b]).not.toContain('volcano')
    }
  })

  it('plans the defaults after what was decided', () => {
    for (const seed of SEEDS.slice(0, 8)) {
      const planned = plannedRoute(seed)
      expect(planned).toHaveLength(AREAS)
      expect(planned[0]).toBe(ROUTE.start)
      expect(plannedRoute(seed, ['meadow', 'beach']).slice(2)).toEqual(planned.slice(2))
    }
  })
})

describe('updateRoute', () => {
  it('puts the gates up before the area, and takes the default when nobody picks', () => {
    const g = game()
    runTo(g, areaStart(1) - FORK.lead - 0.5)
    expect(g.route.fork).toBeNull()
    runTo(g, areaStart(1) - FORK.lead + 0.5)
    const fork = g.route.fork!
    expect(fork.area).toBe(1)
    expect(fork.gates.map((gate) => gate.biome)).toEqual([...forkOptions(1234, 1, 'meadow')])
    // The player stays away from both gates.
    g.player.x = fork.gates[0]!.x + 300
    runTo(g, areaStart(1) - FORK.close + 0.1)
    expect(g.route.path).toEqual(['meadow', fork.gates[0]!.biome])
    expect(fork.chosen).toBe(0)
    expect(fork.by).toBe(-1)
  })

  it('takes the gate a player stands in for the charge time', () => {
    const g = game()
    runTo(g, areaStart(1) - FORK.lead + 0.1)
    const gate = g.route.fork!.gates[1]!
    g.player.x = gate.x
    g.player.y = gate.y
    runTo(g, g.time + FORK.charge - 0.2)
    expect(g.route.path).toHaveLength(1)
    runTo(g, g.time + 0.3)
    expect(g.route.path[1]).toBe(gate.biome)
    expect(g.route.fork!.by).toBe(g.player.slot)
    expect(g.events).toContainEqual({ kind: 'route', biome: gate.biome, area: 1, by: 0 })
  })

  it('catches up when the clock jumps, deciding every fork it skipped by its default', () => {
    const g = game(77)
    g.time = areaStart(3) + 1
    updateRoute(g, 0.1)
    expect(g.route.path).toEqual(plannedRoute(77).slice(0, 4))
  })
})

describe('rerouteRoster', () => {
  it('draws the stages of the areas ahead again and keeps the ones under way, the bosses and the trio', () => {
    const g = game(4321)
    const before = g.roster
    g.route.path.push(forkOptions(4321, 1, 'meadow')[1])
    const after = rerouteRoster(g, 1)
    before.stages.forEach((pool, i) => {
      if (stageStart(i) < areaStart(1)) expect(after.stages[i]).toBe(pool)
    })
    expect(after.trio).toBe(before.trio)
    expect(after.stages.some((pool, i) => pool !== before.stages[i])).toBe(true)
  })
})
