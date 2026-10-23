import { blitEllipse, blitRotated, canvasCache, context2d, createCanvas } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { ARENA_LAYOUTS, type ArenaLayout, type FloorPattern, type FloorPlan } from '../data/arenas'
import { ARENAS, RIFT, type ArenaTheme, type RiftLegend } from '../data/rifts'
import { fits, floorAt, holesAt, lavaDepth, onBridge, stepsAt, stepWarning } from '../game/arenaFloor'
import type { RiftArena, RiftPortal } from '../game/rift'
import type { Game } from '../game/types'
import { art, lazy } from './art'
import { shade, type Ramp } from './sculpt'
import { dashedRing } from './strokes'
import { localPlayer } from '../game/players'

type Ctx = CanvasRenderingContext2D

/* ---------------- Arena ---------------- */

export const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)] as const
export const mix = (a: string, b: string, k: number) => {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  const c = (u: number, v: number) => Math.round(u + (v - u) * k).toString(16).padStart(2, '0')
  return `#${c(r1, r2)}${c(g1, g2)}${c(b1, b2)}`
}

/* Floor patterns, in arena coordinates. */

export type Pattern = (x: number, y: number, t: ArenaTheme) => string

/** Concentric temple rings split into sectors. */
const rings: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const d = Math.sqrt(x * x + y * y)
  const W = 18
  if (d < W) return d > W - 4 && d < W - 2 ? t.wall[0] : hash2(Math.floor(x), Math.floor(y), 9) < 0.1 ? alt : base
  const band = Math.floor(d / W)
  const sectors = 6 + band * 6
  const s = ((Math.atan2(y, x) + Math.PI) / TAU) * sectors
  if (d % W < 1 || (s % 1) * ((d * TAU) / sectors) < 1) return grout
  const c = (band + Math.floor(s)) % 2 === 0 ? base : alt
  return hash2(Math.floor(x), Math.floor(y), 7) < 0.06 ? (c === base ? alt : base) : c
}

/** Lacquered floorboards in staggered rows. */
const planks: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const row = Math.floor((y + 400) / 7)
  const shift = (row % 3) * 13
  if ((y + 400) % 7 < 1 || (x + 400 + shift) % 38 < 1) return grout
  const tone = hash2(row, Math.floor((x + 400 + shift) / 38), 3) < 0.5 ? base : alt
  return hash2(Math.floor(x / 5), Math.floor(y), 4) < 0.08 ? mix(tone, grout, 0.35) : tone
}

/** Big marble slabs with a few veins. */
const slabs: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const S = 22
  const tx = Math.floor((x + 400) / S)
  const ty = Math.floor((y + 400) / S)
  if ((x + 400) % S < 1 || (y + 400) % S < 1) return grout
  const tone = (tx + ty) % 2 === 0 ? base : alt
  const vein = Math.abs(((x + y * 0.6 + hash2(tx, ty, 2) * 40 + 400) % 29) - 14) < 0.5 && hash2(tx, ty, 5) < 0.3 && hash2(Math.floor(x / 4), Math.floor(y / 4), 6) < 0.7
  return vein ? mix(tone, '#ffffff', 0.35) : tone
}

/** Basalt columns seen from above: irregular cells, some seams still glowing. */
const basalt: Pattern = (x, y, t) => {
  const [base, alt, glow] = t.floor
  const S = 13
  const gx = Math.floor((x + 400) / S)
  const gy = Math.floor((y + 400) / S)
  let d1 = Infinity
  let d2 = Infinity
  let id = 0
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = (gx + i + 0.2 + hash2(gx + i, gy + j, 1) * 0.6) * S - 400
      const cy = (gy + j + 0.2 + hash2(gx + i, gy + j, 2) * 0.6) * S - 400
      const d = Math.hypot(x - cx, y - cy)
      if (d < d1) {
        d2 = d1
        d1 = d
        id = (gx + i) * 977 + (gy + j)
      } else if (d < d2) d2 = d
    }
  }
  if (d2 - d1 < 1.3) return hash2(id, 0, 3) < 0.4 ? glow : '#1c0c08'
  const tone = hash2(id, 0, 4) < 0.5 ? base : alt
  if (d2 - d1 < 3 && hash2(id, 1, 4) < 0.5) return mix(tone, '#000000', 0.2)
  return hash2(Math.floor(x), Math.floor(y), 5) < 0.04 ? mix(tone, '#ffffff', 0.12) : tone
}

