import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the second batch's families (`game/gaKitBMoves.ts`): the
 * sprites their effects blit and their move icons. Only the engine is
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

/** One of Onix's boulders, seen from above and a little in front. */
const BOULDER = [
  '....111111....',
  '..1122222211..',
  '.123332222221.',
  '.1233222222221',
  '12332222222241',
  '12222222222441',
  '12222222224441',
  '12222222244441',
  '.122222444441.',
  '.114444444411.',
  '...11111111...',
]
/** A Steelix segment: a riveted steel ring. */
const STEEL_SEG = [
  '....111111....',
  '..1133333311..',
  '.1333222233331',
  '.1322422422231',
  '13222222222231',
  '13322222222331',
  '15333333333351',
  '15522222222551',
  '.152242242251.',
  '.115555555511.',
  '...11111111...',
]
/** A Lucky Egg: cream shell, a pink band and spots. */
const LUCKY_EGG = [
  '..111..',
  '.12221.',
  '1232221',
  '1222221',
  '1444441',
  '1242421',
  '1222221',
  '.12221.',
  '..111..',
]
/** The egg Egg Bomb lobs, smaller. */
const EGG = ['.111.', '12321', '12221', '14441', '12221', '.111.']
const ORB = ['..1111..', '.122221.', '12333321', '12344321', '12344321', '12333321', '.122221.', '..1111..']
const FIST = ['..1111..', '.122221.', '1222222.', '12333321', '12333321', '.122221.', '..1111..']
const SALT = ['.11.', '1221', '1231', '.11.']
const CRESCENT = ['....111.', '...12221', '...1.121', '.......1', '.......1', '...1.121', '...12221', '....111.']
const SPARK = ['...1...', '.1.2.1.', '..232..', '1233321', '..232..', '.1.2.1.', '...1...']
const KICK = ['..11...', '.1221..', '.12221.', '..1221.', '...121.', '....11.']
const FLAME = ['.1.', '121', '232', '.3.']
const CRYSTAL = ['.1.', '121', '232', '121']
const CLAW = ['1...1', '21.12', '.222.', '..2..']
const TAIL = ['....11..', '..1221..', '.12331..', '1233....', '123.....', '.1......']

export const KIT_B_FX = {
  boulder: lazy(() => outline(sprite(BOULDER, { 1: '#404858', 2: '#98a0b0', 3: '#d0d8e0', 4: '#687080' }), '#202430')),
  steel: lazy(() => outline(sprite(STEEL_SEG, { 1: '#383c48', 2: '#8890a0', 3: '#c8d0e0', 4: '#f0f4f8', 5: '#606878' }), '#202028')),
  luckyEgg: lazy(() => outline(sprite(LUCKY_EGG, { 1: '#a87878', 2: '#f8f0e0', 3: '#ffffff', 4: '#f090a8' }), '#584040')),
  egg: lazy(() => outline(sprite(EGG, { 1: '#a87878', 2: '#f8f0e0', 3: '#ffffff', 4: '#f090a8' }), '#584040')),
  sphere: lazy(() => sprite(ORB, { 1: '#1838a0', 2: '#3878e8', 3: '#88c0f8', 4: '#ffffff' })),
  fistGhost: lazy(() => outline(sprite(FIST, { 1: '#382058', 2: '#7050b0', 3: '#a888e0' }), '#180c28')),
  fistIce: lazy(() => outline(sprite(FIST, { 1: '#3878a8', 2: '#88c8e8', 3: '#e0f8ff' }), '#183048')),
  salt: lazy(() => outline(sprite(SALT, { 1: '#a89888', 2: '#f0ece8', 3: '#ffffff' }), '#504038')),
  cut: lazy(() => sprite(CRESCENT, { 1: '#c04890', 2: '#f8a8d8' })),
  spark: lazy(() => sprite(SPARK, { 1: '#f8d030', 2: '#f8f080', 3: '#ffffff' })),
  kick: lazy(() => outline(sprite(KICK, { 1: '#488028', 2: '#a8e070' }), '#183010')),
  flame: lazy(() => sprite(FLAME, { 1: '#f87818', 2: '#f8c838', 3: '#fff8c8' })),
  crystal: lazy(() => outline(sprite(CRYSTAL, { 1: '#d8d0c8', 2: '#ffffff', 3: '#f8f4f0' }), '#685848')),
  flake: lazy(() => sprite(['.1.', '121', '.1.'], { 1: '#d8f0f8', 2: '#ffffff' })),
  claw: lazy(() => outline(sprite(CLAW, { 1: '#f0d0f8', 2: '#a058c8' }), '#281838')),
  tail: lazy(() => outline(sprite(TAIL, { 1: '#383c48', 2: '#8890a0', 3: '#e0e8f0' }), '#202028')),
}

