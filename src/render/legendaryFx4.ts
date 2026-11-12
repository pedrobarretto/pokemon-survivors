import { blitEllipse, blitRing, context2d, createCanvas, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { DRAGON_ENERGY, type LegendaryMove4Id } from '../game/legendaryMoves4'
import type { Attack, Game } from '../game/types'
import { medallion } from './legendaryArt'
import { fadeOut, px, thickLine } from './legendaryFx'

type Ctx = CanvasRenderingContext2D

/**
 * The fourth batch of legendary moves on screen (`game/legendaryMoves4.ts`)
 * and their icons: Regieleki's cage of lightning and the sparks it leaves,
 * Regidrago's beam out of its dragon jaws, Tornadus's icy gusts, Thundurus's
 * storm cloud and its bolts, Landorus's spiral of searing sand and Enamorus's
 * whirl of petals and hearts.
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

const YELLOW = '#f8e048'
const PALE = '#fff8b8'
const DEEP = '#a87818'

export const LEGENDARY_ICONS_4: Record<LegendaryMove4Id, () => PixelSprite> = {
  // Four bars of lightning under a crackling top: a cage.
  thunderCage: () =>
    medallion(paint(11, 11, (dot) => {
      dot(1, 1, DEEP, 9, 1)
      dot(1, 0, YELLOW, 9, 1)
      dot(1, 10, DEEP, 9, 1)
      for (const x of [1, 4, 6, 9]) {
        for (let y = 1; y < 10; y++) dot(x + ((y >> 1) % 2), y, y % 3 === 0 ? '#ffffff' : YELLOW)
      }
      dot(5, 5, '#ffffff')
    }), '#1c2038'),
  // A dragon's open jaws with a green beam out of them.
  dragonEnergy: () =>
    medallion(paint(11, 11, (dot) => {
      dot(0, 2, '#2f7a3c', 5, 2)
      dot(0, 7, '#2f7a3c', 5, 2)
      dot(1, 3, '#ffffff')
      dot(3, 3, '#ffffff')
      dot(1, 7, '#ffffff')
      dot(3, 7, '#ffffff')
      dot(0, 1, '#58c058', 4, 1)
      dot(4, 4, '#b8f8a8', 7, 3)
      dot(4, 5, '#ffffff', 7, 1)
      dot(0, 4, '#c83030', 2, 3)
    }), '#0c2414'),
  // Three icy gusts curling to the right, snow between them.
  bleakwindStorm: () =>
    medallion(paint(11, 11, (dot) => {
      for (const [y, w] of [[2, 8], [5, 10], [8, 7]] as const) {
        dot(0, y, '#a8e0f0', w - 2, 1)
        dot(w - 2, y - 1, '#e8fcff', 2, 1)
        dot(w - 1, y - 2, '#ffffff')
      }
      dot(3, 1, '#ffffff')
      dot(8, 6, '#ffffff')
      dot(2, 9, '#ffffff')
    }), '#183040'),
  // A dark storm cloud with a bolt out of its belly.
  nastyPlot: () =>
    medallion(paint(11, 11, (dot) => {
      dot(1, 2, '#58607a', 9, 3)
      dot(3, 1, '#7a84a0', 5, 1)
      dot(2, 2, '#9aa4c0', 3, 1)
      dot(1, 4, '#383c50', 9, 1)
      for (const [x, y] of [[6, 5], [5, 6], [4, 7], [5, 7], [6, 7], [5, 8], [4, 9]] as const) dot(x, y, YELLOW)
      dot(5, 6, '#ffffff')
    }), '#141828'),
  // A spiral of searing sand, white-hot at its eye.
  sandsearStorm: () =>
    medallion(paint(11, 11, (dot) => {
      for (let i = 0; i < 26; i++) {
        const a = i * 0.48
        const r = i * 0.19
        dot(Math.round(5 + Math.cos(a) * r), Math.round(5 + Math.sin(a) * r), i < 6 ? '#ffffff' : i < 14 ? '#f8b040' : '#c86028')
      }
    }), '#2c1408'),
  // A pink heart with a petal and a sparkle.
  springtideStorm: () =>
    medallion(paint(11, 11, (dot) => {
      dot(2, 3, '#f088b8', 3, 3)
      dot(6, 3, '#f088b8', 3, 3)
      dot(2, 5, '#f088b8', 7, 2)
      dot(3, 7, '#f088b8', 5, 1)
      dot(4, 8, '#f088b8', 3, 1)
      dot(5, 9, '#c85890')
      dot(3, 4, '#ffd8ec')
      dot(8, 1, '#ffffff')
      dot(0, 8, '#f8e0a0', 2, 1)
    }), '#2c1424'),
}

/* ---------------- On screen ---------------- */

/** A jagged bolt from (x0, y0) to (x1, y1) in `steps` kinks, `jag` px off the line, reseeded `rate` times a second. */
const bolt = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, steps: number, jag: number, seed: number, t: number, rate: number, w: number, color: string) => {
  const flick = Math.floor(t * rate)
  let px0 = x0
  let py0 = y0
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy) || 1
  const nx = -dy / len
  const ny = dx / len
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const off = i === steps ? 0 : (hash2(seed, i, flick) - 0.5) * 2 * jag
    const qx = x0 + dx * k + nx * off
    const qy = y0 + dy * k + ny * off
    thickLine(ctx, px0, py0, qx, qy, w, color)
    px0 = qx
    py0 = qy
  }
}