/** Wet sea-cave rock: blotches of two shades, a few dark pits and wet glints. */
const wetRock: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const n = hash2(Math.floor((x + 400) / 11), Math.floor((y + 400) / 8), 1) * 0.55 + hash2(Math.floor((x + 400) / 5), Math.floor((y + 400) / 4), 2) * 0.45
  const h = hash2(Math.floor(x), Math.floor(y), 4)
  if (h < 0.025) return grout
  if (h > 0.995) return t.wall[0]
  return n > 0.56 ? alt : base
}

/** Square jade tiles laid on the diagonal (the Sky Pillar is a diamond), a gold seal in the middle. */
const TILE = 15
const jade: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const d = Math.sqrt(x * x + y * y)
  if ((d > 26 && d < 29) || d < 6) return t.wall[0]
  const u = (x + y) / Math.SQRT2
  const v = (y - x) / Math.SQRT2
  const tu = Math.floor(u / TILE)
  const tv = Math.floor(v / TILE)
  if (u - tu * TILE < 1 || v - tv * TILE < 1) return grout
  return (tu + tv) % 2 === 0 ? base : alt
}

/** Beach sand in wind ripples, with darker grains and a few pale shells. */
const sand: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const h = hash2(Math.floor(x), Math.floor(y), 3)
  if (h < 0.03) return grout
  if (h > 0.997) return '#f8f0e0'
  return (y + Math.sin(x / 11) * 3 + 400) % 9 < 1.2 ? alt : base
}

/** Meteor rock: blotchy stone pitted with craters, their far wall catching the light. */
const craters: Pattern = (x, y, t) => {
  const [base, alt, grout] = t.floor
  const S = 34
  const gx = Math.floor((x + 400) / S)
  const gy = Math.floor((y + 400) / S)
  const dx = x - ((gx + 0.3 + hash2(gx, gy, 1) * 0.4) * S - 400)
  const dy = y - ((gy + 0.3 + hash2(gx, gy, 2) * 0.4) * S - 400)
  const r = 4 + hash2(gx, gy, 3) * 9
  const d = Math.sqrt(dx * dx + dy * dy)
  if (d < r) return d > r - 1.5 && dx + dy > 0 ? alt : mix(base, grout, 0.5)
  if (d < r + 1) return grout
  const h = hash2(Math.floor(x), Math.floor(y), 4)
  if (h > 0.996) return t.wall[0]
  return hash2(Math.floor((x + 400) / 9), Math.floor((y + 400) / 7), 1) > 0.6 ? alt : base
}

/** A dreamed meadow (the Eon duo's Southern Island): soft grass in mown bands, scattered with red, blue and white flowers. */
const garden: Pattern = (x, y) => {
  const h = hash2(Math.floor(x), Math.floor(y), 6)
  // Flowers grow in little clumps: a cell decides the color, a pixel whether one stands there.
  const cell = hash2(Math.floor(x / 5), Math.floor(y / 5), 7)
  if (h > 0.985 && cell > 0.55) return cell > 0.85 ? '#f87890' : cell > 0.7 ? '#88b0f8' : '#f8f0f8'
  if (h < 0.025) return '#3c7c40'
  const band = (y + Math.sin(x / 17) * 4 + 4000) % 22 < 11
  return band ? '#5ca450' : '#66ae58'
}

export const PATTERNS: Record<FloorPattern, Pattern> = { rings, planks, slabs, basalt, wetRock, jade, sand, craters, garden }

