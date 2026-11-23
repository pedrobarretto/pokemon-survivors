import { blitEllipse, blitRing, canvasCache, context2d, createCanvas, lazy } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { circle, type Circle } from '../data/arenas'
import { bodyOf } from '../data/bodies'
import { ENEMIES } from '../data/enemies'
import { RUSH } from '../data/rush'
import { ISLAND_IDS, ISLANDS, type IslandId } from '../data/rushIslands'
import { drawScale } from '../game/alphas'
import { localPlayer } from '../game/players'
import { islandOf, rushGate, type RushState } from '../game/rush'
import type { Game } from '../game/types'
import { detail } from './quality'
import { rgb } from './rift'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * Hoopa's Rings on screen (`game/rush.ts`): each ring's floating island
 * (`data/rushIslands.ts`) adrift in a starry night, its ground and the rock
 * hanging under it painted once from the island's floor into a canvas; what
 * stands on it is the room's terrain, drawn with the map's scenery. Hoopa's
 * small rings stand on each island's rim, the big ring at the gate opens on
 * each legend, and Hoopa floats behind it until the last ring, when it comes
 * through itself, on its own golden island: the round slab of sand rimmed in
 * gold, inlaid with ring portals, the circle of its rings round the fight.
 */

const GOLD = '#f8d048'
const DEEP_GOLD = '#a87010'
const VOID = '#28103c'

/** Hoopa's slab reaches past the rings' circle (its standing rings sit on it), px. */
const STAGE = { margin: 28, rim: 8 } as const
const STAGE_R = RUSH.arena + STAGE.margin

/** The ring portals inlaid in Hoopa's sand, as angles round the middle (none at the north, where the gate stands), and how far out. */
const INLAYS = { at: [-30, 30, 90, 150, -150].map((deg) => (deg * Math.PI) / 180), r: 100, rx: 6, ry: 8 } as const

/** Hoopa's sand: base, its grain, the ripples' crests and troughs, the rim's shadow on it, the sigil's gold and its dark line. */
const SAND = { base: '#c49c64', dark: '#b48a54', light: '#d6b07a', crest: '#e0be84', trough: '#9a7442', shade: '#a8804c', pebble: '#8a6a48', gold: '#c8962c', line: '#8a6020' } as const
/** Hoopa's rim of gold blocks (lit, mid, shaded), its mortar, its inner lip and its outline. */
const RIM = { lit: '#f0c858', mid: '#d8a838', shaded: '#b08020', mortar: '#6a4210', lip: '#8a5a14', outline: '#4a2a08' } as const
/** The night around the islands. */
const NIGHT = '#0b0720'

/**
 * How an island looks: its ground's four tones (darkest first; `base` the
 * one most of it wears), the lip lit along its front edge and the shadow
 * inside its back rim, the rock hanging under it (bands from the rim down,
 * `cap` rows of the ground spilling over first, `hang` strands below:
 * roots, icicles, drips), the outline round it all, and `paint`: what the
 * ground shows at a spot besides its grain (grass, cracks, ripples), or null.
 */
type Look = {
  top: readonly [string, string, string, string]
  base: 1 | 2
  lip: string
  side: readonly string[]
  cap?: { color: string; rows: number }
  hang?: { colors: readonly [string, string]; odds: number; len: number }
  outline: string
  paint: (x: number, y: number, edge: number) => string | null
}

/** A spot's soft wave pattern (presentation only, so plain `Math`): patches of grass, ice or flagstones. */
const waves = (x: number, y: number, a: number, b: number, c: number) => Math.sin(x / a) + Math.sin(y / b + x / 29) + Math.sin((x + y) / c)

/** One pixel out of every `cell`², at a spot the hash picks, where `odds` of the cells get one: flowers, shells, pebbles. */
const speck = (x: number, y: number, cell: number, odds: number, salt: number) => {
  const cx = Math.floor(x / cell)
  const cy = Math.floor(y / cell)
  if (hash2(cx, cy, salt) > odds) return -1
  const at = Math.floor(hash2(cx, cy, salt + 1) * cell * cell)
  return Math.floor(x) - cx * cell === at % cell && Math.floor(y) - cy * cell === Math.floor(at / cell) ? hash2(cx, cy, salt + 2) : -1
}

const FLOWERS = ['#f8d848', '#f87890', '#ffffff', '#b8a0f8'] as const

/** The plate (a cell of jittered points `size` px apart) a spot lies on, set by `cracks`. */
const PLATE = { id: 0 }

/**
 * How far (x, y) lies from the nearest crack between plates of rock (twice the
 * distance, near enough), its edges wobbled so they read as broken stone; the
 * plate is left in `PLATE`.
 */
