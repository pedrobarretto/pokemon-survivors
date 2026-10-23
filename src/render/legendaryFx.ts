import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { bodyOf } from '../data/bodies'
import { playerForm } from '../game/branch'
import { SANDS, TIME } from '../game/legendaryMoves'
import type { Attack, Game } from '../game/types'
import { LEGEND_FX } from './legendaryArt'
import { dashedRing } from './strokes'
import { detail } from './quality'
import { actAs, ownerOf } from '../game/players'

/**
 * Art of the legendary moves (`game/legendaryMoves.ts`), the biggest effects
 * in the game. `draw.ts` calls the two passes once a frame: `drawLegendaryGround`
 * under the Pokémon (the cyclone's shadow, sacred flames, hot sand, craters)
 * and `drawLegendaryAir` over them (the phoenix, rings, beams, comets, the
 * clock). Both walk `g.attacks` themselves. Everything snaps to whole pixels.
 */

export type Ctx = CanvasRenderingContext2D

export const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

export const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)
export const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
/** 1 while it lives, easing to 0 over its last `window` seconds. */
export const fadeOut = (a: Attack, window: number) => clamp01((a.ttl - a.age) / window)

/** Square-brush line from (x0, y0) to (x1, y1), `w` px thick. Drawing lean, a brush 2 px or wider stamps every other step: the squares still overlap. */
export const thickLine = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
  const half = Math.floor(w / 2)
  const stride = detail.lean && w >= 2 ? 2 : 1
  ctx.fillStyle = color
  for (let i = 0; i <= n; i = i < n && i + stride > n ? n : i + stride) {
    const k = i / n
    ctx.fillRect(Math.round(x0 + (x1 - x0) * k) - half, Math.round(y0 + (y1 - y0) * k) - half, w, w)
  }
}

/** A 4-point twinkle. */
export const twinkle = (ctx: Ctx, x: number, y: number, size: number, color: string) => {
  px(ctx, x - size, y, color, size * 2 + 1, 1)
  px(ctx, x, y - size, color, 1, size * 2 + 1)
}

/**
 * A solid ring `thick` px wide at radius `r` (squashed by `squash`), in one color. Drawing lean,
 * a ring 2 px or thicker is plotted in 2 px squares, every other step: a quarter of the calls.
 */
export const band = (ctx: Ctx, x: number, y: number, r: number, thick: number, color: string, squash = 1) => {
  const steps = Math.max(24, Math.ceil(r * TAU))
  const size = detail.lean && thick >= 2 ? 2 : 1
  ctx.fillStyle = color
  for (let i = 0; i < steps; i += size) {
    const a = (i / steps) * TAU
    for (let d = 0; d < thick; d += size) ctx.fillRect(Math.round(x + Math.cos(a) * (r - d)), Math.round(y + Math.sin(a) * (r - d) * squash), size, size)
  }
}

/** Rays from (x, y), `count` of them from `inner` to `outer`, alternating long and short. */
export const spokes = (ctx: Ctx, x: number, y: number, inner: number, outer: number, count: number, colors: readonly string[], turn = 0, squash = 1) => {
  for (let i = 0; i < count; i++) {
    const a = turn + (i / count) * TAU
    const len = i % 2 === 0 ? outer : inner + (outer - inner) * 0.55
    for (let d = inner; d <= len; d++) {
      const k = (d - inner) / Math.max(1, len - inner)
      px(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d * squash, colors[Math.min(colors.length - 1, Math.floor(k * colors.length))]!)
    }
  }
}

/* ---------------- Lugia: Whirlwind ---------------- */

const WHIRL_COLORS = ['#ffffff', '#d8e0f0', '#a8b8e0', '#7890c8'] as const

/** How tall and how present the cyclone is: it grows in, and thins out at the end. */
const whirlPresence = (a: Attack) => Math.min(clamp01(a.age / 0.35), fadeOut(a, 0.3))

const drawWhirlGround = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = whirlPresence(a)
  ctx.globalAlpha = 0.9 * k
  blitEllipse(ctx, Math.round(r * 1.1), Math.max(1, Math.round(r * 0.45)), 'rgba(24,32,64,0.28)', a.x, a.y + 2)
  dashedRing(ctx, a.x, a.y + 2, r * 1.15, t * 9, ['#ffffff', '#a8b8e0'], 0.6, 0.4)
  dashedRing(ctx, a.x, a.y + 2, r * 0.75, -t * 11, ['#d8e0f0', '#7890c8'], 0.5, 0.4)
  ctx.globalAlpha = 1
}

/** The funnel: stacked swirling bands of wind, narrow at the ground and wide up top, swaying; debris and feathers ride it. */
const drawWhirlwind = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = whirlPresence(a)
  const height = Math.round(r * 3.2 * (0.4 + 0.6 * k))
  const layers = Math.max(10, Math.round(height / 2))
  ctx.globalAlpha = Math.max(0.15, k)
  // Drawing lean (`render/quality.ts`), the column has half the layers of air and every streak half the dots.
  const thin = detail.lean ? 2 : 1
  // The body: a translucent column of churning air, so the funnel reads as one mass.
  for (let i = 0; i < layers; i += 2 * thin) {
    const f = i / (layers - 1)
    const w = r * (0.25 + 1.0 * f ** 1.3)
    const sway = Math.sin(t * 3 + a.id + f * 3) * 4 * f
    blitEllipse(ctx, Math.max(1, Math.round(w)), Math.max(1, Math.round(w * 0.3)), 'rgba(200,214,240,0.22)', a.x + sway, a.y - f * height)
  }
  for (let i = 0; i < layers; i++) {
    const f = i / (layers - 1)
    const w = r * (0.25 + 1.0 * f ** 1.3)
    const sway = Math.sin(t * 3 + a.id + f * 3) * 4 * f
    const cy = a.y - f * height
    const spin = t * (13 - f * 5) + i * 0.55
    const n = Math.max(12, Math.round(w * 2.4))
    for (let j = 0; j < n; j += thin) {
      const ang = spin + (j / n) * TAU
      const front = Math.sin(ang) > 0
      // Long streaks with short gaps; the back half is dimmer.
      if (Math.cos(ang * 3 + f * 7 + t * 2) < -0.55) continue
      const c = front ? (Math.cos(ang) > 0.4 ? '#ffffff' : WHIRL_COLORS[(j + i) % 2]!) : WHIRL_COLORS[2 + ((j + i) % 2)]!
      px(ctx, a.x + sway + Math.cos(ang) * w, cy + Math.sin(ang) * w * 0.3, c, 2, front ? 2 : 1)
    }
  }
  // Debris and Lugia's feathers whirling up the funnel.
  for (let i = 0; i < 16; i++) {
    const ph = (t * 0.7 + hash2(a.id, i)) % 1
    const ang = t * 7 + hash2(a.id, i, 1) * TAU
    const w = r * (0.35 + ph * 1.1)
    const x = a.x + Math.cos(ang) * w
    const y = a.y - ph * height + Math.sin(ang) * w * 0.3
    if (i % 4 === 0) {
      px(ctx, x, y, '#ffffff', 3, 1)
      px(ctx, x + 1, y + 1, '#7890c8', 3, 1)
    } else px(ctx, x, y, i % 2 ? '#a08868' : '#c8b898', 2, 2)
  }
  ctx.globalAlpha = 1
}

