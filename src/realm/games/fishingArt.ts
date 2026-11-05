import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../../engine/pixelart'
import { locale } from '../../i18n'
import { outlined } from '../../render/art'
import type { JunkId } from './fishing.rules'

/**
 * Fishing's art (`fishing.ts` draws with it), all code-authored at the
 * game's own resolution: the pier seen from the side (the dock on the left,
 * the sea out to the lighthouse's island, the seabed), the bobber, the junk
 * that bites too, the buoys marking how far out a cast went, and crisp
 * pixel text in the game's fonts.
 */

/** The canvas: small enough to show at 2× on a phone held either way. */
export const W = 180
export const H = 156

/** The water's surface (y), the dock's deck (top y, right edge x) and where the seabed begins. */
export const SURFACE = 44
export const DECK = { top: 38, right: 44 } as const
export const SEABED = 138

/** Where a cast lands on the surface: x for power 0..1. */
export const castX = (power: number) => 62 + power * 108

type Rgb = string

const SKY: readonly Rgb[] = ['#70b0f0', '#80c0f8', '#98d0f8', '#b8e0f8']
const SEA: readonly Rgb[] = ['#58b8e8', '#3c9cd8', '#2c84c8', '#2470b4', '#1c5c9c', '#164c88']
const SAND = { top: '#e8d098', mid: '#d0b070', low: '#b09050', dot: '#f8e8b8' } as const
const WOOD = { hi: '#c88a4c', mid: '#a06a34', lo: '#744a22', line: '#3a2210', wet: '#4a4440', wetHi: '#5e5650' } as const
const INK = '#181820'

/** Fills a band of rows with `a` above and `b` below, the seam dithered over two rows. */
const band = (g: CanvasRenderingContext2D, y0: number, y1: number, a: Rgb, b: Rgb) => {
  for (let y = y0; y < y1; y++) {
    g.fillStyle = a
    g.fillRect(0, y, W, 1)
  }
  g.fillStyle = b
  for (let x = 0; x < W; x += 2) {
    g.fillRect(x + ((y1 - 2) & 1), y1 - 2, 1, 1)
    g.fillRect(x + ((y1 - 1) & 1 ? 0 : 1), y1 - 1, 1, 1)
  }
}

/** A small seeded hash in 0..1, for the backdrop's scatter (fixed, so the scene never shifts). */
const hash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}

/** The seabed's top edge at x: sand in gentle dunes. */
export const seabedAt = (x: number) => SEABED + Math.round(3 * Math.sin(x / 19) + 2 * Math.sin(x / 7 + 1))

/**
 * Everything that holds still: the sky in bands, the island with its
 * lighthouse on the horizon, the sea darkening with depth, the seabed with
 * its rocks and coral, and the dock (its posts going down into the water).
 */
