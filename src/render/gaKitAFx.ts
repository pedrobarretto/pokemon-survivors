import { beginRects, blitCentered, blitEllipse, blitRotated, canvasCache, context2d, createCanvas, type PixelSprite } from '../engine/pixelart'
import { dir8, TAU } from '../engine/math'
import { TYPE_COLORS } from '../data/types'
import { atStage, GA_KIT, gaKitAMeter, shellOut } from '../game/gaKitARules'
import type { Attack, Game, Player } from '../game/types'
import { GA_KIT_A_FX, HAIR } from './gaKitAArt'
import { playerSprites } from './legend'
import { detail } from './quality'
import { dashedRing } from './strokes'
import { drawPokemon, sprites } from './sprites'

/**
 * How the big update's first 15 families look (`game/gaKitAMoves.ts`): their
 * hitboxes, and what rides on the player (the meters and pips, Electivire's
 * cables, Lapras's wake and the Shedinja beside Ninjask). Presentation only.
 */

/** A continuous 1 px oval (a ring seen on the ground, squashed by `squash`), plotted in one batch. */
const ovalRing = (ctx: Ctx, x: number, y: number, r: number, squash: number, color: string) => {
  if (r < 1) return
  const n = Math.max(8, Math.ceil(r * TAU * 1.1))
  beginRects(ctx, color)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU
    ctx.rect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * squash), 1, 1)
  }
  ctx.fill()
}

/* ---------------- Tea ---------------- */

/** A spill's inks: its edge, the deep middle, the liquid, the shallows and the glints. */
type TeaInk = { line: string; deep: string; body: string; shallow: string; glint: string }
/** Polteageist's black tea: amber. */
const BLACK_TEA: TeaInk = { line: '#6a2a0c', deep: '#8a3a10', body: 'rgba(156,78,26,0.8)', shallow: 'rgba(196,118,52,0.8)', glint: '#fff4d0' }
/** The Antique Form's tea is the real, older thing: rose, with flecks of gold. */
const ROSE_TEA: TeaInk = { line: '#6a2038', deep: '#862c44', body: 'rgba(184,78,92,0.86)', shallow: 'rgba(222,128,132,0.86)', glint: '#fff0f0' }

const puddles = canvasCache<string, PixelSprite>()

/** The drops a spill splashed round it (offsets in rx units, `lobe` picks a set), so no two spills look stamped. */
const SPLASH = [
  [[-1.18, 0.5], [1.12, -0.6]],
  [[1.18, 0.4], [-0.75, -1.25]],
  [[-1.15, -0.5], [0.7, 1.3]],
] as const

/**
 * A flat spill of tea `rx` px wide (half), lumpy at the edge, darker along its
 * near edge and lit in the middle, a streak of light on it and a few drops
 * splashed round it (`lobe` 0..2). Cached by size, lobe and ink.
 */
const puddle = (rx: number, lobe: number, ink: TeaInk) => {
  const key = `${rx}|${lobe}|${ink.body}`
  const kept = puddles.get(key)
  if (kept) return kept
  const ry = Math.max(2, Math.round(rx * 0.44))
  const pad = Math.ceil(rx * 0.45) + 2
  const w = rx * 2 + 1 + pad * 2
  const h = ry * 2 + 1 + pad * 2
  const cx = rx + pad
  const cy = ry + pad
  // The edge wobbles: a few bumps round the ellipse, turned by the lobe.
  const rim = (x: number, y: number) => {
    const a = Math.atan2((y - cy) / ry, (x - cx) / rx)
    return 1 + 0.08 * Math.sin(a * 2 + lobe * 2.1) + 0.04 * Math.sin(a * 3 + lobe)
  }
  const dist = (x: number, y: number) => Math.hypot((x - cx) / (rx + 0.5), (y - cy) / (ry + 0.5)) / rim(x, y)
  const drop = (x: number, y: number) => SPLASH[lobe]!.some(([dx, dy], i) => {
    const r = i === 0 ? 1.1 : 0.6
    return (x - Math.round(cx + dx * rx)) ** 2 + (y - Math.round(cy + dy * ry)) ** 2 <= r * r
  })
  const inside = (x: number, y: number) => dist(x, y) <= 1
  const canvas = createCanvas(w, h)
  const ctx = context2d(canvas)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (drop(x, y)) {
        ctx.fillStyle = ink.body
        ctx.fillRect(x, y, 1, 1)
        continue
      }
      if (!inside(x, y)) continue
      const d = dist(x, y)
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      ctx.fillStyle = edge ? ink.line : y > cy && !inside(x, y + 2) ? ink.deep : d < 0.55 && y <= cy ? ink.shallow : ink.body
      ctx.fillRect(x, y, 1, 1)
    }
  }
  // A streak of light on the surface, up and to the left.
  ctx.fillStyle = ink.glint
  ctx.fillRect(Math.round(cx - rx * 0.45), Math.round(cy - ry * 0.35), Math.max(2, Math.round(rx * 0.35)), 1)
  ctx.fillRect(Math.round(cx - rx * 0.45) - 1, Math.round(cy - ry * 0.35) + 1, 1, 1)
  puddles.set(key, canvas)
  return canvas
}

