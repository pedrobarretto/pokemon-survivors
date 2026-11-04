import { DOUBT, emptyGrid, mirrorGrid, pickKey, propagate, sameGrid, type Grid, type Key } from './propagate'

/**
 * A skin's source, as the Ateliê saves it in `src/data/skins/<id>.json`: per
 * variant (`<dex>` or `<dex>:<form>`, one per evolution stage), the frames the
 * artist drew whole (keyframes) and the touch-ups on frames the propagation
 * dressed (fixes). Both are text grids of palette letters, so a person edits
 * them in the Ateliê and a diff reads them: `.` is clear, and in a fix `-`
 * keeps the propagated pixel. The baked sheets (`public/assets/skins/<id>/<variant>/`)
 * come from this and the species' own sheets, never edited by hand.
 */

export const SKIN_ANIMS = ['Walk', 'Idle', 'Hurt'] as const

export type SkinAnim = (typeof SKIN_ANIMS)[number]

/** A frame of a variant's sheets: its anim, its row (the direction, 0 facing the camera) and its column. */
export type FrameRef = { anim: SkinAnim; row: number; frame: number }

/** A frame drawn whole: every pixel, `.` clear. */
export type KeySource = FrameRef & { grid: string[] }

/** Touch-ups on a propagated frame: `-` keeps its pixel, `.` clears it. */
export type FixSource = FrameRef & { grid: string[] }

export type VariantSource = {
  /** Letter → `rrggbb`. The sprite's own colors and the skin's. */
  palette: Record<string, string>
  /** Letter → letter, swapped on every frame after the keyframes and before the fixes: a recolor of colors only the recolored part uses (leaves, a palette theme) needs no keyframes. */
  recolor?: Record<string, string>
  keys: KeySource[]
  fixes: FixSource[]
}

export type SkinSource = { id: string; variants: Record<string, VariantSource> }

export const CLEAR = '.'
export const KEEP = '-'

/** Letters a palette hands out, in order (never `.` or `-`). */
export const LETTERS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!#$%&*+/:;<=>?@^_~'

/** Rows facing one side and their mirror across: a direction without keyframes borrows its mirror's. */
export const MIRROR_ROW = [-1, 7, 6, 5, -1, 3, 2, 1] as const

export const sameFrame = (a: FrameRef, b: FrameRef) => a.anim === b.anim && a.row === b.row && a.frame === b.frame

/** A sheet split into frames: `frames[row][column]`, 8 rows. */
export type SheetGrids = { fw: number; fh: number; frames: Grid[][] }

/** Color ids ↔ `rrggbb`: id 0 is clear. One per variant, shared by its grids. */
export type Colors = { hex: string[]; id: Map<string, number> }

export const newColors = (): Colors => ({ hex: [''], id: new Map() })

export const colorId = (c: Colors, hex: string) => {
  let id = c.id.get(hex)
  if (id === undefined) {
    id = c.hex.length
    c.hex.push(hex)
    c.id.set(hex, id)
  }
  return id
}

const hex2 = (v: number) => v.toString(16).padStart(2, '0')

/** A sheet's RGBA (`sw` px wide) as frame grids. Partly clear pixels count as opaque, as the game draws them. */
export const sheetGrids = (rgba: Uint8Array | Uint8ClampedArray, sw: number, fw: number, fh: number, frames: number, c: Colors): SheetGrids => ({
  fw,
  fh,
  frames: Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: frames }, (_, col) => {
      const g = emptyGrid(fw, fh)
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const i = ((row * fh + y) * sw + col * fw + x) * 4
          if (rgba[i + 3]) g.px[y * fw + x] = colorId(c, hex2(rgba[i]!) + hex2(rgba[i + 1]!) + hex2(rgba[i + 2]!))
        }
      }
      return g
    }),
  ),
})

