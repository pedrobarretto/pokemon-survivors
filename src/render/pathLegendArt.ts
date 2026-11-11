import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'
import type { PathLegendMoveId } from '../game/pathLegendMoves'
import { medallion } from './legendaryArt'

/**
 * Pixel art of the legend paths (`data/legendPaths.ts`): the icons of their
 * legendary moves (`art.ts` lists them), the Zygarde Cell and Core, Meltan's
 * Hex Nut and Regigigas's temple. Strings and shapes painted on the pixel
 * grid, built lazily (the DOM canvas only exists at render time). `art.ts`
 * imports this file, so it keeps its own outline helper.
 */

/** A 1px outline around the opaque pixels. */
const outlined = (s: PixelSprite, color: string): PixelSprite => {
  const canvas = createCanvas(s.width + 2, s.height + 2)
  const ctx = context2d(canvas)
  const sil = createCanvas(s.width, s.height)
  const sctx = context2d(sil)
  sctx.drawImage(s, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, sil.width, sil.height)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) ctx.drawImage(sil, dx, dy)
  ctx.drawImage(s, 1, 1)
  return canvas
}

const sprite = (rows: readonly string[], palette: Palette, outline?: string) => {
  const s = fromStrings(rows, palette)
  return outline ? outlined(s, outline) : s
}

/* ---------------- Zygarde's pieces ---------------- */

/** A Zygarde Cell: a little jelly blob with its hexagon nucleus, lit from the top left. */
const CELL = [
  '...22222...',
  '..2344332..',
  '.234433332.',
  '.233655332.',
  '23355555332',
  '23355555332',
  '23335553332',
  '.233333332.',
  '..2222222..',
]

const CORE = [
  '.6.......6.',
  '.26.....62.',
  '..2.222.2..',
  '...233332..',
  '..23443332.',
  '.2344777332',
  '.2347887332',
  '.2347777332',
  '.2334773322',
  '..23333332.',
  '...222222..',
]

/** The Cell's greens (and its hex, darker), the Core's red eye. */
const CELL_PAL = { 2: '#2f8a48', 3: '#4cc068', 4: '#b8f8c8', 5: '#1c5a30', 6: '#3f9a58', 7: '#e84830', 8: '#ffd0a0' } as const

export const PATH_ART = {
  /** The Cell: its body and a frame lit brighter (its glow's beat). */
  cell: lazy(() => [sprite(CELL, CELL_PAL, '#0c2814'), sprite(CELL, { ...CELL_PAL, 3: '#68d888', 2: '#3aa058', 6: '#58c070' }, '#0c2814')]),
  core: lazy(() => [sprite(CORE, { ...CELL_PAL, 6: '#78e098' }, '#0c2814'), sprite(CORE, { ...CELL_PAL, 6: '#78e098', 3: '#68d888', 7: '#f86848' }, '#0c2814')]),
  /** Meltan's Hex Nut: a flat-topped steel hexagon with its hole, lit on top, shaded below. */
  nut: lazy(() =>
    sprite(
      ['..22222..', '.2333334.', '233000344', '233006344', '.4333344.', '..44444..'],
      { 2: '#f0f0f8', 3: '#b8b8c8', 4: '#787888', 0: '#24242c', 6: '#9898a8' },
      '#141418',
    ),
  ),
}

/* ---------------- Regigigas's temple ---------------- */

/** The map's meadow stone (`landmarkPieces.ts`), dark to light, its seams and outline, and the moss on it. */
const STONE = ['#4a4038', '#6c5e50', '#8e7e6a', '#b0a088', '#d0c4a8'] as const
const SEAM = '#3a322c'
const RIM = '#1c1610'
const MOSS = ['#2c6a2c', '#44903a', '#68b450'] as const

/** The three Regi marks, carved where they wake: Regirock's on the left stone, Regice's on the right, Registeel's on the lintel. Each a 3 × 3 grid of dots. */
export const TEMPLE_MARKS = [
  { at: [8, 20], dots: ['1.1', '111', '1.1'] },
  { at: [49, 28], dots: ['111', '1.1', '111'] },
  { at: [28, 5], dots: ['.1.', '111', '.1.'] },
] as const

/** The marks' light, for Regirock, Regice and Registeel: its glow, its core and its spark (the flare as it lights). */
export const TEMPLE_LIGHTS = [
  ['#e8883c', '#ffd8a0', '#fff0d8'],
  ['#58c0f0', '#e0f8ff', '#ffffff'],
  ['#e04848', '#ffc8c0', '#fff0f0'],
] as const

