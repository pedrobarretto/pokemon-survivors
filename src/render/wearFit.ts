import type { WearableSlot } from '../data/cosmetics'
import { ART_DIRS, WEAR_FITS, type FitKey, type Nudge, type SpeciesFit } from '../data/wearFits'
import type { WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'

/**
 * Where a wearable goes on a frame (`render/wearables.ts` draws it): the
 * species' anchors (`data/wearAnchors/`, `npm run anchors`)
 * decoded, the pivot of each slot per frame and direction, the size class a
 * species wears, and which pass a slot draws in as the Pokémon turns.
 */

/** The five directions wearable art is drawn for (S, SE, E, NE, N); the sheets' other three rows are their mirrors. */
export type ArtDir = 0 | 1 | 2 | 3 | 4

/** A sheet row's art direction: SW, W and NW draw SE's, E's and NE's art flipped. */
export const artDir = (dir: Dir8): ArtDir => (dir <= 4 ? dir : 8 - dir) as ArtDir

export const isMirrored = (dir: Dir8) => dir > 4

/** How far an art direction is turned from facing the camera (radians, toward screen right). */
export const yawOf = (d: ArtDir) => (d * Math.PI) / 4

/**
 * Where a slot draws relative to the sprite: `behind` before it, `front` after
 * it, or not at all. Face items hide facing away; a cape is behind the body
 * facing south and over it facing north; hats are always in front.
 */
export type Layer = 'front' | 'behind' | 'hidden'

export const SLOT_LAYERS = {
  head: ['front', 'front', 'front', 'front', 'front'],
  face: ['front', 'front', 'front', 'hidden', 'hidden'],
  neck: ['front', 'front', 'front', 'front', 'front'],
  back: ['behind', 'behind', 'behind', 'front', 'front'],
} as const satisfies Record<WearableSlot, readonly [Layer, Layer, Layer, Layer, Layer]>

/** The slots in the order a pass draws them: what hangs on the back first, the hat last, on top. */
export const DRAW_ORDER = ['back', 'neck', 'face', 'head'] as const satisfies readonly WearableSlot[]

/** A slot's layer facing `dir`, from an item's own table (`WearModel.layers`) or its slot's. */
export const layerOf = (slot: WearableSlot, dir: Dir8, own?: readonly Layer[]): Layer => (own ?? SLOT_LAYERS[slot])[artDir(dir)]!

/* ---------------- Anchors ---------------- */

/** A generated entry (`npm run anchors`): base64 bytes. */
export type AnchorEntry = { dirs: string; Walk: string; Idle: string; Hurt: string }

/** One file of `data/wearAnchors/`: the entries of the variants whose dex falls in its chunk (`anchorChunk`), by `anchorKey`. */
export type AnchorChunk = { pitch: number; geometry: readonly string[]; species: Record<string, AnchorEntry> }

/**
 * The file of `data/wearAnchors/` a species' anchors are in, every form and
 * color of it together (`scripts/anchors.mjs` files them so): 32 dex numbers a
 * file, so a client loads only the chunks of the species it draws, a few KB each.
 */
export const anchorChunk = (dex: number) => Math.floor(dex / 32)

/**
 * A variant's entry in its chunk: `<dex>`, `<dex>:<form>`, and an `s` after
 * either for a shiny whose frames differ (any other shiny wears its normal
 * colors' anchors: same sheets, recolored). Also `WEAR_FITS`' key, without the `s`.
 */
export const anchorKey = (dex: number, form: string | undefined, shiny: boolean) => `${dex}${form ? `:${form}` : ''}${shiny ? 's' : ''}`

export type AnchorAnim = 'Walk' | 'Idle' | 'Hurt'

/** One sheet's markers: per direction and frame, the mouth's x, y and the center's x, y. */
export type SheetAnchors = { fw: number; fh: number; frames: number; marks: Uint8Array }

/** A species variant's anchors: its directions' measures (signed, `GEOMETRY` order) and its sheets' markers. */
export type Anchors = { geo: Int8Array; anims: Record<AnchorAnim, SheetAnchors> }

/** The measures each direction has, in the order `scripts/anchors.mjs` writes them. */
export const GEOMETRY = ['headX', 'headY', 'headW', 'faceX', 'faceY', 'neckX', 'neckY', 'neckW', 'backX', 'backY', 'bodyW', 'feetY'] as const

const G = Object.fromEntries(GEOMETRY.map((k, i) => [k, i])) as Record<(typeof GEOMETRY)[number], number>
const STRIDE = GEOMETRY.length

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

const sheet = (b64: string): SheetAnchors => {
  const b = bytes(b64)
  return { fw: b[0]!, fh: b[1]!, frames: b[2]!, marks: b.subarray(3) }
}

export const decodeAnchors = (e: AnchorEntry): Anchors => ({
  geo: Int8Array.from(bytes(e.dirs), (v) => v - 128),
  anims: { Walk: sheet(e.Walk), Idle: sheet(e.Idle), Hurt: sheet(e.Hurt) },
})

/**
 * Which of the anchors' sheets a drawn frame is (`placeFrame` found it), or
 * null when the anchors don't know it: the sky's Fly sheet, a sheet shrunk to
 * size (a legend's) or swapped (an emote's) draw bare.
 */
export const anchoredSheet = (a: Anchors, p: { anim: string; fw: number; fh: number; frames: number }): AnchorAnim | null => {
  if (p.anim !== 'Walk' && p.anim !== 'Idle' && p.anim !== 'Hurt') return null
  const s = a.anims[p.anim]
  return s.fw === p.fw && s.fh === p.fh && s.frames === p.frames ? p.anim : null
}

/** A species' fitting by hand (`data/wearFits.ts`), or a form's (its own: a Mega is drawn anew, so the species' nudges don't carry over). */
export const fitOf = (dex: number, form?: string): SpeciesFit | undefined => {
  const key: FitKey = form ? `${dex}:${form}` : dex
  return WEAR_FITS[key]
}

/** A slot's nudge facing `dir` (mirrored for the west-facing rows), or null. */
export const nudgeOf = (fit: SpeciesFit | undefined, slot: WearableSlot, dir: Dir8): Nudge | null => {
  const n = fit?.nudge?.[slot]
  if (!n) return null
  const v = Array.isArray(n) ? (n as Nudge) : (n as Partial<Record<string, Nudge>>)[ART_DIRS[artDir(dir)]]
  if (!v) return null
  return isMirrored(dir) ? [-v[0], v[1]] : v
}

/** Whether a species wears an item at all (`SpeciesFit.no`). */
export const wears = (fit: SpeciesFit | undefined, slot: WearableSlot, id: WearableId) => !fit?.no?.some((k) => k === slot || k === id)

/**
 * The pivot of `slot` (`render/wearModels.ts`) on frame `frame` of a sheet,
 * facing `dir`, in the frame's px: the frame's marker (the mouth for the head,
 * face and neck; the center for the back) plus the direction's measure and
 * the hand nudge. Written into `out` (the draw loop runs it for every
 * wearable of every Pokémon on screen).
 */
export const pivotAt = (a: Anchors, anim: AnchorAnim, dir: Dir8, frame: number, slot: WearableSlot, nudge: Nudge | null, out: { x: number; y: number }) => {
  const s = a.anims[anim]
  const i = (dir * s.frames + Math.min(frame, s.frames - 1)) * 4
  const g = dir * STRIDE
  const back = slot === 'back'
  const kx = slot === 'head' ? G.headX : slot === 'face' ? G.faceX : slot === 'neck' ? G.neckX : G.backX
  out.x = s.marks[i + (back ? 2 : 0)]! + a.geo[g + kx]! + (nudge ? nudge[0] : 0)
  out.y = s.marks[i + (back ? 3 : 1)]! + a.geo[g + kx + 1]! + (nudge ? nudge[1] : 0)
  return out
}

/** The size (px) a species measures facing south: its head, neck and body widths, its back to its feet and up to the top of its head. */
export const measuresOf = (a: Anchors) => {
  const [, my, , gy] = a.anims.Walk.marks
  const backY = gy! + a.geo[G.backY]!
  return {
    head: a.geo[G.headW]!,
    neck: a.geo[G.neckW]!,
    body: a.geo[G.bodyW]!,
    drop: a.geo[G.feetY]! - a.geo[G.backY]!,
    rise: backY - (my! + a.geo[G.headY]!),
  }
}

/** The index of the class nearest `value` (the larger on a tie). */
export const classOf = (value: number, classes: readonly number[]) => {
  let best = 0
  for (let i = 1; i < classes.length; i++) if (Math.abs(classes[i]! - value) <= Math.abs(classes[best]! - value)) best = i
  return best
}
