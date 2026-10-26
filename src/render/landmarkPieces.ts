import type { BiomeId } from '../data/biomes'
import { MAZE, type LandmarkGround, type LandmarkPiece } from '../data/landmarks'
import type { Ellipse } from '../data/terrain'
import { CENTER, COTTAGE, hedgeRow, MAZE_PATTERNS, RIDGE, RUINS } from '../game/landmarkLayout'
import { mineArch, over, PLACE_PIECES } from './placePieces'
import { cylinder, grid, lambert, limb, noise, outline, put, sculpt, shade, stamp, toSprite, wobble, type Blob, type Grid, type Ramp } from './sculpt'
import { brokenPillar, mountainOf, ROCK_SKINS, type Piece } from './terrain'

/**
 * Landmarks' art (`data/landmarks.ts`), sculpted in code like the map's
 * terrain and dressed per biome: the meadow's cottage is a miner's hut in the
 * cave and a haunted house by the tower; the maze's hedges are rock in the
 * cave and thorns in the graveyard. Built on first sight (or warmed ahead,
 * `warmTerrain`) and cached by `render/terrain.ts`. Pieces whose treasure was
 * taken are built `open`.
 */

/** How a biome dresses its landmarks. */
type Skin = {
  stone: Ramp
  mortar: string
  outline: string
  wood: Ramp
  /** Floorboards (the cottage), and the bare ground under a landmark. */
  plank: Ramp
  dirt: Ramp
  gravel: Ramp
  /** Ivy or moss on walls and logs. */
  vine?: Ramp
  snow?: Ramp
  /** Cobwebs in the corners. */
  web?: string
  hedge: Ramp
  hedgeTop: Ramp
  /** Flowers or berries on the hedges and bushes. */
  bloom?: readonly string[]
  /** Tent canvases (two looks). */
  canvas: readonly [Ramp, Ramp]
  /** Light in a lantern or a window. */
  glow: string
  /** Ore in the mine cart. */
  ore: string
  /** A shore by the water (the pier's, the glitched coast's). */
  sand: Ramp
}

const WOOD: Ramp = ['#3c2414', '#5c3c20', '#7c5430', '#9c6c40', '#b88850']

const SKINS: Record<BiomeId, Skin> = {
  meadow: {
    stone: ['#4a4038', '#6c5e50', '#8e7e6a', '#b0a088', '#d0c4a8'],
    mortar: '#3a322c',
    outline: '#1c1610',
    wood: WOOD,
    plank: ['#5a3c22', '#7a5430', '#9a6c40', '#b48650'],
    dirt: ['#9c7c50', '#b89868', '#ccb07c'],
    gravel: ['#a89c88', '#c4b8a0', '#dcd2bc'],
    vine: ['#2c6a2c', '#44903a', '#68b450'],
    hedge: ['#1a4c20', '#2c7030', '#45983a', '#69b84c'],
    hedgeTop: ['#45983a', '#69b84c', '#94d468'],
    bloom: ['#f87890', '#ffffff', '#f8e048'],
    canvas: [['#8c3418', '#c4501c', '#e8782c', '#f8a048'], ['#1c4c84', '#2c68b0', '#4890d8', '#78b8f0']],
    glow: '#f8d878',
    ore: '#c8a050',
    sand: ['#b8a070', '#d4c08c', '#e8d8a8', '#f4ecc8'],
  },
  forest: {
    stone: ['#2c342e', '#465048', '#626e64', '#828e80', '#a0ac9c'],
    mortar: '#1c241e',
    outline: '#0a100a',
    wood: ['#24160c', '#3c2814', '#583c20', '#74522c', '#8c6838'],
    plank: ['#3c2814', '#583c20', '#74522c', '#8c6838'],
    dirt: ['#5c4428', '#7a5c38', '#8c6c44'],
    gravel: ['#6c6650', '#8a8268', '#a49c80'],
    vine: ['#1c4c20', '#2c6a2c', '#44903a'],
    hedge: ['#0c2812', '#163e1c', '#24582a', '#387838'],
    hedgeTop: ['#24582a', '#387838', '#56984a'],
    bloom: ['#e04838', '#f8e0d0'],
    canvas: [['#2c4418', '#486c24', '#68903c', '#8cb058'], ['#5c2c14', '#844020', '#a85c2c', '#c87c40']],
    glow: '#f8d878',
    ore: '#a89070',
    sand: ['#8c7850', '#a89068', '#c0a880', '#d4c098'],
  },
  cave: {
    stone: ['#2c2220', '#4a3c36', '#6a584c', '#8a7464', '#a8927e'],
    mortar: '#1c1412',
    outline: '#100a08',
    wood: WOOD,
    plank: ['#4a3420', '#644830', '#7c5c3c', '#94704a'],
    dirt: ['#6a5c50', '#7c6e60', '#8c7e70'],
    gravel: ['#5c5050', '#766a68', '#948884'],
    hedge: ['#2c2426', '#4a3e40', '#6c5e5e', '#8c7e7c'],
    hedgeTop: ['#6c5e5e', '#8c7e7c', '#b0a4a0'],
    canvas: [['#5c4c30', '#7c6844', '#9c885c', '#bca878'], ['#4c2c2c', '#6c3c3c', '#8c5250', '#ac6c68']],
    glow: '#f8c058',
    ore: '#88b0f8',
    sand: ['#5c5050', '#766a68', '#948884', '#aca09c'],
  },
  snow: {
    stone: ['#28344a', '#3e4e68', '#5a6e8a', '#7c90ac', '#a2b4cc'],
    mortar: '#1a2234',
    outline: '#0c1422',
    wood: ['#2c1c14', '#4a3020', '#6a4630', '#866044', '#a07c58'],
    plank: ['#4a3020', '#6a4630', '#866044', '#a07c58'],
    dirt: ['#a8b8cc', '#c0cee0', '#d4e0ee'],
    gravel: ['#98a8bc', '#b4c2d4', '#ccd8e6'],
    snow: ['#b8cce4', '#dce8f6', '#f4f8ff', '#ffffff'],
    hedge: ['#0c2420', '#163a34', '#245a4c', '#367a62'],
    hedgeTop: ['#d8e6f6', '#f4f8ff', '#ffffff'],
    canvas: [['#841c1c', '#b02c28', '#d84c40', '#f07860'], ['#1c3c68', '#2c5890', '#4878b8', '#78a0d8']],
    glow: '#a8e8ff',
    ore: '#c8e8ff',
    sand: ['#b8cce4', '#d0dff0', '#e8f0fa', '#ffffff'],
  },
  tower: {
    stone: ['#2c2638', '#4a4258', '#6a6280', '#8e86a4', '#b0a8c4'],
    mortar: '#1c1828',
    outline: '#0c0814',
    wood: ['#1c1424', '#342840', '#4c3c5c', '#6a5878', '#86749a'],
    plank: ['#2c2438', '#3c3048', '#4c405c', '#5e5070'],
    dirt: ['#5c5468', '#6c6478', '#7c7488'],
    gravel: ['#6c6480', '#847c94', '#9c94ac'],
    web: '#d8d0e8',
    hedge: ['#140c1c', '#241830', '#3c2848', '#583c68'],
    hedgeTop: ['#3c2848', '#583c68', '#7a5c8c'],
    bloom: ['#c83850', '#b070c8'],
    canvas: [['#2c1c3c', '#44305c', '#604880', '#8068a4'], ['#3c1c2c', '#5c2c44', '#7c4060', '#a05880']],
    glow: '#c890f8',
    ore: '#b070c8',
    sand: ['#4c4458', '#646078', '#7c7890', '#9894ac'],
  },
}

const piece = (g: Grid, ax: number, ay: number): Piece => ({ sprite: toSprite(g), ax: Math.round(ax), ay: Math.round(ay) })

/* ---------------- Extruded blocks (walls, hedges) ---------------- */

/** A box on the ground, in a landmark's own px. */
type Rect = { x0: number; y0: number; x1: number; y1: number }

const rectOf = (e: Ellipse): Rect => ({ x0: e.x - e.rx, y0: e.y - e.ry, x1: e.x + e.rx, y1: e.y + e.ry })

/** Paints one pixel of a raised block: its ground spot, how high (`e`) of how tall (`h`), and whether it's on top. `null` cuts a hole. */
type BlockPaint = (fx: number, fy: number, e: number, h: number, top: boolean) => string | null | undefined

/**
 * Raises boxes straight up from the ground (only their south faces and tops
 * show) into a sprite whose anchor is (px, py) of the landmark: rows go north
 * to south so nearer faces cover farther ones. `height` may vary per spot
 * (crumbled walls, ragged hedges); `paint` may cut holes (windows).
 */
const extrude = (rects: readonly Rect[], height: (fx: number, fy: number) => number, maxH: number, paint: BlockPaint, px: number, py: number, extra = 0) => {
  const x0 = Math.floor(Math.min(...rects.map((r) => r.x0)))
  const x1 = Math.ceil(Math.max(...rects.map((r) => r.x1)))
  const y0 = Math.floor(Math.min(...rects.map((r) => r.y0)))
  const y1 = Math.ceil(Math.max(...rects.map((r) => r.y1)))
  const pad = 2 + extra
  const g = grid(x1 - x0 + pad * 2, y1 - y0 + maxH + pad * 2)
  const ox = pad - x0
  const oy = pad + maxH - y0
  const holes: number[] = []
  for (let fy = y0; fy < y1; fy++) {
    for (let fx = x0; fx < x1; fx++) {
      if (!rects.some((r) => fx + 0.5 >= r.x0 && fx + 0.5 < r.x1 && fy + 0.5 >= r.y0 && fy + 0.5 < r.y1)) continue
      const h = Math.max(0, Math.round(height(fx, fy)))
      for (let e = 0; e <= h; e++) {
        const c = paint(fx, fy, e, h, e === h)
        const i = (oy + fy - e) * g.w + ox + fx
        if (c === null) {
          g.px[i] = null
          holes.push(i)
        } else if (c) put(g, ox + fx, oy + fy - e, c, e === h ? 2 : 1)
      }
    }
  }
  return { g, ox, oy, anchor: { ax: ox + px, ay: oy + py }, holes }
}

/** Outlines a block, then opens its holes again (the outline would fill a window). */
const outlineBlock = (b: { g: Grid; holes: readonly number[] }, color: string) => {
  outline(b.g, color)
  for (const i of b.holes) if (b.g.px[i] === color) b.g.px[i] = null
}