export const backdrop = lazy(() => {
  const c = createCanvas(W, H)
  const g = context2d(c)
  // Sky.
  band(g, 0, 14, SKY[0]!, SKY[1]!)
  band(g, 14, 26, SKY[1]!, SKY[2]!)
  band(g, 26, 36, SKY[2]!, SKY[3]!)
  g.fillStyle = SKY[3]!
  g.fillRect(0, 34, W, SURFACE - 34)
  // The island on the horizon, its lighthouse.
  g.fillStyle = '#5a9a58'
  g.fillRect(138, SURFACE - 4, 34, 4)
  g.fillRect(142, SURFACE - 6, 24, 2)
  g.fillStyle = '#7ab868'
  g.fillRect(144, SURFACE - 6, 10, 1)
  g.fillStyle = '#8a8a90'
  g.fillRect(150, SURFACE - 8, 12, 2)
  for (let y = 0; y < 14; y++) {
    g.fillStyle = Math.floor(y / 3) % 2 === 0 ? '#f8f8f8' : '#d83838'
    g.fillRect(154, SURFACE - 22 + y, 4, 1)
  }
  g.fillStyle = INK
  g.fillRect(153, SURFACE - 25, 6, 1)
  g.fillStyle = '#383840'
  g.fillRect(154, SURFACE - 24, 4, 2)
  // Sea, darker with depth.
  const rows = [SURFACE, 60, 78, 96, 114, 130, H]
  for (let i = 0; i < SEA.length; i++) band(g, rows[i]!, rows[i + 1]!, SEA[i]!, SEA[Math.min(SEA.length - 1, i + 1)]!)
  // Seabed: sand, its dunes shaded, pebbles.
  for (let x = 0; x < W; x++) {
    const top = seabedAt(x)
    for (let y = top; y < H; y++) {
      const d = y - top
      g.fillStyle = d === 0 ? SAND.top : d < 4 ? SAND.mid : hash(x, y) < 0.08 ? SAND.dot : (x + y) % 7 === 0 ? SAND.low : SAND.mid
      g.fillRect(x, y, 1, 1)
    }
  }
  // Rocks and coral on the bottom.
  const stamp = (rows: readonly string[], palette: Palette, x: number) => {
    const s = outlined(fromStrings(rows, palette), INK)
    g.drawImage(s, x, seabedAt(x + s.width / 2) - s.height + 3)
  }
  stamp(ROCK, ROCK_PALETTE, 52)
  stamp(ROCK_SMALL, ROCK_PALETTE, 118)
  stamp(CORAL, CORAL_PALETTE, 82)
  stamp(CORAL, { ...CORAL_PALETTE, 1: '#e8a040', 2: '#c87020' }, 160)
  // The dock: posts down to the seabed, the deck on top, a mooring bollard at its end.
  for (const px of [6, 36]) {
    for (let y = DECK.top + 5; y < seabedAt(px) + 2; y++) {
      const under = y >= SURFACE
      g.fillStyle = WOOD.line
      g.fillRect(px - 1, y, 1, 1)
      g.fillRect(px + 4, y, 1, 1)
      g.fillStyle = under ? WOOD.wet : WOOD.lo
      g.fillRect(px, y, 4, 1)
      g.fillStyle = under ? WOOD.wetHi : WOOD.mid
      g.fillRect(px, y, 1, 1)
    }
  }
  // The deck: a top face of planks seen from the side, its front edge.
  g.fillStyle = WOOD.line
  g.fillRect(0, DECK.top - 1, DECK.right + 1, 1)
  g.fillRect(DECK.right, DECK.top - 1, 1, 7)
  for (let x = 0; x < DECK.right; x++) {
    g.fillStyle = WOOD.hi
    g.fillRect(x, DECK.top, 1, 1)
    g.fillStyle = x % 8 === 7 ? WOOD.line : WOOD.mid
    g.fillRect(x, DECK.top + 1, 1, 2)
    g.fillStyle = WOOD.lo
    g.fillRect(x, DECK.top + 3, 1, 2)
  }
  g.fillStyle = WOOD.line
  g.fillRect(0, DECK.top + 5, DECK.right + 1, 1)
  g.drawImage(outlined(fromStrings(BOLLARD, { 1: '#606870', 2: '#8890a0', 3: '#c0c8d0' }), INK), DECK.right - 8, DECK.top - 6)
  return c
})

const ROCK = ['...1111...', '..122221..', '.12222221.', '1222332221', '1223333221', '1233333321']
const ROCK_SMALL = ['..111..', '.12221.', '1223221', '1233321']
const ROCK_PALETTE = { 1: '#8890a8', 2: '#6a7088', 3: '#4c5068' } as const
const CORAL = ['.1...1.', '.1.1.1.', '11.1.11', '.11111.', '..121..', '..121..', '.12221.']
const CORAL_PALETTE = { 1: '#f080a0', 2: '#c04870' } as const
const BOLLARD = ['.333.', '12221', '.121.', '.121.', '.121.']

/* ---------------- Sprites ---------------- */

const sprite = (rows: readonly string[], palette: Palette) => lazy(() => outlined(fromStrings(rows, palette), INK))

/** The red and white bobber, floating upright. */
export const BOBBER = sprite(['..0..', '.111.', '12111', '11111', '33333', '.333.', '..3..'], { 0: '#404850', 1: '#e83838', 2: '#ffb0a8', 3: '#f8f8f8' })

/** The buoys marking how far out a cast lands: red, then yellow further out. */
export const BUOYS = {
  mid: sprite(['.1.', '.1.', '232', '232', '444'], { 1: '#404850', 2: '#e84040', 3: '#ffffff', 4: '#a02828' }),
  far: sprite(['.1.', '.1.', '232', '232', '444'], { 1: '#404850', 2: '#f8c830', 3: '#ffffff', 4: '#b08010' }),
}

/** The junk that bites too. */
export const JUNK: Record<JunkId, () => PixelSprite> = {
  boot: sprite(
    ['.11111....', '.15221....', '.15321....', '.15221....', '.152211...', '.1522221..', '.15222221.', '1522222221', '1444444441', '.11111111.'],
    { 1: '#2a1a10', 2: '#8a5a30', 3: '#e0d0a8', 4: '#4a3020', 5: '#b07a48' },
  ),
  can: sprite(['.11111.', '1555551', '1222221', '1333331', '1366631', '1333331', '1222221', '1555551', '.11111.'], { 1: '#283040', 2: '#a8b0c0', 3: '#d84848', 5: '#e8eef8', 6: '#f8f8f8' }),
  seaweed: sprite(
    ['...1....', '..121...', '..121.1.', '.1221121', '.122121.', '..1221..', '.12321..', '1223221.', '.12221..', '..1221..', '.12221..', '..111...'],
    { 1: '#1c4a20', 2: '#48a040', 3: '#88d070' },
  ),
}

