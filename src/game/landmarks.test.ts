import { describe, expect, it } from 'vitest'
import { LANDMARK, LANDMARK_IDS, MAZE, TUNNEL } from '../data/landmarks'
import { TERRAIN } from '../data/terrain'
import { spawnEnemy, updateEnemies } from './enemies'
import { createGame, step } from './game'
import { carveMaze, MAZE_PATTERNS } from './landmarkLayout'
import { holdsCarry, updateAttacks } from './attacks'
import { updateLandmarks, updateTunnel } from './landmarks'
import { spawnAttack } from './spawn'
import { createTerrain, featureAt, type Landmark } from './terrain'
import type { Game } from './types'

const TICK = 1 / 60
const SEED = createTerrain(1234).seed

/** Every landmark in a square of cells around the origin, with its cell. */
const landmarks = (seed: number, span: number) =>
  Array.from({ length: (span * 2 + 1) ** 2 }, (_, i) => {
    const cx = (i % (span * 2 + 1)) - span
    const cy = Math.floor(i / (span * 2 + 1)) - span
    return { cx, cy, lm: featureAt(seed, cx, cy)?.landmark }
  }).filter((c): c is { cx: number; cy: number; lm: Landmark } => c.lm !== undefined)

const first = (g: Game, id: Landmark['id']) => landmarks(g.terrain.seed, 14).find(({ lm }) => lm.id === id)!.lm

/** Cells of a maze reachable from its way in (the middle of its south side). */
const reachable = (walls: ReturnType<typeof carveMaze>, n = MAZE.size) => {
  const mid = Math.floor(n / 2)
  const seen = new Set([`${mid},${n - 1}`])
  const todo: [number, number][] = [[mid, n - 1]]
  while (todo.length > 0) {
    const [c, r] = todo.pop()!
    const moves: [number, number, boolean][] = [
      [c, r - 1, !walls.h[r]![c]],
      [c, r + 1, r + 1 < n && !walls.h[r + 1]![c]],
      [c - 1, r, !walls.v[r]![c]],
      [c + 1, r, !walls.v[r]![c + 1]],
    ]
    for (const [x, y, open] of moves) {
      if (!open || x < 0 || y < 0 || x >= n || y >= n || seen.has(`${x},${y}`)) continue
      seen.add(`${x},${y}`)
      todo.push([x, y])
    }
  }
  return seen
}

describe('landmark layouts', () => {
  it('carves perfect mazes: every corridor reachable from the way in, the outer hedge closed but for it', () => {
    for (const walls of MAZE_PATTERNS) {
      expect(reachable(walls).size).toBe(MAZE.size * MAZE.size)
      const mid = Math.floor(MAZE.size / 2)
      expect(walls.h[MAZE.size]!.map((w, c) => w || c === mid)).toEqual(Array(MAZE.size).fill(true))
      expect(walls.h[MAZE.size]![mid]).toBe(false)
      expect(walls.h[0]!.every(Boolean)).toBe(true)
      expect(walls.v.every((row) => row[0] && row[MAZE.size])).toBe(true)
    }
    expect(carveMaze(5)).toEqual(carveMaze(5))
    expect(new Set(MAZE_PATTERNS.map((w) => JSON.stringify(w))).size).toBe(MAZE.patterns)
  })

  it('places at most one landmark per block, every kind of them, the same from the same seed', () => {
    const all = landmarks(SEED, 30)
    const blocks = all.map(({ cx, cy }) => `${Math.floor(cx / LANDMARK.block)},${Math.floor(cy / LANDMARK.block)}`)
    expect(new Set(blocks).size).toBe(blocks.length)
    expect(new Set(all.map(({ lm }) => lm.id))).toEqual(new Set(LANDMARK_IDS))
    expect(landmarks(SEED, 6)).toEqual(landmarks(SEED, 6))
    // About `odds` of the blocks hold one.
    expect(all.length / (61 / LANDMARK.block) ** 2).toBeGreaterThan(LANDMARK.odds - 0.15)
  })

  it('keeps landmarks inside their cells, clear of the edges', () => {
    const C = TERRAIN.cell
    for (const { cx, cy } of landmarks(SEED, 20)) {
      for (const e of featureAt(SEED, cx, cy)!.solids.flatMap((s) => s.foot)) {
        expect(e.x - e.rx).toBeGreaterThanOrEqual(cx * C + TERRAIN.margin - 1)
        expect(e.x + e.rx).toBeLessThanOrEqual((cx + 1) * C - TERRAIN.margin + 1)
        expect(e.y - e.ry).toBeGreaterThanOrEqual(cy * C + TERRAIN.margin - 1)
        expect(e.y + e.ry).toBeLessThanOrEqual((cy + 1) * C - TERRAIN.margin + 1)
      }
    }
  })
})

