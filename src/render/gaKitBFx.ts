import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { atStage, KIT_B } from '../game/gaKitBRules'
import { segmentAt } from '../game/gaKitBSystem'
import { localPlayer } from '../game/players'
import type { Attack, Game } from '../game/types'
import { KIT_B_FX } from './gaKitBArt'
import { hash2 } from '../engine/rng'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How the second batch's families look (`game/gaKitBMoves.ts`,
 * `game/gaKitBSystem.ts`): their hitboxes, what lies around the player
 * (Onix's body, Happiny's eggs, the snowfall, Queenly Majesty's ring) and what
 * rides on it (the bubble, the jets, the latch, the stacks and meters).
 * Presentation only; whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const headingOf = (a: Attack) => (a.motion.kind === 'linear' || a.motion.kind === 'homing' || a.motion.kind === 'lunge' ? Math.atan2(a.motion.vy, a.motion.vx) : 0)

const ring = (ctx: Ctx, a: Attack, colors: readonly string[], squash: number) => {
  if (a.shape.kind !== 'circle') return
  ctx.globalAlpha = fadeOut(a, 0.18)
  dashedRing(ctx, a.x, a.y, a.shape.r, a.id, colors, 0.9, squash)
  ctx.globalAlpha = 1
}

/** A pixel zigzag from (x0, y0) to (x1, y1): the latch's current, Skorupi's tail. */
const zigzag = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, seed: number, jag: number) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.max(1, Math.hypot(dx, dy))
  const steps = Math.max(2, Math.floor(len / 5))
  const nx = -dy / len
  const ny = dx / len
  ctx.fillStyle = color
  let px = x0
  let py = y0
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const off = i === steps ? 0 : (hash2(seed, i, 7) - 0.5) * jag
    const x = x0 + dx * k + nx * off
    const y = y0 + dy * k + ny * off
    const n = Math.max(1, Math.round(Math.hypot(x - px, y - py)))
    for (let j = 0; j < n; j++) ctx.fillRect(Math.round(px + ((x - px) * j) / n), Math.round(py + ((y - py) * j) / n), 1, 1)
    px = x
    py = y
  }
}

export const drawKitBAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'kitBEgg': {
      if (a.age >= 0) return ring(ctx, a, ['#f8f0e0', '#f090a8', '#ffffff'], 0.6)
      // The lob: from the thrower to where it lands, over an arc.
      const k = Math.max(0, Math.min(1, 1 + a.age / 0.5))
      const x = a.from.x + (a.x - a.from.x) * k
      const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 26
      return blitRotated(ctx, KIT_B_FX.egg(), x, y, k * 6)
    }
  }
  if (a.age < 0) return
  switch (a.visual) {
    case 'kitBTail':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, KIT_B_FX.tail(), a.x, a.y, a.motion.kind === 'orbit' ? a.motion.angle + Math.PI / 2 : 0)
      ctx.globalAlpha = 1
      return
    case 'kitBSphere': {
      const big = a.tier === 1
      const r = a.shape.kind === 'circle' ? a.shape.r : 6
      if (big && !detail.lean) dashedRing(ctx, a.x, a.y, r + 2 + (Math.floor(t * 20) % 2), a.id, ['#88c0f8', '#ffffff'], 0.7, 1)
      return blitRotated(ctx, KIT_B_FX.sphere(), a.x, a.y, t * 6, big ? 2 : 1)
    }
    case 'kitBWing':
    case 'kitBSpark': {
      const back = headingOf(a) + Math.PI
      ctx.fillStyle = a.visual === 'kitBSpark' ? '#f8e060' : a.tier === 1 ? '#ffffff' : '#f8c8a0'
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 4
        for (let k = 2; k < 9; k += 2) ctx.fillRect(Math.round(a.x + Math.cos(back) * k - Math.sin(back) * off), Math.round(a.y + Math.sin(back) * k + Math.cos(back) * off), 1, 1)
      }
      if (a.visual === 'kitBSpark') blitRotated(ctx, KIT_B_FX.spark(), a.x, a.y, Math.floor(t * 12) * 0.8)
      return
    }
    case 'kitBFist':
      return blitRotated(ctx, a.type === 'ice' ? KIT_B_FX.fistIce() : KIT_B_FX.fistGhost(), a.x, a.y, headingOf(a), a.shape.kind === 'circle' && a.shape.r > 10 ? 1.5 : 1)
    case 'kitBSalt':
      return blitRotated(ctx, KIT_B_FX.salt(), a.x, a.y, t * 8 + a.id)
    case 'kitBCut':
      return blitRotated(ctx, KIT_B_FX.cut(), a.x, a.y, headingOf(a), a.shape.kind === 'circle' && a.shape.r > 7 ? 1.5 : 1)
    case 'kitBCharge': {
      const k = a.age / Math.max(0.01, a.ttl)
      ctx.fillStyle = Math.floor(t * 16) % 2 === 0 ? '#ffffff' : '#f8d030'
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + t * 5
        const r = 14 * (1 - k) + 3
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * r), Math.round(a.y + Math.sin(ang) * r * 0.7), 2, 2)
      }
      return
    }
    case 'kitBShot': {
      const r = a.shape.kind === 'circle' ? a.shape.r : 6
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitEllipse(ctx, Math.round(r), Math.max(2, Math.round(r * 0.7)), '#f8d030', a.x, a.y)
      blitEllipse(ctx, Math.max(1, Math.round(r * 0.5)), Math.max(1, Math.round(r * 0.35)), '#ffffff', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'kitBKick':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, KIT_B_FX.kick(), a.x, a.y, a.motion.kind === 'orbit' ? a.motion.angle : 0)
      ctx.globalAlpha = 1
      return
    case 'kitBRing': return ring(ctx, a, ['#5868c8', '#e8d878', '#c070e0'], 0.6)
    case 'kitBSlam': return ring(ctx, a, ['#685028', '#a08048', '#d8c080'], 0.5)
    case 'kitBSplash': return ring(ctx, a, ['#58a8e8', '#d8f0f8', '#ffffff'], 0.6)
  }
}

