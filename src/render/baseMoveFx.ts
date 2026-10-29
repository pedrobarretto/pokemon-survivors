import { TAU } from '../engine/math'
import { blitCentered, blitEllipse, blitRing, canvasCache, context2d, createCanvas, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { Attack } from '../game/types'
import { FX } from './art'
import { flightAngle } from './modFx'
import { dashedRing } from './strokes'
import { detail } from './quality'

/**
 * The base moves' animations (Ember, Water Gun, Fire Spin, Swift, Razor Leaf,
 * Thunder, Sludge Bomb, Gust, Vine Whip, Rock Tomb): projectiles drawn as
 * procedural pixel sprites, one per heading and flicker frame, so they point
 * where they fly without a blurry rotation, plus their launches, trails and
 * landings. Everything is a pure function of the attack and the clock: the
 * simulation is untouched. `draw.ts` calls in from its two attack passes.
 */

type Ctx = CanvasRenderingContext2D

/** Headings a procedural projectile is drawn in: fine enough that a homing turn never visibly snaps. */
const DIRS = 32
const dirOf = (angle: number) => ((Math.round((angle / TAU) * DIRS) % DIRS) + DIRS) % DIRS

const radiusOf = (a: Attack, fallback: number) => (a.shape.kind === 'circle' ? a.shape.r : fallback)
const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))

/* ---------------- Frame sheets ---------------- */

/** One frame of a procedural sprite: a `w`×`h` cell of a shared sheet. */
type Cell = { sheet: PixelSprite; sx: number; sy: number; w: number; h: number }
type Sheet = { cells: readonly Cell[]; painted: boolean[]; ctx: Ctx; paint: (ctx: Ctx, i: number) => void }

const sheets = canvasCache<string, Sheet>()

/**
 * Frame `i` (of `count`, each `w`×`h`) of the look `key`. All of a look's
 * frames share one canvas, since every canvas costs memory on a phone however
 * small it is, and each frame is painted the first time it's drawn, so a
 * look's first shot doesn't stall on painting its every heading.
 */
const frameOf = (key: string, count: number, w: number, h: number, i: number, paint: (ctx: Ctx, i: number) => void) => {
  let sh = sheets.get(key)
  if (!sh) {
    const cols = Math.max(1, Math.min(count, Math.floor(1024 / w)))
    const sheet = createCanvas(cols * w, Math.ceil(count / cols) * h)
    const cells = Array.from({ length: count }, (_, k) => ({ sheet, sx: (k % cols) * w, sy: Math.floor(k / cols) * h, w, h }))
    sheets.set(key, (sh = { cells, painted: [], ctx: context2d(sheet), paint }))
  }
  const cell = sh.cells[i]!
  if (!sh.painted[i]) {
    sh.ctx.setTransform(1, 0, 0, 1, cell.sx, cell.sy)
    sh.paint(sh.ctx, i)
    sh.ctx.setTransform(1, 0, 0, 1, 0, 0)
    sh.painted[i] = true
  }
  return cell
}

/** Draws a cell centered at (x, y), snapped to whole pixels. */
const blitCell = (ctx: Ctx, c: Cell, x: number, y: number) => ctx.drawImage(c.sheet, c.sx, c.sy, c.w, c.h, Math.round(x - c.w / 2), Math.round(y - c.h / 2), c.w, c.h)

/* ---------------- Comets: a head with a licking tail ---------------- */

type Comet = {
  /** Head radius and tail length, px. */
  head: number
  tail: number
  /** Colors from the rim to the hottest core. */
  ramp: readonly string[]
  /** How much the tail's edges lick and waver (0: a smooth teardrop). */
  lick: number
  /** Breaks the tail's last stretch into loose pixels, as flame tips do. */
  ragged: boolean
  /** A glint on the head's upper left (liquids), or null. */
  glint: string | null
  /** Heat added toward the front of the head (fire burns hottest where it bites), 0..1. */
  front: number
  /** Light from above: the upper side reads lighter and the underside darker (round liquids), 0..1. */
  lit: number
  /** The head's length along its flight over its width, per frame (squash and stretch); its length is the frame count. */
  stretch: readonly number[]
}

/**
 * A comet pointing along heading `dir` (of `DIRS`), flicker frame `frame`: the
 * head centered in the cell, so `blitCell` puts it on the hitbox. Heat falls
 * off from the head's front to the tail's tip and from the middle to the
 * edges, and picks the color off `ramp`.
 */
const cometFrame = (name: string, c: Comet, dir: number, frame: number) => {
  const frames = c.stretch.length
  const reach = Math.ceil(Math.max(c.head * Math.max(...c.stretch), c.tail + c.head)) + 1
  const size = reach * 2 + 1
  return frameOf(name, DIRS * frames, size, size, dir * frames + (frame % frames), (ctx, i) => paintComet(ctx, c, reach, Math.floor(i / frames), i % frames))
}

