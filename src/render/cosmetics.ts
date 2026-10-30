import { context2d, createCanvas, fromStrings } from '../engine/pixelart'
import type { BackgroundId, FrameId, WallpaperId } from '../data/style'

/**
 * Looks the player can show off: the frame and background of the share cards
 * (`render/card.ts`) and the Caixa do PC's wallpaper (`ui/pcBox.ts`). Each is
 * plain data keyed by id, so a new one is a new entry here (and a price on
 * the shelf, `data/style.ts`); everything that draws takes the equipped one,
 * or the default.
 */

/** A ball emblem for a frame's corners: 7×7 pixel strings and their palette. */
export type BallArt = readonly [rows: readonly string[], palette: Readonly<Record<string, string>>]

/**
 * A card's border, outside in: `edge` line, `light` line, `main` band (2 px),
 * `shade` line. `accent` dots the corners, unless a `ball` sits there. With
 * `lower`, the band's lower half takes that color and a dark line splits
 * them on the sides, like a Poké Ball's two halves.
 */
export type CardFrame = { edge: string; light: string; main: string; shade: string; accent: string; lower?: string; ball?: BallArt }

/** A ball's rows: 2 the top half, 5 its marks, 3 the bottom half, 4 the button. */
const ball = (top: string, marks: string): BallArt => [
  ['..111..', '.15251.', '1522251', '1114111', '1333331', '.13331.', '..111..'],
  { 1: '#181820', 2: top, 3: '#f0f0f0', 4: '#f8f8f8', 5: marks },
]

/** The Ambassador's heart, for its corners (same palette keys as a ball: 1 outline, 2 the heart, 4 its shine). */
const HEART: BallArt = [
  ['.11.11.', '1421221', '1222221', '1222221', '.12221.', '..121..', '...1...'],
  { 1: '#301018', 2: '#f05888', 4: '#ffffff' },
]

/** The Supporter's star, for its corners (same palette keys as a ball: 1 outline, 2 the star, 4 its shine). */
const STAR: BallArt = [
  ['...1...', '..141..', '1112111', '1222221', '.12221.', '.12121.', '.11.11.'],
  { 1: '#4a3008', 2: '#f8d030', 4: '#fff8c8' },
]

/** The Noite das Bruxas jack-o'-lantern, for its corners (1 outline, 2 the pumpkin, 3 the stem, 5 the glow inside). */
const JACK: BallArt = [
  ['...3...', '.11311.', '1222221', '1525251', '1222221', '1255521', '.11111.'],
  { 1: '#401808', 2: '#f08020', 3: '#40a038', 5: '#ffe060' },
]

/** The Caça aos Fantasmas ghost, for its corners: a little Gastly-like wisp (1 outline, 2 the ghost, 4 its eyes, 5 the glow). */
const WISP: BallArt = [
  ['.11111.', '1222221', '1424241', '1222221', '1255521', '1222221', '1.1.1.1'],
  { 1: '#180c28', 2: '#b8a0f0', 4: '#180c28', 5: '#f05870' },
]

/** The loyalty card's stamp, for the Freguês frame's corners (1 outline, 2 the red ink, 4 the paper showing through). */
const STAMP: BallArt = [
  ['.11111.', '1222221', '1244221', '1242421', '1224221', '1222221', '.11111.'],
  { 1: '#581818', 2: '#e04040', 4: '#fff0e0' },
]

/** A gold coin with Kecleon's red zigzag, for the Department Store's frame (1 outline, 2 gold, 3 its shade, 5 the zigzag). */
const KECLEON_COIN: BallArt = [
  ['..111..', '.12221.', '1222221', '1525251', '1252521', '.13331.', '..111..'],
  { 1: '#3a2808', 2: '#f8d030', 3: '#c89028', 5: '#e03838' },
]

/** Meowth's charm coin, for its frame's corners (1 outline, 2 gold, 3 its shade, 4 the shine, 5 the oval). */
const CHARM: BallArt = [
  ['..111..', '.14221.', '1225221', '1252521', '1225221', '.13331.', '..111..'],
  { 1: '#4a3008', 2: '#f8d030', 3: '#c89028', 4: '#fffbe0', 5: '#a06818' },
]

