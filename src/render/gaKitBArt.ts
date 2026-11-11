import { canvasCache, context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

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

/*
 * Onix's line's body segments, in the sheets' own ramp (1 outline, 2 dark, 3 mid, 4 light, 5 shine), sampled
 * from SpriteCollab's Onix and Steelix: mottled boulders with a crack for Onix, banded steel with its fins for
 * Steelix (f, g the fins' light), the Mega's with its crystal fins and the blue ports (6, 7, 8).
 * Sizes taper toward the tail.
 */
const BOULDERS = [
  [
    '...111111...',
    '..13343221..',
    '.1345332231.',
    '134433234321',
    '133322223321',
    '132232222221',
    '123431322221',
    '123322132221',
    '.1222212221.',
    '.1222221221.',
    '..11111111..',
  ],
  [
    '...11111...',
    '..1343221..',
    '.134532231.',
    '13433224321',
    '13222223321',
    '12343122221',
    '12332212221',
    '.122221221.',
    '..1111111..',
  ],
  [
    '..11111..',
    '.1343221.',
    '134322331',
    '132223321',
    '123412221',
    '123321221',
    '.1222221.',
    '..11111..',
  ],
] as const
const STEEL_L = [
  '1.....1111111.....1',
  '11...134555431...11',
  '1g1.13445554431.1g1',
  '.1f1134444443311f1.',
  '..1f13333333321f1..',
  '...1122222222211...',
  '....12333333321....',
  '....12433333421....',
  '.....122222221.....',
  '......1111111......',
]
/** The Mega's largest segment: a blue port in the steel, crystal fins. */
const STEEL_PORT = [
  '1.....1111111.....1',
  '11...134555431...11',
  '1h1.13445554431.1g1',
  '.1f1134466643311f1.',
  '..1f13367776321f1..',
  '...1122678762211...',
  '....12336663321....',
  '....12433333421....',
  '.....122222221.....',
  '......1111111......',
]
const STEEL_M = [
  '1....1111111....1',
  '11..134555431..11',
  '1g1134444443311g1',
  '.1f13333333331f1.',
  '..11222222222211.',
  '...12333333321...',
  '...12433333421...',
  '....122222221....',
  '.....1111111.....',
]
const STEEL_S = [
  '1...11111...1',
  '11.1345431.11',
  '1g134444431g1',
  '.11333333311.',
  '..122222221..',
  '..124333421..',
  '...1222221...',
  '....11111....',
]
/** Which segment art each place in the body wears, head to tail, by look. */
const SEGMENT_ROWS = {
  onix: BOULDERS,
  steelix: [STEEL_L, STEEL_L, STEEL_M, STEEL_M, STEEL_S],
  mega: [STEEL_PORT, STEEL_L, STEEL_M, STEEL_PORT, STEEL_S],
} as const

/** The ramps, normal and shiny, as the sheets have them (the shinies' too: olive Onix, gold Steelix). */
const SEGMENT_RAMPS = {
  onix: [['#47676f', '#7f8f97', '#afb7bf', '#d7dfdf'], ['#839439', '#acb452', '#cdd562', '#eef683']],
  steelix: [['#47676f', '#7f8f97', '#afb7bf', '#d7dfdf'], ['#806133', '#b99c46', '#e4dc72', '#fcffa1']],
  mega: [['#616982', '#9c9cb7', '#cbd1e4', '#f2f5ff'], ['#947421', '#b9a438', '#dad66d', '#fff9be']],
} as const

export type SegmentLook = keyof typeof SEGMENT_ROWS

const segmentArt = (look: SegmentLook, i: number, shiny: boolean): PixelSprite => {
  const [dark, mid, light, shine] = SEGMENT_RAMPS[look][shiny ? 1 : 0]
  const fins = look === 'mega' ? { f: '#ffc7df', g: '#fff7bd', h: '#c6e7ef' } : { f: light, g: shine, h: shine }
  const rows = SEGMENT_ROWS[look]
  return sprite(rows[Math.min(i, rows.length - 1)]!, { 1: '#000000', 2: dark, 3: mid, 4: light, 5: shine, ...fins, 6: '#00649a', 7: '#008cce', 8: '#4f4f4f' })
}

const segmentCache = canvasCache<string, PixelSprite>()

/** Segment `i` (0 behind the head) of Onix's line's body in a look, built once. */
export const segmentSprite = (look: SegmentLook, i: number, shiny: boolean) => {
  const key = `${look}${i}${shiny ? 's' : ''}`
  const hit = segmentCache.get(key)
  if (hit) return hit
  const made = segmentArt(look, i, shiny)
  segmentCache.set(key, made)
  return made
}

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
/** Sandile's mound of sand, shuffling along while it runs below. */
const SAND_MOUND = [
  '......1111......',
  '....11344311....',
  '..113344443311..',
  '.13334444443331.',
  '1233334444333321',
  '1223333333333221',
  '.12222222222221.',
  '..111111111111..',
]
/** A clod of sand the eruption throws. */
const CLOD = ['.11.', '1231', '1221', '.11.']
const CRYSTAL = ['.1.', '121', '232', '121']
const CLAW = ['1...1', '21.12', '.222.', '..2..']
const TAIL = ['....11..', '..1221..', '.12331..', '1233....', '123.....', '.1......']

export const KIT_B_FX = {
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
  mound: lazy(() => sprite(SAND_MOUND, { 1: '#5a3c1c', 2: '#b08850', 3: '#d8b070', 4: '#f8e8b8' })),
  clod: lazy(() => outline(sprite(CLOD, { 1: '#8a6634', 2: '#c8a060', 3: '#f0dca8' }), '#3a2810')),
  hammer: lazy(() => outline(sprite(FIST, { 1: '#18181c', 2: '#383840', 3: '#74748a' }), '#060608')),
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
  powerTrip: icon(['1111111111', '1232323231', '.1.1.1.1.1', '..........', '.1.1.1.1.1', '1232323231', '1222222221', '.11111111.'], { 1: '#301818', 2: '#583838', 3: '#f8f0e8' }),
  hammerArm: icon(['.11.11.11.', '1331331331', '1221221221', '1222222221', '1112222221', '1331222221', '1222222221', '.122222221', '..1222221.', '...11111..'], { 1: '#101014', 2: '#3a3a46', 3: '#9a9ab0' }),
} as const satisfies Record<string, () => PixelSprite>
