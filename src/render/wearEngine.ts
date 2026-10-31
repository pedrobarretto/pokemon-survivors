import type { Look } from '../data/cosmetics'
import type { Nudge } from '../data/wearFits'
import { isWearableId, WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { createCanvas, context2d, onCanvasReset } from '../engine/pixelart'
import { detail } from './quality'
import { drawPokemon, placeFrame, type AnimName, type DrawOpts, type FramePlace, type SpeciesSprites } from './sprites'
import { rasterize } from './wearArt'
import { decodeRig, DRAW_ORDER, fitOf, fixOf, layerOf, rigChunk, rigKey, rigSheet, sizeOf, wears, yawOf, type Rig, type RigAnim, type RigChunk, type RigEntry, type WearSize } from './wearFit'
import { sceneOf, WEAR_MODELS } from './wearModels'
import type { DressDone, DressJob } from './wearWorker'

/**
 * The wearables' engine, loaded with the first look drawn
 * (`render/wearables.ts` imports it on demand): it finds a variant's head rig
 * (its chunk loads the first time the variant wears something), asks the
 * worker (`render/wearWorker.ts`) to dress each sheet row the wearer shows in
 * its look, and draws the dressed frame in the sprite's place, with an
 * animated item's moving part over it. Until a row lands the Pokémon draws
 * bare. Dressed rows are bitmaps kept while drawn, within a memory budget
 * (`ROW_BUDGET`), the least recently drawn let go first.
 */

/* ---------------- Rig ---------------- */

/**
 * The rig's files (`data/wearRig/`, `npm run rig`), each its own small asset,
 * by URL: fetched rather than imported, since some browsers keep a failed
 * dynamic import failed for the page's life and a retry must refetch.
 */
const CHUNKS = import.meta.glob<string>('../data/wearRig/*.json', { query: '?url', import: 'default', eager: true })

const fetchChunk = async (url: string): Promise<RigChunk> => {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`rig ${res.status}`)
  return res.json()
}

/** Each chunk's entries once loaded (`rigChunk`), null while it loads or after it failed lately. */
const chunks = new Map<number, Record<string, RigEntry> | null>()

/** How long (ms) a chunk that failed to load waits before the next try. */
const RETRY = 5000

/** A chunk no player's dex falls in: no rig there. */
const NONE: Record<string, RigEntry> = {}

/** The entries of `dex`'s chunk, or null until it lands (the first ask starts it: a species' first frames draw bare). */
const entriesOf = (dex: number) => {
  const n = rigChunk(dex)
  const have = chunks.get(n)
  if (have !== undefined) return have
  const url = CHUNKS[`../data/wearRig/rig-${n}.json`]
  chunks.set(n, url ? null : NONE)
  if (!url) return NONE
  void fetchChunk(url).then(
    (c) => chunks.set(n, c.species),
    () => setTimeout(() => chunks.delete(n), RETRY),
  )
  return null
}

/** A variant as a wearer: its rig with its hand fixes, its size, and each row's pixels drawn over any hat. */
type Wearer = { key: string; rig: Rig; size: WearSize; fit: ReturnType<typeof fitOf>; over: readonly (readonly Nudge[])[] }

const wearers = new Map<string, Wearer | null>()

/**
 * The wearer for loaded sprites, or null: a stand-in (a puff), a species no
 * player can be or a variant without a rig (`npm run rig` lists them), and
 * any species until its rig's chunk lands. By variant, so a stage change
 * mid-run (new sprites, a new dex) just finds the next stage's.
 */
const wearerOf = (s: SpeciesSprites): Wearer | null => {
  const v = s.variant
  if (!v) return null
  const key = rigKey(s.dex, v.form, v.shiny)
  const known = wearers.get(key)
  if (known !== undefined) return known
  const entries = entriesOf(s.dex)
  if (!entries) {
    misses++
    return null
  }
  const entry = entries[key] ?? entries[rigKey(s.dex, v.form, false)]
  let w: Wearer | null = null
  if (entry) {
    const fit = fitOf(s.dex, v.form)
    const rig = decodeRig(entry, fit)
    w = { key, rig, size: sizeOf(rig, fit), fit, over: Array.from({ length: 8 }, (_, row) => fixOf(fit, row)?.over ?? []) }
  }
  wearers.set(key, w)
  return w
}

