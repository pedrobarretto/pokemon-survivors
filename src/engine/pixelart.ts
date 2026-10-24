/**
 * Code-authored pixel art. Sprites are written as string rows where each
 * character maps to a palette color ('.' or ' ' = transparent).
 */
import { clearShelves, place, shelves, type Shelves } from './shelves'

export type Palette = Readonly<Record<string, string>>
export type PixelSprite = HTMLCanvasElement

export const createCanvas = (w: number, h: number) => {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
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
const holders: Array<() => unknown> = []

/**
 * Registers how to drop a cache of drawn canvases. When the browser loses its GPU context
 * (memory pressure on phones, a driver reset), every 2D canvas comes back blank, so a cache
 * kept past that would silently draw nothing: no ground under the horde, which then smears.
 * `holds` returns what the cache keeps right now (a canvas, or Maps, arrays and plain objects
 * of them), so `heldCanvases` can weigh it.
 */
export const onCanvasReset = (reset: () => void, holds?: () => unknown) => {
  resets.push(reset)
  if (holds) holders.push(holds)
}

/** Drops every registered cache so it redraws. Called when the game canvas gets its context back. */
export const resetCanvases = () => {
  for (const reset of resets) reset()
}

/** Canvases (anything with `getContext` and a size), told apart from the images and patterns caches also keep. */
type Sized = { width: number; height: number; getContext: unknown }
const isCanvas = (v: object): v is Sized => 'getContext' in v && 'width' in v && typeof v.width === 'number' && 'height' in v && typeof v.height === 'number'

/** How deep `weighCanvases` looks: three nested Maps, then a value holding sheets holding canvases. */
const WEIGH_DEPTH = 6

/**
 * The distinct canvases reachable from `roots` (through Maps, Sets, arrays, plain objects and 2D
 * contexts, `WEIGH_DEPTH` deep) and their pixels in bytes (w×h×4). A canvas freed by sizing it to
 * 0×0 weighs nothing and doesn't count.
 */
export const weighCanvases = (roots: Iterable<unknown>) => {
  const seen = new Set<object>()
  const out = { canvases: 0, bytes: 0 }
  const visit = (v: unknown, depth: number): void => {
    if (typeof v !== 'object' || v === null || seen.has(v)) return
    seen.add(v)
    if (isCanvas(v)) {
      const bytes = v.width * v.height * 4
      if (bytes > 0) {
        out.canvases++
        out.bytes += bytes
      }
      return
    }
    if (depth === 0) return
    if ('canvas' in v && 'drawImage' in v) return visit(v.canvas, depth)
    if (v instanceof Map) for (const x of v.values()) visit(x, depth - 1)
    else if (Array.isArray(v) || v instanceof Set) for (const x of v) visit(x, depth - 1)
    else if (Object.getPrototypeOf(v) === Object.prototype) for (const x of Object.values(v)) visit(x, depth - 1)
  }
  for (const root of roots) visit(root, WEIGH_DEPTH)
  return out
}

/**
 * The canvases the game's caches hold right now (`onCanvasReset`'s `holds`) and their pixels in bytes:
 * what the page keeps for good, unlike a count of canvases made, which includes the garbage
 * the collector hasn't got to yet. Walks every cache, so it's for a sample every few seconds, not a frame.
 */
export const heldCanvases = () => weighCanvases(holders.map((holds) => holds()))

/** A Map holding drawn canvases, emptied on a GPU reset. */
export const canvasCache = <K, V>() => {
  const cache = new Map<K, V>()
  onCanvasReset(
    () => cache.clear(),
    () => cache,
  )
  return cache
}

/** Sweeps so far (`sweepArt`): the clock `lazy` art is stamped with when asked for. */
let artSweeps = 0
const idleArt: Array<(before: number) => void> = []

/** Builds a value holding canvases on first use, and again after a GPU reset or once `sweepArt` let it go. */
export const lazy = <T>(build: () => T) => {
  let value: T | undefined
  let used = 0
  onCanvasReset(
    () => (value = undefined),
    () => value,
  )
  idleArt.push((before) => {
    if (used < before) value = undefined
  })
  return () => {
    used = artSweeps
    return (value ??= build())
  }
}

/**
 * Lets go of the `lazy` art not asked for in the last `idle` sweeps: the moves of runs gone by,
 * the lobby's art during a run. A session would otherwise keep every sprite it ever drew, a
 * canvas each. Whatever asks again builds it again; the collector frees the old one meanwhile.
 */
export const sweepArt = (idle: number) => {
  artSweeps++
  const before = artSweeps - idle
  for (const drop of idleArt) drop(before)
}

/* ---------- The shape atlas ---------- */

/**
 * Where a packed shape sits: a spot on a page of the shape atlas or, until the task after the
 * frame packs it, a canvas of its own. Draw it with `drawPacked` or `blitPacked`, and don't keep
 * it past the frame: its page gets reused for other shapes (an evicted one is 0×0 and draws nothing).
 */
export type Packed = { canvas: HTMLCanvasElement; x: number; y: number; w: number; h: number }

type AtlasEntry = { packed: Packed; loose: HTMLCanvasElement | null; forget: () => void }
type AtlasPage = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; shelves: Shelves; entries: AtlasEntry[]; loose: number }