const paintComet = (ctx: Ctx, c: Comet, reach: number, dir: number, frame: number) => {
  const angle = (dir / DIRS) * TAU
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const stretch = c.stretch[frame]!
  const size = reach * 2 + 1
  const n = c.ramp.length
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - reach
      const dy = y - reach
      const u = dx * cos + dy * sin
      const v = -dx * sin + dy * cos
      let edge: number
      let heat: number
      if (u >= 0) {
        edge = Math.hypot(u / (c.head * stretch + 0.35), v / (c.head + 0.35))
        heat = 1 - edge * 0.85
      } else {
        const k = -u / (c.tail + c.head * 0.5)
        if (k >= 1) continue
        const side = v > 0 ? 1 : 2
        const lick = c.lick * (Math.sin(k * 9 - frame * 1.9 + side * 2) * 0.22 + (hash2(Math.round(-u), frame, side) - 0.5) * 0.45)
        const w = (c.head + 0.35) * Math.pow(1 - k, 0.85) * (1 + lick)
        if (w <= 0.3) continue
        if (c.ragged && k > 0.55 && hash2(x * 7 + frame, y * 13, dir) < (k - 0.55) * 1.6) continue
        edge = Math.abs(v) / w
        heat = (1 - edge * 0.85) * (1 - k * 0.9)
      }
      if (edge > 1) continue
      if (u >= 0) heat += c.front * (u / (c.head * stretch + 0.35)) * (1 - edge * 0.5)
      heat -= c.lit * (dy / (c.head + 0.35)) * 0.3
      let color = c.ramp[Math.max(0, Math.min(n - 1, Math.floor(heat * n * 1.1)))]!
      if (c.glint && u > -c.head * 0.8 && Math.hypot(dx + c.head * 0.35, dy + c.head * 0.45) < Math.max(0.8, c.head * 0.34)) color = c.glint
      ctx.fillStyle = color
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

const FIRE_RAMP = ['#801008', '#c02810', '#e85818', '#f89828', '#f8d050', '#fff8d0'] as const
const WATER_RAMP = ['#183890', '#2858c8', '#4888e8', '#78b8f8', '#b8e0ff'] as const

/** Ember by size (its radius grows with Area): a fireball with a licking tail. */
const EMBERS = [3, 4, 5].map((head) => ({ head: head * 0.75, tail: head * 2.4, ramp: FIRE_RAMP, lick: 1, ragged: true, glint: null, front: 0.45, lit: 0, stretch: [1.05, 1, 1.1, 0.95] }) satisfies Comet)
/** Water Gun: a smooth bullet of water that wobbles as it flies. */
const JETS = [4, 5, 6, 7].map((head) => ({ head: head * 0.62, tail: head * 1.5, ramp: WATER_RAMP, lick: 0.15, ragged: false, glint: '#ffffff', front: 0, lit: 1, stretch: [1.35, 1.15, 0.95, 1.15] }) satisfies Comet)

/** Which of a look's sizes a radius `r` draws in (`list[0]` is radius `base`). */
const sizeOf = (list: readonly unknown[], r: number, base: number) => Math.max(0, Math.min(list.length - 1, Math.round(r) - base))

/** A burst at the muzzle for a projectile's first frames: a white star stretched along its flight, then the colors. */
const muzzle = (ctx: Ctx, x: number, y: number, angle: number, age: number, colors: readonly [string, string]) => {
  if (age > 0.09) return
  const k = age / 0.09
  const len = Math.round(6 * (1 - k)) + 1
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  ctx.fillStyle = k < 0.35 ? '#ffffff' : colors[0]
  for (let d = 0; d <= len; d++) ctx.fillRect(Math.round(x + cos * d), Math.round(y + sin * d), 1, 1)
  const side = Math.max(1, Math.round(len * 0.5))
  for (let d = 1; d <= side; d++) {
    ctx.fillRect(Math.round(x - sin * d), Math.round(y + cos * d), 1, 1)
    ctx.fillRect(Math.round(x + sin * d), Math.round(y - cos * d), 1, 1)
  }
  blitRing(ctx, Math.round(2 + k * 4), 1, colors[1], x, y)
}

/** Ember: a fireball with a flickering tail, the flight's way, with a puff at the muzzle and a few loose sparks behind. */
export const drawEmber = (ctx: Ctx, a: Attack, t: number) => {
  const angle = flightAngle(a.motion) ?? 0
  const frame = Math.floor(t * 16 + a.id) % 4
  muzzle(ctx, a.from.x, a.from.y, angle, a.age, ['#f8d050', '#f87820'])
  if (!detail.lean) {
    // Two sparks shed off the tail, drifting up and back as they cool.
    for (let i = 0; i < 2; i++) {
      const phase = (t * 3.2 + hash2(a.id, i, 5)) % 1
      const back = 6 + phase * 10
      const off = (hash2(a.id, i, 6) - 0.5) * 6
      ctx.fillStyle = phase < 0.4 ? '#f8d050' : phase < 0.75 ? '#f07020' : '#a02010'
      ctx.fillRect(Math.round(a.x - Math.cos(angle) * back - Math.sin(angle) * off), Math.round(a.y - Math.sin(angle) * back + Math.cos(angle) * off - phase * 4), 1, 1)
    }
  }
  blitCell(ctx, cometFrame(`ember${sizeOf(EMBERS, radiusOf(a, 4), 3)}`, EMBERS[sizeOf(EMBERS, radiusOf(a, 4), 3)]!, dirOf(angle), frame), a.x, a.y)
}

/** Water Gun: a wobbling bullet of water with a spray of beads falling behind it and a splash ring at the muzzle. */
export const drawWaterGun = (ctx: Ctx, a: Attack, t: number) => {
  const angle = flightAngle(a.motion) ?? 0
  const r = radiusOf(a, 5)
  const frame = Math.floor(t * 18 + a.id) % 4
  muzzle(ctx, a.from.x, a.from.y, angle, a.age, ['#a8d8f8', '#6890f0'])
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  // Beads shed from the bullet: further back, smaller and lower (they fall as the shot flies on).
  const beads = detail.lean ? 2 : 4
  for (let i = 0; i < beads; i++) {
    const back = r * 1.6 + 4 + i * 4.5
    if (back > a.age * 300) break
    const wob = Math.sin(a.age * 30 + i * 2.1 + a.id) * (1 + i * 0.5)
    const x = Math.round(a.x - cos * back - sin * wob)
    const y = Math.round(a.y - sin * back + cos * wob + i * i * 0.5)
    const s = i < 2 ? 2 : 1
    ctx.fillStyle = i % 2 === 0 ? '#78b8f8' : '#b8e0ff'
    ctx.fillRect(x, y, s, s)
    if (s === 2) {
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  blitCell(ctx, cometFrame(`jet${sizeOf(JETS, r, 4)}`, JETS[sizeOf(JETS, r, 4)]!, dirOf(angle), frame), a.x, a.y)
}

/* ---------------- Fire Spin: leaning flames with a burning wake ---------------- */

/** Leans a flame comes in (-2..2) and its flicker frames. */
const LEANS = 5
const FLICKER = 4

/**
 * An upright flame of base radius `r`, its tip leaning `lean` (-2..2: blown
 * the other way as it whirls), flicker frame `frame` (of 4). The base sits at
 * the cell's bottom middle; tongues lick up its sides and fall off as loose
 * pixels near the tip.
 */
const flameFrame = (r: number, lean: number, frame: number) =>
  frameOf(`flame${r}`, LEANS * FLICKER, r * 2 + 5, Math.round(r * 3.4) + 1, (lean + 2) * FLICKER + (frame % FLICKER), (ctx, i) => paintFlame(ctx, r, Math.floor(i / FLICKER) - 2, i % FLICKER))

const paintFlame = (ctx: Ctx, r: number, lean: number, frame: number) => {
  const height = Math.round(r * 3.4)
  const w = r * 2 + 5
  const cx = (w - 1) / 2
  const baseY = height - r
  const n = FIRE_RAMP.length
  for (let y = 0; y <= height; y++) {
    for (let x = 0; x < w; x++) {
      let edge: number
      let heat: number
      if (y >= baseY) {
        edge = Math.hypot(x - cx, (y - baseY) * 1.15) / (r + 0.4)
        heat = 1 - edge * 0.8
      } else {
        const k = (baseY - y) / baseY
        const mid = cx + lean * r * 0.45 * k * k
        const tongue = Math.sin(k * 7 - frame * 1.6 + (x < mid ? 0 : 2.4)) * 0.25 + (hash2(y, frame, x < mid ? 1 : 2) - 0.5) * 0.4
        const half = (r + 0.4) * Math.pow(1 - k, 0.75) * (1 + tongue * k)
        if (half <= 0.3) continue
        if (k > 0.6 && hash2(x + frame * 31, y, 9) < (k - 0.6) * 1.8) continue
        edge = Math.abs(x - mid) / half
        heat = (1 - edge * 0.8) * (1 - k * 0.75)
      }
      if (edge > 1) continue
      ctx.fillStyle = FIRE_RAMP[Math.max(0, Math.min(n - 1, Math.floor(heat * n * 1.15)))]!
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** Draws a flame with its base at (x, y). */
const blitFlame = (ctx: Ctx, c: Cell, x: number, y: number) => blitCell(ctx, c, x, y - c.h / 2)

/**
 * Fire Spin: each flame leans against its whirl and leaves a wake of shrinking
 * embers along the circle behind it; it flares up as it appears and gutters out at the end.
 */
export const drawFireSpin = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  if (m.kind !== 'orbit') return
  const r = Math.max(3, Math.round(radiusOf(a, 7) * 0.6))
  const grow = Math.min(1, a.age / 0.12) * fadeOut(a, 0.25)
  const cx = a.x - Math.cos(m.angle) * m.radius
  const cy = a.y - Math.sin(m.angle) * m.radius
  const dir = m.spin < 0 ? -1 : 1
  // The wake: a ribbon of fire along the arc it just left, thinning and cooling
  // from yellow to red, drawn back to front so the hot part stays on top.
  const arc = 0.85
  // A stamp every pixel and a half of arc, so the ribbon never breaks into beads.
  const steps = Math.max(4, Math.round((m.radius * arc) / (detail.lean ? 4 : 1.5)))
  const flick = Math.floor(t * 14 + a.id)
  for (let i = steps; i >= 1; i--) {
    const k = i / steps
    const back = m.angle - dir * k * arc
    const x = cx + Math.cos(back) * m.radius
    const y = cy + Math.sin(back) * m.radius + 2 - k * 2
    const s = (r * 0.8 * (1 - k) * (0.85 + hash2(i, flick, 23) * 0.3) + 0.5) * grow
    const rr = Math.round(s)
    const color = k > 0.72 ? '#a02010' : k > 0.42 ? '#e05018' : '#f89028'
    if (rr < 1) {
      ctx.fillStyle = color
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
      continue
    }
    blitEllipse(ctx, rr, Math.max(1, Math.round(s * 0.8)), color, x, y)
    if (k < 0.3 && rr > 1) blitEllipse(ctx, rr - 1, Math.max(0, Math.round(s * 0.8) - 1), '#f8d050', x, y - 1)
  }
  // Loose embers float up off the ribbon.
  if (!detail.lean) {
    for (let i = 0; i < 3; i++) {
      const phase = (t * 2.4 + hash2(a.id, i, 20)) % 1
      const back = m.angle - dir * (0.15 + hash2(a.id, i, 21) * 0.6)
      ctx.fillStyle = phase < 0.5 ? '#f8d050' : '#e85818'
      ctx.fillRect(Math.round(cx + Math.cos(back) * m.radius + (hash2(a.id, i, 22) - 0.5) * 4), Math.round(cy + Math.sin(back) * m.radius - phase * 9), 1, 1)
    }
  }
  // It leans back from where it whirls: the tangent's sideways part tips the flame.
  const tangent = -Math.sin(m.angle) * dir
  const lean = Math.max(-2, Math.min(2, Math.round(-tangent * 2.4)))
  const size = Math.max(2, Math.round(r * grow))
  blitFlame(ctx, flameFrame(size, lean, Math.floor((t * 14 + a.id * 1.7) % 4)), a.x, a.y + size + 1)
}

/* ---------------- Swift and Razor Leaf: trails ---------------- */

const SPARKLE_COLORS = ['#ffffff', '#fff8a0', '#f8d830'] as const

/** A four-point twinkle of arm `s` px. */
const twinkle = (ctx: Ctx, x: number, y: number, s: number, color: string) => {
  ctx.fillStyle = color
  ctx.fillRect(x - s, y, s * 2 + 1, 1)
  ctx.fillRect(x, y - s, 1, s * 2 + 1)
}

/**
 * Swift: the spinning star over a soft pulsing glow, trailing twinkles that
 * flash and fade where it passed.
 */
export const drawSwift = (ctx: Ctx, a: Attack, t: number) => {
  const angle = flightAngle(a.motion) ?? 0
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const trail = detail.lean ? 2 : 5
  for (let i = 0; i < trail; i++) {
    const back = 6 + i * 5
    if (back > a.age * 170) break
    const wig = Math.sin(a.age * 20 + i * 1.7) * 2
    const x = Math.round(a.x - cos * back - sin * wig)
    const y = Math.round(a.y - sin * back + cos * wig)
    const flash = (t * 9 + i * 0.37 + a.id * 0.13) % 1
    const s = i < 2 ? (flash < 0.5 ? 2 : 1) : flash < 0.3 ? 1 : 0
    twinkle(ctx, x, y, s, SPARKLE_COLORS[Math.min(2, i >> 1)]!)
  }
  const pulse = Math.round(5 + Math.sin(t * 14 + a.id) * 1.2)
  ctx.globalAlpha = 0.28
  blitEllipse(ctx, pulse, pulse, '#fff8c0', a.x, a.y)
  ctx.globalAlpha = 1
  const sprite = FX.star()
  ctx.save()
  ctx.translate(Math.round(a.x), Math.round(a.y))
  ctx.rotate(a.age * 9)
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
  ctx.restore()
}

/** Razor Leaf: two fading afterimages of the spinning leaf along the way it came, so the spin reads as a slice. */
export const drawRazorLeaf = (ctx: Ctx, a: Attack) => {
  const m = a.motion
  const scale = a.shape.kind === 'circle' ? Math.max(1, Math.round(a.shape.r / 6)) : 1
  const leaf = FX.leaf()
  const spin = a.age * 16
  if (m.kind === 'boomerang' || m.kind === 'linear' || m.kind === 'homing') {
    const speed = Math.hypot(m.vx, m.vy)
    if (speed > 30) {
      for (const [i, alpha] of [[2, 0.18], [1, 0.38]] as const) {
        const dt = i * 0.018
        ctx.globalAlpha = alpha
        drawSpun(ctx, leaf, a.x - m.vx * dt, a.y - m.vy * dt, spin - i * 0.5, scale)
      }
      ctx.globalAlpha = 1
    }
  }
  drawSpun(ctx, leaf, a.x, a.y, spin, scale)
  // A glint runs along the blade twice a turn.
  if (Math.floor(spin / Math.PI) % 2 === 0 && (spin % Math.PI) < 0.5) twinkle(ctx, Math.round(a.x + Math.cos(spin) * 2), Math.round(a.y + Math.sin(spin) * 2), 1, '#ffffff')
}

const drawSpun = (ctx: Ctx, sprite: PixelSprite, x: number, y: number, angle: number, scale: number) => {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(angle)
  if (scale !== 1) ctx.scale(scale, scale)
  ctx.drawImage(sprite, -sprite.width / 2, -sprite.height / 2)
  ctx.restore()
}

/* ---------------- Thunder: a forked bolt that cracks the ground ---------------- */

/** How high the bolt starts above its target, px. */
const BOLT_HEIGHT = 190

type BoltStyle = { glow: string; edge: string; core: string }
const THUNDER_STYLE: BoltStyle = { glow: 'rgba(248,240,128,0.35)', edge: '#f8d030', core: '#ffffff' }

/** A run of pixels from (x0, y0) to (x1, y1), `w` wide, in one color. */
const line = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number) => {
  const n = Math.max(1, Math.round(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  const h = Math.floor(w / 2)
  for (let s = 0; s <= n; s++) ctx.fillRect(Math.round(x0 + ((x1 - x0) * s) / n) - h, Math.round(y0 + ((y1 - y0) * s) / n) - h, w, w)
}

/**
 * A lightning bolt from `height` px above (x, y) down to it, its zigzag drawn
 * from `seed` (the same seed draws the same bolt), `width` its core's
 * thickness. Two branches fork off on the way down. Layers: a pale glow, the
 * yellow body, the white core.
 */
const forkedBolt = (ctx: Ctx, x: number, y: number, height: number, seed: number, width: number, style: BoltStyle) => {
  const pts: { x: number; y: number }[] = [{ x: x + (hash2(seed, 0, 1) - 0.5) * 30, y: y - height }]
  let yy = y - height
  for (let i = 1; yy < y; i++) {
    yy = Math.min(y, yy + 9 + hash2(seed, i, 2) * 9)
    const k = (yy - (y - height)) / height
    // The zigzag closes in on the target as it nears the ground.
    const spread = 16 * (1 - k * k)
    pts.push({ x: yy >= y ? x : x + (hash2(seed, i, 3) - 0.5) * spread + (pts[0]!.x - x) * (1 - k), y: yy })
  }
  const branches: { x0: number; y0: number; pts: { x: number; y: number }[] }[] = []
  for (let b = 0; b < 2; b++) {
    const at = pts[1 + Math.floor(hash2(seed, b, 4) * Math.max(1, pts.length - 3))]!
    const side = b === 0 ? -1 : 1
    const bp = [at]
    let bx = at.x
    let by = at.y
    // Short kinks that keep heading out and down, zigzagging across their own way.
    for (let i = 0; i < 5; i++) {
      bx += side * (2 + hash2(seed, b * 9 + i, 5) * 5) + (i % 2 ? -1 : 1) * hash2(seed, b * 9 + i, 7) * 3
      by += 3 + hash2(seed, b * 9 + i, 6) * 5
      bp.push({ x: bx, y: by })
    }
    branches.push({ x0: at.x, y0: at.y, pts: bp })
  }
  const stroke = (list: readonly { x: number; y: number }[], w: number) => {
    for (let i = 1; i < list.length; i++) line(ctx, list[i - 1]!.x, list[i - 1]!.y, list[i]!.x, list[i]!.y, w)
  }
  if (!detail.lean) {
    ctx.fillStyle = style.glow
    stroke(pts, width + 4)
  }
  ctx.fillStyle = style.edge
  stroke(pts, width + 2)
  for (const br of branches) {
    stroke(br.pts.slice(0, 3), Math.max(1, width - 1))
    stroke(br.pts.slice(2), 1)
  }
  ctx.fillStyle = style.core
  stroke(pts, width)
  for (const br of branches) stroke(br.pts.slice(0, 3), 1)
}

/**
 * Thunder in the air: before it lands, sparks crackle down into the warning
 * ring; at the strike a thick white bolt with a flash, then it thins and
 * flickers out, re-forking every few frames as real lightning re-strikes.
 */
export const drawThunder = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a, 16)
  if (a.age < a.activeFrom) {
    // The last moments before it falls: a faint leader feeling its way down.
    const k = a.age / a.activeFrom
    if (k > 0.6 && Math.floor(a.age * 60) % 3 !== 0) {
      ctx.globalAlpha = 0.5
      forkedBolt(ctx, a.x, a.y - BOLT_HEIGHT * (1 - k) * 0.6, BOLT_HEIGHT * (0.3 + (k - 0.6)), a.id * 31 + Math.floor(a.age * 40), 1, { glow: 'transparent', edge: '#f8e878', core: '#fffff0' })
      ctx.globalAlpha = 1
    }
    return
  }
  const since = a.age - a.activeFrom
  const left = a.ttl - a.activeFrom
  const e = since / left
  // Thick and white at the strike, then thinner each re-strike until it's gone.
  const width = since < 0.05 ? 3 : e < 0.45 ? 2 : 1
  const seed = a.id * 97 + Math.floor(since * 22)
  if (e < 0.85 && !(e > 0.45 && Math.floor(since * 40) % 2 === 1)) {
    forkedBolt(ctx, a.x, a.y, BOLT_HEIGHT, seed, width, since < 0.05 ? { glow: 'rgba(255,255,255,0.5)', edge: '#fff8c0', core: '#ffffff' } : THUNDER_STYLE)
  }
  // The flash where it hits.
  if (since < 0.06) {
    blitEllipse(ctx, Math.round(r * 1.1), Math.round(r * 0.6), '#ffffff', a.x, a.y)
    blitEllipse(ctx, Math.round(r * 0.6), Math.round(r * 0.9), '#ffffff', a.x, a.y - 4)
  } else if (since < 0.16) {
    ctx.globalAlpha = 1 - (since - 0.06) / 0.1
    blitEllipse(ctx, Math.round(r), Math.round(r * 0.5), 'rgba(255,248,160,0.8)', a.x, a.y)
    ctx.globalAlpha = 1
  }
  // Sparks thrown out of the impact, zigzagging as they go.
  if (since < 0.22 && !detail.lean) {
    const k = since / 0.22
    ctx.fillStyle = k < 0.5 ? '#ffffff' : '#f8d030'
    for (let i = 0; i < 7; i++) {
      const ang = (i / 7) * TAU + hash2(a.id, i, 7)
      const d = r * (0.4 + k * 1.1)
      const jag = (hash2(a.id, i, Math.floor(since * 30)) - 0.5) * 3
      const x = a.x + Math.cos(ang) * d - Math.sin(ang) * jag
      const y = a.y + Math.sin(ang) * d * 0.55 + Math.cos(ang) * jag - (1 - k) * 3
      line(ctx, x, y, x - Math.cos(ang) * 3, y - Math.sin(ang) * 2, 1)
    }
  }
}

/**
 * Thunder on the ground: a warning ring that blinks faster as the shadow of
 * the cloud gathers, and after the strike a scorch mark with cracks that cools off.
 */
export const drawThunderGround = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a, 16)
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    ctx.globalAlpha = 0.18 + k * 0.25
    blitEllipse(ctx, Math.round(r * (1.3 - k * 0.4)), Math.round(r * (0.65 - k * 0.2)), '#202838', a.x, a.y)
    ctx.globalAlpha = 1
    if (Math.floor(a.age * (14 + k * 40)) % 2 === 0) blitRing(ctx, Math.round(r), 1, '#f8e030', a.x, a.y)
    return
  }
  const since = a.age - a.activeFrom
  ctx.globalAlpha = Math.max(0, Math.min(1, (a.ttl - a.age) / 0.15)) * 0.8
  blitEllipse(ctx, Math.round(r * 0.75), Math.max(1, Math.round(r * 0.36)), 'rgba(40,32,24,0.55)', a.x, a.y)
  ctx.fillStyle = since < 0.12 ? '#fff8c0' : '#383020'
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * TAU + a.id
    let x = a.x
    let y = a.y
    for (let s = 0; s < 3; s++) {
      const nx = x + Math.cos(ang + (hash2(a.id, i * 3 + s, 8) - 0.5)) * r * 0.3
      const ny = y + Math.sin(ang + (hash2(a.id, i * 3 + s, 8) - 0.5)) * r * 0.16
      line(ctx, x, y, nx, ny, 1)
      x = nx
      y = ny
    }
  }
  ctx.globalAlpha = 1
}

