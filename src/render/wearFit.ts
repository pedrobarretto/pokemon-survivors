import type { WearableSlot } from '../data/cosmetics'
import { ART_DIRS, WEAR_FITS, type ArtDirName, type FitKey, type FixScope, type Nudge, type RigFix, type SpeciesFit } from '../data/wearFits'
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

/**
 * How far a slot's models turn facing an art direction: their direction's
 * turn, but glasses in profile turn 70° rather than 90°, as sprite artists
 * draw a profile's eye, a little toward the viewer: edge-on, a lens is a
 * one-pixel bar that the eye shows past.
 */
export const yawFor = (slot: WearableSlot, d: ArtDir) => (slot === 'face' && d === 2 ? (70 * Math.PI) / 180 : yawOf(d))

/** How far down the camera looks at the sprites (radians): PMD sprites are drawn from a little above, heads almost head-on. */
export const PITCH = (22 * Math.PI) / 180
/**
 * The face's own pitch: drawn almost head-on, as the sprites draw faces, so a
 * strap round the head reads as a band from every side (at `PITCH` it sags into a slab in profile).
 */
export const FACE_PITCH = (8 * Math.PI) / 180

/** The pitch a slot's models are drawn at (`Scene.pitch`). */
export const pitchOf = (slot: WearableSlot) => (slot === 'face' ? FACE_PITCH : PITCH)

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

/**
 * A variant's fitting by hand (`data/wearFits.ts`): a form's own (a Mega is
 * drawn anew, so the species' fixes don't carry over), and a shiny's own
 * where it has one (its sheets differ), else its normal colors'.
 */
export const fitOf = (dex: number, form?: string, shiny = false): SpeciesFit | undefined => {
  const key: FitKey = form ? `${dex}:${form}` : dex
  return (shiny ? WEAR_FITS[`${key}s` as FitKey] : undefined) ?? WEAR_FITS[key]
}

/**
 * A frame's hand fix: its scopes (`FixScope`) from the broadest, every
 * direction, its art direction, its anim, its anim facing that way, adding
 * up their moves (the eyes are the narrowest's), mirrored for the
 * west-facing rows (its left eye is the east-facing art's right).
 */
export const fixOf = (fit: SpeciesFit | undefined, row: number, anim?: RigAnim): RigFix | null => {
  const dir = ART_DIRS[artDir(row as Dir8)] as ArtDirName
  const scopes: FixScope[] = ['all', dir, ...(anim ? ([anim, `${dir}:${anim}`] as const) : [])]
  const fixes = scopes.flatMap((k) => fit?.rig?.[k] ?? [])
  if (fixes.length === 0) return null
  const sum = (pick: (f: RigFix) => readonly number[] | undefined) => {
    const vs = fixes.map(pick).filter((v): v is readonly number[] => v !== undefined)
    return vs.length ? [0, 1, 2].map((i) => vs.reduce((a, v) => a + (v[i] ?? 0), 0)) : undefined
  }
  const last = <K extends keyof RigFix>(k: K) => fixes.reduce<RigFix[K] | undefined>((a, f) => f[k] ?? a, undefined)
  const flip = isMirrored(row as Dir8) ? -1 : 1
  const fx = <T extends readonly number[] | undefined>(v: T) => (v ? [v[0]! * flip, ...v.slice(1)] : undefined)
  const eyes = last('eyes')
  const at = last('eyesAt')
  const one = (e: Nudge | 'none' | undefined) => (e === 'none' ? e : (fx(e) as Nudge | undefined))
  const [left, right] = flip > 0 ? [last('left'), last('right')] : [last('right'), last('left')]
  return {
    seat: fx(sum((f) => f.seat)) as RigFix['seat'],
    eyes: eyes === 'none' ? eyes : (fx(eyes) as RigFix['eyes']),
    ...(at && { eyesAt: at.map(([x, y]) => [x * flip, y] as const) }),
    ...(left && { left: one(left) }),
    ...(right && { right: one(right) }),
    neck: fx(sum((f) => f.neck)) as RigFix['neck'],
    back: fx(sum((f) => f.back)) as RigFix['back'],
    over: fixes.flatMap((f) => f.over ?? []).map(([x, y]) => [x * flip, y] as const),
  }
}

/**
 * One eye of a pair moved or dropped (`RigFix.left`, `right`; a lone eye takes
 * either), the eyes' box following: each eye keeps the margin the box had
 * around it, a dropped one leaves the other's alone.
 */
const oneEye = (o: RigFrame, left: RigFix['left'], right: RigFix['right']) => {
  const pair = o.e2x !== o.e1x || o.e2y !== o.e1y
  const pad = { l: o.e1x - o.eyeX0, r: o.eyeX1 - o.e2x, t: Math.min(o.e1y, o.e2y) - o.eyeY0, b: o.eyeY1 - Math.max(o.e1y, o.e2y) }
  let a = { x: o.e1x, y: o.e1y }
  let b = { x: o.e2x, y: o.e2y }
  const move = (e: { x: number; y: number }, n: RigFix['left']) => (n && n !== 'none' ? { x: e.x + n[0], y: e.y + n[1] } : e)
  if (!pair) a = b = move(a, left ?? right)
  else if (left === 'none') a = b = move(b, right)
  else if (right === 'none') b = a = move(a, left)
  else [a, b] = [move(a, left), move(b, right)]
  ;[a, b] = a.x <= b.x ? [a, b] : [b, a]
  Object.assign(o, { e1x: a.x, e1y: a.y, e2x: b.x, e2y: b.y, eyeX0: a.x - pad.l, eyeX1: b.x + pad.r, eyeY0: Math.min(a.y, b.y) - pad.t, eyeY1: Math.max(a.y, b.y) + pad.b })
}

