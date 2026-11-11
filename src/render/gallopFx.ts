import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { GALLOP } from '../game/gallopRules'
import type { Attack, Game, Player } from '../game/types'
import { GALLOP_FX } from './gallopArt'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How Ponyta's gallop batch looks (`game/gallopMoves.ts`): the erupting
 * earth, the kicks, the drills, the morning sun and the hops' landings, and
 * how high a hop lifts the player (`gallopLift`). Presentation only; whole
 * pixels (rotated sprites keep their chunky pixels at the low resolution).
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/** A ring flattened onto the ground (`squash`), growing to `r` over `grow` s. */
const groundRing = (ctx: Ctx, a: Attack, r: number, grow: number, colors: readonly string[], density = 0.6) =>
  dashedRing(ctx, a.x, a.y + 2, Math.max(2, r * Math.min(1, a.age / grow)), a.id, colors, density, 0.45)

/** A few chunks flung from (x, y), by the attack's id so each eruption scatters its own way. */
const chunks = (ctx: Ctx, a: Attack, x: number, y: number, count: number, reach: number, color: string) => {
  const k = Math.min(1, a.age / 0.25)
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + ((i / Math.max(1, count - 1)) - 0.5) * 2.2 + (a.id % 7) * 0.05
    const d = reach * k
    // A short arc: out, then down again.
    ctx.fillRect(Math.round(x + Math.cos(ang) * d), Math.round(y + Math.sin(ang) * d + k * k * reach * 0.9), 2, 2)
  }
}