/* ---------------- Dressed rows ---------------- */

type Drawable = ImageBitmap | HTMLCanvasElement
type MovingFrames = { img: Drawable; w: number; h: number; ox: number; oy: number }[]
/** A moving item on a row: its frames (shared by the direction's every anim, `movingKey`) and where they turn on each of the row's frames. */
type MovingRow = { id: WearableId; layer: 'front' | 'behind'; key: string; pivots: readonly { x: number; y: number }[]; frames: MovingFrames }
/** A dressed sheet row: its cells (`cw` × `ch`, a frame's top-left at `ox`, `oy`), its moving items and what its cells weigh. */
type Row = { img: Drawable; cw: number; ch: number; ox: number; oy: number; moving: MovingRow[]; bytes: number; used: number }

/**
 * A moving item's frames depend on the wearer, the item and the direction,
 * not the anim: Walk, Idle and Hurt share them, kept while a row uses them.
 */
const movings = new Map<string, { frames: MovingFrames; rows: number; bytes: number }>()

/** A row's moving items let go: frames no row uses any more are freed. */
const release = (r: Row) => {
  for (const m of r.moving) {
    const shared = movings.get(m.key)
    if (!shared || --shared.rows > 0) continue
    for (const f of shared.frames) free(f.img)
    held -= shared.bytes
    movings.delete(m.key)
  }
}

/** Dressed rows by `rowKey`: a row, `null` while it's being dressed. */
const rows = new Map<string, Row | null>()

/** Bytes of dressed rows kept (normal and safe mode): a wearer's whole look is about 1 MB, a match shows eight. */
const ROW_BUDGET = { normal: 16 * 1048576, safe: 6 * 1048576 }
let held = 0
let peak = 0
/** The drawing's clock for the rows' recency: one tick per `drawDressed` call. */
let tick = 0

const free = (img: Drawable) => {
  if ('close' in img) img.close()
  else img.width = img.height = 0
}

/** Lets go of the least recently drawn rows until the kept ones fit the budget. */
const trim = () => {
  const budget = detail.safe ? ROW_BUDGET.safe : ROW_BUDGET.normal
  if (held <= budget) return
  const done = [...rows].flatMap(([k, r]) => (r ? [[k, r] as const] : [])).sort((a, b) => a[1].used - b[1].used)
  for (const [k, r] of done) {
    if (held <= budget * 0.8) break
    rows.delete(k)
    free(r.img)
    release(r)
    held -= r.bytes
  }
}

/** RGBA into something to draw: a bitmap where the browser makes them (off the main thread), else a canvas. */
const drawable = async (rgba: Uint8ClampedArray<ArrayBuffer>, w: number, h: number): Promise<Drawable> => {
  const data = new ImageData(rgba, w, h)
  if (typeof createImageBitmap === 'function') return createImageBitmap(data)
  const c = createCanvas(w, h)
  context2d(c).putImageData(data, 0, 0)
  return c
}

onCanvasReset(
  () => freeWearArt(),
  () => [...rows.values()].flatMap((r) => (r && !('close' in r.img) ? [r.img] : [])),
)

/* ---------------- The worker ---------------- */

let worker: Worker | null | undefined
type Queued = { job: DressJob; urgent: boolean; look: string }
const queue: Queued[] = []
const inFlight = new Set<string>()
/** Jobs the worker runs at once: a few, so the row a wearer shows now never waits behind a whole look's. */
const PARALLEL = 2
/** When (tick) each wearer's look was last drawn: queued rows for a look no longer shown are dropped. */
const shown = new Map<string, number>()
/** Ticks a look may go undrawn before its queued rows go. */
const STALE = 240

