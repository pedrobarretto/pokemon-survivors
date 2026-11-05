import { blitCentered, blitEllipse, blitRotated, fillPlotted, plot } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { driftLinks } from '../game/verbEvolvedRules'
import { AXE, KOWTOW, SEED_FLARE, SWIPE, UPPER } from '../game/verbEvolutions'
import type { Attack, Game } from '../game/types'
import { dashedRing } from './strokes'
import { VE } from './verbEvolvedArt'
import { ownerOf } from '../game/players'
import { detail } from './quality'

/**
 * Art of the verb moves' evolutions (`game/verbEvolutions.ts`). `draw.ts`
 * calls the two passes once a frame: `drawVerbEvolvedGround` under the
 * Pokémon (burning road, sludge tide, scorch marks, Hoopa's void, the wings
 * behind the player) and `drawVerbEvolvedAir` over them (beams, orbs, fists,
 * lances, blasts). Both walk `g.attacks` themselves so they can read the
 * player. Everything snaps to whole pixels.
 */

type Ctx = CanvasRenderingContext2D

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/** Plots (`plot`) a square-brush line from (x0, y0) to (x1, y1), `w` px thick. Drawing lean, a brush 2 px or wider stamps every other step (the squares still overlap). */
const plotLine = (x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
  const half = Math.floor(w / 2)
  const stride = detail.lean && w >= 2 ? 2 : 1
  for (let i = 0; i <= n; i = i < n && i + stride > n ? n : i + stride) {
    const k = i / n
    plot(color, Math.round(x0 + (x1 - x0) * k) - half, Math.round(y0 + (y1 - y0) * k) - half, w, w)
  }
}

/** Square-brush line from (x0, y0) to (x1, y1), `w` px thick. */
const thickLine = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  plotLine(x0, y0, x1, y1, w, color)
  fillPlotted(ctx)
}

/** Impact spokes around (x, y): `count` rays from `inner` to `outer`, alternating long and short. */
const spokes = (ctx: Ctx, x: number, y: number, inner: number, outer: number, count: number, colors: readonly string[], rot = 0) => {
  for (let i = 0; i < count; i++) {
    const a = rot + (i / count) * TAU
    const len = i % 2 === 0 ? outer : inner + (outer - inner) * 0.55
    for (let d = inner; d <= len; d++) plot(colors[Math.min(colors.length - 1, Math.floor(((d - inner) / Math.max(1, len - inner)) * colors.length))]!, x + Math.cos(a) * d, y + Math.sin(a) * d)
  }
  fillPlotted(ctx)
}

/** A thick crescent: `thick` rings at radius `r` around (x, y), from angle `from` through `span`, colors from the outer edge in. */
const crescent = (ctx: Ctx, x: number, y: number, r: number, from: number, span: number, thick: number, colors: readonly string[], squash = 1) => {
  const steps = Math.max(8, Math.ceil(Math.abs(span) * r * 1.3))
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    const a = from + span * k
    const t = Math.max(1, Math.round(Math.sin(k * Math.PI) * thick))
    for (let j = 0; j < t; j++) plot(colors[Math.min(colors.length - 1, Math.floor((j / t) * colors.length))]!, x + Math.cos(a) * (r - j), y + Math.sin(a) * (r - j) * squash, 2, 2)
  }
  fillPlotted(ctx)
}

/**
 * A thick ring `thick` px deep at radius `r`, its rim wobbling with `wave`
 * (a rolling crest): colors from the outer edge in, plotted in 2×2 pixels.
 * Drawing lean, every other step in 4×4 pixels: a quarter of the rects, still closed.
 */
const band = (ctx: Ctx, x: number, y: number, r: number, thick: number, colors: readonly string[], wave: number, squash = 1) => {
  const steps = Math.max(16, Math.ceil(r * TAU * 0.55))
  const size = detail.lean ? 4 : 2
  for (let i = 0; i < steps; i += size / 2) {
    const a = (i / steps) * TAU
    const rim = r + Math.sin(a * 9 + wave) * 1.5 + Math.sin(a * 4 - wave * 0.7) * 1
    const ca = Math.cos(a)
    const sa = Math.sin(a) * squash
    for (let j = 0; j < thick; j += size) plot(colors[Math.min(colors.length - 1, Math.floor((j / thick) * colors.length))]!, x + ca * (rim - j), y + sa * (rim - j), size, size)
  }
  fillPlotted(ctx)
}

/** A flickering lightning line from a to b, its jags reseeded 20 times a second. */
const lightning = (ctx: Ctx, ax: number, ay: number, bx: number, by: number, seed: number, t: number, colors: readonly [string, string, string]) => {
  const len = Math.hypot(bx - ax, by - ay)
  const n = Math.max(2, Math.round(len / 7))
  const nx = -(by - ay) / (len || 1)
  const ny = (bx - ax) / (len || 1)
  const tick = Math.floor(t * 20)
  let x0 = ax
  let y0 = ay
  for (let i = 1; i <= n; i++) {
    const k = i / n
    const jag = i === n ? 0 : (hash2(seed, i, tick) - 0.5) * 9
    const x1 = ax + (bx - ax) * k + nx * jag
    const y1 = ay + (by - ay) * k + ny * jag
    plotLine(x0, y0, x1, y1, 3, colors[0])
    plotLine(x0, y0, x1, y1, 1, colors[1])
    x0 = x1
    y0 = y1
  }
  if (tick % 3 === 0) plot(colors[2], ax + (bx - ax) * 0.5 + nx * 4, ay + (by - ay) * 0.5 + ny * 4)
  fillPlotted(ctx)
}

/* ======================= Ground pass ======================= */

/** Raging Fury's burning road: a scorched glow with a tall flame that sinks into embers. */
const drawFuryBlaze = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const life = 1 - a.age / a.ttl
  ctx.globalAlpha = Math.min(1, life * 1.8)
  blitEllipse(ctx, Math.round(r), Math.max(1, Math.round(r * 0.45)), 'rgba(232,88,24,0.18)', a.x, a.y)
  blitEllipse(ctx, Math.round(r * 0.55), Math.max(1, Math.round(r * 0.25)), 'rgba(248,168,40,0.32)', a.x, a.y)
  const frames = VE.furyFlame()
  const sprite = frames[Math.floor((t * 12 + a.id) % 2)]!
  const sink = Math.round((1 - life) * (1 - life) * 10)
  ctx.save()
  ctx.beginPath()
  ctx.rect(Math.round(a.x - 6), Math.round(a.y - 16), 12, 16 - sink + 1)
  ctx.clip()
  blitCentered(ctx, sprite, a.x + (a.flip ? 1 : 0), a.y - 5 + sink)
  ctx.restore()
  if (life > 0.4 && (Math.floor(t * 8) + a.id) % 4 === 0) px(ctx, a.x + (hash2(a.id, Math.floor(t * 8)) - 0.5) * 8, a.y - 14 - (t * 30 + a.id) % 8, '#fff4b0')
  ctx.globalAlpha = 1
}

