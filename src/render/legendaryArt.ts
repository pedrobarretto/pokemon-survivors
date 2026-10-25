import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'
import type { LegendaryMoveId } from '../game/legendaryMoves'

/**
 * Pixel art of the legendary moves (`render/legendaryFx.ts` draws them,
 * `art.ts` lists the icons): string sprites and a few shapes painted in code
 * on the same grid. Built lazily (the DOM canvas only exists at render time).
 * `art.ts` imports this file, so it keeps its own outline helper.
 */

/** A 1px outline around the opaque pixels, like `outlined` in `art.ts`. */
const outlined = (s: PixelSprite, color = '#181818'): PixelSprite => {
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

type Px = (x: number, y: number, color: string, w?: number, h?: number) => void

/** A canvas painted with `fn(px)`, where `px(x, y, color, w, h)` fills whole pixels. */
const paint = (w: number, h: number, fn: (px: Px) => void) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  fn((x, y, color, pw = 1, ph = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, pw, ph)
  })
  return canvas
}

/* ---------------- Sprites ---------------- */

/** Phoenix flying right, wings up (frame 0) or down (frame 1): 1 deep red, 2 orange, 3 gold, 4 white-hot, 5 green, 6 teal. */
const PHOENIX = [
  [
    '............3...........',
    '..........332...........',
    '........33221...........',
    '.......32211............',
    '......3221..............',
    '.....3221.........344...',
    '....32211.......33343...',
    '56..2211.1....3333331...',
    '5662221111223334444322..',
    '.56622211223334444443221',
    '..5662211122333444321...',
    '...566221111122221......',
    '....5662211.............',
    '.....55662..............',
    '.......556..............',
  ],
  [
    '........................',
    '..................344...',
    '................33343...',
    '56............3333331...',
    '5662221111223334444322..',
    '.56622211223334444443221',
    '..5662211122333444321...',
    '...56622111112221.......',
    '....5662211.2211........',
    '.....556.....3221.......',
    '.......5......3221......',
    '...............3221.....',
    '................332.....',
    '..................3.....',
    '........................',
  ],
] as const
const PHOENIX_PAL = { 1: '#a01810', 2: '#f06018', 3: '#f8c030', 4: '#fff8d0', 5: '#40a048', 6: '#38b8c8' }

/** A sacred flame lick: 1 red rim, 2 orange, 3 gold, 4 white-hot. */
const FLAME = [
  '....1....',
  '...121...',
  '...1221..',
  '..12321..',
  '..123321.',
  '.1233321.',
  '.1234321.',
  '12344321.',
  '12344321.',
  '.123421..',
  '..1111...',
]

/** Ancient stone: 1 dark, 2 stone, 3 light, 4 a glint of Mew's pink. */
const ROCK = ['...1111...', '..122331..', '.12223331.', '1222233331', '1222223341', '1122222331', '.11222221.', '..111111..']
/** Magical leaf pointing right: 1 rim, 2 green, 3 light vein, 4 glow tip. */
const LEAF = ['..1111...', '.122221..', '123333324', '.122221..', '..1111...']
/** Wishing star: 1 rim, 2 gold, 3 light, 4 white. */
const STAR = ['....1....', '...121...', '...131...', '111232111', '.1234321.', '..12321..', '..12121..', '.121.121.', '.11...11.']
/** Psychic comet: 1 rim, 2 orange, 3 light, 4 white core. */
const COMET = ['.111.', '12321', '13431', '12321', '.111.']

