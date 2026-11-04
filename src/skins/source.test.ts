import { describe, expect, it } from 'vitest'
import { bakeVariant, newColors, sheetGrids, textFromGrid, type SheetGrids } from './source'

const sheet = (c: ReturnType<typeof newColors>): SheetGrids => {
  // One 3×1 frame per row: green, green, black.
  const rgba = new Uint8Array(3 * 8 * 4)
  for (let row = 0; row < 8; row++) {
    for (let x = 0; x < 3; x++) rgba.set(x < 2 ? [0, 200, 0, 255] : [0, 0, 0, 255], (row * 3 + x) * 4)
  }
  return sheetGrids(rgba, 3, 3, 1, 1, c)
}

describe('bakeVariant recolor', () => {
  it('swaps colors on every frame without keyframes, and fixes still go over it', () => {
    const c = newColors()
    const s = sheet(c)
    const palette = { g: '00c800', k: '000000', p: 'ff80a0', w: 'ffffff' }
    const baked = bakeVariant({ Walk: s, Idle: s, Hurt: s }, { palette, recolor: { g: 'p' }, keys: [], fixes: [{ anim: 'Idle', row: 2, frame: 0, grid: ['-w-'] }] }, c)
    expect(textFromGrid(baked.Walk[5]![0]!.grid, palette, c)).toEqual(['ppk'])
    expect(textFromGrid(baked.Idle[2]![0]!.grid, palette, c)).toEqual(['pwk'])
  })
})
