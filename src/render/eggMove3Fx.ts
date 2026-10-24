import { blitPacked, blitEllipse, blitRotated, textSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TAU } from '../engine/math'
import { HAMMER_WINDUP, HEAVY_HOP, HEAVY_LIFT, PERISH_TIME } from '../game/eggMove3Rules'
import { playerDex } from '../game/game'
import type { Attack, Game } from '../game/types'
import { EGG3_FX } from './eggMove3Art'
import { bodyOf } from '../data/bodies'
import { dashedRing } from './strokes'
import { localPlayer } from '../game/players'

/**
 * Visuals of the third batch of egg signatures (`game/eggMoves3.ts`). Both
 * frame passes of `draw.ts` fall through here like the other move modules;
 * `drawEgg3Player` adds what rides on the player (the might boost's arrows,
 * Fury Swipes' frenzy, Avalanche's payback) and `egg3PlayerLook` lifts the
 * sprite for Heavy Slam's hop. Everything snaps to whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

/** The way a moving hitbox goes. */
const heading = (a: Attack) => {
  const m = a.motion
  if (m.kind === 'linear' || m.kind === 'homing' || m.kind === 'return') return Math.atan2(m.vy, m.vx)
  return 0
}

/** Where an orbiting segment turns around (the player at the cast's body height), and its angle and radius now. */
const pivot = (a: Attack) => {
  const m = a.motion
  if (m.kind !== 'orbit') return null
  return { x: a.x - Math.cos(m.angle) * m.radius, y: a.y - Math.sin(m.angle) * m.radius, angle: m.angle, radius: m.radius, spin: m.spin }
}

/** Short rays of light around (x, y): an impact. */
const rays = (ctx: Ctx, x: number, y: number, size: number, count: number, colors: readonly [string, string], spin = 0, squash = 1) => {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + spin
    const len = i % 2 === 0 ? size : size * 0.6
    for (let d = 2; d <= len; d++) px(ctx, x + Math.cos(angle) * d, y + Math.sin(angle) * d * squash, d < len * 0.5 ? colors[0] : colors[1])
  }
}

/** Cracks running out of an impact on the ground. */
const cracks = (ctx: Ctx, x: number, y: number, reach: number, count: number, seed: number, color: string) => {
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + seed * 0.7
    for (let d = 3; d < reach; d += 1.5) {
      const jag = Math.sin(d * 0.6 + i * 2) * 1.5
      px(ctx, x + Math.cos(angle) * d - Math.sin(angle) * jag, y + (Math.sin(angle) * d + Math.cos(angle) * jag) * 0.5, color)
    }
  }
}

/** One frame of a dancing flame standing on (x, y); `soul` for Ceruledge's purple fire. */
const flame = (ctx: Ctx, x: number, y: number, t: number, seed: number, soul = false) => {
  const frames = soul ? EGG3_FX.soulFlame : EGG3_FX.flame
  const s = frames[Math.floor(t * 12 + seed) % frames.length]!()
  ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height))
}

/* ---------------- Ground layer ---------------- */

