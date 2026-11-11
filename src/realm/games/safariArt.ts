import type { SafariHabitat } from '../../data/safari'
import type { SafariDaypart } from './safari.rules'
import { MAP_H, MAP_W, TERRAIN, TILE } from '../../data/safariMaps'
import { createCanvas, context2d } from '../../engine/pixelart'
import { tileAt, vertexAt, type SafariWorld } from './safariWorld'

/**
 * What the Zona Safári paints in code: each preserve's ground under the Wang
 * tiles' edges (PixelLab's `tiles-*` atlases hold the paths' and the water's
 * ground-free pixels, indexed by which corners are on: NW 1, NE 2, SW 4, SE 8),
 * the tall grass as pixel blades in the habitat's ramp, and the grass wipe. The
 * map is baked once into one canvas, so walking only blits it.
 */

/** A backdrop: two sky bands, a far shape on the horizon, two ground bands, and each platform's fill and lighter rim. */
export type SafariScene = {
  sky: readonly [string, string]
  far: string
  ground: readonly [string, string]
  platform: readonly [string, string]
  shape: 'hills' | 'trees' | 'mesas' | 'sea'
}

/** A habitat's colors. `ground` runs dark to light; `tall` is the blades', dark to tip. */
export type SafariTheme = {
  ground: readonly [string, string, string, string]
  /** The battle screen's backdrop and platforms, flat colors only (`paintBackdrop`). */
  scene: SafariScene
  patch: string
  shade: string
  tall: readonly [string, string, string, string]
  tip: string
  blade: 'grass' | 'reed' | 'scrub' | 'frost'
  specks: readonly string[]
  /** Whether the blocking terrain is water (it gets the moving glints). */
  water: boolean
  /** Moving motes over the map: color and how they fall. */
  motes: { color: string; alt: string; drift: 'float' | 'rise' | 'fall' | 'dust' }
  glint: string
  /** The planks of a bridge: light and dark. */
  planks: readonly [string, string]
}

export const THEMES: Record<SafariHabitat, SafariTheme> = {
  meadow: {
    ground: ['#8a9c3a', '#9caf42', '#afbf4c', '#c2cc5d'],
    scene: { sky: ['#bcdcec', '#e8f0d4'], far: '#9fbc64', ground: ['#dccd78', '#cbb763'], platform: ['#bda64f', '#ece08f'], shape: 'hills' },
    patch: '#d3cb68',
    shade: '#55702e',
    tall: ['#6a6424', '#8f7c2c', '#bd9f3a', '#e6cf63'],
    tip: '#f3e9a0',
    blade: 'grass',
    specks: ['#f4d860', '#f0a0b0', '#ffffff'],
    water: true,
    motes: { color: '#fff6b0', alt: '#ffffff', drift: 'float' },
    glint: '#9fe3e0',
    planks: ['#b98a52', '#7b5230'],
  },
  marsh: {
    ground: ['#123a3c', '#184846', '#1f5850', '#2a6a5a'],
    scene: { sky: ['#4c3a78', '#6d5894'], far: '#3a2c5c', ground: ['#2a7264', '#225f55'], platform: ['#1c5048', '#46a08a'], shape: 'trees' },
    patch: '#35785f',
    shade: '#0b2a30',
    tall: ['#0f3235', '#1b5a50', '#2f8468', '#7ac08a'],
    tip: '#c7b488',
    blade: 'reed',
    specks: ['#b48ae0', '#8ad0a0', '#e0d0f0'],
    water: true,
    motes: { color: '#c8f090', alt: '#a0e0ff', drift: 'rise' },
    glint: '#b090e8',
    planks: ['#7d5f5a', '#4a3540'],
  },
  ridge: {
    ground: ['#b88a4e', '#c79a59', '#d4a866', '#dfb777'],
    scene: { sky: ['#efc08a', '#f6dcae'], far: '#b26a48', ground: ['#d9a870', '#c8925a'], platform: ['#aa7444', '#e8c48e'], shape: 'mesas' },
    patch: '#e6c489',
    shade: '#8a5f3a',
    tall: ['#6e4a26', '#a26f30', '#cf9d3e', '#ecc862'],
    tip: '#f6e290',
    blade: 'scrub',
    specks: ['#8c6a48', '#f0d8a8', '#a08060'],
    water: false,
    motes: { color: '#f0d8a0', alt: '#c8a070', drift: 'dust' },
    glint: '#ffffff',
    planks: ['#b98a52', '#7b5230'],
  },
  cove: {
    ground: ['#5e8580', '#6f9a90', '#83ada0', '#9cc0b2'],
    scene: { sky: ['#d2e8f2', '#eef7fa'], far: '#62bec8', ground: ['#e8f3f6', '#cfe2ea'], platform: ['#a9c8d4', '#f8fdff'], shape: 'sea' },
    patch: '#d8ecea',
    shade: '#41645f',
    tall: ['#2d6470', '#3f8c94', '#74bcc0', '#cdeee8'],
    tip: '#ffffff',
    blade: 'frost',
    specks: ['#ffffff', '#c8e8f0', '#8fc0d0'],
    water: true,
    motes: { color: '#ffffff', alt: '#d8f0ff', drift: 'fall' },
    glint: '#e8ffff',
    planks: ['#c0a078', '#7f6048'],
  },
}

