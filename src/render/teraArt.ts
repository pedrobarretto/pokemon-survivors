import { TERA_TYPES, type TeraType } from '../data/tera'
import { canvasCache, context2d, createCanvas, fromStrings, readPixels, type PixelSprite } from '../engine/pixelart'
import { outlined, toIconUrl } from './art'
import { CROWNS, SMALL_CROWNS, type CrownSize } from './teraCrowns'
import { placeFrame, type AnimName, type FramePlace, type Sheet, type SpeciesSprites } from './sprites'

/**
 * Terastal's art: each Tera type's crystal ramp, its crown (`teraCrowns.ts`)
 * and the crystal a Terastallized Pokémon turns into. The crystal is made from
 * each sprite frame's own pixels (`crystalOf`): the body is cut into facets
 * (a Voronoi of seeds fixed to the frame, so they hold still as it walks), each
 * facet lit or shaded by its own tilt, its colors pulled toward the type's
 * ramp, the facets' edges drawn as bright 1 px lines and the outline in the
 * ramp's dark, all on the pixel grid and opaque. Frames are made once and
 * cached per sheet; a glint sweeping across and twinkles on the facets' corners
 * are drawn on top each frame (left out drawing lean).
 */

/** A crystal ramp: `o` outline, `1`..`4` shadow to glint, `5`/`6` an accent and its shadow. */
export type Ramp = { o: string; 1: string; 2: string; 3: string; 4: string; 5: string; 6: string }

export const TERA_RAMPS: Record<TeraType, Ramp> = {
  normal: { o: '#2c2c1c', 1: '#76765a', 2: '#aeae86', 3: '#dcdcb8', 4: '#ffffff', 5: '#f0c848', 6: '#a87818' },
  fire: { o: '#401008', 1: '#b03c14', 2: '#f07830', 3: '#f8b860', 4: '#fff8d8', 5: '#f8e050', 6: '#a85820' },
  water: { o: '#0c1848', 1: '#2848b0', 2: '#4c88f0', 3: '#98c8f8', 4: '#ffffff', 5: '#60e0f8', 6: '#2080b0' },
  grass: { o: '#0c2808', 1: '#2c7424', 2: '#58b444', 3: '#a4e070', 4: '#f0ffd0', 5: '#f8d048', 6: '#c07818' },
  electric: { o: '#3c2800', 1: '#b08800', 2: '#f0c820', 3: '#f8f080', 4: '#ffffff', 5: '#606878', 6: '#383c48' },
  ice: { o: '#103040', 1: '#3a84a4', 2: '#70c4dc', 3: '#bcf0f8', 4: '#ffffff', 5: '#e0f8ff', 6: '#78b8d0' },
  fighting: { o: '#300808', 1: '#8a1c14', 2: '#c43428', 3: '#f07858', 4: '#fff0e0', 5: '#f8c840', 6: '#b07818' },
  poison: { o: '#280830', 1: '#682470', 2: '#a444a4', 3: '#d888dc', 4: '#fff0ff', 5: '#88e858', 6: '#3c8828' },
  ground: { o: '#382408', 1: '#946c24', 2: '#d0a850', 3: '#f0d898', 4: '#fff8e0', 5: '#b85c2c', 6: '#7c3418' },
  flying: { o: '#201848', 1: '#5c54b4', 2: '#9890f0', 3: '#cccaf8', 4: '#ffffff', 5: '#88e0f8', 6: '#3890b8' },
  psychic: { o: '#400820', 1: '#b02c64', 2: '#f85888', 3: '#f8acc8', 4: '#ffffff', 5: '#a878f8', 6: '#6040b0' },
  bug: { o: '#202808', 1: '#647414', 2: '#a8b820', 3: '#d8e868', 4: '#f8ffe0', 5: '#e05030', 6: '#902818' },
  rock: { o: '#2c2008', 1: '#7c6424', 2: '#b8a038', 3: '#e0d088', 4: '#fff8e0', 5: '#90c0f0', 6: '#4878b8' },
  ghost: { o: '#180c28', 1: '#44346c', 2: '#705898', 3: '#a890d0', 4: '#f0e8ff', 5: '#70e8f8', 6: '#2878a8' },
  dragon: { o: '#100840', 1: '#3c1ca8', 2: '#7038f8', 3: '#a888f8', 4: '#f0e8ff', 5: '#f8c840', 6: '#a87018' },
  dark: { o: '#100808', 1: '#3c2c24', 2: '#705848', 3: '#a89080', 4: '#f0e0d0', 5: '#f84060', 6: '#982038' },
  steel: { o: '#202030', 1: '#6c6c84', 2: '#a8a8c0', 3: '#d8d8e8', 4: '#ffffff', 5: '#58c8e0', 6: '#287890' },
  fairy: { o: '#401828', 1: '#c05878', 2: '#ee99ac', 3: '#f8c8d8', 4: '#ffffff', 5: '#f8e060', 6: '#c09018' },
  stellar: { o: '#140c38', 1: '#5848b0', 2: '#9c90e8', 3: '#d8d0f8', 4: '#ffffff', 5: '#f8e060', 6: '#c06090' },
}