/** Ground layer (under Pokémon): shadows of things falling, cracks of the slams, a wave's furrow. */
export const drawEgg3Ground = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  switch (a.visual) {
    case 'gigatonHammer': {
      if (a.age < a.activeFrom) {
        // The hammer's shadow grows under where it'll land, and a red ring warns.
        const k = a.age / a.activeFrom
        blitEllipse(ctx, Math.max(1, Math.round(r * (0.4 + 0.6 * k))), Math.max(1, Math.round(r * 0.4 * (0.4 + 0.6 * k))), 'rgba(24,16,32,0.38)', a.x, a.y)
        if (Math.floor(a.age * 20) % 2 === 0) dashedRing(ctx, a.x, a.y, r, a.age * 3, ['#f85868', '#ffffff'], 0.75, 0.5)
        return
      }
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.45)), 'rgba(40,24,40,0.3)', a.x, a.y)
      cracks(ctx, a.x, a.y, Math.min(r * 1.1, 44), 9, a.id, '#302030')
      dashedRing(ctx, a.x, a.y, r * (0.7 + e * 0.5), a.id, ['#f8c0d0', '#ffffff', '#9098b0'], 0.9, 0.45)
      ctx.globalAlpha = 1
      return
    }
    case 'heavyQuake': {
      if (a.age < 0) return
      const e = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.5)), 'rgba(24,32,48,0.25)', a.x, a.y)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#ffffff', '#b8c8d8', '#68788c'], 0.9, 0.5)
      dashedRing(ctx, a.x, a.y, r * 0.75, -a.id, ['#b8c8d8', '#68788c'], 0.5, 0.5)
      cracks(ctx, a.x, a.y, Math.min(r * 0.9, 40), 6 + Math.min(6, a.tier), a.id, '#283040')
      ctx.globalAlpha = 1
      return
    }
    case 'heavySlam': {
      // The hop's shadow stays on the ground, shrinking at the top.
      const k = Math.min(1, a.age / HEAVY_HOP)
      const s = 1 - Math.sin(k * Math.PI) * 0.4
      blitEllipse(ctx, Math.round(10 * s), Math.max(1, Math.round(4 * s)), 'rgba(16,24,32,0.4)', a.x, a.y)
      return
    }
    case 'bulldoze': {
      // A furrow of churned earth behind each chunk.
      if (a.age < 0) return
      ctx.globalAlpha = 0.5 * fadeOut(a, 0.25)
      blitEllipse(ctx, Math.round(r * 1.1), Math.max(1, Math.round(r * 0.45)), 'rgba(74,44,20,0.55)', a.x, a.y + 2)
      ctx.globalAlpha = 1
      return
    }
    case 'avalanche': {
      // The slide's shadow on the ground where it will land, growing as it falls.
      if (a.age < 0) return
      const k = Math.min(1, a.age / a.ttl)
      const ground = a.memo
      blitEllipse(ctx, Math.max(1, Math.round(r * (0.4 + 0.6 * k))), Math.max(1, Math.round(r * 0.35 * (0.4 + 0.6 * k))), 'rgba(24,40,72,0.35)', a.x, ground)
      return
    }
    case 'perishWave': {
      const k = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - k) * 0.7
      for (let k = 0; k < 3; k++) dashedRing(ctx, a.x, a.y + 8, r - k, t * 2 + k, k === 1 ? ['#d0c8e8', '#ffffff'] : ['#504060', '#201828'], 0.95, 0.5)
      dashedRing(ctx, a.x, a.y + 8, r * 0.8, -t * 2, ['#706080', '#d0c8e8'], 0.5, 0.5)
      ctx.globalAlpha = 1
      return
    }
  }
}

/* ---------------- Air layer ---------------- */

const FIRE = ['#c83018', '#f8a030', '#fff0a0'] as const
const SOUL_FIRE = ['#6838a8', '#f87830', '#f8d070'] as const
const NOTE = ['.1111', '.1..1', '.1..1', '11.11', '11.11']

/** A small music note (`NOTE` rows) at (x, y). */
const note = (ctx: Ctx, x: number, y: number, color: string) => {
  NOTE.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) if (row[i] === '1') px(ctx, x + i, y + j, color)
  })
}

