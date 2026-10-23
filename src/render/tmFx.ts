import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { TYPE_COLORS } from '../data/types'
import { walkedSince } from '../game/kitRules'
import { MOVES } from '../game/moves'
import { AURORA, dischargeCharge, ICE_BEAM } from '../game/tmMoves'
import type { Attack, Game, Pickup } from '../game/types'
import { tmDisc, TM_FX } from './tmArt'
import { dashedRing } from './strokes'
import { localPlayer, ownerOf } from '../game/players'

/**
 * Art of the TM moves (`game/tmMoves.ts`) and the TM discs on the ground.
 * `draw.ts` calls the passes once a frame like the verb moves': `drawTmGround`
 * under the Pokémon (shadows, lava pools, dust), `drawTmAir` over them
 * (rocks, beams, bubbles, fangs, orbs) and `drawTmPlayer` for what a move
 * leaves on a player (Discharge's charge, Meteor Beam's boost, the iron body),
 * drawn for each player from their copy of the game.
 * Everything snaps to whole pixels; flicker comes from `hash2`, never from Math.random.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/** Square-brush line from (x0, y0) to (x1, y1), `w` px thick. */
const thickLine = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
  const half = Math.floor(w / 2)
  ctx.fillStyle = color
  for (let i = 0; i <= n; i++) {
    const k = i / n
    ctx.fillRect(Math.round(x0 + (x1 - x0) * k) - half, Math.round(y0 + (y1 - y0) * k) - half, w, w)
  }
}

/** A jagged bolt from (x0, y0) to (x1, y1): `kinks` zigzags, seeded by `seed` so it holds for a frame or two. */
const zigzag = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, kinks: number, seed: number, colors: readonly [string, string], width = 2) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  let ax = x0
  let ay = y0
  for (let i = 1; i <= kinks; i++) {
    const k = i / kinks
    const off = i === kinks ? 0 : (hash2(seed, i) - 0.5) * 7
    const bx = x0 + dx * k + nx * off
    const by = y0 + dy * k + ny * off
    thickLine(ctx, ax, ay, bx, by, width, colors[0])
    thickLine(ctx, ax, ay, bx, by, Math.max(1, width - 2), colors[1])
    ax = bx
    ay = by
  }
}

/** Eight thin rays around (x, y), `len` px long: a sparkle. */
const spokes = (ctx: Ctx, x: number, y: number, len: number, colors: readonly string[], rot: number) => {
  for (let i = 0; i < 8; i++) {
    const a = rot + (i / 8) * TAU
    const l = i % 2 === 0 ? len : len * 0.55
    for (let d = 1; d <= l; d++) px(ctx, x + Math.cos(a) * d, y + Math.sin(a) * d, colors[Math.min(colors.length - 1, Math.floor((d / (l + 1)) * colors.length))]!)
  }
}

const RAINBOW = ['#f85888', '#f8a030', '#f8e030', '#78d850', '#58c8f8', '#a070f8'] as const
const LAVA = ['#401008', '#a82010', '#f06018', '#f8b030', '#fff0a0'] as const

/* ---------------- Ground ---------------- */

const drawRockShadow = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    blitEllipse(ctx, Math.max(1, Math.round(r * (0.35 + 0.5 * k))), Math.max(1, Math.round(r * 0.4 * (0.35 + 0.5 * k))), 'rgba(24,16,8,0.38)', a.x, a.y + 3)
    return
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - e)
  blitEllipse(ctx, Math.round(r * 0.8), Math.max(1, Math.round(r * 0.32)), 'rgba(24,16,8,0.3)', a.x, a.y + 3)
  dashedRing(ctx, a.x, a.y + 3, r * (0.8 + e * 0.8), a.id, ['#7a6040', '#b89868', '#e0d0a8'], 0.6, 0.45)
  ctx.globalAlpha = 1
}