/** The last gust: a white ring blowing out with streaks. */
const drawWhirlBurst = (ctx: Ctx, a: Attack) => {
  const k = a.age / a.ttl
  const r = radiusOf(a) * (0.4 + 0.6 * Math.sqrt(k))
  ctx.globalAlpha = 1 - k
  band(ctx, a.x, a.y - 6, r, 2, '#ffffff', 0.55)
  band(ctx, a.x, a.y - 6, r - 3, 1, '#a8b8e0', 0.55)
  spokes(ctx, a.x, a.y - 6, r * 0.6, r * 1.15, 16, ['#ffffff', '#d8e0f0'], a.id, 0.55)
  ctx.globalAlpha = 1
}

/* ---------------- Ho-Oh: Sacred Fire ---------------- */

const RAINBOW = ['#f83838', '#f89830', '#f8e040', '#58c858', '#48a8f0', '#a868e8'] as const

/** The phoenix: wings beating, a rainbow wake of sparks behind it. */
const drawPhoenix = (ctx: Ctx, a: Attack, t: number) => {
  const angle = a.memo
  const scale = Math.max(2, Math.round(radiusOf(a) / 9))
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)
  // The wake: a fading rainbow streak where it has been.
  const len = Math.min(70, Math.hypot(a.x - a.from.x, a.y - a.from.y))
  for (let d = 6; d < len; d += 1) {
    const k = d / len
    const lane = Math.sin(d * 0.35 - t * 18) * (2 + k * 4)
    const c = RAINBOW[Math.floor((d * 0.15 + t * 8) % RAINBOW.length)]!
    if ((d + Math.floor(t * 30)) % 3 === 0) continue
    px(ctx, a.x - ux * d - uy * lane, a.y - uy * d + ux * lane, c, k < 0.5 ? 2 : 1, k < 0.5 ? 2 : 1)
  }
  for (let i = 0; i < 6; i++) {
    const d = 10 + ((t * 90 + i * 17) % 60)
    const side = (hash2(a.id, i) - 0.5) * 18
    twinkle(ctx, a.x - ux * d - uy * side, a.y - uy * d + ux * side, d < 40 ? 1 : 0, RAINBOW[i]!)
  }
  // A heat glow under the bird.
  ctx.globalAlpha = 0.35
  blitEllipse(ctx, 14 * scale, 8 * scale, '#f8a030', a.x, a.y)
  ctx.globalAlpha = 1
  const frames = LEGEND_FX.phoenix()
  const frame = frames[Math.floor(t * 9 + a.id) % 2]!
  // Flying left, it rolls over so its back stays up.
  const flipped = Math.cos(angle) < 0
  ctx.save()
  ctx.translate(Math.round(a.x), Math.round(a.y))
  ctx.rotate(angle)
  if (flipped) ctx.scale(1, -1)
  if (scale !== 1) ctx.scale(scale, scale)
  ctx.drawImage(frame, -Math.round(frame.width * 0.6), -Math.round(frame.height / 2))
  ctx.restore()
}

/** A sacred flame on the ground: a gold glow under licking fire in the rainbow tints, sinking into embers as it burns out. */
const drawSacredFlame = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const life = 1 - a.age / a.ttl
  const born = clamp01(a.age / 0.12)
  ctx.globalAlpha = Math.min(1, life * 1.8) * born
  blitEllipse(ctx, Math.round(r * 1.1), Math.max(1, Math.round(r * 0.45)), 'rgba(248,120,24,0.3)', a.x, a.y + 2)
  blitEllipse(ctx, Math.round(r * 0.6), Math.max(1, Math.round(r * 0.25)), 'rgba(255,232,120,0.5)', a.x, a.y + 2)
  const frames = LEGEND_FX.flame()
  const sink = Math.round((1 - life) * 7)
  const flick = Math.floor(t * 12 + a.id) % 2
  const sprite = frames[(Math.floor(t * 4 + a.id) % 3 + 3) % 3]!
  ctx.save()
  ctx.beginPath()
  ctx.rect(Math.round(a.x - 12), Math.round(a.y - 22), 24, 24 - sink)
  ctx.clip()
  blitCentered(ctx, sprite, a.x + (a.flip ? 3 : -3), a.y - 4 + sink + flick)
  blitCentered(ctx, frames[(a.id + 1) % 3]!, a.x + (a.flip ? -3 : 3), a.y - 2 + sink - flick)
  ctx.restore()
  // Rainbow sparks rising off the flame.
  for (let i = 0; i < 3; i++) {
    const ph = (t * 1.6 + hash2(a.id, i)) % 1
    px(ctx, a.x + (hash2(a.id, i, 3) - 0.5) * r * 1.6, a.y - 6 - ph * 16, RAINBOW[(a.id + i) % RAINBOW.length]!)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Kyogre: Origin Pulse ---------------- */

/** Kyogre's glowing lines: short cyan glyph marks riding the ring. */
const drawGlyphs = (ctx: Ctx, x: number, y: number, r: number, turn: number, count: number) => {
  for (let i = 0; i < count; i++) {
    const a = turn + (i / count) * TAU
    const cx = x + Math.cos(a) * r
    const cy = y + Math.sin(a) * r
    // A tick across the ring and a dot beside it.
    const nx = Math.cos(a)
    const ny = Math.sin(a)
    for (let d = -3; d <= 3; d++) px(ctx, cx + nx * d, cy + ny * d, d === 0 ? '#ffffff' : '#78e8f8')
    px(ctx, cx - ny * 3, cy + nx * 3, '#ffffff')
  }
}

const drawOriginRing = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = clamp01(a.age / a.ttl)
  const alpha = 1 - k * k * 0.8
  // A wash of glowing water behind the crest, thinning as it spreads.
  ctx.globalAlpha = alpha * 0.35
  band(ctx, a.x, a.y, r - 4, 10, '#78d8f8')
  ctx.globalAlpha = alpha
  band(ctx, a.x, a.y, r + 3, 2, '#102860')
  band(ctx, a.x, a.y, r + 1, 4, '#2858c8')
  band(ctx, a.x, a.y, r - 3, 2, '#78d8f8')
  // The foaming crest, broken and rolling.
  dashedRing(ctx, a.x, a.y, r + 2, -t * 5, ['#ffffff', '#e0f8ff'], 0.55)
  dashedRing(ctx, a.x, a.y, r + 1, t * 4 + 1, ['#ffffff'], 0.4)
  drawGlyphs(ctx, a.x, a.y, r - 1, a.id * 0.4 + k * 1.2, 10)
  // At the start the player blazes with the same marks.
  if (a.age < 0.3) {
    ctx.globalAlpha = 1 - a.age / 0.3
    blitEllipse(ctx, 20, 20, 'rgba(120,216,248,0.5)', a.x, a.y)
    blitEllipse(ctx, 10, 10, 'rgba(255,255,255,0.7)', a.x, a.y)
    drawGlyphs(ctx, a.x, a.y, 15, t * 2, 6)
  }
  ctx.globalAlpha = 1
}

