import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the big update's first 15 families (`game/gaKitAMoves.ts`):
 * the sprites their effects blit and their move icons. Only the engine is
 * imported, so `art.ts` can spread the icons in without a cycle.
 */

const sprite = (rows: readonly string[], palette: Palette) => {
  const w = Math.max(...rows.map((r) => r.length))
  return fromStrings(rows.map((r) => r.padEnd(w, '.')), palette)
}

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

const CHOP = ['......11.', '....1122.', '...122...', '..122....', '.122.....', '.12......', '122......', '12.......', '1........']
const CLAW = ['1..1..1...', '21.21.21..', '.2..2..2..', '.21.21.21.', '..2..2..2.', '...1..1..1']
/** Beat Up's three claw marks, bigger and outlined so a pack's strike reads on a crowd. */
const SLASH = ['1...1...1....', '21..21..21...', '.21..21..21..', '..21..21..21.', '...21..21..21', '....2...2...2', '....1...1...1']
/** Haxorus's Guillotine: a wide crescent of its tusks' edge. */
const CRESCENT = ['..........1111', '.......11122221', '.....1122233321', '....12233321111', '...1223321.....', '..122321.......', '..12321........', '.12221.........', '.1221..........', '1221...........', '121............', '11.............']
const BIG_GEM = ['...1...', '..121..', '.12321.', '1233321', '.12321.', '..121..', '...1...']
const WISP = [
  ['...1...', '..121..', '.12321.', '1233321', '1343431', '1233321', '.12221.', '..1.1..'],
  ['...1...', '..121..', '.12321.', '1233321', '1343431', '1233321', '.12221.', '.1...1.'],
]
const FIST = ['..1111..', '.122221.', '12332211', '12222221', '12222221', '.1122221', '...1111.']
const SPIKE = ['......1', '.....12', '....121', '...121.', '..121..', '.121...', '121....', '11.....']
const SPARK = ['..1...', '.12...', '1221..', '..1221', '...21.', '...1..']
const FEATHER = ['......11', '....1122', '..112221', '.1222211', '122211..', '1111....']
const FLAME = [
  ['..1....', '.121.1.', '.12321.', '1233321', '1233321', '.12221.', '..111..'],
  ['....1..', '.1.121.', '.12321.', '1233321', '1233321', '.12221.', '..111..'],
]
const JAWS = ['11....11', '121..121', '.121121.', '..1221..', '.122221.', '..1111..']
/** Corviknight's armor plate as it turns on its orbit: face on, half turned, edge on; and cracked as it soaks a hit. */
const PLATE_FACE = ['1111111', '1555541', '1463621', '1433321', '1433321', '1433221', '.13321.', '..121..', '...1...']
const PLATE_HALF = ['11111', '15541', '14321', '14321', '14321', '14221', '.132.', '..1..']
const PLATE_EDGE = ['111', '151', '141', '141', '131', '131', '121', '.1.']
const PLATE_CRACK = ['1111111', '1555141', '1461621', '1431321', '1413121', '1433121', '.13121.', '..121..', '...1...']
const SHARDS = [['1...', '41..', '331.', '1111'], ['111', '143', '.31', '..1'], ['.1.', '141', '131', '11.']]
const STEAM = [['.1..', '12..', '.21.', '..21', '.12.', '12..', '2...'], ['..1.', '..21', '.12.', '12..', '.21.', '..21', '...2']]
/** A curl of Impidimp's line's hair drifting in as mischief gathers (and its mirror). */
const CURL = ['.1111..', '122221.', '13..121', '.1..121', '...1221', '.11221.', '..11...']
/** Where a hair fist lands. */
const IMPACT = ['...1...', '.1.2.1.', '..222..', '1222221', '..222..', '.1.2.1.', '...1...']
/** Kommo-o's scale, ringing. */
const SCALE = ['.111.', '12331', '12231', '.121.', '..1..']
/** A strand-made fist of Grimmsnarl's hair. */
const HAIR_FIST = ['.1111..', '1222211', '1233221', '1222221', '.122221', '..1111.']
/** Magmortar's arm cannon by heat: warm, hot, white hot, and cooling after a vent. */
const MUZZLE = ['.111.', '12221', '12321', '12221', '.111.']
const MUZZLE_HOT = ['..111..', '.12221.', '1233321', '1234321', '1233321', '.12221.', '..111..']
const SMOKE = ['.111.', '12221', '12221', '.111.']
/** A super-effective hit cracking Shedinja's shell. */
const PIERCE = ['......1......', '..1...1...1..', '...1..2..1...', '....2.2.2....', '.....232.....', '.1..23432..1.', '1122344432211', '.1..23432..1.', '.....232.....', '....2.2.2....', '...1..2..1...', '..1...1...1..', '......1......']
/** A shot caught on Mega Sableye's gem: a glint. */
const TWINKLE = ['...1...', '...1...', '..121..', '1122211', '..121..', '...1...', '...1...']
const NOTE = ['..111', '..1.1', '..1..', '111..', '111..']