/** Stone courses with staggered joints, darker at the foot, ivy or snow where the biome has it. */
const masonry = (skin: Skin, seed: number): BlockPaint => (fx, fy, e, h, top) => {
  if (top) {
    if (skin.snow) return shade(skin.snow, 0.7 + noise(fx, fy, seed) * 0.3, fx, fy)
    if (skin.vine && noise(fx >> 2, fy >> 1, seed + 2) < 0.3) return shade(skin.vine, 0.75, fx, fy)
    return shade(skin.stone, 0.88 + (noise(fx >> 1, fy, seed) - 0.5) * 0.2, fx, fy)
  }
  // Ivy hangs from the top in strands; snow sits on the top course.
  if (skin.vine && h - e < 2 + Math.floor(noise(fx, 3, seed + 4) * 9) && noise(fx >> 1, 1, seed + 5) < 0.42) return shade(skin.vine, 0.35 + noise(fx, e, seed) * 0.5, fx, e)
  if (skin.snow && h - e < 2) return shade(skin.snow, 0.6, fx, e)
  const row = Math.floor(e / 4)
  const shift = (row % 2) * 4
  if (e % 4 === 0 || (fx + shift + 1000) % 9 === 0) return skin.mortar
  const brick = noise(Math.floor((fx + shift + 1000) / 9), row, seed)
  return shade(skin.stone, 0.52 + (brick - 0.5) * 0.36 - (e < 3 ? 0.15 : 0) + (noise(fx, e, seed + 1) - 0.5) * 0.1, fx, e)
}

/** Ragged height along a wall: a crumbled top, deeper bites here and there. */
const crumble = (H: number, depth: number, seed: number) => (fx: number) => H - Math.floor(wobble(fx / 7, seed) * depth) - (noise(Math.floor(fx / 11), 0, seed + 3) < 0.18 ? depth : 0)

/* ---------------- The cottage ---------------- */

const { half: CW, depth: CD, door: CDOOR, wall: CT } = COTTAGE

/** A window cut through a wall's face: a hole (the ground behind shows through) with a wooden sill and frame. */
const window_ = (skin: Skin, cx: number, bottom: number, w = 5, h = 8) => (fx: number, e: number): string | null | undefined => {
  const dx = fx - cx
  if (Math.abs(dx) > w + 1 || e < bottom - 1 || e > bottom + h + 1) return undefined
  if (e === bottom - 1) return shade(skin.wood, 0.75, fx, e)
  if (Math.abs(dx) === w + 1 || e === bottom + h + 1) return shade(skin.wood, 0.35, fx, e)
  // A cross bar, broken on one side.
  if ((dx === 0 && e < bottom + h - 2) || (e === bottom + (h >> 1) && dx < 2)) return shade(skin.wood, 0.5, fx, e)
  return null
}

/** The back wall, seen from inside: two windows, a fireplace with its chimney and cobwebs in the tower's. */
const wallN = (skin: Skin): Piece => {
  const H = 26
  const rag = crumble(H, 5, 11)
  const chimney = (fx: number) => fx >= -6 && fx <= 12
  const winA = window_(skin, -30, 11)
  const winB = window_(skin, 34, 11)
  const masonryPaint = masonry(skin, 11)
  const block = extrude(
    [rectOf({ x: 0, y: -CD, rx: CW + CT, ry: CT })],
    (fx) => (chimney(fx) ? H + 14 : Math.abs(fx) > CW - 2 ? H : rag(fx)),
    H + 14,
    (fx, fy, e, h, top) => {
      const south = fy === -CD + CT - 1
      if (south && !top) {
        // (A window's `null` is its hole: not to be read as "no window here".)
        const a = winA(fx, e)
        if (a !== undefined) return a
        const b = winB(fx, e)
        if (b !== undefined) return b
        // The fireplace: a pale stone surround, an arched dark mouth with old ash, a mantel above.
        if (fx >= -3 && fx <= 9 && e < 11) {
          const arch = e >= 8 && (fx - 3) ** 2 > (11 - e) * 9
          if (fx === -3 || fx === 9 || arch) return shade(skin.stone, 0.95, fx, e)
          return e < 2 ? (noise(fx, e, 2) < 0.4 ? '#f87830' : '#3c2c24') : '#0c0808'
        }
        if (fx >= -5 && fx <= 11 && e >= 11 && e < 13) return shade(skin.wood, e === 12 ? 0.85 : 0.45, fx, e)
        if (skin.web && (fx < -CW + 8 || fx > CW - 8) && e > h - 8 && (fx + e) % 3 === 0) return skin.web
      }
      if (top && chimney(fx) && h > H && fx >= -3 && fx <= 9 && fy > -CD - CT + 1 && fy < -CD + CT - 2) return '#140c0c'
      return masonryPaint(fx, fy, e, h, top)
    },
    0,
    -CD,
  )
  outlineBlock(block, skin.outline)
  return piece(block.g, block.anchor.ax, block.anchor.ay)
}

/** A side wall: only its top and its south end show, lower toward the front. */
const wallSide = (skin: Skin, side: -1 | 1): Piece => {
  const x = side * CW
  const { g, anchor } = extrude(
    [rectOf({ x, y: -CD / 2, rx: CT, ry: CD / 2 + CT })],
    (_fx, fy) => 24 - Math.floor(((fy + CD) / CD) * 6) - (noise(Math.floor(fy / 6), side, 5) < 0.25 ? 4 : 0),
    26,
    masonry(skin, 20 + side),
    x,
    0,
  )
  outline(g, skin.outline)
  return piece(g, anchor.ax, anchor.ay)
}

/** One half of the front wall: low and broken so the inside shows, a window in the left half, a door post at the doorway. */
const wallS = (skin: Skin, right: boolean): Piece => {
  const x0 = right ? CDOOR : -CW - CT
  const x1 = right ? CW + CT : -CDOOR
  const rag = crumble(18, 6, right ? 31 : 32)
  const win = window_(skin, -38, 7, 4, 6)
  const paint = masonry(skin, 30)
  const post = right ? CDOOR : -CDOOR - 1
  const block = extrude(
    [{ x0, y0: -CT, x1, y1: CT }],
    (fx) => (fx === post ? 22 : Math.abs(Math.abs(fx) - CW) < 3 ? 20 : rag(fx)),
    22,
    (fx, fy, e, h, top) => {
      if (fx === post) return shade(skin.wood, top ? 0.9 : right ? 0.4 : 0.7, fx, e)
      if (!right && fy === CT - 1 && !top) {
        const w = win(fx, e)
        if (w !== undefined) return w
      }
      return paint(fx, fy, e, h, top)
    },
    right ? Math.round((CW + CDOOR) / 2) : -Math.round((CW + CDOOR) / 2),
    0,
  )
  outlineBlock(block, skin.outline)
  return piece(block.g, block.anchor.ax, block.anchor.ay)
}

