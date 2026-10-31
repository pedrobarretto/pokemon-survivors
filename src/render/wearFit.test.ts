import { describe, expect, it } from 'vitest'
import { BRANCHES } from '../data/branches'
import { PLAYABLE } from '../data/hatchlings'
import manifest from '../data/sprites.generated.json'
import type { Dir8 } from '../engine/math'
import { mirror, type PixelArt } from './wearArt'
import { browOf, dress, MAX_LIFT, placeOf } from './wearDress'
import { artDir, decodeRig, fixFrame, fixOf, headSpan, isMirrored, layerOf, pivotOf, rigChunk, rigKey, wears, type RigChunk, type RigEntry, type WearSize } from './wearFit'
import { WEAR_MODELS } from './wearModels'
import { masksOf, measure, NONE, packRig, rigSheets, unpackRig, type Marks, type Pixels, type RigFrame } from './wearRig'

const art = (w: number, h: number, ox: number, oy: number, px: number[], extra: Partial<PixelArt> = {}): PixelArt => ({
  w,
  h,
  ox,
  oy,
  px: Uint8Array.from(px),
  colors: ['', '#ff0000', '#0000ff'],
  edge: new Uint8Array(w * h),
  ink: new Uint8Array(w * h).fill(2),
  back: new Uint8Array(w * h),
  hug: new Uint8Array(w * h),
  ...extra,
})

describe('art directions', () => {
  it('folds the west-facing rows onto their east twins, mirrored', () => {
    const dirs: Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7]
    expect(dirs.map(artDir)).toEqual([0, 1, 2, 3, 4, 3, 2, 1])
    expect(dirs.map(isMirrored)).toEqual([false, false, false, false, false, true, true, true])
  })

  it('mirrors art around its pivot, with its outline, far side and hugging parts', () => {
    const a = art(4, 2, 1, 1, [1, 2, 0, 0, 0, 1, 0, 2], { edge: Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0]), back: Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]), hug: Uint8Array.from([0, 0, 0, 0, 0, 1, 0, 0]) })
    const m = mirror(a)
    expect([...m.px]).toEqual([0, 0, 2, 1, 2, 0, 1, 0])
    expect([...m.edge]).toEqual([0, 0, 1, 0, 0, 0, 0, 0])
    expect([...m.back]).toEqual([0, 0, 0, 1, 0, 0, 0, 0])
    expect([...m.hug]).toEqual([0, 0, 0, 0, 0, 0, 1, 0])
    // The pivot's pixel moves with the art: column 1 of 4 becomes column 2.
    expect(m.ox).toBe(2)
    expect(mirror(m)).toEqual(a)
  })

  it("flips a fix's x on the mirrored rows, its art direction's on top of every direction's", () => {
    const fit = { rig: { all: { seat: [0, 1] as const }, E: { seat: [3, -1] as const, over: [[2, -3]] as const } } }
    expect(fixOf(fit, 2)?.seat).toEqual([3, 0, 0])
    expect(fixOf(fit, 6)?.seat).toEqual([-3, 0, 0])
    expect(fixOf(fit, 6)?.over).toEqual([[-2, -3]])
    expect(fixOf(fit, 0)?.seat).toEqual([0, 1, 0])
    expect(fixOf(undefined, 0)).toBeNull()
  })
})

