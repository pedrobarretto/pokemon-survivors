import { blitCentered, blitEllipse, blitRing, blitRotated, fillPlotted, plot } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TAU } from '../engine/math'
import { DREAM_WINDUP, FOUL_WINDUP, MASH_FALL, MASH_MAX, PUNCH_WINDUP, SLAM_LEAP, SLAM_LIFT } from '../game/eggMoveRules'
import { MOVE_IDS, type MoveId } from '../game/moves'
import type { Attack, Game } from '../game/types'
import { moveIconSprite } from './art'
import { EGG_FX } from './eggMoveArt'
import { dashedRing } from './strokes'
import { localPlayer } from '../game/players'
import { detail } from './quality'

/**
 * Visuals of the egg families' signature moves (`game/eggMoves.ts`). Like
 * `evolved.ts` and `moveFx.ts`, both frame passes of `draw.ts` fall through
 * here; `drawEggPlayer` adds what rides on the player (Meteor Mash's might,
 * Giga Impact's recharge) and `eggPlayerLook` lifts or hides their sprite.
 * Everything snaps to whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

/** The angle a hitbox glued to the player points at (its follow offset). */
const followAngle = (a: Attack) => (a.motion.kind === 'follow' ? Math.atan2(a.motion.oy + 8, a.motion.ox) : 0)

/** The way a moving hitbox goes. */
const heading = (a: Attack) => {
  const m = a.motion
  return m.kind === 'linear' || m.kind === 'homing' || m.kind === 'lunge' ? Math.atan2(m.vy, m.vx) : 0
}

/**
 * A thick crescent around (x, y) facing `dir`, `span` radians wide, revealed
 * by `sweep` (0..1); `colors` go from the outer rim inward.
 */
const crescent = (ctx: Ctx, x: number, y: number, r: number, dir: number, span: number, sweep: number, colors: readonly string[], squash = 1) => {
  const steps = Math.max(6, Math.ceil(r * span * 1.3))
  // Drawing lean, a big one plots every other step in 2 px squares.
  const size = detail.lean && steps >= 16 ? 2 : 1
  for (let i = 0; i <= steps * sweep; i += size) {
    const angle = dir - span / 2 + (span * i) / steps
    const thick = Math.max(1, Math.round(Math.sin((i / steps) * Math.PI) * colors.length))
    for (let k = 0; k < thick; k += size) plot(colors[k]!, x + Math.cos(angle) * (r - k), y + Math.sin(angle) * (r - k) * squash, size, size)
  }
  fillPlotted(ctx)
}

/** Short rays of light around (x, y): an impact. */
const rays = (ctx: Ctx, x: number, y: number, size: number, count: number, colors: readonly [string, string], spin = 0) => {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + spin
    const len = i % 2 === 0 ? size : size * 0.6
    for (let d = 2; d <= len; d++) plot(d < len * 0.5 ? colors[0] : colors[1], x + Math.cos(angle) * d, y + Math.sin(angle) * d)
  }
  fillPlotted(ctx)
}

/* ---------------- Ground layer ---------------- */

