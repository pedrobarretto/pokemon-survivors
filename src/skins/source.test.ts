import { describe, expect, it } from 'vitest'
import { emptyGrid } from './propagate'
import { bakeVariant, newColors, sheetGrids, shinyFrame, textFromGrid, type SheetGrids } from './source'

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

describe('shinyFrame', () => {
  it('gives the shiny color where the skin kept the sprite, and keeps what the skin drew', () => {
    const grid = (...px: number[]) => ({ ...emptyGrid(px.length, 1), px: Int32Array.from(px) })
    // Sprite 1 1 0, shiny 2 2 0, skin: first pixel kept, second drawn as 5, a pixel drawn outside.
    expect([...shinyFrame(grid(1, 1, 0), grid(2, 2, 0), grid(1, 5, 7)).px]).toEqual([2, 5, 7])
  })
})