const drawOriginBeam = (ctx: Ctx, a: Attack) => {
  const k = a.age / a.ttl
  // Fires fat and bright, then narrows away: no thin lines are left lingering.
  const w = Math.round(9 * (1 - k) ** 0.7)
  if (w < 3) return
  ctx.globalAlpha = Math.min(1, (1 - k) * 2.5)
  thickLine(ctx, a.from.x, a.from.y, a.x, a.y, w + 2, '#2858c8')
  thickLine(ctx, a.from.x, a.from.y, a.x, a.y, w, '#78d8f8')
  thickLine(ctx, a.from.x, a.from.y, a.x, a.y, Math.max(1, w - 4), '#ffffff')
  blitEllipse(ctx, w, w, '#c8f8ff', a.x, a.y)
  twinkle(ctx, a.x, a.y, w + 2, '#ffffff')
  ctx.globalAlpha = 1
}

/* ---------------- Groudon: Scorching Sands ---------------- */

const SAND = ['#fff0b8', '#f8d890', '#e8b060', '#d08038', '#b04818'] as const

/** The surge: a crescent wall of sand with depth, its crest bright and its foot glowing red, a dust plume behind and grains flying off the top. */
const drawSandWave = (ctx: Ctx, a: Attack, t: number) => {
  if (a.motion.kind !== 'linear') return
  const heading = Math.atan2(a.motion.vy, a.motion.vx)
  const span = a.memo
  const r = SANDS.wall * (radiusOf(a) / 14)
  const k = a.age / a.ttl
  const tall = Math.round(8 + 14 * Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.85))
  const hx = Math.cos(heading)
  const hy = Math.sin(heading) * 0.75
  ctx.globalAlpha = Math.min(1, (1 - k) * 3)
  // Dust plume trailing the wall.
  for (let i = 0; i < 6; i++) {
    const f = hash2(a.id, i)
    const ang = heading + (f - 0.5) * span
    const back = 10 + hash2(a.id, i, 1) * 14
    ctx.globalAlpha = Math.min(1, (1 - k) * 3) * 0.35
    blitEllipse(ctx, 7, 4, '#e8c890', a.x + Math.cos(ang) * (r - back), a.y + Math.sin(ang) * (r - back) * 0.75 - 3)
  }
  ctx.globalAlpha = Math.min(1, (1 - k) * 3)
  const steps = Math.round(r * span * 1.4)
  for (let depth = 5; depth >= 0; depth--) {
    for (let i = 0; i <= steps; i++) {
      const f = i / steps
      const ang = heading + (f - 0.5) * span
      const edge = Math.min(f, 1 - f) * 2
      const x = a.x + Math.cos(ang) * r - hx * depth * 2
      const y = a.y + Math.sin(ang) * r * 0.75 - hy * depth * 2
      // The wall leans forward: the front rows stand tallest.
      const h = Math.max(2, Math.round(tall * (0.4 + 0.6 * edge) * (1 - depth * 0.12) + Math.sin(f * 19 + t * 22 + depth) * 1.5))
      for (let d = 0; d < h; d += 2) {
        const top = d >= h - 2
        const c = top && depth === 0 ? SAND[0] : top ? SAND[1] : d < 3 ? SAND[4] : depth > 2 ? SAND[3] : SAND[2 + ((i + d + depth) % 2)]!
        px(ctx, x, y + 4 - d, c, 2, 2)
      }
    }
  }
  // Grains thrown ahead of the crest.
  for (let i = 0; i < 20; i++) {
    const f = hash2(a.id, i)
    const ang = heading + (f - 0.5) * span
    const ph = (t * 3 + hash2(a.id, i, 1)) % 1
    const d = r + 4 + ph * 18
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.75 - tall * (1 - ph * ph), i % 3 === 0 ? '#f87020' : SAND[1], i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1)
  }
  ctx.globalAlpha = 1
}

/** Hot sand: glowing ground with cracks of red heat and embers drifting up. */
const drawHotSand = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const life = 1 - a.age / a.ttl
  const heat = 0.6 + Math.sin(t * 5 + a.id) * 0.15
  ctx.globalAlpha = Math.min(1, life * 2) * clamp01(a.age / 0.15)
  blitEllipse(ctx, Math.round(r * 1.1), Math.max(1, Math.round(r * 0.5)), 'rgba(208,128,56,0.35)', a.x, a.y)
  blitEllipse(ctx, Math.round(r * 0.7), Math.max(1, Math.round(r * 0.3)), `rgba(240,88,24,${(0.35 * heat).toFixed(2)})`, a.x, a.y)
  // Cracks of heat.
  for (let i = 0; i < 5; i++) {
    const ang = hash2(a.id, i) * TAU
    for (let d = 2; d < r * 0.9; d += 1) {
      const jag = Math.sin(d * 0.8 + i * 5) * 1.2
      px(ctx, a.x + Math.cos(ang) * d - Math.sin(ang) * jag, a.y + (Math.sin(ang) * d + Math.cos(ang) * jag) * 0.45, d < r * 0.5 ? '#f8d030' : '#e04810')
    }
  }
  // Sand grains and embers.
  for (let i = 0; i < 6; i++) {
    const gx = a.x + (hash2(a.id, i, 2) - 0.5) * r * 1.8
    const gy = a.y + (hash2(a.id, i, 3) - 0.5) * r * 0.8
    px(ctx, gx, gy, SAND[i % 3]!)
    const ph = (t * 1.3 + hash2(a.id, i, 4)) % 1
    if (i % 2 === 0) px(ctx, gx, gy - ph * 14, ph < 0.5 ? '#f8a030' : '#c03010')
  }
  ctx.globalAlpha = 1
}

/* ---------------- Rayquaza: Dragon Ascent ---------------- */

/** Taking off: a green column of light shooting up from the player, yellow rings racing up it. */
const drawAscentRise = (ctx: Ctx, g: Game, a: Attack) => {
  const k = a.age / a.ttl
  const top = g.camera.y - 20
  const x = a.x
  const w = Math.max(2, Math.round((1 - k) * 14))
  ctx.globalAlpha = 1 - k * k
  blitEllipse(ctx, w + 6, Math.round((w + 6) * 0.4), 'rgba(88,192,112,0.45)', x, a.y)
  for (let y = a.y; y > top; y -= 1) {
    const f = (a.y - y) / Math.max(1, a.y - top)
    if (f > k * 4) break
    px(ctx, x - Math.floor(w / 2) - 2, y, '#185830', w + 4, 1)
    px(ctx, x - Math.floor(w / 2), y, '#58c070', w, 1)
    px(ctx, x - Math.floor(w / 4), y, '#e8fff0', Math.max(1, Math.floor(w / 2)), 1)
  }
  for (let i = 0; i < 5; i++) {
    const y = a.y - ((a.age * 600 + i * 36) % Math.max(1, a.y - top))
    band(ctx, x, y, w / 2 + 5, 2, '#f8d830', 0.3)
  }
  ctx.globalAlpha = 1
}

/** Where a dive starts, off to the upper right of its target. */
const DIVE = { dx: 90, dy: -230 } as const