/** Ground layer (under Pokémon): rings on the floor, shadows of things in the air, a mound of earth. */
export const drawEggGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  switch (a.visual) {
    case 'hypnosis': {
      // Three wavy rings rolling out from the player, pink to violet.
      const k = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.8
      const fill = Math.min(1, k * 2)
      blitEllipse(ctx, Math.round(r * fill), Math.max(1, Math.round(r * 0.5 * fill)), 'rgba(200,120,232,0.18)', a.x, a.y + 8)
      for (let j = 0; j < 3; j++) {
        const e = Math.min(1, k * 1.6 - j * 0.22)
        if (e <= 0) continue
        ctx.globalAlpha = Math.max(0, 1 - e)
        const colors = j === 0 ? ['#ffffff', '#f8a0d0'] : ['#f878b8', '#a070d8']
        dashedRing(ctx, a.x, a.y + 8, r * e, t * 3 + j, colors, 0.85, 0.5)
        dashedRing(ctx, a.x, a.y + 7, r * e - 1, -t * 3 - j, colors, 0.6, 0.5)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'digMound': {
      // A mound of earth that shuffles along under the player, crumbs flying off it.
      const bob = Math.floor(t * 10) % 2
      blitEllipse(ctx, 9, 3, 'rgba(40,24,8,0.35)', a.x, a.y + 1)
      blitCentered(ctx, EGG_FX.mound(), a.x, a.y - 2 - bob)
      for (let i = 0; i < 3; i++) {
        const phase = (t * 2.5 + i / 3) % 1
        px(ctx, a.x + (hash2(i, Math.floor(t * 2.5 + i / 3)) - 0.5) * 16, a.y - 4 - Math.sin(phase * Math.PI) * 8, i ? '#b88848' : '#e0c080')
      }
      return
    }
    case 'digBurst':
    case 'slamWave':
    case 'gigaWave': {
      // Cracks and a ring of dust spreading from the impact.
      const e = a.age / a.ttl
      const colors = a.visual === 'gigaWave' ? ['#ffffff', '#f8d878', '#c89848'] : a.visual === 'slamWave' ? ['#f8f0d0', '#d8c088', '#a08048'] : ['#e0c080', '#a07840', '#604020']
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.5)), 'rgba(40,24,8,0.22)', a.x, a.y)
      dashedRing(ctx, a.x, a.y, r, a.id, colors, 0.9, 0.5)
      dashedRing(ctx, a.x, a.y, r * 0.8, -a.id, [colors[1]!, colors[2]!], 0.5, 0.5)
      const cracks = a.visual === 'gigaWave' ? 10 : 7
      for (let i = 0; i < cracks; i++) {
        const angle = (i / cracks) * TAU + a.id * 0.7
        for (let d = 3; d < Math.min(r * 0.9, 40); d += 1.5) {
          const jag = Math.sin(d * 0.6 + i * 2) * 1.5
          px(ctx, a.x + Math.cos(angle) * d - Math.sin(angle) * jag, a.y + (Math.sin(angle) * d + Math.cos(angle) * jag) * 0.5, '#402810')
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'bodySlam': {
      // The leap's shadow stays on the ground, shrinking at the top of the arc.
      const m = a.motion
      if (m.kind !== 'lunge') return
      const k = 1 - m.left / SLAM_LEAP
      const s = 1 - Math.sin(k * Math.PI) * 0.45
      blitEllipse(ctx, Math.round(10 * s), Math.max(1, Math.round(4 * s)), 'rgba(16,24,16,0.4)', a.x, a.y)
      return
    }
    case 'meteorMash': {
      if (a.age < a.activeFrom) {
        const k = a.age / a.activeFrom
        blitEllipse(ctx, Math.max(1, Math.round(r * (0.3 + 0.7 * k))), Math.max(1, Math.round(r * 0.45 * (0.3 + 0.7 * k))), 'rgba(16,16,40,0.4)', a.x, a.y)
        if (Math.floor(a.age * 24) % 2 === 0) dashedRing(ctx, a.x, a.y, r, a.age * 4, ['#a8c8f8', '#ffffff'], 0.8, 0.5)
        return
      }
      // A scorched crater that cools down.
      ctx.globalAlpha = fadeOut(a, 0.3)
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(1, Math.round(r * 0.35)), 'rgba(40,32,24,0.5)', a.x, a.y)
      blitEllipse(ctx, Math.round(r * 0.45), Math.max(1, Math.round(r * 0.2)), 'rgba(248,160,48,0.45)', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'twister':
      blitEllipse(ctx, Math.round(r * 0.9), Math.max(1, Math.round(r * 0.35)), 'rgba(24,16,48,0.3)', a.x, a.y + 12)
      return
    case 'sandTomb': {
      ctx.globalAlpha = Math.min(1, a.age / 0.3, fadeOut(a, 0.4))
      blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.5)), 'rgba(200,160,88,0.22)', a.x, a.y + 4)
      dashedRing(ctx, a.x, a.y + 4, r, -t * 4, ['#c8a060', '#e8d098'], 0.55, 0.5)
      dashedRing(ctx, a.x, a.y + 4, r * 0.6, t * 6, ['#a07840'], 0.35, 0.5)
      ctx.globalAlpha = 1
      return
    }
    case 'curse':
      ctx.globalAlpha = Math.min(1, a.age / 0.2, fadeOut(a, 0.3))
      dashedRing(ctx, a.x, a.y + 10, 9, t * 3, ['#7048b0', '#c8a8f0'], 0.6, 0.45)
      ctx.globalAlpha = 1
      return
  }
}

/* ---------------- Air layer ---------------- */

/** A speech bubble centered at (bx, by) with a move's icon in it (Metronome's call, Sketch's painting). */
const moveBubble = (ctx: Ctx, id: MoveId, bx: number, by: number, fill: string) => {
  const icon = moveIconSprite(id)
  const w = icon.width + 4
  const h = icon.height + 4
  px(ctx, bx - w / 2 - 1, by - h / 2, '#181818', w + 2, h)
  px(ctx, bx - w / 2, by - h / 2 - 1, '#181818', w, h + 2)
  px(ctx, bx - w / 2, by - h / 2, fill, w, h)
  px(ctx, bx - 1, by + h / 2, '#181818', 3, 2)
  px(ctx, bx, by + h / 2, fill, 1, 1)
  blitCentered(ctx, icon, bx, by)
}

