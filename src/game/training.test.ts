import { describe, expect, it } from 'vitest'
import { TRAINING } from '../data/training'
import { buildOf, parseBuilds, planned, type Build } from './builds'
import { createGame, step } from './game'
import { MAX_MOVES } from './leveling'
import { TICK } from './replay'
import { applyBuild, createMeter, readMeter, sampleMeter, setDummies, setForm, setItem, setMove, startTraining, trainingMoves } from './training'

const STILL = { move: { x: 0, y: 0 }, special: false }

/** Charmander at the Dojo with its starting Ember, one dummy ahead. */
const dojo = (count = 1) => {
  const g = createGame('charmander', { w: 480, h: 270 }, 7)
  startTraining(g, 'wobbuffet', count)
  return g
}

const seconds = (g: ReturnType<typeof dojo>, s: number) => {
  for (let i = 0; i < s / TICK; i++) step(g, STILL, TICK)
}

describe('the Dojo', () => {
  it('lets the moves hit the dummies, which never faint, while the clock, the horde and the levels wait', () => {
    const g = dojo(3)
    setMove(g, 'ember', 8)
    seconds(g, 10)
    expect(g.time).toBe(0)
    expect(g.enemies).toHaveLength(3)
    expect(g.enemies.every((e) => e.hp === TRAINING.hp && e.kind === 'wobbuffet')).toBe(true)
    expect(g.player.damageByMove.ember).toBeGreaterThan(0)
    expect(g.player.level).toBe(1)
    expect(g.phase).toBe('playing')
  })

  it('stands a dummy again at its post when one faints anyway', () => {
    const g = dojo()
    const [post] = g.training!.posts
    g.enemies[0]!.dying = 0
    step(g, STILL, TICK)
    const e = g.enemies.find((x) => x.id === g.training!.posts[0]!.id)!
    expect(e.dying).toBe(-1)
    expect(Math.round(e.x)).toBe(post!.x)
  })

  it('swaps the dummies for another species and count', () => {
    const g = dojo()
    setDummies(g, 'snorlax', 8)
    expect(g.enemies).toHaveLength(8)
    expect(g.enemies.every((e) => e.kind === 'snorlax' && e.boss)).toBe(true)
  })

  it('caps the moves and items at their slots, and swaps a move for its evolution in the same slot', () => {
    const g = dojo()
    const pool = trainingMoves('charmander', null)
    for (const id of pool) setMove(g, id, 1)
    expect(g.player.moves).toHaveLength(MAX_MOVES)
    expect(pool.indexOf('flamethrower')).toBe(pool.indexOf('ember') + 1)
    setMove(g, 'ember', 8)
    expect(setMove(g, 'flamethrower', 1)).toBe(true)
    expect(g.player.moves).toHaveLength(MAX_MOVES)
    expect(g.player.moves.some((m) => m.id === 'ember')).toBe(false)
    expect(setItem(g, 'charcoal', 9)).toBe(true)
    expect(g.player.items).toEqual([{ id: 'charcoal', level: 3 }])
  })

  it('puts a saved build back on: form, moves with their forks, items and ability', () => {
    const g = dojo()
    setForm(g, 2, null)
    setMove(g, 'ember', 7)
    g.player.moves.find((m) => m.id === 'ember')!.path = 0b100100
    setItem(g, 'muscleBand', 5)
    const build = buildOf(g.player)
    const h = dojo()
    applyBuild(h, build)
    expect(buildOf(h.player)).toEqual(build)
    expect(h.player.stats).toEqual(g.player.stats)
  })
})

describe('builds', () => {
  const build: Build = { moves: [{ id: 'fireSpin', level: 7, path: 0b100000 }, { id: 'flamethrower', level: 1, path: 0 }], items: [{ id: 'charcoal', level: 2 }], ability: 'blaze', stage: 2, branch: null }

  it('marks the cards that follow the plan', () => {
    expect(planned(build, { kind: 'move', id: 'fireSpin', level: 3 })).toBe(true)
    expect(planned(build, { kind: 'move', id: 'fireSpin', level: 8 })).toBe(false)
    // The base of a planned evolved move, up to its max level.
    expect(planned(build, { kind: 'move', id: 'ember', level: 8 })).toBe(true)
    expect(planned(build, { kind: 'branch', id: 'fireSpin', level: 7, branch: 1 })).toBe(true)
    expect(planned(build, { kind: 'branch', id: 'fireSpin', level: 7, branch: 0 })).toBe(false)
    expect(planned(build, { kind: 'item', id: 'charcoal', level: 2 })).toBe(true)
    expect(planned(build, { kind: 'item', id: 'charcoal', level: 3 })).toBe(false)
    expect(planned(build, { kind: 'evolution', from: 'ember', to: 'flamethrower' })).toBe(true)
    expect(planned(build, { kind: 'ability', id: 'blaze', hidden: false })).toBe(true)
    expect(planned(undefined, { kind: 'move', id: 'ember', level: 1 })).toBe(false)
  })

  it('parses saved builds, dropping unknown families, moves, items and another family’s branch', () => {
    const parsed = parseBuilds({
      charmander: { ...build, moves: [...build.moves, { id: 'nope', level: 2 }], items: [{ id: 'charcoal', level: 99 }], branch: 'vaporeon' },
      notAPokemon: build,
    })
    expect(Object.keys(parsed)).toEqual(['charmander'])
    expect(parsed.charmander).toEqual({ ...build, items: [{ id: 'charcoal', level: 3 }] })
  })
})

describe('the damage meter', () => {
  it('reads the damage per second over its window, by source, and since it started', () => {
    const m = createMeter(0)
    sampleMeter(m, 0, {})
    sampleMeter(m, 2, { ember: 100, special: 20 })
    sampleMeter(m, 4, { ember: 300, special: 20 })
    const r = readMeter(m)
    expect(r.dps).toBe(80)
    expect(r.total).toBe(320)
    expect(r.average).toBe(80)
    expect(r.bySource).toEqual([{ source: 'ember', dps: 75 }, { source: 'special', dps: 5 }])
  })
})