/** What lies on the ground around a player of the batch: Onix's body, Happiny's eggs, the snowfall, the Majesty's ring. */
export const drawKitBGround = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitB
  if (!kit) return
  switch (kit.kind) {
    case 'serpent': {
      const art = p.stage >= 1 || p.mega.active > 0 ? KIT_B_FX.steel() : KIT_B_FX.boulder()
      // Tail first, so the segments nearer the head draw over it.
      for (let i = atStage(KIT_B.serpent.segments, p.stage); i >= 1; i--) {
        const at = segmentAt(kit, i)
        if (!at) continue
        if (!detail.lean) blitEllipse(ctx, 5, 2, 'rgba(24,24,16,0.28)', at.x, at.y + 2)
        blitCentered(ctx, art, at.x, at.y - 4)
      }
      return
    }
    case 'eggs':
      for (const egg of kit.eggs) {
        // A fading egg blinks in its last seconds.
        if (egg.left < 3 && Math.floor(egg.left * 6) % 2 === 0) continue
        const bob = Math.round(Math.sin(t * 3 + egg.x) * 1)
        if (!detail.lean) blitEllipse(ctx, 4, 1, 'rgba(24,24,16,0.28)', egg.x, egg.y + 4)
        blitCentered(ctx, KIT_B_FX.luckyEgg(), egg.x, egg.y - 2 + bob)
      }
      return
    case 'snowfall': {
      const r = atStage(KIT_B.snowfall.r, p.stage) * p.stats.area
      // The snowfall's edge on the ground, and flakes drifting down inside it.
      dashedRing(ctx, p.x, p.y - 2, r, Math.floor(t * 2), ['#ffffff', '#c8e8f8'], 0.35, 0.55)
      const flakes = detail.lean ? 12 : 26
      for (let i = 0; i < flakes; i++) {
        const fall = (t * 0.55 + hash2(i, 3, 11)) % 1
        const ang = hash2(i, 5, 13) * TAU
        const d = Math.sqrt(hash2(i, 7, 17)) * r
        const x = p.x + Math.cos(ang) * d + Math.sin(t * 2 + i) * 2
        const y = p.y + Math.sin(ang) * d * 0.55 - 30 + fall * 30
        ctx.globalAlpha = fall < 0.15 ? fall / 0.15 : 1
        if (i % 3 === 0) blitCentered(ctx, KIT_B_FX.flake(), x, y)
        else {
          ctx.fillStyle = '#ffffff'
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'majesty': {
      if (p.stage < 1 || detail.lean) return
      const r = atStage(KIT_B.majesty.r, p.stage)
      ctx.globalAlpha = kit.ready > 0 ? 0.25 : 0.55
      dashedRing(ctx, p.x, p.y - 8, r, Math.floor(t * 4), ['#f8d870', '#e86878'], 0.35, 0.6)
      ctx.globalAlpha = 1
      return
    }
    default:
  }
}

/** A small bar under the HP bar: a charge or a cooldown. */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** Pips under the HP bar: salt layers, Stamina, the Mega Launcher's count. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

/** What rides on a player of the batch: the bubble, the jets, the latch, Gale Wings' wind, the stacks and meters. */
export const drawKitBAir = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitB
  const y = Math.round(p.y + 9)
  // Eelektross' latch: the current to the foe it holds.
  for (const a of g.attacks) {
    if (a.visual !== 'kitBLatch' || a.owner !== p.slot || a.age >= a.ttl) continue
    zigzag(ctx, p.x, p.y - 12, a.x, a.y, Math.floor(t * 20) % 2 === 0 ? '#ffffff' : '#f8d030', Math.floor(t * 24) + a.id, 6)
  }
  if (!kit) return
  switch (kit.kind) {
    case 'launcher': {
      const every = atStage(KIT_B.launcher.every, p.stage)
      return drawPips(ctx, p.x, y, kit.shots, every - 1, '#88c0f8')
    }
    case 'gale': {
      if (!kit.on) return
      // Gale Wings: wind streaks streaming off the body, on both sides, trailing the way it flies.
      const back = Math.atan2(-p.facing.y, -p.facing.x)
      const side = back + Math.PI / 2
      const lines = detail.lean ? 3 : 5
      for (let i = 0; i < lines; i++) {
        const k = (t * 2.4 + i / lines) % 1
        const off = (i - (lines - 1) / 2) * 5
        const away = p.radius * 1.4 + 4 + k * 14
        const x0 = p.x + Math.cos(side) * off + Math.cos(back) * away
        const y0 = p.y - 12 + Math.sin(side) * off + Math.sin(back) * away * 0.7
        ctx.globalAlpha = 1 - k * 0.7
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : '#f8d8c8'
        for (let s = 0; s < 8; s++) ctx.fillRect(Math.round(x0 + Math.cos(back) * s), Math.round(y0 + Math.sin(back) * s * 0.7), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'jets': {
      if (kit.air > 0) {
        const flick = Math.floor(t * 18) % 2
        const lift = jetsLift(kit.air, kit.total)
        blitCentered(ctx, KIT_B_FX.flame(), p.x - 7, p.y - lift + 2 + flick)
        blitCentered(ctx, KIT_B_FX.flame(), p.x + 7, p.y - lift + 2 + (1 - flick))
        blitEllipse(ctx, 7, 2, 'rgba(24,24,16,0.3)', p.x, p.y + 2)
        return
      }
      if (kit.charge > 0) drawMeter(ctx, p.x, y, 1 - kit.charge / KIT_B.jets.cooldown, '#58a0a0')
      return
    }
    case 'salt': {
      drawPips(ctx, p.x, y, kit.layers, atStage(KIT_B.salt.cap, p.stage), '#f0ece8')
      // The layers' crystals circle the body, wide enough to show round Garganacl.
      const rx = Math.max(12, p.radius * 1.8 + 4)
      for (let i = 0; i < kit.layers; i++) {
        const ang = (i / Math.max(1, kit.layers)) * TAU + t * 0.8
        blitCentered(ctx, KIT_B_FX.crystal(), p.x + Math.cos(ang) * rx, p.y - 8 + Math.sin(ang) * rx * 0.45)
      }
      return
    }
    case 'pin':
      if (!kit.grab) return
      // The tail lashes out to the foe it holds, its claw closed on it.
      zigzag(ctx, p.x, p.y - 9, kit.grab.x, kit.grab.y, '#382050', 7, 3)
      zigzag(ctx, p.x, p.y - 10, kit.grab.x, kit.grab.y - 1, '#d070f0', 7, 3)
      blitCentered(ctx, KIT_B_FX.claw(), kit.grab.x, kit.grab.y)
      return
    case 'bubble': {
      if (kit.down > 0) return drawMeter(ctx, p.x, y, 1 - kit.down / atStage(KIT_B.bubble.cooldown, p.stage), '#90c0d8')
      const r = p.stage >= 1 ? 17 : 13
      const wob = Math.floor(t * 3) % 2
      ctx.globalAlpha = 0.6
      dashedRing(ctx, p.x, p.y - r + 2, r + wob, 0, ['#a8d8f0'], 0.8, 1)
      ctx.globalAlpha = 1
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(p.x - r * 0.5), Math.round(p.y - r * 1.5), 2, 1)
      ctx.fillRect(Math.round(p.x - r * 0.6), Math.round(p.y - r * 1.35), 1, 1)
      return
    }
    case 'stamina':
      return drawPips(ctx, p.x, y, kit.stacks, atStage(KIT_B.stamina.cap, p.stage), '#c8d0e0')
    default:
  }
}

/** How high the arm jets carry Golurk: up fast, a hover, then down for the landing. */
const jetsLift = (air: number, total: number) => {
  const k = 1 - air / Math.max(0.01, total)
  const top = total > 1 ? 18 : 8
  return Math.round(Math.min(1, Math.min(k, 1 - k) * 4) * top)
}

/** Lifts the player's sprite while the arm jets carry it (`drawPlayer`'s moment look). */
export const kitBPlayerLook = (g: Game) => {
  const kit = localPlayer(g).kitB
  return kit?.kind === 'jets' && kit.air > 0 ? { lift: jetsLift(kit.air, kit.total), alpha: 1 } : null
}
