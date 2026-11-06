import { beginRects, blitEllipse, blitRing, fillPlotted, plot } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import type { Attack, Game } from '../game/types'
import { COMET_PALETTES, DUO_ICONS } from './duoArt'
import { dashedRing } from './strokes'
import { localPlayer } from '../game/players'

/**
 * Art of the duo moves (`game/duoMoves.ts`). `draw.ts` calls two passes a
 * frame: `drawDuoGround` under the Pokémon (the sea of fire, the swamp, the
 * puddles, a comet's shadow and shockwave, the frost) and `drawDuoAir` over
 * them (the Pledge pillars, the comets, the arcs between puddles, the mist,
 * the Nightmare's chains and skulls, and Water Pledge's rainbow across the
 * screen). Both walk `g.attacks`; everything snaps to whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
/** 1 while it lasts, easing to 0 over its last `window` seconds. */
const fadeOut = (a: Attack, window: number) => clamp01((a.ttl - a.age) / window)

/** Square-brush line from (x0, y0) to (x1, y1), `w` px thick, as one path. */
const line = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
  const half = Math.floor(w / 2)
  beginRects(ctx, color)
  for (let i = 0; i <= n; i++) {
    const k = i / n
    ctx.rect(Math.round(x0 + (x1 - x0) * k) - half, Math.round(y0 + (y1 - y0) * k) - half, w, w)
  }
  ctx.fill()
}

/** A jagged arc from (x0, y0) to (x1, y1), `width` px: `kinks` corners jittered by `jag` px, reshuffled `rate` times a second. */
const zap = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number, t: number, edge: string, core: string, kinks = 5, jag = 4, rate = 20, width = 2) => {
  const frame = Math.floor(t * rate)
  const nx = -(y1 - y0)
  const ny = x1 - x0
  const len = Math.max(1, Math.hypot(nx, ny))
  let ax = x0
  let ay = y0
  for (let i = 1; i <= kinks; i++) {
    const k = i / kinks
    const off = i === kinks ? 0 : (hash2(seed, i, frame) - 0.5) * 2 * jag
    const bx = x0 + (x1 - x0) * k + (nx / len) * off
    const by = y0 + (y1 - y0) * k + (ny / len) * off
    line(ctx, ax, ay, bx, by, width, edge)
    line(ctx, ax, ay, bx, by, Math.max(1, width - 1), core)
    ax = bx
    ay = by
  }
}

/** Plots (`plot`) a small flame tongue, 2–5 px tall, flickering with `t`: a sea of them fills as one path per shade. */
const tongue = (x: number, y: number, size: number, seed: number, t: number, shades: readonly string[]) => {
  const flick = Math.floor(t * 14 + seed * 10) % 3
  const h = Math.max(2, Math.round(size + flick - 1))
  for (let i = 0; i < h; i++) {
    const k = i / h
    const color = shades[Math.min(shades.length - 1, Math.floor(k * shades.length))]!
    const w = i < h - 1 ? (k < 0.5 ? 3 : 2) : 1
    plot(color, x - Math.floor(w / 2) + (i === h - 1 && flick === 1 ? 1 : 0), y - i, w, 1)
  }
}

const FIRE = ['#a82010', '#e85818', '#f8b030', '#fff4b0'] as const
const WATER = ['#2850b0', '#5890e8', '#a8d8f8', '#ffffff'] as const
const GRASS = ['#205818', '#389828', '#78c848', '#d0f090'] as const
const RAINBOW = ['#f04848', '#f89838', '#f8e048', '#68d048', '#4890f0', '#8850d8'] as const

/* ---------------- Ground ---------------- */

