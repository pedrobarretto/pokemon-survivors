/**
 * Code-authored pixel art. Sprites are written as string rows where each
 * character maps to a palette color ('.' or ' ' = transparent).
 */
export type Palette = Readonly<Record<string, string>>
export type PixelSprite = HTMLCanvasElement

/**
 * Canvases `createCanvas` made that are still alive (as far as the garbage
 * collector has said) and their pixels in bytes (w×h×4), with the peaks since
 * `resetCanvasPeaks`: the crash watch and `run_end` read them. A canvas resized
 * after it's made counts at its first size.
 */
export const canvasStats = { live: 0, bytes: 0, peakLive: 0, peakBytes: 0 }

const collected =
  typeof FinalizationRegistry === 'function'
    ? new FinalizationRegistry<number>((bytes) => {
        canvasStats.live--
        canvasStats.bytes -= bytes
      })
    : null

/** Starts the peaks over from what's alive now (a run starting). */
export const resetCanvasPeaks = () => {
  canvasStats.peakLive = canvasStats.live
  canvasStats.peakBytes = canvasStats.bytes
}

export const createCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  const bytes = c.width * c.height * 4
  canvasStats.live++
  canvasStats.bytes += bytes
  if (canvasStats.live > canvasStats.peakLive) canvasStats.peakLive = canvasStats.live
  if (canvasStats.bytes > canvasStats.peakBytes) canvasStats.peakBytes = canvasStats.bytes
  collected?.register(c, bytes)
  return c
}

/** A 1×1 context made with the first one, for when a canvas gets none. */
let spare: CanvasRenderingContext2D | null = null

/**
 * A canvas' 2D context, unsmoothed for hard pixels. iOS hands out no context once the page's
 * canvases pass its memory budget: that canvas' drawing then lands on the spare and its art
 * comes out blank, instead of the game crashing mid-run.
 */
export const context2d = (canvas: HTMLCanvasElement) => {
  spare ??= createCanvas(1, 1).getContext('2d')
  const ctx = canvas.getContext('2d', { willReadFrequently: false }) ?? spare
  if (!ctx) throw new Error('No 2D canvas context')
  ctx.imageSmoothingEnabled = false
  return ctx
}

export const fromStrings = (rows: readonly string[], palette: Palette, opts: { mirror?: boolean } = {}): PixelSprite => {
  const width = Math.max(...rows.map((r) => r.length))
  const canvas = createCanvas(width, rows.length)
  const ctx = context2d(canvas)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = palette[row[x]!]
      if (!color) continue
      ctx.fillStyle = color
      ctx.fillRect(opts.mirror ? width - 1 - x : x, y, 1, 1)
    }
  })
  return canvas
}

/** Swaps palette colors of a string sprite – handy for item/candy tiers. */
export const recolor = (rows: readonly string[], palette: Palette) => fromStrings(rows, palette)

/* ---------- GPU resets ---------- */

const resets: Array<() => void> = []

/**
 * Registers how to drop a cache of drawn canvases. When the browser loses its GPU context
 * (memory pressure on phones, a driver reset), every 2D canvas comes back blank, so a cache
 * kept past that would silently draw nothing: no ground under the horde, which then smears.
 */
export const onCanvasReset = (reset: () => void) => {
  resets.push(reset)
}

/** Drops every registered cache so it redraws. Called when the game canvas gets its context back. */
export const resetCanvases = () => {
  for (const reset of resets) reset()
}

/** A Map holding drawn canvases, emptied on a GPU reset. */
export const canvasCache = <K, V>() => {
  const cache = new Map<K, V>()
  onCanvasReset(() => cache.clear())
  return cache
}

/** Builds a value holding canvases on first use, and again after a GPU reset. */
export const lazy = <T>(build: () => T) => {
  let value: T | undefined
  onCanvasReset(() => (value = undefined))
  return () => (value ??= build())
}

type Memo3<A, B, C, R> = Map<A, Map<B, Map<C, R>>>

/**
 * Caches a three-argument `fn` in nested Maps, so a hit (hundreds per frame:
 * every shadow, every damage number) allocates nothing. Once a generation's entries
 * add up to `max` (each weighs `cost`, 1 by default) the cache starts a new
 * generation and keeps the last one around for a while: what's still drawn moves
 * over on its next use, the rest goes with it.
 */
