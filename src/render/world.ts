import { canvasCache, context2d, createCanvas, fromStrings, type Palette } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { BiomeId } from '../data/biomes'
import type { BiomeSample } from '../game/biomeMap'

/**
 * Infinite procedural ground, one look per biome, generated in cached chunks.
 * Everything is deterministic from world coordinates (and the run's biome
 * map), so revisiting an area looks the same. Where two biomes meet, the
 * ground dithers from one into the other across a band baked into the chunks.
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
  /** Paths become staggered stone tiles (graveyard walkways, the Power Plant's catwalks). */
  tiles?: boolean
  /** The lines between those tiles (dark purple mortar unless told). */
  mortar?: string
  /**
   * Thin winding lines through the dense zones: lava in the volcano's crust,
   * cracks in the Power Plant's concrete (`width` of the noise band; `glow`
   * rims them a pixel wide).
   */
  veins?: { color: Shades; width: number; glow?: string }
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

/* ---------------- Beach (Route 109) ---------------- */

const SHELL = ['.1.1.', '12121', '12221', '.111.']
const STARFISH = ['..1..', '11211', '.121.', '1...1']
const DUNE_GRASS = ['1...1.', '.1.1.1', '1.1.1.', '.1211.', '..11..']
const DRIFTWOOD = ['.11111.', '1222221', '.13311.']
const SAND_PEBBLES = ['1..', '..2', '.1.']