const drawLavaPool = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < a.activeFrom) return
  const r = radiusOf(a)
  const open = Math.min(1, (a.age - a.activeFrom) / 0.15)
  const cool = 1 - fadeOut(a, 0.8)
  const rx = Math.max(2, Math.round(r * open))
  const ry = Math.max(1, Math.round(r * 0.5 * open))
  ctx.globalAlpha = fadeOut(a, 0.35)
  blitEllipse(ctx, rx + 1, ry + 1, '#301008', a.x, a.y)
  blitEllipse(ctx, rx, ry, cool > 0.5 ? '#702010' : '#c83010', a.x, a.y)
  if (rx > 3) blitEllipse(ctx, rx - 2, Math.max(1, ry - 1), cool > 0.5 ? '#a83818' : '#f06818', a.x, a.y)
  if (rx > 5 && cool < 0.6) blitEllipse(ctx, Math.round(rx * 0.45), Math.max(1, Math.round(ry * 0.4)), '#f8b030', a.x - 1, a.y - 1)
  // Bubbles pop here and there.
  for (let i = 0; i < 4; i++) {
    const ph = (t * 1.6 + hash2(a.id, i)) % 1
    if (ph > 0.55) continue
    const bx = a.x + (hash2(a.id, i, 1) - 0.5) * rx * 1.4
    const by = a.y + (hash2(a.id, i, 2) - 0.5) * ry * 1.2
    px(ctx, bx, by - ph * 3, ph < 0.4 ? '#fff0a0' : '#f8b030', ph < 0.25 ? 2 : 1, 1)
  }
  ctx.globalAlpha = 1
}

const drawDischargeGround = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.2) * 0.8
  blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.4)), 'rgba(248,216,48,0.18)', a.x, a.y + 6)
  dashedRing(ctx, a.x, a.y + 6, r, a.age * 9, ['#f8d030', '#fff8a0'], 0.7, 0.4)
  ctx.globalAlpha = 1
}

const drawYawnGround = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    blitEllipse(ctx, Math.max(1, Math.round(3 + k * r * 0.4)), Math.max(1, Math.round(1 + k * 2)), 'rgba(40,32,80,0.28)', a.x, a.y + 6)
    return
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - e)
  dashedRing(ctx, a.x, a.y + 4, r * (0.6 + 0.5 * e), a.id, ['#d8d0ff', '#b0a8f0'], 0.7, 0.45)
  ctx.globalAlpha = 1
}

export const drawTmGround = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'rockSlide':
        drawRockShadow(ctx, a)
        break
      case 'lavaPool':
        drawLavaPool(ctx, a, t)
        break
      case 'lavaPlume': {
        ctx.globalAlpha = fadeOut(a, 0.3) * 0.7
        blitEllipse(ctx, Math.round(radiusOf(a) * 0.8), Math.max(1, Math.round(radiusOf(a) * 0.35)), 'rgba(48,12,4,0.45)', a.x, a.y + 1)
        ctx.globalAlpha = 1
        break
      }
      case 'discharge':
        drawDischargeGround(ctx, a)
        break
      case 'yawn':
        drawYawnGround(ctx, a)
        break
      case 'meteorRise': {
        const k = Math.min(1, a.age / a.ttl)
        ctx.globalAlpha = 1 - k
        dashedRing(ctx, a.x, a.y + 4, 3 + k * 7, a.id, ['#f8d870', '#c89848'], 0.8, 0.45)
        ctx.globalAlpha = 1
        break
      }
    }
  }
}

/* ---------------- Air ---------------- */

const drawRock = (ctx: Ctx, a: Attack) => {
  const rocks = TM_FX.rocks()
  const rock = rocks[Math.min(rocks.length - 1, a.memo)]!
  if (a.age < a.activeFrom) {
    // Tumbles down from above the screen, speeding up, with a few pebbles around it.
    const k = a.age / a.activeFrom
    const drop = Math.round(86 * (1 - k * k))
    const x = a.x + Math.round((1 - k) * 8)
    blitRotated(ctx, rock, x, a.y - 6 - drop, a.age * 9 + a.id)
    for (let i = 0; i < 2; i++) px(ctx, x - 6 + i * 11, a.y - 14 - drop - i * 5, i ? '#a08868' : '#665040', 2, 2)
    return
  }
  // Lands with a hop and a puff of dust, then crumbles away.
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  const hop = Math.round(Math.sin(Math.min(1, e * 2.5) * Math.PI) * 4)
  if (e < 0.55) {
    const puff = e / 0.55
    for (let i = 0; i < 5; i++) {
      const side = i - 2
      const r = Math.max(1, Math.round(2 + puff * 4 - Math.abs(side) * 0.5))
      ctx.globalAlpha = 1 - puff
      blitEllipse(ctx, r, Math.max(1, Math.round(r * 0.7)), i % 2 ? '#d8c8a0' : '#b8a480', a.x + side * (5 + puff * 9), a.y - 1 - puff * 5 + Math.abs(side) * 2)
    }
    ctx.globalAlpha = 1
  }
  ctx.globalAlpha = Math.min(1, (1 - e) * 3)
  blitRotated(ctx, rock, a.x, a.y - 6 - hop, a.id)
  ctx.globalAlpha = 1
  if (e < 0.5) {
    for (let i = 0; i < 6; i++) {
      const ang = Math.PI + (i / 5) * Math.PI
      const d = 5 + e * 24
      px(ctx, a.x + Math.cos(ang) * d, a.y - 2 + Math.sin(ang) * d * 0.5 + e * e * 30, i % 2 ? '#a08868' : '#dccca4', 2, 2)
    }
  }
}

