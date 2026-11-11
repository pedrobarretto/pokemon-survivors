import { blitEllipse, blitRing } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { GATES } from '../data/domains/palkia'
import type { DomainState } from '../game/domain'
import { foldOf, gateExit, hallEdges, MOUTH, swapOf, twistOf } from '../game/palkiaDomain'
import type { RiftArena } from '../game/rift'
import type { Game } from '../game/types'

type Ctx = CanvasRenderingContext2D

/**
 * Palkia's Folded Space on screen (`game/palkiaDomain.ts`): the twin portals
 * of the crossing (rose while they lead across, violet and spinning the other
 * way while space is twisted), the seams where the hall wraps, the tether of
 * a swap, and the walls of the Origin Forme's fold.
 */

const ROSE = '#f8b8e8'
const PEARL = '#ffffff'
const VIOLET = '#9050d8'
const DEEP = '#28103c'
/** On the pale pearl floor, the seams and the tether need the deep end of Palkia's pinks to read. */
const MAGENTA = '#c83cb0'
const PLUM = '#6c2080'

/**
 * A portal mouth: a tear of space standing on the floor, its glow pooled at
 * its foot, motes spiralling into its dark heart (`spin` sets which way), its
 * rim blinking while `blink`.
 */
const drawMouth = (ctx: Ctx, x: number, y: number, t: number, rim: string, spin: number, blink: boolean) => {
  const pulse = Math.round(Math.sin(t * 4) * 1)
  blitEllipse(ctx, MOUTH.reach + 4, 6, 'rgba(248,184,232,0.28)', x, y)
  blitEllipse(ctx, MOUTH.reach, 4, rim === ROSE ? 'rgba(248,184,232,0.45)' : 'rgba(144,80,216,0.5)', x, y)
  const cy = y - 15
  const rx = 7 + pulse
  const ry = 15
  blitEllipse(ctx, rx + 3, ry + 3, 'rgba(248,184,232,0.2)', x, cy)
  if (!blink || Math.floor(t * 8) % 2 === 0) blitEllipse(ctx, rx + 1, ry + 1, PEARL, x, cy)
  blitEllipse(ctx, rx, ry, rim, x, cy)
  blitEllipse(ctx, rx - 2, ry - 2, DEEP, x, cy)
  blitEllipse(ctx, Math.max(1, rx - 4), ry - 5, '#140820', x, cy)
  for (let i = 0; i < 8; i++) {
    const q = (t * 0.8 + i / 8) % 1
    const a = spin * t * 2.5 + (i / 8) * TAU
    ctx.fillStyle = i % 2 === 0 ? PEARL : rim
    ctx.fillRect(Math.round(x + Math.cos(a) * (1 - q) * (rx - 1)), Math.round(cy + Math.sin(a) * (1 - q) * (ry - 2)), 1, 1)
  }
  // Shards of space flaking off its rim and drifting up.
  for (let i = 0; i < 4; i++) {
    const q = (t * 0.6 + i / 4) % 1
    ctx.globalAlpha = 1 - q
    ctx.fillStyle = rim
    ctx.fillRect(Math.round(x + (hash2(i, 1, 19) - 0.5) * 22), Math.round(cy - ry + 6 - q * 16), 1, 2)
  }
  ctx.globalAlpha = 1
}