const cracks = (x: number, y: number, size: number, salt: number) => {
  const wx = x + 2 * Math.sin(y / 5)
  const wy = y + 2 * Math.sin(x / 6)
  const gx = Math.floor(wx / size)
  const gy = Math.floor(wy / size)
  let d1 = Infinity
  let d2 = Infinity
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = gx + dx
      const cy = gy + dy
      const d = Math.hypot(wx - (cx + 0.15 + 0.7 * hash2(cx, cy, salt)) * size, wy - (cy + 0.15 + 0.7 * hash2(cx, cy, salt + 1)) * size)
      if (d < d1) {
        d2 = d1
        d1 = d
        PLATE.id = hash2(cx, cy, salt + 2)
      } else if (d < d2) d2 = d
    }
  }
  return d2 - d1
}

const LOOKS: Record<Exclude<IslandId, 'hoopa'>, Look> = {
  grove: {
    top: ['#2c6428', '#3f8a36', '#58a844', '#86c860'],
    base: 1,
    lip: '#9cd468',
    side: ['#7a5432', '#684628', '#563a22', '#44301c', '#342414'],
    cap: { color: '#3f8a36', rows: 3 },
    hang: { colors: ['#4a3018', '#5e3e20'], odds: 0.22, len: 9 },
    outline: '#16240e',
    paint: (x, y) => {
      const f = speck(x, y, 7, 0.1, 11)
      if (f >= 0) return FLOWERS[Math.floor(f * FLOWERS.length)]!
      // Patches of tall grass: blades in staggered rows, their tips catching the light.
      if (waves(x, y, 13, 11, 17) > 1.5) {
        const row = Math.floor(y) % 4
        if ((Math.floor(x) + Math.floor(y / 4)) % 3 === 0) return row === 0 ? '#86c860' : '#2c6428'
        return row === 3 ? '#356e2c' : null
      }
      return speck(x, y, 5, 0.25, 21) >= 0 ? '#58a844' : null
    },
  },
  crag: {
    top: ['#4e3e30', '#6e5c4a', '#86705a', '#a08a70'],
    base: 1,
    lip: '#b8a080',
    side: ['#6e5a48', '#5c4a3a', '#4a3c30', '#3a2e26', '#2a221c'],
    hang: { colors: ['#4a3c30', '#5c4a3a'], odds: 0.16, len: 7 },
    outline: '#160f0a',
    paint: (x, y) => {
      // Slabs of rock split by dark cracks, lit on their far lip, a crystal glinting here and there.
      const crack = cracks(x, y, 30, 31)
      if (crack < 1.3) return '#3a2e24'
      if (crack < 2.4) return hash2(Math.floor(x), Math.floor(y), 32) < 0.5 ? '#5a4a3a' : null
      const c = speck(x, y, 7, 0.06, 33)
      if (c >= 0) return c < 0.5 ? '#78d8f0' : '#c8f0ff'
      return PLATE.id < 0.3 && hash2(Math.floor(x), Math.floor(y), 34) < 0.7 ? '#7c6852' : PLATE.id > 0.8 && hash2(Math.floor(x), Math.floor(y), 35) < 0.5 ? '#86705a' : null
    },
  },
  dunes: {
    top: ['#a88450', '#c8a066', '#d8b47c', '#ecca92'],
    base: 1,
    lip: '#f4dca8',
    side: ['#b07840', '#9a6634', '#80542c', '#684424', '#50341c'],
    hang: { colors: ['#80542c', '#9a6634'], odds: 0.1, len: 5 },
    outline: '#2a1808',
    paint: (x, y) => {
      // What's left of an old floor: flagstones in patches, broken, half under the sand.
      if (waves(x, y, 23, 19, 31) > 1.25) {
        const row = Math.floor(y / 8)
        const tx = Math.floor((x + (row % 2) * 6) / 12)
        if (hash2(tx, row, 41) < 0.22) return null
        if (Math.floor(y) % 8 === 0 || Math.floor(x + (row % 2) * 6) % 12 === 0) return '#8a6c48'
        return hash2(tx, row, 42) < 0.5 ? '#c0a074' : '#ccac80'
      }
      const v = y + 5 * Math.sin(x / 19) + 2 * Math.sin(x / 7 + y / 31)
      const m = ((v % 9) + 9) % 9
      if (m < 2 && hash2(Math.floor(x / 10), Math.floor(v / 9), 43) < 0.7) return m < 1 ? '#ecca92' : '#a88450'
      return null
    },
  },
  floe: {
    top: ['#9cb4d0', '#c4d8ec', '#dceaf6', '#ffffff'],
    base: 2,
    lip: '#ffffff',
    side: ['#7898b8', '#5c7c9c', '#466282', '#344a66', '#24344c'],
    cap: { color: '#eef6fc', rows: 3 },
    hang: { colors: ['#d0ecff', '#90c8f0'], odds: 0.3, len: 10 },
    outline: '#141e34',
    paint: (x, y) => {
      // Patches of blue ice, a pale rim round them and a streak of sheen here and there.
      const ice = waves(x, y, 17, 13, 23)
      if (ice > 1.75) return (Math.floor(x) - Math.floor(y) + 400) % 31 < 2 && hash2(Math.floor((x - y) / 31), 0, 52) < 0.6 ? '#e8f8ff' : ice > 2.2 ? '#86b8e4' : '#9cc8ec'
      if (ice > 1.62) return '#d4e8f8'
      const v = y + 6 * Math.sin(x / 23)
      if ((((v % 14) + 14) % 14) < 1.5) return '#b8cce2'
      return speck(x, y, 6, 0.1, 51) >= 0 ? '#ffffff' : null
    },
  },
  caldera: {
    top: ['#24160f', '#3a2420', '#4c302a', '#644036'],
    base: 1,
    lip: '#7c5444',
    side: ['#4a302a', '#3a2420', '#2c1c18', '#201410', '#160e0a'],
    hang: { colors: ['#f86018', '#c03010'], odds: 0.08, len: 6 },
    outline: '#080403',
    paint: (x, y) => {
      // Lava glowing in the cracks of the basalt.
      // Plates of basalt; lava glows up through some of the cracks between them, the rest have cooled dark.
      const crack = cracks(x, y, 34, 61)
      const hot = waves(x, y, 31, 37, 43) > -0.4
      if (crack < 1.2) return hot ? '#f8b040' : '#140a08'
      if (crack < 2.3) return hot ? '#e85818' : hash2(Math.floor(x), Math.floor(y), 62) < 0.5 ? '#1c100c' : null
      if (crack < 3.4 && hot) return hash2(Math.floor(x), Math.floor(y), 62) < 0.55 ? '#7a2410' : null
      const a = speck(x, y, 5, 0.18, 63)
      if (a >= 0) return a < 0.5 ? '#5a4640' : '#24160f'
      return PLATE.id < 0.35 && hash2(Math.floor(x), Math.floor(y), 64) < 0.6 ? '#30201a' : null
    },
  },
  shrine: {
    top: ['#2a2438', '#3a3450', '#4a4262', '#5e5678'],
    base: 1,
    lip: '#7a70a0',
    side: ['#4a4260', '#3a3450', '#2e2840', '#221e30', '#181422'],
    hang: { colors: ['#8a60d8', '#5c3ca0'], odds: 0.07, len: 5 },
    outline: '#0c0912',
    paint: (x, y) => {
      // A dotted violet circle round the middle, where the rings' power gathers.
      const d = Math.hypot(x, y)
      if (Math.abs(d - 54) < 1 && Math.floor(Math.atan2(y, x) * 18) % 2 === 0) return '#8a70d0'
      // Flagstones, some broken and grown over.
      const row = Math.floor(y / 9)
      const tx = Math.floor((x + (row % 2) * 6) / 12)
      if (Math.floor(y) % 9 === 0 || Math.floor(x + (row % 2) * 6) % 12 === 0) return '#1e1a2a'
      const h = hash2(tx, row, 71)
      if (h < 0.08) return hash2(Math.floor(x), Math.floor(y), 72) < 0.5 ? '#36503c' : '#2a3a30'
      return h < 0.4 ? '#443c5a' : h > 0.85 ? '#544c70' : null
    },
  },
  atoll: {
    top: ['#b89868', '#e0c48c', '#ecd4a0', '#f8e6bc'],
    base: 1,
    lip: '#ffffff',
    side: ['#c8a070', '#b08a5c', '#94704a', '#78583a', '#5c442c'],
    hang: { colors: ['#3c6c40', '#2c5030'], odds: 0.12, len: 7 },
    outline: '#2a1c10',
    paint: (x, y, edge) => {
      // Surf foam on the rim, wet sand inside it.
      if (edge < 2.5 + 1.2 * Math.sin(x / 5 + y / 7)) return '#f4fbff'
      if (edge < 9) return hash2(Math.floor(x), Math.floor(y), 81) < 0.15 ? '#a88858' : '#c4a474'
      // Tide pools, a few to an island.
      const px = Math.floor(x / 44)
      const py = Math.floor(y / 36)
      if (hash2(px, py, 83) < 0.32) {
        const cx = px * 44 + 10 + hash2(px, py, 84) * 24
        const cy = py * 36 + 10 + hash2(px, py, 85) * 16
        const k = ((x - cx) / 9) ** 2 + ((y - cy) / 5) ** 2
        if (k < 1) return y < cy - 2.5 ? '#2a5890' : Math.abs(y - cy + 1) < 0.6 && Math.abs(x - cx + 2) < 2.5 ? '#c8ecff' : k > 0.75 ? '#5aa0d8' : '#3a78b8'
        if (k < 1.45) return y < cy ? '#9a7c50' : '#d8bc8c'
      }
      const s = speck(x, y, 6, 0.08, 87)
      if (s >= 0) return s < 0.7 ? '#f8b0c0' : '#f87850'
      return speck(x, y, 5, 0.12, 89) >= 0 ? '#7ca850' : null
    },
  },
}

