import { TAU } from '../engine/math'
import { blitCentered, blitEllipse, blitPacked, blitRing, blitRotated, canvasCache, context2d, createCanvas, ellipse, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { flying } from '../game/attacks'
import { BEAM_STEP, ICICLE_FALL, LASH_TIME, LOB, lobPoint, WAVE_BOW, WAVE_WIDTH } from '../game/evolvedMoves'
import type { Attack } from '../game/types'
import { FX } from './art'
import { arc } from './moveFx'
import { bolt, dashedRing } from './strokes'

/**
 * Visuals for evolved moves (casts in `game/evolvedMoves.ts`). Kept apart
 * from `draw.ts` so the base move art stays readable; both are called from
 * the same frame passes.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
const fadeIn = (a: Attack, window: number) => Math.max(0, Math.min(1, a.age / window))
const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 0)
/** Seconds since the hitbox landed (negative before). */
const since = (a: Attack) => a.age - a.activeFrom

/** Frost patch under a shard that stuck in the ground (Ice Shard, Blizzard). */
export const drawFrost = (ctx: Ctx, a: Attack, r: number) => {
  if (flying(a.motion)) return
  ctx.globalAlpha = fadeOut(a, 0.3)
  blitEllipse(ctx, Math.round(r + 3), Math.round((r + 3) * 0.45), 'rgba(200,232,248,0.45)', a.x, a.y + 3)
  ctx.globalAlpha = 1
}

/** A shard: pointing its way while it flies, then a cluster of icicles stuck in the ground. */
export const drawShard = (ctx: Ctx, a: Attack, shard: PixelSprite, icicles: PixelSprite) => {
  const m = a.motion
  if (m.kind === 'drift' && flying(m)) return blitRotated(ctx, shard, a.x, a.y, Math.atan2(m.vy, m.vx))
  ctx.globalAlpha = fadeOut(a, 0.3)
  blitCentered(ctx, icicles, a.x, a.y - 1)
  ctx.globalAlpha = 1
}

/** A breath puff: a growing ball of fire in `colors` (rim to core), flickering (Outrage). */
const drawPuff = (ctx: Ctx, a: Attack, t: number, colors: readonly [string, string, string, string]) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  const flick = Math.floor((t + a.id) * 20) % 2
  ctx.globalAlpha = fadeOut(a, 0.2)
  blitEllipse(ctx, Math.round(r), Math.round(r), colors[0], a.x, a.y)
  blitEllipse(ctx, Math.round(r * 0.75), Math.round(r * 0.75), colors[1], a.x, a.y - flick)
  blitEllipse(ctx, Math.round(r * 0.48), Math.round(r * 0.48), colors[2], a.x, a.y - 1)
  blitEllipse(ctx, Math.max(1, Math.round(r * 0.2)), Math.max(1, Math.round(r * 0.2)), colors[3], a.x, a.y - 1)
  ctx.globalAlpha = 1
}

/** Two white frames, then the ring: the impact frame of a landing hit. */
const impactFlash = (ctx: Ctx, x: number, y: number, r: number, age: number, colors: readonly [string, string]) => {
  if (age < 0) return
  if (age < 0.035) {
    blitEllipse(ctx, Math.round(r * 0.6), Math.round(r * 0.45), '#ffffff', x, y)
    return
  }
  const k = Math.min(1, (age - 0.035) / 0.25)
  ctx.globalAlpha = 1 - k
  blitRing(ctx, Math.round(r * (0.8 + k * 0.7)), 2, colors[0], x, y)
  blitRing(ctx, Math.round(r * (0.6 + k * 0.5)), 1, colors[1], x, y)
  ctx.globalAlpha = 1
}

/** A flickering flame planted on the ground, popping up and dying down (Fire Blast's star, the burning ground). */
const groundFlame = (ctx: Ctx, x: number, y: number, t: number, seed: number, grow: number, frames: readonly PixelSprite[]) => {
  const sprite = frames[Math.floor(t * 9 + seed) % frames.length]!
  const h = Math.round(sprite.height * grow)
  if (h <= 0) return
  ctx.drawImage(sprite, 0, sprite.height - h, sprite.width, h, Math.round(x - sprite.width / 2), Math.round(y - h), sprite.width, h)
}

/* ---------------- Beams ---------------- */

type BeamColors = readonly [edge: string, mid: string, light: string, core: string]

const BEAMS = {
  hydroPump: ['#1838a0', '#4878e8', '#a8d8f8', '#ffffff'],
  triFire: ['#a02010', '#f06020', '#ffd080', '#ffffff'],
  triIce: ['#2060a0', '#60c0f0', '#e0f8ff', '#ffffff'],
  triBolt: ['#a07800', '#f8d830', '#fff8c0', '#ffffff'],
} as const satisfies Record<string, BeamColors>

type BeamVisual = keyof typeof BEAMS

const slabCache = canvasCache<string, PixelSprite>()