/** A paper lantern, for the Festival das Lanternas frame's corners (1 outline, 2 the paper, 3 its ribs, 4 the flame, 5 the cap). */
const LANTERN: BallArt = [
  ['..151..', '.12221.', '1232321', '1224221', '1232321', '.12221.', '..151..'],
  { 1: '#4a1008', 2: '#f05030', 3: '#a82818', 4: '#fff0a0', 5: '#f8d030' },
]

/** A video's play button, for the Creator frame's corners: a rounded hot-pink tile with a white triangle (1 outline, 2 the tile, 4 the triangle). */
const PLAY: BallArt = [
  ['.11111.', '1222221', '1242221', '1244221', '1242221', '1222221', '.11111.'],
  { 1: '#300818', 2: '#e8306a', 4: '#ffffff' },
]

export const CARD_FRAMES = {
  /** The game's own dialog box: dark line, paper, blue. */
  classic: { edge: '#283040', light: '#f8f8f8', main: '#6878a8', shade: '#101830', accent: '#ffcb05' },
  poke: { edge: '#201818', light: '#f8f8f8', main: '#e03838', shade: '#581818', accent: '#f8f8f8', lower: '#e8e8f0', ball: ball('#e03838', '#e03838') },
  great: { edge: '#101c40', light: '#f8f8f8', main: '#3070e0', shade: '#0c1848', accent: '#e83838', lower: '#e8e8f0', ball: ball('#3070e0', '#e83838') },
  ultra: { edge: '#080808', light: '#f8d030', main: '#303038', shade: '#000000', accent: '#f8d030', lower: '#e8e8f0', ball: ball('#303038', '#f8d030') },
  master: { edge: '#200830', light: '#f8b8f0', main: '#8040c8', shade: '#180428', accent: '#f070c0', lower: '#e8e8f0', ball: ball('#8040c8', '#f070c0') },
  /** A gift for bringing friends: rose and gold, hearts in the corners. */
  ambassador: { edge: '#301018', light: '#f8e098', main: '#e05888', shade: '#581830', accent: '#f8d030', ball: HEART },
  /** A donor's thank-you: emerald and gold, gold stars in the corners. */
  supporter: { edge: '#0c2418', light: '#f8e8a0', main: '#30a070', shade: '#0c3820', accent: '#f8d030', ball: STAR },
  /** The Noite das Bruxas candy jar's first reward: pumpkin orange and witch purple, jack-o'-lanterns in the corners. */
  pumpkin: { edge: '#1c0c24', light: '#ffc040', main: '#f07818', shade: '#4a1c5c', accent: '#a058e0', ball: JACK },
  /** The Noite das Bruxas Caça aos Fantasmas, every night boss beaten: spectral violet and ghost-fire teal, wisps in the corners. */
  spectral: { edge: '#0c0618', light: '#80f0d0', main: '#5a38a0', shade: '#1c0c38', accent: '#58f0b0', ball: WISP },
  /** The Kecleon Shop's loyalty card, 14 stamps: Kecleon green with red stamps in the corners. */
  regular: { edge: '#10280c', light: '#c8f0a0', main: '#48a040', shade: '#183c14', accent: '#e04040', ball: STAMP },
  /** The Kecleon Shop grown to the Department Store: gold leaf, Kecleon's zigzag coins in the corners. */
  kecleon: { edge: '#3a2808', light: '#fff4b0', main: '#d8a020', shade: '#6a4a10', accent: '#e03838', ball: KECLEON_COIN },
  /** Meowth's weekend caravan: cream fur, brown trim and a charm coin in each corner. */
  meowth: { edge: '#2c1c0c', light: '#fff4d8', main: '#e0c890', shade: '#7a5a30', accent: '#f8d030', ball: CHARM },
  /** The Festival das Lanternas' ₽30M milestone: dusk indigo and lantern red, a paper lantern in each corner. */
  lantern: { edge: '#140c28', light: '#ffd890', main: '#d84028', shade: '#2a1848', accent: '#f8d030', ball: LANTERN },
  /** For content creators (`data/creators.ts`): stream pink and cyan, play buttons in the corners. */
  creator: { edge: '#140c28', light: '#c8f8f8', main: '#e8306a', shade: '#3a0820', accent: '#25e8e8', ball: PLAY },
} as const satisfies Record<FrameId, CardFrame>

/** A card's backdrop: sky bands top to bottom (dithered where they meet) and how many stars (fireflies, crystals, snow…). */
export type CardBackground = { sky: readonly string[]; stars: number; starColors: readonly string[] }