const drawYawnBubble = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  if (a.age < a.activeFrom) {
    // Floats from the mouth to its spot, slowing down, swelling and wobbling.
    const k = a.age / a.activeFrom
    const ease = 1 - (1 - k) * (1 - k)
    const x = a.from.x + (a.x - a.from.x) * ease + Math.sin(k * 9 + a.id) * 3
    const y = a.from.y + (a.y - 12 - a.from.y) * ease - Math.sin(k * Math.PI) * 8
    const br = Math.max(3, Math.round(3 + (r * 0.55 - 3) * ease))
    const wob = Math.round(Math.sin(t * 12 + a.id) * 0.8)
    blitEllipse(ctx, br + wob, br - wob, 'rgba(208,200,255,0.35)', x, y)
    for (let i = 0; i < br * 6; i++) {
      const ang = (i / (br * 6)) * TAU
      px(ctx, x + Math.cos(ang) * (br + wob), y + Math.sin(ang) * (br - wob), i % 7 === 0 ? '#ffffff' : '#b8b0f0')
    }
    px(ctx, x - br * 0.45, y - br * 0.5, '#ffffff', 2, 1)
    px(ctx, x - br * 0.6, y - br * 0.3, '#ffffff')
    // Z's drifting up off it.
    const zed = TM_FX.zed()
    for (let i = 0; i < 2; i++) {
      const ph = (k * 1.4 + i * 0.5) % 1
      ctx.globalAlpha = 1 - ph
      blitCentered(ctx, zed, x + br + 2 + ph * 6, y - br - ph * 12)
    }
    ctx.globalAlpha = 1
    return
  }
  // Pop: a ring of droplets and three Z's flying up.
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - e)
  const rr = r * (0.5 + 0.6 * e)
  for (let i = 0; i < 14; i++) {
    const ang = (i / 14) * TAU + a.id
    px(ctx, a.x + Math.cos(ang) * rr, a.y - 12 + Math.sin(ang) * rr * 0.7, i % 2 ? '#ffffff' : '#d8d0ff', 2, 2)
  }
  const zed = TM_FX.zed()
  for (let i = 0; i < 3; i++) blitCentered(ctx, zed, a.x - 10 + i * 10, a.y - 16 - e * (18 + i * 6))
  ctx.globalAlpha = 1
}

/** Whether `b` is another slice of `a`'s beam: cast together, on the same line. */
const sameBeam = (a: Attack, b: Attack | undefined) =>
  b !== undefined && b.visual === a.visual && b.owner === a.owner && b.age === a.age && b.motion.kind === 'orbit' && a.motion.kind === 'orbit' && b.motion.angle === a.motion.angle

/**
 * Half the gap from slice `i` to its neighbor on the beam, +1 px so they join:
 * the slices are spawned one after the other, and the twin ring spaces its
 * copy wider than the cast (`MOD.twin`). `fallback` for a lone slice.
 */
const sliceHalf = (attacks: readonly Attack[], i: number, fallback: number) => {
  const a = attacks[i]!
  const m = a.motion
  if (m.kind !== 'orbit') return fallback
  const before = attacks[i - 1]
  const n = sameBeam(a, before) ? before : sameBeam(a, attacks[i + 1]) ? attacks[i + 1] : undefined
  return n && n.motion.kind === 'orbit' ? Math.max(5, Math.abs(m.radius - n.motion.radius) / 2 + 1) : fallback
}