/** One slice of a beam, `BEAM_STEP` + 3 px long: dark edges, a white core and streaks that flow (2 frames). */
const beamSlab = (visual: BeamVisual, width: number, frame: number) => {
  const key = `${visual}|${width}|${frame}`
  const cached = slabCache.get(key)
  if (cached) return cached
  const [edge, mid, light, core] = BEAMS[visual]
  const len = BEAM_STEP + 3
  const canvas = createCanvas(len, width)
  const ctx = context2d(canvas)
  const half = width / 2
  for (let y = 0; y < width; y++) {
    const d = Math.abs(y + 0.5 - half) / half
    for (let x = 0; x < len; x++) {
      const streak = d > 0.3 && d < 0.7 && (x + frame * 3 + y * 5) % 7 === 0
      ctx.fillStyle = streak ? core : d > 0.8 ? edge : d > 0.55 ? mid : d > 0.25 ? light : core
      ctx.fillRect(x, y, 1, 1)
    }
  }
  slabCache.set(key, canvas)
  return canvas
}

/** A lit beam segment (it swells in, wobbles, and thins out), or the beam's far-end flash. */
const drawBeam = (ctx: Ctx, a: Attack, t: number, visual: BeamVisual) => {
  const [edge, mid, light] = BEAMS[visual]
  const r = radiusOf(a)
  // The visual-only end flash: a burst of the beam's colors where it ends.
  if (a.activeFrom === Infinity) {
    const k = a.age / a.ttl
    ctx.globalAlpha = 1 - k
    blitEllipse(ctx, Math.round(r * (1 - k * 0.5)), Math.round(r * (1 - k * 0.5)), k < 0.25 ? '#ffffff' : light, a.x, a.y)
    blitRing(ctx, Math.round(r * (0.8 + k * 1.2)), 1, mid, a.x, a.y)
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU + a.id
      const d = r * (0.6 + k * 1.6)
      ctx.fillStyle = i % 2 ? edge : light
      ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d), 2, 2)
    }
    ctx.globalAlpha = 1
    return
  }
  if (a.age < a.activeFrom) return
  const swell = Math.min(1, since(a) / 0.04) * fadeOut(a, 0.14)
  const width = Math.max(1, Math.round(r * 2 * swell * (0.85 + 0.15 * Math.sin(t * 60 + a.id))))
  blitRotated(ctx, beamSlab(visual, width, Math.floor(t * 24) % 2), a.x, a.y, Math.atan2(a.y - a.from.y, a.x - a.from.x))
  // Muzzle glow on the first segment.
  if ((a.x - a.from.x) ** 2 + (a.y - a.from.y) ** 2 < 10 ** 2) {
    const m = Math.min(4, Math.round(width * 0.6))
    blitEllipse(ctx, m, m, mid, a.from.x, a.from.y)
    blitEllipse(ctx, Math.max(1, m - 2), Math.max(1, m - 2), '#ffffff', a.from.x, a.from.y)
  }
}

/** Tri Attack's prism: a triangle spinning over the player, its corners fire, ice and lightning. */
const drawPrism = (ctx: Ctx, a: Attack, t: number) => {
  const k = Math.min(fadeIn(a, 0.1), fadeOut(a, 0.15))
  const size = Math.round(6 + 3 * k)
  const spin = t * 7
  const corners = [0, 1, 2].map((i) => ({ x: a.x + Math.cos(spin + (i * TAU) / 3) * size, y: a.y + Math.sin(spin + (i * TAU) / 3) * size * 0.8 }))
  ctx.globalAlpha = k
  blitEllipse(ctx, size + 3, size + 2, 'rgba(255,255,240,0.25)', a.x, a.y)
  ctx.fillStyle = '#ffffff'
  corners.forEach((c, i) => {
    const n = corners[(i + 1) % 3]!
    const steps = Math.max(1, Math.round(Math.hypot(n.x - c.x, n.y - c.y)))
    for (let s = 0; s <= steps; s++) ctx.fillRect(Math.round(c.x + ((n.x - c.x) * s) / steps), Math.round(c.y + ((n.y - c.y) * s) / steps), 1, 1)
  })
  ;(['triFire', 'triIce', 'triBolt'] as const).forEach((v, i) => {
    const c = corners[i]!
    blitEllipse(ctx, 2, 2, BEAMS[v][1], c.x, c.y)
    blitEllipse(ctx, 1, 1, '#ffffff', c.x, c.y)
  })
  ctx.globalAlpha = 1
}

/* ---------------- Waves ---------------- */

const waveCache = canvasCache<string, PixelSprite>()

/** Rows of a wave behind its crest, front to back (`null` lets the ground through). */
const WAVE_BODY = ['#a8d8f8', '#a8d8f8', '#68a0f0', '#4878e8', '#4878e8', '#4878e8', '#4878e8', '#2848b0', '#2848b0', '#2848b0', '#2848b0', 'rgba(40,72,176,0.6)', null, 'rgba(40,72,176,0.45)', null, 'rgba(40,72,176,0.3)'] as const

