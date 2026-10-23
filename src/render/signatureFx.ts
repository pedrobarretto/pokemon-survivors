import { blitCentered, blitEllipse, blitRing, blitRotated } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TAU } from '../engine/math'
import { playerDex } from '../game/game'
import { SNIPE_AIM } from '../game/signatureMoves'
import { AQUA_STEP_MAX } from '../game/signatureRules'
import type { Attack, Game } from '../game/types'
import { FX } from './art'
import { SIG_FX } from './signatureArt'
import { sprites } from './sprites'
import { dashedRing } from './strokes'
import { flightAngle } from './modFx'
import { localPlayer } from '../game/players'

/**
 * Visuals of the starter signature moves (`game/signatureMoves.ts`). Like
 * `evolved.ts` and `moveFx.ts`, both frame passes of `draw.ts` fall through
 * here: `drawSignatureGround` under the Pokémon, `drawSignatureAttack` over
 * them, and `drawSignaturePlayer` for what a move leaves on the player
 * (dizzy stars, a tired sweat drop, Aqua Step's splashes). Whole pixels only.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
const radiusOf = (a: Attack, fallback: number) => (a.shape.kind === 'circle' ? a.shape.r : fallback)

/** A thick crescent around (x, y) at radius `r`, centered on `dir`, `span` radians wide, revealed by `sweep` (0..1, negative sweeps the other way). */
const crescent = (ctx: Ctx, x: number, y: number, r: number, dir: number, span: number, sweep: number, colors: readonly string[]) => {
  const steps = Math.ceil(r * span * 1.6)
  const shown = Math.abs(sweep) * steps
  for (let i = 0; i <= shown; i++) {
    const k = sweep >= 0 ? i / steps : 1 - i / steps
    const angle = dir - span / 2 + span * k
    const thick = Math.sin(k * Math.PI) * colors.length
    for (let j = 0; j < thick; j++) px(ctx, x + Math.cos(angle) * (r - j), y + Math.sin(angle) * (r - j), colors[j]!)
  }
}

/** Speed lines from `a.from` to the hitbox, fading after `until` (the flaming leap, the dance dash). */
const streak = (ctx: Ctx, a: Attack, colors: readonly string[], until: number) => {
  const dx = a.x - a.from.x
  const dy = a.y - a.from.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  ctx.globalAlpha = a.age < until ? 1 : Math.max(0, 1 - (a.age - until) / Math.max(0.01, a.ttl - until))
  for (let lane = -2; lane <= 2; lane++) {
    const from = Math.abs(lane) * 7
    for (let d = from; d < len; d += 1) {
      px(ctx, a.from.x + ux * d - uy * lane * 3, a.from.y + uy * d + ux * lane * 3, colors[Math.min(colors.length - 1, Math.abs(lane))]!)
    }
  }
  ctx.globalAlpha = 1
}

const PSY_COLORS = ['#f85888', '#f8a030', '#f8e030', '#78d850', '#58c8f8', '#a070f8'] as const
const FIRE = ['#ffffff', '#fff0a0', '#f8b030', '#f05818'] as const