/** Inlays drawn over the pattern: the Bell Tower's gold band and the Spear Pillar's clock. */
const INLAYS: Partial<Record<RiftLegend, (x: number, y: number, t: ArenaTheme) => string | null>> = {
  hoOh: (x, y, t) => {
    let d = 0
    for (let i = 0; i < 4; i++) d = Math.max(d, Math.abs(x * Math.cos((i * Math.PI) / 4) + y * Math.sin((i * Math.PI) / 4)))
    return d > 138 && d < 142 ? t.wall[0] : d >= 142 && d < 143 ? t.wall[1] : null
  },
  dialga: (x, y, t) => {
    const d = Math.hypot(x, y - 8)
    if (d > 40 && d < 43) return t.wall[0]
    if (d > 43 && d < 44) return t.wall[1]
    const a = Math.atan2(y - 8, x) / (TAU / 12)
    return d > 33 && d < 40 && Math.abs(a - Math.round(a)) < 0.08 ? t.wall[0] : null
  },
}

/** The color at (x, y) with a floor plan's lava rivers over it: the bridges' planks, the flowing lava, its glow on the banks. */
export const lavaColor = (layout: FloorPlan, x: number, y: number, color: string) => {
  const d = lavaDepth(layout, x, y)
  if (d <= -4) return color
  const b = layout.bridges?.find((r) => Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2)
  if (d > 0 && b && onBridge(layout, x, y)) {
    const along = b.w > b.h ? x : y
    const rail = b.w > b.h ? Math.abs(y - b.y) > b.h / 2 - 2 : Math.abs(x - b.x) > b.w / 2 - 2
    return rail ? '#1c0c08' : Math.floor(along + 400) % 5 === 0 ? '#2a1610' : hash2(Math.floor(along / 5), 0, 2) < 0.5 ? '#5a3a28' : '#684430'
  }
  if (d > 0) {
    const flow = hash2(Math.floor((x + y * 0.3) / 6), Math.floor(y / 4), 6)
    return d < 2 ? '#a02808' : d < 4 ? '#e85818' : flow < 0.35 ? '#f8e060' : '#f89830'
  }
  return mix(color, '#e05818', 0.45 + d * 0.1)
}

/** The platform's side under each floor's south edges. */
export const FACES: Record<RiftLegend, Ramp> = {
  lugia: ['#0c1428', '#1c2c4c', '#2c3c5c', '#40547a'],
  hoOh: ['#200c08', '#401810', '#5c2418', '#7c3420'],
  kyogre: ['#04141c', '#0c2830', '#143c48', '#205060'],
  groudon: ['#100604', '#241010', '#3a1c14', '#52281c'],
  rayquaza: ['#0c1a10', '#1c3424', '#2c4c34', '#3c6448'],
  dialga: ['#101428', '#20284a', '#30385c', '#444c70'],
  latias: ['#3c2c18', '#5c4428', '#7c6038', '#987848'],
  latios: ['#2c2014', '#4a3824', '#685034', '#806444'],
  deoxys: ['#0c0814', '#1c1428', '#2c2038', '#3c3050'],
  darkrai: ['#040208', '#0c0814', '#181024', '#241a36'],
}

const SIZE = 380
const C = SIZE / 2
const FACE = 14

/** How a floor is drawn: after `crumble` and `tide` steps, flashing what's next (`warn`) or red as the rift collapses. */
type FloorLook = { crumble: number; tide: number; warn: boolean; collapse: boolean }

/**
 * Bakes an arena's floor: the pattern clipped to the floor shapes, a lit rim,
 * the platform's side below its south edges, deep water in the holes, lava
 * rivers with their bridges, shallow water around islands.
 */