/** Fire Pledge's sea of fire: a burning ellipse full of flame tongues, spreading in and dying down. */
const seaOfFire = (ctx: Ctx, a: Attack, t: number) => {
  const grow = clamp01(a.age / 0.25)
  const fade = fadeOut(a, 0.5)
  const r = radiusOf(a) * (0.4 + 0.6 * grow)
  ctx.globalAlpha = fade
  blitEllipse(ctx, Math.round(r), Math.round(r * 0.66), 'rgba(232,72,16,0.32)', a.x, a.y)
  blitEllipse(ctx, Math.round(r * 0.72), Math.round(r * 0.47), 'rgba(248,152,40,0.3)', a.x, a.y)
  blitEllipse(ctx, Math.round(r * 0.4), Math.round(r * 0.26), 'rgba(255,232,128,0.28)', a.x, a.y)
  dashedRing(ctx, a.x, a.y, r, t * 3 + a.id, [FIRE[1], FIRE[2], FIRE[0]], 0.95, 0.66)
  const count = Math.round(r * 1.5)
  for (let i = 0; i < count; i++) {
    const ang = hash2(a.id, i, 1) * TAU
    const d = Math.sqrt(hash2(a.id, i, 2)) * r * 0.92
    // Each tongue lives its own short life, so the sea keeps churning.
    const life = (t * 1.6 + hash2(a.id, i, 3)) % 1
    if (life > 0.85) continue
    tongue(a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.66, 2 + 4 * Math.sin(life * Math.PI) * fade, hash2(a.id, i, 4), t, FIRE)
  }
  fillPlotted(ctx)
  // A wall of taller flames along the rim.
  const rim = Math.round(r * 0.9)
  for (let i = 0; i < rim; i++) {
    const ang = (i / rim) * TAU
    tongue(a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.66, (4 + 3 * hash2(a.id, i, 9)) * fade * (0.5 + 0.5 * grow), hash2(a.id, i, 10), t, FIRE)
  }
  fillPlotted(ctx)
  ctx.globalAlpha = 1
}

/** Grass Pledge's swamp: murky water around the player with reeds at the rim and bubbles popping. */
const swamp = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const grow = clamp01(a.age / 0.4)
  const rr = r * grow
  blitEllipse(ctx, Math.round(rr), Math.round(rr * 0.62), 'rgba(48,72,24,0.34)', a.x, a.y)
  blitEllipse(ctx, Math.round(rr * 0.75), Math.round(rr * 0.45), 'rgba(88,104,40,0.22)', a.x, a.y)
  dashedRing(ctx, a.x, a.y, rr, t * 0.8, ['#587028', '#88a040', '#405818'], 0.8, 0.62)
  // Reeds stand still on the ground while the swamp walks: hashed on world cells.
  const reeds = Math.round(rr * 0.35)
  for (let i = 0; i < reeds; i++) {
    const ang = (i / reeds) * TAU + hash2(i, 7, 1) * 0.3
    const x = a.x + Math.cos(ang) * rr * (0.86 + hash2(i, 7, 2) * 0.12)
    const y = a.y + Math.sin(ang) * rr * 0.62 * (0.86 + hash2(i, 7, 2) * 0.12)
    const h = 3 + Math.floor(hash2(i, 7, 3) * 3)
    const sway = Math.round(Math.sin(t * 2 + i) * 0.6)
    px(ctx, x, y - h, '#386020', 1, h)
    px(ctx, x + sway, y - h - 1, '#88b048')
    if (i % 3 === 0) px(ctx, x + sway, y - h - 2, '#a07038', 1, 2)
  }
  // Bubbles rise and pop at hashed spots.
  for (let i = 0; i < 9; i++) {
    const life = (t * 0.9 + hash2(a.id, i, 5)) % 1
    const ang = hash2(a.id, i, 6) * TAU + Math.floor(t * 0.9 + hash2(a.id, i, 5)) * 1.7
    const d = Math.sqrt(hash2(a.id, i, 8)) * rr * 0.8
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.62
    if (life < 0.7) blitRing(ctx, 1 + Math.floor(life * 3), 1, '#a8c068', x, y)
    else if (life < 0.8) for (const [dx, dy] of [[-2, 0], [2, 0], [0, -2]] as const) px(ctx, x + dx, y + dy, '#d0e090')
  }
}

