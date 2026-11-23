import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { atStage, diveEvery, KIT_F } from '../game/fossilKitRules'
import { localPlayer } from '../game/players'
import type { Attack, Game } from '../game/types'
import { FOSSIL_FX } from './fossilKitArt'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How the fossil families look (`game/fossilKitMoves.ts`,
 * `game/fossilKitSystem.ts`): their hitboxes, what lies around the player
 * (Lileep's roots and tendrils) and what rides on it (the dive's and the
 * shell's clocks, the claws', the generator's and the frenzy's pips).
 * Presentation only; whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const headingOf = (a: Attack) => (a.motion.kind === 'linear' || a.motion.kind === 'homing' || a.motion.kind === 'lunge' ? Math.atan2(a.motion.vy, a.motion.vx) : 0)

const radiusOf = (a: Attack, fallback: number) => (a.shape.kind === 'circle' ? a.shape.r : fallback)

const ring = (ctx: Ctx, a: Attack, colors: readonly string[], squash: number) => {
  ctx.globalAlpha = fadeOut(a, 0.18)
  dashedRing(ctx, a.x, a.y, radiusOf(a, 8), a.id, colors, 0.9, squash)
  ctx.globalAlpha = 1
}

/** A pixel zigzag from (x0, y0) to (x1, y1): a bolt off Dracozolt's tail. */
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

/** A curved root from (x0, y0) to (x1, y1), bowing to one side: Cradily's tendrils, the roots on the ground. */
const tendril = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, bow: number, color: string) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.max(1, Math.hypot(dx, dy))
  const steps = Math.max(3, Math.round(len))
  ctx.fillStyle = color
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    const side = Math.sin(k * Math.PI) * bow
    ctx.fillRect(Math.round(x0 + dx * k - (dy / len) * side), Math.round(y0 + dy * k + (dx / len) * side), 1, 1)
  }
}