/** Stellar's seven crystals, red to violet, for its crown's `a`..`f` and its facets. */
export const STELLAR = ['#f85858', '#f8a838', '#f8e858', '#58e898', '#58a8f8', '#a878f8'] as const

/* ---------------- Crowns ---------------- */

/** A crown's art and its white stamp (the glint's), outlined in the ramp's dark. */
export type CrownArt = { sprite: PixelSprite; shine: HTMLCanvasElement; tipX: number; tipY: number }

const crowns = canvasCache<`${TeraType}:${CrownSize}`, CrownArt>()

/** The crown's tones (`teraCrowns.ts`): the ramp, a white glint, a deep crevice, the accent and Stellar's seven crystals. */
const crownColors = (type: TeraType) => {
  const r = TERA_RAMPS[type]
  const [R, O, Y, G, B, V] = STELLAR
  const [o, one] = [hex(r.o), hex(r[1])]
  const deep = `rgb(${mixRgb(o, one, 0.45).map(Math.round).join(',')})`
  return { 1: r[1], 2: r[2], 3: r[3], 4: r[4], w: '#ffffff', d: deep, a: r[5], b: r[6], R, O, Y, G, B, V }
}

/** A type's crown (its full size, or the small one for a small head) and its white stamp. */
export const crownArt = (type: TeraType, size: CrownSize = 'full'): CrownArt => {
  const key = `${type}:${size}` as const
  let art = crowns.get(key)
  if (!art) {
    const rows = (size === 'small' ? SMALL_CROWNS : CROWNS)[type]
    const sprite = outlined(fromStrings(rows, crownColors(type)), TERA_RAMPS[type].o)
    const shine = createCanvas(sprite.width, sprite.height)
    const s = context2d(shine)
    s.drawImage(sprite, 0, 0)
    s.globalCompositeOperation = 'source-in'
    s.fillStyle = '#ffffff'
    s.fillRect(0, 0, sprite.width, sprite.height)
    // Its tallest point, where a twinkle catches (the outline shifts it a pixel).
    const top = rows.findIndex((r) => /[^.]/.test(r))
    const cols = [...rows[top]!].flatMap((c, i) => (c === '.' ? [] : [i]))
    crowns.set(key, (art = { sprite, shine, tipX: cols[cols.length >> 1]! + 1, tipY: top + 1 }))
  }
  return art
}

/** A type's crown as a sprite. */
export const crownSprite = (type: TeraType, size: CrownSize = 'full'): PixelSprite => crownArt(type, size).sprite

/** A type's crown as an icon (the TERA button, toasts, the den's sign). */
export const crownIcon = (type: TeraType) => toIconUrl(`crown:${type}`, () => crownSprite(type))

/**
 * Draws a crown with its setting's bottom row on (cx, bottom), `scale` times
 * its size, a glint sweeping it on the body's beat (`glint` 0..1 while one
 * crosses, else -1) and, now and then, a twinkle on its tallest point.
 */
export const drawCrown = (
  ctx: CanvasRenderingContext2D, type: TeraType, cx: number, bottom: number, scale: number, glint: number, t: number, size: CrownSize = 'full',
) => {
  const { sprite, shine, tipX, tipY } = crownArt(type, size)
  const w = sprite.width
  const h = sprite.height
  // The outline adds a row under the setting: it hangs below the seat.
  const dx = Math.round(cx - (w * scale) / 2)
  const dy = Math.round(bottom - (h - 1) * scale)
  ctx.drawImage(sprite, dx, dy, w * scale, h * scale)
  if (glint >= 0) drawGlint(ctx, { shine }, dx, dy, scale, glint)
  if (Math.floor(t * 2.5) % 4 === 0) {
    ctx.fillStyle = '#ffffff'
    const x = dx + tipX * scale
    const y = dy + tipY * scale
    ctx.fillRect(x - scale, y, scale * 3, scale)
    ctx.fillRect(x, y - scale, scale, scale * 3)
  }
}

