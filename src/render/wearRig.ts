/**
 * The head rig: where each frame of a player's sprite takes a wearable,
 * measured from the frame's own pixels and its SpriteCollab markers (the
 * mouth and the body's center, `scripts/rig.mjs` reads them) by `measure`,
 * then kept steady direction by direction (`settle`). Per frame it finds:
 *
 * - the seat: the skull's top, where a hat's opening rests once the thin
 *   parts above it (ears, horns, crests, leaf stalks) are opened away and the
 *   lobes an outline sets apart (a leaf, a bulb) are left out;
 * - the eyes (their box and centers) and the head's span at their line: no
 *   hat, scarf or cape may cover them, and glasses sit on them;
 * - the neck (the narrowest row under the chin) and the back (the body's axis
 *   at the shoulders).
 *
 * Pure math on RGBA bytes: the offline script, the wearables' worker and the
 * fit check (`npm run fit-check`) share it.
 */

/** A frame's pixels: `w` × `h` RGBA bytes, row by row. */
export type Pixels = { w: number; h: number; rgba: Uint8Array | Uint8ClampedArray }

/** A frame's SpriteCollab markers: the mouth (black) and the body's center (green), in frame px. */
export type Marks = { mx: number; my: number; gx: number; gy: number }

/** An eye: its center, its box (inclusive) and how sure the finder is. */
export type Eye = { x: number; y: number; x0: number; y0: number; x1: number; y1: number; score: number }

/** One frame's rig, in frame px. `NONE` where a feature isn't seen (the eyes facing away). */
export type RigFrame = {
  seatX: number
  seatY: number
  seatW: number
  /** The eyes' box (inclusive), `NONE` without eyes. */
  eyeX0: number
  eyeY0: number
  eyeX1: number
  eyeY1: number
  /** The eyes' centers: the second is the first when one shows (profile). */
  e1x: number
  e1y: number
  e2x: number
  e2y: number
  /** The head's span at the eyes' line (or where they'd be). */
  faceL: number
  faceR: number
  neckX: number
  neckY: number
  neckW: number
  backX: number
  backY: number
  bodyW: number
  feetY: number
}

/** The order `RigFrame`'s fields pack in (`scripts/rig.mjs` writes them, `decodeRig` reads them), a byte each. */
export const RIG_FIELDS = ['seatX', 'seatY', 'seatW', 'e1x', 'e1y', 'e2x', 'e2y', 'eyeX0', 'eyeY0', 'eyeX1', 'eyeY1', 'faceL', 'faceR', 'neckX', 'neckY', 'neckW', 'backX', 'backY', 'bodyW', 'feetY'] as const satisfies readonly (keyof RigFrame)[]

export const NONE = 255

/** Which way a sheet row faces: +1 screen right, -1 left, 0 straight at or away from the camera. */
export const FACING = [0, 1, 1, 1, 0, -1, -1, -1] as const
/** Rows that show the back of the head (the eyes don't show). */
export const away = (row: number) => row >= 3 && row <= 5

const lum = (p: Uint8Array | Uint8ClampedArray, i: number) => 0.3 * p[i]! + 0.59 * p[i + 1]! + 0.11 * p[i + 2]!

/** A frame cut out of a sheet's RGBA (`sw` px wide): column `col`, row `row` of `fw` × `fh` frames. */
export const frameOf = (sheet: Uint8Array | Uint8ClampedArray, sw: number, col: number, row: number, fw: number, fh: number): Pixels => {
  const rgba = new Uint8Array(fw * fh * 4)
  for (let y = 0; y < fh; y++) rgba.set(sheet.subarray(((row * fh + y) * sw + col * fw) * 4, ((row * fh + y) * sw + col * fw + fw) * 4), y * fw * 4)
  return { w: fw, h: fh, rgba }
}

/* ---------------- Masks ---------------- */

/** The frame's coverage (1 opaque), its silhouette's edge (opaque beside clear) and its ink (the outline's color, wherever it's drawn). */
export const masksOf = (f: Pixels) => {
  const { w, h, rgba } = f
  const n = w * h
  const solid = new Uint8Array(n)
  for (let k = 0; k < n; k++) solid[k] = rgba[k * 4 + 3]! > 0 ? 1 : 0
  const at = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && solid[y * w + x] === 1
  const edge = new Uint8Array(n)
  const edgeLums: number[] = []
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (!solid[k]) continue
      if (!at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1)) {
        edge[k] = 1
        edgeLums.push(lum(rgba, k * 4))
      }
    }
  }
  edgeLums.sort((a, b) => a - b)
  // The outline is most of the edge: its darker quarter's lum is the ink's.
  const inkLum = edgeLums.length ? edgeLums[Math.floor(edgeLums.length * 0.25)]! : 40
  const inkMax = Math.max(48, inkLum + 26)
  const ink = new Uint8Array(n)
  const lums = new Float32Array(n)
  for (let k = 0; k < n; k++) {
    if (!solid[k]) continue
    lums[k] = lum(rgba, k * 4)
    if (lums[k]! <= inkMax) ink[k] = 1
  }
  return { solid, edge, ink, lums, inkMax }
}

