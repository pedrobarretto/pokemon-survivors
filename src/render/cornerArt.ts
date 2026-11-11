import { context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'
import type { SlotSymbol } from '../realm/games/corner.rules'
import { toIconUrl } from './art'

/**
 * Pixel art of the Rocket Game Corner (`realm/games/slots.ts`,
 * `realm/games/sweep.ts`, `ui/cornerCounter.ts`): its token, the slot reels'
 * symbols and Koffing Sweep's cards. Code-authored pixel rows, our own.
 */

const sprite = (rows: readonly string[], palette: Palette) => {
  const w = Math.max(...rows.map((r) => r.length))
  return fromStrings(rows.map((r) => r.padEnd(w, '.')), palette)
}

const outline = (s: PixelSprite, color = '#181018'): PixelSprite => {
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

/** A Game Corner token: a red coin, its gold rim, an R stamped on it. */
const TOKEN = ['...1111...', '..122221..', '.12333321.', '1233444321', '1234334321', '1233443321', '1234334321', '.12333321.', '..122221..', '...1111...']
const TOKEN_PAL = { 1: '#7a5008', 2: '#f8c838', 3: '#d82828', 4: '#300808' }

/** Team Rocket's red seven. */
const SEVEN = ['22222222222', '21111111112', '22222221122', '......21122', '.....21122.', '....21122..', '...21122...', '..21122....', '..21122....', '.21122.....', '.21122.....', '.2222......']

/** A ball: `1` the top's color, `2` its shine, `3` the bottom, `4` the band and outline, `5` the button, `6` marks. */
const BALL = [
  '....4444....',
  '..44111144..',
  '.4121111114.',
  '.4116111611.',
  '411111111114',
  '411114541114',
  '444445554444',
  '433334543334',
  '.4333333334.',
  '.4333333334.',
  '..43333334..',
  '....4444....',
]

/** An Oran Berry: its blue round, a cap and a leaf. */
const ORAN = ['....33....', '...3443...', '..112211..', '.12222221.', '1222222221', '1222222221', '1222222221', '.12222221.', '..111111..']

/** A Magikarp, mid-flop: red body, gold fins and whiskers, a wide eye. */
const KARP = [
  '.....55.......',
  '....5115......',
  '...1111115..5.',
  '..11331111.55.',
  '.1134311111155',
  '51133111111155',
  '.111111111115.',
  '..1661111115..',
  '..56.6111155..',
  '.5....55.55...',
]

const BALL_COLORS: Record<'poke' | 'great' | 'ultra' | 'master', Palette> = {
  poke: { 1: '#e83030', 2: '#ffb0a0', 3: '#f4f4f8', 4: '#201820', 5: '#f8f8f8', 6: '#e83030' },
  great: { 1: '#3070e0', 2: '#a8d0ff', 3: '#f4f4f8', 4: '#201820', 5: '#f8f8f8', 6: '#e83838' },
  ultra: { 1: '#303038', 2: '#808090', 3: '#f4f4f8', 4: '#101010', 5: '#f8f8f8', 6: '#f8d030' },
  master: { 1: '#8040c8', 2: '#d8b0f8', 3: '#f4f4f8', 4: '#200830', 5: '#f8f8f8', 6: '#f070c0' },
}

const SYMBOL_ART: Record<SlotSymbol, () => PixelSprite> = {
  seven: lazy(() => outline(sprite(SEVEN, { 1: '#e82828', 2: '#601010' }), '#200808')),
  master: lazy(() => sprite(BALL, BALL_COLORS.master)),
  ultra: lazy(() => sprite(BALL, BALL_COLORS.ultra)),
  great: lazy(() => sprite(BALL, BALL_COLORS.great)),
  poke: lazy(() => sprite(BALL, BALL_COLORS.poke)),
  oran: lazy(() => outline(sprite(ORAN, { 1: '#2858b8', 2: '#58a0f0', 3: '#386820', 4: '#78b838' }), '#101830')),
  magikarp: lazy(() => outline(sprite(KARP, { 1: '#e85030', 3: '#ffffff', 4: '#202020', 5: '#f8c838', 6: '#f8e0d0' }), '#401008')),
}

/** A slot reel's symbol. */
export const slotSymbol = (s: SlotSymbol) => SYMBOL_ART[s]()

/** Koffing Sweep's card back: a red card with a gold diamond on it. */
const BACK = ['1111111111111111', '1222222222222221', '1233333333333321', '1232222442222321', '1232224554222321', '1232245665422321', '1232456776542321', '1232245665422321', '1232224554222321', '1232222442222321', '1233333333333321', '1222222222222221', '1111111111111111']

/** A pile of coins on a face-up card (1, 2 or 3 of them). */
const COIN = ['.111.', '12221', '12321', '12221', '.111.']

export const SWEEP_ART = {
  back: lazy(() => sprite(BACK, { 1: '#300810', 2: '#c02028', 3: '#e84040', 4: '#a06008', 5: '#f8c838', 6: '#fff0a0', 7: '#ffffff' })),
  coin: lazy(() => sprite(COIN, { 1: '#8a5a08', 2: '#f8c838', 3: '#fff4b0' })),
  token: lazy(() => sprite(TOKEN, TOKEN_PAL)),
}

/** The Game Corner's token as a DOM icon. */
export const tokenIcon = () => toIconUrl('rocket:token', () => SWEEP_ART.token())
