import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the regional forms' moves (`game/regionalMoves.ts`): the
 * sprites their effects blit (`render/regionalFx.ts`) and their move icons.
 * Only the engine is imported, so `art.ts` can spread the icons in without a cycle.
 */

const sprite = (rows: readonly string[], palette: Palette) => {
  const w = Math.max(...rows.map((r) => r.length))
  return fromStrings(rows.map((r) => r.padEnd(w, '.')), palette)
}

/** A one-pixel dark outline around a sprite (the icons' look). */
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

/** Three steel claw marks, raking down to the right. */
const CLAWS = [
  '1..1..1...',
  '21.21.21..',
  '.21.21.21.',
  '.221221221',
  '..21.21.21',
  '...1..1..1',
]
/** Galarian Slowbro's shell, the spiral it clamps on its arm. */
const SHELL = [
  '...1111...',
  '..122221..',
  '.12333321.',
  '1233113321',
  '1231221321',
  '1231121321',
  '.12333221.',
  '..122221..',
  '...1111...',
]
/** The poison bolt Shell Side Arm spits from afar: a head and a dripping tail (it flies to the right). */
const BOLT = ['....111..', '..112221.', '1122333321', '..112221.', '....111..']
/** Obstagoon's crossed arms: a thick X. */
const X = [
  '11......11',
  '121....121',
  '.121..121.',
  '..121121..',
  '...1221...',
  '...1221...',
  '..121121..',
  '.121..121.',
  '121....121',
  '11......11',
]
/** The leek lance, pointing right: the white stem in the hand, the green leaves streaming back. */
const LEEK = [
  '22..........',
  '1222........',
  '.1122333333.',
  '..112333334',
  '.1122333333.',
  '1222........',
  '22..........',
]
/** A barb, pointing right. */
const BARB = ['11...', '1221.', '.12331', '1221.', '11...']
/** A toxic glob in the air. */
const GLOB = ['.111.', '12221', '12321', '12221', '.111.']
/** A bubble rising off the pool. */
const BUBBLE = ['.1.', '121', '.1.']
/** A wisp of spite: a pale ghost flame with two hollow eyes. */
const WISP = ['..1..', '.121.', '12221', '13231', '12221', '.121.', '1.1.1']
/** A charging bull's horns, seen from the front, pointing right. */
const HORNS = [
  '1.........',
  '21........',
  '.211......',
  '..2221111.',
  '..22222221',
  '..2221111.',
  '.211......',
  '21........',
  '1.........',
]

export const REGIONAL_FX = {
  claws: lazy(() => sprite(CLAWS, { 1: '#ffffff', 2: '#a8b8c8' })),
  /** The claws with every stack sharpened: a hot white edge. */
  clawsSharp: lazy(() => sprite(CLAWS, { 1: '#ffffff', 2: '#f8f0a0' })),
  shell: lazy(() => outline(sprite(SHELL, { 1: '#583878', 2: '#a070c8', 3: '#e0c8f0' }), '#281838')),
  bolt: lazy(() => sprite(BOLT, { 1: '#582878', 2: '#a048c8', 3: '#e8b0f8' })),
  xDark: lazy(() => sprite(X, { 1: '#181018', 2: '#e83850' })),
  xGuard: lazy(() => outline(sprite(X, { 1: '#e83850', 2: '#f8d0d8' }), '#181018')),
  leek: lazy(() => outline(sprite(LEEK, { 1: '#386818', 2: '#78c040', 3: '#f8f8f0', 4: '#e8e0b8' }), '#203010')),
  barb: lazy(() => outline(sprite(BARB, { 1: '#301838', 2: '#783890', 3: '#f8e0ff' }), '#100810')),
  glob: lazy(() => outline(sprite(GLOB, { 1: '#582878', 2: '#a048c8', 3: '#f0c8ff' }), '#200c28')),
  bubble: lazy(() => sprite(BUBBLE, { 1: '#d8a0f0', 2: '#ffffff' })),
  wisp: lazy(() => sprite(WISP, { 1: '#6858a8', 2: '#c8d0f8', 3: '#281838' })),
  horns: {
    fighting: lazy(() => outline(sprite(HORNS, { 1: '#f8f0d8', 2: '#a07850' }), '#281810')),
    fire: lazy(() => outline(sprite(HORNS, { 1: '#f8e070', 2: '#e85020' }), '#401008')),
    water: lazy(() => outline(sprite(HORNS, { 1: '#e0f8ff', 2: '#3880d8' }), '#102040')),
  },
}

export const REGIONAL_ICONS = {
  metalClaw: icon(CLAWS, { 1: '#e8f0f8', 2: '#6880a0' }),
  shellSideArm: icon(SHELL, { 1: '#583878', 2: '#a070c8', 3: '#e0c8f0' }),
  obstruct: icon(X, { 1: '#181018', 2: '#e83850' }),
  meteorAssault: icon(LEEK, { 1: '#386818', 2: '#78c040', 3: '#f8f8f0', 4: '#e8e0b8' }),
  chloroblast: icon(['....1.....', '.1..1..1..', '..1.2.1...', '...222....', '11223221..', '...222....', '..1.2.1...', '.1..1..1..', '....1.....'], { 1: '#58b030', 2: '#c8f070', 3: '#ffffff' }),
  poisonSting: icon(['..1...1...', '...1.1....', '1..121..1.', '.1123211..', '..12321...', '.1123211..', '1..121..1.', '...1.1....', '..1...1...'], { 1: '#783890', 2: '#c070e0', 3: '#f8e0ff' }),
  toxic: icon(['....1.....', '...121....', '...121....', '..12321...', '.1233321..', '.1223321..', '.1222221..', '..11111...'], { 1: '#482058', 2: '#9038b8', 3: '#e0a8f8' }),
  ragingBull: icon(HORNS, { 1: '#f8f0d8', 2: '#a07850' }),
  bitterMalice: icon(['...11...', '..1221..', '.122221.', '12322321', '12222221', '.122221.', '1.1221.1', '..1..1..'], { 1: '#584898', 2: '#c8d0f8', 3: '#281838' }),
} as const satisfies Record<string, () => PixelSprite>