/** Mulberry32 for what's baked: the same every time. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const rgb = (hex: string) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)] as const

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const

/** Which of a tile's corners hold `terrain`, as a 0..15 mask. */
const maskOf = (world: SafariWorld, x: number, y: number, terrain: number) => {
  const on = (ax: number, ay: number) => (world.terrain[vertexAt(ax, ay)] === terrain ? 1 : 0)
  return on(x, y) | (on(x + 1, y) << 1) | (on(x, y + 1) << 2) | (on(x + 1, y + 1) << 3)
}

/**
 * The map's ground, once: dithered patches of the ground ramp, darker under the
 * tall grass and the forest, the atlases' edges, specks of flowers and pebbles,
 * and the bridges' planks. `path` and `block` are loaded images.
 */
export const bakeGround = (world: SafariWorld, theme: SafariTheme, path: CanvasImageSource, block: CanvasImageSource, seed: number) => {
  const w = (MAP_W - 1) * TILE
  const h = (MAP_H - 1) * TILE
  const canvas = createCanvas(w, h)
  const g = context2d(canvas)
  const next = seeded(seed)
  const N = 32
  const table = Float32Array.from({ length: N * N }, () => next())
  const lattice = (x: number, y: number) => table[((y & (N - 1)) * N + (x & (N - 1))) | 0]!
  const noise = (x: number, y: number) => {
    const fx = Math.floor(x)
    const fy = Math.floor(y)
    const u = x - fx
    const v = y - fy
    return (lattice(fx, fy) * (1 - u) + lattice(fx + 1, fy) * u) * (1 - v) + (lattice(fx, fy + 1) * (1 - u) + lattice(fx + 1, fy + 1) * u) * v
  }
  const ramp = theme.ground.map(rgb)
  const patch = rgb(theme.patch)
  const img = g.createImageData(w, h)
  const data = img.data
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const n = noise(x / 26, y / 26) * 0.65 + noise(x / 9 + 40, y / 9) * 0.35
      const dither = (BAYER[(y & 3) * 4 + (x & 3)]! + 0.5) / 16 - 0.5
      const band = Math.max(0, Math.min(3, Math.floor(n * 4.2 + dither * 0.75 - 0.1)))
      const big = noise(x / 70 + 13, y / 70 + 7) > 0.74 && dither + (noise(x / 70 + 13, y / 70 + 7) - 0.74) * 14 > 0
      const c = big ? patch : ramp[band]!
      const i = (y * w + x) * 4
      data[i] = c[0]!
      data[i + 1] = c[1]!
      data[i + 2] = c[2]!
      data[i + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)

  // The ground under the forest and the tall grass goes dark, so gaps between trees and blades read as depth.
  g.fillStyle = theme.shade
  for (let y = 0; y < MAP_H - 1; y++) {
    for (let x = 0; x < MAP_W - 1; x++) {
      if (maskOf(world, x, y, TERRAIN.forest) !== 0) g.fillRect(x * TILE, y * TILE, TILE, TILE)
      if (world.tall[tileAt(x, y)] === 1) g.fillRect(x * TILE - 1, y * TILE + 2, TILE + 2, TILE - 2)
    }
  }

  // Specks on the open ground: tufts, flowers, pebbles.
  for (let i = 0; i < 2200; i++) {
    const x = Math.floor(next() * w)
    const y = Math.floor(next() * h)
    const vx = Math.round(x / TILE)
    const vy = Math.round(y / TILE)
    if (world.terrain[vertexAt(vx, vy)] !== TERRAIN.ground) continue
    const roll = next()
    if (roll < 0.1) {
      g.fillStyle = theme.specks[Math.floor(next() * theme.specks.length)]!
      g.fillRect(x, y, 1, 1)
      g.fillRect(x + 1, y + 1, 1, 1)
      g.fillRect(x - 1, y + 1, 1, 1)
      g.fillRect(x, y + 2, 1, 1)
    } else {
      g.fillStyle = roll < 0.55 ? theme.ground[0] : theme.ground[3]
      g.fillRect(x, y, 1, 2)
      g.fillRect(x + 2, y + 1, 1, 2)
    }
  }

  // The atlases' edges over all that.
  for (let y = 0; y < MAP_H - 1; y++) {
    for (let x = 0; x < MAP_W - 1; x++) {
      for (const [terrain, atlas] of [[TERRAIN.path, path], [TERRAIN.block, block]] as const) {
        const mask = maskOf(world, x, y, terrain)
        if (mask !== 0) g.drawImage(atlas, (mask % 4) * TILE, Math.floor(mask / 4) * TILE, TILE, TILE, x * TILE, y * TILE, TILE, TILE)
      }
    }
  }

  // The bridges' planks: a rail either side, boards across.
  const [light, dark] = theme.planks
  for (const b of world.bridges) {
    const horizontal = b.y0 === b.y1
    const x0 = b.x0 * TILE
    const y0 = b.y0 * TILE
    const x1 = b.x1 * TILE
    const y1 = b.y1 * TILE
    if (horizontal) {
      g.fillStyle = dark
      g.fillRect(x0, y0 - 11, x1 - x0, 22)
      g.fillStyle = light
      for (let x = x0; x < x1; x += 4) g.fillRect(x, y0 - 10, 3, 20)
      g.fillStyle = dark
      g.fillRect(x0, y0 - 12, x1 - x0, 2)
      g.fillRect(x0, y0 + 10, x1 - x0, 2)
    } else {
      g.fillStyle = dark
      g.fillRect(x0 - 11, y0, 22, y1 - y0)
      g.fillStyle = light
      for (let y = y0; y < y1; y += 4) g.fillRect(x0 - 10, y, 20, 3)
      g.fillStyle = dark
      g.fillRect(x0 - 12, y0, 2, y1 - y0)
      g.fillRect(x0 + 10, y0, 2, y1 - y0)
    }
  }
  return canvas
}

