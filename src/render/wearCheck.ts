import type { WearableSlot } from '../data/cosmetics'
import type { WearableId } from '../data/wearables'
import type { Measure, Pixels } from './wearRig'

/**
 * The fit check's rules (`npm run fit-check`): what a worn item must never do
 * to a frame, judged from masks rather than by eye. A renderer hands over
 * where it drew an item on the frame (`Worn`); the frame's own measures
 * (`wearRig.measure`: its eyes' pixels, its skull, its seat) are the truth.
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

export type Rule = 'eye-covered' | 'face-off-eyes' | 'face-outside' | 'seat-float' | 'seat-sunk' | 'neck-off' | 'back-high' | 'clipped'

export const RULES: readonly Rule[] = ['eye-covered', 'face-off-eyes', 'face-outside', 'seat-float', 'seat-sunk', 'neck-off', 'back-high', 'clipped']

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

/**
 * Judges one item on one frame facing `row` (0..4: S, SE, E, NE, N). The
 * sprite's frame and its measures, the item's slot and id, and where it was
 * drawn; returns every rule it broke (none: it fits).
 */
export const judge = (f: Pixels, truth: Measure, row: number, slot: WearableSlot, id: WearableId, worn: Worn, mouthY: number): Failure[] => {
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
    if (dy < -SEAT_SLACK || !touch) out.push({ rule: 'seat-float', note: touch ? `${-dy} px over the seat` : 'nothing touches the head' })
    else if (dy > SEAT_SLACK && !LOW.includes(id)) out.push({ rule: 'seat-sunk', note: `${dy} px under the seat` })
  }
  if (slot === 'neck') {
    // On the neck: some of it within two rows of the neck's line, and none of it up on the face (on the sprite over the mouth).
    let onLine = false
    let faceUp = 0
    for (let j = 0; j < worn.h; j++) {
      for (let i = 0; i < worn.w; i++) {
        if (!worn.front[j * worn.w + i] && !worn.behind[j * worn.w + i]) continue
        const y = worn.y0 + j
        if (Math.abs(y - rig.neckY) <= 2) onLine = true
        if (worn.front[j * worn.w + i] && row <= 2 && y < mouthY - 1 && solid(worn.x0 + i, y)) faceUp++
      }
    }
    if (!onLine || faceUp > 2) out.push({ rule: 'neck-off', note: onLine ? `${faceUp} px up on the face` : `nowhere near the neck (row ${rig.neckY})` })
  }
  if (slot === 'back' && worn.pivot.y < rig.neckY - 2) out.push({ rule: 'back-high', note: `hung ${rig.neckY - worn.pivot.y} px over the neck` })
  if (worn.total > 0 && worn.cut / worn.total > CUT_MAX) out.push({ rule: 'clipped', note: `${Math.round((worn.cut / worn.total) * 100)}% cut` })
  return out
}