/** Overlay layer (above Pokémon). */
export const drawEggAttack = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const r = a.shape.kind === 'circle' ? a.shape.r : 8
  switch (a.visual) {
    case 'hypnosis':
      return drawHypnosis(ctx, a, t)
    case 'dreamBite': {
      // Ghostly maws close over the target, then snap shut in a flash.
      const k = Math.min(1, a.age / DREAM_WINDUP)
      const gap = Math.round((1 - k * k) * (r + 6))
      const top = EGG_FX.mawTop()
      const bottom = EGG_FX.mawBottom()
      ctx.globalAlpha = a.age > DREAM_WINDUP ? fadeOut(a, 0.2) : Math.min(1, a.age / 0.08)
      blitCentered(ctx, top, a.x, a.y - gap - top.height / 2)
      blitCentered(ctx, bottom, a.x, a.y + gap + bottom.height / 2)
      if (a.age >= DREAM_WINDUP) {
        rays(ctx, a.x, a.y, r + 2, 8, ['#ffffff', '#f878b8'])
        for (let i = 0; i < 2; i++) px(ctx, a.x - 3 + i * 6, a.y - r - 4 - (a.age - DREAM_WINDUP) * 30, '#c8a8f0', 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'forcePalm': {
      // An open palm of blue aura thrust out, with a ring bursting off it.
      const dir = followAngle(a)
      const k = Math.min(1, a.age / 0.08)
      ctx.globalAlpha = fadeOut(a, 0.1)
      const cx = a.x - Math.cos(dir) * 6 * (1 - k)
      const cy = a.y - Math.sin(dir) * 6 * (1 - k)
      blitEllipse(ctx, Math.round(r * 0.75), Math.round(r * 0.75), 'rgba(56,104,200,0.45)', cx, cy)
      drawPalm(ctx, cx, cy, dir, Math.max(1, r / 12))
      if (a.age > 0.06) blitRing(ctx, Math.round(r * (0.7 + a.age * 2.5)), 1, '#a8d8ff', cx, cy)
      ctx.globalAlpha = 1
      return
    }
    case 'auraWave': {
      // Chevrons of aura racing on past the foe it went through.
      const dir = heading(a)
      ctx.globalAlpha = fadeOut(a, 0.12)
      for (let j = 0; j < 3; j++) {
        const back = j * 5
        crescent(ctx, a.x - Math.cos(dir) * back, a.y - Math.sin(dir) * back, r - j, dir, 1.6, 1, j === 0 ? ['#ffffff', '#a8d8ff', '#3868c8'] : ['#a8d8ff', '#3868c8'])
      }
      ctx.globalAlpha = 1
      return
    }
    case 'twister':
      return drawTwister(ctx, a, t, r)
    case 'sandTomb': {
      // Grains of sand whirling around the player at a few heights.
      ctx.globalAlpha = Math.min(1, a.age / 0.3, fadeOut(a, 0.4))
      const grains = Math.round(r * 2.6)
      for (let i = 0; i < grains; i++) {
        const lane = hash2(i, 7)
        const rr = r * (0.35 + 0.65 * lane)
        const angle = t * (3 + lane * 3) + i * 2.4
        const y = a.y + 4 + Math.sin(angle) * rr * 0.5 - hash2(i, 3) * 14
        px(ctx, a.x + Math.cos(angle) * rr, y, i % 5 === 0 ? '#fff0c0' : i % 2 ? '#d8b070' : '#a07840', i % 3 === 0 ? 1 : 2, 1)
        // A short streak behind the faster grains: the vortex reads as wind, not dots.
        if (i % 3 === 0) px(ctx, a.x + Math.cos(angle - 0.12) * rr, y - Math.cos(angle) * rr * 0.06, '#e8d098', 2, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'meteorMash': {
      const hot = a.tier >= MASH_MAX / 2
      if (a.age < a.activeFrom) {
        // Falling from the upper left, a comet's tail behind it, faster as it comes.
        const k = a.age / MASH_FALL
        const left = 1 - k * k
        const x = a.x - 70 * left
        const y = a.y - 8 - 110 * left
        for (let i = 1; i < 10; i++) {
          const tx = x - i * 3.5
          const ty = y - i * 5.5
          px(ctx, tx, ty, i < 3 ? '#ffffff' : i < 6 ? (hot ? '#f8d870' : '#a8c8f8') : hot ? '#f08030' : '#6888c0', i < 5 ? 2 : 1, i < 5 ? 2 : 1)
        }
        return blitRotated(ctx, hot ? EGG_FX.meteorFistHot() : EGG_FX.meteorFist(), x, y, Math.atan2(110, 70), 1 + Math.min(1, a.tier / MASH_MAX))
      }
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitRing(ctx, Math.round(r * (0.6 + e)), 1, hot ? '#f8d870' : '#d8e8f8', a.x, a.y - 2)
      if (e < 0.5) rays(ctx, a.x, a.y - 6, r * (1 - e), 10, [hot ? '#fff8c0' : '#ffffff', hot ? '#f8a030' : '#a8c8f8'], a.id)
      ctx.globalAlpha = 1
      return
    }
    case 'zenHeadbutt': {
      // A pink psychic crescent at the head of the hop, sparks on the way.
      const dir = heading(a)
      const k = Math.min(1, a.age / 0.12)
      ctx.globalAlpha = fadeOut(a, 0.12)
      crescent(ctx, a.x - Math.cos(dir) * 2, a.y - Math.sin(dir) * 2, r + 2, dir, 2.2, k, ['#ffd0e8', '#f85888', '#a03068'])
      for (let i = 0; i < 4; i++) {
        const back = 6 + i * 6
        px(ctx, a.x - Math.cos(dir) * back + Math.sin(dir) * (i % 2 ? 4 : -4), a.y - Math.sin(dir) * back - Math.cos(dir) * (i % 2 ? 4 : -4), '#f8a0c8')
      }
      if (a.age > 0.1) rays(ctx, a.x + Math.cos(dir) * r, a.y + Math.sin(dir) * r, 6, 6, ['#ffffff', '#f85888'], a.age * 4)
      ctx.globalAlpha = 1
      return
    }
    case 'foulPlay':
      return drawFoulPlay(ctx, a, r)
    case 'dynamicPunch': {
      // The fist pulls back glowing, then lands in a blast of fire and light.
      const dir = followAngle(a)
      if (a.age < a.activeFrom) {
        const k = a.age / PUNCH_WINDUP
        const pull = 10 * k
        const glow = Math.floor(a.age * 30) % 2 === 0
        blitEllipse(ctx, 7, 7, glow ? 'rgba(248,160,48,0.5)' : 'rgba(248,208,64,0.35)', a.x - Math.cos(dir) * pull, a.y - Math.sin(dir) * pull)
        return blitRotated(ctx, EGG_FX.punchFist(), a.x - Math.cos(dir) * pull, a.y - Math.sin(dir) * pull, dir, 2)
      }
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - e)
      const br = Math.round(r * (0.6 + e * 0.7))
      blitEllipse(ctx, br, br, 'rgba(240,112,32,0.55)', a.x, a.y)
      blitEllipse(ctx, Math.round(br * 0.65), Math.round(br * 0.65), '#f8d860', a.x, a.y)
      blitEllipse(ctx, Math.max(1, Math.round(br * 0.3)), Math.max(1, Math.round(br * 0.3)), '#ffffff', a.x, a.y)
      blitRing(ctx, br + 2, 1, '#fff0a0', a.x, a.y)
      rays(ctx, a.x, a.y, br + 8, 12, ['#ffffff', '#f8a030'], a.id)
      if (e < 0.35) blitRotated(ctx, EGG_FX.punchFist(), a.x - Math.cos(dir) * 4, a.y - Math.sin(dir) * 4, dir, 2)
      ctx.globalAlpha = 1
      return
    }
    case 'rollout':
      return drawRollout(ctx, a, t, r)
    case 'iceBall': {
      // A snowball, shaded and spinning, glowing once it hits at full power.
      const rr = Math.max(3, Math.round(r))
      const spin = a.age * 12
      if (a.tier >= 3) blitEllipse(ctx, rr + 2, rr + 2, 'rgba(160,232,255,0.45)', a.x, a.y)
      blitEllipse(ctx, rr, rr, '#78a8d8', a.x, a.y)
      blitEllipse(ctx, rr - 1, rr - 1, '#e8f8ff', a.x - 1, a.y - 1)
      blitEllipse(ctx, Math.max(1, Math.round(rr * 0.35)), Math.max(1, Math.round(rr * 0.35)), '#ffffff', a.x - rr * 0.35, a.y - rr * 0.35)
      for (let i = 0; i < 3; i++) {
        const angle = spin + (i * TAU) / 3
        px(ctx, a.x + Math.cos(angle) * rr * 0.55, a.y + Math.sin(angle) * rr * 0.55, '#a8d0f0')
      }
      return
    }
    case 'furyCutter': {
      if (a.age > 0.24) return
      const dir = followAngle(a)
      const hot = a.tier >= 2
      ctx.globalAlpha = Math.min(1, (0.24 - a.age) / 0.1)
      const colors = a.tier >= 3 ? ['#ffffff', '#f8f080', '#a8e070'] : hot ? ['#f0f8c0', '#a8e070', '#58a038'] : ['#d8f0a0', '#78c048', '#386820']
      crescent(ctx, a.x - Math.cos(dir) * r * 0.6, a.y - Math.sin(dir) * r * 0.6, r * 1.1, dir + (a.flip ? 0.25 : -0.25), 2.3, Math.min(1, a.age / 0.07), colors)
      ctx.globalAlpha = 1
      return
    }
    case 'sacredSword': {
      // The blade along the sweep, a pale trail behind it.
      if (m.kind !== 'orbit') return
      const p = { x: a.x - Math.cos(m.angle) * m.radius, y: a.y - Math.sin(m.angle) * m.radius }
      const len = m.radius + r
      for (let i = 1; i <= 4; i++) {
        const back = m.angle - Math.sign(m.spin) * i * 0.14
        ctx.globalAlpha = 0.5 - i * 0.1
        for (let d = 10; d < len; d += 1) px(ctx, p.x + Math.cos(back) * d, p.y + Math.sin(back) * d, i < 2 ? '#ffffff' : '#a8c8f8')
      }
      ctx.globalAlpha = 1
      const mid = len / 2 + 4
      const scale = Math.max(1, Math.round(len / 22))
      blitRotated(ctx, a.age < 0.05 ? EGG_FX.bladeGlow() : EGG_FX.blade(), p.x + Math.cos(m.angle) * mid, p.y + Math.sin(m.angle) * mid, m.angle, scale)
      return
    }
    case 'dragonDart':
      return drawDart(ctx, a, t)
    case 'snarl': {
      // A dark crescent snarl per head: violet, deep blue, crimson.
      const dir = heading(a)
      const colors = [['#e0c8ff', '#7048b0', '#382058'], ['#c8d8ff', '#4858b8', '#202860'], ['#ffd0d0', '#c83848', '#601020']][a.tier % 3]!
      ctx.globalAlpha = fadeOut(a, 0.08)
      crescent(ctx, a.x, a.y, r, dir, 2, 1, colors)
      crescent(ctx, a.x - Math.cos(dir) * 4, a.y - Math.sin(dir) * 4, r * 0.7, dir, 1.6, 1, [colors[1]!, colors[2]!])
      px(ctx, a.x + Math.cos(dir + 0.5) * r * 0.5, a.y + Math.sin(dir + 0.5) * r * 0.5, '#f83848', 2, 1)
      px(ctx, a.x + Math.cos(dir - 0.5) * r * 0.5, a.y + Math.sin(dir - 0.5) * r * 0.5, '#f83848', 2, 1)
      ctx.globalAlpha = 1
      return
    }
    case 'gigaImpact': {
      // The charge: a wall of orange speed lines with a white core.
      const dx = a.x - a.from.x
      const dy = a.y - a.from.y
      const len = Math.hypot(dx, dy)
      if (len < 1) return
      const ux = dx / len
      const uy = dy / len
      ctx.globalAlpha = fadeOut(a, 0.12)
      for (let lane = -3; lane <= 3; lane++) {
        const color = ['#ffffff', '#fff0b0', '#f8c040', '#f08030'][Math.abs(lane)]!
        for (let d = Math.abs(lane) * 5; d < len; d++) px(ctx, a.from.x + ux * d - uy * lane * 3, a.from.y + uy * d + ux * lane * 3, color)
      }
      crescent(ctx, a.x, a.y, r + 3, Math.atan2(uy, ux), 2.4, 1, ['#ffffff', '#f8d030', '#f08030'])
      ctx.globalAlpha = 1
      return
    }
    case 'gigaWave': {
      // A white flash, a star of light and a ring running out.
      const e = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - e)
      if (e < 0.25) blitEllipse(ctx, Math.round(r * 0.6), Math.round(r * 0.45), 'rgba(255,255,255,0.75)', a.x, a.y - 4)
      blitRing(ctx, Math.round(r), 2, '#fff0b0', a.x, a.y - 4)
      blitRing(ctx, Math.max(1, Math.round(r * 0.75)), 1, '#f8a030', a.x, a.y - 4)
      rays(ctx, a.x, a.y - 8, 18 + r * 0.5, 16, ['#ffffff', '#f8d030'], a.id)
      ctx.globalAlpha = 1
      return
    }
    case 'flail': {
      // A wild slap: a white arc with flying droplets (red sweat when HP is low).
      const dir = followAngle(a)
      const k = Math.min(1, a.age / 0.08)
      ctx.globalAlpha = fadeOut(a, 0.08)
      crescent(ctx, a.x - Math.cos(dir) * r * 0.5, a.y - Math.sin(dir) * r * 0.5, r, dir + (a.flip ? 0.4 : -0.4), 2, k, ['#ffffff', '#a8d8f8', '#4880c8'])
      for (let i = 0; i < 3; i++) px(ctx, a.x + Math.cos(dir + i - 1) * (r + a.age * 40), a.y + Math.sin(dir + i - 1) * (r + a.age * 40) + a.age * 60, a.tier >= 2 && i === 1 ? '#f85050' : '#a8d8f8')
      ctx.globalAlpha = 1
      return
    }
    case 'boneRush': {
      // The bone club swings through, the last swing bigger with a crack of light.
      const dir = followAngle(a)
      const k = Math.min(1, a.age / 0.07)
      const swing = (a.flip ? 1 : -1) * (1 - k) * 1.2
      const scale = a.tier ? 2 : 1
      ctx.globalAlpha = fadeOut(a, 0.06)
      blitRotated(ctx, EGG_FX.bone(), a.x - Math.cos(dir) * 4, a.y - Math.sin(dir) * 4, dir + Math.PI / 2 + swing, scale)
      if (a.age > 0.05) rays(ctx, a.x + Math.cos(dir) * 4, a.y + Math.sin(dir) * 4, a.tier ? 9 : 5, 8, ['#ffffff', '#e0c068'])
      ctx.globalAlpha = 1
      return
    }
    case 'metronome': {
      // The finger wags, and a bubble shows the move it called.
      const wag = Math.sin(a.age * 22) * 0.55
      ctx.globalAlpha = fadeOut(a, 0.15)
      blitRotated(ctx, EGG_FX.finger(), a.x, a.y + 8, wag)
      const id = MOVE_IDS[a.tier]
      if (id && a.age > 0.1) moveBubble(ctx, id, a.x + 1, a.y - 8, '#ffffff')
      ctx.globalAlpha = 1
      return
    }
    case 'sketch': {
      // The tail brush sweeps a stroke, and a bubble shows the move painted (green when it was just painted).
      const sweep = Math.sin(a.age * 14) * 0.7
      ctx.globalAlpha = fadeOut(a, 0.15)
      blitRotated(ctx, EGG_FX.brush(), a.x + 10, a.y + 12, 0.5 + sweep)
      const id = MOVE_IDS[a.tier]
      if (id && a.age > 0.08) moveBubble(ctx, id, a.x - 2, a.y - 8, a.flip ? '#d8f8c8' : '#ffffff')
      ctx.globalAlpha = 1
      return
    }
    case 'echoedVoice': {
      // Sound arcs in four directions, whiter at first and more violet the longer the echo.
      const colors = [['#ffffff', '#e0e0f0'], ['#ffffff', '#d8c8f8'], ['#f0e0ff', '#c8a8f8'], ['#e8d0ff', '#a070f8'], ['#f8c8f0', '#c058e0'], ['#ffd0f0', '#e040c0']][Math.min(5, a.tier)]!
      ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
      for (let q = 0; q < 4; q++) {
        const dir = q * (TAU / 4) + Math.PI / 4
        crescent(ctx, a.x, a.y, r, dir, 1.3, 1, [colors[0]!, colors[0]!, colors[1]!])
        crescent(ctx, a.x, a.y, r * 0.72, dir, 1, 1, [colors[1]!, colors[1]!])
        crescent(ctx, a.x, a.y, r * 0.48, dir, 0.8, 1, [colors[0]!])
      }
      ctx.globalAlpha = 1
      return
    }
    case 'curse': {
      // A nail over the head and a flickering ghost flame, flashing on every tick.
      const bob = Math.floor(t * 3 + a.id) % 2
      const flick = Math.floor(t * 12 + a.id) % 2
      ctx.globalAlpha = Math.min(1, a.age / 0.2, fadeOut(a, 0.3))
      const y = a.y - 16 - bob
      blitEllipse(ctx, 3, 4, flick ? 'rgba(112,72,176,0.7)' : 'rgba(160,112,216,0.6)', a.x, y - 6)
      blitEllipse(ctx, 1, 2, '#e0c8ff', a.x, y - 5 - flick)
      blitCentered(ctx, EGG_FX.nail(), a.x, y + 2)
      if (m.kind === 'tether' && m.next - a.age > m.every - 0.08) blitRing(ctx, Math.round(r + 4), 1, '#c8a8f0', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
  }
}

/** Hypnosis over the player's head: a swinging pendulum of rings for a moment. */
const drawHypnosis = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age > 0.45) return
  ctx.globalAlpha = Math.min(1, (0.45 - a.age) / 0.15)
  const swing = Math.sin(a.age * 18) * 6
  const x = a.x + swing
  const y = a.y - 18
  px(ctx, a.x, y - 8, '#a070d8', 1, 1)
  for (let i = 1; i < 6; i++) px(ctx, a.x + (swing * i) / 7, y - 8 + i * 1.4, '#c8a8f0')
  blitRing(ctx, 4, 1, '#f878b8', x, y)
  blitRing(ctx, 2, 1, '#ffffff', x, y)
  if (Math.floor(t * 12) % 2 === 0) px(ctx, x, y, '#ffffff')
  ctx.globalAlpha = 1
}

/** An open palm pointing along `dir`: a round heel and four short fingers. */
const drawPalm = (ctx: Ctx, x: number, y: number, dir: number, scale: number) => {
  const c = Math.cos(dir)
  const s = Math.sin(dir)
  blitEllipse(ctx, Math.round(3 * scale), Math.round(3 * scale), '#78b8f8', x, y)
  blitEllipse(ctx, Math.max(1, Math.round(1.5 * scale)), Math.max(1, Math.round(1.5 * scale)), '#ffffff', x, y)
  for (let f = 0; f < 4; f++) {
    const side = (f - 1.5) * 1.8 * scale
    for (let d = 3 * scale; d < (f === 0 || f === 3 ? 6 : 7) * scale; d++) {
      px(ctx, x + c * d - s * side, y + s * d + c * side, d > 5 * scale ? '#ffffff' : '#a8d8ff')
    }
  }
}

/** A dragon twister: ellipses stacked from a thin foot to a wide crown, dashes turning, debris flying round. */
const drawTwister = (ctx: Ctx, a: Attack, t: number, r: number) => {
  ctx.globalAlpha = Math.min(1, a.age / 0.2, fadeOut(a, 0.35))
  const layers = 8
  for (let i = 0; i < layers; i++) {
    const k = i / (layers - 1)
    const lr = Math.max(2, r * (0.22 + 0.9 * k))
    const sway = Math.sin(t * 6 + i * 0.9 + a.id) * 2.5 * k
    const x = a.x + sway
    const y = a.y + 12 - i * 4
    blitEllipse(ctx, Math.round(lr), Math.max(1, Math.round(lr * 0.32)), i % 2 ? 'rgba(72,200,184,0.45)' : 'rgba(112,72,232,0.45)', x, y)
    // A bright band whips round each layer.
    const spin = t * (9 + i) + a.id + i
    for (let s = 0; s < 6; s++) {
      const angle = spin + s * 0.16
      px(ctx, x + Math.cos(angle) * lr, y + Math.sin(angle) * lr * 0.32, s < 2 ? '#ffffff' : i % 2 ? '#a8f0e0' : '#d0c0ff')
    }
  }
  for (let i = 0; i < 6; i++) {
    const angle = t * 7 + i * 1.3 + a.id
    const k = hash2(i, a.id)
    px(ctx, a.x + Math.cos(angle) * r * (0.6 + k * 0.6), a.y + 6 - k * 26 + Math.sin(angle) * 3, i % 2 ? '#7a6040' : '#48a868', 2, 1)
  }
  ctx.globalAlpha = 1
}

/** Foul Play: three shadow claws gather over the foe, then rake down across it, red eyes glinting. */
const drawFoulPlay = (ctx: Ctx, a: Attack, r: number) => {
  const k = Math.min(1, a.age / FOUL_WINDUP)
  const dir = a.flip ? -1 : 1
  ctx.globalAlpha = a.age > FOUL_WINDUP ? fadeOut(a, 0.18) : Math.min(1, a.age / 0.06)
  const rr = r + 4
  if (a.age < FOUL_WINDUP) {
    px(ctx, a.x - 4 * dir - 1, a.y - rr - 6, '#f83848', 2, 1)
    px(ctx, a.x + 2 * dir, a.y - rr - 6, '#f83848', 2, 1)
    blitEllipse(ctx, Math.round(rr * 0.8), Math.round(rr * 0.5 * k + 1), 'rgba(40,16,48,0.45)', a.x, a.y - rr * 0.5)
  }
  const reveal = a.age < FOUL_WINDUP ? 0.25 : Math.min(1, (a.age - FOUL_WINDUP) / 0.06)
  for (let c = -1; c <= 1; c++) {
    const len = rr * 2.6
    const steps = Math.round(len * reveal)
    for (let i = 0; i < steps; i++) {
      const s = i / len
      // Each claw tapers: thick in the middle, a point at both ends.
      const w = s < 0.15 || s > 0.85 ? 1 : 3
      const x = a.x + dir * (c * 6 - rr * 1.2 + s * rr * 2.4) * 0.75
      const y = a.y - rr * 1.3 + s * rr * 2.6
      px(ctx, x - 1, y + 1, '#281038', w + 1, 1)
      px(ctx, x, y, i < 3 ? '#ffffff' : s > 0.6 ? '#f85878' : '#c8a0f8', w, 1)
    }
  }
  ctx.globalAlpha = 1
}

/** Rollout: a shell of rock chunks spinning around the player and dust behind; the chunks heat up with the streak. */
const drawRollout = (ctx: Ctx, a: Attack, t: number, r: number) => {
  ctx.globalAlpha = Math.min(1, a.age / 0.12, fadeOut(a, 0.2))
  const heat = Math.min(4, a.tier)
  const colors = ['#8a7860', '#a08860', '#c09050', '#e09040', '#f8b040']
  const spin = a.age * 16
  blitEllipse(ctx, Math.round(r), Math.round(r * 0.9), 'rgba(120,96,64,0.28)', a.x, a.y)
  for (let i = 0; i < 14; i++) {
    const angle = spin + (i * TAU) / 14
    const x = a.x + Math.cos(angle) * r
    const y = a.y + Math.sin(angle) * r * 0.9
    px(ctx, x - 2, y - 2, '#403020', 4, 4)
    px(ctx, x - 2, y - 2, i % 2 ? colors[heat]! : '#b8a888', 3, 3)
    px(ctx, x - 2, y - 2, '#e8dcc0')
  }
  dashedRing(ctx, a.x, a.y, r + 2, -spin, ['#584838', heat >= 3 ? '#f8d070' : '#d8c8a8'], 0.4)
  for (let i = 0; i < 3; i++) {
    const phase = (t * 4 + i / 3) % 1
    px(ctx, a.x + (hash2(i, Math.floor(t * 4 + i / 3)) - 0.5) * r * 2, a.y + r - phase * 6, '#d8c8a8')
  }
  if (heat >= 2) for (let i = 0; i < heat; i++) px(ctx, a.x + Math.cos(spin * 1.3 + i * 2) * (r + 4), a.y + Math.sin(spin * 1.3 + i * 2) * (r + 4), '#fff0a0')
  ctx.globalAlpha = 1
}

/** A Dragon Dart: a little teal Dreepy, head first, a ghostly tail fading behind. */
const drawDart = (ctx: Ctx, a: Attack, t: number) => {
  const dir = heading(a)
  const c = Math.cos(dir)
  const s = Math.sin(dir)
  // A wavy ghost tail fading out behind.
  for (let i = 1; i < 9; i++) {
    ctx.globalAlpha = 0.75 - i * 0.08
    const wave = Math.sin(t * 30 + i * 0.9) * 1.2
    px(ctx, a.x - c * (2 + i * 2) - s * wave, a.y - s * (2 + i * 2) + c * wave, i < 4 ? '#a8e8e0' : '#58b8b0', i < 5 ? 2 : 1, i < 5 ? 2 : 1)
  }
  ctx.globalAlpha = 1
  blitEllipse(ctx, 4, 3, '#1c4844', a.x, a.y)
  blitEllipse(ctx, 3, 2, '#48a8a0', a.x, a.y)
  blitEllipse(ctx, 1, 1, '#a8e8e0', a.x - c - s, a.y - s + c - 1)
  // Head first: a yellow eye with a red pupil, looking where it flies.
  px(ctx, a.x + c * 2 - s, a.y + s * 2 + c - 1, '#f8e070', 2, 2)
  px(ctx, a.x + c * 3 - s, a.y + s * 3 + c - 1, '#e83030')
}

/* ---------------- On the player ---------------- */

/** How the player's sprite shows: lifted mid-leap (Body Slam), or hidden under the mound (Dig). */
export const eggPlayerLook = (g: Game) => {
  if (localPlayer(g).hidden?.move === 'dig') return { lift: 0, alpha: 0 }
  for (const a of g.attacks) {
    if (a.visual !== 'bodySlam' || a.motion.kind !== 'lunge' || a.age < 0 || a.owner !== localPlayer(g).slot) continue
    const k = 1 - a.motion.left / SLAM_LEAP
    return { lift: Math.round(Math.sin(k * Math.PI) * SLAM_LIFT), alpha: 1 }
  }
  return null
}

/** Meteor Mash's might (steel glints circling the feet, one per stack) and Giga Impact's recharge (dizzy swirl over the head). */
export const drawEggPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const mash = p.moves.find((m) => m.id === 'meteorMash')?.stacks ?? 0
  for (let i = 0; i < mash; i++) {
    const angle = t * 3 + (i * TAU) / mash
    const hot = mash >= MASH_MAX / 2
    px(ctx, p.x + Math.cos(angle) * 12, p.y - 2 + Math.sin(angle) * 4, Math.floor(t * 8 + i) % 3 === 0 ? '#ffffff' : hot ? '#f8d870' : '#a8c8f8')
  }
  if (p.rooted > 0) {
    const y = p.y - 34
    for (let k = 0; k < 3; k++) {
      const angle = t * 6 + (k * TAU) / 3
      px(ctx, p.x + Math.cos(angle) * 7, y + Math.sin(angle) * 2, k === 0 ? '#ffffff' : '#f8d030', 2, 2)
    }
    if (Math.floor(t * 4) % 2 === 0) px(ctx, p.x + 9, p.y - 26, '#a8d8f8', 1, 2)
  }
}
