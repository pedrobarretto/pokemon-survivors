import { describe, expect, it } from 'vitest'
import { emptyGrid, mirrorGrid, pickKey, propagate, type Grid } from './propagate'

/** A grid from rows of digits (0 clear). */
const grid = (rows: string[]): Grid => {
  const g = emptyGrid(rows[0]!.length, rows.length)
  rows.forEach((r, y) => [...r].forEach((c, x) => (g.px[y * g.w + x] = Number(c))))
  return g
}
const rows = (g: Grid) => Array.from({ length: g.h }, (_, y) => Array.from(g.px.slice(y * g.w, y * g.w + g.w)).join(''))

const K = grid(['000000000', '011111100', '012222100', '012332100', '012222100', '011111100', '000000000', '000000000'])
// The artist turns the 3s into 4s (a buckle on a belly).
const E = grid(['000000000', '011111100', '012222100', '012442100', '012222100', '011111100', '000000000', '000000000'])

describe('propagate', () => {
  it('carries an edit along with the body when the frame moves', () => {
    const T = grid(['000000000', '000000000', '001111110', '001222210', '001233210', '001222210', '001111110', '000000000'])
    expect(rows(propagate(T, { K, E }).out)[4]).toBe('001244210')
  })

  it('keeps a pixel that is a different part now', () => {
    // The 3s are gone in this pose: nothing to dress.
    const T = grid(['000000000', '011111100', '012222100', '012222100', '012222100', '011111100', '000000000', '000000000'])
    expect(rows(propagate(T, { K, E }).out)).toEqual(rows(T))
  })

  it('moves what was drawn outside the silhouette with it', () => {
    const tail = grid(['000000000', '011111150', '012222100', '012332100', '012222100', '011111100', '000000000', '000000000'])
    const T = grid(['000000000', '000000000', '011111100', '012222100', '012332100', '012222100', '011111100', '000000000'])
    expect(rows(propagate(T, { K, E: tail }).out)[2]).toBe('011111150')
  })
})

describe('pickKey', () => {
  it('prefers the keyframe whose pose lies closest', () => {
    const other = grid(['111111111', '100000001', '100000001', '100000001', '100000001', '100000001', '100000001', '111111111'])
    const keys = [
      { K: other, E: other, mirrored: false },
      { K, E, mirrored: false },
    ]
    expect(pickKey(K, keys)?.key).toBe(keys[1])
  })

  it('lets a direction borrow the mirror across', () => {
    const keys = [{ K: mirrorGrid(K), E: mirrorGrid(E), mirrored: true }]
    expect(pickKey(mirrorGrid(K), keys)?.key).toBe(keys[0])
  })
})
