import { TAU } from '../engine/math'
import { blitEllipse, blitRing } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import type { Game, Visual } from '../game/types'
import { flightAngle } from './modFx'
import { detail } from './quality'

/**
 * What a projectile does as it strikes: an Ember bursts into flame, a Water
 * Gun splashes, a Swift star shatters into twinkles. The simulation just
 * drops a shot whose pierce ran out, so the renderer watches the shots it
 * drew: one gone before its time was up struck something, and it pops where
 * it was last seen. One that ran its time out fizzles instead (smoke, drips).
 * Presentation only, kept here and never in the game's state.
 */

type Ctx = CanvasRenderingContext2D

/** A pop: where and which way the shot was going, when it went (`Game.now`), whose it was, and whether it struck or fizzled. */
type Pop = { visual: PopVisual; x: number; y: number; angle: number; at: number; owner: number; hit: boolean }

type PopLook = (ctx: Ctx, p: Pop, k: number, seed: number) => void

/** Seconds a pop plays. */
const POP_TIME = 0.3
/** A shot with less than this left when it vanished ran out rather than struck. */
const EXPIRED = 0.06

const FIRE = ['#ffffff', '#fff0a0', '#f8b030', '#e85818', '#a02010'] as const

/** Sparks flying out of (x, y) along `n` rays, `d` px out, in `color`. */
const rays = (ctx: Ctx, x: number, y: number, n: number, d: number, len: number, color: string, seed: number, spin = 0) => {
  ctx.fillStyle = color
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + spin + hash2(seed, i, 1) * 0.5
    for (let s = 0; s < len; s++) ctx.fillRect(Math.round(x + Math.cos(ang) * (d - s)), Math.round(y + Math.sin(ang) * (d - s) * 0.8), 1, 1)
  }
}

/** Ember: a white flash, licks of flame bursting out and up, then a puff of smoke. Expired, just the smoke. */
const emberPop: PopLook = (ctx, p, k, seed) => {
  if (p.hit) {
    if (k < 0.12) blitEllipse(ctx, 4, 4, '#ffffff', p.x, p.y)
    else if (k < 0.55) {
      const e = (k - 0.12) / 0.43
      blitRing(ctx, Math.round(3 + e * 6), 1, e < 0.5 ? '#f8d050' : '#e85818', p.x, p.y)
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * TAU + hash2(seed, i, 2)
        const d = 2 + e * (6 + hash2(seed, i, 3) * 4)
        ctx.fillStyle = FIRE[Math.min(4, 1 + Math.floor(e * 4))]!
        const s = e < 0.6 ? 2 : 1
        ctx.fillRect(Math.round(p.x + Math.cos(ang) * d), Math.round(p.y + Math.sin(ang) * d * 0.75 - e * 4), s, s)
      }
    }
  }
  if (k > (p.hit ? 0.3 : 0)) {
    const e = p.hit ? (k - 0.3) / 0.7 : k
    ctx.globalAlpha = (1 - e) * 0.7
    for (let i = 0; i < 2; i++) {
      const s = Math.round(1 + e * 2.5)
      blitEllipse(ctx, s, s, i ? '#a09890' : '#706860', p.x + (i ? 2 : -1), p.y - 2 - e * 9 - i * 2)
    }
    ctx.globalAlpha = 1
  }
}

/** Water Gun: a splash crown of droplets thrown up and falling back, and a ring spreading flat. Expired, a few drips falling. */
const waterPop: PopLook = (ctx, p, k, seed) => {
  const n = p.hit ? 7 : 3
  for (let i = 0; i < n; i++) {
    // Thrown back against the shot's way, fanned out.
    const ang = p.angle + Math.PI + (i / (n - 1 || 1) - 0.5) * (p.hit ? 2.6 : 1.2)
    const speed = (p.hit ? 26 : 8) * (0.6 + hash2(seed, i, 4) * 0.6)
    const tt = k * POP_TIME
    const x = p.x + Math.cos(ang) * speed * tt
    const y = p.y + Math.sin(ang) * speed * tt * 0.6 - (p.hit ? 40 : 0) * tt + 260 * tt * tt
    ctx.fillStyle = i % 2 ? '#ffffff' : '#78b8f8'
    const s = k < 0.5 && i % 3 === 0 ? 2 : 1
    ctx.fillRect(Math.round(x), Math.round(y), s, s)
  }
  if (!p.hit) return
  if (k < 0.1) blitEllipse(ctx, 3, 3, '#ffffff', p.x, p.y)
  ctx.globalAlpha = 1 - k
  const r = Math.round(2 + k * 7)
  blitRing(ctx, r, 1, '#a8d8f8', p.x, p.y + 1)
  if (k > 0.25) blitRing(ctx, Math.max(1, r - 3), 1, '#ffffff', p.x, p.y + 1)
  ctx.globalAlpha = 1
}

