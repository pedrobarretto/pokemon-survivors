import { blitCentered, blitRotated, ellipse, ring, textSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { biomeAt } from '../data/biomes'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import type { HazardVisual } from '../data/bosses'
import { TYPE_COLORS } from '../data/types'
import { FLEE_TIME } from '../game/enemies'
import { EVOLUTION_TIME, playerDex } from '../game/game'
import { coinTier } from '../game/meta'
import { xpTier } from '../game/pickups'
import { isAsleep } from '../game/status'
import { inSolid, overTerrain, type Solid } from '../game/terrain'
import { isAirborne, traitPace } from '../game/traits'
import { inPlay } from '../game/players'
import type { Attack, Enemy, Game, Hazard, Player } from '../game/types'
import { drawDowned, drawTeamArrows } from './coop'
import { FX, HAZARD_FX, PICKUPS, SPARKLE } from './art'
import { drawEvolvedAttack, drawEvolvedGround, drawFrost, drawPuff, drawShard } from './evolved'
import { drawMapEventMarkers, drawMapEvents } from './mapEvents'
import { drawMegaAir, drawMegaAttack, drawMegaGround, drawMegaStone, megaLook } from './megaFx'
import { drawMoveFxAttack, drawMoveFxGround } from './moveFx'
import { drawConsumable, drawFlash, drawProps, drawSleep } from './props'
import { drawSpecialAttack, drawSpecialAura, drawSpecialGround, STANCE_FORMS } from './specialFx'
import { drawArena, drawRiftArrow, drawRiftPortal, warmArena } from './rift'
import { drawPokemon, sprites, type AnimName } from './sprites'
import { drawStatusBadge, statusTint } from './status'
import { drawTraitAir, drawTraitGround, traitLift, traitTint } from './traits'
import { bolt, dashedRing } from './strokes'
import { drawWeather } from './weather'
import { drawSolid, drawTerrainGround, drawWading, solidsInView, warmTerrain } from './terrain'
import { drawGround, warmGround } from './world'
import { damageBudget, showsText, textAlpha, type DamageNumbers } from './damageNumbers'

type Ctx = CanvasRenderingContext2D

export const shadow = (ctx: Ctx, x: number, y: number, width: number) => {
  const rx = Math.max(3, Math.round(width * 0.36))
  blitCentered(ctx, ellipse(rx, Math.max(1, Math.round(rx * 0.4)), 'rgba(16,40,16,0.28)'), x, y)
}

/* ---------------- Attacks ---------------- */

const drawGroundAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  switch (a.visual) {
    case 'whirlpool': {
      blitCentered(ctx, ellipse(Math.round(r), Math.round(r), 'rgba(80,140,240,0.16)'), a.x, a.y - 4)
      dashedRing(ctx, a.x, a.y - 4, r, t * 5, ['#a8d0f8', '#ffffff', '#6890f0'], 0.45)
      dashedRing(ctx, a.x, a.y - 4, r * 0.68, -t * 7, ['#6890f0', '#a8d0f8'], 0.35)
      dashedRing(ctx, a.x, a.y - 4, r * 0.38, t * 9, ['#ffffff'], 0.3)
      return
    }
    case 'sludge': {
      if (a.age < a.activeFrom) return
      const fade = Math.min(1, (a.ttl - a.age) / 0.3)
      const grow = Math.min(1, (a.age - a.activeFrom) / 0.12)
      ctx.globalAlpha = fade
      blitCentered(ctx, ellipse(Math.round(r * grow), Math.round(r * 0.72 * grow), 'rgba(96,32,112,0.55)'), a.x, a.y)
      blitCentered(ctx, ellipse(Math.round(r * 0.7 * grow), Math.round(r * 0.48 * grow), 'rgba(176,80,184,0.55)'), a.x, a.y - 1)
      ctx.globalAlpha = 1
      return
    }
    case 'thunder': {
      if (a.age < a.activeFrom && Math.floor(a.age * 30) % 2 === 0) blitCentered(ctx, ring(Math.round(r), 1, '#f8e030'), a.x, a.y)
      return
    }
    case 'quake': {
      ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
      dashedRing(ctx, a.x, a.y, r, 0, ['#704820', '#a07840', '#e0c068'], 0.85)
      dashedRing(ctx, a.x, a.y, r - 2, 1.3, ['#503010', '#906838'], 0.5)
      ctx.fillStyle = '#503010'
      for (let i = 0; i < 7; i++) {
        const angle = (i / 7) * TAU + a.id
        for (let d = 4; d < r - 3; d += 1.5) {
          const jag = Math.sin(d * 0.7 + i) * 1.5
          ctx.fillRect(Math.round(a.x + Math.cos(angle) * d - Math.sin(angle) * jag), Math.round(a.y + Math.sin(angle) * d + Math.cos(angle) * jag), 1, 1)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'drumRoots': {
      ctx.globalAlpha = Math.max(0, 1 - a.age / a.ttl)
      dashedRing(ctx, a.x, a.y - 4, r, a.age * 4, ['#78c850', '#a87840', '#58a838'], 0.75)
      for (let i = 0; i < 10; i++) {
        const angle = (i / 10) * TAU + a.id
        const x = Math.round(a.x + Math.cos(angle) * r)
        const y = Math.round(a.y - 4 + Math.sin(angle) * r)
        ctx.fillStyle = '#5a3818'
        ctx.fillRect(x, y - 3, 1, 4)
        ctx.fillStyle = '#78c850'
        ctx.fillRect(x - 1, y - 4, 3, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'iceShard':
      return drawFrost(ctx, a, r)
    case 'rockTomb': {
      // A growing shadow (and a blinking rim) warns where the boulder lands; then the dust ring spreads.
      if (a.age < a.activeFrom) {
        const k = 0.4 + 0.6 * (a.age / a.activeFrom)
        blitCentered(ctx, ellipse(Math.round(r * k), Math.max(1, Math.round(r * 0.5 * k)), 'rgba(24,16,8,0.4)'), a.x, a.y)
        if (Math.floor(a.age * 24) % 2 === 0) dashedRing(ctx, a.x, a.y, r, 0, ['#d8c080'], 0.9, 0.5)
        return
      }
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - e)
      dashedRing(ctx, a.x, a.y, r * (0.7 + e * 0.6), a.id, ['#685028', '#a08048', '#d8c080'], 0.7, 0.5)
      ctx.globalAlpha = 1
      return
    }
    default:
      drawEvolvedGround(ctx, a, t)
      drawMoveFxGround(ctx, a)
      return drawSpecialGround(ctx, a)
  }
}

/** Small 8-ray impact spark (punch / bite hits). */
const spark = (ctx: Ctx, x: number, y: number, size: number) => {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU
    const len = i % 2 === 0 ? size : size * 0.6
    for (let d = 2; d <= len; d++) {
      ctx.fillStyle = d === 2 ? '#ffffff' : '#f8e070'
      ctx.fillRect(Math.round(x + Math.cos(angle) * d), Math.round(y + Math.sin(angle) * d), 1, 1)
    }
  }
}

/** Crescent slash arc, revealed by `sweep` (0..1). */
const slashArc = (ctx: Ctx, x: number, y: number, r: number, dir: number, sweep: number) => {
  const steps = Math.ceil(r * 2.6)
  const colors = ['#ffffff', '#a8d8f8', '#4878c0']
  for (let i = 0; i <= steps * sweep; i++) {
    const angle = dir - 1.1 + (2.2 * i) / steps
    const thick = Math.sin((i / steps) * Math.PI) * 3
    for (let k = 0; k < thick; k++) {
      ctx.fillStyle = colors[k]!
      ctx.fillRect(Math.round(x + Math.cos(angle) * (r - k)), Math.round(y + Math.sin(angle) * (r - k)), 1, 1)
    }
  }
}

const drawAttack = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  switch (a.visual) {
    case 'ember':
      return blitCentered(ctx, FX.ember()[Math.floor(t * 12) % 2]!, a.x, a.y)
    case 'flame':
      return blitCentered(ctx, FX.flame()[Math.floor((t + a.id) * 10) % 2]!, a.x, a.y - 2)
    case 'water': {
      const angle = m.kind === 'linear' ? Math.atan2(m.vy, m.vx) : 0
      return blitRotated(ctx, FX.water(), a.x, a.y, angle)
    }
    case 'leaf': {
      const scale = a.shape.kind === 'circle' ? Math.max(1, Math.round(a.shape.r / 6)) : 1
      return blitRotated(ctx, FX.leaf(), a.x, a.y, a.age * 16, scale)
    }
    case 'star':
      return blitRotated(ctx, FX.star(), a.x, a.y, a.age * 9)
    case 'sludge': {
      if (a.age >= a.activeFrom) return
      const k = a.age / a.activeFrom
      const x = a.from.x + (a.x - a.from.x) * k
      const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 40
      blitCentered(ctx, ellipse(3, 3, '#502060'), x, y)
      return blitCentered(ctx, ellipse(2, 2, '#c060d0'), x - 1, y - 1)
    }
    case 'thunder': {
      if (a.age < a.activeFrom) return
      const fade = 1 - (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, fade)
      bolt(ctx, a.x, a.y, 180)
      if (a.shape.kind === 'circle') blitCentered(ctx, ellipse(Math.round(a.shape.r), Math.round(a.shape.r * 0.5), 'rgba(255,248,160,0.7)'), a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'gust': {
      if (a.shape.kind !== 'circle') return
      ctx.globalAlpha = 1 - a.age / a.ttl
      dashedRing(ctx, a.x, a.y, a.shape.r, a.age * 20, ['#ffffff', '#e0e8f8', '#c8d0e8'], 0.7)
      dashedRing(ctx, a.x, a.y, a.shape.r * 0.8, -a.age * 25, ['#ffffff'], 0.25)
      ctx.globalAlpha = 1
      return
    }
    case 'vine': {
      if (a.shape.kind !== 'rect') return
      const dir = a.flip ? -1 : 1
      const reach = a.shape.w * Math.min(1, a.age / 0.07)
      const startX = a.x - (dir * a.shape.w) / 2
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.08)
      for (let i = 0; i < reach; i++) {
        const x = Math.round(startX + dir * i)
        const y = Math.round(a.y + Math.sin(i * 0.25 - a.age * 40) * 2)
        ctx.fillStyle = '#204818'
        ctx.fillRect(x, y - 2, 1, 4)
        ctx.fillStyle = i % 9 < 2 ? '#a8e870' : '#58a838'
        ctx.fillRect(x, y - 1, 1, 2)
        if (i % 14 === 7) {
          ctx.fillStyle = '#78c850'
          ctx.fillRect(x, y - 4, 2, 2)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'fist': {
      if (m.kind !== 'follow') return
      const angle = Math.atan2(m.oy + 8, m.ox)
      blitRotated(ctx, FX.fist(), a.x, a.y, angle)
      if (a.age > a.ttl * 0.5) spark(ctx, a.x + Math.cos(angle) * 6, a.y + Math.sin(angle) * 6, 5)
      return
    }
    case 'steel': {
      const r = a.shape.kind === 'circle' ? a.shape.r : 8
      blitRotated(ctx, FX.steel(), a.x, a.y, 0, Math.max(1, Math.round(r / 4)))
      if (Math.floor((t + a.id) * 12) % 3 === 0) spark(ctx, a.x, a.y, Math.round(r * 0.8))
      return
    }
    case 'arrow':
      return blitRotated(ctx, FX.arrow(), a.x, a.y, m.kind === 'linear' ? Math.atan2(m.vy, m.vx) : 0)
    case 'shuriken':
      return blitRotated(ctx, FX.shuriken(), a.x, a.y, a.age * 22)
    case 'jaws': {
      const r = a.shape.kind === 'circle' ? a.shape.r : 10
      const scale = Math.max(1, Math.round(r / 7))
      const { top, bottom } = FX.jaws()
      const gap = Math.round((1 - Math.min(1, a.age / a.activeFrom)) * r * 0.9)
      const half = (top.height * scale) / 2
      ctx.globalAlpha = a.age > a.activeUntil ? Math.max(0, 1 - (a.age - a.activeUntil) / (a.ttl - a.activeUntil)) : 1
      blitRotated(ctx, top, a.x, a.y - gap - half, 0, scale)
      blitRotated(ctx, bottom, a.x, a.y + gap + half, 0, scale)
      if (a.age >= a.activeFrom) spark(ctx, a.x, a.y, Math.round(r * 0.9))
      ctx.globalAlpha = 1
      return
    }
    case 'pyro': {
      if (a.age < a.activeFrom) {
        const k = a.age / a.activeFrom
        const x = a.from.x + (a.x - a.from.x) * k
        const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 50
        return blitRotated(ctx, FX.pyro(), x, y, a.age * 14)
      }
      if (a.shape.kind !== 'circle') return
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      const r = Math.round(a.shape.r * (0.5 + 0.5 * e))
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitCentered(ctx, ellipse(r, Math.round(r * 0.75), 'rgba(240,112,32,0.6)'), a.x, a.y)
      blitCentered(ctx, ellipse(Math.round(r * 0.55), Math.round(r * 0.4), '#f8d860'), a.x, a.y - 1)
      blitCentered(ctx, ring(r, 1, '#fff0a0'), a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'psy': {
      const r = a.shape.kind === 'circle' ? a.shape.r : 6
      return blitRotated(ctx, FX.psy()[Math.floor((t + a.id) * 10) % 2]!, a.x, a.y, 0, Math.max(1, Math.round((r * 2) / 7)))
    }
    case 'heart':
      return blitCentered(ctx, FX.heart(), a.x, a.y + Math.round(Math.sin(a.age * 14) * 1.5))
    case 'note':
      return blitCentered(ctx, FX.note(), a.x + Math.round(Math.sin(a.age * 12) * 2), a.y)
    case 'blade': {
      if (m.kind !== 'orbit') return
      const r = a.shape.kind === 'circle' ? a.shape.r : 9
      return blitRotated(ctx, FX.blade(), a.x, a.y, m.angle + Math.PI * 0.75, Math.max(1, Math.round(r / 5)))
    }
    case 'shell': {
      if (m.kind !== 'follow' || a.shape.kind !== 'circle') return
      const dir = Math.atan2(m.oy + 8, m.ox)
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.08)
      slashArc(ctx, a.x - Math.cos(dir) * a.shape.r * 0.5, a.y - Math.sin(dir) * a.shape.r * 0.5, a.shape.r * 1.2, dir, Math.min(1, a.age / 0.1))
      ctx.globalAlpha = 1
      return
    }
    case 'iceShard':
      return drawShard(ctx, a, FX.iceShard(), FX.icicles())
    case 'rockTomb': {
      // Falls from above, speeding up, then sits cracked where it landed until it crumbles.
      const k = Math.min(1, a.age / a.activeFrom)
      const drop = Math.round(80 * (1 - k * k))
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.25)
      blitCentered(ctx, FX.boulder(), a.x + (a.flip ? 1 : 0), a.y - 5 - drop)
      ctx.globalAlpha = 1
      return
    }
    case 'pin':
      return blitRotated(ctx, FX.pin(), a.x, a.y, m.kind === 'homing' ? Math.atan2(m.vy, m.vx) : 0)
    case 'dragonBreath':
      return drawPuff(ctx, a, t, ['rgba(72,32,168,0.55)', 'rgba(112,56,248,0.8)', '#a070f8', '#f0e0ff'])
    case 'whirlpool':
    case 'quake':
    case 'drumRoots':
      return
    default:
      drawEvolvedAttack(ctx, a, t)
      drawMoveFxAttack(ctx, a, t)
      drawMegaAttack(ctx, a)
      return drawSpecialAttack(ctx, a, t)
  }
}

/* ---------------- Boss hazards ---------------- */

const HAZARD_COLORS: Record<HazardVisual, readonly [string, string]> = {
  rock: ['#c08040', 'rgba(120,80,32,0.28)'],
  slam: ['#f8d878', 'rgba(160,120,48,0.3)'],
  thunder: ['#f8e030', 'rgba(248,224,48,0.22)'],
  ice: ['#98d8f8', 'rgba(152,216,248,0.25)'],
  fire: ['#f08030', 'rgba(240,128,48,0.25)'],
  psychic: ['#f870c0', 'rgba(248,96,208,0.4)'],
  water: ['#58a8f8', 'rgba(88,168,248,0.28)'],
  dragon: ['#a070f8', 'rgba(112,56,248,0.3)'],
  steel: ['#c8e0f8', 'rgba(104,136,200,0.3)'],
  aero: ['#f0f8ff', 'rgba(200,220,248,0.28)'],
  grass: ['#78d850', 'rgba(112,208,72,0.28)'],
  judgment: ['#fff0a0', 'rgba(248,224,112,0.32)'],
}

/** Ground layer: telegraph circles, landed shockwaves and lingering fire. */
const drawHazardGround = (ctx: Ctx, h: Hazard) => {
  const [line, fill] = HAZARD_COLORS[h.visual]
  const r = Math.round(h.r)
  if (h.kind === 'strike') {
    if (h.age < h.armAt) {
      const k = h.age / h.armAt
      blitCentered(ctx, ellipse(Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k)), fill), h.x, h.y)
      // The outline blinks faster as the impact gets close.
      if (Math.floor(h.age * (6 + k * 18)) % 2 === 0) blitCentered(ctx, ring(r, 1, line), h.x, h.y)
      return
    }
    if (h.visual === 'thunder' || h.visual === 'rock') return
    const k = (h.age - h.armAt) / (h.ttl - h.armAt)
    ctx.globalAlpha = 1 - k
    blitCentered(ctx, ellipse(r, r, fill), h.x, h.y)
    blitCentered(ctx, ring(Math.round(r * (0.6 + k * 0.5)), 2, line), h.x, h.y)
    ctx.globalAlpha = 1
    return
  }
  if (h.kind === 'zone') {
    ctx.globalAlpha = Math.min(1, h.age / 0.15, (h.ttl - h.age) / 0.4)
    blitCentered(ctx, ellipse(r, Math.max(1, Math.round(r * 0.5)), fill), h.x, h.y)
    if (h.visual === 'fire') blitCentered(ctx, FX.flame()[Math.floor((h.age + h.id) * 8) % 2]!, h.x, h.y - 5)
    ctx.globalAlpha = 1
  }
}

/** Air layer: projectiles, lightning bolts and falling rocks. */
const drawHazard = (ctx: Ctx, h: Hazard) => {
  if (h.kind === 'shot') {
    const y = h.y - 6
    switch (h.visual) {
      case 'ice':
      case 'grass':
        return blitRotated(ctx, HAZARD_FX[h.visual](), h.x, y, Math.atan2(h.vy, h.vx))
      case 'fire':
        return blitCentered(ctx, FX.ember()[Math.floor(h.age * 12) % 2]!, h.x, y)
      case 'rock':
        return blitCentered(ctx, HAZARD_FX.rock(), h.x, y)
      case 'water':
      case 'dragon':
      case 'steel':
      case 'aero':
      case 'judgment':
        return blitCentered(ctx, HAZARD_FX[h.visual](), h.x, y + (Math.floor(h.age * 10) % 2))
      default:
        return blitCentered(ctx, HAZARD_FX.psychic(), h.x, y + (Math.floor(h.age * 10) % 2))
    }
  }
  if (h.kind !== 'strike') return
  if (h.visual === 'rock' && h.age < h.armAt) {
    const fall = 1 - (h.armAt - h.age) / 0.35
    if (fall > 0) blitCentered(ctx, HAZARD_FX.rock(), h.x, h.y - 3 - (1 - fall) * 120)
    return
  }
  if ((h.visual === 'thunder' || h.visual === 'judgment') && h.age >= h.armAt) {
    ctx.globalAlpha = Math.max(0, 1 - (h.age - h.armAt) / (h.ttl - h.armAt))
    // Arceus's Judgment falls as a pillar of light.
    if (h.visual === 'judgment') bolt(ctx, h.x, h.y, 220, { width: 5, edge: '#f8e070', core: '#ffffff' })
    else bolt(ctx, h.x, h.y, 200)
    blitCentered(ctx, ellipse(Math.round(h.r), Math.round(h.r * 0.5), 'rgba(255,248,160,0.7)'), h.x, h.y)
    ctx.globalAlpha = 1
  }
}

/* ---------------- Shiny sparkles ---------------- */

const SPARKLE_BURST = 0.9
const TWINKLE_PERIOD = 0.8

/**
 * The shiny star burst (eight stars flying out for `SPARKLE_BURST` seconds),
 * followed by a twinkle at a random spot on the body every `TWINKLE_PERIOD`.
 * `since` is seconds since the entrance; `size` is the body size in px.
 */
export const drawSparkles = (ctx: Ctx, x: number, cy: number, size: number, since: number, seed: number) => {
  if (since < 0) return
  const stars = SPARKLE()
  if (since < SPARKLE_BURST) {
    const k = since / SPARKLE_BURST
    const r = 4 + (1 - (1 - k) ** 2) * (size * 0.7 + 10)
    const big = k < 0.2 ? 1 : k < 0.7 ? 2 : k < 0.85 ? 1 : 0
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + k * 0.6
      blitCentered(ctx, stars[i % 2 ? Math.max(0, big - 1) : big]!, x + Math.cos(a) * r, cy + Math.sin(a) * r)
    }
    return
  }
  const cycle = Math.floor(since / TWINKLE_PERIOD)
  const phase = since / TWINKLE_PERIOD - cycle
  if (phase > 0.4) return
  const frame = phase < 0.08 || phase > 0.32 ? 0 : phase < 0.14 || phase > 0.26 ? 1 : 2
  const ox = (hash2(seed, cycle, 1) - 0.5) * size
  const oy = (hash2(seed, cycle, 2) - 0.5) * size
  blitCentered(ctx, stars[frame]!, x + ox, cy + oy)
}

/* ---------------- Entities ---------------- */

const enemyAnim = (e: Enemy): AnimName => (e.dying >= 0 || e.flash > 0 ? 'Hurt' : isAsleep(e.status) || traitPace(e) === 0 ? 'Idle' : 'Walk')

/** `time` is game time (shiny entrance), `t` wall time (status tint). */
const drawEnemy = (ctx: Ctx, e: Enemy, time: number, t: number) => {
  const def: EnemyDef = ENEMIES[e.kind]
  const s = sprites(def.dex, e.shiny)
  const scale = def.scale ?? 1
  if (e.fled) {
    // Running off: it keeps walking away, rising a little, and fades out at the end.
    const k = e.dying / FLEE_TIME
    drawPokemon(ctx, s, 'Walk', e.dir, e.animTime + e.dying * 2, e.x, e.y - Math.round(k * 18), { alpha: 1 - k * k, scale })
    return
  }
  if (e.dying >= 0) {
    const k = e.dying / 0.4
    drawPokemon(ctx, s, 'Hurt', e.dir, e.dying, e.x, e.y, { alpha: 1 - k, flash: 0.6 + k * 0.4, loop: false, scale })
    return
  }
  // Leapers are drawn lifted mid-jump; their shadow stays on the ground.
  const y = e.y - traitLift(e)
  const size = Math.max(s.bodyW, s.bodyH) * scale
  const rage = e.fight?.enraged === true
  const anim = enemyAnim(e)
  if (e.runner && anim === 'Walk' && e.status.stun <= 0) drawSpeedLines(ctx, e, y - Math.round((s.bodyH * scale) / 2), s.bodyW * scale, t)
  if (rage) RAGE_TINT.amount = 0.15 + 0.15 * pulse(t, 3)
  const tint = traitTint(e) ?? statusTint(e.status, t, e.id) ?? (rage ? RAGE_TINT : undefined)
  drawPokemon(ctx, s, anim, e.dir, e.animTime, e.x, y, { flash: e.flash > 0.08 ? 0.85 : 0, tint, scale, outline: outlineOf(e, t) })
  if (e.shiny) drawSparkles(ctx, e.x, y - s.bodyH / 2, Math.max(s.bodyW, s.bodyH), time - e.bornAt, e.id)
  if (rage) drawRageEmbers(ctx, e.x, y - (s.bodyH * scale) / 2, size, t, e.id)
}

/** Reused red overlay of an enraged boss (no allocation per frame). */
const RAGE_TINT = { color: '#f83020', amount: 0 }

/** 0..1 triangle wave at `hz`. */
const pulse = (t: number, hz: number) => Math.abs(((t * hz) % 2) - 1)

/** Enraged bosses flicker red and orange fast; elites keep a slow crimson throb so a crowd of them reads at a glance on a phone. */
const outlineOf = (e: Enemy, t: number) => {
  if (e.fight?.enraged) return Math.floor(t * 8) % 2 === 0 ? '#f83020' : '#f8a020'
  if (e.elite) return Math.floor(t * 2.5 + e.id * 0.37) % 2 === 0 ? '#e02838' : '#f86858'
  return undefined
}

/** Unit steps per `Dir8` (0 Down, 1 DownRight, 2 Right, 3 UpRight, 4 Up, 5 UpLeft, 6 Left, 7 DownLeft). */
const DIR_STEP: readonly (readonly [number, number])[] = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]]

/** A runner's three flickering white streaks trailing behind its body (`cy` is mid-body, `w` the body width). */
const drawSpeedLines = (ctx: Ctx, e: Enemy, cy: number, w: number, t: number) => {
  const [dx, dy] = DIR_STEP[e.dir]!
  const back = Math.round(w / 2) + 1
  const frame = Math.floor(t * 14)
  ctx.fillStyle = '#ffffff'
  ctx.globalAlpha = 0.8
  for (let i = -1; i <= 1; i++) {
    const len = 3 + ((frame + i * 3 + e.id) & 3) - (i === 0 ? 0 : 1)
    const ox = Math.round(e.x - dx * back - dy * i * 3)
    const oy = Math.round(cy - dy * back + dx * i * 3)
    for (let k = 0; k < len; k++) ctx.fillRect(ox - dx * k, oy - dy * k, 1, 1)
  }
  ctx.globalAlpha = 1
}

/** Embers rising off an enraged boss (`cy` mid-body, `size` its body size). */
const drawRageEmbers = (ctx: Ctx, x: number, cy: number, size: number, t: number, seed: number) => {
  for (let i = 0; i < 8; i++) {
    const phase = (t * 0.9 + hash2(seed, i, 3)) % 1
    ctx.globalAlpha = 1 - phase
    ctx.fillStyle = i % 2 === 0 ? '#f83020' : '#f8c030'
    ctx.fillRect(Math.round(x + (hash2(seed, i, 4) - 0.5) * size), Math.round(cy + size * 0.4 - phase * size), 2, 2)
  }
  ctx.globalAlpha = 1
}

const hpColor = (ratio: number) => (ratio > 0.5 ? '#48d048' : ratio > 0.2 ? '#f8c830' : '#f04030')

/** The same run seen as player `p` (per-player art reads `g.player`). */
const as = (g: Game, p: Player): Game => (p === g.player ? g : { ...g, player: p })

/** Chain dash afterimages: fading type-colored copies of their owner along the lunge. */
const drawAfterimages = (ctx: Ctx, g: Game) => {
  for (const a of g.attacks) {
    if (a.visual !== 'afterimage' || a.age < 0) continue
    const p = a.owner
    const s = sprites(playerDex(g, p), p.shiny, megaLook(as(g, p)).form)
    const k = a.age / a.ttl
    drawPokemon(ctx, s, 'Walk', p.dir, p.animTime, a.x, a.y, { alpha: 0.7 * (1 - k), tint: { color: TYPE_COLORS[a.type], amount: 1 } })
  }
}

/** A fainted co-op player lies there, faded, until a teammate gets them up. */
const drawFainted = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const s = sprites(playerDex(g), p.shiny)
  drawPokemon(ctx, s, 'Hurt', p.dir, 0.2, p.x, p.y, { alpha: 0.55 })
  drawDowned(ctx, p, p.y - s.bodyH, t)
}

/** A player as `g.player` (the lens `as` picks who): sprite, Mega and shiny effects and HP bar; fainted, their Poké Ball. */
const drawPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  if (p.down) return drawFainted(ctx, g, t)
  // A Mega wears its Mega form (flickering white while it transforms); Aegislash its Blade Forme in Blade stance.
  const mega = megaLook(g)
  const s = sprites(playerDex(g), p.shiny, mega.form ?? (g.player.special.stance ? STANCE_FORMS[g.player.special.stance] : undefined))
  const anim: AnimName = p.hurt > 0 ? 'Hurt' : p.moving ? 'Walk' : 'Idle'
  const charging = g.player.special.charge > 0 && Math.floor(p.animTime * 16) % 2 === 0
  const blink = p.iframes > 0 && g.player.special.active <= 0 && Math.floor(p.iframes * 20) % 2 === 0
  // Aegislash flashes white for a moment as it swaps stance.
  const swapped = g.player.special.stance !== null && g.player.special.total - g.player.special.cooldown < 0.12
  const flash = Math.max(mega.flash, p.hurt > 0.2 ? 0.7 : charging || swapped ? 0.6 : 0)
  drawPokemon(ctx, s, anim, p.dir, p.animTime, p.x, p.y, { alpha: blink && mega.flash === 0 ? 0.45 : 1, flash, outline: mega.outline })
  // The shiny entrance plays shortly after the run starts.
  if (p.shiny) drawSparkles(ctx, p.x, p.y - s.bodyH / 2, Math.max(s.bodyW, s.bodyH), g.time - 0.3, 0)
  drawMegaAir(ctx, g, p.y - s.bodyH, p.animTime)

  // GBA-style HP bar under the feet.
  const w = 22
  const x = Math.round(p.x - w / 2)
  const y = Math.round(p.y + 4)
  ctx.fillStyle = '#181818'
  ctx.fillRect(x - 1, y - 1, w + 2, 4)
  ctx.fillStyle = '#504848'
  ctx.fillRect(x, y, w, 2)
  const ratio = p.hp / p.stats.maxHp
  ctx.fillStyle = hpColor(ratio)
  ctx.fillRect(x, y, Math.ceil(w * ratio), 2)
}