export type Masks = ReturnType<typeof masksOf>

/** Connected components (8-way when `diag`) of `mask`: each pixel's label (0 none), and the labels' pixels. */
const components = (mask: Uint8Array, w: number, h: number, diag: boolean) => {
  const label = new Int32Array(w * h)
  const parts: number[][] = [[]]
  const stack: number[] = []
  for (let k0 = 0; k0 < w * h; k0++) {
    if (!mask[k0] || label[k0]) continue
    const id = parts.length
    const px: number[] = []
    label[k0] = id
    stack.push(k0)
    while (stack.length) {
      const k = stack.pop()!
      px.push(k)
      const x = k % w
      const y = (k - x) / w
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if ((dx === 0 && dy === 0) || (!diag && dx !== 0 && dy !== 0)) continue
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const o = ny * w + nx
          if (mask[o] && !label[o]) {
            label[o] = id
            stack.push(o)
          }
        }
      }
    }
    parts.push(px)
  }
  return { label, parts }
}

/** The disk a morphological opening rolls (offsets within radius `r`). */
const disk = (r: number) => {
  const pts: [number, number][] = []
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r + r * 0.5) pts.push([dx, dy])
  return pts
}

/** `mask` opened by a disk of radius `r`: what's narrower than the disk (an ear tip, a horn, a stalk) goes. */
export const open = (mask: Uint8Array, w: number, h: number, r: number) => {
  const d = disk(r)
  const eroded = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let all = 1
      for (const [dx, dy] of d) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || !mask[ny * w + nx]) {
          all = 0
          break
        }
      }
      eroded[y * w + x] = all
    }
  }
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!eroded[y * w + x]) continue
      for (const [dx, dy] of d) {
        const nx = x + dx
        const ny = y + dy
        if (nx >= 0 && ny >= 0 && nx < w && ny < h) out[ny * w + nx] = 1
      }
    }
  }
  for (let k = 0; k < w * h; k++) out[k] = out[k]! & mask[k]!
  return out
}

/* ---------------- Eyes ---------------- */

/** An eye candidate: a small dark blob inside the silhouette, much darker than what's around it. */
type Blob = Eye & { n: number; glint: number; edge: number; px: number[] }

/** Whether a pixel is a glint: near white (eyes are lit by one in PMD art). */
const glinty = (p: Uint8Array | Uint8ClampedArray, i: number) => {
  const r = p[i]!
  const g = p[i + 1]!
  const b = p[i + 2]!
  return lum(p, i) >= 196 && Math.max(r, g, b) - Math.min(r, g, b) < 70
}

/** The small dark blobs of a frame inside `within` that may be eyes, with what makes them likely. */
const blobsOf = (f: Pixels, m: Masks, within: Uint8Array) => {
  const { w, h, rgba } = f
  const n = w * h
  // Glints are small white spots: a white patch (a horn, a belly) is no glint.
  const white = new Uint8Array(n)
  for (let k = 0; k < n; k++) if (m.solid[k] && glinty(rgba, k * 4)) white[k] = 1
  const whites = components(white, w, h, true)
  const spot = new Uint8Array(n)
  for (let id = 1; id < whites.parts.length; id++) if (whites.parts[id]!.length <= 4) for (const k of whites.parts[id]!) spot[k] = 1
  const dark = new Uint8Array(n)
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x
      if (!m.solid[k] || m.edge[k] || !within[k]) continue
      // Darker than its lit surroundings by a lot: a pupil, an iris, a closed eye's line (ink among shadows is shading).
      let sum = 0
      let cnt = 0
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
          const o = ny * w + nx
          if (!m.solid[o] || m.ink[o] || o === k) continue
          sum += m.lums[o]!
          cnt++
        }
      }
      const ref = cnt ? sum / cnt : 0
      if (cnt >= 5 && (m.ink[k] ? ref - m.lums[k]! > 45 : ref - m.lums[k]! > 62 && m.lums[k]! < ref * 0.5)) dark[k] = 1
    }
  }
  const { parts } = components(dark, w, h, false)
  const blobs: Blob[] = []
  for (let id = 1; id < parts.length; id++) {
    const px = parts[id]!
    if (px.length > 20) continue
    let x0 = w
    let y0 = h
    let x1 = -1
    let y1 = -1
    let sx = 0
    let sy = 0
    let edge = 0
    for (const k of px) {
      const x = k % w
      const y = (k - x) / w
      x0 = Math.min(x0, x)
      y0 = Math.min(y0, y)
      x1 = Math.max(x1, x)
      y1 = Math.max(y1, y)
      sx += x
      sy += y
      if (m.edge[k - 1] || m.edge[k + 1] || m.edge[k - w] || m.edge[k + w]) edge++
    }
    const bw = x1 - x0 + 1
    const bh = y1 - y0 + 1
    if (bw > 5 || bh > 6) continue
    // Glints: near-white pixels in the blob's ring.
    let glint = 0
    for (let y = Math.max(0, y0 - 1); y <= Math.min(h - 1, y1 + 1); y++) {
      for (let x = Math.max(0, x0 - 1); x <= Math.min(w - 1, x1 + 1); x++) {
        const k = y * w + x
        if (spot[k] && !dark[k]) glint++
      }
    }
    blobs.push({ x: sx / px.length, y: sy / px.length, x0, y0, x1, y1, n: px.length, glint, edge, score: 0, px })
  }
  return blobs
}