describe('landmarks at play', () => {
  it('opens a treasure after standing at it a moment, once, even after the map rebuilds its cell', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lm = first(g, 'cottage')
    Object.assign(g.player, lm.treasure!)
    const coins = () => g.pickups.filter((k) => k.kind === 'coin').length
    for (let t = 0; t < LANDMARK.openTime - 0.1; t += TICK) updateLandmarks(g, TICK)
    expect(coins()).toBe(0)
    for (let t = 0; t < 0.2; t += TICK) updateLandmarks(g, TICK)
    expect(coins()).toBeGreaterThan(0)
    expect(g.landmarks.looted.has(lm.cell)).toBe(true)
    expect(g.events.filter((e) => e.kind === 'landmark').map((e) => e.kind === 'landmark' && e.moment)).toEqual(['spot', 'loot'])
    g.pickups.length = 0
    g.terrain.cells.clear()
    for (let t = 0; t < 2; t += TICK) updateLandmarks(g, TICK)
    expect(coins()).toBe(0)
    expect(g.landmarks.opened).toBe(1)
  })

  it('holds a lunge at a cottage\'s and a camp\'s shut treasure, not once it was taken (holdsCarry)', () => {
    const g = createGame('quaxly', { w: 480, h: 270 }, 1234)
    for (const id of ['cottage', 'camp'] as const) {
      const lm = first(g, id)
      const chest = lm.treasure!
      const at = (dx: number) => ({ x: chest.x + dx, y: chest.y, radius: g.player.radius })
      const near = LANDMARK.treasureRadius + g.player.radius * 0.5
      expect(holdsCarry(g, at(near - 2))).toBe(true)
      expect(holdsCarry(g, at(near + 2))).toBe(false)
      g.landmarks.looted.add(lm.cell)
      expect(holdsCarry(g, at(0))).toBe(false)
    }
  })

  it('ends a lunge (Aqua Step, Flame Charge) as it reaches a camp\'s treasure instead of carrying the player past it', () => {
    const g = createGame('quaxly', { w: 480, h: 270 }, 1234)
    const chest = first(g, 'camp').treasure!
    const p = g.player
    const near = LANDMARK.treasureRadius + p.radius * 0.5
    Object.assign(p, { x: chest.x - near - 6, y: chest.y })
    spawnAttack(g, {
      move: 'aquaStep', type: 'water', visual: 'aquaStep', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 14 }, motion: { kind: 'lunge', vx: 400, vy: 0, left: 0.3 },
      damage: 0, ttl: 0.4, activeUntil: 0.3,
    })
    for (let t = 0; t < 0.4; t += TICK) updateAttacks(g, TICK)
    // Without the hold it would carry the player 120 px, well past the chest.
    expect(Math.abs(p.x - chest.x)).toBeLessThan(near)
  })

  it('takes the player through a tunnel to the far mouth, out of the horde’s sight, and not straight back', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lm = first(g, 'tunnel')
    const [west, east] = lm.mouths
    Object.assign(g.player, west)
    const foe = spawnEnemy(g, 'rattata', west!.x, west!.y + 60)
    for (let t = 0; t < TUNNEL.enterTime + 0.05; t += TICK) updateLandmarks(g, TICK)
    expect(g.player.landmark.transit).not.toBeNull()
    // Underground, the horde loses track: the foe doesn't head straight up at the mouth.
    const before = foe.y
    updateEnemies(g, 0.25)
    expect(before - foe.y).toBeLessThan(foe.speed * 0.25 * 0.8)
    while (updateTunnel(g, TICK)) if (!g.player.landmark.transit) break
    expect(g.player.x).toBe(east!.x)
    expect(g.player.y).toBe(east!.y + TUNNEL.exitStep)
    // Standing in the mouth it came out of doesn't send it back until it steps out.
    Object.assign(g.player, east)
    for (let t = 0; t < 1; t += TICK) updateLandmarks(g, TICK)
    expect(g.player.landmark.transit).toBeNull()
    g.player.y += 40
    updateLandmarks(g, TICK)
    Object.assign(g.player, east)
    for (let t = 0; t < TUNNEL.enterTime + 0.05; t += TICK) updateLandmarks(g, TICK)
    expect(g.player.landmark.transit?.x1).toBe(west!.x)
  })

  it('keeps the player off the rock while walking the tunnel in the full step', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    Object.assign(g, { phase: 'playing' })
    Object.assign(g.player, { phase: 'playing', pendingLevelUps: 0, offers: [] })
    const lm = first(g, 'tunnel')
    Object.assign(g.player, lm.mouths[0])
    let t = 0
    while (t < TUNNEL.enterTime + TUNNEL.travel + 0.3) {
      step(g, { move: { x: 0, y: 0 }, special: false }, TICK)
      t += TICK
    }
    expect(g.player.x).toBeCloseTo(lm.mouths[1]!.x, 0)
  })
})