/** Air layer (over Pokémon): the flames, rings, hammer, blades, bites and the rest. */
export const drawEgg3Attack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle' || a.age < 0) return
  const r = a.shape.r
  switch (a.visual) {
    case 'fieryDance': {
      // A dancing flame with embers trailing behind it.
      const dir = heading(a)
      for (let i = 1; i <= 3; i++) px(ctx, a.x - Math.cos(dir) * i * 4 + Math.sin(t * 20 + i) , a.y - Math.sin(dir) * i * 4 + 2, i === 1 ? FIRE[1] : FIRE[0])
      blitEllipse(ctx, Math.max(1, Math.round(r * 0.9)), Math.max(1, Math.round(r * 0.45)), 'rgba(248,120,40,0.35)', a.x, a.y + 4)
      flame(ctx, a.x, a.y + 5, t, a.id)
      return
    }
    case 'overdrive': return drawRiff(ctx, a, t, r)
    case 'gigatonHammer': return drawHammer(ctx, a, r)
    case 'hammerTap': {
      // A quick light swing: the hammer flicks down and a small white arc.
      const k = Math.min(1, a.age / 0.1)
      const side = a.flip ? -1 : 1
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRotated(ctx, EGG3_FX.hammer(), a.x, a.y - 4, side * (-1.1 + k * 1.4))
      if (k >= 1) rays(ctx, a.x + side * 4, a.y + 2, 5, 6, ['#ffffff', '#f8c0d0'])
      ctx.globalAlpha = 1
      return
    }
    case 'bitterBlade': return drawBitterBlade(ctx, a, t)
    case 'leechLife': {
      // Two curved mandibles snap shut from the sides, then drops of red fly back to the player.
      const close = Math.min(1, a.age / a.activeFrom)
      const open = (1 - close) * 0.9
      ctx.globalAlpha = fadeOut(a, 0.12)
      for (const s of [-1, 1]) {
        for (let i = 0; i <= 8; i++) {
          const angle = (s < 0 ? Math.PI : 0) + s * (-1.1 + (i / 8) * 2.2) * 0.9 + s * open
          const rr = r + 2 - (i === 0 || i === 8 ? 1 : 0)
          const x = a.x + Math.cos(angle) * rr
          const y = a.y + Math.sin(angle) * rr * 0.8
          px(ctx, x, y, '#5a3a20', 2, 2)
          px(ctx, x, y, i % 4 === 0 ? '#ffffff' : '#f0e0c0')
        }
      }
      if (close >= 1) rays(ctx, a.x, a.y, 5, 6, ['#ffffff', '#f87070'], a.id)
      if (a.age >= a.activeFrom) {
        const k = Math.min(1, (a.age - a.activeFrom) / 0.2)
        for (let i = 0; i < 3; i++) {
          const kk = Math.max(0, k - i * 0.12)
          const x = a.x + (a.from.x - a.x) * kk
          const y = a.y + (a.from.y - a.y) * kk - Math.sin(kk * Math.PI) * 8
          px(ctx, x, y, i === 0 ? '#f87070' : '#c82838', 2, 2)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'fireFang': return drawFang(ctx, a, t, r)
    case 'furySwipes': {
      // Three claw marks raked across, revealed in a blink; redder as the frenzy grows.
      const k = Math.min(1, a.age / 0.07)
      const side = a.flip ? -1 : 1
      const hot = a.tier >= 2
      ctx.globalAlpha = fadeOut(a, 0.1)
      for (let c = -1; c <= 1; c++) {
        const len = Math.round(r * 1.6 * k)
        for (let i = 0; i < len; i++) {
          const u = i / Math.max(1, r * 1.6) - 0.5
          const x = a.x + side * (u * r * 1.6) + c * 4
          const y = a.y + u * r * 1.4 - c * 1
          const tip = i < 2 || i > len - 3
          px(ctx, x + side, y + 1, hot ? '#a02818' : '#a08060', 2, 1)
          px(ctx, x, y, tip ? (hot ? '#f87858' : '#f8e8c8') : '#ffffff', 2, 1)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'heavyQuake': {
      // A burst of steel glints and debris at the impact.
      const e = a.age / a.ttl
      if (e > 0.5) return
      ctx.globalAlpha = 1 - e * 2
      rays(ctx, a.x, a.y - 4, Math.min(r * 0.7, 26), 10, ['#ffffff', '#b8c8d8'], a.id, 0.6)
      for (let i = 0; i < 6 + Math.min(6, a.tier); i++) {
        const angle = (i / 8) * TAU + a.id
        const d = r * (0.5 + e)
        px(ctx, a.x + Math.cos(angle) * d, a.y - 6 + Math.sin(angle) * d * 0.5 - Math.sin(e * Math.PI) * 10, i % 2 ? '#68788c' : '#d8e0e8', 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'bulldoze': {
      // A rolling crest of earth: a mound with rocks tumbling over it and dust behind.
      const dir = heading(a)
      const bob = Math.sin(t * 20 + a.tier * 1.7) * 1.5
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(2, Math.round(r * 0.45)), '#4a2c14', a.x, a.y - 1 + bob * 0.3)
      blitEllipse(ctx, Math.round(r * 0.7), Math.max(2, Math.round(r * 0.38)), '#8a5a2c', a.x, a.y - 2 + bob * 0.3)
      blitEllipse(ctx, Math.max(1, Math.round(r * 0.4)), Math.max(1, Math.round(r * 0.2)), '#b88848', a.x - 1, a.y - 3 + bob * 0.3)
      for (let i = 0; i < 2; i++) {
        const spin = t * 14 + i * 3 + a.tier
        px(ctx, a.x + Math.cos(spin) * r * 0.5, a.y - 5 - Math.abs(Math.sin(spin)) * 5, i ? '#604020' : '#e0c080', 3, 2)
      }
      for (let i = 0; i < 3; i++) {
        const phase = (t * 3 + i / 3 + a.tier * 0.2) % 1
        px(ctx, a.x - Math.cos(dir) * (4 + phase * 12) + (hash2(a.id, i) - 0.5) * r, a.y - 2 - phase * 6, '#d8c8a8')
      }
      ctx.globalAlpha = 1
      return
    }
    case 'perishWave': {
      // Notes ride out on the song's ring.
      const k = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - k)
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * TAU + a.id * 0.3
        note(ctx, a.x + Math.cos(angle) * r - 2, a.y + Math.sin(angle) * r * 0.55 - 3 - Math.sin(t * 6 + i) * 2, i % 2 ? '#d0c8e8' : '#706080')
      }
      ctx.globalAlpha = 1
      return
    }
    case 'perishMark': return drawPerish(ctx, a, t)
    case 'chargeBeam': return drawBeam(ctx, a, t)
    case 'moonblast': {
      // The moon, a soft halo turning around it and sparkles left in its wake.
      const dir = heading(a)
      const scale = Math.max(1, Math.round(r / 6))
      for (let i = 1; i <= 4; i++) {
        const twinkle = Math.floor(t * 12 + i) % 2 === 0
        px(ctx, a.x - Math.cos(dir) * i * 5 + (hash2(a.id, i) - 0.5) * 6, a.y - Math.sin(dir) * i * 5 + (hash2(i, a.id) - 0.5) * 6, twinkle ? '#ffffff' : '#f8a8d0')
      }
      dashedRing(ctx, a.x, a.y, r + 3, t * 5, ['#f8c8e0', '#ffffff'], 0.35)
      blitRotated(ctx, EGG3_FX.moon(), a.x, a.y, 0, scale)
      return
    }
    case 'moonBurst': {
      // Moonlight blooms: a pink ring and four-point stars flashing out.
      const e = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - e)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#ffffff', '#f8a8d0', '#f088b8'], 0.85)
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * TAU + a.id
        const sx = a.x + Math.cos(angle) * r * 0.75
        const sy = a.y + Math.sin(angle) * r * 0.75
        px(ctx, sx - 2, sy, '#ffffff', 5, 1)
        px(ctx, sx, sy - 2, '#ffffff', 1, 5)
        px(ctx, sx, sy, '#f8a8d0')
      }
      ctx.globalAlpha = 1
      return
    }
    case 'frostBreath': {
      // An icy puff: pale blue cloud, white core and a snowflake or two.
      const e = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 0.85 - e * 0.8)
      blitEllipse(ctx, Math.max(1, Math.round(r)), Math.max(1, Math.round(r * 0.8)), '#a8e0f8', a.x, a.y)
      blitEllipse(ctx, Math.max(1, Math.round(r * 0.6)), Math.max(1, Math.round(r * 0.45)), '#ffffff', a.x - 1, a.y - 1)
      const spin = t * 4 + a.id
      const sx = a.x + Math.cos(spin) * r * 0.6
      const sy = a.y + Math.sin(spin) * r * 0.5
      px(ctx, sx - 1, sy, '#ffffff', 3, 1)
      px(ctx, sx, sy - 1, '#ffffff', 1, 3)
      ctx.globalAlpha = 1
      return
    }
    case 'avalanche': {
      // A snow boulder tumbling down, spraying snow; bluer and glinting when it pays back a hit.
      const spin = a.age * 14 * (a.flip ? -1 : 1)
      const scale = r >= 11 ? 2 : 1
      for (let i = 1; i <= 3; i++) px(ctx, a.x + (hash2(a.id, i) - 0.5) * r * 1.6, a.y - r - i * 4 - (t * 30) % 4, i === 1 ? '#ffffff' : '#d8e8f8', 2, 2)
      if (a.tier > 0) blitEllipse(ctx, Math.round(r + 2), Math.round(r + 2), 'rgba(120,200,248,0.35)', a.x, a.y)
      blitRotated(ctx, EGG3_FX.snowball(), a.x, a.y, Math.round(spin * 2) / 2, scale)
      if (a.ttl - a.age < 0.1) {
        // It hits the ground: a splash of snow.
        const k = 1 - (a.ttl - a.age) / 0.1
        for (let i = 0; i < 6; i++) {
          const angle = Math.PI + (i / 5) * Math.PI
          px(ctx, a.x + Math.cos(angle) * r * (0.8 + k), a.y + Math.sin(angle) * r * 0.6 * (0.8 + k), '#ffffff', 2, 2)
        }
      }
      return
    }
  }
}

/** Overdrive's beat: a jagged electric ring; the downbeat is double, purple-rimmed and throws sparks. */
const drawRiff = (ctx: Ctx, a: Attack, t: number, r: number) => {
  const e = a.age / a.ttl
  const down = a.tier > 0
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  const steps = Math.max(24, Math.round(r * TAU * 0.8))
  const amp = down ? 3 : 2
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * TAU
    // A sawtooth zigzag: the riff's waveform bent into a ring.
    const zig = (((i % 6) / 6) * 2 - 1) * amp
    const rr = r + zig
    const x = a.x + Math.cos(angle) * rr
    const y = a.y + Math.sin(angle) * rr * 0.8
    px(ctx, x, y, i % 6 === 5 ? '#ffffff' : '#f8e030', down ? 2 : 1, down ? 2 : 1)
    px(ctx, a.x + Math.cos(angle) * (rr - 2), a.y + Math.sin(angle) * (rr - 2) * 0.8, down ? '#a058c8' : '#c8a020')
  }
  if (down) {
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * TAU + a.id
      const x = a.x + Math.cos(angle) * r
      const y = a.y + Math.sin(angle) * r * 0.8
      px(ctx, x, y - 3, '#ffffff', 1, 3)
      px(ctx, x + 1, y, '#f8e030', 2, 1)
      px(ctx, x + 2, y + 1, '#ffffff', 1, 2)
    }
    note(ctx, a.x - 2 + Math.sin(t * 8) * 2, a.y - r * 0.8 - 6 - e * 8, '#e8c0f8')
  }
  ctx.globalAlpha = 1
}

