import { afterEach, describe, expect, it, vi } from 'vitest'
import { artImages, canvasCache, canvasLosses, canvasRestored, canvasWatch, drawThrew, dropFightArt, fillPlotted, heldCanvases, lazy, lazySheet, onCanvasReset, plot, remember, resetCanvases, sweepArt, trimCanvases, weighCanvases, type Probe, type RectSink } from './pixelart'

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

describe('remember', () => {
  it('keeps at most `max` values, the least recently asked for going first, freed', () => {
    const cache = new Map<number, ReturnType<typeof canvas>>()
    let made = 0
    const get = (w: number) => remember(cache, w, 3, () => (made++, canvas(w, 2)))
    const first = get(1)
    get(2)
    get(3)
    // A hit makes no canvas and counts as asked for now.
    expect(get(1)).toBe(first)
    expect(made).toBe(3)
    const second = cache.get(2)!
    get(4)
    expect([...cache.keys()]).toEqual([3, 1, 4])
    expect(second).toMatchObject({ width: 0, height: 0 })
    expect(first.width).toBe(1)
  })

  it('caches a null as a value (nothing to draw there)', () => {
    const cache = new Map<string, null>()
    let made = 0
    remember(cache, 'empty', 2, () => (made++, null))
    remember(cache, 'empty', 2, () => (made++, null))
    expect(made).toBe(1)
  })
})

describe('trimCanvases', () => {
  it('lets go of the oldest canvases past a count or a pixel budget, freeing them', () => {
    const cache = new Map([
      ['a', canvas(4, 4)],
      ['b', canvas(4, 4)],
      ['c', canvas(2, 2)],
    ])
    const a = cache.get('a')!
    // 36 px held: within 64 px but past 2 canvases.
    expect(trimCanvases(cache, 36, 64, 2)).toBe(20)
    expect([...cache.keys()]).toEqual(['b', 'c'])
    expect(a.width).toBe(0)
    // Past the pixels: the oldest goes until it fits.
    expect(trimCanvases(cache, 20, 8, 10)).toBe(4)
    expect([...cache.keys()]).toEqual(['c'])
  })
})

describe('dropFightArt', () => {
  it("drops the fights' caches and keeps the others", () => {
    const fight = canvasCache<string, number>('fight')
    const shared = canvasCache<string, number>()
    let builds = 0
    const art = lazy(() => ++builds, 'fight')
    fight.set('floor', 1)
    shared.set('chunk', 1)
    art()

    dropFightArt()

    expect(fight.size).toBe(0)
    expect(shared.size).toBe(1)
    expect(art()).toBe(2)
  })
})

describe('lazySheet', () => {
  it('builds once, keeps the shape of what it built, and lets go of it as lazy art does', () => {
    let builds = 0
    const sheet = lazySheet(() => ({ n: ++builds, rows: [1, 2] }))
    expect(sheet()).toEqual({ n: 1, rows: [1, 2] })
    expect(sheet()).toBe(sheet())
    for (let i = 0; i < 3; i++) sweepArt(2)
    expect(sheet().n).toBe(2)
    resetCanvases()
    expect(sheet().n).toBe(3)
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