/** The rock hanging under an island: `rim` px under its edge everywhere, `belly` px more under its middle, ragged by up to `rag` px. */
const UNDER = { rim: 14, belly: 64, rag: 10, band: 9 } as const

/** How deep (x, y) lies inside the floor, px (negative outside), and the outward normal of the circle holding it most (`NORMAL`). */
const NORMAL = { x: 0, y: 0 }
const depthIn = (floor: readonly Circle[], x: number, y: number) => {
  let best = -Infinity
  for (const c of floor) {
    const d = Math.hypot(x - c.x, y - c.y)
    if (c.r - d <= best) continue
    best = c.r - d
    NORMAL.x = (x - c.x) / (d || 1)
    NORMAL.y = (y - c.y) / (d || 1)
  }
  return best
}

/** The floor's southern edge at column x (its lowest point there), or -Infinity past it. */
const bottomAt = (floor: readonly Circle[], x: number) => {
  let b = -Infinity
  for (const c of floor) if (Math.abs(x - c.x) < c.r) b = Math.max(b, c.y + Math.sqrt(c.r * c.r - (x - c.x) * (x - c.x)))
  return b
}

/** Hoopa's ground at (x, y), `edge` px in from its rim: gold blocks round the rim, the inlaid rings, the sigil and the rippled sand. */
const hoopaTop = (x: number, y: number, edge: number) => {
  const d = Math.hypot(x, y)
  if (edge < STAGE.rim) {
    if (edge < 1.2) return RIM.outline
    if (edge > STAGE.rim - 1.2) return RIM.lip
    const a = Math.atan2(y, x)
    const seg = (((a / TAU) * 48) % 1 + 1) % 1
    if (seg < 0.07 || Math.abs(edge - 4.6) < 0.5) return RIM.mortar
    const light = (-y / d) * 0.6 - (x / d) * 0.3
    return light > 0.2 ? RIM.lit : light > -0.25 ? RIM.mid : RIM.shaded
  }
  if (edge < STAGE.rim + 3 && (y < 0 || x < 0)) return SAND.shade
  for (const at of INLAYS.at) {
    const ix = Math.cos(at) * INLAYS.r
    const iy = Math.sin(at) * INLAYS.r
    const k = ((x - ix) / INLAYS.rx) ** 2 + ((y - iy) / INLAYS.ry) ** 2
    if (k <= 1.6) return k > 1.15 ? (y - iy < 0 ? RIM.lit : RIM.mid) : k > 0.95 ? RIM.outline : k > 0.5 ? '#2a1040' : '#3c1a58'
  }
  const sigil = Math.abs(d - 48)
  if (sigil < 1.5 || Math.abs(d - 22) < 1) return SAND.gold
  if (sigil < 2.5) return SAND.line
  const v = y + 5 * Math.sin(x / 19) + 2 * Math.sin(x / 7 + y / 31)
  const m = ((v % 9) + 9) % 9
  if (m < 2 && hash2(Math.floor(x / 10), Math.floor(v / 9), 3) < 0.72) return m < 1 ? SAND.crest : SAND.trough
  const grain = hash2(Math.floor(x), Math.floor(y), 1)
  return grain > 0.997 ? SAND.pebble : grain < 0.08 ? SAND.dark : grain > 0.94 ? SAND.light : SAND.base
}