const land = async (done: DressDone) => {
  inFlight.delete(done.key)
  pump()
  if (!rows.has(done.key)) return
  if ('error' in done) {
    // Drawn bare until the next ask (a sheet that failed to load).
    rows.delete(done.key)
    return
  }
  const W = done.cw * Math.max(1, Math.round(done.rgba.length / 4 / done.ch / done.cw))
  try {
    const img = await drawable(done.rgba, W, done.ch)
    // The row's key is `rowKey`'s: wearer, look, anim, direction and scale.
    const [wearer, , , dir, scale] = done.key.split('|')
    const moving: MovingRow[] = []
    for (const m of done.moving) {
      const key = `${wearer}|${scale}|${dir}|${m.id}|${m.layer}`
      let shared = movings.get(key)
      if (!shared) {
        const frames = await Promise.all(m.frames.map(async (f) => ({ img: await drawable(f.rgba, f.w, f.h), w: f.w, h: f.h, ox: f.ox, oy: f.oy })))
        // Another row of the direction may have landed meanwhile.
        shared = movings.get(key)
        if (shared) for (const f of frames) free(f.img)
        else {
          const bytes = m.frames.reduce((a, f) => a + f.rgba.length, 0)
          movings.set(key, (shared = { frames, rows: 0, bytes }))
          held += bytes
        }
      }
      shared.rows++
      moving.push({ id: m.id, layer: m.layer, key, pivots: m.pivots, frames: shared.frames })
    }
    const row: Row = { img, cw: done.cw, ch: done.ch, ox: done.ox, oy: done.oy, moving, bytes: done.rgba.length, used: tick }
    if (!rows.has(done.key)) {
      free(img)
      release(row)
      return
    }
    rows.set(done.key, row)
    held += row.bytes
    peak = Math.max(peak, held)
    trim()
  } catch {
    rows.delete(done.key)
  }
}

const workerOf = () => {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./wearWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<DressDone>) => void land(e.data)
    // A worker that can't run: everything draws bare.
    worker.onerror = () => {
      worker = null
      rows.clear()
      queue.length = 0
      inFlight.clear()
    }
  } catch {
    worker = null
  }
  return worker
}

/** Posts the next jobs: the urgent first, then the look's other rows; a look not drawn lately loses its queued rows. */
const pump = () => {
  const w = workerOf()
  if (!w) return
  while (inFlight.size < PARALLEL && queue.length) {
    const i = queue.findIndex((q) => q.urgent)
    const [next] = queue.splice(i >= 0 ? i : 0, 1)
    if (!next) break
    if (!next.urgent && tick - (shown.get(next.look) ?? -Infinity) > STALE) {
      rows.delete(next.job.key)
      continue
    }
    inFlight.add(next.job.key)
    w.postMessage(next.job)
  }
}

/* ---------------- Looks ---------------- */

/** The items a look puts on a wearer facing `dir`, in drawing order, with the pass each takes (hidden ones left out). */
const itemsOf = (look: Look, w: Wearer, dir: Dir8) =>
  DRAW_ORDER.flatMap((slot) => {
    const id = look[slot]
    if (id === undefined || !isWearableId(id) || WEARABLES[id].slot !== slot || !wears(w.fit, slot, id)) return []
    const layer = layerOf(slot, dir, WEAR_MODELS[id].layers)
    return layer === 'hidden' ? [] : [{ id, layer }]
  })

/** A look's key: its worn items. */
const lookKey = (look: Look) => `${look.head ?? ''},${look.face ?? ''},${look.neck ?? ''},${look.back ?? ''}`

const rowKey = (w: Wearer, look: string, anim: RigAnim, dir: Dir8, scale: number) => `${w.key}|${look}|${anim}|${dir}|${scale}`