/** Raging Fury's cloak, the floor half: a hot glow around the feet while walking. */
const drawFuryGlow = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = ownerOf(g, a.owner)
  const r = radiusOf(a)
  if (!p.moving) {
    blitEllipse(ctx, Math.round(r * 0.7), Math.max(1, Math.round(r * 0.3)), 'rgba(168,32,16,0.25)', p.x, p.y)
    return
  }
  const pulse = Math.floor(t * 10) % 2
  blitEllipse(ctx, Math.round(r + 2 + pulse), Math.max(1, Math.round((r + 2) * 0.45)), 'rgba(232,72,24,0.28)', p.x, p.y)
  blitEllipse(ctx, Math.round(r * 0.6), Math.max(1, Math.round(r * 0.28)), 'rgba(248,200,80,0.35)', p.x, p.y)
  // The blaze wrapping the body, behind the sprite.
  blitEllipse(ctx, 12 + pulse, 15 + pulse, 'rgba(232,72,24,0.35)', p.x, p.y - 12)
  blitEllipse(ctx, 8, 11, 'rgba(248,160,40,0.4)', p.x, p.y - 13 - pulse)
  cloakFlames(ctx, g, a, t, false)
}

/** The ring of tall flames round the feet: the back half (`front` false) goes under the player, the front half over. */
const cloakFlames = (ctx: Ctx, g: Game, a: Attack, t: number, front: boolean) => {
  const p = ownerOf(g, a.owner)
  const r = radiusOf(a)
  const spin = p.walked * 0.09 + t * 2.5
  const frames = VE.furyFlame()
  const n = 9
  for (let i = 0; i < n; i++) {
    const ang = spin + (i / n) * TAU
    if (Math.sin(ang) >= 0 !== front) continue
    const x = p.x + Math.cos(ang) * r
    const y = p.y - 2 + Math.sin(ang) * r * 0.42
    const s = frames[(i + Math.floor(t * 14)) % 2]!
    const bob = Math.round(Math.sin(t * 22 + i * 1.9) * 2)
    blitCentered(ctx, s, x, y - s.height / 2 + 2 + bob)
  }
}

/** Raging Fury's nova: a scorched ring left behind. */
const drawFuryScorch = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.3) * 0.7
  dashedRing(ctx, a.x, a.y + 4, r * 0.95, a.id, ['#401008', '#a01808', '#602010'], 0.8, 0.5)
  ctx.globalAlpha = 1
}

/** Sludge Wave: a thick rolling crest of sludge with bubbles riding it. */
const drawSludgeWave = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = Math.min(1, a.age / (a.ttl - 0.3))
  ctx.globalAlpha = fadeOut(a, 0.3)
  // The trail of slime it leaves just inside the crest, then the crest itself rolling out.
  ctx.globalAlpha *= 0.5
  band(ctx, a.x, a.y, r - 6, 8, ['#9038a0', '#702880', '#581868'], -t * 6 + a.id)
  ctx.globalAlpha = fadeOut(a, 0.3) * Math.min(1, (1 - k) * 3 + 0.35)
  band(ctx, a.x, a.y, r + 1, 7, ['#381040', '#d080e0', '#b050c0', '#9038a0', '#702880'], t * 8 + a.id)
  const n = Math.max(8, Math.round(r / 5))
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + a.id * 0.7 + Math.sin(t * 2 + i) * 0.05
    const bob = Math.round(Math.sin(t * 9 + i * 2) * 1.5)
    const x = a.x + Math.cos(ang) * (r + 1)
    const y = a.y + Math.sin(ang) * (r + 1) - 1 + bob
    const big = (i + a.id) % 3 === 0
    plot('#381040', x - 1, y - 1, big ? 4 : 3, big ? 4 : 3)
    plot(big ? '#d080e0' : '#9038a0', x, y, big ? 2 : 1, big ? 2 : 1)
    if (big) plot('#ffffff', x, y)
  }
  fillPlotted(ctx)
  ctx.globalAlpha = 1
}

/** The shadow of a falling drop or arrow, closing in on its landing spot, and the splash ring after. */
const drawLandingShadow = (ctx: Ctx, a: Attack, ring: readonly string[]) => {
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    blitEllipse(ctx, Math.max(1, Math.round(2 + k * 5)), Math.max(1, Math.round(1 + k * 2)), 'rgba(16,24,48,0.32)', a.x, a.y + 5)
    return
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  const r = radiusOf(a)
  ctx.globalAlpha = Math.max(0, 1 - e)
  dashedRing(ctx, a.x, a.y + 5, r * (0.6 + 0.6 * e), a.id, ring, 0.65, 0.4)
  ctx.globalAlpha = 1
}

/** Hyperspace Hole's void on the floor: a dark well with motes falling into it. */
const drawHoleVoid = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const open = Math.min(1, a.age / 0.15) * fadeOut(a, 0.12)
  ctx.globalAlpha = open
  blitEllipse(ctx, Math.round(r * 1.05), Math.max(1, Math.round(r * 0.55)), 'rgba(48,16,64,0.45)', a.x, a.y + 4)
  blitEllipse(ctx, Math.round(r * 0.6), Math.max(1, Math.round(r * 0.32)), 'rgba(16,4,24,0.6)', a.x, a.y + 4)
  for (let i = 0; i < 14; i++) {
    const ph = (t * 1.6 + hash2(a.id, i)) % 1
    const ang = hash2(a.id, i, 2) * TAU + ph * 3
    const d = (1 - ph) * r * 1.6
    px(ctx, a.x + Math.cos(ang) * d, a.y + 4 + Math.sin(ang) * d * 0.55, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#f85888' : '#f8c830')
  }
  ctx.globalAlpha = 1
}

/** Oblivion Wing's wings, behind the player: they sweep open from the shoulders, beat once, and fold away. */
const drawWings = (ctx: Ctx, g: Game, a: Attack) => {
  const p = ownerOf(g, a.owner)
  const open = Math.min(1, a.age / 0.1)
  const k = open * (0.35 + 0.65 * fadeOut(a, 0.25))
  const [left, right] = VE.wings()
  const scale = a.flip ? 3 : 2
  const beat = Math.round(Math.sin(a.age * 18) * 2)
  const y = p.y - 26 - beat
  ctx.globalAlpha = fadeOut(a, 0.15)
  blitEllipse(ctx, Math.round(10 + 14 * k), Math.round(7 + 4 * k), 'rgba(112,20,40,0.25)', p.x, y + 6)
  for (const [s, side] of [[left!, -1], [right!, 1]] as const) {
    const w = Math.max(1, Math.round(s.width * k))
    // Revealed from the root (at the shoulder) outward.
    const sx = side < 0 ? s.width - w : 0
    const dx = side < 0 ? p.x - 2 - w * scale : p.x + 2
    ctx.drawImage(s, sx, 0, w, s.height, Math.round(dx), Math.round(y - (s.height * scale) / 2), w * scale, s.height * scale)
  }
  ctx.globalAlpha = 1
}