/** Hoopa's island, drawn as the others: its sandstone hanging under the gold. */
const HOOPA_LOOK = {
  side: ['#9a6434', '#845430', '#6e4428', '#583420', '#442818', '#34200f'],
  hang: { colors: ['#a87010', '#f8d048'], odds: 0.05, len: 6 },
  outline: RIM.outline,
} as const

/** The floor an island's art covers: its own, but Hoopa's slab reaches past the rings' circle. */
const artFloor = (id: IslandId): readonly Circle[] => (id === 'hoopa' ? [circle(0, 0, STAGE_R)] : ISLANDS[id].floor)

/** The ground of an island at (x, y), px from its middle, `edge` px in from its rim facing `NORMAL`. */
const groundColor = (look: Look, x: number, y: number, edge: number) => {
  if (edge < 2 && NORMAL.y > 0.25) return look.lip
  if (edge < 5 && NORMAL.y < -0.2 && hash2(Math.floor(x), Math.floor(y), 5) < 0.8) return look.top[0]
  const own = look.paint(x, y, edge)
  if (own) return own
  const grain = hash2(Math.floor(x), Math.floor(y), 1)
  return grain < 0.07 ? look.top[look.base - 1]! : grain > 0.95 ? look.top[look.base + 1]! : look.top[look.base]!
}