export const LEGEND_FX = {
  phoenix: lazy(() => PHOENIX.map((rows) => sprite(rows, PHOENIX_PAL, '#300808'))),
  /** Three tints of the sacred flame (Ho-Oh's rainbow): fire, gold and a rainbow-green tip. */
  flame: lazy(() => [
    sprite(FLAME, { 1: '#b01808', 2: '#f05818', 3: '#f8b830', 4: '#fff8d0' }),
    sprite(FLAME, { 1: '#d05010', 2: '#f8a020', 3: '#f8e060', 4: '#ffffff' }),
    sprite(FLAME, { 1: '#2c9048', 2: '#f05818', 3: '#f8d030', 4: '#fff8d0' }),
  ]),
  rock: lazy(() => [
    sprite(ROCK, { 1: '#4a3828', 2: '#8a7058', 3: '#c8b090', 4: '#f8a8d8' }, '#201008'),
    sprite(ROCK.map((r) => r.split('').reverse().join('')), { 1: '#504030', 2: '#988068', 3: '#d8c0a0', 4: '#f8a8d8' }, '#201008'),
  ]),
  leaf: lazy(() => [
    sprite(LEAF, { 1: '#206818', 2: '#58c040', 3: '#c8f890', 4: '#ffffff' }, '#103008'),
    sprite(LEAF, { 1: '#307820', 2: '#88d850', 3: '#f8f8b0', 4: '#f8b8e8' }, '#103008'),
  ]),
  star: lazy(() => sprite(STAR, { 1: '#a07008', 2: '#f8d030', 3: '#f8f088', 4: '#ffffff' }, '#402808')),
  comet: lazy(() => sprite(COMET, { 1: '#a83810', 2: '#f87830', 3: '#f8c070', 4: '#ffffff' })),
  /** Deoxys's core: a purple gem in an orange shell. */
  core: lazy(() =>
    outlined(paint(9, 11, (px) => {
      px(3, 0, '#c84818', 3, 1)
      px(2, 1, '#f87830', 5, 1)
      px(1, 2, '#f87830', 7, 7)
      px(2, 9, '#f87830', 5, 1)
      px(3, 10, '#c84818', 3, 1)
      px(3, 3, '#702890', 3, 5)
      px(2, 4, '#702890', 5, 3)
      px(3, 4, '#b050d8', 3, 2)
      px(4, 4, '#f0c8ff')
      px(1, 2, '#f8c070', 1, 3)
    }), '#300818'),
  ),
  /** The time-stop clock above a frozen foe: a tiny face with one hand. */
  tinyClock: lazy(() =>
    outlined(paint(7, 7, (px) => {
      px(2, 0, '#a8f0f8', 3, 1)
      px(1, 1, '#a8f0f8', 5, 5)
      px(0, 2, '#a8f0f8', 7, 3)
      px(2, 6, '#a8f0f8', 3, 1)
      px(2, 1, '#ffffff', 3, 5)
      px(1, 2, '#ffffff', 5, 3)
      px(3, 1, '#384890', 1, 3)
      px(3, 3, '#384890', 2, 1)
    }), '#182048'),
  ),
}

/* ---------------- Icons (HUD, level-up, Pokédex) ---------------- */