/** Beams made of orbit slices (Ice Beam, Aurora Beam), layer by layer over every slice so they join into one. */
const drawBeams = (ctx: Ctx, g: Game, t: number) => {
  for (let layer = 0; layer < 3; layer++) {
    for (let i = 0; i < g.attacks.length; i++) {
      const a = g.attacks[i]!
      const m = a.motion
      if ((a.visual !== 'iceBeam' && a.visual !== 'auroraBeam') || a.age < 0 || m.kind !== 'orbit') continue
      const ice = a.visual === 'iceBeam'
      const p = ownerOf(g, a.owner)
      const r = radiusOf(a)
      const k = a.age / a.ttl
      const w = r * Math.min(1, a.age / 0.05) * Math.min(1, (1 - k) / 0.3 + 0.15)
      const length = (ice ? ICE_BEAM.length : AURORA.length) * (r / (ice ? ICE_BEAM.r : AURORA.r))
      const segments = ice ? ICE_BEAM.segments : AURORA.segments
      const half = sliceHalf(g.attacks, i, Math.max(5, (length - 12) / (segments - 1) / 2 + 1))
      const cx = Math.cos(m.angle)
      const cy = Math.sin(m.angle)
      const x0 = p.x + cx * (m.radius - half)
      const y0 = p.y - 8 + cy * (m.radius - half)
      const x1 = p.x + cx * (m.radius + half)
      const y1 = p.y - 8 + cy * (m.radius + half)
      if (!ice) {
        // Aurora: six bands running along the beam, as wide as its hitbox, a white core over them.
        if (layer === 0) {
          const band = Math.max(1, Math.round(w / 3))
          RAINBOW.forEach((c, i) => {
            const off = (i - 2.5) * band
            thickLine(ctx, x0 - cy * off, y0 + cx * off, x1 - cy * off, y1 + cx * off, band + 1, c)
          })
        } else if (layer === 2) {
          thickLine(ctx, x0, y0, x1, y1, Math.max(1, Math.round(w * 0.4)), '#ffffff')
          if (a.flip) spokes(ctx, a.x, a.y, Math.round(w * 1.4) + 4, ['#ffffff', RAINBOW[Math.floor(t * 12) % 6]!, RAINBOW[(Math.floor(t * 12) + 3) % 6]!], t * 5)
        }
        continue
      }
      const color = layer === 0 ? 'rgba(88,168,232,0.6)' : layer === 1 ? '#c8ecff' : '#ffffff'
      const thick = layer === 0 ? w * 1.7 + (Math.floor(t * 30 + m.radius) % 2) : layer === 1 ? w : w * 0.4
      thickLine(ctx, x0, y0, x1, y1, Math.max(1, Math.round(thick)), color)
      if (layer !== 2) continue
      // Ice crystals grow off the beam, alternating sides.
      const side = Math.round(m.radius / 10) % 2 === 0 ? 1 : -1
      const grow = Math.min(1, a.age / 0.15)
      const bx = a.x - cy * side * (w + 1)
      const by = a.y + cx * side * (w + 1)
      for (let d = 0; d < Math.round(3 * grow); d++) px(ctx, bx - cy * side * d - cx * d * 0.5, by + cx * side * d - cy * d * 0.5, d === 0 ? '#ffffff' : '#c8ecff', 2, 2)
      if (a.flip) {
        spokes(ctx, a.x, a.y, Math.round(w * 1.4) + 5, ['#ffffff', '#c8ecff', '#78c8f0'], t * 4)
        blitEllipse(ctx, Math.round(w) + 2, Math.round(w) + 2, '#e8f8ff', a.x, a.y)
      }
    }
  }
}

const drawDischarge = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const fade = fadeOut(a, 0.18)
  const seed = a.id * 7 + Math.floor(t * 24)
  // The flash at the core, then bolts lashing out to the ring.
  if (a.age < 0.1) {
    blitEllipse(ctx, 12, 12, 'rgba(255,248,160,0.55)', a.x, a.y)
    blitEllipse(ctx, 7, 7, '#ffffff', a.x, a.y)
  }
  ctx.globalAlpha = fade
  const bolts = 6 + Math.round(a.memo * 6)
  for (let i = 0; i < bolts; i++) {
    const ang = (i / bolts) * TAU + hash2(a.id, i) * 0.5
    const ex = a.x + Math.cos(ang) * r
    const ey = a.y + Math.sin(ang) * r * 0.85
    zigzag(ctx, a.x, a.y, ex, ey, 4, seed + i, ['#f8c020', '#ffffff'], 3)
    // A fork off the middle of every other bolt.
    if (i % 2 === 0) {
      const mx = a.x + Math.cos(ang) * r * 0.55
      const my = a.y + Math.sin(ang) * r * 0.47
      const side = ang + (hash2(seed, i, 3) > 0.5 ? 0.7 : -0.7)
      zigzag(ctx, mx, my, mx + Math.cos(side) * r * 0.35, my + Math.sin(side) * r * 0.3, 2, seed + i + 50, ['#f8d030', '#fff8c0'])
    }
  }
  ringPx(ctx, a.x, a.y, r, r * 0.85, ['#f8d030', '#ffffff'], t * 6)
  blitEllipse(ctx, 4 + Math.round(a.memo * 3), 4 + Math.round(a.memo * 3), '#fff8c0', a.x, a.y)
  ctx.globalAlpha = 1
}

