import { blitEllipse, blitRing } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { PHASE_SHIFT } from '../data/bosses'
import { domainOf } from '../data/domains'
import { phasesOf } from '../game/bossFight'
import { arenaPoint, domainHere } from '../game/domain'
import { ENCOUNTER, REVEAL_AT } from '../game/domainRules'
import { timeSkipOf } from '../game/dialgaDomain'
import { drawPalkiaAir, drawPalkiaGround, drawPalkiaScreen } from './palkia'
import type { Enemy, Game, Hazard } from '../game/types'
import { HAZARD_COLORS } from './hazardColors'
import { dashedRing } from './strokes'

type Ctx = CanvasRenderingContext2D

/**
 * The looks of the domain mechanics added for Lugia, Ho-Oh and Dialga, all
 * generic: wind (whirlpools and gusts, `Hazard.pull`), a boss aloft (`pass`
 * steering) or reborn (`BossPhase.rebirth`), fire columns, the countdown hand
 * of a long-delayed strike, a time stop holding the player's shots, the
 * `warp` entrance, and Dialga's time skips in its crossing.
 */

/* ---------------- Wind ---------------- */

/** Ground layer of a whirlpool: its reach blinks while it forms, then spiral arms turn in toward a dark eye. */
export const drawVortexGround = (ctx: Ctx, h: Hazard, t: number) => {
  if (h.kind !== 'zone') return blitEllipse(ctx, Math.round(h.r), Math.max(1, Math.round(h.r * 0.4)), 'rgba(16,24,48,0.3)', h.x, h.y)
  const [line, fill] = HAZARD_COLORS[h.visual]
  const reach = Math.round(h.pullReach)
  if (h.age < h.armAt) {
    if (Math.floor(h.age * 10) % 2 === 0) blitRing(ctx, reach, 1, line, h.x, h.y)
    blitEllipse(ctx, Math.max(1, Math.round(h.r * (h.age / h.armAt))), Math.max(1, Math.round(h.r * 0.8 * (h.age / h.armAt))), fill, h.x, h.y)
    return
  }
  const fade = Math.min(1, (h.ttl - h.age) / 0.4, (h.age - h.armAt) / 0.3)
  ctx.globalAlpha = Math.max(0, fade)
  const spin = t * (h.pull > 0 ? 3 : -3)
  // A small one is a patch of churning water; a huge one (Hurricane) is wind rings closing in on its eye.
  if (reach <= 90) blitEllipse(ctx, reach, Math.round(reach * 0.8), fill, h.x, h.y)
  else for (let i = 1; i <= 3; i++) dashedRing(ctx, h.x, h.y, Math.round(reach * (((i / 3 - t * 0.25) % 1 + 1) % 1)) + h.r, spin * 0.3 + i, ['#ffffff', line], 0.35, 0.8)
  const steps = Math.min(64, Math.max(10, Math.round(reach / 5)))
  for (let arm = 0; arm < (reach > 90 ? 5 : 3); arm++) {
    for (let i = 0; i < steps; i++) {
      const k = i / steps
      const r = h.r + (reach - h.r) * k
      const a = spin + (arm / (reach > 90 ? 5 : 3)) * TAU + k * 4.2
      ctx.fillStyle = i % 3 === 0 ? '#ffffff' : line
      ctx.fillRect(Math.round(h.x + Math.cos(a) * r), Math.round(h.y + Math.sin(a) * r * 0.8), 2, 1)
    }
  }
  blitEllipse(ctx, Math.round(h.r), Math.round(h.r * 0.7), 'rgba(8,16,40,0.7)', h.x, h.y)
  ctx.globalAlpha = 1
}

