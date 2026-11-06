import { blitCentered, blitEllipse, blitRing, fillPlotted, plot } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { LUNGE_TIME, MINE_ARM } from '../game/moveRules'
import type { Attack } from '../game/types'
import { FX } from './art'
import { dashedRing } from './strokes'

/**
 * Visuals for lunges, chains, mines and turrets (`game/moveRules.ts`). Kept
 * apart from `draw.ts` like `evolved.ts`; both frame passes fall through here.
 */

type Ctx = CanvasRenderingContext2D

const ARC_COLORS = {
  shock: { edge: '#f8d030', core: '#ffffff', width: 1 },
  thunderbolt: { edge: '#f8b830', core: '#ffffff', width: 1 },
  hex: { edge: '#7048b0', core: '#e0c8ff', width: 1 },
} as const

const BLAST_COLORS = {
  spikesBlast: ['rgba(176,72,200,0.45)', '#c070d0', '#f0d0f8'],
  barbsBlast: ['rgba(150,70,190,0.5)', '#b058d0', '#c8f080'],
} as const

/**
 * Jagged arc between two points, re-rolled a few times a second so it crackles. Each point is an
 * edge square with a core pixel, the next point's square laid over it: plotted as two paths, with
 * the core pixels the next square covers left out, so it looks as drawing them one by one did.
 */
export const arc = (ctx: Ctx, a: Attack, t: number, style: { edge: string; core: string; width: number }, strand = 0) => {
  const dx = a.x - a.from.x
  const dy = a.y - a.from.y
  const len = Math.hypot(dx, dy)
  const steps = Math.max(2, Math.round(len / 7))
  const nx = -dy / (len || 1)
  const ny = dx / (len || 1)
  const seed = a.id * 7 + strand * 131 + Math.floor(t * 24)
  const w = style.width
  let px = a.from.x
  let py = a.from.y
  // The last point's core, waiting to see whether the next square covers it (none yet).
  let cx = Infinity
  let cy = Infinity
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const jag = i === steps ? 0 : (hash2(i, seed) - 0.5) * 10
    const qx = a.from.x + dx * k + nx * jag
    const qy = a.from.y + dy * k + ny * jag
    const n = Math.max(1, Math.round(Math.hypot(qx - px, qy - py)))
    for (let s = 0; s < n; s++) {
      const x = Math.round(px + ((qx - px) * s) / n)
      const y = Math.round(py + ((qy - py) * s) / n)
      if (cx !== Infinity && !(Math.abs(x - cx) <= w && Math.abs(y - cy) <= w)) plot(style.core, cx, cy)
      plot(style.edge, x - w, y - w, 1 + w * 2, 1 + w * 2)
      cx = x
      cy = y
    }
    px = qx
    py = qy
  }
  plot(style.core, cx, cy)
  fillPlotted(ctx)
}

/** Speed lines from where the lunge started to the player, fading once it lands. */
const streak = (ctx: Ctx, a: Attack, colors: readonly string[]) => {
  const dx = a.x - a.from.x
  const dy = a.y - a.from.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return
  const ux = dx / len
  const uy = dy / len
  ctx.globalAlpha = Math.max(0, Math.min(1, (a.ttl - a.age) / (a.ttl - LUNGE_TIME)))
  for (let lane = -2; lane <= 2; lane++) {
    const from = Math.abs(lane) * 6
    ctx.fillStyle = colors[Math.abs(lane)]!
    for (let d = from; d < len; d += 1) {
      ctx.fillRect(Math.round(a.from.x + ux * d - uy * lane * 3), Math.round(a.from.y + uy * d + ux * lane * 3), 1, 1)
    }
  }
  // Leading crescent while it still moves.
  if (a.age < LUNGE_TIME && a.shape.kind === 'circle') {
    const r = a.shape.r
    const dir = Math.atan2(uy, ux)
    for (let i = -8; i <= 8; i++) {
      const angle = dir + i * 0.14
      for (let k = 0; k < 3 - Math.abs(i) / 4; k++) {
        ctx.fillStyle = colors[k]!
        ctx.fillRect(Math.round(a.x + Math.cos(angle) * (r - k)), Math.round(a.y + Math.sin(angle) * (r - k)), 1, 1)
      }
    }
  }
  ctx.globalAlpha = 1
}

