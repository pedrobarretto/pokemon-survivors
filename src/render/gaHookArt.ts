import { canvasCache, context2d, createCanvas, fromStrings, lazy, type Palette, type PixelSprite } from '../engine/pixelart'

/**
 * Pixel art of the hook families (`game/gaHookMoves.ts`): the sprites their
 * effects blit and their move icons. Only the engine is imported, so `art.ts`
 * can spread the icons in without a cycle.
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

/** A chunk of Minior's meteor shell (Power Gem in the shell, the break's shards): 1 dark, 2 mid, 3 light. */
const ROCK = ['.111.', '12231', '12221', '12211', '.111.']

/** A cut gem, its facets light to dark (1 dark edge, 2 body, 3 light facet, 4 shine). */
const PRISM = ['..1..', '.141.', '13321', '12221', '.121.', '..1..']

/** A fist, knuckles forward (right): Fake Out's jab, Hitmonchan's Counter. 1 dark, 2 glove, 3 light. */
const FIST = ['.1111..', '122221.', '1233221', '1222221', '1222221', '.12221.', '..111..']

/** A foot, sole forward (right): Hitmonlee's knee, Hitmontop's spinning kicks. */
const FOOT = ['.111....', '12221...', '12221111', '12222221', '.1233221', '..11111.']

/** A zigzag bolt (Volt Switch). */
const BOLT = ['....11', '...121', '..121.', '.12211', '1122221', '..1221', '..121.', '.121..', '.11...']

/** The plus and the minus Plusle and Minun throw off. */
const PLUS = ['.1.', '111', '.1.']
const MINUS = ['111']

export const HOOK_FX = {
  rock: lazy(() => outline(sprite(ROCK, { 1: '#5a3820', 2: '#a87850', 3: '#d8b088' }), '#2a1808')),
  jab: lazy(() => outline(sprite(FIST, { 1: '#806040', 2: '#f0d0a8', 3: '#ffffff' }), '#302010')),
  glove: lazy(() => outline(sprite(FIST, { 1: '#801818', 2: '#e83838', 3: '#f8a0a0' }), '#300808')),
  foot: lazy(() => outline(sprite(FOOT, { 1: '#704828', 2: '#c89060', 3: '#f0c890' }), '#281808')),
  bolt: lazy(() => outline(sprite(BOLT, { 1: '#c89810', 2: '#f8e858' }), '#504008')),
  plus: lazy(() => outline(sprite(PLUS, { 1: '#f85848' }), '#481010')),
  minus: lazy(() => outline(sprite(MINUS, { 1: '#58a0f8' }), '#102048')),
}

const prisms = canvasCache<string, PixelSprite>()

/** A gem cut in a Core's colors (`MINIOR_CORES`: light, dark), drawn once per color. */
export const prismOf = (light: string, dark: string): PixelSprite => {
  const key = `${light}${dark}`
  const hit = prisms.get(key)
  if (hit) return hit
  const made = outline(sprite(PRISM, { 1: dark, 2: dark, 3: light, 4: '#ffffff' }), '#181828')
  prisms.set(key, made)
  return made
}

/* ---------------- Move icons ---------------- */

export const HOOK_ICONS = {
  bugBuzz: icon(['1.........', '21..1.....', '.21..1....', '.21..21..1', '.21..21..2', '.21..21..2', '.21..21..1', '.21..1....', '21..1.....', '1.........'], { 1: '#386818', 2: '#a8d848' }),
  powerGem: icon(['...1111...', '..123321..', '.12344321.', '1222222221', '.12222221.', '..122221..', '...1221...', '....11....'], { 1: '#782818', 2: '#e04848', 3: '#f8a090', 4: '#ffffff' }),
  fakeOut: icon(['....1111..', '...122221.', '1..1223321', '.1.1222221', '11.1222221', '.1.1222221', '1..122221.', '....1111..'], { 1: '#584838', 2: '#f0d0a8', 3: '#ffffff' }),
  jumpKick: icon(['11........', '121.......', '.121......', '..1211....', '...12221..', '....122221', '....12331.', '...1221...', '..121.....', '..11......'], { 1: '#583818', 2: '#c88858', 3: '#f0c890' }),
  tripleKick: icon(['..11111...', '.1222221..', '12.....21.', '1..111..1.', '1.12221.1.', '1.1...1.1.', '.1.....1..', '..1...1...', '...111....'], { 1: '#783828', 2: '#e89060' }),
  voltSwitch: icon(['.....11...', '....121...', '...121....', '..12211...', '.1222221..', '...1221...', '...121.11.', '..121..121', '..11..1221', '.......11.'], { 1: '#a87808', 2: '#f8e048' }),
  eerieImpulse: icon(['...1111...', '.11....11.', '.1..22..1.', '1..2332..1', '1..2332..1', '.1..22..1.', '.11....11.', '...1111...'], { 1: '#3858c8', 2: '#88b8f8', 3: '#ffffff' }),
} as const satisfies Record<string, () => PixelSprite>
