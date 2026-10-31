import { describe, expect, it } from 'vitest'
import { BRANCHES } from '../data/branches'
import { PLAYABLE } from '../data/hatchlings'
import manifest from '../data/sprites.generated.json'
import type { Dir8 } from '../engine/math'
import { mirror, type PixelArt } from './wearArt'
import { dress } from './wearDress'
import { artDir, decodeRig, fixFrame, fixOf, isMirrored, layerOf, pivotOf, rigChunk, rigKey, type RigChunk, type RigEntry, type WearSize } from './wearFit'
import { WEAR_MODELS } from './wearModels'
import { measure, NONE, packRig, unpackRig, type Pixels, type RigFrame } from './wearRig'

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
  ...extra,
})

describe('art directions', () => {
  it('folds the west-facing rows onto their east twins, mirrored', () => {
    const dirs: Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7]
    expect(dirs.map(artDir)).toEqual([0, 1, 2, 3, 4, 3, 2, 1])
    expect(dirs.map(isMirrored)).toEqual([false, false, false, false, false, true, true, true])
  })

  it('mirrors art around its pivot, with its outline and far side', () => {
    const a = art(4, 2, 1, 1, [1, 2, 0, 0, 0, 1, 0, 2], { edge: Uint8Array.from([0, 1, 0, 0, 0, 0, 0, 0]), back: Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]) })
    const m = mirror(a)
    expect([...m.px]).toEqual([0, 0, 2, 1, 2, 0, 1, 0])
    expect([...m.edge]).toEqual([0, 0, 1, 0, 0, 0, 0, 0])
    expect([...m.back]).toEqual([0, 0, 0, 1, 0, 0, 0, 0])
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
    const size: WearSize = { head: 9, depth: 9, brow: 4, brows: [4, 4], face: 11, eye: 2, neck: 6, body: 12, drop: 14, rise: 12 }
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