/** Dev: hears every eye candidate `findEyes` scored (`ps.rig`, the fit check's notes). */
let debugEyes: ((blobs: readonly Omit<Blob, 'px'>[]) => void) | null = null
export const listenEyes = (fn: typeof debugEyes) => {
  debugEyes = fn
}

/** Where a frame's eyes may be: inside the head (`within`) between its top and just under the mouth marker. */
type EyeWindow = { within: Uint8Array; top: number; headW: number }

/**
 * The eyes of a frame facing `row`: the best pair (facing the camera or
 * turned a little) or the best single eye (in profile). Each candidate scores
 * for a glint, a compact shape and sitting in the head's lower part, above the
 * mouth; a pair scores for matching heights and sitting either side of the
 * head's axis. `prior`: where the direction's other frames put them (offsets
 * from the mouth). Empty facing away, or when nothing scores well enough.
 */
export const findEyes = (f: Pixels, m: Masks, row: number, marks: Marks, win: EyeWindow, prior?: readonly { dx: number; dy: number }[]): (Eye & { px: number[] })[] => {
  if (away(row)) return []
  const { mx, my } = marks
  const s = FACING[row]!
  const headH = Math.max(5, my - win.top)
  const blobs = blobsOf(f, m, win.within).filter((b) => {
    if (b.y0 <= win.top || b.y > my + 3) return false
    const dx = (b.x - mx) * (s === 0 ? 1 : s)
    return s === 0 ? Math.abs(dx) <= Math.max(5, win.headW * 0.6) : dx <= 2 && dx >= -Math.max(8, win.headW)
  })
  for (const b of blobs) {
    const bw = b.x1 - b.x0 + 1
    const bh = b.y1 - b.y0 + 1
    const fill = b.n / (bw * bh)
    const up = my - b.y
    b.score =
      2.4 * Math.min(b.glint, 2) +
      1.2 * fill +
      (bh >= 2 ? 0.8 : 0) +
      (b.n >= 2 ? 0.5 : 0) -
      (s === 0 ? 1.2 : 0.4) * Math.min(b.edge, 2) -
      // Eyes sit above the mouth: on its row or under it is the mouth itself (fangs, a tongue).
      (up < 0.5 ? 2.5 : up < 1.5 ? 0.8 : 0) -
      0.18 * Math.abs(up - headH * 0.5) -
      // Turned away from the camera the eye sits near the snout's tip.
      (s === 0 ? 0 : 0.12 * Math.max(0, Math.abs(b.x - mx) - 4)) -
      // A one-pixel strand three or more tall is a contour (a jaw's, a cheek's) more often than an eye.
      (bw === 1 && bh >= 3 ? 1.2 : 0) -
      (b.n > 12 ? 1 : 0)
    if (prior?.length) {
      const near = Math.min(...prior.map((p) => Math.hypot(b.x - mx - p.dx, b.y - my - p.dy)))
      b.score += near <= 1.5 ? 3 : near <= 3 ? 1 : -1.5
    }
  }
  if (debugEyes) debugEyes(blobs.map(({ px: _px, ...b }) => b))
  const keep = (b: Blob) => ({ x: b.x, y: b.y, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1, score: b.score, px: b.px })
  let best: { score: number; eyes: Blob[] } | null = null
  for (const b of blobs) if (b.score > 1.2 && (!best || b.score > best.score)) best = { score: b.score, eyes: [b] }
  // A pair: about level, a believable gap apart, either side of the mouth's column facing the camera (in profile, one eye).
  if (row !== 2 && row !== 6) {
    for (let i = 0; i < blobs.length; i++) {
      for (let j = i + 1; j < blobs.length; j++) {
        const [a, b] = blobs[i]!.x < blobs[j]!.x ? [blobs[i]!, blobs[j]!] : [blobs[j]!, blobs[i]!]
        const gap = b.x - a.x
        if (Math.abs(a.y - b.y) > 1.6 || gap < 2.5 || gap > Math.min(s === 0 ? 13 : 9, Math.max(7, win.headW * 0.9))) continue
        const off = (a.x + b.x) / 2 - mx
        if (s === 0 && Math.abs(off) > Math.max(2.5, gap * 0.3)) continue
        const score = a.score + b.score + 3 - Math.abs(a.y - b.y) - (s === 0 ? Math.abs(off) * 0.6 : 0) - Math.abs(a.n - b.n) * 0.15
        if (a.score > -1 && b.score > -1 && (!best || score > best.score)) best = { score, eyes: [a, b] }
      }
    }
  }
  if (!best || best.score < 1.5) return []
  return best.eyes.sort((a, b) => a.x - b.x).map(keep)
}

