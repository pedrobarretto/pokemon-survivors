import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { atStage, eruptionEvery, hopCooldown, leapLift, MEGA_KIT_B, pureCap } from '../game/megaKitBRules'
import { localPlayer } from '../game/players'
import type { Attack, Game } from '../game/types'
import { magnitudeLabel, MEGA_B_FX } from './megaKitBArt'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How the Mega families look (`game/megaKitBMoves.ts`,
 * `game/megaKitBSystem.ts`): their hitboxes (the kick's landing and crash,
 * Magnitude's quake and its roll, the lava bombs and their magma, the ear
 * punches and the stomp, Fairy Wind's glitter, the blossoms and their petals,
 * the venom and its splash) and what rides on the player (Pure Power's focus,
 * the humps' pressure, the hop's spring). Presentation only; whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const headingOf = (a: Attack) => (a.motion.kind === 'linear' || a.motion.kind === 'homing' ? Math.atan2(a.motion.vy, a.motion.vx) : 0)

const radiusOf = (a: Attack, fallback: number) => (a.shape.kind === 'circle' ? a.shape.r : fallback)

/** Pixels flung out from (x, y) as `k` goes 0 to 1: sparks, clods, droplets; each its own way, from the hitbox's id. */
const spray = (ctx: Ctx, a: Attack, x: number, y: number, k: number, reach: number, colors: readonly string[], count: number, rise = 0) => {
  for (let i = 0; i < count; i++) {
    const ang = hash2(a.id, i, 31) * TAU
    const d = reach * k * (0.5 + 0.5 * hash2(a.id, i, 37))
    const up = rise * Math.sin(k * Math.PI) * (0.6 + 0.4 * hash2(a.id, i, 41))
    ctx.fillStyle = colors[i % colors.length]!
    ctx.fillRect(Math.round(x + Math.cos(ang) * d), Math.round(y + Math.sin(ang) * d * 0.6 - up), i % 3 === 0 ? 2 : 1, 1)
  }
}

/** A burst of short rays, the kick's impact: they shoot out and shrink. */
const rays = (ctx: Ctx, x: number, y: number, k: number, r: number, color: string, count: number, seed: number) => {
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * TAU + seed * 0.7
    const inner = r * (0.3 + 0.7 * k)
    const len = Math.max(1, Math.round(r * 0.5 * (1 - k)))
    for (let s = 0; s < len; s++) ctx.fillRect(Math.round(x + Math.cos(ang) * (inner + s)), Math.round(y + Math.sin(ang) * (inner + s) * 0.6), 1, 1)
  }
}

/** Magnitude's color by its roll: dust brown at 4, through amber, to a hot red at 10. */
const MAG_COLORS = ['#c8a070', '#d8a860', '#e8b048', '#f0a838', '#f88830', '#f86028', '#f83820'] as const

const BLOSSOMS = [MEGA_B_FX.blossom, MEGA_B_FX.blossomFlorges, MEGA_B_FX.blossomEternal] as const
const RING_COLORS = [['#f8a0a8', '#78c868'], ['#f8d0e0', '#a8e088'], ['#6870a8', '#f05868']] as const