const STEEL = { 1: '#141826', 2: '#3c4660', 3: '#7888a8', 4: '#b8c8e0', 5: '#ffffff', 6: '#1e2436' }
/** Grimmsnarl's hair: near black, a violet sheen. */
export const HAIR = { 1: '#16101e', 2: '#3e3050', 3: '#7e64a0' }

export const GA_KIT_A_FX = {
  chop: lazy(() => sprite(CHOP, { 1: '#7058c8', 2: '#e8e0ff' })),
  guillotine: lazy(() => outline(sprite(CRESCENT, { 1: '#a01828', 2: '#f86868', 3: '#ffffff' }), '#300808')),
  claw: lazy(() => outline(sprite(SLASH, { 1: '#ffffff', 2: '#88b8f0' }), '#181828')),
  gem: [lazy(() => outline(sprite(BIG_GEM, { 1: '#a01838', 2: '#f85878', 3: '#ffd0e0' }), '#380818')), lazy(() => outline(sprite(BIG_GEM, { 1: '#1878a0', 2: '#58e8f8', 3: '#e0ffff' }), '#082838'))],
  wisp: WISP.map((rows) => lazy(() => sprite(rows, { 1: '#3a2060', 2: '#8868d0', 3: '#b8f8c8', 4: '#182018' }))),
  jab: lazy(() => outline(sprite(FIST, { 1: '#481858', 2: '#a048c0', 3: '#e8a8f8' }), '#280830')),
  punch: lazy(() => outline(sprite(FIST, { 1: '#806010', 2: '#f8d030', 3: '#fff8c0' }), '#382808')),
  horn: lazy(() => sprite(SPIKE, { 1: '#183870', 2: '#88b8f8' })),
  spike: lazy(() => sprite(SPIKE, { 1: '#401828', 2: '#f878b0' })),
  spark: lazy(() => sprite(SPARK, { 1: '#f8d030', 2: '#ffffff' })),
  feather: lazy(() => sprite(FEATHER, { 1: '#484c60', 2: '#d8e0f0' })),
  flame: FLAME.map((rows) => lazy(() => sprite(rows, { 1: '#c83010', 2: '#f88830', 3: '#f8e060' }))),
  jaws: lazy(() => sprite(JAWS, { 1: '#486018', 2: '#c8e858' })),
  plate: [PLATE_FACE, PLATE_HALF, PLATE_EDGE].map((rows) => lazy(() => sprite(rows, STEEL))),
  plateCrack: lazy(() => sprite(PLATE_CRACK, STEEL)),
  plateFlash: lazy(() => sprite(PLATE_FACE, { ...STEEL, 2: '#b8c8e0', 3: '#ffffff', 4: '#ffffff', 6: '#b8c8e0' })),
  shard: SHARDS.map((rows) => lazy(() => sprite(rows, STEEL))),
  shedClaw: lazy(() => sprite(CLAW, { 1: '#f8e8b0', 2: '#8868d0' })),
  steam: STEAM.map((rows) => lazy(() => sprite(rows, { 1: '#ffffff', 2: '#c8c0d0' }))),
  curl: [CURL, CURL.map((r) => [...r].reverse().join(''))].map((rows) => lazy(() => sprite(rows, { 1: '#16101e', 2: '#5a4478', 3: '#f878b0' }))),
  impact: lazy(() => sprite(IMPACT, { 1: '#f878b0', 2: '#ffffff' })),
  scale: lazy(() => sprite(SCALE, { 1: '#5a3810', 2: '#f8c838', 3: '#fff8c0' })),
  scaleLit: lazy(() => sprite(SCALE, { 1: '#806020', 2: '#ffffff', 3: '#ffffff' })),
  hairFist: lazy(() => sprite(HAIR_FIST, HAIR)),
  muzzle: [
    lazy(() => sprite(MUZZLE, { 1: '#401008', 2: '#a02810', 3: '#e85018' })),
    lazy(() => sprite(MUZZLE, { 1: '#581008', 2: '#f05818', 3: '#f8c040' })),
    lazy(() => sprite(MUZZLE_HOT, { 1: '#802010', 2: '#f87828', 3: '#f8d048', 4: '#ffffff' })),
    lazy(() => sprite(MUZZLE, { 1: '#301010', 2: '#602018', 3: '#903020' })),
  ],
  smoke: lazy(() => sprite(SMOKE, { 1: '#4a4448', 2: '#9a9298' })),
  pierce: lazy(() => outline(sprite(PIERCE, { 1: '#d01818', 2: '#f86020', 3: '#f8d048', 4: '#ffffff' }), '#300808')),
  twinkle: lazy(() => sprite(TWINKLE, { 1: '#a8f8ff', 2: '#ffffff' })),
  note: lazy(() => outline(sprite(NOTE, { 1: '#f8b8d0' }), '#702848')),
}