describe('hand fixes', () => {
  it('adds a direction, an anim and an anim facing that way on top of every direction, the eyes taking the narrowest', () => {
    const fit = { rig: { all: { seat: [0, 1] as const }, E: { seat: [2, 0] as const, eyes: [1, 0] as const }, Idle: { seat: [0, -3] as const }, 'E:Idle': { eyes: [0, 2] as const } } }
    expect(fixOf(fit, 2, 'Walk')).toMatchObject({ seat: [2, 1, 0], eyes: [1, 0] })
    expect(fixOf(fit, 2, 'Idle')).toMatchObject({ seat: [2, -2, 0], eyes: [0, 2] })
    // Facing west, the east-facing fix mirrored; facing south only `all` and the anim's.
    expect(fixOf(fit, 6, 'Idle')).toMatchObject({ seat: [-2, -2, 0], eyes: [-0, 2] })
    expect(fixOf(fit, 0, 'Idle')?.seat).toEqual([0, -2, 0])
  })

  it('moves or drops one eye of a pair, the east-facing left one being the west-facing right one', () => {
    const r = rigFrame()
    expect(fixFrame(r, { left: 'none' })).toMatchObject({ e1x: 12, e2x: 12, eyeX0: 11, eyeX1: 13 })
    expect(fixFrame(r, { right: [1, 1] })).toMatchObject({ e1x: 8, e1y: 9, e2x: 13, e2y: 10, eyeX1: 14, eyeY1: 11 })
    expect(fixOf({ rig: { E: { left: 'none' } } }, 6)?.right).toBe('none')
  })

  it('leaves a slot off facing one way only', () => {
    const fit = { no: ['head:S', 'scarf'] as const }
    expect(wears(fit, 'head', 'topHat', 0)).toBe(false)
    expect(wears(fit, 'head', 'topHat', 2)).toBe(true)
    expect(wears(fit, 'head', 'topHat')).toBe(true)
    expect(wears(fit, 'neck', 'scarf', 2)).toBe(false)
  })
})

describe('layers', () => {
  const all: Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7]

  it('keeps hats in front and face items off when facing away', () => {
    expect(all.map((d) => layerOf('head', d))).toEqual(Array(8).fill('front'))
    expect(all.map((d) => layerOf('face', d))).toEqual(['front', 'front', 'front', 'hidden', 'hidden', 'hidden', 'front', 'front'])
  })

  it('hangs a cape behind the body facing south and over it facing north', () => {
    expect(all.map((d) => layerOf('back', d))).toEqual(['behind', 'behind', 'behind', 'front', 'front', 'front', 'behind', 'behind'])
  })

  it("takes an item's own layers over its slot's", () => {
    expect(all.map((d) => layerOf('neck', d, WEAR_MODELS.bowTie.layers))).toEqual(['front', 'front', 'front', 'hidden', 'hidden', 'hidden', 'front', 'front'])
  })
})

/** A rig frame with everything at `v` but what `o` sets. */
const rigFrame = (o: Partial<RigFrame> = {}): RigFrame => ({
  seatX: 10, seatY: 4, seatW: 9, e1x: 8, e1y: 9, e2x: 12, e2y: 9, eyeX0: 7, eyeY0: 8, eyeX1: 13, eyeY1: 10, faceL: 5, faceR: 15,
  neckX: 10, neckY: 14, neckW: 6, backX: 10, backY: 16, bodyW: 12, feetY: 30, ...o,
})

describe('the rig', () => {
  it('packs and unpacks every frame, moving or not, eyes or none', () => {
    const rows = Array.from({ length: 8 }, (_, row) =>
      [0, 1, 2].map((f) => (row === 4 ? rigFrame({ seatY: 4 + f, e1x: NONE, e1y: NONE, e2x: NONE, e2y: NONE, eyeX0: NONE, eyeY0: NONE, eyeX1: NONE, eyeY1: NONE }) : rigFrame({ seatX: 10 + f, seatY: 4 - f, e1y: 9 + (f & 1), neckY: 14 + f, backY: 16 }))),
    )
    const back = unpackRig(packRig(32, 40, rows))
    expect([back.fw, back.fh, back.frames]).toEqual([32, 40, 3])
    expect(back.rows).toEqual(rows)
  })

  it('moves the eyes a fix moves, drops them for none and puts them where a fix says', () => {
    const r = rigFrame()
    expect(fixFrame(r, { eyes: [1, -1] })).toMatchObject({ e1x: 9, e1y: 8, eyeX0: 8, eyeY1: 9 })
    expect(fixFrame(r, { eyes: 'none' }).e1x).toBe(NONE)
    const none = fixFrame(r, { eyes: 'none' })
    expect(fixFrame(none, { eyesAt: [[3, 5], [-3, 5]] })).toMatchObject({ e1x: 7, e1y: 9, e2x: 13, e2y: 9 })
  })

  it('puts glasses where their eyes land on the eyes found', () => {
    const size: WearSize = { head: 9, depth: 9, faceDepth: 11, brow: 4, brows: [4, 4], face: 11, eye: 2, neck: 6, body: 12, drop: 14, rise: 12 }
    const out = { x: 0, y: 0 }
    pivotOf(rigFrame(), 'face', 0, size, out)
    // Facing the camera: halfway between the eyes, a little over them (the camera looks down at the face's front).
    expect(out.x).toBe(10)
    expect(out.y).toBeLessThan(9)
    // Turned away a little the pivot stays behind the near eye.
    pivotOf(rigFrame({ e1x: 9, e2x: 13 }), 'face', 1, size, out)
    expect(out.x).toBeLessThan(11)
  })
})