/* ---------------- Sludge Bomb: a wobbling glob that splashes ---------------- */

const SLUDGE = { rim: '#381048', body: '#7a2a90', light: '#b058c8', shine: '#f0c8f8' } as const

/** Where the lobbed glob is at progress `k` (0..1) of its arc. */
const lobAt = (a: Attack, k: number) => ({ x: a.from.x + (a.x - a.from.x) * k, y: a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 40 })

/**
 * Sludge Bomb in the air: a glob that wobbles as it flies, dripping down the
 * arc behind it; at the landing a splash of droplets thrown out and falling back.
 */
export const drawSludge = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < a.activeFrom) {
    const k = a.age / a.activeFrom
    const p = lobAt(a, k)
    // Drips left behind on the arc, falling off it.
    for (let i = 1; i <= 3; i++) {
      const kk = k - i * 0.07
      if (kk <= 0) break
      const q = lobAt(a, kk)
      ctx.fillStyle = i === 1 ? SLUDGE.light : SLUDGE.body
      ctx.fillRect(Math.round(q.x), Math.round(q.y + i * i), i === 1 ? 2 : 1, i === 1 ? 2 : 1)
    }
    // Squash and stretch: long while it rises and falls fast, round at the top.
    const vy = Math.cos(k * Math.PI)
    const wob = Math.sin(t * 30 + a.id) * 0.5
    const rx = Math.round(4 - Math.abs(vy) + wob)
    const ry = Math.round(3 + Math.abs(vy) - wob)
    blitEllipse(ctx, rx, ry, SLUDGE.rim, p.x, p.y)
    blitEllipse(ctx, rx - 1, ry - 1, SLUDGE.body, p.x, p.y)
    blitEllipse(ctx, Math.max(1, rx - 2), Math.max(1, ry - 2), SLUDGE.light, p.x - 1, p.y - 1)
    ctx.fillStyle = SLUDGE.shine
    ctx.fillRect(Math.round(p.x - 2), Math.round(p.y - ry + 1), 1, 1)
    return
  }
  const since = a.age - a.activeFrom
  if (since > 0.4 || detail.lean) return
  // The splash: droplets on short arcs out of the impact.
  const r = radiusOf(a, 22)
  for (let i = 0; i < 9; i++) {
    const ang = (i / 9) * TAU + hash2(a.id, i, 9) * 0.6
    const dist = r * (0.5 + hash2(a.id, i, 10) * 0.5) * Math.min(1, since / 0.3)
    const hop = Math.sin(Math.min(1, since / 0.4) * Math.PI) * (6 + hash2(a.id, i, 11) * 6)
    ctx.fillStyle = i % 3 === 0 ? SLUDGE.light : SLUDGE.body
    const s = since < 0.2 ? 2 : 1
    ctx.fillRect(Math.round(a.x + Math.cos(ang) * dist), Math.round(a.y + Math.sin(ang) * dist * 0.6 - hop), s, s)
  }
}