export const GA_KIT_A_ICONS = {
  clangingScales: icon(['..1....1..', '.1.1111.1.', '1.122221.1', '1.123321.1', '1.123321.1', '.1.1221.1.', '..1.11.1..', '....11....'], { 1: '#806040', 2: '#f8d048', 3: '#fff8c0' }),
  dualChop: icon(['......1..1', '.....12.12', '....12.12.', '...12.12..', '..12.12...', '.12.12....', '12.12.....', '1..1......'], { 1: '#382878', 2: '#b8a8f8' }),
  sing: icon(['....1111..', '....1221..', '....1..11.', '....1.....', '....1.....', '..111.....', '.12221....', '.12221....', '..111.....'], { 1: '#a83868', 2: '#f8b8d0' }),
  beatUp: icon(['1..1..1...', '21.21.21..', '.2..2..2..', '.21.21.21.', '..2..2..2.', '..21.21.21', '...1..1..1'], { 1: '#201828', 2: '#a8c8f0' }),
  hornAttack: icon(['1.........', '21........', '121.......', '.121......', '.1221.....', '..12221...', '..122221..', '...1222211', '....111111'], { 1: '#183870', 2: '#5888d8' }),
  shadowSneak: icon(['...1.1....', '..12121...', '..12221...', '...121....', '...121....', '.11121111.', '1222222221', '.11111111.'], { 1: '#180c28', 2: '#6848a8' }),
  ominousWind: icon(['....1.....', '...121....', '..1221.1..', '..12321.1.', '.1233321..', '.1233321..', '..12221...', '...111....'], { 1: '#382858', 2: '#7858c8', 3: '#a8f0c8' }),
  poisonJab: icon(['..1111....', '.122221...', '1233221...', '1222221111', '1222222221', '.11222221.', '...11111..', '....1.....', '...121....', '....1.....'], { 1: '#481858', 2: '#a048c0', 3: '#e8a8f8' }),
  teatime: icon(['..4.4.4...', '.4.4.4....', '..........', '11111111..', '13333331.1', '12222221.1', '.122221.1.', '..111111..', '.11111111.'], { 1: '#683818', 2: '#c89068', 3: '#f8e0b0', 4: '#e8e8f0' }),
  falseSurrender: icon(['.........1', '........12', '.......121', '......121.', '.....121..', '1...121...', '11.121....', '.1121.....', '..11......'], { 1: '#401828', 2: '#f878b0' }),
  nuzzle: icon(['.1.....1..', '121...121.', '.1.111.1..', '..12221...', '.1222221..', '.1233221..', '.1222221..', '..11111...'], { 1: '#886010', 2: '#f8d030', 3: '#f88848' }),
  steelWing: icon(['.........1', '.......112', '.....11222', '...1122221', '.112222211', '1222221111', '.1111.....'], { 1: '#484c60', 2: '#c8d0e0' }),
  thunderPunch: icon(['..1111..1.', '.122221.21', '1233221.1.', '1222221111', '1222222221', '.11222221.', '...11111..'], { 1: '#806010', 2: '#f8d030', 3: '#fff8c0' }),
  flameBurst: icon(['1...1...1.', '.1..1..1..', '..12221...', '1123332211', '..12321...', '.1.121.1..', '1...1...1.'], { 1: '#c83010', 2: '#f88830', 3: '#f8e060' }),
  bugBite: icon(['.11....11.', '1221..1221', '12.1..1.21', '12.1111.21', '.12.22.21.', '..122221..', '...1111...'], { 1: '#486018', 2: '#a8c840' }),
} as const satisfies Record<string, () => PixelSprite>