/**
 * A whole Surf wave travelling right, `width` px across: the crest bows `bow`
 * px forward in the middle and curls over in churning white foam (2 frames),
 * the blue body trails behind it and thins into the ground. The ends break
 * lower, in more foam.
 */
const waveSprite = (width: number, bow: number, frame: number) => {
  const key = `${width}|${bow}|${frame}`
  const cached = waveCache.get(key)
  if (cached) return cached
  const depth = WAVE_BODY.length + 5 + bow
  const canvas = createCanvas(depth, width)
  const ctx = context2d(canvas)
  for (let y = 0; y < width; y++) {
    const f = (y + 0.5) / width - 0.5
    const front = depth - 1 - Math.round(bow * 4 * f * f)
    const end = Math.abs(f) > 0.4
    const foam = 2 + Math.floor(hash2(y >> 1, frame, 7) * 3) + (end ? 2 : 0)
    // The curl: a lip of foam hanging over the face, then the body.
    for (let k = 0; k < foam + WAVE_BODY.length; k++) {
      const x = front - k
      if (x < 0) break
      const color = k < foam ? (k === 0 && (y + frame) % 4 === 0 ? '#d8f0ff' : '#ffffff') : WAVE_BODY[k - foam]
      if (!color) continue
      ctx.fillStyle = (x + y * 2 + frame) % 9 === 0 && k >= foam && k < foam + 6 ? '#a8d8f8' : color
      ctx.fillRect(x, y, 1, 1)
    }
    // Flecks of spray just ahead of the crest.
    if (hash2(y, frame, 3) > 0.82) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.min(depth - 1, front + 1), y, 1, 1)
    }
  }
  waveCache.set(key, canvas)
  return canvas
}

/** Surf: the middle segment paints the whole wave, its crest's middle where the segment is. */
const drawSurf = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind !== 'linear') return
  const r = radiusOf(a)
  // The segments are `width / 6` apart and `0.75` of that wide (`castSurf`).
  const width = Math.round(r * 8)
  const bow = Math.round((WAVE_BOW * width) / WAVE_WIDTH)
  const sprite = waveSprite(width, bow, Math.floor(t * 10) % 2)
  const angle = Math.atan2(m.vy, m.vx)
  const back = sprite.width / 2 - 1
  ctx.globalAlpha = Math.min(fadeIn(a, 0.08), fadeOut(a, 0.25))
  blitRotated(ctx, sprite, a.x - Math.cos(angle) * back, a.y - Math.sin(angle) * back, angle)
  ctx.globalAlpha = 1
}

/* ---------------- Vines, horns, leaves ---------------- */

/** Power Whip: the vine from the player to its tip, the base leading and the tip lagging like a lash. */
const drawVine = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind !== 'orbit') return
  const cx = a.x - Math.cos(m.angle) * m.radius
  const cy = a.y - Math.sin(m.angle) * m.radius
  const dir = Math.sign(m.spin)
  const swing = a.age < LASH_TIME
  ctx.globalAlpha = swing ? 1 : fadeOut(a, 0.14)
  // Motion smear behind the tip.
  if (swing) {
    for (let i = 1; i < 14; i++) {
      const ang = m.angle - dir * i * 0.07
      ctx.fillStyle = i < 5 ? '#a8e870' : '#58b838'
      if (i % 2 === 0 || i < 5) ctx.fillRect(Math.round(cx + Math.cos(ang) * m.radius), Math.round(cy + Math.sin(ang) * m.radius), 1, 1)
    }
  }
  const steps = Math.ceil(m.radius)
  for (let s = 4; s <= steps; s++) {
    const f = s / steps
    const ang = m.angle + dir * 0.55 * (1 - f) * (1 - f)
    const wob = Math.sin(s * 0.5 - t * 30) * (swing ? 1 : 0.4)
    const x = Math.round(cx + Math.cos(ang) * s - Math.sin(ang) * wob)
    const y = Math.round(cy + Math.sin(ang) * s + Math.cos(ang) * wob)
    // Thick at the base, thinning to the tip: dark rim, green body, a light top edge.
    const w = f > 0.8 ? 1 : f > 0.4 ? 2 : 3
    ctx.fillStyle = '#183818'
    ctx.fillRect(x - w, y - w, w * 2 + 1, w * 2 + 1)
    ctx.fillStyle = s % 9 < 2 ? '#a8e870' : '#58b838'
    ctx.fillRect(x - w + 1, y - w + 1, w * 2 - 1, w * 2 - 1)
    ctx.fillStyle = '#a8e870'
    ctx.fillRect(x - w + 1, y - w + 1, w * 2 - 1, 1)
    // Thorns and little leaves, alternating sides.
    if (s % 7 === 3) {
      const side = (s >> 3) % 2 === 0 ? 1 : -1
      const tx = Math.round(x - Math.sin(ang) * (w + 2) * side)
      const ty = Math.round(y + Math.cos(ang) * (w + 2) * side)
      ctx.fillStyle = '#f0e8a8'
      ctx.fillRect(tx, ty, 1, 1)
      ctx.fillStyle = '#183818'
      ctx.fillRect(Math.round(x - Math.sin(ang) * (w + 1) * side), Math.round(y + Math.cos(ang) * (w + 1) * side), 1, 1)
    }
    if (s % 17 === 9) blitRotated(ctx, FX.leaf(), x - Math.sin(ang) * 4, y + Math.cos(ang) * 4, ang)
  }
  // Leafy tip, and the crack spark when the lash ends.
  blitRotated(ctx, FX.leafStorm(), a.x, a.y, m.angle + Math.PI / 4)
  const crack = a.age - LASH_TIME
  if (crack >= 0 && crack < 0.08) {
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU
      const len = i % 2 === 0 ? 6 : 3
      for (let d = 2; d <= len; d++) {
        ctx.fillStyle = d === 2 ? '#ffffff' : '#f8f0a0'
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d), 1, 1)
      }
    }
  }
  ctx.globalAlpha = 1
}