const buildFloor = (legend: RiftLegend, look: FloorLook) => {
  const layout: ArenaLayout = ARENA_LAYOUTS[legend]
  const theme = ARENAS[legend]
  const floor = floorAt(layout, look.crumble)
  const holes = holesAt(layout, look.tide)
  const nextFloor = floorAt(layout, look.crumble + 1)
  const nextHoles = holesAt(layout, look.tide + 1)
  const pattern = PATTERNS[layout.pattern]
  const inlay = INLAYS[legend]
  const [light, dark] = look.collapse ? (['#f86060', '#b01818'] as const) : theme.wall
  const mask = new Uint8Array(SIZE * SIZE)
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const x = px - C + 0.5
      const y = py - C + 0.5
      mask[py * SIZE + px] = floor.some((s) => fits(s, x, y, 0)) && !holes.some((h) => fits(h, x, y, 0)) ? 1 : 0
    }
  }
  const at = (px: number, py: number) => px >= 0 && py >= 0 && px < SIZE && py < SIZE && mask[py * SIZE + px] === 1
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(SIZE, SIZE)
  const set = (px: number, py: number, color: string) => {
    const [r, g, b] = rgb(color)
    const i = (py * SIZE + px) * 4
    img.data[i] = r
    img.data[i + 1] = g
    img.data[i + 2] = b
    img.data[i + 3] = 255
  }
  for (let py = 0; py < SIZE; py++) {
    for (let px = 0; px < SIZE; px++) {
      const x = px - C + 0.5
      const y = py - C + 0.5
      if (!at(px, py)) {
        // The platform's side below a south edge, else deep water or the void.
        let k = 0
        for (let d = 1; d <= FACE && !k; d++) if (at(px, py - d)) k = d
        if (k) set(px, py, shade(FACES[legend], 0.9 - k / FACE + (k % 4 === 0 ? -0.25 : 0) + (hash2(px >> 2, k, 3) - 0.5) * 0.2, px, py))
        else if (holes.some((h) => fits(h, x, y, 0))) {
          const wave = Math.abs(((y + Math.sin(x / 9) * 2.5 + 400) % 10) - 5) < 0.6 && hash2(Math.floor(x / 14), Math.floor(y / 10), 1) < 0.7
          set(px, py, wave ? '#3890c0' : hash2(px, py, 2) < 0.5 ? '#0c3450' : '#0e3a58')
        }
        continue
      }
      let near = 0
      for (let d = 1; d <= 2 && !near; d++) if (!at(px + d, py) || !at(px - d, py) || !at(px, py + d) || !at(px, py - d)) near = d
      let color = inlay?.(x, y, theme) ?? pattern(x, y, theme)
      if (layout.shallow?.some((s) => fits(s, x, y, 0)) && !layout.islands?.some((s) => fits(s, x, y, 0))) {
        const shore = layout.islands?.some((s) => fits(s, x, y, -2))
        // Islands rise a few px out of the water: their side shows under the south shore.
        const side = layout.islands?.some((s) => fits(s, x, y - 5, 0) && y > s.y)
        const rim = layout.shallow.some((s) => s.kind === 'circle' && s.r < 150 && fits(s, x, y, 0) && !fits(s, x, y, 2))
        const ripple = Math.abs(((Math.sqrt(x * x + y * y) + hash2(Math.floor(x / 16), Math.floor(y / 16), 4) * 9) % 13) - 6) < 0.5 && hash2(px >> 3, py >> 3, 5) < 0.5
        color = side ? mix(theme.wall[1], '#000000', 0.35) : shore ? '#d8f0f8' : rim ? '#1c5070' : ripple ? '#88c8e8' : mix(color, '#2878b0', 0.62)
      }
      if (layout.lava) color = lavaColor(layout, x, y, color)
      // What falls or floods next shows up during the warning.
      if (look.warn) {
        if (layout.crumble && !nextFloor.some((s) => fits(s, x, y, 0))) color = mix(color, '#f83838', 0.45)
        if (layout.tide && nextHoles.some((h) => fits(h, x, y, 0))) color = mix(color, '#58b8f8', 0.5)
      }
      if (near === 1) color = light
      else if (near === 2) color = dark
      set(px, py, color)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

const floors = canvasCache<string, HTMLCanvasElement>()
const lookKey = (legend: RiftLegend, l: FloorLook) => `${legend}:${l.crumble}:${l.tide}:${l.warn ? 1 : 0}:${l.collapse ? 1 : 0}`

const floorOf = (legend: RiftLegend, look: FloorLook) => {
  const key = lookKey(legend, look)
  let floor = floors.get(key)
  if (!floor) floors.set(key, (floor = buildFloor(legend, look)))
  return floor
}

/** Every look an arena's floor can take, in the order the fight needs them. */
const looks = (legend: RiftLegend): FloorLook[] => {
  const layout = ARENA_LAYOUTS[legend]
  const rule = layout.crumble ?? layout.tide
  const steps = rule?.max ?? 0
  const at = (n: number, warn: boolean, collapse = false): FloorLook => ({
    crumble: layout.crumble ? n : 0,
    tide: layout.tide ? n : 0,
    warn,
    collapse,
  })
  return [...Array.from({ length: steps + 1 }, (_, n) => [at(n, false), ...(n < steps ? [at(n, true)] : [])]).flat(), at(steps, false, true)]
}

/** Frees every arena floor look (about 0.6 MB each, a dozen per arena) once no arena is on (`warmScenery`). */
export const dropArenas = () => {
  if (floors.size === 0) return
  for (const floor of floors.values()) floor.width = floor.height = 0
  floors.clear()
}

/** Builds at most one of the arena's floor looks it hasn't seen yet, so its steps never stall a frame. */
export const warmArena = (arena: RiftArena) => {
  const missing = looks(arena.legend).find((l) => !floors.has(lookKey(arena.legend, l)))
  if (missing) floorOf(arena.legend, missing)
}

const MOTE_TILE = 128
const MOTES = 18

/** The void past the platform, with slow parallax motes, then the floor. Replaces the map while in an arena. */
export const drawArena = (ctx: Ctx, arena: RiftArena, camX: number, camY: number, w: number, h: number, t: number) => {
  const theme = ARENAS[arena.legend]
  const layout = ARENA_LAYOUTS[arena.legend]
  ctx.fillStyle = theme.void
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = theme.motes
  const ox = Math.round(camX * 0.4)
  const oy = Math.round(camY * 0.4)
  for (let i = 0; i < MOTES; i++) {
    if (Math.sin(t * 2 + i * 1.7) < -0.4) continue // twinkle
    const bx = Math.floor(hash2(i, 1, 77) * MOTE_TILE)
    const by = Math.floor(hash2(i, 2, 77) * MOTE_TILE)
    const x0 = (((bx - ox) % MOTE_TILE) + MOTE_TILE) % MOTE_TILE
    const y0 = (((by - oy) % MOTE_TILE) + MOTE_TILE) % MOTE_TILE
    for (let y = y0; y < h; y += MOTE_TILE) for (let x = x0; x < w; x += MOTE_TILE) ctx.fillRect(x, y, 1, 1)
  }
  const rule = layout.crumble ?? layout.tide
  const steps = stepsAt(rule, arena.age)
  // The next step flashes in during its warning; the rim flashes red in the last seconds before the rift collapses.
  const blink = Math.floor(t * 6) % 2 === 0
  const collapse = arena.loot === null && arena.left < 10 && Math.floor(t * (arena.left < 4 ? 8 : 4)) % 2 === 0
  const look: FloorLook = {
    crumble: layout.crumble ? steps : 0,
    tide: layout.tide ? steps : 0,
    warn: stepWarning(rule, arena.age) && blink,
    collapse: collapse && steps === (rule?.max ?? 0),
  }
  const floor = floorOf(arena.legend, look)
  ctx.drawImage(floor, Math.round(arena.x - C - camX), Math.round(arena.y - C - camY))
}

/* ---------------- Portal on the map ---------------- */

const VORTEX = ['#ffffff', '#c8a8f8', '#7850c8'] as const

/** A glowing tear in the air over a swirl on the ground, filling up as the player stands in it. */
export const drawRiftPortal = (ctx: Ctx, portal: RiftPortal, t: number) => {
  // It blinks faster and faster in its last seconds.
  if (portal.left < 8 && Math.floor(t * (portal.left < 3 ? 10 : 5)) % 3 === 0) return
  const x = Math.round(portal.x)
  const y = Math.round(portal.y)
  const r = RIFT.portalRadius
  const pulse = Math.round((Math.sin(t * 4) + 1) * 1.5)
  const cy = y - 24 + Math.round(Math.sin(t * 2))
  // Ground swirl.
  blitEllipse(ctx, r + 4, Math.round((r + 4) * 0.4), 'rgba(120,80,200,0.35)', x, y)
  dashedRing(ctx, x, y, r, t * 5, VORTEX, 0.5, 0.4)
  // Beam of light, then the tear itself, layered from glow to the dark core.
  ctx.fillStyle = 'rgba(200,168,248,0.25)'
  ctx.fillRect(x - 3, cy - 90, 7, 90)
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.fillRect(x - 1, cy - 90, 3, 90)
  blitEllipse(ctx, 12 + pulse, 22 + pulse, 'rgba(200,168,248,0.3)', x, cy)
  blitEllipse(ctx, 9, 18, '#ffffff', x, cy)
  blitEllipse(ctx, 8, 17, '#c8a8f8', x, cy)
  blitEllipse(ctx, 6, 14, '#7850c8', x, cy)
  blitEllipse(ctx, 4, 11, '#301860', x, cy)
  blitEllipse(ctx, 2, 7, '#100820', x, cy)
  dashedRing(ctx, x, cy, 6, -t * 8, VORTEX, 0.4, 2.2)
  if (portal.charge <= 0) return
  // Charge arc: a white ring on the ground that closes as the player steps in.
  const k = Math.min(1, portal.charge / RIFT.enterTime)
  const rr = r + 3
  const steps = Math.ceil(rr * TAU * k)
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + i / rr
    ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.4), 2, 1)
  }
}

