import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { dir8, TAU } from '../engine/math'
import { TYPE_COLORS } from '../data/types'
import { atStage, GA_KIT, gaKitAMeter, shellOut } from '../game/gaKitARules'
import type { Attack, Game } from '../game/types'
import { GA_KIT_A_FX } from './gaKitAArt'
import { detail } from './quality'
import { dashedRing } from './strokes'
import { drawPokemon, sprites } from './sprites'

/**
 * How the big update's first 15 families look (`game/gaKitAMoves.ts`): their
 * hitboxes, and what rides on the player (the meters and pips, Electivire's
 * cables, Lapras's wake and the Shedinja beside Ninjask). Presentation only.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const radius = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/** The angle a hitbox glued to the player points at (its offset), else 0. */
const facing = (a: Attack) => (a.motion.kind === 'follow' ? Math.atan2(a.motion.oy + 8, a.motion.ox) : 0)

/** Hitboxes drawn on the ground, under the bodies: the tea and the sliding shadows. */
export const drawGaKitAGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = radius(a)
  if (a.visual === 'gaTea') {
    const fade = Math.min(1, a.age / 0.15) * fadeOut(a, 0.6)
    // Tea spilled on the grass: a dark brew with a thin edge, a ripple turning in it and a glint; the Antique Form's twinkles gold.
    const ry = Math.max(3, Math.round(r * 0.5))
    ctx.globalAlpha = 0.75 * fade
    blitEllipse(ctx, r, ry, '#2a1006', a.x, a.y)
    blitEllipse(ctx, r - 1, ry - 1, '#6a2a0c', a.x, a.y)
    blitEllipse(ctx, Math.max(1, r - 4), Math.max(1, ry - 2), '#843814', a.x + 1, a.y + 1)
    ctx.globalAlpha = fade
    dashedRing(ctx, a.x, a.y, Math.max(2, r * 0.55), Math.floor(t * 4) + a.id, ['#b86030'], 0.35, ry / r)
    ctx.fillStyle = '#f0c890'
    ctx.fillRect(Math.round(a.x - r * 0.4), Math.round(a.y - ry * 0.4), 3, 1)
    if (a.flip) {
      ctx.fillStyle = '#f8e070'
      const blink = Math.floor(t * 6 + a.id) % 3
      ctx.fillRect(Math.round(a.x + r * 0.35), Math.round(a.y - ry * 0.2), 1, 1)
      if (blink === 0) ctx.fillRect(Math.round(a.x - r * 0.1), Math.round(a.y + ry * 0.4), 1, 1)
      if (blink === 1) ctx.fillRect(Math.round(a.x + r * 0.6), Math.round(a.y + ry * 0.3), 1, 1)
    }
    if (!detail.lean) {
      const rise = (t * 10 + a.id * 3) % 8
      blitCentered(ctx, GA_KIT_A_FX.steam(), a.x + ((a.id % 3) - 1) * 4, a.y - 4 - Math.floor(rise))
    }
    ctx.globalAlpha = 1
    return
  }
  if (a.visual === 'gaShadow') {
    blitEllipse(ctx, Math.round(r * 0.9), Math.max(2, Math.round(r * 0.4)), 'rgba(24,12,40,0.75)', a.x, a.y)
    blitEllipse(ctx, Math.round(r * 0.5), 1, '#6848a8', a.x, a.y)
  }
}