/* ---------------- Seat, neck, back ---------------- */

/**
 * The region of the silhouette the seeds sit in, as far as its own outline
 * encloses it (a leaf or a bulb an outline sets apart stays out), with that
 * outline and the ink inside it (eyes, markings).
 */
const regionOf = (f: Pixels, m: Masks, seeds: readonly number[], palette?: readonly number[]) => {
  const { w, h, rgba } = f
  const n = w * h
  const material = new Uint8Array(n)
  for (let k = 0; k < n; k++) material[k] = m.solid[k] && !m.ink[k] && (!palette || near(palette, rgba, k * 4)) ? 1 : 0
  const { label, parts } = components(material, w, h, false)
  const region = new Uint8Array(n)
  for (const k of seeds) if (label[k]) for (const o of parts[label[k]!]!) region[o] = 1
  const grown = new Uint8Array(n)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const k = y * w + x
      if (!m.solid[k]) continue
      if (region[k]) {
        grown[k] = 1
        continue
      }
      if (!m.ink[k]) continue
      for (let dy = -1; dy <= 1 && !grown[k]; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && ny >= 0 && nx < w && ny < h && region[ny * w + nx]) {
            grown[k] = 1
            break
          }
        }
      }
    }
  }
  for (let pass = 0; pass < 2; pass++) {
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const k = y * w + x
        if (!grown[k] && m.solid[k] && grown[k - 1]! + grown[k + 1]! + grown[k - w]! + grown[k + w]! >= 3) grown[k] = 1
      }
    }
  }
  return grown
}

/** The colors (packed RGB) of the uninked pixels of `seeds`: a head's palette. */
const paletteOf = (f: Pixels, seeds: readonly number[]) => [...new Set(seeds.map((k) => (f.rgba[k * 4]! << 16) | (f.rgba[k * 4 + 1]! << 8) | f.rgba[k * 4 + 2]!))]

/** Whether the pixel at byte `i` is close to a color of `palette` (a shade of the same ramp). */
const near = (palette: readonly number[], p: Uint8Array | Uint8ClampedArray, i: number) => {
  for (const c of palette) {
    const dr = p[i]! - (c >> 16)
    const dg = p[i + 1]! - ((c >> 8) & 255)
    const db = p[i + 2]! - (c & 255)
    if (dr * dr + dg * dg + db * db <= 34 * 34) return true
  }
  return false
}

/** The span of `mask` on row `y` through column `x` (or the nearest set pixel within 2 px), or null. */
const spanAt = (mask: Uint8Array, w: number, x: number, y: number): [number, number] | null => {
  const row = y * w
  let c = -1
  for (const d of [0, -1, 1, -2, 2]) {
    if (x + d >= 0 && x + d < w && mask[row + x + d]) {
      c = x + d
      break
    }
  }
  if (c < 0) return null
  let l = c
  let r = c
  while (l > 0 && mask[row + l - 1]) l--
  while (r < w - 1 && mask[row + r + 1]) r++
  return [l, r]
}

/**
 * The skull's top along column `x`, walking up from row `y0`: the rows its
 * span runs through until it ends or narrows to under 45% of the widest seen
 * (an ear's base, a horn, a crest above the dome). The top row, and the widest span.
 */
