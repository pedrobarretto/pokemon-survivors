import type { WearableSlot } from '../data/cosmetics'
import type { WearableId } from '../data/wearables'
import { MAX_LIFT } from './wearDress'
import { FACING, masksOf, type Marks, type Masks, type Measure, type Pixels } from './wearRig'

/**
 * The fit check's rules (`npm run fit-check`): what a worn item must never do
 * to a frame, judged from masks rather than by eye. A renderer hands over
 * where it drew an item on the frame (`Worn`); the frame's own measures
 * (`wearRig.measure`: its eyes' pixels, its skull, its seat) are the truth,
 * and so are its silhouette and its SpriteCollab markers (`silhouetteOf`),
 * which the rules that don't trust the rig judge by: where the rig is wrong
 * (a seat sunk into the forehead, eyes found on an ear, none found), the
 * rules built on it pass anyway, and these don't.
 */

/** Where a renderer drew one item on a frame: its pixels over the sprite (`front`) and under it (`behind`), in a box around the frame. */
export type Worn = {
  /** The box's top-left in frame px (it may start left of or above the frame) and size. */
  x0: number
  y0: number
  w: number
  h: number
  /** 1 where the item shows over the sprite. */
  front: Uint8Array
  /** 1 where the item is drawn under the sprite (it shows only where the sprite is clear). */
  behind: Uint8Array
  /** The item's pivot in frame px (`render/wearModels.ts` builds each model around it). */
  pivot: { x: number; y: number }
  /** Item pixels the renderer cut (eyes, the face's edge, a horn in front) and all it rendered, to judge how much is gone. */
  cut: number
  total: number
}

/** The rules judged against the rig's measures. */
export const RIG_RULES = ['eye-covered', 'face-off-eyes', 'face-outside', 'seat-float', 'seat-sunk', 'neck-off', 'back-high', 'clipped'] as const
/**
 * The rules that don't trust the rig: a face item left off for want of eyes
 * found (`eyes-unfound`, the fit check's own), a seat with the skull going on
 * above it (`seat-low`) or on a tip (`seat-perch`), and a hat on the face's
 * details or right over them (`features-touched`, `silhouetteOf`).
 */
export const SILHOUETTE_RULES = ['eyes-unfound', 'seat-low', 'seat-perch', 'features-touched'] as const

export type Rule = (typeof RIG_RULES)[number] | (typeof SILHOUETTE_RULES)[number]

/**
 * The silhouette's rules that only raise a suspicion: a crest, a mane or a
 * cloud of the head's own colors over a hat reads as skull to them as a seat
 * sunk into the forehead does. Listed for a look (`npm run fit-check`'s
 * suspects), never failing a fit.
 */
export const SUSPECT_RULES: readonly Rule[] = ['seat-low', 'seat-perch']

export const RULES: readonly Rule[] = [...RIG_RULES, ...SILHOUETTE_RULES]

/** What a rule found: its name and a short note (numbers to look at). */
export type Failure = { rule: Rule; note: string }

/** How far (px) a face item may stray outside the sprite: lenses stand off the face a little, in profile too. */
export const FACE_SLACK = 2
/** How far (px) a hat's pivot may sit off the measured seat. */
export const SEAT_SLACK = 1
/** The share of an item a renderer may cut before it reads as missing. */
export const CUT_MAX = 0.35

/** Items that float by design (no seat to rest on) or sit below the skull's top (a band round the forehead). */
const FLOATS: readonly WearableId[] = ['halo']
const LOW: readonly WearableId[] = ['headband']
/** Face items that cover one eye only. */
const ONE_EYE: readonly WearableId[] = ['monocle', 'eyePatch']

/** Rows of skull over a hat's seat that make it sunk (`seat-low`), and how narrow (of the skull's opening) a tip it may not sit on is (`seat-perch`). */
const SKULL_OVER = 3
/** How wide (of the seat's opening) a row over the seat must be to count as skull the hat sank under. */
const SKULL_WIDE = 0.8
const PERCH = 0.4

/** The run of opaque pixels on row `y` through column `x` (or the nearest within a pixel), or null. */
const runOf = (solid: Uint8Array, w: number, x: number, y: number): [number, number] | null => {
  const h = solid.length / w
  if (y < 0 || y >= h) return null
  const c = [x, x - 1, x + 1].find((i) => i >= 0 && i < w && solid[y * w + i])
  if (c === undefined) return null
  let l = c
  let r = c
  while (l > 0 && solid[y * w + l - 1]) l--
  while (r < w - 1 && solid[y * w + r + 1]) r++
  return [l, r]
}