/** Sky Uppercut: the ground cracks and bulges where the fist will burst out. */
const drawUppercutGround = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = Math.min(1, a.age / UPPER.rise)
  ctx.globalAlpha = a.age < UPPER.rise ? 1 : fadeOut(a, 0.3)
  const y = a.y + r * 0.6
  blitEllipse(ctx, Math.round(r * (0.5 + 0.5 * k)), Math.max(1, Math.round(r * 0.3 * (0.5 + 0.5 * k))), 'rgba(40,24,8,0.45)', a.x, y)
  ctx.fillStyle = '#402810'
  for (let i = 0; i < 7; i++) {
    const ang = (i / 7) * TAU + a.id
    for (let d = 2; d < r * k; d += 1.5) ctx.fillRect(Math.round(a.x + Math.cos(ang) * d + Math.sin(d + i) * 1.2), Math.round(y + Math.sin(ang) * d * 0.45), 1, 1)
  }
  ctx.globalAlpha = 1
}

/** A shock ring flat on the floor. */
const drawFloorShock = (ctx: Ctx, a: Attack, colors: readonly string[]) => {
  ctx.globalAlpha = fadeOut(a, 0.2)
  dashedRing(ctx, a.x, a.y, radiusOf(a), a.age * 20, colors, 0.8, 0.5)
  dashedRing(ctx, a.x, a.y, radiusOf(a) * 0.8, -a.age * 16, colors.slice(1), 0.5, 0.5)
  ctx.globalAlpha = 1
}

/** Glacial Lance's frost streak along its flight. */
const drawFrostStreak = (ctx: Ctx, a: Attack) => {
  const dx = a.x - a.from.x
  const dy = a.y - a.from.y
  const len = Math.hypot(dx, dy)
  if (len < 2) return
  ctx.globalAlpha = 0.55 * fadeOut(a, 0.4)
  for (let d = 0; d < len; d += 2) {
    const k = d / len
    const x = a.from.x + dx * k
    const y = a.from.y + dy * k + 10
    if (hash2(a.id, Math.floor(d)) < 0.55) px(ctx, x, y + (hash2(a.id, Math.floor(d), 1) - 0.5) * 6, k > 0.8 ? '#ffffff' : '#c8e8ff')
  }
  ctx.globalAlpha = 1
}

/** Water Spout's geyser on the player: a column bursting up, foaming at the top. */
const drawSpout = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = ownerOf(g, a.owner)
  const k = a.age / a.ttl
  const h = Math.round(64 * Math.sin(Math.min(1, k * 1.5) * Math.PI))
  if (h <= 0) return
  ctx.globalAlpha = Math.min(1, (1 - k) * 3)
  const wob = Math.round(Math.sin(t * 30) * 1)
  px(ctx, p.x - 8 + wob, p.y - 4 - h, '#183878', 17, h)
  px(ctx, p.x - 7 + wob, p.y - 4 - h, '#3868c8', 15, h)
  px(ctx, p.x - 4 + wob, p.y - 4 - h, '#88b8f0', 8, h)
  px(ctx, p.x - 1 + wob, p.y - 4 - h, '#ffffff', 3, h)
  for (let y = p.y - 4 - h + ((t * 120) % 8); y < p.y - 4; y += 8) px(ctx, p.x - 6 + wob, y, '#d8f0ff', 2, 3)
  blitEllipse(ctx, 12, 6, '#ffffff', p.x + wob, p.y - 4 - h)
  blitEllipse(ctx, 9, 4, '#d8f0ff', p.x + wob, p.y - 3 - h)
  blitEllipse(ctx, 10, 3, 'rgba(136,184,240,0.6)', p.x, p.y - 2)
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + (hash2(a.id, i) - 0.5) * 2.2
    const d = (t * 60 + hash2(a.id, i, 1) * 20) % 22
    px(ctx, p.x + Math.cos(ang) * d, p.y - 4 - h + Math.sin(ang) * d + d * d * 0.04, i % 2 ? '#ffffff' : '#88b8f0', 2, 2)
  }
  ctx.globalAlpha = 1
}

/** Ground layer (under the Pokémon). */
export const drawVerbEvolvedGround = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'furyBlaze':
        drawFuryBlaze(ctx, a, t)
        break
      case 'ragingFury':
        drawFuryGlow(ctx, g, a, t)
        break
      case 'furyNova':
        drawFuryScorch(ctx, a)
        break
      case 'sludgeWave':
        drawSludgeWave(ctx, a, t)
        break
      case 'spoutDrop':
        drawLandingShadow(ctx, a, ['#ffffff', '#88b8f0'])
        break
      case 'waterSpout':
        // Behind the player: the geyser bursts up from their feet.
        drawSpout(ctx, g, a, t)
        break
      case 'thousandArrows':
        drawLandingShadow(ctx, a, ['#d8c080', '#a08048'])
        break
      case 'hyperspaceHole':
        drawHoleVoid(ctx, a, t)
        break
      case 'oblivionWing':
        drawWings(ctx, g, a)
        break
      case 'skyUppercut':
        drawUppercutGround(ctx, a)
        break
      case 'uppercutShock':
        drawFloorShock(ctx, a, ['#ffffff', '#f8d030', '#c03028'])
        break
      case 'glacialLance':
        drawFrostStreak(ctx, a)
        break
      case 'gearGrind':
        blitEllipse(ctx, Math.round(radiusOf(a) * 0.8), Math.max(1, Math.round(radiusOf(a) * 0.3)), 'rgba(16,16,24,0.3)', a.x, a.y + radiusOf(a) + 2)
        break
      case 'axeSplinter':
        ctx.globalAlpha = Math.min(1, a.age / 0.2) * fadeOut(a, 0.6)
        blitEllipse(ctx, 3, 1, 'rgba(24,16,8,0.35)', a.x, a.y + 2)
        ctx.globalAlpha = 1
        break
      case 'explosion': {
        ctx.globalAlpha = fadeOut(a, 0.4) * 0.85
        const r = radiusOf(a)
        blitEllipse(ctx, Math.round(r * 0.85), Math.max(1, Math.round(r * 0.4)), 'rgba(40,24,16,0.42)', a.x, a.y + 8)
        ctx.globalAlpha = 1
        break
      }
      case 'stoneAxe':
        if (a.age >= a.activeFrom) drawFloorShock(ctx, { ...a, y: a.y + 8 }, ['#ece4d4', '#a09888', '#666058'])
        break
    }
  }
}

/* ======================= Air pass ======================= */