/** Ground layer: shadows, scorch marks, warnings, pinned shadows. */
export const drawSignatureGround = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'leechSeed': {
      if (a.age >= a.activeFrom) return
      const k = a.age / a.activeFrom
      blitEllipse(ctx, Math.max(1, Math.round(2 + 3 * k)), Math.max(1, Math.round(1 + k)), 'rgba(24,40,16,0.35)', a.x, a.y + 3)
      return
    }
    case 'eruptionFall': {
      // The bomb's shadow grows where it'll land; the rim blinks faster as it comes.
      const r = radiusOf(a, 16)
      const k = a.age / a.ttl
      const fall = Math.max(0, (k - 0.4) / 0.6)
      blitEllipse(ctx, Math.max(1, Math.round(r * (0.3 + 0.7 * fall))), Math.max(1, Math.round(r * 0.45 * (0.3 + 0.7 * fall))), 'rgba(48,8,0,0.35)', a.x, a.y)
      if (Math.floor(a.age * (8 + fall * 22)) % 2 === 0) dashedRing(ctx, a.x, a.y, r, a.id, ['#f86030', '#f8d030'], 0.8, 0.5)
      return
    }
    case 'eruption':
    case 'flameLanding': {
      const r = radiusOf(a, 16)
      ctx.globalAlpha = fadeOut(a, 0.35) * 0.8
      blitEllipse(ctx, Math.round(r * 0.9), Math.round(r * 0.42), 'rgba(40,16,8,0.5)', a.x, a.y + 1)
      blitEllipse(ctx, Math.round(r * 0.55), Math.round(r * 0.24), 'rgba(248,96,24,0.45)', a.x, a.y + 1)
      ctx.globalAlpha = 1
      return
    }
    case 'thrash': {
      // The rampage's reach: a red dashed ring around the player.
      const r = radiusOf(a, 46)
      ctx.globalAlpha = 0.55 * Math.min(1, a.age / 0.15, fadeOut(a, 0.3))
      dashedRing(ctx, a.x, a.y + 8, r, t * 6, ['#f83030', '#f88060'], 0.55, 0.55)
      ctx.globalAlpha = 1
      return
    }
    case 'hammer': {
      if (a.age < a.activeFrom) return
      const r = radiusOf(a, 22)
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.45), 'rgba(40,24,8,0.4)', a.x, a.y + 8)
      // Cracks running out of the impact.
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU + a.id
        for (let d = 3; d < r * (0.6 + e * 0.5); d += 1) {
          const jag = Math.sin(d * 0.9 + i * 2) * 1.2
          px(ctx, a.x + Math.cos(angle) * d - Math.sin(angle) * jag, a.y + 8 + (Math.sin(angle) * d + Math.cos(angle) * jag) * 0.5, '#402810')
        }
      }
      dashedRing(ctx, a.x, a.y + 8, r * (0.8 + e * 0.6), a.id, ['#a07840', '#d8c080'], 0.7, 0.45)
      ctx.globalAlpha = 1
      return
    }
    case 'leafTornado': {
      const r = radiusOf(a, 16)
      ctx.globalAlpha = Math.min(1, a.age / 0.15, fadeOut(a, 0.2))
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.4), 'rgba(24,56,16,0.3)', a.x, a.y + r * 0.6)
      ctx.globalAlpha = 1
      return
    }
    case 'pinShadow': {
      // The foe's shadow, nailed down by a spectral arrow.
      const r = radiusOf(a, 6)
      ctx.globalAlpha = fadeOut(a, 0.25)
      blitEllipse(ctx, Math.round(r * 1.3 + 2), Math.round(r * 0.5 + 1), 'rgba(56,24,88,0.55)', a.x, a.y)
      blitRotated(ctx, FX.arrow(), a.x + r * 0.6, a.y - 3, Math.PI * 0.62)
      ctx.globalAlpha = 1
      return
    }
    case 'rapidSpin': {
      const r = radiusOf(a, 15)
      ctx.globalAlpha = 0.6 * fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y + 8, r * 0.9, -t * 14, ['#d8c8a0', '#a89878'], 0.45, 0.4)
      ctx.globalAlpha = 1
      return
    }
  }
}