/** The dive on its way: a green comet with Rayquaza's yellow bands, and its shadow growing on the target. */
const drawAscentComet = (ctx: Ctx, a: Attack, t: number, ground: boolean) => {
  const k = clamp01(a.age / a.ttl)
  const r = radiusOf(a)
  if (ground) {
    ctx.globalAlpha = 0.2 + 0.5 * k
    blitEllipse(ctx, Math.max(2, Math.round(r * (0.3 + 0.7 * k))), Math.max(1, Math.round(r * 0.42 * (0.3 + 0.7 * k))), 'rgba(16,48,24,0.5)', a.x, a.y)
    ctx.globalAlpha = 1
    return
  }
  // Starts slow and speeds up, like something falling from the sky.
  const e = k * k
  const dx = a.flip ? -DIVE.dx : DIVE.dx
  const hx = a.x + dx * (1 - e)
  const hy = a.y - 10 + DIVE.dy * (1 - e)
  const len0 = Math.hypot(dx, DIVE.dy)
  const ux = -dx / len0
  const uy = -DIVE.dy / len0
  // The serpent body trails back toward the sky, waving.
  const len = 40 + 70 * k
  for (let d = len; d >= 0; d -= 1) {
    const f = d / len
    const w = Math.max(2, Math.round((1 - f) * 12))
    const wave = Math.sin(d * 0.18 - t * 14) * 4 * f
    const x = hx - ux * d + uy * wave
    const y = hy - uy * d - ux * wave
    const ring = Math.floor((d + t * 60) / 10) % 3 === 0
    const half = Math.floor(w / 2)
    px(ctx, x - half - 1, y - half - 1, '#1c6034', w + 2, w + 2)
    px(ctx, x - half, y - half, ring && f < 0.85 ? '#f8d830' : f > 0.6 ? '#389858' : '#48b068', w, w)
    if (w > 4 && !ring) px(ctx, x - half + 1, y - half + 1, '#98e8a8', Math.max(1, w - 3), Math.max(1, Math.floor(w / 3)))
  }
  // The blazing head.
  blitEllipse(ctx, 10, 10, 'rgba(200,255,200,0.4)', hx, hy)
  px(ctx, hx - 6, hy - 6, '#185830', 13, 13)
  px(ctx, hx - 5, hy - 5, '#58c070', 11, 11)
  px(ctx, hx - 4, hy - 4, '#c8f8d0', 9, 9)
  px(ctx, hx - 2, hy - 2, '#ffffff', 5, 5)
  twinkle(ctx, hx, hy, 10, 'rgba(255,255,255,0.8)')
}

/** The impact: a white flash, a green shockwave ring, rubble flying and a scorched crater left behind. */
const drawAscentImpact = (ctx: Ctx, a: Attack, ground: boolean) => {
  const r = radiusOf(a)
  const k = a.age / a.ttl
  if (ground) {
    ctx.globalAlpha = 1 - k
    blitEllipse(ctx, Math.round(r * 0.9), Math.max(1, Math.round(r * 0.4)), 'rgba(24,32,16,0.5)', a.x, a.y)
    for (let i = 0; i < 12; i++) {
      const ang = (i / 12) * TAU + a.id
      for (let d = r * 0.3; d < r * (0.8 + (i % 2) * 0.3); d += 1) px(ctx, a.x + Math.cos(ang) * d + Math.sin(d) * 1.2, a.y + Math.sin(ang) * d * 0.42, '#102010')
    }
    ctx.globalAlpha = 1
    return
  }
  if (a.age < 0.07) {
    blitEllipse(ctx, Math.round(r * 1.3), Math.round(r * 0.9), 'rgba(232,255,232,0.9)', a.x, a.y - 8)
    blitEllipse(ctx, Math.round(r * 0.6), Math.round(r * 0.5), '#ffffff', a.x, a.y - 8)
    return
  }
  ctx.globalAlpha = 1 - k
  const rr = r * (0.5 + 1.0 * Math.sqrt(k))
  band(ctx, a.x, a.y - 2, rr + 2, 2, '#185830', 0.5)
  band(ctx, a.x, a.y - 2, rr, 4, '#58c070', 0.5)
  band(ctx, a.x, a.y - 2, rr - 4, 2, '#f8d830', 0.5)
  spokes(ctx, a.x, a.y - 8, r * 0.2, r * (0.9 + k * 0.6), 16, ['#ffffff', '#c8f8d0', '#58c070'], a.id, 0.75)
  // A green pillar of light where it struck.
  const pillar = Math.round((1 - k) * 10)
  if (pillar > 1) {
    px(ctx, a.x - pillar / 2, a.y - 90, '#58c070', pillar, 88)
    px(ctx, a.x - pillar / 4, a.y - 90, '#e8fff0', Math.max(1, pillar / 2), 88)
  }
  for (let i = 0; i < 14; i++) {
    const ang = hash2(a.id, i) * TAU
    const d = r * (0.3 + k * 1.4) * (0.6 + hash2(a.id, i, 1) * 0.6)
    const lift = Math.sin(k * Math.PI) * (12 + hash2(a.id, i, 2) * 18)
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.5 - lift, i % 2 ? '#806848' : '#a89070', 3, 3)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Dialga: Roar of Time ---------------- */

/** A clock ring: a steel rim with twelve ticks, the quarters long. */
const clockRing = (ctx: Ctx, x: number, y: number, r: number, turn: number) => {
  band(ctx, x, y, r + 1, 1, '#202848')
  band(ctx, x, y, r, 2, '#a8f0f8')
  band(ctx, x, y, r - 2, 1, '#4868a8')
  for (let i = 0; i < 12; i++) {
    const a = turn + (i / 12) * TAU
    const long = i % 3 === 0
    for (let d = long ? -6 : -3; d <= 0; d++) px(ctx, x + Math.cos(a) * (r + d), y + Math.sin(a) * (r + d), long ? '#ffffff' : '#a8f0f8', long ? 2 : 1, long ? 2 : 1)
  }
}

/** Time stops: a cold veil over the whole view, deepest while everything is frozen. */
const drawTimeVeil = (ctx: Ctx, g: Game, a: Attack) => {
  const total = a.ttl
  const k = a.age < TIME.time * 0.5 ? a.age / (TIME.time * 0.5) : a.age > total - 0.25 ? (total - a.age) / 0.25 : 1
  ctx.fillStyle = `rgba(40,64,128,${(0.2 * clamp01(k)).toFixed(3)})`
  ctx.fillRect(Math.floor(g.camera.x) - 8, Math.floor(g.camera.y) - 8, g.view.w + 16, g.view.h + 16)
}

/**
 * The clock over the player's head: it pops in big, settles smaller above the
 * sprite (never over it: it stays up for seconds), its hands spin back as time
 * stops, stand still while it's stopped, and lurch forward when it starts again.
 */
const drawTimeClock = (ctx: Ctx, g: Game, a: Attack) => {
  const pop = clamp01(a.age / 0.15)
  const settle = clamp01((a.age - 0.15) / 0.3)
  const r = Math.round(14 * pop - 4 * settle)
  if (r < 2) return
  const x = Math.round(a.x)
  const p = ownerOf(g, a.owner)
  const before = actAs(g, p)
  const y = Math.round(p.y - bodyOf(playerForm(g).dex).bodyH - r - 3)
  actAs(g, before)
  const end = a.ttl - 0.25
  const hand = a.age < TIME.time * 0.6 ? -a.age * 30 : a.age > end ? -TIME.time * 18 + (a.age - end) * 40 : -TIME.time * 18
  ctx.globalAlpha = fadeOut(a, 0.2)
  blitEllipse(ctx, r + 3, r + 3, 'rgba(168,240,248,0.25)', x, y)
  blitEllipse(ctx, r, r, '#e8f8ff', x, y)
  clockRing(ctx, x, y, r, 0)
  thickLine(ctx, x, y, x + Math.cos(hand - Math.PI / 2) * (r - 3), y + Math.sin(hand - Math.PI / 2) * (r - 3), 2, '#202848')
  thickLine(ctx, x, y, x + Math.cos(hand / 12 - Math.PI / 2) * (r - 5), y + Math.sin(hand / 12 - Math.PI / 2) * (r - 5), 2, '#4868a8')
  // Dialga's diamond at the hub.
  px(ctx, x - 1, y - 2, '#78e0f8', 3, 5)
  px(ctx, x - 2, y - 1, '#78e0f8', 5, 3)
  px(ctx, x, y - 1, '#ffffff')
  ctx.globalAlpha = 1
}

/** The time ring: a giant clock face rolling out over the screen, with an echo ring inside. */
const drawTimeRing = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = clamp01(a.age / a.ttl)
  ctx.globalAlpha = 1 - k * k
  clockRing(ctx, a.x, a.y, r, -k * 1.4)
  if (r > 24) {
    ctx.globalAlpha *= 0.5
    band(ctx, a.x, a.y, r * 0.7, 1, '#a8f0f8')
    dashedRing(ctx, a.x, a.y, r * 0.85, k * 9, ['#ffffff', '#78e0f8'], 0.35)
  }
  ctx.globalAlpha = 1
}

