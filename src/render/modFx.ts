import { blitCentered, blitEllipse, blitRing, canvasCache, context2d, createCanvas } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import type { PokeType } from '../data/types'
import type { ModId } from '../game/mods'
import type { Attack, Motion } from '../game/types'
import { art, toIconUrl } from './art'
import { dashedRing } from './strokes'

/**
 * Art of the behavior mods (`game/mods.ts`): the lingering ground a Trail
 * leaves, a Burst's blast, an Arc's sparks, and a small icon per mod for the
 * level-up cards. Both frame passes of `draw.ts` fall through here.
 */

type Ctx = CanvasRenderingContext2D

/** Per type: [shadow, body, highlight], the ground and sparks of its mods (every type: forks reach every move). */
const PALETTES: Record<PokeType, readonly [string, string, string]> = {
  fire: ['#a02810', '#f08030', '#f8d860'],
  water: ['#2848a8', '#6890f0', '#d0e8ff'],
  grass: ['#285818', '#78c850', '#d8f8a0'],
  electric: ['#a07800', '#f8d030', '#fff8c0'],
  normal: ['#686850', '#c8c890', '#fff8c0'],
  dark: ['#281818', '#705848', '#c0a0e0'],
  poison: ['#502060', '#a040a0', '#e8a8f0'],
  ice: ['#3878a0', '#98d8d8', '#ffffff'],
  flying: ['#4838a0', '#a890f0', '#e8e0ff'],
  bug: ['#485008', '#a8b820', '#e0f070'],
  rock: ['#584818', '#b8a038', '#e8d888'],
  ground: ['#785820', '#e0c068', '#f8f0b8'],
  ghost: ['#302048', '#705898', '#d0b8f8'],
  fighting: ['#601010', '#c03028', '#f8a080'],
  psychic: ['#982050', '#f85888', '#ffd0e0'],
  steel: ['#505068', '#b8b8d0', '#ffffff'],
  fairy: ['#a04868', '#ee99ac', '#fff0f8'],
  dragon: ['#301888', '#7038f8', '#c8b0ff'],
}

const palette = (type: PokeType) => PALETTES[type]

/**
 * The way a flying hitbox points, whatever motion a fork's mod gave it
 * (Seek homes, Boomerang curves back, Halo puts it in orbit: along the ring),
 * or null when it doesn't fly. A move's art that turns along its flight reads
 * this instead of checking for `linear`, so a branch never makes it vanish.
 */
export const flightAngle = (m: Motion): number | null => {
  switch (m.kind) {
    case 'linear':
    case 'homing':
    case 'boomerang':
    case 'drift':
      return Math.atan2(m.vy, m.vx)
    case 'orbit':
      return m.angle + (m.spin < 0 ? -Math.PI / 2 : Math.PI / 2)
    default:
      return null
  }
}

/** Patches of Trail ground, per type, variant and radius: a ragged, dithered blob with a darker rim. */
const patches = canvasCache<string, HTMLCanvasElement>()

const patch = (type: PokeType, variant: number, r: number) => {
  const key = `${type}|${variant}|${r}`
  const cached = patches.get(key)
  if (cached) return cached
  const [dark, body, light] = palette(type)
  const ry = Math.max(2, Math.round(r * 0.55))
  const canvas = createCanvas(r * 2 + 1, ry * 2 + 1)
  const ctx = context2d(canvas)
  for (let y = -ry; y <= ry; y++) {
    for (let x = -r; x <= r; x++) {
      // A ragged edge: each pixel's own reach wobbles with a hash.
      const d = Math.hypot(x / (r + 0.5), y / (ry + 0.5)) + (hash2(x, y, variant) - 0.5) * 0.35
      if (d > 1) continue
      const rim = d > 0.72
      if (!rim && (x + y) % 2 !== 0 && hash2(y, x, variant + 9) < 0.5) continue
      ctx.fillStyle = rim ? dark : hash2(x, y, variant + 3) < 0.18 ? light : body
      ctx.fillRect(x + r, y + ry, 1, 1)
    }
  }
  patches.set(key, canvas)
  return canvas
}

/** Ground a Trail left: a ragged patch in the move's colors with motes flickering up off it, fading in and out. */
const drawTrail = (ctx: Ctx, a: Attack, t: number) => {
  if (a.shape.kind !== 'circle') return
  const [, body, light] = palette(a.type)
  const r = Math.round(a.shape.r)
  const fade = Math.max(0, Math.min(1, a.age / 0.08, (a.ttl - a.age) / 0.45))
  ctx.globalAlpha = fade * 0.6
  blitCentered(ctx, patch(a.type, a.id % 4, r), a.x, a.y)
  ctx.globalAlpha = fade
  // Four motes, each on its own loop: rising off the patch and blinking out.
  for (let i = 0; i < 4; i++) {
    const phase = (t * 1.6 + hash2(a.id, i, 7)) % 1
    const x = Math.round(a.x + (hash2(a.id, i, 3) - 0.5) * r * 1.5)
    const y = Math.round(a.y + (hash2(a.id, i, 5) - 0.5) * r * 0.6 - phase * 8)
    ctx.fillStyle = phase < 0.45 ? light : body
    ctx.fillRect(x, y, 1, phase < 0.3 ? 2 : 1)
  }
  ctx.globalAlpha = 1
}

