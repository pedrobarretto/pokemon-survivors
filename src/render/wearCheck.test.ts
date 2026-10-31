import { describe, expect, it } from 'vitest'
import { climb, silhouetteOf } from './wearCheck'
import { masksOf, type Pixels } from './wearRig'

const INK = [16, 16, 24] as const
const SKIN = [232, 200, 96] as const
const LEAF = [64, 168, 72] as const

/** A round head (its dome's top row 7) on a body, eyes with glints on rows 12..13, and a lobe on the dome (rows 2..7): a leaf of its own colors, a tuft of the head's, or none. */
const head = (lobe: 'leaf' | 'tuft' | null = null): Pixels => {
  const w = 24
  const h = 32
  const rgba = new Uint8Array(w * h * 4)
  const set = (x: number, y: number, c: readonly number[]) => rgba.set([...c, 255], (y * w + x) * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((x - 12) ** 2 + (y - 12) ** 2 <= 36 || (Math.abs(x - 12) <= 5 && y >= 16 && y <= 28)) set(x, y, SKIN)
      else if (lobe && Math.abs(x - 12) <= 4 && y >= 2 && y <= 7) set(x, y, lobe === 'leaf' ? LEAF : SKIN)
    }
  }
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && rgba[(y * w + x) * 4 + 3]! > 0
  const edge: [number, number][] = []
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (solid(x, y) && (!solid(x - 1, y) || !solid(x + 1, y) || !solid(x, y - 1) || !solid(x, y + 1))) edge.push([x, y])
  for (const [x, y] of edge) set(x, y, INK)
  for (const ex of [10, 14]) {
    set(ex, 12, INK)
    set(ex, 13, INK)
    set(ex + 1, 12, [255, 255, 255])
  }
  return { w, h, rgba }
}

describe('the head by its silhouette', () => {
  it('climbs to the skull over a seat sunk into it, through a tuft of its colors but not a leaf of its own', () => {
    const at = (f: Pixels) => climb(f, masksOf(f), 12, 9)
    // From two rows into the dome up to its top (row 6 is a single pixel: no skull).
    expect(at(head())).toBe(7)
    expect(at(head('leaf'))).toBe(7)
    expect(at(head('tuft'))).toBe(2)
    // A tuft or a leaf is no detail of the face either.
    expect(silhouetteOf(head('leaf'), 0, { mx: 12, my: 16, gx: 12, gy: 22 }).details).toHaveLength(6)
  })

  it("finds the face's details (the eyes and their glints) under its top half, not its skin nor its outline", () => {
    const f = head()
    const { top, details } = silhouetteOf(f, 0, { mx: 12, my: 16, gx: 12, gy: 22 })
    expect(top).toBe(7)
    const at = details.map((k) => [k % f.w, Math.floor(k / f.w)])
    expect(at).toEqual(expect.arrayContaining([[10, 12], [10, 13], [14, 12], [14, 13], [11, 12], [15, 12]]))
    expect(at).toHaveLength(6)
  })
})