export const drawMegaBAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'mbKick': {
      if (a.age < 0) return
      const k = Math.min(1, a.age / a.ttl)
      const r = radiusOf(a, 16)
      ctx.globalAlpha = fadeOut(a, 0.14)
      blitCentered(ctx, MEGA_B_FX.foot(), a.x, a.y - 6 - Math.round(Math.max(0, 0.08 - a.age) * 80))
      rays(ctx, a.x, a.y, k, r + 4, '#f8d048', 8, a.id)
      dashedRing(ctx, a.x, a.y + 2, r * (0.5 + 0.6 * k), a.id, ['#f87838', '#ffffff'], 0.8, 0.55)
      ctx.globalAlpha = 1
      return
    }
    case 'mbCrash': {
      // Face first into the ground: dust rolls out, and stars circle the dazed head (golden for the Mega, which shrugs it off).
      const k = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = Math.min(1, 1.6 - k * 1.6)
      for (const side of [-1, 1]) blitCentered(ctx, MEGA_B_FX.dust(), a.x + side * (5 + k * 12), a.y - 2 - k * 3)
      blitCentered(ctx, MEGA_B_FX.dust(), a.x, a.y + 1)
      ctx.globalAlpha = 1
      const stars = a.tier === 1 ? 2 : 3
      for (let i = 0; i < stars; i++) {
        const ang = (i / stars) * TAU + a.age * 9
        blitCentered(ctx, MEGA_B_FX.star(), a.x + Math.cos(ang) * 9, a.y - 26 + Math.sin(ang) * 3)
      }
      return
    }
    case 'mbQuake': {
      if (a.age < 0) return
      const r = radiusOf(a, 24)
      const mag = Math.max(4, Math.min(10, a.tier))
      const color = MAG_COLORS[mag - 4]!
      const k = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = fadeOut(a, 0.2)
      // The shock: a ring per magnitude step past 4, cracks radiating out, rubble thrown up.
      const rings = 1 + Math.floor((mag - 4) / 2)
      for (let w = 0; w < rings; w++) dashedRing(ctx, a.x, a.y + 4, Math.max(3, r - w * 4), a.id + w, w === 0 ? [color, '#f8e8c8'] : ['#8a6634', color], 1, 0.5)
      // Cracks running out from the feet, two pixels wide, lit on their upper lip.
      const cracks = detail.lean ? 4 : 5 + Math.floor((mag - 4) / 2)
      for (let i = 0; i < cracks; i++) {
        const ang = (i / cracks) * TAU + hash2(a.id, i, 11) * 0.8
        const len = r * (0.55 + 0.4 * hash2(a.id, i, 13)) * Math.min(1, k * 4)
        for (let s = 3; s < len; s += 1) {
          const jag = Math.round((hash2(a.id, i * 31 + Math.floor(s / 5), 17) - 0.5) * 3)
          const x = Math.round(a.x + Math.cos(ang) * s - Math.sin(ang) * jag)
          const y = Math.round(a.y + 4 + (Math.sin(ang) * s + Math.cos(ang) * jag) * 0.5)
          ctx.fillStyle = '#3a2814'
          ctx.fillRect(x, y, 2, 1)
          if (s % 2 === 0) {
            ctx.fillStyle = mag >= 8 ? '#f89030' : '#c8a070'
            ctx.fillRect(x, y - 1, 1, 1)
          }
        }
      }
      // Rubble thrown up off the ground, falling back.
      const rocks = detail.lean ? 4 : 4 + (mag - 4)
      for (let i = 0; i < rocks; i++) {
        const ang = hash2(a.id, i, 19) * TAU
        const d = r * (0.3 + 0.6 * hash2(a.id, i, 23)) * Math.min(1, k * 2)
        const up = Math.sin(Math.min(1, k * 1.6) * Math.PI) * (6 + mag * 1.5) * (0.6 + 0.4 * hash2(a.id, i, 29))
        blitCentered(ctx, MEGA_B_FX.rubble(), a.x + Math.cos(ang) * d, a.y + 4 + Math.sin(ang) * d * 0.5 - up)
      }
      spray(ctx, a, a.x, a.y + 4, k, r, ['#a07848', '#d8b878', color], detail.lean ? 6 : 6 + mag, 6 + mag)
      ctx.globalAlpha = 1
      // The roll, rising over the player.
      const rise = Math.round(Math.min(1, a.age / 0.15) * 6)
      if (a.age < a.ttl * 0.85) blitRotated(ctx, magnitudeLabel(mag, mag >= 8 ? '#f8e060' : '#ffffff'), a.x, a.y - 40 - rise, 0, 2)
      return
    }
    case 'mbBomb': {
      if (a.age < 0) return
      const r = radiusOf(a, 16)
      const k = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = fadeOut(a, 0.16)
      blitEllipse(ctx, Math.round(r * (0.4 + 0.5 * k)), Math.round(r * (0.25 + 0.3 * k)), k < 0.4 ? '#f8e060' : '#f87828', a.x, a.y + 2)
      dashedRing(ctx, a.x, a.y + 2, r * (0.5 + 0.5 * k), a.id, ['#f8e060', '#d84020'], 0.9, 0.55)
      spray(ctx, a, a.x, a.y, k, r * 1.2, ['#f8e060', '#f89030', '#584038'], detail.lean ? 6 : 12, 14)
      ctx.globalAlpha = 1
      return
    }
    case 'mbMagma': {
      if (a.age < 0) return
      // A pool of magma: lobes of it run out from where the bomb hit, a dark crust round them and the glow inside,
      // cooling from the rim in as it goes.
      const r = radiusOf(a, 12)
      const left = a.ttl - a.age
      const hot = left > 1
      ctx.globalAlpha = Math.min(1, left / 0.6, a.age / 0.1)
      const lobes = [0, 1, 2].map((i) => ({
        x: a.x + (hash2(a.id, i, 3) - 0.5) * r * 0.9,
        y: a.y + 2 + (hash2(a.id, i, 5) - 0.5) * r * 0.35,
        rx: Math.max(2, Math.round(r * (0.55 + 0.25 * hash2(a.id, i, 7)))),
      }))
      for (const l of lobes) blitEllipse(ctx, l.rx + 1, Math.max(1, Math.round((l.rx + 1) * 0.5)), '#2c1810', l.x, l.y)
      for (const l of lobes) blitEllipse(ctx, l.rx, Math.max(1, Math.round(l.rx * 0.5)), hot ? '#c83018' : '#8a2a14', l.x, l.y)
      for (const l of lobes) blitEllipse(ctx, Math.max(1, l.rx - 2), Math.max(1, Math.round(l.rx * 0.5) - 1), hot ? '#f87828' : '#c84820', l.x, l.y)
      blitEllipse(ctx, Math.max(1, Math.round(r * 0.3)), 1, hot ? '#f8d048' : '#e87830', lobes[0]!.x, lobes[0]!.y)
      const bubbles = detail.lean ? 2 : 4
      for (let i = 0; i < bubbles; i++) {
        const phase = (t * 1.4 + hash2(a.id, i, 3)) % 1
        const bx = a.x + (hash2(a.id, i, 5) - 0.5) * r * 1.2
        const by = a.y + 2 + (hash2(a.id, i, 7) - 0.5) * r * 0.5
        ctx.fillStyle = phase > 0.8 ? '#f8f0a0' : '#f8e060'
        if (phase > 0.8) ctx.fillRect(Math.round(bx) - 1, Math.round(by - 2), 3, 1)
        else ctx.fillRect(Math.round(bx), Math.round(by - phase * 2), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'mbPunch': {
      if (a.age < 0) return
      const counter = a.tier === 1
      ctx.globalAlpha = fadeOut(a, 0.08)
      const k = Math.min(1, a.age / 0.08)
      blitRotated(ctx, a.type === 'fighting' ? MEGA_B_FX.fistMega() : MEGA_B_FX.fist(), a.x, a.y, 0, counter ? 2 : 1)
      rays(ctx, a.x, a.y, k, radiusOf(a, 11), counter ? '#f8d048' : '#ffffff', counter ? 8 : 5, a.id)
      if (counter && !detail.lean) for (let i = 0; i < 3; i++) blitCentered(ctx, MEGA_B_FX.star(), a.x + Math.cos(i * 2.1 + a.age * 12) * 12, a.y - 6 + Math.sin(i * 2.1 + a.age * 12) * 4)
      ctx.globalAlpha = 1
      return
    }
    case 'mbStomp': {
      if (a.age < 0) return
      const r = radiusOf(a, 22)
      const k = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = fadeOut(a, 0.18)
      dashedRing(ctx, a.x, a.y + 2, r, a.id, a.tier === 1 ? ['#f87890', '#ffffff'] : ['#f0dcb0', '#ffffff'], 0.9, 0.5)
      for (const side of [-1, 1]) blitCentered(ctx, MEGA_B_FX.dust(), a.x + side * (6 + k * r * 0.6), a.y + 1)
      ctx.globalAlpha = 1
      return
    }
    case 'mbWind': {
      if (a.age < 0) return
      // A twinkle riding the gust, a trail of glitter behind it.
      const back = headingOf(a) + Math.PI
      for (let i = 1; i <= 4; i++) {
        ctx.fillStyle = i % 2 ? '#f8c8e0' : '#ffffff'
        const wob = Math.sin(t * 20 + i + a.id) * 2
        ctx.fillRect(Math.round(a.x + Math.cos(back) * i * 3 - Math.sin(back) * wob), Math.round(a.y + Math.sin(back) * i * 3 + Math.cos(back) * wob), 1, 1)
      }
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRotated(ctx, MEGA_B_FX.twinkle(), a.x, a.y, Math.floor(t * 10) % 2 === 0 ? 0 : Math.PI / 4)
      ctx.globalAlpha = 1
      return
    }
    case 'mbBlossom': {
      const tier = Math.max(0, Math.min(2, a.tier))
      const left = a.ttl - a.age
      // The ring it heals in, breathing; the flower sways; a wilting one sheds petals and fades.
      if (!detail.lean) {
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + a.id)
        dashedRing(ctx, a.x, a.y, radiusOf(a, 22), Math.floor(t * 3) + a.id, RING_COLORS[tier]!, 0.35, 0.5)
      }
      ctx.globalAlpha = Math.min(1, left / 0.5, a.age / 0.15 + 0.2)
      if (!detail.lean) blitEllipse(ctx, 4, 1, 'rgba(24,24,16,0.28)', a.x, a.y + 1)
      const sway = Math.round(Math.sin(t * 2 + a.id) * 1)
      blitCentered(ctx, BLOSSOMS[tier]!(), a.x + sway, a.y - 6)
      if (left < 0.5) spray(ctx, a, a.x, a.y - 10, 1 - left / 0.5, 10, ['#f8a0a8', '#ffffff'], 5, -6)
      ctx.globalAlpha = 1
      return
    }
    case 'mbPetal':
      return blitRotated(ctx, MEGA_B_FX.petal(), a.x, a.y, t * 9 + a.id)
    case 'mbGlob': {
      if (a.age < 0) return
      // Bigger as it grows (`venomSizes`), dripping behind.
      const r = radiusOf(a, 5)
      const back = headingOf(a) + Math.PI
      ctx.fillStyle = '#9858c8'
      for (let i = 1; i <= 3; i++) {
        const k = (t * 6 + i / 3 + a.id * 0.1) % 1
        ctx.fillRect(Math.round(a.x + Math.cos(back) * (r + 2 + i * 3)), Math.round(a.y + Math.sin(back) * (r + 2 + i * 3) + k * 4), 1, 1)
      }
      return blitRotated(ctx, MEGA_B_FX.glob(), a.x, a.y, headingOf(a) - Math.PI / 2, r >= 7 ? 2 : 1)
    }
    case 'mbSplash': {
      if (a.age < 0) return
      const r = radiusOf(a, 14)
      const k = Math.min(1, a.age / a.ttl)
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(1, Math.round(r * 0.35)), a.tier === 1 ? '#7838a8' : '#9858c8', a.x, a.y + 4)
      dashedRing(ctx, a.x, a.y + 2, r, a.id, ['#c8f0a0', '#9858c8'], 0.8, 0.55)
      spray(ctx, a, a.x, a.y, k, r * 1.3, ['#9858c8', '#d8a8f0', '#c8f0a0'], detail.lean ? 6 : 12, 10)
      ctx.globalAlpha = 1
      return
    }
    case 'mbDrop':
      if (a.age < 0) return
      return blitCentered(ctx, MEGA_B_FX.drop(), a.x, a.y)
  }
}

