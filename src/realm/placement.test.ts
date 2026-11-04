import { describe, expect, it } from 'vitest'
import { FURNITURE } from '../data/furniture'
import { BASE_GRID } from '../data/realmMap'
import { EMPTY_BASE, checkLayout, type BaseLayout, type Placed } from '../data/secretBases'
import { clampSpot, dollLegend, drawOrder, firstSpot, onSale, trayCounts } from './placement'

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