/** Air layer of a gust: a little whirlwind of stacked rings swaying as it flies (hovering by the boss through its windup). */
export const drawVortexAir = (ctx: Ctx, h: Hazard, t: number) => {
  if (h.kind !== 'shot') return
  const x = Math.round(h.x)
  const y = Math.round(h.y)
  for (let i = 0; i < 5; i++) {
    const sway = Math.round(Math.sin(t * 14 + i * 1.1 + h.id) * (1 + i * 0.6))
    const rx = 2 + i
    blitEllipse(ctx, rx, Math.max(1, Math.round(rx * 0.35)), i % 2 === 0 ? '#f0f8ff' : '#a8c8f0', x + sway, y - 2 - i * 3)
  }
}

/* ---------------- Bosses ---------------- */

/** How a boss is drawn in its phase (`bossLook`): raised off its shadow, faded, tinted, flashing. Reused, never allocated per frame. */
export type BossLook = { lift: number; alpha: number; flash: number; tint: { color: string; amount: number } | undefined }

const LOOK: BossLook = { lift: 0, alpha: 1, flash: 0, tint: undefined }
const ASH = { color: '#200808', amount: 0 }

/** The rebirth's opening, 0..1, while a reborn boss's phase opens (`BossPhase.rebirth`); -1 otherwise. */
const rebirthAt = (e: Enemy) => {
  const f = e.fight
  const phase = f ? phasesOf(e.kind)?.[f.phase] : undefined
  if (!f || !phase || phase.rebirth === undefined || f.shift <= 0) return -1
  return 1 - f.shift / (phase.shift ?? PHASE_SHIFT)
}

/**
 * A phase boss's look: aloft over its shadow while its phase flies it
 * (`pass`), or through a rebirth: burning to ash and sinking into the
 * flames, gone in the fire, then rising from it, flashing. Null when it looks
 * as usual.
 */
export const bossLook = (e: Enemy, t: number): BossLook | null => {
  const f = e.fight
  const phase = f ? phasesOf(e.kind)?.[f.phase] : undefined
  if (!f || !phase) return null
  LOOK.lift = 0
  LOOK.alpha = 1
  LOOK.flash = 0
  LOOK.tint = undefined
  const k = rebirthAt(e)
  if (k >= 0) {
    if (k < 0.3) {
      ASH.amount = (k / 0.3) * 0.9
      LOOK.tint = ASH
      LOOK.flash = 0.2
      LOOK.alpha = 1 - (k / 0.3) * 0.4
    } else if (k < 0.72) LOOK.alpha = 0
    else {
      const q = (k - 0.72) / 0.28
      LOOK.alpha = q
      LOOK.flash = 1 - q
      LOOK.lift = Math.round((1 - q) * 26)
    }
    return LOOK
  }
  if (phase.steer?.kind === 'pass') {
    const rise = f.shift > 0 ? 1 - f.shift / (phase.shift ?? PHASE_SHIFT) : 1
    LOOK.lift = Math.round(rise * (16 + Math.sin(t * 3) * 2))
    return LOOK
  }
  return null
}

/** The column of flame a boss is reborn in, from the moment it burns until it rises (`bossLook`). */
const drawRebirth = (ctx: Ctx, e: Enemy, t: number) => {
  const k = rebirthAt(e)
  if (k < 0.15) return
  const x = Math.round(e.x)
  const y = Math.round(e.y)
  const grow = Math.min(1, (k - 0.15) / 0.2)
  const fade = k > 0.85 ? (1 - k) / 0.15 : 1
  const height = Math.round(120 * grow)
  ctx.globalAlpha = fade
  for (let yy = 0; yy < height; yy += 2) {
    const q = yy / Math.max(1, height)
    const half = Math.round((14 - q * 8) * grow + Math.sin(t * 20 + yy * 0.4) * 2)
    ctx.fillStyle = q < 0.3 ? '#fff0a0' : q < 0.65 ? '#f8a020' : '#f84818'
    ctx.fillRect(x - half, y - yy, half * 2, 2)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - Math.max(1, half >> 2), y - yy, Math.max(2, half >> 1), 2)
  }
  // Its rainbow ring spreads as it comes back.
  if (k > 0.72) {
    const q = (k - 0.72) / 0.28
    const colors = ['#f84848', '#f8e048', '#68d858', '#48a8f8', '#b058e0']
    colors.forEach((c, i) => blitRing(ctx, Math.round(10 + q * 60 + i * 3), 1, c, x, y - 16))
  }
  ctx.globalAlpha = 1
}

