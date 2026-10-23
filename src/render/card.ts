import { formatTime } from '../engine/math'
import { canvasCache, context2d, createCanvas, ellipse, fromStrings, onCanvasReset, type PixelSprite } from '../engine/pixelart'
import { MEDALS, type Medal } from '../data/achievements'
import type { BackgroundId, FrameId } from '../data/style'
import type { Difficulty } from '../game/difficulty'
import { RIBBON_TIERS, type RibbonTier } from '../game/ribbons'
import { formatDay, formatNumber, locale, LOCALES, t } from '../i18n'
import { medalSprite, outlined, PICKUPS, ribbonSprite, SPARKLE } from './art'
import { CARD_BACKGROUNDS, CARD_FRAMES, DEFAULT_CARD_STYLE, type CardBackground, type CardFrame, type CardStyle } from './cosmetics'
import { titleLogo } from './logo'
import { drawPokemon, hasShiny, loadSpecies, portraitUrl, type SpeciesSprites } from './sprites'

/**
 * Share cards: the run's card (results screen) and the Trainer Card (profile,
 * Caixa do PC), drawn like the game: a 270×338 pixel layout (≈4:5, a feed
 * post) built from code art, PMD sprites at whole scales and the game's fonts
 * snapped to hard pixels, then blown up ×4 into a 1080×1352 PNG. Text reads
 * `t()` when drawn. `style` takes the equipped frame and background
 * (`render/cosmetics.ts`), the default one otherwise.
 */

export const CARD = { w: 270, h: 338, scale: 4 } as const

/** A Pokémon on a card: its dex number, name and colors. */
export type CardMon = { dex: number; name: string; shiny: boolean }

/** Who shares the card: handle and equipped title when there is one, and the game's link (with `?ref=`). */
export type CardTrainer = { handle: string | null; title: string | null; link: string }

export type RunOutcome = 'victory' | 'fainted' | 'endless'

export type RunCardData = {
  date: Date
  /** The form the run ended in. */
  mon: CardMon
  outcome: RunOutcome
  difficulty: Difficulty
  time: number
  level: number
  kills: number
  /** Shinies caught this run, and how many of them the Pokédex didn't have. */
  shinies: readonly CardMon[]
  newShinies: number
  /** Species the Pokédex saw for the first time (shown when no shiny came). */
  newSpecies: readonly CardMon[]
  /** The moves that hurt the most (shown when nothing new came). `icon` is a data URL. */
  moves: ReadonlyArray<{ name: string; icon: string; damage: number; color: string }>
  /** Rift legendaries beaten, by dex number. */
  legends: readonly number[]
  /** The official Desafio do dia attempt's place, when the API told it ("Desafio de 15/10: #12 de 340"). */
  challenge: { day: string; rank: number; total: number } | null
  trainer: CardTrainer
}

export type TrainerCardData = {
  date: Date
  /** The account's display name; null plays as a guest. */
  name: string | null
  partner: CardMon
  medals: Readonly<Record<Medal, number>>
  /** Every shiny in the Caixa do PC. */
  shinies: number
  /** Desafio do dia ribbons won, by tier (none: the row stays off). */
  ribbons: Readonly<Record<RibbonTier, number>>
  dex: { caught: number; seen: number; total: number }
  bestTime: number
  /** Shinies to show off, best first: the grid shows six, or five and "+N" (`showcase`). */
  showcase: readonly CardMon[]
  trainer: CardTrainer
}

/** Cells in a card's grid. */
export const CARD_SLOTS = 6

/**
 * What a grid of `slots` cells shows: every item when they fit, else one
 * cell fewer and a "+N" cell for the rest.
 */
export const showcase = <T>(items: readonly T[], slots = CARD_SLOTS): { shown: readonly T[]; more: number } => {
  if (items.length <= slots) return { shown: items, more: 0 }
  const shown = items.slice(0, slots - 1)
  return { shown, more: items.length - shown.length }
}

/* ---------------- Palette ---------------- */

const INK = '#303040'
const PAPER = '#f8f8f8'
const BOX_EDGE = '#283040'
const BOX_FRAME = '#6878a8'
const GOLD = '#e0a828'
const GOLD_LIGHT = '#f8d860'
const MUTED = '#707088'
const SHADOW = '#060a18'
const DIFFICULTY_COLORS = { normal: '#58b858', hard: '#f08030', nightmare: '#a040c8' } as const satisfies Record<Difficulty, string>
const OUTCOME_COLORS = { victory: '#3878e8', fainted: '#d04848', endless: '#7048d8' } as const satisfies Record<RunOutcome, string>