const ARROW = lazy(() =>
  art(['11.....', '1221...', '122221.', '1222221', '122221.', '1221...', '11.....'], { 1: '#c8a8f8', 2: '#7850c8' }, '#180830'),
)

/** Screen-space arrow on the edge pointing at an off-screen portal. */
export const drawRiftArrow = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const portal = g.rift.portal
  if (!portal) return
  const { w, h } = g.view
  const sx = portal.x - camX
  const sy = portal.y - camY
  if (sx > 0 && sx < w && sy > -20 && sy < h) return
  const cx = w / 2
  const cy = h / 2
  const angle = Math.atan2(sy - cy, sx - cx)
  // Margins keep it clear of the HUD: timer and rift pill on top, status box at the bottom.
  const left = 16
  const right = w - 16
  const top = 72
  const bottom = h - 40
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const k = Math.min(dx > 0 ? (right - cx) / dx : dx < 0 ? (left - cx) / dx : Infinity, dy > 0 ? (bottom - cy) / dy : dy < 0 ? (top - cy) / dy : Infinity)
  const bob = Math.sin(t * 8) * 2
  blitRotated(ctx, ARROW(), cx + dx * (k + bob), cy + dy * (k + bob), angle, 2)
}

/* ---------------- Falling in the arena ---------------- */