/** A solid 2-px ring (outer color, inner color), squashed to `ry`, with gaps turning by `rot`. */
const ringPx = (ctx: Ctx, x: number, y: number, rx: number, ry: number, colors: readonly [string, string], rot: number) => {
  const steps = Math.ceil(rx * TAU * 1.4)
  for (let i = 0; i < steps; i++) {
    const ang = (i / steps) * TAU
    if (Math.floor((ang + rot) * 3) % 5 === 0) continue
    px(ctx, x + Math.cos(ang) * rx, y + Math.sin(ang) * ry, colors[0])
    px(ctx, x + Math.cos(ang) * (rx - 1), y + Math.sin(ang) * (ry - 1), colors[1])
  }
}

const HEAT = ['#801008', '#c02010', '#f06018', '#f8a030', '#f8d860', '#fff8d0'] as const

const drawHeatWave = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind !== 'linear') return
  const r = radiusOf(a)
  const dir = Math.atan2(m.vy, m.vx)
  const nx = -Math.sin(dir)
  const ny = Math.cos(dir)
  const fx = Math.cos(dir)
  const fy = Math.sin(dir)
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.35)
  const span = Math.round(r * 1.25)
  // Each slice is a curved band: white-hot at the front edge, darker behind, with heat shimmering off it.
  for (let s = -span; s <= span; s++) {
    const bow = -((s / span) ** 2) * 2
    const wav = Math.sin(t * 18 + s * 0.6 + a.id) * 1
    const x = a.x + nx * s + fx * (bow + wav)
    const y = a.y + ny * s + fy * (bow + wav)
    const core = Math.abs(s) < span * 0.7
    for (let d = 0; d < HEAT.length; d++) px(ctx, x - fx * (HEAT.length - 1 - d), y - fy * (HEAT.length - 1 - d), d === HEAT.length - 1 && !core ? HEAT[3] : HEAT[d]!)
    if ((s + Math.floor(t * 20)) % 3 === 0) px(ctx, x - fx * (8 + (s & 3) * 2), y - fy * (8 + (s & 3) * 2), 'rgba(248,176,48,0.55)')
    if ((s * 7 + Math.floor(t * 12)) % 11 === 0) px(ctx, x - fx * (12 + (s & 7)), y - fy * (12 + (s & 7)) - 2, '#f8d860')
  }
  ctx.globalAlpha = 1
}

const drawFang = (ctx: Ctx, a: Attack, t: number) => {
  const top = TM_FX.jawTop()
  const bottom = TM_FX.jawBottom()
  const k = Math.min(1, a.age / a.activeFrom)
  const gap = Math.round(11 * (1 - k * k))
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.15)
  blitCentered(ctx, top, a.x, a.y - 4 - gap)
  blitCentered(ctx, bottom, a.x, a.y + 3 + gap)
  if (a.age >= a.activeFrom) {
    const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
    if (e < 0.6) {
      spokes(ctx, a.x, a.y, 8 + Math.round(e * 8), ['#ffffff', '#fff8a0', '#f8d030'], a.id)
      const seed = a.id * 3 + Math.floor(t * 30)
      for (let i = 0; i < 3; i++) {
        const ang = hash2(a.id, i) * TAU
        zigzag(ctx, a.x, a.y, a.x + Math.cos(ang) * 16, a.y + Math.sin(ang) * 16, 3, seed + i, ['#f8d030', '#ffffff'])
      }
    }
  }
  ctx.globalAlpha = 1
}

