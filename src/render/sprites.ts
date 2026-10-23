import { bodyOf, type Body } from '../data/bodies'
import type { MegaForm } from '../data/megas'
import type { LegendForm } from '../data/legends'
import manifest from '../data/sprites.generated.json'
import { createCanvas, context2d, fromStrings, onCanvasReset } from '../engine/pixelart'
import type { Dir8 } from '../engine/math'
import { detail } from './quality'

/**
 * Loader/renderer for PMD SpriteCollab sheets. Each sheet has 8 rows (one per
 * direction) and N columns (frames). Durations are in 1/60s ticks. `Fly` is a
 * flyer's wingbeat up in the sky, for the species SpriteCollab has one for.
 */
export type AnimName = 'Walk' | 'Idle' | 'Hurt' | 'Fly'
export type Dex = number

type Sheet = {
  img: HTMLImageElement | HTMLCanvasElement
  fw: number
  fh: number
  durations: readonly number[]
  totalTicks: number
  /** The sweep (`sweepSprites`) it was last drawn or asked for in; `GONE` once its species was dropped, and then it draws nothing. */
  seen: number
  /** Its frames' silhouettes (`overlay`), by `overlayKey`; null until the first one. */
  overlays: Map<number, Overlay> | null
}

export type SpeciesSprites = {
  dex: Dex
  anims: Record<Exclude<AnimName, 'Fly'>, Sheet> & { Fly?: Sheet }
  /** The portrait's URL, for DOM art (an <img>); never downloaded with the sheets. */
  portrait: string
  cry: string
  /** Distance from frame center down to the feet, in px. */
  footY: number
  /** Opaque body size on the first Walk frame (`bodyOf`). */
  bodyW: number
  bodyH: number
}

type ManifestAnims = Partial<Record<AnimName, { frameWidth: number; frameHeight: number; durations: number[] }>>
type ManifestVariant = { anims: ManifestAnims; portrait?: boolean; body?: Body }
type ManifestEntry = ManifestVariant & {
  shiny?: ManifestVariant
  forms?: Record<string, ManifestVariant & { shiny?: ManifestVariant }>
  /** Forms with a cry of their own in `<form>/cry.ogg` (`FORM_CRIES`), with or without sheets. */
  formCries?: string[]
}
const MANIFEST = manifest as Record<string, ManifestEntry>

type Manifest = typeof manifest
/** An alternate form with its own sheets (`FORMS` in scripts/dex.mjs), like Aegislash's `blade`. Inferred from the manifest. */
export type Form = { [K in keyof Manifest]: Manifest[K] extends { forms: infer F } ? keyof F : never }[keyof Manifest]

/**
 * A form the game may ask for: one with sheets, or a Mega's or a legend's (Primal Kyogre, Deoxys's
 * formes), whose sheets may not be downloaded yet (then the normal ones stand in).
 */
export type FormKey = Form | MegaForm | LegendForm

const base = (dex: Dex) => `${import.meta.env.BASE_URL}assets/pokemon/${dex}`
/** Alternate forms live in a `<form>/` subfolder, shinies in a `shiny/` one below the form's, each with their own sheets. */
const variantBase = (dex: Dex, shiny: boolean, form?: FormKey) => `${base(dex)}${form ? `/${form}` : ''}${shiny ? '/shiny' : ''}`
/**
 * A loaded variant's key: a number for a species' normal and shiny colors (the hot path: `sprites` runs for every
 * Pokémon on screen every frame, so no string is built there), a string for an alternate form.
 */
type Key = number | string
const cacheKey = (dex: Dex, shiny: boolean, form?: FormKey): Key => (form ? `${dex}:${form}${shiny ? 's' : ''}` : dex * 2 + (shiny ? 1 : 0))

const manifestVariant = (dex: Dex, shiny: boolean, form?: FormKey) => {
  const entry = MANIFEST[String(dex)]
  const variant = form ? entry?.forms?.[form] : entry
  return shiny ? variant?.shiny : variant
}

const SHINIES = new Set(Object.entries(MANIFEST).flatMap(([dex, entry]) => (entry.shiny ? [Number(dex)] : [])))
export const hasShiny = (dex: Dex) => SHINIES.has(dex)

/**
 * How soon a sheet is wanted: `now` holds a loading screen, `shown` is on
 * screen as a stand-in (a puff, the normal colors, the base form) until it
 * lands, `ahead` is loaded before anything needs it.
 */
export type Urgency = 'now' | 'shown' | 'ahead'
const RANK: Record<Urgency, number> = { now: 0, shown: 1, ahead: 2 }

/**
 * Images downloading and decoding at most at once. Phones killed the tab on
 * bursts of them (a rift's legendary in every form at its crossing, a run's
 * cast while the lobby's was still held), so the rest wait their turn in
 * `waiting`, the most urgent first, and a burst lands as a trickle.
 */
const DECODES = 2