/** The rock under an island at column x, `below` px under its rim where it hangs `depth` px; null past it. */
const sideColor = (side: readonly string[], cap: Look['cap'], hang: Look['hang'], x: number, below: number, depth: number, lean: number) => {
  if (below > depth) {
    // Roots, icicles or drips hanging past the rock, a strand every few columns.
    if (!hang || hash2(Math.floor(x / 2), 0, 91) > hang.odds) return null
    const len = 2 + Math.floor(hash2(Math.floor(x / 2), 1, 91) * hang.len)
    return below - depth <= len ? hang.colors[Math.floor(x) % 2]! : null
  }
  if (cap && below <= cap.rows - (Math.floor(x) % 3 === 0 ? 0 : 1)) return cap.color
  const band = Math.min(side.length - 1, Math.floor(below / UNDER.band))
  // The left face catches the light; a crack here and there.
  const lit = hash2(Math.floor(x), Math.floor(below), 93) < lean ? -1 : 0
  const crack = hash2(Math.floor(x / 3), Math.floor(below / 4), 94) < 0.08 ? 1 : 0
  return side[Math.max(0, Math.min(side.length - 1, band + lit + crack))]!
}

type IslandArt = { canvas: HTMLCanvasElement; ox: number; oy: number }

/**
 * Paints island `id` once: its ground over its floor, the rock tapering under
 * it (deepest under its middle, ragged), and an outline round it all. The
 * canvas's (0, 0) is (`ox`, `oy`) px from the island's middle.
 */
