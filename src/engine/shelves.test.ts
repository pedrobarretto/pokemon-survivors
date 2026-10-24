import { describe, expect, it } from 'vitest'
import { clearShelves, place, shelves } from './shelves'

describe('place', () => {
  it('fills a shelf left to right with a pixel between sprites, then opens one below', () => {
    const page = shelves(16)
    expect(place(page, 7, 4)).toEqual({ x: 0, y: 0 })
    expect(place(page, 7, 4)).toEqual({ x: 8, y: 0 })
    // No room left on the first shelf: a new one starts under it, past the gap.
    expect(place(page, 7, 4)).toEqual({ x: 0, y: 5 })
  })

  it('puts a sprite on a slightly taller shelf, but opens a new one for a much shorter or taller sprite', () => {
    const page = shelves(64)
    place(page, 10, 8)
    expect(place(page, 10, 7)).toEqual({ x: 11, y: 0 })
    expect(place(page, 10, 2)).toEqual({ x: 0, y: 9 })
    expect(place(page, 10, 12)).toEqual({ x: 0, y: 12 })
  })

  it('says no when the page is full or the sprite is bigger than it', () => {
    const page = shelves(8)
    expect(place(page, 9, 1)).toBeNull()
    expect(place(page, 8, 8)).toEqual({ x: 0, y: 0 })
    expect(place(page, 1, 1)).toBeNull()
    clearShelves(page)
    expect(place(page, 1, 1)).toEqual({ x: 0, y: 0 })
  })
})