const topOf = (mask: Uint8Array, w: number, x: number, y0: number, colors?: { f: Pixels; m: Masks; palette: readonly number[] }) => {
  let top = -1
  let widest = 0
  let ax = x
  let span: [number, number] | null = null
  for (let y = y0; y >= 0; y--) {
    const sp = spanAt(mask, w, ax, y)
    if (!sp) break
    const sw = sp[1] - sp[0] + 1
    if (widest >= 5 && sw * 2.2 < widest) break
    if (colors && y < y0 - 1) {
      // A row of colors the face doesn't have: a lobe sits on the skull here.
      let own = 0
      let all = 0
      for (let xx = sp[0]; xx <= sp[1]; xx++) {
        const k = y * w + xx
        if (colors.m.ink[k]) continue
        all++
        if (near(colors.palette, colors.f.rgba, k * 4)) own++
      }
      if (all >= 3 && own < all * 0.3) break
    }
    if (sw > widest) [widest, span] = [sw, sp]
    top = y
    ax = Math.min(Math.max(ax, sp[0] + 1), sp[1] - 1)
  }
  return { top, widest, span }
}

/** The disk an opening rolls for a head `width` px wide: wider heads lose wider ears. */
const diskFor = (width: number) => (width >= 9 ? 2 : 1)

/** A frame's measures before `settle` steadies them: the rig, plus the eyes' pixels and the skull (the fit check and the dev tool draw them). */
export type Measure = { rig: RigFrame; eyePx: number[]; skull: Uint8Array; eyes: Eye[]; palette: readonly number[] }

/**
 * Measures one frame facing `row` (see the module's doc). First the head
 * around the mouth marker (its top bounds where eyes may be), then the eyes,
 * then the skull again from the forehead over the eyes, where the hat goes.
 * `eyes` replaces the eyes found (`settle` passes a direction's own when a
 * frame's are off); `prior` helps the finder (`findEyes`).
 */