/* ---------------- Text ---------------- */

type Font = 'title' | 'body'

/** Cubic 11 draws the Chinese text the Latin pixel fonts have no glyphs for (see `ui/style.css`). */
const FAMILY = { title: '"Press Start 2P", "Cubic 11"', body: 'VT323, "Cubic 11"' } as const satisfies Record<Font, string>

/** Waits for the game fonts: a card drawn before them would fall back to a smooth system font. A line of the current language as the sample loads Cubic 11 only when the card is in Chinese. */
const fontsReady = () => Promise.all([document.fonts.load(`8px ${FAMILY.title}`, t().loading), document.fonts.load(`16px ${FAMILY.body}`, t().loading)])

type Mask = { canvas: HTMLCanvasElement; width: number; baseline: number }

const masks = canvasCache<string, Mask>()

/** Text in white with every pixel fully on or off, so it reads like the rest of the pixel art. */
const textMask = (text: string, font: Font, size: number): Mask => {
  const key = `${font}|${size}|${text}`
  const cached = masks.get(key)
  if (cached) return cached
  const probe = context2d(createCanvas(1, 1))
  probe.font = `${size}px ${FAMILY[font]}`
  const width = Math.ceil(probe.measureText(text).width)
  const baseline = Math.round(size * 1.5)
  const canvas = createCanvas(width + 2, size * 2)
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.font = `${size}px ${FAMILY[font]}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#fff'
  ctx.fillText(text, 1, baseline)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i]! >= 110 ? 255 : 0
  ctx.putImageData(img, 0, 0)
  const mask = { canvas, width, baseline }
  masks.set(key, mask)
  return mask
}

const recolor = (mask: HTMLCanvasElement, color: string) => {
  const canvas = createCanvas(mask.width, mask.height)
  const ctx = context2d(canvas)
  ctx.drawImage(mask, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

type TextOpts = { font?: Font; size?: number; color?: string; shadow?: string; align?: 'left' | 'center' | 'right' }

const textWidth = (text: string, font: Font = 'body', size = 16) => textMask(text, font, size).width

/** `text` cut with "…" until it fits `max` px. */
const fit = (text: string, max: number, font: Font = 'body', size = 16) => {
  if (textWidth(text, font, size) <= max) return text
  let cut = text
  while (cut.length > 1 && textWidth(`${cut}…`, font, size) > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** Draws pixel text with its baseline at `y`, with a 1 px drop shadow if asked. Returns its width. */
const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, opts: TextOpts = {}) => {
  const { font = 'body', size = 16, color = INK, shadow, align = 'left' } = opts
  const mask = textMask(value, font, size)
  const left = align === 'center' ? x - Math.floor(mask.width / 2) : align === 'right' ? x - mask.width : x
  const top = y - mask.baseline
  // The mask has a 1 px margin on the left; the shadow sits 1 px right and down.
  if (shadow) ctx.drawImage(recolor(mask.canvas, shadow), left, top + 1)
  ctx.drawImage(recolor(mask.canvas, color), left - 1, top)
  return mask.width
}

/* ---------------- Shapes ---------------- */

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color
  ctx.fillRect(x, y, w, h)
}

/** A filled box with its corner pixels cut, the game's rounded corners at this size. */
const rounded = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  rect(ctx, x + 1, y, w - 2, h, color)
  rect(ctx, x, y + 1, w, h - 2, color)
}

/** The game's dialog box: dark line, paper, the blue frame and paper again, with a drop shadow. */
const paperBox = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  rounded(ctx, x, y + 1, w, h, SHADOW)
  rounded(ctx, x, y, w, h, BOX_EDGE)
  rounded(ctx, x + 1, y + 1, w - 2, h - 2, PAPER)
  rounded(ctx, x + 2, y + 2, w - 4, h - 4, BOX_FRAME)
  rounded(ctx, x + 3, y + 3, w - 6, h - 6, PAPER)
}

/** A Caixa do PC cell: white with a gold frame inside. */
const pcCell = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) => {
  rounded(ctx, x, y + 1, w, h, SHADOW)
  rounded(ctx, x, y, w, h, BOX_EDGE)
  rounded(ctx, x + 1, y + 1, w - 2, h - 2, PAPER)
  rounded(ctx, x + 2, y + 2, w - 4, h - 4, GOLD)
  rounded(ctx, x + 3, y + 3, w - 6, h - 6, '#fffdf4')
  rect(ctx, x + 3, y + h - 13, w - 6, 10, '#f4f0e0')
}

/** A label chip (SHINY, the outcome, the difficulty). Returns its width. */
const chip = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, bg: string, color = '#ffffff') => {
  const w = textWidth(label) + 8
  rounded(ctx, x, y + 1, w, 12, SHADOW)
  rounded(ctx, x, y, w, 12, bg)
  rect(ctx, x + 1, y, w - 2, 1, 'rgba(255,255,255,0.35)')
  text(ctx, label, x + 4, y + 10, { color })
  return w
}

const clipped = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, draw: () => void) => {
  ctx.save()
  ctx.beginPath()
  ctx.rect(x, y, w, h)
  ctx.clip()
  draw()
  ctx.restore()
}

const sparkles = () => SPARKLE()

/** Sparkles outlined for light backgrounds (cells, chips). */
let darkSparkles: PixelSprite[] | null = null
onCanvasReset(
  () => (darkSparkles = null),
  () => darkSparkles,
)
const outlinedSparkles = () => (darkSparkles ??= SPARKLE().map((s) => outlined(s, '#584010')))

const blit = (ctx: CanvasRenderingContext2D, sprite: PixelSprite, cx: number, cy: number) =>
  ctx.drawImage(sprite, Math.round(cx - sprite.width / 2), Math.round(cy - sprite.height / 2))

/* ---------------- Backdrop and frame ---------------- */

type Size = { w: number; h: number }

/** Sky in bands, dithered where they meet, with a deterministic sprinkle of stars. */
const drawBackground = (ctx: CanvasRenderingContext2D, bg: CardBackground, { w, h }: Size = CARD) => {
  const band = Math.ceil(h / bg.sky.length)
  bg.sky.forEach((color, i) => rect(ctx, 0, i * band, w, band, color))
  bg.sky.slice(1).forEach((color, i) => {
    const y = (i + 1) * band
    ctx.fillStyle = color
    for (let x = 0; x < w; x++) {
      if (x % 2 === 0) ctx.fillRect(x, y - 2, 1, 1)
      if (x % 4 === 1) ctx.fillRect(x, y - 4, 1, 1)
    }
    ctx.fillStyle = bg.sky[i]!
    for (let x = 0; x < w; x++) if (x % 2 === 1) ctx.fillRect(x, y + 1, 1, 1)
  })
  // A tiny LCG keeps the sky the same on every card.
  let seed = 20261015
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  const stars = Math.round((bg.stars * w * h) / (CARD.w * CARD.h))
  for (let i = 0; i < stars; i++) {
    const x = Math.floor(rand() * w)
    const y = Math.floor(rand() * h)
    const color = bg.starColors[Math.floor(rand() * bg.starColors.length)]!
    const kind = rand()
    if (kind < 0.08) blit(ctx, sparkles()[0]!, x, y)
    else if (kind < 0.2) {
      rect(ctx, x - 1, y, 3, 1, color)
      rect(ctx, x, y - 1, 1, 3, color)
    } else rect(ctx, x, y, 1, 1, color)
  }
}

/**
 * The card's border, with rounded corners and a dot of the accent (or the
 * frame's ball) in each. A frame with a `lower` color splits its band in
 * halves with a dark line across each side, like a Poké Ball.
 */
const drawFrame = (ctx: CanvasRenderingContext2D, f: CardFrame, { w, h }: Size = CARD) => {
  const ring = (i: number, color: string) => {
    rect(ctx, i, i, w - i * 2, 1, color)
    rect(ctx, i, h - 1 - i, w - i * 2, 1, color)
    rect(ctx, i, i, 1, h - i * 2, color)
    rect(ctx, w - 1 - i, i, 1, h - i * 2, color)
  }
  ;[f.edge, f.light, f.main, f.main, f.edge, f.shade].forEach((color, i) => ring(i, color))
  if (f.lower) {
    const mid = Math.floor(h / 2)
    for (const i of [2, 3]) {
      rect(ctx, i, h - 1 - i, w - i * 2, 1, f.lower)
      rect(ctx, i, mid, 1, h - 1 - i - mid, f.lower)
      rect(ctx, w - 1 - i, mid, 1, h - 1 - i - mid, f.lower)
    }
    rect(ctx, 0, mid - 1, 6, 2, f.edge)
    rect(ctx, w - 6, mid - 1, 6, 2, f.edge)
  }
  // Rounded outer corners: the page shows through.
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]] as const) {
    ctx.clearRect(x, y, 1, 1)
    ctx.clearRect(x === 0 ? 1 : x - 1, y, 1, 1)
    ctx.clearRect(x, y === 0 ? 1 : y - 1, 1, 1)
    rect(ctx, x === 0 ? 1 : x - 1, y === 0 ? 1 : y - 1, 1, 1, f.edge)
  }
  if (f.ball) {
    const ballSprite = fromStrings(f.ball[0], f.ball[1])
    for (const [x, y] of [[1, 1], [w - 8, 1], [1, h - 8], [w - 8, h - 8]] as const) ctx.drawImage(ballSprite, x, y)
  } else for (const [x, y] of [[2, 2], [w - 4, 2], [2, h - 4], [w - 4, h - 4]] as const) rect(ctx, x, y, 2, 2, f.accent)
}

/**
 * A card's look in small (`w`×`h` px), for the Poké Mart's style shelf: the
 * sky, with the frame around it unless `frame` is null.
 */
export const styleThumb = (frame: FrameId | null, background: BackgroundId, w = 54, h = 68) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  drawBackground(ctx, CARD_BACKGROUNDS[background], { w, h })
  if (frame) drawFrame(ctx, CARD_FRAMES[frame], { w, h })
  return canvas
}

/* ---------------- Pieces ---------------- */

/** Sprites of a card Pokémon: shiny when it is and SpriteCollab has the colors, never a rejection. */
const spritesOf = (mon: CardMon): Promise<SpeciesSprites | null> =>
  loadSpecies(mon.dex, mon.shiny && hasShiny(mon.dex)).catch(() => loadSpecies(mon.dex).catch(() => null))

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })

/** Largest whole scale that keeps the body inside `maxW`×`maxH`, from 1 to 4. */
const heroScale = (s: SpeciesSprites, maxW: number, maxH: number) => Math.max(1, Math.min(4, Math.floor(Math.min(maxW / s.bodyW, maxH / s.bodyH))))

/** A battle platform: a rim, its face and a lighter ring, like the stages of the games. */
const platform = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, colors: { rim: string; face: string; ring: string }) => {
  blit(ctx, ellipse(rx + 1, ry + 1, SHADOW), cx, cy + 4)
  blit(ctx, ellipse(rx, ry, colors.rim), cx, cy + 3)
  blit(ctx, ellipse(rx, ry, colors.face), cx, cy)
  blit(ctx, ellipse(rx - 5, ry - 2, colors.ring), cx, cy)
  blit(ctx, ellipse(rx - 7, ry - 3, colors.face), cx, cy + 1)
}

const NIGHT_PLATFORM = { rim: '#1c2648', face: '#3a5288', ring: '#5070b0' }
const PAPER_PLATFORM = { rim: '#a8b0c8', face: '#d8dcea', ring: '#eceef6' }

/** The big Pokémon of a card standing on its platform, with sparkles around a shiny. */
const hero = (ctx: CanvasRenderingContext2D, s: SpeciesSprites | null, mon: CardMon, cx: number, feetY: number, box: { w: number; h: number }, colors = NIGHT_PLATFORM) => {
  platform(ctx, cx, feetY + 2, Math.round(box.w / 2) - 6, 8, colors)
  if (!s) return blit(ctx, PICKUPS.pokeball(), cx, feetY - 8)
  const k = heroScale(s, box.w - 12, box.h)
  drawPokemon(ctx, s, 'Idle', 0, 0, cx, feetY, { scale: k })
  if (!mon.shiny) return
  const top = feetY - s.bodyH * k
  const half = (s.bodyW * k) / 2
  const marks = [
    [cx - half - 8, top + 4, 2],
    [cx + half + 6, top - 2, 2],
    [cx + half + 10, top + (s.bodyH * k) / 2, 1],
    [cx - half - 12, feetY - 14, 1],
    [cx + 4, top - 8, 0],
    [cx - half + 2, top - 6, 0],
  ] as const
  for (const [x, y, size] of marks) blit(ctx, sparkles()[size]!, x, y)
}

/** A cell of the grid: the Pokémon's first Idle frame, its name and a sparkle for a shiny. */
const monCell = (ctx: CanvasRenderingContext2D, s: SpeciesSprites | null, mon: CardMon, x: number, y: number, w: number, h: number) => {
  pcCell(ctx, x, y, w, h)
  clipped(ctx, x + 3, y + 3, w - 6, h - 16, () => {
    if (s) drawPokemon(ctx, s, 'Idle', 0, 0, x + w / 2, y + h - 15)
    else blit(ctx, PICKUPS.pokeball(), x + w / 2, y + (h - 13) / 2)
  })
  text(ctx, fit(mon.name, w - 8), x + w / 2, y + h - 5, { align: 'center' })
  if (mon.shiny) blit(ctx, outlinedSparkles()[1]!, x + w - 8, y + 8)
}

/** The "+N" cell closing a grid that doesn't fit. */
const moreCell = (ctx: CanvasRenderingContext2D, more: number, x: number, y: number, w: number, h: number) => {
  pcCell(ctx, x, y, w, h)
  text(ctx, `+${more}`, x + w / 2, y + h / 2 + 2, { font: 'title', size: 16, color: '#c08010', align: 'center' })
  text(ctx, t().share.card.more, x + w / 2, y + h - 5, { align: 'center', color: MUTED })
  blit(ctx, outlinedSparkles()[2]!, x + 12, y + 10)
  blit(ctx, outlinedSparkles()[0]!, x + w - 10, y + h - 20)
}

const GRID = { cols: 3, gap: 4, cellH: 46 } as const

const gridHeight = (cells: number) => {
  const rows = Math.max(1, Math.ceil(cells / GRID.cols))
  return rows * GRID.cellH + (rows - 1) * GRID.gap
}

/** Up to six Pokémon in Caixa do PC cells, three per row, the last one "+N" when they don't fit. */
const monGrid = async (ctx: CanvasRenderingContext2D, mons: readonly CardMon[], x: number, y: number, w: number) => {
  const { shown, more } = showcase(mons)
  const cellW = Math.floor((w - GRID.gap * (GRID.cols - 1)) / GRID.cols)
  const spriteSets = await Promise.all(shown.map(spritesOf))
  const at = (i: number) => ({ cx: x + (i % GRID.cols) * (cellW + GRID.gap), cy: y + Math.floor(i / GRID.cols) * (GRID.cellH + GRID.gap) })
  shown.forEach((mon, i) => {
    const { cx, cy } = at(i)
    monCell(ctx, spriteSets[i]!, mon, cx, cy, cellW, GRID.cellH)
  })
  if (more > 0) {
    const { cx, cy } = at(shown.length)
    moreCell(ctx, more, cx, cy, cellW, GRID.cellH)
  }
}

/** Empty Caixa do PC cells with a faint Poké Ball, for a Trainer Card with no shiny yet. */
const emptyGrid = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
  const cellW = Math.floor((w - GRID.gap * (GRID.cols - 1)) / GRID.cols)
  for (let i = 0; i < GRID.cols; i++) {
    const cx = x + i * (cellW + GRID.gap)
    pcCell(ctx, cx, y, cellW, GRID.cellH)
    ctx.globalAlpha = 0.25
    blit(ctx, PICKUPS.pokeball(), cx + cellW / 2, y + GRID.cellH / 2 - 4)
    ctx.globalAlpha = 1
  }
  text(ctx, t().share.card.noShinies, x + w / 2, y + GRID.cellH - 5, { align: 'center', color: MUTED })
}

const MOVE_ROW = 14

/** The moves that hurt the most: icon, name, a bar in the move's type color and the damage. */
const moveList = async (ctx: CanvasRenderingContext2D, moves: RunCardData['moves'], x: number, y: number, w: number) => {
  const icons = await Promise.all(moves.map((m) => loadImage(m.icon)))
  const top = moves[0]?.damage || 1
  paperBox(ctx, x, y, w, moves.length * MOVE_ROW + 8)
  moves.forEach((m, i) => {
    const ry = y + 4 + i * MOVE_ROW
    const icon = icons[i]
    if (icon) ctx.drawImage(icon, x + 6, ry + Math.round((MOVE_ROW - icon.height) / 2))
    text(ctx, fit(m.name, 88), x + 22, ry + 11)
    const barX = x + 114
    const barW = w - 114 - 56
    rect(ctx, barX, ry + 5, barW, 4, '#d0d4e4')
    rect(ctx, barX, ry + 5, Math.max(2, Math.round((barW * m.damage) / top)), 4, m.color)
    text(ctx, formatNumber(m.damage), x + w - 8, ry + 11, { align: 'right' })
  })
}

const movesHeight = (moves: number) => moves * MOVE_ROW + 8

const STRIP_H = 42

/** Number sizes a stat may take, biggest first: a long one ("217/568") steps down until it fits its column. */
const STAT_SIZES = [32, 24, 16] as const

/** A paper strip of three stats: small label, big number. */
const statStrip = (ctx: CanvasRenderingContext2D, stats: ReadonlyArray<readonly [string, string]>, x: number, y: number, w: number) => {
  paperBox(ctx, x, y, w, STRIP_H)
  const col = Math.floor((w - 8) / stats.length)
  stats.forEach(([label, value], i) => {
    const cx = x + 4 + col * i + Math.floor(col / 2)
    if (i > 0) rect(ctx, x + 4 + col * i, y + 8, 1, STRIP_H - 16, '#d8dce8')
    text(ctx, label, cx, y + 13, { align: 'center', color: MUTED })
    const size = STAT_SIZES.find((s) => textWidth(value, 'body', s) <= col - 6) ?? 16
    text(ctx, value, cx, y + 36, { size, align: 'center' })
  })
}

/** A section title in gold, with an optional note on the right. */
const sectionTitle = (ctx: CanvasRenderingContext2D, title: string, note: string | null, x: number, y: number, w: number) => {
  text(ctx, title, x + 1, y + 8, { font: 'title', size: 8, color: GOLD_LIGHT, shadow: SHADOW })
  if (note) text(ctx, note, x + w - 1, y + 9, { align: 'right', color: '#c8d0f0', shadow: SHADOW })
}

/** The footer: who shares it (handle and title) and the link that brings friends in. */
const footer = (ctx: CanvasRenderingContext2D, trainer: CardTrainer, y: number) => {
  const { w } = CARD
  const m = t().share.card
  rect(ctx, 14, y, w - 28, 1, '#34447a')
  const who = [trainer.handle && `@${trainer.handle}`, trainer.title && `★ ${trainer.title} ★`].filter((s): s is string => Boolean(s)).join(' · ')
  text(ctx, fit(who || m.play, w - 28), w / 2, y + 13, { align: 'center', color: '#e8ecff', shadow: SHADOW })
  const link = textWidth(trainer.link) <= w - 28 ? trainer.link : trainer.link.replace(/\?.*$/, '')
  text(ctx, link, w / 2, y + 25, { align: 'center', color: GOLD_LIGHT, shadow: SHADOW })
}

const FOOTER_H = 28

/** The logo (top left) and a line or two on the right. */
const header = async (ctx: CanvasRenderingContext2D, right: readonly string[]) => {
  const logo = await titleLogo()
  ctx.drawImage(logo, 10, 9)
  right.forEach((line, i) => text(ctx, line, CARD.w - 11, 20 + i * 11, { font: i === 0 ? 'body' : 'title', size: i === 0 ? 16 : 8, align: 'right', color: i === 0 ? '#a8b4e0' : GOLD_LIGHT, shadow: SHADOW }))
}

const HEADER_H = 46

/** Day, month and year in the current language. */
const cardDate = (d: Date) => d.toLocaleDateString(LOCALES[locale()].tag, { day: '2-digit', month: '2-digit', year: 'numeric' })

/** Blocks stacked between the header and the footer, the spare height spread between them. */
const stack = (heights: readonly number[], top: number, bottom: number) => {
  const gap = Math.max(4, Math.floor((bottom - top - heights.reduce((a, b) => a + b, 0)) / (heights.length + 1)))
  let y = top + gap
  return heights.map((h) => {
    const at = y
    y += h + gap
    return at
  })
}

/** The low-res canvas every card is laid out on, sky and frame already drawn. */
const blank = (style: CardStyle) => {
  const canvas = createCanvas(CARD.w, CARD.h)
  const ctx = context2d(canvas)
  drawBackground(ctx, CARD_BACKGROUNDS[style.background])
  return { canvas, ctx }
}

/** The finished card: the frame on top, then ×4 with hard pixels. */
const finish = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, style: CardStyle) => {
  drawFrame(ctx, CARD_FRAMES[style.frame])
  const out = createCanvas(CARD.w * CARD.scale, CARD.h * CARD.scale)
  context2d(out).drawImage(canvas, 0, 0, out.width, out.height)
  canvas.width = canvas.height = 0
  return out
}

const INNER = { x: 8, w: CARD.w - 16 } as const

/* ---------------- The run's card ---------------- */

/** What fills the grid of a run's card: its shinies, else what the Pokédex gained, else its strongest moves. */
type RunSection = { kind: 'mons'; title: string; note: string | null; mons: readonly CardMon[] } | { kind: 'moves' } | { kind: 'none' }

const runSection = (card: RunCardData): RunSection => {
  const m = t().share.card
  if (card.shinies.length > 0) return { kind: 'mons', title: m.shinies, note: card.newShinies > 0 ? m.newShinies(card.newShinies) : null, mons: card.shinies }
  if (card.newSpecies.length > 0) return { kind: 'mons', title: m.newSpecies, note: m.speciesCount(card.newSpecies.length), mons: card.newSpecies }
  return card.moves.length > 0 ? { kind: 'moves' } : { kind: 'none' }
}

const HERO_H = 90

/** The Trainer Card's ribbon row, under the medals. */
const RIBBON_ROW = 18

/** Legendary portraits beside the hero; more show as "+N". */
const LEGENDS_SHOWN = 2

/** The run's card: the Pokémon on its platform, name and chips, legendaries beaten, the stats and the run's best catch. */
export const drawRunCard = async (card: RunCardData, style: CardStyle = DEFAULT_CARD_STYLE) => {
  await fontsReady()
  const m = t().share.card
  const { canvas, ctx } = blank(style)
  // An official challenge attempt reads in the header: "Desafio de 15/10" over "#12 DE 340", in gold.
  const place = card.challenge
  await header(ctx, place ? [m.challenge(formatDay(place.day)), m.challengePlace(place.rank, place.total)] : [cardDate(card.date)])
  const section = runSection(card)
  const sectionH = section.kind === 'none' ? 0 : 12 + (section.kind === 'mons' ? gridHeight(Math.min(section.mons.length, CARD_SLOTS)) : movesHeight(card.moves.length))
  const [heroY, statsY, sectionY] = stack(section.kind === 'none' ? [HERO_H, STRIP_H] : [HERO_H, STRIP_H, sectionH], HEADER_H, CARD.h - 8 - FOOTER_H)

  // Hero: the Pokémon on the left half, its name, chips and legendaries on the right.
  const [sprites, portraits] = await Promise.all([spritesOf(card.mon), Promise.all(card.legends.slice(0, LEGENDS_SHOWN).map((dex) => loadImage(portraitUrl(dex))))])
  hero(ctx, sprites, card.mon, 72, heroY! + HERO_H - 12, { w: 124, h: 78 })
  const rx = 142
  const rw = CARD.w - 10 - rx
  const nameW = text(ctx, fit(card.mon.name, rw - 10, 'title', 8), rx, heroY! + 14, { font: 'title', size: 8, color: '#ffffff', shadow: SHADOW })
  if (card.mon.shiny) blit(ctx, sparkles()[2]!, rx + nameW + 6, heroY! + 10)
  const chips = [
    ...(card.mon.shiny ? [[m.shiny, GOLD_LIGHT, INK] as const] : []),
    [m.outcomes[card.outcome], OUTCOME_COLORS[card.outcome], '#ffffff'] as const,
    [t().difficulty.names[card.difficulty], DIFFICULTY_COLORS[card.difficulty], '#ffffff'] as const,
  ]
  let cx = rx
  let cy = heroY! + 20
  for (const [label, bg, color] of chips) {
    if (cx + textWidth(label) + 8 > rx + rw) {
      cx = rx
      cy += 14
    }
    cx += chip(ctx, label, cx, cy, bg, color) + 4
  }
  if (card.legends.length > 0) {
    // Portraits at 1:1 in gold frames, two at most and a "+N".
    const ly = heroY! + HERO_H - 42
    portraits.forEach((img, i) => {
      const px = rx + i * 45
      rounded(ctx, px, ly + 1, 42, 42, SHADOW)
      rounded(ctx, px, ly, 42, 42, BOX_EDGE)
      rect(ctx, px + 1, ly + 1, 40, 40, GOLD)
      if (img) ctx.drawImage(img, px + 1, ly + 1)
    })
    if (card.legends.length > LEGENDS_SHOWN) text(ctx, `+${card.legends.length - LEGENDS_SHOWN}`, rx + rw, ly + 26, { font: 'title', size: 8, align: 'right', color: GOLD_LIGHT, shadow: SHADOW })
  } else if (card.moves[0]) {
    // No legendary: the move that carried the run.
    const top = card.moves[0]
    const icon = await loadImage(top.icon)
    const ly = heroY! + HERO_H - 30
    text(ctx, m.topMove, rx, ly, { color: '#c8d0f0', shadow: SHADOW })
    if (icon) ctx.drawImage(icon, rx, ly + 4)
    text(ctx, fit(top.name, rw - 18), rx + (icon?.width ?? 0) + 4, ly + 14, { color: '#ffffff', shadow: SHADOW })
  }

  statStrip(ctx, [[m.time, formatTime(card.time)], [m.level, String(card.level)], [m.kills, formatNumber(card.kills)]], INNER.x, statsY!, INNER.w)

  if (section.kind === 'mons') {
    sectionTitle(ctx, section.title, section.note, INNER.x, sectionY!, INNER.w)
    await monGrid(ctx, section.mons, INNER.x, sectionY! + 12, INNER.w)
  } else if (section.kind === 'moves') {
    sectionTitle(ctx, m.moves, null, INNER.x, sectionY!, INNER.w)
    await moveList(ctx, card.moves, INNER.x, sectionY! + 12, INNER.w)
  }

  footer(ctx, card.trainer, CARD.h - 8 - FOOTER_H)
  return finish(canvas, ctx, style)
}

/* ---------------- The Trainer Card ---------------- */

/** The Trainer Card: name, handle, title and medals beside the partner, the collection in numbers and up to six shinies. */
export const drawTrainerCard = async (card: TrainerCardData, style: CardStyle = DEFAULT_CARD_STYLE) => {
  await fontsReady()
  const m = t().share.card
  const { canvas, ctx } = blank(style)
  await header(ctx, [cardDate(card.date), ...m.trainerCard])
  const gridH = 12 + gridHeight(card.showcase.length > 0 ? Math.min(card.showcase.length, CARD_SLOTS) : 1)
  const ribbons = RIBBON_TIERS.some((tier) => card.ribbons[tier] > 0)
  const idH = HERO_H + (ribbons ? RIBBON_ROW : 0)
  const [idY, statsY, gridY] = stack([idH, STRIP_H, gridH], HEADER_H, CARD.h - 8 - FOOTER_H)

  // The ID: paper with the trainer's lines on the left and the partner on the right.
  const x = INNER.x
  const y = idY!
  paperBox(ctx, x, y, INNER.w, idH)
  const textW = INNER.w - 104
  text(ctx, m.idLabel, x + 9, y + 14, { color: MUTED })
  text(ctx, fit(card.name ?? m.guest, textW, 'title', 8), x + 9, y + 26, { font: 'title', size: 8 })
  if (card.trainer.handle) text(ctx, fit(`@${card.trainer.handle}`, textW), x + 9, y + 38, { color: BOX_FRAME })
  if (card.trainer.title) text(ctx, fit(`★ ${card.trainer.title}`, textW), x + 9, y + 50, { color: '#b07800' })
  rect(ctx, x + 9, y + 56, textW, 1, '#d8dce8')
  // Medals in a row after their label, gold first.
  const medalsX = x + 9 + text(ctx, m.medals, x + 9, y + 74, { color: MUTED }) + 6
  ;[...MEDALS].reverse().forEach((medal, i) => {
    const mx = medalsX + i * 30
    ctx.drawImage(medalSprite(medal, card.medals[medal] === 0), mx, y + 62)
    text(ctx, `×${card.medals[medal]}`, mx + 12, y + 74)
  })
  // Ribbons in a row under the medals, gold first, once there's one.
  if (ribbons) {
    const ribbonsX = x + 9 + text(ctx, m.ribbons, x + 9, y + 92, { color: MUTED }) + 6
    RIBBON_TIERS.forEach((tier, i) => {
      const rx = ribbonsX + i * 30
      ctx.drawImage(ribbonSprite(tier), rx, y + 79)
      text(ctx, `×${card.ribbons[tier]}`, rx + 13, y + 92)
    })
  }
  const partner = await spritesOf(card.partner)
  const px = x + INNER.w - 52
  rounded(ctx, px - 46, y + 6, 92, HERO_H - 12, '#e8ecf6')
  hero(ctx, partner, card.partner, px, y + HERO_H - 18, { w: 88, h: 62 }, PAPER_PLATFORM)

  const dex = `${card.dex.caught}/${card.dex.total}`
  statStrip(ctx, [[m.shinyTotal, formatNumber(card.shinies)], [m.pokedex, dex], [m.best, card.bestTime > 0 ? formatTime(card.bestTime) : '—']], INNER.x, statsY!, INNER.w)

  sectionTitle(ctx, m.showcase, m.inBox(card.shinies), INNER.x, gridY!, INNER.w)
  if (card.showcase.length > 0) await monGrid(ctx, card.showcase, INNER.x, gridY! + 12, INNER.w)
  else emptyGrid(ctx, INNER.x, gridY! + 12, INNER.w)

  footer(ctx, card.trainer, CARD.h - 8 - FOOTER_H)
  return finish(canvas, ctx, style)
}

/** A card as a PNG blob, for the share sheet, the clipboard or a download. */
export const cardBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png'))