/** A round head on a body, ears up either side, eyes with glints: what `measure` should find. */
const head = (): Pixels => {
  const w = 24
  const h = 32
  const rgba = new Uint8Array(w * h * 4)
  const set = (x: number, y: number, c: readonly [number, number, number]) => rgba.set([...c, 255], (y * w + x) * 4)
  const INK = [16, 16, 24] as const
  const SKIN = [232, 200, 96] as const
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inHead = (x - 12) ** 2 + (y - 12) ** 2 <= 36
      const inBody = Math.abs(x - 12) <= 5 && y >= 16 && y <= 28
      const inEar = (Math.abs(x - 8) <= 1 && y >= 2 && y <= 7) || (Math.abs(x - 16) <= 1 && y >= 2 && y <= 7)
      if (inHead || inBody || inEar) set(x, y, SKIN)
    }
  }
  // The outline: every skin pixel beside clear air.
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4 + 3]! > 0
  const edge: [number, number][] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edge.push([x, y])
  for (const [x, y] of edge) set(x, y, INK)
  // Eyes: two dark pixels tall, a glint over each.
  for (const ex of [10, 14]) {
    set(ex, 12, INK)
    set(ex, 13, INK)
    set(ex + 1, 12, [255, 255, 255])
  }
  return { w, h, rgba }
}