export const drawGaKitAAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = radius(a)
  switch (a.visual) {
    case 'gaRing':
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r, a.id, [TYPE_COLORS[a.type], '#ffffff', '#f8d048'], 1, 0.6)
      ctx.globalAlpha = 1
      return
    case 'gaCroak':
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#a048c0', '#e8a8f8', '#58e858'], 1, 0.6)
      ctx.globalAlpha = 1
      return
    case 'gaSing': {
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#f8b8d0', '#ffffff'], 0.6, 0.6)
      // Notes ride the ring.
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + a.id
        blitCentered(ctx, GA_KIT_A_FX.note(), a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6 - 3)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'gaChop':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, GA_KIT_A_FX.chop(), a.x, a.y, facing(a) + (a.flip ? -0.6 : 0.6), 1.5)
      ctx.globalAlpha = 1
      return
    case 'gaGuillotine':
      ctx.globalAlpha = fadeOut(a, 0.12)
      blitRotated(ctx, GA_KIT_A_FX.guillotine(), a.x, a.y, facing(a) + 0.5, 3)
      ctx.globalAlpha = 1
      return
    case 'gaClaw':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, GA_KIT_A_FX.claw(), a.x, a.y, a.flip ? -0.4 : 0.4)
      ctx.globalAlpha = 1
      return
    case 'gaShedClaw':
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRotated(ctx, GA_KIT_A_FX.shedClaw(), a.x, a.y, a.flip ? -0.5 : 0.5)
      ctx.globalAlpha = 1
      return
    case 'gaHorn':
      blitRotated(ctx, GA_KIT_A_FX.horn(), a.x, a.y, facing(a) + Math.PI / 4)
      return
    case 'gaBow':
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRotated(ctx, GA_KIT_A_FX.spike(), a.x, a.y - 2, a.flip ? -Math.PI / 4 : Math.PI / 4, 1.5)
      ctx.globalAlpha = 1
      return
    case 'gaShadow': {
      // Spikes of shadow rise where it passes.
      const up = Math.floor((t * 12 + a.id) % 3)
      ctx.fillStyle = '#6848a8'
      for (let i = -1; i <= 1; i++) ctx.fillRect(Math.round(a.x + i * 4), Math.round(a.y - 3 - ((i + up) % 2) * 2), 1, 3)
      return
    }
    case 'gaGem':
      blitRotated(ctx, (a.id % 2 === 0 ? GA_KIT_A_FX.gem[0]! : GA_KIT_A_FX.gem[1]!)(), a.x, a.y, Math.round(t * 8) * (Math.PI / 4))
      return
    case 'gaWisp':
      blitCentered(ctx, GA_KIT_A_FX.wisp[Math.floor((t * 8 + a.id) % 2)]!(), a.x, a.y + Math.round(Math.sin(t * 6 + a.id) * 1.5))
      return
    case 'gaJab':
      blitRotated(ctx, GA_KIT_A_FX.jab(), a.x, a.y, facing(a))
      return
    case 'gaPunch':
      blitRotated(ctx, GA_KIT_A_FX.punch(), a.x, a.y, facing(a))
      return
    case 'gaSpark':
      blitRotated(ctx, GA_KIT_A_FX.spark(), a.x, a.y, Math.floor(t * 20) * (Math.PI / 2))
      return
    case 'gaWing':
      blitRotated(ctx, GA_KIT_A_FX.feather(), a.x, a.y, a.motion.kind === 'orbit' ? a.motion.angle : 0)
      return
    case 'gaZap': {
      ctx.globalAlpha = fadeOut(a, 0.08)
      dashedRing(ctx, a.x, a.y, r, a.id + Math.floor(t * 30), ['#f8d030', '#ffffff'], 0.5, 1)
      ctx.globalAlpha = 1
      return
    }
    case 'gaFlame':
      blitCentered(ctx, GA_KIT_A_FX.flame[Math.floor((t * 10 + a.id) % 2)]!(), a.x, a.y)
      return
    case 'gaFlameSplash':
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r * Math.min(1, 0.4 + a.age * 4), a.id, ['#f88830', '#f8e060', '#c83010'], 0.8, 0.6)
      ctx.globalAlpha = 1
      return
    case 'gaBite':
      ctx.globalAlpha = fadeOut(a, 0.06)
      blitRotated(ctx, GA_KIT_A_FX.jaws(), a.x, a.y, facing(a) + Math.PI / 2)
      ctx.globalAlpha = 1
      return
    case 'gaPlate':
      blitRotated(ctx, GA_KIT_A_FX.plate(), a.x, a.y, Math.round(t * 10 + a.id) * (Math.PI / 4))
      return
  }
}

/** A small bar under the HP bar. */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string, on: boolean) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = on ? '#ffffff' : color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** Pips under the HP bar: stacks, plates, sacs, wisps. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

/** A hard-edged 1 px line from (x0, y0) to (x1, y1). */
const pixelLine = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number) => {
  const steps = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let i = 0; i <= steps; i++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * i) / steps), Math.round(y0 + ((y1 - y0) * i) / steps), 1, 1)
}

/** A crackling cable from (x0, y0) to (x1, y1): one of Electivire's, zigzagging a little differently each frame. */
const cable = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, seed: number) => {
  const len = Math.hypot(x1 - x0, y1 - y0)
  const n = Math.max(2, Math.floor(len / 7))
  const nx = -(y1 - y0) / (len || 1)
  const ny = (x1 - x0) / (len || 1)
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const k = i / n
    const j = i === 0 || i === n ? 0 : (((seed * 7 + i * 13) % 5) - 2) * 1.2
    return { x: x0 + (x1 - x0) * k + nx * j, y: y0 + (y1 - y0) * k + ny * j }
  })
  for (const [color, dy] of [['#6a4a08', 1], ['#f8e060', 0]] as const) {
    ctx.fillStyle = color
    for (let i = 0; i < n; i++) pixelLine(ctx, pts[i]!.x, pts[i]!.y + dy, pts[i + 1]!.x, pts[i + 1]!.y + dy)
  }
  ctx.fillStyle = '#ffffff'
  const spark = pts[(seed % n) + 0]!
  ctx.fillRect(Math.round(spark.x), Math.round(spark.y), 1, 1)
  blitCentered(ctx, GA_KIT_A_FX.spark(), x1, y1)
}