/** Overlay layer: the moves themselves. */
export const drawSignatureAttack = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  switch (a.visual) {
    case 'leechSeed': {
      if (a.age < a.activeFrom) {
        const k = a.age / a.activeFrom
        const x = a.from.x + (a.x - a.from.x) * k
        const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 34
        return blitRotated(ctx, SIG_FX.seed(), x, y, a.age * 14 * (a.flip ? -1 : 1))
      }
      // It bursts open on landing: a green ring and the seed shell splitting.
      const k = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - k)
      blitRing(ctx, Math.round(4 + k * radiusOf(a, 10)), 1, '#a8e870', a.x, a.y)
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * TAU + a.id
        px(ctx, a.x + Math.cos(angle) * (2 + k * 10), a.y + Math.sin(angle) * (2 + k * 8) - k * 4, i % 2 ? '#88d850' : '#e0f8a0', 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'rapidSpin': {
      // Spin lines whirling round the shell, flecks of water flung off them.
      const r = radiusOf(a, 15)
      ctx.globalAlpha = Math.min(1, a.age / 0.08, fadeOut(a, 0.15))
      const spin = a.age * 22
      for (let arm = 0; arm < 3; arm++) {
        const dir = spin + (arm * TAU) / 3
        crescent(ctx, a.x, a.y, r, dir, 1.7, 1, ['#ffffff', '#c8e0f8', '#7898c8'])
        crescent(ctx, a.x, a.y, r * 0.62, dir + 1, 1.2, 1, ['#f0d090', '#a06830'])
      }
      for (let i = 0; i < 6; i++) {
        const phase = (a.age * 3 + i / 6) % 1
        const angle = spin * 0.5 + i * 1.7
        px(ctx, a.x + Math.cos(angle) * (r + phase * 14), a.y + Math.sin(angle) * (r + phase * 14) * 0.8, phase < 0.5 ? '#ffffff' : '#78b8f8')
      }
      ctx.globalAlpha = 1
      return
    }
    case 'petal': {
      ctx.globalAlpha = Math.min(1, a.age / 0.1, fadeOut(a, 0.25))
      const scale = Math.max(1, Math.round(radiusOf(a, 6) / 6))
      blitRotated(ctx, SIG_FX.petal()[a.id % 2]!, a.x, a.y, a.age * 9 * (a.flip ? -1 : 1) + a.id, scale)
      // A tiny petal trailing behind.
      if (m.kind === 'orbit') {
        const back = m.angle - Math.sign(m.spin) * 0.35
        const cx = a.x - Math.cos(m.angle) * m.radius
        const cy = a.y - Math.sin(m.angle) * m.radius
        px(ctx, cx + Math.cos(back) * m.radius, cy + Math.sin(back) * m.radius, '#f8b8d8', 2, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'eruptionFall': {
      // Up out of the player's back, then down onto its spot from high above.
      const k = a.age / a.ttl
      const frame = SIG_FX.magma()[Math.floor((t + a.id) * 14) % 2]!
      if (k < 0.4) {
        const u = k / 0.4
        const x = a.from.x + (a.x - a.from.x) * u * 0.25
        const y = a.from.y - (1 - (1 - u) * (1 - u)) * 80
        return blitCentered(ctx, frame, x, y)
      }
      const u = (k - 0.4) / 0.6
      blitCentered(ctx, frame, a.x, a.y - 110 * (1 - u * u))
      // A short tail of embers above it.
      for (let i = 1; i <= 3; i++) px(ctx, a.x + (hash2(a.id, i) - 0.5) * 4, a.y - 110 * (1 - u * u) - i * 5, i === 1 ? '#f8d030' : '#f06020')
      return
    }
    case 'eruption':
    case 'flameLanding': {
      // A fiery blast: a hot core, a white rim spreading out and flames licking up around it.
      const r = radiusOf(a, 16)
      const k = Math.min(1, a.age / a.ttl)
      const grow = 0.55 + 0.45 * Math.min(1, a.age / 0.12)
      ctx.globalAlpha = Math.max(0, 1 - k * k)
      blitEllipse(ctx, Math.round(r * grow), Math.round(r * 0.6 * grow), 'rgba(240,96,24,0.32)', a.x, a.y - 2)
      blitEllipse(ctx, Math.round(r * 0.6 * grow), Math.round(r * 0.36 * grow), 'rgba(248,176,48,0.55)', a.x, a.y - 3)
      blitEllipse(ctx, Math.round(r * 0.3 * grow), Math.round(r * 0.18 * grow), 'rgba(255,248,200,0.9)', a.x, a.y - 3)
      if (a.age < 0.05) blitEllipse(ctx, Math.round(r * 0.45), Math.round(r * 0.3), '#ffffff', a.x, a.y - 3)
      dashedRing(ctx, a.x, a.y - 2, r * (0.6 + k * 0.6), a.id, ['#fff0a0', '#f8b030', '#ffffff'], 0.8, 0.62)
      const flames = a.visual === 'flameLanding' ? 8 : 5
      for (let i = 0; i < flames; i++) {
        const angle = (i / flames) * TAU + a.id
        const fx = a.x + Math.cos(angle) * r * 0.75 * grow
        const fy = a.y - 4 + Math.sin(angle) * r * 0.45 * grow - k * 8
        blitCentered(ctx, FX.flame()[(i + Math.floor(t * 10)) % 2]!, fx, fy)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'thrash': {
      // An anger mark throbbing over the raging player.
      const beat = Math.floor(a.age * 6) % 2
      blitCentered(ctx, SIG_FX.anger(), a.x + 9 + beat, a.y - 20 - beat)
      return
    }
    case 'thrashBite': {
      const r = radiusOf(a, 11)
      const { top, bottom } = FX.jaws()
      const close = Math.min(1, a.age / a.activeFrom)
      const gap = Math.round((1 - close) * r * 0.8)
      ctx.globalAlpha = a.age > a.activeUntil ? Math.max(0, 1 - (a.age - a.activeUntil) / (a.ttl - a.activeUntil)) : 1
      const tilt = a.flip ? -0.25 : 0.25
      blitRotated(ctx, top, a.x, a.y - gap - top.height / 2, tilt)
      blitRotated(ctx, bottom, a.x, a.y + gap + bottom.height / 2, tilt)
      if (a.age >= a.activeFrom) {
        blitRing(ctx, Math.round(3 + (a.age - a.activeFrom) * 40), 1, '#f84030', a.x, a.y)
        for (let i = 0; i < 4; i++) {
          const angle = (i / 4) * TAU + 0.4
          px(ctx, a.x + Math.cos(angle) * 6, a.y + Math.sin(angle) * 6, '#ffffff', 2, 1)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'kick': {
      if (m.kind !== 'follow') return
      const r = radiusOf(a, 12)
      const dir = Math.atan2(m.oy + 8, m.ox)
      const second = a.memo === 1
      const cx = a.x - Math.cos(dir) * r * 0.7
      const cy = a.y - Math.sin(dir) * r * 0.7
      ctx.globalAlpha = fadeOut(a, 0.07)
      const sweep = Math.min(1, a.age / 0.09)
      crescent(ctx, cx, cy, r * 1.25, dir, 2.3, second ? -sweep : sweep, second ? FIRE : ['#ffffff', '#f8d8a0', '#f89838'])
      // The second kick is the hard one: a starburst at the tip.
      if (second && a.age > 0.06) {
        const sx = cx + Math.cos(dir) * r * 1.3
        const sy = cy + Math.sin(dir) * r * 1.3
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * TAU
          const len = i % 2 ? 3 : 6
          for (let d = 2; d <= len; d++) px(ctx, sx + Math.cos(angle) * d, sy + Math.sin(angle) * d, d === 2 ? '#ffffff' : '#f8c030')
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'mudWave': {
      const dir = flightAngle(m)
      if (dir === null) return
      const r = radiusOf(a, 9)
      ctx.globalAlpha = fadeOut(a, 0.2)
      // A crest of mud facing its way, darker behind, with clods flying off the top.
      const base = ctx.globalAlpha
      for (let k = 3; k >= 1; k--) {
        ctx.globalAlpha = base * (1 - k * 0.22)
        crescent(ctx, a.x - Math.cos(dir) * k * 4, a.y - Math.sin(dir) * k * 4, r - k, dir, 2.4, 1, ['#906838', '#704c28', '#583818'])
      }
      ctx.globalAlpha = base
      crescent(ctx, a.x, a.y, r, dir, 2.6, 1, ['#f0d8a0', '#c09058', '#906838', '#704c28', '#503418'])
      for (let i = 0; i < 5; i++) {
        const side = (hash2(a.id, i) - 0.5) * 2.2
        const lift = ((a.age * 3 + hash2(i, a.id)) % 1) * 7
        px(ctx, a.x + Math.cos(dir + side) * r, a.y + Math.sin(dir + side) * r - lift, i % 2 ? '#a07840' : '#604020', 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hammer': {
      if (m.kind !== 'follow') return
      const r = radiusOf(a, 22)
      const dir = Math.atan2(m.oy + 8, m.ox)
      const pivot = { x: a.x - m.ox, y: a.y - m.oy - 8 }
      const back = a.flip ? 1 : -1
      // Raised over the shoulder while it winds up, then brought down in one frame-snapping swing.
      const k = a.age < a.activeFrom ? a.age / a.activeFrom : 1
      const swing = a.age < a.activeFrom ? back * 2.1 * Math.min(1, k * 1.6) : back * 2.1 * Math.max(0, 1 - (a.age - a.activeFrom) / 0.05)
      const angle = dir + swing
      const scale = Math.max(1, Math.round(r / 13))
      const hammer = SIG_FX.hammer()
      const reach = (hammer.width * scale) / 2
      ctx.globalAlpha = fadeOut(a, 0.12)
      blitRotated(ctx, hammer, pivot.x + Math.cos(angle) * reach, pivot.y + Math.sin(angle) * reach, angle, scale)
      if (a.age >= a.activeFrom) {
        const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
        if (e < 0.25) blitEllipse(ctx, Math.round(r * 0.7), Math.round(r * 0.4), 'rgba(255,255,255,0.7)', a.x, a.y + 6)
        blitRing(ctx, Math.round(r * (0.5 + e)), 1, '#f8f0d0', a.x, a.y + 4)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'drill': {
      const angle = flightAngle(m)
      if (angle === null) return
      const scale = Math.max(1, Math.round(radiusOf(a, 6) / 6))
      blitRotated(ctx, SIG_FX.drill()[Math.floor(a.age * 30) % 2]!, a.x, a.y, angle, scale)
      // Spin lines behind, and sparks while it grinds through a foe.
      const ux = Math.cos(angle)
      const uy = Math.sin(angle)
      for (let i = 0; i < 3; i++) {
        const d = 8 + i * 4 + ((a.age * 40) % 4)
        px(ctx, a.x - ux * d - uy * (i - 1) * 3, a.y - uy * d + ux * (i - 1) * 3, '#ffffff', 2, 1)
      }
      // Only a straight drill slows down to grind (`signatures.ts`).
      if (m.kind === 'linear' && Math.hypot(m.vx, m.vy) < a.memo * 0.6) {
        for (let i = 0; i < 4; i++) {
          const s = hash2(a.id, Math.floor(t * 30) + i)
          px(ctx, a.x + ux * 6 + (s - 0.5) * 12, a.y + uy * 6 + (hash2(i, Math.floor(t * 30)) - 0.5) * 12, i % 2 ? '#fff0a0' : '#ffffff')
        }
      }
      return
    }
    case 'leafTornado': {
      // A funnel of spinning air, widest at the top, with leaves whipping round it.
      const r = radiusOf(a, 16)
      const base = Math.min(1, a.age / 0.15, fadeOut(a, 0.2))
      const foot = a.y + r * 0.6
      const height = r * 2.4
      for (let i = 0; i < 7; i++) {
        const k = i / 6
        const rx = r * (0.25 + 0.8 * k)
        const sway = Math.sin(a.age * 7 + i * 0.8) * 2
        const y = foot - k * height
        ctx.globalAlpha = base * 0.3
        blitEllipse(ctx, Math.round(rx), Math.max(1, Math.round(rx * 0.32)), '#a8e070', a.x + sway, y)
        ctx.globalAlpha = base
        dashedRing(ctx, a.x + sway, y, rx, a.age * 18 + i * 1.3, i % 2 ? ['#ffffff', '#c8f0a0'] : ['#78c850', '#e8f8d0'], 0.85, 0.32)
      }
      for (let i = 0; i < 6; i++) {
        const angle = a.age * 8 + i * 1.05
        const k = ((i * 0.37 + a.age * 0.9) % 1)
        const w = r * (0.25 + 0.8 * k)
        const x = a.x + Math.cos(angle) * w
        const y = foot - k * height + Math.sin(angle) * w * 0.32
        if (Math.sin(angle) > -0.2) blitRotated(ctx, FX.leaf(), x, y, angle * 2, 1)
        else px(ctx, x, y, '#58b838', 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'tornadoLeaf':
      ctx.globalAlpha = fadeOut(a, 0.12)
      blitRotated(ctx, FX.leaf(), a.x, a.y, a.age * 20)
      ctx.globalAlpha = 1
      return
    case 'flameCharge': {
      streak(ctx, a, ['#fff0a0', '#f8b030', '#f05818'], a.activeUntil)
      if (a.age > a.activeUntil) return
      // Wrapped in fire on the way.
      blitEllipse(ctx, 10, 9, 'rgba(248,120,32,0.45)', a.x, a.y)
      for (let i = 0; i < 4; i++) {
        const angle = (i / 4) * TAU + a.age * 20
        blitCentered(ctx, FX.flame()[(i + Math.floor(t * 12)) % 2]!, a.x + Math.cos(angle) * 7, a.y + Math.sin(angle) * 5 - 3)
      }
      return
    }
    case 'needleArm': {
      // The quills stand up all round the player, pulsing, flickering as they settle.
      if (a.ttl - a.age < 0.3 && Math.floor(t * 20) % 2 === 0) return
      const pulse = Math.floor(a.age * 8) % 2
      const n = 14
      for (let i = 0; i < n; i++) {
        const angle = (i / n) * TAU + 0.1
        const len = (i % 2 ? 4 : 6) + pulse
        for (let d = 0; d < len; d++) {
          const dist = 11 + d
          const x = a.x + Math.cos(angle) * dist
          const y = a.y + Math.sin(angle) * dist * 0.85
          if (d < 2) px(ctx, x - 1, y - 1, '#285018', 3, 3)
          px(ctx, x, y, d >= len - 1 ? '#ffffff' : d > 1 ? '#c8f090' : '#68b040')
        }
      }
      return
    }
    case 'needle': {
      if (m.kind === 'linear') return blitRotated(ctx, SIG_FX.needle(), a.x, a.y, Math.atan2(m.vy, m.vx))
      // The thorns answer a touch: a spray of spikes towards whoever it was.
      const angle = Math.atan2(a.from.y - a.y, a.from.x - a.x)
      const k = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - k)
      for (let i = -2; i <= 2; i++) {
        const s = angle + i * 0.22
        blitRotated(ctx, SIG_FX.needle(), a.x + Math.cos(s) * (12 + k * 16), a.y + Math.sin(s) * (12 + k * 16), s)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'psybeam': {
      const dir = flightAngle(m)
      if (dir === null) return
      const r = radiusOf(a, 5)
      const wobble = Math.sin(a.age * 18 + a.memo * 1.3) * 3
      const x = a.x - Math.sin(dir) * wobble
      const y = a.y + Math.cos(dir) * wobble
      const color = PSY_COLORS[(a.memo + Math.floor(t * 8)) % PSY_COLORS.length]!
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitRing(ctx, Math.round(r), 1, color, x, y)
      blitRing(ctx, Math.max(1, Math.round(r * 0.55)), 1, '#ffffff', x, y)
      ctx.globalAlpha = 1
      return
    }
    case 'lariat': {
      if (m.kind !== 'orbit') return
      const r = radiusOf(a, 7)
      const cx = a.x - Math.cos(m.angle) * m.radius
      const cy = a.y - Math.sin(m.angle) * m.radius
      const ux = Math.cos(m.angle)
      const uy = Math.sin(m.angle)
      ctx.globalAlpha = Math.min(1, a.age / 0.06, fadeOut(a, 0.15))
      if (a.memo === 1) {
        // The fist: a fiery smear trailing behind it, then the fist itself.
        for (let k = 4; k >= 1; k--) {
          const back = m.angle - Math.sign(m.spin) * k * 0.09
          px(ctx, cx + Math.cos(back) * m.radius - 1, cy + Math.sin(back) * m.radius - 1, k > 2 ? '#f86030' : '#f8b040', 3, 3)
        }
        blitCentered(ctx, FX.flame()[Math.floor((t + a.id) * 12) % 2]!, a.x, a.y - 4)
        blitRotated(ctx, SIG_FX.fist(), a.x, a.y, m.angle, Math.max(1, Math.round(r / 5)))
      } else {
        // A stretch of arm: a dark bar along the radius with a red stripe.
        for (let d = -6; d <= 6; d++) {
          const x = cx + ux * (m.radius + d)
          const y = cy + uy * (m.radius + d)
          px(ctx, x - 1, y - 1, '#281020', 3, 3)
        }
        for (let d = -6; d <= 6; d++) px(ctx, cx + ux * (m.radius + d), cy + uy * (m.radius + d), d % 4 === 0 ? '#f86030' : '#684058')
      }
      ctx.globalAlpha = 1
      return
    }
    case 'bubble': {
      const r = radiusOf(a, 7)
      const grow = Math.min(1, a.age / 0.15)
      const wob = Math.sin(a.age * 9 + a.id) * 0.8
      const rx = Math.max(1, Math.round(r * grow + wob))
      const ry = Math.max(1, Math.round(r * grow - wob))
      blitEllipse(ctx, rx, ry, 'rgba(184,228,255,0.4)', a.x, a.y)
      dashedRing(ctx, a.x, a.y, rx, 0, ['#4890e0', '#78b8f0', '#ffffff'], 1, ry / rx)
      px(ctx, a.x - rx * 0.45, a.y - ry * 0.5, '#ffffff', 2, 1)
      px(ctx, a.x - rx * 0.55, a.y - ry * 0.3, '#ffffff')
      // A sparkle twinkling on its rim.
      if (Math.floor((t * 3 + a.id * 0.3) % 2) === 0) {
        const sx = a.x + rx * 0.6
        const sy = a.y - ry * 0.7
        px(ctx, sx - 1, sy, '#f8b8e0', 3, 1)
        px(ctx, sx, sy - 1, '#f8b8e0', 1, 3)
        px(ctx, sx, sy, '#ffffff')
      }
      return
    }
    case 'bubblePop': {
      const r = radiusOf(a, 18)
      const k = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = Math.max(0, 1 - k)
      blitRing(ctx, Math.round(r * (0.4 + 0.6 * k)), 1, '#c8ecff', a.x, a.y)
      dashedRing(ctx, a.x, a.y, r * (0.3 + 0.5 * k), a.id, ['#ffffff', '#78b8f0'], 0.6)
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * TAU + a.id
        const d = r * (0.3 + 0.8 * k)
        px(ctx, a.x + Math.cos(angle) * d, a.y + Math.sin(angle) * d + k * k * 6, i % 2 ? '#a8d8f8' : '#ffffff', 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'snipeSight': {
      // The crosshair closes in on its mark, then flashes red as the shot leaves.
      const k = Math.min(1, a.age / SNIPE_AIM)
      const r = Math.round(radiusOf(a, 9) * (1.6 - 0.6 * k))
      const live = k >= 1 || (k > 0.7 && Math.floor(a.age * 30) % 2 === 0)
      const color = live ? '#f84838' : '#a8e0ff'
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRing(ctx, r, 1, color, a.x, a.y)
      px(ctx, a.x, a.y - r - 3, color, 1, 5)
      px(ctx, a.x, a.y + r - 1, color, 1, 5)
      px(ctx, a.x - r - 3, a.y, color, 5, 1)
      px(ctx, a.x + r - 1, a.y, color, 5, 1)
      px(ctx, a.x, a.y, '#ffffff')
      ctx.globalAlpha = 1
      return
    }
    case 'snipeShot': {
      if (m.kind !== 'linear') return
      const v = Math.hypot(m.vx, m.vy) || 1
      const ux = m.vx / v
      const uy = m.vy / v
      const tail = Math.min(44, a.age * v)
      for (let d = 0; d < tail; d++) {
        const c = d < 6 ? '#ffffff' : d < tail * 0.6 ? '#a8d8f8' : '#4878c8'
        px(ctx, a.x - ux * d, a.y - uy * d, c)
        if (d < tail * 0.4) px(ctx, a.x - ux * d - uy, a.y - uy * d + ux, '#78a8e8')
      }
      return blitRotated(ctx, FX.water(), a.x, a.y, Math.atan2(uy, ux))
    }
    case 'flowerTrick': {
      blitRotated(ctx, SIG_FX.flower(), a.x, a.y, a.age * 8)
      if (m.kind === 'homing') {
        const v = Math.hypot(m.vx, m.vy) || 1
        for (let i = 1; i <= 2; i++) px(ctx, a.x - (m.vx / v) * (6 + i * 4) + Math.sin(a.age * 20 + i) * 2, a.y - (m.vy / v) * (6 + i * 4), i === 1 ? '#f878b0' : '#ffd0e8', 2, 1)
      }
      return
    }
    case 'aquaStep': {
      streak(ctx, a, ['#ffffff', '#a8d8f8', '#4890e8'], a.activeUntil)
      if (a.age > a.activeUntil) return
      blitEllipse(ctx, 9, 7, 'rgba(120,184,248,0.4)', a.x, a.y)
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * TAU + a.age * 25
        px(ctx, a.x + Math.cos(angle) * 9, a.y + Math.sin(angle) * 7, i % 2 ? '#ffffff' : '#78c0f8', 2, 2)
      }
      return
    }
    case 'sonicJab': {
      if (m.kind !== 'linear') return
      const r = radiusOf(a, 7)
      const dir = Math.atan2(m.vy, m.vx)
      ctx.globalAlpha = fadeOut(a, 0.12)
      crescent(ctx, a.x, a.y, r + a.age * 12, dir, 2, 1, ['#ffffff', '#f8d8a0', '#c87848'])
      crescent(ctx, a.x - Math.cos(dir) * 4, a.y - Math.sin(dir) * 4, r * 0.7 + a.age * 8, dir, 1.6, 1, ['#ffffff', '#e0e0e0'])
      ctx.globalAlpha = 1
      return
    }
  }
}

const STAR = ['#f8e030', '#fff8a0'] as const

/** What a move leaves on the player: dizzy stars (Petal Dance), a sweat drop (Thrash's tiredness), Aqua Step's splashes. */
export const drawSignaturePlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  if (p.moveBuffs.length === 0) return
  const head = p.y - sprites(playerDex(g)).bodyH - 3
  for (const b of p.moveBuffs) {
    switch (b.move) {
      case 'petalDance':
        for (let k = 0; k < 3; k++) {
          const a = t * 6 + (k * TAU) / 3
          const x = p.x + Math.cos(a) * 9
          const y = head + Math.sin(a) * 2.5
          px(ctx, x - 1, y, STAR[0], 3, 1)
          px(ctx, x, y - 1, STAR[0], 1, 3)
          px(ctx, x, y, STAR[1])
        }
        break
      case 'thrash': {
        const bob = Math.floor(t * 4) % 2
        const x = p.x + 8
        const y = head + 4 + bob
        px(ctx, x, y, '#a8d8f8', 1, 1)
        px(ctx, x - 1, y + 1, '#a8d8f8', 3, 2)
        px(ctx, x, y + 1, '#ffffff')
        break
      }
      case 'aquaStep': {
        const stacks = Math.min(AQUA_STEP_MAX, p.moves.find((m) => m.id === 'aquaStep')?.stacks ?? 1)
        for (let k = 0; k < stacks; k++) {
          const a = t * 4 + (k * TAU) / stacks
          const phase = (t * 1.5 + k * 0.3) % 1
          px(ctx, p.x + Math.cos(a) * 10, p.y + Math.sin(a) * 3 - phase * 6, phase < 0.5 ? '#a8d8f8' : '#ffffff')
        }
        break
      }
    }
  }
}