/** Time starts again: a ring snapping in from the edge and cracks of light flashing across. */
const drawTimeSnap = (ctx: Ctx, a: Attack) => {
  const reach = radiusOf(a)
  const k = clamp01(a.age / a.ttl)
  const r = reach * (1 - Math.min(1, k * 1.6))
  ctx.globalAlpha = 1 - k
  if (r > 4) {
    band(ctx, a.x, a.y, r, 2, '#ffffff')
    band(ctx, a.x, a.y, r - 2, 1, '#78e0f8')
  }
  for (let i = 0; i < 14; i++) {
    const ang = hash2(a.id, i) * TAU
    const d = reach * (0.2 + hash2(a.id, i, 1) * 0.75)
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.7
    const c = Math.cos(ang + 1.3)
    const s = Math.sin(ang + 1.3)
    for (let j = -4; j <= 4; j++) px(ctx, x + c * j + (j % 2), y + s * j, j === 0 ? '#ffffff' : '#c8f8ff')
  }
  ctx.globalAlpha = 1
}

/** Foes Roar of Time froze carry a little stopped clock over their heads. */
export const drawStoppedFoes = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  const clock = LEGEND_FX.tinyClock()
  for (const e of g.enemies) {
    const f = e.status.freeze
    if (f.time <= 0 || f.move !== 'roarOfTime' || e.dying >= 0 || !visible(e.x, e.y)) continue
    const head = e.y - e.radius * 2.4 - 4
    if (f.time < 0.3 && Math.floor(t * 20) % 2 === 0) continue
    blitCentered(ctx, clock, e.x, head)
  }
}

/* ---------------- Latias: Mist Ball ---------------- */

const drawMistBall = (ctx: Ctx, a: Attack, t: number) => {
  const r = Math.round(radiusOf(a))
  // A trail of down behind it.
  if (a.motion.kind === 'linear') {
    const sp = Math.hypot(a.motion.vx, a.motion.vy) || 1
    const ux = a.motion.vx / sp
    const uy = a.motion.vy / sp
    for (let i = 1; i <= 6; i++) {
      const d = i * 4 + ((t * 30) % 4)
      ctx.globalAlpha = 0.6 - i * 0.08
      px(ctx, a.x - ux * d + Math.sin(t * 9 + i) * 2, a.y - uy * d + Math.cos(t * 7 + i) * 2, i % 2 ? '#ffffff' : '#f8c8d8', 2, 2)
    }
  }
  ctx.globalAlpha = 0.35
  blitEllipse(ctx, r + 3, r + 3, '#f8d8e8', a.x, a.y)
  ctx.globalAlpha = 1
  blitEllipse(ctx, r, r, '#f8c8d8', a.x, a.y)
  blitEllipse(ctx, r - 2, r - 2, '#ffffff', a.x - 1, a.y - 1)
  // Latias's red swirl turning inside.
  for (let i = 0; i < 9; i++) {
    const ang = t * 6 + i * 0.75
    const d = 1 + i * (r - 2) / 9
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, i > 5 ? '#f87888' : '#e04050')
  }
  px(ctx, a.x - r / 2, a.y - r / 2, '#ffffff', 2, 1)
}

/** The mist: soft puffs drifting over the spot, glinting red now and then. */
const drawMistCloud = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = Math.min(clamp01(a.age / 0.25), fadeOut(a, 0.6))
  const grow = 0.6 + 0.4 * clamp01(a.age / 0.35)
  for (let i = 0; i < 7; i++) {
    const ang = hash2(a.id, i) * TAU + t * 0.6 * (i % 2 ? 1 : -1)
    const d = r * 0.45 * grow * (0.4 + hash2(a.id, i, 1) * 0.6)
    const pr = Math.round(r * grow * (0.35 + hash2(a.id, i, 2) * 0.2))
    ctx.globalAlpha = 0.2 * k
    blitEllipse(ctx, pr, Math.max(1, Math.round(pr * 0.6)), i % 3 === 0 ? '#f8d0e0' : '#ffffff', a.x + Math.cos(ang) * d, a.y - 6 + Math.sin(ang) * d * 0.5)
  }
  ctx.globalAlpha = 0.7 * k
  dashedRing(ctx, a.x, a.y - 4, r * grow, t * 2, ['#ffffff', '#f8c8d8'], 0.35, 0.5)
  for (let i = 0; i < 4; i++) {
    if ((Math.floor(t * 6) + i + a.id) % 5 !== 0) continue
    twinkle(ctx, a.x + (hash2(a.id, i, 5) - 0.5) * r * 1.4, a.y - 6 + (hash2(a.id, i, 6) - 0.5) * r * 0.6, 1, '#e04050')
  }
  ctx.globalAlpha = 1
}

/* ---------------- Latios: Luster Purge ---------------- */