/** A Burst: a quick white core, an expanding double ring and eight rays. */
const drawBurst = (ctx: Ctx, a: Attack) => {
  if (a.shape.kind !== 'circle') return
  const [dark, body, light] = palette(a.type)
  const k = Math.min(1, a.age / a.ttl)
  const ease = 1 - (1 - k) * (1 - k)
  const r = Math.max(2, Math.round(a.shape.r * (0.35 + 0.65 * ease)))
  ctx.globalAlpha = Math.max(0, 1 - k)
  // A small white core for the first frames, then only the rings.
  if (k < 0.18) blitEllipse(ctx, Math.max(1, Math.round(r * 0.35)), Math.max(1, Math.round(r * 0.35)), '#ffffff', a.x, a.y)
  blitRing(ctx, r, 2, body, a.x, a.y)
  blitRing(ctx, Math.max(1, r - 3), 1, light, a.x, a.y)
  dashedRing(ctx, a.x, a.y, r + 2, a.id, [dark, body], 0.4)
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * TAU + (a.id % 7) * 0.2
    const from = r * 0.6
    const to = r + 3 + (i % 2) * 3
    for (let d = from; d < to; d += 1) {
      ctx.fillStyle = d > to - 2 ? light : body
      ctx.fillRect(Math.round(a.x + Math.cos(angle) * d), Math.round(a.y + Math.sin(angle) * d), 1, 1)
    }
  }
  ctx.globalAlpha = 1
}

/** An Arc: a jagged, crackling line of the move's colors from the foe hit to the next one. */
const drawArc = (ctx: Ctx, a: Attack, t: number) => {
  const [dark, body, light] = palette(a.type)
  const dx = a.x - a.from.x
  const dy = a.y - a.from.y
  const len = Math.hypot(dx, dy)
  const steps = Math.max(2, Math.round(len / 6))
  const nx = -dy / (len || 1)
  const ny = dx / (len || 1)
  const seed = a.id * 5 + Math.floor(t * 24)
  ctx.globalAlpha = Math.max(0, Math.min(1, (a.ttl - a.age) / 0.12))
  let px = a.from.x
  let py = a.from.y
  for (let i = 1; i <= steps; i++) {
    const k = i / steps
    const jag = i === steps ? 0 : (hash2(i, seed) - 0.5) * 9
    const qx = a.from.x + dx * k + nx * jag
    const qy = a.from.y + dy * k + ny * jag
    const n = Math.max(1, Math.round(Math.hypot(qx - px, qy - py)))
    for (let s = 0; s < n; s++) {
      const x = Math.round(px + ((qx - px) * s) / n)
      const y = Math.round(py + ((qy - py) * s) / n)
      ctx.fillStyle = dark
      ctx.fillRect(x - 1, y - 1, 3, 3)
      ctx.fillStyle = body
      ctx.fillRect(x, y - 1, 1, 2)
      ctx.fillStyle = light
      ctx.fillRect(x, y, 1, 1)
    }
    px = qx
    py = qy
  }
  blitRing(ctx, 2 + Math.round(a.age * 16), 1, light, a.x, a.y)
  ctx.globalAlpha = 1
}

/** Ground layer (under Pokémon). */
export const drawModGround = (ctx: Ctx, a: Attack, t: number) => {
  if (a.visual === 'modTrail') drawTrail(ctx, a, t)
}

/** Overlay layer (above Pokémon). */
export const drawModAttack = (ctx: Ctx, a: Attack, t: number) => {
  if (a.visual === 'modBurst') drawBurst(ctx, a)
  else if (a.visual === 'modArc') drawArc(ctx, a, t)
}

/* ---------------- Icons ---------------- */

/** 7×7 glyphs, `1` light and `2` accent, on the level-up cards' branch badges. */
const MOD_ART: Record<ModId, readonly string[]> = {
  split: ['1.....1', '.1...1.', '..1.1..', '...1...', '...1...', '...2...', '..222..'],
  bounce: ['1......', '.1...1.', '..1.1..', '...1...', '.......', '.......', '2222222'],
  boomerang: ['..111..', '.1...1.', '1.....1', '1......', '1...1..', '.1..11.', '..1111.'],
  seek: ['...1...', '.11111.', '.1...1.', '11.2.11', '.1...1.', '.11111.', '...1...'],
  trail: ['.....11', '....111', '.....11', '.......', '2.2.2..', '.2.2...', '.......'],
  burstOnKill: ['1..1..1', '.1.1.1.', '..222..', '1122211', '..222..', '.1.1.1.', '1..1..1'],
  echo: ['.11..2.', '1..12.2', '1..12.2', '1..12.2', '1..12.2', '.11..2.', '.......'],
  rear: ['.1...1.', '11...11', '1111111', '11...11', '.1...1.', '.......', '.......'],
  twin: ['..111..', '.1...1.', '1.222.1', '1.2.2.1', '1.222.1', '.1...1.', '..111..'],
  arc: ['....11.', '...11..', '..1111.', '...11..', '..11...', '.11....', '.1.....'],
  halo: ['..1.1..', '.1...1.', '1.....1', '...2...', '1.....1', '.1...1.', '..1.1..'],
  drain: ['.11.11.', '1111111', '1122111', '.11211.', '..121..', '...1...', '.......'],
  execute: ['2.....1', '.2...1.', '..2.1..', '...2...', '..1.2..', '.1...2.', '1.....2'],
  vortex: ['.11111.', '1.....1', '1.111.1', '1.1.2.1', '1.1...1', '1..111.', '.1.....'],
  hunter: ['2..2..2', '22.2.22', '2222222', '1111111', '1.1.1.1', '1111111', '.......'],
  cruel: ['.11111.', '1111111', '1..1..1', '1111111', '.11.11.', '.2.2.2.', '.......'],
}

/** A mod's icon as a data URL: a white glyph with a gold accent on a dark outline. */
export const modIcon = (id: ModId) => toIconUrl(`mod:${id}`, () => art(MOD_ART[id], { 1: '#ffffff', 2: '#f8d030' }, '#181820'))
