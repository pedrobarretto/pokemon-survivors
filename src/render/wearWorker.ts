import type { WearableSlot } from '../data/cosmetics'
import type { Nudge } from '../data/wearFits'
import { WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import type { PixelArt } from './wearArt'
import { dress, itemArt, movingParts, placeOf, squashOf, type Dressed, type ItemArt } from './wearDress'
import type { WearSize } from './wearFit'
import { decodePng } from './wearPng'
import { frameOf, type RigFrame } from './wearRig'

/**
 * Dresses sprites off the main thread (`render/wearEngine.ts` posts the jobs):
 * a job is one sheet row of a wearer in a look, and comes back as that row's
 * frames dressed (`render/wearDress.ts`) side by side in cells of one size,
 * plus each moving item's frames to draw over them. The worker fetches and
 * decodes the sheet itself (the page already has it cached), renders each
 * item's model for the wearer once per direction, and keeps a few sheets and
 * models for the next rows. Pure math in, RGBA out.
 */

export type DressJob = {
  key: string
  /** The sheet's URL and its frame grid. */
  sheet: string
  fw: number
  fh: number
  frames: number
  row: Dir8
  /** The row's frames' rigs, fixes applied (`decodeRig`), the fix's pixels over any hat, and the wearer's size. */
  rigs: readonly RigFrame[]
  over: readonly Nudge[]
  size: WearSize
  /** A key for the wearer's size: its models render once per item and direction. */
  wearer: string
  items: readonly { id: WearableId; layer: 'front' | 'behind' }[]
  /** Below 1 for a legend shrunk to fit (`fitSprites`): the dressed frames shrink the same way. */
  scale: number
}

/** A moving item's frames, each with its pivot at (`ox`, `oy`), and where that pivot goes on each of the row's frames. */
export type Moving = { id: WearableId; layer: 'front' | 'behind'; pivots: { x: number; y: number }[]; frames: { w: number; h: number; ox: number; oy: number; rgba: Uint8ClampedArray<ArrayBuffer> }[] }

/** A dressed row: `frames` cells of `cw` × `ch` side by side, each frame's top-left at (`ox`, `oy`) in its cell. */
export type DressDone = { key: string; cw: number; ch: number; ox: number; oy: number; rgba: Uint8ClampedArray<ArrayBuffer>; moving: Moving[] } | { key: string; error: string }

/* ---------------- Caches ---------------- */

type Sheet = { w: number; h: number; rgba: Uint8Array }
const sheets = new Map<string, Promise<Sheet>>()
const sheetBytes = new Map<string, number>()
const sheetUsed = new Map<string, number>()
/** Decoded sheets kept for the next rows (bytes; a legend's is about 1 MB), and how long (ms) one may sit unused: a look's rows come in a burst. */
const SHEETS_MAX = 8 * 1048576
const SHEET_IDLE = 6000

/** Lets go of the sheets no job has read lately. */
const sweep = () => {
  const now = Date.now()
  for (const [url, at] of sheetUsed) {
    if (now - at < SHEET_IDLE) continue
    sheets.delete(url)
    sheetBytes.delete(url)
    sheetUsed.delete(url)
  }
  if (sheets.size) setTimeout(sweep, SHEET_IDLE)
}

const sheetOf = (url: string) => {
  if (sheets.size === 0) setTimeout(sweep, SHEET_IDLE)
  sheetUsed.set(url, Date.now())
  let s = sheets.get(url)
  if (s) {
    // Most recently used last.
    sheets.delete(url)
    sheets.set(url, s)
    return s
  }
  s = fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`sheet ${r.status}`)
      return r.arrayBuffer()
    })
    .then((b) => {
      const d = decodePng(new Uint8Array(b))
      sheetBytes.set(url, d.rgba.length)
      let all = 0
      for (const n of sheetBytes.values()) all += n
      for (const old of sheets.keys()) {
        if (all <= SHEETS_MAX || old === url) break
        all -= sheetBytes.get(old) ?? 0
        sheets.delete(old)
        sheetBytes.delete(old)
        sheetUsed.delete(old)
      }
      return d
    })
  s.catch(() => {
    sheets.delete(url)
    sheetBytes.delete(url)
    sheetUsed.delete(url)
  })
  sheets.set(url, s)
  return s
}