/** The crossing's gates: each near mouth, and the landing across its gap as a faint ring. A twisted mouth glows violet and turns the other way. */
const drawGates = (ctx: Ctx, arena: RiftArena, d: DomainState, t: number) => {
  const { twisted, warning } = twistOf(d)
  GATES.forEach((gate, i) => {
    const to = gateExit(i, false)
    const tx = Math.round(arena.x + to[0])
    const ty = Math.round(arena.y + to[1])
    ctx.globalAlpha = 0.55
    blitRing(ctx, Math.round(MOUTH.reach * 0.9), 1, ROSE, tx, ty)
    ctx.globalAlpha = 1
    const x = Math.round(arena.x + gate.from[0])
    const y = Math.round(arena.y + gate.from[1])
    drawMouth(ctx, x, y, t, twisted ? VIOLET : ROSE, twisted ? -1 : 1, warning > 0)
    // A dotted thread across the gap toward where it leads.
    const [ex, ey] = gateExit(i, twisted)
    const dx = arena.x + ex - x
    const dy = arena.y + ey - y
    const len = Math.hypot(dx, dy) || 1
    for (let s = MOUTH.reach + 4 + ((t * 40) % 10); s < Math.min(len, 90); s += 10) {
      ctx.fillStyle = twisted ? VIOLET : ROSE
      ctx.fillRect(Math.round(x + (dx / len) * s), Math.round(y + (dy / len) * s), 1, 1)
    }
  })
}

/** Where the hall wraps: a seam of torn space down each wall (a glowing band, a magenta core flickering white), chevrons running out through it. */
const drawSeams = (ctx: Ctx, arena: RiftArena, d: DomainState, t: number) => {
  const { west, east, top, bottom } = hallEdges(arena, d)
  for (const [x, dir] of [[Math.round(west), -1], [Math.round(east), 1]] as const) {
    const inner = x - dir * 5
    ctx.fillStyle = 'rgba(200,60,176,0.22)'
    ctx.fillRect(Math.min(x, inner), Math.round(top), 5, Math.round(bottom - top))
    for (let y = Math.round(top); y < bottom; y++) {
      const lit = Math.floor(y / 5 - t * 8) % 5 === 0
      ctx.fillStyle = lit ? PEARL : MAGENTA
      ctx.fillRect(x - (dir > 0 ? 2 : 0), y, 2, 1)
      if (hash2(y, Math.floor(t * 6), 21) < 0.15) {
        ctx.fillStyle = PLUM
        ctx.fillRect(x - dir * 3, y, 1, 1)
      }
    }
    for (let i = 0; i < 7; i++) {
      const y = Math.round(top + ((i + 0.5) / 7) * (bottom - top))
      const k = (t * 1.2 + i * 0.37) % 1
      const cx = Math.round(x - dir * (16 - k * 12))
      ctx.globalAlpha = Math.min(1, k * 2)
      ctx.fillStyle = MAGENTA
      for (const [ox, oy] of [[0, -3], [1, -2], [2, -1], [3, 0], [2, 1], [1, 2], [0, 3]] as const) ctx.fillRect(cx + dir * ox, y + oy, 1, 1)
    }
    ctx.globalAlpha = 1
  }
}

/** The fold's walls: the void that's taken the hall's sides, creased at its edge; while it's warned of, the creases blink where they'll stop. */
const drawFold = (ctx: Ctx, arena: RiftArena, d: DomainState, t: number) => {
  const fold = foldOf(d)
  const { west, east, top, bottom } = hallEdges(arena, d)
  const full = hallEdges(arena, d, 0)
  if (fold.warning && Math.floor(t * 8) % 2 === 0) {
    ctx.fillStyle = VIOLET
    const depth = full.east - full.west
    for (let y = Math.round(top); y < bottom; y += 3) {
      ctx.fillRect(Math.round(full.west + depth * 0.18), y, 1, 1)
      ctx.fillRect(Math.round(full.east - depth * 0.18), y, 1, 1)
    }
  }
  if (fold.k <= 0) return
  for (const [x0, x1, edge] of [[full.west - 2, west, Math.round(west)], [east, full.east + 2, Math.round(east)]] as const) {
    ctx.fillStyle = 'rgba(20,8,32,0.88)'
    ctx.fillRect(Math.round(x0), Math.round(top), Math.max(0, Math.round(x1 - x0)), Math.round(bottom - top))
    // Creases inside the folded strip.
    ctx.fillStyle = 'rgba(176,96,200,0.5)'
    for (let y = Math.round(top); y < bottom; y += 2) {
      const zig = Math.abs(((y + t * 30) % 16) - 8) / 2
      const w = x1 - x0
      for (let j = 1; j < 3; j++) ctx.fillRect(Math.round(x0 + (w * j) / 3 + zig - 2), y, 1, 1)
    }
    ctx.fillStyle = ROSE
    for (let y = Math.round(top); y < bottom; y++) ctx.fillRect(edge + (hash2(y, 1, 9) < 0.5 ? 0 : -1), y, 1, 1)
  }
}

