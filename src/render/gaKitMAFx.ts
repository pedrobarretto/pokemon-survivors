import { blitCentered, blitEllipse, blitRotated, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { featherCap, KIT_MA, snapEvery } from '../game/gaKitMARules'
import { localPlayer } from '../game/players'
import type { Attack, Game, Player } from '../game/types'
import { GA_KIT_MA_FX } from './gaKitMAArt'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How the Mega families look (`game/gaKitMAMoves.ts`, `game/gaKitMASystem.ts`):
 * their hitboxes (the punches and the baby's hop, the pincers, the blades and
 * feathers, the drill, the holes and the fault lines, the sound rings and the
 * roar), Drill Run's mound under the ground and what rides on the player
 * (the pincers' clock, the feathers' count, Drampa's rage). Presentation only;
 * whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const headingOf = (a: Attack) => (a.motion.kind === 'linear' || a.motion.kind === 'lunge' ? Math.atan2(a.motion.vy, a.motion.vx) : a.memo)

const megaIs = (p: Player, stone: string) => p.mega.active > 0 && p.mega.stone === stone

const ring = (ctx: Ctx, a: Attack, colors: readonly string[], squash: number, density = 0.9) => {
  if (a.shape.kind !== 'circle') return
  ctx.globalAlpha = fadeOut(a, 0.18)
  dashedRing(ctx, a.x, a.y, a.shape.r, a.id, colors, density, squash)
  ctx.globalAlpha = 1
}

/** Pinsir's horn colors: outline, shade, body and shine (Mega Pinsir's outline burns orange). */
const HORN = { line: '#202028', shade: '#9090a0', body: '#e0e0e8', shine: '#ffffff' } as const
const HORN_MEGA = { ...HORN, line: '#c83820' } as const

/**
 * Pinsir's two horns closing on (x, y), facing `heading`: `k` 0 is wide open, 1 shut. Each horn is drawn
 * pixel by pixel along a quarter curve from its base, beside and behind the bite, to its tip at the middle,
 * thick at the base and thin at the tip, with three spikes along its inner edge. `size` scales the curve.
 */
const drawPincers = (ctx: Ctx, x: number, y: number, heading: number, k: number, mega: boolean, size = 1) => {
  const fx = Math.cos(heading)
  const fy = Math.sin(heading)
  // Local frame: `side` across the bite, `ahead` along the heading.
  const put = (side: number, ahead: number, color: string) => {
    ctx.fillStyle = color
    ctx.fillRect(Math.round(x - fy * side + fx * ahead), Math.round(y + fx * side + fy * ahead), 1, 1)
  }
  const c = mega ? HORN_MEGA : HORN
  const gap = 1 + (1 - k) * 6
  const steps = Math.round(22 * size)
  for (const s of [-1, 1]) {
    const point = (u: number) => {
      const q = (u * Math.PI) / 2
      return { side: s * (gap + (7 - gap) * Math.cos(q)) * size, ahead: (-5 + 12 * Math.sin(q)) * size }
    }
    const width = (u: number) => (2 * (1 - u) + 0.5) * size
    // Three passes: the outline a pixel wider, the body, then the shade along the outer edge and a shine.
    for (const pass of [0, 1, 2]) {
      for (let i = 0; i <= steps; i++) {
        const u = i / steps
        const a = point(u)
        const b = point(Math.min(1, u + 0.02))
        const len = Math.hypot(b.side - a.side, b.ahead - a.ahead) || 1
        const ns = -(b.ahead - a.ahead) / len
        const na = (b.side - a.side) / len
        const w = width(u) + (pass === 0 ? 1 : 0)
        for (let d = -w; d <= w; d += 0.5) {
          const outer = d * s * ns < 0
          const color = pass === 0 ? c.line : pass === 1 ? c.body : outer && Math.abs(d) > w * 0.4 ? c.shade : null
          if (color) put(a.side + ns * d, a.ahead + na * d, color)
        }
        if (pass === 2 && i % 7 === 3) put(a.side, a.ahead, c.shine)
      }
    }
    // The spikes on the inner edge, pointing across the bite.
    for (const u of [0.3, 0.55, 0.78]) {
      const a = point(u)
      for (let d = 0; d < 2.5 * size; d++) put(a.side - s * (width(u) + d), a.ahead + d * 0.4, d >= 2 * size ? c.line : c.body)
    }
  }
}

/** A pixel crack from (x0, y0) to (x1, y1), drawn up to `k` of its length: the tunnel about to cave in. */
const crack = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, k: number, seed: number, color: string) => {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.max(1, Math.hypot(dx, dy))
  const nx = -dy / len
  const ny = dx / len
  const steps = Math.max(1, Math.floor(len * k))
  ctx.fillStyle = color
  for (let i = 0; i <= steps; i++) {
    const off = (hash2(seed, Math.floor(i / 3), 5) - 0.5) * 3
    ctx.fillRect(Math.round(x0 + (dx * i) / len + nx * off), Math.round(y0 + (dy * i) / len + ny * off * 0.6), 1, 1)
  }
}

export const drawGaKitMAAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'maBaby': {
      const mega = a.tier === 1
      if (a.age < 0) {
        // The hop: out of the pouch, over an arc, onto the foe.
        const k = Math.max(0, Math.min(1, 1 + a.age / KIT_MA.baby.hop))
        const x = a.from.x + (a.x - a.from.x) * k
        const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 12
        if (!detail.lean) blitEllipse(ctx, 3, 1, 'rgba(24,16,8,0.3)', x, a.y + 6)
        return blitCentered(ctx, (mega ? GA_KIT_MA_FX.babyMega : GA_KIT_MA_FX.baby)(), x, y)
      }
      // The punch lands: the baby on the foe, its little fist out, a star.
      const k = a.age / a.ttl
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitCentered(ctx, (mega ? GA_KIT_MA_FX.babyMega : GA_KIT_MA_FX.baby)(), a.x - (a.x >= a.from.x ? 7 : -7), a.y - 2 - Math.round(Math.sin(k * Math.PI) * 4))
      blitRotated(ctx, GA_KIT_MA_FX.star(), a.x, a.y, k * 2, k < 0.4 ? 1 : 0.75)
      ctx.globalAlpha = 1
      if (mega) ring(ctx, a, ['#f8e8c0', '#ffffff'], 0.6, 0.6)
      return
    }
    case 'maFault': {
      if (a.age < 0) {
        // The crack runs along the tunnel before it gives way, the far end first.
        const ahead = Math.min(1, Math.max(0, 1 + a.age / (KIT_MA.dig.collapse + 0.2)))
        const r = a.shape.kind === 'circle' ? a.shape.r : 10
        const dx = Math.cos(a.memo) * r
        const dy = Math.sin(a.memo) * r
        crack(ctx, a.x - dx, a.y - dy, a.x + dx, a.y + dy, ahead, a.id, '#2a1c10')
        return
      }
      // Rubble: the ground slumps, clods jump and a dust ring rolls out.
      const r = a.shape.kind === 'circle' ? a.shape.r : 10
      ctx.globalAlpha = fadeOut(a, 0.16)
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(2, Math.round(r * 0.35)), 'rgba(40,28,16,0.45)', a.x, a.y + 2)
      dashedRing(ctx, a.x, a.y, r * Math.min(1, 0.5 + a.age * 4), a.id, ['#b8a080', '#887050'], 0.8, 0.5)
      ctx.globalAlpha = 1
      const k = Math.min(1, a.age / a.ttl)
      const clods = detail.lean ? 2 : 4
      for (let i = 0; i < clods; i++) {
        const ang = hash2(a.id, i, 41) * TAU
        const d = r * (0.2 + 0.6 * k)
        blitCentered(ctx, GA_KIT_MA_FX.clod(), a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.5 - Math.sin(k * Math.PI) * (8 + 6 * hash2(a.id, i, 43)))
      }
      return
    }
  }
  if (a.age < 0) return
  switch (a.visual) {
    case 'maComet': {
      // The fist flies out and back, a comet tail of light behind it.
      const k = a.age / a.ttl
      const reach = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 4
      const x = a.x + Math.cos(a.memo) * reach
      const y = a.y + Math.sin(a.memo) * reach
      ctx.fillStyle = '#f8e8b0'
      for (let s = 3; s < 10; s += 2) ctx.fillRect(Math.round(x - Math.cos(a.memo) * s), Math.round(y - Math.sin(a.memo) * s), 1, 1)
      blitRotated(ctx, GA_KIT_MA_FX.fist(), x, y, a.memo)
      if (k < 0.45) blitCentered(ctx, GA_KIT_MA_FX.star(), x + Math.cos(a.memo) * 6, y + Math.sin(a.memo) * 6)
      return
    }
    case 'maThrow': {
      // The horns grip, then the throw's arc swings over the shoulder.
      const k = Math.min(1, a.age / 0.07)
      drawPincers(ctx, a.x, a.y, a.memo, k, false, 0.8)
      const swing = Math.min(1, a.age / a.ttl)
      ctx.fillStyle = '#ffffff'
      for (let i = 0; i < 7; i++) {
        const u = swing - i * 0.05
        if (u <= 0) break
        const ang = a.memo - Math.PI / 2 - u * Math.PI
        ctx.globalAlpha = 1 - i / 7
        ctx.fillRect(Math.round(a.x - Math.cos(a.memo) * 12 + Math.cos(ang) * 14), Math.round(a.y - 4 + Math.sin(ang) * 10), 2, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'maSnap': {
      const k = Math.min(1, a.age / 0.06)
      ctx.globalAlpha = fadeOut(a, 0.1)
      drawPincers(ctx, a.x, a.y, a.memo, k, a.tier === 1, 1.1)
      ctx.globalAlpha = 1
      if (a.age < 0.12 && k >= 1) blitRotated(ctx, GA_KIT_MA_FX.star(), a.x, a.y - 2, a.age * 8)
      return
    }
    case 'maGust':
      return blitRotated(ctx, GA_KIT_MA_FX.gust(), a.x, a.y, t * 14 + a.id, 1.5)
    case 'maCutter':
      return blitRotated(ctx, a.ignoreWards ? GA_KIT_MA_FX.cutterMega() : GA_KIT_MA_FX.cutter(), a.x, a.y, headingOf(a), a.shape.kind === 'circle' && a.shape.r > 7 ? 1.5 : 1)
    case 'maFeather': {
      // A feather stuck in the ground, glinting now and then; it blinks out as its time runs out.
      const left = a.ttl - a.age
      if (left < 1.5 && Math.floor(left * 8) % 2 === 0) return
      const pop = Math.min(1, a.age / 0.12)
      const art = a.tier === 1 ? GA_KIT_MA_FX.featherMega() : GA_KIT_MA_FX.feather()
      if (!detail.lean) blitEllipse(ctx, 4, 1, 'rgba(16,20,32,0.3)', a.x, a.y + 3)
      blitRotated(ctx, art, a.x, a.y - (1 - pop) * 8, (hash2(a.id, 3, 7) - 0.5) * 1.2 + (hash2(a.id, 5, 9) < 0.5 ? 0 : Math.PI))
      const glint = (t * 0.7 + hash2(a.id, 1, 3)) % 1
      if (glint < 0.08) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(a.x), Math.round(a.y - 2), 1, 1)
        ctx.fillRect(Math.round(a.x) - 1, Math.round(a.y - 2), 3, 1)
      }
      return
    }
    case 'maDrill': {
      // Above ground the drill spins through; under it (`drawGaKitMAGround`) only its tip breaks the surface.
      const heading = headingOf(a)
      const spin = Math.floor(t * 20) % 2 === 0
      const mega = a.ignoreWards
      const art = mega ? (spin ? GA_KIT_MA_FX.drillMegaA() : GA_KIT_MA_FX.drillMegaB()) : spin ? GA_KIT_MA_FX.drillA() : GA_KIT_MA_FX.drillB()
      const big = a.tier >= 1 ? 1.25 : 1
      blitRotated(ctx, art, a.x + Math.cos(heading) * 8, a.y + 4 + Math.sin(heading) * 6, heading, big)
      const sprays = detail.lean ? 3 : 6
      for (let i = 0; i < sprays; i++) {
        const k = (t * 4 + i / sprays) % 1
        const side = (hash2(a.id, i, Math.floor(t * 4 + i / sprays)) - 0.5) * 1.6
        ctx.fillStyle = i % 2 ? '#a89070' : '#d0c0a0'
        ctx.fillRect(Math.round(a.x - Math.cos(heading + side) * (4 + k * 14)), Math.round(a.y + 6 - Math.sin(heading + side) * (2 + k * 7) - Math.sin(k * Math.PI) * 6), 1, 1)
      }
      return
    }
    case 'maHole': {
      // A pit with a rim of loose earth; it caves in as it fades.
      const r = a.shape.kind === 'circle' ? a.shape.r : 10
      const left = a.ttl - a.age
      const shrink = left < 1 ? left : Math.min(1, a.age / 0.15)
      const rx = Math.max(2, Math.round(r * shrink))
      const ry = Math.max(1, Math.round(r * 0.45 * shrink))
      blitEllipse(ctx, rx + 2, ry + 1, '#8a7050', a.x, a.y)
      blitEllipse(ctx, rx, ry, '#3a2a1a', a.x, a.y)
      blitEllipse(ctx, Math.max(1, rx - 2), Math.max(1, ry - 1), '#160e08', a.x, a.y + 1)
      if (detail.lean) return
      for (let i = 0; i < 5; i++) {
        const ang = hash2(a.id, i, 13) * TAU
        blitCentered(ctx, GA_KIT_MA_FX.pebble(), a.x + Math.cos(ang) * (rx + 2), a.y + Math.sin(ang) * (ry + 1))
      }
      return
    }
    case 'maVoice': {
      // A sound ring: a bright band and a fainter echo just inside it, with the sound's little arcs.
      if (a.shape.kind !== 'circle') return
      const r = a.shape.r
      ctx.globalAlpha = fadeOut(a, 0.12)
      dashedRing(ctx, a.x, a.y, r, a.id + a.tier, ['#ffffff', '#d8c0f8'], 1, 0.6)
      if (r > 8) dashedRing(ctx, a.x, a.y, r - 2, a.id + 5, ['#a080d0', '#8060b8'], 0.7, 0.6)
      if (r > 14) dashedRing(ctx, a.x, a.y, r - 5, a.id + 9, ['#c8a8f0'], 0.3, 0.6)
      ctx.globalAlpha = 1
      return
    }
    case 'maRoar': {
      if (a.shape.kind !== 'circle') return
      const r = a.shape.r
      ctx.globalAlpha = fadeOut(a, 0.18)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#fff0d8', '#f87858'], 1, 0.6)
      dashedRing(ctx, a.x, a.y, Math.max(4, r - 5), a.id + 3, ['#e84838', '#78b8e8'], 0.6, 0.6)
      ctx.globalAlpha = 1
      return
    }
  }
}