/**
 * Gigaton Hammer: held by its grip just short of the target, it is raised up
 * and back, then swung over and down until the head lies on the target; it
 * stays a beat on the ground and fades. (The sprite is upright: head up, grip down.)
 */
const drawHammer = (ctx: Ctx, a: Attack, r: number) => {
  const side = a.flip ? -1 : 1
  const scale = r >= 34 ? 3 : 2
  const gx = a.x - side * 10 * scale
  const gy = a.y
  const at = (angle: number, lift: number, hot: boolean) =>
    blitRotated(ctx, hot ? EGG3_FX.hammerHot() : EGG3_FX.hammer(), gx + Math.sin(angle) * 6 * scale, gy - lift - Math.cos(angle) * 6 * scale, angle, scale)
  if (a.age < a.activeFrom) {
    const k = a.age / HAMMER_WINDUP
    // Up and back for most of the windup, then the swing comes over fast.
    if (k < 0.7) {
      const e = k / 0.7
      return at(-side * 0.7 * e, 14 * e, false)
    }
    const e = (k - 0.7) / 0.3
    return at(-side * 0.7 + side * (Math.PI / 2 + 0.7) * e * e, 14 * (1 - e), false)
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - Math.max(0, e - 0.4) / 0.6)
  at((side * Math.PI) / 2, e < 0.1 ? 2 : 0, e < 0.15)
  if (e < 0.35) rays(ctx, a.x, a.y, Math.round(r * 0.9), 12, ['#ffffff', '#f8c0d0'], a.id, 0.55)
  ctx.globalAlpha = 1
}