/* ---------------- Move icons ---------------- */

export const KIT_B_ICONS = {
  ironTail: icon(['.......11.', '.....1221.', '....12331.', '...1233.1.', '..12331...', '.12331....', '1233.1....', '1231......', '121.......', '11........'], { 1: '#383c48', 2: '#8890a0', 3: '#e0e8f0' }),
  eggBomb: icon(['.1.....1..', '..1.11.1..', '...1221...', '1.123221.1', '..122221..', '..144441..', '..124241..', '..122221..', '...1111...'], { 1: '#a87878', 2: '#f8f0e0', 3: '#ffffff', 4: '#f090a8' }),
  auraSphere: icon(['...1111...', '.1.2222.1.', '..233332..', '1233443321', '.23344332.', '.23344332.', '1233443321', '..233332..', '.1.2222.1.', '...1111...'], { 1: '#1838a0', 2: '#3878e8', 3: '#88c0f8', 4: '#ffffff' }),
  acrobatics: icon(['1.........', '11........', '1211......', '.12211....', '..1222111.', '...1222221', '..123331..', '.1231.....', '121.......', '11........'], { 1: '#702818', 2: '#e05838', 3: '#f8c8a0' }),
  shadowPunch: icon(['...1111...', '..122221..', '.12222221.', '.12133121.', '1222222221', '1213333121', '1222222221', '.11111111.', '1.1.1.1.1.'], { 1: '#382058', 2: '#7050b0', 3: '#a888e0' }),
  saltCure: icon(['....11....', '...1231...', '..122221..', '..12221.11', '.1122211231', '12311112221', '1222211221.', '.12221.11..', '..111......'], { 1: '#a89888', 2: '#f0ece8', 3: '#ffffff' }),
  psychoCut: icon(['......111.', '.....12221', '....12..21', '...12....1', '...12.....', '...12.....', '...12....1', '....12..21', '.....12221', '......111.'], { 1: '#a03878', 2: '#f8a8d8' }),
  poisonFang: icon(['1111111111', '1222222221', '.1.12.1.1.', '.1..1..1..', '..........', '..1..1..1.', '.1.21.1.1.', '1222222221', '1111111111'], { 1: '#583078', 2: '#c070e0' }),
  icePunch: icon(['.1..1..1..', '..122221..', '.12333321.', '1233333321', '1233333321', '1222222221', '.12222221.', '..111111..', '.1..1..1..'], { 1: '#3878a8', 2: '#88c8e8', 3: '#e0f8ff' }),
  spark: icon(['....1.....', '.1..12..1.', '..1.121.1.', '...12221..', '1112333211', '...12221..', '..1.121.1.', '.1..21..1.', '.....1....'], { 1: '#b88810', 2: '#f8d030', 3: '#ffffff' }),
  lunge: icon(['.........1', '........12', '.....11122', '...1122221', '.11222221.', '1222222...', '.1122221..', '...111221.', '......1121', '........11'], { 1: '#386838', 2: '#88c060' }),
  electroShot: icon(['1111......', '12221.....', '123321111.', '1233333331', '1233444441', '1233333331', '123321111.', '12221.....', '1111......'], { 1: '#585868', 2: '#a8b0c0', 3: '#f8d030', 4: '#ffffff' }),
  tropKick: icon(['.....111..', '....12221.', '...122221.', '...12221..', '..122221..', '.1222221..', '1232221...', '12221.....', '.111......'], { 1: '#386018', 2: '#88c048', 3: '#e86878' }),
} as const satisfies Record<string, () => PixelSprite>