/**
 * Thunder Cage: bars of lightning standing round the crowd (the ring seen
 * from above, squashed), snapping in from wider as it shuts, crackling
 * between a glowing floor ring and a top ring; it fades as it opens.
 */
const drawCageBars = (ctx: Ctx, a: Attack, t: number) => {
  const shut = Math.min(1, a.age / 0.14)
  const r = a.memo * (1.35 - 0.35 * shut)
  const fade = fadeOut(a, 0.25)
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  const tall = 22
  ctx.globalAlpha = fade
  // The top ring, a dotted crackle.
  for (let i = 0; i < 40; i++) {
    const q = (i / 40) * TAU + t * 0.6
    if ((i + Math.floor(t * 18)) % 4 === 0) continue
    px(ctx, x + Math.cos(q) * r, y - tall + Math.sin(q) * r * 0.42, i % 3 === 0 ? '#ffffff' : YELLOW)
  }
  // The bars, the back ones dimmer than the front ones.
  for (let i = 0; i < a.tier; i++) {
    const q = (i / a.tier) * TAU + 0.2
    const bx = x + Math.cos(q) * r
    const by = y + Math.sin(q) * r * 0.42
    const front = Math.sin(q) > 0
    ctx.globalAlpha = fade * (front ? 1 : 0.6)
    bolt(ctx, bx, by, bx, by - tall + Math.sin(q) * r * 0.0, 4, 2, a.id * 31 + i, t, 14, 3, '#3858c8')
    bolt(ctx, bx, by, bx, by - tall, 4, 2, a.id * 31 + i, t, 14, 1, (Math.floor(t * 20) + i) % 3 === 0 ? '#ffffff' : PALE)
  }
  // An arc jumping between two bars now and then.
  if (Math.floor(t * 9 + a.id) % 3 === 0) {
    const i = Math.floor(hash2(a.id, Math.floor(t * 9), 3) * a.tier)
    const q0 = (i / a.tier) * TAU + 0.2
    const q1 = ((i + 1) / a.tier) * TAU + 0.2
    ctx.globalAlpha = fade
    bolt(ctx, x + Math.cos(q0) * r, y - tall / 2 + Math.sin(q0) * r * 0.42, x + Math.cos(q1) * r, y - tall / 2 + Math.sin(q1) * r * 0.42, 3, 3, a.id, t, 20, 1, '#ffffff')
  }
  ctx.globalAlpha = 1
}

