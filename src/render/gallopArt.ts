import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of Ponyta's gallop batch (`game/gallopMoves.ts`): the sprites
 * its effects blit and its move icons. Only the engine is imported, so
 * `art.ts` can spread the icons in without a cycle.
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

const icon = (rows: readonly string[], palette: Palette, edge?: string) => () => outline(sprite(rows, palette), edge)

/** A horseshoe, open side up, its nail holes in the light color; a row of thrown-up dirt under it. */
const SHOE = [
  '.11....11.',
  '1221..1221',
  '1231..1321',
  '1221..1221',
  '1231..1321',
  '1222112221',
  '.12222221.',
  '..111111..',
  '..........',
  '5.55..55.5',
  '.5..55..5.',
]
/** A low kick's arc: a crescent swept left to right, the hoof at its end. */
const SWEEP = [
  '..........11',
  '........1221',
  '......12221.',
  '1...1222 1..'.replace(' ', '2'),
  '.1122221....',
  '..1221......',
  '...11.......',
  '....3443....',
  '...344443...',
  '....3333....',
]
/** A heel coming down onto a burst. */
const HEEL = [
  '...1111...',
  '...1221...',
  '...1221...',
  '..112211..',
  '..122221..',
  '..123321..',
  '...1111...',
  '.3..4..3..',
  '..3.4.3...',
  '4..343..4.',
]
/** A drill's cone, point up, its spiral in two tones. */
const DRILL = [
  '....11....',
  '....13....',
  '...1231...',
  '...1321...',
  '..123321..',
  '..132231..',
  '.12332231.',
  '.13223321.',
  '1233223321',
  '1111111111',
]
/** A morning sun: the disc and its rays. */
const SUN = [
  '.....1.....',
  '.1...1...1.',
  '..1.....1..',
  '....222....',
  '...23332...',
  '11.23432.11',
  '...23332...',
  '....222....',
  '..1.....1..',
  '.1...1...1.',
  '.....1.....',
]
/** A hop: the dotted arc of the jump, the ring where it lands. */
const HOP = [
  '...1111....',
  '..1....1...',
  '.1......1..',
  '.1.......1.',
  '1........1.',
  '1.........1',
  '...........',
  '.22222222..',
  '2333333332.',
  '.22222222..',
]
/** A dive: wings folded into a chevron, falling onto its impact. */
const DIVE = [
  '1........1',
  '21......12',
  '.21....12.',
  '..213312..',
  '...2332...',
  '...1331...',
  '....11....',
  '..4.44.4..',
  '.4.4334.4.',
  '4..3443..4',
]

const EARTH = { 1: '#5c5c70', 2: '#a8a8bc', 3: '#f0f0f8', 5: '#a06a30' }
const GOLD_SHOE = { 1: '#7a4410', 2: '#e09030', 3: '#fff0a8', 5: '#8a6040' }

export const GALLOP_ICONS = {
  highHorsepower: icon(SHOE, EARTH),
  headlongRush: icon(SHOE, GOLD_SHOE, '#281808'),
  lowKick: icon(SWEEP, { 1: '#a83018', 2: '#f08040', 3: '#5a4038', 4: '#a88070' }),
  axeKick: icon(HEEL, { 1: '#802018', 2: '#e05830', 3: '#f8c048', 4: '#ffffff' }, '#200808'),
  hornDrill: icon(DRILL, { 1: '#505868', 2: '#a8b0c0', 3: '#f0f0f8' }),
  hyperDrill: icon(DRILL, { 1: '#784010', 2: '#e8a030', 3: '#fff4b0' }, '#281000'),
  morningSun: icon(SUN, { 1: '#e88a20', 2: '#e8b028', 3: '#f8e070', 4: '#ffffff' }, '#583008'),
  revivalBlessing: icon(SUN, { 1: '#f080b0', 2: '#e8b028', 3: '#f8e070', 4: '#ffffff' }, '#582038'),
  bounce: icon(HOP, { 1: '#88b8e8', 2: '#3870b0', 3: '#c8e8f8' }, '#102040'),
  skyDrop: icon(DIVE, { 1: '#3060a8', 2: '#88b8f0', 3: '#e8f4ff', 4: '#f8d048' }, '#081830'),
} as const satisfies Record<string, () => PixelSprite>