/**
 * The atlas' pages: 512 px squares (1 MB each), made as shapes need them, `ATLAS_PAGES` at most.
 * Once the last fills, the oldest is wiped and filled again: what's still drawn is made again on
 * its next use, the rest goes. The pages stand for the thousand-odd small canvases (every
 * shadow, ring and damage number of a crowded fight) that killed phones' tabs mid-run.
 */
const ATLAS_PAGE = 512
const ATLAS_PAGES = 6
/** Shapes too big for a page keep a canvas of their own, a few per page, and go with it. */
const LOOSE_PER_PAGE = 8

let atlasPages: AtlasPage[] = []
let atlasAt = 0
let unpacked: AtlasEntry[] = []
let packing = false
const atlasForgets: Array<() => void> = []
onCanvasReset(
  () => {
    atlasPages = []
    atlasAt = 0
    unpacked = []
    for (const forget of atlasForgets) forget()
  },
  () => [atlasPages.map((p) => p.canvas), atlasPages.map((p) => p.entries.map((e) => e.loose)), unpacked.map((e) => e.loose)],
)

/** Drops a packed shape: its cache forgets it, it draws nothing, and a canvas of its own is freed now. */
const evictPacked = (e: AtlasEntry) => {
  e.forget()
  e.packed.w = e.packed.h = 0
  if (e.loose) e.loose.width = e.loose.height = 0
  e.loose = null
}

const newPage = (): AtlasPage => {
  const canvas = createCanvas(ATLAS_PAGE, ATLAS_PAGE)
  return { canvas, ctx: context2d(canvas), shelves: shelves(ATLAS_PAGE), entries: [], loose: 0 }
}

/** Copies an entry's own canvas to `spot` on `page` and frees it: from now on it draws from the page. */
const settle = (e: AtlasEntry, loose: HTMLCanvasElement, page: AtlasPage, spot: { x: number; y: number }) => {
  page.ctx.drawImage(loose, spot.x, spot.y)
  e.packed.canvas = page.canvas
  e.packed.x = spot.x
  e.packed.y = spot.y
  e.loose = null
  loose.width = loose.height = 0
}

/** Packs what was made since the last task (`packShapes`, `packKept`), once per task. */
const schedulePack = () => {
  if (packing) return
  packing = true
  setTimeout(() => {
    packing = false
    packShapes()
    packKept()
  }, 0)
}

/** The page shapes go to next: a new one while there's room for it, else the oldest, wiped. */
const turnPage = (): AtlasPage => {
  if (atlasPages.length > 0) atlasAt = (atlasAt + 1) % ATLAS_PAGES
  const old = atlasPages[atlasAt]
  if (!old) return (atlasPages[atlasAt] = newPage())
  for (const e of old.entries) evictPacked(e)
  old.entries.length = 0
  old.loose = 0
  clearShelves(old.shelves)
  old.ctx.clearRect(0, 0, ATLAS_PAGE, ATLAS_PAGE)
  return old
}

/**
 * Copies the shapes made since the last task onto the atlas and frees their own canvases. It runs
 * after the frame, so writing a page doesn't make the browser copy it under a frame drawing from it.
 */