/** The cage's floor: a glowing ring where its bars stand. */
const drawCageFloor = (ctx: Ctx, a: Attack, t: number) => {
  const shut = Math.min(1, a.age / 0.14)
  const r = Math.round(a.memo * (1.35 - 0.35 * shut))
  ctx.globalAlpha = fadeOut(a, 0.25) * (0.55 + (Math.floor(t * 12) % 2) * 0.15)
  blitEllipse(ctx, r, Math.max(2, Math.round(r * 0.42)), 'rgba(248,224,72,0.22)', Math.round(a.x), Math.round(a.y))
  ctx.globalAlpha = fadeOut(a, 0.25)
  for (let i = 0; i < 32; i++) {
    const q = (i / 32) * TAU
    px(ctx, a.x + Math.cos(q) * r, a.y + Math.sin(q) * r * 0.42, i % 2 === 0 ? YELLOW : DEEP)
  }
  ctx.globalAlpha = 1
}

/** Electro Drift's sparks on the ground: a scorch with little arcs jumping off it, fading. */
const drawCageSpark = (ctx: Ctx, a: Attack, t: number) => {
  const k = fadeOut(a, 0.4)
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  ctx.globalAlpha = k * 0.6
  blitEllipse(ctx, 4, 2, '#3a3020', x, y)
  ctx.globalAlpha = k
  for (let i = 0; i < 2; i++) {
    const q = hash2(a.id, i, Math.floor(t * 12)) * TAU
    const r = 3 + hash2(a.id, i + 4, Math.floor(t * 12)) * 4
    bolt(ctx, x, y - 1, x + Math.cos(q) * r, y - 1 + Math.sin(q) * r * 0.6 - 2, 2, 1.5, a.id + i, t, 12, 1, i === 0 ? '#ffffff' : YELLOW)
  }
  ctx.globalAlpha = 1
}

const GREEN = ['#1c5a2c', '#38a048', '#88e078', '#d8fcc8'] as const

/**
 * Dragon Energy: while it gathers, a dotted aim line and motes of green light
 * drawn into the jaws; then a thick beam of draconic energy, scales of light
 * running down it, a white core, fading as it burns out.
 */
const drawDragonBeam = (ctx: Ctx, a: Attack, t: number) => {
  const dx = Math.cos(a.memo)
  const dy = Math.sin(a.memo)
  const len = a.tier
  const x0 = a.x + dx * 12
  const y0 = a.y + dy * 12
  const x1 = a.x + dx * len
  const y1 = a.y + dy * len
  if (a.age < DRAGON_ENERGY.windup) {
    const k = a.age / DRAGON_ENERGY.windup
    const n = Math.round(len / 6)
    for (let i = 0; i <= n; i++) if ((i + Math.floor(t * 24)) % 3 === 0) px(ctx, x0 + (x1 - x0) * (i / n), y0 + (y1 - y0) * (i / n), k > 0.6 ? GREEN[3] : GREEN[2])
    for (let i = 0; i < 10; i++) {
      const q = hash2(a.id, i, 1) * TAU
      const r = (1 - ((k + hash2(a.id, i, 2)) % 1)) * 22
      px(ctx, x0 + Math.cos(q) * r, y0 + Math.sin(q) * r, i % 2 === 0 ? GREEN[3] : GREEN[2])
    }
    blitEllipse(ctx, Math.round(2 + k * 4), Math.round(2 + k * 4), GREEN[2], Math.round(x0), Math.round(y0))
    return
  }
  const since = a.age - DRAGON_ENERGY.windup
  const open = Math.max(0, 1 - since / (DRAGON_ENERGY.burn + 0.15))
  const w = Math.max(2, Math.round(14 * Math.min(1, since / 0.05 + 0.3) * (0.4 + open * 0.6)))
  const wobble = Math.floor(t * 30) % 2
  thickLine(ctx, x0, y0, x1, y1, w + 4 + wobble, GREEN[0])
  thickLine(ctx, x0, y0, x1, y1, w + 1, GREEN[1])
  thickLine(ctx, x0, y0, x1, y1, Math.max(1, w - 3), GREEN[2])
  thickLine(ctx, x0, y0, x1, y1, Math.max(1, w - 8), GREEN[3])
  // Scales of light running down the beam.
  for (let i = 0; i < 8; i++) {
    const d = (since * 420 + i * (len / 8)) % len
    const sx = a.x + dx * d
    const sy = a.y + dy * d
    px(ctx, sx - dy * (w / 2 - 1), sy + dx * (w / 2 - 1), '#ffffff', 2, 1)
    px(ctx, sx + dy * (w / 2 - 1), sy - dx * (w / 2 - 1), GREEN[3], 2, 1)
  }
  // The roar at the jaws and the splash at the end.
  blitEllipse(ctx, Math.round(w * 0.7 + 2), Math.round(w * 0.7 + 2), GREEN[2], Math.round(x0), Math.round(y0))
  blitEllipse(ctx, Math.round(w * 0.45), Math.round(w * 0.45), '#ffffff', Math.round(x0), Math.round(y0))
  blitRing(ctx, Math.round(w * 0.6 + since * 40), 1, GREEN[3], Math.round(x1), Math.round(y1))
}