const paintIsland = (id: IslandId): IslandArt => {
  const floor = artFloor(id)
  const look = id === 'hoopa' ? null : LOOKS[id]
  const under = look ?? HOOPA_LOOK
  const x0 = Math.min(...floor.map((c) => c.x - c.r))
  const x1 = Math.max(...floor.map((c) => c.x + c.r))
  const y0 = Math.min(...floor.map((c) => c.y - c.r))
  const y1 = Math.max(...floor.map((c) => c.y + c.r))
  const ox = Math.floor(x0) - 2
  const oy = Math.floor(y0) - 2
  const w = Math.ceil(x1) + 3 - ox
  const h = Math.ceil(y1 + UNDER.rim + UNDER.belly + UNDER.rag + 14) - oy
  const mid = (x0 + x1) / 2
  const half = (x1 - x0) / 2
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(w, h)
  const filled = new Uint8Array(w * h)
  const put = (i: number, color: string) => {
    const [r, g, b] = rgb(color)
    img.data[i * 4] = r
    img.data[i * 4 + 1] = g
    img.data[i * 4 + 2] = b
    img.data[i * 4 + 3] = 255
    filled[i] = 1
  }
  for (let px = 0; px < w; px++) {
    const x = px + ox + 0.5
    const bottom = bottomAt(floor, x)
    const u = (x - mid) / half
    const depth = UNDER.rim + UNDER.belly * Math.pow(Math.max(0, 1 - u * u), 1.6) + UNDER.rag * hash2(Math.floor(x / 4), 2, 95) + 4 * hash2(Math.floor(x / 9), 3, 95)
    const lean = Math.max(0, -u - 0.15)
    for (let py = 0; py < h; py++) {
      const y = py + oy + 0.5
      const edge = depthIn(floor, x, y)
      let color: string | null = null
      if (edge >= 0) color = look ? groundColor(look, x, y, edge) : hoopaTop(x, y, edge)
      else if (y > bottom) color = sideColor(under.side, look?.cap, under.hang, x, y - bottom, depth, lean)
      if (color) put(py * w + px, color)
    }
  }
  // One dark outline round the island and its rock.
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const i = py * w + px
      if (filled[i]) continue
      if ((px > 0 && filled[i - 1] === 1) || (px < w - 1 && filled[i + 1] === 1) || (py > 0 && filled[i - w] === 1) || (py < h - 1 && filled[i + w] === 1)) {
        put(i, under.outline)
        filled[i] = 2
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  return { canvas, ox, oy }
}

/** The islands painted so far; only the one in play and the next are kept. */
const islandArts = canvasCache<IslandId, IslandArt>()

const islandArt = (id: IslandId, keep: IslandId) => {
  let art = islandArts.get(id)
  if (art) return art
  for (const other of ISLAND_IDS) if (other !== keep && other !== id) islandArts.delete(other)
  islandArts.set(id, (art = paintIsland(id)))
  return art
}

/** The night's stars, a tile of them; a few bright ones, most dim, and faint haze. */
const STAR_TILE = 160
const STARS = lazy(() => {
  const canvas = createCanvas(STAR_TILE, STAR_TILE)
  const ctx = context2d(canvas)
  for (let i = 0; i < 26; i++) {
    ctx.fillStyle = '#140c2e'
    const x = Math.floor(hash2(i, 1, 41) * STAR_TILE)
    const y = Math.floor(hash2(i, 2, 41) * STAR_TILE)
    for (let k = 0; k < 18; k++) ctx.fillRect((x + Math.floor(hash2(i, k, 42) * 18)) % STAR_TILE, (y + Math.floor(hash2(i, k, 43) * 10)) % STAR_TILE, 2, 1)
  }
  for (let i = 0; i < 70; i++) {
    const x = Math.floor(hash2(i, 3, 41) * STAR_TILE)
    const y = Math.floor(hash2(i, 4, 41) * STAR_TILE)
    const kind = hash2(i, 5, 41)
    ctx.fillStyle = kind < 0.7 ? '#4c4478' : kind < 0.92 ? '#9c9ccc' : '#f8f0d0'
    ctx.fillRect(x, y, 1, 1)
    if (kind > 0.97) {
      ctx.fillStyle = '#8c84b8'
      ctx.fillRect(x - 1, y, 1, 1)
      ctx.fillRect(x + 1, y, 1, 1)
      ctx.fillRect(x, y - 1, 1, 1)
      ctx.fillRect(x, y + 1, 1, 1)
    }
  }
  return canvas
})

/** A small far island: a sliver of grass over its rock, tapering to a point, a tree on it, in the night's dim colors. */
const farIsle = (ctx: Ctx, x: number, y: number, size: number) => {
  for (let dx = -size; dx <= size; dx++) {
    const k = 1 - (dx / size) ** 2
    const top = Math.round(Math.sqrt(k) * size * 0.28)
    const hang = Math.round(Math.pow(k, 1.6) * size * 0.9) + 2
    ctx.fillStyle = '#2e4a40'
    ctx.fillRect(x + dx, y - top, 1, top * 2 + 1)
    ctx.fillStyle = '#44665a'
    ctx.fillRect(x + dx, y - top, 1, 1)
    ctx.fillStyle = '#2a2244'
    ctx.fillRect(x + dx, y + top + 1, 1, Math.ceil(hang / 2))
    ctx.fillStyle = '#1e1834'
    ctx.fillRect(x + dx, y + top + 1 + Math.ceil(hang / 2), 1, Math.floor(hang / 2))
  }
  blitEllipse(ctx, 3, 3, '#2a443a', x - Math.round(size * 0.3), y - Math.round(size * 0.28) - 4)
  ctx.fillStyle = '#241c18'
  ctx.fillRect(x - Math.round(size * 0.3), y - Math.round(size * 0.28) - 1, 1, 2)
}

/** Far off in the night, Hoopa's other rings drift and other islands float: a tile of them, dim with distance. */
const FAR_TILE = 260
const FAR_RINGS = lazy(() => {
  const canvas = createCanvas(FAR_TILE, FAR_TILE)
  const ctx = context2d(canvas)
  const [x, y] = [70, 90]
  blitEllipse(ctx, 13, 17, '#5a3e14', x, y)
  blitEllipse(ctx, 12, 16, '#7a5820', x, y)
  blitEllipse(ctx, 10, 14, '#150b2c', x, y)
  blitEllipse(ctx, 9, 13, '#1d1038', x, y)
  ctx.fillStyle = '#a07c30'
  ctx.fillRect(x - 9, y - 12, 2, 2)
  blitEllipse(ctx, 6, 8, '#4a3410', 200, 210)
  blitEllipse(ctx, 5, 7, '#140a28', 200, 210)
  farIsle(ctx, 190, 60, 16)
  farIsle(ctx, 40, 200, 10)
  return canvas
})

/** Fills the view with a tile scrolled at `k` of the camera's pace (parallax). */
const tileView = (ctx: Ctx, tile: HTMLCanvasElement, size: number, camX: number, camY: number, w: number, h: number, k: number) => {
  const ox = -((((Math.round(camX * k) % size) + size) % size))
  const oy = -((((Math.round(camY * k) % size) + size) % size))
  for (let y = oy; y < h; y += size) for (let x = ox; x < w; x += size) ctx.drawImage(tile, x, y)
}

/** Each island's drifting motes (fireflies, embers, wisps...): how they move and their two colors; none on the dunes and Hoopa's. */
const MOTES: Partial<Record<IslandId, { kind: 'bob' | 'rise' | 'twinkle'; colors: readonly [string, string] }>> = {
  grove: { kind: 'bob', colors: ['#f0f890', '#a8d848'] },
  crag: { kind: 'twinkle', colors: ['#c8f0ff', '#78d8f0'] },
  floe: { kind: 'twinkle', colors: ['#ffffff', '#b8dcf8'] },
  caldera: { kind: 'rise', colors: ['#f8c040', '#e85818'] },
  shrine: { kind: 'bob', colors: ['#c8a8f8', '#8a60d8'] },
  atoll: { kind: 'twinkle', colors: ['#ffffff', '#c8e8f8'] },
}

/** Spots well on each island for its motes, found once. */
const moteSpots = new Map<IslandId, readonly (readonly [number, number])[]>()
const spotsOf = (id: IslandId) => {
  let spots = moteSpots.get(id)
  if (spots) return spots
  const floor = ISLANDS[id].floor
  const found: (readonly [number, number])[] = []
  for (let i = 0; found.length < 16 && i < 200; i++) {
    const x = Math.round((hash2(i, 1, 97) - 0.5) * 300)
    const y = Math.round((hash2(i, 2, 97) - 0.5) * 300)
    if (depthIn(floor, x, y) > 10) found.push([x, y])
  }
  moteSpots.set(id, (spots = found))
  return spots
}

/** An island's motes, over its ground (world space). */
const drawMotes = (ctx: Ctx, r: RushState, t: number) => {
  const motes = MOTES[r.island]
  if (!motes) return
  spotsOf(r.island).forEach(([sx, sy], i) => {
    const phase = t * 0.5 + hash2(i, 3, 97) * 7
    let x = r.room.x + sx
    let y = r.room.y + sy
    if (motes.kind === 'bob') {
      x += Math.round(Math.sin(phase * 1.3) * 6)
      y += Math.round(Math.sin(phase * 0.9) * 4) - 8
      if (Math.floor(phase * 2) % 4 === 0) return
    } else if (motes.kind === 'rise') {
      const k = phase % 1
      y -= Math.round(k * 22)
      x += Math.round(Math.sin(phase * 5) * 2)
      if (k > 0.8) return
    } else if (Math.floor(phase * 3) % 5 !== 0) return
    ctx.fillStyle = motes.colors[0]
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
    ctx.fillStyle = motes.colors[1]
    if (motes.kind === 'twinkle') {
      ctx.fillRect(Math.round(x) - 1, Math.round(y), 1, 1)
      ctx.fillRect(Math.round(x) + 1, Math.round(y), 1, 1)
      ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 1)
      ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1)
    } else ctx.fillRect(Math.round(x), Math.round(y) + 1, 1, 1)
  })
}