const drawGeyser = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = a.age / a.ttl
  const height = Math.round(r * 2.6 * Math.sin(Math.min(1, k * 1.5) * Math.PI))
  const w = Math.max(3, Math.round(r * 0.5))
  // The column, row by row: it bulges and ripples, hotter in the middle.
  for (let row = 0; row < height; row++) {
    const up = row / Math.max(1, height)
    const ww = Math.max(1, Math.round(w * (1.15 - up * 0.55) + Math.sin(row * 0.7 - t * 24 + a.id)))
    const sway = Math.round(Math.sin(row * 0.35 + t * 14 + a.id) * up * 2)
    const x = a.x + sway
    const y = a.y - row
    px(ctx, x - ww - 1, y, LAVA[0], ww * 2 + 3, 1)
    px(ctx, x - ww, y, LAVA[1], ww * 2 + 1, 1)
    px(ctx, x - ww + 1, y, LAVA[2], Math.max(1, ww * 2 - 1), 1)
    px(ctx, x - 1, y, LAVA[3], 3, 1)
    if ((row + Math.floor(t * 30)) % 3 !== 0) px(ctx, x, y, LAVA[4])
  }
  if (height > 2) {
    // A splash crowning it.
    const top = a.y - height
    blitEllipse(ctx, w + 3, 3, LAVA[1], a.x, top)
    blitEllipse(ctx, w + 2, 2, LAVA[3], a.x, top - 1)
    blitEllipse(ctx, Math.max(1, w - 1), 1, LAVA[4], a.x, top - 1)
  }
  // A ring of molten rock at its foot.
  blitEllipse(ctx, w + 4, 3, LAVA[1], a.x, a.y + 1)
  blitEllipse(ctx, w + 2, 2, LAVA[2], a.x, a.y)
  // Molten drops thrown out of it.
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI / 2 + (hash2(a.id, i) - 0.5) * 2.4
    const v = 50 + hash2(a.id, i, 1) * 60
    const tt = a.age
    const x = a.x + Math.cos(ang) * v * tt
    const y = a.y - r * 1.4 + Math.sin(ang) * v * tt + 170 * tt * tt
    if (y > a.y + 4) continue
    px(ctx, x, y, i % 3 === 0 ? LAVA[4] : i % 3 === 1 ? LAVA[3] : LAVA[2], 2, 2)
  }
}

const drawMeteorRise = (ctx: Ctx, a: Attack) => {
  const k = Math.min(1, a.age / a.ttl)
  const rock = TM_FX.meteor()
  blitEllipse(ctx, 5, 5, 'rgba(248,216,112,0.35)', a.x, a.y - 4 - k * 6)
  ctx.globalAlpha = Math.min(1, k * 3)
  blitCentered(ctx, rock, a.x, a.y - k * 10)
  ctx.globalAlpha = 1
  for (let i = 0; i < 3; i++) px(ctx, a.x - 4 + i * 4, a.y + 2 - k * 4, '#a08868')
}

const drawMeteor = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind === 'homing') {
    const len = Math.hypot(m.vx, m.vy) || 1
    for (let i = 1; i <= 4; i++) px(ctx, a.x - (m.vx / len) * i * 4, a.y - (m.vy / len) * i * 4, i === 1 ? '#fff8d0' : '#f8d870', i < 3 ? 2 : 1, i < 3 ? 2 : 1)
  }
  const glow = 7 + (Math.floor(t * 10 + a.id) % 2)
  blitEllipse(ctx, glow, glow, 'rgba(248,216,112,0.35)', a.x, a.y)
  blitRotated(ctx, TM_FX.meteor(), a.x, a.y, a.age * 7)
}

const drawIcyWind = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const r = radiusOf(a)
  const k = a.age / a.ttl
  const dir = m.kind === 'drift' ? Math.atan2(m.vy, m.vx) : 0
  const fx = Math.cos(dir)
  const fy = Math.sin(dir)
  const nx = -fy
  const ny = fx
  ctx.globalAlpha = Math.max(0, 1 - k * k)
  blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.6)), 'rgba(200,236,255,0.28)', a.x, a.y)
  // Two wind strokes curling at their tips, like the "gust" glyph.
  for (let s = 0; s < 2; s++) {
    const off = (s - 0.5) * r * 0.9
    const len = Math.round(r * (1.6 - s * 0.4))
    for (let i = 0; i < len; i++) {
      const d = i - len / 2
      const wave = Math.sin(i * 0.5 + t * 14 + a.memo) * 1.2
      px(ctx, a.x + fx * d + nx * (off + wave), a.y + fy * d + ny * (off + wave), i > len - 4 ? '#ffffff' : '#d8f4ff')
    }
    const tipX = a.x + fx * (len / 2) + nx * off
    const tipY = a.y + fy * (len / 2) + ny * off
    for (let i = 0; i < 4; i++) {
      const ang = dir - Math.PI / 2 + (s ? -1 : 1) * i * 0.7
      px(ctx, tipX + Math.cos(ang) * 2, tipY + Math.sin(ang) * 2, '#ffffff')
    }
  }
  // Snowflakes riding it.
  for (let i = 0; i < 3; i++) {
    const ph = (t * 2 + hash2(a.id, i)) % 1
    const sx = a.x + (hash2(a.id, i, 1) - 0.5) * r * 2
    const sy = a.y + (hash2(a.id, i, 2) - 0.5) * r * 1.4 + ph * 4
    px(ctx, sx, sy, '#ffffff')
    px(ctx, sx - 1, sy, '#98d8f8')
    px(ctx, sx + 1, sy, '#98d8f8')
    px(ctx, sx, sy - 1, '#98d8f8')
    px(ctx, sx, sy + 1, '#98d8f8')
  }
  ctx.globalAlpha = 1
}

