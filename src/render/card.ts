import { formatTime } from '../engine/math'
import { blitPacked, canvasCache, context2d, createCanvas, ellipse, fromStrings, onCanvasReset, type PixelSprite } from '../engine/pixelart'
import { MEDALS, type Medal } from '../data/achievements'
import type { Look } from '../data/cosmetics'
import type { BackgroundId, FrameId } from '../data/style'
import type { Difficulty } from '../game/difficulty'
import type { RunRanks } from '../game/ranking'
import { RIBBON_TIERS, type RibbonTier } from '../game/ribbons'
import { formatNumber, locale, LOCALES, t } from '../i18n'
import { medalSprite, outlined, PICKUPS, ribbonSprite, SPARKLE } from './art'
import { CARD_BACKGROUNDS, CARD_FRAMES, DEFAULT_CARD_STYLE, ERA1_MARKS, type BallArt, type CardBackground, type CardFrame, type CardStyle } from './cosmetics'
import { titleLogo } from './logo'
import { drawPokemon, fitSprites, hasShiny, loadSkin, loadSpecies, type SpeciesSprites } from './sprites'
import { drawDressed, loadWearables, wearMisses } from './wearables'

/**
 * Share cards: the run's card (results screen) and the Trainer Card (profile,
 * Caixa do PC), drawn like the game: a 270×338 pixel layout (≈4:5: a feed
 * post uncropped on Instagram and X, a story with room for stickers) built
 * from code art, PMD sprites at whole scales and the game's fonts at their
 * native pixel sizes, then blown up ×4 into a 1080×1352 PNG. Text reads
 * `t()` when drawn. `style` takes the equipped frame and background
 * (`render/cosmetics.ts`), the default one otherwise.
 */

export const CARD = { w: 270, h: 338, scale: 4 } as const

/**
 * A Pokémon on a card: its dex number, name and colors, and what it wears:
 * a skin for its species (`skinFor`) and the look whose hats it puts on
 * (`render/wearables.ts`), both as the game shows them.
 */
export type CardMon = { dex: number; name: string; shiny: boolean; skin?: string | null; look?: Look | null }

/** Who made the card: handle, title (and its mark, an Era 1 title's coin or ruby, drawn in the ★'s place) and the game's link. */
export type CardTrainer = { handle: string | null; title: string | null; mark?: BallArt | null; link: string }

export type RunOutcome = 'victory' | 'fainted' | 'endless'