/**
 * The hitboxes still waiting to land (`age < 0`, which `drawAttack` skips): High Jump Kick's target closing on
 * where it comes down, and the lava bombs' lob out of the humps, their shadows growing under them.
 */
export const drawMegaBPending = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age >= 0 || !visible(a.x, a.y, 160)) continue
    if (a.visual === 'mbKick') {
      const k = Math.min(1, -a.age / MEGA_KIT_B.kick.leap)
      ctx.globalAlpha = 0.75
      dashedRing(ctx, a.x, a.y + 4, 4 + k * 10, Math.floor(t * 10), ['#f87838', '#ffffff'], 0.6, 0.55)
      ctx.globalAlpha = 1
      continue
    }
    if (a.visual !== 'mbBomb') continue
    const k = Math.max(0, Math.min(1, 1 + a.age / Math.max(0.01, a.memo)))
    const arc = (q: number) => ({ x: a.from.x + (a.x - a.from.x) * q, y: a.from.y + (a.y - a.from.y) * q - Math.sin(q * Math.PI) * 46 })
    if (!detail.lean) blitEllipse(ctx, 2 + Math.round(k * 4), 1 + Math.round(k), 'rgba(24,16,8,0.32)', a.x, a.y + 4)
    // Embers trailing behind, hottest nearest the bomb.
    for (let i = 1; i <= 4; i++) {
      const at = arc(Math.max(0, k - i * 0.035))
      ctx.fillStyle = i === 1 ? '#f8e060' : i === 2 ? '#f89030' : i === 3 ? '#d85020' : '#584038'
      ctx.fillRect(Math.round(at.x), Math.round(at.y), i < 3 ? 2 : 1, i < 3 ? 2 : 1)
    }
    const at = arc(k)
    blitRotated(ctx, a.tier === 1 ? MEGA_B_FX.bombBig() : MEGA_B_FX.bomb(), at.x, at.y, k * 7)
  }
}

