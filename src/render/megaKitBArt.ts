import { canvasCache, context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the Mega families (`game/megaKitBMoves.ts`,
 * `game/megaKitBSystem.ts`): the sprites their effects blit and their move
 * icons. Only the engine is imported, so `art.ts` can spread the icons in
 * without a cycle.
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

/** High Jump Kick's foot coming down, toes forward (1 shade, 2 skin, 3 light, 4 the strike's shine). */
const FOOT = ['....111..', '...12231.', '...12231.', '..122331.', '.1222331.', '12223331.', '12233331.', '1222222211', '.11111111.']

/** The crash's dust (1 shade, 2 dust, 3 light). */
const DUST = ['...111.....', '.11223111..', '1223332231.', '12333333221', '.1223332221', '..1111111..']

/** A clod of rubble Magnitude throws up (1 shade, 2 earth, 3 light). */
const RUBBLE = ['.11.', '1231', '1221', '.11.']

/** Small digits, 3×5: Magnitude's roll. */
const DIGITS: Record<string, readonly string[]> = {
  '0': ['111', '1.1', '1.1', '1.1', '111'],
  '1': ['.1.', '11.', '.1.', '.1.', '111'],
  '4': ['1.1', '1.1', '111', '..1', '..1'],
  '5': ['111', '1..', '111', '..1', '111'],
  '6': ['111', '1..', '111', '1.1', '111'],
  '7': ['111', '..1', '.1.', '.1.', '.1.'],
  '8': ['111', '1.1', '111', '1.1', '111'],
  '9': ['111', '1.1', '111', '..1', '111'],
}

/** A lava bomb: a dark crust split over the glow (1 crust shade, 2 crust, 3 lava, 4 the hot core). */
const BOMB = ['..1111..', '.122321.', '12233421', '13344321', '12343221', '12234321', '.122221.', '..1111..']
const BOMB_BIG = ['...11111...', '..1223221..', '.122333221.', '12233443321', '12334443221', '13344432221', '12233443321', '12223343221', '.122233221.', '..1222221..', '...11111...']

/** Dizzy Punch's fist: a fluffy ear curled into a fist (1 shade, 2 fur, 3 fluff). */
const EAR_FIST = ['..1111..', '.122221.', '12333321', '12333321', '12333321', '.123321.', '..1221..', '...11...']

/** The dizzy stars round a confused foe, and the stomp's. */
const STAR = ['..1..', '.121.', '12321', '.121.', '..1..']

/** Fairy Wind's glitter: a four-point twinkle. */
const TWINKLE = ['...1...', '...2...', '..121..', '1232321', '..121..', '...2...', '...1...']

/**
 * A blossom of Flabébé's garden: five petals round the heart, on a stem with
 * two leaves (1 petal shade, 2 petal, 3 petal light, 4 heart, 5 heart light,
 * 6 stem, 7 leaf). Florges' and the Eternal Flower's wear their own colors.
 */
const BLOSSOM = [
  '...111...',
  '..12321..',
  '.1122211.',
  '123454321',
  '122444221',
  '.1124211.',
  '.1231321.',
  '.1221221.',
  '..11611..',
  '.77.6.77.',
  '.7776777.',
  '....6....',
]

/** A petal it fires. */
const PETAL = ['.11.', '1221', '1231', '.11.']

/** Venom Drench's glob: a drop of venom with a bubble in it (1 shade, 2 venom, 3 light, 4 the bubble). */
const GLOB = ['...11...', '..1221..', '.122221.', '12234221', '12232221', '12222221', '.122221.', '..1111..']

/** A droplet off the splash. */
const DROP = ['.1.', '121', '.1.']

export const MEGA_B_FX = {
  foot: lazy(() => outline(sprite(FOOT, { 1: '#8a5040', 2: '#e8b890', 3: '#f8e0c8' }), '#382018')),
  rubble: lazy(() => outline(sprite(RUBBLE, { 1: '#6a4a28', 2: '#a07848', 3: '#d8b878' }), '#2a1c10')),
  dust: lazy(() => sprite(DUST, { 1: '#8a7860', 2: '#c8b898', 3: '#f0e4d0' })),
  bomb: lazy(() => outline(sprite(BOMB, { 1: '#382420', 2: '#584038', 3: '#f87828', 4: '#f8e060' }), '#181010')),
  bombBig: lazy(() => outline(sprite(BOMB_BIG, { 1: '#382420', 2: '#584038', 3: '#f87828', 4: '#f8e060' }), '#181010')),
  fist: lazy(() => outline(sprite(EAR_FIST, { 1: '#7a5838', 2: '#b08860', 3: '#f0dcb0' }), '#382818')),
  fistMega: lazy(() => outline(sprite(EAR_FIST, { 1: '#3a2c28', 2: '#584038', 3: '#f0dcb0' }), '#181010')),
  star: lazy(() => sprite(STAR, { 1: '#e8a020', 2: '#f8d848', 3: '#ffffff' })),
  twinkle: lazy(() => sprite(TWINKLE, { 1: '#f088b8', 2: '#f8c8e0', 3: '#ffffff' })),
  blossom: lazy(() => outline(sprite(BLOSSOM, { 1: '#a02838', 2: '#e05868', 3: '#f8a0a8', 4: '#e8a020', 5: '#f8e070', 6: '#3c7830', 7: '#68b048' }), '#28180c')),
  blossomFlorges: lazy(() => outline(sprite(BLOSSOM, { 1: '#c87898', 2: '#f8c8d8', 3: '#ffffff', 4: '#d8a838', 5: '#f8e898', 6: '#3c7830', 7: '#68b048' }), '#28180c')),
  // The Eternal Flower's own colors, as its sheets wear them: night-blue petals round a red heart.
  blossomEternal: lazy(() => outline(sprite(BLOSSOM, { 1: '#202040', 2: '#383868', 3: '#6870a8', 4: '#b82838', 5: '#f05868', 6: '#2c6028', 7: '#58a040' }), '#100818')),
  petal: lazy(() => outline(sprite(PETAL, { 1: '#d84868', 2: '#f898b0', 3: '#ffffff' }), '#501828')),
  glob: lazy(() => outline(sprite(GLOB, { 1: '#582878', 2: '#9858c8', 3: '#d8a8f0', 4: '#c8f0a0' }), '#200c30')),
  drop: lazy(() => sprite(DROP, { 1: '#7838a8', 2: '#c8f0a0' })),
}

const LABELS = canvasCache<string, PixelSprite>()

/** Magnitude's number in its own pixel digits, cached per roll and color: a dark outline round a `color` face. */
export const magnitudeLabel = (mag: number, color: string): PixelSprite => {
  const key = `${mag}:${color}`
  const hit = LABELS.get(key)
  if (hit) return hit
  const chars = String(mag).split('')
  const face = createCanvas(chars.length * 4 - 1, 5)
  const ctx = context2d(face)
  chars.forEach((c, i) => ctx.drawImage(sprite(DIGITS[c] ?? DIGITS['0']!, { 1: color }), i * 4, 0))
  const label = outline(face, '#201810')
  LABELS.set(key, label)
  return label
}

/* ---------------- Move icons ---------------- */

export const MEGA_KIT_B_ICONS = {
  highJumpKick: icon(['.......111', '......1231', '.....12331', '....12331.', '...12331..', '..12331...', '.1221.1.1.', '1221..1...', '121.1.1.1.', '11........'], { 1: '#683028', 2: '#c84838', 3: '#f8c8a8' }),
  magnitude: icon(['....1.....', '...121....', '..12321...', '....1.....', '1111211111', '1222122221', '1221212221', '1212221221', '1222222221', '1111111111'], { 1: '#583820', 2: '#a07848', 3: '#f8d880' }),
  dizzyPunch: icon(['1.1....1.1', '.1..11..1.', '1.1123311.', '...123331.', '..1233331.', '..1233331.', '..1222221.', '...12221..', '....111...'], { 1: '#7a5838', 2: '#b08860', 3: '#f0dcb0' }),
  fairyWind: icon(['....1.....', '....2..11.', '..11211221', '.12222221.', '1221..1...', '121.......', '1221..1...', '.12222221.', '..11211221', '....2..11.'], { 1: '#c04880', 2: '#f8b8d8' }),
  venomDrench: icon(['....11....', '...1221...', '...1221...', '..122221..', '.12233221.', '.12232221.', '1222222221', '1222222221', '.12222221.', '..111111..'], { 1: '#582878', 2: '#9858c8', 3: '#c8f0a0' }),
} as const satisfies Record<string, () => PixelSprite>
