import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { plusMinusLink } from '../game/coop'
import { KIT_H } from '../game/gaHookRules'
import { fighterNow } from '../game/gaHookSystem'
import type { Attack, Game } from '../game/types'
import { MINIOR_CORES } from '../data/vivillon'
import { HOOK_FX, prismOf } from './gaHookArt'
import { coreOf, patternColors } from './gaHookLook'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How the hook families look (`game/gaHookMoves.ts`, `game/gaHookSystem.ts`):
 * their hitboxes (the powder in the caster's Vivillon colors, the gems in its
 * Core's), what rides on a player (Tyrogue's build meter, Plusle's charge,
 * Minun's pulse) and Plusle and Minun's co-op current. Presentation only;
 * whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const headingOf = (a: Attack) => (a.motion.kind === 'linear' || a.motion.kind === 'homing' || a.motion.kind === 'lunge' || a.motion.kind === 'return' ? Math.atan2(a.motion.vy, a.motion.vx) : 0)

const radiusOf = (a: Attack, fallback: number) => (a.shape.kind === 'circle' ? a.shape.r : fallback)

/** A bold ring three pixels thick: a dark rim outside, the colors' band, a light edge inside (`colors`: dark, mid, light). */
const ring = (ctx: Ctx, a: Attack, colors: readonly [string, string, string], squash: number) => {
  const r = radiusOf(a, 8)
  ctx.globalAlpha = fadeOut(a, 0.18)
  dashedRing(ctx, a.x, a.y, r + 1, a.id, [colors[0]], 1, squash)
  dashedRing(ctx, a.x, a.y, r, a.id + 1, [colors[1]], 1, squash)
  dashedRing(ctx, a.x, a.y, r - 1, a.id + 2, [colors[2]], 0.7, squash)
  ctx.globalAlpha = 1
}

/** A pixel zigzag from (x0, y0) to (x1, y1): Plusle and Minun's current, a zap. */
const zigzag = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, color: string, seed: number, jag: number) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.max(1, Math.hypot(dx, dy))
  const steps = Math.max(2, Math.floor(len / 6))
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

/** The powders' tints: Scatterbug's slow, then Vivillon's Poison Powder, Stun Spore and Sleep Powder. */
const POWDER = [
  ['#d8d0e0', '#a098b0'],
  ['#d090f0', '#8040b0'],
  ['#f8e870', '#d0a820'],
  ['#a8f0c8', '#48b080'],
] as const

/** A puff of scales: a soft cloud of powder in its tint, swirling motes, and the caster's wing scales glinting as they settle. */
const drawPowder = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a, 14)
  const tint = POWDER[Math.min(POWDER.length - 1, a.tier)]!
  const k = Math.min(1, a.age / 0.2)
  const fade = fadeOut(a, 0.5)
  // Scatterbug's and Spewpa's scales are their own grey; Vivillon's wear its pattern.
  const scales: readonly string[] = a.tier > 0 ? patternColors(a.owner) : ['#f8f8f8', '#a8a8b0', '#505058']
  const rr = r * (0.55 + 0.45 * k)
  // The cloud: two soft layers of powder, a puff at the heart.
  ctx.globalAlpha = fade * 0.22
  blitEllipse(ctx, rr, rr * 0.55, tint[0], a.x, a.y)
  ctx.globalAlpha = fade * 0.3
  blitEllipse(ctx, rr * 0.6, rr * 0.33, tint[0], a.x + Math.sin(t * 1.3 + a.id) * 2, a.y - 2)
  ctx.globalAlpha = fade * 0.75
  dashedRing(ctx, a.x, a.y, rr, a.id + Math.floor(t * 3), [tint[1]], 0.5, 0.55)
  const motes = detail.lean ? 12 : 24
  for (let i = 0; i < motes; i++) {
    const ang = hash2(a.id, i, 3) * TAU + t * (0.6 + hash2(a.id, i, 5))
    const d = Math.sqrt(hash2(a.id, i, 7)) * rr
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.55 - 2 - ((t * 4 + hash2(a.id, i, 9) * 6) % 6)
    ctx.globalAlpha = fade * (i % 3 === 0 ? 1 : 0.7)
    ctx.fillStyle = tint[i % 2]!
    ctx.fillRect(Math.round(x), Math.round(y), i % 4 === 0 ? 2 : 1, 1)
  }
  const glints = detail.lean ? 5 : 9
  for (let i = 0; i < glints; i++) {
    const ang = hash2(a.id, i, 11) * TAU - t * 0.8
    const d = (0.25 + 0.75 * hash2(a.id, i, 13)) * rr
    const x = Math.round(a.x + Math.cos(ang) * d)
    const y = Math.round(a.y + Math.sin(ang) * d * 0.55 - 4 - ((t * 5 + i * 3) % 7))
    // A scale turning in the air: a small wing-scale (3×2, a dark tip) that flashes its light side now and then.
    const flash = Math.floor(t * 8 + i) % 4 === 0
    ctx.globalAlpha = fade
    ctx.fillStyle = flash ? scales[0]! : scales[1 + (i % 2)]!
    ctx.fillRect(x, y, 3, 1)
    ctx.fillRect(x + 1, y + 1, 1, 1)
    ctx.fillStyle = scales[2]!
    ctx.fillRect(x + (i % 2 ? 0 : 2), y + 1, 1, 1)
  }
  ctx.globalAlpha = 1
}