/** Ion Deluge's puddle: blue water that flashes yellow every time it zaps. */
const puddle = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const grow = clamp01(a.age / 0.15)
  const fade = fadeOut(a, 0.4)
  const zapping = a.age >= a.activeFrom && (a.age - a.activeFrom) % a.hitInterval < 0.1
  ctx.globalAlpha = fade
  blitEllipse(ctx, Math.round(r * grow), Math.round(r * 0.58 * grow), zapping ? 'rgba(248,232,96,0.6)' : 'rgba(40,96,208,0.62)', a.x, a.y)
  blitEllipse(ctx, Math.round(r * 0.6 * grow), Math.round(r * 0.3 * grow), zapping ? 'rgba(255,255,220,0.6)' : 'rgba(136,192,248,0.45)', a.x - r * 0.15, a.y - 1)
  dashedRing(ctx, a.x, a.y, r * grow, t * 4, zapping ? ['#fff8b0', '#f8e030'] : ['#a8d8f8', '#5890e8'], 0.6, 0.58)
  // Each zap throws little bolts up out of the water.
  if (zapping) {
    for (let i = 0; i < 3; i++) {
      const x = a.x + (hash2(a.id, i, Math.floor(t * 30)) - 0.5) * r * 1.4
      zap(ctx, x, a.y, x + (hash2(a.id, i, 9) - 0.5) * 6, a.y - 16 - i * 4, a.id + i * 13, t, '#f8d030', '#ffffff', 3, 2, 30)
    }
  }
  // Sparks dance on the surface.
  for (let i = 0; i < 4; i++) {
    if (hash2(a.id, i, Math.floor(t * 18)) > (zapping ? 0.9 : 0.35)) continue
    const ang = hash2(a.id, i, Math.floor(t * 18) + 3) * TAU
    const d = hash2(a.id, i, Math.floor(t * 18) + 5) * r * 0.8
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.58 - 1, '#fff8a0', 1, 2)
  }
  ctx.globalAlpha = 1
}

/** Ground scars of a comet: Flare's glowing embers, Bolt's crackling scorch. */
const scorch = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const fade = fadeOut(a, 0.5)
  const bolt = a.type === 'electric'
  ctx.globalAlpha = fade
  blitEllipse(ctx, Math.round(r), Math.round(r * 0.6), bolt ? 'rgba(24,40,96,0.4)' : 'rgba(48,16,8,0.4)', a.x, a.y)
  for (let i = 0; i < 14; i++) {
    const ang = hash2(a.id, i, 1) * TAU
    const d = Math.sqrt(hash2(a.id, i, 2)) * r
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.6
    const on = (t * 3 + hash2(a.id, i, 3)) % 1 < 0.6
    if (bolt) {
      if (on) px(ctx, x, y, hash2(a.id, i, Math.floor(t * 12)) > 0.5 ? '#fff8a0' : '#80d0f8', 2, 1)
    } else px(ctx, x, y, on ? '#f8b030' : '#a82010', 1, 1)
  }
  ctx.globalAlpha = 1
}

/** A comet's shadow growing as it falls (with a blinking rim), then the shockwave rings. */
const cometGround = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const pal = a.type === 'electric' ? COMET_PALETTES.fusionBolt : COMET_PALETTES.fusionFlare
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    blitEllipse(ctx, Math.round(r * (0.3 + 0.7 * k)), Math.max(1, Math.round(r * 0.55 * (0.3 + 0.7 * k))), 'rgba(16,8,24,0.35)', a.x, a.y)
    if (Math.floor(a.age * 20) % 2 === 0) dashedRing(ctx, a.x, a.y, r, a.age * 6, [pal[2], pal[1]], 0.9, 0.55)
    return
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = clamp01(1 - e)
  blitEllipse(ctx, Math.round(r * (0.8 + e)), Math.round(r * 0.55 * (0.8 + e)), a.type === 'electric' ? 'rgba(128,208,248,0.25)' : 'rgba(248,176,48,0.25)', a.x, a.y)
  dashedRing(ctx, a.x, a.y, r * (0.6 + e * 1.4), a.id, [pal[1], pal[2], pal[0]], 0.85, 0.55)
  dashedRing(ctx, a.x, a.y, r * (0.3 + e * 0.9), -a.id, [pal[0], pal[2]], 0.6, 0.55)
  ctx.globalAlpha = 1
}