/**
 * The batch's hitboxes still waiting to land, which the attack pass skips (it draws from age 0): the baby's
 * hop onto its foe and the crack running along a tunnel before it caves in.
 */
export const drawGaKitMAWaiting = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, margin: number) => boolean) => {
  for (const a of g.attacks) if (a.age < 0 && (a.visual === 'maBaby' || a.visual === 'maFault') && visible(a.x, a.y, 120)) drawGaKitMAAttack(ctx, a, t)
}

/** Under the player: Drampa's rage glowing red once it runs high; under the ground (Drill Run), the mound of earth that runs along where the player is, and its spray. */
export const drawGaKitMAGround = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  if (p.kitMA?.kind === 'berserk' && p.kitMA.rage >= 0.5 && !detail.lean) {
    ctx.globalAlpha = 0.25 + 0.2 * Math.sin(t * 6)
    blitEllipse(ctx, Math.round(p.radius * 1.6), Math.max(2, Math.round(p.radius * 0.5)), '#e84030', p.x, p.y + 1)
    ctx.globalAlpha = 1
  }
  if (p.kitMA?.kind !== 'dig' || p.hidden?.move !== 'drillRun') return
  const bob = Math.floor(t * 16) % 2
  if (!detail.lean) blitEllipse(ctx, 8, 2, 'rgba(24,16,8,0.3)', p.x, p.y + 1)
  blitCentered(ctx, GA_KIT_MA_FX.mound(), p.x, p.y - 2 - bob)
  const back = Math.atan2(-p.facing.y, -p.facing.x)
  for (let i = 0; i < 6; i++) {
    const k = (t * 3.5 + i / 6) % 1
    const spread = (hash2(i, 3, Math.floor(t * 3.5 + i / 6)) - 0.5) * 1.4
    ctx.fillStyle = i % 2 ? '#a89070' : '#d0c0a0'
    ctx.fillRect(Math.round(p.x + Math.cos(back + spread) * (6 + k * 12)), Math.round(p.y - 3 + Math.sin(back + spread) * (3 + k * 6) - Math.sin(k * Math.PI) * 5), 1, 1)
  }
}