/**
 * The rush's floor, under everything (screen space): the night, its far rings
 * and islands and its stars sliding behind, a few stars twinkling, and the
 * ring's island. Between rings the next island is painted ahead, so it never
 * costs a frame as the ring opens; a lean frame leaves the far tile and the
 * twinkling out.
 */
export const drawRushFloor = (ctx: Ctx, g: Game, camX: number, camY: number, w: number, h: number, t: number) => {
  const r = g.rush
  if (!r) return
  const lean = detail.lean
  ctx.fillStyle = NIGHT
  ctx.fillRect(0, 0, w, h)
  if (!lean) tileView(ctx, FAR_RINGS(), FAR_TILE, camX, camY, w, h, 0.15)
  tileView(ctx, STARS(), STAR_TILE, camX, camY, w, h, 0.35)
  for (let i = 0; !lean && i < 14; i++) {
    if (Math.floor(t * 2 + hash2(i, 1, 51) * 7) % 5 !== 0) continue
    const x = Math.floor(hash2(i, 2, 51) * w)
    const y = Math.floor(hash2(i, 3, 51) * h)
    ctx.fillStyle = '#fff8e0'
    ctx.fillRect(x, y, 1, 1)
    ctx.fillStyle = '#b8b0e0'
    ctx.fillRect(x - 1, y, 1, 1)
    ctx.fillRect(x + 1, y, 1, 1)
    ctx.fillRect(x, y - 1, 1, 1)
    ctx.fillRect(x, y + 1, 1, 1)
  }
  const next = r.stage === 'rest' ? islandOf(r.lineup, r.ring + 1) : r.island
  if (next !== r.island) islandArt(next, r.island)
  const art = islandArt(r.island, next)
  ctx.drawImage(art.canvas, Math.round(r.room.x) + art.ox - camX, Math.round(r.room.y) + art.oy - camY)
}

/** One of Hoopa's rings standing on the ground: a golden hoop around a dark portal, its glint running round it. */
const standingRing = (ctx: Ctx, x: number, y: number, size: number, t: number, open = 1) => {
  const rx = Math.max(2, Math.round(size * 0.6 * open))
  const ry = Math.max(2, Math.round(size * open))
  const cy = y - ry - 2
  blitEllipse(ctx, rx + 3, 3, 'rgba(16,8,24,0.35)', x, y)
  blitEllipse(ctx, rx + 2, ry + 2, DEEP_GOLD, x, cy)
  blitEllipse(ctx, rx, ry, GOLD, x, cy)
  blitEllipse(ctx, Math.max(1, rx - 3), Math.max(1, ry - 3), VOID, x, cy)
  const a = t * 3 + x * 0.01
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(Math.round(x + Math.cos(a) * (rx - 1)), Math.round(cy + Math.sin(a) * (ry - 1)), 2, 2)
  // Motes drifting into the portal.
  ctx.fillStyle = '#c890f0'
  for (let i = 0; i < 3; i++) {
    const q = (t * 0.7 + i / 3 + x * 0.003) % 1
    ctx.fillRect(Math.round(x + Math.cos(i * 2.1 + t) * (rx - 3) * (1 - q)), Math.round(cy + Math.sin(i * 2.1 + t) * (ry - 3) * (1 - q)), 1, 1)
  }
}