export const memo3 = <A, B, C, R>(fn: (a: A, b: B, c: C) => R, max = Infinity, cost: (value: R) => number = () => 1) => {
  let fresh: Memo3<A, B, C, R> = new Map()
  let old: Memo3<A, B, C, R> = new Map()
  let size = 0
  onCanvasReset(() => {
    fresh = new Map()
    old = new Map()
    size = 0
  })
  const store = (a: A, b: B, c: C, v: R) => {
    let byB = fresh.get(a)
    if (!byB) fresh.set(a, (byB = new Map()))
    let byC = byB.get(b)
    if (!byC) byB.set(b, (byC = new Map()))
    byC.set(c, v)
  }
  return (a: A, b: B, c: C): R => {
    const hit = fresh.get(a)?.get(b)?.get(c)
    if (hit !== undefined) return hit
    const v = old.get(a)?.get(b)?.get(c) ?? fn(a, b, c)
    if (size >= max) {
      old = fresh
      fresh = new Map()
      size = 0
    }
    store(a, b, c, v)
    size += cost(v)
    return v
  }
}

/**
 * What a cached canvas weighs in a bounded `memo3`: its pixels, plus a flat share for the
 * canvas and its context, which cost memory however small the canvas is.
 */
const canvasWeight = (c: PixelSprite) => c.width * c.height + 1024
/** Pixels' worth of canvases a shape cache keeps per generation (2 MB; two generations at most). Big shapes aren't cached (`blitEllipse`, `blitRing`). */
const SHAPE_BUDGET = 512 * 1024

/** Paints a hard-edged filled ellipse whose bounding box starts at (left, top). */
const paintEllipse = (ctx: CanvasRenderingContext2D, left: number, top: number, rx: number, ry: number, color: string) => {
  const w = Math.round(rx) * 2 + 1
  const h = Math.round(ry) * 2 + 1
  ctx.fillStyle = color
  const cx = (w - 1) / 2
  const cy = (h - 1) / 2
  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / (ry + 0.5)
    const span = Math.sqrt(Math.max(0, 1 - dy * dy)) * (rx + 0.5)
    const x0 = Math.round(cx - span)
    const x1 = Math.round(cx + span)
    if (x1 > x0) ctx.fillRect(left + x0, top + y, x1 - x0, 1)
  }
}

/** The rightmost x ≥ 0 on row `y` with `Math.hypot(x, y) <= lim` (-1 if none): the same test a pixel-by-pixel scan makes. */
const reach = (lim: number, y: number) => {
  if (!(Math.abs(y) <= lim)) return -1
  let x = Math.floor(Math.sqrt(Math.max(0, lim * lim - y * y)))
  while (x > 0 && Math.hypot(x, y) > lim) x--
  while (Math.hypot(x + 1, y) <= lim) x++
  return x
}

/**
 * Paints a hard-edged ring of radius `r` (whole px) and `thickness`, its bounding box starting at
 * (left, top): every pixel whose center lies within r + 0.5 of the middle but past r + 0.5 - thickness,
 * filled a row span at a time.
 */
const paintRing = (ctx: CanvasRenderingContext2D, left: number, top: number, r: number, thickness: number, color: string) => {
  ctx.fillStyle = color
  const outer = r + 0.5
  const inner = outer - thickness
  for (let y = -r; y <= r; y++) {
    const xo = reach(outer, y)
    if (xo < 0) continue
    const xi = reach(inner, y)
    if (xi < 0) ctx.fillRect(left + r - xo, top + r + y, xo * 2 + 1, 1)
    else if (xo > xi) {
      ctx.fillRect(left + r - xo, top + r + y, xo - xi, 1)
      ctx.fillRect(left + r + xi + 1, top + r + y, xo - xi, 1)
    }
  }
}

const ellipseCanvas = (rx: number, ry: number, color: string): PixelSprite => {
  const canvas = createCanvas(Math.round(rx) * 2 + 1, Math.round(ry) * 2 + 1)
  paintEllipse(context2d(canvas), 0, 0, rx, ry, color)
  return canvas
}

const ringCanvas = (radius: number, thickness: number, color: string): PixelSprite => {
  const r = Math.round(radius)
  const canvas = createCanvas(r * 2 + 1, r * 2 + 1)
  paintRing(context2d(canvas), 0, 0, r, thickness, color)
  return canvas
}

/** Hard-edged filled ellipse (no antialiasing) as a canvas of its own, cached per size/color, bounded. For art built from it; drawing in a frame goes through `blitEllipse`. */
export const ellipse = memo3(ellipseCanvas, SHAPE_BUDGET, canvasWeight)