/** Before a pillar bursts, the ground ripples (a geyser bubbles, a vine pushes up the earth); after, a ring at its foot. */
const pillarGround = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const shades = a.type === 'water' ? WATER : a.type === 'grass' ? GRASS : FIRE
  if (a.age < a.activeFrom) {
    const k = a.age / Math.max(0.01, a.activeFrom)
    dashedRing(ctx, a.x, a.y, r * (0.4 + 0.6 * k), t * 8, [shades[2], shades[1]], 0.7, 0.55)
    return
  }
  const e = clamp01((a.age - a.activeFrom) / 0.35)
  ctx.globalAlpha = 1 - e
  dashedRing(ctx, a.x, a.y, r * (0.8 + e * 0.8), a.id, [shades[2], shades[3], shades[1]], 0.8, 0.55)
  ctx.globalAlpha = 1
}

/** Freeze-Dry's frost on the ground: a rim of ice where the mist has reached and crystals left behind. */
const frostGround = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const fade = fadeOut(a, 0.25)
  ctx.globalAlpha = fade * 0.9
  blitEllipse(ctx, Math.round(r), Math.round(r * 0.62), 'rgba(200,236,255,0.16)', a.x, a.y)
  dashedRing(ctx, a.x, a.y, r, a.id, ['#ffffff', '#c8f0ff', '#78c0f0'], 0.9, 0.62)
  const count = Math.round(r * 0.5)
  for (let i = 0; i < count; i++) {
    const ang = hash2(a.id, i, 1) * TAU
    const d = hash2(a.id, i, 2) * r
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.62
    px(ctx, x - 1, y, '#e0f8ff', 3, 1)
    px(ctx, x, y - 1, '#ffffff', 1, 3)
  }
  ctx.globalAlpha = 1
}

export const drawDuoGround = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'seaOfFire':
        seaOfFire(ctx, a, t)
        break
      case 'swamp':
        swamp(ctx, a, t)
        break
      case 'ionPuddle':
        puddle(ctx, a, t)
        break
      case 'cometScorch':
        scorch(ctx, a, t)
        break
      case 'comet':
        cometGround(ctx, a)
        break
      case 'pledgePillar':
        pillarGround(ctx, a, t)
        break
      case 'freezeDry':
        frostGround(ctx, a)
        break
    }
  }
}

/* ---------------- Air ---------------- */