/** Whether two packed RGB colors are shades of one ramp (as `wearRig`'s palette tells them). */
const close = (a: number, b: number) => {
  const dr = (a >> 16) - (b >> 16)
  const dg = ((a >> 8) & 255) - ((b >> 8) & 255)
  const db = (a & 255) - (b & 255)
  return dr * dr + dg * dg + db * db <= 40 * 40
}

/**
 * How high the head goes along column `x` from row `y0` up, by its
 * silhouette and the colors of the rows it starts over (not the face's, as
 * the rig takes them): while a row's run stays broad (half the widest of the
 * four rows under it: an ear's base, a horn, a crest end it, and no narrower
 * than `wide` px), keeps a third of its pixels in those colors (a bulb, a leaf
 * of its own colors ends it) and no outline crosses the column with more of
 * the sprite over it. The top row reached.
 */
export const climb = (f: Pixels, { solid, ink }: Masks, x: number, y0: number, wide = 0) => {
  const w = f.w
  const rgb = (k: number) => (f.rgba[k * 4]! << 16) | (f.rgba[k * 4 + 1]! << 8) | f.rgba[k * 4 + 2]!
  const widths: number[] = []
  const own: number[] = []
  for (let y = y0 + 3; y > y0; y--) {
    const r = runOf(solid, w, x, y)
    if (!r) continue
    widths.push(r[1] - r[0] + 1)
    for (let i = r[0]; i <= r[1]; i++) if (!ink[y * w + i] && !own.some((c) => close(c, rgb(y * w + i)))) own.push(rgb(y * w + i))
  }
  let top = y0 + 1
  for (let y = y0; y >= 0; y--) {
    const r = runOf(solid, w, x, y)
    if (!r) break
    const width = r[1] - r[0] + 1
    if (width < wide || (widths.length && width < Math.max(...widths.slice(-4)) * 0.5)) break
    const k = y * w + x
    if (ink[k] && ink[k - 1] && ink[k + 1] && y > 0 && solid[k - w] && !ink[k - w]) break
    let mine = 0
    let all = 0
    for (let i = r[0]; i <= r[1]; i++) {
      if (ink[y * w + i]) continue
      all++
      if (own.some((c) => close(c, rgb(y * w + i)))) mine++
    }
    if (all >= 3 && mine * 3 < all) break
    widths.push(width)
    top = y
  }
  return top
}

/**
 * A frame's head as its silhouette and its mouth marker show it, without the
 * rig: its top (`climb` up the head's axis from the mouth; facing a side the
 * axis is a little behind the snout's tip) and its face's details in its
 * lower half down to the mouth (pixel indexes): small blobs (a pupil, a closed
 * eye's line, a nostril) of ink or of pixels darker than most of what's around
 * them (not the shading where two tones meet, nor a long contour) with some ink
 * or a glint (not a marking in a darker shade of the skin), and the glints
 * beside them. Not an eye finder: no pairs, no scores.
 */
export const silhouetteOf = (f: Pixels, row: number, marks: Marks) => {
  const m = masksOf(f)
  const { w, h } = f
  const s = FACING[row] ?? 0
  const ax = Math.min(w - 1, Math.max(0, s === 0 ? marks.mx : marks.mx - s * 2))
  const top = climb(f, m, ax, Math.min(h - 1, marks.my - 1))
  const from = Math.max(1, top + Math.round((marks.my - top) * 0.5))
  const to = Math.min(h - 2, marks.my - 1)
  const N8 = [-w - 1, -w, -w + 1, -1, 1, w - 1, w, w + 1]
  const dark = new Uint8Array(w * h)
  const glints: number[] = []
  for (let y = from; y <= to; y++) {
    const run = runOf(m.solid, w, ax, y)
    if (!run) continue
    for (let x = Math.max(1, run[0]); x <= Math.min(w - 2, run[1]); x++) {
      const k = y * w + x
      if (!m.solid[k] || m.edge[k]) continue
      const lum = m.lums[k]!
      let brighter = 0
      let darker = 0
      for (const d of N8) {
        if (!m.solid[k + d] || m.ink[k + d]) continue
        if (m.lums[k + d]! - lum > 60) brighter++
        if (lum - m.lums[k + d]! > 40) darker++
      }
      const [r, g, b] = [f.rgba[k * 4]!, f.rgba[k * 4 + 1]!, f.rgba[k * 4 + 2]!]
      if (m.ink[k] || brighter >= 5) dark[k] = 1
      else if (lum >= 200 && Math.max(r, g, b) - Math.min(r, g, b) < 60 && darker >= 4) glints.push(k)
    }
  }
  // Small blobs only: a contour or a band of shadow across the face is no detail. And an eye's: some of it as dark as
  // the outline (a pupil, a closed eye's line) or a glint beside it; a marking in a darker shade of the skin
  // (Bulbasaur's forehead spots, Umbreon's rings) is no eye.
  const glinty = new Set(glints)
  const details: number[] = []
  const seen = new Uint8Array(w * h)
  for (let k0 = 0; k0 < w * h; k0++) {
    if (!dark[k0] || seen[k0]) continue
    const blob = [k0]
    seen[k0] = 1
    for (let i = 0; i < blob.length; i++) {
      for (const d of N8) {
        const q = blob[i]! + d
        if (dark[q] && !seen[q]) {
          seen[q] = 1
          blob.push(q)
        }
      }
    }
    const xs = blob.map((k) => k % w)
    const ys = blob.map((k) => Math.floor(k / w))
    const small = blob.length <= 10 && Math.max(...xs) - Math.min(...xs) < 5 && Math.max(...ys) - Math.min(...ys) < 4
    const eyeLike = blob.some((k) => m.ink[k] || N8.some((d) => glinty.has(k + d)))
    if (small && eyeLike) details.push(...blob)
  }
  const near = new Set(details.flatMap((k) => N8.map((d) => k + d)))
  return { top, details: [...details, ...glints.filter((k) => near.has(k))], m }
}