/** The world px of every fully blocked water tile: where the glints may play. */
export const waterTiles = (world: SafariWorld) => {
  const out: number[] = []
  for (let y = 0; y < MAP_H - 1; y++) for (let x = 0; x < MAP_W - 1; x++) if (maskOf(world, x, y, TERRAIN.block) === 15) out.push(x * TILE, y * TILE)
  return Int16Array.from(out)
}

export const GRASS_CELL = { w: 20, h: 28 } as const
export const GRASS_VARIANTS = 3
export const GRASS_FRAMES = 3

/**
 * The tall grass: `GRASS_VARIANTS` tufts in `GRASS_FRAMES` sways, on one sheet.
 * A tuft is drawn back to front, a mound of the darkest tone and then blades,
 * each leaning further toward its tip as the sway grows.
 */
export const bakeGrass = (theme: SafariTheme) => {
  const { w, h } = GRASS_CELL
  const canvas = createCanvas(w * GRASS_FRAMES, h * GRASS_VARIANTS)
  const g = context2d(canvas)
  const px = (x: number, y: number, c: string, cell: number, row: number) => {
    const fx = Math.round(x)
    if (fx < 0 || fx >= w || y < 0 || y >= h) return
    g.fillStyle = c
    g.fillRect(fx + cell * w, y + row * h, 1, 1)
  }
  for (let variant = 0; variant < GRASS_VARIANTS; variant++) {
    for (let frame = 0; frame < GRASS_FRAMES; frame++) {
      const sway = (frame - 1) * 2.6
      const next = seeded(variant * 101 + 7)
      // The mound: it fills the tile so the ground never shows through the middle, and thins out upward.
      for (let y = h - 11; y < h; y++) {
        const half = Math.round(9.5 - Math.max(0, h - 6 - y) * 0.7)
        for (let x = 10 - half; x < 10 + half; x++) px(x, y, theme.tall[0], frame, variant)
      }
      const blades = 17
      for (let b = 0; b < blades; b++) {
        const front = b / (blades - 1)
        const base = 1 + next() * 18
        const reach = (theme.blade === 'scrub' ? 9 : 12) + next() * 9 + (theme.blade === 'reed' ? 5 : 0)
        const lean = (next() - 0.5) * (theme.blade === 'scrub' ? 12 : 10)
        const baseY = h - 1 - Math.floor(front * 5)
        const tone = Math.min(3, Math.floor(front * 3.2 + next() * 1.1))
        const { tall } = theme
        for (let t = 0; t <= reach; t++) {
          const k = t / reach
          const x = base + (lean + sway * (0.6 + front * 0.6)) * k * k
          const c = k > 0.8 ? tall[Math.min(3, tone + 1)]! : k > 0.4 ? tall[tone]! : tall[Math.max(0, tone - 1)]!
          px(x, baseY - t, c, frame, variant)
          if (k < 0.5) px(x + 1, baseY - t, c, frame, variant)
        }
        const tipX = base + lean + sway * (0.6 + front * 0.6)
        if (theme.blade === 'reed' && b % 4 === 0) for (let t = 0; t < 4; t++) px(tipX, baseY - reach + t, theme.tip, frame, variant)
        else if (theme.blade === 'frost' && b % 2 === 0) px(tipX, baseY - reach, theme.tip, frame, variant)
        else if (theme.blade === 'grass' && b % 4 === 0) {
          px(tipX, baseY - reach, theme.tip, frame, variant)
          px(tipX - 1, baseY - reach + 1, theme.tip, frame, variant)
          px(tipX + 1, baseY - reach + 1, theme.tip, frame, variant)
        } else if (theme.blade === 'scrub' && b % 3 === 0) {
          px(tipX + 1, baseY - reach + 2, tall[2]!, frame, variant)
          px(tipX - 1, baseY - reach + 3, tall[2]!, frame, variant)
        }
      }
    }
  }
  return canvas
}

