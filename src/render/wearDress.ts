import type { WearableSlot } from '../data/cosmetics'
import type { Nudge } from '../data/wearFits'
import type { WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { mirror, rasterize, type PixelArt } from './wearArt'
import { artDir, headSpan, isMirrored, pivotOf, radius, yawFor, yawOf, type WearSize } from './wearFit'
import { sceneOf, WEAR_MODELS } from './wearModels'
import { glinty, masksOf, NONE, type Masks, type Pixels, type RigFrame } from './wearRig'

/**
 * The dresser: worn items drawn into a sprite's frame as if its artist had
 * drawn them (`render/wearWorker.ts` runs it off the main thread, the fit
 * check in Node). Each item's model renders for the wearer's size and
 * direction (`itemArt`); a frame is dressed (`dress`) with the items pinned to
 * its rig, and per pixel: what hangs behind goes under the sprite, the rest
 * over it, except where the rig says no:
 *
 * - no hat, scarf or cape covers an eye, and a hat's band stops a row of the
 *   face short of them (`browOf`), so its outline never reads as their line;
 * - glasses stay on the head (nothing past a pixel off the sprite), and a
 *   frame whose eyes weren't found wears none; a clear lens tints the eye
 *   under it, which shows through;
 * - what wraps the wearer (a strap, a temple, a scarf's wrap: `PixelArt.hug`)
 *   stays on its silhouette, inside its outline, and a face item's on the
 *   head's span at the eyes: past the head it went round, it's out of sight;
 * - a scarf's far half goes behind the neck, and the chin over it; the head
 *   stays over what hangs on the back (`placeOf` keeps wings under it);
 * - what grows from the head above the seat (a leaf, a horn) shows through the
 *   far side of an open item (a crown's ring), and through any hat where the
 *   hand fix says so (`RigFix.over`); a tuft a hat leaves poking out goes;
 *
 * then one outline runs around the whole: the sprite's own where it was,
 * the item's ink where an item meets clear air or the sprite's color, and a
 * one-pixel gap between an item and the sprite closes up, so it rests on it.
 */

/** An item's art for a wearer facing a direction: the still part dressed into frames, and the moving part's frames drawn over them (or none). */
export type ItemArt = { still: PixelArt; moving: PixelArt[] | null }

/** A model rendered for `size` facing `dir` (its frame of animation `frame`), flipped for the west-facing rows. */
const render = (id: WearableId, slot: WearableSlot, size: WearSize, dir: Dir8, frame: number, squash: number) => {
  const raw = rasterize(sceneOf(id, slot, size, frame, squash, artDir(dir)), yawFor(slot, artDir(dir)))
  return isMirrored(dir) ? mirror(raw) : raw
}

/** The lowest row (from the pivot, px down) a hat's art reaches, outline included. */
const reach = (art: PixelArt) => {
  for (let j = art.h - 1; j >= 0; j--) for (let i = 0; i < art.w; i++) if (art.px[j * art.w + i]) return j - art.oy
  return 0
}

/**
 * How far a hat's part under its seat is pressed (0..1) so that its outline
 * ends a row of the face over the eyes (`BROW`) facing south, turned a little and in profile
 * (`WearSize.brow`, `brows`): per direction, two renders measure how its
 * reach grows with the press (the brim's own perspective doesn't), and the
 * press that leaves it there follows; the hat takes the strongest. 0: the
 * hat's tight way (`WearModel.tight`), where no press and lift would clear the eyes.
 */
export const squashOf = (id: WearableId, size: WearSize) => {
  if (WEAR_MODELS[id].unpressed) return 1
  let press = 1
  let lifted = 1
  for (const [dir, brow] of [[0, size.brow], [1, size.brows[0]], [2, size.brows[1]]] as const) {
    if (brow <= 0) continue
    const room = brow - BROW - 1
    const full = reach(render(id, 'head', size, dir, 0, 1))
    if (full <= room) continue
    const half = reach(render(id, 'head', size, dir, 0, 0.5))
    const per = (full - half) * 2
    if (per <= 0) continue
    press = Math.min(press, (room - (half - per / 2)) / per)
    lifted = Math.min(lifted, (room + MAX_LIFT - (half - per / 2)) / per)
  }
  // Pressed as far as it goes and lifted as far as it may (`placeOf`), still over the eyes: worn its tight way, if it has one.
  if (lifted < MIN_PRESS && WEAR_MODELS[id].tight) return 0
  return Math.min(1, Math.max(MIN_PRESS, press))
}

/** How far a hat may be pressed (`squashOf`): flatter, it no longer reads as the hat. */
const MIN_PRESS = 0.3

/**
 * An item's art for a wearer (see `ItemArt`): a still item's single render;
 * a moving one's (a propeller, a flowing cape) split into what every frame of
 * it shares (dressed into the sprite's frames) and each frame's rest, drawn
 * over the dressed frame as it plays.
 */
export const itemArt = (id: WearableId, slot: WearableSlot, size: WearSize, dir: Dir8, squash: number): ItemArt => {
  const count = WEAR_MODELS[id].frames?.count ?? 1
  const first = render(id, slot, size, dir, 0, squash)
  if (count === 1) return { still: first, moving: null }
  const all = [first, ...Array.from({ length: count - 1 }, (_, f) => render(id, slot, size, dir, f + 1, squash))]
  // The frames share the art's box only when the model's bounds don't move: compare them in the pivot's frame.
  const same = (a: PixelArt, k: number, b: PixelArt) => {
    const i = (k % a.w) - a.ox + b.ox
    const j = Math.floor(k / a.w) - a.oy + b.oy
    return i >= 0 && j >= 0 && i < b.w && j < b.h && b.px[j * b.w + i] === a.px[k] && !b.edge[j * b.w + i]
  }
  const keep = new Uint8Array(first.px.length)
  for (let k = 0; k < keep.length; k++) keep[k] = first.px[k] && !first.edge[k] && all.every((b) => same(first, k, b)) ? 1 : 0
  const still: PixelArt = { ...first, px: first.px.map((v, k) => (keep[k] ? v : 0)), edge: new Uint8Array(first.px.length), back: first.back.map((v, k) => (keep[k] ? v : 0)), hug: first.hug.map((v, k) => (keep[k] ? v : 0)), clear: first.clear.map((v, k) => (keep[k] ? v : 0)) }
  const moving = all.map((b) => {
    const px = b.px.map((v, k) => {
      const i = (k % b.w) - b.ox + first.ox
      const j = Math.floor(k / b.w) - b.oy + first.oy
      const stillHere = i >= 0 && j >= 0 && i < first.w && j < first.h && keep[j * first.w + i] === 1
      return stillHere ? 0 : v
    })
    return { ...b, px }
  })
  return { still, moving }
}

/** The run of `sprite`'s opaque pixels on row `y` through column `x` (or the nearest within 2 px), or null. */
const runAt = (sprite: Pixels, x: number, y: number): [number, number] | null => {
  if (y < 0 || y >= sprite.h) return null
  const solid = (i: number) => i >= 0 && i < sprite.w && sprite.rgba[(y * sprite.w + i) * 4 + 3]! > 0
  const c = [0, -1, 1, -2, 2].map((d) => x + d).find(solid)
  if (c === undefined) return null
  let l = c
  let r = c
  while (solid(l - 1)) l--
  while (solid(r + 1)) r++
  return [l, r]
}

/** How far (px) a hat may be lifted off its seat to clear the eyes (`placeOf`); past it, its part on the brow is cut. */
export const MAX_LIFT = 3

/** The lowest row (from the pivot, px down) an art reaches in columns `i0`..`i1` (from the pivot), outline included; -Infinity where it has none. */
const reachIn = (art: PixelArt, i0: number, i1: number) => {
  for (let j = art.h - 1; j >= 0; j--) for (let i = Math.max(0, i0 + art.ox); i <= Math.min(art.w - 1, i1 + art.ox); i++) if (art.px[j * art.w + i]) return j - art.oy
  return -Infinity
}

/**
 * Where an item's model turns on a frame (`pivotOf`), its art known: facing
 * away, what hangs on the back (wings, a balloon) comes down until its top is
 * under the neck's line, so it never stands over the back of the head (a
 * quadruped's shoulders sit right under it), but no lower than halfway to the
 * feet. A hat whose brim, pressed as far as it goes (`squashOf`), still comes
 * down over the brow (`browOf`) is lifted clear of it, up to `MAX_LIFT`, so
 * it keeps its shape instead of losing its brim to the cut. Turned to a side,
 * a neck item rests on the throat: the model's neck meets the frame's
 * (`sprite`) on the side it faces, so what hangs in front (a bell, a bow, a
 * medal) touches the chest instead of floating before it; and what hangs on
 * the back comes in to the frame's back where the body is shallower than wide.
 */
export const placeOf = (rig: RigFrame, slot: WearableSlot, dir: Dir8, size: WearSize, art: ItemArt, out: { x: number; y: number }, sprite?: Pixels) => {
  pivotOf(rig, slot, dir, size, out)
  const a = artDir(dir)
  if (slot === 'back' && (a === 3 || a === 4)) out.y = Math.min(Math.max(out.y, rig.neckY + topOf(art)), Math.round((rig.backY + rig.feetY) / 2))
  if (slot === 'head' && rig.eyeY0 !== NONE) {
    const brow = browOf(rig, sprite ? eyeTopOf(sprite, masksOf(sprite), rig) : rig.eyeY0)!
    const low = Math.max(...[art.still, ...(art.moving ?? [])].map((p) => reachIn(p, brow.x0 - out.x, brow.x1 - out.x)))
    out.y -= Math.min(MAX_LIFT, Math.max(0, out.y + low - brow.y0))
  }
  if (slot === 'back' && sprite && (a === 1 || a === 2)) {
    const run = runAt(sprite, rig.backX, rig.backY)
    if (run && run[0] <= out.x && out.x <= run[1]) {
      const s = isMirrored(dir) ? -1 : 1
      const r = radius(size.body)
      // The model's back where it turns to the camera's side, pulled in to a pixel inside the frame's back outline
      // when it would hang in the air behind it (a body shallower than it is wide: Gengar's, Snorlax's), never
      // pushed out, nor its axis off the body.
      const back = out.x - s * r * Math.sin(yawOf(a))
      const gap = Math.min(((s > 0 ? run[0] : run[1]) + s - back) * s, r, (s > 0 ? run[1] - out.x : out.x - run[0]) - 1)
      if (gap > 0) out.x += s * Math.round(gap)
    }
  }
  if (slot === 'neck' && sprite && a >= 1 && a <= 3) {
    const run = runAt(sprite, rig.neckX, rig.neckY)
    if (run) {
      const s = isMirrored(dir) ? -1 : 1
      const r = radius(size.neck)
      // The model's neck surface one pixel inside the frame's outline, never more than its radius off the rig's axis.
      const edge = (s > 0 ? run[1] : run[0]) - s
      out.x += Math.round(Math.min(r, Math.max(-r, edge - (out.x + s * r))))
    }
  }
  return out
}

/** Rows of the face a hat leaves between its outline and the eyes. */
const BROW = 1

/**
 * The eyes' top on a frame: the rig's, or up to two rows higher where a glint
 * or a line sits right over it across the eyes (the rig finds a pupil's dark;
 * its glint, its lid are the eye too).
 */
const eyeTopOf = (sprite: Pixels, m: Masks, rig: RigFrame) => {
  let top = rig.eyeY0
  for (let y = rig.eyeY0 - 1; y >= Math.max(0, rig.eyeY0 - 2); y--) {
    let eye = false
    for (let x = Math.max(0, rig.eyeX0); x <= Math.min(sprite.w - 1, rig.eyeX1) && !eye; x++) {
      const k = y * sprite.w + x
      eye = m.solid[k] === 1 && !m.edge[k] && (m.ink[k] === 1 || glinty(sprite.rgba, k * 4))
    }
    if (!eye) break
    top = y
  }
  return top
}

/**
 * Where a hat may not reach on a frame with eyes: from `BROW` rows and its
 * outline over the eyes' top (`top`: `eyeTopOf`, the rig's without the
 * frame) down, across the eyes and a little either side (within the head's
 * span at them). Null without eyes.
 */
export const browOf = (rig: RigFrame, top = rig.eyeY0) =>
  rig.eyeY0 === NONE ? null : { x0: Math.max(rig.faceL, rig.eyeX0 - 3), x1: Math.min(rig.faceR, rig.eyeX1 + 3), y0: top - BROW - 1 }

/** How far (px) an item's art reaches over its pivot, all its frames counted. */
export const topOf = (art: ItemArt) => Math.max(art.still.oy, ...(art.moving ?? []).map((m) => m.oy))

/**
 * A moving item's frames as they play over a dressed row (`itemArt`'s
 * `moving`), cut as the dresser cuts the still part: never on the eyes
 * (where they sit around the pivot on any of the row's frames) nor, for a
 * hat, over its brow (`browOf`); a scarf's or a cape's far half plays behind
 * the body. `sprites`: the row's frames, which place a neck item (`placeOf`).
 */
export const movingParts = (art: ItemArt, slot: WearableSlot, layer: 'front' | 'behind', rigs: readonly RigFrame[], row: Dir8, size: WearSize, sprites?: readonly (Pixels | undefined)[]) => {
  if (!art.moving) return []
  const pivot = { x: 0, y: 0 }
  const cuts = rigs.flatMap((rig, f) => {
    if (rig.eyeY0 === NONE || slot === 'face') return []
    const sprite = sprites?.[f]
    placeOf(rig, slot, row, size, art, pivot, sprite)
    const brow = browOf(rig, sprite ? eyeTopOf(sprite, masksOf(sprite), rig) : rig.eyeY0)!
    const eye = slot === 'head' ? { x0: brow.x0 - pivot.x, x1: brow.x1 - pivot.x, y0: brow.y0 - pivot.y, y1: Infinity } : { x0: rig.eyeX0 - pivot.x, x1: rig.eyeX1 - pivot.x, y0: rig.eyeY0 - pivot.y, y1: rig.eyeY1 - pivot.y }
    // A scarf's moving end stays under the neck's line, as its still part does (`dress`): turned, it streams up behind the head.
    const chin = { x0: -Infinity, x1: Infinity, y0: -Infinity, y1: rig.neckY - 3 - pivot.y }
    return slot === 'neck' ? [eye, chin] : [eye]
  })
  const split = layer === 'front' && (slot === 'neck' || slot === 'back')
  const part = (far: boolean): PixelArt[] =>
    art.moving!.map((m) => ({
      ...m,
      px: m.px.map((v, k) => {
        const x = (k % m.w) - m.ox
        const y = Math.floor(k / m.w) - m.oy
        if (!v || (split ? (m.back[k] === 1) !== far : far)) return 0
        return cuts.some((c) => x >= c.x0 && x <= c.x1 && y >= c.y0 && y <= c.y1) ? 0 : v
      }),
    }))
  return [{ layer, frames: part(false) }, ...(split ? [{ layer: 'behind' as const, frames: part(true) }] : [])]
}

/** One item to dress a frame with: its art, its pivot on the frame (frame px), its pass and what it may let through. */
export type Dressing = { id: WearableId; slot: WearableSlot; art: PixelArt; x: number; y: number; layer: 'front' | 'behind' }

/** A dressed frame: `w` × `h` RGBA with the frame's top-left at (`ox`, `oy`); and, for the fit check, each item's pixels and how many the rig cut. */
export type Dressed = {
  w: number
  h: number
  ox: number
  oy: number
  rgba: Uint8ClampedArray
  /** Per pixel, 1 + the index of the item drawn there over the sprite (0 none). */
  front: Uint8Array
  /** Per pixel, 1 + the index of the item drawn under the sprite there (0 none). */
  behind: Uint8Array
  cut: number[]
  total: number[]
}

/** How far (px) glasses may stray off the sprite before the dresser cuts them (the fit check allows a pixel more). */
const FACE_SLACK = 1
/** A tuft of the sprite this small poking out of a hat goes. */
const TUFT = 3

const rgbOf = (c: string) => parseInt(c.slice(1, 7), 16)

/** How much of a clear lens's color tints what's under it. */
const GLASS_TINT = 0.3
/** A packed RGB color under a clear lens of color `glass`. */
const tint = (under: number, glass: number) => {
  const mix = (sh: number) => Math.round(((under >> sh) & 255) * (1 - GLASS_TINT) + ((glass >> sh) & 255) * GLASS_TINT)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}

/**
 * Dresses one frame (see the module's doc): the sprite's pixels, its rig, the
 * items in drawing order (`DRAW_ORDER`) and the hand fix's pixels drawn over
 * any hat (`RigFix.over`, from the seat).
 */
export const dress = (sprite: Pixels, rig: RigFrame, items: readonly Dressing[], over: readonly Nudge[] = []): Dressed => {
  const { w: fw, h: fh } = sprite
  // The box: the frame and every item's art around its pivot.
  let x0 = 0
  let y0 = 0
  let x1 = fw
  let y1 = fh
  for (const it of items) {
    x0 = Math.min(x0, it.x - it.art.ox)
    y0 = Math.min(y0, it.y - it.art.oy)
    x1 = Math.max(x1, it.x - it.art.ox + it.art.w)
    y1 = Math.max(y1, it.y - it.art.oy + it.art.h)
  }
  const W = x1 - x0
  const H = y1 - y0
  const n = W * H
  const ox = -x0
  const oy = -y0
  const color = new Uint32Array(n)
  /** 0 clear, 1 the sprite, 2 + i item i's shape. */
  const owner = new Uint16Array(n)
  /** The outline color an item's pixel takes (an index into its art's colors), by pixel. */
  const inkAt = new Uint8Array(n)
  const front = new Uint8Array(n)
  const behind = new Uint8Array(n)
  const cut = items.map(() => 0)
  const total = items.map(() => 0)
  const m = masksOf(sprite)
  const at = (x: number, y: number) => (y + oy) * W + x + ox
  const spriteAt = (x: number, y: number) => x >= 0 && y >= 0 && x < fw && y < fh && m.solid[y * fw + x] === 1
  const eyes = rig.eyeY0 !== NONE
  const inEyes = (x: number, y: number) => eyes && x >= rig.eyeX0 && x <= rig.eyeX1 && y >= rig.eyeY0 && y <= rig.eyeY1
  const brow = eyes ? browOf(rig, eyeTopOf(sprite, m, rig)) : null
  const [headL, headR] = headSpan(rig)
  /** Whether a hugging pixel of a `slot` item shows at (x, y): inside the sprite's outline, and a face item's within the head's span. */
  const wraps = (slot: WearableSlot, x: number, y: number) => spriteAt(x, y) && !m.edge[y * fw + x] && (slot !== 'face' || (x >= headL && x <= headR))
  const overSet = new Set(over.map(([dx, dy]) => (rig.seatY + dy) * 4096 + rig.seatX + dx))
  const palettes = items.map((it) => it.art.colors.map((c) => (c ? rgbOf(c) : 0)))
  const paint = (i: number, pass: 'front' | 'behind') => {
    const it = items[i]!
    const { art } = it
    const open = WEAR_MODELS[it.id].open === true
    // Glasses go where eyes were found: a frame without them (a profile the rig can't read) wears none.
    if (it.slot === 'face' && !eyes) return
    for (let j = 0; j < art.h; j++) {
      for (let a = 0; a < art.w; a++) {
        const k = j * art.w + a
        if (!art.px[k] || art.edge[k]) continue
        const x = it.x - art.ox + a
        const y = it.y - art.oy + j
        total[i]!++
        const o = at(x, y)
        // What wraps the wearer is on it or out of sight: never under it, nor past its outline.
        if (art.hug[k] && !wraps(it.slot, x, y)) continue
        if (pass === 'behind') {
          if (owner[o] === 0 || owner[o]! >= 2) {
            owner[o] = 2 + i
            color[o] = palettes[i]![art.px[k]!]!
            inkAt[o] = art.ink[k]!
          }
          behind[o] = 1 + i
          continue
        }
        const onSprite = spriteAt(x, y)
        // The rig's cuts: the eyes, a band down to them, glasses off the head.
        if (it.slot !== 'face' && inEyes(x, y)) {
          cut[i]!++
          continue
        }
        if (it.slot === 'head' && brow && y >= brow.y0 && x >= brow.x0 && x <= brow.x1 && onSprite) {
          cut[i]!++
          continue
        }
        if (it.slot === 'face' && !onSprite) {
          let near = false
          for (let dy = -FACE_SLACK; dy <= FACE_SLACK && !near; dy++) for (let dx = -FACE_SLACK; dx <= FACE_SLACK; dx++) if (spriteAt(x + dx, y + dy)) near = true
          if (!near) {
            cut[i]!++
            continue
          }
        }
        // What grows from the head shows through an open item's far side, and through any hat where the fix says; a scarf's far half is behind the neck.
        if (it.slot === 'head' && onSprite && y < rig.seatY && ((open && art.back[k]) || overSet.has(y * 4096 + x))) continue
        if (it.slot === 'neck' && onSprite && (art.back[k] || y < rig.neckY - 2)) continue
        // Facing away, the head stays over what hangs on the back.
        if (it.slot === 'back' && onSprite && y < rig.neckY) continue
        // A clear lens over the sprite tints what's under it: the eye shows through.
        color[o] = art.clear[k] && onSprite ? tint(color[o]!, palettes[i]![art.px[k]!]!) : palettes[i]![art.px[k]!]!
        owner[o] = 2 + i
        inkAt[o] = art.ink[k]!
        front[o] = 1 + i
      }
    }
  }
  items.forEach((it, i) => it.layer === 'behind' && paint(i, 'behind'))
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      if (!m.solid[y * fw + x]) continue
      const i = (y * fw + x) * 4
      const o = at(x, y)
      owner[o] = 1
      color[o] = (sprite.rgba[i]! << 16) | (sprite.rgba[i + 1]! << 8) | sprite.rgba[i + 2]!
    }
  }
  items.forEach((it, i) => it.layer === 'front' && paint(i, 'front'))
  const isFront = (o: number) => owner[o]! >= 2 && items[owner[o]! - 2]!.layer === 'front'
  // Tufts: a few pixels of the sprite a hat leaves poking out over its seat go.
  const head = items.findIndex((it) => it.slot === 'head' && it.layer === 'front' && WEAR_MODELS[it.id].open !== true)
  if (head >= 0) {
    const seen = new Uint8Array(n)
    for (let y = 0; y < Math.min(rig.seatY, fh); y++) {
      for (let x = 0; x < fw; x++) {
        const o0 = at(x, y)
        if (owner[o0] !== 1 || seen[o0]) continue
        const part: number[] = []
        let touches = false
        const stack = [o0]
        seen[o0] = 1
        while (stack.length) {
          const o = stack.pop()!
          part.push(o)
          for (const d of [1, -1, W, -W]) {
            const q = o + d
            if (q < 0 || q >= n) continue
            if (owner[q] === 2 + head) touches = true
            const qy = Math.floor(q / W) - oy
            if (owner[q] === 1 && !seen[q] && qy < rig.seatY) {
              seen[q] = 1
              stack.push(q)
            }
          }
        }
        if (touches && part.length <= TUFT) for (const o of part) owner[o] = 0
      }
    }
  }
  // The outline: around every item in its ink, where it meets clear air (and, over the sprite, the sprite's color).
  const inkOf = (o: number) => {
    const c = inkAt[o]!
    return c ? palettes[owner[o]! - 2]![c]! : -1
  }
  const outline = new Int32Array(n).fill(-1)
  const fill = new Int32Array(n).fill(-1)
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const o = y * W + x
      if (owner[o]! >= 2) continue
      let ink = -1
      let near = -1
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const q = ny * W + nx
        if (owner[q]! < 2 || (owner[o] === 1 && !isFront(q))) continue
        const c = inkOf(q)
        if (c >= 0) {
          ink = c
          near = q
          break
        }
      }
      if (ink < 0) continue
      const fx = x - ox
      const fy = y - oy
      const item = items[owner[near]! - 2]!
      if (item.slot !== 'face' && inEyes(fx, fy)) continue
      if (owner[o] === 1) {
        // On the sprite: its own outline stays; elsewhere the item's ink is where they meet (not up on the chin over a scarf, nor on the head over a cape).
        if (item.slot === 'neck' && fy < rig.neckY - 2) continue
        if (item.slot === 'back' && fy < rig.neckY) continue
        if (!m.ink[fy * fw + fx]) outline[o] = ink
        continue
      }
      // Clear: a gap a pixel wide between the item and the sprite closes up (the item rests on it); else the outline.
      const ax = 2 * x - (near % W)
      const ay = 2 * y - Math.floor(near / W)
      const across = ax >= 0 && ay >= 0 && ax < W && ay < H ? ay * W + ax : -1
      if (across >= 0 && owner[across] === 1 && m.ink[(ay - oy) * fw + ax - ox]) fill[o] = color[near]!
      else outline[o] = ink
    }
  }
  const rgba = new Uint8ClampedArray(n * 4)
  for (let o = 0; o < n; o++) {
    let c = -1
    if (fill[o]! >= 0) c = fill[o]!
    else if (outline[o]! >= 0) c = outline[o]!
    else if (owner[o]) c = color[o]!
    if (c < 0) continue
    rgba[o * 4] = (c >> 16) & 255
    rgba[o * 4 + 1] = (c >> 8) & 255
    rgba[o * 4 + 2] = c & 255
    rgba[o * 4 + 3] = 255
    if (outline[o]! >= 0 || fill[o]! >= 0) {
      // The outline and the closed gaps belong to the item beside them.
      for (const d of [1, -1, W, -W]) {
        const q = o + d
        if (q >= 0 && q < n && owner[q]! >= 2) {
          ;(isFront(q) ? front : behind)[o] = owner[q]! - 1
          break
        }
      }
    }
  }
  return { w: W, h: H, ox, oy, rgba, front, behind, cut, total }
}