const drawPickups = (ctx: Ctx, g: Game, t: number) => {
  const candies = PICKUPS.candy()
  const coins = PICKUPS.coins()
  for (const k of g.pickups) {
    const bob = k.attracted ? 0 : Math.round(Math.sin(t * 4 + k.id) * 1.2)
    if (!k.attracted) blitCentered(ctx, ellipse(3, 1, 'rgba(16,40,16,0.25)'), k.x, k.y + 4)
    if (k.kind === 'consumable') {
      drawConsumable(ctx, k.item, k.x, k.y + bob, k.id, t)
      continue
    }
    if (k.kind === 'megaStone') {
      drawMegaStone(ctx, k.mega, k.x, k.y + bob, t)
      continue
    }
    const sprite =
      k.kind === 'xp' ? candies[xpTier(k.value)]!
      : k.kind === 'coin' ? coins[coinTier(k.value)]!
      : k.kind === 'berry' ? PICKUPS.berry()
      : PICKUPS.pokeball()
    blitCentered(ctx, sprite, k.x, k.y + bob)
  }
}

/* ---------------- Evolution scene ---------------- */

const drawEvolution = (ctx: Ctx, g: Game, t: number) => {
  const evo = g.player.evolution
  if (!evo) return
  const { w, h } = g.view
  const k = evo.t
  ctx.fillStyle = `rgba(8,8,24,${Math.min(0.85, k * 1.5)})`
  ctx.fillRect(0, 0, w, h)

  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2 + 24)
  const from = sprites(evo.from, g.player.shiny)
  const to = sprites(evo.to, g.player.shiny)
  const flashStart = 0.7
  const flashEnd = 3.7
  if (k < flashStart) {
    drawPokemon(ctx, from, 'Idle', 0, t, cx, cy, { scale: 2 })
  } else if (k < flashEnd) {
    // Alternating silhouettes that speed up, like the handheld games.
    const progress = (k - flashStart) / (flashEnd - flashStart)
    const period = 0.5 - progress * 0.44
    const showNew = Math.floor((k - flashStart) / period) % 2 === 1
    drawPokemon(ctx, showNew ? to : from, 'Idle', 0, t, cx, cy, { scale: 2, flash: 1 })
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU + k * 2
      const r = 70 - progress * 40
      ctx.fillStyle = i % 2 ? '#ffffff' : '#a8d8f8'
      ctx.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy - 30 + Math.sin(a) * r * 0.6), 2, 2)
    }
  } else {
    drawPokemon(ctx, to, 'Idle', 0, t, cx, cy, { scale: 2 })
    const white = 1 - (k - flashEnd) / 0.5
    if (white > 0) {
      ctx.fillStyle = `rgba(255,255,255,${white})`
      ctx.fillRect(0, 0, w, h)
    }
  }
  if (k > EVOLUTION_TIME - 0.2) {
    ctx.fillStyle = `rgba(255,255,255,${(k - EVOLUTION_TIME + 0.2) * 2})`
    ctx.fillRect(0, 0, w, h)
  }
}

