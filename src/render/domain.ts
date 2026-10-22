import { blitEllipse, canvasCache, context2d, createCanvas, onCanvasReset } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { fits } from '../game/arenaFloor'
import type { ArenaShape, Circle, FloorPlan } from '../data/arenas'
import { domainOf, type ArenaTransform, type LegendDomain, type ThreatKind } from '../data/domains'
import { ARENAS, RIFT, type ArenaTheme, type RiftLegend } from '../data/rifts'
import { composePlan, transformStage } from '../game/domainRules'
import type { DomainState } from '../game/domain'
import { riftDomain, type RiftArena, type RiftPortal } from '../game/rift'
import type { Game } from '../game/types'
import { FACES, lavaColor, mix, PATTERNS, rgb } from './rift'
import { shade } from './sculpt'
import { dashedRing } from './strokes'

type Ctx = CanvasRenderingContext2D

/**
 * A legendary's domain on screen (`game/domain.ts`): its floor, baked in
 * 128 px chunks as they come into view (a domain is far bigger than the
 * screen, and a phone shouldn't hold all of it at once), the arena's
 * transforms (baked once each, blinking through their warning), the threat
 * rising behind the crossing, the rubble that seals the way back, and the
 * huge tear of its portal on the map.
 */

const CHUNK = 128
/** Px of floor read around a chunk: the platform's side under a south edge reaches `FACE` below it, its rim 2 px. */
const FACE = 14
const APRON = FACE + 3

type Painter = { domain: LegendDomain; plan: FloorPlan; theme: ArenaTheme; legend: RiftLegend; box: { x0: number; y0: number; x1: number; y1: number } }

const boxOf = (shapes: readonly ArenaShape[]) => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const s of shapes) {
    if (s.kind === 'circle') {
      x0 = Math.min(x0, s.x - s.r)
      y0 = Math.min(y0, s.y - s.r)
      x1 = Math.max(x1, s.x + s.r)
      y1 = Math.max(y1, s.y + s.r)
    } else {
      for (const [x, y] of s.pts) {
        x0 = Math.min(x0, x)
        y0 = Math.min(y0, y)
        x1 = Math.max(x1, x)
        y1 = Math.max(y1, y)
      }
    }
  }
  return { x0, y0, x1, y1 }
}

const painters = new Map<RiftLegend, Painter>()

/** How a legendary's domain floor is painted: its whole floor (crossing and arena, before any transform), colors and extent. */
const painterOf = (legend: RiftLegend): Painter | null => {
  const known = painters.get(legend)
  if (known) return known
  const domain = domainOf(legend)
  if (!domain) return null
  const plan = composePlan(domain, false, [])
  const painter = { domain, plan, theme: ARENAS[legend], legend, box: boxOf(plan.floor) }
  painters.set(legend, painter)
  return painter
}

/** Whether (x, y) (domain px) is in any of `shapes`, skipping those whose box is far. */
const inAny = (shapes: readonly ArenaShape[] | undefined, x: number, y: number) => shapes?.some((s) => fits(s, x, y, 0)) ?? false

/** The color of a floor pixel at domain (x, y): the arena's pattern around its center, the crossing's elsewhere, water and islands over it. */
const floorColor = (p: Painter, x: number, y: number, inArena: boolean) => {
  const { domain, theme, plan } = p
  const [ax, ay] = domain.arena.at
  let color = inArena ? PATTERNS[domain.arena.pattern](x - ax, y - ay, theme) : PATTERNS[domain.crossing.pattern](x, y, theme)
  if (inAny(plan.shallow, x, y) && !inAny(plan.islands, x, y)) {
    const ripple = Math.abs(((Math.sqrt(x * x + y * y) + hash2(Math.floor(x / 16), Math.floor(y / 16), 4) * 9) % 13) - 6) < 0.5 && hash2(x >> 3, y >> 3, 5) < 0.5
    color = ripple ? '#88c8e8' : mix(color, '#2878b0', 0.62)
  }
  if (plan.lava?.length) color = lavaColor(plan, x, y, color)
  return color
}

/** How deep (x, y) is inside the nearest of `holes`, px (negative: outside them all). */
const holeDepth = (holes: readonly Circle[], x: number, y: number) => {
  let best = -Infinity
  for (const h of holes) best = Math.max(best, h.r - Math.sqrt((x - h.x) * (x - h.x) + (y - h.y) * (y - h.y)))
  return best
}

type HoleLook = (x: number, y: number, depth: number) => string | null

