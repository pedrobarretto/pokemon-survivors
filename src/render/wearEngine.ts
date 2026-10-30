import type { Look, WearableSlot } from '../data/cosmetics'
import data from '../data/wearAnchors.generated.json'
import { isWearableId, WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { createCanvas, context2d, onCanvasReset } from '../engine/pixelart'
import type { PixelArt } from './wearArt'
import { renderJob, type ArtDone, type ArtJob } from './wearWorker'
import {
  classOf,
  decodeAnchors,
  DRAW_ORDER,
  fitOf,
  layerOf,
  measuresOf,
  nudgeOf,
  pivotAt,
  wears,
  type AnchorAnim,
  type AnchorEntry,
  type Anchors,
  type Layer,
} from './wearFit'
import { SIZE_CLASSES, WEAR_MODELS, type WearSize } from './wearModels'
import { placeFrame, type AnimName, type FramePlace, type SpeciesSprites } from './sprites'

/**
 * The wearables' engine, loaded with the Arena's first look
 * (`render/wearables.ts` imports it on demand, with the anchors' data): it
 * finds a species' anchors, sizes its wearables, renders each model once per
 * size, direction and frame (`render/wearArt.ts`) into a small canvas and
 * draws it pinned to the frame's pivot.
 */

const SPECIES = data.species as Record<string, AnchorEntry>

/** One art direction's (or its mirror's) art, ready to draw: a canvas and where its pivot is. */
type Art = { canvas: HTMLCanvasElement; ox: number; oy: number }

/** A species variant as a wearer: its anchors, its hand fitting and the size each slot's art comes in. */
type Wearer = {
  dex: number
  anchors: Anchors
  fit: ReturnType<typeof fitOf>
  sizes: Record<WearableSlot, WearSize>
  /** Each slot's size as a small number, for the art's cache key. */
  keys: Record<WearableSlot, number>
}

const wearers = new Map<string, Wearer | null>()

/** The size class a species wears in each slot: its own measures (`measuresOf`), or its hand fitting's (`SpeciesFit.size`). */
const sizesOf = (a: Anchors, fit: Wearer['fit']) => {
  const m = measuresOf(a)
  const pick = (slot: WearableSlot, value: number) => fit?.size?.[slot] ?? classOf(value, SIZE_CLASSES[slot])
  const head = pick('head', m.head)
  const face = pick('face', m.head)
  const neck = pick('neck', m.neck)
  const back = pick('back', m.body)
  // A back item also reaches the feet (a cape) or above the head (a balloon): those go by 2 px steps.
  const drop = Math.max(4, Math.round(m.drop / 2) * 2)
  const rise = Math.max(4, Math.round(m.rise / 2) * 2)
  const size = (h: number, n: number, b: number): WearSize => ({ head: SIZE_CLASSES.head[h]!, neck: SIZE_CLASSES.neck[n]!, body: SIZE_CLASSES.back[b]!, drop, rise })
  return {
    sizes: { head: size(head, neck, back), face: size(face, neck, back), neck: size(head, neck, back), back: size(head, neck, back) },
    keys: { head, face, neck, back: back + 3 * (drop + 64 * rise) },
  }
}

/** The wearer for loaded sprites, or null: a stand-in (a puff), a form without anchors, a species outside the Arena's roster. */
const wearerOf = (s: SpeciesSprites): Wearer | null => {
  const v = s.variant
  if (!v || v.form) return null
  const key = v.shiny && SPECIES[`${s.dex}s`] ? `${s.dex}s` : String(s.dex)
  let w = wearers.get(key)
  if (w === undefined) {
    const entry = SPECIES[key]
    if (!entry) w = null
    else {
      const anchors = decodeAnchors(entry)
      const fit = fitOf(s.dex)
      w = { dex: s.dex, anchors, fit, ...sizesOf(anchors, fit) }
    }
    wearers.set(key, w)
  }
  return w
}

/* ---------------- Art ---------------- */

/** Rendered art by item, then by size, direction and frame (`artKey`); null while it renders. */
const arts = new Map<WearableId, Map<number, Art | null>>()

onCanvasReset(
  () => {
    arts.clear()
    jobs.clear()
  },
  () => [...arts.values()].flatMap((m) => [...m.values()].flatMap((a) => (a ? [a.canvas] : []))),
)

const artKey = (size: number, dir: Dir8, frame: number) => (size * 8 + dir) * 64 + frame

/** Pixel art into a canvas (the art's palette indexes to colors). */
const toCanvas = (art: PixelArt): Art => {
  const canvas = createCanvas(art.w, art.h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(art.w, art.h)
  const rgb = art.colors.map((c) => (c ? parseInt(c.slice(1, 7), 16) : 0))
  for (let i = 0; i < art.px.length; i++) {
    const c = art.px[i]!
    if (c === 0) continue
    const v = rgb[c]!
    img.data[i * 4] = (v >> 16) & 255
    img.data[i * 4 + 1] = (v >> 8) & 255
    img.data[i * 4 + 2] = v & 255
    img.data[i * 4 + 3] = 255
  }
  ctx.putImageData(img, 0, 0)
  return { canvas, ox: art.ox, oy: art.oy }
}

/** An item's art for a size facing `dir` (`renderJob`), into a canvas. */
const renderArt = (id: WearableId, size: WearSize, dir: Dir8, frame: number) => toCanvas(renderJob({ key: '', id, size, dir, frame }))

/**
 * The art renders in a worker (`render/wearWorker.ts`), so a new look never
 * stalls a frame: until it lands the item just isn't drawn. Where no worker
 * runs, it renders here, a few models per stretch of drawing (`BUDGET`).
 */
let worker: Worker | null | undefined
const jobs = new Map<string, { id: WearableId; key: number }>()

const byItem = (id: WearableId) => {
  let m = arts.get(id)
  if (!m) arts.set(id, (m = new Map()))
  return m
}

const land = ({ key, art }: ArtDone) => {
  const job = jobs.get(key)
  if (!job) return
  jobs.delete(key)
  byItem(job.id).set(job.key, toCanvas(art))
}

const workerOf = () => {
  if (worker !== undefined) return worker
  try {
    worker = new Worker(new URL('./wearWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<ArtDone>) => land(e.data)
    // A worker that can't run: what it was given renders here instead.
    worker.onerror = () => {
      worker = null
      for (const { id, key } of jobs.values()) byItem(id).delete(key)
      jobs.clear()
    }
  } catch {
    worker = null
  }
  return worker
}

/** Time (ms) a stretch of drawing may spend rendering art without a worker; a new stretch starts this long (ms) after the last began. */
const BUDGET = 3
const STRETCH = 12
let stretch = 0
let spent = 0

/** Asks for an item's art: posted to the worker (null meanwhile), or rendered here while the budget lasts. */
const request = (id: WearableId, w: Wearer, slot: WearableSlot, dir: Dir8, frame: number, key: number) => {
  const m = byItem(id)
  const off = workerOf()
  if (off) {
    m.set(key, null)
    const tag = `${id}:${key}`
    jobs.set(tag, { id, key })
    off.postMessage({ key: tag, id, size: w.sizes[slot], dir, frame } satisfies ArtJob)
    return
  }
  const now = performance.now()
  if (now - stretch > STRETCH) {
    stretch = now
    spent = 0
  }
  if (spent > BUDGET) return
  m.set(key, renderArt(id, w.sizes[slot], dir, frame))
  spent += performance.now() - now
}

/** The art for an item on a wearer facing `dir` at a frame of its animation, or null while it renders. The first ask for an item at a size asks for all its directions and frames. */
const artOf = (id: WearableId, w: Wearer, slot: WearableSlot, dir: Dir8, frame: number): Art | null => {
  const m = byItem(id)
  const key = artKey(w.keys[slot], dir, frame)
  const have = m.get(key)
  if (have) return have
  if (have === null) {
    misses++
    return null
  }
  request(id, w, slot, dir, frame, key)
  if (workerOf()) {
    const frames = WEAR_MODELS[id].frames?.count ?? 1
    for (let f = 0; f < frames; f++) {
      for (let d = 0; d < 8; d++) {
        const k = artKey(w.keys[slot], d as Dir8, f)
        if (!m.has(k)) request(id, w, slot, d as Dir8, f, k)
      }
    }
  }
  const art = m.get(key) ?? null
  if (!art) misses++
  return art
}

/** Draws that found no art yet, since `takeMisses` last asked. */
let misses = 0

/** An animated item's frame at `seconds`, 0 for a still one. */
const modelFrame = (id: WearableId, seconds: number) => {
  const f = WEAR_MODELS[id].frames
  return f ? Math.floor(seconds / f.every) % f.count : 0
}

/* ---------------- Drawing ---------------- */

const place: FramePlace = { anim: 'Walk', fw: 0, fh: 0, frames: 0, frame: 0, dx: 0, dy: 0 }
const pivot = { x: 0, y: 0 }

/** Whether the frame `placeFrame` found is the one the anchors know (a shrunk or swapped sheet isn't), and which of their sheets it is. */
const anchorAnim = (a: Anchors, p: FramePlace): AnchorAnim | null => {
  if (p.anim === 'Fly') return null
  const s = a.anims[p.anim]
  return s.fw === p.fw && s.fh === p.fh && s.frames === p.frames ? p.anim : null
}

/** The item a look wears in a slot, if it's a wearable this species wears. */
const wornIn = (look: Look, slot: WearableSlot, w: Wearer): WearableId | null => {
  const id = look[slot]
  return id !== undefined && isWearableId(id) && WEARABLES[id].slot === slot && wears(w.fit, slot, id) ? id : null
}

/** `render/wearables.ts`'s `drawWearables`, once this module is loaded. */
export const drawWearables = (
  ctx: CanvasRenderingContext2D,
  s: SpeciesSprites,
  look: Look,
  anim: AnimName,
  dir: Dir8,
  seconds: number,
  x: number,
  y: number,
  layer: Exclude<Layer, 'hidden'>,
  opts: { alpha?: number; scale?: number; loop?: boolean; clock?: number },
) => {
  const w = wearerOf(s)
  if (!w) return
  const k = opts.scale ?? 1
  if (!placeFrame(s, anim, seconds, x, y, k, opts.loop ?? true, place)) return
  const sheet = anchorAnim(w.anchors, place)
  if (!sheet) return
  const alpha = opts.alpha ?? 1
  for (const slot of DRAW_ORDER) {
    const id = wornIn(look, slot, w)
    if (!id || layerOf(slot, dir, WEAR_MODELS[id].layers) !== layer) continue
    const art = artOf(id, w, slot, dir, modelFrame(id, opts.clock ?? seconds))
    if (!art) continue
    pivotAt(w.anchors, sheet, dir, place.frame, slot, nudgeOf(w.fit, slot, dir), pivot)
    if (alpha !== 1) ctx.globalAlpha = alpha
    ctx.drawImage(art.canvas, place.dx + (pivot.x - art.ox) * k, place.dy + (pivot.y - art.oy) * k, art.canvas.width * k, art.canvas.height * k)
  }
  if (alpha !== 1) ctx.globalAlpha = 1
}

const icons = new Map<WearableId, HTMLCanvasElement>()
onCanvasReset(
  () => icons.clear(),
  () => [...icons.values()],
)

/** An item's art facing south-east (its truest three-quarter view) at its middle size, for the shop and the locker's tiles. */
export const wearableIcon = (id: WearableId): HTMLCanvasElement => {
  let icon = icons.get(id)
  if (!icon) {
    const size: WearSize = { head: SIZE_CLASSES.head[1], neck: SIZE_CLASSES.neck[1], body: SIZE_CLASSES.back[1], drop: 12, rise: 14 }
    icons.set(id, (icon = renderArt(id, size, 1, 0).canvas))
  }
  return icon
}

/** Lets go of the rendered art (a match ended: the next one renders what its looks wear), so a long session doesn't keep every look it ever saw. */
export const freeWearArt = () => {
  arts.clear()
  jobs.clear()
}

/** Drops the cached wearers and art (the fitting tool changes `WEAR_FITS` live). */
export const refit = () => {
  wearers.clear()
  arts.clear()
  jobs.clear()
}

/** Dev: how many draws found no art yet since the last ask (a contact sheet repaints until none did). */
export const takeMisses = () => {
  const n = misses
  misses = 0
  return n
}

/** Whether a species (by dex) has anchors to wear things on: the Boutique tries looks on the partner only then. */
export const hasAnchors = (dex: number) => Object.hasOwn(SPECIES, String(dex))
