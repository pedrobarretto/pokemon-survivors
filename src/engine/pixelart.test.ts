import { describe, expect, it } from 'vitest'
import { canvasCache, lazy, resetCanvases, shelfSpot, shelves } from './pixelart'

describe('resetCanvases', () => {
  it('drops cached art so it is drawn again after a GPU reset', () => {
    let builds = 0
    const art = lazy(() => ++builds)
    const cache = canvasCache<string, number>()
    cache.set('chunk', 1)
    expect(art()).toBe(1)
    expect(art()).toBe(1)

    resetCanvases()

    expect(cache.size).toBe(0)
    expect(art()).toBe(2)
  })
})

describe('shelfSpot', () => {
  it('fills a row left to right with a clear px between sprites', () => {
    const s = shelves(32)
    expect(shelfSpot(s, 5, 7)).toEqual({ x: 0, y: 0 })
    expect(shelfSpot(s, 5, 7)).toEqual({ x: 6, y: 0 })
    // A little shorter shares the row; much shorter opens its own.
    expect(shelfSpot(s, 3, 5)).toEqual({ x: 12, y: 0 })
    expect(shelfSpot(s, 3, 2)).toEqual({ x: 0, y: 8 })
  })

  it('opens a new row when one is full, and says when the page is', () => {
    const s = shelves(16)
    expect(shelfSpot(s, 10, 7)).toEqual({ x: 0, y: 0 })
    expect(shelfSpot(s, 10, 7)).toEqual({ x: 0, y: 8 })
    expect(shelfSpot(s, 10, 7)).toBeNull()
    expect(shelfSpot(s, 17, 1)).toBeNull()
  })
})