/** A water column `height` px tall: wavy foaming sides, white streaks running up, a crown of spray. */
const geyser = (ctx: Ctx, a: Attack, t: number, height: number, width: number, life: number) => {
  for (let i = 0; i < height; i++) {
    const k = i / Math.max(1, height)
    const wave = Math.round(Math.sin(i * 0.45 - t * 18) * 1.2)
    const half = Math.max(2, Math.round((width / 2) * (1.15 - k * 0.35) + (i < 4 ? 4 - i : 0)))
    // Rows don't overlap, and each color is plotted narrower than the one before: one path per color layers the same.
    plot(WATER[0], a.x - half + wave, a.y - i, half * 2 + 1, 1)
    plot(WATER[1], a.x - half + 1 + wave, a.y - i, half * 2 - 1, 1)
    plot(WATER[2], a.x - Math.round(half * 0.5) + wave, a.y - i, Math.max(1, half), 1)
    // Foam streaks racing up the column.
    for (let s = 0; s < 3; s++) {
      if ((i + Math.floor(t * 60) + s * 7 + a.id) % 11 < 3) plot(WATER[3], a.x - half + 2 + s * Math.max(1, Math.floor(half / 1.5)) + wave, a.y - i)
    }
  }
  fillPlotted(ctx)
  const top = a.y - height
  blitEllipse(ctx, Math.round(width * 0.8), Math.round(width * 0.45), WATER[3], a.x, top)
  blitEllipse(ctx, Math.round(width * 0.55), Math.round(width * 0.3), WATER[2], a.x, top + 1)
  // Spray falling off the crown.
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1
    const spread = (3 + (i >> 1)) * side
    const k = clamp01(life * 1.8 + hash2(a.id, i, 1) * 0.3)
    plot(i % 3 ? WATER[3] : WATER[2], a.x + spread * (1 + k * 2), top + k * k * 26 - 2, 2, 2)
  }
  // The splash ring at the foot.
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI + (i / 9) * Math.PI
    plot(WATER[3], a.x + Math.cos(ang) * (width + 3), a.y + Math.sin(ang) * 4 - 1, 2, 2)
  }
  fillPlotted(ctx)
}

/** How tall a Pledge pillar stands, by type: water geysers highest, vines lowest. */
const PILLAR_HEIGHT = { fire: 40, water: 54, grass: 38 } as const

/**
 * A Pledge pillar: a column of its type bursting out of the ground and
 * falling back. Fire flickers and throws embers, water is a geyser with a
 * crown of spray, grass twists like a vine with leaves.
 */
const pillar = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < a.activeFrom) return
  const kind = a.type === 'water' ? 'water' : a.type === 'grass' ? 'grass' : 'fire'
  const shades = kind === 'grass' ? GRASS : FIRE
  const life = (a.age - a.activeFrom) / Math.max(0.01, a.ttl - a.activeFrom)
  const rise = clamp01(life / 0.22)
  const fall = clamp01((life - 0.55) / 0.45)
  const height = Math.round(PILLAR_HEIGHT[kind] * (a.shape.kind === 'circle' ? a.shape.r / 11 : 1) * rise * (1 - fall * 0.7))
  const width = Math.max(3, Math.round(radiusOf(a) * 1.1 * (1 - fall * 0.5)))
  ctx.globalAlpha = 1 - fall * 0.8
  if (kind === 'water') {
    geyser(ctx, a, t, height, width, life)
    ctx.globalAlpha = 1
    return
  }
  for (let i = 0; i < height; i++) {
    const k = i / Math.max(1, height)
    const half = Math.max(1, Math.round((width / 2) * (1 - k * 0.45)))
    const wob = kind === 'grass' ? Math.round(Math.sin(i * 0.35 + a.id) * 2) : Math.round((hash2(a.id, i, Math.floor(t * 16)) - 0.5) * 2)
    const color = shades[Math.min(shades.length - 1, Math.floor((1 - k) * 0.4 * shades.length + k * shades.length * 0.95))]!
    px(ctx, a.x - half + wob, a.y - i, shades[0], half * 2 + 1, 1)
    px(ctx, a.x - half + 1 + wob, a.y - i, color, Math.max(1, half * 2 - 1), 1)
    if (i % 2 === 0 && half > 2) px(ctx, a.x + wob - 1, a.y - i, shades[3], 2, 1)
    if (kind === 'grass' && i % 7 === 3) {
      const side = (i / 7) % 2 < 1 ? 1 : -1
      px(ctx, a.x + wob + (side > 0 ? half + 1 : -half - 3), a.y - i, GRASS[2], 3, 1)
      px(ctx, a.x + wob + (side > 0 ? half + 2 : -half - 3), a.y - i - 1, GRASS[3], 2, 1)
    }
  }
  const top = a.y - height
  if (kind === 'fire') {
    for (let i = 0; i < 6; i++) {
      const k = (t * 2 + hash2(a.id, i, 1)) % 1
      px(ctx, a.x + (hash2(a.id, i, 2) - 0.5) * width * 2, top - k * 14, k < 0.5 ? FIRE[3] : FIRE[2])
    }
  } else {
    px(ctx, a.x - 2, top - 2, GRASS[3], 5, 2)
    px(ctx, a.x - 1, top - 4, GRASS[2], 3, 2)
  }
  ctx.globalAlpha = 1
}

