import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { localPlayer } from '../game/players'
import { bubblesAt, KIT_SC, moonPhase } from '../game/scKitRules'
import type { Attack, Game } from '../game/types'
import { detail } from './quality'
import { SC_KIT_FX } from './scKitArt'
import { dashedRing } from './strokes'

/**
 * How the Safári and Game Corner wave's families look (`game/scKitMoves.ts`,
 * `game/scKitSystem.ts`): their hitboxes (sludge, barbs, horn jabs and the
 * charge, the quake, moonbeams, geysers and the splash), what lies under the
 * player (the guard's ring, the full moon's light) and what rides over it
 * (the moon by phase, the bubbles of the current). Presentation only; whole
 * pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const headingOf = (a: Attack) => (a.motion.kind === 'linear' || a.motion.kind === 'homing' || a.motion.kind === 'lunge' ? Math.atan2(a.motion.vy, a.motion.vx) : 0)

/** Drops thrown out from (x, y) as a splash grows: `n` of them, spread by `seed`, flying `k` (0..1) of `reach`, falling as they go. */
const splashDrops = (ctx: Ctx, x: number, y: number, n: number, reach: number, k: number, seed: number, sprite: () => HTMLCanvasElement) => {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash2(seed, i, 3) * 0.6
    const d = reach * (0.4 + hash2(seed, i, 5) * 0.6) * k
    const lift = Math.sin(k * Math.PI) * (6 + hash2(seed, i, 7) * 8)
    blitCentered(ctx, sprite(), Math.round(x + Math.cos(a) * d), Math.round(y + Math.sin(a) * d * 0.6 - lift))
  }
}

/** A column of light from above onto (x, y): its width, colors and how far it reaches up. */
const lightColumn = (ctx: Ctx, x: number, y: number, w: number, height: number, alpha: number, edge: string, core: string) => {
  const top = Math.round(y - height)
  const left = Math.round(x - w / 2)
  ctx.globalAlpha = alpha * 0.55
  ctx.fillStyle = edge
  ctx.fillRect(left, top, Math.max(1, Math.round(w)), Math.round(height))
  ctx.globalAlpha = alpha
  ctx.fillStyle = core
  const cw = Math.max(1, Math.round(w / 3))
  ctx.fillRect(Math.round(x - cw / 2), top, cw, Math.round(height))
  ctx.globalAlpha = 1
}

export const drawScKitAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'scSludge': {
      if (a.age >= 0) break
      // The lob: from the thrower to where it lands, over an arc.
      // `memo` holds the flight's length (`scKitMoves.ts`).
      const k = Math.max(0, Math.min(1, 1 + a.age / Math.max(0.05, a.memo)))
      const x = a.from.x + (a.x - a.from.x) * k
      const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 22
      return blitRotated(ctx, SC_KIT_FX.glob(), x, y, k * 4)
    }
    case 'scGeyser':
      if (a.age >= 0) break
      // A ripple on the ground where the geyser will burst.
      if (detail.lean && Math.floor(t * 10) % 2 === 0) return
      ctx.globalAlpha = 0.7
      dashedRing(ctx, a.x, a.y, (a.shape.kind === 'circle' ? a.shape.r : 14) * (0.5 + 0.5 * ((t * 3) % 1)), a.id, ['#a8e0f8', '#ffffff'], 0.6, 0.45)
      ctx.globalAlpha = 1
      return
  }
  if (a.age < 0) return
  const r = a.shape.kind === 'circle' ? a.shape.r : 8
  switch (a.visual) {
    case 'scSludge': {
      // The splat: a puddle and drops thrown out.
      const k = Math.min(1, a.age / 0.2)
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitEllipse(ctx, Math.round(r * 0.8), Math.round(r * 0.35), 'rgba(120,56,160,0.55)', a.x, a.y + 2)
      blitEllipse(ctx, Math.round(r * 0.5), Math.round(r * 0.2), 'rgba(176,104,216,0.7)', a.x, a.y + 2)
      splashDrops(ctx, a.x, a.y, detail.lean ? 4 : 7, r, k, a.id, SC_KIT_FX.drop)
      ctx.globalAlpha = 1
      return
    }
    case 'scQuill':
      ctx.globalAlpha = fadeOut(a, 0.12)
      blitRotated(ctx, SC_KIT_FX.quill(), a.x, a.y, headingOf(a))
      ctx.globalAlpha = 1
      return
    case 'scHorn': {
      // A jab: the horn thrusts out and back, a white streak behind it.
      const k = Math.min(1, a.age / 0.08)
      const back = 6 * (1 - k)
      const x = a.x - Math.cos(a.memo) * back
      const y = a.y - Math.sin(a.memo) * back
      ctx.globalAlpha = fadeOut(a, 0.08)
      ctx.fillStyle = '#ffffff'
      for (let i = 1; i <= 3; i++) ctx.fillRect(Math.round(x - Math.cos(a.memo) * (4 + i * 3)), Math.round(y - Math.sin(a.memo) * (4 + i * 3) + (i - 2) * 2), 2, 1)
      blitRotated(ctx, SC_KIT_FX.horn(), x, y, a.memo)
      ctx.globalAlpha = 1
      return
    }
    case 'scCharge': {
      // The charge: the horn out front and a trail of purple dust behind.
      const h = headingOf(a)
      const lines = detail.lean ? 3 : 6
      for (let i = 0; i < lines; i++) {
        const back = 6 + i * 4 + ((t * 60) % 4)
        const off = (hash2(a.id, i, 1) - 0.5) * 12
        ctx.fillStyle = i % 2 === 0 ? '#c070e0' : '#e8d8f0'
        ctx.fillRect(Math.round(a.x - Math.cos(h) * back - Math.sin(h) * off), Math.round(a.y - Math.sin(h) * back + Math.cos(h) * off), 2, 1)
      }
      return blitRotated(ctx, SC_KIT_FX.horn(), a.x + Math.cos(h) * 10, a.y + Math.sin(h) * 10, h)
    }
    case 'scQuake':
      ctx.globalAlpha = fadeOut(a, 0.18)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#a87848', '#d8b878', '#584028'], 0.9, 0.5)
      if (!detail.lean) splashDrops(ctx, a.x, a.y, 6, r, Math.min(1, a.age / 0.3), a.id, SC_KIT_FX.drop)
      ctx.globalAlpha = 1
      return
    case 'scMoonbeam': {
      // A column of moonlight falls on the target, pink under the full moon, and leaves a glint.
      const k = Math.min(1, a.age / 0.06)
      const alpha = fadeOut(a, 0.24)
      const full = a.tier !== 0
      lightColumn(ctx, a.x, a.y, r * 1.2 * (1.2 - 0.4 * k), 150, alpha, full ? '#f8c8e8' : '#f8e8a0', '#fffff0')
      ctx.globalAlpha = alpha
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.4), full ? 'rgba(248,200,232,0.7)' : 'rgba(248,232,160,0.7)', a.x, a.y)
      blitCentered(ctx, SC_KIT_FX.glint(), a.x + Math.round(Math.sin(a.id) * 4), a.y - 8 - Math.round(a.age * 20))
      ctx.globalAlpha = 1
      return
    }
    case 'scGeyser': {
      // The geyser: a column of water shooting up and its drops falling back.
      const k = Math.min(1, a.age / 0.12)
      const alpha = fadeOut(a, 0.2)
      const height = (a.tier === 1 ? 46 : 32) * (k < 1 ? k : 1 - Math.max(0, a.age - 0.12) * 1.4)
      if (height > 1) lightColumn(ctx, a.x, a.y, r * 0.9, height, alpha, '#58a8e0', '#e8f8ff')
      ctx.globalAlpha = alpha
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.4), 'rgba(136,200,240,0.6)', a.x, a.y)
      splashDrops(ctx, a.x, a.y - height * 0.6, detail.lean ? 4 : 8, r * 1.4, Math.min(1, a.age / 0.4), a.id, SC_KIT_FX.droplet)
      ctx.globalAlpha = 1
      return
    }
    case 'scSplash':
      // Phione's bubbles burst: a ring of warm water and drops thrown all round.
      ctx.globalAlpha = fadeOut(a, 0.18)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#88c8f0', '#ffffff', '#f8a8c0'], 0.8, 0.6)
      splashDrops(ctx, a.x, a.y, detail.lean ? 6 : 12, r, Math.min(1, a.age / 0.3), a.id, SC_KIT_FX.droplet)
      ctx.globalAlpha = 1
  }
}