/** An image waiting its turn: the variant it belongs to (`cacheKey`), its rank (`RANK`), how to start it and how to give it up. */
type Job = { key: Key; rank: number; start: () => void; drop: () => void }
const waiting: Job[] = []
let decoding = 0

/** Starts the most urgent waiting images (the oldest among equals) while there's room. */
const pump = () => {
  while (decoding < DECODES && waiting.length > 0) {
    let at = 0
    for (let i = 1; i < waiting.length; i++) if (waiting[i]!.rank < waiting[at]!.rank) at = i
    const job = waiting.splice(at, 1)[0]!
    decoding++
    job.start()
  }
}

/**
 * Loads an image and decodes it off the main thread, so its first draw (mid-run)
 * doesn't stall a frame, once its turn comes (`DECODES`).
 */
const loadImage = (src: string, key: Key, rank: number) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const start = () => {
      const img = new Image()
      img.src = src
      // A browser that can't decode ahead (a rejected `decode` on an image that did load) still gets the image.
      img
        .decode()
        .then(
          () => img,
          () => (img.complete && img.naturalWidth > 0 ? img : Promise.reject(new Error(`Failed to load ${src}`))),
        )
        .then(resolve, reject)
        .finally(() => {
          decoding--
          pump()
        })
    }
    waiting.push({ key, rank, start, drop: () => reject(new Error(`Dropped ${src}`)) })
    pump()
  })

/* ---------------- Silhouettes ---------------- */

/**
 * One frame's silhouette in one color: the white of a hit flash (and the
 * evolution's), a status tint, an elite's or enraged boss's outline. Each is
 * made the first time it's drawn, from that frame alone (fw×fh, about a
 * twentieth of its sheet), and packed into an atlas page shared by all: a
 * frame draws slower the more distinct images it draws from, and a crowd of
 * flashing enemies would draw from hundreds. One made mid-frame draws from its
 * own `loose` canvas until the next task packs it (writing into a page the
 * frame already drew from makes the browser copy the whole page). Past
 * `OVERLAY_PAGES` the least recently drawn silhouette gives its spot to the
 * new one. Whole-sheet silhouettes per color, kept for good, grew past 100 MB
 * of canvases over a run (every species, sheet and status color) until phones
 * killed the tab.
 */
type Overlay = {
  sheet: Sheet
  key: number
  /** Where it's packed; null while it's `loose`. */
  shelf: Shelf | null
  x: number
  loose: HTMLCanvasElement | null
  /** The sweep it was last drawn in. */
  seen: number
  /** Neighbors in the list of packed silhouettes, least recently drawn first. */
  older: Overlay | null
  newer: Overlay | null
}

/** A row of a page's silhouettes, as tall as its tallest: filled left to right, then its freed spots reused. */
type Shelf = { page: Page; y: number; h: number; end: number; free: { x: number; w: number }[] }

/** An atlas page: shelves of silhouettes, stacked top to bottom, `count` of them packed there now. */
type Page = { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; shelves: Shelf[]; top: number; count: number }

/** A page's side, in px: 1 MB of pixels, room for about 180 frames of a common species (the biggest frame is 144 px). */
const PAGE = 512
/** Clear px between silhouettes, so no sampling ever bleeds a neighbor in. */
const GAP = 1
/** A shelf takes frames up to this many px shorter than itself, so tall and short frames don't share one. */
const SHELF_SLACK = 6

/**
 * Pages kept at most: 16 MB, a fixed, small slice of a phone's canvas memory
 * (the whole-sheet ones passed 100 MB). A crowded late screen (a dozen species
 * in 8 directions, white-flashed, burning, poisoned, outlined) draws a few MB
 * of silhouettes. A stress of 240 enemies of 8 species, all flashing, outlined
 * and in every status color at once, needs 22 MB: at 16 it redoes a few dozen
 * silhouettes a second and its frames cost what they did with no cap, while
 * at 12 the redoing showed (about 1.5 ms a frame on a 4× slowed CPU).
 */
export const OVERLAY_PAGES = 16
/** Pages kept at most in safe mode (`detail.safe`): half the memory, for some silhouettes redone on a crowded screen. */
const SAFE_OVERLAY_PAGES = 8

/** Sweeps (`sweepSprites`) a silhouette stays undrawn before it's dropped; a page left empty is freed. */
const OVERLAY_IDLE = 10

const pages: Page[] = []
let oldest: Overlay | null = null
let newest: Overlay | null = null
const toPack: Overlay[] = []
let packing = false
/** Silhouettes made so far, for the dev console. */
let made = 0

const unlink = (o: Overlay) => {
  if (o.older) o.older.newer = o.newer
  else if (oldest === o) oldest = o.newer
  if (o.newer) o.newer.older = o.older
  else if (newest === o) newest = o.older
  o.older = null
  o.newer = null
}

const pushNewest = (o: Overlay) => {
  o.older = newest
  if (newest) newest.newer = o
  else oldest = o
  newest = o
}