/** The defeat's progress, 0 → 1 (null while the player stands). */
const fallProgress = (g: Game) => {
  const fall = g.rift.arena?.fall
  return fall == null ? null : 1 - fall / RIFT.fallTime
}

const clamp01 = (k: number) => Math.min(1, Math.max(0, k))
/** Where the tear opens, over the fainted player's head. */
const TEAR_RISE = 46

/** How the fainted player looks while the rift throws them out; null while they stand. */
export type FallLook = { seconds: number; lift: number; alpha: number; flash: number; tint: { color: string; amount: number }; bar: boolean }

/**
 * The player during the defeat: the Hurt pose blinking white as they faint,
 * then a violet silhouette pulled up into the tear and swallowed by it.
 */
export const riftFallLook = (g: Game): FallLook | null => {
  const k = fallProgress(g)
  if (k === null) return null
  const pull = clamp01((k - 0.55) / 0.35)
  const ease = pull * pull
  return {
    seconds: k * RIFT.fallTime,
    lift: Math.round(ease * (TEAR_RISE - 12)),
    alpha: 1 - clamp01((k - 0.82) / 0.1),
    flash: k < 0.3 && Math.floor(k * 24) % 2 === 0 ? 0.7 : 0,
    tint: { color: '#a078e8', amount: 0.85 * clamp01((k - 0.3) / 0.3) },
    bar: pull === 0,
  }
}

