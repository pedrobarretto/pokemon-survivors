import { canvasCache, context2d, createCanvas, fromStrings, lazy, onCanvasReset, type Palette } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { BiomeId } from '../data/biomes'

/**
 * Infinite procedural ground, one look per biome, generated in cached chunks.
 * Everything is deterministic from world coordinates, so revisiting an area
 * looks the same. Biome changes cross-dissolve with an ordered dither.
 */
const CHUNK = 256
const TILE = 16
const SEED = 1996
/** How far past the view's edges (px) the ground is built ahead of time (`warmScenery` passes it). */
export const GROUND_LOOKAHEAD = 128

const smooth = (t: number) => t * t * (3 - 2 * t)

/** Bilinear value noise in [0, 1). */
const noise = (x: number, y: number, scale: number, seed: number) => {
  const gx = x / scale
  const gy = y / scale
  const x0 = Math.floor(gx)
  const y0 = Math.floor(gy)
  const tx = smooth(gx - x0)
  const ty = smooth(gy - y0)
  const a = hash2(x0, y0, seed)
  const b = hash2(x0 + 1, y0, seed)
  const c = hash2(x0, y0 + 1, seed)
  const d = hash2(x0 + 1, y0 + 1, seed)
  return a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
}

type Rgb = readonly [number, number, number]
/** Three shades of one ground color: base, then the sparse lighter/darker dither pixels. */
type Shades = readonly [Rgb, Rgb, Rgb]

const hex = (h: string): Rgb => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const shades = (a: string, b: string, c: string): Shades => [hex(a), hex(b), hex(c)]

/** Where a decor sprite goes in a 16px tile: `x`, `y` jittered, `dense` inside a thicket (tall grass, graves…). */
type Spot = { x: number; y: number; jx: number; jy: number; wx: number; wy: number; roll: number; dense: boolean }

type GroundStyle = {
  base: Shades
  /** Noise-dense zones (darker meadow, undergrowth, rough rock…). */
  alt: Shades
  path: Shades
  /** Fine noise peaks: sun dapples in the forest, drifts in the snow. */
  spots?: Shades
  /** Paths become staggered stone tiles (graveyard walkways). */
  tiles?: boolean
  /** Noise level above which tiles are `dense` (thickets); lower means more of them. */
  thicket?: number
  /** Builds the biome's decor sprites once and returns how to dress a tile. */
  decor: () => (ctx: CanvasRenderingContext2D, s: Spot) => void
}

const sprite = (rows: readonly string[], palette: Palette) => fromStrings(rows, palette)

/* ---------------- Meadow (Route 1) ---------------- */

const TUFT = ['.1...1.', '121.121', '1221221', '.12221.']
const BLADES = ['1.1', '.1.']
const ROCK = ['.111.', '12221', '12231', '.111.']
const FLOWER = ['.1.', '121', '.1.']