/** A stone well with a little wooden roof, a crank and a bucket. */
const well = (skin: Skin): Piece => {
  const g = grid(30, 40)
  const cx = 15
  const ground = 36
  const water: Ramp = skin.snow ? ['#5c80a8', '#88b0d8', '#c8e4f8'] : ['#0c1c30', '#183450', '#2c5478']
  cylinder(g, cx, ground, 10, 9, skin.stone, {
    top: water,
    paint: (x, y, nx, elev, light) => (elev % 4 === 0 || Math.round((nx + 1) * 5 + Math.floor(elev / 4)) % 3 === 0 ? skin.mortar : shade(skin.stone, light + (noise(x, y, 4) - 0.5) * 0.2, x, y)),
  })
  for (const px of [cx - 9, cx + 9]) limb(g, px, ground - 8, px, ground - 26, 1, 1, skin.wood)
  // The roof: two planks meeting over the crank.
  for (let i = 0; i <= 12; i++) {
    for (let y = 0; y < 3; y++) {
      put(g, cx - i, ground - 32 + Math.round(i * 0.5) + y, shade(skin.wood, y === 0 ? 0.85 : 0.55, cx - i, y))
      put(g, cx + i, ground - 32 + Math.round(i * 0.5) + y, shade(skin.wood, y === 0 ? 0.6 : 0.3, cx + i, y))
    }
  }
  if (skin.snow) for (let i = -12; i <= 12; i++) put(g, cx + i, ground - 33 + Math.round(Math.abs(i) * 0.5), skin.snow[3]!)
  limb(g, cx - 9, ground - 22, cx + 9, ground - 22, 0.8, 0.8, skin.wood)
  for (let y = ground - 21; y < ground - 13; y++) put(g, cx + 1, y, '#c8b088')
  stamp(g, ['1111', '1221', '.11.'], { 1: '#5a4a3a', 2: '#8c7c68' }, cx - 1, ground - 13)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** A short run of picket fence, one post leaning, one rail down. */
const fence = (skin: Skin): Piece => {
  const g = grid(48, 20)
  const ground = 16
  for (let x = 4; x <= 44; x += 6) {
    const lean = x === 28 ? 3 : 0
    const tall = x === 16 ? 6 : 11
    limb(g, x, ground, x + lean, ground - tall, 1, 0.9, skin.wood)
    if (skin.snow) put(g, x + lean, ground - tall - 1, skin.snow[3]!)
  }
  for (let x = 4; x <= 44; x++) {
    if (x < 16 || x > 22) put(g, x, ground - 8, shade(skin.wood, 0.7, x, 0))
    put(g, x, ground - 4, shade(skin.wood, 0.45, x, 1))
  }
  outline(g, skin.outline)
  return piece(g, 24, ground - 1)
}

const CRATE = ['111111111111111', '122222222222221', '123333333333321', '134444444444431', '134555555555431', '135455555554531', '135545555545531', '135554555455531', '135555454555531', '135555545555531', '135555454555531', '135554555455531', '134444444444431', '111111111111111']
const CRATE_OPEN = ['.......1111.....', '......122221....', '.....12333321...', '111111111111111.', '166666666666661.', '167777777777761.', '134444444444431.', '135545555545531.', '135554555455531.', '135555454555531.', '135555545555531.', '135555454555531.', '134444444444431.', '111111111111111.']

/** An old wooden crate with cross braces; once opened, its lid leans off and straw shows. */
const crate = (skin: Skin, open: boolean): Piece => {
  const g = grid(19, 18)
  const palette = { 1: skin.outline, 2: skin.wood[4] ?? skin.wood[3]!, 3: skin.wood[3]!, 4: skin.wood[2]!, 5: skin.wood[1]!, 6: '#e8d080', 7: '#b89848' }
  stamp(g, open ? CRATE_OPEN : CRATE, palette, 2, 2)
  if (skin.snow && !open) for (let x = 3; x < 16; x++) put(g, x, 2, skin.snow[3]!)
  return piece(g, 9, 15)
}

const BED = ['1111111111111111111111', '1222222222222222222221', '1233333344444444444421', '1235553344444444444421', '1233333344455444554421', '1222222244444444444421', '1666666666666666666661', '1111111111111111111111', '17................17..', '17................1...']

/** A bed frame with a torn mattress and a faded blanket. */
const bed = (skin: Skin): Piece => {
  const g = grid(26, 14)
  stamp(g, BED, { 1: skin.outline, 2: skin.wood[3]!, 3: '#d8d0c0', 4: '#8c4c58', 5: '#f0e8dc', 6: skin.wood[1]!, 7: skin.wood[2]! }, 2, 2)
  if (skin.web) stamp(g, ['1.1', '.1.', '1.1'], { 1: skin.web }, 19, 3)
  return piece(g, 13, 11)
}

const TABLE = ['..11111111111111..', '.1222222222222221.', '133333333333333331', '144444444444444441', '.11111111111111111', '..15.........15...', '..15..........15..', '..15...........15.', '..11............11']

/** A table, one leg giving way, a cup left on it. */
const table = (skin: Skin): Piece => {
  const g = grid(22, 16)
  stamp(g, TABLE, { 1: skin.outline, 2: skin.wood[4] ?? skin.wood[3]!, 3: skin.wood[3]!, 4: skin.wood[1]!, 5: skin.wood[2]! }, 2, 3)
  stamp(g, ['111', '121', '111'], { 1: '#2c2c3c', 2: '#d8d8e8' }, 6, 1)
  return piece(g, 11, 11)
}

/* ---------------- The tunnel ---------------- */

/** A lantern hanging off a timber, lit. */
const LANTERN = ['.1.', '111', '121', '131', '111']

/**
 * The tunnel's ridge: a long mountain in the biome's skin with a timbered
 * mine mouth at each end, a lantern on each frame and a sign pointing across.
 */
const ridge = (biome: BiomeId, skin: Skin): Piece => {
  const hill = mountainOf(biome, RIDGE.tiers, [[-70, -26, 1], [62, -32, 1], [-22, -40, 3], [34, -36, 2]], 71)
  const g = grid(hill.sprite.width, hill.sprite.height)
  const foot = hill.ay + 4
  for (const side of [-1, 1]) {
    const cx = hill.ax + side * RIDGE.mouthX
    const beam = mineArch(g, cx, foot, 11, false)
    stamp(g, LANTERN, { 1: '#1c1410', 2: skin.glow, 3: '#a87830' }, cx + side * 13 - 1, beam + 1)
    // Rails going in.
    for (let y = foot - 7; y <= foot; y++) for (const dx of [-3, 3]) put(g, cx + dx, y, '#6c6c78')
  }
  // A sign between the mouths: an arrow each way.
  const sx = hill.ax - 34
  const sy = foot + 2
  limb(g, sx, sy, sx, sy - 9, 0.9, 0.9, skin.wood)
  for (let y = sy - 16; y <= sy - 9; y++) for (let x = sx - 8; x <= sx + 8; x++) put(g, x, y, shade(skin.wood, y === sy - 16 ? 0.9 : 0.6, x, y))
  stamp(g, ['.1.......1.', '11111111111', '.1.......1.'], { 1: '#2c1c10' }, sx - 5, sy - 14)
  outline(g, '#140e10')
  return { sprite: over(hill.sprite, g, 0, 0), ax: hill.ax, ay: hill.ay }
}

const CART = ['1111111111111111', '1222222222222221', '1233333333333321', '1344444444444431', '1344444444444431', '.13333333333331.', '.11111111111111.', '..151......151..', '...1........1...']

/** A mine cart on its side of the rails, ore heaped in it. */
const cart = (skin: Skin): Piece => {
  const g = grid(20, 16)
  stamp(g, CART, { 1: '#1c1c24', 2: '#8c8c9c', 3: '#5c5c6c', 4: '#44444e', 5: '#a8a8b8' }, 2, 4)
  sculpt(g, [{ x: 6, y: 5, rx: 3, ry: 2 }, { x: 10, y: 4, rx: 3.5, ry: 2.5 }, { x: 14, y: 5, rx: 3, ry: 2 }], ['#3c3434', skin.ore, '#f8f0e0'], { facets: 2, seed: 3 })
  outline(g, skin.outline)
  return piece(g, 10, 12)
}

/* ---------------- The maze ---------------- */

/** Leafy clumps on a hedge's face and top, flowers or berries here and there; in the cave the "hedge" is rough rock. */
const leafy = (skin: Skin, seed: number): BlockPaint => (fx, fy, e, h, top) => {
  const n = noise(fx >> 1, (fy - e) >> 1, seed)
  if (top) {
    if (skin.snow) return shade(skin.hedgeTop, 0.6 + n * 0.4, fx, fy)
    return shade(skin.hedgeTop, 0.35 + n * 0.6, fx, fy)
  }
  if (skin.snow && h - e < 2 + (noise(fx, 2, seed) < 0.4 ? 1 : 0)) return shade(skin.snow, 0.8, fx, e)
  if (skin.bloom && e > 2 && noise(fx, e, seed + 5) < 0.018) return skin.bloom[Math.floor(noise(fx, e, seed + 6) * skin.bloom.length)]!
  const l = 0.42 + (n - 0.5) * 0.55 - (e < 3 ? 0.18 : 0) + (e / Math.max(1, h)) * 0.2
  // Dark gaps between the clumps.
  return noise(fx, (fy - e) >> 1, seed + 7) < 0.08 ? skin.hedge[0]! : shade(skin.hedge, l, fx, e)
}

/** One row line of a maze's hedges (`hedgeRow`), topiary balls on the posts at its way in. */
const hedge = (skin: Skin, variant: number): Piece => {
  const pattern = Math.floor(variant / 8) % MAZE.patterns
  const row = variant % 8
  const S = MAZE.cell
  const rowY = -MAZE.size * S + row * S
  const rects = hedgeRow(MAZE_PATTERNS[pattern]!, row).map(rectOf)
  const H = 15
  const { g, ox, oy, anchor } = extrude(rects, (fx, fy) => H + Math.round(noise(fx >> 1, fy >> 2, 9 + pattern) * 2), H + 2, leafy(skin, 40 + row), 0, rowY, 8)
  if (row === MAZE.size) {
    // Topiary balls crown the two posts of the way in.
    for (const x of [-S / 2, S / 2]) sculpt(g, [{ x: ox + x + 0.5, y: oy + rowY - H - 5, rx: 6, ry: 6 }], skin.snow ? skin.hedgeTop : skin.hedge, { tag: 9, seed: 4 })
  }
  outline(g, skin.outline)
  return piece(g, anchor.ax, anchor.ay)
}

/* ---------------- The ruins ---------------- */

/** Unown glyphs carved in the standing stones: `1` the carving, `2` the eye. */
const GLYPHS: readonly (readonly string[])[] = [
  ['..1..', '.1.1.', '1.2.1', '.1.1.', '1...1'],
  ['111..', '1.2.1', '111..', '1...1', '1111.'],
  ['.111.', '1.2..', '1....', '1...1', '.111.'],
  ['1...1', '1.2.1', '1...1', '1...1', '.111.'],
  ['11111', '..1..', '.121.', '..1..', '..1..'],
  ['.111.', '1...1', '1.2.1', '1...1', '.111.'],
  ['1...1', '.1.1.', '..2..', '.1.1.', '1...1'],
  ['1....', '1.2..', '1....', '1....', '11111'],
]

const RUNE = '#68f0f8'

/** A standing stone with an Unown glyph carved in it; once the altar wakes, the glyph glows. */
const menhir = (skin: Skin, variant: number, open: boolean): Piece => {
  const g = grid(20, 36)
  const cx = 10
  const ground = 33
  const stone = ROCK_RAMP(skin)
  const lean = ((variant % 3) - 1) * 0.6
  lathe2(g, cx, ground, 26, (t) => 5.6 - t * 1.2 - (t > 0.86 ? (t - 0.86) * 24 : 0), lean, stone)
  const glyph = GLYPHS[variant % GLYPHS.length]!
  stamp(g, glyph, { 1: open ? RUNE : stone[0]!, 2: open ? '#ffffff' : stone[1]! }, cx - 2 + Math.round(lean * 0.4), ground - 19)
  for (let dx = -6; dx <= 6; dx++) {
    if (skin.vine && noise(dx, variant, 3) < 0.6) put(g, cx + dx, ground + (Math.abs(dx) > 4 ? 0 : 1), shade(skin.vine, 0.5, cx + dx, ground))
    if (skin.snow && noise(dx, variant, 4) < 0.7) put(g, cx + dx, ground + (Math.abs(dx) > 4 ? 0 : 1), skin.snow[2]!)
  }
  if (skin.snow) for (let dx = -3; dx <= 3; dx++) put(g, cx + dx + Math.round(lean), ground - 26 - (Math.abs(dx) < 2 ? 1 : 0), skin.snow[3]!)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** The stone the ruins are made of: the cottage's in most biomes. */
const ROCK_RAMP = (skin: Skin) => skin.stone

/** A leaning solid of revolution (a standing stone): `radius(t)` its half-width from foot (0) to top (1), `lean` px per height. */
const lathe2 = (g: Grid, cx: number, ground: number, height: number, radius: (t: number) => number, lean: number, ramp: Ramp) => {
  for (let e = 0; e <= height; e++) {
    const t = e / height
    const r = radius(t)
    if (r <= 0) continue
    const x0 = cx + (e / height) * lean * 4
    for (let x = Math.floor(x0 - r); x <= Math.ceil(x0 + r); x++) {
      const nx = (x + 0.5 - x0) / r
      if (Math.abs(nx) > 1) continue
      const nz = Math.sqrt(1 - nx * nx)
      const top = radius(Math.min(1, t + 1 / height)) <= 0.5
      put(g, x, ground - e, shade(ramp, lambert(nx * 0.9, top ? -0.6 : -0.15, nz) + (noise(x, e >> 1, 7) - 0.5) * 0.18, x, e))
    }
  }
}

/** The ruins' altar: a tablet with a great Unown eye on a low dais; once woken, the eye glows. */
const altar = (skin: Skin, open: boolean): Piece => {
  const g = grid(36, 40)
  const cx = 18
  const ground = 36
  const stone = ROCK_RAMP(skin)
  const dais = extrude([{ x0: -14, y0: -6, x1: 14, y1: 4 }], () => 4, 4, (fx, fy, e, _h, top) => shade(stone, top ? 0.8 + (noise(fx, fy, 2) - 0.5) * 0.2 : e === 0 ? 0.3 : 0.5, fx, fy), 0, 0)
  // Copy the dais in (its anchor at the tablet's foot).
  for (let y = 0; y < dais.g.h; y++) for (let x = 0; x < dais.g.w; x++) {
    const c = dais.g.px[y * dais.g.w + x]
    if (c) put(g, x - dais.anchor.ax + cx, y - dais.anchor.ay + ground, c)
  }
  // The tablet: square shoulders, a rounded top.
  for (let e = 4; e <= 28; e++) {
    const half = e > 22 ? Math.round(Math.sqrt(Math.max(0, 36 - (e - 22) ** 2)) + 3) : 9
    for (let dx = -half; dx <= half; dx++) {
      const light = dx < -half + 2 ? 0.85 : dx > half - 2 ? 0.28 : 0.55
      put(g, cx + dx, ground - 3 - e, shade(stone, light + (noise(cx + dx, e, 5) - 0.5) * 0.14, cx + dx, e))
    }
  }
  const eye = ['..11111..', '.1.....1.', '1..111..1', '1.12221.1', '1..111..1', '.1.....1.', '..11111..', '....1....', '...1.1...']
  stamp(g, eye, { 1: open ? RUNE : stone[0]!, 2: open ? '#ffffff' : stone[1]! }, cx - 4, ground - 27)
  if (skin.snow) for (let dx = -6; dx <= 6; dx++) put(g, cx + dx, ground - 32 + (Math.abs(dx) > 4 ? 1 : 0), skin.snow[3]!)
  if (skin.vine) for (const dx of [-9, -8, 9, 8]) for (let e = 4; e < 4 + ((dx * 7) & 7); e++) put(g, cx + dx, ground - 3 - e, shade(skin.vine, 0.5, dx, e))
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/* ---------------- The camp ---------------- */

/**
 * An A-frame tent seen from the front: the canvas planes run back from the
 * ridge, the door flap tied open on the dark inside, guy lines to the pegs
 * and a rip or two (nobody has camped here for a while).
 */
const tent = (skin: Skin, variant: number): Piece => {
  const g = grid(56, 44)
  const cx = 28
  const ground = 38
  const canvas = skin.canvas[variant % 2]!
  const H = 24
  const W = 18
  const depth = 12
  // The planes: the front triangle swept back (up on screen), lit on the left.
  for (let t = depth; t >= 1; t--) {
    for (let y = ground - H; y <= ground; y++) {
      const half = ((y - (ground - H)) / H) * W
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const left = x < cx
        const stripe = (t + 1) % 6 < 1
        const c = shade(canvas, (left ? 0.72 : 0.32) - (stripe ? 0.18 : 0), x, y)
        put(g, x, y - t, skin.snow && y - (ground - H) < 3 + (t % 3) ? skin.snow[2]! : c)
      }
    }
  }
  // The front: canvas with a hem, the open door, the flap tied back.
  for (let y = ground - H; y <= ground; y++) {
    const half = ((y - (ground - H)) / H) * W
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      const door = ((y - (ground - H + 7)) / (H - 7)) * 7
      const inDoor = y > ground - H + 7 && Math.abs(x + 0.5 - cx) < door
      const flap = !inDoor && x > cx && x < cx + door + 4 && y > ground - H + 9
      put(g, x, y, inDoor ? (y > ground - 2 ? '#2c2018' : '#120c0c') : flap ? shade(canvas, 0.9, x, y) : shade(canvas, 0.55 + (y === ground ? -0.25 : 0), x, y))
    }
  }
  // Poles and guy lines.
  limb(g, cx, ground - H - 2, cx, ground - H + 1, 0.8, 0.8, skin.wood)
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 10; i++) put(g, Math.round(cx + side * (W - 4 + i * 0.8)), Math.round(ground - 10 + i), '#c8bca8')
    stamp(g, ['1', '1'], { 1: skin.wood[1]! }, cx + side * (W + 5), ground)
  }
  // A rip in the canvas.
  stamp(g, ['1.', '11', '.1'], { 1: '#120c0c' }, cx - 9, ground - H + 4 - 6)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** The campfire's stone ring and charred logs; the flame and smoke are drawn live (`render/landmarks.ts`). */