/** Bug Buzz's wave: a thick arc of wing-beat facing where it rolls, outlined so it reads on grass, buzzing as it widens. */
const drawBuzz = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a, 9)
  const facing = a.memo
  const span = 0.9
  const steps = Math.max(8, Math.floor(r * span * 2.2))
  const cx = a.x - Math.cos(facing) * r * 0.55
  const cy = a.y - Math.sin(facing) * r * 0.55
  const jitter = Math.floor(t * 30) % 2
  ctx.globalAlpha = fadeOut(a, 0.25)
  // Back to front: a dark rim, the green body, a bright crest; every third pixel of the crest buzzes off the line.
  const bands = [[r + 1, '#284810'], [r, '#78b828'], [r - 1, '#a8e048'], [r - 2, '#f0f8b0']] as const
  for (const [rr, color] of bands) {
    ctx.fillStyle = color
    for (let i = 0; i <= steps; i++) {
      const ang = facing - span + (2 * span * i) / steps
      const wob = color === '#f0f8b0' && i % 3 === jitter ? 1 : 0
      ctx.fillRect(Math.round(cx + Math.cos(ang) * (rr + wob)), Math.round(cy + Math.sin(ang) * (rr + wob) * 0.85), 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

export const drawHookAttack = (ctx: Ctx, a: Attack, t: number, g: Game) => {
  if (a.age < 0) return
  switch (a.visual) {
    case 'hookPowder': return drawPowder(ctx, a, t)
    case 'hookBuzz': return drawBuzz(ctx, a, t)
    case 'hookGem': {
      if (a.tier === 0) return blitRotated(ctx, HOOK_FX.rock(), a.x, a.y, t * 7 + a.id)
      const [light, dark] = MINIOR_CORES[coreOf(g, a.owner)]
      // The prism's sparkle trail, then the prism turning on its point.
      const back = headingOf(a) + Math.PI
      ctx.fillStyle = light
      for (let k = 3; k < 12; k += 3) ctx.fillRect(Math.round(a.x + Math.cos(back) * k), Math.round(a.y + Math.sin(back) * k), 1, 1)
      return blitRotated(ctx, prismOf(light, dark), a.x, a.y, headingOf(a) + Math.PI / 2)
    }
    case 'hookShell': {
      const r = radiusOf(a, 20)
      ring(ctx, a, ['#3a2410', '#a87850', '#e8c898'], 0.55)
      const shards = detail.lean ? 6 : 10
      ctx.globalAlpha = fadeOut(a, 0.12)
      for (let i = 0; i < shards; i++) {
        const ang = (i / shards) * TAU + hash2(a.id, i, 3) * 0.4
        blitRotated(ctx, HOOK_FX.rock(), a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6, ang + a.age * 9)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hookJab':
    case 'hookCounter': {
      const counter = a.visual === 'hookCounter'
      const k = Math.min(1, a.age / 0.06)
      ctx.globalAlpha = fadeOut(a, 0.1)
      const angle = counter ? Math.atan2(a.y - a.from.y, a.x - a.from.x) : a.memo
      // The fist darts in from behind, with three speed lines trailing it.
      const back = angle + Math.PI
      const x = a.x + Math.cos(back) * (1 - k) * 8
      const y = a.y + Math.sin(back) * (1 - k) * 8
      ctx.fillStyle = '#ffffff'
      for (let s = -1; s <= 1; s++) for (let d = 6; d < 12; d++) ctx.fillRect(Math.round(x + Math.cos(back) * d - Math.sin(back) * s * 3), Math.round(y + Math.sin(back) * d + Math.cos(back) * s * 3), 1, 1)
      blitRotated(ctx, counter ? HOOK_FX.glove() : HOOK_FX.jab(), x, y, angle)
      if (counter) dashedRing(ctx, a.x, a.y, radiusOf(a, 14) * (0.5 + 0.5 * k), a.id, ['#f8e060', '#ffffff'], 0.6, 0.7)
      ctx.globalAlpha = 1
      return
    }
    case 'hookLeap': {
      // Dust kicked up under the leap.
      ctx.fillStyle = '#d8c8a8'
      for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(a.from.x + (hash2(a.id, i, 3) - 0.5) * 14), Math.round(a.from.y + 6 - a.age * 20 * hash2(a.id, i, 5)), 1, 1)
      return
    }
    case 'hookKnee': {
      ring(ctx, a, ['#683810', '#f0a040', '#f8f0d0'], 0.55)
      ctx.globalAlpha = fadeOut(a, 0.15)
      blitRotated(ctx, HOOK_FX.foot(), a.x, a.y - 6 - Math.max(0, 8 - a.age * 80), Math.PI / 2, 1)
      ctx.globalAlpha = 1
      return
    }
    case 'hookSpin': {
      // The legs sweep round: three feet on the ring, each spin wider and brighter.
      const r = radiusOf(a, 24)
      ctx.globalAlpha = fadeOut(a, 0.12)
      dashedRing(ctx, a.x, a.y, r, a.id, a.tier === 2 ? ['#ffffff', '#f0a040'] : ['#f0c890', '#c87838'], 0.6, 0.55)
      const spin = a.age * 30 + a.tier
      for (let i = 0; i < 3; i++) {
        const ang = spin + (i / 3) * TAU
        blitRotated(ctx, HOOK_FX.foot(), a.x + Math.cos(ang) * r * 0.8, a.y + Math.sin(ang) * r * 0.45, ang)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hookBolt': {
      const back = headingOf(a) + Math.PI
      ctx.fillStyle = Math.floor(t * 20) % 2 === 0 ? '#ffffff' : '#f8e048'
      for (let k = 4; k < 14; k += 2) ctx.fillRect(Math.round(a.x + Math.cos(back) * k + (hash2(a.id, k, Math.floor(t * 30)) - 0.5) * 3), Math.round(a.y + Math.sin(back) * k), 1, 1)
      return blitRotated(ctx, HOOK_FX.bolt(), a.x, a.y, headingOf(a) + Math.PI / 2)
    }
    case 'hookImpulse': {
      const r = radiusOf(a, 20)
      ring(ctx, a, ['#182878', '#5888f0', '#d8e8ff'], 0.6)
      // Little arcs of current crackling round its edge.
      ctx.globalAlpha = fadeOut(a, 0.15)
      const arcs = detail.lean ? 3 : 6
      for (let i = 0; i < arcs; i++) {
        const ang = (i / arcs) * TAU + a.age * 4
        const x0 = a.x + Math.cos(ang) * r
        const y0 = a.y + Math.sin(ang) * r * 0.6
        zigzag(ctx, x0, y0, x0 + Math.cos(ang + 1.4) * 7, y0 + Math.sin(ang + 1.4) * 4, '#b8d8ff', a.id + i + Math.floor(t * 20), 4)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hookBurst':
    case 'hookPulse': {
      const plus = a.visual === 'hookBurst'
      const r = radiusOf(a, 20)
      ring(ctx, a, plus ? ['#801818', '#f8d030', '#ffffff'] : ['#102060', '#58a0f8', '#ffffff'], 0.6)
      ctx.globalAlpha = fadeOut(a, 0.15)
      const signs = detail.lean ? 4 : 8
      for (let i = 0; i < signs; i++) {
        const ang = (i / signs) * TAU + hash2(a.id, i, 3)
        blitCentered(ctx, plus ? HOOK_FX.plus() : HOOK_FX.minus(), a.x + Math.cos(ang) * r * 0.85, a.y + Math.sin(ang) * r * 0.5 - a.age * 12)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hookZap':
      ctx.globalAlpha = fadeOut(a, 0.1)
      zigzag(ctx, a.from.x, a.from.y, a.x, a.y, '#ffffff', a.id, 10)
      ctx.globalAlpha = 1
      return
    default:
  }
}

/**
 * Plusle and Minun's current: a red (plus) and a blue (minus) strand braided
 * along a dark-rimmed bolt, a white core flickering through it, and sparks
 * where it leaves each of them.
 */
const drawLink = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, t: number) => {
  const seed = Math.floor(t * 18)
  zigzag(ctx, x0, y0 + 1, x1, y1 + 1, '#302808', seed, 12)
  zigzag(ctx, x0, y0, x1, y1, '#f8d830', seed, 12)
  zigzag(ctx, x0 + 1, y0, x1 + 1, y1, '#f8d830', seed, 12)
  zigzag(ctx, x0, y0 - 1, x1, y1 - 1, '#f86048', seed + 3, 7)
  zigzag(ctx, x0, y0 + 1, x1, y1 + 1, '#58a0f8', seed + 5, 7)
  if (Math.floor(t * 12) % 2 === 0) zigzag(ctx, x0, y0, x1, y1, '#ffffff', seed + 9, 4)
  if (detail.lean) return
  for (const [x, y, sign] of [[x0, y0, HOOK_FX.plus()], [x1, y1, HOOK_FX.minus()]] as const) {
    const k = (t * 3) % 1
    ctx.globalAlpha = 1 - k
    blitCentered(ctx, sign, x + Math.sin(t * 7) * 3, y - 6 - k * 8)
  }
  ctx.globalAlpha = 1
}

/** A small bar under the HP bar. */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** The branch Tyrogue's build points at, in its color: Hitmonlee's tan, Hitmonchan's red gloves, Hitmontop's blue. */
const BRANCH_COLOR = { hitmonlee: '#d8a070', hitmonchan: '#e83838', hitmontop: '#4878d8' } as const

/**
 * Tyrogue's build meter: Attack (red, from the left) against Defense (blue,
 * from the right) as they stand, a notch where the even band sits, and a pip
 * in the color of the branch it would become now.
 */
const drawFighter = (ctx: Ctx, x: number, y: number, attack: number, defense: number, branch: keyof typeof BRANCH_COLOR) => {
  const w = 24
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  const total = Math.max(0, attack) + Math.max(0, defense)
  const share = total > 0 ? Math.max(0, attack) / total : 0.5
  const split = Math.round(w * share)
  ctx.fillStyle = '#e85840'
  ctx.fillRect(lx, y, split, 2)
  ctx.fillStyle = '#4888e8'
  ctx.fillRect(lx + split, y, w - split, 2)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(lx + Math.round(w / 2), y - 1, 1, 4)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx + w + 2, y - 1, 4, 4)
  ctx.fillStyle = BRANCH_COLOR[branch]
  ctx.fillRect(lx + w + 3, y, 2, 2)
}

/** What rides on a hook player: Tyrogue's build, Plusle's charge, Minun's pulse; on Plusle, the co-op current to Minun. */
export const drawHookAir = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const kit = p.kitH
  if (!kit) return
  const y = Math.round(p.y + 9)
  switch (kit.kind) {
    case 'fighter': {
      if (p.stage > 0) return
      const now = fighterNow(p)
      if (now) drawFighter(ctx, p.x, y, now.attack, now.defense, now.branch)
      return
    }
    case 'plus': {
      drawMeter(ctx, p.x, y, kit.charge / KIT_H.plus.need, '#f8d030')
      if (kit.surge > 0 && !detail.lean) {
        // The surge: sparks crackling over its body.
        for (let i = 0; i < 3; i++) {
          const ang = hash2(i, Math.floor(t * 12), 5) * TAU
          zigzag(ctx, p.x, p.y - 12, p.x + Math.cos(ang) * 10, p.y - 12 + Math.sin(ang) * 8, i % 2 ? '#f8e048' : '#ffffff', Math.floor(t * 24) + i, 3)
        }
      }
      // Plusle draws the co-op current once, from its side.
      const link = plusMinusLink(g)
      if (link && link.plus === p) drawLink(ctx, p.x, p.y - 10, link.minus.x, link.minus.y - 10, t)
      return
    }
    case 'minus':
      return drawMeter(ctx, p.x, y, 1 - kit.next / KIT_H.minus.every, '#58a0f8')
    default:
  }
}