/** Every crown, for the dev gallery and warming. */
export const ALL_CROWNS = TERA_TYPES

/* ---------------- Crystal frames ---------------- */

/** A frame turned to crystal: its pixels, a white stamp of it (the glint's), the corners where facets meet (twinkles) and its top row. */
export type CrystalFrame = { canvas: HTMLCanvasElement; shine: HTMLCanvasElement; corners: Int16Array; top: number }

/** Seed spacing (px) of the facets. */
const CELL = 8

/** Integer hash → [0, 1); the facets' seeds and tilts, the same every frame. */
const hash = (x: number, y: number, k: number) => {
  let h = (x * 374761393 + y * 668265263 + k * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

const hex = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)] as const

type Rgb = readonly [number, number, number]
const RAMP_RGB = new Map<TeraType, { o: Rgb; tones: readonly Rgb[] }>()
const rampRgb = (type: TeraType) => {
  let r = RAMP_RGB.get(type)
  if (!r) {
    const ramp = TERA_RAMPS[type]
    r = { o: hex(ramp.o), tones: [hex(ramp[1]), hex(ramp[2]), hex(ramp[3]), hex(ramp[4])] }
    RAMP_RGB.set(type, r)
  }
  return r
}
const STELLAR_RGB = STELLAR.map(hex)

/** The nearest two facet seeds to (x, y): which facet it's in, and how close the next one is (an edge under 1). */
const facetAt = (x: number, y: number) => {
  const cx = Math.floor(x / CELL)
  const cy = Math.floor(y / CELL)
  let best = Infinity
  let next = Infinity
  let id = 0
  for (let j = cy - 1; j <= cy + 1; j++) {
    for (let i = cx - 1; i <= cx + 1; i++) {
      const sx = (i + 0.15 + hash(i, j, 1) * 0.7) * CELL
      const sy = (j + 0.15 + hash(i, j, 2) * 0.7) * CELL
      const d = Math.hypot(x - sx, y - sy)
      if (d < best) {
        next = best
        best = d
        id = (i & 0xffff) * 65536 + (j & 0xffff)
      } else if (d < next) next = d
    }
  }
  return { id, edge: next - best }
}

/** A facet's light: -1 turned away, 0 side-on, 1 toward the light (the top left). */
const facetLight = (id: number) => {
  const t = hash(id >>> 16, id & 0xffff, 3)
  return t < 0.3 ? -1 : t < 0.6 ? 0 : 1
}

const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]

/**
 * Turns a frame's RGBA (`w`×`h`) into crystal, in place: keeps the sprite's
 * darkest lines (eyes, the outline) in the ramp's dark, pulls every other
 * pixel toward the ramp tone its brightness and facet light give (`pull` of
 * the way, so the Pokémon's own colors still show through, as gems do), and
 * draws the facets' edges a tone brighter on the lit side. Pure: it only
 * reads and writes `px`. Returns the corners where three facets meet (x, y
 * pairs) and the frame's top opaque row.
 */