export const drawGallopAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'gallopQuake': {
      if (a.age < 0) return
      const r = radiusOf(a)
      const fade = fadeOut(a, 0.15)
      ctx.globalAlpha = fade
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(1, Math.round(r * 0.3)), 'rgba(40,24,8,0.4)', a.x, a.y + 2)
      blitCentered(ctx, GALLOP_FX.crack(), a.x, a.y + 2)
      // A full gallop throws the earth up tallest (`memo`: the cast's momentum).
      const size = a.memo >= 0.85 ? 2 : a.memo >= 0.55 ? 1 : 0
      const rise = Math.round(Math.min(1, a.age / 0.08) * (3 + size * 2))
      const plume = GALLOP_FX.plume[size]!()
      ctx.drawImage(plume, Math.round(a.x - plume.width / 2), Math.round(a.y - plume.height + 3 - rise + (1 - fade) * 4))
      if (!detail.lean) chunks(ctx, a, a.x, a.y - 2, 3 + size, 6 + size * 3, '#8a5a28')
      ctx.globalAlpha = 1
      return
    }
    case 'gallopPillar': {
      if (a.age < 0) return
      const fade = fadeOut(a, 0.15)
      ctx.globalAlpha = fade
      blitCentered(ctx, GALLOP_FX.crack(), a.x, a.y + 2)
      const pillar = GALLOP_FX.pillar()
      // Thrust up fast, then holds; sinks back as it goes.
      const up = Math.min(1, a.age / 0.07) * (0.6 + 0.4 * fade)
      const h = Math.max(2, Math.round(pillar.height * up))
      ctx.drawImage(pillar, 0, 0, pillar.width, h, Math.round(a.x - pillar.width / 2), Math.round(a.y + 3 - h), pillar.width, h)
      if (a.age < 0.2 && !detail.lean) chunks(ctx, a, a.x, a.y - 4, 4, 9, '#9a8468')
      ctx.globalAlpha = 1
      return
    }
    case 'lowKick': {
      if (a.motion.kind !== 'orbit') return
      // The outer segment draws the swoosh: an arc from where the sweep began to where it is, thick and fading at its tail.
      if (a.motion.radius < GALLOP.lowKick.length * 0.7) return
      const m = a.motion
      const k = a.age / a.ttl
      const cx = a.x - Math.cos(m.angle) * m.radius
      const cy = a.y - Math.sin(m.angle) * m.radius
      const swept = m.spin * a.age
      const steps = Math.max(6, Math.round(Math.abs(swept) * m.radius * 0.7))
      ctx.globalAlpha = Math.max(0, 1 - k * 0.5)
      for (let i = 0; i <= steps; i++) {
        const f = i / steps
        const ang = m.angle - swept * (1 - f)
        // Thin at the tail, three pixels at the head; the light core sits outside, the orange edge in.
        const w = 1 + Math.round(f * 2)
        for (let j = 0; j < w; j++) {
          const r = m.radius - j
          ctx.fillStyle = j === 0 ? '#ffffff' : j === 1 ? '#f8c880' : '#e86830'
          ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + 4 + Math.sin(ang) * r * 0.6), 1, 1)
        }
      }
      // Dust kicked up where the hoof is now.
      if (!detail.lean) {
        ctx.fillStyle = '#d8c0a0'
        ctx.fillRect(Math.round(a.x - 2), Math.round(a.y + 6), 2, 1)
        ctx.fillRect(Math.round(a.x + 1), Math.round(a.y + 5), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'axeKick': {
      const fade = fadeOut(a, 0.2)
      ctx.globalAlpha = fade
      blitRotated(ctx, a.age < 0.08 ? GALLOP_FX.impact() : GALLOP_FX.impactRed(), a.x, a.y - 4, 0, a.age < 0.12 ? 2 : 1)
      blitRotated(ctx, GALLOP_FX.hoof(), a.x, a.y - 10 + Math.round(Math.min(1, a.age / 0.1) * 2), 0, 2)
      ctx.globalAlpha = 1
      return
    }
    case 'axeRing':
      if (a.age < 0) return
      ctx.globalAlpha = fadeOut(a, 0.12)
      groundRing(ctx, a, radiusOf(a), 0.01, ['#e05830', '#f8c048', '#ffffff'], 0.7)
      ctx.globalAlpha = 1
      return
    case 'hornDrill': {
      // On the foe, pointing the way it came from the player, its spiral turning.
      const ang = Math.atan2(a.y - a.from.y, a.x - a.from.x)
      const frames = a.move === 'hyperDrill' ? GALLOP_FX.drillGold : GALLOP_FX.drill
      const frame = frames[Math.floor(t * 30 + a.id) % 2]!()
      const back = Math.round(6 - Math.min(1, a.age / 0.08) * 4)
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, frame, a.x - Math.cos(ang) * (back + 8), a.y - Math.sin(ang) * (back + 8), ang)
      if (!detail.lean && Math.floor(t * 20 + a.id) % 2 === 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(a.x + Math.cos(ang + 2) * 4), Math.round(a.y + Math.sin(ang + 2) * 4), 1, 1)
        ctx.fillRect(Math.round(a.x + Math.cos(ang - 2) * 5), Math.round(a.y + Math.sin(ang - 2) * 5), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hornBlow': {
      // Waits on the foe until the bores are done; its one hit pushes `tether.next` 99 s on, so from then it bursts.
      if (a.motion.kind !== 'tether' || a.motion.next < 50) return
      const since = a.age - (a.motion.next - 99)
      if (since < 0) return
      ctx.globalAlpha = Math.max(0, 1 - since / 0.3)
      blitRotated(ctx, since < 0.06 ? GALLOP_FX.impact() : GALLOP_FX.impactRed(), a.x, a.y, 0, since < 0.1 ? 2 : 1)
      dashedRing(ctx, a.x, a.y, 6 + since * 70, a.id, ['#ffffff', '#f8c048'], 0.7)
      ctx.globalAlpha = 1
      return
    }
    case 'hyperLance': {
      if (a.age < 0 || a.motion.kind !== 'linear') return
      blitRotated(ctx, GALLOP_FX.lance(), a.x, a.y, Math.atan2(a.motion.vy, a.motion.vx))
      return
    }
    case 'morningSun':
    case 'revivalFlare': {
      const pink = a.visual === 'revivalFlare'
      const r = radiusOf(a)
      // The sun rises over the head and fades; the halo spreads once.
      const k = Math.min(1, a.age / 0.25)
      const fade = fadeOut(a, 0.25)
      ctx.globalAlpha = fade
      const sun = pink ? GALLOP_FX.sunPink() : GALLOP_FX.sun()
      const sy = a.y - 18 - Math.round(k * 6)
      if (!detail.lean) {
        // Rays: short dashes turning around the disc, longer under a sunny sky (`tier`).
        ctx.fillStyle = pink ? '#f8a0c8' : '#f8c040'
        const rays = 8
        const len = a.tier > 0 ? 5 : 3
        for (let i = 0; i < rays; i++) {
          const ang = (i / rays) * TAU + a.age * 1.5
          for (let s = 0; s < len; s++) ctx.fillRect(Math.round(a.x + Math.cos(ang) * (8 + s)), Math.round(sy + Math.sin(ang) * (8 + s)), 1, 1)
        }
      }
      blitCentered(ctx, sun, a.x, sy)
      const spread = Math.min(1, a.age / 0.18)
      dashedRing(ctx, a.x, a.y + 6, Math.max(3, r * spread), a.id, pink ? ['#f8a0c8', '#fff0a0', '#ffffff'] : ['#f8c040', '#fff0a0', '#ffffff'], a.tier > 0 ? 0.75 : 0.55, 0.5)
      ctx.globalAlpha = 1
      return
    }
    case 'bounceLand': {
      if (a.age < 0) return
      const r = radiusOf(a) * Math.min(1, a.age / 0.1)
      ctx.globalAlpha = fadeOut(a, 0.18)
      blitEllipse(ctx, Math.round(radiusOf(a) * 0.35), Math.max(1, Math.round(radiusOf(a) * 0.12)), 'rgba(24,40,72,0.3)', a.x, a.y + 2)
      // A solid shock ring with a lighter one inside it, gold once the crescendo builds.
      dashedRing(ctx, a.x, a.y + 2, Math.max(2, r), a.id, ['#ffffff'], 1, 0.42)
      dashedRing(ctx, a.x, a.y + 2, Math.max(1, r - 2), a.id, [a.tier >= 2 ? '#f8d048' : '#88c0f0'], 0.7, 0.42)
      if (!detail.lean) chunks(ctx, a, a.x, a.y, 4, 6 + a.tier * 2, '#e8f4ff')
      ctx.globalAlpha = 1
      return
    }
    case 'skyDive': {
      const r = radiusOf(a)
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitRotated(ctx, a.age < 0.08 ? GALLOP_FX.impact() : GALLOP_FX.impactRed(), a.x, a.y - 4, 0, 2)
      groundRing(ctx, a, r, 0.12, ['#ffffff', '#88b8f0', '#f8d048'], 0.75)
      ctx.globalAlpha = 1
      return
    }
  }
}