/** A palette letter's color id, or throws on a letter the palette doesn't have. */
const letterId = (palette: Record<string, string>, c: Colors, ch: string) => {
  const hex = palette[ch]
  if (hex === undefined) throw new Error(`letter "${ch}" isn't in the palette`)
  return colorId(c, hex)
}

export const gridFromText = (lines: readonly string[], palette: Record<string, string>, c: Colors): Grid => {
  const h = lines.length
  const w = lines[0]?.length ?? 0
  const g = emptyGrid(w, h)
  lines.forEach((line, y) => {
    for (let x = 0; x < w; x++) {
      const ch = line[x] ?? CLEAR
      if (ch !== CLEAR) g.px[y * w + x] = letterId(palette, c, ch)
    }
  })
  return g
}

/** A grid as palette letters; a color the palette lacks gets the next free letter (the palette grows). */
export const textFromGrid = (g: Grid, palette: Record<string, string>, c: Colors): string[] => {
  const letter = new Map(Object.entries(palette).map(([k, v]) => [v, k]))
  const of = (id: number) => {
    if (!id) return CLEAR
    const hex = c.hex[id]!
    let ch = letter.get(hex)
    if (!ch) {
      ch = [...LETTERS].find((l) => !(l in palette))
      if (!ch) throw new Error('the palette is full')
      palette[ch] = hex
      letter.set(hex, ch)
    }
    return ch
  }
  return Array.from({ length: g.h }, (_, y) => Array.from({ length: g.w }, (_, x) => of(g.px[y * g.w + x]!)).join(''))
}

/** A frame with the variant's `recolor` swapped in (the same grid when it has none). */
export const applyRecolor = (g: Grid, recolor: Record<string, string> | undefined, palette: Record<string, string>, c: Colors): Grid => {
  if (!recolor) return g
  const swap = new Map(Object.entries(recolor).map(([from, to]) => [letterId(palette, c, from), letterId(palette, c, to)]))
  return { w: g.w, h: g.h, px: g.px.map((v) => swap.get(v) ?? v) }
}

/** Applies a fix's grid over a frame. */
export const applyFix = (g: Grid, fix: readonly string[], palette: Record<string, string>, c: Colors): Grid => {
  const px = Int32Array.from(g.px)
  fix.forEach((line, y) => {
    for (let x = 0; x < Math.min(g.w, line.length); x++) {
      const ch = line[x]!
      if (ch === KEEP) continue
      px[y * g.w + x] = ch === CLEAR ? 0 : letterId(palette, c, ch)
    }
  })
  return { w: g.w, h: g.h, px }
}

/** A variant's whole palette for its sprite: every sheet color gets a letter (new variants start here). */
export const paletteFor = (sheets: Record<SkinAnim, SheetGrids>, c: Colors, palette: Record<string, string> = {}) => {
  const used = new Set<number>()
  for (const anim of SKIN_ANIMS) for (const row of sheets[anim].frames) for (const g of row) for (const v of g.px) if (v) used.add(v)
  const have = new Set(Object.values(palette))
  for (const id of [...used].sort((a, b) => a - b)) {
    const hex = c.hex[id]!
    if (have.has(hex)) continue
    const ch = [...LETTERS].find((l) => !(l in palette))
    if (!ch) break
    palette[ch] = hex
    have.add(hex)
  }
  return palette
}

/** One frame of a baked variant: what it draws, its doubts, and which keyframe it followed (-1 none, `own` it's a keyframe). */
export type BakedFrame = { grid: Grid; doubt: Uint8Array; key: number; own: boolean; fixed: boolean }

export type Baked = Record<SkinAnim, BakedFrame[][]>

type PreparedKey = Key & { mirrored: boolean; index: number }

/**
 * Bakes a variant: each keyframe is its own frame as drawn; every other frame
 * follows the keyframe that fits it best (`pickKey`), from its direction or
 * the mirror across; then the variant's `recolor` swaps colors and its fixes
 * go over it. `only` limits the work to
 * some frames (the Ateliê re-bakes what an edit touched); the rest come back
 * from `prev`.
 */
