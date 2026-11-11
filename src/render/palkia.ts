import { blitEllipse, blitRing, context2d, createCanvas } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { GATES } from '../data/domains/palkia'
import type { DomainState } from '../game/domain'
import { foldOf, gateExit, hallEdges, MOUTH, swapOf, twistOf } from '../game/palkiaDomain'
import type { RiftArena } from '../game/rift'
import type { Enemy, Game } from '../game/types'
import { ENEMIES } from '../data/enemies'
import { bossForm, formChangeAt, formFlash, formLift, FORM_SWAP } from './legendFx'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * Palkia's Folded Space on screen (`game/palkiaDomain.ts`): the twin portals
 * of the crossing (rose while they lead across, violet and spinning the other
 * way while space is twisted), the seams where the hall wraps, the tether of
 * a swap, the walls of the Origin Forme's fold, its transformation (space
 * cracking round it as it changes in a white flash) and its last Spacial Rend
 * tearing the screen in two while it charges.
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

/** Where a boss stands on screen (mid-body). */
const onScreen = (boss: Enemy, camX: number, camY: number) => ({ x: Math.round(boss.x - camX), y: Math.round(boss.y - 18 - camY) })

/**
 * Space cracking round Palkia as it turns Origin: jagged rays of torn space
 * running out from it to past the screen's edge as the change grows (`k`, 0..1),
 * a shard of the void glinting along each.
 */
const drawCracks = (ctx: Ctx, x: number, y: number, k: number, reach: number, t: number) => {
  const grow = Math.min(1, k / 0.45)
  for (let i = 0; i < 7; i++) {
    let a = (i / 7) * TAU + hash2(i, 1, 31) * 0.6
    let px = x
    let py = y
    const len = reach * grow * (0.6 + hash2(i, 2, 31) * 0.4)
    for (let s = 0; s < len; s += 2) {
      // Each ray bends every few steps, as cracks do.
      if (s % 16 === 0) a += (hash2(i, s, 32) - 0.5) * 0.8
      px += Math.cos(a) * 2
      py += Math.sin(a) * 2
      const wide = s < len * 0.35 ? 3 : 2
      const cx = Math.round(px)
      const cy = Math.round(py)
      ctx.fillStyle = PLUM
      ctx.fillRect(cx - 1, cy - 1, wide + 1, wide + 1)
      ctx.fillStyle = Math.floor(s / 8 - t * 12) % 5 === 0 ? PEARL : ROSE
      ctx.fillRect(cx, cy, wide - 1, wide - 1)
    }
  }
}

/**
 * Palkia turning Origin (its third phase's opening, `formChangeAt`): the hall
 * dims violet round it, space cracks out from it, the frame whites out as the
 * new form takes the old one's place (`bossForm`), and shock rings run out as
 * it settles.
 */
const drawOrigin = (ctx: Ctx, g: Game, boss: Enemy, camX: number, camY: number, t: number) => {
  const k = formChangeAt(boss)
  if (k < 0) return
  const { w, h } = g.view
  const at = onScreen(boss, camX, camY)
  const dim = Math.sin(Math.min(1, k / 0.9) * Math.PI)
  ctx.fillStyle = `rgba(36,8,56,${(0.45 * dim).toFixed(2)})`
  ctx.fillRect(0, 0, w, h)
  if (k < FORM_SWAP + 0.15) drawCracks(ctx, at.x, at.y, k, Math.hypot(w, h), t)
  // Palkia itself stays out of the dark, whitening as it changes.
  drawPokemon(ctx, sprites(ENEMIES[boss.kind].dex, boss.shiny, bossForm(boss)), 'Idle', boss.dir, t, Math.round(boss.x - camX), Math.round(boss.y - camY) - formLift(k), { flash: formFlash(k) })
  // Its rings of light, closing on it before the change and running out after.
  if (k < FORM_SWAP) {
    for (let i = 0; i < 3; i++) {
      const r = Math.round(10 + (1 - ((k * 3 + i / 3) % 1)) * 90)
      ctx.globalAlpha = 0.7
      blitRing(ctx, r, 1, i === 0 ? PEARL : ROSE, at.x, at.y)
    }
  } else {
    const q = (k - FORM_SWAP) / (1 - FORM_SWAP)
    for (let i = 0; i < 3; i++) {
      const r = Math.round(12 + q * Math.max(w, h) * (0.5 + i * 0.25))
      ctx.globalAlpha = Math.max(0, 1 - q) * 0.9
      blitRing(ctx, r, 2, i === 1 ? VIOLET : i === 2 ? PEARL : ROSE, at.x, at.y)
    }
  }
  ctx.globalAlpha = 1
  // The change itself: the frame whites out, then clears.
  const white = Math.max(0, 1 - Math.abs(k - FORM_SWAP - 0.04) / 0.12)
  if (white > 0) {
    ctx.fillStyle = `rgba(255,248,255,${(0.85 * white).toFixed(2)})`
    ctx.fillRect(0, 0, w, h)
  }
}