/* ---------------- Frame ---------------- */

type Drawable = Enemy | Player | Solid
const drawables: Drawable[] = []
const isSolid = (d: Drawable): d is Solid => 'foot' in d
const isPlayer = (d: Drawable): d is Player => 'slot' in d

/* ---------------- Biome ---------------- */

/** Seconds the ground takes to dissolve into the next biome. */
const BIOME_FADE = 2.4
/** How far ahead (game seconds) the next biome's ground starts building in the background. */
const BIOME_WARMUP = 10

/** The ground dissolve in progress, if any. */
const biomeFade = (g: Game) => {
  const { prev, since } = g.biome
  const k = (g.time - since) / BIOME_FADE
  return prev && k < 1 ? { from: prev, k } : null
}

/** Player preferences from the settings screen. */
const TEXT_PASSES = [false, true] as const

/** Player preferences. `g.player` is who the screen follows. */
export type RenderOptions = { damageNumbers: DamageNumbers; screenShake: boolean }

export const render = (ctx: Ctx, g: Game, t: number, opts: RenderOptions) => {
  const { w, h } = g.view
  const shake = opts.screenShake ? g.shake : 0
  const shakeX = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 2) : 0
  const shakeY = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 2) : 0
  const camX = Math.round(g.camera.x) + shakeX
  const camY = Math.round(g.camera.y) + shakeY

  const fade = biomeFade(g)
  if (g.rift.arena) drawArena(ctx, g.rift.arena, camX, camY, w, h, t)
  else drawGround(ctx, camX, camY, w, h, g.biome.id, fade)
  const upcoming = biomeAt(g.time + BIOME_WARMUP)
  if (upcoming !== g.biome.id) warmGround(upcoming, camX, camY, w, h)
  // One terrain sprite per frame at most: this biome's first, then the next one's.
  if (g.rift.arena) warmArena(g.rift.arena)
  else if (!warmTerrain(g.biome.id) && upcoming !== g.biome.id) warmTerrain(upcoming)
  // Scenery changes outfit halfway through the dissolve, like the breakables.
  const look = fade && fade.k < 0.5 ? fade.from : g.biome.id
  ctx.save()
  ctx.translate(-camX, -camY)

  const visible = (x: number, y: number, m = 48) => x > camX - m && x < camX + w + m && y > camY - m && y < camY + h + m * 2

  drawTerrainGround(ctx, g, look, camX, camY)
  for (const a of g.attacks) if (a.age >= 0) drawGroundAttack(ctx, a, t)
  for (const hz of g.hazards) if (visible(hz.x, hz.y)) drawHazardGround(ctx, hz)
  // Breakables change outfit halfway through the dissolve.
  drawProps(ctx, g, t, look)
  // Map events wait outside with the rest of the world while the player is in an arena.
  if (!g.rift.arena) drawMapEvents(ctx, g, t)
  if (g.rift.portal) drawRiftPortal(ctx, g.rift.portal, t)
  for (const p of g.players) {
    if (!inPlay(p)) continue
    drawSpecialAura(ctx, as(g, p), t)
    drawMegaGround(ctx, as(g, p), camX, camY, t)
  }
  drawTraitGround(ctx, g, visible)
  drawPickups(ctx, g, t)

  drawables.length = 0
  for (const e of g.enemies) if (visible(e.x, e.y)) drawables.push(e)
  for (const p of g.players) if (!p.gone && visible(p.x, p.y)) drawables.push(p)
  solidsInView(g, camX, camY, w, h, drawables)
  // Mid-jump leapers sort last so they fly over the horde, and so does a flyer over a rock or a mountain.
  const depth = (d: Drawable) =>
    isPlayer(d) || isSolid(d) ? d.y : isAirborne(d) || (overTerrain(d) && inSolid(g, d.x, d.y, 4)) ? d.y + 4096 : d.y
  drawables.sort((a, b) => depth(a) - depth(b))

  for (const d of drawables) {
    if (isPlayer(d)) {
      const width = sprites(playerDex(g, d)).bodyW
      shadow(ctx, d.x, d.y, width)
      drawWading(ctx, as(g, d), width, t)
    }
    else if (!isSolid(d) && d.dying < 0) shadow(ctx, d.x, d.y, d.radius * 3)
  }
  drawAfterimages(ctx, g)
  for (const d of drawables) {
    if (isPlayer(d)) drawPlayer(ctx, as(g, d), t)
    else if (isSolid(d)) drawSolid(ctx, g, d, look)
    else drawEnemy(ctx, d, g.time, t)
  }
  // Badges only on bosses: on a 300-enemy horde they'd bury the sprites (tint + particles carry it there).
  for (const d of drawables) {
    if (!isPlayer(d) && !isSolid(d) && d.boss && d.dying < 0) {
      const def: EnemyDef = ENEMIES[d.kind]
      drawStatusBadge(ctx, d.status, d.x, d.y - sprites(def.dex).bodyH * (def.scale ?? 1) - 5)
    }
  }
  drawSleep(ctx, g, t)
  drawTraitAir(ctx, g, visible)

  for (const a of g.attacks) if (a.age >= 0 && visible(a.x, a.y, 200)) drawAttack(ctx, a, t)
  for (const hz of g.hazards) if (visible(hz.x, hz.y, 200)) drawHazard(ctx, hz)

  for (const p of g.particles) {
    ctx.globalAlpha = Math.min(1, (1 - p.life / p.ttl) * 1.5)
    ctx.fillStyle = p.color
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size)
  }
  ctx.globalAlpha = 1
  ctx.restore()

  // Weather goes over the world but under damage numbers, so they stay readable in fog and glare.
  drawWeather(ctx, g, camX, camY, t)
  ctx.save()
  ctx.translate(-camX, -camY)
  // Two passes: super-effective and critical numbers (`12!`) land on top of the rest.
  const mode = opts.damageNumbers
  const budget = damageBudget(g.texts, g.bossId)
  for (const bang of TEXT_PASSES) {
    for (const text of g.texts) {
      if (text.text.endsWith('!') !== bang || !showsText(text, mode, g.bossId, budget)) continue
      ctx.globalAlpha = textAlpha(text, mode)
      blitCentered(ctx, textSprite(text.text, text.color), text.x, text.y)
    }
  }
  ctx.globalAlpha = 1
  ctx.restore()

  drawRiftArrow(ctx, g, camX, camY, t)
  if (g.coop) drawTeamArrows(ctx, g, camX, camY, t)
  if (!g.rift.arena) drawMapEventMarkers(ctx, g, t)
  drawFlash(ctx, g)
  if (g.phase === 'evolving') drawEvolution(ctx, g, t)
}