/** Raging Fury's cloak: tall flames whirling round the feet while walking; embers while still. */
const drawFuryCloak = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = ownerOf(g, a.owner)
  const r = radiusOf(a)
  if (!p.moving) {
    // Smouldering: a few embers round the feet.
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU + t * 0.5
      if ((Math.floor(t * 3) + i) % 3 === 0) px(ctx, p.x + Math.cos(ang) * r, p.y - 3 + Math.sin(ang) * r * 0.42, i % 2 ? '#f8a028' : '#a01808')
    }
    return
  }
  cloakFlames(ctx, g, a, t, true)
  {
    // A comet tail of fire behind the rampage.
    const vx = p.vx
    const vy = p.vy
    const sp = Math.hypot(vx, vy) || 1
    for (let i = 1; i <= 5; i++) {
      const k = i / 5
      ctx.globalAlpha = 0.55 * (1 - k)
      blitEllipse(ctx, Math.max(1, Math.round(6 * (1 - k * 0.6))), Math.max(1, Math.round(5 * (1 - k * 0.6))), i < 3 ? '#f8a028' : '#e84818', p.x - (vx / sp) * i * 5, p.y - 10 - (vy / sp) * i * 5)
    }
    ctx.globalAlpha = 1
  }
}

/** Raging Fury's nova: a wall of flame racing outward. */
const drawFuryNova = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const k = Math.min(1, a.age / (a.ttl - 0.3))
  ctx.globalAlpha = fadeOut(a, 0.3)
  dashedRing(ctx, a.x, a.y, r, t * 6, ['#fff4b0', '#f8a028', '#e84818'], 0.95, 0.55)
  dashedRing(ctx, a.x, a.y - 2, r * 0.85, -t * 5, ['#f8a028', '#e84818', '#a01808'], 0.7, 0.55)
  const frames = VE.furyFlame()
  const n = Math.max(8, Math.round(r / 4))
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + a.id
    const s = frames[(i + Math.floor(t * 12)) % 2]!
    const h = Math.max(2, Math.round(s.height * (1 - k * 0.6)))
    ctx.drawImage(s, 0, s.height - h, s.width, h, Math.round(a.x + Math.cos(ang) * r - s.width / 2), Math.round(a.y + Math.sin(ang) * r * 0.55 - h + 2), s.width, h)
  }
  ctx.globalAlpha = 1
}

/** Seed Flare's sun over the player: it swells while the light gathers, then blazes with turning rays. */
const drawSeedSun = (ctx: Ctx, a: Attack, t: number) => {
  const swell = Math.min(1, a.age / SEED_FLARE.charge)
  const sun = VE.sun()
  ctx.globalAlpha = fadeOut(a, 0.25)
  const glow = Math.round(5 + swell * 8 + Math.sin(t * 20) * 1)
  blitEllipse(ctx, glow + 3, glow + 3, 'rgba(248,216,80,0.25)', a.x, a.y)
  blitEllipse(ctx, glow, glow, 'rgba(255,248,176,0.45)', a.x, a.y)
  blitRotated(ctx, sun, a.x, a.y, t * 3, swell < 1 ? 1 : 2)
  if (swell < 1) {
    // Light motes drawn into the sun.
    for (let i = 0; i < 12; i++) {
      const ph = (swell * 1.4 + hash2(a.id, i)) % 1
      const ang = hash2(a.id, i, 3) * TAU + ph * 2
      const d = (1 - ph) * 34
      px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, i % 3 === 0 ? '#ffffff' : i % 3 === 1 ? '#f8f8a0' : '#78c850', ph > 0.7 ? 2 : 1, ph > 0.7 ? 2 : 1)
    }
  } else if (Math.floor(t * 16) % 2 === 0) spokes(ctx, a.x, a.y, 16, 24, 12, ['#ffffff', '#f8f8a0', '#f8d850'], t * 2)
  ctx.globalAlpha = 1
}

/** Seed Flare's rays, drawn layer by layer over all their slices so each ray reads as one solid beam. */
const drawSeedRays = (ctx: Ctx, g: Game, t: number) => {
  const layers = [
    { k: 1.6, color: 'rgba(248,216,80,0.45)', flick: true },
    { k: 1, color: '#f8f8b0', flick: false },
    { k: 0.45, color: '#ffffff', flick: false },
  ] as const
  for (const layer of layers) {
    for (const a of g.attacks) {
      const m = a.motion
      if (a.visual !== 'seedFlare' || a.age < 0 || m.kind !== 'orbit') continue
      const p = ownerOf(g, a.owner)
      const r = radiusOf(a)
      const k = a.age / a.ttl
      const w = r * Math.min(1, a.age / 0.06) * Math.min(1, (1 - k) / 0.25 + 0.2)
      const half = Math.max(5, ((SEED_FLARE.length * r) / SEED_FLARE.r - 12) / (SEED_FLARE.segments - 1) / 2 + 1)
      const cx = Math.cos(m.angle)
      const cy = Math.sin(m.angle)
      const flick = layer.flick ? Math.floor(t * 30 + m.radius) % 2 : 0
      thickLine(ctx, p.x + cx * (m.radius - half), p.y - 8 + cy * (m.radius - half), p.x + cx * (m.radius + half), p.y - 8 + cy * (m.radius + half), Math.max(1, Math.round(w * layer.k)) + flick, layer.color)
      if (layer.k < 1 && a.flip) {
        spokes(ctx, a.x, a.y, 2, Math.round(w * 1.4) + 5, 8, ['#ffffff', '#f8f8a0', '#78c850'], t * 6)
        blitCentered(ctx, VE.seed(), a.x, a.y)
      }
    }
  }
}

/** Seed Flare's bloom: a flower of light bursting where a ray ended. */
const drawSeedBloom = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const e = a.age / a.ttl
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  if (a.age < 0.06) blitEllipse(ctx, Math.round(r), Math.round(r * 0.8), 'rgba(255,255,220,0.8)', a.x, a.y)
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + a.id
    const d = r * (0.3 + e * 0.8)
    blitRotated(ctx, VE.seed(), a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.7, ang + Math.PI / 2)
  }
  dashedRing(ctx, a.x, a.y, r * (0.6 + e * 0.6), t * 5 + a.id, ['#ffffff', '#d8f888', '#58b838'], 0.75, 0.7)
  ctx.globalAlpha = 1
}

/** Water Spout's drop: arcing high from the spout's top, then a splash column where it lands. */
const drawSpoutDrop = (ctx: Ctx, a: Attack) => {
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    const x = a.from.x + (a.x - a.from.x) * k
    const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 70
    const vy = (a.y - a.from.y) - Math.cos(k * Math.PI) * Math.PI * 70
    const vx = a.x - a.from.x
    // The drop's tip trails behind it.
    blitRotated(ctx, VE.drop(), x, y, Math.atan2(-vx, vy))
    px(ctx, x - vx * 0.02, y - vy * 0.02, '#88b8f0', 2, 2)
    return
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  const r = radiusOf(a)
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  const h = Math.round(r * 1.7 * Math.sin(Math.min(1, e * 1.7) * Math.PI))
  if (h > 0) {
    px(ctx, a.x - 5, a.y + 5 - h, '#3868c8', 11, h)
    px(ctx, a.x - 3, a.y + 5 - h, '#88b8f0', 6, h)
    px(ctx, a.x - 1, a.y + 5 - h, '#ffffff', 2, h)
    px(ctx, a.x - 7, a.y + 5 - h, '#ffffff', 15, 1)
  }
  for (let i = 0; i < 8; i++) {
    const ang = -Math.PI / 2 + (hash2(a.id, i) - 0.5) * 2.8
    const sp = 16 + hash2(a.id, i, 1) * 24
    px(ctx, a.x + Math.cos(ang) * sp * e * 1.4, a.y + 2 + Math.sin(ang) * sp * e * 1.4 + 60 * e * e, i % 2 ? '#88b8f0' : '#ffffff', 2, 2)
  }
  ctx.globalAlpha = 1
}