export const TEMPLE = { w: 64, h: 52 } as const

/**
 * Regigigas's temple, 64 × 52 px, its foot at the bottom middle: a stepped
 * plinth, a gate with a dark way down between two pillars under a heavy
 * lintel, and two worn standing stones, moss on all of it. The three Regi
 * marks are carved on it, and `lit` of them glow (0 to 3, as the trio's
 * presence wakes the giant).
 */
export const templeArt = (lit: number): PixelSprite => {
  const canvas = createCanvas(TEMPLE.w, TEMPLE.h)
  const ctx = context2d(canvas)
  const px = (x: number, y: number, c: string, pw = 1, ph = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, pw, ph)
  }
  // A dressed stone: outline, body, a lit top and left edge, a shaded right edge and foot.
  const block = (x: number, y: number, w: number, h: number) => {
    px(x, y, RIM, w, h)
    px(x + 1, y + 1, STONE[2], w - 2, h - 2)
    px(x + 1, y + 1, STONE[4], w - 2, 1)
    px(x + 1, y + 2, STONE[3], 1, h - 3)
    px(x + w - 2, y + 2, STONE[1], 1, h - 3)
    px(x + 1, y + h - 2, STONE[1], w - 2, 1)
  }
  // The plinth's two steps, their top faces lighter.
  block(0, 43, 64, 9)
  px(1, 44, STONE[3], 62, 2)
  block(5, 37, 54, 8)
  px(6, 38, STONE[3], 52, 2)
  // The standing stones, the right one shorter, both broken off on top in a jagged edge.
  const broken = (x0: number, y0: number, tops: readonly number[]) => {
    for (const [i, top] of tops.entries()) {
      ctx.clearRect(x0 + i, y0, 1, top - y0)
      const edge = i === 0 || i === tops.length - 1
      px(x0 + i, top, RIM)
      if (!edge) px(x0 + i, top + 1, (tops[i - 1] ?? top) > top ? STONE[4] : STONE[3])
    }
  }
  block(5, 14, 13, 25)
  broken(5, 14, [17, 16, 15, 14, 14, 15, 17, 18, 17, 16, 16, 17, 19])
  block(46, 19, 13, 20)
  broken(46, 19, [21, 20, 19, 19, 20, 22, 21, 22, 23, 23, 24, 25, 26])
  // The gate: two pillars under the lintel and its cap.
  block(21, 12, 7, 27)
  block(36, 12, 7, 27)
  block(25, 13, 14, 26)
  px(27, 15, '#100c08', 10, 23)
  px(27, 15, '#241c14', 10, 2)
  px(28, 17, '#1a140e', 8, 21)
  // Worn steps going down into the dark.
  px(29, 33, '#2a2219', 6, 1)
  px(28, 35, '#3a3024', 8, 1)
  px(27, 37, '#4a4038', 10, 1)
  block(17, 3, 30, 11)
  block(22, 0, 20, 4)
  // Seams and cracks across the stone.
  for (const [x, y, w] of [[8, 30, 6], [3, 47, 14], [24, 48, 18], [47, 46, 12], [9, 40, 10], [42, 41, 12], [22, 24, 4], [38, 30, 4], [20, 8, 6]] as const) px(x, y, SEAM, w, 1)
  for (const [x, y] of [[14, 26], [15, 27], [15, 28], [55, 37], [54, 38], [39, 6], [40, 7], [33, 47], [34, 48]] as const) px(x, y, SEAM)
  // Moss: a crown on the stones, a drape down the left one and the lintel, tufts at the foot.
  for (const [x, y, w, c] of [[9, 15, 3, 1], [47, 20, 4, 1], [18, 4, 5, 1], [36, 1, 4, 1], [1, 44, 6, 2], [55, 44, 8, 1], [6, 38, 5, 0]] as const) {
    px(x, y, MOSS[c + 1]!, w, 1)
    px(x + 1, y + 1, MOSS[c]!, Math.max(1, w - 2), 1)
  }
  for (const [x, y, n] of [[6, 17, 6], [19, 5, 5], [44, 5, 3], [57, 23, 4]] as const) for (let i = 0; i < n; i++) px(x + (i % 3 === 2 ? 1 : 0), y + i, MOSS[i % 2]!)
  // The marks: carved dots, or lit.
  for (const [i, { at, dots }] of TEMPLE_MARKS.entries()) {
    const [glow, core] = TEMPLE_LIGHTS[i]!
    const on = i < lit
    const spots = dots.flatMap((row, r) => [...row].flatMap((d, c) => (d === '1' ? [[at[0] + c * 3, at[1] + r * 3] as const] : [])))
    for (const [x, y] of spots) {
      if (!on) {
        px(x, y, SEAM, 2, 2)
        px(x + 1, y + 2, STONE[3])
        continue
      }
      px(x, y, glow, 2, 2)
      px(x, y, core)
    }
  }
  return canvas
}