const drawIronShard = (ctx: Ctx, a: Attack) => {
  const m = a.motion
  if (m.kind !== 'linear') return
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.2)
  blitRotated(ctx, TM_FX.shard(), a.x, a.y, Math.atan2(m.vy, m.vx), radiusOf(a) > 5 ? 2 : 1)
  ctx.globalAlpha = 1
}

const drawPsyHover = (ctx: Ctx, a: Attack, t: number) => {
  const k = Math.min(1, a.age / a.ttl)
  const r = Math.round(1 + k * 3)
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + t * 6
    const d = (1 - ((k * 2 + i / 6) % 1)) * 12
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, i % 2 ? '#f8b0e0' : '#ffffff')
  }
  blitEllipse(ctx, r + 2, r + 2, 'rgba(248,88,168,0.45)', a.x, a.y)
  blitEllipse(ctx, r, r, '#f878c0', a.x, a.y)
  blitEllipse(ctx, Math.max(1, r - 2), Math.max(1, r - 2), '#ffffff', a.x, a.y)
}

const drawPsystrike = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const r = Math.max(3, Math.round(radiusOf(a) * 0.75))
  const vx = 'vx' in m ? m.vx : 0
  const vy = 'vy' in m ? m.vy : 0
  const len = Math.hypot(vx, vy) || 1
  // A comet tail behind the orb.
  for (let i = 1; i <= 10; i++) {
    const k = i / 10
    const w = Math.max(1, Math.round((1 - k) * r * 1.4))
    px(ctx, a.x - (vx / len) * i * 2.2 - w / 2, a.y - (vy / len) * i * 2.2 - w / 2, k < 0.4 ? '#f878c0' : k < 0.7 ? '#c84898' : 'rgba(160,48,120,0.6)', w, w)
  }
  blitEllipse(ctx, r + 2, r + 2, 'rgba(248,88,168,0.45)', a.x, a.y)
  blitEllipse(ctx, r, r, '#f878c0', a.x, a.y)
  blitEllipse(ctx, Math.max(1, r - 2), Math.max(1, r - 2), '#ffffff', a.x, a.y)
  if (Math.floor(t * 16 + a.id) % 3 === 0) dashedRing(ctx, a.x, a.y, r + 4, t * 8, ['#f8b0e0'], 0.5)
}

export const drawTmAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  drawBeams(ctx, g, t)
  for (const a of g.attacks) {
    if (a.age < 0 || !visible(a.x, a.y, 120)) continue
    switch (a.visual) {
      case 'rockSlide':
        drawRock(ctx, a)
        break
      case 'yawn':
        drawYawnBubble(ctx, a, t)
        break
      case 'discharge':
        drawDischarge(ctx, a, t)
        break
      case 'heatWave':
        drawHeatWave(ctx, a, t)
        break
      case 'thunderFang':
        drawFang(ctx, a, t)
        break
      case 'lavaPlume':
        drawGeyser(ctx, a, t)
        break
      case 'meteorRise':
        drawMeteorRise(ctx, a)
        break
      case 'meteor':
        drawMeteor(ctx, a, t)
        break
      case 'icyWind':
        drawIcyWind(ctx, a, t)
        break
      case 'ironShard':
        drawIronShard(ctx, a)
        break
      case 'psyHover':
        drawPsyHover(ctx, a, t)
        break
      case 'psystrike':
        drawPsystrike(ctx, a, t)
        break
    }
  }
}

/* ---------------- On the player ---------------- */

