import { describe, expect, it } from 'vitest'
import { SAFARI_HABITAT_IDS } from '../../data/safari'
import { MAP_H, MAP_W, PLAZA, SAFARI_MAPS, TILE } from '../../data/safariMaps'
import { behindPlaza, buildWorld, tallTileAt, walkable, type SafariWorld } from './safariWorld'

const STEP = 6

/** Every spot a walker can reach from the spawn, on a grid of `STEP` px. */
const flood = (w: SafariWorld) => {
  const key = (x: number, y: number) => y * 10000 + x
  const start = { x: Math.round((PLAZA.spawn.x * TILE) / STEP) * STEP, y: Math.round((PLAZA.spawn.y * TILE) / STEP) * STEP }
  const seen = new Set([key(start.x, start.y)])
  const open = [start]
  while (open.length > 0) {
    const { x, y } = open.pop()!
    for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]] as const) {
      const nx = x + dx
      const ny = y + dy
      if (seen.has(key(nx, ny)) || !walkable(w, nx, ny)) continue
      seen.add(key(nx, ny))
      open.push({ x: nx, y: ny })
    }
  }
  return seen
}

describe.each(SAFARI_HABITAT_IDS)('the %s preserve', (habitat) => {
  const world = buildWorld(SAFARI_MAPS[habitat])

  it('lets a walker stand at the spawn', () => {
    expect(walkable(world, PLAZA.spawn.x * TILE, PLAZA.spawn.y * TILE)).toBe(true)
  })

  it('walks in along open ground and stops in front of the arch, clear of its threshold', () => {
    const x = PLAZA.entry.x * TILE
    for (let y = PLAZA.spawn.y * TILE; y >= PLAZA.entry.y * TILE; y -= 2) expect(walkable(world, x, y)).toBe(true)
    // The arch's art ends 4 px below its anchor.
    expect(PLAZA.entry.y * TILE).toBeGreaterThan(PLAZA.gate.y * TILE + 4)
    expect(behindPlaza(x, PLAZA.entry.y * TILE)).toBe(false)
  })

  it('reaches both sides of the arch', () => {
    const seen = [...flood(world)].map((k) => ({ x: k % 10000, y: Math.floor(k / 10000) }))
    const inArch = seen.filter((p) => Math.abs(p.x - PLAZA.gate.x * TILE) < PLAZA.gate.posts * TILE)
    expect(inArch.some((p) => p.y < (PLAZA.gate.y - 3) * TILE)).toBe(true)
    expect(inArch.some((p) => p.y > (PLAZA.gate.y + 3) * TILE)).toBe(true)
  })

  it('has plenty of tall grass, nearly all of it reachable', () => {
    expect(world.tallList.length).toBeGreaterThan(90)
    const seen = flood(world)
    const reachedTiles = new Set<number>()
    for (const k of seen) {
      const x = k % 10000
      const y = (k - x) / 10000
      const tile = tallTileAt(world, x, y)
      if (tile >= 0) reachedTiles.add(tile)
    }
    expect(reachedTiles.size / world.tallList.length).toBeGreaterThan(0.9)
  })

  it('stays inside the map', () => {
    expect(walkable(world, 0, 0)).toBe(false)
    expect(walkable(world, MAP_W * TILE, MAP_H * TILE)).toBe(false)
  })
})