/** Bitter Blade: the purple blade swept from the player with a trail of soul fire behind it. */
const drawBitterBlade = (ctx: Ctx, a: Attack, t: number) => {
  const o = pivot(a)
  if (!o) return
  const len = o.radius + 6
  const scale = len >= 40 ? 2 : 1
  ctx.globalAlpha = fadeOut(a, 0.08)
  // The trail: a crescent of soul fire over the arc the blade already swept, hottest right behind it.
  const swept = Math.min(Math.abs(o.spin * a.age), 2.6)
  const back = -Math.sign(o.spin)
  const steps = Math.ceil(swept * len * 0.9)
  for (let i = 0; i <= steps; i++) {
    const k = i / Math.max(1, steps)
    const angle = o.angle + back * swept * k
    const inner = len * (0.5 + 0.35 * k)
    const flicker = Math.sin(t * 30 + i * 0.7) * 1.5
    for (let d = inner; d <= len + flicker; d += 1) {
      const edge = len + flicker - d < 2
      const color = edge ? (k < 0.4 ? SOUL_FIRE[2] : SOUL_FIRE[1]) : k < 0.2 ? SOUL_FIRE[1] : k < 0.55 ? '#a058e0' : SOUL_FIRE[0]
      // The tail end burns out in wisps.
      if (!edge && k > 0.7 && hash2(i, Math.round(d)) < (k - 0.7) * 3) continue
      px(ctx, o.x + Math.cos(angle) * d, o.y + Math.sin(angle) * d, color)
    }
  }
  blitRotated(ctx, EGG3_FX.bitterBlade(), o.x + Math.cos(o.angle) * len * 0.55, o.y + Math.sin(o.angle) * len * 0.55, o.angle, scale)
  ctx.globalAlpha = 1
}