/** Dragon's Maw: a pair of jaws snapping shut where the beam ends, teeth and all, then a green flash. */
const drawDragonMaw = (ctx: Ctx, a: Attack) => {
  const shut = Math.min(1, a.age / 0.12)
  const open = (1 - shut) * 0.9 + 0.05
  const r = a.shape.kind === 'circle' ? a.shape.r : 20
  const x = a.x
  const y = a.y
  const face = a.memo
  ctx.globalAlpha = fadeOut(a, 0.15)
  for (const side of [-1, 1] as const) {
    const base = face + Math.PI + side * open
    for (let i = 0; i <= 12; i++) {
      const q = base + side * (i / 12) * (Math.PI - open * 1.2) * -1
      const jx = x + Math.cos(q) * r
      const jy = y + Math.sin(q) * r * 0.75
      px(ctx, jx - 1, jy - 1, GREEN[0], 3, 3)
      px(ctx, jx, jy, GREEN[2], 2, 2)
      if (i % 3 === 1) px(ctx, x + Math.cos(q) * (r - 4), y + Math.sin(q) * (r - 4) * 0.75, '#ffffff', 2, 2)
    }
  }
  if (shut >= 1 && a.age < 0.2) blitRing(ctx, Math.round(r * 0.6 + a.age * 60), 2, GREEN[3], Math.round(x), Math.round(y))
  ctx.globalAlpha = 1
}

/** Bleakwind Storm: a thick icy crescent of wind facing its way, outlined in deep teal, a flurry of snow trailing it. */
const drawBleakGust = (ctx: Ctx, a: Attack, t: number) => {
  const dx = Math.cos(a.memo)
  const dy = Math.sin(a.memo)
  const r = (a.shape.kind === 'circle' ? a.shape.r : 9) + 3
  const fade = fadeOut(a, 0.25)
  ctx.globalAlpha = fade
  const arc = (bend: number, color: string, w: number) => {
    for (let i = -6; i <= 6; i++) {
      const k = i / 6
      const curve = (1 - k * k) * r * 0.7 + bend
      px(ctx, a.x + dx * curve - dy * k * r - 1, a.y + dy * curve + dx * k * r - 1, color, w, w)
    }
  }
  arc(-1, '#2c6a88', 3)
  arc(0, '#a8e0f0', 2)
  arc(1, '#ffffff', 1)
  // The curl at its tip, and a second, thinner gust riding behind it.
  const tip = (Math.floor(t * 10) + a.tier) % 2
  px(ctx, a.x + dx * (r * 0.7 + 3) - dy * tip, a.y + dy * (r * 0.7 + 3) + dx * tip, '#ffffff', 2, 2)
  for (let i = -3; i <= 3; i++) {
    const k = i / 3
    const curve = (1 - k * k) * r * 0.4 - 7
    px(ctx, a.x + dx * curve - dy * k * r * 0.6, a.y + dy * curve + dx * k * r * 0.6, '#d8f8ff')
  }
  for (let i = 1; i <= 5; i++) {
    const sx = a.x - dx * i * 5 + (hash2(a.id, i, 1) - 0.5) * r * 1.4
    const sy = a.y - dy * i * 5 + (hash2(a.id, i, 2) - 0.5) * r * 1.4
    ctx.globalAlpha = fade * (1 - i * 0.16)
    px(ctx, sx, sy, i % 2 === 0 ? '#ffffff' : '#c8f0ff', i === 1 ? 2 : 1, i === 1 ? 2 : 1)
  }
  ctx.globalAlpha = 1
}