export type Silhouette = ReturnType<typeof silhouetteOf>

/**
 * Judges one item on one frame facing `row` (0..4: S, SE, E, NE, N). The
 * sprite's frame, its measures and its silhouette (`silhouetteOf`), the
 * item's slot and id, where it was drawn and the frame's mouth marker's row;
 * returns every rule it broke (none: it fits).
 */
export const judge = (f: Pixels, truth: Measure, row: number, slot: WearableSlot, id: WearableId, worn: Worn, mouthY: number, sil?: Silhouette): Failure[] => {
  const out: Failure[] = []
  const { w, h } = f
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && f.rgba[(y * w + x) * 4 + 3]! > 0
  const frontAt = (x: number, y: number) => {
    const i = x - worn.x0
    const j = y - worn.y0
    return i >= 0 && j >= 0 && i < worn.w && j < worn.h && worn.front[j * worn.w + i] === 1
  }
  const anyAt = (x: number, y: number) => {
    const i = x - worn.x0
    const j = y - worn.y0
    return i >= 0 && j >= 0 && i < worn.w && j < worn.h && (worn.front[j * worn.w + i] === 1 || (worn.behind[j * worn.w + i] === 1 && !solid(x, y)))
  }
  const rig = truth.rig
  const eyes = truth.eyePx
  // Every item but glasses must leave the eyes alone.
  if (slot !== 'face') {
    let covered = 0
    for (const k of eyes) if (frontAt(k % w, Math.floor(k / w))) covered++
    if (covered > 0) out.push({ rule: 'eye-covered', note: `${covered}/${eyes.length} eye px` })
  }
  if (slot === 'face' && row <= 2) {
    // Glasses sit on the eyes: each eye (or one, for a monocle) has item pixels on it or right beside it.
    if (truth.eyes.length) {
      const touched = truth.eyes.filter((e) => {
        for (let y = e.y0 - 1; y <= e.y1 + 1; y++) for (let x = e.x0 - 1; x <= e.x1 + 1; x++) if (frontAt(x, y)) return true
        return false
      }).length
      const need = ONE_EYE.includes(id) ? 1 : truth.eyes.length
      if (touched < need) out.push({ rule: 'face-off-eyes', note: `${touched}/${truth.eyes.length} eyes under it` })
    }
    // ...and stay on the head: nothing far off the sprite's edge (a strap out in front of the face in profile).
    let outside = 0
    for (let j = 0; j < worn.h; j++) {
      for (let i = 0; i < worn.w; i++) {
        if (!worn.front[j * worn.w + i]) continue
        const x = worn.x0 + i
        const y = worn.y0 + j
        let near = false
        for (let dy = -FACE_SLACK; dy <= FACE_SLACK && !near; dy++) for (let dx = -FACE_SLACK; dx <= FACE_SLACK; dx++) if (solid(x + dx, y + dy)) {
          near = true
          break
        }
        if (!near) outside++
      }
    }
    if (outside > 0) out.push({ rule: 'face-outside', note: `${outside} px over ${FACE_SLACK} px off the sprite` })
  }
  if (slot === 'head' && !FLOATS.includes(id)) {
    const dy = worn.pivot.y - rig.seatY
    // Resting on the head: some of its pixels touch the sprite over the seat's span (a band round the forehead: anywhere on it).
    let touch = false
    if (LOW.includes(id)) for (let j = 0; j < worn.h && !touch; j++) for (let i = 0; i < worn.w && !touch; i++) if (worn.front[j * worn.w + i] && solid(worn.x0 + i, worn.y0 + j)) touch = true
    for (let x = rig.seatX - (rig.seatW >> 1); x <= rig.seatX + (rig.seatW >> 1) && !touch; x++) {
      for (let y = Math.max(0, rig.seatY - 3); y <= Math.min(h - 1, rig.seatY + 3) && !touch; y++) {
        if (!solid(x, y)) continue
        if (frontAt(x, y) || anyAt(x, y - 1)) touch = true
      }
    }
    // A hat lifted clear of the eyes (`placeOf`) sits up to `MAX_LIFT` over its seat, by design.
    if (dy < -SEAT_SLACK - MAX_LIFT || !touch) out.push({ rule: 'seat-float', note: touch ? `${-dy} px over the seat` : 'nothing touches the head' })
    else if (dy > SEAT_SLACK && !LOW.includes(id)) out.push({ rule: 'seat-sunk', note: `${dy} px under the seat` })
  }
  if (slot === 'head' && sil) {
    // The seat by the silhouette: no skull as wide as its opening going on over it (a dome narrows over a seat on its top), nor a tip...
    // ...and it goes on up to the silhouette's top: a crest, a mane, a cloud rising over the head leaves it unsure.
    const skullTop = climb(f, sil.m, rig.seatX, rig.seatY - 1, rig.seatW * SKULL_WIDE)
    let silTop = skullTop
    while (silTop > 0 && sil.m.solid[(silTop - 1) * w + rig.seatX]) silTop--
    const over = rig.seatY - skullTop
    if (over >= SKULL_OVER && skullTop - silTop <= 2) out.push({ rule: 'seat-low', note: `${over} rows of skull over the seat` })
    const { solid } = sil.m
    // A tip: the row under the seat much narrower than the skull's opening (its width, a median over the direction's frames).
    const at = [1, 2].map((d) => runOf(solid, w, rig.seatX, rig.seatY + d)).reduce((a, r) => Math.max(a, r ? r[1] - r[0] + 1 : 0), 0)
    if (at < Math.max(3, rig.seatW * PERCH)) out.push({ rule: 'seat-perch', note: `seat on a tip ${at} px wide, the skull ${rig.seatW}` })
    // The face's details: a hat neither on them nor its outline right over them.
    if (row <= 2 && !FLOATS.includes(id)) {
      const touched = sil.details.filter((k) => frontAt(k % w, Math.floor(k / w)) || frontAt(k % w, Math.floor(k / w) - 1)).length
      if (touched > 0) out.push({ rule: 'features-touched', note: `${touched} px of the face's details under or right under it` })
    }
  }
  if (slot === 'neck') {
    // On the neck: some of it within two rows of the neck's line, and none of it up on the face (on the sprite over the mouth).
    // A mouth marker under the neck's line is no chin to judge by: a beak pointing down (Staraptor's), another head's (Zweilous').
    const chin = Math.min(mouthY, rig.neckY)
    let onLine = false
    let faceUp = 0
    for (let j = 0; j < worn.h; j++) {
      for (let i = 0; i < worn.w; i++) {
        if (!worn.front[j * worn.w + i] && !worn.behind[j * worn.w + i]) continue
        const y = worn.y0 + j
        if (Math.abs(y - rig.neckY) <= 2) onLine = true
        if (worn.front[j * worn.w + i] && row <= 2 && y < chin - 1 && solid(worn.x0 + i, y)) faceUp++
      }
    }
    if (!onLine || faceUp > 2) out.push({ rule: 'neck-off', note: onLine ? `${faceUp} px up on the face` : `nowhere near the neck (row ${rig.neckY})` })
  }
  if (slot === 'back') {
    // Hung at head height: over the neck line on the neck's own column (an upright back), or over the body's top anywhere (a quadruped's back is level with its neck, behind it).
    let top = h
    for (let y = 0; y < h && top === h; y++) if (solid(worn.pivot.x, y)) top = y
    const onNeck = Math.abs(worn.pivot.x - rig.neckX) <= (rig.neckW >> 1) + 1
    if ((onNeck && worn.pivot.y < rig.neckY - 2) || worn.pivot.y < top - 2) out.push({ rule: 'back-high', note: onNeck ? `hung ${rig.neckY - worn.pivot.y} px over the neck` : `hung ${top - worn.pivot.y} px over the back` })
  }
  if (worn.total > 0 && worn.cut / worn.total > CUT_MAX) out.push({ rule: 'clipped', note: `${Math.round((worn.cut / worn.total) * 100)}% cut` })
  return out
}