/** Small ids for the few colors silhouettes come in, so a frame's key stays a small integer. */
const COLOR_IDS = new Map<string, number>()
const colorId = (color: string) => {
  let id = COLOR_IDS.get(color)
  if (id === undefined) COLOR_IDS.set(color, (id = COLOR_IDS.size))
  return id
}

/** `col`, `row` (< 1024, < 8) and the color in one integer, unique within a sheet. */
const overlayKey = (col: number, row: number, color: string) => colorId(color) * 8192 + row * 1024 + col

/** Forgets a silhouette: it's made again when next drawn, and its spot on the page waits for another. */
const evict = (o: Overlay) => {
  unlink(o)
  if (o.sheet.overlays?.get(o.key) === o) o.sheet.overlays.delete(o.key)
  if (o.shelf) {
    o.shelf.free.push({ x: o.x, w: o.sheet.fw })
    o.shelf.page.count--
  }
  o.shelf = null
  if (o.loose) o.loose.width = o.loose.height = 0
  o.loose = null
}

/** Drops a page and frees its pixels right away, without waiting for the garbage collector. */
const freePage = (page: Page) => {
  for (let o = oldest; o; ) {
    const next = o.newer
    if (o.shelf?.page === page) evict(o)
    o = next
  }
  pages.splice(pages.indexOf(page), 1)
  page.canvas.width = 0
  page.canvas.height = 0
}

/** The shelves a `w`×`h` silhouette fits, by height. */
const holds = (s: Shelf, h: number) => s.h >= h && s.h - h <= SHELF_SLACK

/** A free spot for a `w`×`h` silhouette: a freed one, the end of a shelf, a new shelf, or a new page. Null when all is taken. */
const spot = (w: number, h: number): { shelf: Shelf; x: number } | null => {
  for (const page of pages) {
    for (const shelf of page.shelves) {
      if (!holds(shelf, h)) continue
      const i = shelf.free.findIndex((f) => f.w >= w)
      if (i >= 0) return { shelf, x: shelf.free.splice(i, 1)[0]!.x }
      if (shelf.end + w <= PAGE) {
        const x = shelf.end
        shelf.end += w + GAP
        return { shelf, x }
      }
    }
  }
  let page = pages.find((p) => p.top + h <= PAGE)
  if (!page && pages.length < (detail.safe ? SAFE_OVERLAY_PAGES : OVERLAY_PAGES)) {
    const canvas = createCanvas(PAGE, PAGE)
    page = { canvas, ctx: context2d(canvas), shelves: [], top: 0, count: 0 }
    pages.push(page)
  }
  if (!page) return null
  const shelf: Shelf = { page, y: page.top, h, end: w + GAP, free: [] }
  page.shelves.push(shelf)
  page.top += h + GAP
  return { shelf, x: 0 }
}

/**
 * A spot for a `w`×`h` silhouette, freeing the least recently drawn ones that
 * could give theirs (a few hundred looked at, at most); failing that, the
 * least recently drawn page whole.
 */
const claim = (w: number, h: number) => {
  const free = spot(w, h)
  if (free) return free
  let looked = 0
  for (let o = oldest; o && looked < 256; o = o.newer, looked++) {
    if (o.shelf && holds(o.shelf, h) && o.sheet.fw >= w) {
      const shelf = o.shelf
      const x = o.x
      evict(o)
      shelf.free.pop()
      return { shelf, x }
    }
  }
  const page = oldest?.shelf?.page ?? pages[0]!
  freePage(page)
  return spot(w, h)!
}

/** Packs the silhouettes made since the last task into pages, which no frame is drawing from now, and frees their loose canvases. */
const pack = () => {
  packing = false
  for (const o of toPack) {
    const loose = o.loose
    if (!loose) continue
    o.loose = null
    if (o.sheet.overlays?.get(o.key) === o) {
      const { fw, fh } = o.sheet
      const { shelf, x } = claim(fw, fh)
      shelf.page.ctx.clearRect(x, shelf.y, fw, shelf.h)
      shelf.page.ctx.drawImage(loose, x, shelf.y)
      o.shelf = shelf
      o.x = x
      shelf.page.count++
      pushNewest(o)
    }
    loose.width = 0
    loose.height = 0
  }
  toPack.length = 0
}

/** The silhouette of the frame at `col`, `row` of `sheet` in `color`, from its page or made now. */
const overlay = (sheet: Sheet, col: number, row: number, color: string) => {
  const key = overlayKey(col, row, color)
  const o = sheet.overlays?.get(key)
  if (o) {
    o.seen = epoch
    if (o.shelf && o !== newest) {
      unlink(o)
      pushNewest(o)
    }
    return o
  }
  const { fw, fh } = sheet
  made++
  const loose = createCanvas(fw, fh)
  const ctx = context2d(loose)
  ctx.drawImage(sheet.img, col * fw, row * fh, fw, fh, 0, 0, fw, fh)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, fw, fh)
  const fresh: Overlay = { sheet, key, shelf: null, x: 0, loose, seen: epoch, older: null, newer: null }
  ;(sheet.overlays ??= new Map()).set(key, fresh)
  toPack.push(fresh)
  if (!packing) {
    packing = true
    setTimeout(pack, 0)
  }
  return fresh
}