/** Electro Drift's orb: neon, crackling, a ghost trail along its spiral. */
const drawDriftOrb = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const r = radiusOf(a)
  const s = VE.neon()
  const scale = Math.max(1, Math.round((r * 2) / s.width))
  if (m.kind === 'orbit') {
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.45 - i * 0.12
      const back = m.angle - Math.sign(m.spin || 1) * i * 0.16
      const cx = a.x - Math.cos(m.angle) * m.radius + Math.cos(back) * m.radius
      const cy = a.y - Math.sin(m.angle) * m.radius + Math.sin(back) * m.radius
      blitEllipse(ctx, Math.max(1, Math.round(r * (1 - i * 0.2))), Math.max(1, Math.round(r * (1 - i * 0.2))), i === 1 ? '#58e8f8' : '#8040f8', cx, cy)
    }
    ctx.globalAlpha = 1
  }
  ctx.globalAlpha = fadeOut(a, 0.2)
  blitRotated(ctx, s, a.x, a.y, Math.floor(t * 10) * (Math.PI / 2), scale)
  if (Math.floor(t * 20 + a.id) % 3 === 0) spokes(ctx, a.x, a.y, r + 1, r + 4, 6, ['#ffffff', '#58e8f8'], t * 9)
  ctx.globalAlpha = 1
}

/** Electro Drift's lightning between each cast's orbs. */
const drawDriftLinks = (ctx: Ctx, g: Game, link: Attack, t: number) => {
  const orbs = g.attacks.filter((a) => a.visual === 'electroDrift' && a.memo === link.id && a.age >= 0)
  ctx.globalAlpha = fadeOut(link, 0.2)
  for (const [i, j] of driftLinks(orbs.length)) {
    const a = orbs[i]!
    const b = orbs[j]!
    lightning(ctx, a.x, a.y, b.x, b.y, link.id * 7 + i, t, ['rgba(128,64,248,0.7)', '#c8f8ff', '#ffffff'])
  }
  ctx.globalAlpha = 1
}

/** A toxic geyser: a purple column with globs flying off. */
const drawSludgeGeyser = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const e = a.age / a.ttl
  const h = Math.round(r * 1.8 * Math.sin(Math.min(1, e * 1.6) * Math.PI))
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  if (h > 0) {
    px(ctx, a.x - 4, a.y - h, '#381040', 9, h)
    px(ctx, a.x - 3, a.y - h, '#9038a0', 7, h)
    px(ctx, a.x - 1, a.y - h, '#d080e0', 3, h)
    blitEllipse(ctx, 6, 3, '#9038a0', a.x, a.y - h)
    blitEllipse(ctx, 4, 2, '#d080e0', a.x, a.y - h - 1)
  }
  for (let i = 0; i < 6; i++) {
    const ang = -Math.PI / 2 + (hash2(a.id, i) - 0.5) * 2.6
    const sp = 14 + hash2(a.id, i, 1) * 20
    plot(i % 3 === 0 ? '#b8f060' : '#d080e0', a.x + Math.cos(ang) * sp * e * 1.3, a.y - 4 + Math.sin(ang) * sp * e * 1.3 + 50 * e * e, 2, 2)
  }
  fillPlotted(ctx)
  ctx.globalAlpha = 1
}

/**
 * A blast: a white-hot heart and a front of fireballs racing out, then the
 * fireballs turn to smoke and rise. `big` for the Explosion itself (more
 * puffs, a shock ring, a smoke column); the chain's blasts are small.
 */
const drawBlast = (ctx: Ctx, a: Attack, t: number, big: boolean) => {
  const r = radiusOf(a)
  const open = big ? 0.24 : 0.1
  const k = Math.min(1, a.age / open)
  const e = Math.max(0, (a.age - open) / (a.ttl - open))
  const front = r * (big ? 0.25 + 0.75 * (1 - (1 - k) * (1 - k)) : 0.4 + 0.6 * k)
  const n = Math.max(6, Math.round(front / (big ? 4 : 3.5)))
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  if (e < 0.5) {
    const heart = Math.max(2, Math.round(front * (big ? 0.5 : 0.6) * (1 - e * 1.6)))
    blitEllipse(ctx, heart + 3, Math.round((heart + 3) * 0.85), '#f8c030', a.x, a.y)
    blitEllipse(ctx, heart, Math.round(heart * 0.85), '#fff4b0', a.x, a.y - (Math.floor(t * 30) % 2))
    blitEllipse(ctx, Math.max(1, Math.round(heart * 0.6)), Math.max(1, Math.round(heart * 0.5)), '#ffffff', a.x, a.y)
  }
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + hash2(a.id, i) * 0.4
    const d = front * (0.72 + hash2(a.id, i, 1) * 0.28)
    const rise = e * e * (big ? 26 : 12)
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.8 - rise
    const size = Math.max(2, Math.round(front * (big ? 0.1 : 0.13) * (0.8 + hash2(a.id, i, 2) * 0.4) * (1 - e * 0.5)))
    const smoke = e > 0.25 + hash2(a.id, i, 3) * 0.3
    ctx.globalAlpha = Math.max(0, 1 - e * e) * (smoke ? 0.7 : 1)
    blitEllipse(ctx, size + 1, size + 1, smoke ? '#383030' : '#a01808', x, y)
    blitEllipse(ctx, size, size, smoke ? '#686060' : '#e85818', x, y - 1)
    blitEllipse(ctx, Math.max(1, size - 2), Math.max(1, size - 2), smoke ? '#a09890' : e < 0.1 ? '#fff4b0' : '#f8c030', x - 1, y - 2)
  }
  if (a.age <= open + 0.05) spokes(ctx, a.x, a.y, Math.round(front * 1.02), Math.round(front * (big ? 1.4 : 1.3)), big ? 16 : 10, ['#ffffff', '#fff4b0', '#f8c030', '#e85818'], a.id)
  if (big) {
    dashedRing(ctx, a.x, a.y, r * (1.05 + e * 0.5), a.id, ['#ffffff', '#fff4b0', '#d8d0c8'], 0.85 * (1 - e), 0.8)
    if (e > 0.1) {
      // The mushroom: a cloud of smoke climbing off the blast.
      const top = a.y - r * (0.15 + e * 0.5)
      ctx.globalAlpha = Math.max(0, 1 - e) * 0.85
      blitEllipse(ctx, Math.round(r * 0.2), Math.round(r * 0.13), '#484040', a.x, top)
      blitEllipse(ctx, Math.round(r * 0.16), Math.round(r * 0.1), '#888078', a.x - 1, top - 2)
      blitEllipse(ctx, Math.round(r * 0.07), Math.round(r * 0.045), '#c8c0b8', a.x - 3, top - 4)
    }
  }
  ctx.globalAlpha = 1
}