const campfire = (skin: Skin): Piece => {
  const g = grid(22, 14)
  const cx = 11
  const ground = 10
  const stones: Blob[] = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2
    return { x: cx + Math.cos(a) * 8, y: ground - 1 + Math.sin(a) * 3.2, rx: 2.4, ry: 1.8 }
  }).sort((a, b) => a.y - b.y)
  sculpt(g, stones, skin.stone, { facets: 2, seed: 5 })
  limb(g, cx - 5, ground, cx + 4, ground - 3, 1.2, 1, ['#1c1410', '#3c2c20', '#5c4430'])
  limb(g, cx + 5, ground, cx - 4, ground - 3, 1.2, 1, ['#1c1410', '#3c2c20', '#5c4430'])
  for (const [x, y] of [[cx - 1, ground - 2], [cx + 2, ground - 1], [cx, ground]] as const) put(g, x, y, '#f87830')
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

type LogSkin = { bark: Ramp; ring: Ramp; outline: string; moss?: Ramp; snow?: Ramp; cap?: readonly [string, string] }

/**
 * A log lying east to west: bark shaded round, the cut end showing its rings,
 * moss or snow along the top and, in the forest, mushrooms on its side.
 */
export const logPiece = (skin: LogSkin, length: number, r: number, seed: number): Piece => {
  const w = length + 6
  const h = Math.ceil(r * 2) + 8
  const g = grid(w, h)
  const ground = h - 3
  const x0 = 3
  const x1 = x0 + length - 1
  for (let x = x0; x <= x1; x++) {
    for (let y = ground - Math.ceil(r * 2); y <= ground; y++) {
      const ny = (y + 0.5 - (ground - r)) / r
      if (Math.abs(ny) > 1) continue
      const nz = Math.sqrt(1 - ny * ny)
      const top = ny < -0.55
      const groove = (x + Math.floor(noise(x >> 2, 0, seed) * 3)) % 5 === 0
      let c = shade(skin.bark, lambert(0, ny, nz) - (groove ? 0.2 : 0) + (noise(x, y, seed) - 0.5) * 0.12, x, y)
      if (top && skin.snow) c = shade(skin.snow, 0.8, x, y)
      else if (top && skin.moss && noise(x >> 2, 0, seed + 1) < 0.6) c = shade(skin.moss, 0.6 + (noise(x, y, seed) - 0.5) * 0.3, x, y)
      put(g, x, y, c)
    }
  }
  // The cut end, rings and all.
  const ex = x1
  for (let y = ground - Math.ceil(r * 2); y <= ground; y++) {
    for (let x = ex - Math.ceil(r * 0.5); x <= ex + Math.ceil(r * 0.5); x++) {
      const dx = (x + 0.5 - ex) / (r * 0.5)
      const dy = (y + 0.5 - (ground - r)) / r
      const d = Math.sqrt(dx * dx + dy * dy)
      if (d > 1) continue
      put(g, x, y, d > 0.82 ? skin.bark[1]! : Math.floor(d * 4) % 2 === 0 ? skin.ring[2]! : skin.ring[1]!)
    }
  }
  if (skin.cap) for (const mx of [x0 + 5, x0 + 9]) stamp(g, ['.11.', '1221', '.33.'], { 1: skin.cap[0], 2: skin.cap[1], 3: '#e8e0c8' }, mx, ground - 3)
  outline(g, skin.outline)
  return piece(g, x0 + length / 2, ground)
}

/** Each biome's logs: mossy, snowy, purple in the graveyard, mushroom-capped in the forest. */
export const LOG_SKINS: Record<BiomeId, LogSkin> = {
  meadow: { bark: ['#3c2414', '#5c3c20', '#7c5430', '#9c6c40'], ring: ['#a07040', '#c89860', '#e0b880'], outline: '#1c1008', moss: ['#3a7a30', '#58a040', '#80c058'] },
  forest: { bark: ['#24160c', '#3c2814', '#583c20', '#74522c'], ring: ['#7c5c34', '#a07848', '#c0985c'], outline: '#0c0804', moss: ['#24582a', '#3c7c38', '#5c9c48'], cap: ['#902820', '#e04838'] },
  cave: { bark: ['#2c2426', '#4a3e40', '#6c5e5e', '#8c7e7c'], ring: ['#6c5e5e', '#8c7e7c', '#b0a4a0'], outline: '#140e10', cap: ['#286078', '#68c8e8'] },
  snow: { bark: ['#2c1c14', '#4a3020', '#6a4630', '#866044'], ring: ['#866044', '#a88060', '#c8a07c'], outline: '#0c1422', snow: ['#b8cce4', '#dce8f6', '#f4f8ff', '#ffffff'] },
  tower: { bark: ['#1c1424', '#342840', '#4c3c5c', '#6a5878'], ring: ['#4c3c5c', '#6a5878', '#8a789a'], outline: '#0c0814', cap: ['#582878', '#b070c8'] },
}

const PACK = ['...1111...', '..122221..', '.12333321.', '1233333321', '1244444421', '1245555421', '1244444421', '1233333321', '1233333321', '.11111111.']
const PACK_OPEN = ['..........', '..........', '.11111111.', '1266666621', '1244444421', '1245555421', '1244444421', '1233333321', '1233333321', '.11111111.']

/** A yellow backpack left by the fire; opened, its flap is thrown back. */
const pack = (skin: Skin, open: boolean): Piece => {
  const g = grid(16, 14)
  stamp(g, open ? PACK_OPEN : PACK, { 1: skin.outline, 2: '#f8d048', 3: '#e0a828', 4: '#b07818', 5: '#f8f0c0', 6: '#2c1c10' }, 3, 2)
  if (open) stamp(g, ['11', '22'], { 1: '#f8f8f8', 2: '#9050c0' }, 12, 9)
  return piece(g, 8, 11)
}

/* ---------------- The games' nods ---------------- */

/** A piece mirrored left to right (the landmark's flipped variant), its anchor with it. */
const mirrored = (g: Grid, ax: number, ay: number): Piece => {
  const m = grid(g.w, g.h)
  for (let y = 0; y < g.h; y++) {
    for (let x = 0; x < g.w; x++) {
      const c = g.px[y * g.w + x]
      if (c) put(m, g.w - 1 - x, y, c)
    }
  }
  return piece(m, g.w - 1 - ax, ay)
}

