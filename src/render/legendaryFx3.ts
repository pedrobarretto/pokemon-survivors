import { blitEllipse, blitRing, context2d, createCanvas, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { FURY, MYSTIC, REND, RETALIATE, type LegendaryMove3Id } from '../game/legendaryMoves3'
import { ownerOf } from '../game/players'
import type { Attack, Game } from '../game/types'
import { medallion } from './legendaryArt'
import { fadeOut, px, thickLine } from './legendaryFx'

type Ctx = CanvasRenderingContext2D

/**
 * The third batch of legendary moves on screen (`game/legendaryMoves3.ts`)
 * and their icons: Palkia's tears in space, the lake trio's orbs, the Swords'
 * X cut, Keldeo's long blade and Hoopa's rings with the fists out of them.
 */

/* ---------------- Icons ---------------- */

type Px = (x: number, y: number, color: string, w?: number, h?: number) => void

const paint = (w: number, h: number, fn: (dot: Px) => void) => {
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  fn((x, y, color, pw = 1, ph = 1) => {
    ctx.fillStyle = color
    ctx.fillRect(x, y, pw, ph)
  })
  return canvas
}

export const LEGENDARY_ICONS_3: Record<LegendaryMove3Id, () => PixelSprite> = {
  spacialRend: () =>
    medallion(paint(11, 11, (dot) => {
      // A tear down the diagonal: a dark slit rimmed in pink with a white core.
      for (let i = 0; i < 11; i++) {
        const x = i
        const y = 10 - i
        dot(x, y, '#f8b8e8')
        if (i > 0 && i < 10) dot(x, y - 1, '#c83cb0')
        if (i > 1 && i < 9) dot(x - 1, y, '#28103c')
      }
      dot(4, 6, '#ffffff')
      dot(6, 4, '#ffffff')
    }), '#1c0c2c'),
  mysticalPower: () =>
    medallion(paint(11, 11, (dot) => {
      for (const [cx, cy, c] of [[5, 2, '#f8d048'], [2, 7, '#f878b0'], [8, 7, '#58a0f8']] as const) {
        dot(cx - 1, cy - 1, c, 3, 3)
        dot(cx, cy - 2, c)
        dot(cx, cy + 2, c)
        dot(cx - 2, cy, c)
        dot(cx + 2, cy, c)
        dot(cx - 1, cy - 1, '#ffffff')
      }
    }), '#201838'),
  retaliate: () =>
    medallion(paint(11, 11, (dot) => {
      for (let i = 0; i < 11; i++) {
        dot(i, i, i % 3 === 0 ? '#ffffff' : '#d0d8e8')
        dot(10 - i, i, i % 3 === 1 ? '#ffffff' : '#d0d8e8')
      }
      dot(5, 5, '#f8e070')
    }), '#283040'),
  secretSword: () =>
    medallion(paint(11, 11, (dot) => {
      // A horn-blade, point up, of water and light.
      for (let y = 0; y < 9; y++) {
        const w = y < 2 ? 1 : 3
        dot(5 - (w >> 1), y, y < 3 ? '#ffffff' : '#a8d8f8', w, 1)
        if (w === 3) dot(5, y, '#ffffff')
      }
      dot(3, 8, '#3878c8', 5, 1)
      dot(4, 9, '#f8d048', 3, 2)
    }), '#102438'),
  hyperspaceFury: () =>
    medallion(paint(11, 11, (dot) => {
      for (let y = 0; y < 11; y++) for (let x = 0; x < 11; x++) {
        const d = Math.hypot(x - 5, (y - 5) * 1.3)
        if (d > 3.8 && d <= 5.2) dot(x, y, x + y < 9 ? '#f8e078' : '#c09020')
        else if (d <= 3.8) dot(x, y, '#28103c')
      }
      // A fist punching out of it.
      dot(4, 3, '#e870b8', 3, 3)
      dot(5, 2, '#f8a8d8')
      dot(3, 4, '#a03880')
    }), '#201028'),
}

/* ---------------- On screen ---------------- */

const ORB = ['#f8d048', '#f878b0', '#58a0f8'] as const

/** A tear in space: while it shows, a blinking seam; once it cuts, a dark slit rimmed in pink with a white core, flaking shards; a vacuum tear stays open and draws motes in. */
const drawRendTear = (ctx: Ctx, a: Attack, t: number) => {
  const half = a.tier / 2
  const dx = Math.cos(a.memo)
  const dy = Math.sin(a.memo)
  const x0 = a.x - dx * half
  const y0 = a.y - dy * half
  const x1 = a.x + dx * half
  const y1 = a.y + dy * half
  if (a.age < REND.windup) {
    if (Math.floor(t * 16) % 2 === 0) return
    // The seam: a dotted line that fills in as the cut comes.
    const k = a.age / REND.windup
    const n = Math.round(a.tier / 4)
    for (let i = 0; i <= n; i++) {
      if ((i + Math.floor(t * 20)) % 3 !== 0 && k < 0.7) continue
      px(ctx, x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n), k > 0.6 ? '#ffffff' : '#f8b8e8')
    }
    return
  }
  const since = a.age - REND.windup
  const open = a.flip ? 1 : Math.max(0, 1 - since / 0.35)
  ctx.globalAlpha = a.flip ? Math.min(1, fadeOut(a, 0.2) * 1.2) : open
  const w = a.flip ? 5 + (Math.floor(t * 12) % 2) : Math.max(1, Math.round(7 * open))
  thickLine(ctx, x0, y0, x1, y1, w + 2, '#c83cb0')
  thickLine(ctx, x0, y0, x1, y1, w, '#28103c')
  thickLine(ctx, x0, y0, x1, y1, Math.max(1, w - 4), a.flip ? '#5c2878' : '#ffffff')
  // Shards of space flaking off the rim (a vacuum's drift into it instead).
  for (let i = 0; i < 10; i++) {
    const along = hash2(i, a.id, 3) - 0.5
    const side = (hash2(i, a.id, 4) < 0.5 ? -1 : 1) * (a.flip ? 1 - ((t * 1.5 + hash2(i, a.id, 5)) % 1) : since * 2 + 0.1) * 16
    const sx = a.x + dx * along * a.tier - dy * side
    const sy = a.y + dy * along * a.tier + dx * side
    px(ctx, sx, sy, i % 2 === 0 ? '#ffffff' : '#f8b8e8')
  }
  ctx.globalAlpha = 1
}