export const measure = (
  f: Pixels,
  row: number,
  marks: Marks,
  opts: { eyes?: readonly (Eye & { px?: readonly number[] })[]; prior?: readonly { dx: number; dy: number }[]; palette?: readonly number[] } = {},
): Measure => {
  const { w, h } = f
  const m = masksOf(f)
  const { mx, my, gx, gy } = marks
  const s = FACING[row]!
  const seedsIn = (x0: number, x1: number, y0: number, y1: number) => {
    const out: number[] = []
    for (let y = Math.max(0, y0); y <= Math.min(h - 1, y1); y++) for (let x = Math.max(0, x0); x <= Math.min(w - 1, x1); x++) if (m.solid[y * w + x] && !m.ink[y * w + x]) out.push(y * w + x)
    return out
  }
  // The head as the mouth marker finds it: facing sideways the marker is the snout's tip, the head's axis behind it.
  const axis0 = s === 0 ? mx : mx - s * 2
  let seeds = seedsIn(axis0 - 2, axis0 + 2, my - 4, my - 1)
  if (seeds.length === 0) seeds = seedsIn(axis0 - 3, axis0 + 3, my - 2, my + 2)
  const head = regionOf(f, m, seeds)
  let headW = 0
  for (let y = 0; y < h; y++) {
    const sp = spanAt(head, w, axis0, y)
    if (sp && y <= my && y >= my - 12) headW = Math.max(headW, sp[1] - sp[0] + 1)
  }
  const rough = topOf(open(head, w, h, diskFor(headW)), w, axis0, Math.min(h - 1, my))
  const eyes = opts.eyes ?? findEyes(f, m, row, marks, { within: head, top: rough.top < 0 ? my - 12 : rough.top, headW: Math.max(headW, 6) }, opts.prior)
  // The skull over the eyes: seeded from the forehead just above them.
  let eyeTop = NONE
  let skull = head
  if (eyes.length) {
    eyeTop = Math.min(...eyes.map((e) => e.y0))
    const x0 = Math.min(...eyes.map((e) => e.x0))
    const x1 = Math.max(...eyes.map((e) => e.x1))
    const brow = [...seedsIn(x0 - 1, x1 + 1, eyeTop - 2, eyeTop - 1), ...seedsIn(x0 - 1, x0 - 1, eyeTop, eyeTop + 1), ...seedsIn(x1 + 1, x1 + 1, eyeTop, eyeTop + 1)]
    if (brow.length) skull = regionOf(f, m, brow)
  }
  const eyeMid = eyes.length ? Math.round(eyes.reduce((a, e) => a + e.x, 0) / eyes.length) : axis0
  const ax = eyes.length === 2 ? Math.round((eyes[0]!.x + eyes[1]!.x) / 2) : eyes.length === 1 ? eyeMid - s * 2 : axis0
  let width = 0
  for (let y = Math.max(0, (eyeTop === NONE ? my : eyeTop) - 10); y <= (eyeTop === NONE ? my : eyeTop); y++) {
    const sp = spanAt(skull, w, ax, y)
    if (sp) width = Math.max(width, sp[1] - sp[0] + 1)
  }
  const opened = open(skull, w, h, diskFor(width))
  const from = eyeTop === NONE ? Math.min(h - 1, my - 1) : Math.max(0, eyeTop - 1)
  // The face's colors, its whole rows from the eyes down to the mouth: a lobe of other colors over the head (a leaf, a plume) isn't skull.
  // Near the eyes only: a leaf hanging beside the face isn't the face's. Facing the camera, the front's palette serves every direction (`opts.palette`).
  const faceRows: number[] = []
  const ex0 = eyes.length ? Math.min(...eyes.map((e) => e.x0)) - 3 : ax - 4
  const ex1 = eyes.length ? Math.max(...eyes.map((e) => e.x1)) + 3 : ax + 4
  for (let y = eyeTop === NONE ? my - 4 : eyeTop; y <= Math.max(my, eyeTop === NONE ? my : eyeTop + 1); y++) {
    const sp = y >= 0 && y < h ? spanAt(skull, w, ax, y) : null
    if (sp) faceRows.push(...seedsIn(Math.max(sp[0], ex0), Math.min(sp[1], ex1), y, y))
  }
  const palette = opts.palette ?? paletteOf(f, faceRows)
  const top = topOf(opened, w, ax, from, { f, m, palette })
  let seatX = ax
  let seatY = top.top >= 0 ? top.top : Math.max(0, my - 6)
  let seatW = 7
  if (top.top >= 0) {
    // The opening's width: the skull's widest row between its top and the brow.
    let wide: [number, number] | null = null
    for (let y = top.top; y <= Math.max(top.top, from); y++) {
      const sp = spanAt(opened, w, ax, y)
      if (sp && (!wide || sp[1] - sp[0] > wide[1] - wide[0])) wide = sp
      if (y - top.top >= 6) break
    }
    if (wide) {
      seatW = Math.max(5, wide[1] - wide[0] + 1)
      if (s !== 0 || eyes.length !== 2) seatX = Math.round((wide[0] + wide[1]) / 2)
    }
    // The drop: the opening's middle half rests on the highest skull pixel under it (not above the top found).
    const half = Math.max(1, Math.round(seatW / 4))
    let rest = h
    for (let x = seatX - half; x <= seatX + half; x++) {
      if (x < 0 || x >= w) continue
      for (let y = top.top; y < h; y++) {
        if (opened[y * w + x]) {
          rest = Math.min(rest, y)
          break
        }
      }
    }
    if (rest < h) seatY = rest
  }
  // The head's span at the eyes' line: the head's own region there (a crest, a shoulder or a wing on the same row isn't face).
  const eyeY = eyes.length ? Math.round(eyes.reduce((a, e) => a + e.y, 0) / eyes.length) : Math.round(seatY + (my - seatY) * 0.55)
  const faceRow = Math.min(h - 1, Math.max(0, eyeY))
  const faceSpan = spanAt(head, w, eyes.length ? eyeMid : seatX, faceRow) ?? spanAt(m.solid, w, eyes.length ? eyeMid : seatX, faceRow)
  // The neck: the narrowest row from under the chin down toward the body's center.
  const neckAxis = s === 0 ? mx : Math.round((mx + seatX) / 2)
  let neckY = Math.min(h - 1, my + 1)
  let neckW = NONE
  const neckEnd = Math.max(neckY, Math.min(gy, my + Math.max(3, Math.round((my - seatY) * 0.6))))
  for (let y = neckY; y <= neckEnd; y++) {
    const sp = spanAt(m.solid, w, neckAxis, y)
    if (!sp) continue
    const nw = sp[1] - sp[0] + 1
    if (nw < neckW) {
      neckW = nw
      neckY = y
    }
  }
  if (neckW === NONE) neckW = seatW
  neckW = Math.round(Math.min(Math.max(neckW, seatW * 0.45), seatW * 0.8))
  // The back: the body's axis just under the neck; the body's width at its center.
  const backY = Math.min(h - 1, Math.max(neckY + 2, Math.min(gy, neckY + 3)))
  const body = spanAt(m.solid, w, gx, gy)
  let feetY = h - 1
  for (; feetY > 0; feetY--) {
    let any = false
    for (let x = 0; x < w && !any; x++) if (m.solid[feetY * w + x]) any = true
    if (any) break
  }
  const rig: RigFrame = {
    seatX,
    seatY,
    seatW,
    eyeX0: eyes.length ? Math.min(...eyes.map((e) => e.x0)) : NONE,
    eyeY0: eyes.length ? eyeTop : NONE,
    eyeX1: eyes.length ? Math.max(...eyes.map((e) => e.x1)) : NONE,
    eyeY1: eyes.length ? Math.max(...eyes.map((e) => e.y1)) : NONE,
    e1x: eyes.length ? Math.round(eyes[0]!.x) : NONE,
    e1y: eyes.length ? Math.round(eyes[0]!.y) : NONE,
    e2x: eyes.length ? Math.round(eyes[eyes.length - 1]!.x) : NONE,
    e2y: eyes.length ? Math.round(eyes[eyes.length - 1]!.y) : NONE,
    faceL: faceSpan ? faceSpan[0] : seatX - (seatW >> 1),
    faceR: faceSpan ? faceSpan[1] : seatX + (seatW >> 1),
    neckX: neckAxis,
    neckY,
    neckW,
    backX: gx,
    backY,
    bodyW: body ? body[1] - body[0] + 1 : seatW,
    feetY,
  }
  return { rig, eyePx: eyes.flatMap((e) => [...(e.px ?? [])]), skull: opened, eyes: eyes.map(({ x, y, x0, y0, x1, y1, score }) => ({ x, y, x0, y0, x1, y1, score })), palette: paletteOf(f, faceRows) }
}