/** Draws a silhouette (`overlay`) of a `fw`×`fh` frame into (dx, dy, dw, dh). */
const blit = (ctx: CanvasRenderingContext2D, o: Overlay, fw: number, fh: number, dx: number, dy: number, dw: number, dh: number) => {
  if (o.shelf) ctx.drawImage(o.shelf.page.canvas, o.x, o.shelf.y, fw, fh, dx, dy, dw, dh)
  else if (o.loose) ctx.drawImage(o.loose, dx, dy, dw, dh)
}

/** Forgets a dropped sheet's silhouettes. */
const releaseOverlays = (sheet: Sheet) => {
  if (sheet.overlays) for (const o of [...sheet.overlays.values()]) evict(o)
  sheet.overlays = null
}

/** Drops the silhouettes not drawn in the last `OVERLAY_IDLE` sweeps and frees the pages that leaves empty, so calm moments and the menus hold few. */
const sweepOverlays = () => {
  while (oldest && oldest.seen < epoch - OVERLAY_IDLE) evict(oldest)
  for (const page of [...pages]) if (page.count === 0) freePage(page)
}

/** The silhouette pages right now, for the dev console. */
export const overlayStats = () => {
  let silhouettes = 0
  for (let o = oldest; o; o = o.newer) silhouettes++
  return { pages: pages.length, max: OVERLAY_PAGES, MB: (pages.length * PAGE * PAGE * 4) / 1048576, silhouettes, made }
}

/* ---------------- Loading and freeing ---------------- */

/** A dropped sheet's `seen`. */
const GONE = -1

/** Counts sweeps (`sweepSprites`); a sheet drawn or asked for takes the current one as its `seen`. */
let epoch = 0

const sheetOf = (img: HTMLImageElement | HTMLCanvasElement, fw: number, fh: number, durations: readonly number[]): Sheet => ({
  img,
  fw,
  fh,
  durations,
  totalTicks: durations.reduce((a, b) => a + b, 0),
  seen: epoch,
  overlays: null,
})

const cache = new Map<Key, SpeciesSprites>()

/** Decoded bytes of the loaded sheets (a missing animation shares the walk's image), and the most since `spriteMemory(true)`. */
let resident = 0
let peak = 0
const bytesOf = (s: SpeciesSprites) => {
  let n = 0
  for (const sheet of new Set(Object.values(s.anims))) n += sheet.img.width * sheet.img.height * 4
  return n
}

/** The loaded sheets' decoded size now and at its peak (MB), for the dev console; `reset` starts a new peak. */
export const spriteMemory = (reset = false) => {
  if (reset) peak = resident
  return { variants: cache.size, MB: +(resident / 1048576).toFixed(1), peakMB: +(peak / 1048576).toFixed(1) }
}

const pending = new Map<Key, Promise<SpeciesSprites>>()
/** Variants whose download failed since the last sweep: not asked for again until then (a flaky connection gets retried, a frame loop doesn't). */
const failed = new Set<Key>()

/**
 * Loads (once) every sheet and the cry URL of a species variant. Concurrent calls share one request;
 * a more urgent one moves its images up the queue (`Urgency`).
 */
export const loadSpecies = (dex: Dex, shiny = false, form?: FormKey, urgency: Urgency = 'shown'): Promise<SpeciesSprites> => {
  const key = cacheKey(dex, shiny, form)
  const cached = cache.get(key)
  if (cached) return Promise.resolve(cached)
  const rank = RANK[urgency]
  const inFlight = pending.get(key)
  if (inFlight) {
    for (const job of waiting) if (job.key === key) job.rank = Math.min(job.rank, rank)
    return inFlight
  }
  const fresh = fetchSpecies(dex, shiny, form, key, rank)
    .then(
      (s) => {
        cache.set(key, s)
        resident += bytesOf(s)
        peak = Math.max(peak, resident)
        return s
      },
      (error: unknown) => {
        failed.add(key)
        throw error
      },
    )
    .finally(() => pending.delete(key))
  pending.set(key, fresh)
  return fresh
}

/** Starts loading a variant in the background unless it's loaded, on its way or just failed. Cheap enough to call every frame. */
const ask = (dex: Dex, shiny: boolean, form?: FormKey) => {
  const key = cacheKey(dex, shiny, form)
  if (!cache.has(key) && !pending.has(key) && !failed.has(key)) void loadSpecies(dex, shiny, form).catch(() => {})
}

/** Frees a dropped image's decoded pixels right away, without waiting for the garbage collector. */
const freeImage = (img: HTMLImageElement | HTMLCanvasElement) => {
  if (img instanceof HTMLImageElement) img.removeAttribute('src')
}

