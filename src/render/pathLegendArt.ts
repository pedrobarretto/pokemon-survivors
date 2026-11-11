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
  /** Meltan's Hex Nut: steel with its hole, a light edge on top. */
  nut: lazy(() =>
    sprite(
      ['..111..', '.12221.', '1233321', '1230321', '1233321', '.13331.', '..111..'],
      { 1: '#686878', 2: '#e8e8f0', 3: '#b0b0c0', 0: '#30303c' },
      '#141418',
    ),
  ),
}

/* ---------------- Regigigas's temple ---------------- */

const STONE = { dark: '#4a4238', mid: '#7a6e5c', light: '#a89a80', top: '#c8bca0', door: '#18140f' } as const

/** The lights on the temple's face, for Regirock, Regice and Registeel. */
export const TEMPLE_LIGHTS = [
  ['#c87848', '#f8b878'],
  ['#78c0e8', '#d8f4ff'],
  ['#8890a0', '#e0e4ec'],
] as const

/**
 * Regigigas's temple, 44 × 38 px: a stepped stone shrine with a dark door and
 * three lights set over it. `lit` lights glow (0 to 3, as it wakes). The
 * bottom middle is its foot.
 */
export const templeArt = (lit: number): PixelSprite => {
  const w = 44
  const h = 38
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const px = (x: number, y: number, c: string, pw = 1, ph = 1) => {
    ctx.fillStyle = c
    ctx.fillRect(x, y, pw, ph)
  }
  // Three steps at the foot, the shrine on top.
  const block = (x: number, y: number, bw: number, bh: number) => {
    px(x, y, STONE.dark, bw, bh)
    px(x + 1, y + 1, STONE.mid, bw - 2, bh - 2)
    px(x + 1, y + 1, STONE.top, bw - 2, 1)
    px(x + 1, y + 2, STONE.light, 1, bh - 3)
  }
  block(0, 32, 44, 6)
  block(3, 27, 38, 6)
  block(7, 6, 30, 22)
  // The roof: a heavy slab and its cap.
  block(4, 3, 36, 5)
  block(12, 0, 20, 4)
  // Seams in the stone, a few chips off its edges.
  for (const [x, y, sw] of [[10, 12, 6], [24, 15, 8], [12, 20, 5], [27, 22, 6], [8, 29, 9], [26, 30, 10], [6, 35, 12], [28, 34, 9]] as const) px(x, y, STONE.dark, sw, 1)
  // Worn corners.
  ctx.clearRect(7, 6, 1, 1)
  ctx.clearRect(36, 6, 1, 1)
  ctx.clearRect(0, 32, 1, 1)
  ctx.clearRect(43, 32, 1, 1)
  // The door, a step down into the dark.
  px(17, 17, STONE.dark, 10, 11)
  px(18, 18, STONE.door, 8, 10)
  px(18, 18, '#2a241c', 8, 1)
  // Three lights in a row over the door, dark until they wake.
  for (const [i, [glow, core]] of TEMPLE_LIGHTS.entries()) {
    const x = 12 + i * 8
    const on = i < lit
    px(x, 9, STONE.dark, 6, 6)
    px(x + 1, 10, on ? glow : '#3a3430', 4, 4)
    px(x + 2, 11, on ? core : '#4a4238', 2, 2)
    if (on) px(x + 1, 10, '#ffffff')
  }
  return canvas
}

export const TEMPLE = { w: 44, h: 38 } as const

/** The temple with 0 to 3 lights on, built once. */
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