/** Thrown-up earth, small to tall (High Horsepower's power picks one). */
const PLUMES = [
  ['....1..1....', '..1.121.1...', '.12112211.1.', '122332221121', '.1223322221.', '..1222221...'],
  ['.....1......', '...1.121.1..', '..121221121.', '.1223322221.', '12233332221.', '1233333322 1'.replace(' ', '2'), '.122222221..', '..111111....'],
  ['......1.....', '....1.121...', '..1.122211..', '.1211233211.', '.12233332211', '122333333221', '123333333321', '123332333321', '.1222222221.', '..11111111..'],
]
/** A crack the eruption leaves in the ground. */
const CRACK = ['1....1.....1', '.1..1.1...1.', '..11...1.1..', '.........1..']
/** A stone pillar thrust up by Headlong Rush. */
const PILLAR = ['..11..', '.1231.', '.1221.', '12321.', '12221.', '123211', '122221', '111111']
/** Low Kick's swipe, bending to the right (rotated along the sweep). */
const SWIPE = ['11......', '.1221...', '..12221.', '...12221', '..12221.', '.1221...', '11......']
/** A hoof seen from below, coming down (Axe Kick). */
const HOOF = ['..1111..', '.122221.', '12233221', '12333321', '12333321', '.122221.', '.11..11.']
/** A starburst of impact. */
const IMPACT = ['....1....', '.1..1..1.', '..1.2.1..', '...232...', '112343211', '...232...', '..1.2.1..', '.1..1..1.', '....1....']
/** The drill pointing right, in two turns of its spiral. */
const DRILL_SIDE = [
  ['111.............', '13311...........', '1223311.........', '133223311.......', '12233223311.....', '1332233223311...', '12233223322333111', '1332233223311...', '12233223311.....', '133223311.......', '1223311.........', '13311...........', '111.............'],
  ['111.............', '12211...........', '1332211.........', '122332211.......', '13322332211.....', '1223322332211...', '13322332233222111', '1223322332211...', '13322332211.....', '122332211.......', '1332211.........', '12211...........', '111.............'],
]
/** Hyper Drill's lance, pointing right. */
const LANCE = ['11..............', '13311...........', '1223331111......', '13322223333331111', '1223331111......', '13311...........', '11..............']
/** The sun disc rising over the head. */
const SUN_DISC = ['...2222...', '..233332..', '.23344332.', '2334444332', '2334444332', '2334444332', '.23344332.', '..233332..', '...2222...']
/** A falling feather of fire (Sky Drop's dive, before it lands). */
const STREAK = ['..1..', '.121.', '.121.', '12321', '12321', '12321', '.123.', '.12..', '..1..']

const DIRT = { 1: '#4a3018', 2: '#8a5a28', 3: '#c89858' }

export const GALLOP_FX = {
  plume: PLUMES.map((rows) => lazy(() => outline(sprite(rows, DIRT), '#2a1808'))),
  crack: lazy(() => sprite(CRACK, { 1: '#3a2410' })),
  pillar: lazy(() => outline(sprite(PILLAR, { 1: '#5a4a38', 2: '#9a8468', 3: '#d8c8a0' }), '#201810')),
  swipe: lazy(() => sprite(SWIPE, { 1: '#f8f0e8', 2: '#f08840' })),
  hoof: lazy(() => outline(sprite(HOOF, { 1: '#5a3a28', 2: '#a07050', 3: '#d8b090' }), '#200808')),
  impact: lazy(() => sprite(IMPACT, { 1: '#f8c048', 2: '#ffffff', 3: '#f8e8a0', 4: '#ffffff' })),
  impactRed: lazy(() => sprite(IMPACT, { 1: '#e05830', 2: '#f8c048', 3: '#fff0c0', 4: '#ffffff' })),
  drill: DRILL_SIDE.map((rows) => lazy(() => outline(sprite(rows, { 1: '#283048', 2: '#7880a8', 3: '#f8f8ff' }), '#0c0c18'))),
  drillGold: DRILL_SIDE.map((rows) => lazy(() => outline(sprite(rows, { 1: '#603008', 2: '#e8a030', 3: '#fff8d0' }), '#201000'))),
  lance: lazy(() => outline(sprite(LANCE, { 1: '#784010', 2: '#e8a030', 3: '#fff4b0' }), '#281000')),
  sun: lazy(() => outline(sprite(SUN_DISC, { 2: '#e8a028', 3: '#f8d850', 4: '#fff8d8' }), '#a85810')),
  sunPink: lazy(() => outline(sprite(SUN_DISC, { 2: '#e87098', 3: '#f8c070', 4: '#fff8e0' }), '#a83860')),
  streak: lazy(() => outline(sprite(STREAK, { 1: '#3060a8', 2: '#88b8f0', 3: '#ffffff' }), '#081830')),
}