/** Under the player: Nidoqueen's guard ring and the full moon's pool of light. */
export const drawScKitGround = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitSC
  if (!kit) return
  if (kit.kind === 'barbs' && kit.guard > 0) {
    ctx.globalAlpha = 0.35 + 0.1 * kit.guard
    dashedRing(ctx, p.x, p.y + 2, KIT_SC.barbs.guard.near * 0.4 + kit.guard * 2, Math.floor(t * 6), ['#c070e0', '#7838a0'], 0.5, 0.45)
    ctx.globalAlpha = 1
  }
  if (kit.kind === 'moon' && kit.full > 0 && !detail.lean) blitEllipse(ctx, 26, 9, `rgba(248,240,200,${0.18 + 0.06 * Math.sin(t * 4)})`, p.x, p.y + 2)
}

/** Over the player: the moon by phase over Cleffa's line's head, and the bubbles of Phione's current. */
export const drawScKitAir = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitSC
  if (!kit) return
  if (kit.kind === 'moon') {
    const phase = moonPhase(kit.fill, kit.full, p.stage)
    const bob = Math.round(Math.sin(t * 2) * 1)
    // Beside the head, so a Mega's stone over it never hides the moon.
    const x = Math.round(p.x + p.radius + 8)
    const y = Math.round(p.y - p.radius * 2 - 6 + bob)
    if (phase === 4 && !detail.lean) {
      // The full moon's halo winks round it.
      for (let i = 0; i < 6; i++) {
        if (Math.floor(t * 4 + i) % 3 === 0) continue
        const a = (i / 6) * TAU + t
        ctx.fillStyle = '#fff8d8'
        ctx.fillRect(Math.round(x + Math.cos(a) * 7), Math.round(y + Math.sin(a) * 7), 1, 1)
      }
    }
    return blitCentered(ctx, SC_KIT_FX.moons[phase]!(), x, y)
  }
  if (kit.kind === 'current') {
    const n = bubblesAt(kit.drift)
    const orbit = KIT_SC.current.orbit * p.stats.area
    for (let i = 0; i < n; i++) {
      const a = kit.angle + (i / n) * TAU
      const x = Math.round(p.x + Math.cos(a) * orbit)
      const y = Math.round(p.y - 8 + Math.sin(a) * orbit * 0.7 + Math.sin(t * 5 + i) * 1)
      blitCentered(ctx, SC_KIT_FX.bubble(), x, y)
    }
  }
}