/** Megahorn: the horn along its flight, wrapped in spinning drill rings. */
const drawHorn = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind !== 'boomerang') return
  const angle = Math.atan2(m.vy, m.vx)
  const scale = Math.max(1, Math.round(radiusOf(a) / 7))
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.2)
  for (let k = 0; k < 3; k++) {
    const back = (k * 5 + ((t * 60) % 5)) * scale
    const x = a.x - Math.cos(angle) * back
    const y = a.y - Math.sin(angle) * back
    for (let i = 0; i < 10; i++) {
      const p = (i / 10) * TAU + t * 30
      const along = Math.cos(p) * 2
      const across = Math.sin(p) * (r * 0.9 - k * 2)
      ctx.fillStyle = k === 0 ? '#ffffff' : '#c8d0e8'
      ctx.fillRect(Math.round(x + Math.cos(angle) * along - Math.sin(angle) * across), Math.round(y + Math.sin(angle) * along + Math.cos(angle) * across), 1, 1)
    }
  }
  blitRotated(ctx, FX.horn(), a.x, a.y, angle, scale)
  ctx.globalAlpha = 1
}

/* ---------------- Storm pieces ---------------- */

const cloudCache = canvasCache<string, PixelSprite>()

/** Wildbolt Storm's thundercloud: lumpy puffs, lit from within when `lit`. */
const stormCloud = (lit: boolean) => {
  const key = String(lit)
  const cached = cloudCache.get(key)
  if (cached) return cached
  const canvas = createCanvas(44, 20)
  const ctx = context2d(canvas)
  const puffs = [[9, 11, 8, 6], [19, 8, 10, 7], [30, 9, 9, 6], [36, 12, 6, 5], [15, 13, 9, 5], [26, 13, 10, 5]] as const
  const layer = (grow: number, dy: number, color: string) => {
    for (const [x, y, rx, ry] of puffs) {
      blitPacked(ctx, ellipse(rx + grow, ry + grow, color), x, y + dy)
    }
  }
  layer(1, 0, '#101020')
  layer(0, 0, lit ? '#585898' : '#383858')
  layer(-2, -1, lit ? '#9898d0' : '#505078')
  layer(-4, -2, lit ? '#e0e0ff' : '#686890')
  cloudCache.set(key, canvas)
  return canvas
}

const drawCloud = (ctx: Ctx, a: Attack, t: number) => {
  ctx.globalAlpha = Math.min(fadeIn(a, 0.2), fadeOut(a, 0.4)) * 0.92
  const bob = Math.round(Math.sin(t * 2) * 1.5)
  const lit = Math.floor(t * 13 + a.id) % 7 === 0
  blitCentered(ctx, stormCloud(lit), a.x, a.y + bob)
  if (lit) bolt(ctx, a.x + Math.round(Math.sin(t * 9) * 12), a.y + 8 + bob, -6, { width: 1, edge: '#f8e030', core: '#ffffff' })
  ctx.globalAlpha = 1
}

/** Blizzard's whirl: snowflakes and gusts circling the player. */
const drawSnowSwirl = (ctx: Ctx, a: Attack, t: number) => {
  ctx.globalAlpha = Math.min(fadeIn(a, 0.2), fadeOut(a, 0.4))
  for (let i = 0; i < 10; i++) {
    const ang = t * 2.4 + (i / 10) * TAU
    const rr = 26 + (i % 3) * 9 + Math.sin(t * 3 + i) * 3
    const x = a.x + Math.cos(ang) * rr
    const y = a.y + Math.sin(ang) * rr * 0.55
    if (i % 3 === 0) blitCentered(ctx, FX.snowflake(), x, y)
    else {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(Math.round(x), Math.round(y), 2, 1)
    }
  }
  dashedRing(ctx, a.x, a.y, 34, t * 6, ['#ffffff', '#d8f0ff'], 0.35, 0.55)
  ctx.globalAlpha = 1
}