/**
 * A wall of grass over the whole canvas, `k` 0..1 of the way up (1 hides all):
 * blades of two tones in jagged columns, so the wipe is the grass itself closing in.
 */
export const drawGrassWipe = (g: CanvasRenderingContext2D, W: number, H: number, k: number, theme: SafariTheme, column = 5) => {
  if (k <= 0) return
  const tip = Math.max(1, Math.round((column * 3) / 5))
  for (let i = 0, x = 0; x < W; i++, x += column) {
    const wob = ((i * 7919) % 97) / 97
    const reach = Math.min(1, k * (1.28 - wob * 0.28))
    const top = Math.round(H * (1 - reach) - tip * 4 * (1 - k))
    g.fillStyle = i % 3 === 0 ? theme.tall[1] : i % 3 === 1 ? theme.tall[0] : theme.shade
    g.fillRect(x, top, column, H - top)
    g.fillStyle = theme.tall[2]
    g.fillRect(x + Math.floor(column / 5), top - tip, Math.max(1, column - Math.floor(column / 5) * 2), tip)
    g.fillStyle = theme.tall[3]
    g.fillRect(x + Math.floor(column / 2), top - tip * 2, 1, tip)
  }
}

/**
 * A battle backdrop at the scene's own low resolution: flat bands of sky and
 * ground and one quiet shape on the horizon, a hint of the habitat and no more.
 * `w` and `h` are art pixels; the scene is drawn upscaled as one pixel grid.
 */
