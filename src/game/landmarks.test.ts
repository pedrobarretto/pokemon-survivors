import { describe, expect, it } from 'vitest'
import { ENEMIES } from '../data/enemies'
import { LANDMARK, LANDMARK_IDS, LANDMARK_LOOT, MAZE, TUNNEL } from '../data/landmarks'
import { TERRAIN } from '../data/terrain'
import { spawnEnemy, updateEnemies } from './enemies'
import { createGame, step } from './game'
import { carveMaze, MAZE_PATTERNS } from './landmarkLayout'
import { mewUnder, openTimeOf, updateLandmarks, updateTunnel, wokenHp } from './landmarks'
import { createTerrain, featureAt, inSolid, type Landmark } from './terrain'
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
      const f = featureAt(SEED, cx, cy)!
      for (const e of [...f.solids.flatMap((s) => s.foot), ...(f.lake?.foot ?? [])]) {
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

describe("the games' nods", () => {
  /** The first landmark of a kind found in a wide square around the origin. */
  const find = (g: Game, id: Landmark['id']) => landmarks(g.terrain.seed, 40).find(({ lm }) => lm.id === id)!.lm
  const stand = (g: Game, at: { x: number; y: number }, seconds: number) => {
    Object.assign(g.player, at)
    for (let t = 0; t < seconds; t += TICK) updateLandmarks(g, TICK)
  }
  const moments = (g: Game) => g.events.flatMap((e) => (e.kind === 'landmark' ? [e.moment] : []))

  it('wakes the Snorlax across the path: it fights as an Alpha with a share of the boss’s HP, and the way stays open', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lm = find(g, 'snorlax')
    const belly = { x: lm.treasure!.x, y: lm.treasure!.y + 16 }
    expect(inSolid(g, lm.x, lm.y, 4)).toBe(true)
    stand(g, belly, openTimeOf('snorlax') - 0.2)
    expect(g.enemies.some((e) => e.kind === 'snorlax')).toBe(false)
    stand(g, belly, 0.3)
    const snorlax = g.enemies.find((e) => e.kind === 'snorlax')!
    expect(snorlax.alpha).not.toBeNull()
    expect(snorlax.maxHp).toBe(Math.round(ENEMIES.snorlax.hp * wokenHp(g.time)))
    expect(moments(g)).toEqual(['spot', 'wake'])
    expect(inSolid(g, lm.x, lm.y, 4)).toBe(false)
    g.terrain.cells.clear()
    expect(inSolid(g, lm.x, lm.y, 4)).toBe(false)
    expect(wokenHp(0)).toBeLessThan(wokenHp(600))
  })

  it('heals at the Pokémon Center, once', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lm = find(g, 'center')
    g.player.hp = 10
    stand(g, lm.treasure!, openTimeOf('center') + 0.05)
    expect(g.player.hp).toBe(g.player.stats.maxHp)
    g.player.hp = 10
    stand(g, lm.treasure!, 3)
    expect(g.player.hp).toBe(10)
  })

  it('keeps the truck’s rumor: Mew under about one truck in twenty, the same truck always telling the same story', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lm = find(g, 'truck')
    const trucks = Array.from({ length: 4000 }, (_, i) => mewUnder(g, { ...lm, cell: i }))
    const share = trucks.filter(Boolean).length / trucks.length
    expect(share).toBeGreaterThan(LANDMARK_LOOT.truck.rumor * 0.7)
    expect(share).toBeLessThan(LANDMARK_LOOT.truck.rumor * 1.3)
    expect(mewUnder(g, lm)).toBe(mewUnder(g, { ...lm }))
  })

  it('turns up Mew (and a Rare Candy) under the truck that hides it, and nothing under the others', () => {
    /** A run (by seed) whose nearest truck does or doesn't hide Mew. */
    const runWith = (mew: boolean) => {
      for (let seed = 1; seed < 400; seed++) {
        const g = createGame('charmander', { w: 480, h: 270 }, seed)
        const lm = landmarks(g.terrain.seed, 14).find((c) => c.lm.id === 'truck')?.lm
        if (lm && mewUnder(g, lm) === mew) return { g, lm }
      }
      throw new Error('no such truck')
    }
    for (const mew of [true, false]) {
      const { g, lm } = runWith(mew)
      stand(g, { x: lm.treasure!.x, y: lm.treasure!.y + 16 }, openTimeOf('truck') + 0.05)
      expect(moments(g)).toEqual(['spot', mew ? 'mew' : 'loot'])
      expect(g.landmarks.mew.has(lm.cell)).toBe(mew)
      expect(g.pickups.filter((k) => k.kind === 'consumable' && k.item === 'rareCandy').length).toBe(mew ? 1 : 0)
    }
  })

  it('has MissingNo. give its item twice', () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 1234)
    const lm = find(g, 'glitch')
    stand(g, lm.treasure!, openTimeOf('glitch') + 0.05)
    const items = g.pickups.flatMap((k) => (k.kind === 'consumable' ? [k.item] : []))
    expect(items.length).toBe(2)
    expect(items[0]).toBe(items[1])
  })
})