/** A comet falling from `from` onto its spot (speeding up) with a glowing head and a long tail; at impact a white flash. */
const cometAir = (ctx: Ctx, a: Attack, t: number) => {
  const pal = a.type === 'electric' ? COMET_PALETTES.fusionBolt : COMET_PALETTES.fusionFlare
  const bolt = a.type === 'electric'
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    const e = 0.35 * k + 0.65 * k * k
    const x = a.from.x + (a.x - a.from.x) * e
    const y = a.from.y + (a.y - 8 - a.from.y) * e
    const dx = a.x - a.from.x
    const dy = a.y - a.from.y
    const len = Math.hypot(dx, dy)
    const ux = dx / len
    const uy = dy / len
    // A soft glow around the head.
    ctx.globalAlpha = 0.35
    blitEllipse(ctx, 14, 14, pal[2], x, y)
    ctx.globalAlpha = 0.5
    blitEllipse(ctx, 10, 10, pal[1], x, y)
    ctx.globalAlpha = 1
    // The tail, thinning and cooling behind the head; lightning jitters, fire flickers.
    for (let i = 40; i >= 1; i--) {
      const k2 = i / 40
      const jitter = bolt ? Math.round((hash2(a.id, i, Math.floor(t * 24)) - 0.5) * 5 * k2) : Math.round((hash2(a.id, i, Math.floor(t * 16)) - 0.5) * 2)
      const tx = x - ux * i * 2.4 - uy * jitter
      const ty = y - uy * i * 2.4 + ux * jitter
      const w = Math.max(1, Math.round(9 * (1 - k2)))
      const color = pal[Math.min(pal.length - 1, Math.floor(k2 * pal.length))]!
      px(ctx, tx - Math.floor(w / 2), ty - Math.floor(w / 2), color, w, w)
    }
    for (let i = 0; i < 6; i++) {
      const life = (t * 3 + hash2(a.id, i, 1)) % 1
      const back = 6 + life * 30
      const side = (hash2(a.id, i, 2) - 0.5) * 16 * life
      px(ctx, x - ux * back - uy * side, y - uy * back + ux * side, life < 0.5 ? pal[1] : pal[3], 2, 2)
    }
    for (let yy = -7; yy <= 7; yy++) {
      for (let xx = -7; xx <= 7; xx++) {
        const d = xx * xx + yy * yy
        if (d > 52) continue
        px(ctx, x + xx, y + yy, d <= 9 ? pal[0] : d <= 25 ? pal[1] : d <= 40 ? pal[2] : pal[3])
      }
    }
    if (bolt) {
      for (let i = 0; i < 4; i++) {
        const ang = hash2(a.id, i, Math.floor(t * 20)) * TAU
        zap(ctx, x, y, x + Math.cos(ang) * 16, y + Math.sin(ang) * 16, a.id + i, t, '#3878e0', '#fff8a0', 3, 3)
      }
    }
    return
  }
  const e = (a.age - a.activeFrom) / 0.16
  if (e > 1) return
  const r = radiusOf(a)
  ctx.globalAlpha = 1 - e
  blitEllipse(ctx, Math.round(r * (0.8 + e * 0.6)), Math.round(r * 0.8 * (0.8 + e * 0.6)), pal[1], a.x, a.y - 6)
  blitEllipse(ctx, Math.round(r * 0.55), Math.round(r * 0.45), pal[0], a.x, a.y - 6)
  // A pillar of light where it struck.
  px(ctx, a.x - 3, a.y - 70, pal[0], 7, 64)
  px(ctx, a.x - 5, a.y - 50, pal[1], 2, 44)
  px(ctx, a.x + 4, a.y - 50, pal[1], 2, 44)
  ctx.globalAlpha = 1
}