/** The icicle falling from above, then a white impact frame and a ring of frost. */
const drawIcicleFall = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  if (a.age < a.activeFrom) {
    const k = a.age / ICICLE_FALL
    const sprite = FX.icicle()
    const scale = Math.max(1, Math.round(r / 9))
    blitRotated(ctx, sprite, a.x + (1 - k) * 18, a.y - 8 - (1 - k) * 130, a.flip ? 0.12 : -0.12, scale)
    return
  }
  impactFlash(ctx, a.x, a.y - 2, r, since(a), ['#e0f8ff', '#98d8f8'])
}

/* ---------------- Lobbed bombs ---------------- */

/** Fire Blast's fireball in flight (spinning, growing), then the burst. */
const drawFireBlast = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  if (a.age < a.activeFrom) {
    const at = lobPoint(a, LOB.fireBlast)
    const scale = at.k > 0.4 ? 2 : 1
    blitEllipse(ctx, 4 * scale + 2, 4 * scale + 2, 'rgba(248,160,48,0.35)', at.x, at.y)
    blitRotated(ctx, FX.pyro(), at.x, at.y, t * 12, scale)
    return
  }
  const e = since(a)
  if (e < 0.035) {
    blitEllipse(ctx, Math.round(r * 0.6), Math.round(r * 0.45), '#fff8d0', a.x, a.y - 2)
    return
  }
  const k = Math.min(1, (e - 0.035) / (a.ttl - a.activeFrom - 0.035))
  ctx.globalAlpha = 1 - k
  blitEllipse(ctx, Math.round(r * (0.9 - k * 0.4)), Math.round(r * (0.7 - k * 0.3)), '#f87828', a.x, a.y - 2)
  blitEllipse(ctx, Math.round(r * (0.6 - k * 0.3)), Math.round(r * (0.45 - k * 0.2)), '#f8d050', a.x, a.y - 3)
  blitEllipse(ctx, Math.max(1, Math.round(r * 0.3 * (1 - k))), Math.max(1, Math.round(r * 0.25 * (1 - k))), '#fff8d0', a.x, a.y - 3)
  blitRing(ctx, Math.round(r * (1 + k * 0.8)), 2, '#f8a030', a.x, a.y - 2)
  ctx.globalAlpha = 1
}

/** Gunk Shot's heap in flight, then the splash; the puddles are its blobs (`gunk`). */
const drawGunkBomb = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  if (a.age < a.activeFrom) {
    const at = lobPoint(a, LOB.gunkBomb)
    return blitRotated(ctx, FX.gunkBomb(), at.x, at.y, Math.sin(t * 8 + a.id) * 0.5, at.k > 0.35 ? 2 : 1)
  }
  impactFlash(ctx, a.x, a.y - 2, r, since(a), ['#6a3a78', '#88a038'])
  // Splash drops thrown up and out.
  const e = since(a)
  if (e > 0.3) return
  ctx.fillStyle = '#6a3a78'
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * TAU + a.id
    const d = r * (0.4 + e * 4)
    ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y - 2 + Math.sin(ang) * d * 0.6 - Math.sin(e * 10) * 6), 2, 2)
  }
}

/* ---------------- Ground layer ---------------- */