describe('measuring a frame', () => {
  const marks = { mx: 12, my: 16, gx: 12, gy: 22 }

  it('finds the eyes and seats the hat on the skull, under the ears', () => {
    const m = measure(head(), 0, marks)
    expect(m.eyes.map((e) => [Math.round(e.x), Math.round(e.y)])).toEqual([[10, 13], [14, 13]])
    // The dome's top (row 6) and not the ears' tips (row 2).
    expect(m.rig.seatY).toBeGreaterThanOrEqual(5)
    expect(m.rig.seatY).toBeLessThanOrEqual(7)
    expect(Math.abs(m.rig.seatX - 12)).toBeLessThanOrEqual(1)
  })

  it('never lets a hat cover the eyes, and lets what grows from the head show through an open one', () => {
    const f = head()
    const m = measure(f, 0, marks)
    // A slab of a hat as wide as the head, from over the ears down past the eyes.
    const W = 16
    const H = 14
    const slab = art(W, H, 8, 2, Array(W * H).fill(1), { back: new Uint8Array(W * H).fill(1) })
    const solidHat = dress(f, m.rig, [{ id: 'topHat', slot: 'head', art: slab, x: 12, y: 2, layer: 'front' }])
    const eyeCovered = m.eyePx.some((k) => solidHat.front[(Math.floor(k / f.w) + solidHat.oy) * solidHat.w + (k % f.w) + solidHat.ox])
    expect(eyeCovered).toBe(false)
    // An ear over the seat: under a solid hat it's covered, through a crown's far side it shows.
    const ear = (8 + solidHat.ox) + (4 + solidHat.oy) * solidHat.w
    expect(solidHat.front[ear]).toBeGreaterThan(0)
    const crown = dress(f, m.rig, [{ id: 'crown', slot: 'head', art: slab, x: 12, y: 2, layer: 'front' }])
    expect(crown.front[ear]).toBe(0)
  })

  it("keeps a row of the face between a hat's outline and the eyes", () => {
    const f = head()
    const { rig } = measure(f, 0, marks)
    const slab = art(16, 14, 8, 2, Array(16 * 14).fill(1))
    const d = dress(f, rig, [{ id: 'topHat', slot: 'head', art: slab, x: 12, y: 2, layer: 'front' }])
    // Over the eyes' columns, the row right over them is the face's own: the hat's outline stops a row higher.
    for (let x = rig.eyeX0; x <= rig.eyeX1; x++) expect(d.front[(rig.eyeY0 - 1 + d.oy) * d.w + x + d.ox], `x ${x}`).toBe(0)
    expect(d.front[(rig.eyeY0 - 2 + d.oy) * d.w + rig.eyeX0 + d.ox]).toBeGreaterThan(0)
  })

  it("wraps a strap round the head: inside its outline and its span, never past them", () => {
    const f = head()
    const { rig } = measure(f, 0, marks)
    // A strap far wider than the head across the eyes' row.
    const W = 24
    const strap = art(W, 3, 12, 1, Array(W * 3).fill(1), { hug: new Uint8Array(W * 3).fill(1) })
    const d = dress(f, rig, [{ id: 'goggles', slot: 'face', art: strap, x: 12, y: 11, layer: 'front' }])
    const { solid, edge } = masksOf(f)
    const [l, r] = headSpan(rig)
    let shown = 0
    for (let y = 0; y < d.h; y++) {
      for (let x = 0; x < d.w; x++) {
        if (!d.front[y * d.w + x]) continue
        const fx = x - d.ox
        const fy = y - d.oy
        // The strap itself, or its outline on the face where it meets it.
        expect(solid[fy * f.w + fx] && !edge[fy * f.w + fx] && fx >= l && fx <= r, `${fx},${fy}`).toBe(true)
        shown++
      }
    }
    expect(shown).toBeGreaterThan(0)
  })

  it('lifts a hat whose brim comes down over the brow clear of it, up to a limit', () => {
    const f = head()
    const { rig } = measure(f, 0, marks)
    const brow = browOf(rig)!
    const size: WearSize = { head: 9, depth: 9, faceDepth: 9, brow: 4, brows: [4, 4], face: 11, eye: 2, neck: 7, body: 12, drop: 14, rise: 12 }
    // Reaching a row past the brow: lifted by one; reaching far past it: by the limit, and the cut does the rest.
    const reaching = (rows: number) => ({ still: art(9, rows + 1, 4, 0, Array(9 * (rows + 1)).fill(1)), moving: null })
    expect(placeOf(rig, 'head', 0, size, reaching(brow.y0 - rig.seatY + 1), { x: 0, y: 0 }).y).toBe(rig.seatY - 1)
    expect(placeOf(rig, 'head', 0, size, reaching(brow.y0 - rig.seatY + 9), { x: 0, y: 0 }).y).toBe(rig.seatY - MAX_LIFT)
    expect(placeOf(rig, 'head', 0, size, reaching(brow.y0 - rig.seatY - 1), { x: 0, y: 0 }).y).toBe(rig.seatY)
  })

  it('rests a neck item on the throat turned to a side, from whichever side it faces', () => {
    const f = head()
    const { rig } = measure(f, 0, marks)
    const size: WearSize = { head: 9, depth: 9, faceDepth: 9, brow: 4, brows: [4, 4], face: 11, eye: 2, neck: 7, body: 12, drop: 14, rise: 12 }
    // The neck's run on its line spans x 7..17: the model's neck (radius 3) meets it a pixel inside its outline.
    const at = (dir: Dir8) => placeOf({ ...rig, neckX: 12, neckY: 16 }, 'neck', dir, size, { still: art(1, 1, 0, 0, [1]), moving: null }, { x: 0, y: 0 }, f).x
    expect(at(2)).toBe(16 - 3)
    expect(at(6)).toBe(8 + 3)
    // Facing the camera it stays on the rig's axis.
    expect(at(0)).toBe(12)
  })
})