const beachDecor = () => {
  const shells = [sprite(SHELL, { 1: '#c86878', 2: '#f8c8c8' }), sprite(SHELL, { 1: '#a87848', 2: '#f8e8d0' })]
  const star = sprite(STARFISH, { 1: '#e86830', 2: '#f8b058' })
  const grass = sprite(DUNE_GRASS, { 1: '#6a9a40', 2: '#a8c868' })
  const wood = sprite(DRIFTWOOD, { 1: '#6c5c48', 2: '#b0a088', 3: '#8c7c64' })
  const pebbles = sprite(SAND_PEBBLES, { 1: '#b8a07c', 2: '#fff8e8' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Dune grass on the high sand, low enough to walk through. Palms are real trees (`render/terrain.ts`).
      ctx.drawImage(grass, s.x + (s.jx >> 1), s.y + (s.jy >> 1))
      if (s.roll < 0.35) ctx.drawImage(grass, s.x + 8, s.y + 9)
    } else if (s.roll < 0.04) {
      ctx.drawImage(shells[s.jx % 2]!, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.055) {
      ctx.drawImage(star, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.15) {
      ctx.drawImage(pebbles, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.162) {
      ctx.drawImage(wood, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Power Plant (Kanto) ---------------- */

const BOLTS = ['1....1', '......', '......', '1....1']
const GRATE = ['1111111', '1.1.1.1', '1111111', '1.1.1.1', '1111111']
const CABLE = ['.11......', '1..1.....', '....1.11.', '.....1..1']
const OIL = ['..11...', '.12211.', '1223221', '.122211', '..111..']
const WEEDS = ['1...1', '.1.1.', '.121.']
const RUBBLE = ['..1..', '.121.', '12231', '.111.']
const SCRAP = ['111..', '1221.', '.1111']

const plantDecor = () => {
  const bolts = sprite(BOLTS, { 1: '#6c727c' })
  const grate = sprite(GRATE, { 1: '#5c626c' })
  const cables = [sprite(CABLE, { 1: '#2c2c34' }), sprite(CABLE, { 1: '#9c3428' })]
  const oil = sprite(OIL, { 1: '#4c525c', 2: '#2c3038', 3: '#6878a8' })
  const weeds = sprite(WEEDS, { 1: '#5c7c40', 2: '#88a858' })
  const rubble = sprite(RUBBLE, { 1: '#4c525c', 2: '#9ca4ae', 3: '#c4cad2' })
  const scrap = sprite(SCRAP, { 1: '#5c3c28', 2: '#a8643c' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Worn yard: weeds through the cracks (the ground's own `veins`), rubble and scrap.
      if (s.roll < 0.35) ctx.drawImage(weeds, s.x + s.jx, s.y + s.jy)
      else if (s.roll < 0.5) ctx.drawImage(rubble, s.x + s.jx, s.y + s.jy)
      else if (s.roll < 0.58) ctx.drawImage(scrap, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.02) {
      ctx.drawImage(grate, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.06) {
      ctx.drawImage(bolts, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.085) {
      ctx.drawImage(cables[s.jy % 2]!, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.1) {
      ctx.drawImage(oil, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.13) {
      ctx.drawImage(weeds, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Desert (Route 111) ---------------- */

const CACTUS = ['..1..', '1.1..', '1.1.1', '111.1', '..111', '..1..', '.111.']
const BONES = ['1...1', '.111.', '1...1']
const RIPPLE = ['11....', '..1111']
const DRY_TUFT = ['1.1.1', '.1.1.', '.121.']

const desertDecor = () => {
  const cactus = sprite(CACTUS, { 1: '#4c8838' })
  const bones = sprite(BONES, { 1: '#f8f0e0' })
  const ripple = sprite(RIPPLE, { 1: '#c49058' })
  const light = sprite(RIPPLE, { 1: '#f8dca8' })
  const tuft = sprite(DRY_TUFT, { 1: '#a88848', 2: '#c8a860' })
  const pebbles = sprite(SAND_PEBBLES, { 1: '#a07848', 2: '#f0d8a8' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Dunes: wind ripples in rows, lit on one side.
      ctx.drawImage(ripple, s.x + (s.jx >> 1), s.y + 3)
      ctx.drawImage(light, s.x + (s.jx >> 1) + 1, s.y + 2)
      ctx.drawImage(ripple, s.x + ((s.jx + 5) % 10), s.y + 10)
      ctx.drawImage(light, s.x + ((s.jx + 5) % 10) + 1, s.y + 9)
    } else if (s.roll < 0.02) {
      ctx.drawImage(cactus, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.028) {
      ctx.drawImage(bones, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.1) {
      ctx.drawImage(pebbles, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.16) {
      ctx.drawImage(tuft, s.x + s.jx, s.y + s.jy)
    }
  }
}

/* ---------------- Volcano (Mt. Chimney) ---------------- */

const VENT = ['..1..', '.121.', '12321', '.111.']
const OBSIDIAN = ['..1..', '.121.', '12231', '.111.']
const ASH_PILE = ['..11..', '.1221.', '122221']
const CINDERS = ['1..', '..2', '.1.']
const SCORCH = ['1.1.1', '.1.1.']

const volcanoDecor = () => {
  const vent = sprite(VENT, { 1: '#2c2426', 2: '#c84818', 3: '#f8c040' })
  const obsidian = sprite(OBSIDIAN, { 1: '#141018', 2: '#3c3450', 3: '#8c84b0' })
  const ash = sprite(ASH_PILE, { 1: '#8c8684', 2: '#b4aeaa' })
  const cinders = sprite(CINDERS, { 1: '#2c2426', 2: '#8c4430' })
  const scorch = sprite(SCORCH, { 1: '#3a3236' })
  return (ctx: CanvasRenderingContext2D, s: Spot) => {
    if (s.dense) {
      // Hot crust: the lava shows in its cracks (the ground's `veins`); a vent glows here and there.
      if (s.roll < 0.12) ctx.drawImage(vent, s.x + s.jx, s.y + s.jy)
      else if (s.roll < 0.4) ctx.drawImage(cinders, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.025) {
      ctx.drawImage(obsidian, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.05) {
      ctx.drawImage(ash, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.12) {
      ctx.drawImage(cinders, s.x + s.jx, s.y + s.jy)
    } else if (s.roll < 0.14) {
      ctx.drawImage(scorch, s.x + s.jx, s.y + s.jy)
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
  beach: {
    base: shades('#f0dca8', '#f6e4b4', '#e8d29c'),
    alt: shades('#dcc48c', '#e2ca94', '#d4bc84'),
    path: shades('#c8ac78', '#d0b480', '#c0a470'),
    spots: shades('#fff0c8', '#fff6d8', '#f8e8bc'),
    thicket: 0.66,
    decor: beachDecor,
  },
  plant: {
    base: shades('#9ca0a4', '#a4a8ac', '#94989c'),
    alt: shades('#8a8e90', '#929698', '#84888a'),
    path: shades('#74787e', '#7a7e84', '#6e7278'),
    veins: { color: shades('#686c70', '#606468', '#707478'), width: 0.01 },
    thicket: 0.66,
    decor: plantDecor,
  },
  desert: {
    base: shades('#e4bc7c', '#ecc488', '#dcb474'),
    alt: shades('#d4a868', '#dcb070', '#cca060'),
    path: shades('#c49460', '#cc9c68', '#bc8c58'),
    spots: shades('#f4d498', '#f8dca4', '#ecca8c'),
    thicket: 0.62,
    decor: desertDecor,
  },
  volcano: {
    base: shades('#4a4648', '#504c4e', '#444042'),
    alt: shades('#3a3436', '#403a3c', '#343032'),
    path: shades('#8c8682', '#948e8a', '#86807c'),
    spots: shades('#5a5452', '#605a58', '#545050'),
    veins: { color: shades('#f07020', '#f8a838', '#c84418'), width: 0.0075, glow: '#6a2a1e' },
    thicket: 0.62,
    decor: volcanoDecor,
  },
}

const decorCache = canvasCache<BiomeId, (ctx: CanvasRenderingContext2D, s: Spot) => void>()

const decorFor = (biome: BiomeId) => {
  let decorate = decorCache.get(biome)
  if (!decorate) decorCache.set(biome, (decorate = STYLES[biome].decor()))
  return decorate
}

const MORTAR = '#4c4458'

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
const veinRow = new Float64Array(CHUNK)

/** One chunk's pixels, shared by every build: each build writes all of them. */
let pixels: ImageData | null = null

/* ---------------- Biome borders ---------------- */

/**
 * Where the ground comes from: `at` samples the map's biomes (`sampleBiome`,
 * `game/biomeMap.ts`), `key` names the map in the chunk cache (a run's seed),
 * `blend` is how far (px) each side of a border dithers into the other.
 */
export type GroundMap = { key: string; at: (x: number, y: number) => BiomeSample; blend: number }

/** One biome everywhere (the title screen's meadow). */
export const plainGround = (biome: BiomeId): GroundMap => {
  const sample: BiomeSample = { a: biome, b: biome, t: Infinity }
  return { key: biome, at: () => sample, blend: 0 }
}

const MEADOW_GROUND = plainGround('meadow')

/** The map is sampled once per `BLOCK`×`BLOCK` px and dithered inside the block, so a chunk costs 1024 samples, not 65536. */
const BLOCK = 8
const PER = CHUNK / BLOCK

/** 8x8 Bayer matrix: the order pixels switch to the other biome as a border nears. */
const BAYER8 = (() => {
  const m = new Uint8Array(64)
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      let v = 0
      for (let bit = 0; bit < 3; bit++) {
        const bx = (x >> bit) & 1
        const by = (y >> bit) & 1
        v |= ((bx ^ by) << (5 - bit * 2)) | (by << (4 - bit * 2))
      }
      m[y * 8 + x] = v
    }
  }
  return m
})()

/** Per block of the chunk being built: its biome, the one across the border and how many of 64 pixels take that one. */
const blockA = Array.from({ length: PER * PER }, (): BiomeId => 'meadow')
const blockB = Array.from({ length: PER * PER }, (): BiomeId => 'meadow')
const blockK = new Uint8Array(PER * PER)

/** Samples the map once per block of chunk (cx, cy): half the pixels on the line, none `blend` px in. */
const sampleBlocks = (map: GroundMap, ox: number, oy: number) => {
  for (let by = 0; by < PER; by++) {
    for (let bx = 0; bx < PER; bx++) {
      const s = map.at(ox + bx * BLOCK + BLOCK / 2, oy + by * BLOCK + BLOCK / 2)
      const i = by * PER + bx
      blockA[i] = s.a
      blockB[i] = s.b
      blockK[i] = s.a === s.b || s.t >= map.blend ? 0 : Math.round(Math.max(0, Math.min(0.5, 0.5 - s.t / (2 * map.blend))) * 64)
    }
  }
}

/** The biome pixel (x, y) of the chunk being built shows. */
const biomeOfPixel = (x: number, y: number, wx: number, wy: number) => {
  const i = (y >> 3) * PER + (x >> 3)
  return BAYER8[(wy & 7) * 8 + (wx & 7)]! < blockK[i]! ? blockB[i]! : blockA[i]!
}

/** Each biome's ground shades flattened (base, alt, path, spots; 3 shades of RGB each) and its mortar, out of the pixel loop. */
type Flat = { rgb: readonly number[]; mortar: Rgb; tiles: boolean; spots: boolean; veins: readonly number[] | null; vein: number; glow: Rgb | null }
const flats = new Map<BiomeId, Flat>()
const flatOf = (biome: BiomeId): Flat => {
  let f = flats.get(biome)
  if (f) return f
  const style = STYLES[biome]
  f = {
    rgb: [style.base, style.alt, style.path, style.spots ?? style.base].flatMap((shades) => shades.flat()),
    mortar: hex(style.mortar ?? MORTAR),
    tiles: style.tiles === true,
    spots: style.spots !== undefined,
    veins: style.veins ? style.veins.color.flat() : null,
    vein: style.veins?.width ?? 0,
    glow: style.veins?.glow ? hex(style.veins.glow) : null,
  }
  flats.set(biome, f)
  return f
}

/** Paints chunk (cx, cy) of `map` into `canvas` (a fresh one, or an evicted chunk's: the ground covers every pixel). */
const buildChunk = (map: GroundMap, cx: number, cy: number, canvas: HTMLCanvasElement) => {
  const ctx = context2d(canvas)
  const img = (pixels ??= new ImageData(CHUNK, CHUNK))
  const data = img.data
  const ox = cx * CHUNK
  const oy = cy * CHUNK
  sampleBlocks(map, ox, oy)

  for (let y = 0; y < CHUNK; y++) {
    const wy = oy + y
    noiseRow(pathRow, ox, wy, 220, SEED + 7)
    noiseRow(altRow, ox, wy, 96, SEED)
    noiseRow(spotRow, ox, wy, 20, SEED + 9)
    noiseRow(veinRow, ox, wy, 44, SEED + 11)
    for (let x = 0; x < CHUNK; x++) {
      const wx = ox + x
      const flat = flatOf(biomeOfPixel(x, y, wx, wy))
      const path = Math.abs(pathRow[x]! - 0.5) < 0.025
      const r = hash2(wx, wy, SEED + 1)
      const palette = path ? 2 : flat.spots && spotRow[x]! > 0.76 ? 3 : altRow[x]! > 0.55 ? 1 : 0
      // Ordered-ish dither: mostly the base shade with sparse lighter/darker pixels.
      const i = (y * CHUNK + x) * 4
      // Veins wind through the dense zones only, off the paths.
      const vein = flat.veins && !path && altRow[x]! > 0.57 ? Math.abs(veinRow[x]! - 0.5) : 1
      if (vein < flat.vein) {
        const c = r < 0.6 ? 0 : r < 0.85 ? 3 : 6
        data[i] = flat.veins![c]!
        data[i + 1] = flat.veins![c + 1]!
        data[i + 2] = flat.veins![c + 2]!
      } else if (flat.glow && vein < flat.vein * 2.2) {
        data[i] = flat.glow[0]
        data[i + 1] = flat.glow[1]
        data[i + 2] = flat.glow[2]
      } else if (path && flat.tiles && isMortar(wx, wy)) {
        data[i] = flat.mortar[0]
        data[i + 1] = flat.mortar[1]
        data[i + 2] = flat.mortar[2]
      } else {
        const c = palette * 9 + (r < 0.7 ? 0 : r < 0.9 ? 3 : 6)
        data[i] = flat.rgb[c]!
        data[i + 1] = flat.rgb[c + 1]!
        data[i + 2] = flat.rgb[c + 2]!
      }
      data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)

  for (let ty = 0; ty < CHUNK / TILE; ty++) {
    for (let tx = 0; tx < CHUNK / TILE; tx++) {
      const wx = ox + tx * TILE
      const wy = oy + ty * TILE
      if (pathAt(wx, wy, 0.04)) continue // keep paths clean
      // A tile wears the decor of the biome its middle shows; none right on a border, where the two grounds mix.
      const i = (ty * 2) * PER + tx * 2 + PER + 1
      const k = blockK[i]!
      if (k > 16) continue
      const biome = blockA[i]!
      decorFor(biome)(ctx, {
        x: tx * TILE,
        y: ty * TILE,
        wx,
        wy,
        dense: noise(wx, wy, 140, SEED + 3) > (STYLES[biome].thicket ?? 0.68),
        roll: hash2(tx + cx * 64, ty + cy * 64, SEED + 2),
        jx: Math.floor(hash2(wx, wy, SEED + 4) * 10),
        jy: Math.floor(hash2(wx, wy, SEED + 5) * 10),
      })
    }
  }
  return canvas
}

const chunks = canvasCache<string, HTMLCanvasElement>()

const chunkKey = (map: GroundMap, cx: number, cy: number) => `${map.key}:${cx},${cy}`

/** Chunks a span of `size` px can touch along one axis. */
const across = (size: number) => Math.ceil(size / CHUNK) + 1

/**
 * How many chunks stay cached for a `w`×`h` view: the view and its lookahead,
 * and a few spare, so walking back and forth doesn't rebuild. About 16 (4 MB) on a phone.
 */
const capFor = (w: number, h: number) => across(w + GROUND_LOOKAHEAD * 2) * across(h + GROUND_LOOKAHEAD * 2) + 4
let cap = capFor(480, 270)

/**
 * Least recently used goes first: a hit moves the chunk to the back, so on-screen chunks are
 * never evicted. A miss past the cap repaints the evicted chunk's canvas instead of making
 * another one, so a long run keeps the same few canvases (and their GPU textures).
 */
const chunkAt = (map: GroundMap, cx: number, cy: number) => {
  const key = chunkKey(map, cx, cy)
  let chunk = chunks.get(key)
  if (chunk) chunks.delete(key)
  else {
    let spare: HTMLCanvasElement | undefined
    while (chunks.size >= cap) {
      const oldest = chunks.keys().next().value!
      spare ??= chunks.get(oldest)
      chunks.delete(oldest)
    }
    chunk = buildChunk(map, cx, cy, spare ?? createCanvas(CHUNK, CHUNK))
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

/**
 * Draws the ground under a camera whose top-left is (camX, camY): the map's
 * biomes, each border a band of dithered pixels baked into the chunks, so a
 * frame only blits (lean mode included).
 */
export const drawGround = (ctx: CanvasRenderingContext2D, camX: number, camY: number, w: number, h: number, map: GroundMap = MEADOW_GROUND) => {
  cap = capFor(w, h)
  const { x0, y0, x1, y1 } = chunkSpan(camX, camY, w, h)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) ctx.drawImage(chunkAt(map, cx, cy), cx * CHUNK - camX, cy * CHUNK - camY)
  }
}

/**
 * Builds at most one missing chunk of `map` under the view grown by `margin`
 * px on every side, so chunks are ready before they scroll in and never
 * stall the frame that shows them. True if it built one.
 */
export const warmGround = (map: GroundMap, camX: number, camY: number, w: number, h: number, margin = 0) => {
  cap = capFor(w, h)
  const { x0, y0, x1, y1 } = chunkSpan(camX - margin, camY - margin, w + margin * 2, h + margin * 2)
  for (let cy = y0; cy <= y1; cy++) {
    for (let cx = x0; cx <= x1; cx++) {
      if (chunks.has(chunkKey(map, cx, cy))) continue
      chunkAt(map, cx, cy)
      return true
    }
  }
  return false
}