const drawLusterBeam = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  if (a.motion.kind !== 'orbit') return
  const p = ownerOf(g, a.owner)
  const ox = p.x
  const oy = p.y - 8
  const length = a.memo
  const angle = a.motion.angle
  const spin = a.motion.spin
  const pulse = Math.floor(t * 30) % 2
  // The swept arc glows behind the beam for a moment.
  for (let j = 1; j <= 5; j++) {
    const back = angle - spin * j * 0.025
    ctx.globalAlpha = 0.35 - j * 0.06
    thickLine(ctx, ox, oy, ox + Math.cos(back) * length, oy + Math.sin(back) * length, 3, '#80b0f8')
  }
  ctx.globalAlpha = a.age > a.ttl - 0.12 ? fadeOut(a, 0.12) : 1
  const ex = ox + Math.cos(angle) * length
  const ey = oy + Math.sin(angle) * length
  const w = 9 + pulse
  thickLine(ctx, ox, oy, ex, ey, w + 2, '#2038a0')
  thickLine(ctx, ox, oy, ex, ey, w, '#4878e0')
  thickLine(ctx, ox, oy, ex, ey, w - 4, '#a8d0f8')
  thickLine(ctx, ox, oy, ex, ey, Math.max(1, w - 7), '#ffffff')
  // Sparks streaming down the beam.
  for (let i = 0; i < 8; i++) {
    const d = ((t * 380 + i * (length / 8)) % length)
    const side = Math.sin(i * 2.3 + t * 20) * (w / 2 + 2)
    px(ctx, ox + Math.cos(angle) * d - Math.sin(angle) * side, oy + Math.sin(angle) * d + Math.cos(angle) * side, '#ffffff')
  }
  blitEllipse(ctx, 7 + pulse, 7 + pulse, '#a8d0f8', ox, oy)
  blitEllipse(ctx, 4, 4, '#ffffff', ox, oy)
  twinkle(ctx, ox, oy, 9, '#ffffff')
  blitEllipse(ctx, 5, 5, '#ffffff', ex, ey)
  ctx.globalAlpha = 1
}

/* ---------------- Deoxys: Psycho Boost ---------------- */

const drawBoostCore = (ctx: Ctx, a: Attack, t: number) => {
  const k = clamp01(a.age / 0.3)
  ctx.globalAlpha = fadeOut(a, 0.15)
  const r = 8 + Math.round(k * 8) + (Math.floor(t * 20) % 2)
  blitEllipse(ctx, r + 4, r + 4, 'rgba(248,120,48,0.25)', a.x, a.y)
  blitEllipse(ctx, r - 2, r - 2, 'rgba(176,80,216,0.35)', a.x, a.y)
  // A double helix winding around the core: orange and teal strands.
  for (let i = 0; i < 40; i++) {
    const f = i / 39
    const ang = f * TAU * 2 + t * 9
    const y = a.y - 18 + f * 36
    const front = Math.cos(ang) > 0
    px(ctx, a.x + Math.sin(ang) * (r + 3), y, front ? '#f87830' : '#a84010', 2, 2)
    px(ctx, a.x - Math.sin(ang) * (r + 3), y, !front ? '#58e0c8' : '#287868', 2, 2)
    if (i % 5 === 0) thickLine(ctx, a.x + Math.sin(ang) * (r + 3), y, a.x - Math.sin(ang) * (r + 3), y, 1, 'rgba(248,240,255,0.5)')
  }
  // Energy drawn in from all around.
  for (let i = 0; i < 12; i++) {
    const ph = 1 - ((t * 2 + hash2(a.id, i)) % 1)
    const ang = hash2(a.id, i, 1) * TAU
    px(ctx, a.x + Math.cos(ang) * ph * 44, a.y + Math.sin(ang) * ph * 26, i % 2 ? '#f87830' : '#58e0c8', 2, 2)
  }
  blitRotated(ctx, LEGEND_FX.core(), a.x, a.y, 0, 2)
  ctx.globalAlpha = 1
}

const drawBoostComet = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind === 'follow') {
    // Waiting in orbit around the core, pulsing.
    blitEllipse(ctx, 3 + (Math.floor(t * 16 + a.id) % 2), 3, 'rgba(248,192,112,0.6)', a.x, a.y)
    return blitCentered(ctx, LEGEND_FX.comet(), a.x, a.y)
  }
  if (m.kind !== 'homing') return
  const sp = Math.hypot(m.vx, m.vy) || 1
  const ux = m.vx / sp
  const uy = m.vy / sp
  for (let d = 2; d < 22; d++) {
    const w = Math.sin(d * 0.55 - t * 26) * (1 + d * 0.12)
    px(ctx, a.x - ux * d - uy * w, a.y - uy * d + ux * w, d < 12 ? '#f87830' : '#a84010')
    px(ctx, a.x - ux * d + uy * w, a.y - uy * d - ux * w, d < 12 ? '#58e0c8' : '#287868')
  }
  blitEllipse(ctx, 5, 5, 'rgba(248,160,80,0.45)', a.x, a.y)
  blitCentered(ctx, LEGEND_FX.comet(), a.x, a.y)
}

const drawBoostBurst = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = a.age / a.ttl
  if (a.age < 0.05) {
    blitEllipse(ctx, Math.round(r * 0.7), Math.round(r * 0.7), '#ffffff', a.x, a.y)
    return
  }
  ctx.globalAlpha = 1 - k
  const rr = r * (0.4 + 0.7 * Math.sqrt(k))
  band(ctx, a.x, a.y, rr, 3, '#f87830')
  band(ctx, a.x, a.y, rr * 0.7, 2, '#58e0c8')
  spokes(ctx, a.x, a.y, rr * 0.3, rr * 1.15, 10, ['#ffffff', '#f8c070', '#f87830'], a.id)
  ctx.globalAlpha = 1
}

/* ---------------- Jirachi: Wish ---------------- */

/** Jirachi's star over the player: it pops in with three blue wish tags and sends sparkles up to the sky. */
const drawWishStar = (ctx: Ctx, a: Attack, t: number) => {
  const pop = clamp01(a.age / 0.12)
  ctx.globalAlpha = fadeOut(a, 0.2)
  const bob = Math.round(Math.sin(t * 6) * 1.5)
  blitEllipse(ctx, Math.round(9 * pop), Math.round(9 * pop), 'rgba(248,224,80,0.35)', a.x, a.y + bob)
  for (let i = 0; i < 3; i++) {
    const x = a.x + (i - 1) * 5
    const sway = Math.round(Math.sin(t * 8 + i) * 1.5)
    px(ctx, x + sway, a.y + 6 + bob, '#3878c8', 3, 5)
    px(ctx, x + sway, a.y + 6 + bob, '#a8d8f8', 3, 1)
  }
  if (pop > 0.5) blitRotated(ctx, LEGEND_FX.star(), a.x, a.y + bob, Math.sin(t * 3) * 0.2, 2)
  for (let i = 0; i < 6; i++) {
    const ph = (t * 1.5 + hash2(a.id, i)) % 1
    twinkle(ctx, a.x + (hash2(a.id, i, 1) - 0.5) * 30, a.y - ph * 60, ph < 0.4 ? 1 : 0, i % 2 ? '#ffffff' : '#f8e050')
  }
  ctx.globalAlpha = 1
}