/** Hard-edged ring (circle outline) of a given thickness. Cached and bounded, like `ellipse`; drawing in a frame goes through `blitRing`. */
export const ring = memo3(ringCanvas, SHAPE_BUDGET, canvasWeight)

/* ---------- Small-sprite atlas ---------- */

/**
 * A small cached sprite's place: a rectangle of an atlas page, or its own canvas (at 0, 0) until
 * the next task packs it. Read it when drawing, never keep it: packing moves it.
 */
export type AtlasSprite = { src: HTMLCanvasElement; sx: number; sy: number; width: number; height: number; gen: number }

/** A page's rows of sprites, filled left to right and stacked top to bottom. */
export type Shelves = { size: number; top: number; rows: { y: number; h: number; end: number }[] }

/** Clear px between sprites, so no sampling under a transform bleeds a neighbor in. */
const ATLAS_GAP = 1
/** A row takes sprites up to this many px shorter than itself, so tall and short ones don't share one. */
const ROW_SLACK = 4

export const shelves = (size: number): Shelves => ({ size, top: 0, rows: [] })

/** Claims a spot for a `w`×`h` sprite on a page's rows, opening a new row if none fits; null when the page is full. */
export const shelfSpot = (s: Shelves, w: number, h: number): { x: number; y: number } | null => {
  for (const row of s.rows) {
    if (h <= row.h && row.h - h <= ROW_SLACK && row.end + w <= s.size) {
      const x = row.end
      row.end += w + ATLAS_GAP
      return { x, y: row.y }
    }
  }
  if (w > s.size || s.top + h > s.size) return null
  s.rows.push({ y: s.top, h, end: w + ATLAS_GAP })
  s.top += h + ATLAS_GAP
  return { x: 0, y: s.top - h - ATLAS_GAP }
}

type AtlasPage = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; shelves: Shelves }

/**
 * Caches a three-argument `make` that draws a small sprite on a canvas of its own, packing what it
 * makes into shared `size`×`size` pages: a canvas costs the browser memory (its surface, its context, a
 * DOM node) however few pixels it holds, and a run's shadows, rings and damage numbers made one
 * per size, color and value, over a thousand by minute 5, until phones closed the tab.
 * A sprite made mid-frame draws from its own canvas until the next task packs it, since writing
 * into a page the frame already drew from makes the browser copy the whole page. Once
 * `pagesPerGen` pages are full a new generation starts and the last one is kept until the next
 * turn: what's still drawn moves over on its next use, the rest goes with its pages.
 */
const atlas3 = <A, B, C>(make: (a: A, b: B, c: C) => PixelSprite, size: number, pagesPerGen: number) => {
  let gen = 0
  let fresh: Memo3<A, B, C, AtlasSprite> = new Map()
  let old: Memo3<A, B, C, AtlasSprite> = new Map()
  let pages: AtlasPage[] = []
  let oldPages: AtlasPage[] = []
  let pending: AtlasSprite[] = []
  let scheduled = false
  const free = (list: AtlasPage[]) => {
    for (const p of list) p.canvas.width = p.canvas.height = 0
  }
  onCanvasReset(() => {
    free(pages)
    free(oldPages)
    fresh = new Map()
    old = new Map()
    pages = []
    oldPages = []
    pending = []
    gen++
  })
  const turn = () => {
    free(oldPages)
    oldPages = pages
    pages = []
    old = fresh
    fresh = new Map()
    gen++
  }
  const place = (w: number, h: number) => {
    for (const page of pages) {
      const at = shelfSpot(page.shelves, w, h)
      if (at) return { page, at }
    }
    if (w > size || h > size) return null
    if (pages.length >= pagesPerGen) turn()
    const canvas = createCanvas(size, size)
    const page = { canvas, ctx: context2d(canvas), shelves: shelves(size) }
    pages.push(page)
    const at = shelfSpot(page.shelves, w, h)
    return at && { page, at }
  }
  const pack = () => {
    scheduled = false
    const list = pending
    pending = []
    for (const s of list) {
      const loose = s.src
      // Too big for a page: it keeps its own canvas.
      const spot = place(s.width, s.height)
      if (!spot) continue
      spot.page.ctx.drawImage(loose, spot.at.x, spot.at.y)
      s.src = spot.page.canvas
      s.sx = spot.at.x
      s.sy = spot.at.y
      s.gen = gen
      loose.width = loose.height = 0
    }
  }
  const store = (a: A, b: B, c: C, s: AtlasSprite) => {
    let byB = fresh.get(a)
    if (!byB) fresh.set(a, (byB = new Map()))
    let byC = byB.get(b)
    if (!byC) byB.set(b, (byC = new Map()))
    byC.set(c, s)
    return s
  }
  return (a: A, b: B, c: C): AtlasSprite => {
    const hit = fresh.get(a)?.get(b)?.get(c)
    if (hit) return hit
    const was = old.get(a)?.get(b)?.get(c)
    // Packed after the turn (made just before it): already on a current page.
    if (was && was.gen === gen) return store(a, b, c, was)
    const src = make(a, b, c)
    const s: AtlasSprite = { src, sx: 0, sy: 0, width: src.width, height: src.height, gen }
    pending.push(s)
    if (!scheduled) {
      scheduled = true
      setTimeout(pack, 0)
    }
    return store(a, b, c, s)
  }
}