/** Iron Head's iron body: a plated steel shell with rivets and a glint sweeping across, brighter while the block is up. */
const drawIronBody = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = localPlayer(g)
  const r = radiusOf(a)
  const guarding = p.guard?.move === 'ironHead'
  const cy = p.y - 10
  const ry = r * 0.95
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.3)
  // The clang when it hardens: a ring flies out.
  if (a.age < 0.25) {
    const e = a.age / 0.25
    ringPx(ctx, p.x, cy, r + 4 + e * 14, (r + 4 + e * 14) * 0.9, ['#8890a8', '#ffffff'], 0)
  }
  blitEllipse(ctx, Math.round(r), Math.round(ry), guarding ? 'rgba(200,210,232,0.28)' : 'rgba(160,170,196,0.18)', p.x, cy)
  ringPx(ctx, p.x, cy, r, ry, guarding ? ['#485068', '#e8eef8'] : ['#485068', '#a8b0c8'], -t * 1.5)
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + t * 0.8
    px(ctx, p.x + Math.cos(ang) * (r - 1) - 1, cy + Math.sin(ang) * (ry - 1) - 1, '#f8f8ff', 2, 2)
  }
  const sweep = ((t * 0.9 + a.id * 0.1) % 1) * TAU
  for (let i = -3; i <= 3; i++) {
    const ang = sweep + i * 0.07
    px(ctx, p.x + Math.cos(ang) * (r + 1), cy + Math.sin(ang) * (ry + 1), '#ffffff', 2, 2)
  }
  ctx.globalAlpha = 1
}

export const drawTmPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  for (const a of g.attacks) if (a.visual === 'ironHead' && a.age >= 0 && a.owner === p.slot) drawIronBody(ctx, g, a, t)
  // Discharge's charge crackles around the player as they walk.
  const discharge = p.moves.find((m) => m.id === 'discharge')
  if (discharge) {
    const charge = dischargeCharge(walkedSince(discharge, p))
    const sparks = Math.round(charge * 5)
    const seed = Math.floor(t * 14)
    for (let i = 0; i < sparks; i++) {
      if (hash2(seed, i) < 0.45) continue
      const ang = hash2(seed, i, 1) * TAU
      const d = 9 + hash2(seed, i, 2) * 6
      const x = p.x + Math.cos(ang) * d
      const y = p.y - 10 + Math.sin(ang) * d
      zigzag(ctx, x, y, x + Math.cos(ang) * 4, y + Math.sin(ang) * 4, 2, seed + i, ['#f8d030', '#ffffff'])
    }
    if (charge >= 1 && Math.floor(t * 8) % 2 === 0) dashedRing(ctx, p.x, p.y - 10, 15, t * 4, ['#fff8a0', '#f8d030'], 0.4)
  }
  // Meteor Beam's charge: golden motes rising off the player while the boost lasts.
  if (p.moveBuffs.some((b) => b.move === 'meteorBeam')) {
    for (let i = 0; i < 6; i++) {
      const ph = (t * 0.9 + i / 6) % 1
      const x = p.x + Math.sin(i * 2.1 + t * 2) * 9
      const y = p.y - 2 - ph * 26
      ctx.globalAlpha = 1 - ph
      px(ctx, x, y, i % 2 ? '#f8d870' : '#fff8d0', ph < 0.3 ? 2 : 1, ph < 0.3 ? 2 : 1)
    }
    ctx.globalAlpha = 1
  }
}

/* ---------------- TM discs ---------------- */

/** A TM disc on the ground: its type's color, a gold rim and sparkles for a legendary one, a glint passing over. */
export const drawTmDisc = (ctx: Ctx, k: Extract<Pickup, { kind: 'tm' }>, x: number, y: number, t: number) => {
  const gold = k.source === 'legendary'
  const color = TYPE_COLORS[MOVES[k.move].type]
  if (!k.attracted) blitEllipse(ctx, 9, 9, gold ? 'rgba(248,208,48,0.25)' : 'rgba(255,255,255,0.18)', x, y)
  blitCentered(ctx, tmDisc(color, gold), x, y)
  const phase = (t * 0.7 + k.id * 0.13) % 1
  if (phase < 0.25) {
    const s = Math.round(-5 + phase * 40)
    px(ctx, x + s, y - 5 + Math.round(phase * 10), 'rgba(255,255,255,0.85)')
  }
  const n = gold ? 4 : 2
  for (let i = 0; i < n; i++) {
    const ph = (t * 0.8 + i / n + k.id * 0.37) % 1
    if (ph > 0.4) continue
    const ang = (i / n) * TAU + k.id
    const sx = x + Math.cos(ang) * 9
    const sy = y + Math.sin(ang) * 7 - 2
    const c = gold ? '#fff0a0' : '#ffffff'
    px(ctx, sx, sy, c)
    if (ph < 0.2) {
      px(ctx, sx - 1, sy, c)
      px(ctx, sx + 1, sy, c)
      px(ctx, sx, sy - 1, c)
      px(ctx, sx, sy + 1, c)
    }
  }
}