/** The mist's front: puffs riding the edge of Freeze-Dry's ring, and snowflakes twinkling inside. */
const mist = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const fade = fadeOut(a, 0.25)
  const puffs = Math.max(10, Math.round(r * 0.7))
  ctx.globalAlpha = fade * 0.85
  for (let i = 0; i < puffs; i++) {
    const ang = (i / puffs) * TAU + a.id
    const wob = Math.sin(t * 5 + i) * 1.5
    const x = a.x + Math.cos(ang) * (r + wob)
    const y = a.y - 4 + Math.sin(ang) * (r + wob) * 0.62
    const s = 2 + (i % 3)
    px(ctx, x - s / 2, y - s / 2, i % 2 ? '#ffffff' : '#c8ecff', s, s)
  }
  for (let i = 0; i < 8; i++) {
    const on = (t * 2.5 + hash2(a.id, i, 1)) % 1 < 0.4
    if (!on) continue
    const ang = hash2(a.id, i, 2) * TAU
    const d = hash2(a.id, i, 3) * r * 0.9
    const x = a.x + Math.cos(ang) * d
    const y = a.y - 6 + Math.sin(ang) * d * 0.62
    px(ctx, x - 2, y, '#ffffff', 5, 1)
    px(ctx, x, y - 2, '#ffffff', 1, 5)
    px(ctx, x - 1, y - 1, '#a8e0ff', 3, 3)
    px(ctx, x, y, '#ffffff')
  }
  ctx.globalAlpha = 1
}

/** The Nightmare's chain: a violet and venom-green strand from foe to foe, fading, with a wisp where it lands. */
const chain = (ctx: Ctx, a: Attack, t: number) => {
  ctx.globalAlpha = clamp01((a.ttl - a.age) / 0.15)
  zap(ctx, a.from.x, a.from.y, a.x, a.y, a.id, t, '#301048', '#c098f0', 6, 5, 20, 3)
  zap(ctx, a.from.x, a.from.y, a.x, a.y, a.id + 7, t, '#305018', '#a8f060', 4, 4, 14)
  blitEllipse(ctx, 4 + Math.round(a.age * 10), 3 + Math.round(a.age * 6), 'rgba(152,120,200,0.45)', a.x, a.y)
  blitRing(ctx, 3 + Math.round(a.age * 16), 1, '#c098f0', a.x, a.y)
  ctx.globalAlpha = 1
}

const skullSprite = (() => {
  let s: (CanvasImageSource & { width: number; height: number }) | null = null
  return () => (s ??= DUO_ICONS.nightmare())
})()

/** The skull's second bite: it pops up over the foe, twice its size for a snap, then floats off, venom dripping. */
const skull = (ctx: Ctx, a: Attack) => {
  const k = a.age / a.ttl
  const scale = a.age < 0.06 ? 2 : 1
  const sprite = skullSprite()
  ctx.globalAlpha = clamp01(1.15 - k * 1.1)
  const w = sprite.width * scale
  const h = sprite.height * scale
  const y = Math.round(a.y - 12 - k * 12)
  ctx.drawImage(sprite, Math.round(a.x - w / 2), Math.round(y - h / 2), w, h)
  for (let i = 0; i < 3; i++) px(ctx, a.x - 3 + i * 3, y + h / 2 + k * 10 + i * 2, '#a8f060', 1, 2)
  if (a.age < 0.14) {
    blitRing(ctx, 5 + Math.round(a.age * 70), 1, '#a8f060', a.x, a.y - 4)
    blitRing(ctx, 3 + Math.round(a.age * 50), 1, '#c098f0', a.x, a.y - 4)
  }
  ctx.globalAlpha = 1
}