/* ---------------- Steadying a direction's frames ---------------- */

const median = (xs: readonly number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? s[s.length >> 1]! : 0
}

/** A sheet row's frames to settle: each frame's pixels and markers. */
export type RowFrames = readonly { f: Pixels; marks: Marks }[]

/** A direction's eyes as offsets from the seat (sorted left to right), with their boxes' sizes: its template. */
export type EyeTemplate = readonly { dx: number; dy: number; bw: number; bh: number }[]

/** The eye count most of a row's frames agree on (two over one on a tie) and where they sit from each frame's own seat. */
const templateOf = (frames: readonly Measure[]): EyeTemplate => {
  const counts = [0, 0, 0]
  for (const m of frames) counts[m.eyes.length]!++
  const n = counts[2]! >= counts[1]! && counts[2]! > 0 ? 2 : counts[1]! > 0 ? 1 : 0
  if (n === 0 || counts[n]! * 3 < frames.length) return []
  return Array.from({ length: n }, (_, i) => {
    const with_ = frames.filter((m) => m.eyes.length === n)
    return {
      dx: median(with_.map((m) => m.eyes[i]!.x - m.rig.seatX)),
      dy: median(with_.map((m) => m.eyes[i]!.y - m.rig.seatY)),
      bw: median(with_.map((m) => m.eyes[i]!.x1 - m.eyes[i]!.x0)),
      bh: median(with_.map((m) => m.eyes[i]!.y1 - m.eyes[i]!.y0)),
    }
  })
}

/** The template's eyes on a frame whose seat is `seat` (a blink, a squint: where they'd be). */
const eyesAt = (t: EyeTemplate, seat: { seatX: number; seatY: number }): Eye[] =>
  t.map(({ dx, dy, bw, bh }) => {
    const x = seat.seatX + dx
    const y = seat.seatY + dy
    const x0 = Math.round(x - bw / 2)
    const y0 = Math.round(y - bh / 2)
    return { x, y, x0, y0, x1: x0 + Math.round(bw), y1: y0 + Math.round(bh), score: 0 }
  })

/**
 * One sheet row's rig, frame by frame (see `measure`), steadied. A frame
 * keeps its own measures when it sees as many eyes as most of the row does
 * (the mouth marker isn't always rigid with the head: an Idle's breath, a
 * roll, a dance move it); one that sees fewer (a blink, a squint) looks again
 * where the others put them, and takes them from its own seat if it still
 * can't. A seat that strays from where its eyes put the others' is put back.
 * The widths and the feet are the row's. `fallback`: another anim's template
 * for the same row (Walk's), for a row whose own frames don't agree (Hurt's
 * squeezed eyes). `palette`: the face's colors as the front view finds them
 * (`Measure.palette`), which hold from every side.
 */
export const settle = (row: number, frames: RowFrames, fallback?: EyeTemplate, palette?: readonly number[]) => {
  const first = frames.map(({ f, marks }) => measure(f, row, marks, { palette }))
  let t = templateOf(first)
  if (t.length === 0 && fallback?.length && !away(row)) t = fallback
  const measured = first.map((m, i) => {
    const { f, marks: mk } = frames[i]!
    if (m.eyes.length >= t.length) return t.length === 0 && m.eyes.length ? measure(f, row, mk, { eyes: [], palette }) : m
    const prior = t.map(({ dx, dy }) => ({ dx: m.rig.seatX + dx - mk.mx, dy: m.rig.seatY + dy - mk.my }))
    const again = measure(f, row, mk, { prior, palette })
    return again.eyes.length === t.length ? again : measure(f, row, mk, { eyes: eyesAt(t, m.rig), palette })
  })
  // A seat that strays (an ear caught on one frame) goes where its eyes put the row's others.
  const off = measured.flatMap((m) => (m.eyes.length ? [{ x: m.rig.seatX - m.eyes[0]!.x, y: m.rig.seatY - Math.min(...m.eyes.map((e) => e.y0)) }] : []))
  const sx = median(off.map((o) => o.x))
  const sy = median(off.map((o) => o.y))
  const sw = median(measured.map((m) => m.rig.seatW))
  const lead = measured[0]!.rig
  const rigs = measured.map((m, i) => {
    const r = { ...m.rig, seatW: sw, neckW: lead.neckW, bodyW: lead.bodyW, feetY: lead.feetY, faceL: lead.faceL - lead.seatX + m.rig.seatX, faceR: lead.faceR - lead.seatX + m.rig.seatX }
    if (m.eyes.length && off.length >= 3) {
      const ex = m.eyes[0]!.x
      const ey = Math.min(...m.eyes.map((e) => e.y0))
      if (Math.abs(r.seatY - ey - sy) > 3 || Math.abs(r.seatX - ex - sx) > 4) {
        r.seatX = Math.min(Math.max(Math.round(ex + sx), 0), frames[i]!.f.w - 1)
        r.seatY = Math.min(Math.max(Math.round(ey + sy), 0), frames[i]!.f.h - 1)
      }
    }
    return r
  })
  return { rigs, measured, template: t }
}