const packShapes = () => {
  for (const e of unpacked) {
    const loose = e.loose
    // Evicted (or dropped by a GPU reset) before it was packed.
    if (!loose || e.packed.w === 0) continue
    let page = atlasPages[atlasAt] ?? turnPage()
    let spot = place(page.shelves, loose.width, loose.height)
    if (!spot && loose.width <= ATLAS_PAGE && loose.height <= ATLAS_PAGE) {
      page = turnPage()
      spot = place(page.shelves, loose.width, loose.height)
    }
    page.entries.push(e)
    if (!spot) {
      if (++page.loose >= LOOSE_PER_PAGE) turnPage()
      continue
    }
    settle(e, loose, page, spot)
  }
  unpacked = []
}

/* ---------- Kept sprites ---------- */

/**
 * Sprites kept a while in named groups (a biome's terrain), packed on the group's own pages so a
 * biome's hundred sculpted pieces take a few canvases, and freed together (`dropKept`) when the
 * run leaves the biome.
 */
type KeptGroup = { pages: AtlasPage[]; loose: AtlasEntry[]; dropped: boolean }
const keptGroups = new Map<string, KeptGroup>()
let unkept: { group: KeptGroup; e: AtlasEntry }[] = []
onCanvasReset(
  () => {
    keptGroups.clear()
    unkept = []
  },
  () => [[...keptGroups.values()].map((g) => [g.pages.map((p) => p.canvas), g.loose.map((e) => e.loose)]), unkept.map((u) => u.e.loose)],
)

const noop = () => {}

/**
 * Hands `sprite` (a canvas no one else draws to or keeps) over to `group`: it's drawn from the
 * returned `Packed`, which keeps pointing at it until the task after the frame copies it onto
 * the group's pages and frees it. Too big for a page, it stays as it is, freed with the group.
 */
export const keepPacked = (group: string, sprite: HTMLCanvasElement): Packed => {
  let g = keptGroups.get(group)
  if (!g) keptGroups.set(group, (g = { pages: [], loose: [], dropped: false }))
  const e: AtlasEntry = { packed: { canvas: sprite, x: 0, y: 0, w: sprite.width, h: sprite.height }, loose: sprite, forget: noop }
  unkept.push({ group: g, e })
  schedulePack()
  return e.packed
}

/** Frees a group's pages (and its sprites too big for one) now: what it packed draws nothing from here on. */
export const dropKept = (group: string) => {
  const g = keptGroups.get(group)
  if (!g) return
  keptGroups.delete(group)
  g.dropped = true
  for (const page of g.pages) {
    for (const e of page.entries) evictPacked(e)
    page.canvas.width = page.canvas.height = 0
  }
  for (const e of g.loose) evictPacked(e)
}

/** Copies the kept sprites made since the last task onto their groups' pages, first fit. */
const packKept = () => {
  for (const { group, e } of unkept) {
    const loose = e.loose
    if (!loose) continue
    // Its group was dropped before it was packed.
    if (group.dropped) {
      evictPacked(e)
      continue
    }
    if (loose.width > ATLAS_PAGE || loose.height > ATLAS_PAGE) {
      group.loose.push(e)
      continue
    }
    let page: AtlasPage | null = null
    let spot: { x: number; y: number } | null = null
    for (const p of group.pages) {
      spot = place(p.shelves, loose.width, loose.height)
      if (spot) {
        page = p
        break
      }
    }
    if (!page || !spot) {
      group.pages.push((page = newPage()))
      spot = place(page.shelves, loose.width, loose.height)!
    }
    page.entries.push(e)
    settle(e, loose, page, spot)
  }
  unkept = []
}

/**
 * Caches a three-argument shape painter on the shape atlas: a hit (hundreds per frame: every
 * shadow, every damage number) allocates nothing, and the shapes share a few page canvases
 * instead of holding a canvas each. `make` paints the shape on a fresh canvas, which the atlas
 * takes over. Put the argument with the most values last: its Map drops evicted entries, the
 * outer ones only empty on a GPU reset.
 */
export const packed3 = <A, B, C>(make: (a: A, b: B, c: C) => HTMLCanvasElement) => {
  let root = new Map<A, Map<B, Map<C, AtlasEntry>>>()
  atlasForgets.push(() => (root = new Map()))
  return (a: A, b: B, c: C): Packed => {
    let byB = root.get(a)
    if (!byB) root.set(a, (byB = new Map()))
    let byC = byB.get(b)
    if (!byC) byB.set(b, (byC = new Map()))
    const hit = byC.get(c)
    if (hit) return hit.packed
    const loose = make(a, b, c)
    const home = byC
    const e: AtlasEntry = {
      packed: { canvas: loose, x: 0, y: 0, w: loose.width, h: loose.height },
      loose,
      forget: () => {
        if (home.get(c) === e) home.delete(c)
      },
    }
    home.set(c, e)
    unpacked.push(e)
    schedulePack()
    return e.packed
  }
}