/** Arcs between neighboring puddles of Ion Deluge: each puddle to the nearest other within reach, drawn once per pair. */
const puddleArcs = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.visual !== 'ionPuddle' || a.age < a.activeFrom) continue
    let best: Attack | null = null
    let bestD = 150 * 150
    for (const b of g.attacks) {
      if (b === a || b.visual !== 'ionPuddle' || b.age < b.activeFrom) continue
      const d = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
      if (d < bestD) {
        bestD = d
        best = b
      }
    }
    if (!best || best.id < a.id) continue
    const zapping = (a.age - a.activeFrom) % a.hitInterval < 0.1
    ctx.globalAlpha = Math.min(fadeOut(a, 0.4), fadeOut(best, 0.4)) * (zapping ? 1 : 0.55)
    zap(ctx, a.x, a.y - 2, best.x, best.y - 2, a.id * 31 + best.id, t, zapping ? '#f8d030' : '#3878e0', zapping ? '#ffffff' : '#a8e0ff', 7, zapping ? 7 : 3, 20, zapping ? 3 : 2)
    ctx.globalAlpha = 1
  }
}

/**
 * Water Pledge's rainbow: an arc of the six colors over the field while the
 * buff lasts, wide enough to span the screen, fading in and out.
 */
const rainbow = (ctx: Ctx, g: Game, t: number) => {
  const buff = localPlayer(g).moveBuffs.find((b) => b.move === 'waterPledge')
  if (!buff) return
  // Fades out over its last half second (each cast refreshes it).
  const alpha = Math.min(1, buff.left / 0.5) * 0.5
  const cx = Math.round(localPlayer(g).x)
  const cy = Math.round(localPlayer(g).y + g.view.h * 0.25)
  const r0 = Math.round(Math.max(g.view.w * 0.5, g.view.h * 0.75))
  // Each band is one path, so its overlapping dots fill once: as opaque as they built up drawn one by one.
  ctx.globalAlpha = alpha * 1.6
  // The arc is wider than the screen: only the dots in view (with room for the screen shake) are drawn, most of them on a phone held upright.
  const margin = 8 + Math.ceil(g.shake)
  const left = Math.round(g.camera.x) - margin
  const top = Math.round(g.camera.y) - margin
  const right = left + g.view.w + margin * 2
  const bottom = top + g.view.h + margin * 2
  RAINBOW.forEach((color, band) => {
    const r = r0 - band * 3
    const steps = Math.round(Math.PI * r)
    beginRects(ctx, color)
    for (let i = 0; i <= steps; i++) {
      const ang = Math.PI + (i / steps) * Math.PI
      const x = Math.round(cx + Math.cos(ang) * r)
      const y = Math.round(cy + Math.sin(ang) * r * 0.7)
      if (x >= left && x <= right && y >= top && y <= bottom) ctx.rect(x, y, 2, 3)
    }
    ctx.fill()
  })
  // A few twinkles riding the arc.
  ctx.globalAlpha = alpha * 1.6
  for (let i = 0; i < 6; i++) {
    const ang = Math.PI + ((t * 0.12 + i / 6) % 1) * Math.PI
    const x = cx + Math.cos(ang) * (r0 - 8)
    const y = cy + Math.sin(ang) * (r0 - 8) * 0.7
    px(ctx, x - 2, y, '#ffffff', 5, 1)
    px(ctx, x, y - 2, '#ffffff', 1, 5)
  }
  ctx.globalAlpha = 1
}

export const drawDuoAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  rainbow(ctx, g, t)
  puddleArcs(ctx, g, t)
  for (const a of g.attacks) {
    if (a.age < 0 || !visible(a.x, a.y, 200)) continue
    switch (a.visual) {
      case 'pledgePillar':
        pillar(ctx, a, t)
        break
      case 'comet':
        cometAir(ctx, a, t)
        break
      case 'freezeDry':
        mist(ctx, a, t)
        break
      case 'nightmare':
        chain(ctx, a, t)
        break
      case 'nightmareSkull':
        skull(ctx, a)
        break
    }
  }
}