/** Night skies: the classic one and each biome at dusk, all dark enough for the card's white text. */
export const CARD_BACKGROUNDS = {
  night: { sky: ['#080c20', '#0e1430', '#141c40', '#1a2450', '#202c5c'], stars: 90, starColors: ['#ffffff', '#a8b8f8', '#f8e070', '#6878a8'] },
  meadow: { sky: ['#0a1a24', '#0e2630', '#123438', '#18443c', '#205440'], stars: 60, starColors: ['#f8f070', '#c0f070', '#ffffff', '#58a868'] },
  forest: { sky: ['#041008', '#08180c', '#0c2412', '#103018', '#163c1e'], stars: 70, starColors: ['#e8f870', '#a8e858', '#f8f8c0', '#2c6830'] },
  cave: { sky: ['#0e0806', '#18100a', '#22160e', '#2c1e12', '#362618'], stars: 50, starColors: ['#80d0f8', '#c8a8f8', '#f8f8f8', '#6a5440'] },
  snow: { sky: ['#0a1428', '#101e3c', '#182a50', '#203664', '#2a4478'], stars: 130, starColors: ['#ffffff', '#d8e8f8', '#a8c8f0', '#ffffff'] },
  tower: { sky: ['#0e0616', '#160a24', '#1e0e32', '#281240', '#32164e'], stars: 70, starColors: ['#b080f8', '#80f0d0', '#f8f8f8', '#5a4078'] },
  /** The gold supporters' sky: a warm dusk full of golden stars. */
  supporter: { sky: ['#0c0814', '#180e22', '#26142a', '#341c2c', '#44262c'], stars: 120, starColors: ['#f8d030', '#fff4b0', '#ffffff', '#c89038'] },
  /** Noite das Bruxas: a witching-hour dusk, purple into a pumpkin glow, with orange embers among the stars. */
  halloween: { sky: ['#0c0614', '#180a24', '#26102e', '#3a1430', '#5a2028'], stars: 80, starColors: ['#ffa030', '#ffffff', '#c080ff', '#ff6020'] },
} as const satisfies Record<BackgroundId, CardBackground>

/** What a card wears. */
export type CardStyle = { frame: FrameId; background: BackgroundId }

export const DEFAULT_CARD_STYLE: CardStyle = { frame: 'classic', background: 'night' }

/** A Caixa do PC wallpaper: a 16×16 tile in pixel strings and its palette. */
export type Wallpaper = { tile: readonly string[]; palette: Readonly<Record<string, string>> }