/** Draws a packed shape with its top-left corner at (x, y). */
export const drawPacked = (ctx: CanvasRenderingContext2D, p: Packed, x: number, y: number) => {
  if (p.w > 0) ctx.drawImage(p.canvas, p.x, p.y, p.w, p.h, x, y, p.w, p.h)
}

/** Draws a packed shape centered at (x, y), snapped to whole pixels, as `blitCentered` draws a canvas. */
export const blitPacked = (ctx: CanvasRenderingContext2D, p: Packed, x: number, y: number) =>
  drawPacked(ctx, p, Math.round(x - p.w / 2), Math.round(y - p.h / 2))

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

/** Hard-edged filled ellipse (no antialiasing), on the shape atlas. */
export const ellipse = packed3((rx: number, ry: number, color: string) => {
  const canvas = createCanvas(Math.round(rx) * 2 + 1, Math.round(ry) * 2 + 1)
  paintEllipse(context2d(canvas), 0, 0, rx, ry, color)
  return canvas
})

/** A soft round light in hard rings, brightest in the middle (pixel art: no gradients). */
export const glow = (radius: number, color: string, alpha: number) => {
  const canvas = createCanvas(radius * 2 + 1, radius * 2 + 1)
  const ctx = context2d(canvas)
  for (const [k, a] of [[1, 0.35], [0.7, 0.6], [0.42, 1]] as const) {
    ctx.globalAlpha = alpha * a
    paintEllipse(ctx, Math.round(radius - radius * k), Math.round(radius - radius * k * 0.75), Math.round(radius * k), Math.round(radius * k * 0.75), color)
  }
  return canvas
}

/** Hard-edged ring (circle outline) of a given thickness, on the shape atlas like `ellipse`. */
export const ring = packed3((radius: number, thickness: number, color: string) => {
  const r = Math.round(radius)
  const canvas = createCanvas(r * 2 + 1, r * 2 + 1)
  paintRing(context2d(canvas), 0, 0, r, thickness, color)
  return canvas
})

/** Shapes past this many pixels are painted fresh instead of cached: a shockwave or a telegraph grows through every size. */
const BIG_SHAPE = 64 * 64

let stage: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null = null
onCanvasReset(
  () => (stage = null),
  () => stage,
)

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

/** `blitCentered(ctx, ellipse(rx, ry, color), x, y)`, with big ellipses painted fresh rather than cached. */
export const blitEllipse = (ctx: CanvasRenderingContext2D, rx: number, ry: number, color: string, x: number, y: number) => {
  const w = Math.round(rx) * 2 + 1
  const h = Math.round(ry) * 2 + 1
  if (w * h <= BIG_SHAPE) return blitPacked(ctx, ellipse(rx, ry, color), x, y)
  stamp(ctx, w, h, x, y, (s) => paintEllipse(s, 0, 0, rx, ry, color))
}

/** `blitCentered(ctx, ring(radius, thickness, color), x, y)`, with big rings painted fresh rather than cached. */
export const blitRing = (ctx: CanvasRenderingContext2D, radius: number, thickness: number, color: string, x: number, y: number) => {
  const r = Math.round(radius)
  const size = r * 2 + 1
  if (size * size <= BIG_SHAPE) return blitPacked(ctx, ring(radius, thickness, color), x, y)
  stamp(ctx, size, size, x, y, (s) => paintRing(s, 0, 0, r, thickness, color))
}

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
  // For co-op name tags (`render/team.ts`).
  ' ': ['00', '00', '00', '00', '00'], '.': ['0', '0', '0', '0', '1'], '-': ['000', '000', '111', '000', '000'], '_': ['000', '000', '000', '000', '111'],
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
 * Renders text with a 1px dark outline, on the shape atlas: a damage total changes with every
 * merged hit, so a canvas per text would pile up thousands of them. The text goes last (`packed3`).
 */
const outlinedText = packed3((color: string, outline: string, text: string) => {
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
})

/** A number or short word in the in-world font, with the usual dark outline unless told otherwise. Packed: draw it with `blitPacked`. */
export const textSprite = (text: string, color: string, outline = '#181010') => outlinedText(color, outline, text)