/** Deep water rolling in waves (Kyogre's pool, and any domain without its own look). */
const waterHole: HoleLook = (x, y) => {
  const wave = Math.abs(((y + Math.sin(x / 9) * 2.5 + 4000) % 10) - 5) < 0.6 && hash2(Math.floor(x / 14), Math.floor(y / 10), 1) < 0.7
  return wave ? '#3890c0' : hash2(Math.floor(x), Math.floor(y), 2) < 0.5 ? '#0c3450' : '#0e3a58'
}

/** A lava lake: a dark crust at its rim, then bright flowing magma. */
const lavaHole: HoleLook = (x, y, depth) => {
  if (depth < 2.5) return '#a02808'
  const flow = hash2(Math.floor((x + y * 0.3) / 6), Math.floor(y / 4), 6)
  return depth < 5 ? '#e85818' : flow < 0.3 ? '#f8e060' : flow < 0.75 ? '#f89830' : '#e86020'
}

/** What a domain's holes are, by legendary; null leaves the pixel clear, so the backdrop (Rayquaza's open sky) shows through. */
const HOLES: Partial<Record<RiftLegend, HoleLook>> = { groudon: lavaHole, rayquaza: () => null }

/** Bakes chunk (cx, cy) of a domain's floor, or null when it holds no floor at all. */
const bakeChunk = (p: Painter, cx: number, cy: number) => {
  const x0 = cx * CHUNK
  const y0 = cy * CHUNK
  const { box } = p
  if (x0 > box.x1 + APRON || y0 > box.y1 + APRON || x0 + CHUNK < box.x0 - APRON || y0 + CHUNK < box.y0 - APRON) return null
  const W = CHUNK + APRON * 2
  const floorShapes = p.plan.floor.filter((s) => {
    const b = boxOf([s])
    return !(b.x0 > x0 + CHUNK + APRON || b.y0 > y0 + CHUNK + APRON || b.x1 < x0 - APRON || b.y1 < y0 - APRON)
  })
  if (floorShapes.length === 0) return null
  const [ax, ay] = p.domain.arena.at
  const arenaShapes = p.domain.arena.floor.map((s) => (s.kind === 'circle' ? { ...s, x: s.x + ax, y: s.y + ay } : { ...s, pts: s.pts.map(([x, y]) => [x + ax, y + ay] as const) }))
  const holes = p.plan.holes ?? []
  const mask = new Uint8Array(W * W)
  for (let py = 0; py < W; py++) {
    for (let px = 0; px < W; px++) {
      const x = x0 - APRON + px + 0.5
      const y = y0 - APRON + py + 0.5
      mask[py * W + px] = floorShapes.some((s) => fits(s, x, y, 0)) && !holes.some((h) => fits(h, x, y, 0)) ? 1 : 0
    }
  }
  const at = (px: number, py: number) => px >= 0 && py >= 0 && px < W && py < W && mask[py * W + px] === 1
  const canvas = createCanvas(CHUNK, CHUNK)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(CHUNK, CHUNK)
  const faces = FACES[p.legend]
  const [light, dark] = p.theme.wall
  let any = false
  for (let py = 0; py < CHUNK; py++) {
    for (let px = 0; px < CHUNK; px++) {
      const mx = px + APRON
      const my = py + APRON
      const x = x0 + px + 0.5
      const y = y0 + py + 0.5
      let color: string | null = null
      if (!at(mx, my)) {
        let k = 0
        for (let d = 1; d <= FACE && !k; d++) if (at(mx, my - d)) k = d
        if (k) color = shade(faces, 0.9 - k / FACE + (k % 4 === 0 ? -0.25 : 0) + (hash2(Math.floor(x) >> 2, k, 3) - 0.5) * 0.2, Math.floor(x), Math.floor(y))
        else {
          const depth = holeDepth(holes, x, y)
          // Over open space a hole goes straight through: the void, with a star or two.
          if (depth >= 0 && p.domain.backdrop === 'space') color = hash2(Math.floor(x), Math.floor(y), 8) > 0.992 ? p.theme.motes : p.theme.void
          else if (depth >= 0) color = (HOLES[p.legend] ?? waterHole)(x, y, depth)
        }
      } else {
        let near = 0
        for (let d = 1; d <= 2 && !near; d++) if (!at(mx + d, my) || !at(mx - d, my) || !at(mx, my + d) || !at(mx, my - d)) near = d
        color = near === 1 ? light : near === 2 ? dark : floorColor(p, x, y, arenaShapes.some((s) => fits(s, x, y, 0)))
      }
      if (!color) continue
      any = true
      const [r, g, b] = rgb(color)
      const i = (py * CHUNK + px) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  if (!any) return null
  ctx.putImageData(img, 0, 0)
  return canvas
}

/** Baked chunks by `legend:cx:cy` (null: nothing there). Dropped when the domain is left (`warmDomain`). */
const chunks = canvasCache<string, HTMLCanvasElement | null>()
const chunkKey = (legend: RiftLegend, cx: number, cy: number) => `${legend}:${cx}:${cy}`

const chunkOf = (p: Painter, cx: number, cy: number) => {
  const key = chunkKey(p.legend, cx, cy)
  if (chunks.has(key)) return chunks.get(key) ?? null
  const c = bakeChunk(p, cx, cy)
  chunks.set(key, c)
  return c
}

/** Chunks a frame may bake when they're missing on screen (the rest wait for idle time or the next frame). */
const FRAME_BUDGET = 2

/* ---------------- Transforms ---------------- */

/** A baked transform; a crumble over the open sky also keeps `sky`, a mask of where the floor is gone (the sky shows through it). */
type Baked = { canvas: HTMLCanvasElement; x: number; y: number; sky?: HTMLCanvasElement }
/** Baked transforms; dropped with every other canvas on a GPU reset. */
let transforms = new WeakMap<ArenaTransform, Baked>()
onCanvasReset(
  () => (transforms = new WeakMap()),
  // Keyed by the domains' own data, so a domain's baked transforms stay once it's been fought in.
  () => [...painters.values()].flatMap((p) => p.domain.phases.flatMap((phase) => (phase.arena ?? []).map((t) => transforms.get(t)))),
)

/** Bakes what a transform turns the arena into: flood water around its islands, lava around its cool spots, or the holes it crumbles. */
const bakeTransform = (p: Painter, t: ArenaTransform): Baked => {
  const area = t.kind === 'crumble' ? t.spare : t.area
  const b = boxOf(area)
  const x0 = Math.floor(b.x0)
  const y0 = Math.floor(b.y0)
  const w = Math.ceil(b.x1) - x0 + 1
  const h = Math.ceil(b.y1) - y0 + 8
  const floor = p.domain.arena.floor
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(w, h)
  const open = t.kind === 'crumble' && p.domain.backdrop === 'sky'
  const mask = open ? new Uint8ClampedArray(w * h * 4) : null
  const islandSide = mix(p.theme.wall[1], '#000000', 0.35)
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const x = x0 + px + 0.5
      const y = y0 + py + 0.5
      if (!floor.some((s) => fits(s, x, y, 0))) continue
      let color: string | null = null
      if (t.kind === 'crumble') {
        if (t.spare.some((s) => fits(s, x, y, 0))) {
          color = crumbleColor(p, t.spare, x, y)
          if (color === null && mask) mask.fill(255, (py * w + px) * 4, (py * w + px) * 4 + 4)
        }
      } else if (t.area.some((s) => fits(s, x, y, 0))) {
        const spared = t.spare.some((s) => fits(s, x, y, 0))
        if (t.kind === 'flood') {
          if (spared) continue
          // Islands rise a few px out of the water: their side shows under the south shore, foam all round.
          const side = t.spare.some((s) => fits(s, x, y - 4, 0) && y > s.y)
          const shore = t.spare.some((s) => fits(s, x, y, -2))
          const ripple = Math.abs(((Math.sqrt(x * x + y * y) + hash2(Math.floor(x / 16), Math.floor(y / 16), 4) * 9) % 13) - 6) < 0.5 && hash2(Math.floor(x) >> 3, Math.floor(y) >> 3, 5) < 0.5
          color = side ? islandSide : shore ? '#d8f0f8' : ripple ? '#68b0e0' : hash2(Math.floor(x), Math.floor(y), 9) < 0.5 ? '#1c5c94' : '#1e6098'
        } else {
          if (spared) continue
          const flow = hash2(Math.floor((x + y * 0.3) / 6), Math.floor(y / 4), 6)
          color = t.spare.some((s) => fits(s, x, y, -2)) ? '#a02808' : flow < 0.35 ? '#f8e060' : '#f89830'
        }
      }
      if (!color) continue
      const [r, g, bl] = rgb(color)
      const i = (py * w + px) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = bl
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  if (!mask) return { canvas, x: x0, y: y0 }
  const sky = createCanvas(w, h)
  context2d(sky).putImageData(new ImageData(mask, w, h), 0, 0)
  return { canvas, x: x0, y: y0, sky }
}

/** Where the floor fell away: the platform's broken side under the north rim, then what lies below (the sky's blue and clouds, or the void). */
const crumbleColor = (p: Painter, spare: readonly Circle[], x: number, y: number): string | null => {
  for (let k = 1; k <= 8; k++) {
    if (spare.some((s) => fits(s, x, y - k, 0))) continue
    return shade(FACES[p.legend], 0.9 - k / 8 + (hash2(Math.floor(x) >> 2, k, 3) - 0.5) * 0.25, Math.floor(x), Math.floor(y))
  }
  // Over the open sky the hole stays clear: the sky is drawn through its mask (`drawTransform`).
  return p.domain.backdrop === 'sky' ? null : p.theme.void
}

const transformOf = (p: Painter, t: ArenaTransform) => {
  let baked = transforms.get(t)
  if (!baked) transforms.set(t, (baked = bakeTransform(p, t)))
  return baked
}

/* ---------------- Drawing ---------------- */

const MOTE_TILE = 128
const MOTES = 18

const ROCK_TILE = 96

/** Cave rock past the floor: blotches of the void's color, cracks and wet glints, tiled with the world. */
const rockTile = (theme: ArenaTheme) => {
  const canvas = createCanvas(ROCK_TILE, ROCK_TILE)
  const ctx = context2d(canvas)
  const img = ctx.createImageData(ROCK_TILE, ROCK_TILE)
  const dark = mix(theme.void, '#000000', 0.3)
  const mid = mix(theme.void, theme.floor[2], 0.45)
  const light = mix(theme.void, theme.floor[0], 0.35)
  for (let y = 0; y < ROCK_TILE; y++) {
    for (let x = 0; x < ROCK_TILE; x++) {
      // Wrapped noise, so the tile repeats seamlessly.
      const n = hash2(Math.floor(x / 8) % (ROCK_TILE / 8), Math.floor(y / 6) % (ROCK_TILE / 6), 11) * 0.6 + hash2(Math.floor(x / 3) % (ROCK_TILE / 3), Math.floor(y / 3) % (ROCK_TILE / 3), 12) * 0.4
      const crack = hash2(x, y, 13) < 0.012
      const glint = hash2(x, y, 14) > 0.997
      const [r, g, b] = rgb(glint ? theme.motes : crack ? dark : n > 0.68 ? light : n > 0.42 ? mid : theme.void)
      const i = (y * ROCK_TILE + x) * 4
      img.data[i] = r
      img.data[i + 1] = g
      img.data[i + 2] = b
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

const rockTiles = canvasCache<RiftLegend, HTMLCanvasElement>()

/** Volcanic rock past a magma domain's floor: dark and calm, with a rare ember glinting in it. */
const MAGMA_ROCK: ArenaTheme = { floor: ['#3c1e14', '#2c140c', '#2a140e'], wall: ['#f89038', '#a03810'], void: '#140604', motes: '#f86820' }

/** The open sky under the Sky Pillar: its blues and its clouds. */
const SKY = { blue: '#3a64a8', cloud: '#c8d8f0', light: '#f0f8ff', shadow: '#8ca8d8' } as const

const CLOUD_TILE = 192

/** A tile of puffy clouds seen from above, each a few overlapping lumps with a shadowed belly; `seed` varies the layer. */
const cloudTile = (seed: number) => {
  const canvas = createCanvas(CLOUD_TILE, CLOUD_TILE)
  const ctx = context2d(canvas)
  for (let i = 0; i < 5; i++) {
    const cx = Math.floor(hash2(i, 1, seed) * CLOUD_TILE)
    const cy = Math.floor(hash2(i, 2, seed) * CLOUD_TILE)
    for (let j = 0; j < 5; j++) {
      const rx = 8 + Math.floor(hash2(i, j + 3, seed) * 10)
      const x = cx + (j - 2) * 9
      const y = cy + Math.floor((hash2(i, j + 9, seed) - 0.5) * 8)
      // Drawn in every wrapped copy that touches the tile, so it repeats seamlessly.
      for (const ox of [-CLOUD_TILE, 0, CLOUD_TILE]) {
        for (const oy of [-CLOUD_TILE, 0, CLOUD_TILE]) {
          blitEllipse(ctx, rx, Math.round(rx * 0.55), SKY.shadow, x + ox, y + oy + 2)
          blitEllipse(ctx, rx, Math.round(rx * 0.5), SKY.cloud, x + ox, y + oy)
          blitEllipse(ctx, Math.max(2, rx - 4), Math.max(1, Math.round(rx * 0.3)), SKY.light, x + ox - 2, y + oy - 2)
        }
      }
    }
  }
  return canvas
}

const cloudTiles = canvasCache<number, HTMLCanvasElement>()

/** Two layers of clouds drifting far below at their own parallax, over the sky's blue; (sx, sy) is where on screen the target's corner sits. */
const drawSky = (ctx: Ctx, camX: number, camY: number, w: number, h: number, t: number, sx = 0, sy = 0) => {
  ctx.fillStyle = SKY.blue
  ctx.fillRect(0, 0, w, h)
  for (const [seed, depth, drift] of [[31, 0.3, 4], [37, 0.55, 9]] as const) {
    let tile = cloudTiles.get(seed)
    if (!tile) cloudTiles.set(seed, (tile = cloudTile(seed)))
    const x0 = -((((Math.round(camX * depth + t * drift) + sx) % CLOUD_TILE) + CLOUD_TILE) % CLOUD_TILE)
    const y0 = -((((Math.round(camY * depth) + sy) % CLOUD_TILE) + CLOUD_TILE) % CLOUD_TILE)
    ctx.globalAlpha = depth < 0.5 ? 0.55 : 0.9
    for (let y = y0; y < h; y += CLOUD_TILE) for (let x = x0; x < w; x += CLOUD_TILE) ctx.drawImage(tile, x, y)
  }
  ctx.globalAlpha = 1
}

/** Open sea past the floor (`sea`): deep water with whitecaps rolling across it, anchored to the world. */
const drawSea = (ctx: Ctx, camX: number, camY: number, w: number, h: number, t: number) => {
  ctx.fillStyle = '#0a1c34'
  ctx.fillRect(0, 0, w, h)
  const cx = Math.round(camX)
  const cy = Math.round(camY)
  const x0 = -(((cx % 16) + 16) % 16)
  const y0 = -(((cy % 6) + 6) % 6)
  for (let y = y0; y < h; y += 6) {
    const row = Math.floor((y + cy) / 6)
    const drift = Math.round(Math.sin(row * 0.7 + t * 1.3) * 3)
    for (let x = x0; x < w; x += 16) {
      const n = hash2(Math.floor((x + cx) / 16), row, 3)
      if (n > 0.3) continue
      ctx.fillStyle = n < 0.06 ? '#a8c8e8' : '#24507c'
      ctx.fillRect(x + drift, y, n < 0.06 ? 3 : 6, 1)
    }
  }
}

/** The void around the floor: cave rock, the open sky, open sea, or open space with slow parallax motes. */
const drawVoid = (ctx: Ctx, p: Painter, camX: number, camY: number, w: number, h: number, t: number) => {
  const theme = p.theme
  if (p.domain.backdrop === 'sky') return drawSky(ctx, camX, camY, w, h, t)
  if (p.domain.backdrop === 'sea') return drawSea(ctx, camX, camY, w, h, t)
  if (p.domain.backdrop === 'cave' || p.domain.backdrop === 'magma') {
    let tile = rockTiles.get(p.legend)
    if (!tile) rockTiles.set(p.legend, (tile = rockTile(p.domain.backdrop === 'magma' ? MAGMA_ROCK : theme)))
    const x0 = -(((Math.round(camX) % ROCK_TILE) + ROCK_TILE) % ROCK_TILE)
    const y0 = -(((Math.round(camY) % ROCK_TILE) + ROCK_TILE) % ROCK_TILE)
    for (let y = y0; y < h; y += ROCK_TILE) for (let x = x0; x < w; x += ROCK_TILE) ctx.drawImage(tile, x, y)
    return
  }
  ctx.fillStyle = theme.void
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = theme.motes
  const ox = Math.round(camX * 0.4)
  const oy = Math.round(camY * 0.4)
  for (let i = 0; i < MOTES; i++) {
    if (Math.sin(t * 2 + i * 1.7) < -0.4) continue
    const bx = Math.floor(hash2(i, 1, 77) * MOTE_TILE)
    const by = Math.floor(hash2(i, 2, 77) * MOTE_TILE)
    const x0 = (((bx - ox) % MOTE_TILE) + MOTE_TILE) % MOTE_TILE
    const y0 = (((by - oy) % MOTE_TILE) + MOTE_TILE) % MOTE_TILE
    for (let y = y0; y < h; y += MOTE_TILE) for (let x = x0; x < w; x += MOTE_TILE) ctx.fillRect(x, y, 1, 1)
  }
}

/** The threat's front on screen: a band from `sy` down, by kind. */
const THREATS: Record<ThreatKind, { body: string; edge: string; foam: string }> = {
  tide: { body: 'rgba(20,72,128,0.86)', edge: '#58a8e8', foam: '#e8f8ff' },
  collapse: { body: 'rgba(12,8,6,0.94)', edge: '#5a4030', foam: '#a08060' },
  fire: { body: 'rgba(160,40,8,0.86)', edge: '#f86818', foam: '#f8e060' },
  void: { body: 'rgba(8,4,24,0.94)', edge: '#7850c8', foam: '#c8a8f8' },
  storm: { body: 'rgba(52,64,84,0.92)', edge: '#c8d8e8', foam: '#ffffff' },
  time: { body: 'rgba(36,44,84,0.88)', edge: '#a8f0f8', foam: '#ffffff' },
  magma: { body: 'rgba(176,44,8,0.9)', edge: '#f8a030', foam: '#fff0a0' },
  crumble: { body: 'rgba(44,84,152,0.94)', edge: '#2c4c34', foam: '#f8e070' },
  mist: { body: 'rgba(236,224,244,0.9)', edge: '#f8c8e0', foam: '#ffffff' },
}

/** What rides a threat's band besides its bubbles: crust and rubble on the magma, tiles tumbling into the sky. */
const drawThreatExtra = (ctx: Ctx, kind: ThreatKind, top: number, w: number, h: number, t: number) => {
  if (kind === 'magma') {
    // Plates of cooling crust drifting on the lava.
    ctx.fillStyle = 'rgba(48,14,4,0.75)'
    for (let i = 0; i < 14; i++) {
      const x = Math.round((hash2(i, 1, 51) * (w + 40) + t * (6 + hash2(i, 2, 51) * 8)) % (w + 40)) - 20
      const y = Math.round(top + 10 + hash2(i, 3, 51) * Math.max(0, h - top))
      ctx.fillRect(x, y, 6 + Math.floor(hash2(i, 4, 51) * 8), 2 + Math.floor(hash2(i, 5, 51) * 2))
    }
    // The tunnel caving in: boulders dropping into the front.
    for (let i = 0; i < 6; i++) {
      const k = (t * 0.9 + hash2(i, 6, 51)) % 1
      const x = Math.round(hash2(i, 7, 51) * w)
      const y = Math.round(top - 30 + k * 34)
      const s = 2 + Math.floor(hash2(i, 8, 51) * 3)
      ctx.fillStyle = '#2a1a12'
      ctx.fillRect(x - s, y - s, s * 2, s * 2)
      ctx.fillStyle = '#5a4030'
      ctx.fillRect(x - s, y - s, s * 2 - 1, 1)
    }
    return
  }
  if (kind === 'crumble') {
    // Tiles of the floor breaking off and tumbling down, smaller as they fall.
    for (let i = 0; i < 18; i++) {
      const k = (t * 0.7 + hash2(i, 1, 53)) % 1
      const x = Math.round(hash2(i, 2, 53) * w + Math.sin(t * 2 + i) * 3)
      const y = Math.round(top + 4 + k * 70)
      const s = Math.max(1, Math.round((1 - k) * 5))
      ctx.fillStyle = i % 3 === 0 ? '#467654' : '#3c6848'
      ctx.fillRect(x, y, s, s)
      ctx.fillStyle = '#1c3424'
      ctx.fillRect(x, y + s, s, 1)
    }
    // Wisps of cloud far below.
    ctx.fillStyle = 'rgba(200,216,240,0.35)'
    for (let i = 0; i < 6; i++) {
      const x = Math.round((hash2(i, 3, 53) * (w + 60) - t * 10) % (w + 60) + w + 60) % (w + 60) - 30
      const y = Math.round(top + 40 + hash2(i, 4, 53) * Math.max(0, h - top))
      ctx.fillRect(x, y, 22 + Math.floor(hash2(i, 5, 53) * 20), 3)
    }
  }
}

const drawThreat = (ctx: Ctx, kind: ThreatKind, sy: number, w: number, h: number, t: number) => {
  if (sy >= h + 4) return
  const look = THREATS[kind]
  const top = Math.max(-4, Math.round(sy))
  ctx.fillStyle = look.body
  ctx.fillRect(0, top + 2, w, h - top)
  // A rolling edge: a crest of foam over a lighter lip, each column on its own wave.
  for (let x = 0; x < w; x += 2) {
    const off = Math.round(Math.sin(x / 9 + t * 3) * 2 + Math.sin(x / 23 - t * 1.7) * 1.5)
    ctx.fillStyle = look.edge
    ctx.fillRect(x, top + off, 2, 3)
    ctx.fillStyle = look.foam
    ctx.fillRect(x, top + off - 1, 2, 1)
  }
  drawThreatExtra(ctx, kind, top, w, h, t)
  // Bubbles (or embers) rising through it.
  ctx.fillStyle = look.foam
  for (let i = 0; i < 24; i++) {
    const x = Math.floor(hash2(i, 1, 31) * w)
    const rise = (t * (18 + hash2(i, 2, 31) * 20) + hash2(i, 3, 31) * 200) % 200
    const y = Math.round(top + 8 + (h - top) - rise)
    if (y > top + 4 && y < h) ctx.fillRect(x, y, 1, 1)
  }
}

/** Rocks piled across the arena's way in once it seals. */
const drawSeal = (ctx: Ctx, p: Painter, ox: number, oy: number) => {
  const [ax, ay] = p.domain.arena.at
  const r = boxOf(p.domain.arena.floor).y1
  const stone = FACES[p.legend]
  for (let i = 0; i < 9; i++) {
    const x = Math.round(ox + ax + (i - 4) * 9 + (hash2(i, 1, 5) - 0.5) * 4)
    const y = Math.round(oy + ay + r - 2 + (hash2(i, 2, 5) - 0.5) * 6)
    const s = 6 + Math.floor(hash2(i, 3, 5) * 4)
    blitEllipse(ctx, s + 1, s, '#05080c', x, y + 1)
    blitEllipse(ctx, s, s - 1, stone[2]!, x, y)
    blitEllipse(ctx, Math.max(1, s - 3), Math.max(1, s - 4), stone[3]!, x - 1, y - 2)
  }
}

/** A transform's look: hidden, blinking through its warning, or there. */
/** A canvas reused to cut the sky to a crumbled hole's shape. */
let scratch: HTMLCanvasElement | null = null
onCanvasReset(
  () => (scratch = null),
  () => scratch,
)

/** The open sky seen through a crumbled hole: the sky drawn on a scratch canvas, kept only inside the hole's mask. */
const drawSkyThrough = (ctx: Ctx, mask: HTMLCanvasElement, sx: number, sy: number, camX: number, camY: number, t: number) => {
  if (!scratch || scratch.width < mask.width || scratch.height < mask.height) scratch = createCanvas(Math.max(mask.width, scratch?.width ?? 0), Math.max(mask.height, scratch?.height ?? 0))
  const sctx = context2d(scratch)
  sctx.globalCompositeOperation = 'source-over'
  sctx.clearRect(0, 0, scratch.width, scratch.height)
  drawSky(sctx, camX, camY, mask.width, mask.height, t, sx, sy)
  sctx.globalCompositeOperation = 'destination-in'
  sctx.drawImage(mask, 0, 0)
  sctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(scratch, 0, 0, mask.width, mask.height, sx, sy, mask.width, mask.height)
}

const drawTransform = (ctx: Ctx, p: Painter, t: ArenaTransform, stage: ReturnType<typeof transformStage>, ox: number, oy: number, time: number, camX: number, camY: number) => {
  if (stage === 'hidden') return
  const baked = transformOf(p, t)
  const [ax, ay] = p.domain.arena.at
  const sx = Math.round(ox + ax + baked.x)
  const sy = Math.round(oy + ay + baked.y)
  if (stage === 'warn') {
    if (Math.floor(time * 6) % 2 === 1) return
    ctx.globalAlpha = 0.5
  } else ctx.globalAlpha = baked.sky ? 1 : 0.92
  if (baked.sky) {
    if (stage === 'landed') drawSkyThrough(ctx, baked.sky, sx, sy, camX, camY, time)
    else ctx.drawImage(baked.sky, sx, sy)
  }
  ctx.drawImage(baked.canvas, sx, sy)
  ctx.globalAlpha = 1
}

/**
 * The ground of a domain, in screen space before the world's translation:
 * the void, the floor's chunks in view, the landed and warning transforms,
 * the seal, and the threat behind the crossing.
 */
export const drawDomainFloor = (ctx: Ctx, arena: RiftArena, d: DomainState, camX: number, camY: number, w: number, h: number, t: number) => {
  const p = painterOf(d.legend)
  if (!p) return
  drawVoid(ctx, p, camX, camY, w, h, t)
  const ox = arena.x - camX
  const oy = arena.y - camY
  let budget = FRAME_BUDGET
  for (let cy = Math.floor((camY - arena.y) / CHUNK); cy <= Math.floor((camY + h - arena.y) / CHUNK); cy++) {
    for (let cx = Math.floor((camX - arena.x) / CHUNK); cx <= Math.floor((camX + w - arena.x) / CHUNK); cx++) {
      const key = chunkKey(p.legend, cx, cy)
      if (!chunks.has(key) && budget-- <= 0) continue
      const c = chunkOf(p, cx, cy)
      if (c) ctx.drawImage(c, Math.round(ox + cx * CHUNK), Math.round(oy + cy * CHUNK))
    }
  }
  for (const done of d.landed) if (!d.pending.some((q) => q.def === done)) drawTransform(ctx, p, done, 'landed', ox, oy, t, camX, camY)
  for (const q of d.pending) drawTransform(ctx, p, q.def, q.landed ? 'landed' : transformStage(q.def, d.phaseAge), ox, oy, t, camX, camY)
  if (d.act !== 'crossing') drawSeal(ctx, p, ox, oy)
  else drawThreat(ctx, p.domain.crossing.threat.kind, oy + d.front, w, h, t)
}

/**
 * Bakes one missing piece of the domain in idle time, most needed first: the
 * chunks in view and a screen ahead (north), then the arena's, then its
 * transforms. With no domain on, drops the chunks. True if it baked one.
 */
export const warmDomain = (g: Game) => {
  const arena = g.rift.arena
  const outside = g.rift.omen?.legend ?? g.rift.portal?.legend
  const legend = arena?.domain?.legend ?? (outside && riftDomain(g, outside) ? outside : undefined)
  const p = legend ? painterOf(legend) : null
  if (!p) {
    if (chunks.size > 0) chunks.clear()
    return false
  }
  const { w, h } = g.view
  // Before stepping in, the crossing's start; inside, the view and a screen ahead.
  const [sx, sy] = p.domain.crossing.start
  const ox = arena ? g.camera.x - arena.x : sx - w / 2
  const oy = arena ? g.camera.y - arena.y : sy - h / 2
  for (let cy = Math.floor((oy - h) / CHUNK); cy <= Math.floor((oy + h) / CHUNK); cy++) {
    for (let cx = Math.floor(ox / CHUNK); cx <= Math.floor((ox + w) / CHUNK); cx++) {
      if (chunks.has(chunkKey(p.legend, cx, cy))) continue
      chunkOf(p, cx, cy)
      return true
    }
  }
  const d = arena?.domain
  if (!d || d.act === 'crossing') return false
  for (const phase of p.domain.phases) {
    for (const tr of phase.arena ?? []) {
      if (transforms.has(tr)) continue
      transformOf(p, tr)
      return true
    }
  }
  return false
}

/* ---------------- The tear on the map ---------------- */

/** A legendary's portal: a huge jagged tear in the air over a swirl on the ground, its domain showing through, filling as the player stands in it. */
export const drawTear = (ctx: Ctx, portal: RiftPortal, t: number) => {
  if (portal.left < 8 && Math.floor(t * (portal.left < 3 ? 10 : 5)) % 3 === 0) return
  const theme = ARENAS[portal.legend]
  const x = Math.round(portal.x)
  const y = Math.round(portal.y)
  const r = RIFT.tearRadius
  blitEllipse(ctx, r + 6, Math.round((r + 6) * 0.4), 'rgba(120,80,200,0.35)', x, y)
  dashedRing(ctx, x, y, r, t * 5, ['#ffffff', theme.motes, '#7850c8'], 0.5, 0.4)
  const H = 92
  const top = y - 18 - H
  // The tear: each row's half-width follows a jagged lens, shimmering.
  for (let i = 0; i < H; i++) {
    const k = i / H
    const lens = Math.sin(k * Math.PI)
    const jag = (hash2(i >> 2, 0, 41) - 0.5) * 6 + Math.round(Math.sin(t * 9 + i * 0.7))
    const half = Math.max(1, Math.round(lens * 15 + jag * lens))
    const yy = top + i
    ctx.fillStyle = 'rgba(200,168,248,0.35)'
    ctx.fillRect(x - half - 3, yy, half * 2 + 7, 1)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - half - 1, yy, half * 2 + 3, 1)
    ctx.fillStyle = theme.motes
    ctx.fillRect(x - half, yy, half * 2 + 1, 1)
    if (half > 2) {
      ctx.fillStyle = theme.void
      ctx.fillRect(x - half + 2, yy, half * 2 - 3, 1)
    }
  }
  // The domain glimpsed through it: its motes drifting.
  ctx.fillStyle = theme.motes
  for (let i = 0; i < 10; i++) {
    const k = (t * 0.3 + hash2(i, 1, 43)) % 1
    const yy = Math.round(top + 10 + k * (H - 20))
    const half = Math.sin(((yy - top) / H) * Math.PI) * 10
    ctx.fillRect(Math.round(x + (hash2(i, 2, 43) - 0.5) * half * 1.6), yy, 1, 1)
  }
  // Lightning crackling at its edges now and then.
  if (Math.floor(t * 7) % 9 === 0) {
    ctx.fillStyle = '#ffffff'
    let bx = x + 14
    for (let yy = top + 20; yy < top + 60; yy += 3) {
      bx += Math.round((hash2(yy, Math.floor(t * 7), 7) - 0.5) * 6)
      ctx.fillRect(bx, yy, 1, 3)
    }
  }
  if (portal.charge <= 0) return
  const k = Math.min(1, portal.charge / RIFT.enterTime)
  const rr = r + 3
  const steps = Math.ceil(rr * TAU * k)
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < steps; i++) {
    const a = -Math.PI / 2 + i / rr
    ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.4), 2, 1)
  }
}

