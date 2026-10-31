import { WEARABLES, type WearableId } from '../data/wearables'
import type { Dir8 } from '../engine/math'
import type { Worn } from './wearCheck'
import { dress, itemArt, movingParts, placeOf, squashOf, type ItemArt } from './wearDress'
import { decodeRig, fitOf, fixOf, layerOf, rigChunk, sizeOf, wears, type Rig, type RigAnim, type RigChunk, type WearSize } from './wearFit'
import { WEAR_MODELS } from './wearModels'
import { NONE, type Measure, type Pixels, type RigFrame } from './wearRig'

/**
 * The fit check's view of the game's renderer (`scripts/fit-check.mjs` loads
 * it in Node): the shipped rig (`data/wearRig/`) with its hand fixes, the
 * dresser (`render/wearDress.ts`) and the moving part of an animated item
 * on its first frame, as the game draws them. The rig it judges by is the
 * one drawn (`drawn`), frame by frame.
 */

/** The rig's files as the script reads them (`init`): the adapter stays free of Node. */
let readChunk: (n: number) => RigChunk | null = () => null
const chunks = new Map<number, RigChunk['species']>()
const entryOf = (dex: number, key: string) => {
  const n = rigChunk(dex)
  if (!chunks.has(n)) chunks.set(n, readChunk(n)?.species ?? {})
  return chunks.get(n)![key]
}

type Wearer = { rig: Rig; sizes: readonly WearSize[]; fit: ReturnType<typeof fitOf> }
const wearers = new Map<string, Wearer | null>()
const wearerOf = (key: string) => {
  if (wearers.has(key)) return wearers.get(key)!
  const [d, form] = key.split(':')
  const dex = Number(d)
  const e = entryOf(dex, key)
  const fit = fitOf(dex, form)
  const rig = e ? decodeRig(e, fit) : null
  const w = rig ? { rig, sizes: Array.from({ length: 8 }, (_, dir) => sizeOf(rig, fit, dir as Dir8)), fit } : null
  wearers.set(key, w)
  return w
}

const arts = new Map<string, ItemArt>()
const squashes = new Map<string, number>()

/** A frame's rig as the game draws it (its hand fixes on), or null without one. */
const frameRig = (key: string, anim: RigAnim, row: number, frame: number) => {
  const w = wearerOf(key)
  return w ? w.rig[anim].rows[row]![Math.min(frame, w.rig[anim].frames - 1)]! : null
}

export const adapter = {
  name: 'new',
  init: (read: (n: number) => RigChunk | null) => {
    readChunk = read
  },
  wearer: (key: string) => wearerOf(key) !== null,
  /** Whether the variant wears an item facing `row`'s way (`SpeciesFit.no`). */
  wears: (key: string, id: WearableId, row: number) => {
    const w = wearerOf(key)
    return !!w && wears(w.fit, WEARABLES[id].slot, id, row as Dir8)
  },
  /** The rig drawn on a frame, as the rules' truth: its eyes' pixels those of their box on the sprite. */
  drawn: (key: string, anim: RigAnim, row: number, frame: number, f: Pixels): Measure | null => {
    const rig = frameRig(key, anim, row, frame)
    if (!rig) return null
    const eyes = rig.e1x === NONE ? [] : eyeBoxes(rig)
    const eyePx: number[] = []
    for (const e of eyes) for (let y = Math.max(0, e.y0); y <= Math.min(f.h - 1, e.y1); y++) for (let x = Math.max(0, e.x0); x <= Math.min(f.w - 1, e.x1); x++) if (f.rgba[(y * f.w + x) * 4 + 3]) eyePx.push(y * f.w + x)
    return { rig, eyes, eyePx, skull: new Uint8Array(0), palette: [] }
  },
  wear: (key: string, id: WearableId, anim: RigAnim, row: number, frame: number, f: Pixels): (Worn & { rgba: Uint8Array }) | 'hidden' | 'unseen' | null => {
    const w = wearerOf(key)
    if (!w) return null
    const slot = WEARABLES[id].slot
    const dir = row as Dir8
    const layer = layerOf(slot, dir, WEAR_MODELS[id].layers)
    if (layer === 'hidden') return 'hidden'
    const rf = frameRig(key, anim, row, frame)!
    // Glasses on a frame whose eyes weren't found aren't drawn (`dress`): a hole in the look, unless a fix says no eyes show.
    if (slot === 'face' && rf.e1x === NONE) return fixOf(w.fit, row, anim)?.eyes === 'none' ? 'hidden' : 'unseen'
    const size = w.sizes[row]!
    let squash = squashes.get(`${key}:${id}:${row}`)
    if (squash === undefined) squashes.set(`${key}:${id}:${row}`, (squash = slot === 'head' ? squashOf(id, size) : 1))
    const ak = `${key}:${id}:${row}`
    let art = arts.get(ak)
    if (!art) arts.set(ak, (art = itemArt(id, slot, size, dir, squash)))
    const pivot = placeOf(rf, slot, dir, size, art, { x: 0, y: 0 }, f)
    const d = dress(f, rf, [{ id, slot, art: art.still, x: pivot.x, y: pivot.y, layer }], fixOf(w.fit, row, anim)?.over)
    const front = Uint8Array.from(d.front, (v) => (v ? 1 : 0))
    const behind = Uint8Array.from(d.behind, (v) => (v ? 1 : 0))
    const rgba = new Uint8Array(d.rgba)
    // The moving part's first frame, drawn over (or under) the dressed frame as the game draws it.
    let total = d.total[0]!
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < f.w && y < f.h && f.rgba[(y * f.w + x) * 4 + 3]! > 0
    const rows = w.rig[anim].rows[row]!
    for (const part of movingParts(art, slot, layer, rows, dir, size, rows.map((_, i) => (i === frame ? f : undefined)))) {
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

/** A rig's eyes as boxes: a pair's, each as wide about its center as the box reaches past it on its side. */
const eyeBoxes = (r: RigFrame) => {
  if (r.e2x === r.e1x && r.e2y === r.e1y) return [{ x: r.e1x, y: r.e1y, x0: r.eyeX0, y0: r.eyeY0, x1: r.eyeX1, y1: r.eyeY1, score: 0 }]
  return [
    { x: r.e1x, y: r.e1y, x0: r.eyeX0, y0: r.eyeY0, x1: Math.min(2 * r.e1x - r.eyeX0, r.e2x - 1), y1: r.eyeY1, score: 0 },
    { x: r.e2x, y: r.e2y, x0: Math.max(2 * r.e2x - r.eyeX1, r.e1x + 1), y0: r.eyeY0, x1: r.eyeX1, y1: r.eyeY1, score: 0 },
  ]
}