/**
 * Sludge Bomb's puddle: a blobby pool that spreads out from the landing,
 * with bubbles that swell and pop on it until it soaks away.
 */
export const drawSludgeGround = (ctx: Ctx, a: Attack) => {
  if (a.age < a.activeFrom) {
    // The glob's shadow, growing as it nears the ground.
    const k = a.age / a.activeFrom
    blitEllipse(ctx, Math.round(2 + k * 4), Math.round(1 + k * 2), 'rgba(24,8,32,0.3)', a.x, a.y)
    return
  }
  const r = radiusOf(a, 22)
  const fade = Math.min(1, (a.ttl - a.age) / 0.3)
  const since = a.age - a.activeFrom
  const grow = Math.min(1, since / 0.14) * (since < 0.14 ? 1.15 : 1)
  ctx.globalAlpha = fade * 0.72
  // Lobes at fixed offsets make the pool irregular, not a perfect ellipse.
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * TAU + a.id
    const ox = Math.cos(ang) * r * 0.32 * grow
    const oy = Math.sin(ang) * r * 0.2 * grow
    const s = 0.55 + hash2(a.id, i, 12) * 0.2
    blitEllipse(ctx, Math.round(r * s * grow), Math.round(r * s * 0.62 * grow), SLUDGE.rim, a.x + ox, a.y + oy)
  }
  // Solid colors under one alpha: the lobes merge into one pool instead of darkening where they overlap.
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * TAU + a.id
    const s = 0.55 + hash2(a.id, i, 12) * 0.2
    blitEllipse(ctx, Math.round((r * s - 2) * grow), Math.round((r * s - 2) * 0.62 * grow), SLUDGE.body, a.x + Math.cos(ang) * r * 0.32 * grow, a.y + Math.sin(ang) * r * 0.2 * grow - 1)
  }
  blitEllipse(ctx, Math.round(r * 0.55 * grow), Math.round(r * 0.32 * grow), SLUDGE.light, a.x - r * 0.08, a.y - r * 0.06)
  blitEllipse(ctx, Math.round(r * 0.22 * grow), Math.round(r * 0.1 * grow), SLUDGE.shine, a.x - r * 0.2, a.y - r * 0.14)
  if (!detail.lean && since > 0.15) {
    for (let i = 0; i < 5; i++) {
      const period = 0.7 + hash2(a.id, i, 13) * 0.6
      const phase = ((a.age + hash2(a.id, i, 14) * period) % period) / period
      const ang = hash2(a.id, i, 15) * TAU
      const d = Math.sqrt(hash2(a.id, i, 16)) * r * 0.6
      const x = a.x + Math.cos(ang) * d
      const y = a.y + Math.sin(ang) * d * 0.55
      if (phase < 0.8) {
        const s = Math.round(phase * 3)
        blitEllipse(ctx, s, Math.max(0, s - (s > 1 ? 1 : 0)), SLUDGE.light, x, y - s)
        if (s > 0) {
          ctx.fillStyle = SLUDGE.shine
          ctx.fillRect(Math.round(x - Math.max(0, s - 1)), Math.round(y - s * 2 + 1), 1, 1)
        }
      } else if (phase < 0.9) blitRing(ctx, 3, 1, SLUDGE.shine, x, y - 2)
    }
  }
  ctx.globalAlpha = 1
}