/** Oblivion Wing's beam: from the player's chest to the foe, dark red with a white heart, feathers at the hit. */
const drawOblivionBeam = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = ownerOf(g, a.owner)
  const sx = p.x
  const sy = p.y - 16
  const k = a.age / a.ttl
  if (a.age < 0.14) {
    const w = a.age < 0.04 ? 5 : 3
    thickLine(ctx, sx, sy, a.x, a.y, w + 2, 'rgba(24,8,16,0.7)')
    thickLine(ctx, sx, sy, a.x, a.y, w, '#c02838')
    thickLine(ctx, sx, sy, a.x, a.y, 1, '#ffd0d0')
  }
  ctx.globalAlpha = Math.max(0, 1 - k)
  spokes(ctx, a.x, a.y, 3 + k * 4, 8 + k * 10, 8, ['#ffffff', '#f86868', '#701428'], a.flip ? 0.4 : 0)
  for (let i = 0; i < 4; i++) {
    const ang = hash2(a.id, i) * TAU
    const d = 4 + k * 16
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d + k * 6, i % 2 ? '#c02838' : '#180810', 2, 1)
  }
  if (Math.floor(t * 20) % 2 === 0 && a.age < 0.1) blitEllipse(ctx, 4, 4, '#ffffff', a.x, a.y)
  ctx.globalAlpha = 1
}

/** Sky Uppercut: a colossal fist bursting up out of the ground through the foe, with speed lines. */
const drawUppercut = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < UPPER.rise) return
  const fist = VE.upFist()
  const e = Math.min(1, (a.age - UPPER.rise) / 0.12)
  const ground = a.y + radiusOf(a) * 0.6
  const top = ground - 44 * e
  ctx.globalAlpha = fadeOut(a, 0.2)
  ctx.save()
  ctx.beginPath()
  ctx.rect(Math.round(a.x - 20), Math.round(top - 30), 40, Math.round(ground - top + 30))
  ctx.clip()
  // The forearm below the fist, with a cuff.
  const arm = Math.max(0, ground - top - 8)
  px(ctx, a.x - 6, top + 8, '#601008', 13, arm)
  px(ctx, a.x - 5, top + 8, '#c03020', 11, arm)
  px(ctx, a.x - 2, top + 8, '#e85840', 4, arm)
  px(ctx, a.x - 7, top + 10, '#f8d030', 15, 3)
  px(ctx, a.x - 7, top + 13, '#a07010', 15, 1)
  blitEllipse(ctx, 14, 12, 'rgba(255,240,160,0.35)', a.x, top - 2)
  blitRotated(ctx, fist, a.x, top - 2, 0, 2)
  ctx.restore()
  for (let i = -2; i <= 2; i++) {
    const x = a.x + i * 7
    const len = 10 + ((i + 2) % 2) * 8
    thickLine(ctx, x, top + 14 + Math.abs(i) * 3, x, top + 14 + Math.abs(i) * 3 + len, 1, i === 0 ? '#ffffff' : '#f8d030')
  }
  if (a.age < UPPER.rise + 0.1) spokes(ctx, a.x, top - 6, 6, 16, 10, ['#ffffff', '#f8d030', '#f87040'], t * 3)
  ctx.globalAlpha = 1
}

/** Gear Grind's gear: a big wheel spinning along its way, sparks where it grinds. */
const drawGear = (ctx: Ctx, a: Attack, t: number) => {
  const frames = VE.gear()
  const r = radiusOf(a)
  const scale = Math.max(1, Math.round((r * 2.2) / 23))
  const m = a.motion
  const dir = m.kind === 'return' && (m.out > 0 ? m.vx : m.vx) < 0 ? -1 : 1
  const frame = frames[(((Math.floor(t * 30 * dir) + a.id) % frames.length) + frames.length) % frames.length]!
  ctx.globalAlpha = fadeOut(a, 0.15)
  blitRotated(ctx, frame, a.x, a.y, 0, scale)
  if (a.memo > 1.3) {
    // Grinding hard: a white-hot rim.
    dashedRing(ctx, a.x, a.y, r + 1, t * 20, ['#ffffff', '#f8d860'], 0.3)
  }
  ctx.globalAlpha = 1
}

/** Kowtow Cleave: a great dark crescent swept through the arc, a gold edge, the blade at its tip. */
const drawCleave = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const span = KOWTOW.half * 2
  const k = Math.min(1, a.age / 0.09)
  const side = a.flip ? -1 : 1
  const from = a.memo - side * KOWTOW.half
  ctx.globalAlpha = (a.age < 0.12 ? 1 : fadeOut(a, a.ttl - 0.12)) * 0.45
  crescent(ctx, a.x, a.y, r - 9, from, side * span * k, 8, ['#382838', '#281828', '#100810'], 0.8)
  ctx.globalAlpha = a.age < 0.12 ? 1 : fadeOut(a, a.ttl - 0.12)
  crescent(ctx, a.x, a.y, r, from, side * span * k, 11, ['#f8d860', '#ffffff', '#e0e0f0', '#b0b0c8', '#686078', '#382838', '#100810'], 0.8)
  crescent(ctx, a.x, a.y, r + 2, from + side * span * 0.15 * k, side * span * 0.7 * k, 2, ['#a02030', '#a02030'], 0.8)
  const tip = from + side * span * k
  if (a.age < 0.14) blitRotated(ctx, VE.blade(), a.x + Math.cos(tip) * (r - 4), a.y + Math.sin(tip) * (r - 4) * 0.8, tip + (side > 0 ? Math.PI / 4 : -Math.PI / 4 + Math.PI), 2)
  ctx.globalAlpha = 1
}