/** Under the ground the player's sprite hides behind the mound. */
export const kitMAPlayerLook = (g: Game) => {
  const p = localPlayer(g)
  return p.kitMA?.kind === 'dig' && p.hidden?.move === 'drillRun' ? { lift: 0, alpha: 0 } : null
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

/** Pips under the HP bar: the feathers lying on the ground out of the cap. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

/** Drampa's rage: hot puffs rising off it, more and redder as it climbs. */
const drawRage = (ctx: Ctx, p: Player, rage: number, t: number, art: PixelSprite) => {
  const puffs = Math.max(1, Math.round((detail.lean ? 3 : 6) * rage))
  for (let i = 0; i < puffs; i++) {
    const k = (t * 1.3 + i / Math.max(1, puffs)) % 1
    const x = p.x + (hash2(i, 7, Math.floor(t * 1.3 + i / Math.max(1, puffs))) - 0.5) * p.radius * 2.4
    ctx.globalAlpha = (1 - k) * (0.4 + 0.6 * rage)
    blitCentered(ctx, art, x + Math.sin(t * 3 + i) * 2, p.y - 10 - k * 22)
  }
  ctx.globalAlpha = 1
}

/** What rides on a player of the batch: the pincers' clock, the feathers' count, Drampa's rage and its roar's clock. */
export const drawGaKitMAAir = (ctx: Ctx, g: Game, t: number) => {
  const p = localPlayer(g)
  const kit = p.kitMA
  if (!kit) return
  const y = Math.round(p.y + 9)
  switch (kit.kind) {
    case 'pincers':
      return drawMeter(ctx, p.x, y, 1 - kit.snap / snapEvery(megaIs(p, 'pinsir')), '#c8b898')
    case 'feathers': {
      let lying = 0
      for (const a of g.attacks) if (a.visual === 'maFeather' && a.owner === p.slot && a.age < a.ttl) lying++
      return drawPips(ctx, p.x, y, lying, featherCap(p.level, megaIs(p, 'skarmory')), '#c8d0e0')
    }
    case 'berserk': {
      if (kit.rage > 0) drawRage(ctx, p, kit.rage, t, GA_KIT_MA_FX.wisp())
      const R = KIT_MA.berserk.roar
      if (kit.roar > 0) drawMeter(ctx, p.x, y, 1 - kit.roar / (megaIs(p, 'drampa') ? R.megaCooldown : R.cooldown), '#e86858')
      return
    }
    default:
  }
}