/* ---------------- Packing ---------------- */

/**
 * The field each one moves with from frame to frame (packed as its change
 * less that field's), so a head that moves as one packs as zeros: the eyes
 * with the seat and each other, the back with the neck. The widths and the
 * feet are the row's (`settle`).
 */
const REF = {
  seatX: null,
  seatY: null,
  seatW: null,
  e1x: 'seatX',
  e1y: 'seatY',
  e2x: 'e1x',
  e2y: 'e1y',
  eyeX0: 'e1x',
  eyeY0: 'e1y',
  eyeX1: 'e1x',
  eyeY1: 'e1y',
  faceL: 'seatX',
  faceR: 'seatX',
  neckX: 'seatX',
  neckY: 'seatY',
  neckW: null,
  backX: 'neckX',
  backY: 'neckY',
  bodyW: null,
  feetY: null,
} as const satisfies Record<keyof RigFrame, keyof RigFrame | null>

const clampByte = (v: number) => {
  if (!Number.isFinite(v)) throw new Error(`rig value ${v}`)
  // A measure off the frame's edge (an eye guessed from the direction's others) stays on it.
  return v === NONE ? NONE : Math.min(Math.max(Math.round(v), 0), 254)
}

/**
 * One anim's rig as bytes: frame width, height and count, then row by row the
 * first frame's fields (`RIG_FIELDS`) and, field by field, each later frame's
 * change from the first less its `REF` field's (mod 256). The head moves as
 * one, so those are mostly zeros, which the chunk's gzip all but drops.
 */
export const packRig = (fw: number, fh: number, rows: readonly (readonly RigFrame[])[]) => {
  const frames = rows[0]!.length
  const per = RIG_FIELDS.length
  const out = new Uint8Array(3 + rows.length * per * frames)
  out.set([fw, fh, frames])
  let o = 3
  for (const row of rows) {
    const b = row.map((r) => Object.fromEntries(RIG_FIELDS.map((k) => [k, clampByte(r[k])])) as RigFrame)
    for (const k of RIG_FIELDS) out[o++] = b[0]![k]
    for (const k of RIG_FIELDS) {
      const ref = REF[k]
      for (let f = 1; f < frames; f++) {
        // A row's frames all see its eyes or none do (`settle`): unseen, the field stays NONE throughout.
        if ((b[f]![k] === NONE) !== (b[0]![k] === NONE)) throw new Error(`rig ${k}: seen on some frames of a row only`)
        out[o++] = b[0]![k] === NONE ? 0 : (b[f]![k] - b[0]![k] - (ref ? b[f]![ref] - b[0]![ref] : 0)) & 255
      }
    }
  }
  return out
}

/** A sheet's rig, unpacked: its frame size and count, and each row's frames' rigs. */
export type SheetRig = { fw: number; fh: number; frames: number; rows: RigFrame[][] }

export const unpackRig = (b: Uint8Array): SheetRig => {
  const [fw, fh, frames] = [b[0]!, b[1]!, b[2]!]
  const rows: RigFrame[][] = []
  let o = 3
  for (let row = 0; row < 8; row++) {
    const line = Array.from({ length: frames }, () => ({}) as RigFrame)
    for (const k of RIG_FIELDS) line[0]![k] = b[o++]!
    for (const k of RIG_FIELDS) {
      const ref = REF[k]
      for (let f = 1; f < frames; f++) {
        const v = b[o++]!
        line[f]![k] = line[0]![k] === NONE ? NONE : (line[0]![k] + v + (ref ? line[f]![ref] - line[0]![ref] : 0)) & 255
      }
    }
    rows.push(line)
  }
  return { fw, fh, frames, rows }
}