export const crystalize = (px: Uint8ClampedArray, w: number, h: number, type: TeraType, pull = 0.84) => {
  const { o, tones } = rampRgb(type)
  const corners: number[] = []
  let top = h
  const opaque = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && px[(y * w + x) * 4 + 3]! > 96
  const facets = new Int32Array(w * h).fill(-1)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) if (opaque(x, y)) facets[y * w + x] = facetAt(x + 0.5, y + 0.5).id
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!opaque(x, y)) {
        px[i + 3] = 0
        continue
      }
      top = Math.min(top, y)
      const lum = (px[i]! * 0.3 + px[i + 1]! * 0.55 + px[i + 2]! * 0.15) / 255
      const rim = !opaque(x - 1, y) || !opaque(x + 1, y) || !opaque(x, y - 1) || !opaque(x, y + 1)
      let out: Rgb
      // The silhouette's outline and the sprite's darkest lines (its eyes, its inner lines) stay dark.
      if (rim || lum < 0.12) out = o
      else {
        const id = facets[y * w + x]!
        const light = facetLight(id)
        const base = lum < 0.33 ? 0 : lum < 0.66 ? 1 : 2
        const tone = Math.max(0, Math.min(3, base + light))
        const up = facets[(y - 1) * w + x]
        const left = facets[y * w + x - 1]
        const edge = (up !== undefined && up >= 0 && up !== id) || (left !== undefined && left >= 0 && left !== id)
        const own: Rgb = [px[i]!, px[i + 1]!, px[i + 2]!]
        if (type === 'stellar') {
          // Stellar is a prism: the Pokémon's own colors, each facet lit or shaded, its edges in the seven crystals.
          out = edge ? STELLAR_RGB[Math.floor(hash(id >>> 16, id & 0xffff, 5) * STELLAR_RGB.length)]! : light > 0 ? mixRgb(own, tones[3]!, 0.35) : light < 0 ? mixRgb(own, tones[0]!, 0.3) : own
        } else {
          // A facet's edge is a bright line: white-hot where the facet faces the light, a shade darker where it turns away.
          out = edge ? tones[light > 0 ? 3 : light === 0 ? 2 : 1]! : mixRgb(own, tones[tone]!, pull)
        }
        // Where three facets meet inside the body, a twinkle may catch the light.
        const diag = facets[(y - 1) * w + x - 1]
        if (edge && up !== left && diag !== undefined && diag >= 0 && diag !== id && diag !== up && hash(x, y, 7) < 0.5) corners.push(x, y)
      }
      px[i] = Math.round(out[0])
      px[i + 1] = Math.round(out[1])
      px[i + 2] = Math.round(out[2])
      px[i + 3] = 255
    }
  }
  return { corners: Int16Array.from(corners), top: top === h ? 0 : top }
}

const TYPE_INDEX = new Map(TERA_TYPES.map((t, i) => [t, i]))

/** Crystal frames by sheet; a sheet dropped by a sweep takes its frames with it. */
let frames = new WeakMap<Sheet, Map<number, CrystalFrame>>()
/** Frames made, oldest first, so the cache stays small (`MAX_FRAMES`). */
const made: { sheet: Sheet; key: number }[] = []
/** About 2 MB of crystal: a few Pokémon's walks in every direction, two types each. */
const MAX_FRAMES = 320

let reader: CanvasRenderingContext2D | null = null

/** The pixel reader: a context that keeps its pixels on the CPU, as `getImageData` wants. */
const readerFor = (w: number, h: number) => {
  if (!reader) {
    const c = createCanvas(w, h)
    reader = c.getContext('2d', { willReadFrequently: true })
  }
  if (!reader) return null
  const c = reader.canvas
  if (c.width < w || c.height < h) {
    c.width = Math.max(c.width, w)
    c.height = Math.max(c.height, h)
  }
  reader.imageSmoothingEnabled = false
  reader.clearRect(0, 0, c.width, c.height)
  return reader
}

const forget = () => {
  const old = made.shift()
  if (!old) return
  const set = frames.get(old.sheet)
  const f = set?.get(old.key)
  if (!f) return
  set!.delete(old.key)
  f.canvas.width = f.canvas.height = f.shine.width = f.shine.height = 0
}

/** Frame `frame` of `sheet` facing `dir` in `type`'s crystal, made on first use; null when its pixels can't be read. */
export const crystalOf = (sheet: Sheet, frame: number, dir: number, type: TeraType): CrystalFrame | null => {
  const key = (TYPE_INDEX.get(type)! * 8 + dir) * 1024 + frame
  let set = frames.get(sheet)
  const held = set?.get(key)
  if (held) return held
  const { fw, fh } = sheet
  const ctx = readerFor(fw, fh)
  if (!ctx) return null
  try {
    ctx.drawImage(sheet.img, frame * fw, dir * fh, fw, fh, 0, 0, fw, fh)
  } catch {
    return null
  }
  const data = readPixels(ctx, 0, 0, fw, fh)
  if (!data) return null
  const { corners, top } = crystalize(data.data, fw, fh, type)
  const canvas = createCanvas(fw, fh)
  context2d(canvas).putImageData(data, 0, 0)
  const shine = createCanvas(fw, fh)
  const s = context2d(shine)
  s.drawImage(canvas, 0, 0)
  s.globalCompositeOperation = 'source-in'
  s.fillStyle = '#ffffff'
  s.fillRect(0, 0, fw, fh)
  const out: CrystalFrame = { canvas, shine, corners, top }
  if (!set) frames.set(sheet, (set = new Map()))
  set.set(key, out)
  made.push({ sheet, key })
  while (made.length > MAX_FRAMES) forget()
  return out
}