/** Ground layer (under Pokémon): puddles, scorch marks, shadows and strike warnings. */
export const drawEvolvedGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const r = a.shape.r
  switch (a.visual) {
    case 'blizzard':
      return a.age < a.activeFrom ? undefined : drawFrost(ctx, a, r)
    case 'icicleFall': {
      if (a.age >= a.activeFrom) {
        ctx.globalAlpha = fadeOut(a, 0.3)
        blitEllipse(ctx, Math.round(r), Math.round(r * 0.45), 'rgba(216,240,255,0.5)', a.x, a.y)
        ctx.globalAlpha = 1
        return
      }
      const k = 0.35 + 0.65 * (a.age / a.activeFrom)
      blitEllipse(ctx, Math.round(r * k), Math.max(1, Math.round(r * 0.45 * k)), 'rgba(24,48,72,0.35)', a.x, a.y)
      if (Math.floor(a.age * 24) % 2 === 0) dashedRing(ctx, a.x, a.y, r, 0, ['#e0f8ff'], 0.9, 0.45)
      return
    }
    case 'stoneEdge': {
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitEllipse(ctx, Math.round(r * 0.8), Math.round(r * 0.35), 'rgba(40,28,16,0.45)', a.x, a.y + 1)
      ctx.globalAlpha = 1
      return
    }
    case 'gunk': {
      if (a.age < a.activeFrom) return
      const grow = Math.min(1, (a.age - a.activeFrom) / 0.12)
      ctx.globalAlpha = fadeOut(a, 0.3)
      blitEllipse(ctx, Math.round(r * grow), Math.round(r * 0.72 * grow), 'rgba(40,24,48,0.6)', a.x, a.y)
      blitEllipse(ctx, Math.round(r * 0.78 * grow), Math.round(r * 0.54 * grow), 'rgba(106,58,120,0.6)', a.x, a.y - 1)
      blitEllipse(ctx, Math.round(r * 0.4 * grow), Math.round(r * 0.26 * grow), 'rgba(136,160,56,0.55)', a.x + r * 0.2, a.y + 1)
      // Popping bubbles.
      for (let i = 0; i < 4; i++) {
        const phase = (t * 1.4 + i * 0.37 + a.id * 0.13) % 1
        const bx = Math.round(a.x + Math.cos(i * 2.4 + a.id) * r * 0.55)
        const by = Math.round(a.y + Math.sin(i * 1.7 + a.id) * r * 0.35)
        blitRing(ctx, 1 + Math.round(phase * 2), 1, '#c890d8', bx, by)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'gunkBomb':
    case 'fireBlast': {
      if (a.age < a.activeFrom) {
        // The shadow grows where the bomb will land.
        const k = 0.3 + 0.7 * (a.age / a.activeFrom)
        blitEllipse(ctx, Math.round(r * 0.7 * k), Math.max(1, Math.round(r * 0.3 * k)), 'rgba(24,16,24,0.4)', a.x, a.y)
        return
      }
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.5), a.visual === 'fireBlast' ? 'rgba(48,20,8,0.45)' : 'rgba(40,24,48,0.5)', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'flameField':
    case 'starFlame':
    case 'infernoRing': {
      if (a.age < a.activeFrom) return
      ctx.globalAlpha = Math.min(fadeIn(a, 0.1), fadeOut(a, 0.3))
      const rx = a.visual === 'starFlame' ? r * 0.7 : r
      blitEllipse(ctx, Math.round(rx), Math.round(rx * 0.45), 'rgba(48,20,8,0.4)', a.x, a.y)
      if (a.visual !== 'starFlame') blitEllipse(ctx, Math.round(rx * 0.75), Math.round(rx * 0.32), 'rgba(248,120,32,0.25)', a.x, a.y)
      if (a.visual === 'infernoRing') dashedRing(ctx, a.x, a.y, r, t * 3, ['#f8a030', '#f07020', '#c03018'], 0.8, 0.45)
      ctx.globalAlpha = 1
      return
    }
    case 'pumpSplash': {
      if (a.age < a.activeFrom) return
      ctx.globalAlpha = fadeOut(a, 0.3)
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.45), 'rgba(72,120,232,0.35)', a.x, a.y + 4)
      ctx.globalAlpha = 1
      return
    }
    case 'outrageRoar': {
      ctx.globalAlpha = fadeOut(a, 0.2)
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + a.id
        for (let d = 6; d < r; d += 1.5) {
          const jag = Math.sin(d * 0.6 + i) * 1.5
          ctx.fillStyle = '#381860'
          ctx.fillRect(Math.round(a.x + Math.cos(ang) * d - Math.sin(ang) * jag), Math.round(a.y + 6 + (Math.sin(ang) * d + Math.cos(ang) * jag) * 0.5), 1, 1)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'wildbolt': {
      if (a.age < a.activeFrom) {
        if (Math.floor(a.age * 30) % 2 === 0) blitRing(ctx, Math.round(r), 1, '#a8f0ff', a.x, a.y)
        return
      }
      ctx.globalAlpha = fadeOut(a, 0.3) * 0.7
      blitEllipse(ctx, Math.round(r * 0.7), Math.round(r * 0.35), 'rgba(24,32,48,0.5)', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
  }
}

/* ---------------- Overlay layer ---------------- */

/** Overlay layer (above Pokémon). */
export const drawEvolvedAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'flamethrower': {
      if (a.shape.kind !== 'circle') return
      const r = a.shape.r
      // White-hot at the mouth, cooling to red and smoke as it flies.
      const life = a.age / a.ttl
      const flick = Math.floor((t + a.id) * 20) % 2
      ctx.globalAlpha = fadeOut(a, 0.25)
      blitEllipse(ctx, Math.round(r), Math.round(r), life > 0.7 ? 'rgba(72,40,40,0.7)' : '#c03018', a.x, a.y)
      blitEllipse(ctx, Math.round(r * 0.75), Math.round(r * 0.75), life > 0.75 ? '#a03018' : '#f07020', a.x, a.y - flick)
      blitEllipse(ctx, Math.round(r * 0.48), Math.round(r * 0.48), life < 0.4 ? '#fff0a0' : '#f8c040', a.x, a.y - 1)
      blitEllipse(ctx, Math.max(1, Math.round(r * 0.22)), Math.max(1, Math.round(r * 0.22)), '#ffffff', a.x, a.y - 1)
      ctx.globalAlpha = 1
      return
    }
    case 'flameField': {
      if (a.age < a.activeFrom) return
      const r = radiusOf(a)
      const grow = Math.min(fadeIn(a, a.activeFrom + 0.12), fadeOut(a, 0.35))
      for (let i = 0; i < 5; i++) {
        const ang = i * 2.4 + a.id
        groundFlame(ctx, a.x + Math.cos(ang) * r * 0.6, a.y + Math.sin(ang) * r * 0.3 + 2, t, i + a.id, grow * (0.6 + 0.4 * Math.sin(t * 7 + i) ** 2), FX.flame())
      }
      return
    }
    case 'fireBlast':
      return drawFireBlast(ctx, a, t)
    case 'starFlame': {
      if (a.age < a.activeFrom) return
      const pop = Math.min(1, since(a) / 0.08)
      const grow = pop * fadeOut(a, 0.35) * (0.85 + 0.15 * Math.sin(t * 9 + a.id))
      groundFlame(ctx, a.x, a.y + 3, t, a.id, grow, a.flip ? FX.flame() : FX.inferno())
      return
    }
    case 'hydroPump':
    case 'triFire':
    case 'triIce':
    case 'triBolt':
      return drawBeam(ctx, a, t, a.visual)
    case 'triPrism':
      return drawPrism(ctx, a, t)
    case 'pumpSplash': {
      if (a.age < a.activeFrom) return
      const r = radiusOf(a)
      impactFlash(ctx, a.x, a.y, r, since(a), ['#ffffff', '#68a0f0'])
      const e = since(a)
      if (e > 0.32) return
      // A crown of spray shooting up and falling back.
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * TAU + a.id
        const d = r * (0.5 + e * 2.4)
        ctx.fillStyle = i % 3 === 0 ? '#ffffff' : '#a8d8f8'
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d * 0.5 - (e * 70 - e * e * 220)), 2, 2)
      }
      return
    }
    case 'surf':
      return drawSurf(ctx, a, t)
    case 'leafStorm': {
      ctx.globalAlpha = Math.min(fadeIn(a, 0.1), fadeOut(a, 0.3))
      blitRotated(ctx, a.flip ? FX.leafStormGold() : FX.leafStorm(), a.x, a.y, a.age * 16 + a.id)
      ctx.globalAlpha = 1
      return
    }
    case 'powerWhip':
      return drawVine(ctx, a, t)
    case 'wildbolt': {
      if (a.age < a.activeFrom || a.shape.kind !== 'circle') return
      const r = a.shape.r
      const e = since(a)
      // Impact frame: a white column and flash, then the bolt crackles out.
      if (e < 0.05) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(a.x) - 2, Math.round(a.y) - 220, 5, 220)
        blitEllipse(ctx, Math.round(r * 0.55), Math.round(r * 0.3), '#ffffff', a.x, a.y)
        return
      }
      ctx.globalAlpha = Math.max(0, 1 - e / (a.ttl - a.activeFrom))
      bolt(ctx, a.x, a.y, 220, { width: 5, edge: '#58c8f8', core: '#ffffff' })
      bolt(ctx, a.x + 3, a.y, 120, { width: 3, edge: '#f8e030', core: '#fff8c0' })
      blitEllipse(ctx, Math.round(r * 0.8), Math.round(r * 0.4), 'rgba(168,240,255,0.4)', a.x, a.y)
      blitRing(ctx, Math.round(r * (0.6 + e * 2)), 1, '#e0ffff', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'wildFork': {
      if (a.age < a.activeFrom) return
      ctx.globalAlpha = fadeOut(a, 0.1)
      arc(ctx, a, t, { edge: '#58c8f8', core: '#ffffff', width: 1 })
      blitRing(ctx, 2 + Math.round(since(a) * 20), 1, '#e0ffff', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'boltStrike': {
      ctx.globalAlpha = fadeOut(a, 0.12)
      if (a.age < 0.04) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(a.x) - 2, Math.round(a.from.y), 5, Math.round(a.y - a.from.y))
      } else bolt(ctx, a.x, a.y, a.y - a.from.y, { width: 3, edge: '#f8b830', core: '#ffffff' })
      blitRing(ctx, 3 + Math.round(a.age * 30), 1, '#fff8d0', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'stormCloud':
      return drawCloud(ctx, a, t)
    case 'gunkBomb':
      return drawGunkBomb(ctx, a, t)
    case 'gunk': {
      // A splattered blob flying out from where the heap landed; the puddle is drawn on the ground layer.
      if (a.age >= a.activeFrom) return
      const at = lobPoint(a, LOB.gunk)
      blitEllipse(ctx, 3, 2, '#281830', at.x, at.y)
      blitEllipse(ctx, 2, 1, '#6a3a78', at.x - 1, at.y - 1)
      return blitEllipse(ctx, 1, 1, '#88a038', at.x + 1, at.y - 1)
    }
    case 'toxicCloud': {
      const r = radiusOf(a)
      ctx.globalAlpha = Math.min(fadeIn(a, 0.15), fadeOut(a, 0.5)) * 0.6
      for (let i = 0; i < 5; i++) {
        const ang = i * 1.3 + a.id + t * 0.8
        const rr = Math.round(r * (0.4 + 0.12 * Math.sin(t * 3 + i)))
        blitEllipse(ctx, rr, Math.round(rr * 0.7), i % 2 ? 'rgba(160,64,160,0.45)' : 'rgba(200,144,216,0.4)', a.x + Math.cos(ang) * r * 0.45, a.y - 4 + Math.sin(ang) * r * 0.25 - a.age * 4)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'infernoRing': {
      const r = radiusOf(a)
      const grow = Math.min(fadeIn(a, 0.25), fadeOut(a, 0.4))
      const n = Math.max(6, Math.round(r / 4))
      for (let i = 0; i < n; i++) {
        const ang = (i / n) * TAU + t * 0.6
        groundFlame(ctx, a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.45 + 2, t, i * 3 + a.id, grow * (0.45 + 0.25 * Math.sin(t * 8 + i * 1.7) ** 2), FX.flame())
      }
      return
    }
    case 'icicleFall':
      return drawIcicleFall(ctx, a)
    case 'blizzard':
      return a.age < a.activeFrom ? undefined : drawShard(ctx, a, FX.blizzardShard(), FX.blizzardIcicles())
    case 'snowSwirl':
      return drawSnowSwirl(ctx, a, t)
    case 'stoneEdge': {
      // The pillar shoots up out of the ground, holds, then sinks back.
      const sprite = FX.pillar()
      const rise = Math.max(0, Math.min(1, a.age / 0.06, (a.ttl - a.age) / 0.2))
      const h = Math.round(sprite.height * rise)
      if (h <= 0) return
      const scale = a.shape.kind === 'circle' ? Math.max(1, Math.round(a.shape.r / 10)) : 1
      const x = Math.round(a.x - (sprite.width * scale) / 2 + (a.flip ? 1 : -1))
      const y = Math.round(a.y + 2 - h * scale)
      ctx.drawImage(sprite, 0, sprite.height - h, sprite.width, h, x, y, sprite.width * scale, h * scale)
      if (a.age < 0.12) dashedRing(ctx, a.x, a.y, 4 + a.age * 60, a.id, ['#d8c080', '#a08048'], 0.6, 0.5)
      return
    }
    case 'megahorn':
      return drawHorn(ctx, a, t)
    case 'outrage':
      return drawPuff(ctx, a, t, ['rgba(120,40,200,0.5)', 'rgba(224,72,96,0.85)', '#f8a058', '#fff0d0'])
    case 'outrageRoar': {
      const r = radiusOf(a)
      if (a.age < 0.04) return blitRing(ctx, Math.round(r + 2), 3, '#ffffff', a.x, a.y)
      ctx.globalAlpha = fadeOut(a, 0.18)
      dashedRing(ctx, a.x, a.y, r, a.age * 20, ['#f85030', '#f8d030'], 0.9, 0.7)
      dashedRing(ctx, a.x, a.y, r - 3, -a.age * 24, ['#a070f8', '#7038f8'], 0.8, 0.7)
      // Spikes of the roar.
      for (let i = 0; i < 12; i++) {
        const ang = (i / 12) * TAU + a.id
        for (let d = r - 2; d < r + 4; d++) {
          ctx.fillStyle = d > r + 1 ? '#f8d030' : '#f85030'
          ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d * 0.7), 1, 1)
        }
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hurricane': {
      if (a.shape.kind !== 'circle') return
      const r = a.shape.r
      ctx.globalAlpha = Math.min(1, a.age / 0.2) * fadeOut(a, 0.4)
      // Funnel of spinning rings, narrow at the ground and wide at the top, with debris caught in it.
      for (let k = 0; k < 7; k++) {
        const rr = r * (0.3 + k * 0.14)
        const sway = Math.sin(t * 6 + k * 0.7) * 2
        dashedRing(ctx, a.x + sway, a.y + 6 - k * 5, rr, t * 14 + k, k % 2 ? ['#ffffff', '#b8c0dc'] : ['#e8eefc', '#7880a8'], 0.8, 0.35)
      }
      for (let i = 0; i < 4; i++) {
        const ang = t * 9 + (i / 4) * TAU + a.id
        const lift = ((t * 0.9 + i * 0.25) % 1) * 30
        ctx.fillStyle = i % 2 ? '#70d048' : '#a08048'
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * r * (0.4 + lift / 60)), Math.round(a.y + 4 - lift + Math.sin(ang) * r * 0.2), 2, 1)
      }
      ctx.globalAlpha = 1
      return
    }
  }
}