/* ---------------- Gust: a spinning gale ---------------- */

/**
 * Gust: three comma-shaped wind strokes whirling outward with the ring, a
 * thin white swirl inside and a few leaves caught in it.
 */
export const drawGust = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a, 6)
  const k = a.age / a.ttl
  ctx.globalAlpha = Math.max(0, Math.min(1, (1 - k) * 1.6))
  const spin = a.age * 11 + a.id
  for (let s = 0; s < 3; s++) {
    const start = spin + (s * TAU) / 3
    // Each stroke sweeps a third of the way round, thick at its head and thinning to a wisp.
    const steps = Math.max(8, Math.round(r * 1.6))
    for (let i = 0; i < steps; i++) {
      const f = i / steps
      const ang = start - f * 1.9
      const rr = r * (1 - f * 0.25)
      const x = Math.round(a.x + Math.cos(ang) * rr)
      const y = Math.round(a.y + Math.sin(ang) * rr * 0.6)
      const thick = f < 0.2 ? 3 : f < 0.5 ? 2 : 1
      // A cool shadow under each stroke keeps the white readable on pale ground.
      ctx.fillStyle = '#7080a8'
      ctx.fillRect(x, y + thick, thick, 1)
      ctx.fillStyle = f < 0.2 ? '#ffffff' : f < 0.6 ? '#e8f0ff' : '#b8c8e8'
      ctx.fillRect(x, y, thick, thick)
    }
  }
  // An inner swirl turning the other way.
  ctx.fillStyle = '#ffffff'
  for (let i = 0; i < 10; i++) {
    const ang = -spin * 1.4 + i * 0.35
    const rr = r * 0.45 * (1 - i / 14)
    ctx.fillRect(Math.round(a.x + Math.cos(ang) * rr), Math.round(a.y + Math.sin(ang) * rr * 0.6), 1, 1)
  }
  if (!detail.lean) {
    for (let i = 0; i < 3; i++) {
      const ang = spin * 0.8 + i * 2.1
      const rr = r * (0.7 + 0.25 * Math.sin(a.age * 9 + i))
      const x = Math.round(a.x + Math.cos(ang) * rr)
      const y = Math.round(a.y + Math.sin(ang) * rr * 0.6 - 2)
      ctx.fillStyle = '#58a838'
      ctx.fillRect(x, y, 2, 1)
      ctx.fillStyle = '#a8e870'
      ctx.fillRect(x + (Math.floor(ang * 2) % 2 ? 1 : 0), y - 1, 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

/* ---------------- Vine Whip: a lash that cracks ---------------- */

const VINE = { dark: '#183810', mid: '#4a9a30', light: '#88d058', shine: '#c8f090', leaf: '#68c040' } as const

/**
 * Vine Whip: the vine shoots out with a wave running down it to the tip,
 * leaves alternating along it; at full stretch the tip snaps with a crack.
 */
export const drawVineWhip = (ctx: Ctx, a: Attack) => {
  if (a.shape.kind !== 'rect') return
  const length = a.shape.w
  const dir = a.flip ? -1 : 1
  const out = Math.min(1, a.age / 0.07)
  // Eased out, so it whips fast and slows into the stretch; in its last moments it snaps back in.
  const back = Math.min(1, (a.ttl - a.age) / 0.07)
  const reach = length * (1 - (1 - out) * (1 - out)) * (back * (2 - back))
  const startX = a.x - (dir * length) / 2
  const wave = (i: number) => {
    const f = i / length
    // The wave grows toward the tip and settles once the lash is out.
    const amp = 1 + f * 3 * (1 - Math.min(1, Math.max(0, a.age - 0.07) / 0.12))
    return Math.sin(i * 0.22 - a.age * 45) * amp
  }
  for (let i = 0; i < reach; i++) {
    const x = Math.round(startX + dir * i)
    const y = Math.round(a.y + wave(i))
    // Five pixels thick (outline, a lit top, the body), tapering to three near the tip.
    const thin = i > reach - 8 ? 1 : 0
    ctx.fillStyle = VINE.dark
    ctx.fillRect(x, y - 2 + thin, 1, 5 - thin * 2)
    ctx.fillStyle = VINE.mid
    ctx.fillRect(x, y - 1 + thin, 1, 3 - thin * 2 || 1)
    ctx.fillStyle = i % 8 < 3 ? VINE.shine : VINE.light
    ctx.fillRect(x, y - 1 + thin, 1, 1)
    // Thorn nubs every few pixels along its underside.
    if (!thin && i % 8 === 4) {
      ctx.fillStyle = VINE.dark
      ctx.fillRect(x, y + 3, 1, 1)
    }
    // Leaves on alternate sides, each a little 3-pixel blade.
    if (i % 12 === 6 && i < reach - 6) {
      const up = (i / 12) % 2 < 1 ? -1 : 1
      ctx.fillStyle = VINE.dark
      ctx.fillRect(x - dir, y + up * 3, 3, 1)
      ctx.fillStyle = VINE.leaf
      ctx.fillRect(x, y + up * 3, 2, 1)
      ctx.fillRect(x + dir, y + up * 4, 1, 1)
    }
  }
  // The tip: a curled bud, and the crack as the whip reaches full stretch.
  const tipX = Math.round(startX + dir * reach)
  const tipY = Math.round(a.y + wave(reach))
  ctx.fillStyle = VINE.dark
  ctx.fillRect(tipX - 1, tipY - 2, 3, 3)
  ctx.fillStyle = VINE.light
  ctx.fillRect(tipX, tipY - 1, 1, 1)
  const crack = a.age - 0.06
  if (crack >= 0 && crack < 0.08) {
    const s = crack < 0.03 ? 4 : 2
    ctx.fillStyle = crack < 0.03 ? '#ffffff' : '#e8f8c0'
    ctx.fillRect(tipX + dir * 2, tipY - s, 1, s * 2 + 1)
    ctx.fillRect(tipX + dir * 2 - s, tipY, s * 2 + 1, 1)
    ctx.fillRect(tipX + dir * (2 + s - 1), tipY - s + 1, 1, 1)
    ctx.fillRect(tipX + dir * (2 + s - 1), tipY + s - 1, 1, 1)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Rock Tomb: the landing ---------------- */

/** Rock Tomb's landing: chips of stone thrown up out of a dust cloud that rolls out and settles. */
export const drawRockTombLanding = (ctx: Ctx, a: Attack) => {
  const since = a.age - a.activeFrom
  if (since < 0 || since > 0.45) return
  const r = radiusOf(a, 12)
  const k = since / 0.45
  if (!detail.lean) {
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * TAU + hash2(a.id, i, 17)
      const d = r * (0.3 + k * (0.7 + hash2(a.id, i, 18) * 0.5))
      const hop = Math.sin(Math.min(1, k * 1.4) * Math.PI) * (8 + hash2(a.id, i, 19) * 8)
      ctx.fillStyle = i % 2 === 0 ? '#685028' : '#a08048'
      const x = Math.round(a.x + Math.cos(ang) * d)
      const y = Math.round(a.y + Math.sin(ang) * d * 0.5 - hop)
      ctx.fillRect(x, y, 2, 2)
      ctx.fillStyle = '#d8c080'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  // Dust puffs rolling out low and fading.
  ctx.globalAlpha = (1 - k) * 0.8
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * TAU + a.id
    const d = r * (0.5 + k * 0.7)
    const s = Math.round(3 + k * 3)
    blitEllipse(ctx, s, Math.max(1, Math.round(s * 0.7)), i % 2 ? '#e0d0a8' : '#c8b088', a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.45 - 2)
  }
  ctx.globalAlpha = 1
}

/* ---------------- Psyshock: a spinning psychic orb ---------------- */

const PSY_RAMP = ['#581040', '#a02060', '#e04080', '#f880b0', '#ffd8ec'] as const

/**
 * A psychic orb of radius `r`, lit from the upper left, with a spiral that
 * turns inside it over `PSY_FRAMES` frames.
 */
const PSY_FRAMES = 6
const psyOrb = (r: number, frame: number) => frameOf(`psy${r}`, PSY_FRAMES, r * 2 + 1, r * 2 + 1, frame, (ctx, i) => paintPsyOrb(ctx, r, i))

const paintPsyOrb = (ctx: Ctx, r: number, frame: number) => {
  const size = r * 2 + 1
  const n = PSY_RAMP.length
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - r) / (r + 0.4)
      const dy = (y - r) / (r + 0.4)
      const d2 = dx * dx + dy * dy
      if (d2 > 1) continue
      const dz = Math.sqrt(1 - d2)
      // Lambert from the upper left, plus the spiral's bright arms.
      let light = 0.15 + 0.7 * Math.max(0, -dx * 0.5 - dy * 0.6 + dz * 0.62)
      const arm = Math.sin(Math.atan2(dy, dx) * 2 + Math.sqrt(d2) * 7 - (frame / PSY_FRAMES) * TAU)
      if (arm > 0.55 && d2 < 0.8) light += 0.25
      // A dark rim so it reads on grass and sand alike.
      if (d2 > 0.74) light = 0
      ctx.fillStyle = PSY_RAMP[Math.max(0, Math.min(n - 1, Math.floor(light * n)))]!
      ctx.fillRect(x, y, 1, 1)
    }
  }
}

/** Half of a tilted ring around (x, y): the back half (behind the orb) or the front. */
const orbitRing = (ctx: Ctx, x: number, y: number, rx: number, ry: number, tilt: number, front: boolean, color: string) => {
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const steps = Math.round(rx * 4)
  ctx.fillStyle = color
  for (let i = 0; i < steps; i++) {
    const th = (i / steps) * TAU
    if (Math.sin(th) > 0 !== front) continue
    // The back half is broken up, as if seen through the orb's glow.
    if (!front && i % 3 === 2) continue
    const px = Math.cos(th) * rx
    const py = Math.sin(th) * ry
    ctx.fillRect(Math.round(x + px * cos - py * sin), Math.round(y + px * sin + py * cos), 1, 1)
  }
}

/**
 * Psyshock: a shaded orb with a spiral turning inside, a tilted ring of
 * psychic energy wrapping round it, and two fading afterimages along its way.
 */
export const drawPsyshock = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const r = Math.max(3, Math.round(radiusOf(a, 6) * 0.75))
  const frame = Math.floor(t * 14 + a.id) % PSY_FRAMES
  const orb = psyOrb(r, frame)
  if ((m.kind === 'boomerang' || m.kind === 'linear' || m.kind === 'homing') && !detail.lean) {
    for (const [i, alpha] of [[2, 0.15], [1, 0.32]] as const) {
      ctx.globalAlpha = alpha
      blitCell(ctx, orb, a.x - m.vx * i * 0.022, a.y - m.vy * i * 0.022)
    }
    ctx.globalAlpha = 1
  }
  const tilt = t * 2.6 + a.id
  const rx = r + 3
  const ry = Math.max(1, Math.round((r + 3) * 0.35))
  orbitRing(ctx, a.x, a.y, rx, ry, tilt, false, '#a03068')
  blitCell(ctx, orb, a.x, a.y)
  orbitRing(ctx, a.x, a.y, rx, ry, tilt, true, '#ffffff')
}

/* ---------------- Pyro Ball: a blazing lob that erupts ---------------- */

/** The eruption's dome colors (rim, middle, core) as it cools. */
const PYRO_COOLING = [
  ['#e85818', '#f8a030', '#ffffff'],
  ['#c83818', '#e86020', '#f8b838'],
  ['#802010', '#b83018', '#e05818'],
] as const

/** The cooling puffs the ball sheds along its arc, newest first (radius, color). */
const PYRO_TRAIL = [
  [3, '#f8d050'],
  [3, '#f07020'],
  [2, '#c83818'],
  [1, '#802010'],
] as const

/**
 * Pyro Ball: on its way, Cinderace's kicked ball, round and spinning with its
 * charred patches, shedding cooling puffs along its arc over its shadow on the
 * ground; on landing, a white flash, then a dome of fire with flames shooting
 * up round its rim, and smoke rolling off as it dies down.
 */
export const drawPyroBall = (ctx: Ctx, a: Attack, t: number) => {
  if (a.age < a.activeFrom) {
    const at = (k: number) => ({
      x: a.from.x + (a.x - a.from.x) * k,
      y: a.from.y + (a.y - a.from.y) * k,
      lift: Math.sin(k * Math.PI) * 50,
    })
    const k = a.age / a.activeFrom
    const ball = at(k)
    // Its shadow, under the arc: smaller and fainter the higher the ball flies.
    const high = ball.lift / 50
    ctx.globalAlpha = 0.35 - high * 0.15
    blitEllipse(ctx, Math.round(5 - high * 2), Math.round(2 - high), '#201008', ball.x, ball.y + 4)
    ctx.globalAlpha = 1
    const trail = detail.lean ? 2 : PYRO_TRAIL.length
    for (let i = trail - 1; i >= 0; i--) {
      const back = k - (i + 1) * 0.07
      if (back < 0) continue
      const p = at(back)
      const [r, color] = PYRO_TRAIL[i]!
      const jitter = (hash2(a.id, i, Math.floor(t * 20)) - 0.5) * 2
      blitEllipse(ctx, r, r, color, p.x + jitter, p.y - p.lift - jitter)
    }
    // Its glow, then the ball.
    ctx.globalAlpha = 0.35
    blitEllipse(ctx, 9, 9, '#f8a030', ball.x, ball.y - ball.lift)
    ctx.globalAlpha = 1
    const spin = FX.pyroBall()[a.x >= a.from.x ? 'right' : 'left']
    blitCentered(ctx, spin[Math.floor(t * 18 + a.id) % spin.length]!, ball.x, ball.y - ball.lift)
    return
  }
  const r = radiusOf(a, 20)
  const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
  // The scorch it leaves, under everything.
  ctx.globalAlpha = Math.max(0, 1 - e) * 0.6
  blitEllipse(ctx, Math.round(r * 0.8), Math.round(r * 0.4), '#402018', a.x, a.y + 1)
  ctx.globalAlpha = 1
  if (e < 0.08) {
    blitEllipse(ctx, Math.round(r * 0.75), Math.round(r * 0.55), '#ffffff', a.x, a.y - 2)
    return
  }
  const dome = Math.round(r * (0.45 + 0.35 * e))
  // It cools rather than fades: hot white-yellow, then orange, then embers red; only the last moments go see-through.
  const [outer, mid, core] = PYRO_COOLING[Math.min(2, Math.floor(e * 3))]!
  ctx.globalAlpha = e < 0.7 ? 1 : Math.max(0, (1 - e) / 0.3)
  blitEllipse(ctx, dome, Math.round(dome * 0.7), outer, a.x, a.y - 2)
  blitEllipse(ctx, Math.round(dome * 0.7), Math.round(dome * 0.5), mid, a.x, a.y - 3)
  blitEllipse(ctx, Math.round(dome * 0.38), Math.round(dome * 0.28), core, a.x, a.y - 4)
  blitRing(ctx, Math.round(r * (0.6 + e * 0.6)), 1, '#fff0a0', a.x, a.y)
  // Flames shooting up round the rim, tall at first and guttering.
  const tall = Math.max(2, Math.round((r * 0.32) * (1 - e * 0.7)))
  const n = detail.lean ? 4 : 7
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + a.id
    const fx = a.x + Math.cos(ang) * dome * 0.95
    const fy = a.y - 2 + Math.sin(ang) * dome * 0.65
    blitFlame(ctx, flameFrame(tall, Math.round(Math.cos(ang) * 1.5), Math.floor(t * 14 + i) % 4), fx, fy + 1 - e * 4)
  }
  ctx.globalAlpha = 1
  if (e > 0.5 && !detail.lean) {
    const s = (e - 0.5) / 0.5
    ctx.globalAlpha = (1 - s) * 0.6
    for (let i = 0; i < 3; i++) {
      const sz = Math.round(2 + s * 4)
      blitEllipse(ctx, sz, sz, i % 2 ? '#807870' : '#605850', a.x + (i - 1) * dome * 0.6, a.y - dome * 0.6 - s * 14 - i * 2)
    }
    ctx.globalAlpha = 1
  }
}