const arts = new Map<string, ItemArt>()
const squashes = new Map<string, number>()
/** Models kept rendered (by wearer, item and direction). */
const ARTS_MAX = 400

const artOf = (wearer: string, id: WearableId, slot: WearableSlot, size: WearSize, row: Dir8) => {
  const key = `${wearer}|${id}|${row}`
  let a = arts.get(key)
  if (a) return a
  const sk = `${wearer}|${id}`
  let squash = squashes.get(sk)
  if (squash === undefined) squashes.set(sk, (squash = slot === 'head' ? squashOf(id, size) : 1))
  a = itemArt(id, slot, size, row, squash)
  arts.set(key, a)
  if (arts.size > ARTS_MAX) arts.delete(arts.keys().next().value!)
  return a
}

/* ---------------- Shrinking (a legend fitted to size) ---------------- */

/**
 * `src` (`w` × `h` RGBA, the frame's top-left at `ox`, `oy`) shrunk by `k` the
 * way `fitSprites` shrinks a sheet (each pixel the most common opaque color of
 * its block, darker on a tie), its blocks counted from the frame's top-left
 * so the frame's own pixels land as the shrunk sheet's do.
 */
export const shrink = (src: { w: number; h: number; ox: number; oy: number; rgba: Uint8ClampedArray }, fw: number, fh: number, k: number) => {
  const sw = Math.max(1, Math.round(fw * k))
  const sh = Math.max(1, Math.round(fh * k))
  const lo = (v: number, full: number, small: number) => Math.floor((v * full) / small)
  const ox = Math.ceil((src.ox * sw) / fw)
  const oy = Math.ceil((src.oy * sh) / fh)
  const w = ox + Math.ceil(((src.w - src.ox) * sw) / fw)
  const h = oy + Math.ceil(((src.h - src.oy) * sh) / fh)
  const rgba = new Uint8ClampedArray(w * h * 4)
  const counts = new Map<number, number>()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const rx = x - ox
      const ry = y - oy
      const x0 = src.ox + lo(rx, fw, sw)
      const x1 = src.ox + Math.max(lo(rx, fw, sw) + 1, lo(rx + 1, fw, sw))
      const y0 = src.oy + lo(ry, fh, sh)
      const y1 = src.oy + Math.max(lo(ry, fh, sh) + 1, lo(ry + 1, fh, sh))
      counts.clear()
      let opaque = 0
      let area = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          area++
          if (xx < 0 || yy < 0 || xx >= src.w || yy >= src.h) continue
          const i = (yy * src.w + xx) * 4
          if (src.rgba[i + 3]! < 128) continue
          opaque++
          const rgb = (src.rgba[i]! << 16) | (src.rgba[i + 1]! << 8) | src.rgba[i + 2]!
          counts.set(rgb, (counts.get(rgb) ?? 0) + 1)
        }
      }
      if (opaque * 2 < area) continue
      let best = 0
      let most = 0
      for (const [rgb, n] of counts) {
        const darker = ((rgb >> 16) & 255) + ((rgb >> 8) & 255) + (rgb & 255) < ((best >> 16) & 255) + ((best >> 8) & 255) + (best & 255)
        if (n > most || (n === most && darker)) [best, most] = [rgb, n]
      }
      const o = (y * w + x) * 4
      rgba[o] = (best >> 16) & 255
      rgba[o + 1] = (best >> 8) & 255
      rgba[o + 2] = best & 255
      rgba[o + 3] = 255
    }
  }
  return { w, h, ox, oy, rgba }
}

/* ---------------- Jobs ---------------- */

/** Pixel art into RGBA (its palette's indexes to colors), its pivot kept. */
const toRgba = (art: PixelArt) => {
  const rgba = new Uint8ClampedArray(art.w * art.h * 4)
  const rgb = art.colors.map((c) => (c ? parseInt(c.slice(1, 7), 16) : 0))
  for (let k = 0; k < art.px.length; k++) {
    const c = art.px[k]!
    if (!c) continue
    rgba[k * 4] = (rgb[c]! >> 16) & 255
    rgba[k * 4 + 1] = (rgb[c]! >> 8) & 255
    rgba[k * 4 + 2] = rgb[c]! & 255
    rgba[k * 4 + 3] = 255
  }
  return { w: art.w, h: art.h, ox: art.ox, oy: art.oy, rgba }
}