export const drawKitFAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.visual === 'kitFIcicle' && a.age < 0) {
    // The icicle drops point first onto its ring, faster as it falls.
    const k = Math.max(0, Math.min(1, 1 + a.age / 0.4))
    return blitCentered(ctx, FOSSIL_FX.icicle(), a.x, a.y - 8 - (1 - k * k) * 70)
  }
  if (a.age < 0) return
  switch (a.visual) {
    case 'kitFWing':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, FOSSIL_FX.wing(), a.x, a.y, a.motion.kind === 'orbit' ? a.motion.angle + Math.PI / 2 : 0)
      ctx.globalAlpha = 1
      return
    case 'kitFDive': {
      // Stone wings swept back behind the swoop, and the wind it tears.
      const h = headingOf(a)
      const wing = a.tier === 1 ? FOSSIL_FX.megaWing() : FOSSIL_FX.diveWing()
      const back = h + Math.PI
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, wing, a.x + Math.cos(back) * 6 - Math.sin(h) * 6, a.y + Math.sin(back) * 6 + Math.cos(h) * 6, h + 2.6)
      blitRotated(ctx, wing, a.x + Math.cos(back) * 6 + Math.sin(h) * 6, a.y + Math.sin(back) * 6 - Math.cos(h) * 6, h - 2.6)
      const lines = detail.lean ? 3 : 5
      for (let i = 0; i < lines; i++) {
        const off = (i - (lines - 1) / 2) * 4
        ctx.fillStyle = i % 2 === 0 ? '#ffffff' : a.tier === 1 ? '#e8a0b8' : '#c8b8e0'
        for (let k = 10; k < 26; k += 2) ctx.fillRect(Math.round(a.x + Math.cos(back) * k - Math.sin(back) * off), Math.round(a.y + Math.sin(back) * k + Math.cos(back) * off), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'kitFSpike':
      return blitRotated(ctx, a.tier === 1 ? FOSSIL_FX.spikeHot() : FOSSIL_FX.spike(), a.x, a.y, headingOf(a))
    case 'kitFShell':
      return blitRotated(ctx, FOSSIL_FX.shard(), a.x, a.y, t * 10 + a.id)
    case 'kitFRoot': {
      // The roots heave up out of the ground, then sink back.
      const k = Math.min(1, a.age / 0.08)
      const sink = Math.max(0, (a.age - a.ttl * 0.6) / (a.ttl * 0.4))
      const sprite = a.tier === 1 ? FOSSIL_FX.rootsRooted() : FOSSIL_FX.roots()
      const scale = radiusOf(a, 14) > 16 ? 1.25 : 1
      ctx.globalAlpha = 1 - sink
      blitRotated(ctx, sprite, a.x, a.y - 2 - Math.round(k * 4) + Math.round(sink * 4), 0, scale)
      ctx.globalAlpha = 1
      if (!detail.lean) ring(ctx, a, ['#7a5838', '#a07850'], 0.5)
      return
    }
    case 'kitFClaw':
      ctx.globalAlpha = fadeOut(a, 0.06)
      blitRotated(ctx, FOSSIL_FX.claw(), a.x, a.y, a.motion.kind === 'orbit' ? a.motion.angle + Math.PI / 2 : 0)
      ctx.globalAlpha = 1
      return
    case 'kitFCross': {
      // Armaldo's claws cross in an X as wide as the cleave, then a ring of grit.
      const r = radiusOf(a, 20)
      ctx.globalAlpha = fadeOut(a, 0.14)
      for (const [sx, sy] of [[1, 1], [1, -1]] as const) {
        for (let k = -r; k <= r; k++) {
          const x = Math.round(a.x + k * 0.72 * sx)
          const y = Math.round(a.y + k * 0.5 * sy)
          ctx.fillStyle = '#304038'
          ctx.fillRect(x - 1, y - 1, 3, 3)
          ctx.fillStyle = Math.abs(k) < r * 0.85 ? '#ffffff' : '#c8d8c8'
          ctx.fillRect(x, y, 2, 1)
        }
      }
      ctx.globalAlpha = 1
      return ring(ctx, a, ['#90b8a0', '#e8f0e8'], 0.55)
    }
    case 'kitFBeak': {
      // The beak leads, a forked trail of lightning behind.
      const h = headingOf(a)
      const back = h + Math.PI
      const color = Math.floor(t * 20) % 2 === 0 ? '#ffffff' : '#f8d030'
      for (const side of [-1, 1]) zigzag(ctx, a.x, a.y, a.x + Math.cos(back) * 22 - Math.sin(back) * side * 5, a.y + Math.sin(back) * 22 + Math.cos(back) * side * 5, color, Math.floor(t * 24) + side + a.id, 5)
      return blitRotated(ctx, FOSSIL_FX.beak(), a.x + Math.cos(h) * 6, a.y + Math.sin(h) * 6, h)
    }
    case 'kitFVolt': {
      ring(ctx, a, ['#f8d030', '#ffffff', '#78a858'], 0.6)
      if (a.age > a.activeUntil) return
      const r = radiusOf(a, 20)
      const bolts = detail.lean ? 4 : 8
      for (let i = 0; i < bolts; i++) {
        const ang = (i / bolts) * TAU + a.id
        zigzag(ctx, a.x, a.y, a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6, i % 2 ? '#ffffff' : '#f8d030', a.id * 7 + i + Math.floor(t * 20), 6)
      }
      return
    }
    case 'kitFIcicle': {
      // Shattered on landing: ice shards splayed out of the ring.
      ring(ctx, a, ['#a8e0f8', '#ffffff'], 0.55)
      const r = radiusOf(a, 12)
      const k = Math.min(1, a.age / a.ttl)
      ctx.fillStyle = '#e0f8ff'
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + a.id
        const d = r * (0.3 + 0.7 * k)
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d * 0.55 - Math.sin(k * Math.PI) * 6), 2, 1)
      }
      return
    }
    case 'kitFShiver': {
      ring(ctx, a, ['#d8f0ff', '#78c8f0'], 0.55)
      if (detail.lean) return
      const r = radiusOf(a, 20)
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 10; i++) {
        const ang = hash2(a.id, i, 31) * TAU
        const d = r * (0.4 + 0.6 * hash2(a.id, i, 37))
        if ((Math.floor(t * 12) + i) % 3 !== 0) ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d * 0.55), 1, 1)
      }
      return
    }
    case 'kitFJaws': {
      // The fish jaws open wide on the leap and snap shut as it lands, a splash off them.
      const h = headingOf(a)
      const k = Math.min(1, a.age / Math.max(0.01, a.ttl))
      const gap = Math.round(k < 0.6 ? 2 + k * 6 : 5.6 * (1 - (k - 0.6) / 0.4))
      const nx = -Math.sin(h)
      const ny = Math.cos(h)
      const x = a.x + Math.cos(h) * 6
      const y = a.y + Math.sin(h) * 6
      blitRotated(ctx, FOSSIL_FX.jawTop(), x - nx * (gap + 2), y - ny * (gap + 2), h)
      blitRotated(ctx, FOSSIL_FX.jawBottom(), x + nx * (gap + 2), y + ny * (gap + 2), h)
      ctx.fillStyle = '#a8d8f8'
      for (let i = 0; i < 4; i++) {
        const ang = h + Math.PI + (i - 1.5) * 0.4
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * (10 + i * 2)), Math.round(a.y + Math.sin(ang) * (10 + i * 2)), 1, 1)
      }
      return
    }
  }
}