export const bakeVariant = (sheets: Record<SkinAnim, SheetGrids>, src: VariantSource, c: Colors, only?: (f: FrameRef) => boolean, prev?: Baked): Baked => {
  const byRow: PreparedKey[][] = Array.from({ length: 8 }, () => [])
  src.keys.forEach((k, index) => {
    const original = sheets[k.anim].frames[k.row]?.[k.frame]
    if (!original) return
    const E = gridFromText(k.grid, src.palette, c)
    byRow[k.row]!.push({ K: original, E, mirrored: false, index })
    const across = MIRROR_ROW[k.row]!
    if (across >= 0) byRow[across]!.push({ K: mirrorGrid(original), E: mirrorGrid(E), mirrored: true, index })
  })
  const out = {} as Baked
  for (const anim of SKIN_ANIMS) {
    out[anim] = sheets[anim].frames.map((frames, row) =>
      frames.map((T, frame): BakedFrame => {
        const ref = { anim, row, frame }
        const old = prev?.[anim]?.[row]?.[frame]
        if (only && old && !only(ref)) return old
        const ownIndex = src.keys.findIndex((k) => sameFrame(k, ref))
        let res: BakedFrame
        if (ownIndex >= 0) {
          res = { grid: gridFromText(src.keys[ownIndex]!.grid, src.palette, c), doubt: new Uint8Array(T.w * T.h), key: ownIndex, own: true, fixed: false }
        } else {
          const own = byRow[row]!.filter((k) => !k.mirrored)
          const pick = pickKey(T, own.length ? [...own, ...byRow[row]!.filter((k) => k.mirrored)] : byRow[row]!)
          if (!pick) res = { grid: T, doubt: new Uint8Array(T.w * T.h), key: -1, own: false, fixed: false }
          else {
            const p = sameGrid(T, pick.key.K) ? { out: pick.key.E, doubt: new Uint8Array(T.w * T.h) } : propagate(T, pick.key, pick.shift)
            res = { grid: p.out, doubt: p.doubt, key: pick.key.index, own: false, fixed: false }
          }
        }
        res.grid = applyRecolor(res.grid, src.recolor, src.palette, c)
        const fix = src.fixes.find((f) => sameFrame(f, ref))
        if (fix) {
          res.grid = applyFix(res.grid, fix.grid, src.palette, c)
          res.fixed = true
        }
        return res
      }),
    )
  }
  return out
}

/** How many propagated frames have several pixels the match wasn't sure of (worth a look), for the save's report. */
export const doubtCount = (b: Baked, atLeast = 4) => {
  let n = 0
  for (const anim of SKIN_ANIMS) for (const row of b[anim]) for (const f of row) if (!f.own && !f.fixed && f.doubt.reduce((k, d) => k + (d === DOUBT.match ? 1 : 0), 0) >= atLeast) n++
  return n
}

/** A baked anim as RGBA, laid out like the species' sheet (8 rows of frames). */
export const bakedRgba = (frames: BakedFrame[][], fw: number, fh: number, c: Colors) => {
  const cols = frames[0]?.length ?? 0
  const w = fw * cols
  const rgba = new Uint8ClampedArray(w * fh * 8 * 4)
  frames.forEach((row, r) =>
    row.forEach((f, col) => {
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const id = f.grid.px[y * fw + x]!
          if (!id) continue
          const hex = c.hex[id]!
          const o = ((r * fh + y) * w + col * fw + x) * 4
          rgba[o] = parseInt(hex.slice(0, 2), 16)
          rgba[o + 1] = parseInt(hex.slice(2, 4), 16)
          rgba[o + 2] = parseInt(hex.slice(4, 6), 16)
          rgba[o + 3] = 255
        }
      }
    }),
  )
  return { w, h: fh * 8, rgba }
}