/** Lets go of every crystal frame (a run ended). */
export const freeCrystals = () => {
  while (made.length > 0) forget()
  for (const c of cut.splice(0)) c.facets.atlas.width = c.facets.atlas.height = c.facets.white.width = c.facets.white.height = 0
  frames = new WeakMap()
}

/** Dev: crystal frames held now. */
export const crystalCount = () => made.length

const place: FramePlace = { anim: 'Walk', fw: 0, fh: 0, frames: 0, frame: 0, dx: 0, dy: 0 }

/**
 * The crystal frame `drawPokemon` would draw for these arguments, with where
 * its top-left lands; null when there's none (a dropped sheet, unreadable pixels).
 */
export const crystalAt = (s: SpeciesSprites, anim: AnimName, dir: number, seconds: number, x: number, y: number, scale: number, loop: boolean, type: TeraType) => {
  if (!placeFrame(s, anim, seconds, x, y, scale, loop, place)) return null
  const sheet = s.anims[place.anim] ?? s.anims.Walk
  const crystal = crystalOf(sheet, place.frame, dir, type)
  return crystal ? { crystal, dx: place.dx, dy: place.dy, fw: place.fw, fh: place.fh } : null
}

/* ---------------- Facets ---------------- */

/** A facet of a crystal frame: its box in the frame and its row in the atlas. */
export type Facet = { x: number; y: number; w: number; h: number; ay: number }

/**
 * A crystal frame cut along its facets (the transformation grows the crystal
 * facet by facet and shatters it into them): each facet's pixels on a row of
 * its own in `atlas` (its white stamp in `white`), in growing order, from the
 * feet up with a little scatter.
 */
export type Facets = { atlas: HTMLCanvasElement; white: HTMLCanvasElement; facets: readonly Facet[]; fw: number; fh: number }

/** The last few frames cut (the transformation shows one or two). */
const cut: { key: CrystalFrame; facets: Facets }[] = []

/** `crystal` cut along its facets, made on first use. */
export const facetsOf = (crystal: CrystalFrame): Facets | null => {
  const held = cut.find((c) => c.key === crystal)
  if (held) return held.facets
  const fw = crystal.canvas.width
  const fh = crystal.canvas.height
  const ctx = readerFor(fw, fh)
  if (!ctx) return null
  ctx.drawImage(crystal.canvas, 0, 0)
  const data = readPixels(ctx, 0, 0, fw, fh)
  if (!data) return null
  const px = data.data
  const boxes = new Map<number, { x0: number; y0: number; x1: number; y1: number; at: number[] }>()
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const i = (y * fw + x) * 4
      if (px[i + 3]! === 0) continue
      const { id } = facetAt(x + 0.5, y + 0.5)
      let b = boxes.get(id)
      if (!b) boxes.set(id, (b = { x0: x, y0: y, x1: x, y1: y, at: [] }))
      b.x0 = Math.min(b.x0, x)
      b.y0 = Math.min(b.y0, y)
      b.x1 = Math.max(b.x1, x)
      b.y1 = Math.max(b.y1, y)
      b.at.push(x, y)
    }
  }
  // From the feet up, facets a row apart scattered a little, so the crystal climbs unevenly.
  const order = [...boxes.entries()].sort(([ia, a], [ib, b]) => b.y1 + hash(ia, 0, 11) * 6 - (a.y1 + hash(ib, 0, 11) * 6))
  const height = order.reduce((n, [, b]) => n + b.y1 - b.y0 + 1, 0)
  const atlas = createCanvas(fw, Math.max(1, height))
  const white = createCanvas(fw, Math.max(1, height))
  const img = context2d(atlas).createImageData(fw, Math.max(1, height))
  const facets: Facet[] = []
  let ay = 0
  for (const [, b] of order) {
    for (let k = 0; k < b.at.length; k += 2) {
      const x = b.at[k]!
      const y = b.at[k + 1]!
      const from = (y * fw + x) * 4
      const to = ((ay + y - b.y0) * fw + x) * 4
      img.data[to] = px[from]!
      img.data[to + 1] = px[from + 1]!
      img.data[to + 2] = px[from + 2]!
      img.data[to + 3] = 255
    }
    facets.push({ x: b.x0, y: b.y0, w: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1, ay })
    ay += b.y1 - b.y0 + 1
  }
  context2d(atlas).putImageData(img, 0, 0)
  const wctx = context2d(white)
  wctx.drawImage(atlas, 0, 0)
  wctx.globalCompositeOperation = 'source-in'
  wctx.fillStyle = '#ffffff'
  wctx.fillRect(0, 0, fw, height)
  const out: Facets = { atlas, white, facets, fw, fh }
  cut.push({ key: crystal, facets: out })
  while (cut.length > 4) {
    const old = cut.shift()!
    old.facets.atlas.width = old.facets.atlas.height = old.facets.white.width = old.facets.white.height = 0
  }
  return out
}