/** A frame's rig with a hand fix applied (`fixOf`). */
export const fixFrame = (r: RigFrame, fix: RigFix | null): RigFrame => {
  if (!fix) return r
  const o = { ...r }
  if (fix.seat) {
    o.seatX += fix.seat[0]
    o.seatY += fix.seat[1]
    // A width taken off can't empty the opening.
    o.seatW = Math.max(3, o.seatW + (fix.seat[2] ?? 0))
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
  if ((fix.left || fix.right) && o.e1x !== NONE) oneEye(o, fix.left, fix.right)
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

/** A generated entry decoded, the variant's hand fixes applied to every frame (by the row's art direction and the anim, `fixOf`). */
export const decodeRig = (e: RigEntry, fit: SpeciesFit | undefined): Rig => {
  const anim = (name: RigAnim): SheetRig => {
    const s = unpackRig(bytes(e[name]))
    return { ...s, rows: s.rows.map((frames, row) => frames.map((r) => fixFrame(r, fixOf(fit, row, name)))) }
  }
  return { Walk: anim('Walk'), Idle: anim('Idle'), Hurt: anim('Hurt') }
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

/** Whether a species wears an item (`SpeciesFit.no`): at all, or facing `dir` too where given. */
export const wears = (fit: SpeciesFit | undefined, slot: WearableSlot, id: WearableId, dir?: Dir8) => {
  const d = dir === undefined ? null : ART_DIRS[artDir(dir)]
  return !fit?.no?.some((k) => k === slot || k === id || (d !== null && (k === `${slot}:${d}` || k === `${id}:${d}`)))
}

/* ---------------- Sizes and pivots ---------------- */

/**
 * What a variant's models are sized from (px), measured facing south on its
 * first Walk frame (the depths in profile): the seat's width (`head`), the
 * skull's depth (`depth`) and the head's at the eyes (`faceDepth`, `headSpan`), how far below the seat its eyes start (`brow`: no band comes
 * down that far), the head's width at the eyes (`face`), half the eyes' gap
 * (`eye`, 0 unknown), the neck's and body's widths, and from the back down
 * to the feet (`drop`) and up to the seat (`rise`); `brows`, the brow's room
 * turned a little and in profile (SE, E; 0 where no eyes show), which a hat's
 * band must clear too.
 */
export type WearSize = { head: number; depth: number; faceDepth: number; brow: number; brows: readonly [number, number]; face: number; eye: number; neck: number; body: number; drop: number; rise: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/**
 * A variant's size (`WearSize`), with its hand fitting's (`SpeciesFit.size`)
 * on top, for a row facing `dir`: the hat's model is as wide as the skull
 * facing south and as deep as it is in profile; turned between them or away,
 * it's scaled to that direction's own skull (its seat's width, a fix's
 * included), so a hat fits each side of the head the rig reads.
 */
export const sizeOf = (rig: Rig, fit: SpeciesFit | undefined, dir: Dir8 = 0): WearSize => {
  const s = rig.Walk.rows[0]![0]!
  const se = rig.Walk.rows[1]![0]!
  const e = rig.Walk.rows[2]![0]!
  const room = (r: RigFrame) => (r.eyeY0 !== NONE ? Math.max(1, r.eyeY0 - r.seatY) : 0)
  const add = fit?.size ?? {}
  const head = clamp(s.seatW + (add.head ?? 0), 7, 26)
  const eyes = s.eyeY0 !== NONE
  const [l, r] = headSpan(e)
  const depth = clamp(e.seatW, Math.round(head * 0.6), Math.round(head * 1.6))
  // Turned between the camera and a side, or away: the model's width there against the skull's.
  const a = artDir(dir)
  const yaw = yawOf(a)
  const k = a === 0 || a === 2 ? 1 : clamp(rig.Walk.rows[a]![0]!.seatW / Math.hypot(head * Math.cos(yaw), depth * Math.sin(yaw)), 0.75, 1.33)
  return {
    head: Math.round(head * k),
    depth: Math.round(depth * k),
    faceDepth: r - l + 1,
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

/** How much deeper than wide a variant's head is: hats stretch along the skull's depth, face models along the head's at the eyes. */
export const depthOf = (size: WearSize, slot: 'head' | 'face') => clamp(slot === 'face' ? size.faceDepth / size.face : size.depth / size.head, 0.7, 1.4)

/**
 * A frame's head span (px, inclusive): its width at the eyes' line, no wider
 * than the skull's seat and a pixel either side (a crest, a shoulder or spikes
 * level with the eyes aren't head). What a face item's strap wraps.
 */
export const headSpan = (r: RigFrame): readonly [number, number] => [Math.max(r.faceL, r.seatX - (r.seatW >> 1) - 1), Math.min(r.faceR, r.seatX + (r.seatW >> 1) + 1)]

/**
 * The pivot of `slot` (`render/wearModels.ts` builds each model around it) on a
 * frame's rig, facing `dir`, in the frame's px: the seat (hats), the head's
 * center behind the eyes (glasses: where the model's eyes, turned to face
 * `dir`, land on the eyes found), the neck's axis behind its front, the
 * back's point. Written into `out` (the draw loop runs it every frame).
 */
export const pivotOf = (r: RigFrame, slot: WearableSlot, dir: Dir8, size: WearSize, out: { x: number; y: number }) => {
  const yaw = yawFor(slot, artDir(dir))
  const flip = isMirrored(dir) ? -1 : 1
  const sp = Math.sin(pitchOf(slot))
  if (slot === 'head') {
    out.x = r.seatX
    out.y = r.seatY
  } else if (slot === 'face') {
    const rf = radius(size.face)
    const e = eyeOf(size, rf)
    const zf = Math.sqrt(Math.max(rf * rf - e * e, 0)) * depthOf(size, 'face')
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