/* ---------------- Strikes ---------------- */

/** How long (s) a strike's warning must be for its countdown hand to show: Dialga's marks of the future. */
const LONG_STRIKE = 2

/** A long-delayed strike's countdown: a clock hand sweeping round its circle until it lands. */
const drawStrikeClock = (ctx: Ctx, h: Hazard) => {
  const k = h.age / h.armAt
  const a = -Math.PI / 2 + k * TAU
  const r = Math.max(3, h.r - 3)
  ctx.fillStyle = '#ffffff'
  for (let d = 0; d < r; d += 2) ctx.fillRect(Math.round(h.x + Math.cos(a) * d), Math.round(h.y + Math.sin(a) * d * 0.9), 1, 1)
  for (let i = 0; i < 4; i++) {
    const q = (i / 4) * TAU
    ctx.fillRect(Math.round(h.x + Math.cos(q) * r), Math.round(h.y + Math.sin(q) * r * 0.9), 1, 1)
  }
}

/** A fire strike landing in a domain (Sacred Fire): a column of flame rises off its circle. */
const drawFireColumn = (ctx: Ctx, h: Hazard, t: number) => {
  const k = (h.age - h.armAt) / 0.4
  if (k < 0 || k > 1) return
  const x = Math.round(h.x)
  const y = Math.round(h.y)
  ctx.globalAlpha = 1 - k * k
  const height = Math.round(70 * Math.min(1, k * 3))
  for (let yy = 0; yy < height; yy += 2) {
    const half = Math.round(h.r * 0.5 * (1 - yy / 120) + Math.sin(t * 24 + yy * 0.5))
    ctx.fillStyle = yy < height * 0.3 ? '#fff0a0' : yy < height * 0.7 ? '#f89830' : '#f85020'
    ctx.fillRect(x - half, y - yy, half * 2, 2)
  }
  ctx.globalAlpha = 1
}

/** Ground layer: long strikes' countdown hands, and Palkia's portals, seams and fold. */
export const drawDomainGround = (ctx: Ctx, g: Game, t: number) => {
  for (const h of g.hazards) if (h.kind === 'strike' && !h.world && h.armAt >= LONG_STRIKE && h.age < h.armAt) drawStrikeClock(ctx, h)
  const here = domainHere(g)
  if (here?.d.legend === 'palkia') drawPalkiaGround(ctx, here.arena, here.d, t)
}

/** Air layer: fire columns, reborn bosses' flame, the player's shots held by a time stop, and the foes frozen by a time skip. */
export const drawDomainAir = (ctx: Ctx, g: Game, t: number) => {
  const here = domainHere(g)
  if (!here) return
  for (const h of g.hazards) if (h.kind === 'strike' && h.visual === 'fire' && !h.world && h.r >= 14) drawFireColumn(ctx, h, t)
  for (const e of g.enemies) if (e.boss && e.dying < 0) drawRebirth(ctx, e, t)
  const boss = g.enemies.find((e) => e.id === here.d.bossId)
  const stop = boss?.fight?.timeStop
  if (stop && stop.wait <= 0) {
    // Held shots blink a cold rim: they'll fly on when time does.
    const blink = Math.floor(t * 6) % 2 === 0
    for (const a of g.attacks) if (a.age >= 0) blitRing(ctx, 5, 1, blink ? '#a8f0f8' : '#ffffff', a.x, a.y - 4)
  }
  if (here.d.legend === 'palkia') drawPalkiaAir(ctx, g, here.d, t)
  const skip = timeSkipOf(here.d)
  if (skip?.skip === 'stop' && !skip.warning) {
    for (const e of g.enemies) if (e.dying < 0 && e.status.stun > 0) blitRing(ctx, Math.round(e.radius + 4), 1, '#a8f0f8', e.x, e.y - e.radius)
  }
}