/** Fire Fang: upper and lower fangs snap shut on the foe, licked by flames; a flinch shows a jolt. */
const drawFang = (ctx: Ctx, a: Attack, t: number, r: number) => {
  const close = Math.min(1, a.age / a.activeFrom)
  const gap = Math.round((1 - close) * r) + 1
  ctx.globalAlpha = fadeOut(a, 0.12)
  const w = Math.round(r * 1.6)
  for (const s of [-1, 1]) {
    const y = a.y + s * gap
    px(ctx, a.x - w / 2, y - (s < 0 ? 1 : 0), '#f87830', w, 1)
    for (let i = 0; i < 4; i++) {
      const fx = a.x - w / 2 + 1 + (i * (w - 3)) / 3
      for (let d = 1; d <= 3; d++) px(ctx, fx + (d === 3 ? 0.5 : 0), y - s * d - (s < 0 ? 1 : 0), '#ffffff', d === 3 ? 1 : 2, 1)
    }
  }
  if (a.age >= a.activeFrom) {
    for (let i = 0; i < 3; i++) flame(ctx, a.x - w / 2 + (i * w) / 2, a.y + 6 - (i % 2) * 3, t, i + a.id)
    if (a.tier > 0) {
      // Flinched: a jolt of yellow lines over its head.
      for (const s of [-1, 0, 1]) px(ctx, a.x + s * 4, a.y - r - 6 + Math.abs(s), '#f8e030', 1, 3)
    }
  }
  ctx.globalAlpha = 1
}

/** Perish Song's mark: a ghostly count of 3, 2, 1 over the foe, then a dark burst as it perishes. */
const drawPerish = (ctx: Ctx, a: Attack, t: number) => {
  const head = a.y - 10
  if (a.age < PERISH_TIME) {
    const left = Math.ceil(PERISH_TIME - a.age)
    const beat = (PERISH_TIME - a.age) % 1
    const pop = beat > 0.85 ? 1 : 0
    ctx.globalAlpha = Math.min(1, a.age / 0.25)
    blitPacked(ctx, textSprite(String(left), left === 1 ? '#f85868' : '#d0c8e8', '#201828'), a.x, head - pop)
    note(ctx, a.x + 4, head - 8 + Math.sin(t * 5 + a.id) * 1.5, '#706080')
    ctx.globalAlpha = 1
    return
  }
  const e = (a.age - PERISH_TIME) / (a.ttl - PERISH_TIME)
  ctx.globalAlpha = Math.max(0, 1 - e)
  rays(ctx, a.x, a.y, 10 + e * 8, 8, ['#d0c8e8', '#504060'], a.id)
  blitEllipse(ctx, Math.max(1, Math.round(5 + e * 6)), Math.max(1, Math.round(4 + e * 4)), 'rgba(32,24,40,0.6)', a.x, a.y - e * 10)
  ctx.globalAlpha = 1
}