/** The temple with 0 to 3 marks lit, built once. */
export const TEMPLES = lazy(() => [0, 1, 2, 3].map(templeArt))

/* ---------------- Move icons ---------------- */

type Px = (x: number, y: number, color: string, w?: number, h?: number) => void

const paint = (w: number, h: number, fn: (px: Px) => void) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  fn((x, y, color, pw = 1, ph = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, pw, ph)
  })
  return canvas
}

export const PATH_LEGEND_ICONS: Record<PathLegendMoveId, () => PixelSprite> = {
  // A green Z, lit at its corners.
  coreEnforcer: () =>
    medallion(paint(11, 11, (px) => {
      px(1, 1, '#2f8a48', 9, 2)
      px(1, 1, '#b8f8c8', 9, 1)
      for (let i = 0; i < 7; i++) px(8 - i, 3 + i, '#4cc068', 2, 1)
      px(1, 8, '#2f8a48', 9, 2)
      px(1, 9, '#1c5a30', 9, 1)
      px(0, 1, '#e84830')
      px(10, 9, '#e84830')
    }), '#0c2414'),
  // A sun-white comet with a gold tail.
  sunsteelStrike: () =>
    medallion(paint(11, 11, (px) => {
      for (let i = 0; i < 6; i++) px(i, 10 - i - 1, i < 3 ? '#c87018' : '#f8a830', 2, 2)
      px(6, 2, '#f8d030', 4, 4)
      px(7, 1, '#f8d030', 2, 6)
      px(5, 3, '#f8d030', 6, 2)
      px(7, 3, '#ffffff', 2, 2)
    }), '#302008'),
  // A violet beam out of a white moon.
  moongeistBeam: () =>
    medallion(paint(11, 11, (px) => {
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (Math.hypot(x - 2, y - 2) <= 2.4) px(x, y + 6, x + y < 4 ? '#ffffff' : '#d8d0f8')
      for (let i = 0; i < 6; i++) px(4 + i, 6 - i, '#a888f8', 2, 2)
      px(9, 0, '#f0e8ff', 2, 2)
    }), '#140c28'),
  // A dark fist with a red gleam.
  wickedBlow: () =>
    medallion(paint(11, 11, (px) => {
      px(2, 3, '#383048', 7, 6)
      px(1, 4, '#383048', 1, 4)
      px(3, 2, '#585068', 5, 1)
      for (const x of [3, 5, 6, 8]) px(x, 3, '#686078', 1, 2)
      px(2, 8, '#20182c', 7, 1)
      px(8, 3, '#e83848', 1, 3)
    }), '#100810'),
  // Two hex nuts, crossed.
  doubleIronBash: () =>
    medallion(paint(11, 11, (px) => {
      const nut = (ox: number, oy: number) => {
        px(ox + 1, oy, '#e8e8f0', 3, 1)
        px(ox, oy + 1, '#b0b0c0', 5, 3)
        px(ox + 1, oy + 4, '#686878', 3, 1)
        px(ox + 2, oy + 2, '#30303c')
      }
      nut(0, 1)
      nut(5, 5)
    }), '#202028'),
  // A giant's open hand, its three bright lines.
  crushGrip: () =>
    medallion(paint(11, 11, (px) => {
      px(2, 4, '#d8d0b8', 7, 6)
      for (let i = 0; i < 4; i++) px(2 + i * 2, 1, '#d8d0b8', 1, 4)
      px(0, 5, '#d8d0b8', 2, 2)
      px(3, 6, '#c87848', 1, 3)
      px(5, 6, '#78c0e8', 1, 3)
      px(7, 6, '#a0a8b8', 1, 3)
      px(2, 9, '#a89878', 7, 1)
    }), '#28241c'),
}