/** Draws an atlas sprite centered at (x, y), snapped to whole pixels, as `blitCentered` draws a canvas. */
const blitSprite = (ctx: CanvasRenderingContext2D, s: AtlasSprite, x: number, y: number) =>
  ctx.drawImage(s.src, s.sx, s.sy, s.width, s.height, Math.round(x - s.width / 2), Math.round(y - s.height / 2), s.width, s.height)

/** Ellipses (every shadow) fill two 512 px pages a generation (2 MB; two generations at most); rings, far fewer, one of 256 px. */
const ellipseSprite = atlas3(ellipseCanvas, 512, 2)
const ringSprite = atlas3(ringCanvas, 256, 1)

/** Shapes past this many pixels are painted fresh instead of cached: a shockwave or a telegraph grows through every size. */
const BIG_SHAPE = 64 * 64

let stage: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null
onCanvasReset(() => (stage = null))

/**
 * Paints a `w`×`h` shape on a shared staging canvas and draws it centered at (x, y) the way
 * `blitCentered` draws a cached one: same pixels, composited the same way, without keeping
 * a canvas per size (a ripple across the screen would leave megabytes of them each second).
 */
const stamp = (ctx: CanvasRenderingContext2D, w: number, h: number, x: number, y: number, paint: (s: CanvasRenderingContext2D) => void) => {
  if (!stage || stage.canvas.width < w || stage.canvas.height < h) {
    // Grown in 64 px steps, so a shape swelling a pixel a frame doesn't make a canvas a frame.
    const grow = (need: number, had = 0) => Math.max(had, Math.ceil(need / 64) * 64)
    const canvas = createCanvas(grow(w, stage?.canvas.width), grow(h, stage?.canvas.height))
    stage = { canvas, ctx: context2d(canvas) }
  }
  stage.ctx.clearRect(0, 0, w, h)
  paint(stage.ctx)
  ctx.drawImage(stage.canvas, 0, 0, w, h, Math.round(x - w / 2), Math.round(y - h / 2), w, h)
}

/** `blitCentered(ctx, ellipse(rx, ry, color), x, y)`, from the atlas, with big ellipses painted fresh rather than cached. */
export const blitEllipse = (ctx: CanvasRenderingContext2D, rx: number, ry: number, color: string, x: number, y: number) => {
  const w = Math.round(rx) * 2 + 1
  const h = Math.round(ry) * 2 + 1
  if (w * h <= BIG_SHAPE) return blitSprite(ctx, ellipseSprite(rx, ry, color), x, y)
  stamp(ctx, w, h, x, y, (s) => paintEllipse(s, 0, 0, rx, ry, color))
}

/** `blitCentered(ctx, ring(radius, thickness, color), x, y)`, from the atlas, with big rings painted fresh rather than cached. */
export const blitRing = (ctx: CanvasRenderingContext2D, radius: number, thickness: number, color: string, x: number, y: number) => {
  const r = Math.round(radius)
  const size = r * 2 + 1
  if (size * size <= BIG_SHAPE) return blitSprite(ctx, ringSprite(radius, thickness, color), x, y)
  stamp(ctx, size, size, x, y, (s) => paintRing(s, 0, 0, r, thickness, color))
}

/** `ctx.drawImage(ellipse(rx, ry, color), left, top)`, from the atlas like `blitEllipse`. */
export const drawEllipse = (ctx: CanvasRenderingContext2D, rx: number, ry: number, color: string, left: number, top: number) =>
  blitEllipse(ctx, rx, ry, color, left + Math.round(rx) + 0.5, top + Math.round(ry) + 0.5)