/** A sheet's URL, for the worker to fetch: the loaded image's own (a canvas, a recolor, has none and draws bare). */
const urlOf = (s: SpeciesSprites, anim: RigAnim) => {
  const img = s.anims[anim].img
  return typeof HTMLImageElement !== 'undefined' && img instanceof HTMLImageElement && img.src ? img.src : null
}

/** Asks for one row (urgent: drawn now) unless it's kept or on its way. */
const ask = (s: SpeciesSprites, w: Wearer, look: Look, key: string, anim: RigAnim, dir: Dir8, scale: number, urgent: boolean) => {
  const rk = rowKey(w, key, anim, dir, scale)
  if (rows.has(rk)) {
    if (urgent) {
      const q = queue.find((j) => j.job.key === rk)
      if (q) q.urgent = true
    }
    return
  }
  const items = itemsOf(look, w, dir)
  const sheet = urlOf(s, anim)
  if (items.length === 0 || !sheet) return
  const r = w.rig[anim]
  rows.set(rk, null)
  queue.push({
    urgent,
    look: `${w.key}|${key}`,
    job: { key: rk, sheet, fw: r.fw, fh: r.fh, frames: r.frames, row: dir, rigs: r.rows[dir]!, over: w.over[dir]!, size: w.size, wearer: `${w.key}|${scale}`, items, scale },
  })
  pump()
}

/** Asks for a look's every row (Walk and Idle in every direction, then Hurt), so turning and stopping never draw bare once it's in. */
const askAll = (s: SpeciesSprites, w: Wearer, look: Look, key: string, scale: number) => {
  for (const anim of ['Walk', 'Idle', 'Hurt'] as const) for (let d = 0; d < 8; d++) ask(s, w, look, key, anim, d as Dir8, scale, false)
}

/* ---------------- Drawing ---------------- */

const place: FramePlace = { anim: 'Walk', fw: 0, fh: 0, frames: 0, frame: 0, dx: 0, dy: 0 }

/** An animated item's frame at `seconds`. */
const modelFrame = (id: WearableId, seconds: number) => {
  const f = WEAR_MODELS[id].frames
  return f ? Math.floor(seconds / f.every) % f.count : 0
}

/** Draws that found their row still dressing, since `takeMisses` last asked. */
let misses = 0

/** `render/wearables.ts`'s `drawDressed`, once this module is loaded. */
export const drawDressed = (
  ctx: CanvasRenderingContext2D,
  s: SpeciesSprites,
  look: Look,
  anim: AnimName,
  dir: Dir8,
  seconds: number,
  x: number,
  y: number,
  opts: DrawOpts & { clock?: number },
) => {
  tick++
  // A legend shrunk to fit (`fitSprites`) dresses on its downloaded sheets' rig, shrunk with it.
  const src = s.fitted?.from ?? s
  const w = wearerOf(src)
  const bare = () => drawPokemon(ctx, s, anim, dir, seconds, x, y, opts)
  if (!w || !placeFrame(src, anim, seconds, 0, 0, 1, opts.loop ?? true, place)) return bare()
  const sheet = rigSheet(w.rig, place)
  if (!sheet) return bare()
  const frame = place.frame
  const scale = s.fitted?.scale ?? 1
  const key = lookKey(look)
  const rk = rowKey(w, key, sheet, dir, scale)
  const first = !shown.has(`${w.key}|${key}`)
  shown.set(`${w.key}|${key}`, tick)
  const row = rows.get(rk)
  if (!row) {
    ask(src, w, look, key, sheet, dir, scale, true)
    if (first) askAll(src, w, look, key, scale)
    misses++
    return bare()
  }
  row.used = tick
  const k = opts.scale ?? 1
  const items = itemsOf(look, w, dir)
  if (!placeFrame(s, anim, seconds, x, y, k, opts.loop ?? true, place)) return
  const alpha = opts.alpha ?? 1
  const drawMoving = (layer: 'front' | 'behind') => {
    for (const m of row.moving) {
      if (m.layer !== layer) continue
      const f = m.frames[modelFrame(m.id, opts.clock ?? seconds) % m.frames.length]!
      const at = m.pivots[Math.min(frame, m.pivots.length - 1)]!
      if (alpha !== 1) ctx.globalAlpha = alpha
      ctx.drawImage(f.img, Math.round(place.dx + (at.x - f.ox) * k), Math.round(place.dy + (at.y - f.oy) * k), f.w * k, f.h * k)
      ctx.globalAlpha = 1
    }
  }
  if (items.length) drawMoving('behind')
  drawPokemon(ctx, s, anim, dir, seconds, x, y, { ...opts, body: { img: row.img, sx: frame * row.cw, sy: 0, w: row.cw, h: row.ch, ox: row.ox, oy: row.oy } })
  if (items.length) drawMoving('front')
}

