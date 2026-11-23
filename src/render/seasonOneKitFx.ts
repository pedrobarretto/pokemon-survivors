import { blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { TYPE_COLORS } from '../data/types'
import { KIT, kitMeter } from '../game/seasonOneKitRules'
import type { Attack, Game } from '../game/types'
import { detail } from './quality'
import { KIT_FX } from './seasonOneKitArt'
import { dashedRing } from './strokes'
import { drawPokemon, sprites } from './sprites'

/**
 * How Temporada 1's mechanic families look (`game/seasonOneKitMoves.ts`):
 * their hitboxes, and what rides on the player (the mice, Tatsugiri's
 * Dondozo, the meters and stacks). Presentation only.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

export const drawSeasonKitGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.visual !== 'slime' || a.shape.kind !== 'circle') return
  ctx.globalAlpha = Math.min(0.85, fadeOut(a, 0.5))
  const wob = Math.floor(t * 3 + a.id) % 2
  blitEllipse(ctx, a.shape.r + wob, Math.max(2, Math.round(a.shape.r * 0.5)), 'rgba(120,96,184,0.55)', a.x, a.y)
  ctx.drawImage(KIT_FX.slime(), Math.round(a.x - 5), Math.round(a.y - 3))
  ctx.globalAlpha = 1
}

const drawGrowingRing = (ctx: Ctx, a: Attack, colors: readonly string[], squash = 0.55) => {
  if (a.shape.kind !== 'circle') return
  ctx.globalAlpha = fadeOut(a, 0.2)
  dashedRing(ctx, a.x, a.y, a.shape.r, a.id, colors, 1, squash)
  ctx.globalAlpha = 1
}

export const drawSeasonKitAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = a.shape.kind === 'circle' ? a.shape.r : 8
  switch (a.visual) {
    case 'kitCross':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, KIT_FX.cross(), a.x, a.y, t * 12 + a.id)
      ctx.globalAlpha = 1
      return
    case 'kitClaw':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, KIT_FX.claw(), a.x, a.y, t * 8 + a.id, 1.2)
      ctx.globalAlpha = 1
      return
    case 'dragonPulse': return drawGrowingRing(ctx, a, ['#7048d8', '#d0b8f8', '#ffffff'])
    case 'waterPulse': return drawGrowingRing(ctx, a, ['#58a8e8', '#d8f0f8'])
    case 'miceBite':
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 3; i++) ctx.fillRect(Math.round(a.x + Math.cos((i / 3) * TAU + a.id) * 5), Math.round(a.y + Math.sin((i / 3) * TAU + a.id) * 3), 1, 1)
      return
    case 'auraWheel':
      blitRotated(ctx, a.type === 'dark' ? KIT_FX.wheelDark() : KIT_FX.wheelElectric(), a.x, a.y, t * 14, r > 7 ? 1.5 : 1)
      return
    case 'zenOrb':
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(1, Math.round(r * 0.4)), 'rgba(120,80,200,0.3)', a.x, a.y + 12)
      blitRotated(ctx, KIT_FX.zenOrb(), a.x, a.y, t * 3, r / 6)
      return
    case 'commandSlam': return drawGrowingRing(ctx, a, ['#e87858', '#f8c0a0', '#d8c080'], 0.5)
    case 'orderUp': return drawGrowingRing(ctx, a, [TYPE_COLORS.dragon, '#f8a878', '#ffffff'], 0.7)
  }
}

/** A small bar under the HP bar: a School or Commander meter, the time left while it runs. */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string, on: boolean) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = on ? '#ffffff' : color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** Pips under the HP bar: Rage, Supreme Overlord and the mice's stacks. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

export const drawSeasonKitPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const kit = p.kit
  if (!kit) return
  const y = Math.round(p.y + 9)
  const meter = kitMeter(kit)
  if (meter) drawMeter(ctx, p.x, y, meter.fill, meter.locked ? '#606878' : kit.kind === 'school' ? '#58a8e8' : '#e87858', meter.on)
  if (kit.kind === 'rage') drawPips(ctx, p.x, y, kit.stacks, KIT.rage.cap[Math.min(p.stage, KIT.rage.cap.length - 1)]!, '#f05838')
  if (kit.kind === 'supreme') drawPips(ctx, p.x, y, kit.stacks, KIT.supreme.cap, '#d84848')
  if (kit.kind === 'mice') {
    const walk = KIT_FX.mouse[Math.floor(t * 12) % 2]!
    for (const m of kit.mice) ctx.drawImage(walk(), Math.round(m.x - 5), Math.round(m.y - 6))
  }
  if (kit.kind === 'exit' && kit.cooldown > 0) drawMeter(ctx, p.x, y, 1 - kit.cooldown / KIT.exit.cooldown, '#a0a8b0', false)
  if (kit.kind === 'disguise' && kit.down > 0) drawMeter(ctx, p.x, y, 1 - kit.down / KIT.disguise.cooldown, '#d8c890', false)
  if (kit.kind === 'commander' && kit.left > 0) {
    // Tatsugiri rides inside: Dondozo walks where it walks, drawn over the player.
    const s = sprites(977, false)
    drawPokemon(ctx, s, p.moving ? 'Walk' : 'Idle', p.dir, p.animTime, p.x, p.y, {})
    if (!detail.lean) dashedRing(ctx, p.x, p.y, 40, 0, ['#e87858', '#f8c0a0'], 0.8, 0.45)
  }
}