/** A swap's tether: dots running from Palkia to the player it marked, and rings closing on them as it comes. */
const drawTether = (ctx: Ctx, g: Game, d: DomainState, t: number) => {
  const swap = swapOf(g, d)
  const boss = g.enemies.find((e) => e.id === d.bossId)
  if (!swap || !boss) return
  const sx = boss.x
  const sy = boss.y - 14
  const dx = swap.x - sx
  const dy = swap.y - 8 - sy
  const len = Math.hypot(dx, dy) || 1
  for (let s = (t * 60) % 8; s < len; s += 8) {
    ctx.fillStyle = Math.floor(s / 8) % 2 === 0 ? MAGENTA : PEARL
    ctx.fillRect(Math.round(sx + (dx / len) * s), Math.round(sy + (dy / len) * s), 2, 2)
    ctx.fillStyle = PLUM
    ctx.fillRect(Math.round(sx + (dx / len) * s), Math.round(sy + (dy / len) * s) + 2, 2, 1)
  }
  for (let i = 0; i < 2; i++) {
    const r = Math.round(6 + (1 - ((swap.k + i * 0.5) % 1)) * 22)
    ctx.globalAlpha = 0.8
    blitRing(ctx, r, 1, i === 0 ? MAGENTA : VIOLET, Math.round(swap.x), Math.round(swap.y - 6))
    blitRing(ctx, r, 1, i === 0 ? MAGENTA : VIOLET, Math.round(boss.x), Math.round(boss.y - 14))
  }
  ctx.globalAlpha = 1
}

/** Ground layer, under everyone: the crossing's gates, the hall's seams and fold. */
export const drawPalkiaGround = (ctx: Ctx, arena: RiftArena, d: DomainState, t: number) => {
  if (d.act === 'crossing') return drawGates(ctx, arena, d, t)
  if (d.act !== 'battle' || d.phase < 1) return
  drawFold(ctx, arena, d, t)
  drawSeams(ctx, arena, d, t)
}

/** Air layer: the swap's tether. */
export const drawPalkiaAir = (ctx: Ctx, g: Game, d: DomainState, t: number) => {
  if (d.act === 'battle') drawTether(ctx, g, d, t)
}

/** Over the frame: a twist warned of (rings closing on the screen's middle), then a violet cast with creases while space is twisted. */
export const drawPalkiaScreen = (ctx: Ctx, g: Game, d: DomainState, t: number) => {
  const { twisted, warning } = twistOf(d)
  const { w, h } = g.view
  if (warning > 0) {
    for (let i = 0; i < 3; i++) {
      const r = Math.round(8 + (1 - ((warning + i / 3) % 1)) * Math.max(w, h) * 0.55)
      ctx.globalAlpha = 0.5
      blitRing(ctx, r, 1, ROSE, Math.round(w / 2), Math.round(h / 2))
    }
    ctx.globalAlpha = 1
  }
  if (!twisted) return
  ctx.fillStyle = 'rgba(96,40,152,0.2)'
  ctx.fillRect(0, 0, w, h)
  ctx.fillStyle = 'rgba(248,184,232,0.45)'
  for (let i = 0; i < 4; i++) {
    const y0 = Math.round(((hash2(i, 1, 13) * h + t * 50 * (i % 2 ? 1 : -1)) % h + h) % h)
    for (let x = 0; x < w; x += 2) ctx.fillRect(x, y0 + Math.round(Math.sin(x / 14 + t * 4 + i) * 3), 2, 1)
  }
}