/** An orb of the lake trio: a ball in its color with a white core and a short tail behind it. */
const drawMysticOrb = (ctx: Ctx, a: Attack, t: number) => {
  const color = ORB[a.tier % 3]!
  const v = a.motion.kind === 'homing' ? a.motion : null
  const speed = v ? Math.hypot(v.vx, v.vy) || 1 : 1
  for (let i = 3; i >= 1; i--) {
    ctx.globalAlpha = 0.5 - i * 0.12
    const tx = a.x - (v ? (v.vx / speed) * i * 4 : 0)
    const ty = a.y - (v ? (v.vy / speed) * i * 4 : 0)
    blitEllipse(ctx, 3 - (i >> 1), 3 - (i >> 1), color, Math.round(tx), Math.round(ty))
  }
  ctx.globalAlpha = 1
  const pulse = Math.floor(t * 10 + a.id) % 2
  blitEllipse(ctx, 4 + pulse, 4 + pulse, color, Math.round(a.x), Math.round(a.y))
  blitEllipse(ctx, 2, 2, '#ffffff', Math.round(a.x - 1), Math.round(a.y - 1))
}

/** The halo the orbs burst out of: three arcs in the trio's colors widening around the player. */
const drawMysticHalo = (ctx: Ctx, a: Attack) => {
  const k = Math.min(1, a.age / MYSTIC.halo)
  const r = Math.round(8 + k * MYSTIC.ring)
  ctx.globalAlpha = 1 - k
  for (let i = 0; i < 36; i++) {
    const q = (i / 36) * TAU + k * 2
    px(ctx, a.x + Math.cos(q) * r, a.y + Math.sin(q) * r * 0.7, ORB[Math.floor(i / 12)]!, 2, 1)
  }
  ctx.globalAlpha = 1
}

/** One stroke of Retaliate's X: a bright arc sweeping out from the player, leaving a fading streak. */
const drawRetaliateCut = (ctx: Ctx, g: Game, a: Attack) => {
  const p = ownerOf(g, a.owner)
  const dir = a.flip ? -1 : 1
  const k = Math.min(1, a.age / RETALIATE.time)
  const reach = a.tier
  const from = a.memo
  const steps = 12
  for (let i = 0; i <= steps * k; i++) {
    const q = from + dir * RETALIATE.arc * (i / steps)
    const fade = 1 - (k * steps - i) / steps
    ctx.globalAlpha = Math.max(0, Math.min(1, fade * 1.4)) * fadeOut(a, 0.1)
    const r0 = reach * 0.45
    thickLine(ctx, p.x + Math.cos(q) * r0, p.y - 8 + Math.sin(q) * r0, p.x + Math.cos(q) * reach, p.y - 8 + Math.sin(q) * reach, 2, i === Math.floor(steps * k) ? '#ffffff' : '#d0d8e8')
  }
  ctx.globalAlpha = 1
}

