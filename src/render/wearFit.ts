import type { WearableSlot } from '../data/cosmetics'
import { ART_DIRS, WEAR_FITS, type ArtDirName, type FitKey, type RigFix, type SpeciesFit } from '../data/wearFits'
import type { WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import { NONE, unpackRig, type RigFrame, type SheetRig } from './wearRig'

/**
 * Where a wearable goes on a frame (`render/wearDress.ts` dresses it): a
 * variant's head rig (`data/wearRig/`, `npm run rig`) decoded with its hand
 * fixes (`data/wearFits.ts`), the size each slot's model takes from it, the
 * pivot each model turns around on a frame, and which pass a slot draws in as
 * the Pokémon turns. Pure: the main thread and the wearables' worker share it.
 */

/** The five directions wearable art is drawn for (S, SE, E, NE, N); the sheets' other three rows are their mirrors. */
export type ArtDir = 0 | 1 | 2 | 3 | 4

/** A sheet row's art direction: SW, W and NW draw SE's, E's and NE's art flipped. */
export const artDir = (dir: Dir8): ArtDir => (dir <= 4 ? dir : 8 - dir) as ArtDir

export const isMirrored = (dir: Dir8) => dir > 4

/** How far an art direction is turned from facing the camera (radians, toward screen right). */
export const yawOf = (d: ArtDir) => (d * Math.PI) / 4

/** How far down the camera looks at the sprites (radians): PMD sprites are drawn from a little above, heads almost head-on. */
export const PITCH = (22 * Math.PI) / 180

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

/* ---------------- The rig's files ---------------- */

/** A generated entry (`npm run rig`): each anim's rig as base64 bytes (`packRig`). */
export type RigEntry = { Walk: string; Idle: string; Hurt: string }

/** One file of `data/wearRig/`: the entries of the variants whose dex falls in its chunk (`rigChunk`), by `rigKey`. */
export type RigChunk = { fields: readonly string[]; species: Record<string, RigEntry> }

/**
 * The file of `data/wearRig/` a species' rig is in, every form and color of it
 * together (`scripts/rig.mjs` files them so): 32 dex numbers a file, so a
 * client loads only the chunks of the species it draws.
 */
export const rigChunk = (dex: number) => Math.floor(dex / 32)

/**
 * A variant's entry in its chunk: `<dex>`, `<dex>:<form>`, and an `s` after
 * either for a shiny whose frames differ (any other shiny wears its normal
 * colors' rig: same sheets, recolored). Also `WEAR_FITS`' key, without the `s`.
 */
export const rigKey = (dex: number, form: string | undefined, shiny: boolean) => `${dex}${form ? `:${form}` : ''}${shiny ? 's' : ''}`

export type RigAnim = 'Walk' | 'Idle' | 'Hurt'

/** A variant's rig, every anim's, its hand fixes applied. */
export type Rig = Record<RigAnim, SheetRig>

const bytes = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** A species' fitting by hand (`data/wearFits.ts`), or a form's (its own: a Mega is drawn anew, so the species' fixes don't carry over). */
export const fitOf = (dex: number, form?: string): SpeciesFit | undefined => {
  const key: FitKey = form ? `${dex}:${form}` : dex
  return WEAR_FITS[key]
}

/** A row's hand fix (its art direction's on top of `all`), mirrored for the west-facing rows. */
export const fixOf = (fit: SpeciesFit | undefined, row: number): RigFix | null => {
  const all = fit?.rig?.all
  const own = fit?.rig?.[ART_DIRS[artDir(row as Dir8)] as ArtDirName]
  if (!all && !own) return null
  const add = (a?: readonly number[], b?: readonly number[]) => (a || b ? [0, 1, 2].map((i) => (a?.[i] ?? 0) + (b?.[i] ?? 0)) : undefined)
  const flip = isMirrored(row as Dir8) ? -1 : 1
  const fx = <T extends readonly number[] | undefined>(v: T) => (v ? [v[0]! * flip, ...v.slice(1)] : undefined)
  const eyes = own?.eyes ?? all?.eyes
  const at = own?.eyesAt ?? all?.eyesAt
  return {
    seat: fx(add(all?.seat, own?.seat)) as RigFix['seat'],
    eyes: eyes === 'none' ? eyes : (fx(eyes) as RigFix['eyes']),
    ...(at && { eyesAt: at.map(([x, y]) => [x * flip, y] as const) }),
    neck: fx(add(all?.neck, own?.neck)) as RigFix['neck'],
    back: fx(add(all?.back, own?.back)) as RigFix['back'],
    over: [...(all?.over ?? []), ...(own?.over ?? [])].map(([x, y]) => [x * flip, y] as const),
  }
}

/** A frame's rig with a hand fix applied (`fixOf`). */
export const fixFrame = (r: RigFrame, fix: RigFix | null): RigFrame => {
  if (!fix) return r
  const o = { ...r }
  if (fix.seat) {
    o.seatX += fix.seat[0]
    o.seatY += fix.seat[1]
    o.seatW += fix.seat[2] ?? 0
  }
  if (fix.eyes === 'none') {
    o.eyeX0 = o.eyeY0 = o.eyeX1 = o.eyeY1 = o.e1x = o.e1y = o.e2x = o.e2y = NONE
  } else if (fix.eyes && o.e1x !== NONE) {
    const [dx, dy] = fix.eyes
    o.eyeX0 += dx
    o.eyeX1 += dx
    o.e1x += dx
    o.e2x += dx
    o.eyeY0 += dy
    o.eyeY1 += dy
    o.e1y += dy
    o.e2y += dy
  } else if (fix.eyesAt?.length) {
    const at = [...fix.eyesAt].map(([x, y]) => [o.seatX + x, o.seatY + y] as const).sort((a, b) => a[0] - b[0])
    const [a, b] = [at[0]!, at[at.length - 1]!]
    ;[o.e1x, o.e1y, o.e2x, o.e2y] = [a[0], a[1], b[0], b[1]]
    o.eyeX0 = a[0] - 1
    o.eyeX1 = b[0] + 1
    o.eyeY0 = Math.min(a[1], b[1]) - 1
    o.eyeY1 = Math.max(a[1], b[1]) + 1
  }
  if (fix.neck) {
    o.neckX += fix.neck[0]
    o.neckY += fix.neck[1]
  }
  if (fix.back) {
    o.backX += fix.back[0]
    o.backY += fix.back[1]
  }
  return o
}

/** A generated entry decoded, the variant's hand fixes applied to every frame (by the row's art direction). */
export const decodeRig = (e: RigEntry, fit: SpeciesFit | undefined): Rig => {
  const fixes = Array.from({ length: 8 }, (_, row) => fixOf(fit, row))
  const anim = (b64: string): SheetRig => {
    const s = unpackRig(bytes(b64))
    return { ...s, rows: s.rows.map((frames, row) => frames.map((r) => fixFrame(r, fixes[row]!))) }
  }
  return { Walk: anim(e.Walk), Idle: anim(e.Idle), Hurt: anim(e.Hurt) }
}

/**
 * Which of the rig's sheets a drawn frame is (`placeFrame` found it), or null
 * when the rig doesn't know it: the sky's Fly sheet or a sheet swapped (an
 * emote's) draw bare.
 */
export const rigSheet = (rig: Rig, p: { anim: string; fw: number; fh: number; frames: number }): RigAnim | null => {
  if (p.anim !== 'Walk' && p.anim !== 'Idle' && p.anim !== 'Hurt') return null
  const s = rig[p.anim]
  return s.fw === p.fw && s.fh === p.fh && s.frames === p.frames ? p.anim : null
}

/** Whether a species wears an item at all (`SpeciesFit.no`). */
export const wears = (fit: SpeciesFit | undefined, slot: WearableSlot, id: WearableId) => !fit?.no?.some((k) => k === slot || k === id)

/* ---------------- Sizes and pivots ---------------- */

/**
 * What a variant's models are sized from (px), measured facing south on its
 * first Walk frame (the depth in profile): the seat's width (`head`), the
 * head's depth, how far below the seat its eyes start (`brow`: no band comes
 * down that far), the head's width at the eyes (`face`), half the eyes' gap
 * (`eye`, 0 unknown), the neck's and body's widths, and from the back down
 * to the feet (`drop`) and up to the seat (`rise`); `brows`, the brow's room
 * turned a little and in profile (SE, E; 0 where no eyes show), which a hat's
 * band must clear too.
 */
export type WearSize = { head: number; depth: number; brow: number; brows: readonly [number, number]; face: number; eye: number; neck: number; body: number; drop: number; rise: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** A variant's size (`WearSize`), with its hand fitting's (`SpeciesFit.size`) on top. */
export const sizeOf = (rig: Rig, fit: SpeciesFit | undefined): WearSize => {
  const s = rig.Walk.rows[0]![0]!
  const se = rig.Walk.rows[1]![0]!
  const e = rig.Walk.rows[2]![0]!
  const room = (r: RigFrame) => (r.eyeY0 !== NONE ? Math.max(1, r.eyeY0 - r.seatY) : 0)
  const add = fit?.size ?? {}
  const head = clamp(s.seatW + (add.head ?? 0), 7, 26)
  const eyes = s.eyeY0 !== NONE
  return {
    head,
    depth: clamp(e.seatW, Math.round(head * 0.6), Math.round(head * 1.6)),
    brow: eyes ? Math.max(1, s.eyeY0 - s.seatY) : Math.max(3, Math.round((s.neckY - s.seatY) * 0.45)),
    brows: [room(se), room(e)],
    // Glasses as wide as the face, but no wider than the eyes' gap makes believable (a face read too wide spans the chest).
    face: clamp(s.faceR - s.faceL + 1 + (add.face ?? 0), eyes && s.e2x !== s.e1x ? s.e2x - s.e1x + 5 : 7, eyes && s.e2x !== s.e1x ? Math.round((s.e2x - s.e1x) * 2.6) + 5 : 26),
    eye: eyes && s.e2x !== s.e1x ? (s.e2x - s.e1x) / 2 : 0,
    neck: clamp(s.neckW + (add.neck ?? 0), 5, 22),
    body: clamp(s.bodyW + (add.back ?? 0), 8, 40),
    drop: Math.max(4, Math.round((s.feetY - s.backY) / 2) * 2),
    rise: Math.max(4, Math.round((s.backY - s.seatY) / 2) * 2),
  }
}

/** A model's radius for a measured width: the art adds a 1 px outline around the shape. */
export const radius = (w: number) => (w - 1) / 2

/** Half the eyes' gap a face model takes, for a face of radius `r`: the rig's, kept believable. */
export const eyeOf = (size: WearSize, r: number) => (size.eye > 0 ? clamp(size.eye, r * 0.26, r * 0.62) : r * 0.42)

/** How much deeper than wide a variant's head is: face models and hats stretch along it. */
export const depthOf = (size: WearSize) => clamp(size.depth / size.head, 0.7, 1.4)

/**
 * The pivot of `slot` (`render/wearModels.ts` builds each model around it) on a
 * frame's rig, facing `dir`, in the frame's px: the seat (hats), the head's
 * center behind the eyes (glasses: where the model's eyes, turned to face
 * `dir`, land on the eyes found), the neck's axis behind its front, the
 * back's point. Written into `out` (the draw loop runs it every frame).
 */
export const pivotOf = (r: RigFrame, slot: WearableSlot, dir: Dir8, size: WearSize, out: { x: number; y: number }) => {
  const yaw = yawOf(artDir(dir))
  const flip = isMirrored(dir) ? -1 : 1
  const sp = Math.sin(PITCH)
  if (slot === 'head') {
    out.x = r.seatX
    out.y = r.seatY
  } else if (slot === 'face') {
    const rf = radius(size.face)
    const e = eyeOf(size, rf)
    const zf = Math.sqrt(Math.max(rf * rf - e * e, 0)) * depthOf(size)
    if (r.e1x === NONE) {
      out.x = r.seatX
      out.y = r.seatY + Math.round(size.brow + 1 - zf * sp * Math.cos(yaw))
      return out
    }
    // The model's eyes (±e, 0, zf) turned to `dir`: where they land from the pivot, nearest the camera first.
    const model = [-e, e]
      .map((x) => ({ u: (x * Math.cos(yaw) + zf * Math.sin(yaw)) * flip, wz: -x * Math.sin(yaw) + zf * Math.cos(yaw) }))
      .sort((a, b) => b.wz - a.wz)
    const found = r.e2x !== r.e1x || r.e2y !== r.e1y ? [[r.e1x, r.e1y], [r.e2x, r.e2y]] : [[r.e1x, r.e1y]]
    const pairs = found.length === 2 ? [...model].sort((a, b) => a.u - b.u).map((m, i) => [m, found[i]!] as const) : [[model[0]!, found[0]!] as const]
    out.x = Math.round(pairs.reduce((a, [m, [x]]) => a + x! - m.u, 0) / pairs.length)
    out.y = Math.round(pairs.reduce((a, [m, [, y]]) => a + y! - m.wz * sp, 0) / pairs.length)
  } else if (slot === 'neck') {
    out.x = r.neckX
    out.y = r.neckY - Math.round(radius(size.neck) * sp * Math.max(0, Math.cos(yaw)))
  } else {
    out.x = r.backX
    out.y = r.backY
  }
  return out
}