/** Under the entities: the arena dims while the rift turns on the player, and the tear's beam reaches down to them. */
export const drawRiftFallGround = (ctx: Ctx, g: Game, camX: number, camY: number) => {
  const k = fallProgress(g)
  if (k === null) return
  ctx.fillStyle = `rgba(16,8,40,${(0.55 * clamp01(k * 3)).toFixed(2)})`
  ctx.fillRect(camX, camY, g.view.w, g.view.h)
  // The tear's beam falls behind the player, so their silhouette reads against it.
  if (k < 0.4 || k > 0.92) return
  const x = Math.round(localPlayer(g).x)
  const top = Math.round(localPlayer(g).y - TEAR_RISE)
  ctx.fillStyle = 'rgba(200,168,248,0.3)'
  ctx.fillRect(x - 4, top, 9, TEAR_RISE)
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  ctx.fillRect(x - 1, top, 3, TEAR_RISE)
}

/** Above the entities: the tear opening over the player and violet motes spiralling up into it. */
export const drawRiftFallAir = (ctx: Ctx, g: Game, t: number) => {
  const k = fallProgress(g)
  if (k === null) return
  const p = localPlayer(g)
  const x = Math.round(p.x)
  const cy = Math.round(p.y - TEAR_RISE)
  const open = clamp01((k - 0.2) / 0.25) * (1 - clamp01((k - 0.92) / 0.08))
  if (open <= 0) return
  const size = (n: number) => Math.max(1, Math.round(n * open))
  const pulse = Math.round((Math.sin(t * 6) + 1) * 1.5)
  blitEllipse(ctx, size(14) + pulse, size(24) + pulse, 'rgba(200,168,248,0.3)', x, cy)
  blitEllipse(ctx, size(11), size(20), '#ffffff', x, cy)
  blitEllipse(ctx, size(10), size(19), '#c8a8f8', x, cy)
  blitEllipse(ctx, size(8), size(16), '#7850c8', x, cy)
  blitEllipse(ctx, size(5), size(12), '#301860', x, cy)
  blitEllipse(ctx, size(3), size(8), '#100820', x, cy)
  dashedRing(ctx, x, cy, size(7), -t * 8, VORTEX, 0.4, 2.2)
  // Motes rise from a ring around the player and spiral into the tear.
  const motes = 18
  for (let i = 0; i < motes; i++) {
    const u = (k * 2.5 + i / motes) % 1
    const a = (i / motes) * TAU + u * 5
    const r = (1 - u) * 34 * open
    ctx.fillStyle = VORTEX[i % VORTEX.length]!
    ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(p.y - 8 - u * (TEAR_RISE - 8) + Math.sin(a) * r * 0.4), 2, 2)
  }
}

/** Over everything: the screen fades to a pale violet as the player is swallowed (the way out's flash picks it up). */
export const drawRiftFallOut = (ctx: Ctx, g: Game) => {
  const k = fallProgress(g)
  if (k === null || k < 0.85) return
  ctx.fillStyle = `rgba(240,232,255,${(0.6 * clamp01((k - 0.85) / 0.15)).toFixed(2)})`
  ctx.fillRect(0, 0, g.view.w, g.view.h)
}