/** Keldeo's blade: a long horn of water and light from the player, a glow of the swept arc behind it. */
const drawSecretBlade = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  if (a.motion.kind !== 'orbit') return
  const p = ownerOf(g, a.owner)
  const ox = p.x
  const oy = p.y - 8
  const length = a.memo
  const angle = a.motion.angle
  for (let j = 1; j <= 4; j++) {
    const back = angle - a.motion.spin * j * 0.03
    ctx.globalAlpha = 0.32 - j * 0.07
    thickLine(ctx, ox, oy, ox + Math.cos(back) * length, oy + Math.sin(back) * length, 3, '#78c8f8')
  }
  ctx.globalAlpha = fadeOut(a, 0.1)
  const ex = ox + Math.cos(angle) * length
  const ey = oy + Math.sin(angle) * length
  const pulse = Math.floor(t * 30) % 2
  // It tapers to a point: thicker near the hilt.
  const mx = ox + Math.cos(angle) * length * 0.7
  const my = oy + Math.sin(angle) * length * 0.7
  thickLine(ctx, ox, oy, mx, my, 7 + pulse, '#2868b8')
  thickLine(ctx, ox, oy, mx, my, 5 + pulse, '#78c8f8')
  thickLine(ctx, mx, my, ex, ey, 4, '#78c8f8')
  thickLine(ctx, ox, oy, ex, ey, 2, '#ffffff')
  px(ctx, ex - 1, ey - 1, '#ffffff', 3, 3)
  ctx.globalAlpha = 1
  for (let i = 0; i < 6; i++) {
    const d = (t * 260 + i * (length / 6)) % length
    px(ctx, ox + Math.cos(angle) * d, oy + Math.sin(angle) * d - 2, '#e8f8ff')
  }
}

/** One of Hoopa's rings over a crowd: a golden ring opening around a dark portal, closing again once its fists are out. */
const drawFuryRing = (ctx: Ctx, a: Attack, t: number) => {
  const open = Math.min(1, a.age / FURY.open) * Math.min(1, (a.ttl - a.age) / 0.25)
  if (open <= 0) return
  const rx = Math.max(2, Math.round(FURY.ring * open))
  const ry = Math.max(1, Math.round(FURY.ring * 0.45 * open))
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  blitEllipse(ctx, rx + 2, ry + 2, '#7a5010', x, y)
  blitEllipse(ctx, rx, ry, Math.floor(t * 8) % 2 === 0 ? '#f8e078' : '#f0c840', x, y)
  blitEllipse(ctx, Math.max(1, rx - 3), Math.max(1, ry - 2), '#28103c', x, y)
  blitRing(ctx, Math.max(1, rx - 6), 1, '#5c2878', x, y)
}

/** A fist out of a ring: an arm reaching from the ring to the punch, a flash as it lands. */
const drawFuryFist = (ctx: Ctx, a: Attack) => {
  const reach = 14
  const sx = a.x - Math.cos(a.memo) * reach
  const sy = a.y - 6 - Math.sin(a.memo) * reach * 0.7
  const k = Math.min(1, a.age / 0.06)
  const fx = sx + (a.x - sx) * k
  const fy = sy + (a.y - 6 - sy) * k
  ctx.globalAlpha = fadeOut(a, 0.1)
  thickLine(ctx, sx, sy, fx, fy, 4, '#a03880')
  thickLine(ctx, sx, sy, fx, fy, 2, '#e870b8')
  blitEllipse(ctx, 4, 3, '#a03880', Math.round(fx), Math.round(fy))
  blitEllipse(ctx, 3, 2, '#f8a8d8', Math.round(fx), Math.round(fy) - 1)
  if (a.age < 0.1) blitRing(ctx, Math.round(5 + a.age * 80), 1, '#ffffff', Math.round(a.x), Math.round(a.y) - 6)
  ctx.globalAlpha = 1
}

/** Ground layer: Hoopa's rings. */
export const drawLegendary3Ground = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) if (a.age >= 0 && a.visual === 'furyRing') drawFuryRing(ctx, a, t)
}

/** Air layer (over the Pokémon). Tears and blades span the screen: they draw even when their middle is off it. */
export const drawLegendary3Air = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'rendTear':
        drawRendTear(ctx, a, t)
        continue
      case 'secretBlade':
        drawSecretBlade(ctx, g, a, t)
        continue
      case 'retaliateCut':
        drawRetaliateCut(ctx, g, a)
        continue
      case 'mysticHalo':
        drawMysticHalo(ctx, a)
        continue
    }
    if (!visible(a.x, a.y, 40)) continue
    if (a.visual === 'mysticOrb') drawMysticOrb(ctx, a, t)
    else if (a.visual === 'furyFist') drawFuryFist(ctx, a)
  }
}