/** Nasty Plot's storm cloud: a dark rolling cloud over the crowd, lightning flickering in its belly, rain falling under it in the rain. */
const drawPlotCloud = (ctx: Ctx, a: Attack, t: number) => {
  const grow = Math.min(1, a.age / 0.3)
  const fade = fadeOut(a, 0.35)
  const w = Math.round(a.shape.kind === 'circle' ? a.shape.r : 40)
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  ctx.globalAlpha = fade * 0.95
  if (a.flip) {
    for (let i = 0; i < 14; i++) {
      const rx = x + (hash2(a.id, i, 1) - 0.5) * w * 1.6
      const fall = (t * 160 + hash2(a.id, i, 2) * 50) % 50
      px(ctx, rx, y + 6 + fall, '#a8c0e8', 1, 3)
    }
  }
  const puffs = [[-0.6, 2, 0.45], [0.55, 2, 0.45], [-0.25, -2, 0.55], [0.25, -1, 0.55], [0, 3, 0.6]] as const
  for (const [ox, oy, s] of puffs) blitEllipse(ctx, Math.round(w * s * grow), Math.round(w * s * 0.45 * grow), '#30344a', x + Math.round(ox * w), y + oy + 1)
  for (const [ox, oy, s] of puffs) blitEllipse(ctx, Math.max(1, Math.round(w * s * grow) - 2), Math.max(1, Math.round(w * s * 0.45 * grow) - 2), '#555c78', x + Math.round(ox * w), y + oy - 1)
  blitEllipse(ctx, Math.round(w * 0.3 * grow), Math.max(1, Math.round(w * 0.1 * grow)), '#8890b0', x - Math.round(w * 0.2), y - 6)
  // Lightning lighting it from inside.
  if (Math.floor(t * 8 + a.id) % 4 === 0) {
    ctx.globalAlpha = fade * 0.7
    blitEllipse(ctx, Math.round(w * 0.35), Math.round(w * 0.14), '#f8f0a0', x + Math.round((hash2(a.id, Math.floor(t * 8), 3) - 0.5) * w), y + 2)
  }
  ctx.globalAlpha = 1
}

/** A bolt out of Nasty Plot's cloud: a jagged white and yellow line down to the strike, a flash and a ring of sparks where it lands. */
const drawPlotBolt = (ctx: Ctx, a: Attack, t: number) => {
  const k = fadeOut(a, 0.18)
  const r = a.shape.kind === 'circle' ? a.shape.r : 12
  ctx.globalAlpha = k
  bolt(ctx, a.x + (hash2(a.id, 1, 1) - 0.5) * 10, a.y - 52, a.x, a.y, 6, 5, a.id, t, 30, 4, '#3858c8')
  bolt(ctx, a.x + (hash2(a.id, 1, 1) - 0.5) * 10, a.y - 52, a.x, a.y, 6, 5, a.id, t, 30, 2, YELLOW)
  bolt(ctx, a.x + (hash2(a.id, 1, 1) - 0.5) * 10, a.y - 52, a.x, a.y, 6, 5, a.id, t, 30, 1, '#ffffff')
  if (a.age < 0.1) blitEllipse(ctx, Math.round(r * 0.8), Math.round(r * 0.45), PALE, Math.round(a.x), Math.round(a.y))
  blitRing(ctx, Math.round(r * 0.5 + a.age * 70), 1, YELLOW, Math.round(a.x), Math.round(a.y))
  ctx.globalAlpha = 1
}

const SAND = [['#ffffff', '#f8c860', '#c86028'], ['#f8e0a0', '#f0a040', '#a84818'], ['#fff0c8', '#f8b048', '#d07030']] as const