/** Under the player: Lapras's wake while it floats. */
export const drawGaKitAPlayerGround = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const k = p.kitA
  if (k?.kind !== 'ferry' || !k.afloat) return
  const wob = Math.floor(t * 4) % 2
  dashedRing(ctx, p.x, p.y + 1, 16 + wob, Math.floor(t * 6), ['#d8f0f8', '#ffffff'], 0.5, 0.4)
}

/** Over the player: meters, pips, the cables and the Shedinja. */
export const drawGaKitAPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const k = p.kitA
  if (!k) return
  const y = Math.round(p.y + 9)
  const meter = gaKitAMeter(k, p.stage)
  if (meter) drawMeter(ctx, p.x, y, meter.fill, meter.color, meter.on)
  switch (k.kind) {
    case 'soul':
      if (k.left > 0) dashedRing(ctx, p.x, p.y - 12, 20 + (Math.floor(t * 6) % 2), Math.floor(t * 10), ['#f8d048', '#e86848'], 0.5, 0.8)
      return
    case 'mischief':
      // The hair coiled into muscle: a dark and pink crackle around the body while it lasts.
      if (k.left > 0) dashedRing(ctx, p.x, p.y - 12, 18 + (Math.floor(t * 8) % 2), Math.floor(t * 14), ['#f878b0', '#401828'], 0.6, 0.9)
      return
    case 'dance': return drawPips(ctx, p.x, y, k.stacks, atStage(GA_KIT.dance.cap, p.stage), '#9878f0')
    case 'hunt': return k.stacks > 0 ? drawPips(ctx, p.x, y, k.stacks, atStage(GA_KIT.hunt.cap, p.stage), '#a8c8f0') : undefined
    case 'hoard':
      drawMeter(ctx, p.x, y, k.gems / (p.mega.active > 0 && p.mega.stone === 'sableye' ? GA_KIT.hoard.megaNeed : GA_KIT.hoard.need), '#f85878', false)
      // Mega Sableye's gem turns in front of it, catching shots.
      if (p.mega.active > 0 && p.mega.stone === 'sableye') blitRotated(ctx, GA_KIT_A_FX.gem[0]!(), p.x + Math.cos(t * 3) * 10, p.y - 12, Math.floor(t * 6) * (Math.PI / 4), 2)
      return
    case 'spirits': return k.wisps > 0 ? drawPips(ctx, p.x, y, k.wisps, 9, '#a8f0c8') : undefined
    case 'sacs': return drawPips(ctx, p.x, y, k.sacs, GA_KIT.sacs.need, '#c060e0')
    case 'plates': return drawPips(ctx, p.x, y, k.plates, atStage(GA_KIT.plates.cap, p.stage), '#c8d0e0')
    case 'fur':
      if (k.charge >= 1 && !detail.lean && Math.floor(t * 8) % 2 === 0) blitCentered(ctx, GA_KIT_A_FX.spark(), p.x + ((Math.floor(t * 8) % 3) - 1) * 8, p.y - 18)
      return
    case 'cables':
      for (const id of k.links) {
        const e = g.enemies.find((f) => f.id === id && f.dying < 0)
        if (e) cable(ctx, p.x, p.y - 14, e.x, e.y - e.radius, Math.floor(t * 24) + id)
      }
      return
    case 'heat':
      if (k.vent > 0 && !detail.lean) blitCentered(ctx, GA_KIT_A_FX.steam(), p.x + Math.round(Math.sin(t * 9) * 6), p.y - 26 - Math.floor((t * 12) % 6))
      return
    case 'shell': {
      if (!k.shed || !shellOut(p.stage, p.branch)) return
      // The shell left behind, Shedinja, hovers a step behind and claws what comes near.
      const s = sprites(292, p.shiny)
      const dir = dir8(p.x - k.shed.x, p.y - 14 - k.shed.y)
      ctx.globalAlpha = 0.95
      drawPokemon(ctx, s, 'Idle', dir, p.animTime, Math.round(k.shed.x), Math.round(k.shed.y + 14 + Math.sin(t * 3) * 1.5), {})
      ctx.globalAlpha = 1
      return
    }
    default:
  }
}
