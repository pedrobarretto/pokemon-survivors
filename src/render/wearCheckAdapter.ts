import { WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import type { Worn } from './wearCheck'
import { dress, itemArt, movingParts, placeOf, squashOf, topOf, type ItemArt } from './wearDress'
import { decodeRig, fitOf, fixFrame, fixOf, layerOf, rigChunk, sizeOf, wears, type Rig, type RigAnim, type RigChunk, type WearSize } from './wearFit'
import { WEAR_MODELS } from './wearModels'
import { NONE, type Measure, type Pixels } from './wearRig'

/**
 * The fit check's view of the game's renderer (`scripts/fit-check.mjs` loads
 * it in Node): the shipped rig (`data/wearRig/`) with its hand fixes, the
 * dresser (`render/wearDress.ts`) and the moving part of an animated item
 * on its first frame, as the game draws them.
 */

/** The rig's files as the script reads them (`init`): the adapter stays free of Node. */
let readChunk: (n: number) => RigChunk | null = () => null
const chunks = new Map<number, RigChunk['species']>()
const entryOf = (dex: number, key: string) => {
  const n = rigChunk(dex)
  if (!chunks.has(n)) chunks.set(n, readChunk(n)?.species ?? {})
  return chunks.get(n)![key]
}

type Wearer = { rig: Rig; size: WearSize; fit: ReturnType<typeof fitOf> }
const wearers = new Map<string, Wearer | null>()
const wearerOf = (key: string) => {
  if (wearers.has(key)) return wearers.get(key)!
  const [d, form] = key.split(':')
  const dex = Number(d)
  const e = entryOf(dex, key)
  const fit = fitOf(dex, form)
  const rig = e ? decodeRig(e, fit) : null
  const w = rig ? { rig, size: sizeOf(rig, fit), fit } : null
  wearers.set(key, w)
  return w
}

const arts = new Map<string, ItemArt>()
const squashes = new Map<string, number>()

export const adapter = {
  name: 'new',
  init: (read: (n: number) => RigChunk | null) => {
    readChunk = read
  },
  wearer: (key: string) => wearerOf(key) !== null,
  wears: (key: string, id: WearableId) => {
    const w = wearerOf(key)
    return !!w && wears(w.fit, WEARABLES[id].slot, id)
  },
  /** The truth with the hand fixes on it: a seat moved by hand is where the hat must rest, eyes added by hand are eyes. */
  fixTruth: (key: string, row: number, truth: Measure, w: number): Measure => {
    const fix = fixOf(wearerOf(key)?.fit, row)
    if (!fix) return truth
    const rig = fixFrame(truth.rig, fix)
    let eyePx = truth.eyePx
    if (fix.eyes === 'none') eyePx = []
    else if (fix.eyes) {
      const [dx, dy] = fix.eyes
      eyePx = eyePx.map((k) => k + dy * w + dx)
    }
    else if (fix.eyesAt && rig.e1x !== NONE) eyePx = [[rig.e1x, rig.e1y], [rig.e2x, rig.e2y]].flatMap(([x, y]) => [y! * w + x!, (y! + 1) * w + x!])
    const eyes = rig.e1x === NONE ? [] : [{ x: rig.e1x, y: rig.e1y, x0: rig.eyeX0, y0: rig.eyeY0, x1: rig.e2x === rig.e1x ? rig.eyeX1 : rig.e1x + 1, y1: rig.eyeY1, score: 0 }, ...(rig.e2x !== rig.e1x ? [{ x: rig.e2x, y: rig.e2y, x0: rig.e2x - 1, y0: rig.eyeY0, x1: rig.eyeX1, y1: rig.eyeY1, score: 0 }] : [])]
    return { ...truth, rig, eyePx, eyes: fix.eyes || fix.eyesAt ? eyes : truth.eyes }
  },
  wear: (key: string, id: WearableId, anim: RigAnim, row: number, frame: number, f: Pixels, truth: Measure): (Worn & { rgba: Uint8Array }) | 'hidden' | null => {
    const w = wearerOf(key)
    if (!w) return null
    const slot = WEARABLES[id].slot
    const dir = row as Dir8
    const layer = layerOf(slot, dir, WEAR_MODELS[id].layers)
    if (layer === 'hidden') return 'hidden'
    let squash = squashes.get(`${key}:${id}`)
    if (squash === undefined) squashes.set(`${key}:${id}`, (squash = slot === 'head' ? squashOf(id, w.size) : 1))
    const ak = `${key}:${id}:${row}`
    let art = arts.get(ak)
    if (!art) arts.set(ak, (art = itemArt(id, slot, w.size, dir, squash)))
    const rf = w.rig[anim].rows[row]![Math.min(frame, w.rig[anim].frames - 1)]!
    const pivot = placeOf(rf, slot, dir, w.size, topOf(art), { x: 0, y: 0 })
    const d = dress(f, rf, [{ id, slot, art: art.still, x: pivot.x, y: pivot.y, layer }], fixOf(w.fit, row)?.over)
    // A face item on a frame without eyes isn't drawn (`dress`): nothing to judge, unless the frame has eyes the rig missed.
    if (slot === 'face' && rf.e1x === NONE && truth.eyes.length === 0) return 'hidden'
    const front = Uint8Array.from(d.front, (v) => (v ? 1 : 0))
    const behind = Uint8Array.from(d.behind, (v) => (v ? 1 : 0))
    const rgba = new Uint8Array(d.rgba)
    // The moving part's first frame, drawn over (or under) the dressed frame as the game draws it.
    let total = d.total[0]!
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < f.w && y < f.h && f.rgba[(y * f.w + x) * 4 + 3]! > 0
    for (const part of movingParts(art, slot, layer, w.rig[anim].rows[row]!, dir, w.size)) {
      const m = part.frames[0]!
      const rgb = m.colors.map((c) => (c ? parseInt(c.slice(1, 7), 16) : 0))
      for (let j = 0; j < m.h; j++) {
        for (let i = 0; i < m.w; i++) {
          const c = m.px[j * m.w + i]!
          if (!c) continue
          const x = pivot.x - m.ox + i
          const y = pivot.y - m.oy + j
          const bi = x + d.ox
          const bj = y + d.oy
          if (bi < 0 || bj < 0 || bi >= d.w || bj >= d.h) continue
          total++
          const k = bj * d.w + bi
          if (part.layer === 'behind') {
            behind[k] = 1
            if (solid(x, y)) continue
          } else front[k] = 1
          rgba.set([(rgb[c]! >> 16) & 255, (rgb[c]! >> 8) & 255, rgb[c]! & 255, 255], k * 4)
        }
      }
    }
    return { x0: -d.ox, y0: -d.oy, w: d.w, h: d.h, front, behind, pivot, cut: d.cut[0]!, total, rgba }
  },
}