/** A small bar under the HP bar: a charge or a cooldown. */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** Pips under the HP bar: Pure Power's focus. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

/** What rides on a player of the batch: Pure Power's focus and aura, the humps' smoke before they blow, the hop's spring and the counter's glint. */
export const drawMegaBAir = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.megaB
  if (!kit) return
  const y = Math.round(p.y + 9)
  const mega = p.mega.active > 0
  switch (kit.kind) {
    case 'pure': {
      const cap = pureCap(p.stage, mega)
      drawPips(ctx, p.x, y, kit.stacks, cap, '#f8a038')
      if (kit.stacks <= 0 || detail.lean) return
      // Focus: motes of aura rising round the body, more with every stack.
      for (let i = 0; i < kit.stacks; i++) {
        const k = (t * 0.9 + i / kit.stacks) % 1
        const ang = (i / kit.stacks) * TAU
        ctx.globalAlpha = 1 - k
        ctx.fillStyle = i % 2 ? '#f8d048' : '#f87838'
        ctx.fillRect(Math.round(p.x + Math.cos(ang) * (p.radius + 4)), Math.round(p.y - 4 - k * 22), 1, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'erupt': {
      const every = eruptionEvery(p.stage, mega)
      const fill = 1 - kit.next / every
      drawMeter(ctx, p.x, y, fill, fill > 0.8 ? '#f8e060' : '#f87828')
      if (fill < 0.75 || detail.lean) return
      // About to blow: smoke curling up off the humps.
      const top = p.y - (p.stage >= 1 ? 26 : 16)
      for (let i = 0; i < 4; i++) {
        const k = (t * 1.2 + i / 4) % 1
        ctx.globalAlpha = 1 - k
        ctx.fillStyle = i % 2 ? '#686060' : '#888080'
        ctx.fillRect(Math.round(p.x + (i - 1.5) * 3 + Math.sin(t * 3 + i) * 2), Math.round(top - k * 12), 2, 2)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hop': {
      if (kit.air > 0) return blitEllipse(ctx, 6, 2, 'rgba(24,24,16,0.3)', p.x, p.y + 2)
      if (kit.down > 0) drawMeter(ctx, p.x, y, 1 - kit.down / hopCooldown(p.stage, mega), '#f0dcb0')
      if (kit.counter <= 0) return
      // The counter waits: a glint on the ears, blinking as it runs out.
      if (kit.counter < 1 && Math.floor(t * 8) % 2 === 0) return
      blitCentered(ctx, MEGA_B_FX.star(), p.x + 6, p.y - p.radius * 2 - 6 - (Math.floor(t * 4) % 2))
      return
    }
    case 'garden':
      return
  }
}

/** Lifts the player's sprite through High Jump Kick's leap and Buneary's hop (`drawPlayer`'s moment look). */
export const megaBPlayerLook = (g: Game) => {
  const p = localPlayer(g)
  const kit = p.megaB
  if (kit?.kind === 'pure' && kit.leap > 0) return { lift: leapLift(kit.leap, kit.total, atStage(MEGA_KIT_B.kick.lift, p.stage)), alpha: 1 }
  if (kit?.kind === 'hop' && kit.air > 0) return { lift: leapLift(kit.air, MEGA_KIT_B.hop.time, atStage(MEGA_KIT_B.hop.lift, p.stage)), alpha: 1 }
  return null
}