/** Draws facet `f` of `cut` with its frame's top-left at (dx, dy), `scale` times, moved (ox, oy) px; white for a flash. */
export const drawFacet = (ctx: CanvasRenderingContext2D, cut: Facets, f: Facet, dx: number, dy: number, scale: number, ox = 0, oy = 0, white = false) =>
  ctx.drawImage(white ? cut.white : cut.atlas, f.x, f.ay, f.w, f.h, Math.round(dx + f.x * scale + ox), Math.round(dy + f.y * scale + oy), f.w * scale, f.h * scale)

/* ---------------- The glint ---------------- */

let glintCanvas: HTMLCanvasElement | null = null

/**
 * A glint crossing a crystal frame drawn at (dx, dy) times `scale`: a 3 px
 * diagonal band of light at `k` (0..1 across the frame), its edge stepped on the
 * pixel grid, stamped from the frame's white copy.
 */
export const drawGlint = (ctx: CanvasRenderingContext2D, f: Pick<CrystalFrame, 'shine'>, dx: number, dy: number, scale: number, k: number) => {
  const w = f.shine.width
  const h = f.shine.height
  if (!glintCanvas) glintCanvas = createCanvas(w, h)
  if (glintCanvas.width < w || glintCanvas.height < h) {
    glintCanvas.width = Math.max(glintCanvas.width, w)
    glintCanvas.height = Math.max(glintCanvas.height, h)
  }
  const g = context2d(glintCanvas)
  g.globalCompositeOperation = 'source-over'
  g.clearRect(0, 0, glintCanvas.width, glintCanvas.height)
  g.drawImage(f.shine, 0, 0)
  g.globalCompositeOperation = 'destination-in'
  g.fillStyle = '#ffffff'
  // The band leans down to the left, two rows a step, and sweeps left to right.
  const at = Math.round(k * (w + h * 0.5 + 3)) - 3
  for (let y = 0; y < h; y++) g.fillRect(at - (y >> 1) + (h >> 1), y, 3, 1)
  g.globalCompositeOperation = 'source-over'
  ctx.drawImage(glintCanvas, 0, 0, w, h, dx, dy, w * scale, h * scale)
}

/** Twinkles on the facets' corners: a few at a time, each a 1 px cross for a beat. */
export const drawTwinkles = (ctx: CanvasRenderingContext2D, f: CrystalFrame, dx: number, dy: number, scale: number, t: number, color = '#ffffff') => {
  const n = f.corners.length / 2
  if (n === 0) return
  ctx.fillStyle = color
  const beat = Math.floor(t * 5)
  for (let k = 0; k < 2; k++) {
    const i = Math.floor(hash(beat, k, 9) * n)
    const x = dx + f.corners[i * 2]! * scale
    const y = dy + f.corners[i * 2 + 1]! * scale
    ctx.fillRect(x, y, scale, scale)
    if ((beat + k) % 2 === 0) {
      ctx.fillRect(x - scale, y, scale, scale)
      ctx.fillRect(x + scale, y, scale, scale)
      ctx.fillRect(x, y - scale, scale, scale)
      ctx.fillRect(x, y + scale, scale, scale)
    }
  }
}