/**
 * A box seen from the south and above, the way the map shows everything: its
 * south face (`face(i, e)`, `e` up its height) and its top (`top(i, j)`, `j`
 * back from the south edge). (x, y) is the south face's bottom-left pixel.
 */
const slab = (g: Grid, x: number, y: number, w: number, d: number, h: number, top: (i: number, j: number) => string | null, face: (i: number, e: number) => string | null) => {
  for (let e = 0; e < h; e++) {
    for (let i = 0; i < w; i++) {
      const c = face(i, e)
      if (c) put(g, x + i, y - e, c)
    }
  }
  for (let j = 0; j < d; j++) {
    for (let i = 0; i < w; i++) {
      const c = top(i, j)
      if (c) put(g, x + i, y - h - j, c)
    }
  }
}

const SNORLAX_BODY: Ramp = ['#0c2630', '#16404c', '#225a66', '#327680', '#4c929a']
const SNORLAX_CREAM: Ramp = ['#8c7c5c', '#b8a47c', '#dccca0', '#f4ead0']

/**
 * The Snorlax asleep across the path, on its back: the great round belly up,
 * arms folded on it, its feet (pads and claws) toward the viewer and the head
 * at the far end, eyes shut and a fang showing. Snow settles on it in the
 * snow, a leaf in the forest. The Zzz float over it live (`render/landmarks.ts`).
 */
const snorlaxPiece = (skin: Skin, variant: number): Piece => {
  const g = grid(66, 52)
  const cx = 33
  const ground = 46
  // The head and the ears first: the body covers its lower edge.
  for (const side of [-1, 1]) stamp(g, side < 0 ? ['1..', '11.', '111'] : ['..1', '.11', '111'], { 1: SNORLAX_BODY[2]! }, cx + side * 9 - 1, ground - 40)
  sculpt(g, [{ x: cx, y: ground - 31, rx: 13, ry: 8 }], SNORLAX_BODY, { seed: 4, tag: 0 })
  sculpt(g, [{ x: cx, y: ground - 32, rx: 9, ry: 4.5 }], SNORLAX_CREAM, { seed: 5, tag: 2, seams: false })
  // Shut eyes, a closed mouth with its fangs.
  for (const ex of [cx - 6, cx + 3]) for (let i = 0; i < 4; i++) put(g, ex + i, ground - 34 + (i === 0 || i === 3 ? 0 : -1), '#2c2018')
  for (let x = cx - 3; x <= cx + 3; x++) put(g, x, ground - 30, '#3c2820')
  put(g, cx - 3, ground - 31, '#ffffff')
  put(g, cx + 3, ground - 31, '#ffffff')
  // The body, the arms folded on it, the belly.
  sculpt(g, [{ x: cx, y: ground - 14, rx: 26, ry: 15 }], SNORLAX_BODY, { seed: 1, tag: 4 })
  sculpt(g, [{ x: cx - 21, y: ground - 19, rx: 6, ry: 5 }, { x: cx + 21, y: ground - 19 + (variant % 2), rx: 6, ry: 5 }], SNORLAX_BODY, { seed: 2, tag: 6 })
  sculpt(g, [{ x: cx, y: ground - 15, rx: 18, ry: 10.5 }], SNORLAX_CREAM, { seed: 3, tag: 9, seams: false })
  for (const side of [-1, 1]) for (let i = 0; i < 3; i++) put(g, cx + side * (16 + i), ground - 22 + i, SNORLAX_CREAM[3]!)
  // The feet toward us: cream soles with a brown pad, three claws each.
  sculpt(g, [{ x: cx - 12, y: ground - 4, rx: 7.5, ry: 5.5 }, { x: cx + 12, y: ground - 4, rx: 7.5, ry: 5.5 }], SNORLAX_CREAM, { seed: 6, tag: 11 })
  for (const side of [-1, 1]) {
    const fx = cx + side * 12
    sculpt(g, [{ x: fx, y: ground - 3, rx: 3.6, ry: 2.6 }], ['#6c4c2c', '#8c6438', '#a87c48'], { seed: 7, tag: 14, seams: false })
    for (const dx of [-3, 0, 3]) put(g, fx + dx, ground - 9, '#fffaf0')
  }
  if (skin.snow) {
    for (let dx = -9; dx <= 9; dx++) if (noise(dx, 1, 8) < 0.75) put(g, cx + dx, ground - 25 + (Math.abs(dx) > 6 ? 1 : 0), skin.snow[3]!)
    for (let dx = -5; dx <= 5; dx++) put(g, cx + dx, ground - 39 + (Math.abs(dx) > 3 ? 1 : 0), skin.snow[2]!)
  } else if (skin.vine) stamp(g, ['.11', '121', '11.'], { 1: skin.vine[1]!, 2: skin.vine[0]! }, cx + 4, ground - 21)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

const WALL: Ramp = ['#a8a090', '#d0c8b8', '#ece6d8', '#fcf8f0']
const ROOF: Ramp = ['#781810', '#a82820', '#d03c30', '#f06050']
const GLASS = { dark: '#3c5c78', mid: '#88c0e8', light: '#c8ecff', off: '#4c6878' } as const

/**
 * A Pokémon Center: white walls with the red band, a hipped red roof and the
 * Poké Ball over the glass doors, Nurse Joy behind them and Chansey by the
 * door. Once it has healed (`open`), the lights are off and Chansey has gone in.
 */
const centerPiece = (skin: Skin, open: boolean): Piece => {
  const { half: W, depth: D } = CENTER
  const H = 22
  const g = grid(W * 2 + 14, D + H + 24)
  const ox = W + 7
  const oy = D + H + 18
  const lit = open ? GLASS.off : GLASS.mid
  slab(
    g,
    ox - W,
    oy - 1,
    W * 2,
    0,
    H,
    () => null,
    (i, e) => {
      const fx = i - W
      if (e < 2) return shade(skin.stone, e === 0 ? 0.3 : 0.6, i, e)
      // The sliding doors: a frame, two panes, the light inside.
      if (Math.abs(fx) <= 9 && e <= 15) {
        if (Math.abs(fx) === 9 || e === 15) return '#4c4c5c'
        if (fx === 0) return '#6c6c7c'
        return (fx + e) % 9 === 0 && !open ? GLASS.light : e === 2 ? GLASS.dark : lit
      }
      for (const wx of [-29, 29]) {
        const dx = fx - wx
        if (Math.abs(dx) > 7 || e < 6 || e > 13) continue
        if (Math.abs(dx) === 7 || e === 6 || e === 13 || e === 10) return '#5c5c6c'
        return (dx + e) % 7 === 0 && !open ? GLASS.light : lit
      }
      // The red band round the walls.
      if (e === 17 || e === 18) return ROOF[2]!
      return shade(WALL, 0.72 - (i / (W * 2)) * 0.25 + (noise(i, e >> 2, 9) - 0.5) * 0.06, i, e)
    },
  )
  // The hipped roof over the eaves: the south slope facing us, the hips at the ends, the north slope past the ridge.
  const R = 7
  const S = D / 2 + R
  const N = D / 2 - R
  const eave = oy - H
  const ridge = eave - S
  const back = ridge - N
  const full = W + 3
  const pitch = 0.55
  for (let row = back; row <= eave; row++) {
    for (let x = -full; x < full; x++) {
      const south = row >= ridge && Math.abs(x + 0.5) <= full - (eave - row) * pitch
      const north = row < ridge && Math.abs(x + 0.5) <= full - S * pitch + (ridge - row) * ((S * pitch) / N)
      let c: string
      if (row === ridge && Math.abs(x + 0.5) <= full - S * pitch) c = skin.snow ? skin.snow[3]! : '#f89888'
      else if (south) {
        const r = eave - row
        const band = Math.floor(r / 4)
        const seam = r % 4 === 0 || (x + 400 + (band % 2) * 4) % 8 === 0
        c = r === 0 ? ROOF[0]! : skin.snow && r > 2 && (r > S - 7 || noise(x >> 2, r >> 1, 3) < 0.3 + (r / S) * 0.4) ? shade(skin.snow, 0.75 + noise(x >> 1, r, 3) * 0.25, x, r) : seam ? ROOF[1]! : shade(ROOF, 0.68 - (x + full) * 0.002, x, r)
      } else if (north) c = skin.snow ? skin.snow[1]! : shade(ROOF, 0.3, x, row)
      else c = skin.snow ? skin.snow[x < 0 ? 2 : 1]! : x < 0 ? shade(ROOF, 0.5, x, row) : ROOF[1]!
      put(g, ox + x, row, c)
    }
  }
  // Nurse Joy behind the right pane: pink hair in two loops, a white cap.
  if (!open) stamp(g, ['.3.', '414', '121', '414', '151', '.5.', '.5.'], { 1: '#f0a8c0', 2: '#f8d8c0', 3: '#ffffff', 4: '#e868a0', 5: '#f8f0f8' }, ox + 3, oy - 13)
  // The Poké Ball on the roof, over the door.
  const by = eave - 6
  for (let y = -6; y <= 6; y++) {
    for (let x = -6; x <= 6; x++) {
      const d = x * x + y * y
      if (d > 40) continue
      const c = d > 30 ? '#1c1c24' : Math.abs(y) < 1 ? '#1c1c24' : y < 0 ? (x + y < -6 ? '#f89080' : '#e83828') : x + y < -2 ? '#ffffff' : '#d8d8e0'
      put(g, ox + x, by + y, c)
    }
  }
  for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) put(g, ox + x, by + y, x * x + y * y <= 1 ? '#ffffff' : '#1c1c24')
  // Chansey by the door: round and pink, its egg in the pouch.
  if (!open) {
    const chx = ox + 15
    const chy = oy - 1
    sculpt(g, [{ x: chx + 0.5, y: chy - 6, rx: 5.5, ry: 6 }], ['#b05c70', '#e08898', '#f8b0c0', '#ffd8e0'], { seed: 12, tag: 20 })
    stamp(g, ['1...1', '11.11'], { 1: '#e08898' }, chx - 2, chy - 14)
    stamp(g, ['1.1'], { 1: '#2c1c20' }, chx - 1, chy - 9)
    stamp(g, ['.222.', '21112', '.222.'], { 1: '#ffffff', 2: '#f8e0e8' }, chx - 2, chy - 5)
  }
  outline(g, skin.outline)
  return piece(g, ox, oy)
}