/* ---------------- Icons and housekeeping ---------------- */

const icons = new Map<WearableId, HTMLCanvasElement>()
onCanvasReset(
  () => icons.clear(),
  () => [...icons.values()],
)

/** A size for the icons: a middling head. */
const ICON_SIZE: WearSize = { head: 13, depth: 13, brow: 9, brows: [9, 9], face: 13, eye: 0, neck: 9, body: 16, drop: 12, rise: 14 }

/** An item's art facing south-east (its truest three-quarter view) at a middling size, for the shop and the locker's tiles. */
export const wearableIcon = (id: WearableId): HTMLCanvasElement => {
  let icon = icons.get(id)
  if (!icon) {
    const art = rasterize(sceneOf(id, WEARABLES[id].slot, ICON_SIZE, 0), yawOf(1))
    icon = createCanvas(art.w, art.h)
    const ctx = context2d(icon)
    const img = ctx.createImageData(art.w, art.h)
    const rgb = art.colors.map((c) => (c ? parseInt(c.slice(1, 7), 16) : 0))
    for (let i = 0; i < art.px.length; i++) {
      const c = art.px[i]!
      if (!c) continue
      img.data.set([(rgb[c]! >> 16) & 255, (rgb[c]! >> 8) & 255, rgb[c]! & 255, 255], i * 4)
    }
    ctx.putImageData(img, 0, 0)
    icons.set(id, icon)
  }
  return icon
}

/** Lets go of the dressed rows (a match ended: the next one dresses what its looks wear), so a long session doesn't keep every look it ever saw. */
export const freeWearArt = () => {
  for (const r of rows.values()) if (r) free(r.img)
  for (const m of movings.values()) for (const f of m.frames) free(f.img)
  rows.clear()
  movings.clear()
  queue.length = 0
  held = 0
}

/** Drops the cached wearers and rows (the dev tools change `WEAR_FITS` live). */
export const refit = () => {
  wearers.clear()
  freeWearArt()
}

/** Dev: how many draws found no dressed row yet since the last ask (a contact sheet repaints until none did). */
export const takeMisses = () => {
  const n = misses + queue.length + inFlight.size
  misses = 0
  return n
}

/** Dev: what the dressed rows weigh now and at their peak (MB), and how many (`ps.sprites()` prints it beside the sheets'). */
export const wearMemory = (reset = false) => {
  if (reset) peak = held
  return { rows: [...rows.values()].filter(Boolean).length, MB: +(held / 1048576).toFixed(2), peakMB: +(peak / 1048576).toFixed(2), queued: queue.length }
}

/** Whether a species (by dex) has a rig to wear things on, null while its chunk loads: the Boutique tries looks on the partner only then. */
export const hasRig = (dex: number): boolean | null => {
  const entries = entriesOf(dex)
  return entries && Object.hasOwn(entries, rigKey(dex, undefined, false))
}

/** Dev (`ps.rig`): a variant's wearer, decoded fresh (its fixes as they are now). */
export const devWearer = (s: SpeciesSprites) => {
  if (s.variant) wearers.delete(rigKey(s.dex, s.variant.form, s.variant.shiny))
  return wearerOf(s)
}
