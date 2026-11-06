import { describe, expect, it } from 'vitest'
import { FURNITURE, footprint, turnOf } from '../data/furniture'
import { BASE_GRID } from '../data/realmMap'
import { BASE_ROOM } from '../data/realmMap'
import { DOOR, EMPTY_BASE, checkLayout, type BaseLayout, type Placed } from '../data/secretBases'
import { baseSolids } from '../render/base'
import { blocked } from './interp'
import { clampSpot, dollLegend, drawOrder, firstSpot, nearestReachable, onSale, reachableTiles, trayCounts } from './placement'

const at = (id: Placed['id'], x: number, y: number, turned = false): Placed => ({ id, x, y, turned })
const room = (items: Placed[]): BaseLayout => ({ ...EMPTY_BASE, items })

describe('trayCounts', () => {
  it('leaves what is owned but not placed', () => {
    const left = trayCounts({ woodChair: 3, candle: 1, aquarium: 0 }, room([at('woodChair', 2, 3), at('candle', 2, 3)]))
    expect([...left]).toEqual([['woodChair', 2]])
  })
})

describe('clampSpot', () => {
  it('keeps wall pieces on the wall and the rest on the floor, inside the grid', () => {
    expect(clampSpot('regionMap', false, 20, 6)).toEqual({ x: BASE_GRID.cols - 2, y: BASE_GRID.wallRows - 1 })
    expect(clampSpot('woodChair', false, -3, 0)).toEqual({ x: 0, y: BASE_GRID.wallRows })
    expect(clampSpot('pikachuBed', false, 0, 99)).toEqual({ x: 0, y: BASE_GRID.rows - 3 })
    expect(clampSpot('pikachuBed', true, 99, 99)).toEqual({ x: BASE_GRID.cols - 3, y: BASE_GRID.rows - 2 })
  })
})

describe('firstSpot', () => {
  it('finds a spot the layout check takes', () => {
    const owned = { woodChair: 1, pikachuBed: 1 }
    const layout = room([at('pikachuBed', 5, 3)])
    const chair = firstSpot(layout, owned, 'woodChair')
    expect(checkLayout({ ...layout, items: [...layout.items, chair] }, owned)).toBeNull()
  })

  it('sets what sits on a table on one', () => {
    const owned = { woodTable: 1, candle: 1 }
    const layout = room([at('woodTable', 1, 4)])
    const candle = firstSpot(layout, owned, 'candle')
    expect(candle.y).toBe(4)
    expect([1, 2]).toContain(candle.x)
  })

  it('falls back to the middle when nothing fits (the editor marks it)', () => {
    const candle = firstSpot(EMPTY_BASE, { candle: 1 }, 'candle')
    expect(checkLayout(room([candle]), { candle: 1 })).toEqual({ error: 'support', item: 0 })
  })
})

describe('drawOrder', () => {
  it('draws rugs first, then the wall, then by bottom row with tops after their table', () => {
    const items = [at('woodChair', 0, 6), at('candle', 4, 4), at('aquarium', 3, 4), at('pokeBallRug', 0, 4), at('regionMap', 0, 0), at('pottedPlant', 8, 2)]
    expect(drawOrder(items)).toEqual([3, 4, 5, 2, 1, 0])
  })
})

describe('onSale', () => {
  it('sells only priced pieces, never a doll', () => {
    const sold = onSale('2026-11-04')
    expect(sold.length).toBeGreaterThan(0)
    expect(sold.every((id) => FURNITURE[id].price !== null && dollLegend(id) === null)).toBe(true)
    expect(dollLegend('doll:kyogre')).toBe('kyogre')
  })
})

describe('a trainer in a base', () => {
  const T = BASE_GRID.tile
  const tile = (x: number, y: number) => y * BASE_GRID.cols + x

  it('lands clear of pieces standing beside the door', () => {
    const layout = room([at('pottedPlant', DOOR.x - 1, DOOR.y), at('pottedPlant', DOOR.x - 1, DOOR.y - 1), at('pottedPlant', DOOR.x + 1, DOOR.y), at('pottedPlant', DOOR.x + 1, DOOR.y - 1)])
    expect(checkLayout(layout, { pottedPlant: 4 })).toBeNull()
    expect(blocked({ w: BASE_ROOM.w, h: BASE_ROOM.h, solid: baseSolids(layout) }, BASE_ROOM.spawn.x, BASE_ROOM.spawn.y)).toBe(false)
  })

  it('walks through a piece a layout left on the doorway, so the door never shuts', () => {
    const layout = room([at('pottedPlant', DOOR.x, DOOR.y)])
    expect(reachableTiles(layout).has(tile(DOOR.x, DOOR.y))).toBe(true)
    expect(blocked({ w: BASE_ROOM.w, h: BASE_ROOM.h, solid: baseSolids(layout) }, BASE_ROOM.spawn.x, BASE_ROOM.spawn.y)).toBe(false)
  })

  it('reaches only the floor joined to the door', () => {
    // A wall of bookshelves across row 4 cuts the room's top off.
    const shelves = Array.from({ length: BASE_GRID.cols / 2 }, (_, i) => at('bookshelf', i * 2, 4))
    const reach = reachableTiles(room(shelves))
    expect(reach.has(tile(0, 3))).toBe(false)
    expect(reach.has(tile(0, 5))).toBe(true)
    expect(reach.has(tile(0, 4))).toBe(false)
  })

  it('sets a trainer standing in a piece down on the nearest tile it can walk to the door from', () => {
    const shelves = Array.from({ length: BASE_GRID.cols / 2 }, (_, i) => at('bookshelf', i * 2, 4))
    // Inside the shelf at (2, 4): above it is closer, but cut off, so it lands below.
    expect(nearestReachable(room(shelves), 2.5 * T, 4.4 * T)).toEqual({ x: 2.5 * T, y: 5.5 * T })
  })
})

describe('turnOf', () => {
  it('turns art seen from above a quarter, mirrors 3/4 art in place, and leaves out what a turn would not change', () => {
    expect([turnOf('pikachuBed'), turnOf('pokeBallRug'), turnOf('centerSofa'), turnOf('doll:kyogre')]).toEqual(['quarter', 'quarter', 'mirror', 'mirror'])
    expect([turnOf('fireRedCover'), turnOf('roundRug'), turnOf('plankFloor')]).toEqual([null, null, null])
    expect([footprint('pikachuBed', true), footprint('centerSofa', true)]).toEqual([[3, 2], [2, 1]])
  })
})