/** Hyperspace Hole's ring: Hoopa's slim golden ring opening in the air over a swirling void. */
const drawHoleRing = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const open = Math.min(1, a.age / 0.15)
  const shut = fadeOut(a, 0.15)
  const k = open * (0.4 + 0.6 * shut)
  const rx = Math.max(2, Math.round(r * k))
  const ry = Math.max(1, Math.round(rx * 0.5))
  const cy = a.y - 8
  blitEllipse(ctx, rx, ry, '#200830', a.x, cy)
  blitEllipse(ctx, Math.max(1, rx - 4), Math.max(1, ry - 2), '#401050', a.x, cy)
  // The void swirls.
  for (let i = 0; i < 18; i++) {
    const ang = t * 3 + (i / 18) * TAU * 2
    const d = ((i * 0.37 + t * 0.6) % 1) * 0.85
    px(ctx, a.x + Math.cos(ang) * rx * d, cy + Math.sin(ang) * ry * d, i % 3 === 0 ? '#f85888' : i % 3 === 1 ? '#a040c0' : '#ffffff')
  }
  const steps = Math.max(24, Math.round(rx * 5))
  for (let i = 0; i < steps; i++) {
    const ang = (i / steps) * TAU
    const ca = Math.cos(ang)
    const sa = Math.sin(ang)
    const lit = ca * -0.7 + sa * -0.7 > 0.35
    const shade = sa > 0.55
    px(ctx, a.x + ca * (rx + 1), cy + sa * (ry + 1), '#704000', 2, 2)
    px(ctx, a.x + ca * rx, cy + sa * ry, lit ? '#fff8b0' : shade ? '#c08818' : '#f8c830', 2, 2)
  }
  for (let i = 0; i < 3; i++) {
    const ang = t * 5 + (i / 3) * TAU
    px(ctx, a.x + Math.cos(ang) * rx - 1, cy + Math.sin(ang) * ry - 1, '#ffffff', 3, 3)
  }
}

/** Hyperspace Hole's collapse: a flash, a ring of pink light racing out. */
const drawHoleBurst = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const e = a.age / a.ttl
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  if (a.age < 0.07) blitEllipse(ctx, Math.round(r), Math.round(r * 0.7), 'rgba(255,255,255,0.85)', a.x, a.y - 6)
  blitEllipse(ctx, Math.round(r * 0.5 * (1 - e)), Math.max(1, Math.round(r * 0.3 * (1 - e))), '#f85888', a.x, a.y - 6)
  dashedRing(ctx, a.x, a.y - 6, r * (0.5 + e * 0.8), t * 5, ['#ffffff', '#ffd0e8', '#f85888', '#f8c830'], 0.85, 0.6)
  spokes(ctx, a.x, a.y - 6, r * 0.3 + e * 8, r * 0.6 + e * 16, 12, ['#ffffff', '#f8c830', '#f85888'], a.id)
  ctx.globalAlpha = 1
}

/** Thousand Arrows: an arrow climbing from the ground and diving onto its spot, then stuck in the earth. */
const drawArrow = (ctx: Ctx, a: Attack) => {
  const s = VE.arrow()
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    const lift = 80
    const x = a.from.x + (a.x - a.from.x) * k
    const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * lift
    const vx = a.x - a.from.x
    const vy = a.y - a.from.y - Math.cos(k * Math.PI) * Math.PI * lift
    const ang = Math.atan2(vy, vx)
    for (let i = 1; i <= 3; i++) px(ctx, x - Math.cos(ang) * (12 + i * 4), y - Math.sin(ang) * (12 + i * 4), i === 1 ? '#a8f0a0' : '#30a048', 2, 2)
    blitRotated(ctx, s, x, y, ang, 2)
    return
  }
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  // Stuck nose down, half buried, quivering at first.
  const quiver = e < 0.2 ? Math.round(Math.sin(a.age * 80)) : 0
  ctx.save()
  ctx.beginPath()
  ctx.rect(Math.round(a.x - 14), Math.round(a.y - 26), 28, 26)
  ctx.clip()
  blitRotated(ctx, s, a.x + quiver, a.y - 6, Math.PI / 2 + (a.flip ? 0.25 : -0.25), 2)
  ctx.restore()
  ctx.globalAlpha = 1
}

/** Stone Axe: the axe swung down from overhead onto the foe, then the bite and the cracks. */
const drawAxe = (ctx: Ctx, a: Attack, t: number) => {
  const s = VE.axe()
  const side = a.flip ? -1 : 1
  const k = Math.min(1, a.age / AXE.chop)
  // The haft's end is the pivot: raised behind the head, it swings down until the head bites the foe.
  const ang = side * (-0.9 + 2.35 * k * k)
  const pivotX = a.x - side * 27
  const pivotY = a.y + 6
  const reach = 16
  ctx.globalAlpha = a.age < AXE.chop ? 1 : fadeOut(a, 0.25)
  if (a.age < AXE.chop) {
    // The swing's arc, trailing the head.
    for (let i = 1; i < 7; i++) {
      const b = ang - side * i * 0.16
      px(ctx, pivotX + Math.sin(b) * 30, pivotY - Math.cos(b) * 30, i < 3 ? '#ffffff' : '#ece4d4', 2, 2)
    }
  }
  blitRotated(ctx, s, pivotX + Math.sin(ang) * reach, pivotY - Math.cos(ang) * reach, ang, 2)
  if (a.age >= AXE.chop && a.age < AXE.chop + 0.12) spokes(ctx, a.x, a.y + 2, 5, 14, 10, ['#ffffff', '#ece4d4', '#a09888'], t)
  ctx.globalAlpha = 1
}

/** A splinter flung out of the axe's bite, then floating in place; blinking before it crumbles. */
const drawSplinter = (ctx: Ctx, a: Attack, t: number) => {
  const fly = Math.min(1, a.age / 0.2)
  const x = a.from.x + (a.x - a.from.x) * fly
  const y = a.from.y + (a.y - a.from.y) * fly - Math.sin(fly * Math.PI) * 12
  const bob = Math.round(Math.sin(t * 2.6 + a.id) * 1.5)
  const dying = a.ttl - a.age < 1.2 && Math.floor(a.age * 10) % 2 === 0
  ctx.globalAlpha = dying ? 0.45 : 1
  blitCentered(ctx, VE.splinters()[a.flip ? 1 : 0]!, x, y - 6 + (fly >= 1 ? bob : 0))
  ctx.globalAlpha = 1
}

/** First Impression: speed lanes along each leg, a leading crescent while it runs, a "!" as it starts. */
const drawImpression = (ctx: Ctx, a: Attack) => {
  const dx = a.x - a.from.x
  const dy = a.y - a.from.y
  const len = Math.hypot(dx, dy)
  const colors = ['#ffffff', '#f8d030', '#e0f080', '#a8b820'] as const
  ctx.globalAlpha = fadeOut(a, 0.16)
  if (len >= 1) {
    const ux = dx / len
    const uy = dy / len
    for (let lane = -3; lane <= 3; lane++) {
      ctx.fillStyle = colors[Math.abs(lane)]!
      for (let d = Math.abs(lane) * 4; d < len; d++) ctx.fillRect(Math.round(a.from.x + ux * d - uy * lane * 2.5), Math.round(a.from.y + uy * d + ux * lane * 2.5), 1, 1)
    }
    if (a.motion.kind === 'lunge' && a.motion.left > 0) {
      const r = radiusOf(a)
      const dir = Math.atan2(uy, ux)
      crescent(ctx, a.x, a.y, r, dir - 1.1, 2.2, 3, ['#ffffff', '#e0f080', '#a8b820'])
    }
  }
  if (a.age < 0.12) blitCentered(ctx, VE.exclaim(), a.x, a.y - 22 - Math.round(a.age * 40))
  ctx.globalAlpha = 1
}

