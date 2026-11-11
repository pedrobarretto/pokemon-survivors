import { describe, expect, it } from 'vitest'
import { stepGrid, stepSections } from './gridNav'

describe('stepGrid', () => {
  it('walks the reading order with ← →, stopping at the ends', () => {
    expect(stepGrid(8, 'right', 9, 27)).toBe(9)
    expect(stepGrid(9, 'left', 9, 27)).toBe(8)
    expect(stepGrid(0, 'left', 9, 27)).toBe(0)
    expect(stepGrid(26, 'right', 9, 27)).toBe(26)
  })

  it('moves a row with ↑ ↓ and leaves through the top and bottom rows', () => {
    expect(stepGrid(4, 'down', 9, 27)).toBe(13)
    expect(stepGrid(13, 'up', 9, 27)).toBe(4)
    expect(stepGrid(4, 'up', 9, 27)).toBe('above')
    expect(stepGrid(22, 'down', 9, 27)).toBe('below')
  })

  it('lands on the last cell of a short last row', () => {
    // 52 cells, 10 wide: the last row holds 50 and 51.
    expect(stepGrid(47, 'down', 10, 52)).toBe(51)
    expect(stepGrid(51, 'down', 10, 52)).toBe('below')
  })
})

describe('stepSections', () => {
  // 7 cells, then 5, then 2, 4 wide: rows [0-3][4-6] | [7-10][11] | [12-13].
  const sizes = [7, 5, 2]

  it('walks straight through the sections with ← →', () => {
    expect(stepSections(6, 'right', 4, sizes)).toBe(7)
    expect(stepSections(7, 'left', 4, sizes)).toBe(6)
  })

  it('crosses a header with ↑ ↓ in the same column', () => {
    expect(stepSections(5, 'down', 4, sizes)).toBe(8)
    expect(stepSections(8, 'up', 4, sizes)).toBe(5)
    expect(stepSections(11, 'down', 4, sizes)).toBe(12)
  })

  it('lands on the last cell of a short row and leaves through the ends', () => {
    expect(stepSections(10, 'up', 4, sizes)).toBe(6)
    expect(stepSections(10, 'down', 4, sizes)).toBe(11)
    expect(stepSections(9, 'down', 4, [7, 5, 2])).toBe(11)
    expect(stepSections(2, 'up', 4, sizes)).toBe('above')
    expect(stepSections(13, 'down', 4, sizes)).toBe('below')
  })
})