/** Swift: the star breaks into a big twinkle and four small ones flying off. */
const starPop: PopLook = (ctx, p, k, seed) => {
  if (!p.hit) return
  const big = Math.round(5 * (1 - k))
  if (big > 0) {
    ctx.fillStyle = k < 0.3 ? '#ffffff' : '#fff8a0'
    ctx.fillRect(Math.round(p.x) - big, Math.round(p.y), big * 2 + 1, 1)
    ctx.fillRect(Math.round(p.x), Math.round(p.y) - big, 1, big * 2 + 1)
  }
  for (let i = 0; i < 4; i++) {
    const ang = (i / 4) * TAU + 0.785 + hash2(seed, i, 5) * 0.4
    const d = 3 + k * 10
    const x = Math.round(p.x + Math.cos(ang) * d)
    const y = Math.round(p.y + Math.sin(ang) * d)
    const s = k < 0.5 ? 1 : 0
    ctx.fillStyle = i % 2 ? '#f8d830' : '#ffffff'
    ctx.fillRect(x - s, y, s * 2 + 1, 1)
    ctx.fillRect(x, y - s, 1, s * 2 + 1)
  }
}

/** A ring and short sparks in the shot's colors: the plain pop of a hard shot. */
const sparkPop = (colors: readonly [string, string]): PopLook => (ctx, p, k, seed) => {
  if (!p.hit) return
  if (k < 0.1) blitEllipse(ctx, 3, 3, '#ffffff', p.x, p.y)
  ctx.globalAlpha = 1 - k
  blitRing(ctx, Math.round(2 + k * 6), 1, colors[0], p.x, p.y)
  rays(ctx, p.x, p.y, 5, 3 + k * 7, 2, colors[1], seed)
  ctx.globalAlpha = 1
}

const POPS = {
  ember: emberPop,
  water: waterPop,
  star: starPop,
  steel: sparkPop(['#c8d0e0', '#ffffff']),
  psy: sparkPop(['#f85888', '#ffd0e8']),
  pin: sparkPop(['#d8f070', '#ffffff']),
  arrow: sparkPop(['#a070d8', '#e8e0f8']),
  shuriken: sparkPop(['#a8d8f8', '#ffffff']),
} as const satisfies Partial<Record<Visual, PopLook>>

type PopVisual = keyof typeof POPS

const pops = (v: Visual): v is PopVisual => v in POPS

/** The shots drawn last frame, by id: where they were and how long they had left. */
type Seen = { visual: PopVisual; x: number; y: number; angle: number; left: number; owner: number; frame: number }

const seen = new Map<number, Seen>()
const live: Pop[] = []
let watched: Game | null = null
let frame = 0

/**
 * Notes this frame's shots and turns the ones gone since the last frame into
 * pops. Called once a frame with the drawn game; a new game (a new run, a
 * co-op resync) starts over.
 */
export const watchImpacts = (g: Game) => {
  if (g !== watched) {
    seen.clear()
    live.length = 0
    watched = g
  }
  frame++
  for (const a of g.attacks) {
    if (a.age < 0 || !pops(a.visual)) continue
    const s = seen.get(a.id)
    const angle = flightAngle(a.motion) ?? (s ? s.angle : 0)
    if (s) {
      s.x = a.x
      s.y = a.y
      s.angle = angle
      s.left = a.ttl - a.age
      s.frame = frame
    } else seen.set(a.id, { visual: a.visual, x: a.x, y: a.y, angle, left: a.ttl - a.age, owner: a.owner, frame })
  }
  for (const [id, s] of seen) {
    if (s.frame === frame) continue
    seen.delete(id)
    if (!detail.lean) live.push({ visual: s.visual, x: s.x, y: s.y, angle: s.angle, at: g.now, owner: s.owner, hit: s.left > EXPIRED })
  }
  for (let i = live.length - 1; i >= 0; i--) if (g.now - live[i]!.at > POP_TIME || g.now < live[i]!.at) live.splice(i, 1)
}

/** Draws the pops playing now whose shots belong to `mine` (a co-op screen draws its own and its teammates' apart, as their moves). */
export const drawImpacts = (ctx: Ctx, now: number, mine: (owner: number) => boolean) => {
  for (const p of live) {
    if (!mine(p.owner)) continue
    POPS[p.visual](ctx, p, Math.min(1, (now - p.at) / POP_TIME), Math.round(p.at * 977) + p.owner)
  }
}
