import { describe, expect, it } from 'vitest'
import { BRANCHES } from '../data/branches'
import { PLAYABLE } from '../data/hatchlings'
import manifest from '../data/sprites.generated.json'
import type { Dir8 } from '../engine/math'
import { mirror, PITCH, type PixelArt } from './wearArt'
import { anchorChunk, anchorKey, artDir, decodeAnchors, GEOMETRY, isMirrored, layerOf, nudgeOf, pivotAt, type AnchorChunk, type AnchorEntry } from './wearFit'
import { WEAR_MODELS } from './wearModels'

const b64 = (bytes: readonly number[]) => btoa(String.fromCharCode(...bytes))

describe('art directions', () => {
  it('folds the west-facing rows onto their east twins, mirrored', () => {
    const dirs: Dir8[] = [0, 1, 2, 3, 4, 5, 6, 7]
    expect(dirs.map(artDir)).toEqual([0, 1, 2, 3, 4, 3, 2, 1])
    expect(dirs.map(isMirrored)).toEqual([false, false, false, false, false, true, true, true])
  })

  it('mirrors art around its pivot', () => {
    const art: PixelArt = { w: 4, h: 2, ox: 1, oy: 1, px: Uint8Array.from([1, 2, 0, 0, 0, 3, 0, 4]), colors: ['', '#000000', '#111111', '#222222', '#333333'] }
    const m = mirror(art)
    expect([...m.px]).toEqual([0, 0, 2, 1, 4, 0, 3, 0])
    // The pivot's pixel moves with the art: column 1 of 4 becomes column 2.
    expect(m.ox).toBe(2)
    expect(m.oy).toBe(1)
    expect(mirror(m)).toEqual(art)
  })

  it("flips a nudge's x on the mirrored rows", () => {
    const fit = { nudge: { head: { E: [3, -1] as const }, face: [1, 2] as const } }
    expect(nudgeOf(fit, 'head', 2)).toEqual([3, -1])
    expect(nudgeOf(fit, 'head', 6)).toEqual([-3, -1])
    expect(nudgeOf(fit, 'head', 0)).toBeNull()
    expect(nudgeOf(fit, 'face', 7)).toEqual([-1, 2])
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
    expect(all.map((d) => layerOf('neck', d, WEAR_MODELS.scarf.layers))).toEqual(Array(8).fill('front'))
  })
})

describe('anchors', () => {
  // Two frames a row: mouth (10 + row, 5 + frame), center (10 + row, 20).
  const marks = Array.from({ length: 8 }, (_, row) => [0, 1].flatMap((f) => [10 + row, 5 + f, 10 + row, 20])).flat()
  const geo = Array.from({ length: 8 }, (_, row) => GEOMETRY.map((_, i) => (i === 0 ? row - 3 : i === 1 ? -4 : i === 8 ? 1 : i === 9 ? -2 : 5)))
  const entry: AnchorEntry = {
    dirs: b64(geo.flat().map((v) => v + 128)),
    Walk: b64([32, 40, 2, ...marks]),
    Idle: b64([32, 40, 2, ...marks]),
    Hurt: b64([32, 40, 2, ...marks]),
  }

  it('pins a slot to its marker plus the direction measure, per frame', () => {
    const a = decodeAnchors(entry)
    const out = { x: 0, y: 0 }
    // Head: the mouth's (10 + row, 5 + frame) plus (row − 3, −4).
    expect(pivotAt(a, 'Walk', 2, 1, 'head', null, out)).toEqual({ x: 12 - 1, y: 6 - 4 })
    // Back: the center's (10 + row, 20) plus (1, −2), and a nudge on top.
    expect(pivotAt(a, 'Walk', 6, 0, 'back', [2, 1], out)).toEqual({ x: 16 + 1 + 2, y: 20 - 2 + 1 })
    // A frame past the sheet's holds its last.
    expect(pivotAt(a, 'Walk', 0, 9, 'head', null, out)).toEqual({ x: 10 - 3, y: 6 - 4 })
  })

  // The generated files (`npm run anchors`), by chunk.
  const files = Object.entries(import.meta.glob<AnchorChunk>('../data/wearAnchors/*.json', { eager: true, import: 'default' })).map(
    ([path, chunk]) => [Number(path.match(/anchors-(\d+)\.json$/)![1]), chunk] as const,
  )

  it('was measured from the camera angle the art renders at', () => {
    for (const [, chunk] of files) {
      expect(chunk.pitch).toBe(Math.round((PITCH * 180) / Math.PI))
      expect(chunk.geometry).toEqual([...GEOMETRY])
    }
  })

  it("files every variant in its dex's chunk, which the engine loads it from", () => {
    expect(files.length).toBeGreaterThan(1)
    for (const [n, chunk] of files) for (const key of Object.keys(chunk.species)) expect(anchorChunk(parseInt(key, 10)), key).toBe(n)
  })

  /** Players' variants SpriteCollab has no usable offsets for (`npm run anchors` lists them): they draw bare. Sandygast's Walk offsets carry no markers. */
  const BARE = new Set(['769'])

  it('covers every Pokémon a player can be and its forms, frame for frame with the sprites\' sheets', () => {
    const species = Object.assign({}, ...files.map(([, chunk]) => chunk.species)) as Record<string, AnchorEntry>
    type Sheets = { anims: Record<string, { frameWidth: number; frameHeight: number; durations: number[] }>; shiny?: Sheets }
    const sheets = manifest as Record<string, Sheets & { forms?: Record<string, Sheets> }>
    const dexes = new Set([...Object.values(PLAYABLE).flatMap((p) => p.line.map((s) => s.dex)), ...Object.values(BRANCHES).map((b) => b.dex)])
    const variants = [...dexes].flatMap((dex) => [
      { dex, form: undefined, meta: sheets[dex]! },
      ...Object.entries(sheets[dex]!.forms ?? {}).map(([form, meta]) => ({ dex, form, meta })),
    ])
    expect(variants.length).toBeGreaterThan(300)
    for (const { dex, form, meta } of variants) {
      const key = anchorKey(dex, form, false)
      if (BARE.has(key)) continue
      expect(species[key], key).toBeDefined()
      for (const [shiny, colors] of [[false, meta], [true, meta.shiny]] as const) {
        if (!colors) continue
        const a = decodeAnchors((shiny && species[anchorKey(dex, form, true)]) || species[key]!)
        for (const anim of ['Walk', 'Idle', 'Hurt'] as const) {
          // A form without a sheet for an anim draws its Walk in its place (`placeFrame`), and so do its anchors.
          const m = colors.anims[anim] ?? colors.anims.Walk!
          expect([a.anims[anim].fw, a.anims[anim].fh, a.anims[anim].frames], `${anchorKey(dex, form, shiny)} ${anim}`).toEqual([m.frameWidth, m.frameHeight, m.durations.length])
        }
      }
    }
  })
})