const fetchSpecies = async (dex: Dex, shiny: boolean, form: FormKey | undefined, key: Key, rank: number): Promise<SpeciesSprites> => {
  const variant = manifestVariant(dex, shiny, form)
  const anims = variant?.anims
  const walkMeta = anims?.Walk
  if (!anims || !walkMeta) throw new Error(`Missing ${shiny ? 'shiny ' : ''}${form ?? ''} sprites for #${dex}. Run npm run assets.`)
  const dir = variantBase(dex, shiny, form)
  const loadSheet = async (name: AnimName, meta: { frameWidth: number; frameHeight: number; durations: number[] }) =>
    sheetOf(await loadImage(`${dir}/${name}.png`, key, rank), meta.frameWidth, meta.frameHeight, meta.durations)
  // A missing animation plays the walk: the same sheet, not a second copy of its image.
  const walk = loadSheet('Walk', walkMeta)
  const [Walk, Idle, Hurt, Fly] = await Promise.allSettled([
    walk,
    anims.Idle ? loadSheet('Idle', anims.Idle) : walk,
    anims.Hurt ? loadSheet('Hurt', anims.Hurt) : walk,
    anims.Fly ? loadSheet('Fly', anims.Fly) : null,
  ])
  if (Walk.status === 'rejected' || Idle.status === 'rejected' || Hurt.status === 'rejected' || Fly.status === 'rejected') {
    // Half a species is no use: the sheets that did land go too.
    for (const r of [Walk, Idle, Hurt, Fly]) if (r.status === 'fulfilled' && r.value) freeImage(r.value.img)
    throw new Error(`Failed to load ${dir}`)
  }
  return {
    dex,
    anims: { Walk: Walk.value, Idle: Idle.value, Hurt: Hurt.value, ...(Fly.value && { Fly: Fly.value }) },
    portrait: portraitUrl(dex, shiny),
    cry: cryUrl(dex, form),
    // A form's own body only places its sheets; hitboxes keep the species' `bodyOf`.
    ...((form && variant.body) || bodyOf(dex, shiny)),
  }
}

/**
 * A species' sheets a run may want: its normal or shiny colors, in its own look or an
 * alternate form's (any key: one the manifest lacks loads nothing, `streamSprites`).
 */
export type Variant = { dex: Dex; shiny: boolean; form?: string }

/** A variant as it loads: a form the manifest lacks (a Mega SpriteCollab hasn't drawn) as nothing, shiny colors it lacks as the normal ones, as `sprites` would draw it. */
type Loadable = { dex: Dex; shiny: boolean; form: Form | undefined }
const loadable = (v: Variant): Loadable[] => {
  const form = v.form === undefined ? undefined : formOf(v.dex, v.form)
  if ((v.form !== undefined && !form) || !manifestVariant(v.dex, false, form)) return []
  return [{ dex: v.dex, shiny: v.shiny && manifestVariant(v.dex, true, form) !== undefined, form }]
}

/** Loads these variants first in the queue, for a loading screen; one that fails is left to its stand-in (a puff), never holding the run back. */
export const loadAll = async (variants: readonly Variant[]) => {
  await Promise.allSettled(variants.flatMap(loadable).map((v) => loadSpecies(v.dex, v.shiny, v.form, 'now')))
}

/** Loads shiny forms in the background. Until one is ready, `sprites` falls back to the normal form. */
export const preloadShinies = (dexes: readonly Dex[]) =>
  Promise.allSettled(dexes.filter(hasShiny).map((dex) => loadSpecies(dex, true, undefined, 'ahead')))

/** What the background stream loads next, soonest needed first (`streamSprites`). */
let queue: readonly Loadable[] = []
let streaming = false

const missing = (v: Loadable) => {
  const key = cacheKey(v.dex, v.shiny, v.form)
  return !cache.has(key) && !failed.has(key)
}

/**
 * Loads these variants one after another in the background, in this order,
 * so they don't hog the network or decode all at once. A new call replaces
 * the list: the shell hands over what's needed now and next, every few
 * seconds, and what's no longer needed is never fetched.
 */
export const streamSprites = (variants: readonly Variant[]) => {
  queue = variants.flatMap(loadable)
  if (streaming) return
  streaming = true
  void (async () => {
    for (let next = queue.find(missing); next !== undefined; next = queue.find(missing)) await loadSpecies(next.dex, next.shiny, next.form, 'ahead').catch(() => {})
    streaming = false
  })()
}

/** What a sweep keeps however long since it was drawn: species whose normal colors stay, and species whose every loaded variant (shiny, forms) stays. */
export type KeepSprites = { species: ReadonlySet<Dex>; variants: ReadonlySet<Dex> }

/**
 * Frees every loaded species variant not drawn nor asked for (`sprites`) in the
 * last `idle` sweeps and not in `keep`: its silhouettes, and its images, whose
 * decoded pixels go right away. Anything still holding one draws nothing with
 * it (`GONE`), and asking again (`sprites`, `loadSpecies`) reloads it from the
 * HTTP cache, with the dust puff standing in meanwhile. The shell sweeps every
 * few seconds, so a run holds its current and next stages, not all it met.
 */
