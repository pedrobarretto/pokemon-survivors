import { describe, expect, it } from 'vitest'
import manifest from '../data/sprites.generated.json'
import data from '../data/wearAnchors.generated.json'
import { STARTERS } from '../data/starters'
import { VERSUS_PICKS } from '../data/versus'
import type { Dir8 } from '../engine/math'
import { mirror, PITCH, type PixelArt } from './wearArt'
import { anchoredSheet, anchorKey, artDir, decodeAnchors, GEOMETRY, isMirrored, layerOf, nudgeOf, pivotAt, type AnchorEntry } from './wearFit'
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

  it('wears a look only on the sheets they measured', () => {
    const a = decodeAnchors(entry)
    expect(anchoredSheet(a, { anim: 'Idle', fw: 32, fh: 40, frames: 2 })).toBe('Idle')
    // The sky's Fly sheet, and a sheet shrunk to size (a legend's) or swapped (an emote's), draw bare.
    expect(anchoredSheet(a, { anim: 'Fly', fw: 32, fh: 40, frames: 2 })).toBeNull()
    expect(anchoredSheet(a, { anim: 'Walk', fw: 24, fh: 30, frames: 2 })).toBeNull()
    expect(anchoredSheet(a, { anim: 'Walk', fw: 32, fh: 40, frames: 6 })).toBeNull()
  })

  it('finds a species by its own colors, one species at a time', () => {
    const has = (key: string) => key === '4' || key === '7' || key === '7s'
    expect(anchorKey(4, { shiny: false }, has)).toBe('4')
    // Shiny colors share the normal's measures unless measured apart.
    expect(anchorKey(4, { shiny: true }, has)).toBe('4')
    expect(anchorKey(7, { shiny: true }, has)).toBe('7s')
    // A species not measured yet, any form (a Mega, a hand-made shiny) and a stand-in draw bare.
    expect(anchorKey(25, { shiny: false }, has)).toBeNull()
    expect(anchorKey(4, { shiny: false, form: 'megaX' }, has)).toBeNull()
    expect(anchorKey(4, undefined, has)).toBeNull()
  })

  it('was measured from the camera angle the art renders at', () => {
    expect(data.pitch).toBe(Math.round((PITCH * 180) / Math.PI))
    expect(data.geometry).toEqual([...GEOMETRY])
  })

  it("covers every stage the Arena plays, frame for frame with the sprites' sheets", () => {
    const species = data.species as Record<string, AnchorEntry>
    const sheets = manifest as Record<string, { anims: Record<string, { frameWidth: number; frameHeight: number; durations: number[] }> }>
    for (const pick of VERSUS_PICKS) {
      for (const { dex } of STARTERS[pick].line) {
        const a = decodeAnchors(species[dex]!)
        for (const anim of ['Walk', 'Idle', 'Hurt'] as const) {
          const meta = sheets[dex]!.anims[anim]!
          expect([a.anims[anim].fw, a.anims[anim].fh, a.anims[anim].frames], `#${dex} ${anim}`).toEqual([meta.frameWidth, meta.frameHeight, meta.durations.length])
        }
      }
    }
  })
})