/**
 * Ground layer: the island's motes and Hoopa's rings standing on its rim (on
 * its own island, the golden circle the fight keeps to and seven rings round
 * it), the gate's ring last (behind whoever steps out of it).
 */
export const drawRushGround = (ctx: Ctx, g: Game, t: number) => {
  const r = g.rush
  if (!r) return
  const { x, y } = r.home
  if (!detail.lean) drawMotes(ctx, r, t)
  if (r.island === 'hoopa') {
    blitRing(ctx, RUSH.arena + 2, 1, DEEP_GOLD, x, y)
    blitRing(ctx, RUSH.arena, 2, GOLD, x, y)
    ctx.globalAlpha = 0.3
    blitRing(ctx, RUSH.arena - 4, 3, '#f8e8a8', x, y)
    ctx.globalAlpha = 1
    // Seven rings round the circle (the north spot is the gate's).
    for (let i = 1; i < 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * TAU
      standingRing(ctx, Math.round(x + Math.cos(a) * (RUSH.arena + 8)), Math.round(y + Math.sin(a) * (RUSH.arena + 8)), 10, t)
    }
  } else for (const [rx, ry] of ISLANDS[r.island].rings) standingRing(ctx, Math.round(x + rx), Math.round(y + ry), 9, t)
  const gate = rushGate(r)
  const opening = r.stage === 'gate' ? Math.min(1, 1 - r.clock / RUSH.gate + 0.15) : r.stage === 'fight' ? 1 : 0.55
  standingRing(ctx, Math.round(gate.x), Math.round(gate.y - 6), 22, t, opening)
  drawHost(ctx, r, gate, t)
}

/**
 * Hoopa floating behind the gate, watching, until it comes through on the
 * last ring: drawn with the ground, so the ring's legend (a Palkia stands
 * tall) is never under it.
 */
const drawHost = (ctx: Ctx, r: RushState, gate: { x: number; y: number }, t: number) => {
  if (r.lineup[r.ring] === 'hoopa' || r.stage === 'cleared') return
  const bob = Math.round(Math.sin(t * 2.4) * 2)
  drawPokemon(ctx, sprites(ENEMIES.hoopa.dex), 'Idle', 0, t, Math.round(gate.x + 40), Math.round(gate.y - 44 + bob))
}

/* ---------------- Framing the ring's legend ---------------- */

/** How tall the gate's frame keeps room for before its legend comes through (world px over the gate): about a legend's body. */
const GATE_TALL = 34

/** The screen's room the HUD leaves (world px from the top and the bottom), measured by the shell (`syncMarkerInsets` in `main.ts`). */
let room = { top: 0, bottom: 8 }
let nudge = 0
let nudgedAt = 0

/** The shell measures the HUD's top (the boss bar or the pill under it, whichever ends lower) and what covers the bottom's middle. */
export const setRushRoom = (next: { top: number; bottom: number }) => {
  room = next
}

/**
 * The drawn camera in Hoopa's Rings, as `frameRaid` does a raid's: the
 * simulation frames the player and the ring's legend (`rushCamera`) without
 * knowing the HUD, so on a short screen (a phone held sideways) the legend
 * coming through the gate, north of the player, would stand under the boss
 * bar. Where the legend's top (or, while the ring opens, the gate's frame)
 * would sit under the HUD, the drawn camera rises until it clears it, as far
 * as the player's feet and HP bar stay above what covers the bottom's middle.
 * Eased, and only ever up. Writes `g.camera.y` from `base`, the camera as
 * the simulation aimed it; nothing outside a rush.
 */
export const frameRush = (g: Game, t: number, base: number) => {
  const r = g.rush
  if (!r) {
    nudge = 0
    return
  }
  const p = localPlayer(g)
  const boss = r.stage === 'fight' ? g.enemies.find((e) => e.id === r.bossId && e.dying < 0) : undefined
  const top = boss ? boss.y - bodyOf(ENEMIES[boss.kind].dex).bodyH * drawScale(boss) : r.stage === 'gate' ? rushGate(r).y - GATE_TALL : null
  const dt = Math.min(0.1, Math.max(0, t - nudgedAt))
  nudgedAt = t
  if (top === null || p.hp <= 0) {
    // Between rings the frame eases back to the simulation's.
    nudge -= nudge * Math.min(1, dt * 4)
  } else {
    const need = room.top + 2 - (top - base)
    // The feet, and the HP bar under them, keep above the bottom's cover.
    const below = g.view.h - room.bottom - (p.y + 8 - base)
    const want = need > 0 ? -Math.min(need, Math.max(0, below)) : 0
    nudge += (want - nudge) * Math.min(1, dt * 6)
  }
  g.camera.y = base + Math.round(nudge)
}