/** First Impression's closing burst. */
const drawImpressionBurst = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const e = a.age / a.ttl
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  dashedRing(ctx, a.x, a.y, r, t * 8, ['#ffffff', '#f8d030', '#a8b820'], 0.85)
  spokes(ctx, a.x, a.y, r * 0.4, r * 0.8, 10, ['#ffffff', '#e0f080', '#a8b820'], a.id)
  if (e < 0.6) blitRotated(ctx, VE.exclaim(), a.x, a.y - 4, 0, 2)
  ctx.globalAlpha = 1
}

/** Breaking Swipe: a scaled tail sweeping round and round, a fading trail behind its spade tip. */
const drawSwipe = (ctx: Ctx, g: Game, a: Attack) => {
  const m = a.motion
  if (m.kind !== 'orbit') return
  const p = ownerOf(g, a.owner)
  const r = radiusOf(a) * 0.85
  const swept = Math.min(SWIPE.spin, a.age) * m.spin
  const trail = Math.sign(m.spin) * Math.min(Math.abs(swept), Math.PI * 1.4)
  const tip = m.angle
  ctx.globalAlpha = a.age > SWIPE.spin ? fadeOut(a, a.ttl - SWIPE.spin) : 1
  const steps = Math.max(10, Math.ceil(Math.abs(trail) * r * 0.6))
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    const ang = tip - trail * (1 - k)
    const thick = 1 + Math.round(k * 6)
    for (let d = 0; d < thick; d++) {
      const c = d === 0 ? (k > 0.6 ? '#ffffff' : '#d8c8ff') : d === thick - 1 ? '#200868' : (i + d) % 4 === 0 ? '#b898ff' : (i + d) % 2 === 0 ? '#9070ff' : '#7038f8'
      px(ctx, p.x + Math.cos(ang) * (r - d), p.y - 8 + Math.sin(ang) * (r - d) * 0.7, c, 2, 2)
    }
  }
  const tx = p.x + Math.cos(tip) * r
  const ty = p.y - 8 + Math.sin(tip) * r * 0.7
  px(ctx, tx - 3, ty - 3, '#200868', 7, 7)
  px(ctx, tx - 2, ty - 2, '#9070ff', 5, 5)
  px(ctx, tx - 1, ty - 1, '#d8c8ff', 3, 3)
  px(ctx, tx, ty, '#ffffff')
  if (a.age > SWIPE.spin * 0.6) dashedRing(ctx, p.x, p.y - 4, r + 4 + (a.age - SWIPE.spin * 0.6) * 60, a.age * 10, ['#ffffff', '#b898ff', '#7038f8'], 0.6, 0.7)
  ctx.globalAlpha = 1
}

/** Glacial Lance: the lance flying point first, snow streaming off it. */
const drawLance = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const ang = m.kind === 'linear' ? Math.atan2(m.vy, m.vx) : 0
  const scale = Math.max(1, Math.round(radiusOf(a) / 6))
  ctx.globalAlpha = fadeOut(a, 0.1)
  const cx = Math.cos(ang)
  const cy = Math.sin(ang)
  for (let i = 1; i <= 4; i++) blitEllipse(ctx, Math.max(1, 4 - i), Math.max(1, 4 - i), i < 2 ? '#ffffff' : '#c8e8ff', a.x - cx * (14 + i * 6) * scale, a.y - cy * (14 + i * 6) * scale)
  blitRotated(ctx, VE.lance(), a.x, a.y, ang, scale)
  if (Math.floor(t * 12 + a.id) % 4 === 0) px(ctx, a.x + cx * 12 * scale, a.y + cy * 12 * scale - 1, '#ffffff', 2, 2)
  ctx.globalAlpha = 1
}

/** Glacial Lance's burst: frost crystals flung out on an icy ring. */
const drawLanceBurst = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  const e = a.age / a.ttl
  ctx.globalAlpha = Math.max(0, 1 - e * e)
  if (a.age < 0.06) blitEllipse(ctx, Math.round(r * 0.8), Math.round(r * 0.6), 'rgba(255,255,255,0.8)', a.x, a.y)
  dashedRing(ctx, a.x, a.y, r * (0.5 + e * 0.6), t * 4, ['#ffffff', '#d8f0ff', '#98d8f8'], 0.85, 0.7)
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + a.id
    const d = r * (0.3 + e * 0.8)
    const x = a.x + Math.cos(ang) * d
    const y = a.y + Math.sin(ang) * d * 0.7
    px(ctx, x - 1, y, '#ffffff', 3, 1)
    px(ctx, x, y - 1, '#ffffff', 1, 3)
    px(ctx, x, y, '#98d8f8')
  }
  ctx.globalAlpha = 1
}

/** Air layer (over the Pokémon). */
export const drawVerbEvolvedAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  drawSeedRays(ctx, g, t)
  for (const a of g.attacks) {
    if (a.age < 0 || !visible(a.x, a.y, 200)) continue
    switch (a.visual) {
      case 'ragingFury':
        drawFuryCloak(ctx, g, a, t)
        break
      case 'furyNova':
        drawFuryNova(ctx, a, t)
        break
      case 'seedSun':
        drawSeedSun(ctx, a, t)
        break
      case 'seedBloom':
        drawSeedBloom(ctx, a, t)
        break
      case 'spoutDrop':
        drawSpoutDrop(ctx, a)
        break
      case 'electroDrift':
        drawDriftOrb(ctx, a, t)
        break
      case 'driftLink':
        drawDriftLinks(ctx, g, a, t)
        break
      case 'sludgeGeyser':
        drawSludgeGeyser(ctx, a)
        break
      case 'explosion':
        drawBlast(ctx, a, t, true)
        break
      case 'explosionChain':
        drawBlast(ctx, a, t, false)
        break
      case 'oblivionBeam':
        drawOblivionBeam(ctx, g, a, t)
        break
      case 'skyUppercut':
        drawUppercut(ctx, a, t)
        break
      case 'gearGrind':
        drawGear(ctx, a, t)
        break
      case 'kowtowCleave':
        drawCleave(ctx, a)
        break
      case 'hyperspaceHole':
        drawHoleRing(ctx, a, t)
        break
      case 'hyperspaceBurst':
        drawHoleBurst(ctx, a, t)
        break
      case 'thousandArrows':
        drawArrow(ctx, a)
        break
      case 'stoneAxe':
        drawAxe(ctx, a, t)
        break
      case 'axeSplinter':
        drawSplinter(ctx, a, t)
        break
      case 'firstImpression':
        drawImpression(ctx, a)
        break
      case 'impressionBurst':
        drawImpressionBurst(ctx, a, t)
        break
      case 'breakingSwipe':
        drawSwipe(ctx, g, a)
        break
      case 'glacialLance':
        drawLance(ctx, a, t)
        break
      case 'lanceBurst':
        drawLanceBurst(ctx, a, t)
        break
    }
  }
}