/** The bubble with a "!" that pops up over a bite (the lobby's bubble shape). */
export const EXCLAIM = lazy(() =>
  fromStrings(
    ['..1111111..', '.122222221.', '12222322221', '12222322221', '12222322221', '12222322221', '12222222221', '12222322221', '12222222221', '.122222221.', '..1112111..', '....121....', '.....1.....'],
    { 1: '#283040', 2: '#f8f8f8', 3: '#e83838' },
  ),
)

/** A fish's mark on the reel's bar. */
export const FISH_ICON = sprite(['..111..1', '.122211.', '12322221', '.122211.', '..111..1'], { 1: '#203048', 2: '#5878a0', 3: '#f8f8f8' })

/** A four-point twinkle, for catches and the shiny. */
export const SPARKLE = lazy(() => fromStrings(['..1..', '..2..', '12321', '..2..', '..1..'], { 1: '#fff0a0', 2: '#fff8d8', 3: '#ffffff' }))

/** The clock by the time left. */
export const CLOCK = sprite(['.111.', '12321', '12331', '12221', '.111.'], { 1: '#f8f8f8', 2: '#f8f8f8', 3: '#283040' })

/** A cloud: two tones, no outline, like the lobby's sky. */
export const CLOUDS = [
  lazy(() => fromStrings(['....1111.....', '..11111111...', '.1111111111..', '111111111111.', '2222222222222'], { 1: '#ffffff', 2: '#d8e8f8' })),
  lazy(() => fromStrings(['...111....', '.1111111..', '111111111.', '2222222222'], { 1: '#ffffff', 2: '#d8e8f8' })),
]

/* ---------------- Text ---------------- */

const masks = new Map<string, HTMLCanvasElement>()

/** The game's pixel font for the current language (Cubic 11 for Chinese), at the size it's drawn crisp. */
const fontOf = () => (locale() === 'zh' ? '11px "Cubic 11"' : '8px "Press Start 2P"')

/** Loads the fonts a round's text draws in (text drawn before them falls back to a smooth font, and isn't kept). */
export const loadFonts = (sample: string) => document.fonts.load(fontOf(), sample).catch(() => [])

/**
 * A line of text as crisp pixel art: the font's glyphs with every pixel
 * fully on or off, in `color` with a 1 px `outline` around them. Kept per
 * text once the font has loaded.
 */
export const pixelText = (text: string, color: string, outline: string = INK): HTMLCanvasElement => {
  const key = `${color}|${outline}|${text}`
  const kept = masks.get(key)
  if (kept) return kept
  const font = fontOf()
  const probe = context2d(createCanvas(1, 1))
  probe.font = font
  const width = Math.ceil(probe.measureText(text).width)
  const size = locale() === 'zh' ? 11 : 8
  const glyphs = createCanvas(width + 2, size + 4)
  const gx = glyphs.getContext('2d', { willReadFrequently: true })!
  gx.font = font
  gx.textBaseline = 'top'
  gx.fillStyle = '#fff'
  gx.fillText(text, 1, 1)
  const img = gx.getImageData(0, 0, glyphs.width, glyphs.height)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 110 ? 255 : 0
  gx.putImageData(img, 0, 0)
  const tint = (fill: string) => {
    const t = createCanvas(glyphs.width, glyphs.height)
    const tg = context2d(t)
    tg.drawImage(glyphs, 0, 0)
    tg.globalCompositeOperation = 'source-in'
    tg.fillStyle = fill
    tg.fillRect(0, 0, t.width, t.height)
    return t
  }
  const out = createCanvas(glyphs.width + 2, glyphs.height + 2)
  const og = context2d(out)
  const edge = tint(outline)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2]] as const) og.drawImage(edge, dx, dy)
  og.drawImage(tint(color), 1, 1)
  if (document.fonts.check(font, text)) {
    if (masks.size > 120) masks.clear()
    masks.set(key, out)
  }
  return out
}

/** Splits `text` into lines no wider than `max` px in the pixel font (at spaces, and always at " · "). */
export const wrapText = (text: string, max: number): string[] => {
  const probe = context2d(createCanvas(1, 1))
  probe.font = fontOf()
  const lines: string[] = []
  for (const part of text.split(' · ')) {
    let line = ''
    // Chinese wraps between any two characters; the rest between words.
    const words = locale() === 'zh' ? [...part] : part.split(' ')
    const sep = locale() === 'zh' ? '' : ' '
    for (const w of words) {
      const next = line ? line + sep + w : w
      if (line && probe.measureText(next).width > max) {
        lines.push(line)
        line = w
      } else line = next
    }
    if (line) lines.push(line)
  }
  return lines
}

/** A sprite as an image URL (the end sheet's log lists junk with it). */
export const spriteUrl = (s: PixelSprite) => s.toDataURL()
