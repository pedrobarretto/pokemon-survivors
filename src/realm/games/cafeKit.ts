import { PLAYABLE } from '../../data/hatchlings'
import { context2d, createCanvas, fromStrings, lazy, type PixelSprite } from '../../engine/pixelart'
import { locale } from '../../i18n'
import type { TableView } from '../../net/realmTables'
import { loadSpecies } from '../../render/sprites'
import type { Sitter, TableCtx } from './frame'

/**
 * What the café's open tables (Ludo, Unown) draw alike: words in the UI's
 * pixel font, the panels' cut-corner boxes, the four seats' Poké Balls, who
 * sits where (a person's trainer, or one of the bots and its Pokémon) and the
 * size of a canvas that follows the stage by whole pixels.
 */

export const INK = '#181820'

/* ---------------- Text ---------------- */

const texts = new Map<string, PixelSprite>()

/**
 * A line in the UI's pixel font (Cubic 11 for Chinese), every pixel on or
 * off, outlined in `outline`: cached once the font has loaded.
 */
export const label = (text: string, color = '#f8f8f8', outline = INK): PixelSprite => {
  const cjk = locale() === 'zh'
  const size = cjk ? 12 : 8
  const font = `${size}px "Press Start 2P", "Cubic 11", monospace`
  const key = `${font}|${color}|${outline}|${text}`
  const hit = texts.get(key)
  if (hit) return hit
  const probe = context2d(createCanvas(1, 1))
  probe.font = font
  const tw = Math.max(1, Math.ceil(probe.measureText(text).width))
  const mask = createCanvas(tw + 2, size + 4)
  const mg = mask.getContext('2d', { willReadFrequently: true })
  const out = createCanvas(tw + 4, size + 6)
  if (!mg) return out
  mg.font = font
  mg.textBaseline = 'top'
  mg.fillStyle = '#fff'
  mg.fillText(text, 1, cjk ? 1 : 2)
  const img = mg.getImageData(0, 0, mask.width, mask.height)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 110 ? 255 : 0
  mg.putImageData(img, 0, 0)
  const g = context2d(out)
  const tinted = (c: string) => {
    const s = createCanvas(mask.width, mask.height)
    const sg = context2d(s)
    sg.drawImage(mask, 0, 0)
    sg.globalCompositeOperation = 'source-in'
    sg.fillStyle = c
    sg.fillRect(0, 0, s.width, s.height)
    return s
  }
  const edge = tinted(outline)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2], [2, 2]] as const) g.drawImage(edge, dx, dy)
  g.drawImage(tinted(color), 1, 1)
  if (document.fonts.check(font, text)) texts.set(key, out)
  return out
}