export const paintBackdrop = (w: number, h: number, scene: SafariScene) => {
  const c = createCanvas(w, h)
  const g = context2d(c)
  const skyBreak = Math.round(h * 0.26)
  const horizon = Math.round(h * 0.5)
  const groundBreak = Math.round(h * 0.76)
  g.fillStyle = scene.sky[0]
  g.fillRect(0, 0, w, skyBreak)
  g.fillStyle = scene.sky[1]
  g.fillRect(0, skyBreak, w, horizon - skyBreak)
  g.fillStyle = scene.far
  if (scene.shape === 'hills') {
    for (let x = 0; x < w; x++) {
      const rise = Math.round(3 + Math.sin(x * 0.11 + 1) * 2 + Math.sin(x * 0.041) * 2)
      g.fillRect(x, horizon - rise, 1, rise)
    }
  } else if (scene.shape === 'trees') {
    g.fillRect(0, horizon - 3, w, 3)
    // A few bare trunks, each with one branch: enough to say "swamp".
    for (let x = 6; x < w; x += 25 + (x % 7)) {
      const tall = 10 + (x % 5)
      g.fillRect(x, horizon - tall, 2, tall)
      g.fillRect(x - 3, horizon - tall + 3, 4, 1)
      g.fillRect(x + 2, horizon - tall + 6, 3, 1)
    }
  } else if (scene.shape === 'mesas') {
    // Blocky flat-topped steps, drawn left to right.
    const steps = [7, 7, 11, 11, 11, 5, 5, 9, 9, 13, 13, 13, 6, 6, 10, 10]
    for (let x = 0; x < w; x++) {
      const rise = steps[Math.floor(x / 6) % steps.length]!
      g.fillRect(x, horizon - rise, 1, rise)
    }
  } else {
    // The sea as one band, a few glints on it, the snow beginning below.
    g.fillRect(0, horizon - 8, w, 8)
    g.fillStyle = scene.sky[1]
    for (let x = 4; x < w; x += 17) g.fillRect(x, horizon - 5 + (x % 3), 4, 1)
  }
  g.fillStyle = scene.ground[0]
  g.fillRect(0, horizon, w, groundBreak - horizon)
  g.fillStyle = scene.ground[1]
  g.fillRect(0, groundBreak, w, h - groundBreak)
  return c
}

/** A flat platform oval with a lighter rim, in art pixels. */
export const paintPlatform = (rx: number, ry: number, scene: SafariScene) => {
  const c = createCanvas(rx * 2 + 2, ry * 2 + 2)
  const g = context2d(c)
  const oval = (r: number, q: number, color: string) => {
    g.fillStyle = color
    for (let y = -q; y <= q; y++) {
      const half = Math.round(r * Math.sqrt(1 - (y / (q + 0.5)) ** 2))
      g.fillRect(rx + 1 - half, ry + 1 + y, half * 2, 1)
    }
  }
  oval(rx, ry, scene.platform[1])
  oval(rx - 2, ry - 1, scene.platform[0])
  return c
}

