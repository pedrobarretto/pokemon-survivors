import { afterEach, describe, expect, it, vi } from 'vitest'
import { artImages, canvasCache, canvasLosses, canvasRestored, canvasWatch, drawThrew, fillPlotted, heldCanvases, lazy, onCanvasReset, plot, resetCanvases, sweepArt, weighCanvases, type Probe, type RectSink } from './pixelart'

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

  it('drops the caches once for a burst of canvases restored by the same reset', async () => {
    let drops = 0
    onCanvasReset(() => drops++)
    canvasRestored()
    canvasRestored()
    canvasRestored()
    expect(drops).toBe(0)
    await Promise.resolve()
    expect(drops).toBe(1)
  })
})

/** A stand-in for the watched canvas: keeps its one pixel's alpha, which `wipe` clears as iOS does. */
const pixel = () => {
  const data = [0, 0, 0, 0]
  const probe: Probe = { fillStyle: '', fillRect: () => (data[3] = 255), getImageData: () => ({ data }) }
  return { probe, wipe: () => (data[3] = 0) }
}

describe('canvasWatch', () => {
  it('drops the caches when the browser wipes the canvases without a word, on a new probe', async () => {
    const made: ReturnType<typeof pixel>[] = []
    const check = canvasWatch(() => made[made.push(pixel()) - 1]!.probe)
    let drops = 0
    onCanvasReset(() => drops++)
    const wiped = canvasLosses.wiped

    expect(check()).toBe(false)
    expect(check()).toBe(false)
    made[0]!.wipe()
    expect(check()).toBe(true)
    await Promise.resolve()
    expect(drops).toBe(1)
    expect(canvasLosses.wiped).toBe(wiped + 1)
    expect(made).toHaveLength(2)
    // The new probe is painted: no more drops until it's wiped too.
    expect(check()).toBe(false)
  })

  it('takes a probe WebKit refuses to read (InvalidStateError) as lost, once in a row', () => {
    const unreadable: Probe = {
      fillStyle: '',
      fillRect: () => {},
      getImageData: () => {
        throw new DOMException('The object is in an invalid state.', 'InvalidStateError')
      },
    }
    const check = canvasWatch(() => unreadable)
    const wiped = canvasLosses.wiped

    expect(check()).toBe(false)
    expect(check()).toBe(true)
    // Still unreadable on the new probe: a page past its memory budget, not another wipe.
    expect(check()).toBe(false)
    expect(check()).toBe(false)
    expect(canvasLosses.wiped).toBe(wiped + 1)
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

describe('plot', () => {
  /** A context that writes down the path calls it gets. */
  const recorder = () => {
    const calls: string[] = []
    const sink: RectSink = {
      set fillStyle(c: string) {
        calls.push(`style ${c}`)
      },
      get fillStyle() {
        return ''
      },
      beginPath: () => calls.push('begin'),
      rect: (x: number, y: number, w: number, h: number) => calls.push(`rect ${x},${y},${w},${h}`),
      fill: () => calls.push('fill'),
    }
    return { calls, sink }
  }

  it('fills each color as one path, in the order the colors were first plotted', () => {
    const { calls, sink } = recorder()
    plot('#dark', 1.4, 2.6, 3, 3)
    plot('#core', 2, 3)
    plot('#dark', 5, 5)
    fillPlotted(sink)
    expect(calls).toEqual(['style #dark', 'begin', 'rect 1,3,3,3', 'rect 5,5,1,1', 'fill', 'style #core', 'begin', 'rect 2,3,1,1', 'fill'])
    calls.length = 0
    fillPlotted(sink)
    expect(calls).toEqual([])
  })

  it('keeps every rect of a color past its first buffer', () => {
    const { calls, sink } = recorder()
    for (let i = 0; i < 500; i++) plot('#ring', i, 0)
    fillPlotted(sink)
    expect(calls.filter((c) => c.startsWith('rect'))).toHaveLength(500)
    expect(calls.at(-2)).toBe('rect 499,0,1,1')
  })
})

describe('drawThrew', () => {
  /** A context down to what a throw leaves behind: its transform and the `save` stack over it. */
  const fakeContext = () => {
    let x = 0
    const saved: number[] = []
    return {
      globalAlpha: 1,
      globalCompositeOperation: 'source-over' as GlobalCompositeOperation,
      save: () => void saved.push(x),
      translate: (dx: number) => void (x += dx),
      restore: () => void (x = saved.pop() ?? x),
      setTransform: () => void (x = 0),
      offset: () => x,
      depth: () => saved.length,
    }
  }

  it('leaves nothing of the failed frame on the context, however deep it threw', () => {
    const ctx = fakeContext()
    ctx.save()
    ctx.translate(-320)
    ctx.save()
    ctx.translate(40)
    ctx.globalAlpha = 0.3
    ctx.globalCompositeOperation = 'lighter'

    drawThrew(ctx, new Error('nested throw'), () => {})

    expect(ctx.offset()).toBe(0)
    expect(ctx.depth()).toBe(0)
    expect(ctx.globalAlpha).toBe(1)
    expect(ctx.globalCompositeOperation).toBe('source-over')
  })

  it('reports an error repeated every frame once', () => {
    const report = vi.fn()
    for (let i = 0; i < 3; i++) drawThrew(fakeContext(), new Error('every frame'), report)
    drawThrew(fakeContext(), new Error('another one'), report)
    expect(report).toHaveBeenCalledTimes(2)
  })
})

describe('artImages', () => {
  /** Images made so far: each ends loaded with nothing to draw, as a failed download does. */
  let made: { src: string; complete: boolean; naturalWidth: number; naturalHeight: number }[] = []
  let clock = 0

  const failing = () => {
    made = []
    clock = 0
    vi.spyOn(performance, 'now').mockImplementation(() => clock)
    vi.stubGlobal(
      'Image',
      vi.fn(function fake() {
        const img = { src: '', complete: true, naturalWidth: 0, naturalHeight: 0 }
        made.push(img)
        return img
      }),
    )
    return artImages((file: string) => `/art/${file}.png`)
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('fetches a failed picture again past the HTTP cache, and only once its wait is over', () => {
    const art = failing()
    expect(art.copy('tree')).toBeNull()
    expect(art.copy('tree')).toBeNull()
    expect(made.map((m) => m.src)).toEqual(['/art/tree.png'])

    clock = 3_000
    expect(art.copy('tree')).toBeNull()
    expect(made.map((m) => m.src)).toEqual(['/art/tree.png', '/art/tree.png?retry=1'])
  })

  it('gives up after its last try, for the stand-in to stay', () => {
    const art = failing()
    for (const wait of [0, 3_000, 15_000, 60_000, 600_000]) {
      clock += wait
      art.copy('tree')
    }
    expect(made).toHaveLength(4)
  })

  it('starts over once a picture is forgotten', () => {
    const art = failing()
    art.copy('tree')
    art.forget('tree')
    art.copy('tree')
    expect(made.map((m) => m.src)).toEqual(['/art/tree.png', '/art/tree.png'])
  })
})
