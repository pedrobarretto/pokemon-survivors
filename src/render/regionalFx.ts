import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TAU } from '../engine/math'
import { BULL, CLAW, JOUST, TOXIC } from '../game/regionalRules'
import type { Attack } from '../game/types'
import { detail } from './quality'
import { REGIONAL_FX } from './regionalArt'
import { dashedRing } from './strokes'

/**
 * How the regional forms' moves look (`game/regionalMoves.ts`). Both frame
 * passes of `draw.ts` fall through here: `drawRegionalGround` under the
 * Pokémon (pools, scorch lines, the X's ring) and `drawRegionalAttack` over
 * them. Everything snaps to whole pixels; the jitter comes from `hash2`.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

/** The way a moving hitbox goes. */
const heading = (a: Attack) => {
  const m = a.motion
  return m.kind === 'linear' || m.kind === 'homing' || m.kind === 'lunge' ? Math.atan2(m.vy, m.vx) : 0
}

/** Square-brush line from (x0, y0) to (x1, y1), `w` px thick. */
const line = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
  const half = Math.floor(w / 2)
  ctx.fillStyle = color
  for (let i = 0; i <= n; i++) {
    const k = i / n
    ctx.fillRect(Math.round(x0 + (x1 - x0) * k) - half, Math.round(y0 + (y1 - y0) * k) - half, w, w)
  }
}

/** The colors of a charge by the type it hits as (Raging Bull's breed). */
const BULL_COLORS = {
  fighting: ['#a07850', '#e0c098', '#fff4e0'],
  fire: ['#c83818', '#f89838', '#f8e070'],
  water: ['#2860c0', '#68b0f0', '#e0f8ff'],
} as const

const bullColors = (a: Attack) => (a.type === 'fire' ? BULL_COLORS.fire : a.type === 'water' ? BULL_COLORS.water : BULL_COLORS.fighting)

/* ---------------- Ground layer ---------------- */