/** One job (see `DressJob`): the row's frames dressed into cells of one size, and the moving items' frames. */
export const runJob = async (job: DressJob): Promise<DressDone> => {
  const sheet = await sheetOf(job.sheet)
  const pivot = { x: 0, y: 0 }
  const arts = job.items.map(({ id, layer }) => ({ id, layer, slot: WEARABLES[id].slot, art: artOf(job.wearer, id, WEARABLES[id].slot, job.size, job.row) }))
  let cells: { w: number; h: number; ox: number; oy: number; rgba: Uint8ClampedArray }[] = []
  const frames = Array.from({ length: job.frames }, (_, f) => frameOf(sheet.rgba, sheet.w, f, job.row, job.fw, job.fh))
  for (let f = 0; f < job.frames; f++) {
    const rig = job.rigs[Math.min(f, job.rigs.length - 1)]!
    const frame = frames[f]!
    const d: Dressed = dress(
      frame,
      rig,
      arts.map(({ id, slot, layer, art }) => {
        placeOf(rig, slot, job.row, job.size, art, pivot, frame)
        return { id, slot, layer, art: art.still, x: pivot.x, y: pivot.y }
      }),
      job.over,
    )
    cells.push(d)
  }
  let fw = job.fw
  let fh = job.fh
  if (job.scale < 1) {
    cells = cells.map((c) => shrink(c, job.fw, job.fh, job.scale))
    fw = Math.max(1, Math.round(job.fw * job.scale))
    fh = Math.max(1, Math.round(job.fh * job.scale))
  }
  // One cell size for the row: every frame's box around its frame's top-left.
  const ox = Math.max(...cells.map((c) => c.ox))
  const oy = Math.max(...cells.map((c) => c.oy))
  const cw = ox + Math.max(fw, ...cells.map((c) => c.w - c.ox))
  const ch = oy + Math.max(fh, ...cells.map((c) => c.h - c.oy))
  const W = cw * cells.length
  const rgba = new Uint8ClampedArray(W * ch * 4)
  cells.forEach((c, f) => {
    for (let y = 0; y < c.h; y++) {
      const to = ((y - c.oy + oy) * W + f * cw + ox - c.ox) * 4
      rgba.set(c.rgba.subarray(y * c.w * 4, (y + 1) * c.w * 4), to)
    }
  })
  const moving = arts.flatMap(({ id, slot, layer, art }) => {
    if (!art.moving) return []
    // Where the moving part turns on each of the row's frames (frame px, shrunk with the frames).
    const pivots = job.rigs.map((rig, f) => {
      placeOf(rig, slot, job.row, job.size, art, pivot, frames[f])
      return { x: Math.round(pivot.x * job.scale), y: Math.round(pivot.y * job.scale) }
    })
    return movingParts(art, slot, layer, job.rigs, job.row, job.size, frames).map((m) => ({
      id,
      layer: m.layer,
      pivots,
      frames: m.frames.map((f) => {
        const rgba = toRgba(f)
        return job.scale < 1 ? shrink(rgba, 1 / job.scale, 1 / job.scale, job.scale) : rgba
      }),
    }))
  })
  return { key: job.key, cw, ch, ox, oy, rgba, moving }
}

/** The worker's side of the messages (this module also loads, inert, on the main thread and in tests). */
type Scope = { onmessage: ((e: MessageEvent<DressJob>) => void) | null; postMessage: (done: DressDone, transfer: Transferable[]) => void }

if (typeof (globalThis as { WorkerGlobalScope?: unknown }).WorkerGlobalScope !== 'undefined') {
  const scope = globalThis as unknown as Scope
  scope.onmessage = (e) => {
    runJob(e.data).then(
      (done) => scope.postMessage(done, 'rgba' in done ? [done.rgba.buffer, ...done.moving.flatMap((m) => m.frames.map((f) => f.rgba.buffer))] : []),
      (error: unknown) => scope.postMessage({ key: e.data.key, error: String(error) }, []),
    )
  }
}