/** Team Rocket's R: red, edged white. */
const ROCKET_R = ['111111.', '11...11', '11...11', '111111.', '11.11..', '11..11.', '11...11']

/**
 * Team Rocket's tent: an A-frame in black canvas, the red R on its front, the
 * flap laced shut, guy lines out to its pegs.
 */
const rocketTent = (skin: Skin): Piece => {
  const g = grid(60, 50)
  const cx = 30
  const ground = 44
  const canvas: Ramp = ['#0c0a10', '#1c1820', '#2c2834', '#423c4c', '#5c5468']
  const H = 30
  const W = 20
  for (let t = 14; t >= 1; t--) {
    for (let y = ground - H; y <= ground; y++) {
      const half = ((y - (ground - H)) / H) * W
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const c = shade(canvas, (x < cx ? 0.7 : 0.3) - ((t + 1) % 7 < 1 ? 0.15 : 0), x, y)
        put(g, x, y - t, skin.snow && y - (ground - H) < 3 + (t % 3) ? skin.snow[2]! : c)
      }
    }
  }
  for (let y = ground - H; y <= ground; y++) {
    const half = ((y - (ground - H)) / H) * W
    for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
      // The flap, laced shut down the middle.
      const lace = Math.abs(x + 0.5 - cx) < 1 && y > ground - 12
      put(g, x, y, lace ? ((y & 1) === 0 ? '#c8bca8' : '#0c0a10') : shade(canvas, 0.5 + (y === ground ? -0.25 : 0), x, y))
    }
  }
  // The R, edged in white.
  const rx = cx - 3
  const ry = ground - 22
  for (let j = 0; j < ROCKET_R.length; j++) {
    for (let i = 0; i < 7; i++) {
      if (ROCKET_R[j]![i] !== '1') continue
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) put(g, rx + i + dx, ry + j + dy, '#f8f0f0')
    }
  }
  stamp(g, ROCKET_R, { 1: '#e02828' }, rx, ry)
  limb(g, cx, ground - H - 3, cx, ground - H + 1, 0.8, 0.8, skin.wood)
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 11; i++) put(g, Math.round(cx + side * (W - 4 + i * 0.8)), Math.round(ground - 12 + i), '#8c8478')
    stamp(g, ['1', '1'], { 1: skin.wood[1]! }, cx + side * (W + 6), ground)
  }
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** The stake the Meowth balloon is tied to, the rope coiled at its foot; the balloon floats over it (`render/landmarks.ts`). Once it's gone, a cut end hangs. */
const stake = (skin: Skin, open: boolean): Piece => {
  const g = grid(14, 18)
  const cx = 7
  const ground = 15
  limb(g, cx, ground, cx, ground - 9, 1.3, 1, skin.wood)
  for (let a = 0; a < 16; a++) put(g, Math.round(cx + Math.cos((a / 16) * Math.PI * 2) * 4), Math.round(ground - 1 + Math.sin((a / 16) * Math.PI * 2) * 1.6), (a & 1) === 0 ? '#d8c8a0' : '#a89870')
  if (open) stamp(g, ['1.', '.1', '.1', '1.'], { 1: '#d8c8a0' }, cx + 1, ground - 12)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

const TRUCK_BOX: Ramp = ['#7c7c84', '#a8a8ac', '#cccac4', '#e8e6de', '#f8f6f0']
const TRUCK_CAB: Ramp = ['#142c5c', '#203e80', '#3058a8', '#4c78cc', '#78a0e8']

/**
 * The truck by the pier: a white box with a blue stripe behind a blue cab,
 * rust on its flanks and a flat tire, ivy (or snow) on it where the biome
 * has any. Nobody ever moved it, and they say there's something under it.
 * Faces west; the flipped variant faces east.
 */
const truckPiece = (skin: Skin, variant: number): Piece => {
  const g = grid(56, 40)
  const cx = 28
  const ground = 34
  const bed = ground - 4
  // The chassis, then the wheels under it.
  for (let x = cx - 24; x <= cx + 19; x++) for (let y = bed; y <= bed + 1; y++) put(g, x, y, '#24242c')
  const wheel = (wx: number, flat: boolean) => {
    const rx = flat ? 4.6 : 4
    const ry = flat ? 2.6 : 3.4
    for (let y = -4; y <= 4; y++) for (let x = -5; x <= 5; x++) if ((x / rx) ** 2 + (y / ry) ** 2 <= 1) put(g, wx + x, ground - 2 + y + (flat ? 1 : 0), Math.abs(x) <= 1 && Math.abs(y) <= 1 ? '#8c8c98' : '#141418')
  }
  wheel(cx - 17, false)
  wheel(cx + 13, true)
  const stain = (i: number, e: number) => noise(i >> 1, e >> 1, 40 + variant) < 0.07
  // The cargo box.
  slab(
    g,
    cx - 8,
    bed - 1,
    28,
    12,
    17,
    (i, j) => (skin.snow ? shade(skin.snow, 0.75 + noise(i, j, 2) * 0.25, i, j) : j % 4 === 0 ? TRUCK_BOX[2]! : shade(TRUCK_BOX, 0.85 - j * 0.015, i, j)),
    (i, e) => {
      if (skin.vine && e < 2 + Math.floor(noise(i, 1, 6) * 7) && noise(i >> 1, 2, 7) < 0.4) return shade(skin.vine, 0.3 + noise(i, e, 8) * 0.5, i, e)
      if (stain(i, e)) return e < 6 ? '#8c4c2c' : '#a8683c'
      if (e === 7 || e === 8) return TRUCK_CAB[2]!
      if (i % 9 === 0) return TRUCK_BOX[1]!
      return shade(TRUCK_BOX, 0.62 - (e === 0 ? 0.2 : 0), i, e)
    },
  )
  // The cab and its hood.
  slab(
    g,
    cx - 21,
    bed - 1,
    13,
    11,
    13,
    (i, j) => (skin.snow ? skin.snow[2]! : i < 3 ? (j % 3 === 0 ? GLASS.light : GLASS.dark) : shade(TRUCK_CAB, 0.75, i, j)),
    (i, e) => {
      if (i >= 2 && i <= 8 && e >= 7 && e <= 11) return i === 2 || i === 8 || e === 7 || e === 11 ? TRUCK_CAB[0]! : (i + e) % 6 === 0 ? GLASS.light : GLASS.mid
      if (i === 10 && e < 11) return TRUCK_CAB[0]!
      if (i === 9 && e === 5) return '#d8d8e0'
      if (stain(i + 40, e)) return '#8c4c2c'
      return shade(TRUCK_CAB, 0.5 - (e === 0 ? 0.2 : 0), i, e)
    },
  )
  slab(
    g,
    cx - 26,
    bed - 1,
    5,
    10,
    8,
    (i, j) => (skin.snow ? skin.snow[3]! : shade(TRUCK_CAB, 0.8, i, j)),
    (i, e) => (i === 0 && e === 4 ? '#f8e070' : e === 0 ? '#9c9ca8' : shade(TRUCK_CAB, 0.45, i, e)),
  )
  outline(g, skin.outline)
  return variant % 2 === 0 ? piece(g, cx, ground) : mirrored(g, cx, ground)
}

/**
 * The S.S. Anne, moored: a white liner with a red stripe and a navy keel line
 * at the water, portholes, a two-deck bridge and two red funnels with black
 * tops, masts fore and aft. Its bow points west (east when flipped).
 */
const ship = (variant: number): Piece => {
  const g = grid(76, 50)
  const cx = 38
  const water = 42
  const HULL: Ramp = ['#a8a8b0', '#d0d0d4', '#ececec', '#ffffff']
  // The hull: wider at the deck than at the water, the bow drawn out to a point.
  for (let e = 0; e <= 10; e++) {
    const x0 = cx - 29 - Math.round(e * 0.5)
    const x1 = cx + 28 + Math.round(e * 0.15)
    for (let x = x0; x <= x1; x++) {
      const c = e < 2 ? '#1c2c58' : e === 2 ? '#c83028' : (x - x0) % 5 === 2 && e === 6 && x > x0 + 4 && x < x1 - 2 ? '#2c3c64' : shade(HULL, 0.66 - (e < 4 ? 0.12 : 0), x, e)
      put(g, x, water - e, c)
    }
  }
  // The deck, seen from above.
  for (let j = 0; j < 7; j++) {
    const x0 = cx - 33 + Math.round(j * 0.9)
    const x1 = cx + 30 - Math.round(j * 0.2)
    for (let x = x0; x <= x1; x++) put(g, x, water - 11 - j, x === x0 || x === x1 || j === 0 ? '#f0f0f0' : shade(['#8c6c44', '#a8845c', '#c4a074'], 0.55 + noise(x >> 2, j, 3) * 0.3, x, j))
  }
  // The bridge: two white decks with rows of windows.
  slab(g, cx - 14, water - 13, 30, 5, 8, (i, j) => shade(HULL, 0.9 - j * 0.04, i, j), (i, e) => (e === 4 && i % 3 !== 0 ? '#2c3c64' : shade(HULL, 0.6, i, e)))
  slab(g, cx - 8, water - 21, 20, 4, 5, (i, j) => shade(HULL, 0.95, i, j), (i, e) => (e === 2 && i % 3 === 1 ? '#2c3c64' : shade(HULL, 0.62, i, e)))
  // Funnels.
  for (const fx of [cx - 3, cx + 7]) {
    for (let e = 0; e < 11; e++) {
      for (let x = 0; x < 5; x++) put(g, fx + x, water - 26 - e, e > 8 ? '#1c1c24' : e === 6 ? '#ffffff' : shade(['#901c14', '#c83028', '#f05040'], x === 0 ? 0.9 : x === 4 ? 0.1 : 0.55, x, e))
    }
  }
  // Masts fore and aft, a pennant on the foremast.
  for (const mx of [cx - 24, cx + 22]) for (let e = 0; e < 11; e++) put(g, mx, water - 17 - e, '#4c4038')
  stamp(g, ['111', '11.', '1..'], { 1: '#2858b8' }, cx - 23, water - 28)
  outline(g, '#141824')
  // The water lapping at the hull.
  for (let x = cx - 30; x <= cx + 30; x += 2) put(g, x, water + 1, '#d8f0ff')
  return variant % 2 === 0 ? piece(g, cx, water) : mirrored(g, cx, water)
}

/** An iron mooring post on the quay, a rope coiled round it (trailing to the water on one). */
const bollard = (skin: Skin, variant: number): Piece => {
  const g = grid(12, 16)
  const cx = 6
  const ground = 13
  cylinder(g, cx, ground, 2.6, 7, ['#14141c', '#2c2c38', '#484856', '#686876'])
  sculpt(g, [{ x: cx + 0.5, y: ground - 8, rx: 3.6, ry: 2 }], ['#14141c', '#2c2c38', '#484856', '#686876'], { seed: 2, tag: 4 })
  for (let x = -3; x <= 3; x++) put(g, cx + x, ground - 3, (x & 1) === 0 ? '#d8c8a0' : '#a89870')
  if (variant === 1) for (let i = 0; i < 6; i++) put(g, cx + 3 + (i >> 1), ground - 3 - i, '#c8b890')
  if (skin.snow) for (let x = -2; x <= 2; x++) put(g, cx + x, ground - 10, skin.snow[3]!)
  outline(g, skin.outline)
  return piece(g, cx, ground)
}

/** The colors MissingNo.'s scramble is made of: the old screens' greys, a stray color here and there. */
const SCRAMBLE = ['#101010', '#585858', '#a8a8a8', '#f8f8f8'] as const
const STRAY = ['#f838a8', '#38d8f8', '#f8d838'] as const

/** One 4×4 block of scrambled tile data, picked by `seed`. */
const scramble = (x: number, y: number, seed: number) => {
  const kind = Math.floor(noise(x >> 2, y >> 2, seed) * 6)
  const a = SCRAMBLE[Math.floor(noise(x >> 2, y >> 2, seed + 1) * 4)]!
  const b = noise(x >> 2, y >> 2, seed + 2) < 0.08 ? STRAY[Math.floor(noise(x >> 2, y >> 2, seed + 3) * 3)]! : SCRAMBLE[Math.floor(noise(x >> 2, y >> 2, seed + 4) * 4)]!
  const i = x & 3
  const j = y & 3
  switch (kind) {
    case 0:
      return (i + j) % 2 === 0 ? a : b
    case 1:
      return j < 2 ? a : b
    case 2:
      return i === j || i === 3 - j ? b : a
    case 3:
      return noise(x, y, seed + 5) < 0.5 ? a : b
    case 4:
      return i < 2 ? a : b
    default:
      return a
  }
}

/**
 * MissingNo.: a backwards L of scrambled blocks (the top-left corner left
 * out), standing on the glitched shore. Opened, its blocks shuffle again.
 */
const missingno = (skin: Skin, open: boolean): Piece => {
  const g = grid(30, 34)
  const x0 = 3
  const y0 = 3
  for (let by = 0; by < 7; by++) {
    for (let bx = 0; bx < 6; bx++) {
      if (bx < 3 && by < 4) continue
      for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) put(g, x0 + bx * 4 + i, y0 + by * 4 + j, scramble(bx * 4 + i, by * 4 + j, open ? 91 : 17))
    }
  }
  outline(g, skin.outline)
  return piece(g, x0 + 12, y0 + 27)
}