/** Ground layer (under Pokémon): mines on the floor and turret shadows. */
export const drawMoveFxGround = (ctx: Ctx, a: Attack) => {
  switch (a.visual) {
    case 'spikes':
    case 'barbs': {
      if (a.pierce <= 0) return
      // Dim until armed, blinking in its last second.
      const dying = a.ttl - a.age < 1 && Math.floor(a.age * 8) % 2 === 0
      ctx.globalAlpha = a.age < MINE_ARM ? 0.45 : dying ? 0.5 : 1
      blitCentered(ctx, FX[a.visual](), a.x, a.y - 2)
      ctx.globalAlpha = 1
      return
    }
    case 'wisp':
    case 'inferno': {
      ctx.globalAlpha = Math.min(1, a.age / 0.15, (a.ttl - a.age) / 0.3)
      blitEllipse(ctx, 5, 2, 'rgba(16,24,48,0.3)', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
  }
}

/** Overlay layer (above Pokémon). */
export const drawMoveFxAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'quick':
    case 'extremeSpeed': {
      const colors = a.visual === 'quick' ? ['#ffffff', '#c8d0e8', '#8890b0'] : ['#ffffff', '#f8d030', '#c89000']
      if (a.motion.kind === 'lunge') return streak(ctx, a, colors)
      // Extreme Speed's landing shockwave.
      if (a.shape.kind !== 'circle') return
      ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
      dashedRing(ctx, a.x, a.y, a.shape.r, a.age * 18, colors, 0.75, 0.6)
      ctx.globalAlpha = 1
      return
    }
    case 'shock':
    case 'thunderbolt':
    case 'hex': {
      ctx.globalAlpha = Math.max(0, Math.min(1, (a.ttl - a.age) / 0.12))
      arc(ctx, a, t, ARC_COLORS[a.visual])
      // Thunderbolt crackles with a second strand.
      if (a.visual === 'thunderbolt') arc(ctx, a, t, { edge: '#f8e070', core: '#fff8d0', width: 0 }, 1)
      blitRing(ctx, 3 + Math.round(a.age * 14), 1, ARC_COLORS[a.visual].core, a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'spikesBlast':
    case 'barbsBlast': {
      if (a.shape.kind !== 'circle') return
      const [fill, line, spark] = BLAST_COLORS[a.visual]
      const k = a.age / a.ttl
      const r = Math.round(a.shape.r * (0.55 + 0.45 * k))
      ctx.globalAlpha = Math.max(0, 1 - k)
      blitEllipse(ctx, r, Math.max(1, Math.round(r * 0.6)), fill, a.x, a.y)
      dashedRing(ctx, a.x, a.y, r, a.id, [line, spark], 0.7, 0.6)
      ctx.globalAlpha = 1
      return
    }
    case 'wisp':
    case 'inferno': {
      const frames = FX[a.visual]()
      const bob = Math.round(Math.sin((a.age + a.id) * 5) * 1.5)
      ctx.globalAlpha = Math.min(1, a.age / 0.15, (a.ttl - a.age) / 0.3)
      blitCentered(ctx, frames[Math.floor((t + a.id) * 8) % 2]!, a.x, a.y - 12 + bob)
      ctx.globalAlpha = 1
      return
    }
    case 'wispShot':
      return blitCentered(ctx, FX.wispShot(), a.x, a.y)
    case 'infernoShot':
      return blitCentered(ctx, FX.ember()[Math.floor(t * 12) % 2]!, a.x, a.y)
  }
}