/* ---------------- Screen space ---------------- */

/** The tint of each of Dialga's time skips while it plays. */
const SKIP_TINT = { stop: 'rgba(150,170,210,0.24)', forward: 'rgba(248,200,120,0.14)', rewind: 'rgba(200,150,90,0.22)' } as const

/** Clock rings closing on (x, y) (screen px) as `k` goes 0..1. */
const closingRings = (ctx: Ctx, x: number, y: number, k: number, size: number, color: string) => {
  for (let i = 0; i < 3; i++) {
    const r = Math.round(8 + (1 - ((k + i / 3) % 1)) * size)
    ctx.globalAlpha = 0.6
    blitRing(ctx, r, 1, color, x, y)
  }
  ctx.globalAlpha = 1
}

/**
 * Over the frame: a time stop (rings closing on its boss, then the cold
 * stillness while it holds), the `warp` entrance greying the world as time
 * stops, and Dialga's time skips (rings warning of one, then its tint and
 * streaks).
 */
export const drawDomainScreen = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const here = domainHere(g)
  if (!here) return
  const { arena, d } = here
  const { w, h } = g.view
  const def = domainOf(d.legend)
  if (def?.entrance === 'warp' && d.act === 'encounter') {
    const start = ENCOUNTER.settle + ENCOUNTER.pan
    const k = Math.min(1, Math.max(0, (d.scene - start) / 0.4)) * Math.min(1, Math.max(0, (REVEAL_AT + ENCOUNTER.hold - d.scene) / 0.4))
    if (k > 0) {
      ctx.fillStyle = `rgba(150,160,190,${(0.35 * k).toFixed(2)})`
      ctx.fillRect(0, 0, w, h)
      const at = arenaPoint(arena, d, def.arena.boss)
      if (d.scene < REVEAL_AT) closingRings(ctx, Math.round(at.x - camX), Math.round(at.y - 20 - camY), (d.scene * 0.8) % 1, 70, '#d0f8ff')
    }
  }
  const boss = g.enemies.find((e) => e.id === d.bossId)
  const stop = boss?.fight?.timeStop
  if (boss && stop) {
    if (stop.wait > 0) closingRings(ctx, Math.round(boss.x - camX), Math.round(boss.y - boss.radius - camY), (t * 1.2) % 1, Math.min(w, h) * 0.5, '#a8f0f8')
    else {
      // About to flow again, the stillness flickers.
      if (stop.left > 0.6 || Math.floor(t * 12) % 2 === 0) {
        ctx.fillStyle = 'rgba(120,140,196,0.22)'
        ctx.fillRect(0, 0, w, h)
        ctx.fillStyle = 'rgba(208,248,255,0.12)'
        for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
      }
    }
  }
  if (d.legend === 'palkia') drawPalkiaScreen(ctx, g, d, t)
  const skip = timeSkipOf(d)
  if (!skip) return
  if (skip.warning) return closingRings(ctx, Math.round(w / 2), Math.round(h / 2), skip.k, Math.max(w, h) * 0.6, '#d0f8ff')
  ctx.fillStyle = SKIP_TINT[skip.skip]
  ctx.fillRect(0, 0, w, h)
  if (skip.skip === 'stop') return
  // Streaks rush up (forward) or drift back down (rewind).
  const dir = skip.skip === 'forward' ? -1 : 1
  ctx.fillStyle = 'rgba(255,255,255,0.5)'
  for (let i = 0; i < 14; i++) {
    const x = Math.round(hash2(i, 1, 71) * w)
    const len = 8 + Math.round(hash2(i, 2, 71) * 16)
    const y = Math.round((((hash2(i, 3, 71) * h + dir * t * 420) % (h + len)) + h + len) % (h + len)) - len
    ctx.fillRect(x, y, 1, len)
  }
}