/** The emblem sits on a dark disc inside a gold rim: legendary moves read apart at a glance. */
const ICON = 17
export const medallion = (emblem: PixelSprite, disc = '#28203c') => {
  const canvas = createCanvas(ICON, ICON)
  const ctx = context2d(canvas)
  const c = (ICON - 1) / 2
  for (let y = 0; y < ICON; y++) for (let x = 0; x < ICON; x++) {
    const d = Math.hypot(x - c, y - c)
    if (d > 8.5) continue
    // Light from the top left: the rim catches it there and falls into shade at the bottom right.
    const lit = x + y < ICON - 4
    ctx.fillStyle = d > 7.6 ? '#4a3008' : d > 6.4 ? (lit ? (x + y < 8 ? '#fff4b0' : '#f8d030') : '#c08818') : disc
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.drawImage(emblem, Math.floor((ICON - emblem.width) / 2), Math.floor((ICON - emblem.height) / 2))
  return canvas
}

const TORNADO = ['11111111', '.122221.', '..1221..', '.12221..', '..1221..', '...121..', '..121...', '...1....']

export const LEGENDARY_ICONS: Record<LegendaryMoveId, () => PixelSprite> = {
  whirlwind: () => medallion(sprite(TORNADO, { 1: '#7890c8', 2: '#ffffff' }), '#202848'),
  sacredFire: () => medallion(LEGEND_FX.flame()[0]!, '#381008'),
  originPulse: () =>
    medallion(paint(11, 11, (px) => {
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const d = Math.hypot(x - 5, y - 5)
        if (d <= 5.5 && d > 4.3) px(x, y, '#3878e0')
        else if (d <= 4.3 && d > 3.3) px(x, y, '#a8e8f8')
      }
      px(5, 1, '#ffffff', 1, 3)
      px(5, 7, '#ffffff', 1, 3)
      px(1, 5, '#ffffff', 3, 1)
      px(7, 5, '#ffffff', 3, 1)
      px(4, 4, '#78d8f8', 3, 3)
      px(5, 5, '#ffffff')
    }), '#081838'),
  scorchingSands: () =>
    medallion(paint(11, 11, (px) => {
      px(6, 0, '#f8d030', 3, 3)
      px(7, 1, '#fff4b0')
      for (let x = 0; x < 11; x++) {
        const top = 6 + Math.round(Math.sin(x * 0.7) * 1.5)
        px(x, top, '#f8d890')
        px(x, top + 1, '#e0a050', 1, 2)
        px(x, top + 3, '#c04818', 1, 11 - top - 3)
      }
    }), '#301008'),
  dragonAscent: () =>
    medallion(paint(12, 12, (px) => {
      for (let i = 0; i < 9; i++) px(i, 11 - i, i % 3 === 1 ? '#f8d830' : '#309050', 2, 2)
      px(8, 1, '#58c070', 3, 3)
      px(9, 2, '#ffffff')
      px(10, 0, '#f8f8a0')
    }), '#082010'),
  roarOfTime: () =>
    medallion(paint(11, 11, (px) => {
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const d = Math.hypot(x - 5, y - 5)
        if (d <= 5.5 && d > 4.4) px(x, y, '#a8f0f8')
        else if (d <= 4.4) px(x, y, '#e8f8ff')
      }
      px(5, 1, '#4868a8')
      px(5, 9, '#4868a8')
      px(1, 5, '#4868a8')
      px(9, 5, '#4868a8')
      px(5, 2, '#202848', 1, 4)
      px(5, 5, '#202848', 3, 1)
      px(5, 5, '#78a0f8')
    }), '#101838'),
  mistBall: () =>
    medallion(paint(11, 11, (px) => {
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const d = Math.hypot(x - 5, y - 5)
        if (d <= 5) px(x, y, d > 4 ? '#f8c8d8' : '#ffffff')
      }
      for (let i = 0; i < 8; i++) {
        const a = i * 0.7
        px(Math.round(5 + Math.cos(a) * (1 + i * 0.4)), Math.round(5 + Math.sin(a) * (1 + i * 0.4)), '#e04050')
      }
      px(3, 2, '#ffffff', 2, 1)
    }), '#381828'),
  lusterPurge: () =>
    medallion(paint(12, 12, (px) => {
      for (let i = 0; i < 11; i++) {
        px(i, 11 - i - 1, '#3050c0', 2, 2)
        px(i, 11 - i, '#80b0f8')
      }
      for (let i = 1; i < 10; i++) px(i, 10 - i, '#ffffff')
      px(0, 9, '#ffffff', 3, 3)
    }), '#101838'),
  psychoBoost: () =>
    medallion(paint(12, 12, (px) => {
      for (let i = 0; i < 12; i++) {
        px(i, Math.round(6 + Math.sin(i * 0.9) * 3), '#f87830')
        px(i, Math.round(6 - Math.sin(i * 0.9) * 3), '#38b8a8')
      }
      px(4, 4, '#b050d8', 4, 4)
      px(5, 5, '#f0c8ff', 2, 2)
    }), '#200c28'),
  wish: () => medallion(LEGEND_FX.star(), '#182040'),
  ancientPower: () => medallion(LEGEND_FX.rock()[0]!, '#381830'),
  magicalLeaf: () => medallion(LEGEND_FX.leaf()[1]!, '#102810'),
  darkVoid: () =>
    medallion(paint(11, 11, (px) => {
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const d = Math.hypot(x - 5, y - 5)
        if (d <= 5.5 && d > 4.4) px(x, y, x + y < 9 ? '#8868d0' : '#5838a0')
        else if (d <= 4.4 && d > 3.4) px(x, y, '#c83858')
        else if (d <= 3.4) px(x, y, '#08040e')
      }
      px(4, 4, '#58e8f0', 2, 1)
      px(5, 3, '#ffffff')
    }), '#100818'),
  lunarBlessing: () =>
    medallion(paint(11, 11, (px) => {
      // A crescent moon, its horns to the right, in Cresselia's gold and pink.
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const d = Math.hypot(x - 5, y - 5)
        if (d > 5.4 || Math.hypot(x - 7.6, y - 4) < 4.4) continue
        px(x, y, d > 4.4 ? '#f0a0d0' : x + y < 9 ? '#fff8d0' : '#f8e078')
      }
      px(9, 8, '#ffffff')
      px(8, 1, '#f0a0d0')
    }), '#281838'),
}