/** A wishing star on its way down, trailing sparkles, and a little twinkling ring where it will land. */
const drawWishFall = (ctx: Ctx, a: Attack, t: number, ground: boolean) => {
  const k = clamp01(a.age / a.ttl)
  const r = radiusOf(a)
  if (ground) {
    ctx.globalAlpha = 0.3 + 0.6 * k
    dashedRing(ctx, a.x, a.y, r * (1.2 - 0.4 * k), t * 8, ['#f8e050', '#ffffff'], 0.6, 0.5)
    ctx.globalAlpha = 1
    return
  }
  const e = k * k
  const dx = a.flip ? 50 : -50
  const sx = a.x + dx * (1 - e)
  const sy = a.y - 8 - 200 * (1 - e)
  const n = Math.hypot(dx, 200)
  const ux = -dx / n
  const uy = 200 / n
  for (let d = 4; d < 44; d += 1) {
    const c = d < 12 ? '#ffffff' : d < 26 ? '#f8e050' : '#a8d8f8'
    const w = d < 12 ? 3 : d < 26 ? 2 : 1
    if (d > 26 && (d + Math.floor(t * 30)) % 3 === 0) continue
    px(ctx, sx - ux * d + Math.sin(d * 0.5 + t * 20) * 1.5 - 1, sy - uy * d - 1, c, w, w)
  }
  blitEllipse(ctx, 7, 7, 'rgba(248,240,160,0.5)', sx, sy)
  blitRotated(ctx, LEGEND_FX.star(), sx, sy, t * 8 + a.id, 2)
}

const drawWishBurst = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = a.age / a.ttl
  ctx.globalAlpha = 1 - k
  if (a.age < 0.07) {
    blitEllipse(ctx, Math.round(r * 1.1), Math.round(r * 0.8), 'rgba(255,251,224,0.9)', a.x, a.y - 6)
    blitEllipse(ctx, Math.round(r * 0.5), Math.round(r * 0.4), '#ffffff', a.x, a.y - 6)
  }
  spokes(ctx, a.x, a.y - 6, r * 0.2, r * (1 + k * 0.6), 12, ['#ffffff', '#f8e050', '#f8b030'], a.id + k, 0.8)
  band(ctx, a.x, a.y - 2, r * (0.5 + k * 0.9), 2, '#f8e050', 0.5)
  band(ctx, a.x, a.y - 2, r * (0.4 + k * 0.9), 1, '#a8d8f8', 0.5)
  const star = LEGEND_FX.star()
  for (let i = 0; i < 5; i++) {
    const ang = hash2(a.id, i) * TAU
    const d = r * (0.4 + k * 1.2)
    const x = a.x + Math.cos(ang) * d
    const y = a.y - 6 + Math.sin(ang) * d * 0.6 - k * 12
    if (i % 2 === 0) blitCentered(ctx, star, x, y)
    else twinkle(ctx, x, y, 2, '#ffffff')
  }
  ctx.globalAlpha = 1
}

/* ---------------- Mew: Ancient Power ---------------- */

const drawAncientRock = (ctx: Ctx, g: Game, a: Attack, t: number, ground: boolean) => {
  const waiting = a.motion.kind === 'follow'
  const rise = clamp01(a.age / Math.max(0.01, a.memo > 0 ? a.memo : 0.5))
  const frames = LEGEND_FX.rock()
  const rock = frames[a.flip ? 1 : 0]!
  const scale = 2
  if (ground) {
    if (!waiting) return
    // Dust and a crack where the stone tore out of the ground.
    ctx.globalAlpha = 0.7 * (1 - rise * 0.6)
    const p = ownerOf(g, a.owner)
    blitEllipse(ctx, 7, 3, '#806848', a.x, p.y + 2 + (a.y - p.y + 10) * 0.4)
    ctx.globalAlpha = 1
    return
  }
  if (waiting) {
    // Rising out of the ground, wrapped in Mew's pink glow.
    const lift = Math.round((1 - rise) * 16)
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 12 + a.id)
    blitEllipse(ctx, 11, 11, '#f8a8d8', a.x, a.y + lift)
    ctx.globalAlpha = 1
    dashedRing(ctx, a.x, a.y + lift, 12, t * 6 + a.id, ['#f8a8d8', '#ffffff'], 0.5)
    blitRotated(ctx, rock, a.x, a.y + lift, Math.sin(t * 4 + a.id) * 0.3, scale)
    return
  }
  // In flight: a pink streak behind the tumbling stone.
  const m = a.motion
  if (m.kind === 'linear') {
    const sp = Math.hypot(m.vx, m.vy) || 1
    for (let d = 4; d < 26; d++) {
      ctx.globalAlpha = 0.8 - d * 0.03
      px(ctx, a.x - (m.vx / sp) * d - 1, a.y - (m.vy / sp) * d - 1, d % 4 === 0 ? '#ffffff' : '#f8a8d8', d < 12 ? 3 : 2, d < 12 ? 3 : 2)
    }
    ctx.globalAlpha = 1
  }
  blitRotated(ctx, rock, a.x, a.y, a.age * 9, scale)
}

/** While Ancient Power's raise lasts, a pink and gold aura shimmers up around `g`'s player (`draw.ts` draws it for each player). */
export const drawAncientAura = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const buff = p.moveBuffs.find((b) => b.move === 'ancientPower')
  if (!buff) return
  ctx.globalAlpha = buff.left < 1 && Math.floor(t * 12) % 2 === 0 ? 0.3 : 0.7
  dashedRing(ctx, p.x, p.y - 2, 14, t * 5, ['#f8a8d8', '#f8d030'], 0.5, 0.4)
  for (let i = 0; i < 5; i++) {
    const ph = (t * 1.2 + i * 0.2) % 1
    px(ctx, p.x + Math.sin(i * 2.1 + t) * 11, p.y - 2 - ph * 26, i % 2 ? '#f8a8d8' : '#f8e078')
  }
  ctx.globalAlpha = 1
}

/* ---------------- Celebi: Magical Leaf ---------------- */

const LEAF_GLOW = ['#f8f8a0', '#a8f0c8', '#f8b8e8', '#c8f8ff'] as const

const drawMagicalLeaf = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const frames = LEGEND_FX.leaf()
  const leaf = frames[Math.floor(t * 8 + a.id) % 2]!
  const glow = LEAF_GLOW[Math.floor(t * 10 + a.id) % LEAF_GLOW.length]!
  if (m.kind === 'follow') {
    // Opening into the ring and twirling in place, glowing.
    const k = clamp01(a.age / 0.15)
    const x = a.x * k + (a.x - m.ox) * (1 - k)
    const y = a.y * k + (a.y - m.oy - 10) * (1 - k)
    blitEllipse(ctx, 7, 7, 'rgba(200,255,160,0.35)', x, y)
    twinkle(ctx, x, y, 5, glow)
    return blitRotated(ctx, leaf, x, y, t * 10 + a.id, 2)
  }
  if (m.kind !== 'homing') return
  const sp = Math.hypot(m.vx, m.vy) || 1
  for (let i = 1; i <= 8; i++) {
    const w = i < 4 ? 2 : 1
    px(ctx, a.x - (m.vx / sp) * i * 3 - 1, a.y - (m.vy / sp) * i * 3 - 1, LEAF_GLOW[(i + a.id + Math.floor(t * 12)) % LEAF_GLOW.length]!, w, w)
  }
  blitEllipse(ctx, 6, 6, 'rgba(200,255,160,0.3)', a.x, a.y)
  twinkle(ctx, a.x, a.y, 3, glow)
  blitRotated(ctx, leaf, a.x, a.y, Math.atan2(m.vy, m.vx), 2)
}

/* ---------------- Darkrai: Dark Void ---------------- */

const VOID_DARK = ['#08040e', '#1c1030', '#3a2468', '#5838a0'] as const