/* ---------------- Grounds ---------------- */

/** A flat ground piece: `paint` colors a spot of the landmark's own px, or leaves it out. Anchored at the landmark's (0, 0). */
const flat = (x0: number, y0: number, x1: number, y1: number, paint: (x: number, y: number) => string | null): Piece => {
  const g = grid(x1 - x0, y1 - y0)
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const c = paint(x, y)
    if (c) put(g, x - x0, y - y0, c)
  }
  return piece(g, -x0, -y0)
}

const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1

/** The cottage's floor: boards with gaps and holes, a faded rug, fallen roof tiles, stepping stones out the door. */
const floor = (skin: Skin, variant: number): Piece => {
  const rug = variant % 2 === 0 ? ['#7c3040', '#a04858'] : ['#30507c', '#486ca0']
  return flat(-CW - 6, -CD - 4, CW + 6, 40, (x, y) => {
    // Stepping stones from the door.
    if (y > CT) {
      const s = Math.floor((y - CT) / 9)
      const sx = (s % 2 === 0 ? -3 : 3) + Math.round(noise(s, 1, 2) * 4) - 2
      return y < 38 && inEllipse(x, (y - CT) % 9, sx, 4.5, 6, 3) ? shade(skin.stone, 0.75 - (y - CT) % 9 * 0.04, x, y) : null
    }
    if (Math.abs(x) > CW - CT || y < -CD + CT || y > -CT) return null
    // Holes where boards rotted through.
    if (noise(x >> 3, y >> 2, 17 + variant) < 0.06) return noise(x, y, 3) < 0.3 ? shade(skin.dirt, 0.2, x, y) : null
    // Snow blown in through the open roof drifts against the walls.
    if (skin.snow) {
      const fromWall = Math.min(CW - CT - Math.abs(x), y + CD - CT, -CT - y)
      if (fromWall < 4 + wobble((x * 0.7 + y) / 7, 4) * 12 || noise(x >> 1, y >> 1, 4) < 0.05) return shade(skin.snow, 0.55 + fromWall * -0.02 + noise(x, y, 5) * 0.3, x, y)
    }
    // A faded rug with a border and fringes, a corner eaten away.
    const rx = x - 4
    const ry = y + 32
    if (Math.abs(rx) <= 20 && Math.abs(ry) <= 11 && !(rx > 12 && ry > 4 && noise(x, y, 9) < 0.6)) {
      if (Math.abs(rx) === 20) return (y & 1) === 0 ? '#e8dcc0' : null
      const border = Math.abs(rx) > 16 || Math.abs(ry) > 8
      const motif = !border && (Math.abs(rx) + Math.abs(ry) * 2) % 8 < 2
      return border || motif ? rug[1]! : rug[0]!
    }
    // Fallen roof tiles.
    if (noise(x >> 2, y >> 1, 21) < 0.05) return (y & 1) === 0 ? '#5c2c24' : '#7c3c2c'
    const row = Math.floor((y + 200) / 4)
    const seam = (y + 200) % 4 === 0 || (x + 300 + (row % 3) * 11) % 23 === 0
    return seam ? skin.plank[0]! : shade(skin.plank, 0.55 + (noise(Math.floor((x + (row % 3) * 11) / 23), row, 5) - 0.5) * 0.45, x, y)
  })
}

/** Rails out of both tunnel mouths, on a bed of gravel. */
const rails = (skin: Skin): Piece =>
  flat(-RIDGE.mouthX - 16, -2, RIDGE.mouthX + 16, 48, (x, y) => {
    for (const side of [-1, 1]) {
      const cx = side * RIDGE.mouthX + Math.round(Math.max(0, y - 20) * 0.15 * side)
      const dx = x - cx
      if (Math.abs(dx) > 8 || y > 44 - Math.abs(noise(x, 1, 3) * 4)) continue
      if (Math.abs(dx) === 3) return '#7c7c88'
      if (Math.abs(dx) === 4) return '#3c3c48'
      if (y % 4 === 0 && Math.abs(dx) < 6) return shade(skin.wood, 0.4, x, y)
      if (Math.abs(dx) < 7) return shade(skin.gravel, noise(x, y, 4), x, y)
    }
    return null
  })

/** Gravel paths through the maze and a flagstone at its way in. */
const gravel = (skin: Skin): Piece => {
  const half = (MAZE.size * MAZE.cell) / 2
  return flat(-half - 6, -half * 2 - 6, half + 6, 14, (x, y) => {
    // Two worn steps at the way in.
    if (y > 0) return Math.abs(x) < 13 && y < 11 ? (y === 5 || y === 10 ? skin.stone[1]! : shade(skin.stone, 0.85, x, y)) : null
    if (Math.abs(x) > half + 4 || y < -half * 2 - 4) return null
    const edge = Math.abs(x) > half + 2 || y < -half * 2 - 2
    return edge ? shade(skin.stone, 0.4, x, y) : shade(skin.gravel, 0.3 + noise(x, y, 6) * 0.6, x, y)
  })
}

/** The ruins' plaza: worn flagstones in a ring, grass between them, the path in from the south. */
const plaza = (skin: Skin, variant: number): Piece => {
  const { rx, ry } = RUINS
  return flat(-rx - 8, -ry - 8, rx + 8, ry + 22, (x, y) => {
    const path = y > 0 && Math.abs(x) < 9 && y < ry + 20
    const ring = inEllipse(x, y, 0, 0, rx + 5, ry + 5) && !inEllipse(x, y, 0, 0, rx - 5, ry - 5)
    const inner = inEllipse(x, y, 0, 0, rx - 14, ry - 12)
    if (!ring && !inner && !path) return null
    const row = Math.floor((y + 200) / 5)
    const seam = (y + 200) % 5 === 0 || (x + 300 + (row % 2) * 4) % 9 === 0
    // Missing stones, grass in the seams.
    if (noise(Math.floor((x + 300 + (row % 2) * 4) / 9), row, 30 + variant) < 0.16) return null
    if (inner && inEllipse(x, y, 0, -4, 18, 12) && !inEllipse(x, y, 0, -4, 16, 10.5)) return skin.stone[0]!
    return seam ? (skin.vine ? shade(skin.vine, 0.3, x, y) : skin.stone[1]!) : shade(skin.stone, 0.62 + (noise(x >> 3, row, 31) - 0.5) * 0.3, x, y)
  })
}

/** The camp's trampled ground: bare earth, the fire's ash, a fishing rod left lying. */
const campGround = (skin: Skin, variant: number): Piece => {
  const s = variant % 2 === 0 ? 1 : -1
  return flat(-62, -40, 62, 26, (x, y) => {
    if (inEllipse(x, y, 0, -1, 11, 5)) return shade(['#2c2420', '#4a4038', '#6c6058'], noise(x, y, 3), x, y)
    // The rod: a thin line with its reel.
    const rx = x * s
    if (y > 10 && y < 22 && Math.abs(rx - (16 + (y - 10) * 2.2)) < 0.6) return '#5c3c20'
    if (inEllipse(rx, y, 30, 20, 1.5, 1.5)) return '#c0c0c8'
    // Bare earth, thinning out into the grass at its edge.
    const d = ((x + 6 * s) / 56) ** 2 + ((y + 8) / 26) ** 2
    if (d > 1 || (d > 0.7 && noise(x >> 1, y >> 1, 8 + variant) < (d - 0.7) * 3.3)) return null
    return shade(skin.dirt, 0.45 + (noise(x >> 2, y >> 2, 9) - 0.5) * 0.5, x, y)
  })
}