/**
 * Spilled tea: a small spill that settles in, a glint gliding over it, a ripple
 * now and then and a wisp or two of steam while it's hot; it shrinks and fades
 * as it dries. The Antique Form's is rose with gold flecks.
 */
const drawTea = (ctx: Ctx, a: Attack, t: number) => {
  const life = a.age / a.ttl
  const fade = Math.min(1, a.age / 0.12) * fadeOut(a, 0.5)
  const settle = Math.min(1, 0.45 + a.age / 0.2)
  const dry = life < 0.55 ? 1 : 1 - (life - 0.55) * 0.9
  const rx = Math.max(3, Math.round(radius(a) * 0.68 * settle * dry))
  const ry = Math.max(2, Math.round(rx * 0.44))
  const ink = a.flip ? ROSE_TEA : BLACK_TEA
  ctx.globalAlpha = fade
  blitCentered(ctx, puddle(rx, a.id % 3, ink), a.x, a.y)
  // The glint slides along under the lip.
  const gx = Math.round(a.x - rx * 0.3 + ((t * 4 + a.id * 1.7) % Math.max(1, rx * 0.9)))
  const gy = Math.round(a.y + ry * 0.2)
  ctx.fillStyle = ink.glint
  ctx.fillRect(gx, gy, 1, 1)
  ctx.fillStyle = ink.shallow
  ctx.fillRect(gx - 1, gy, 1, 1)
  ctx.fillRect(gx + 1, gy, 1, 1)
  if (a.flip) {
    ctx.fillStyle = '#f8e070'
    const blink = Math.floor(t * 6 + a.id) % 3
    ctx.fillRect(Math.round(a.x + rx * 0.4), Math.round(a.y + ry * 0.1), 1, 1)
    if (blink === 0) ctx.fillRect(Math.round(a.x - rx * 0.2), Math.round(a.y + ry * 0.4), 1, 1)
    if (blink === 1) ctx.fillRect(Math.round(a.x + rx * 0.1), Math.round(a.y - ry * 0.1), 1, 1)
  }
  if (!detail.lean) {
    // Steam while it's hot: one wisp a spill, two on every other.
    if (life < 0.7) {
      for (let i = 0; i < 1 + (a.id % 2); i++) {
        const rise = (t * 11 + i * 6 + a.id * 3) % 12
        ctx.globalAlpha = fade * (1 - rise / 12) * (1 - life / 0.7) * 0.9
        blitCentered(ctx, GA_KIT_A_FX.steam[(Math.floor(t * 3) + i) % 2]!(), a.x + (i === 0 ? -2 : 3), a.y - ry - 3 - Math.floor(rise))
      }
    }
  }
  ctx.globalAlpha = 1
}

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

const radius = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/** The angle a hitbox glued to the player points at (its offset), else 0. */
const facing = (a: Attack) => (a.motion.kind === 'follow' ? Math.atan2(a.motion.oy + 8, a.motion.ox) : 0)

/** Hitboxes drawn on the ground, under the bodies: the tea and the sliding shadows. */
export const drawGaKitAGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = radius(a)
  if (a.visual === 'gaTea') return drawTea(ctx, a, t)
  if (a.visual === 'gaShadow') {
    blitEllipse(ctx, Math.round(r * 0.9), Math.max(2, Math.round(r * 0.4)), 'rgba(24,12,40,0.75)', a.x, a.y)
    blitEllipse(ctx, Math.round(r * 0.5), 1, '#6848a8', a.x, a.y)
  }
}

