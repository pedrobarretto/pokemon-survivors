import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the Mega families (`game/gaKitMAMoves.ts`, `gaKitMASystem.ts`):
 * the sprites their effects blit and their move icons. Only the engine is
 * imported, so `art.ts` can spread the icons in without a cycle.
 */

const sprite = (rows: readonly string[], palette: Palette) => {
  const w = Math.max(...rows.map((r) => r.length))
  return fromStrings(rows.map((r) => r.padEnd(w, '.')), palette)
}

/** A one-pixel dark outline around a sprite. */
const outline = (s: PixelSprite, color = '#181818'): PixelSprite => {
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

const icon = (rows: readonly string[], palette: Palette) => () => outline(sprite(rows, palette))

/* ---------------- Effect sprites ---------------- */

/** Kangaskhan's brown fist (1 dark, 2 hide, 3 light), knuckles forward. */
const FIST = ['..1111..', '.122221.', '12232321', '12222221', '12333321', '.122221.', '..1111..']

/** The baby out of the pouch: round head, two eyes, a cream belly and little arms out for the punch. */
const BABY = [
  '..1....1...',
  '.121..121..',
  '.12211221..',
  '.12222221..',
  '1224224221.',
  '1224224221.',
  '.12233221..',
  '..123321...',
  '.11333311..',
  '12213312211',
  '.113333311.',
  '..12.121...',
  '..11..11...',
]

/** The four-point star a punch pops (1 rim, 2 core). */
const STAR = ['...1...', '...1...', '..121..', '1112111', '..121..', '...1...', '...1...']

/** Mega Pinsir's gust: two blades of wind crossed in an X. */
const GUST_X = ['1.....1', '21...12', '.21.12.', '..232..', '.21.12.', '21...12', '1.....1']

/** A blade of air: a crescent bowing forward, its edge bright (1 rim, 2 body, 3 edge). */
const CUTTER = [
  '...111....',
  '....1221..',
  '.....1231.',
  '......1231',
  '......1231',
  '......1231',
  '......1231',
  '.....1231.',
  '....1221..',
  '...111....',
]

/** A steel feather lying on the ground, quill to tip (1 outline, 2 steel, 3 shine, 4 Skarmory's red). */
const FEATHER = ['........11', '......1231', '....12231.', '..122331..', '.12231....', '1441......', '11........']

/** Excadrill's drill, pointing right, in two spins (1 outline, 2 dark band, 3 light band, 4 shine). */
const DRILL_A = ['11........', '1211......', '123211....', '1233221...', '12223321..', '123333421.', '12223321..', '1233221...', '123211....', '1211......', '11........']
const DRILL_B = ['11........', '1311......', '132311....', '1322331...', '12333221..', '123222421.', '12333221..', '1322331...', '132311....', '1311......', '11........']

/** The mound of dirt and pebbles Drill Run pushes up while it runs below. */
const MOUND = [
  '......1111......',
  '....11344311....',
  '..1134454433111.',
  '.13344443444331.',
  '1233434444343321',
  '1223333333333221',
  '.12222222222221.',
  '..111111111111..',
]

/** A clod of earth thrown up. */
const CLOD = ['.11.', '1231', '1221', '.11.']

/** A pebble on a hole's rim. */
const PEBBLE = ['11', '12']

/** One of Drampa's rage wisps: a puff of hot breath rising, curling at the top. */
const WISP = ['..1..', '.121.', '.1221', '12321', '12331', '.122.', '..1..']

const BROWN = { 1: '#4a3018', 2: '#a07848', 3: '#e8c890' }

export const GA_KIT_MA_FX = {
  fist: lazy(() => outline(sprite(FIST, BROWN), '#201008')),
  baby: lazy(() => outline(sprite(BABY, { 1: '#5a3a1c', 2: '#c89a64', 3: '#f8e8c8', 4: '#101010' }), '#201008')),
  babyMega: lazy(() => outline(sprite(BABY, { 1: '#5a3a1c', 2: '#d0a46c', 3: '#fff0d8', 4: '#101010' }), '#f8f0d0')),
  star: lazy(() => sprite(STAR, { 1: '#f8d878', 2: '#ffffff' })),
  gust: lazy(() => sprite(GUST_X, { 1: '#a8e0d0', 2: '#e8fff8', 3: '#ffffff' })),
  cutter: lazy(() => sprite(CUTTER, { 1: '#5878b0', 2: '#c8d8f8', 3: '#ffffff' })),
  cutterMega: lazy(() => sprite(CUTTER, { 1: '#a82828', 2: '#f0b8b8', 3: '#ffffff' })),
  feather: lazy(() => outline(sprite(FEATHER, { 1: '#283040', 2: '#8898b0', 3: '#e8eef8', 4: '#d04040' }), '#101418')),
  featherMega: lazy(() => outline(sprite(FEATHER, { 1: '#283040', 2: '#a0b0c8', 3: '#ffffff', 4: '#f85050' }), '#480808')),
  drillA: lazy(() => outline(sprite(DRILL_A, { 1: '#28202a', 2: '#706878', 3: '#c8c0d0', 4: '#ffffff' }), '#100810')),
  drillB: lazy(() => outline(sprite(DRILL_B, { 1: '#28202a', 2: '#706878', 3: '#c8c0d0', 4: '#ffffff' }), '#100810')),
  drillMegaA: lazy(() => outline(sprite(DRILL_A, { 1: '#381818', 2: '#c83838', 3: '#e8d8d8', 4: '#ffffff' }), '#180808')),
  drillMegaB: lazy(() => outline(sprite(DRILL_B, { 1: '#381818', 2: '#c83838', 3: '#e8d8d8', 4: '#ffffff' }), '#180808')),
  mound: lazy(() => sprite(MOUND, { 1: '#3a2a1a', 2: '#7a6448', 3: '#a89070', 4: '#d0c0a0', 5: '#888890' })),
  clod: lazy(() => outline(sprite(CLOD, { 1: '#5a4430', 2: '#8a7050', 3: '#c0a880' }), '#281c10')),
  pebble: lazy(() => sprite(PEBBLE, { 1: '#685848', 2: '#a89878' })),
  wisp: lazy(() => outline(sprite(WISP, { 1: '#d84838', 2: '#f89868', 3: '#fff0d8' }), '#601810')),
}

/* ---------------- Move icons ---------------- */

export const GA_KIT_MA_ICONS = {
  cometPunch: icon(['......1.1.', '.......1..', '..1111.1.1', '.1222211..', '1223232 1.', '1222222 1.', '12333331..', '.122221...', '..1111....'].map((r) => r.replace(/ /g, '2')), { 1: '#4a3018', 2: '#a07848', 3: '#e8c890' }),
  stormThrow: icon(['..111111..', '.1......1.', '1..1111..1', '1.12222.1.', '..123321..', '..122221..', '...1221...', '1..1..1..1', '.1......1.', '..11..11..'], { 1: '#702818', 2: '#e86838', 3: '#f8d0a0' }),
  airCutter: icon(['....111...', '...12221..', '..12..121.', '.12.....21', '.1......21', '........21', '.......121', '.....1221.', '....1221..', '....111...'], { 1: '#5878b0', 2: '#e8f0ff' }),
  drillRun: icon(['11........', '1211......', '123211....', '1233221...', '12223321..', '1233334211', '12223321..', '1233221...', '123211....', '1211......', '11........'], { 1: '#28202a', 2: '#706878', 3: '#c8c0d0', 4: '#ffffff' }),
  hyperVoice: icon(['..1...1...', '.1..1..1..', '1..1.1..1.', '1.1.2.1.1.', '1.123.1.1.', '1.1.2.1.1.', '1..1.1..1.', '.1..1..1..', '..1...1...'], { 1: '#9878c8', 2: '#e86858', 3: '#ffffff' }),
} as const satisfies Record<string, () => PixelSprite>