/** The Snorlax's road: a dirt path wandering between the trees, wheel ruts down it, and the flattened bed where it sleeps (seen once it's gone). */
const route = (skin: Skin, variant: number): Piece =>
  flat(-66, -92, 66, 72, (x, y) => {
    const bed = ((x / 27) ** 2 + ((y + 2) / 12) ** 2)
    if (bed <= 1) return bed > 0.8 && noise(x, y, 5) < 0.4 ? null : shade(skin.dirt, 0.18 + noise(x >> 1, y >> 1, 4) * 0.22, x, y)
    const mid = Math.round((wobble((y + 300) / 40, 5 + variant) - 0.5) * 8)
    const half = 12 + wobble((y + 200) / 17, 3 + variant) * 5 - Math.max(0, Math.abs(y + 10) - 70) * 0.6
    const d = Math.abs(x - mid)
    if (d > half || (d > half - 2 && noise(x, y, 7) < 0.5)) return null
    const rut = Math.abs(d - 6) < 1
    return shade(skin.dirt, 0.48 + (noise(x >> 2, y >> 1, 9) - 0.5) * 0.4 - (rut ? 0.18 : 0), x, y)
  })

/** The Pokémon Center's forecourt: pale paving, flower beds along the front, a red mat at the doors and a path out. */
const court = (skin: Skin): Piece =>
  flat(-50, -2, 50, 46, (x, y) => {
    const fore = y < 16 && Math.abs(x) < 46
    const path = y >= 16 && Math.abs(x) < 9 + (y > 40 ? -(y - 40) : 0) && y < 46
    if (!fore && !path) return null
    if (y < 0) return null
    if (Math.abs(x) < 8 && y < 4) return y === 1 ? '#f8f0f0' : '#c83830'
    // Beds of flowers under the windows.
    if (y < 6 && Math.abs(x) > 14 && Math.abs(x) < 40) {
      const bloom = skin.bloom ?? ['#f8f0f0', '#f87890']
      if (noise(x, y, 11) < 0.3) return bloom[Math.floor(noise(x, y, 12) * bloom.length)]!
      return shade(skin.vine ?? skin.hedge, 0.35 + noise(x >> 1, y, 13) * 0.4, x, y)
    }
    const grout = (x + 200) % 8 === 0 || (y + 200) % 8 === 0
    if (fore && Math.abs(x) > 42 && noise(x, y, 14) < 0.5) return null
    return grout ? shade(skin.gravel, 0.15, x, y) : shade(skin.gravel, 0.75 + (noise((x + 200) >> 3, (y + 200) >> 3, 15) - 0.5) * 0.2, x, y)
  })

/** Team Rocket's ground: trampled earth, boot prints toward the balloon and a scorch where something blew up. */
const hideout = (skin: Skin, variant: number): Piece => {
  const s = variant % 2 === 0 ? 1 : -1
  return flat(-80, -36, 80, 40, (x, y) => {
    const rx = x * s
    // Boot prints, heel and toe, from the tent to the stake.
    for (let i = 0; i < 6; i++) {
      const px = -6 + i * 8
      const py = 2 + (i % 2) * 5
      if (inEllipse(rx, y, px, py, 1.6, 1) || inEllipse(rx, y, px + 2, py, 1, 0.8)) return shade(skin.dirt, 0.1, x, y)
    }
    const d = ((rx - 6) / 74) ** 2 + ((y + 2) / 32) ** 2
    if (d > 1 || (d > 0.72 && noise(x >> 1, y >> 1, 8 + variant) < (d - 0.72) * 3.6)) return null
    return shade(skin.dirt, 0.32 + (noise(x >> 2, y >> 2, 9) - 0.5) * 0.4, x, y)
  })
}

/** The pier: a plank quay along the water (the lake covers its back), posts at its edge, and the truck's tracks coming off it. */
const pier = (skin: Skin, variant: number): Piece => {
  const s = variant % 2 === 0 ? 1 : -1
  return flat(-92, -4, 92, 74, (x, y) => {
    const tx = x - 38 * s
    // Tire tracks from the truck, south and off the map.
    if (y > 54 && (Math.abs(Math.abs(tx - (y - 54) * 0.3 * s) - 7) < 1.5) && noise(x, y >> 1, 3) < 0.8) return shade(skin.dirt, 0.25, x, y)
    if (y > 32 || y < 6 || Math.abs(x) > 88 - (y > 26 ? (y - 26) * 2 : 0)) return null
    // The quay's south beam and its posts.
    if (y >= 30) return (x + 400) % 22 < 3 ? skin.wood[0]! : skin.wood[1]!
    const row = Math.floor((y + 200) / 4)
    const seam = (y + 200) % 4 === 0 || (x + 400 + (row % 3) * 13) % 31 === 0
    return seam ? skin.plank[0]! : shade(skin.plank, 0.5 + (noise(Math.floor((x + 400 + (row % 3) * 13) / 31), row, 7) - 0.5) * 0.4, x, y)
  })
}

/** The glitched coast: a sand shore by the water whose tiles came out scrambled, more of them toward the water. */
const glitchGround = (skin: Skin, variant: number): Piece => {
  const s = variant % 2 === 0 ? 1 : -1
  return flat(-72, -12, 84, 76, (x, y) => {
    const rx = x * s
    const d = ((rx - 6) / 72) ** 2 + ((y - 22) / 46) ** 2
    if (d > 1 || (d > 0.8 && noise(x >> 1, y >> 1, 3 + variant) < (d - 0.8) * 5)) return null
    // 8 px tiles gone wrong, thickest along the shore.
    const tx = (x + 400) >> 3
    const ty = (y + 400) >> 3
    if (y < 44 && noise(tx, ty, 21) < 0.34 - (y - 10) * 0.008) return scramble(x + 400, y + 400, 33 + ((tx + ty) & 3))
    return shade(skin.sand, 0.55 + (noise(x >> 2, y >> 1, 9) - 0.5) * 0.35, x, y)
  })
}

/* ---------------- Tables ---------------- */

/** Every landmark piece, built for a biome (and open, once its treasure is taken). */
export const LANDMARK_PIECES: Record<LandmarkPiece, (variant: number, biome: BiomeId, open: boolean) => Piece> = {
  wallN: (_v, b) => wallN(SKINS[b]),
  wallW: (_v, b) => wallSide(SKINS[b], -1),
  wallE: (_v, b) => wallSide(SKINS[b], 1),
  wallS: (v, b) => wallS(SKINS[b], v === 1),
  well: (_v, b) => well(SKINS[b]),
  fence: (_v, b) => fence(SKINS[b]),
  crate: (_v, b, open) => crate(SKINS[b], open),
  table: (_v, b) => table(SKINS[b]),
  bed: (_v, b) => bed(SKINS[b]),
  ridge: (_v, b) => ridge(b, SKINS[b]),
  cart: (_v, b) => cart(SKINS[b]),
  hedge: (v, b) => hedge(SKINS[b], v),
  chest: (_v, b, open) => PLACE_PIECES.chest(open ? 1 : 0, b),
  menhir: (v, b, open) => menhir(SKINS[b], v, open),
  altar: (_v, b, open) => altar(SKINS[b], open),
  column: (v, b) => brokenPillar(ROCK_SKINS[b], 40 + v),
  tent: (v, b) => tent(SKINS[b], v),
  campfire: (_v, b) => campfire(SKINS[b]),
  log: (v, b) => logPiece(LOG_SKINS[b], 22 + v * 2, 3.5, 60 + v),
  pack: (_v, b, open) => pack(SKINS[b], open),
  snorlax: (v, b) => snorlaxPiece(SKINS[b], v),
  center: (_v, b, open) => centerPiece(SKINS[b], open),
  rocketTent: (_v, b) => rocketTent(SKINS[b]),
  balloon: (_v, b, open) => stake(SKINS[b], open),
  truck: (v, b) => truckPiece(SKINS[b], v),
  ship: (v) => ship(v),
  bollard: (v, b) => bollard(SKINS[b], v),
  missingno: (_v, b, open) => missingno(SKINS[b], open),
}

/** Every landmark's ground, built for a biome. */
export const LANDMARK_GROUNDS: Record<LandmarkGround, (variant: number, biome: BiomeId) => Piece> = {
  floor: (v, b) => floor(SKINS[b], v),
  rails: (_v, b) => rails(SKINS[b]),
  gravel: (_v, b) => gravel(SKINS[b]),
  plaza: (v, b) => plaza(SKINS[b], v),
  camp: (v, b) => campGround(SKINS[b], v),
  route: (v, b) => route(SKINS[b], v),
  court: (_v, b) => court(SKINS[b]),
  hideout: (v, b) => hideout(SKINS[b], v),
  pier: (v, b) => pier(SKINS[b], v),
  glitch: (v, b) => glitchGround(SKINS[b], v),
}

/** Shadow width of each piece (0: none, it's flat or casts its own). */
export const LANDMARK_SHADOW: Record<LandmarkPiece, number> = {
  wallN: 0, wallW: 0, wallE: 0, wallS: 0, well: 11, fence: 0, crate: 8, table: 9, bed: 0,
  ridge: 0, cart: 9, hedge: 0, chest: 11, menhir: 6, altar: 13, column: 8, tent: 20, campfire: 0, log: 12, pack: 6,
  snorlax: 26, center: 0, rocketTent: 22, balloon: 4, truck: 22, ship: 0, bollard: 3, missingno: 9,
}

/** Pieces tall enough to go see-through when the player walks behind them. */
export const LANDMARK_TALL: Record<LandmarkPiece, boolean> = {
  wallN: true, wallW: true, wallE: true, wallS: true, well: true, fence: false, crate: false, table: false, bed: false,
  ridge: true, cart: false, hedge: true, chest: false, menhir: true, altar: true, column: true, tent: true, campfire: false, log: false, pack: false,
  snorlax: true, center: true, rocketTent: true, balloon: false, truck: true, ship: true, bollard: false, missingno: true,
}

/** Pieces a run will likely meet, per biome, to sculpt in idle time before they show (`warmTerrain`). */
export const LANDMARK_WARM: readonly (readonly [LandmarkPiece, number])[] = [
  ['ridge', 0], ['wallN', 0], ['wallW', 0], ['wallE', 0], ['wallS', 0], ['wallS', 1], ['tent', 0], ['tent', 1], ['altar', 0],
  ['snorlax', 0], ['snorlax', 1], ['center', 0], ['rocketTent', 0],
  ...Array.from({ length: MAZE.patterns * (MAZE.size + 1) }, (_, i) => ['hedge', Math.floor(i / (MAZE.size + 1)) * 8 + (i % (MAZE.size + 1))] as const),
]