/* ---------------- Flash Cannon: a gleaming steel shot ---------------- */

/**
 * Flash Cannon: the steel orb with rings of light peeling off behind it and a
 * glint that turns on its face; it sparkles as it flies.
 */
export const drawFlashCannon = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a, 8)
  const angle = flightAngle(a.motion)
  if (angle !== null && !detail.lean) {
    for (let i = 1; i <= 3; i++) {
      const back = i * (r * 0.9 + 2)
      ctx.globalAlpha = 0.55 - i * 0.15
      blitRing(ctx, Math.max(2, Math.round(r - i)), 1, i === 1 ? '#ffffff' : '#c8d0e0', a.x - Math.cos(angle) * back, a.y - Math.sin(angle) * back)
    }
    ctx.globalAlpha = 1
  }
  const scale = Math.max(1, Math.round(r / 4))
  const orb = FX.steel()
  ctx.drawImage(orb, Math.round(a.x - (orb.width * scale) / 2), Math.round(a.y - (orb.height * scale) / 2), orb.width * scale, orb.height * scale)
  // The glint: a four-point star that grows and shrinks on the upper left of the orb.
  const g = Math.round(1 + Math.abs(Math.sin(t * 8 + a.id)) * (r * 0.45))
  twinkle(ctx, Math.round(a.x - r * 0.35), Math.round(a.y - r * 0.35), g, '#ffffff')
}