/** Sandsear Storm: a clot of searing sand, white-hot in the middle, embers flaking off behind it. */
const drawSearSand = (ctx: Ctx, a: Attack, t: number) => {
  const [core, mid, rim] = SAND[a.tier % 3]!
  const r = Math.round(a.shape.kind === 'circle' ? a.shape.r : 7)
  const v = a.motion.kind === 'linear' ? a.motion : null
  const speed = v ? Math.hypot(v.vx, v.vy) || 1 : 1
  ctx.globalAlpha = fadeOut(a, 0.3)
  for (let i = 1; i <= 3; i++) {
    const tx = a.x - (v ? (v.vx / speed) * i * 4 : 0)
    const ty = a.y - (v ? (v.vy / speed) * i * 4 : 0)
    px(ctx, tx + (hash2(a.id, i, Math.floor(t * 10)) - 0.5) * 4, ty, i === 1 ? mid : rim)
  }
  const pulse = Math.floor(t * 12 + a.id) % 2
  blitEllipse(ctx, r - 1 + pulse, r - 2 + pulse, rim, Math.round(a.x), Math.round(a.y))
  blitEllipse(ctx, Math.max(1, r - 3), Math.max(1, r - 4), mid, Math.round(a.x), Math.round(a.y))
  blitEllipse(ctx, Math.max(1, r - 5), Math.max(1, r - 5), core, Math.round(a.x) - 1, Math.round(a.y) - 1)
  ctx.globalAlpha = 1
}

const HEART = ['.11.11.', '1221221', '1232221', '1222221', '.12221.', '..121..', '...1...'] as const
const PETAL = ['...11.', '..1221', '.12321', '122221', '12221.', '.111..'] as const

/** One of Springtide Storm's petals or hearts, whirling round the player, a pink sparkle now and then. */
const drawSpringPetal = (ctx: Ctx, a: Attack, t: number) => {
  const rows = a.tier === 0 ? HEART : PETAL
  const x0 = Math.round(a.x) - (rows[0]!.length >> 1)
  const y0 = Math.round(a.y) - (rows.length >> 1)
  ctx.globalAlpha = fadeOut(a, 0.3)
  for (const [y, row] of rows.entries()) {
    for (let x = 0; x < row.length; x++) {
      const c = row[x]
      if (c === '1') px(ctx, x0 + x, y0 + y, a.tier === 0 ? '#902860' : '#b04880')
      else if (c === '2') px(ctx, x0 + x, y0 + y, a.tier === 0 ? '#f870b0' : '#f8a8d0')
      else if (c === '3') px(ctx, x0 + x, y0 + y, '#ffffff')
    }
  }
  // A short pink trail behind it as it whirls.
  if (a.motion.kind === 'orbit') {
    const back = a.motion.angle - Math.sign(a.motion.spin) * 0.35
    const r = a.motion.radius
    px(ctx, a.x - Math.cos(a.motion.angle) * r + Math.cos(back) * r, a.y - Math.sin(a.motion.angle) * r + Math.sin(back) * r, '#f8b8d8', 2, 1)
  }
  if ((Math.floor(t * 6) + a.id) % 5 === 0) {
    px(ctx, x0 + rows[0]!.length + 1, y0 - 1, '#ffffff')
    px(ctx, x0 + rows[0]!.length, y0, '#f8e0a0')
  }
  ctx.globalAlpha = 1
}

/** Ground layer: the cage's floor ring and Electro Drift's sparks. */
export const drawLegendary4Ground = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    if (a.visual === 'cageBars') drawCageFloor(ctx, a, t)
    else if (a.visual === 'cageSpark') drawCageSpark(ctx, a, t)
  }
}

/** Air layer (over the Pokémon). Beams span the screen: they draw even when their start is off it. */
export const drawLegendary4Air = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    if (a.visual === 'dragonBeam') {
      drawDragonBeam(ctx, a, t)
      continue
    }
    if (!visible(a.x, a.y, 70)) continue
    switch (a.visual) {
      case 'cageBars':
        drawCageBars(ctx, a, t)
        break
      case 'dragonMaw':
        drawDragonMaw(ctx, a)
        break
      case 'bleakGust':
        drawBleakGust(ctx, a, t)
        break
      case 'plotCloud':
        drawPlotCloud(ctx, a, t)
        break
      case 'plotBolt':
        drawPlotBolt(ctx, a, t)
        break
      case 'searSand':
        drawSearSand(ctx, a, t)
        break
      case 'springPetal':
        drawSpringPetal(ctx, a, t)
        break
    }
  }
}