/**
 * What the gallop batch shows before a hit lands (the scene's attack pass
 * skips dormant hitboxes): Axe Kick's hoof dropping onto its warning, Sky
 * Drop's dive falling onto its own.
 */
export const drawGallopAir = (ctx: Ctx, g: Game, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age >= 0 || !visible(a.x, a.y, 120)) continue
    if (a.visual === 'axeKick') {
      const delay = GALLOP.axeKick.delay
      const k = Math.max(0, 1 + a.age / delay)
      const hoof = GALLOP_FX.hoof()
      ctx.globalAlpha = 0.35 + 0.65 * k
      // Its shadow grows on the ground as it comes down.
      blitEllipse(ctx, Math.max(1, Math.round(3 + k * 4)), Math.max(1, Math.round(1 + k * 1.5)), 'rgba(24,8,8,0.35)', a.x, a.y + 2)
      const hy = Math.round(a.y - hoof.height - 4 - (1 - k) * 48)
      // Speed lines trailing up from it, then the hoof at twice its size (a whole-number scale keeps the grid).
      if (!detail.lean) {
        ctx.fillStyle = '#ffffff'
        for (const dx of [-6, 0, 6]) ctx.fillRect(Math.round(a.x + dx), hy - 16 - Math.abs(dx), 1, 8)
      }
      blitRotated(ctx, hoof, a.x, hy, 0, 2)
      ctx.globalAlpha = 1
    } else if (a.visual === 'skyDive') {
      const fall = -a.age / 0.4
      if (fall >= 1) continue
      const streak = GALLOP_FX.streak()
      blitEllipse(ctx, Math.max(1, Math.round(4 + (1 - fall) * 6)), Math.max(1, Math.round(1 + (1 - fall) * 2)), 'rgba(8,24,48,0.35)', a.x, a.y + 2)
      blitRotated(ctx, streak, a.x, Math.round(a.y - streak.height - 6 - fall * 80), 0, 2)
    }
  }
}

/**
 * How high the player's hops (Bounce, Sky Drop) lift its sprite now: an arc
 * up to the next pending landing, 0 when none is coming. The sprite keeps its
 * worn look (only its height changes).
 */
export const gallopLift = (g: Game, p: Player) => {
  let lift = 0
  for (const a of g.attacks) {
    if (a.visual !== 'bounceLand' || a.owner !== p.slot || a.age >= 0) continue
    const o = a.move === 'skyDrop' ? GALLOP.skyDrop : GALLOP.bounce
    if (a.age < -o.hop) continue
    const k = (a.age + o.hop) / o.hop
    lift = Math.max(lift, Math.sin(k * Math.PI) * o.lift * (1 + 0.15 * a.tier))
  }
  return Math.round(lift)
}