/* ---------------- Rock, bait and the moods they bring ---------------- */

/** A throwing rock at scene resolution: grey stone, a lit top and a dark crack. */
export const ROCK_ROWS = ['..oooo..', '.oglllo.', 'ogglllgo', 'ogggglgo', 'odggdggo', 'oddgggdo', '.oddddo.', '..oooo..'] as const
export const ROCK_COLORS = { o: '#20242c', g: '#9098a8', l: '#c8d0dc', d: '#5c6474' } as const

/** Bait: a brown pellet of pressed grain with crumbs of seed in it. */
export const BAIT_ROWS = ['..ooo..', '.obyto.', 'obttbto', 'otbytbo', 'obtttbo', '.obtbo.', '..ooo..'] as const
export const BAIT_COLORS = { o: '#2c1c10', b: '#a86c34', t: '#d09050', y: '#f4d878' } as const

/** The anger mark that pulses by an angry Pokémon's head: four red hooks around a gap. */
export const ANGER_ROWS = ['.r...r.', 'rd...dr', '.dr.rd.', '.......', '.dr.rd.', 'rd...dr', '.r...r.'] as const
export const ANGER_COLORS = { r: '#f04848', d: '#a01828' } as const

/** A small four-point sparkle: the chain's mark. */
const SPARK_ROWS = ['...y...', '...w...', '..ywy..', 'ywwwwwy', '..ywy..', '...w...', '...y...'] as const
const SPARK_COLORS = { y: '#f8c030', w: '#fff8d8' } as const

const SUN_ROWS = ['...y...', '.y.y.y.', '..ooo..', 'yyoooyy', '..ooo..', '.y.y.y.', '...y...'] as const
const SUN_COLORS = { y: '#f8c030', o: '#f8e070' } as const
const MOON_ROWS = ['..mmm..', '.mmd...', 'mmd....', 'mmd....', 'mmd....', '.mmd...', '..mmm..'] as const
const MOON_COLORS = { m: '#f8f0c0', d: '#c8b878' } as const
const DUSK_ROWS = ['.......', '.......', '..ooo..', '.ooooo.', 'ooooooo', 'hhhhhhh', '.h.h.h.'] as const
const DUSK_COLORS = { o: '#f08848', h: '#e0b0a0' } as const
/** Two footprints, for the sneak toggle. */
const STEP_ROWS = ['.oo....', 'oooo...', 'oooo...', '.oo..oo', '....oooo', '....oooo', '.....oo.'] as const
const STEP_COLORS = { o: '#283040' } as const
/** A bug net for the Concurso de Insetos's button and board. */
const NET_ROWS = [
  '...oooooo.',
  '..owmwmwmo',
  '.owmwmwmwo',
  '.omwmwmwmo',
  '.owmwmwmwo',
  '..owmwmwo.',
  '..obooooo.',
  '.obo......',
  'obo.......',
  'oo........',
] as const
const NET_COLORS = { o: '#283040', w: '#f8f8f8', m: '#b8c8d8', b: '#c08040' } as const

const iconUrls = new Map<string, string>()

/** An icon of these rows as an image URL, made once, `scale` times its size so the browser never smooths it. */
const iconUrl = (key: string, rows: readonly string[], colors: Readonly<Record<string, string>>, scale = 4) => {
  const had = iconUrls.get(key)
  if (had) return had
  const w = Math.max(...rows.map((r) => r.length))
  const c = createCanvas(w * scale, rows.length * scale)
  const g = context2d(c)
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row[x]!]
      if (!color) continue
      g.fillStyle = color
      g.fillRect(x * scale, y * scale, scale, scale)
    }
  })
  const url = c.toDataURL()
  c.width = c.height = 0
  iconUrls.set(key, url)
  return url
}