export const drawRegionalGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  switch (a.visual) {
    case 'toxicPool': {
      if (a.age < 0) return
      // A bubbling violet pool: it fades in as the glob lands, darkens at the rim, pops bubbles.
      const k = Math.min(1, a.age / 0.15) * fadeOut(a, 0.5)
      ctx.globalAlpha = k * 0.75
      blitEllipse(ctx, r, Math.max(2, Math.round(r * 0.5)), '#582878', a.x, a.y)
      blitEllipse(ctx, Math.round(r * 0.82), Math.max(2, Math.round(r * 0.38)), '#8838b0', a.x, a.y)
      blitEllipse(ctx, Math.round(r * 0.45), Math.max(1, Math.round(r * 0.2)), '#b860d8', a.x - r * 0.15, a.y - r * 0.06)
      ctx.globalAlpha = k
      const bubbles = detail.lean ? 2 : 4
      for (let i = 0; i < bubbles; i++) {
        const phase = (t * 1.6 + hash2(a.id, i)) % 1
        const bx = a.x + (hash2(i, a.id) - 0.5) * r * 1.4
        const by = a.y + (hash2(a.id + 7, i) - 0.5) * r * 0.6 - phase * 6
        if (phase < 0.8) blitCentered(ctx, REGIONAL_FX.bubble(), bx, by)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'leekJoust':
    case 'bullCharge': {
      // The path scored into the ground behind the lunge.
      const done = a.motion.kind === 'lunge' ? 1 - a.motion.left / (a.visual === 'leekJoust' ? JOUST.time : BULL.time) : 1
      const colors = a.visual === 'leekJoust' ? ['rgba(120,192,64,0.35)', '#c8f098'] : [`${bullColors(a)[0]}66`, bullColors(a)[1]]
      ctx.globalAlpha = fadeOut(a, 0.2)
      const fx = a.from.x
      const fy = a.from.y
      line(ctx, fx, fy, a.x, a.y + 8, 5, colors[0]!)
      line(ctx, fx + (a.x - fx) * (1 - done) * 0.4, fy + (a.y + 8 - fy) * (1 - done) * 0.4, a.x, a.y + 8, 1, colors[1]!)
      ctx.globalAlpha = 1
      return
    }
    case 'obstructX': {
      // The X's shock ring on the floor.
      const e = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = 1 - e
      dashedRing(ctx, a.x, a.y + 6, r, a.id, ['#e83850', '#181018'], 0.8, 0.5)
      ctx.globalAlpha = 1
      return
    }
    case 'chloroblast': {
      const e = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = (1 - e) * 0.9
      dashedRing(ctx, a.x, a.y + 6, r, a.id, ['#58b030', '#c8f070'], 0.9, 0.5)
      ctx.globalAlpha = 1
      return
    }
  }
}

/* ---------------- Air layer ---------------- */

export const drawRegionalAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = a.shape.kind === 'circle' ? a.shape.r : 8
  switch (a.visual) {
    case 'metalClaw': {
      if (a.age < a.activeFrom) return
      // Three rakes that slash in; sharpened claws (stacks) glint hot white.
      const sharp = a.tier >= CLAW.max / 2
      const k = Math.min(1, (a.age - a.activeFrom) / 0.06)
      ctx.globalAlpha = fadeOut(a, 0.1)
      const s = sharp ? REGIONAL_FX.clawsSharp() : REGIONAL_FX.claws()
      blitRotated(ctx, s, a.x, a.y, a.flip ? Math.PI / 2 : 0, (0.7 + 0.5 * k) * Math.max(1, r / 11))
      if (sharp && !detail.lean) for (let i = 0; i < 3; i++) px(ctx, a.x + (hash2(a.id, i) - 0.5) * r * 2, a.y + (hash2(i, a.id) - 0.5) * r * 2, '#fff8c0')
      ctx.globalAlpha = 1
      return
    }
    case 'shellSlam': {
      if (a.age < a.activeFrom) {
        // The shell swings in from above.
        const k = a.age / a.activeFrom
        blitRotated(ctx, REGIONAL_FX.shell(), a.x, a.y - 14 * (1 - k), (1 - k) * 1.2)
        return
      }
      ctx.globalAlpha = fadeOut(a, 0.12)
      blitRotated(ctx, REGIONAL_FX.shell(), a.x, a.y, 0, 1 + Math.max(0, 0.25 - (a.age - a.activeFrom)))
      dashedRing(ctx, a.x, a.y + 4, r * Math.min(1.3, 0.6 + a.age * 4), a.id, ['#a070c8', '#e0c8f0'], 0.7, 0.55)
      ctx.globalAlpha = 1
      return
    }
    case 'shellShot': {
      blitRotated(ctx, REGIONAL_FX.bolt(), a.x, a.y, heading(a), Math.max(1, r / 6))
      if (!detail.lean && Math.floor(t * 20 + a.id) % 3 === 0) px(ctx, a.x - Math.cos(heading(a)) * 8, a.y - Math.sin(heading(a)) * 8 + 2, '#c878f0')
      return
    }
    case 'obstructGuard': {
      // Arms crossed: a small X badge over the head, pulsing, and a red-rimmed ring at the feet while the guard waits.
      const pulse = Math.floor(t * 6) % 2
      dashedRing(ctx, a.x, a.y + 8, 14 + pulse, a.id, ['#e83850', '#382838'], 0.7, 0.5)
      blitCentered(ctx, REGIONAL_FX.xGuard(), a.x, a.y - 22 - pulse)
      return
    }
    case 'obstructX': {
      // A big X flung out from the body: two thick strokes, dark with a red core, growing and fading.
      const e = Math.min(1, a.age / a.ttl)
      const half = Math.round(r * 0.75)
      ctx.globalAlpha = 1 - e * e
      for (const [w, color] of [[5, '#181018'], [3, '#a01828'], [1, '#f86878']] as const) {
        line(ctx, a.x - half, a.y - half, a.x + half, a.y + half, w, color)
        line(ctx, a.x - half, a.y + half, a.x + half, a.y - half, w, color)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'leekJoust': {
      // The leek couched like a lance ahead of the rider, speed lines streaming back.
      const dir = heading(a)
      const ahead = 10
      ctx.globalAlpha = fadeOut(a, 0.12)
      if (!detail.lean)
        for (let i = 0; i < 4; i++) {
          const off = (hash2(a.id, i) - 0.5) * 14
          const len = 8 + hash2(i, a.id) * 10
          const bx = a.x - Math.cos(dir) * (6 + i * 3) - Math.sin(dir) * off
          const by = a.y - Math.sin(dir) * (6 + i * 3) + Math.cos(dir) * off
          line(ctx, bx, by, bx - Math.cos(dir) * len, by - Math.sin(dir) * len, 1, i % 2 ? '#ffffff' : '#c8f098')
        }
      blitRotated(ctx, REGIONAL_FX.leek(), a.x + Math.cos(dir) * ahead, a.y + Math.sin(dir) * ahead, dir, Math.max(1, r / JOUST.r))
      ctx.globalAlpha = 1
      return
    }
    case 'chloroblast': {
      // A green flash and leaves of light thrown out all round.
      const e = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = 1 - e
      if (e < 0.25) blitEllipse(ctx, Math.round(r * 0.7), Math.round(r * 0.5), '#e8ffb0', a.x, a.y)
      dashedRing(ctx, a.x, a.y, r, a.id + 3, ['#78d040', '#f8f880', '#ffffff'], 0.7, 0.8)
      const motes = detail.lean ? 6 : 12
      for (let i = 0; i < motes; i++) {
        const ang = (i / motes) * TAU + hash2(a.id, i) * 0.4
        const d = r * (0.6 + 0.5 * e)
        px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.8, i % 3 ? '#a8f070' : '#ffffff', 2, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'bitterMalice': {
      // Wisps of spite rise round the crowd and spiral in, a cold ring under them.
      const e = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = 1 - e * e
      dashedRing(ctx, a.x, a.y + 6, r * (1.1 - e * 0.4), a.id, ['#584898', '#c8d0f8'], 0.6, 0.5)
      const wisps = detail.lean ? 3 : 6
      for (let i = 0; i < wisps; i++) {
        const ang = (i / wisps) * TAU + e * 2.4 + a.id
        const d = r * (1 - e * 0.6)
        blitCentered(ctx, REGIONAL_FX.wisp(), a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.6 - e * 8)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'barb':
      blitRotated(ctx, REGIONAL_FX.barb(), a.x, a.y, heading(a), Math.max(1, r / 4))
      return
    case 'toxicGlob': {
      // Lobbed: an arc up and down over its flight.
      const k = Math.min(1, a.age / TOXIC.flight)
      blitCentered(ctx, REGIONAL_FX.glob(), a.x, a.y - Math.sin(k * Math.PI) * 18)
      return
    }
    case 'bullCharge': {
      const dir = heading(a)
      const c = bullColors(a)
      ctx.globalAlpha = fadeOut(a, 0.12)
      // A wedge of the breed's color ahead (fire for Blaze, spray for Aqua), the horns leading.
      if (!detail.lean)
        for (let i = 0; i < 5; i++) {
          const spread = (hash2(a.id, i + Math.floor(t * 30)) - 0.5) * 16
          const bx = a.x - Math.cos(dir) * (4 + i * 3) - Math.sin(dir) * spread
          const by = a.y - Math.sin(dir) * (4 + i * 3) + Math.cos(dir) * spread
          px(ctx, bx, by, c[i % 3]!, 2, 2)
        }
      const horns = a.type === 'fire' ? REGIONAL_FX.horns.fire() : a.type === 'water' ? REGIONAL_FX.horns.water() : REGIONAL_FX.horns.fighting()
      blitRotated(ctx, horns, a.x + Math.cos(dir) * 9, a.y + Math.sin(dir) * 9, dir, Math.max(1, r / BULL.r))
      ctx.globalAlpha = 1
      return
    }
  }
}