/** What lies on the ground around a fossil family's player: Lileep's roots once rooted, and its tendrils on the foes they hold. */
export const drawKitFGround = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitF
  if (kit?.kind !== 'roots') return
  if (kit.rooted) {
    // The roots reach out over the ground from its base, a little longer each moment.
    const grow = Math.min(1, (kit.still - KIT_F.roots.settle) / 0.4 + 0.3)
    const n = detail.lean ? 5 : 8
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * TAU + 0.3
      const len = (10 + hash2(i, 3, 5) * 10) * grow * (p.stage >= 1 ? 1.4 : 1)
      const x1 = p.x + Math.cos(ang) * len
      const y1 = p.y + 1 + Math.sin(ang) * len * 0.45
      tendril(ctx, p.x, p.y + 1, x1, y1, (hash2(i, 7, 9) - 0.5) * 6, '#5a3c20')
      ctx.fillStyle = p.stage >= 1 ? '#a8e070' : '#e890c8'
      ctx.fillRect(Math.round(x1), Math.round(y1), 1, 1)
    }
  }
  for (const td of kit.tendrils) {
    // A tendril lashes from it to the foe it holds, its suction cup on the end.
    const k = td.left / KIT_F.roots.show
    ctx.globalAlpha = Math.min(1, k * 2)
    tendril(ctx, p.x, p.y - 6, td.x, td.y, 6 * Math.sin(t * 9 + td.x), '#683858')
    tendril(ctx, p.x, p.y - 7, td.x, td.y - 1, 6 * Math.sin(t * 9 + td.x), '#e890c8')
    blitEllipse(ctx, 2, 1, '#f8c8e8', td.x, td.y)
    ctx.globalAlpha = 1
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

/** Pips under the HP bar: the claws' chain, the generator's charge, the frenzy. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

/** What rides on a fossil family's player: the dive's clock, the shell's, Shell Smash's fury, and the stacks. */
export const drawKitFAir = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitF
  if (!kit) return
  const y = Math.round(p.y + 9)
  switch (kit.kind) {
    case 'dive':
      if (kit.next > 0) drawMeter(ctx, p.x, y, 1 - kit.next / diveEvery(p.mega.active > 0), p.mega.active > 0 ? '#e8a0b8' : '#a898b8')
      return
    case 'smash': {
      if (kit.left <= 0) {
        if (kit.shell > 0) drawMeter(ctx, p.x, y, 1 - kit.shell / atStage(KIT_F.smash.regrow, p.stage), '#d8c098')
        return
      }
      // Smashed: the meter runs down, and sparks of fury flick off the bare body.
      drawMeter(ctx, p.x, y, kit.left / atStage(KIT_F.smash.left, p.stage), '#f09048')
      const sparks = detail.lean ? 3 : 6
      for (let i = 0; i < sparks; i++) {
        const k = (t * 2 + i / sparks) % 1
        const ang = hash2(i, Math.floor(t * 2 + i / sparks), 3) * TAU
        ctx.fillStyle = i % 2 ? '#f8d070' : '#f06030'
        ctx.fillRect(Math.round(p.x + Math.cos(ang) * (8 + k * 8)), Math.round(p.y - 10 + Math.sin(ang) * (5 + k * 5) - k * 6), 1, 1)
      }
      return
    }
    case 'claws':
      return drawPips(ctx, p.x, y, kit.links, atStage(KIT_F.claws.cap, p.stage), '#e8f0e8')
    case 'volt':
      return drawPips(ctx, p.x, y, kit.charge, KIT_F.volt.need, '#f8d030')
    case 'frenzy':
      return drawPips(ctx, p.x, y, kit.stacks, KIT_F.frenzy.cap, '#78b8e8')
    default:
  }
}