export const ICONS = {
  rock: () => iconUrl('rock', ROCK_ROWS, ROCK_COLORS),
  bait: () => iconUrl('bait', BAIT_ROWS, BAIT_COLORS),
  spark: () => iconUrl('spark', SPARK_ROWS, SPARK_COLORS),
  sun: () => iconUrl('sun', SUN_ROWS, SUN_COLORS),
  moon: () => iconUrl('moon', MOON_ROWS, MOON_COLORS),
  dusk: () => iconUrl('dusk', DUSK_ROWS, DUSK_COLORS),
  step: () => iconUrl('step', STEP_ROWS, STEP_COLORS),
  net: () => iconUrl('net', NET_ROWS, NET_COLORS),
} as const

/* ---------------- The time of day ---------------- */

/**
 * How a time of day tints a habitat: the map takes `wash` multiplied over it
 * (one flat color, so every pixel keeps its edge), the battle backdrop's flat
 * bands are mixed toward `sky`, `ground` by `amount`, and night adds stars, a
 * moon and fireflies. Day is untouched.
 */
export type SafariLight = { wash: string; sky: readonly [string, string]; mix: string; amount: number; stars: boolean; moon: boolean; fireflies: boolean; lamps: boolean }

export const LIGHTS: Record<SafariDaypart, SafariLight | null> = {
  day: null,
  dawn: { wash: '#e8c8e0', sky: ['#a8a0d8', '#f4c8b8'], mix: '#c09ac0', amount: 0.22, stars: false, moon: false, fireflies: false, lamps: false },
  dusk: { wash: '#f0b088', sky: ['#7c5498', '#f09868'], mix: '#c06850', amount: 0.3, stars: false, moon: false, fireflies: true, lamps: true },
  night: { wash: '#5a68b0', sky: ['#141c3c', '#26305c'], mix: '#1c2450', amount: 0.55, stars: true, moon: true, fireflies: true, lamps: true },
}

const hexMix = (a: string, b: string, k: number) => {
  const [ar, ag, ab] = rgb(a)
  const [br, bg, bb] = rgb(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * k).toString(16).padStart(2, '0')
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`
}

/** A backdrop's colors at a time of day: still flat bands, the sky the hour's and the rest mixed toward its shade. */
export const sceneAt = (scene: SafariScene, part: SafariDaypart): SafariScene => {
  const light = LIGHTS[part]
  if (!light) return scene
  const k = light.amount
  const m = (c: string) => hexMix(c, light.mix, k)
  return { ...scene, sky: light.sky, far: hexMix(scene.far, light.mix, Math.min(1, k + 0.15)), ground: [m(scene.ground[0]), m(scene.ground[1])], platform: [m(scene.platform[0]), m(scene.platform[1])] }
}

/** Night's sky over a painted backdrop: a fixed scatter of stars over its upper band and a moon in its corner. */
export const paintNightSky = (g: CanvasRenderingContext2D, w: number, h: number) => {
  const top = Math.round(h * 0.42)
  for (let i = 0; i < 40; i++) {
    const x = (i * 53 + 7) % w
    const y = (i * 29 + 3) % top
    g.fillStyle = i % 5 === 0 ? '#fff8d0' : '#a8b8e8'
    g.fillRect(x, y, 1, 1)
  }
  const cx = w - Math.max(10, Math.round(w * 0.12))
  const cy = Math.max(7, Math.round(h * 0.12))
  for (let y = -4; y <= 4; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 20.25 - y * y)))
    g.fillStyle = '#f8f0c0'
    g.fillRect(cx - half, cy + y, half * 2, 1)
  }
  // The moon's shadow side, for a crescent.
  for (let y = -3; y <= 3; y++) {
    const half = Math.round(Math.sqrt(Math.max(0, 12.25 - y * y)))
    g.fillStyle = LIGHTS.night!.sky[0]
    g.fillRect(cx - half + 3, cy + y - 1, half * 2, 1)
  }
}