/** Charge Beam: a crackling line from the player out to its tip, a charged orb at the start. */
const drawBeam = (ctx: Ctx, a: Attack, t: number) => {
  const o = pivot(a)
  if (!o) return
  const k = a.age / a.ttl
  ctx.globalAlpha = k > 0.6 ? Math.max(0, 1 - (k - 0.6) / 0.4) : 1
  const len = o.radius + (a.shape.kind === 'circle' ? a.shape.r : 0)
  const c = Math.cos(o.angle)
  const s = Math.sin(o.angle)
  const width = a.shape.kind === 'circle' && a.shape.r >= 8 ? 2 : 1
  for (let d = 8; d < len; d++) {
    const jag = Math.sin(d * 0.9 + t * 60) * 1.2 + (hash2(Math.floor(d / 4), Math.floor(t * 30)) - 0.5) * 1.5
    const x = o.x + c * d - s * jag
    const y = o.y + s * d + c * jag
    px(ctx, x - width, y - width, '#f8c820', 1 + width * 2, 1 + width * 2)
    px(ctx, o.x + c * d, o.y + s * d, '#ffffff', width, width)
  }
  blitEllipse(ctx, 4 + width, 4 + width, '#f8c820', o.x + c * 8, o.y + s * 8)
  blitEllipse(ctx, 2 + width, 2 + width, '#ffffff', o.x + c * 8, o.y + s * 8)
  rays(ctx, o.x + c * len, o.y + s * len, 5, 6, ['#ffffff', '#f8e030'], t * 9)
  ctx.globalAlpha = 1
}

/* ---------------- On the player ---------------- */

/** How the player's sprite shows: lifted mid-hop by Heavy Slam, or null. */
export const egg3PlayerLook = (g: Game) => {
  for (const a of g.attacks) {
    if (a.visual !== 'heavySlam' || a.age < 0 || a.owner !== localPlayer(g).slot) continue
    const k = Math.min(1, a.age / HEAVY_HOP)
    return { lift: Math.round(Math.sin(k * Math.PI) * HEAVY_LIFT), alpha: 1 }
  }
  return null
}

/** The might boost (red arrows rising, like a stat raise), Fury Swipes' frenzy (an anger mark) and Avalanche's payback (snowflakes). */
export const drawEgg3Player = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const boosted = p.moveBuffs.some((b) => b.move === 'fieryDance' || b.move === 'chargeBeam')
  const frenzy = p.moves.find((m) => m.id === 'furySwipes')?.stacks ?? 0
  const payback = (p.moves.find((m) => m.id === 'avalanche')?.stacks ?? 0) > 0
  if (!boosted && frenzy < 2 && !payback) return
  const bodyH = bodyOf(playerDex(g)).bodyH
  if (boosted) {
    for (let k = 0; k < 3; k++) {
      const phase = (t * 1.6 + k / 3) % 1
      const x = p.x + [-9, 0, 9][k]!
      const y = p.y - 4 - phase * (bodyH + 6)
      ctx.globalAlpha = Math.sin(phase * Math.PI)
      px(ctx, x, y, '#ffffff')
      px(ctx, x - 1, y + 1, '#f85838', 3, 1)
      px(ctx, x - 2, y + 2, '#f85838', 2, 1)
      px(ctx, x + 1, y + 2, '#f85838', 2, 1)
    }
    ctx.globalAlpha = 1
  }
  if (frenzy >= 2) {
    const x = p.x + 7
    const y = p.y - bodyH - 2 + (Math.floor(t * 6) % 2)
    const color = frenzy >= 3 ? '#f83838' : '#f88070'
    px(ctx, x, y, color, 1, 2); px(ctx, x + 3, y, color, 1, 2)
    px(ctx, x, y + 3, color, 1, 2); px(ctx, x + 3, y + 3, color, 1, 2)
    px(ctx, x + 1, y + 2, color, 2, 1)
  }
  if (payback) {
    for (let k = 0; k < 2; k++) {
      const angle = t * 2.5 + k * Math.PI
      const x = p.x + Math.cos(angle) * 11
      const y = p.y - bodyH * 0.5 + Math.sin(angle) * 3
      px(ctx, x - 1, y, '#d8f0ff', 3, 1)
      px(ctx, x, y - 1, '#d8f0ff', 1, 3)
      px(ctx, x, y, '#ffffff')
    }
  }
}