describe('tracking the head', () => {
  /** `f` moved by (dx, dy) in a frame of the same size, its markers with it. */
  const moved = (f: Pixels, m: Marks, dx: number, dy: number) => {
    const rgba = new Uint8Array(f.rgba.length)
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) if (x - dx >= 0 && y - dy >= 0 && x - dx < f.w && y - dy < f.h) rgba.set(f.rgba.subarray(((y - dy) * f.w + x - dx) * 4, ((y - dy) * f.w + x - dx) * 4 + 4), (y * f.w + x) * 4)
    return { f: { w: f.w, h: f.h, rgba }, marks: { mx: m.mx + dx, my: m.my + dy, gx: m.gx + dx, gy: m.gy + dy } }
  }

  it("moves every frame's rig with its head, Idle and Hurt's too, whatever a frame of them would read alone", () => {
    const marks = { mx: 12, my: 16, gx: 12, gy: 22 }
    const shifts = [[0, 0], [0, 1], [1, 1], [0, 0]] as const
    const walk = shifts.map(([dx, dy]) => moved(head(), marks, dx, dy))
    // One frame with a dark tuft on its dome: read alone, its seat climbs onto it.
    const odd = moved(head(), marks, 0, 1)
    for (const [x, y] of [[12, 5], [12, 6]] as const) odd.f.rgba.set([16, 16, 24, 255], (y * odd.f.w + x) * 4)
    const idle = [moved(head(), marks, 0, 0), odd]
    const rows = (frames: typeof walk) => Array.from({ length: 8 }, () => frames)
    const rig = rigSheets({ Walk: rows(walk), Idle: rows(idle), Hurt: rows([moved(head(), marks, 1, 0)]) })
    const s = rig.Walk[0]!
    shifts.forEach(([dx, dy], i) => expect([s[i]!.seatX - s[0]!.seatX, s[i]!.seatY - s[0]!.seatY, s[i]!.e1y - s[0]!.e1y]).toEqual([dx, dy, dy]))
    expect([rig.Idle[0]![1]!.seatX, rig.Idle[0]![1]!.seatY]).toEqual([s[0]!.seatX, s[0]!.seatY + 1])
    expect(rig.Hurt[0]![0]!.seatX).toBe(s[0]!.seatX + 1)
  })
})

describe('the generated rig', () => {
  // The generated files (`npm run rig`), by chunk.
  const files = Object.entries(import.meta.glob<RigChunk>('../data/wearRig/*.json', { eager: true, import: 'default' })).map(
    ([path, chunk]) => [Number(path.match(/rig-(\d+)\.json$/)![1]), chunk] as const,
  )

  it("files every variant in its dex's chunk, which the engine loads it from", () => {
    expect(files.length).toBeGreaterThan(1)
    for (const [n, chunk] of files) for (const key of Object.keys(chunk.species)) expect(rigChunk(parseInt(key, 10)), key).toBe(n)
  })

  /** Players' variants SpriteCollab has no usable offsets for (`npm run rig` lists them): they draw bare. Sandygast's Walk offsets carry no markers. */
  const BARE = new Set(['769'])

  it("covers every Pokémon a player can be and its forms, frame for frame with the sprites' sheets", () => {
    const species = Object.assign({}, ...files.map(([, chunk]) => chunk.species)) as Record<string, RigEntry>
    type Sheets = { anims: Record<string, { frameWidth: number; frameHeight: number; durations: number[] }>; shiny?: Sheets }
    const sheets = manifest as Record<string, Sheets & { forms?: Record<string, Sheets> }>
    const dexes = new Set([...Object.values(PLAYABLE).flatMap((p) => p.line.map((s) => s.dex)), ...Object.values(BRANCHES).map((b) => b.dex)])
    const variants = [...dexes].flatMap((dex) => [
      { dex, form: undefined, meta: sheets[dex]! },
      ...Object.entries(sheets[dex]!.forms ?? {}).map(([form, meta]) => ({ dex, form, meta })),
    ])
    expect(variants.length).toBeGreaterThan(300)
    for (const { dex, form, meta } of variants) {
      const key = rigKey(dex, form, false)
      if (BARE.has(key)) continue
      expect(species[key], key).toBeDefined()
      for (const [shiny, colors] of [[false, meta], [true, meta.shiny]] as const) {
        if (!colors) continue
        const rig = decodeRig((shiny && species[rigKey(dex, form, true)]) || species[key]!, undefined)
        for (const anim of ['Walk', 'Idle', 'Hurt'] as const) {
          // A form without a sheet for an anim draws its Walk in its place (`placeFrame`), and so does its rig.
          const m = colors.anims[anim] ?? colors.anims.Walk!
          expect([rig[anim].fw, rig[anim].fh, rig[anim].frames], `${rigKey(dex, form, shiny)} ${anim}`).toEqual([m.frameWidth, m.frameHeight, m.durations.length])
        }
      }
    }
  })
})