/* ---------------- Whirlpool: a vortex around the player ---------------- */

/**
 * Whirlpool's water on the ground: a pale pool with four spiral arms curling
 * into a dark eye, foam riding its rim and bubbles welling up and popping.
 * It turns the whole time it's out, so it reads as a current, not a disc.
 */
export const drawWhirlpool = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a, 34)
  const x0 = a.x
  const y0 = a.y - 4
  blitEllipse(ctx, Math.round(r), Math.round(r), 'rgba(72,136,232,0.16)', x0, y0)
  blitEllipse(ctx, Math.max(2, Math.round(r * 0.14)), Math.max(2, Math.round(r * 0.14)), 'rgba(24,56,144,0.35)', x0, y0)
  const spin = t * 2.2
  const arms = 4
  const steps = Math.max(12, Math.round(r * (detail.lean ? 0.6 : 1.3)))
  for (let j = 0; j < arms; j++) {
    for (let i = 0; i < steps; i++) {
      const f = i / steps
      // From the rim inward, curling round as it falls toward the eye.
      const ang = spin + (j * TAU) / arms + f * 2.6
      const rr = r * (0.97 - f * 0.8)
      const x = Math.round(x0 + Math.cos(ang) * rr)
      const y = Math.round(y0 + Math.sin(ang) * rr)
      ctx.fillStyle = f < 0.2 ? '#ffffff' : f < 0.55 ? '#a8d8f8' : '#6898e8'
      ctx.fillRect(x, y, f < 0.3 ? 2 : 1, 1)
    }
  }
  // Foam riding the rim, and a slower inner current the other way.
  dashedRing(ctx, x0, y0, r, t * 5, ['#ffffff', '#d8f0ff', '#a8d0f8'], 0.5)
  dashedRing(ctx, x0, y0, r * 0.45, -t * 7, ['#a8d0f8', '#ffffff'], 0.3)
  if (detail.lean) return
  for (let i = 0; i < 4; i++) {
    const period = 0.9 + hash2(a.id, i, 24) * 0.5
    const phase = ((t + hash2(a.id, i, 25) * period) % period) / period
    const ang = hash2(a.id, i, 26) * TAU + spin * 0.5
    const d = r * (0.25 + hash2(a.id, i, 27) * 0.5)
    const x = x0 + Math.cos(ang) * d
    const y = y0 + Math.sin(ang) * d
    if (phase < 0.75) blitRing(ctx, Math.round(phase * 2.4), 1, '#d8f0ff', x, y)
    else if (phase < 0.85) twinkle(ctx, Math.round(x), Math.round(y), 1, '#ffffff')
  }
}

/* ---------------- Dragon Breath: billowing dragonfire ---------------- */

const DRAGON_RAMP = ['#200858', '#4820a8', '#7038f8', '#a070f8', '#d8c0ff', '#ffffff'] as const
/** Three sizes the puffs pass through as they swell. */
const DRAGON_SMOKE = ['#100420', '#200a48', '#341878', '#4c2ca8', '#6c50c8'] as const
const dragonPuff = (head: number, ramp: readonly string[]) => ({ head, tail: head * 1.5, ramp, lick: 1.2, ragged: true, glint: null, front: 0.3, lit: 0, stretch: [1, 1.1, 0.95, 1.05] }) satisfies Comet
const DRAGON_PUFFS = [2.4, 3.8, 5.4].map((head) => dragonPuff(head, DRAGON_RAMP))
/** The same puffs burnt down to violet smoke, for their last moments. */
const DRAGON_SMOKES = [2.4, 3.8, 5.4].map((head) => dragonPuff(head, DRAGON_SMOKE))