export const sweepSprites = (keep: KeepSprites, idle: number) => {
  epoch++
  failed.clear()
  for (const [key, s] of cache) {
    const variant = typeof key === 'string' || key % 2 === 1
    if (keep.variants.has(s.dex) || (!variant && keep.species.has(s.dex))) continue
    const { Walk, Idle, Hurt, Fly } = s.anims
    if (Math.max(Walk.seen, Idle.seen, Hurt.seen, Fly?.seen ?? GONE) >= epoch - idle) continue
    cache.delete(key)
    resident -= bytesOf(s)
    for (const sheet of new Set([Walk, Idle, Hurt, Fly])) {
      if (!sheet) continue
      sheet.seen = GONE
      releaseOverlays(sheet)
      freeImage(sheet.img)
    }
  }
  // After the sheets, so the pages their silhouettes leave empty go now.
  sweepOverlays()
}

/**
 * Lets go of every sheet but `keep`'s at once and of the loads still waiting
 * their turn, once the images already decoding land: a run frees the lobby's
 * art before it loads its own, so a phone never holds both. Whatever asks
 * again reloads it (back from the run, the lobby streams its own again).
 */
export const releaseSprites = async (keep: KeepSprites) => {
  queue = []
  for (const job of waiting.splice(0)) job.drop()
  await Promise.allSettled([...pending.values()])
  sweepSprites(keep, 0)
}

/** The images (or shrunk canvases) behind a species' sheets. */
const sheetImages = (s: SpeciesSprites | undefined) => (s ? Object.values(s.anims).map((sheet) => sheet?.img) : [])

/**
 * The downloaded sheets held right now (each image once: a missing animation shares the walk's)
 * and their decoded pixels in bytes (w×h×4), for the crash watch and `run_end`.
 */
export const sheetStats = () => {
  const seen = new Set<HTMLImageElement>()
  let bytes = 0
  for (const s of cache.values()) {
    for (const img of sheetImages(s)) {
      if (!(img instanceof HTMLImageElement) || seen.has(img)) continue
      seen.add(img)
      bytes += img.naturalWidth * img.naturalHeight * 4
    }
  }
  return { sheets: seen.size, bytes }
}

/** A puff of dust, drawn in place of a species that hasn't finished downloading. */
const PUFF = [
  '...1111.....',
  '..122221.11.',
  '.12233321221',
  '123333333321',
  '123333333331',
  '.1233333321.',
  '..11222211..',
  '....1111....',
]

let puff: Sheet | null = null
const standIns = new Map<Dex, SpeciesSprites>()

// A GPU reset blanks the silhouettes and the puff, all canvases. The sheets are images and
// survive, so the silhouettes are made again from them when next drawn.
onCanvasReset(
  () => {
    for (const page of [...pages]) freePage(page)
    for (const o of toPack) evict(o)
    puff = null
    standIns.clear()
  },
  () => [pages.map((p) => p.canvas), toPack.map((o) => o.loose), puff?.img],
)

/* ---------------- Fitting big sprites ---------------- */

/**
 * One frame of a sheet shrunk by `k` (< 1) the pixel-art way: each pixel of
 * the smaller frame takes the commonest opaque color of the block it covers
 * (the darker one on a tie, so outlines hold), or stays clear when most of the
 * block is. Hard-edged, no blending.
 */
const shrinkFrame = (src: ImageData, sx: number, sy: number, fw: number, fh: number, out: ImageData, ox: number, oy: number, w: number, h: number) => {
  const counts = new Map<number, number>()
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const x0 = sx + Math.floor((x * fw) / w)
      const x1 = sx + Math.max(Math.floor((x * fw) / w) + 1, Math.floor(((x + 1) * fw) / w))
      const y0 = sy + Math.floor((y * fh) / h)
      const y1 = sy + Math.max(Math.floor((y * fh) / h) + 1, Math.floor(((y + 1) * fh) / h))
      counts.clear()
      let opaque = 0
      for (let yy = y0; yy < y1; yy++) {
        for (let xx = x0; xx < x1; xx++) {
          const i = (yy * src.width + xx) * 4
          if (src.data[i + 3]! < 128) continue
          opaque++
          const rgb = (src.data[i]! << 16) | (src.data[i + 1]! << 8) | src.data[i + 2]!
          counts.set(rgb, (counts.get(rgb) ?? 0) + 1)
        }
      }
      if (opaque * 2 < (x1 - x0) * (y1 - y0)) continue
      let best = 0
      let most = 0
      for (const [rgb, n] of counts) {
        const darker = ((rgb >> 16) & 255) + ((rgb >> 8) & 255) + (rgb & 255) < ((best >> 16) & 255) + ((best >> 8) & 255) + (best & 255)
        if (n > most || (n === most && darker)) [best, most] = [rgb, n]
      }
      const o = ((oy + y) * out.width + ox + x) * 4
      out.data[o] = (best >> 16) & 255
      out.data[o + 1] = (best >> 8) & 255
      out.data[o + 2] = best & 255
      out.data[o + 3] = 255
    }
  }
}

