import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the Rocket Game Corner's prize families
 * (`game/rocketKitMoves.ts`): the sprites their effects blit and their move
 * icons. Only the engine is imported, so `art.ts` can spread the icons in
 * without a cycle.
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

const DITTO = ['...1111...', '..122221..', '.12222221.', '1223223221', '1222222221', '1222332221', '.12222221.', '1122222211', '1111111111']
const BLADE = ['....1111..', '..112221..', '.1222211..', '1222211...', '122211....', '12221.....', '1221......', '.121......', '..11......']
const COINS = ['..1111....', '.122221...', '.133331...', '.122221...', '.1111111..', '..1222221.', '..1333331.', '..1222221.', '...111111.']
const JAWS = ['1.1.1.1.1.', '1212121211', '1222222221', '.12222221.', '..111111..', '..111111..', '.12222221.', '1222222221', '1212121211', '1.1.1.1.1.']

export const ROCKET_KIT_ICONS = {
  transform: icon(DITTO, { 1: '#7850a8', 2: '#c8a0e8', 3: '#181818' }),
  razorWind: icon(BLADE, { 1: '#5878a8', 2: '#e8f0f8' }),
  makeItRain: icon(COINS, { 1: '#886010', 2: '#f8c838', 3: '#fff0a0' }),
  viseGrip: icon(JAWS, { 1: '#383038', 2: '#787078' }),
} as const satisfies Record<string, () => PixelSprite>

/** A falling coin: a face, a turn, its edge and the turn back (four frames, spun as it drops). */
const COIN_FRAMES = [
  ['..1111..', '.122221.', '12233221', '12322321', '12322321', '12233221', '.122221.', '..1111..'],
  ['..111...', '.12221..', '.12321..', '123321..', '123321..', '.12321..', '.12221..', '..111...'],
  ['...11...', '...11...', '..1221..', '..1221..', '..1221..', '..1221..', '...11...', '...11...'],
  ['...111..', '..12221.', '..12321.', '..123321', '..123321', '..12321.', '..12221.', '...111..'],
]

/** One of Mawile's jaws, open (its teeth along the edge); the other is its mirror. */
const JAW = ['..11111111..', '.1222222221.', '122222222221', '1333333333.1', '.4.4.4.4.4..']

/** A wind crescent, pointing right. */
const CRESCENT = ['..1111....', '....1221..', '......121.', '.......121', '.......121', '......121.', '....1221..', '..1111....']

/** Ditto's goo, splashing out of a copy. */
const GOO = ['..11..', '.1221.', '122221', '.1221.', '..11..']

/** Absol's Omen over a doomed foe: a dark crescent eye. */
const OMEN = ['..11111..', '.1222221.', '122333221', '123343321', '122333221', '.1222221.', '..11111..']

export const ROCKET_FX = {
  coin: COIN_FRAMES.map((rows) => lazy(() => outline(sprite(rows, { 1: '#886010', 2: '#f8c838', 3: '#fff0a0' }), '#402800'))),
  jaw: lazy(() => sprite(JAW, { 1: '#282028', 2: '#605860', 3: '#383038', 4: '#f8f8f8' })),
  crescent: lazy(() => sprite(CRESCENT, { 1: '#f8f8ff', 2: '#a8c0e0' })),
  crescentDark: lazy(() => sprite(CRESCENT, { 1: '#e8e0f8', 2: '#5848a0' })),
  goo: lazy(() => sprite(GOO, { 1: '#7850a8', 2: '#c8a0e8' })),
  omen: lazy(() => outline(sprite(OMEN, { 1: '#201838', 2: '#5848a0', 3: '#a898e0', 4: '#f84858' }), '#100818')),
  coinIcon: lazy(() => sprite(COIN_FRAMES[0]!, { 1: '#886010', 2: '#f8c838', 3: '#fff0a0' })),
}