/** Draws a sprite centered at (x, y), snapped to whole pixels. */
export const blitCentered = (ctx: CanvasRenderingContext2D, sprite: CanvasImageSource & { width: number; height: number }, x: number, y: number) =>
  ctx.drawImage(sprite, Math.round(x - sprite.width / 2), Math.round(y - sprite.height / 2))

/** Draws a sprite centered at (x, y) rotated by `angle`. Rotation keeps the chunky pixel look at low res. */
export const blitRotated = (ctx: CanvasRenderingContext2D, sprite: PixelSprite, x: number, y: number, angle: number, scale = 1) => {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(angle)
  if (scale !== 1) ctx.scale(scale, scale)
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
  ctx.restore()
}

/* ---------- Bitmap font for in-world numbers (3x5 glyphs, outlined) ---------- */

const GLYPHS: Record<string, readonly string[]> = {
  '0': ['111', '101', '101', '101', '111'],
  '1': ['010', '110', '010', '010', '111'],
  '2': ['111', '001', '111', '100', '111'],
  '3': ['111', '001', '011', '001', '111'],
  '4': ['101', '101', '111', '001', '001'],
  '5': ['111', '100', '111', '001', '111'],
  '6': ['111', '100', '111', '101', '111'],
  '7': ['111', '001', '010', '010', '010'],
  '8': ['111', '101', '111', '101', '111'],
  '9': ['111', '101', '111', '001', '111'],
  '!': ['1', '1', '1', '0', '1'],
  '+': ['000', '010', '111', '010', '000'],
  '₽': ['0110', '0101', '0110', '1110', '0100'],
  // Capitals, for short in-world tags (an Alpha's "ALFA").
  A: ['010', '101', '111', '101', '101'], B: ['110', '101', '110', '101', '110'], C: ['011', '100', '100', '100', '011'],
  D: ['110', '101', '101', '101', '110'], E: ['111', '100', '110', '100', '111'], F: ['111', '100', '110', '100', '100'],
  G: ['011', '100', '101', '101', '011'], H: ['101', '101', '111', '101', '101'], I: ['111', '010', '010', '010', '111'],
  J: ['001', '001', '001', '101', '010'], K: ['101', '101', '110', '101', '101'], L: ['100', '100', '100', '100', '111'],
  M: ['10001', '11011', '10101', '10001', '10001'], N: ['1001', '1101', '1011', '1001', '1001'], O: ['010', '101', '101', '101', '010'],
  P: ['110', '101', '110', '100', '100'], Q: ['010', '101', '101', '110', '011'], R: ['110', '101', '110', '101', '101'],
  S: ['011', '100', '010', '001', '110'], T: ['111', '010', '010', '010', '010'], U: ['101', '101', '101', '101', '111'],
  V: ['101', '101', '101', '101', '010'], W: ['10001', '10001', '10101', '11011', '10001'], X: ['101', '101', '010', '101', '101'],
  Y: ['101', '101', '010', '010', '010'], Z: ['111', '001', '010', '100', '111'],
}

/**
 * Renders text with a 1px dark outline into a cached sprite, packed in a 256 px atlas page (about 400 numbers a generation): a damage total
 * changes with every merged hit, so a long run would otherwise pile up tens of thousands of canvases.
 */
const outlinedText = atlas3((text: string, color: string, outline: string): PixelSprite => {
  const chars = [...text].map((c) => GLYPHS[c] ?? GLYPHS['0']!)
  const width = chars.reduce((w, g) => w + g[0]!.length + 1, 1)
  const canvas = createCanvas(width + 1, 7)
  const ctx = context2d(canvas)
  const plot = (fill: string, dx: number, dy: number) => {
    ctx.fillStyle = fill
    let ox = 1
    for (const g of chars) {
      g.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) if (row[x] === '1') ctx.fillRect(ox + x + dx, 1 + y + dy, 1, 1)
      })
      ox += g[0]!.length + 1
    }
  }
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) plot(outline, dx, dy)
  plot(color, 0, 0)
  return canvas
}, 256, 1)

/** Draws a number or short word in the in-world font centered at (x, y), with the usual dark outline unless told otherwise. */
export const blitText = (ctx: CanvasRenderingContext2D, text: string, color: string, x: number, y: number, outline = '#181010') =>
  blitSprite(ctx, outlinedText(text, color, outline), x, y)