export type RunCardData = {
  /** The form the run ended in. */
  mon: CardMon
  outcome: RunOutcome
  difficulty: Difficulty
  time: number
  level: number
  kills: number
  /** Shinies caught this run. */
  shinies: number
  /** Rift legendaries beaten. */
  legends: number
  /** The run beat the device's best time (a first run never counts). */
  record: boolean
  /** The run's best place on its boards (`boardPlace`), when the API told it in time. */
  board: { period: keyof RunRanks; rank: number } | null
  /** The official Desafio do dia attempt's place, when the API told it. */
  challenge: { rank: number; total: number } | null
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

/* ---------------- Highlights ---------------- */

/** How deep a board place still brags: past it, the card keeps quiet. */
export const BOARD_SHOWN = 100

/**
 * The place worth putting on a run's card: all time first, then the week,
 * then the day, the first within `BOARD_SHOWN`; null when none is.
 */
export const boardPlace = (ranks: Readonly<Partial<RunRanks>>): RunCardData['board'] => {
  for (const period of ['all', 'week', 'day'] as const) {
    const rank = ranks[period]
    if (rank != null && rank <= BOARD_SHOWN) return { period, rank }
  }
  return null
}

export type RunBadge = 'challenge' | 'record' | 'board' | 'shinies' | 'legends'

/** Badges a run's card has room for, side by side. */
export const BADGES_SHOWN = 3

type BadgeFacts = Pick<RunCardData, 'challenge' | 'record' | 'board' | 'shinies' | 'legends'>

/**
 * A run's highlights, most telling first (the challenge's place, a new
 * record, a board place, shinies, legendaries), `BADGES_SHOWN` at most.
 */
export const runBadges = (card: BadgeFacts): RunBadge[] => {
  const all: Array<RunBadge | false> = [card.challenge !== null && 'challenge', card.record && 'record', card.board !== null && 'board', card.shinies > 0 && 'shinies', card.legends > 0 && 'legends']
  return all.filter((b): b is RunBadge => b !== false).slice(0, BADGES_SHOWN)
}

/** What a badge says. */
const badgeLabel = (badge: RunBadge, card: BadgeFacts) => {
  const m = t().share.card
  if (badge === 'challenge') return card.challenge ? m.challengeBadge(card.challenge.rank, card.challenge.total) : ''
  if (badge === 'record') return m.record
  if (badge === 'board') return card.board ? `#${card.board.rank} ${t().ranking.place[card.board.period]}` : ''
  return badge === 'shinies' ? m.shinyCount(card.shinies) : m.legendCount(card.legends)
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
/** The outcome's ribbon: its face and the folds behind its ends. */
const OUTCOME_COLORS = {
  victory: { face: '#3878e8', fold: '#2050a8' },
  fainted: { face: '#d04848', fold: '#902830' },
  endless: { face: '#7048d8', fold: '#4a2c98' },
} as const satisfies Record<RunOutcome, { face: string; fold: string }>

/* ---------------- Text ---------------- */

type Font = 'title' | 'body'

/** Cubic 11 draws the Chinese text the Latin pixel fonts have no glyphs for (see `ui/style.css`). */
const FAMILY = { title: '"Jersey 10", VT323, "Cubic 11"', body: '"Jersey 15", VT323, "Cubic 11"' } as const satisfies Record<Font, string>

/**
 * The card's type styles. A pixel font only comes out with even strokes at
 * the sizes where its pixels land on whole (or half) card pixels: Jersey 15
 * at 18 px (27 at a pixel and a half), Jersey 10 at 18⅔ px (28), and Cubic 11
 * (any text with Chinese in it) at 12 and 24 px.
 */
const FACES = {
  /** Small text: labels, names, the footer. */
  label: { font: 'body', em: 18, cjk: 12 },
  /** Headings: the outcome, a cell's "+N". */
  title: { font: 'title', em: 56 / 3, cjk: 12 },
  /** The Pokémon's name. */
  display: { font: 'title', em: 28, cjk: 24 },
  /** The big numbers. */
  number: { font: 'body', em: 27, cjk: 24 },
} as const satisfies Record<string, { font: Font; em: number; cjk: number }>

type Face = keyof typeof FACES

const HAN = /[⺀-鿿豈-﫿＀-￯]/

const emOf = (text: string, face: Face) => (HAN.test(text) ? FACES[face].cjk : FACES[face].em)

/** Waits for the game fonts: a card drawn before them would fall back to a smooth system font. A line of the current language as the sample loads Cubic 11 only when the card is in Chinese. */
const fontsReady = () => Promise.all([document.fonts.load(`28px ${FAMILY.title}`, t().loading), document.fonts.load(`18px ${FAMILY.body}`, t().loading)])

type Mask = { canvas: HTMLCanvasElement; width: number; baseline: number }

const masks = canvasCache<string, Mask>('lobby')

/** Text in white with every pixel fully on or off, so it reads like the rest of the pixel art. */
const textMask = (text: string, face: Face): Mask => {
  const key = `${face}|${text}`
  const cached = masks.get(key)
  if (cached) return cached
  const em = emOf(text, face)
  const font = `${em}px ${FAMILY[FACES[face].font]}`
  const probe = context2d(createCanvas(1, 1))
  probe.font = font
  const width = Math.ceil(probe.measureText(text).width)
  const baseline = Math.round(em * 1.5)
  const canvas = createCanvas(width + 2, Math.ceil(em * 2))
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  ctx.font = font
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

/** `shadow`: a 1 px drop below; `outline`: a 1 px ring all round with the drop under it, for big text over the sky. */
type TextOpts = { face?: Face; color?: string; shadow?: string; outline?: string; align?: 'left' | 'center' | 'right' }

const textWidth = (text: string, face: Face = 'label') => textMask(text, face).width

/** `text` cut with "…" until it fits `max` px. */
const fit = (text: string, max: number, face: Face = 'label') => {
  if (textWidth(text, face) <= max) return text
  let cut = text
  while (cut.length > 1 && textWidth(`${cut}…`, face) > max) cut = cut.slice(0, -1)
  return `${cut.trimEnd()}…`
}

/** Draws pixel text with its baseline at `y`. Returns its width. */
const text = (ctx: CanvasRenderingContext2D, value: string, x: number, y: number, opts: TextOpts = {}) => {
  const { face = 'label', color = INK, shadow, outline, align = 'left' } = opts
  const mask = textMask(value, face)
  // The mask has a 1 px margin on the left.
  const left = (align === 'center' ? x - Math.floor(mask.width / 2) : align === 'right' ? x - mask.width : x) - 1
  const top = y - mask.baseline
  if (outline) {
    const ring = recolor(mask.canvas, outline)
    for (let dy = -1; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) if (dx !== 0 || dy !== 0) ctx.drawImage(ring, left + dx, top + dy)
  } else if (shadow) ctx.drawImage(recolor(mask.canvas, shadow), left + 1, top + 1)
  ctx.drawImage(recolor(mask.canvas, color), left, top)
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
  rect(ctx, x + 3, y + h - 14, w - 6, 11, '#f4f0e0')
}

const CHIP_H = 15

/** A label chip (the difficulty). Returns its width. */
const chip = (ctx: CanvasRenderingContext2D, label: string, x: number, y: number, bg: string, color = '#ffffff') => {
  const w = textWidth(label) + 10
  rounded(ctx, x, y + 1, w, CHIP_H, SHADOW)
  rounded(ctx, x, y, w, CHIP_H, bg)
  rect(ctx, x + 1, y, w - 2, 1, 'rgba(255,255,255,0.35)')
  text(ctx, label, x + 5, y + 12, { color })
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
  'lobby',
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
 * halves with a dark line across each side, like a Poké Ball. `band` widens
 * the main band, `inner` adds lines inside, and `studs` set rivets along the
 * band every 12 px. The crest isn't drawn here: the header seats it
 * (`header`), a swatch on its top edge (`styleThumb`).
 */
const drawFrame = (ctx: CanvasRenderingContext2D, f: CardFrame, { w, h }: Size = CARD) => {
  const ring = (i: number, color: string) => {
    rect(ctx, i, i, w - i * 2, 1, color)
    rect(ctx, i, h - 1 - i, w - i * 2, 1, color)
    rect(ctx, i, i, 1, h - i * 2, color)
    rect(ctx, w - 1 - i, i, 1, h - i * 2, color)
  }
  const band = f.band ?? 2
  ;[f.edge, f.light, ...Array<string>(band).fill(f.main), f.edge, f.shade, ...(f.inner ?? [])].forEach((color, i) => ring(i, color))
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
  if (f.studs) {
    // A plus of 5 px in the band's middle line.
    const mid = 2 + Math.floor(band / 2)
    const stud = (x: number, y: number) => {
      rect(ctx, x - 1, y, 3, 1, f.studs!)
      rect(ctx, x, y - 1, 1, 3, f.studs!)
    }
    for (let x = 18; x <= w - 18; x += 12) (stud(x, mid), stud(x, h - 1 - mid))
    for (let y = 18; y <= h - 18; y += 12) (stud(mid, y), stud(w - 1 - mid, y))
  }
  if (f.ball) {
    const ballSprite = fromStrings(f.ball[0], f.ball[1])
    const far = ballSprite.width + 1
    for (const [x, y] of [[1, 1], [w - far, 1], [1, h - far], [w - far, h - far]] as const) ctx.drawImage(ballSprite, x, y)
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
  if (frame) {
    const f: CardFrame = CARD_FRAMES[frame]
    drawFrame(ctx, f, { w, h })
    if (f.crest) {
      const crest = fromStrings(f.crest[0], f.crest[1])
      ctx.drawImage(crest, Math.floor((w - crest.width) / 2), 1)
    }
  }
  return canvas
}

/* ---------------- Pieces ---------------- */

/** Sprites of a card Pokémon: its skin's when it wears one, shiny when it is and SpriteCollab has the colors, never a rejection. */
const spritesOf = async (mon: CardMon): Promise<SpeciesSprites | null> => {
  const skinned = mon.skin ? await loadSkin(mon.skin, mon.dex, mon.shiny).catch(() => null) : null
  return skinned ?? loadSpecies(mon.dex, mon.shiny && hasShiny(mon.dex)).catch(() => loadSpecies(mon.dex).catch(() => null))
}

/** Largest whole scale, up to `max`, that keeps the body inside `maxW`×`maxH`. */
const heroScale = (s: SpeciesSprites, maxW: number, maxH: number, max: number) => Math.max(1, Math.min(max, Math.floor(Math.min(maxW / s.bodyW, maxH / s.bodyH))))

/** How long a card waits for the wearables' worker to dress its Pokémon before drawing it bare: tries × ms. */
const DRESS_WAIT = { tries: 25, ms: 120 } as const

/**
 * A card Pokémon's first Idle frame, facing out, dressed in its look's worn
 * items (`drawDressed`). The worker dresses the frame's row on the first ask,
 * so the frame is drawn again until no draw found its row still dressing
 * (`wearMisses`), or the wait runs out and it goes bare.
 */
const drawMon = async (ctx: CanvasRenderingContext2D, s: SpeciesSprites, look: Look | null, x: number, feetY: number, scale: number) => {
  const wears = look && (look.head !== undefined || look.back !== undefined)
  if (!wears || !(await loadWearables().then(() => true, () => false))) return drawPokemon(ctx, s, 'Idle', 0, 0, x, feetY, { scale })
  const layer = createCanvas(ctx.canvas.width, ctx.canvas.height)
  const lctx = context2d(layer)
  for (let i = 0; ; i++) {
    wearMisses()
    lctx.clearRect(0, 0, layer.width, layer.height)
    drawDressed(lctx, s, look, 'Idle', 0, 0, x, feetY, { scale })
    if (wearMisses() === 0 || i >= DRESS_WAIT.tries) break
    await new Promise((resolve) => setTimeout(resolve, DRESS_WAIT.ms))
  }
  ctx.drawImage(layer, 0, 0)
  layer.width = layer.height = 0
}

/** A battle platform: a rim, its face and a lighter ring, like the stages of the games. */
const platform = (ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, colors: { rim: string; face: string; ring: string }) => {
  blitPacked(ctx, ellipse(rx + 1, ry + 1, SHADOW), cx, cy + 4)
  blitPacked(ctx, ellipse(rx, ry, colors.rim), cx, cy + 3)
  blitPacked(ctx, ellipse(rx, ry, colors.face), cx, cy)
  blitPacked(ctx, ellipse(rx - 5, ry - 2, colors.ring), cx, cy)
  blitPacked(ctx, ellipse(rx - 7, ry - 3, colors.face), cx, cy + 1)
}

const NIGHT_PLATFORM = { rim: '#1c2648', face: '#3a5288', ring: '#5070b0' }
const PAPER_PLATFORM = { rim: '#a8b0c8', face: '#d8dcea', ring: '#eceef6' }

/** A spotlight behind the run card's Pokémon: rings of light over the sky, whatever the sky. */
const halo = (ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) => {
  blitPacked(ctx, ellipse(r, r, 'rgba(255,255,255,0.05)'), cx, cy)
  blitPacked(ctx, ellipse(r - 14, r - 14, 'rgba(255,255,255,0.05)'), cx, cy)
  blitPacked(ctx, ellipse(r - 28, r - 28, 'rgba(255,255,255,0.06)'), cx, cy)
}

type HeroBox = { w: number; h: number; max: number }

/** The big Pokémon of a card standing on its platform, with sparkles around a shiny. Returns the top of its body. */
const hero = async (ctx: CanvasRenderingContext2D, s: SpeciesSprites | null, mon: CardMon, cx: number, feetY: number, box: HeroBox, colors = NIGHT_PLATFORM) => {
  platform(ctx, cx, feetY + 2, Math.round(box.w / 2) - 6, 8, colors)
  if (!s) {
    blit(ctx, PICKUPS.pokeball(), cx, feetY - 8)
    return feetY - 16
  }
  // A body wider than the box at 1:1 (a legend's) is shrunk to it, the pixel-art way.
  const body = s.bodyW > box.w - 12 ? fitSprites(s, box.w - 12) : s
  const k = heroScale(body, box.w - 12, box.h, box.max)
  await drawMon(ctx, body, mon.look ?? null, cx, feetY, k)
  const top = feetY - body.bodyH * k
  if (!mon.shiny) return top
  const half = (body.bodyW * k) / 2
  const marks = [
    [cx - half - 8, top + 4, 2],
    [cx + half + 6, top - 2, 2],
    [cx + half + 10, top + (body.bodyH * k) / 2, 1],
    [cx - half - 12, feetY - 14, 1],
    [cx + 4, top - 8, 0],
    [cx - half + 2, top - 6, 0],
  ] as const
  for (const [x, y, size] of marks) blit(ctx, sparkles()[size]!, x, y)
  return top
}

/** A cell of the grid: the Pokémon's first Idle frame, its name and a sparkle for a shiny. */
const monCell = (ctx: CanvasRenderingContext2D, s: SpeciesSprites | null, mon: CardMon, x: number, y: number, w: number, h: number) => {
  pcCell(ctx, x, y, w, h)
  clipped(ctx, x + 3, y + 3, w - 6, h - 17, () => {
    if (s) drawPokemon(ctx, s, 'Idle', 0, 0, x + w / 2, y + h - 16)
    else blit(ctx, PICKUPS.pokeball(), x + w / 2, y + (h - 14) / 2)
  })
  text(ctx, fit(mon.name, w - 8), x + w / 2, y + h - 5, { align: 'center' })
  if (mon.shiny) blit(ctx, outlinedSparkles()[1]!, x + w - 8, y + 8)
}

/** The "+N" cell closing a grid that doesn't fit. */
const moreCell = (ctx: CanvasRenderingContext2D, more: number, x: number, y: number, w: number, h: number) => {
  pcCell(ctx, x, y, w, h)
  text(ctx, `+${more}`, x + w / 2, y + h / 2 + 3, { face: 'title', color: '#c08010', align: 'center' })
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

/** One wide Caixa do PC cell with faint Poké Balls, for a Trainer Card with no shiny yet. */
const emptyGrid = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number) => {
  pcCell(ctx, x, y, w, GRID.cellH)
  ctx.globalAlpha = 0.25
  for (let i = 0; i < GRID.cols; i++) blit(ctx, PICKUPS.pokeball(), x + Math.round((w * (i + 0.5)) / GRID.cols), y + GRID.cellH / 2 - 5)
  ctx.globalAlpha = 1
  text(ctx, fit(t().share.card.noShinies, w - 12), x + w / 2, y + GRID.cellH - 5, { align: 'center', color: MUTED })
}

const STRIP_H = 46

/** Faces a stat's number may take, biggest first: a long one ("217/568") steps down until it fits its column. */
const STAT_FACES = ['number', 'title', 'label'] as const satisfies readonly Face[]

/** A paper strip of stats: small label, big number. */
const statStrip = (ctx: CanvasRenderingContext2D, stats: ReadonlyArray<readonly [string, string]>, x: number, y: number, w: number) => {
  paperBox(ctx, x, y, w, STRIP_H)
  const col = Math.floor((w - 8) / stats.length)
  stats.forEach(([label, value], i) => {
    const cx = x + 4 + col * i + Math.floor(col / 2)
    if (i > 0) rect(ctx, x + 4 + col * i, y + 8, 1, STRIP_H - 16, '#d8dce8')
    text(ctx, fit(label, col - 6), cx, y + 15, { align: 'center', color: MUTED })
    const face = STAT_FACES.find((f) => textWidth(value, f) <= col - 6) ?? 'label'
    text(ctx, value, cx, y + 38, { face, align: 'center' })
  })
}

/** A section title in gold, with an optional note on the right. */
const sectionTitle = (ctx: CanvasRenderingContext2D, title: string, note: string | null, x: number, y: number, w: number) => {
  text(ctx, title, x + 1, y + 10, { face: 'title', color: GOLD_LIGHT, shadow: SHADOW })
  if (note) text(ctx, note, x + w - 1, y + 10, { align: 'right', color: '#c8d0f0', shadow: SHADOW })
}

const FOOTER_H = 28

/** The footer: who shares it (handle and title, with its mark) and the link that brings friends in. */
const footer = (ctx: CanvasRenderingContext2D, trainer: CardTrainer, y: number) => {
  const { w } = CARD
  const m = t().share.card
  rect(ctx, 14, y, w - 28, 1, 'rgba(200,210,255,0.25)')
  const mark = trainer.title && trainer.mark ? fromStrings(trainer.mark[0], trainer.mark[1]) : null
  const title = trainer.title && (mark ? trainer.title : `★ ${trainer.title}`)
  const who = [trainer.handle && `@${trainer.handle}`, title].filter((s): s is string => Boolean(s)).join(' · ')
  const line = fit(who || m.play, w - 28 - (mark ? mark.width + 4 : 0))
  const lineW = textWidth(line) + (mark ? mark.width + 4 : 0)
  const left = Math.round((w - lineW) / 2)
  if (mark) ctx.drawImage(mark, left, y + 14 - mark.height)
  text(ctx, line, left + (mark ? mark.width + 4 : 0), y + 14, { color: '#e8ecff', shadow: SHADOW })
  const link = textWidth(trainer.link) <= w - 28 ? trainer.link : trainer.link.replace(/\?.*$/, '')
  text(ctx, link, w / 2, y + 27, { align: 'center', color: GOLD_LIGHT, shadow: SHADOW })
}

/**
 * The logo (top left), what `right` draws right-aligned at `x` (returning its
 * width), and between them the frame's crest when it has one and they leave
 * it room.
 */
const header = async (ctx: CanvasRenderingContext2D, frame: CardFrame, right: (x: number) => number) => {
  const logo = await titleLogo()
  ctx.drawImage(logo, 10, 9)
  const rightW = right(CARD.w - 11)
  if (!frame.crest) return
  const crest = fromStrings(frame.crest[0], frame.crest[1])
  const from = 10 + logo.width
  const to = CARD.w - 11 - rightW
  if (to - from < crest.width + 6) return
  ctx.drawImage(crest, Math.round((from + to - crest.width) / 2), 9 + Math.round((logo.height - crest.height) / 2))
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

const RIBBON_H = 18

/** The outcome on a ribbon across the card, its ends folded behind it with a notch. */
const ribbon = (ctx: CanvasRenderingContext2D, label: string, cx: number, y: number, colors: { face: string; fold: string }) => {
  const w = textWidth(label, 'title') + 28
  const x = Math.round(cx - w / 2)
  // The folded ends: 10 px out each side, a V cut into their outer edge.
  for (let i = 0; i < RIBBON_H; i++) {
    const notch = Math.max(0, 4 - Math.round(Math.abs(i - (RIBBON_H - 1) / 2)))
    rect(ctx, x - 9 + notch, y + 3 + i, 13 - notch, 1, colors.fold)
    rect(ctx, x + w - 4, y + 3 + i, 13 - notch, 1, colors.fold)
  }
  rect(ctx, x - 9, y + 3 + RIBBON_H, 13, 1, SHADOW)
  rect(ctx, x + w - 4, y + 3 + RIBBON_H, 13, 1, SHADOW)
  rect(ctx, x, y + 1, w, RIBBON_H, SHADOW)
  rect(ctx, x, y, w, RIBBON_H, colors.face)
  rect(ctx, x, y, w, 1, 'rgba(255,255,255,0.35)')
  rect(ctx, x, y + RIBBON_H - 1, w, 1, colors.fold)
  text(ctx, label, cx, y + 14, { face: 'title', color: '#ffffff', shadow: colors.fold, align: 'center' })
}

const BADGE_H = 18

/** A badge's icon: the challenge's ribbon, a record's gold medal, the board's crown, a sparkle, a Poké Ball. */
const badgeIcon = (kind: RunBadge): PixelSprite => {
  if (kind === 'challenge') return ribbonSprite('gold')
  if (kind === 'record') return medalSprite('gold')
  if (kind === 'board') return fromStrings(ERA1_MARKS.champion[0], ERA1_MARKS.champion[1])
  if (kind === 'shinies') return sparkles()[1]!
  return PICKUPS.pokeball()
}

/** The run's highlights in gold-edged badges, centered in a row (one that doesn't fit is left out). */
const badgeRow = (ctx: CanvasRenderingContext2D, card: BadgeFacts, cx: number, y: number, maxW: number) => {
  const GAP = 6
  const items = runBadges(card).map((b) => ({ icon: badgeIcon(b), label: badgeLabel(b, card) }))
  const widthOf = (b: (typeof items)[number]) => b.icon.width + textWidth(b.label) + 14
  // Most telling first, each one that still fits.
  const shown: typeof items = []
  let used = -GAP
  for (const b of items) if (used + GAP + widthOf(b) <= maxW) (shown.push(b), (used += GAP + widthOf(b)))
  if (shown.length === 0 && items[0]) shown.push(items[0])
  const total = shown.reduce((sum, b) => sum + widthOf(b), 0) + GAP * (shown.length - 1)
  let x = Math.round(cx - Math.min(total, maxW) / 2)
  for (const b of shown) {
    const label = fit(b.label, maxW - b.icon.width - 14)
    const w = Math.min(widthOf(b), maxW)
    rounded(ctx, x, y + 1, w, BADGE_H, SHADOW)
    rounded(ctx, x, y, w, BADGE_H, GOLD)
    rounded(ctx, x + 1, y + 1, w - 2, BADGE_H - 2, '#1c2244')
    ctx.drawImage(b.icon, x + 5, y + Math.round((BADGE_H - b.icon.height) / 2))
    text(ctx, label, x + 9 + b.icon.width, y + 13, { color: '#fff4c8' })
    x += w + GAP
  }
}

/**
 * The run's card: the Pokémon big on its platform in a spotlight, its name
 * and the outcome on a ribbon, the time, level and KOs, and up to three
 * highlights (`runBadges`); the difficulty in the header.
 */
export const drawRunCard = async (card: RunCardData, style: CardStyle = DEFAULT_CARD_STYLE) => {
  await fontsReady()
  const m = t().share.card
  const { canvas, ctx } = blank(style)
  await header(ctx, CARD_FRAMES[style.frame], (x) => {
    const label = t().difficulty.names[card.difficulty]
    const w = textWidth(label) + 10
    chip(ctx, label, x - w, 13, DIFFICULTY_COLORS[card.difficulty])
    return w
  })
  const badges = runBadges(card)
  const cx = CARD.w / 2
  // Without badges the space they'd take goes to the Pokémon.
  const feetY = badges.length > 0 ? 158 : 178
  const box: HeroBox = { w: 172, h: feetY - HEADER_H - 6, max: 5 }

  const sprites = await spritesOf(card.mon)
  const bodyH = sprites ? Math.min(box.h, sprites.bodyH * heroScale(sprites, box.w - 12, box.h, box.max)) : 16
  halo(ctx, cx, Math.round(feetY - bodyH / 2), 64)
  await hero(ctx, sprites, card.mon, cx, feetY, box)

  const nameY = feetY + 33
  // A long name ("Mega Charizard X") steps down a size before it's cut.
  const nameFace: Face = textWidth(card.mon.name, 'display') <= INNER.w - 40 ? 'display' : 'title'
  const name = fit(card.mon.name, INNER.w - 40, nameFace)
  const nameW = text(ctx, name, cx, nameY, { face: nameFace, color: card.mon.shiny ? GOLD_LIGHT : '#ffffff', outline: SHADOW, align: 'center' })
  if (card.mon.shiny) {
    blit(ctx, sparkles()[2]!, cx - nameW / 2 - 10, nameY - 9)
    blit(ctx, sparkles()[2]!, cx + nameW / 2 + 9, nameY - 9)
  }
  const ribbonY = nameY + 6
  ribbon(ctx, m.outcomes[card.outcome], cx, ribbonY, OUTCOME_COLORS[card.outcome])

  const statsY = ribbonY + RIBBON_H + 10
  statStrip(ctx, [[m.time, formatTime(card.time)], [m.level, String(card.level)], [m.kills, formatNumber(card.kills)]], INNER.x, statsY, INNER.w)
  if (badges.length > 0) badgeRow(ctx, card, cx, statsY + STRIP_H + 7, INNER.w)

  footer(ctx, card.trainer, CARD.h - 11 - FOOTER_H)
  return finish(canvas, ctx, style)
}

/* ---------------- The Trainer Card ---------------- */

const HERO_H = 90

/** The Trainer Card's ribbon row, under the medals. */
const RIBBON_ROW = 18

/** The Trainer Card: name, handle, title and medals beside the partner, the collection in numbers and up to six shinies. */
export const drawTrainerCard = async (card: TrainerCardData, style: CardStyle = DEFAULT_CARD_STYLE) => {
  await fontsReady()
  const m = t().share.card
  const { canvas, ctx } = blank(style)
  await header(ctx, CARD_FRAMES[style.frame], (x) => {
    const date = cardDate(card.date)
    text(ctx, date, x, 20, { align: 'right', color: '#a8b4e0', shadow: SHADOW })
    m.trainerCard.forEach((line, i) => text(ctx, line, x, 32 + i * 12, { face: 'title', align: 'right', color: GOLD_LIGHT, shadow: SHADOW }))
    return Math.max(textWidth(date), ...m.trainerCard.map((line) => textWidth(line, 'title')))
  })
  const gridH = 13 + gridHeight(card.showcase.length > 0 ? Math.min(card.showcase.length, CARD_SLOTS) : 1)
  const ribbons = RIBBON_TIERS.some((tier) => card.ribbons[tier] > 0)
  const idH = HERO_H + (ribbons ? RIBBON_ROW : 0)
  const [idY, statsY, gridY] = stack([idH, STRIP_H, gridH], HEADER_H, CARD.h - 11 - FOOTER_H)

  // The ID: paper with the trainer's lines on the left and the partner on the right.
  const x = INNER.x
  const y = idY!
  paperBox(ctx, x, y, INNER.w, idH)
  const textW = INNER.w - 104
  text(ctx, m.idLabel, x + 9, y + 14, { color: MUTED })
  text(ctx, fit(card.name ?? m.guest, textW, 'title'), x + 9, y + 28, { face: 'title' })
  if (card.trainer.handle) text(ctx, fit(`@${card.trainer.handle}`, textW), x + 9, y + 40, { color: BOX_FRAME })
  if (card.trainer.title) {
    const mark = card.trainer.mark ? fromStrings(card.trainer.mark[0], card.trainer.mark[1]) : null
    if (mark) ctx.drawImage(mark, x + 9, y + 52 - mark.height + 1)
    const tx = mark ? x + 9 + mark.width + 4 : x + 9
    text(ctx, fit(mark ? card.trainer.title : `★ ${card.trainer.title}`, textW - (tx - x - 9)), tx, y + 52, { color: '#b07800' })
  }
  rect(ctx, x + 9, y + 57, textW, 1, '#d8dce8')
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
  await hero(ctx, partner, card.partner, px, y + HERO_H - 18, { w: 88, h: 62, max: 4 }, PAPER_PLATFORM)

  const dex = `${card.dex.caught}/${card.dex.total}`
  statStrip(ctx, [[m.shinyTotal, formatNumber(card.shinies)], [m.pokedex, dex], [m.best, card.bestTime > 0 ? formatTime(card.bestTime) : '—']], INNER.x, statsY!, INNER.w)

  sectionTitle(ctx, m.showcase, m.inBox(card.shinies), INNER.x, gridY!, INNER.w)
  if (card.showcase.length > 0) await monGrid(ctx, card.showcase, INNER.x, gridY! + 13, INNER.w)
  else emptyGrid(ctx, INNER.x, gridY! + 13, INNER.w)

  footer(ctx, card.trainer, CARD.h - 11 - FOOTER_H)
  return finish(canvas, ctx, style)
}

/** A card as a PNG blob, for the share sheet, the clipboard or a download. */
export const cardBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png'))