export const drawGaKitAAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < 0) return
  const r = radius(a)
  switch (a.visual) {
    case 'gaRing':
      // A ring of sound or static: the type's color round a white core.
      ctx.globalAlpha = fadeOut(a, 0.2)
      ovalRing(ctx, a.x, a.y, r + 1, 0.6, '#181828')
      ovalRing(ctx, a.x, a.y, r, 0.6, TYPE_COLORS[a.type])
      ovalRing(ctx, a.x, a.y, r - 1, 0.6, '#ffffff')
      ctx.globalAlpha = 1
      return
    case 'gaClang': {
      // Clangorous Soul: the scales ring out in a gold shockwave, a scale riding it every few steps.
      const fade = fadeOut(a, 0.12)
      ctx.globalAlpha = fade
      ovalRing(ctx, a.x, a.y, r + 1, 0.6, '#6a4410')
      ovalRing(ctx, a.x, a.y, r, 0.6, '#f8d048')
      ovalRing(ctx, a.x, a.y, r - 1, 0.6, '#ffffff')
      if (!detail.lean) ovalRing(ctx, a.x, a.y, r * 0.72, 0.6, '#e86848')
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU + a.id
        const lit = Math.floor(t * 20 + i) % 3 === 0
        blitCentered(ctx, (lit ? GA_KIT_A_FX.scaleLit : GA_KIT_A_FX.scale)(), a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'gaVent': {
      // Magmortar vents: a ring of fire rolls out from the cannons.
      ctx.globalAlpha = fadeOut(a, 0.12)
      ovalRing(ctx, a.x, a.y, r + 1, 0.6, '#601008')
      ovalRing(ctx, a.x, a.y, r, 0.6, '#f87838')
      ovalRing(ctx, a.x, a.y, r - 1, 0.6, '#f8d048')
      ovalRing(ctx, a.x, a.y, r - 2, 0.6, '#c83010')
      const flames = detail.lean ? 6 : 10
      for (let i = 0; i < flames; i++) {
        const ang = (i / flames) * TAU + a.id
        blitCentered(ctx, GA_KIT_A_FX.flame[(Math.floor(t * 10) + i) % 2]!(), a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6 - 3)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'gaCroak':
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#a048c0', '#e8a8f8', '#58e858'], 1, 0.6)
      ctx.globalAlpha = 1
      return
    case 'gaSing': {
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r, a.id, ['#f8b8d0', '#ffffff'], 0.6, 0.6)
      // Notes ride the ring.
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + a.id
        blitCentered(ctx, GA_KIT_A_FX.note(), a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.6 - 3)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'gaChop':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, GA_KIT_A_FX.chop(), a.x, a.y, facing(a) + (a.flip ? -0.6 : 0.6), 1.5)
      ctx.globalAlpha = 1
      return
    case 'gaGuillotine':
      ctx.globalAlpha = fadeOut(a, 0.12)
      blitRotated(ctx, GA_KIT_A_FX.guillotine(), a.x, a.y, facing(a) - Math.PI / 4, 2)
      ctx.globalAlpha = 1
      return
    case 'gaClaw':
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, GA_KIT_A_FX.claw(), a.x, a.y, a.flip ? -0.4 : 0.4)
      ctx.globalAlpha = 1
      return
    case 'gaShedClaw':
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRotated(ctx, GA_KIT_A_FX.shedClaw(), a.x, a.y, a.flip ? -0.5 : 0.5)
      ctx.globalAlpha = 1
      return
    case 'gaHorn':
      blitRotated(ctx, GA_KIT_A_FX.horn(), a.x, a.y, facing(a) + Math.PI / 4)
      return
    case 'gaBow':
      ctx.globalAlpha = fadeOut(a, 0.1)
      blitRotated(ctx, GA_KIT_A_FX.spike(), a.x, a.y - 2, a.flip ? -Math.PI / 4 : Math.PI / 4, 1.5)
      ctx.globalAlpha = 1
      return
    case 'gaShadow': {
      // Spikes of shadow rise where it passes.
      const up = Math.floor((t * 12 + a.id) % 3)
      ctx.fillStyle = '#6848a8'
      for (let i = -1; i <= 1; i++) ctx.fillRect(Math.round(a.x + i * 4), Math.round(a.y - 3 - ((i + up) % 2) * 2), 1, 3)
      return
    }
    case 'gaGem':
      blitCentered(ctx, (a.id % 2 === 0 ? GA_KIT_A_FX.gem[0]! : GA_KIT_A_FX.gem[1]!)(), a.x, a.y + (Math.floor(t * 8 + a.id) % 2))
      return
    case 'gaWisp':
      blitCentered(ctx, GA_KIT_A_FX.wisp[Math.floor((t * 8 + a.id) % 2)]!(), a.x, a.y + Math.round(Math.sin(t * 6 + a.id) * 1.5))
      return
    case 'gaJab':
      blitRotated(ctx, GA_KIT_A_FX.jab(), a.x, a.y, facing(a))
      return
    case 'gaPunch':
      blitRotated(ctx, GA_KIT_A_FX.punch(), a.x, a.y, facing(a))
      return
    case 'gaSpark':
      blitRotated(ctx, GA_KIT_A_FX.spark(), a.x, a.y, Math.floor(t * 20) * (Math.PI / 2))
      return
    case 'gaWing':
      blitRotated(ctx, GA_KIT_A_FX.feather(), a.x, a.y, a.motion.kind === 'orbit' ? a.motion.angle : 0)
      return
    case 'gaZap': {
      // The shock a cable carries crackling over the foe it holds.
      const turn = Math.floor(t * 30 + a.id) % 4
      for (let i = 0; i < 4; i++) {
        const ang = ((i + turn * 0.5) / 4) * TAU
        blitCentered(ctx, GA_KIT_A_FX.spark(), a.x + Math.cos(ang) * (r - 2), a.y + Math.sin(ang) * (r - 2) * 0.8)
      }
      return
    }
    case 'gaFlame':
      blitCentered(ctx, GA_KIT_A_FX.flame[Math.floor((t * 10 + a.id) % 2)]!(), a.x, a.y)
      return
    case 'gaFlameSplash':
      ctx.globalAlpha = fadeOut(a, 0.2)
      dashedRing(ctx, a.x, a.y, r * Math.min(1, 0.4 + a.age * 4), a.id, ['#f88830', '#f8e060', '#c83010'], 0.8, 0.6)
      ctx.globalAlpha = 1
      return
    case 'gaBite':
      ctx.globalAlpha = fadeOut(a, 0.06)
      blitRotated(ctx, GA_KIT_A_FX.jaws(), a.x, a.y, facing(a) + Math.PI / 2)
      ctx.globalAlpha = 1
      return
    case 'gaPlate':
      // A broken plate's shards flying out.
      blitCentered(ctx, GA_KIT_A_FX.shard[(a.id + Math.floor(t * 12)) % 3]!(), a.x, a.y)
      return
    case 'gaPlateBreak': {
      // The plate that soaked the hit: a white flash, a crack, then it bursts with a clank.
      const u = a.age / a.ttl
      if (u < 0.12) blitCentered(ctx, GA_KIT_A_FX.plateFlash(), a.x, a.y + 2)
      else if (u < 0.3) blitCentered(ctx, GA_KIT_A_FX.plateCrack(), a.x, a.y + 2)
      else {
        const d = ((u - 0.3) / 0.7) * 12
        ctx.globalAlpha = 1 - (u - 0.3) / 0.7
        blitCentered(ctx, GA_KIT_A_FX.shard[0]!(), a.x - 2 - d, a.y - d * 0.6)
        blitCentered(ctx, GA_KIT_A_FX.shard[1]!(), a.x + 2 + d, a.y - d * 0.3)
        blitCentered(ctx, GA_KIT_A_FX.shard[2]!(), a.x, a.y + 3 + d * 0.5)
      }
      ctx.globalAlpha = (1 - u) * 0.9
      ovalRing(ctx, a.x, a.y + 2, 5 + u * 16, 0.7, '#ffffff')
      ctx.globalAlpha = 1
      return
    }
    case 'gaWard': {
      // Wonder Guard holds: the hollow shell rings, a pale ripple and the hit glancing off.
      const u = a.age / a.ttl
      ctx.globalAlpha = 1 - u
      if (u < 0.3) ovalRing(ctx, a.x, a.y, 10, 0.95, '#ffffff')
      ovalRing(ctx, a.x, a.y, 11 + u * 14, 0.85, '#f8f0c8')
      const u2 = Math.max(0, u - 0.2) / 0.8
      if (u2 > 0) ovalRing(ctx, a.x, a.y, 8 + u2 * 14, 0.85, '#c8a868')
      ctx.fillStyle = '#ffffff'
      const d = 8 + u * 10
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.fillRect(Math.round(a.x + sx * d), Math.round(a.y + sy * d * 0.8), 1, 1)
        ctx.fillRect(Math.round(a.x + sx * (d + 2)), Math.round(a.y + sy * (d + 2) * 0.8), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'gaPierce': {
      // A super-effective hit gets through: a red burst on the shell.
      const u = a.age / a.ttl
      ctx.globalAlpha = 1 - u * 0.6
      ovalRing(ctx, a.x, a.y, 7 + u * 18, 0.8, '#f83018')
      ovalRing(ctx, a.x, a.y, 6 + u * 18, 0.8, '#f8a030')
      if (u < 0.65 && Math.floor(a.age * 20) % 3 !== 2) blitCentered(ctx, GA_KIT_A_FX.pierce(), a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'gaMirror': {
      // A shot Mega Sableye's gem sent back: a gem with a streak behind it.
      if (a.motion.kind === 'linear') {
        const { vx, vy } = a.motion
        ctx.globalAlpha = 0.6
        blitEllipse(ctx, 2, 2, '#58e8f8', a.x - vx * 0.03, a.y - vy * 0.03)
        ctx.globalAlpha = 0.3
        blitEllipse(ctx, 1, 1, '#e0ffff', a.x - vx * 0.06, a.y - vy * 0.06)
        ctx.globalAlpha = 1
      }
      blitCentered(ctx, GA_KIT_A_FX.gem[1]!(), a.x, a.y)
      return
    }
    case 'gaGlint': {
      const u = a.age / a.ttl
      ctx.globalAlpha = 1 - u
      ovalRing(ctx, a.x, a.y, 4 + u * 12, 0.9, '#a8f8ff')
      ovalRing(ctx, a.x, a.y, 2 + u * 8, 0.9, '#ffffff')
      if (Math.floor(a.age * 24) % 2 === 0) blitCentered(ctx, GA_KIT_A_FX.twinkle(), a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
  }
}

/** A small bar under the HP bar. */
const drawMeter = (ctx: Ctx, x: number, y: number, fill: number, color: string, on: boolean) => {
  const w = 22
  const lx = Math.round(x - w / 2)
  ctx.fillStyle = '#181828'
  ctx.fillRect(lx - 1, y - 1, w + 2, 4)
  ctx.fillStyle = on ? '#ffffff' : color
  ctx.fillRect(lx, y, Math.round(w * Math.max(0, Math.min(1, fill))), 2)
}

/** Pips under the HP bar: stacks, plates, sacs, wisps. */
const drawPips = (ctx: Ctx, x: number, y: number, count: number, cap: number, color: string) => {
  const lx = Math.round(x - (cap * 3) / 2)
  for (let i = 0; i < cap; i++) {
    ctx.fillStyle = i < count ? color : 'rgba(0,0,0,0.45)'
    ctx.fillRect(lx + i * 3, y, 2, 2)
  }
}

/* ---------------- Electivire's cables ---------------- */

/** Scratch for a cable's points (x, y pairs), reused every frame. */
const cablePts: number[] = []

/**
 * One of Electivire's cables from (x0, y0) to a foe at (x1, y1): black and
 * yellow stripes sagging between them, outlined, a plug latched on the foe, and
 * the shock running down it to arrive as the zap lands (`run`, 0..1).
 */
const cable = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, run: number) => {
  const len = Math.hypot(x1 - x0, y1 - y0)
  const sag = Math.min(16, 3 + len * 0.16)
  const mx = (x0 + x1) / 2
  const my = (y0 + y1) / 2 + sag
  const n = Math.max(4, Math.ceil(len * 1.1))
  cablePts.length = 0
  for (let i = 0; i <= n; i++) {
    const k = i / n
    const a = (1 - k) * (1 - k)
    const b = 2 * (1 - k) * k
    const c = k * k
    cablePts.push(Math.round(a * x0 + b * mx + c * x1), Math.round(a * y0 + b * my + c * y1))
  }
  // Outline, then the two rows of the cable: yellow bands with black ones between, lit on top.
  beginRects(ctx, '#140c0c')
  for (let i = 0; i <= n; i++) ctx.rect(cablePts[i * 2]! - 1, cablePts[i * 2 + 1]! - 1, 3, 4)
  ctx.fill()
  const step = len / n
  for (const [yellow, row, color] of [[true, 0, '#f8e868'], [true, 1, '#d09818'], [false, 0, '#545058'], [false, 1, '#262024']] as const) {
    beginRects(ctx, color)
    for (let i = 0; i <= n; i++) if ((Math.floor(i * step) % 7 < 4) === yellow) ctx.rect(cablePts[i * 2]!, cablePts[i * 2 + 1]! + row, 1, 1)
    ctx.fill()
  }
  // The plug, latched: a black head with a yellow band, two prongs into the foe.
  const back = Math.max(0, n - 4)
  const ux = x1 - cablePts[back * 2]!
  const uy = y1 - cablePts[back * 2 + 1]!
  const ul = Math.hypot(ux, uy) || 1
  const dx = ux / ul
  const dy = uy / ul
  const hx = Math.round(x1 - dx * 3)
  const hy = Math.round(y1 - dy * 3)
  ctx.fillStyle = '#140c0c'
  ctx.fillRect(hx - 3, hy - 3, 6, 6)
  ctx.fillStyle = '#3c3438'
  ctx.fillRect(hx - 2, hy - 2, 4, 4)
  ctx.fillStyle = '#f8d030'
  ctx.fillRect(hx - 2, hy, 4, 1)
  ctx.fillStyle = '#e8e8f0'
  for (const side of [-1, 1]) {
    for (let k = 3; k <= 5; k++) ctx.fillRect(Math.round(hx + dx * k - dy * side * 1.5), Math.round(hy + dy * k + dx * side * 1.5), 1, 1)
  }
  // The shock running down the cable.
  const sparks = detail.lean ? [run] : [run, (run + 0.5) % 1]
  for (const at of sparks) {
    const i = Math.min(n, Math.round(at * n))
    const sx = cablePts[i * 2]!
    const sy = cablePts[i * 2 + 1]!
    ctx.fillStyle = '#f8f070'
    ctx.fillRect(sx - 1, sy, 3, 2)
    ctx.fillRect(sx, sy - 1, 2, 4)
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(sx, sy, 2, 2)
  }
  if (run > 0.85) blitCentered(ctx, GA_KIT_A_FX.spark(), x1, y1 - 2)
}

/* ---------------- Grimmsnarl's hair ---------------- */

/** Mischief gathering: curls of hair drifting in round the body, more and closer as the meter fills, twitching near full. */
const drawStrands = (ctx: Ctx, p: Player, fill: number, t: number) => {
  const count = Math.max(1, Math.round(fill * 8))
  const reach = 28 - fill * 10
  const twitch = fill >= 0.8 ? Math.floor(t * 12) % 2 : 0
  for (let i = 0; i < count; i++) {
    const ang = (i / 8) * TAU + t * 0.9
    const x = p.x + Math.cos(ang) * (reach + twitch)
    blitCentered(ctx, GA_KIT_A_FX.curl[x < p.x ? 0 : 1]!(), x, p.y - 14 + Math.sin(ang) * (reach + twitch) * 0.7)
  }
}

/** The nearest live foe to (x, y) within `reach`, for a hair arm to swing at. */
const swingTarget = (g: Game, x: number, y: number, reach: number) => {
  let best: { x: number; y: number } | null = null
  let bestD = reach * reach
  for (const e of g.enemies) {
    if (e.dying >= 0 || e.behavior.kind === 'avatar') continue
    const d = (e.x - x) ** 2 + (e.y - e.radius - y) ** 2
    if (d < bestD) {
      bestD = d
      best = { x: e.x, y: e.y - e.radius }
    }
  }
  return best
}

/**
 * Grimmsnarl's hair coiled into muscle: two thick arms of hair from its
 * shoulders, each lashing out at the nearest foe in turn (flexing beside it with
 * nobody near), a fist of hair and a pink star where it lands.
 */
const drawHairArms = (ctx: Ctx, g: Game, p: Player, t: number) => {
  for (const side of [-1, 1] as const) {
    const phase = (t * 1.7 + (side > 0 ? 0.5 : 0)) % 1
    const out = phase < 0.3 ? phase / 0.3 : phase < 0.45 ? 1 : 1 - (phase - 0.45) / 0.55
    const sx = p.x + side * 7
    const sy = p.y - 16
    const target = swingTarget(g, sx, sy, 64) ?? { x: sx + side * 16, y: sy - 10 + Math.round(Math.sin(t * 6 + side) * 2) }
    const tx = sx + (target.x - sx) * out
    const ty = sy + (target.y - sy) * out
    const len = Math.hypot(tx - sx, ty - sy)
    const nx = len > 0 ? -(ty - sy) / len : 0
    const ny = len > 0 ? (tx - sx) / len : 0
    const bend = side * (10 - out * 6)
    const segs = Math.max(4, Math.ceil(len / 3))
    for (const [rx, color] of [[3, HAIR[1]], [2, HAIR[2]]] as const) {
      for (let i = 0; i <= segs; i++) {
        const k = i / segs
        const bow = Math.sin(k * Math.PI) * bend
        const w = rx - (k > 0.6 ? 1 : 0)
        blitEllipse(ctx, w, w, color, sx + (tx - sx) * k + nx * bow, sy + (ty - sy) * k + ny * bow)
      }
    }
    ctx.fillStyle = HAIR[3]
    for (let i = 1; i < segs; i += 2) {
      const k = i / segs
      const bow = Math.sin(k * Math.PI) * bend
      ctx.fillRect(Math.round(sx + (tx - sx) * k + nx * bow) - 1, Math.round(sy + (ty - sy) * k + ny * bow) - 1, 1, 1)
    }
    blitCentered(ctx, GA_KIT_A_FX.hairFist(), tx, ty)
    if (out >= 0.95) blitCentered(ctx, GA_KIT_A_FX.impact(), tx + side * 3, ty - 3)
  }
}

/* ---------------- Corviknight's plates ---------------- */

/** Corviknight's plates on their orbit: the ones behind the body (`front` false) or before it; a slot regrowing blinks in. */
const drawPlates = (ctx: Ctx, p: Player, plates: number, regrow: number, t: number, front: boolean) => {
  const cap = atStage(GA_KIT.plates.cap, p.stage)
  const r = 17
  for (let i = 0; i < cap; i++) {
    const ang = t * 1.6 + (i / cap) * TAU
    const depth = Math.sin(ang)
    if (depth >= 0 !== front) continue
    const ghost = i >= plates
    if (ghost && (regrow > 1.5 || Math.floor(t * 8) % 2 === 0)) continue
    const face = Math.abs(depth)
    const sprite = GA_KIT_A_FX.plate[face > 0.7 ? 0 : face > 0.3 ? 1 : 2]!()
    ctx.globalAlpha = ghost ? 0.45 : 1
    blitCentered(ctx, sprite, p.x + Math.cos(ang) * r, p.y - 10 + depth * r * 0.45)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Magmortar's cannons ---------------- */

/** Where the arm cannons are on the drawn body: either side, a little under the middle. */
const cannons = (g: Game) => {
  const p = g.player
  const s = playerSprites(g)
  const dx = Math.max(6, Math.round(s.bodyW * 0.45))
  const y = Math.round(p.y - s.bodyH * 0.42)
  return [{ x: p.x - dx, y, side: -1 }, { x: p.x + dx, y, side: 1 }] as const
}

/** The cannons glowing by heat, in three steps up to white hot; venting, they blast fire, then smoke and cool. */
const drawCannons = (ctx: Ctx, g: Game, heat: number, vent: number, t: number) => {
  const p = g.player
  const fill = heat / atStage(GA_KIT.heat.need, p.stage)
  if (heat <= 0 && vent <= 0) return
  const since = GA_KIT.heat.vent - vent
  const tier = vent > 0 ? (since < 0.6 ? 2 : 3) : fill < 0.34 ? 0 : fill < 0.67 ? 1 : 2
  for (const c of cannons(g)) {
    if (tier === 2) {
      ctx.globalAlpha = 0.5
      blitEllipse(ctx, 4, 3, '#f8d048', c.x, c.y)
      ctx.globalAlpha = 1
    }
    blitCentered(ctx, GA_KIT_A_FX.muzzle[tier]!(), c.x, c.y)
    if (vent > 0) {
      if (since < 0.7) {
        // The blast: a column of fire out of each cannon.
        ctx.globalAlpha = 1 - since / 0.7
        for (let j = 0; j < 3; j++) blitCentered(ctx, GA_KIT_A_FX.flame[(Math.floor(t * 12) + j) % 2]!(), c.x + c.side * j * 2, c.y - 5 - j * 5)
      }
      if (!detail.lean && since > 0.3) {
        for (let j = 0; j < 2; j++) {
          const rise = (since * 14 + j * 7) % 16
          ctx.globalAlpha = (1 - rise / 16) * Math.min(1, vent)
          blitCentered(ctx, GA_KIT_A_FX.smoke(), c.x + c.side * Math.floor(rise / 5), c.y - 4 - Math.floor(rise))
        }
      }
      ctx.globalAlpha = 1
      continue
    }
    // Embers rising off the hot metal, more as it heats.
    if (detail.lean) continue
    const embers = [1, 2, 4][tier]!
    for (let i = 0; i < embers; i++) {
      const rise = (t * 18 + i * 7 + (c.side > 0 ? 3 : 0)) % 12
      ctx.globalAlpha = 1 - rise / 12
      ctx.fillStyle = i % 2 === 0 ? '#f8d048' : '#f87838'
      ctx.fillRect(c.x + ((i * 5 + (c.side > 0 ? 3 : 0)) % 5) - 2, Math.round(c.y - 3 - rise), 1, 1)
    }
    ctx.globalAlpha = 1
  }
}

/* ---------------- Kommo-o's soul ---------------- */

/** Clangorous Soul running: a halo of gold scales ringing in turn round the body, a ripple of sound off it now and then. */
const drawSoul = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const s = playerSprites(g)
  const rx = Math.max(12, Math.round(s.bodyW * 0.5) + 5)
  const cy = p.y - Math.round(s.bodyH * 0.5)
  if (!detail.lean) {
    const u = (t / 0.7) % 1
    ctx.globalAlpha = (1 - u) * 0.85
    ovalRing(ctx, p.x, p.y - 1, 9 + u * 16, 0.5, '#f8d048')
    ovalRing(ctx, p.x, p.y - 1, 8 + u * 16, 0.5, '#fff8c0')
    ctx.globalAlpha = 1
  }
  const lit = Math.floor(t * 14) % 8
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU - t * 0.8
    const on = i === lit || i === (lit + 7) % 8
    blitCentered(ctx, (on ? GA_KIT_A_FX.scaleLit : GA_KIT_A_FX.scale)(), p.x + Math.cos(ang) * rx, cy + Math.sin(ang) * rx * 0.75)
  }
}

/** Under the player: Lapras's wake while it floats, and Corviknight's plates behind it. */
export const drawGaKitAPlayerGround = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const k = p.kitA
  if (k?.kind === 'plates') return drawPlates(ctx, p, k.plates, k.regrow, t, false)
  if (k?.kind !== 'ferry' || !k.afloat) return
  const wob = Math.floor(t * 4) % 2
  dashedRing(ctx, p.x, p.y + 1, 16 + wob, Math.floor(t * 6), ['#d8f0f8', '#ffffff'], 0.5, 0.4)
}

/** Over the player: meters, pips, the cables, hair, plates, cannons and scales, and the Shedinja. */
export const drawGaKitAPlayer = (ctx: Ctx, g: Game, t: number) => {
  const p = g.player
  const k = p.kitA
  if (!k) return
  const y = Math.round(p.y + 9)
  const meter = gaKitAMeter(k, p.stage)
  if (meter) drawMeter(ctx, p.x, y, meter.fill, meter.color, meter.on)
  switch (k.kind) {
    case 'soul':
      if (k.left > 0) drawSoul(ctx, g, t)
      return
    case 'mischief':
      if (k.left > 0) drawHairArms(ctx, g, p, t)
      else if (k.meter > 0 && k.lockout <= 0) drawStrands(ctx, p, k.meter / GA_KIT.mischief.need, t)
      return
    case 'dance': return drawPips(ctx, p.x, y, k.stacks, atStage(GA_KIT.dance.cap, p.stage), '#9878f0')
    case 'hunt': return k.stacks > 0 ? drawPips(ctx, p.x, y, k.stacks, atStage(GA_KIT.hunt.cap, p.stage), '#a8c8f0') : undefined
    case 'hoard':
      drawMeter(ctx, p.x, y, k.gems / (p.mega.active > 0 && p.mega.stone === 'sableye' ? GA_KIT.hoard.megaNeed : GA_KIT.hoard.need), '#f85878', false)
      // Mega Sableye's gem turns in front of it, catching shots.
      if (p.mega.active > 0 && p.mega.stone === 'sableye') blitCentered(ctx, GA_KIT_A_FX.gem[0]!(), p.x + Math.round(Math.cos(t * 3) * 12), p.y - 14)
      return
    case 'spirits': return k.wisps > 0 ? drawPips(ctx, p.x, y, k.wisps, 9, '#a8f0c8') : undefined
    case 'sacs': return drawPips(ctx, p.x, y, k.sacs, GA_KIT.sacs.need, '#c060e0')
    case 'plates':
      drawPlates(ctx, p, k.plates, k.regrow, t, true)
      return drawPips(ctx, p.x, y, k.plates, atStage(GA_KIT.plates.cap, p.stage), '#c8d0e0')
    case 'fur':
      if (k.charge >= 1 && !detail.lean && Math.floor(t * 8) % 2 === 0) blitCentered(ctx, GA_KIT_A_FX.spark(), p.x + ((Math.floor(t * 8) % 3) - 1) * 8, p.y - 18)
      return
    case 'cables': {
      // The cables are Electivire's tails: they leave from its back.
      const run = 1 - Math.max(0, k.tick) / GA_KIT.cables.every
      k.links.forEach((id, i) => {
        const e = g.enemies.find((f) => f.id === id && f.dying < 0)
        if (e) cable(ctx, p.x - p.facing.x * 5 + (i === 0 ? -3 : 3), p.y - 12, e.x, e.y - Math.round(e.radius * 0.8), run)
      })
      return
    }
    case 'heat':
      return drawCannons(ctx, g, k.heat, k.vent, t)
    case 'shell': {
      if (!k.shed || !shellOut(p.stage, p.branch)) return
      // The shell left behind, Shedinja, hovers a step behind and claws what comes near.
      const s = sprites(292, p.shiny)
      const dir = dir8(p.x - k.shed.x, p.y - 14 - k.shed.y)
      ctx.globalAlpha = 0.95
      drawPokemon(ctx, s, 'Idle', dir, p.animTime, Math.round(k.shed.x), Math.round(k.shed.y + 14 + Math.sin(t * 3) * 1.5), {})
      ctx.globalAlpha = 1
      return
    }
    default:
  }
}