/** A whole sheet shrunk frame by frame (`shrinkFrame`). */
const shrinkSheet = (sheet: Sheet, k: number): Sheet => {
  const cols = Math.round(sheet.img.width / sheet.fw)
  const rows = Math.round(sheet.img.height / sheet.fh)
  const fw = Math.max(1, Math.round(sheet.fw * k))
  const fh = Math.max(1, Math.round(sheet.fh * k))
  const scratch = createCanvas(sheet.img.width, sheet.img.height)
  const read = context2d(scratch)
  read.drawImage(sheet.img, 0, 0)
  const src = read.getImageData(0, 0, sheet.img.width, sheet.img.height)
  scratch.width = 0
  scratch.height = 0
  const canvas = createCanvas(cols * fw, rows * fh)
  const ctx = context2d(canvas)
  const out = ctx.createImageData(canvas.width, canvas.height)
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) shrinkFrame(src, c * sheet.fw, r * sheet.fh, sheet.fw, sheet.fh, out, c * fw, r * fh, fw, fh)
  ctx.putImageData(out, 0, 0)
  return sheetOf(canvas, fw, fh, sheet.durations)
}

let fits = new WeakMap<SpeciesSprites, SpeciesSprites>()
onCanvasReset(
  () => {
    fits = new WeakMap()
  },
  () => [...cache.values()].map((s) => sheetImages(fits.get(s))),
)

/**
 * Sprites no wider than `maxW` px of body: a bigger species (Lugia's wings
 * span 79 px) is shrunk once, the pixel-art way, and cached. A wide, flat one
 * (Moltres's flaming wings) only shrinks down to `minH` px of body height, so
 * a wingspan doesn't leave it smaller than its peers. Smaller ones and the
 * dust puff of a species still downloading come back as they are.
 */
export const fitSprites = (s: SpeciesSprites, maxW: number, minH = 0): SpeciesSprites => {
  const k = Math.min(1, Math.max(maxW / s.bodyW, minH / s.bodyH))
  if (k >= 1 || standIns.get(s.dex) === s) return s
  let fit = fits.get(s)
  if (!fit) {
    const { Walk, Idle, Hurt, Fly } = s.anims
    fit = {
      ...s,
      anims: { Walk: shrinkSheet(Walk, k), Idle: shrinkSheet(Idle, k), Hurt: shrinkSheet(Hurt, k), ...(Fly && { Fly: shrinkSheet(Fly, k) }) },
      footY: Math.round(s.footY * k),
      bodyW: Math.round(s.bodyW * k),
      bodyH: Math.round(s.bodyH * k),
    }
    fits.set(s, fit)
  }
  return fit
}

/** Stand-in sprites for `dex`, which also starts (once) downloading the real ones. */
const pendingSprites = (dex: Dex): SpeciesSprites => {
  ask(dex, false)
  let s = standIns.get(dex)
  if (!s) {
    if (!puff) {
      const frame = fromStrings(PUFF, { 1: '#6c7058', 2: '#b0b098', 3: '#e0e0c8' })
      const img = createCanvas(frame.width, frame.height * 8)
      for (let row = 0; row < 8; row++) context2d(img).drawImage(frame, 0, row * frame.height)
      puff = sheetOf(img, frame.width, frame.height, [60])
    }
    // The puff stands where the Pokémon will: same feet and body as its real sprite.
    s = { dex, anims: { Walk: puff, Idle: puff, Hurt: puff }, portrait: portraitUrl(dex), cry: cryUrl(dex), ...bodyOf(dex) }
    standIns.set(dex, s)
  }
  return s
}

/** An alternate form's sprites if loaded; otherwise starts (once) loading them and returns undefined. */
const formSprites = (dex: Dex, shiny: boolean, form: FormKey) => {
  const s = cache.get(cacheKey(dex, shiny, form))
  if (!s && manifestVariant(dex, shiny, form)) ask(dex, shiny, form)
  return s
}

/** A shiny's sprites if loaded; otherwise starts loading them (when SpriteCollab has the colors) and returns undefined. */
const shinySprites = (dex: Dex) => {
  const s = cache.get(dex * 2 + 1)
  if (!s && hasShiny(dex)) ask(dex, true)
  return s
}

/**
 * Sprites of a species variant: a shiny form SpriteCollab lacks (Mega Tyranitar) wears the form's
 * normal colors, an alternate form falls back to the species' own colors, a shiny to the normal
 * colors (until its own download, started here, lands), then to a dust puff while it downloads.
 * Asking keeps them loaded (`sweepSprites`). Never throws.
 */