/**
 * Dragon Breath: each puff a tongue of violet dragonfire licking along its
 * way, swelling as it spreads and cooling to a dark smoke as it dies.
 */
export const drawDragonBreath = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a, 4)
  const angle = flightAngle(a.motion) ?? 0
  const size = r < 4.5 ? 0 : r < 7 ? 1 : 2
  const k = a.age / a.ttl
  // It burns down to smoke rather than fading, and only thins out at the very end.
  const smoke = k > 0.62
  ctx.globalAlpha = k < 0.85 ? 1 : Math.max(0, (1 - k) / 0.15)
  blitCell(ctx, cometFrame(`${smoke ? 'dragonSmoke' : 'dragon'}${size}`, (smoke ? DRAGON_SMOKES : DRAGON_PUFFS)[size]!, dirOf(angle), Math.floor(t * 16 + a.id) % 4), a.x, a.y)
  ctx.globalAlpha = 1
  if (!detail.lean && k > 0.3) {
    // Embers of it shed sideways and drift up.
    for (let i = 0; i < 2; i++) {
      const phase = (t * 3 + hash2(a.id, i, 28)) % 1
      const side = i ? 1 : -1
      ctx.fillStyle = phase < 0.5 ? '#d8c0ff' : '#7038f8'
      ctx.fillRect(Math.round(a.x - Math.cos(angle) * r * 0.8 - Math.sin(angle) * side * r * 0.6), Math.round(a.y - Math.sin(angle) * r * 0.8 + Math.cos(angle) * side * r * 0.6 - phase * 6), 1, 1)
    }
  }
}

/* ---------------- Pin Missile and Crunch ---------------- */

/** Pin Missile: each needle flies on a puff of exhaust, sparks at its tail and a short smoke trail behind. */
export const drawPinMissile = (ctx: Ctx, a: Attack, t: number) => {
  const angle = flightAngle(a.motion) ?? 0
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  if (!detail.lean) {
    for (let i = 0; i < 4; i++) {
      const back = 5 + i * 2.5
      if (back > a.age * 260) break
      const wob = (hash2(a.id, i, Math.floor(t * 30)) - 0.5) * 2
      const x = Math.round(a.x - cos * back - sin * wob)
      const y = Math.round(a.y - sin * back + cos * wob)
      ctx.fillStyle = i === 0 ? '#fff8c0' : i === 1 ? '#f8d050' : i === 2 ? '#d8d0c0' : '#a8a098'
      ctx.fillRect(x, y, 1, 1)
    }
  }
  const pin = FX.pin()
  ctx.save()
  ctx.translate(Math.round(a.x), Math.round(a.y))
  ctx.rotate(angle)
  ctx.drawImage(pin, -pin.width / 2, -pin.height / 2)
  ctx.restore()
}

/**
 * Crunch: the jaws open wide (anticipation), then snap shut fast; on the bite
 * they shudder, a star flashes between the teeth and chips fly off.
 */
export const drawCrunch = (ctx: Ctx, a: Attack, spark: (x: number, y: number, size: number) => void) => {
  const r = radiusOf(a, 10)
  const scale = Math.max(1, Math.round(r / 7))
  const { top, bottom } = FX.jaws()
  const k = Math.min(1, a.age / a.activeFrom)
  // Open from 0.9r to 1.15r over the first 60%, then slam shut (ease in).
  const open = k < 0.6 ? 0.9 + (k / 0.6) * 0.25 : 1.15 * (1 - ((k - 0.6) / 0.4) ** 2)
  const gap = Math.round(open * r * 0.9)
  const bit = a.age - a.activeFrom
  const shake = bit >= 0 && bit < 0.08 ? (Math.floor(bit * 60) % 2 ? 1 : -1) : 0
  const half = (top.height * scale) / 2
  ctx.globalAlpha = a.age > a.activeUntil ? Math.max(0, 1 - (a.age - a.activeUntil) / (a.ttl - a.activeUntil)) : 1
  const x = Math.round(a.x + shake)
  ctx.drawImage(top, Math.round(x - (top.width * scale) / 2), Math.round(a.y - gap - half * 2), top.width * scale, top.height * scale)
  ctx.drawImage(bottom, Math.round(x - (bottom.width * scale) / 2), Math.round(a.y + gap), bottom.width * scale, bottom.height * scale)
  if (bit >= 0) {
    spark(a.x, a.y, Math.round(r * 0.9))
    if (bit < 0.2 && !detail.lean) {
      const e = bit / 0.2
      for (let i = 0; i < 5; i++) {
        const ang = -Math.PI / 2 + (i - 2) * 0.55 + hash2(a.id, i, 29) * 0.3
        const d = r * (0.4 + e * 0.9)
        ctx.fillStyle = i % 2 ? '#ffffff' : '#a89888'
        ctx.fillRect(Math.round(a.x + Math.cos(ang) * d), Math.round(a.y + Math.sin(ang) * d * 0.7 + e * e * 10), 1, 1)
      }
    }
  }
  ctx.globalAlpha = 1
}

/* ---------------- Earthquake: a heaving shockwave ---------------- */

const EARTH = { deep: '#3a2410', dark: '#5a3a18', mid: '#a07840', light: '#e0c068' } as const

/**
 * Earthquake on the ground: the front of the wave heaves the earth up into a
 * jagged ridge (dark under, lit on top) that rolls outward, rocks hopping on
 * it and dust kicked up behind; cracks split out from the middle as it goes.
 */
export const drawEarthquake = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a, 8)
  const k = a.age / a.ttl
  ctx.globalAlpha = k < 0.7 ? 1 : Math.max(0, (1 - k) / 0.3)
  // Cracks from the middle out to just behind the front, two pixels wide with a lit edge.
  for (let i = 0; i < 7; i++) {
    const base = (i / 7) * TAU + a.id
    let x = a.x
    let y = a.y
    let heading = base
    const reach = r * 0.85
    // A walk that drifts a little each step, the way a crack wanders, and forks nowhere.
    for (let d = 3; d < reach; d += 3) {
      heading += (hash2(a.id, i * 40 + d, 30) - 0.5) * 0.9
      heading += (base - heading) * 0.3
      const nx = x + Math.cos(heading) * 3
      const ny = y + Math.sin(heading) * 3
      ctx.fillStyle = EARTH.light
      line(ctx, x, y + 1, nx, ny + 1, 1)
      ctx.fillStyle = EARTH.deep
      line(ctx, x, y, nx, ny, d < reach * 0.5 ? 2 : 1)
      x = nx
      y = ny
    }
  }
  // The ridge: earth heaved up along the front, a shadow under it and its top catching the light.
  const rr = Math.round(r)
  const tall = k < 0.5 ? 2 : 1
  blitRing(ctx, rr, 1, EARTH.deep, a.x, a.y + 1)
  blitRing(ctx, rr, 1 + tall, EARTH.mid, a.x, a.y - tall)
  blitRing(ctx, rr, 1, EARTH.light, a.x, a.y - tall - 1)
  if (!detail.lean) {
    // Rocks hopping on the ridge.
    for (let i = 0; i < 9; i++) {
      const ang = (i / 9) * TAU + hash2(a.id, i, 32)
      const hop = Math.abs(Math.sin(a.age * 14 + i * 1.7)) * (3 + hash2(a.id, i, 33) * 4)
      const x = Math.round(a.x + Math.cos(ang) * r)
      const y = Math.round(a.y + Math.sin(ang) * r - 3 - hop)
      ctx.fillStyle = EARTH.dark
      ctx.fillRect(x, y, 2, 2)
      ctx.fillStyle = EARTH.light
      ctx.fillRect(x, y, 1, 1)
    }
    // Dust rolling up behind the front.
    ctx.globalAlpha *= 0.55
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * TAU + a.id * 0.7
      const d = Math.max(0, r - 5)
      const s = 2 + Math.round(hash2(a.id, i, 34) * 2 + k * 2)
      blitEllipse(ctx, s, Math.max(1, s - 1), i % 2 ? '#e0d0a8' : '#c8b088', a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d - 3)
    }
  }
  ctx.globalAlpha = 1
}
