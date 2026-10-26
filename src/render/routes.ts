import { blitCentered, blitRotated, canvasCache, lazy, type Palette, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { FORK, type BiomeId } from '../data/biomes'
import type { RouteGate } from '../game/route'
import type { Game } from '../game/types'
import { art, toIconUrl } from './art'
import { grid, limb, outline, put, shade, stamp, toSprite, type Ramp } from './sculpt'
import { dashedRing } from './strokes'

/**
 * The route's art (`game/route.ts`): each biome's emblem (on its gate's sign,
 * in the HUD's fork card and route strip), the route gates standing on the map
 * with a patch of the biome they lead to under their arch, the charge ring of a
 * gate being taken and the arrows to gates off screen.
 */

type Ctx = CanvasRenderingContext2D

/** A biome's emblem: pixel rows and colors (outlined when drawn). */
type Emblem = { rows: readonly string[]; palette: Palette }

const EMBLEMS: Record<BiomeId, Emblem> = {
  meadow: { rows: ['....1.....', '...12...1.', '.1.12..12.', '.12.12.12.', '.12.121221', '1221222221', '1222222221', '.11111111.'], palette: { 1: '#2f7a3a', 2: '#69b84c' } },
  forest: { rows: ['....11....', '...1221...', '..122221..', '...1221...', '..122221..', '.12222221.', '1222222221', '....33....', '....33....'], palette: { 1: '#163e1c', 2: '#45983a', 3: '#7c5430' } },
  beach: { rows: ['...1111...', '..122221..', '..122221..', '...1111...', '..........', '.33...33..', '3443.3443.', '4..343..34'], palette: { 1: '#f8b030', 2: '#f8e048', 3: '#2c70b8', 4: '#78c8f0' } },
  cave: { rows: ['...111...', '..122....', '.122.....', '.12......', '.122.....', '..122....', '...111...', '.33.333..', '344344443'], palette: { 1: '#8878d0', 2: '#e8e0ff', 3: '#4a3e40', 4: '#8c7e7c' } },
  plant: { rows: ['....111', '...121.', '..121..', '.12111.', '.11121.', '...121.', '..121..', '.121...', '.11....'], palette: { 1: '#c89818', 2: '#fff070' } },
  snow: { rows: ['....1....', '.1..1..1.', '..1.1.1..', '...121...', '111222111', '...121...', '..1.1.1..', '.1..1..1.', '....1....'], palette: { 1: '#88b8e8', 2: '#ffffff' } },
  desert: { rows: ['...11....', '..1221...', '..1221.1.', '1.1221121', '121221121', '121222221', '.1222211.', '..1221...', '..1221...'], palette: { 1: '#2c5c28', 2: '#58a040' } },
  tower: { rows: ['..11111..', '.1222221.', '122322321', '122222221', '122222221', '122222221', '121212121'], palette: { 1: '#584870', 2: '#b090d8', 3: '#ffffff' } },
  volcano: { rows: ['..4.3.4..', '...343...', '...3.3...', '...131...', '..12321..', '.1222221.', '122222221'], palette: { 1: '#2e2426', 2: '#6e5e5c', 3: '#f86818', 4: '#f8b040' } },
}

/** Each biome's color on the route: its gate's pennants, its arrow, its chip in the HUD. */
export const ROUTE_COLORS: Record<BiomeId, string> = {
  meadow: '#58b048',
  forest: '#2c8040',
  beach: '#38a8e0',
  cave: '#8878d0',
  plant: '#e0b820',
  snow: '#a8d0f0',
  desert: '#e09848',
  tower: '#a070d0',
  volcano: '#f06020',
}

const emblems = canvasCache<BiomeId, PixelSprite>()

/** A biome's emblem, outlined. */
export const biomeEmblem = (id: BiomeId) => {
  let s = emblems.get(id)
  if (!s) emblems.set(id, (s = art(EMBLEMS[id].rows, EMBLEMS[id].palette, '#181018')))
  return s
}

/** A biome's emblem as an image URL, for the HUD. */
export const biomeIcon = (id: BiomeId) => toIconUrl(`biome:${id}`, () => biomeEmblem(id))

/** What a gate is made of and the ground it shows under its arch. */
type GateLook = { post: Ramp; board: Ramp; ground: readonly [string, string, string] }

const WOOD: Ramp = ['#3c2414', '#5c3c20', '#7c5430', '#9c6c40']
const BOARD: Ramp = ['#a07848', '#c8a070', '#e0c090']

const GATE_LOOKS: Record<BiomeId, GateLook> = {
  meadow: { post: WOOD, board: BOARD, ground: ['#74b452', '#8fd068', '#b8e888'] },
  forest: { post: WOOD, board: BOARD, ground: ['#30622e', '#4a8a40', '#68a84c'] },
  beach: { post: ['#6c5c4c', '#8c7c68', '#aca088', '#c8bca8'], board: BOARD, ground: ['#dcc48c', '#f0dca8', '#68d0f0'] },
  cave: { post: ['#2c2426', '#4a3e40', '#6c5e5e', '#8c7e7c'], board: BOARD, ground: ['#544848', '#76686a', '#9c8c7c'] },
  plant: { post: ['#30343c', '#4c525c', '#6c7480', '#8c96a2'], board: ['#c8a020', '#f0c838', '#f8e070'], ground: ['#70747e', '#8c9098', '#c8b048'] },
  snow: { post: ['#2c3648', '#46546c', '#66788f', '#8a9cb4'], board: BOARD, ground: ['#c8d6ea', '#e4ecf6', '#ffffff'] },
  desert: { post: ['#6c4428', '#9c6438', '#c48450', '#dca468'], board: BOARD, ground: ['#d4a868', '#e4bc7c', '#f4d498'] },
  tower: { post: ['#2c2638', '#4a4258', '#6a6280', '#8e86a4'], board: ['#6a6280', '#8e86a4', '#b0a8c4'], ground: ['#625a72', '#7a7088', '#a098ac'] },
  volcano: { post: ['#1c1416', '#2e2426', '#423436', '#584848'], board: BOARD, ground: ['#3a3034', '#4c4044', '#f86818'] },
}

/** Px from the gate's foot to its sign. */
const GATE_H = 40
const HALF = 18

/**
 * A route gate: two posts with pennants in the biome's color, a crossbeam and a
 * sign with its emblem, over an oval patch of the biome's ground. Anchored at the foot.
 */
const gateSprite = (id: BiomeId) => {
  const look = GATE_LOOKS[id]
  const w = HALF * 2 + 14
  const h = GATE_H + 22
  const g = grid(w, h)
  const cx = Math.floor(w / 2)
  const ground = h - 6
  // The patch of the land beyond, dithered from its ground colors.
  for (let y = -5; y <= 5; y++) {
    for (let x = -HALF - 2; x <= HALF + 2; x++) {
      const d = (x / (HALF + 2)) ** 2 + (y / 5) ** 2
      if (d > 1) continue
      const c = d > 0.72 ? look.ground[0] : (x * 7 + y * 13) % 11 === 0 ? look.ground[2] : look.ground[1]
      put(g, cx + x, ground + y, c)
    }
  }
  const accent = ROUTE_COLORS[id]
  for (const side of [-1, 1]) {
    const px = cx + side * HALF
    limb(g, px, ground + 1, px, ground - GATE_H, 1.6, 1.4, look.post)
    // A pennant flying from the top of each post.
    for (let k = 0; k < 4; k++) for (let y = 0; y < 4 - k; y++) put(g, px + side * (k + 1), ground - GATE_H - 4 + y + Math.floor(k / 2), k === 0 ? '#ffffff' : accent)
  }
  limb(g, cx - HALF - 3, ground - GATE_H + 4, cx + HALF + 3, ground - GATE_H + 4, 1.3, 1.3, look.post)
  // The sign, nailed under the beam, the emblem on it.
  const emblem = EMBLEMS[id]
  const ew = Math.max(...emblem.rows.map((r) => r.length))
  const eh = emblem.rows.length
  const bx0 = cx - Math.ceil(ew / 2) - 2
  const by0 = ground - GATE_H + 6
  for (let y = by0; y < by0 + eh + 4; y++) for (let x = bx0; x < bx0 + ew + 4; x++) put(g, x, y, shade(look.board, y === by0 ? 0.95 : x === bx0 ? 0.7 : 0.5, x, y))
  stamp(g, emblem.rows, emblem.palette, bx0 + 2, by0 + 2)
  outline(g, '#140c08')
  return { sprite: toSprite(g), ax: cx, ay: ground }
}

const gates = canvasCache<BiomeId, ReturnType<typeof gateSprite>>()

const gateOf = (id: BiomeId) => {
  let s = gates.get(id)
  if (!s) gates.set(id, (s = gateSprite(id)))
  return s
}

/** The share of `FORK.charge` filled, as a ring of light around the gate's foot. */
const chargeArc = (ctx: Ctx, x: number, y: number, r: number, k: number) => {
  const steps = Math.ceil(r * TAU * Math.min(1, k))
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + i / r
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.4), 2, 1)
  }
}

