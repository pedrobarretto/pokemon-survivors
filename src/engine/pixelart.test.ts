import { describe, expect, it } from 'vitest'
import { canvasCache, heldCanvases, lazy, resetCanvases, sweepArt, weighCanvases } from './pixelart'

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

describe('sweepArt', () => {
  it('lets go of lazy art not asked for in the last sweeps, and keeps what is in use', () => {
    let idleBuilds = 0
    let busyBuilds = 0
    const idle = lazy(() => ++idleBuilds)
    const busy = lazy(() => ++busyBuilds)
    idle()
    busy()
    sweepArt(3)
    sweepArt(3)
    // Asked for within the last 3 sweeps: still there.
    expect(idle()).toBe(1)
    for (let i = 0; i < 4; i++) {
      busy()
      sweepArt(3)
    }
    expect(idle()).toBe(2)
    expect(busy()).toBe(1)
  })
})

/** A stand-in canvas: `weighCanvases` knows one by its size and `getContext`. */
const canvas = (width: number, height: number) => ({ width, height, getContext: () => null })

describe('weighCanvases', () => {
  it('counts each canvas once, through Maps, arrays, plain objects and 2D contexts', () => {
    const a = canvas(10, 10)
    const b = canvas(4, 2)
    const ctx = { canvas: b, drawImage: () => {} }
    const nested = new Map([['x', new Map([['y', [a, { sprite: a }]]])]])
    expect(weighCanvases([nested, ctx, [b], a])).toEqual({ canvases: 2, bytes: 10 * 10 * 4 + 4 * 2 * 4 })
  })

  it('skips canvases freed to 0×0, images and cycles', () => {
    const loop: { self?: unknown; art: unknown } = { art: canvas(2, 2) }
    loop.self = loop
    const image = { width: 64, height: 64, naturalWidth: 64 }
    expect(weighCanvases([loop, canvas(0, 0), image, null, 3])).toEqual({ canvases: 1, bytes: 16 })
  })
})

describe('heldCanvases', () => {
  it('weighs what the caches hold now, not what they once made', () => {
    const before = heldCanvases()
    const cache = canvasCache<string, ReturnType<typeof canvas>>()
    cache.set('chunk', canvas(8, 8))
    expect(heldCanvases()).toEqual({ canvases: before.canvases + 1, bytes: before.bytes + 256 })
    cache.clear()
    expect(heldCanvases()).toEqual(before)
  })
})
