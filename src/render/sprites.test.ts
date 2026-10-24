import { afterEach, describe, expect, it, vi } from 'vitest'
import { detail } from './quality'
import { drawPokemon, overlayStats, OVERLAY_PAGES, type SpeciesSprites } from './sprites'

// Canvases are plain sized objects here: the test is about where silhouettes go, not their pixels.
vi.mock('../engine/pixelart', () => {
  const ctx = { drawImage: () => {}, clearRect: () => {}, fillRect: () => {}, globalAlpha: 1, globalCompositeOperation: '', fillStyle: '' }
  const canvas = (width: number, height: number) => ({ width, height })
  return { createCanvas: canvas, context2d: () => ctx, fromStrings: () => canvas(1, 1), onCanvasReset: () => {}, drawable: () => true }
})

const ctx = { drawImage: () => {}, globalAlpha: 1 } as unknown as CanvasRenderingContext2D

/** A one-frame species of `size`×`size` frames. */
const species = (size: number): SpeciesSprites => {
  const sheet = { img: { width: size, height: size * 8 } as HTMLCanvasElement, fw: size, fh: size, durations: [1], totalTicks: 1, seen: 0, overlays: null }
  return { dex: size, anims: { Walk: sheet, Idle: sheet, Hurt: sheet }, portrait: '', cry: '', footY: 0, bodyW: size, bodyH: size }
}

/** Draws `s` tinted in `n` colors never used before, a new silhouette each. */
let colors = 0
const tintAll = (s: SpeciesSprites, n: number) => {
  for (let i = 0; i < n; i++) drawPokemon(ctx, s, 'Walk', 0, 0, 0, 0, { tint: { color: `#c${colors++}`, amount: 1 } })
}

afterEach(() => {
  detail.safe = false
  vi.useRealTimers()
})

describe('silhouette pages', () => {
  it('packs a new silhouette when safe mode turns on with more pages held than its cap', () => {
    vi.useFakeTimers()
    // 255 px frames fill a 512 px page with four: no shelf or page has room left once all are made.
    tintAll(species(255), OVERLAY_PAGES * 4)
    vi.runAllTimers()
    expect(overlayStats().pages).toBe(OVERLAY_PAGES)
    detail.safe = true
    // Shorter frames fit no shelf there and no evicted spot: only freeing whole pages makes room.
    tintAll(species(100), 3)
    expect(() => vi.runAllTimers()).not.toThrow()
    // Safe mode keeps half the pages.
    expect(overlayStats().pages).toBeLessThanOrEqual(OVERLAY_PAGES / 2)
  })
})
