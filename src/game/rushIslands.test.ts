import { describe, expect, it } from 'vitest'
import { fits } from './arenaFloor'
import { RUSH, RUSH_ORDER } from '../data/rush'
import { ISLAND_CLEAR, ISLAND_IDS, ISLAND_START, ISLANDS, islandFoot, type IslandId } from '../data/rushIslands'
import { createGame } from './game'
import { islandOf, startRush } from './rush'
import { inSolid, PLAYER_FOOT, standingSpot } from './terrain'

/** A grid of spots STEP px apart over an island; a spot is open when a player's foot fits on the floor, clear of every footprint. */
const STEP = 2
const SPAN = 200
const N = (SPAN * 2) / STEP

const openGrid = (id: IslandId) => {
  const { floor, solids } = ISLANDS[id]
  const feet = solids.map((s) => {
    const f = islandFoot(s.piece)
    return { x: s.x + f.x, y: s.y + f.y, rx: f.rx, ry: f.ry }
  })
  const r = PLAYER_FOOT
  const open = new Uint8Array(N * N)
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x = -SPAN + i * STEP
      const y = -SPAN + j * STEP
      const onFloor = floor.some((s) => fits(s, x, y, r))
      const blocked = feet.some((e) => (x - e.x) ** 2 / (e.rx + r) ** 2 + (y - e.y) ** 2 / (e.ry + r) ** 2 < 1)
      open[j * N + i] = onFloor && !blocked ? 1 : 0
    }
  }
  return open
}

const cellOf = (x: number, y: number) => Math.round((y + SPAN) / STEP) * N + Math.round((x + SPAN) / STEP)

/** Every open spot reached from `from`, four ways. */
const flood = (open: Uint8Array, from: number) => {
  const seen = new Uint8Array(N * N)
  const queue = [from]
  seen[from] = 1
  while (queue.length) {
    const c = queue.pop()!
    const i = c % N
    for (const n of [c - N, c + N, i > 0 ? c - 1 : -1, i < N - 1 ? c + 1 : -1]) {
      if (n < 0 || n >= N * N || seen[n] || !open[n]) continue
      seen[n] = 1
      queue.push(n)
    }
  }
  return seen
}

describe("Hoopa's islands", () => {
  for (const id of ISLAND_IDS) {
    it(`keeps the ${id} island's middle and gate clear, and every piece on its floor`, () => {
      const { floor, solids } = ISLANDS[id]
      for (const s of solids) {
        const f = islandFoot(s.piece)
        const x = s.x + f.x
        const y = s.y + f.y
        const reach = Math.max(f.rx, f.ry) + PLAYER_FOOT
        expect(Math.hypot(x, y) - reach, `${s.piece} at ${s.x},${s.y}`).toBeGreaterThanOrEqual(ISLAND_CLEAR.middle)
        expect(Math.hypot(x, y + RUSH.enter) - reach, `${s.piece} at ${s.x},${s.y}`).toBeGreaterThanOrEqual(ISLAND_CLEAR.gate)
        expect(floor.some((c) => fits(c, x, y, Math.max(f.rx, f.ry))), `${s.piece} at ${s.x},${s.y}`).toBe(true)
      }
    })

    it(`lets a player walk from the start and from the gate to every open spot of the ${id} island`, () => {
      const open = openGrid(id)
      const start = cellOf(0, ISLAND_START)
      const gate = cellOf(0, -RUSH.enter)
      expect(open[start]).toBe(1)
      expect(open[gate]).toBe(1)
      const total = open.reduce((n, v) => n + v, 0)
      for (const from of [start, gate]) expect(flood(open, from).reduce((n, v) => n + v, 0)).toBe(total)
    })
  }

  it("takes each ring's island from its legend's type, never the same twice in a row, and Hoopa's last", () => {
    expect(islandOf(['moltres', 'hoopa'], 0)).toBe('caldera')
    expect(islandOf(['moltres', 'hoopa'], 1)).toBe('hoopa')
    // Articuno is Ice and Flying: the floe; Zapdos is Electric: the crag.
    expect(islandOf(['articuno', 'zapdos', 'hoopa'], 0)).toBe('floe')
    expect(islandOf(['articuno', 'zapdos', 'hoopa'], 1)).toBe('crag')
    // The lake trio are all Psychic: the second takes the next island round instead.
    const lake = ['uxie', 'mesprit', 'azelf', 'hoopa'] as const
    expect(lake.map((_, i) => islandOf(lake, i))).toEqual(['shrine', 'atoll', 'shrine', 'hoopa'])
    const all = [...RUSH_ORDER, 'hoopa' as const]
    const islands = all.map((_, i) => islandOf(all, i))
    for (let i = 1; i < islands.length; i++) expect(islands[i]).not.toBe(islands[i - 1])
    expect(new Set(islands).size).toBe(ISLAND_IDS.length)
  })

  it("moves a blast's shelters onto open ground: off the scenery, back from the rim", () => {
    const g = createGame('charmander', { w: 480, h: 270 }, 3)
    startRush(g, 'normal', ['entei', 'hoopa'], null)
    const r = g.rush!
    expect(r.island).toBe('caldera')
    const piece = ISLANDS.caldera.solids[0]!
    for (const [x, y] of [[piece.x, piece.y - 2], [0, -200], [190, 40], [0, 0]] as const) {
      const spot = standingSpot(g, { x: r.home.x + x, y: r.home.y + y })
      const lx = spot.x - r.home.x
      const ly = spot.y - r.home.y
      expect(ISLANDS.caldera.floor.some((c) => fits(c, lx, ly, PLAYER_FOOT))).toBe(true)
      expect(inSolid(g, spot.x, spot.y, PLAYER_FOOT)).toBe(false)
    }
  })
})