export const PC_WALLPAPERS = {
  /** Blue diamonds, like the first box of the games' PC. */
  classic: {
    tile: [
      '1111111111111111',
      '1111111211111111',
      '1111112321111111',
      '1111123332111111',
      '1111233433211111',
      '1112334443321111',
      '1111233433211111',
      '1111123332111111',
      '1111112321111111',
      '1111111211111111',
      '1111111111111111',
      '1111111111111111',
      '2111111111111112',
      '3211111111111123',
      '3321111111111233',
      '3211111111111123',
    ],
    palette: { 1: '#5070b8', 2: '#5878c0', 3: '#6888d0', 4: '#80a0e0' },
  },
  /** Leaves on green, like Viridian Forest. */
  forest: {
    tile: [
      '1111111111111111',
      '1111112211111111',
      '1111122321111111',
      '1111223332111111',
      '1112233332111111',
      '1112333321111111',
      '1111233211111111',
      '1111144111111111',
      '1111141111111111',
      '1111111111111111',
      '1111111111122111',
      '1111111111223211',
      '1111111112233321',
      '1111111112333211',
      '1111111111232111',
      '1111111111141111',
    ],
    palette: { 1: '#3a7a3a', 2: '#2e662e', 3: '#58a048', 4: '#285428' },
  },
  /** Pebbles on brown, like Mt. Moon. */
  cave: {
    tile: [
      '1111111111111111',
      '1112221111111111',
      '1123332111111111',
      '1233333211111111',
      '1233343211111111',
      '1123332111111211',
      '1112221111112321',
      '1111111111111211',
      '1111111111111111',
      '1111111122211111',
      '1111111233321111',
      '1121111233432111',
      '1232111123321111',
      '1121111112211111',
      '1111111111111111',
      '1111111111111111',
    ],
    palette: { 1: '#6a5440', 2: '#54402e', 3: '#8a7258', 4: '#a89070' },
  },
  /** Snowflakes on ice blue, like Mt. Silver. */
  snow: {
    tile: [
      '1111111111111111',
      '1111111211111111',
      '1111121212111111',
      '1111112321111111',
      '1112223432221111',
      '1111112321111111',
      '1111121212111111',
      '1111111211111111',
      '1111111111111111',
      '1111111111111121',
      '1111111111111111',
      '1121111111111111',
      '1232111111111111',
      '1121111111111111',
      '1111111111111111',
      '1111111111111111',
    ],
    palette: { 1: '#88b0d8', 2: '#a8c8e8', 3: '#d0e4f8', 4: '#ffffff' },
  },
  /** Little ghosts on purple, like Lavender Tower. */
  tower: {
    tile: [
      '1111111111111111',
      '1111112222111111',
      '1111123333211111',
      '1111233333321111',
      '1111234334321111',
      '1111233333321111',
      '1111233333321111',
      '1111232323221111',
      '1111121212111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111311',
      '1111111111113331',
      '1111111111111311',
      '1111111111111111',
      '1111111111111111',
    ],
    palette: { 1: '#5a4078', 2: '#6a4c8c', 3: '#8468a8', 4: '#3a2850' },
  },
  /** Gold stars on emerald, for the gold supporters (the Supporter frame's colors). */
  supporter: {
    tile: [
      '1111111111111111',
      '1111111311111111',
      '1111113331111111',
      '1113333433331111',
      '1111333333311111',
      '1111133333111111',
      '1111133133111111',
      '1111311111311111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111311',
      '1111111111113431',
      '1111111111111311',
      '1111111111111111',
      '1121111111111111',
      '1111111111111111',
    ],
    palette: { 1: '#1e6a4a', 2: '#2a7e5a', 3: '#f8d030', 4: '#fff4b0' },
  },
  /** Jack-o'-lanterns and bats on a haunted purple, for filling the Noite das Bruxas candy jar. */
  haunted: {
    tile: [
      '1111111111111111',
      '1111151111111211',
      '1113333311111111',
      '1133433431111111',
      '1133333331111111',
      '1134444431111111',
      '1113333311111111',
      '1111111111111111',
      '1111111111111111',
      '1111111111111111',
      '1211111111111111',
      '1111111116111116',
      '1111111116616166',
      '1111111111666661',
      '1111111111161611',
      '1111111111111111',
    ],
    palette: { 1: '#3a2450', 2: '#7058a0', 3: '#c06428', 4: '#f0b048', 5: '#4a7a30', 6: '#24142e' },
  },
} as const satisfies Record<WallpaperId, Wallpaper>

export const DEFAULT_WALLPAPER: WallpaperId = 'classic'

const frameIcons = new Map<FrameId, string>()

/** A frame as a small icon (the Poké Mart's rows): its ball, or its rings as nested squares. */
export const frameIcon = (id: FrameId) => {
  let url = frameIcons.get(id)
  if (!url) {
    const f: CardFrame = CARD_FRAMES[id]
    const canvas = createCanvas(7, 7)
    const ctx = context2d(canvas)
    if (f.ball) ctx.drawImage(fromStrings(f.ball[0], f.ball[1]), 0, 0)
    else
      [f.edge, f.light, f.main, f.accent].forEach((color, i) => {
        ctx.fillStyle = color
        ctx.fillRect(i, i, 7 - i * 2, 7 - i * 2)
      })
    frameIcons.set(id, (url = canvas.toDataURL()))
  }
  return url
}

const wallpaperUrls = new Map<WallpaperId, string>()

/** A wallpaper's tile as a data URL, for a CSS background (scaled in whole `--px` steps). */
export const wallpaperUrl = (id: WallpaperId = DEFAULT_WALLPAPER) => {
  let url = wallpaperUrls.get(id)
  if (!url) {
    const { tile, palette } = PC_WALLPAPERS[id]
    const sprite = fromStrings(tile, palette)
    const canvas = createCanvas(sprite.width, sprite.height)
    context2d(canvas).drawImage(sprite, 0, 0)
    wallpaperUrls.set(id, (url = canvas.toDataURL()))
  }
  return url
}