export const sprites = (dex: Dex, shiny = false, form?: FormKey) => {
  const s =
    (form && (formSprites(dex, shiny, form) || (shiny && !manifestVariant(dex, true, form) && formSprites(dex, false, form)))) ||
    (shiny && shinySprites(dex)) ||
    cache.get(dex * 2) ||
    pendingSprites(dex)
  s.anims.Walk.seen = epoch
  return s
}

export const portraitUrl = (dex: Dex, shiny = false) =>
  `${variantBase(dex, shiny && MANIFEST[String(dex)]?.shiny?.portrait === true)}/portrait.png`

/** A species' Walk sheet and frame size, for DOM art drawn from its first frame (facing down). */
export const walkSheet = (dex: Dex) => {
  const walk = MANIFEST[String(dex)]?.anims.Walk
  return walk && { url: `${base(dex)}/Walk.png`, fw: walk.frameWidth, fh: walk.frameHeight }
}

/** Sprites if already loaded, without throwing (menus draw progressively). Unlike `sprites`, asking doesn't keep them: drawing does. */
export const loadedSprites = (dex: Dex, shiny = false): SpeciesSprites | undefined => cache.get(cacheKey(dex, shiny))

/** A species' cry, or its form's own (Megas) when PokeAPI has one. */
export const cryUrl = (dex: Dex, form?: FormKey) =>
  form && MANIFEST[String(dex)]?.formCries?.includes(form) ? `${base(dex)}/${form}/cry.ogg` : `${base(dex)}/cry.ogg`

/** True when a form has sheets of its own; without them `sprites` draws the normal form. */
export const hasSheets = (dex: Dex, form: FormKey) => manifestVariant(dex, false, form) !== undefined

const frameIndex = (sheet: Sheet, seconds: number, loop: boolean) => {
  let tick = Math.floor(seconds * 60)
  tick = loop ? tick % sheet.totalTicks : Math.min(tick, sheet.totalTicks - 1)
  for (let i = 0; i < sheet.durations.length; i++) {
    tick -= sheet.durations[i]!
    if (tick < 0) return i
  }
  return sheet.durations.length - 1
}

export type DrawOpts = {
  /** 0..1 white overlay strength (hit flash). 1 = full silhouette. */
  flash?: number
  alpha?: number
  loop?: boolean
  /** Integer upscale (evolution scene, menus). */
  scale?: number
  /** Colored overlay (status conditions); `amount` is 0..1 opacity. */
  tint?: { color: string; amount: number }
  /** A hard 1 px outline in this color around the silhouette (elites, enraged bosses). */
  outline?: string
}

/** The hit flash's color. */
const WHITE = '#fff'

/**
 * Draws a species at its feet position (x, y). Its flash, tint and outline are
 * the frame's silhouettes (`overlay`). Sprites dropped by a sweep draw nothing.
 */
export const drawPokemon = (
  ctx: CanvasRenderingContext2D,
  s: SpeciesSprites,
  anim: AnimName,
  dir: Dir8,
  seconds: number,
  x: number,
  y: number,
  opts: DrawOpts = {},
) => {
  const sheet = s.anims[anim] ?? s.anims.Walk
  if (sheet.seen === GONE) return
  sheet.seen = epoch
  const frame = frameIndex(sheet, seconds, opts.loop ?? true)
  const k = opts.scale ?? 1
  const dw = sheet.fw * k
  const dh = sheet.fh * k
  const dx = Math.round(x - dw / 2)
  const dy = Math.round(y - (s.footY + sheet.fh / 2) * k)
  const alpha = opts.alpha ?? 1
  const flash = opts.flash ?? 0
  if (alpha !== 1) ctx.globalAlpha = alpha
  const { fw, fh } = sheet
  if (opts.outline) {
    const edge = overlay(sheet, frame, dir, opts.outline)
    blit(ctx, edge, fw, fh, dx - 1, dy, dw, dh)
    blit(ctx, edge, fw, fh, dx + 1, dy, dw, dh)
    blit(ctx, edge, fw, fh, dx, dy - 1, dw, dh)
    blit(ctx, edge, fw, fh, dx, dy + 1, dw, dh)
  }
  if (flash < 1) ctx.drawImage(sheet.img, frame * fw, dir * fh, fw, fh, dx, dy, dw, dh)
  const tint = opts.tint
  if (tint && tint.amount > 0 && flash < 1) {
    ctx.globalAlpha = alpha * Math.min(1, tint.amount)
    blit(ctx, overlay(sheet, frame, dir, tint.color), fw, fh, dx, dy, dw, dh)
  }
  if (flash > 0) {
    ctx.globalAlpha = alpha * Math.min(1, flash)
    blit(ctx, overlay(sheet, frame, dir, WHITE), fw, fh, dx, dy, dw, dh)
  }
  ctx.globalAlpha = 1
}

/** `key` as one of `dex`'s alternate forms (a boss phase's `form`), if the manifest has it. */
export const formOf = (dex: Dex, key: string | undefined): Form | undefined =>
  key !== undefined && MANIFEST[String(dex)]?.forms?.[key] ? (key as Form) : undefined