/** A copy of the frame for the tear to move its halves apart from (sized to the view as it comes). */
let frameCopy: HTMLCanvasElement | null = null

/**
 * Tears the frame in two along a jagged line through (x, y) at `slope`: each
 * side moves `gap` px away from it (in 2 px columns, so its edges stay hard),
 * and the void shows between them, rimmed in Palkia's pinks, a star or two in it.
 */
const tearFrame = (ctx: Ctx, w: number, h: number, x: number, y: number, slope: number, gap: number, t: number) => {
  if (!frameCopy || frameCopy.width !== w || frameCopy.height !== h) frameCopy = createCanvas(w, h)
  const copy = context2d(frameCopy)
  copy.clearRect(0, 0, w, h)
  copy.drawImage(ctx.canvas, 0, 0)
  const flicker = Math.floor(t * 20) % 2
  for (let cx = 0; cx < w; cx += 2) {
    const jag = Math.round((hash2(Math.floor(cx / 8), 1, 33) - 0.5) * 6 + (hash2(Math.floor(cx / 3), 2, 33) - 0.5) * 2)
    const c = Math.max(0, Math.min(h, Math.round(y + slope * (cx - x)) + jag))
    if (gap > 0) {
      if (c > 0) ctx.drawImage(frameCopy, cx, 0, 2, c, cx, -gap, 2, c)
      if (c < h) ctx.drawImage(frameCopy, cx, c, 2, h - c, cx, c + gap, 2, h - c)
      ctx.fillStyle = DEEP
      ctx.fillRect(cx, c - gap, 2, gap * 2)
      if (hash2(cx, 3, 33) > 0.86) {
        ctx.fillStyle = hash2(cx, 4, 33) > 0.5 ? PEARL : ROSE
        ctx.fillRect(cx, c - gap + Math.floor(hash2(cx, 5, 33) * gap * 2), 1, 1)
      }
    }
    ctx.fillStyle = MAGENTA
    ctx.fillRect(cx, c - gap - 2, 2, 1)
    ctx.fillRect(cx, c + gap + 1, 2, 1)
    ctx.fillStyle = flicker ? PEARL : ROSE
    ctx.fillRect(cx, c - gap - 1, 2, 1)
    ctx.fillRect(cx, c + gap, 2, 1)
  }
}

/**
 * The Origin Forme's Spacial Rend charging (its blast, `visual: 'space'`): a
 * crack runs across the frame at Palkia's feet, then splits it, the void widening
 * between the halves until the burst.
 */
const drawRend = (ctx: Ctx, g: Game, boss: Enemy, camX: number, camY: number, t: number) => {
  const blast = boss.fight?.blast
  if (!blast || blast.visual !== 'space') return
  const k = 1 - blast.left / blast.total
  const { w, h } = g.view
  const gap = k < 0.2 ? 0 : Math.round(((k - 0.2) / 0.8) ** 2 * 10)
  // Just under its feet, so Palkia stands whole over the rift it opens.
  tearFrame(ctx, w, h, Math.round(boss.x - camX), Math.round(boss.y - camY) + 6, -0.28, gap, t)
}

/**
 * Over the frame: a twist warned of (rings closing on the screen's middle),
 * then a violet cast with creases while space is twisted; the Origin Forme's
 * transformation and its Spacial Rend tearing the frame.
 */
export const drawPalkiaScreen = (ctx: Ctx, g: Game, d: DomainState, camX: number, camY: number, t: number) => {
  const boss = d.act === 'battle' ? g.enemies.find((e) => e.id === d.bossId && e.dying < 0) : undefined
  if (boss) {
    drawRend(ctx, g, boss, camX, camY, t)
    drawOrigin(ctx, g, boss, camX, camY, t)
  }
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