const SPARK = lazy(() => art(['.1.', '121', '.1.'], { 1: '#fff8c0', 2: '#ffffff' }))

/** One gate: its sprite, a dashed ring in its color while it's open, its charge, and sparkles rising from the patch. */
const drawGate = (ctx: Ctx, gate: RouteGate, t: number, taken: boolean) => {
  const art = gateOf(gate.biome)
  ctx.drawImage(art.sprite, Math.round(gate.x - art.ax), Math.round(gate.y - art.ay))
  const color = ROUTE_COLORS[gate.biome]
  dashedRing(ctx, gate.x, gate.y, FORK.radius + 4, t * 3, [color, '#ffffff'], taken ? 0.6 : 0.35, 0.4)
  if (gate.charge > 0 && !taken) chargeArc(ctx, gate.x, gate.y, FORK.radius + 6, gate.charge / FORK.charge)
  for (let i = 0; i < (taken ? 5 : 2); i++) {
    const k = (t * 0.6 + i * 0.37 + gate.x * 0.01) % 1
    blitCentered(ctx, SPARK(), gate.x + Math.sin(i * 2.3 + t) * 10, gate.y - k * 28)
  }
}

/** The fork's gates on the map, ground layer: both while it's open, the one taken until its area begins. */
export const drawRouteGates = (ctx: Ctx, g: Game, t: number) => {
  const fork = g.route.fork
  if (!fork) return
  fork.gates.forEach((gate, i) => {
    if (fork.chosen < 0 || fork.chosen === i) drawGate(ctx, gate, t, fork.chosen === i)
  })
}

