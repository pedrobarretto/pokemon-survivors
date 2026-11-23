import { blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { TYPE_COLORS } from '../data/types'
import { ROCKET_KIT } from '../game/rocketKitRules'
import type { Attack, Game } from '../game/types'
import { detail } from './quality'
import { ROCKET_FX } from './rocketKitArt'
import { dashedRing } from './strokes'

/**
 * How the Rocket Game Corner's prize families look (`game/rocketKitMoves.ts`):
 * their hitboxes, and what rides on the player (Ditto's copy running out,
 * Gimmighoul's coins, Absol's Omen over the doomed foe). Presentation only.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

/** The jaws: the upper one swinging down onto the lower one as `shut` goes 0 → 1. */
const drawJaws = (ctx: Ctx, x: number, y: number, shut: number, scale: number) => {
  const jaw = ROCKET_FX.jaw()
  const gap = Math.round((1 - shut) * 9 * scale)
  const w = Math.round(jaw.width * scale)
  const h = Math.round(jaw.height * scale)
  const lx = Math.round(x - w / 2)
  ctx.drawImage(jaw, lx, Math.round(y - h - gap), w, h)
  ctx.save()
  ctx.translate(lx, Math.round(y + gap + h))
  ctx.scale(1, -1)
  ctx.drawImage(jaw, 0, 0, w, h)
  ctx.restore()
}

export const drawRocketKitAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = a.shape.kind === 'circle' ? a.shape.r : 8
  switch (a.visual) {
    case 'transformSplash': {
      // Ditto's goo bursts out from the copied foe in the copied type's color.
      const k = Math.min(1, a.age / 0.3)
      ctx.globalAlpha = fadeOut(a, 0.15)
      blitEllipse(ctx, Math.round(r * k), Math.max(1, Math.round(r * k * 0.5)), TYPE_COLORS[a.type], a.x, a.y + 4)
      const goo = ROCKET_FX.goo()
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + a.id
        ctx.drawImage(goo, Math.round(a.x + Math.cos(ang) * r * k - 3), Math.round(a.y + Math.sin(ang) * r * k * 0.6 - 3 - (1 - k) * 4))
      }
      ctx.globalAlpha = 1
      return
    }
    case 'razorWind': {
      const v = a.motion.kind === 'linear' ? a.motion : { vx: 1, vy: 0 }
      blitRotated(ctx, ROCKET_FX.crescent(), a.x, a.y, Math.atan2(v.vy, v.vx), r > 9 ? 1.5 : 1)
      return
    }
    case 'omenFall':
      ctx.globalAlpha = fadeOut(a, 0.25)
      dashedRing(ctx, a.x, a.y + 4, r * Math.min(1, a.age / 0.12), a.id, ['#201838', '#5848a0', '#e8e0f8'], 1, 0.5)
      blitRotated(ctx, ROCKET_FX.crescentDark(), a.x, a.y, -0.6 + a.age * 3, 2)
      ctx.globalAlpha = 1
      return
    case 'coinRain': {
      // The coin spins down from above, lands at `activeFrom` and glints.
      const fall = Math.max(0, 0.3 - a.age) / 0.3
      const frame = ROCKET_FX.coin[Math.floor(t * 14 + a.id) % 4]!()
      if (fall > 0) {
        blitEllipse(ctx, 3, 1, 'rgba(0,0,0,0.35)', a.x, a.y + 3)
        ctx.drawImage(frame, Math.round(a.x - frame.width / 2), Math.round(a.y - 4 - fall * 56 - frame.height / 2))
        return
      }
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y + 2, r * Math.min(1, (a.age - 0.3) / 0.1), a.id, ['#f8c838', '#fff0a0', '#ffffff'], 1, 0.5)
      ctx.globalAlpha = 1
      return
    }
    case 'viseGrip':
      ctx.globalAlpha = fadeOut(a, 0.1)
      drawJaws(ctx, a.x, a.y, Math.min(1, a.age / 0.14), r / 14)
      ctx.globalAlpha = 1
      return
    case 'deceiverBite':
      ctx.globalAlpha = fadeOut(a, 0.1)
      drawJaws(ctx, a.x, a.y, Math.min(1, a.age / 0.1), 0.7)
      ctx.globalAlpha = 1
      return
  }
}

/** A small bar under the HP bar (Ditto's copy running out). */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** Gimmighoul's coins under the HP bar: a gauge to 999 (the evolution), then Gholdengo's stack. */
const drawCoins = (ctx: Ctx, x: number, y: number, coins: number, stage: number) => {
  const goal = ROCKET_KIT.coins.evolve
  drawMeter(ctx, x + 3, y, stage === 0 ? coins / goal : Math.min(1, coins / ROCKET_KIT.coins.cap), '#f8c838')
  const coin = ROCKET_FX.coinIcon()
  ctx.drawImage(coin, Math.round(x - 15 - coin.width / 2), y - 3, 6, 6)
}

export const drawRocketKitPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const kit = p.rocket
  if (!kit) return
  const y = Math.round(p.y + 9)
  switch (kit.kind) {
    case 'transform':
      if (kit.dex !== 0) drawMeter(ctx, p.x, y, kit.left / ROCKET_KIT.transform.hold, TYPE_COLORS[kit.type])
      return
    case 'coins':
      return drawCoins(ctx, p.x, y, kit.coins, p.stage)
    case 'omen': {
      if (kit.target === 0) return
      const foe = g.enemies.find((e) => e.id === kit.target)
      if (!foe) return
      const omen = ROCKET_FX.omen()
      const bob = detail.lean ? 0 : Math.round(Math.sin(t * 4) * 1.5)
      ctx.drawImage(omen, Math.round(foe.x - omen.width / 2), Math.round(foe.y - foe.radius * 2 - 16 + bob))
      return
    }
    case 'deceiver':
  }
}