/** A ball of darkness floating to its crowd, wisps of night trailing off it and a cyan glint in its heart (Darkrai's eye). */
const drawVoidOrb = (ctx: Ctx, a: Attack, t: number) => {
  if (a.motion.kind === 'linear') {
    const sp = Math.hypot(a.motion.vx, a.motion.vy) || 1
    const ux = a.motion.vx / sp
    const uy = a.motion.vy / sp
    for (let i = 1; i <= 7; i++) {
      const d = i * 3 + ((t * 40) % 3)
      ctx.globalAlpha = 0.7 - i * 0.08
      px(ctx, a.x - ux * d + Math.sin(t * 11 + i) * 2, a.y - uy * d + Math.cos(t * 9 + i) * 2, VOID_DARK[i % 3 + 1]!, 2, 2)
    }
  }
  const pulse = Math.floor(t * 14 + a.id) % 2
  ctx.globalAlpha = 0.35
  blitEllipse(ctx, 9 + pulse, 9 + pulse, '#5838a0', a.x, a.y)
  ctx.globalAlpha = 1
  blitEllipse(ctx, 6, 6, '#3a2468', a.x, a.y)
  blitEllipse(ctx, 5, 5, '#08040e', a.x, a.y)
  band(ctx, a.x, a.y, 6, 1, '#c83858')
  px(ctx, a.x - 1, a.y - 1, '#58e8f0', 2, 1)
  px(ctx, a.x + 1, a.y - 2, '#ffffff')
}

/** The void opening: a disc of night swelling to its full size, a crimson rim and tendrils lashing out of it. */
const drawVoidBurst = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const full = a.memo || r
  const k = clamp01(a.age / Math.max(0.01, a.ttl))
  ctx.globalAlpha = 0.55 * (1 - k * 0.5)
  blitEllipse(ctx, Math.round(r), Math.round(r * 0.6), '#08040e', a.x, a.y)
  ctx.globalAlpha = 1 - k * 0.6
  band(ctx, a.x, a.y, r, 2, '#5838a0', 0.6)
  band(ctx, a.x, a.y, Math.max(1, r - 3), 1, '#c83858', 0.6)
  spokes(ctx, a.x, a.y, r * 0.35, Math.min(full * 1.1, r * 1.15), 10, ['#1c1030', '#3a2468', '#5838a0'], a.id + t * 1.5, 0.6)
  if (a.age < 0.08) blitEllipse(ctx, 6, 4, '#58e8f0', a.x, a.y)
  ctx.globalAlpha = 1
}

/** What the void leaves on the ground while its sleep holds: a pool of night, wisps curling up and an eye glinting now and then. */
const drawVoidPool = (ctx: Ctx, a: Attack, t: number) => {
  const r = a.memo || radiusOf(a)
  const k = Math.min(clamp01(a.age / 0.3), fadeOut(a, 0.8))
  ctx.globalAlpha = 0.45 * k
  blitEllipse(ctx, Math.round(r), Math.round(r * 0.5), '#2a1850', a.x, a.y)
  ctx.globalAlpha = 0.55 * k
  blitEllipse(ctx, Math.round(r * 0.72), Math.round(r * 0.36), '#08040e', a.x, a.y)
  ctx.globalAlpha = 0.8 * k
  dashedRing(ctx, a.x, a.y, r, t * 1.2 + a.id, ['#5838a0', '#3a2468'], 0.4, 0.5)
  const wisps = detail.lean ? 4 : 8
  for (let i = 0; i < wisps; i++) {
    const ph = (t * 0.7 + hash2(a.id, i)) % 1
    const ang = hash2(a.id, i, 1) * TAU
    const d = r * 0.8 * hash2(a.id, i, 2)
    ctx.globalAlpha = k * (1 - ph) * 0.8
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.5 - ph * 14, VOID_DARK[1 + (i % 3)]!, 2, 2)
  }
  if ((Math.floor(t * 3) + a.id) % 4 === 0) {
    ctx.globalAlpha = k
    px(ctx, a.x - 2, a.y - 1, '#58e8f0', 2, 1)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Passes ---------------- */

/** Ground layer (under the Pokémon). */
export const drawLegendaryGround = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'whirlwind':
        drawWhirlGround(ctx, a, t)
        break
      case 'sacredFlame':
        drawSacredFlame(ctx, a, t)
        break
      case 'hotSand':
        drawHotSand(ctx, a, t)
        break
      case 'ascentComet':
        drawAscentComet(ctx, a, t, true)
        break
      case 'ascentImpact':
        drawAscentImpact(ctx, a, true)
        break
      case 'wishFall':
        drawWishFall(ctx, a, t, true)
        break
      case 'ancientRock':
        drawAncientRock(ctx, g, a, t, true)
        break
      case 'voidPool':
        drawVoidPool(ctx, a, t)
        break
    }
  }
}

/** Air layer (over the Pokémon). */
export const drawLegendaryAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  // The veil goes first, so the clock and the rings shine over it (and the stopped foes' clocks, `drawStoppedFoes`).
  for (const a of g.attacks) if (a.age >= 0 && a.visual === 'timeClock') drawTimeVeil(ctx, g, a)
  for (const a of g.attacks) {
    if (a.age < 0) continue
    // Rings and beams span the screen: they draw even when their center is off it.
    switch (a.visual) {
      case 'originRing':
        drawOriginRing(ctx, a, t)
        continue
      case 'timeRing':
        drawTimeRing(ctx, a)
        continue
      case 'timeSnap':
        drawTimeSnap(ctx, a)
        continue
      case 'lusterBeam':
        drawLusterBeam(ctx, g, a, t)
        continue
      case 'originBeam':
        drawOriginBeam(ctx, a)
        continue
      case 'ascentRise':
        drawAscentRise(ctx, g, a)
        continue
    }
    if (!visible(a.x, a.y, 120)) continue
    switch (a.visual) {
      case 'whirlwind':
        drawWhirlwind(ctx, a, t)
        break
      case 'whirlBurst':
        drawWhirlBurst(ctx, a)
        break
      case 'phoenix':
        drawPhoenix(ctx, a, t)
        break
      case 'sandWave':
        drawSandWave(ctx, a, t)
        break
      case 'ascentComet':
        drawAscentComet(ctx, a, t, false)
        break
      case 'ascentImpact':
        drawAscentImpact(ctx, a, false)
        break
      case 'timeClock':
        drawTimeClock(ctx, g, a)
        break
      case 'mistBall':
        drawMistBall(ctx, a, t)
        break
      case 'mistCloud':
        drawMistCloud(ctx, a, t)
        break
      case 'boostCore':
        drawBoostCore(ctx, a, t)
        break
      case 'boostComet':
        drawBoostComet(ctx, a, t)
        break
      case 'boostBurst':
        drawBoostBurst(ctx, a)
        break
      case 'wishStar':
        drawWishStar(ctx, a, t)
        break
      case 'wishFall':
        drawWishFall(ctx, a, t, false)
        break
      case 'wishBurst':
        drawWishBurst(ctx, a)
        break
      case 'ancientRock':
        drawAncientRock(ctx, g, a, t, false)
        break
      case 'magicalLeaf':
        drawMagicalLeaf(ctx, a, t)
        break
      case 'voidOrb':
        drawVoidOrb(ctx, a, t)
        break
      case 'voidBurst':
        drawVoidBurst(ctx, a, t)
        break
    }
  }
}