const meadowDecor = () => {
  const tuft = sprite(TUFT, { 1: '#2f7a3a', 2: '#4f9e48' })
  const blades = sprite(BLADES, { 1: '#5a9a40' })
  const rock = sprite(ROCK, { 1: '#6a6458', 2: '#a8a090', 3: '#d8d0c0' })
  const flowers = ['#ffffff', '#f8e048', '#f87890', '#a8c8f8'].map((petal) => sprite(FLOWER, { 1: petal, 2: '#f8b030' }))
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Tall grass patch – the classic encounter tile.
      ctx.drawImage(tuft, s.x + 1, s.y + 3)
      ctx.drawImage(tuft, s.x + 9, s.y + 3)
      ctx.drawImage(tuft, s.x + 5, s.y + 10)
    } else if (s.roll < 0.05) {
      const flower = flowers[Math.floor(hash2(s.wx, s.wy, SEED + 6) * flowers.length)]!
      ctx.drawImage(flower, s.x + s.jx, s.y + s.jy)
      ctx.drawImage(flower, s.x + ((s.jx + 5) % 12), s.y + ((s.jy + 4) % 12))
    } else if (s.roll < 0.2) {
      ctx.drawImage(blades, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.215) {
      ctx.drawImage(rock, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Forest (Viridian Forest) ---------------- */

const BUSH = ['...111...', '.112221..', '12232221.', '122222321', '1222222221', '.11111111.']
const MUSHROOM = ['.111.', '12321', '11111', '.454.']
const LEAVES = ['1..', '.2.', '..1']
const FERN = ['1...1', '.1.1.', '1.1.1', '.111.', '..1..']
const STUMP = ['.111.', '12321', '14441', '14441', '.111.']

const forestDecor = () => {
  const bush = sprite(BUSH, { 1: '#1c4a24', 2: '#2f7032', 3: '#4f9444' })
  const mushroom = sprite(MUSHROOM, { 1: '#902820', 2: '#e04838', 3: '#f8e0d0', 4: '#c8b8a0', 5: '#e8d8c0' })
  const leaves = [
    sprite(LEAVES, { 1: '#c87830', 2: '#e8a040' }),
    sprite(LEAVES, { 1: '#a89030', 2: '#d8c048' }),
  ]
  const fern = sprite(FERN, { 1: '#2a6a30' })
  const stump = sprite(STUMP, { 1: '#4a3018', 2: '#a07848', 3: '#c8a070', 4: '#704c28' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Undergrowth: low bushes and ferns. Anything taller is a real tree (`render/terrain.ts`), which blocks.
      ctx.drawImage(bush, s.x + (s.jx >> 1) - 1, s.y + (s.jy >> 1))
      if (s.roll < 0.4) ctx.drawImage(fern, s.x + 10, s.y + 9)
    } else if (s.roll < 0.035) {
      ctx.drawImage(mushroom, s.x + s.jx, s.y + s.jy)
      ctx.drawImage(mushroom, s.x + ((s.jx + 4) % 12), s.y + ((s.jy + 3) % 12))
    } else if (s.roll < 0.16) {
      ctx.drawImage(leaves[s.roll < 0.1 ? 0 : 1]!, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.22) {
      ctx.drawImage(fern, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.228) {
      ctx.drawImage(stump, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Cave (Mt. Moon) ---------------- */

const PEBBLES = ['1..', '..2', '.1.']
const CRACK = ['1.....', '.1....', '.11...', '...1..', '...11.', '.....1']
const STALAGMITE = ['..1..', '..2..', '.123.', '.123.', '12233', '12223', '.111.']
const CRYSTAL = ['..1...', '.121.1', '.1231.', '1223.1', '12231.', '.111..']

const caveDecor = () => {
  const pebbles = sprite(PEBBLES, { 1: '#4a3e40', 2: '#a89a98' })
  const crack = sprite(CRACK, { 1: '#40363a' })
  const stalagmite = sprite(STALAGMITE, { 1: '#2c2426', 2: '#867878', 3: '#b0a4a0' })
  const crystals = [
    sprite(CRYSTAL, { 1: '#283878', 2: '#5880d8', 3: '#b8d0ff' }),
    sprite(CRYSTAL, { 1: '#582878', 2: '#a058d8', 3: '#e8c0ff' }),
  ]
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Rough ground: rubble and cracks, flat enough to walk over. Real rocks block (`render/terrain.ts`).
      ctx.drawImage(pebbles, s.x + s.jx, s.y + s.jy)
      ctx.drawImage(pebbles, s.x + ((s.jx + 6) % 12), s.y + ((s.jy + 5) % 12))
      if (s.roll < 0.1) ctx.drawImage(crack, s.x + 4, s.y + 6)
    } else if (s.roll < 0.012) {
      ctx.drawImage(crystals[s.jx % 2]!, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.12) {
      ctx.drawImage(pebbles, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.17) {
      ctx.drawImage(crack, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.19) {
      ctx.drawImage(stalagmite, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Snow (Mt. Silver) ---------------- */

const MOUND = ['..111..', '.12221.', '1222223']
const FROST = ['1.1', '.1.', '1.1']
const SNOW_ROCK = ['.111.', '12221', '13341', '.333.']

const snowDecor = () => {
  const mound = sprite(MOUND, { 1: '#f8fcff', 2: '#ffffff', 3: '#b8c8e0' })
  const frost = sprite(FROST, { 1: '#90b0d0' })
  const rock = sprite(SNOW_ROCK, { 1: '#f8fcff', 2: '#ffffff', 3: '#7888a0', 4: '#505c70' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Drifts: snow mounds and frost, flat enough to walk over. Real pines block (`render/terrain.ts`).
      ctx.drawImage(mound, s.x + (s.jx >> 1), s.y + (s.jy >> 1) + 2)
      if (s.roll < 0.4) ctx.drawImage(frost, s.x + 10, s.y + 9)
    } else if (s.roll < 0.06) {
      ctx.drawImage(mound, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.15) {
      ctx.drawImage(frost, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.165) {
      ctx.drawImage(rock, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Tower (Lavender Town graveyard) ---------------- */

const GRAVE = ['..111..', '.12221.', '1233321', '1231321', '1233321', '1233321', '1222221', '4444444']
const CANDLE = ['.1.', '121', '.3.', '343', '343', '555']
const DEAD_TUFT = ['1...1', '.1.1.', '.121.']
const WISP_FLOWER = ['1.1', '.2.', '1.1']

const towerDecor = () => {
  const grave = sprite(GRAVE, { 1: '#383048', 2: '#9890a8', 3: '#c0b8d0', 4: '#463c56' })
  const candle = sprite(CANDLE, { 1: '#f8a030', 2: '#fff0a0', 3: '#e8e0f0', 4: '#c8c0d8', 5: '#504060' })
  const tuft = sprite(DEAD_TUFT, { 1: '#4c4060', 2: '#6c6080' })
  const flower = sprite(WISP_FLOWER, { 1: '#b070c8', 2: '#f0d0ff' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Graves stand in neat rows, one per tile, with a candle now and then.
      ctx.drawImage(grave, s.x + 4, s.y + 4)
      if (s.roll < 0.2) ctx.drawImage(candle, s.x + 12, s.y + 6)
    } else if (s.roll < 0.04) {
      ctx.drawImage(flower, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.16) {
      ctx.drawImage(tuft, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.172) {
      ctx.drawImage(candle, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Styles ---------------- */

const STYLES: Record<BiomeId, GroundStyle> = {
  meadow: {
    base: shades('#8fd068', '#88c862', '#80c05c'),
    alt: shades('#74b452', '#6eac4e', '#67a448'),
    path: shades('#d8c088', '#d0b880', '#c8b078'),
    decor: meadowDecor,
  },
  forest: {
    base: shades('#4a8a40', '#44823c', '#3e7a38'),
    alt: shades('#356a32', '#30622e', '#2b5a2a'),
    path: shades('#a08050', '#98784a', '#8c6c40'),
    spots: shades('#68a84c', '#70b050', '#60a048'),
    thicket: 0.6,
    decor: forestDecor,
  },
  cave: {
    base: shades('#76686a', '#706264', '#6a5c5e'),
    alt: shades('#544848', '#4e4243', '#483c3e'),
    path: shades('#9c8c7c', '#a49484', '#948474'),
    thicket: 0.62,
    decor: caveDecor,
  },
  snow: {
    base: shades('#e4ecf6', '#eef4fa', '#d8e2f0'),
    alt: shades('#d4e0f0', '#dce6f4', '#c8d6ea'),
    path: shades('#a8d0ec', '#c8e4f8', '#98c4e4'),
    spots: shades('#f6faff', '#ffffff', '#eaf2fa'),
    thicket: 0.64,
    decor: snowDecor,
  },
  tower: {
    base: shades('#7a7088', '#746a82', '#6e647c'),
    alt: shades('#625a72', '#5c546c', '#565066'),
    path: shades('#a098ac', '#a8a0b4', '#9890a4'),
    tiles: true,
    thicket: 0.64,
    decor: towerDecor,
  },
}

const decorCache = canvasCache<BiomeId, (ctx: CanvasRenderingContext2D, s: Spot) => void>()

const decorFor = (biome: BiomeId) => {
  let decorate = decorCache.get(biome)
  if (!decorate) decorCache.set(biome, (decorate = STYLES[biome].decor()))
  return decorate
}

const MORTAR = hex('#4c4458')

/** Graveyard walkway: 12x8 stones in staggered rows, split by dark mortar lines. */
const isMortar = (wx: number, wy: number) => {
  const row = Math.floor(wy / 8)
  return wy % 8 === 0 || (wx + (row % 2) * 6) % 12 === 0
}

const pathAt = (wx: number, wy: number, width: number) => Math.abs(noise(wx, wy, 220, SEED + 7) - 0.5) < width

/**
 * `noise` at the `out.length` pixels of world row `wy` starting at `wx0`, hashing
 * each lattice corner once per cell instead of once per pixel. Same arithmetic as
 * `noise`, so the same values to the last bit.
 */
const noiseRow = (out: Float64Array, wx0: number, wy: number, scale: number, seed: number) => {
  const gy = wy / scale
  const y0 = Math.floor(gy)
  const ty = smooth(gy - y0)
  let cell = NaN
  let a = 0
  let b = 0
  let c = 0
  let d = 0
  for (let x = 0; x < out.length; x++) {
    const gx = (wx0 + x) / scale
    const x0 = Math.floor(gx)
    if (x0 !== cell) {
      cell = x0
      a = hash2(x0, y0, seed)
      b = hash2(x0 + 1, y0, seed)
      c = hash2(x0, y0 + 1, seed)
      d = hash2(x0 + 1, y0 + 1, seed)
    }
    const tx = smooth(gx - x0)
    out[x] = a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty
  }
}

/** Rows of noise `buildChunk` reuses: the paths, the dense zones and the spots. */
const pathRow = new Float64Array(CHUNK)
const altRow = new Float64Array(CHUNK)
const spotRow = new Float64Array(CHUNK)

/** One chunk's pixels, shared by every build: each build writes all of them. */
let pixels: ImageData | null = null

/** Paints chunk (cx, cy) of `biome` into `canvas` (a fresh one, or an evicted chunk's: the ground covers every pixel). */
const buildChunk = (biome: BiomeId, cx: number, cy: number, canvas: HTMLCanvasElement) => {
  const style = STYLES[biome]
  const ctx = context2d(canvas)
  const img = (pixels ??= new ImageData(CHUNK, CHUNK))
  const data = img.data
  const ox = cx * CHUNK
  const oy = cy * CHUNK

  // The ground's shades flattened once (base, alt, path, spots; 3 shades of RGB each), out of the pixel loop.
  const { tiles, spots } = style
  const rgb = [style.base, style.alt, style.path, spots ?? style.base].flatMap((shades) => shades.flat())
  for (let y = 0; y < CHUNK; y++) {
    const wy = oy + y
    noiseRow(pathRow, ox, wy, 220, SEED + 7)
    noiseRow(altRow, ox, wy, 96, SEED)
    if (spots) noiseRow(spotRow, ox, wy, 20, SEED + 9)
    for (let x = 0; x < CHUNK; x++) {
      const wx = ox + x
      const path = Math.abs(pathRow[x]! - 0.5) < 0.025
      const r = hash2(wx, wy, SEED + 1)
      const palette = path ? 2 : spots && spotRow[x]! > 0.76 ? 3 : altRow[x]! > 0.55 ? 1 : 0
      // Ordered-ish dither: mostly the base shade with sparse lighter/darker pixels.
      const i = (y * CHUNK + x) * 4
      if (path && tiles && isMortar(wx, wy)) {
        data[i] = MORTAR[0]
        data[i + 1] = MORTAR[1]
        data[i + 2] = MORTAR[2]
      } else {
        const c = palette * 9 + (r < 0.7 ? 0 : r < 0.9 ? 3 : 6)
        data[i] = rgb[c]!
        data[i + 1] = rgb[c + 1]!
        data[i + 2] = rgb[c + 2]!
      }
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  const decorate = decorFor(biome)
  for (let ty = 0; ty < CHUNK / TILE; ty++) {
    for (let tx = 0; tx < CHUNK / TILE; tx++) {
      const wx = ox + tx * TILE
      const wy = oy + ty * TILE
      if (pathAt(wx, wy, 0.04)) continue // keep paths clean
      decorate(ctx, {
        x: tx * TILE,
        y: ty * TILE,
        wx,
        wy,
        dense: noise(wx, wy, 140, SEED + 3) > (style.thicket ?? 0.68),
        roll: hash2(tx + cx * 64, ty + cy * 64, SEED + 2),
        jx: Math.floor(hash2(wx, wy, SEED + 4) * 10),
        jy: Math.floor(hash2(wx, wy, SEED + 5) * 10),
      })
    }
  }
  return canvas
}

const chunks = canvasCache<string, HTMLCanvasElement>()

const chunkKey = (biome: BiomeId, cx: number, cy: number) => `${biome}:${cx},${cy}`

/** Chunks a span of `size` px can touch along one axis. */
const across = (size: number) => Math.ceil(size / CHUNK) + 1

/**
 * How many chunks stay cached for a `w`×`h` view: the view and its lookahead in
 * the biome here, the view in the next one (warming, or the one dissolving out),
 * and a few spare, so walking back and forth doesn't rebuild. About 22 (5.5 MB) on a phone.
 */
const capFor = (w: number, h: number) => across(w + GROUND_LOOKAHEAD * 2) * across(h + GROUND_LOOKAHEAD * 2) + across(w) * across(h) + 4
let cap = capFor(480, 270)

/**
 * Least recently used goes first: a hit moves the chunk to the back, so on-screen chunks are
 * never evicted. A miss past the cap repaints the evicted chunk's canvas instead of making
 * another one, so a long run keeps the same few canvases (and their GPU textures).
 */
const chunkAt = (biome: BiomeId, cx: number, cy: number) => {
  const key = chunkKey(biome, cx, cy)
  let chunk = chunks.get(key)
  if (chunk) chunks.delete(key)
  else {
    let spare: HTMLCanvasElement | undefined
    while (chunks.size >= cap) {
      const oldest = chunks.keys().next().value!
      spare ??= chunks.get(oldest)
      chunks.delete(oldest)
    }
    chunk = buildChunk(biome, cx, cy, spare ?? createCanvas(CHUNK, CHUNK))
  }
  chunks.set(key, chunk)
  return chunk
}

/** Chunk range covering a `w`×`h` view at (camX, camY). */
const chunkSpan = (camX: number, camY: number, w: number, h: number) => ({
  x0: Math.floor(camX / CHUNK),
  y0: Math.floor(camY / CHUNK),
  x1: Math.floor((camX + w) / CHUNK),
  y1: Math.floor((camY + h) / CHUNK),
})

const drawChunks = (ctx: CanvasRenderingContext2D, biome: BiomeId, camX: number, camY: number, w: number, h: number) => {
  const { x0, y0, x1, y1 } = chunkSpan(camX, camY, w, h)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) ctx.drawImage(chunkAt(biome, cx, cy), cx * CHUNK - camX, cy * CHUNK - camY)
  }
}

/* ---------------- Biome dissolve ---------------- */

/** 4x4 Bayer matrix: the order pixels switch over during a dissolve. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** One dither mask per step: step `n` lets `n` of every 16 pixels through. */
const masks = lazy(() =>
  Array.from({ length: 17 }, (_, n) => {
    const c = createCanvas(4, 4)
    const mctx = context2d(c)
    mctx.fillStyle = '#000'
    BAYER.forEach((v, i) => v < n && mctx.fillRect(i % 4, Math.floor(i / 4), 1, 1))
    return c
  }),
)

let scratch: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; patterns: CanvasPattern[] } | null = null
onCanvasReset(
  () => (scratch = null),
  () => scratch,
)

const scratchFor = (w: number, h: number) => {
  if (!scratch || scratch.canvas.width !== w || scratch.canvas.height !== h) {
    const canvas = createCanvas(w, h)
    const ctx = context2d(canvas)
    scratch = { canvas, ctx, patterns: masks().map((m) => ctx.createPattern(m, 'repeat')!) }
  }
  return scratch
}

const mod = (a: number, n: number) => ((a % n) + n) % n

/**
 * Draws the ground under a camera whose top-left is (camX, camY). While `fade`
 * runs (k from 0 to 1), `fade.from` dissolves into `biome` in 16 dithered steps
 * locked to the world grid, so the pattern doesn't swim as the camera moves.
 */
export const drawGround = (
  ctx: CanvasRenderingContext2D,
  camX: number,
  camY: number,
  w: number,
  h: number,
  biome: BiomeId = 'meadow',
  fade: { from: BiomeId; k: number } | null = null,
) => {
  cap = capFor(w, h)
  const step = fade ? Math.max(0, Math.min(16, Math.floor(fade.k * 17))) : 16
  if (!fade || step >= 16) return drawChunks(ctx, biome, camX, camY, w, h)
  drawChunks(ctx, fade.from, camX, camY, w, h)
  if (step === 0) return
  const s = scratchFor(w, h)
  drawChunks(s.ctx, biome, camX, camY, w, h)
  s.ctx.globalCompositeOperation = 'destination-in'
  s.ctx.fillStyle = s.patterns[step]!
  s.ctx.save()
  s.ctx.translate(-mod(camX, 4), -mod(camY, 4))
  s.ctx.fillRect(0, 0, w + 4, h + 4)
  s.ctx.restore()
  s.ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(s.canvas, 0, 0)
}

/**
 * Builds at most one missing chunk of `biome` under the view grown by `margin`
 * px on every side, so chunks are ready before they scroll in (and an upcoming
 * biome before its dissolve starts) and never stall the frame that shows them.
 * True if it built one.
 */
export const warmGround = (biome: BiomeId, camX: number, camY: number, w: number, h: number, margin = 0) => {
  cap = capFor(w, h)
  const { x0, y0, x1, y1 } = chunkSpan(camX - margin, camY - margin, w + margin * 2, h + margin * 2)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (chunks.has(chunkKey(biome, cx, cy))) continue
      chunkAt(biome, cx, cy)
      return true
    }
  }
  return false
}