/** `text` cut with an ellipsis dot to at most `max` letters. */
export const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}.` : text)

/**
 * `text` in lines that fit `width` game px of the pixel font (8 px a letter;
 * Chinese, without spaces, breaks anywhere at 12 px a character).
 */
export const wrap = (text: string, width: number): string[] => {
  const cjk = locale() === 'zh'
  const max = Math.max(4, Math.floor(width / (cjk ? 12 : 8)))
  if (cjk) return Array.from({ length: Math.ceil([...text].length / max) }, (_, i) => [...text].slice(i * max, (i + 1) * max).join(''))
  const out: string[] = []
  let line = ''
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= max) line = next
    else {
      if (line) out.push(line)
      line = clip(word, max)
    }
  }
  if (line) out.push(line)
  return out
}

/** Draws `s` centered on (`x`, `y`), on whole pixels. */
export const centered = (g: CanvasRenderingContext2D, s: CanvasImageSource & { width: number; height: number }, x: number, y: number) =>
  g.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2))

/** A rectangle with its corners cut by one pixel: the panels', buttons' and cards' shape. */
export const box = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) => {
  g.fillStyle = fill
  g.fillRect(x + 1, y, w - 2, h)
  g.fillRect(x, y + 1, w, h - 2)
}

/** A rectangle the pointer can press. */
export type Rect = { x: number; y: number; w: number; h: number }

export const inside = (r: Rect, x: number, y: number) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h

/**
 * A button: an outlined box, lit on top, sunk while pressed, a label in the
 * middle; `glow` pulses it (the move the table waits for).
 */
export const button = (g: CanvasRenderingContext2D, r: Rect, text: PixelSprite, opts: { fill: string; light: string; dark: string; down?: boolean; glow?: number }) => {
  const sink = opts.down ? 1 : 0
  box(g, r.x, r.y, r.w, r.h, INK)
  if (opts.glow && opts.glow > 0) {
    g.globalAlpha = opts.glow
    box(g, r.x - 1, r.y - 1, r.w + 2, r.h + 2, '#fff8c0')
    g.globalAlpha = 1
    box(g, r.x, r.y, r.w, r.h, INK)
  }
  box(g, r.x + 1, r.y + 1 + sink, r.w - 2, r.h - 2 - sink, opts.dark)
  box(g, r.x + 1, r.y + 1 + sink, r.w - 2, r.h - 4, opts.fill)
  g.fillStyle = opts.light
  if (!opts.down) g.fillRect(r.x + 2, r.y + 2, r.w - 4, 1)
  centered(g, text, r.x + r.w / 2, r.y + r.h / 2 - 1 + sink)
}

/* ---------------- The seats' Poké Balls ---------------- */

/** A seat's ball, 12 × 12: Poké Ball, Great Ball, Ultra Ball, Safari Ball, by seat. */
const BALL = [
  '....kkkk....',
  '..kkttttkk..',
  '.kttttthhtk.',
  '.ktsttttstk.',
  'kTtsttttstTk',
  'kTTTkkkkTTTk',
  'kkkkkwwkkkkk',
  'kwwwkwwkwwgk',
  '.kwwwkkwwwgk',
  '.kgwwwwwwggk',
  '..kkggggkk..',
  '....kkkk....',
]
/** Its 8 × 8 icon for the scoreboard. */
const MINI = ['..kkkk..', '.kttthk.', 'ktsttstk', 'kkkwwkkk', 'kwwkkwgk', 'kwwwwggk', '.kgggkk.', '..kkkk..']

const PALETTES = [
  { k: '#202028', t: '#e83830', T: '#a82018', h: '#ffb0a0', s: '#e83830', w: '#f8f8f8', g: '#b8b8c8' },
  { k: '#202028', t: '#3874e0', T: '#1c4aa8', h: '#b0d0ff', s: '#e83830', w: '#f8f8f8', g: '#b8b8c8' },
  { k: '#202028', t: '#383840', T: '#202028', h: '#8890a0', s: '#f8c830', w: '#f8f8f8', g: '#b8b8c8' },
  { k: '#202028', t: '#68b048', T: '#3c7c30', h: '#c8f0a0', s: '#c8a050', w: '#f8f8f8', g: '#b8b8c8' },
] as const

export const balls = lazy(() => PALETTES.map((p) => fromStrings(BALL, p)))
export const miniBalls = lazy(() => PALETTES.map((p) => fromStrings(MINI, p)))

/** Each seat's colors (its ball's), for its yard, its lane, its name: `mid` the color, `light`/`dark` its ramp, `ink` text on it. */
export const SEAT_COLORS = [
  { mid: '#e05040', light: '#f8a090', dark: '#982818', pale: '#f8d8d0', ink: '#f8f8f8' },
  { mid: '#3c78d8', light: '#90b8f8', dark: '#1c4090', pale: '#d0e0f8', ink: '#f8f8f8' },
  { mid: '#e8b820', light: '#f8e080', dark: '#906808', pale: '#f8f0c0', ink: INK },
  { mid: '#58a840', light: '#a8d880', dark: '#2c6820', pale: '#d8f0c8', ink: '#f8f8f8' },
] as const

/* ---------------- Who sits where ---------------- */

/** The bots' Pokémon, one per seat (the computer's own and three of its friends), and their names. */
const BOTS = [
  { partner: 'porygon', dex: 137, name: 'Porygon' },
  { partner: 'magnemite', dex: 81, name: 'Magnemite' },
  { partner: 'rotom', dex: 479, name: 'Rotom' },
  { partner: 'voltorb', dex: 100, name: 'Voltorb' },
] as const

/** A seat as the screen shows it: its name, whether it's a bot, the Pokémon at it (dex) and shiny. */
export type Seated = { name: string; bot: boolean; dex: number; shiny: boolean; you: boolean }

/** The dex a trainer's partner is drawn as (its line's first stage), Pikachu for anything unknown. */
export const dexOf = (partner: string) => (Object.hasOwn(PLAYABLE, partner) ? PLAYABLE[partner as keyof typeof PLAYABLE].line[0].dex : 25)

/**
 * Who's at `seat`: a person (`ctx.who`, or this device's own player), or a
 * bot (a negative id at the local table, a null seat during a relay match).
 * `you` reads "Você"; a bot goes by its Pokémon's name.
 */
export const seatedAt = (ctx: TableCtx, tb: TableView | null, seat: number, you: string): Seated | null => {
  const id = tb?.seats[seat]
  if (id === undefined) return null
  const bot = BOTS[seat % BOTS.length]!
  // A null seat is free while the table gathers, and the bot's in a match.
  if (id === null && tb?.phase === 'waiting') return null
  if (id === null || id < 0) return { name: bot.name, bot: true, dex: bot.dex, shiny: false, you: false }
  const mine = ctx.source.seat() === seat
  const who: Sitter | null = ctx.who(id) ?? (mine ? { handle: '', partner: ctx.partner, shiny: ctx.shiny } : null)
  if (!who) return { name: '...', bot: false, dex: 25, shiny: false, you: mine }
  return { name: mine ? you : who.handle || '...', bot: false, dex: dexOf(who.partner), shiny: who.shiny, you: mine }
}

/** Loads each seated Pokémon's sheets once (`loaded` remembers which were asked). */
export const loadSeated = (seated: readonly (Seated | null)[], loaded: Set<string>) => {
  for (const s of seated) {
    if (!s) continue
    const key = `${s.dex}|${s.shiny}`
    if (loaded.has(key)) continue
    loaded.add(key)
    void loadSpecies(s.dex, s.shiny).catch(() => {})
  }
}

/* ---------------- The canvas ---------------- */

/**
 * The canvas size for a stage of `stageW` × `stageH` CSS px: the whole stage
 * at a whole scale (2 on a phone held either way, at most 3 on a desktop), the most
 * that keeps at least `short` game px on its short side and `long` on its
 * long one.
 */
export const fluidSize = (short: number, long: number) => (stageW: number, stageH: number) => {
  const scale = Math.max(1, Math.min(3, Math.floor(Math.min(stageW, stageH) / short), Math.floor(Math.max(stageW, stageH) / long)))
  return { w: Math.max(120, Math.floor(stageW / scale)), h: Math.max(120, Math.floor(stageH / scale)) }
}

/* ---------------- Bits ---------------- */

/** A bit of confetti or dust. */
export type Bit = { x: number; y: number; vx: number; vy: number; life: number; color: string; size: number }

/** Moves the bits on by `dt` (gravity pulls them), dropping the spent ones. */
export const stepBits = (bits: Bit[], dt: number): Bit[] =>
  bits.filter((b) => {
    b.life -= dt
    b.vy += 260 * dt
    b.x += b.vx * dt
    b.y += b.vy * dt
    return b.life > 0
  })

export const drawBits = (g: CanvasRenderingContext2D, bits: readonly Bit[]) => {
  for (const b of bits) {
    g.fillStyle = b.color
    g.fillRect(Math.round(b.x), Math.round(b.y), b.size, b.size)
  }
}

/** A burst of `n` bits from (`x`, `y`) in `colors`. */
export const burst = (bits: Bit[], x: number, y: number, n: number, colors: readonly string[], speed = 120) => {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2
    const sp = speed * (0.3 + Math.random() * 0.7)
    bits.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - speed * 0.4, life: 0.5 + Math.random() * 0.7, color: colors[i % colors.length]!, size: 1 + (i % 3 === 0 ? 1 : 0) })
  }
}

/** A plain dark canvas fill (the café's wooden table) under everything, `w` × `h`. */
export const tableTop = (g: CanvasRenderingContext2D, w: number, h: number) => {
  g.fillStyle = '#3a2418'
  g.fillRect(0, 0, w, h)
  g.fillStyle = '#442c1c'
  for (let y = 3; y < h; y += 7) g.fillRect(0, y, w, 1)
  g.fillStyle = '#301c12'
  for (let y = 6; y < h; y += 14) for (let x = (y * 7) % 23; x < w; x += 41) g.fillRect(x, y, 9, 1)
}