const ARROW = ['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....']
const arrows = canvasCache<BiomeId, PixelSprite>()
const arrowOf = (id: BiomeId) => {
  let s = arrows.get(id)
  if (!s) arrows.set(id, (s = art(ARROW, { 1: '#ffffff', 2: ROUTE_COLORS[id] }, '#181018')))
  return s
}

/** Screen-space arrows on the edges pointing at an open fork's gates off screen, each with its biome's emblem. */
export const drawRouteArrows = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const fork = g.route.fork
  if (!fork || fork.chosen >= 0) return
  const { w, h } = g.view
  for (const gate of fork.gates) {
    const sx = gate.x - camX
    const sy = gate.y - camY
    if (sx > 0 && sx < w && sy > -10 && sy < h) continue
    const cx = w / 2
    const cy = h / 2
    const angle = Math.atan2(sy - cy, sx - cx)
    const dx = Math.cos(angle)
    const dy = Math.sin(angle)
    const k = Math.min(dx > 0 ? (w - 16 - cx) / dx : dx < 0 ? (16 - cx) / dx : Infinity, dy > 0 ? (h - 40 - cy) / dy : dy < 0 ? (72 - cy) / dy : Infinity)
    const bob = Math.sin(t * 8) * 2
    const ax = cx + dx * (k + bob)
    const ay = cy + dy * (k + bob)
    blitRotated(ctx, arrowOf(gate.biome), ax, ay, angle, 2)
    blitCentered(ctx, biomeEmblem(gate.biome), ax - dx * 16, ay - dy * 16)
  }
}
