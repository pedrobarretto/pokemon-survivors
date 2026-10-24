import { hash2 } from '../engine/rng'
import { blitEllipse, blitRing, canvasCache, context2d, createCanvas, ring, drawPacked } from '../engine/pixelart'
import { domainOf, type LegendSky } from '../data/domains'
import { RIFT } from '../data/rifts'
import { REVEAL_AT } from '../game/domainRules'
import type { Game } from '../game/types'
import { riftDomain } from '../game/rift'

type Ctx = CanvasRenderingContext2D

/**
 * A legendary's sky (`LegendDomain.omen.sky`), in screen space over the
 * world: over the map through its omen and while its portal is open, and over
 * its domain from the moment it shows itself. Like the weather, every
 * particle is a pure function of its index and the clock, snapped to pixels.
 * A sky without its own painter yet gets a tint in its color.
 */

type Painter = (ctx: Ctx, w: number, h: number, camX: number, camY: number, t: number, g: Game) => void

const mod = (a: number, n: number) => ((a % n) + n) % n

/** Kyogre's Primordial Sea: a dark sky, sheets of slanted rain and lightning now and then. */
const downpour: Painter = (ctx, w, h, camX, camY, t) => {
  ctx.fillStyle = 'rgba(8,18,52,0.42)'
  ctx.fillRect(0, 0, w, h)
  // Storm clouds weigh on the top of the screen, in bands that thin out downward.
  for (let y = 0; y < h * 0.3; y += 2) {
    const k = 1 - y / (h * 0.3)
    ctx.fillStyle = `rgba(4,8,24,${(0.35 * k).toFixed(2)})`
    ctx.fillRect(0, y, w, 2)
  }
  const n = Math.round((w * h) / 900)
  for (let i = 0; i < n; i++) {
    const speed = 300 + hash2(i, 3, 17) * 120
    const x = Math.round(mod(hash2(i, 1, 17) * 4096 - camX - t * speed * 0.35, w + 20) - 10)
    const y = Math.round(mod(hash2(i, 2, 17) * 4096 - camY + t * speed, h + 20) - 10)
    ctx.fillStyle = i % 3 === 0 ? '#e0ecff' : '#9cb8e8'
    ctx.fillRect(x, y, 1, 3)
    ctx.fillRect(x - 1, y + 3, 1, 3)
  }
  // Lightning: a few frames of white sky every several seconds, with a bolt far off.
  const beat = Math.floor(t / 5.3)
  const since = t - beat * 5.3
  if (hash2(beat, 1, 23) < 0.7 && since < 0.22 && Math.floor(since * 30) % 2 === 0) {
    ctx.fillStyle = 'rgba(232,240,255,0.35)'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    let x = Math.round(hash2(beat, 2, 23) * w)
    for (let y = 0; y < h * 0.45; y += 4) {
      x += Math.round((hash2(beat, y, 29) - 0.5) * 8)
      ctx.fillRect(x, y, 2, 4)
    }
  }
}

/** The phase a domain's legendary fights in (0 before the battle, or on the map): its sky grows wilder with it. */
const phaseOf = (g: Game) => {
  const d = g.rift.arena?.domain
  return d ? (g.enemies.find((e) => e.id === d.bossId)?.fight?.phase ?? 0) : 0
}

/**
 * Groudon's Drought: a glaring orange sky, heat shimmering off the ground and
 * dust rising. On the map the sun itself burns in the corner with slow rays;
 * in its magma chamber the heat alone, fiercer once it goes Primal.
 */
const harshSun: Painter = (ctx, w, h, camX, camY, t, g) => {
  const primal = phaseOf(g) >= 2
  ctx.fillStyle = primal ? 'rgba(248,96,24,0.2)' : 'rgba(248,160,48,0.13)'
  ctx.fillRect(0, 0, w, h)
  if (!g.rift.arena) {
    const sx = w - 34
    const sy = 18
    // Rays turning slowly out of the sun.
    ctx.fillStyle = 'rgba(255,240,180,0.16)'
    for (let i = 0; i < 7; i++) {
      const a = t * 0.08 + (i / 7) * Math.PI * 2
      for (let r = 30; r < 150; r += 3) ctx.fillRect(Math.round(sx + Math.cos(a) * r), Math.round(sy + Math.sin(a) * r), 2, 2)
    }
    ctx.globalAlpha = 0.18
    blitEllipse(ctx, 46, 46, '#fff0b0', sx, sy)
    ctx.globalAlpha = 0.3
    blitEllipse(ctx, 30, 30, '#fff8d0', sx, sy)
    ctx.globalAlpha = 1
    blitEllipse(ctx, 16, 16, '#fffcf0', sx, sy)
  }
  // Heat shimmer: faint wavy bands over the lower half.
  ctx.fillStyle = 'rgba(255,236,200,0.09)'
  for (let y = Math.floor(h * 0.45); y < h; y += 7) {
    const off = Math.round(Math.sin(t * 3 + y * 0.4) * 3)
    for (let x = (y * 5) % 11; x < w; x += 11) ctx.fillRect(x + off, y, 6, 1)
  }
  // Dust and embers lifting off the hot ground.
  const n = Math.round((w * h) / (primal ? 1400 : 2600))
  for (let i = 0; i < n; i++) {
    const speed = 10 + hash2(i, 3, 61) * 18
    const x = Math.round(mod(hash2(i, 1, 61) * 4096 - camX + Math.sin(t + i) * 4, w + 10) - 5)
    const y = Math.round(mod(hash2(i, 2, 61) * 4096 - camY - t * speed, h + 10) - 5)
    ctx.fillStyle = i % 4 === 0 ? '#f86818' : i % 4 === 1 ? '#f8d070' : '#e0b078'
    ctx.fillRect(x, y, 1, 1)
  }
}

/** Period of the green streak crossing the sky in Rayquaza's omen, and how long a pass takes, in seconds. */
const STREAK = { every: 5, pass: 3, length: 36 } as const

/**
 * Rayquaza's Air Lock: a gale that blows every other weather away. Streaks of
 * wind race across a pale sky with leaves tumbling in them; on the map a long
 * green streak (Rayquaza itself, high up) crosses the sky now and then.
 */
const gale: Painter = (ctx, w, h, camX, camY, t, g) => {
  const mega = phaseOf(g) >= 2
  ctx.fillStyle = 'rgba(200,236,224,0.14)'
  ctx.fillRect(0, 0, w, h)
  const n = Math.round((w * h) / (mega ? 900 : 1400))
  for (let i = 0; i < n; i++) {
    const speed = 260 + hash2(i, 3, 71) * 180
    const len = 6 + Math.floor(hash2(i, 4, 71) * 14)
    const x = Math.round(mod(hash2(i, 1, 71) * 4096 - camX * 0.5 - t * speed, w + len + 20) - len - 10)
    const y = Math.round(mod(hash2(i, 2, 71) * 4096 - camY * 0.5 + Math.sin(t * 2 + i) * 2, h + 10) - 5)
    ctx.fillStyle = i % 4 === 0 ? 'rgba(255,255,255,0.8)' : 'rgba(232,248,240,0.5)'
    ctx.fillRect(x, y, len, 1)
  }
  for (let i = 0; i < 10; i++) {
    const x = Math.round(mod(hash2(i, 5, 71) * 4096 - t * 200, w + 20) - 10)
    const y = Math.round(mod(hash2(i, 6, 71) * 4096 + Math.sin(t * 5 + i) * 10, h))
    ctx.fillStyle = i % 2 ? '#78c058' : '#a8d870'
    ctx.fillRect(x, y, Math.floor(t * 8 + i) % 2 ? 2 : 1, Math.floor(t * 8 + i) % 2 ? 1 : 2)
  }
  if (g.rift.arena) return
  const beat = Math.floor(t / STREAK.every)
  const k = (t - beat * STREAK.every) / STREAK.pass
  if (k >= 1) return
  // The serpent: a head and a tail of green with gold bands, weaving along its pass.
  const flip = hash2(beat, 1, 73) < 0.5
  // Below the HUD and the toasts, high over the field.
  const baseY = h * (0.3 + hash2(beat, 2, 73) * 0.14)
  const head = -60 + k * (w + 120 + STREAK.length * 5)
  for (let j: number = STREAK.length; j >= 0; j--) {
    const along = head - j * 5
    const x = Math.round(flip ? w - along : along)
    const y = Math.round(baseY + Math.sin(along / 34 + beat) * 10)
    // Thick at the head, tapering to the tail, with a gold band every few segments and a pale wake.
    const s = j === 0 ? 7 : Math.max(2, Math.round(6 - (j / STREAK.length) * 4))
    ctx.fillStyle = 'rgba(200,248,208,0.25)'
    ctx.fillRect(x - s, y - (s >> 1) - 1, s * 2, s + 2)
    ctx.fillStyle = j % 5 === 2 ? '#f8e070' : j === 0 ? '#68c878' : '#3c9850'
    ctx.fillRect(x - (s >> 1), y - (s >> 1), s, s)
    if (j === 0) {
      ctx.fillStyle = '#f8e070'
      ctx.fillRect(x - 1, y - 2, 2, 2)
    }
  }
}

/** Lugia's storm at sea: a slate sky under rolling clouds, wind-driven rain slanting hard, gusts streaking past and lightning. */
const storm: Painter = (ctx, w, h, camX, camY, t) => {
  ctx.fillStyle = 'rgba(14,22,40,0.4)'
  ctx.fillRect(0, 0, w, h)
  // Clouds rolling over the top, their lower edge billowing as they go.
  for (let x = 0; x < w; x += 2) {
    const edge = Math.round(h * 0.16 + Math.sin((x + t * 40) / 23) * 6 + Math.sin((x - t * 25) / 9) * 3)
    ctx.fillStyle = 'rgba(8,12,24,0.45)'
    ctx.fillRect(x, 0, 2, edge)
    ctx.fillStyle = 'rgba(96,112,144,0.35)'
    ctx.fillRect(x, edge, 2, 1)
  }
  const n = Math.round((w * h) / 700)
  for (let i = 0; i < n; i++) {
    const speed = 340 + hash2(i, 3, 19) * 140
    const x = Math.round(mod(hash2(i, 1, 19) * 4096 - camX - t * speed * 0.7, w + 30) - 15)
    const y = Math.round(mod(hash2(i, 2, 19) * 4096 - camY + t * speed, h + 20) - 10)
    ctx.fillStyle = i % 4 === 0 ? '#e8f0ff' : '#8ca4c8'
    ctx.fillRect(x, y, 1, 2)
    ctx.fillRect(x - 1, y + 2, 1, 2)
    ctx.fillRect(x - 2, y + 4, 1, 1)
  }
  // Gusts: long pale streaks blown across the screen.
  ctx.fillStyle = 'rgba(232,240,255,0.45)'
  for (let i = 0; i < 9; i++) {
    const len = 10 + Math.floor(hash2(i, 4, 19) * 18)
    const x = Math.round(mod(hash2(i, 5, 19) * 999 - t * (260 + i * 20), w + len * 2) - len)
    const y = Math.round(mod(hash2(i, 6, 19) * 999 + Math.sin(t + i) * 8, h))
    ctx.fillRect(x, y, len, 1)
  }
  const beat = Math.floor(t / 3.7)
  const since = t - beat * 3.7
  if (hash2(beat, 1, 31) < 0.8 && since < 0.26 && Math.floor(since * 30) % 2 === 0) {
    ctx.fillStyle = 'rgba(224,232,255,0.32)'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#ffffff'
    let x = Math.round(hash2(beat, 2, 31) * w)
    for (let y = 0; y < h * 0.55; y += 4) {
      x += Math.round((hash2(beat, y, 37) - 0.5) * 10)
      ctx.fillRect(x, y, 2, 4)
      // A fork now and then.
      if (hash2(beat, y, 41) < 0.08) ctx.fillRect(x + 2, y + 2, 4, 1)
    }
  }
}

const rainbows = canvasCache<string, HTMLCanvasElement>()
const RAINBOW = ['#f84848', '#f89838', '#f8e048', '#68d858', '#48a8f8', '#6868e8', '#b058e0'] as const

/** A rainbow arc spanning the screen, baked once per view size: seven hard-edged bands. */
const rainbowOf = (w: number, h: number) => {
  const key = `${w}x${h}`
  const known = rainbows.get(key)
  if (known) return known
  const canvas = createCanvas(w, h)
  const c = context2d(canvas)
  const cx = w / 2
  const cy = h * 0.95
  const r0 = Math.max(w, h) * 0.62
  RAINBOW.forEach((color, i) => {
    c.fillStyle = color
    const r = r0 - i * 3
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      if (Math.abs(dx) >= r) continue
      c.fillRect(x, Math.round(cy - Math.sqrt(r * r - dx * dx)), 1, 3)
    }
  })
  rainbows.set(key, canvas)
  return canvas
}

/** Ho-Oh's sky: a warm glow, a rainbow across it, and embers drifting down, swaying and flickering. */
const embers: Painter = (ctx, w, h, camX, camY, t) => {
  ctx.fillStyle = 'rgba(160,56,16,0.14)'
  ctx.fillRect(0, 0, w, h)
  ctx.globalAlpha = 0.2 + 0.05 * Math.sin(t * 0.8)
  ctx.drawImage(rainbowOf(w, h), 0, 0)
  ctx.globalAlpha = 1
  const n = Math.round((w * h) / 2600)
  for (let i = 0; i < n; i++) {
    const fall = 18 + hash2(i, 3, 53) * 26
    const y = Math.round(mod(hash2(i, 2, 53) * 4096 - camY * 0.6 + t * fall, h + 10) - 5)
    const x = Math.round(mod(hash2(i, 1, 53) * 4096 - camX * 0.6 + Math.sin(t * 1.4 + i) * 7, w))
    if (Math.sin(t * 7 + i * 1.3) < -0.6) continue
    ctx.fillStyle = i % 3 === 0 ? '#fff0a0' : i % 3 === 1 ? '#f8a030' : '#f85028'
    ctx.fillRect(x, y, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
  }
}

/** Dialga's distorted time: a cold tint, a ghostly clock over everything whose hands stutter, ripples of time spreading, and glitched rows. */
const timeWarp: Painter = (ctx, w, h, _camX, _camY, t) => {
  ctx.fillStyle = 'rgba(40,64,136,0.2)'
  ctx.fillRect(0, 0, w, h)
  const cx = Math.round(w / 2)
  const cy = Math.round(h / 2)
  const R = Math.round(Math.min(w, h) * 0.42)
  ctx.globalAlpha = 0.22
  drawPacked(ctx, ring(R, 2, '#a8f0f8'), cx - R, cy - R)
  ctx.fillStyle = '#a8f0f8'
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    ctx.fillRect(Math.round(cx + Math.cos(a) * (R - 6)) - 1, Math.round(cy + Math.sin(a) * (R - 6)) - 1, 3, 3)
  }
  // The hands jump in stutters, now and then a step backward.
  const tick = Math.floor(t * 3)
  const minute = (tick + (hash2(tick, 1, 61) < 0.2 ? -2 : 0)) * 0.21
  const hour = tick * 0.03
  for (const [a, len] of [[minute, R - 12], [hour, R * 0.55]] as const) {
    for (let d = 0; d < len; d += 2) ctx.fillRect(Math.round(cx + Math.sin(a) * d), Math.round(cy - Math.cos(a) * d), 2, 2)
  }
  ctx.globalAlpha = 1
  for (let i = 0; i < 2; i++) {
    const k = mod(t / 2.4 + i / 2, 1)
    ctx.globalAlpha = (1 - k) * 0.35
    const r = Math.round(10 + k * Math.max(w, h) * 0.7)
    blitRing(ctx, r, 1, '#d0f8ff', cx, cy)
  }
  ctx.globalAlpha = 1
  // The world stutters: a few rows glitch for a moment every few seconds.
  const beat = Math.floor(t / 3.1)
  if (t - beat * 3.1 < 0.14) {
    for (let i = 0; i < 5; i++) {
      const y = Math.round(hash2(beat, i, 67) * h)
      ctx.fillStyle = i % 2 === 0 ? 'rgba(168,240,248,0.5)' : 'rgba(248,120,216,0.35)'
      ctx.fillRect(0, y, w, 1 + (i % 3))
    }
  }
}

/** The Eon duo's dream: a lilac haze, banks of fog drifting across, glints rising, and now and then a red and a blue streak far up in the sky. */
const mist: Painter = (ctx, w, h, camX, camY, t) => {
  ctx.fillStyle = 'rgba(232,220,248,0.2)'
  ctx.fillRect(0, 0, w, h)
  // Fog banks: soft bands at a slow parallax, each breathing in and out.
  for (let i = 0; i < 6; i++) {
    const y = Math.round(mod(hash2(i, 1, 51) * 900 - camY * 0.3, h + 60) - 30)
    const x = Math.round(mod(hash2(i, 2, 51) * 900 - camX * 0.3 + t * (6 + i * 2), w + 240) - 120)
    const a = 0.08 + 0.05 * Math.sin(t * 0.7 + i)
    ctx.fillStyle = `rgba(248,240,255,${a.toFixed(2)})`
    ctx.fillRect(x, y, 200, 10)
    ctx.fillRect(x + 20, y - 4, 150, 4)
    ctx.fillRect(x + 36, y + 10, 120, 4)
  }
  // Dream glints, red and blue, rising and twinkling.
  const n = Math.round((w * h) / 5200)
  for (let i = 0; i < n; i++) {
    if (Math.sin(t * 3 + i * 2.3) < 0.2) continue
    const x = Math.round(mod(hash2(i, 3, 51) * 4096 - camX * 0.6, w))
    const y = Math.round(mod(hash2(i, 4, 51) * 4096 - camY * 0.6 - t * 9, h))
    ctx.fillStyle = i % 3 === 0 ? '#f86078' : i % 3 === 1 ? '#58a0f8' : '#ffffff'
    ctx.fillRect(x, y - 1, 1, 3)
    ctx.fillRect(x - 1, y, 3, 1)
  }
  // The pair far up, streaking across every few seconds.
  const beat = Math.floor(t / 7.5)
  const since = t - beat * 7.5
  if (since < 1.4) {
    const k = since / 1.4
    for (let j = 0; j < 2; j++) {
      const x = Math.round(-20 + (w + 40) * k + j * 10)
      const y = Math.round(h * (0.08 + hash2(beat, j, 53) * 0.1) + j * 6 - Math.sin(k * Math.PI) * 10)
      ctx.fillStyle = j === 0 ? '#f86078' : '#58a0f8'
      ctx.fillRect(x, y, 3, 2)
      for (let q = 1; q < 6; q++) {
        ctx.globalAlpha = 1 - q / 6
        ctx.fillRect(x - q * 4, y + (q % 2), 3, 1)
      }
      ctx.globalAlpha = 1
    }
  }
}

/** Deoxys's meteor shower: a deep night sky, stars twinkling and meteors streaking down with their fiery tails. */
const meteors: Painter = (ctx, w, h, camX, camY, t) => {
  ctx.fillStyle = 'rgba(16,8,40,0.34)'
  ctx.fillRect(0, 0, w, h)
  const stars = Math.round((w * h) / 2600)
  for (let i = 0; i < stars; i++) {
    if (Math.sin(t * 2 + i * 1.9) < -0.5) continue
    ctx.fillStyle = i % 5 === 0 ? '#f8d0a0' : '#e8e8ff'
    ctx.fillRect(Math.round(mod(hash2(i, 1, 61) * 4096 - camX * 0.1, w)), Math.round(mod(hash2(i, 2, 61) * 4096 - camY * 0.1, h)), 1, 1)
  }
  // Meteors: each on its own cycle, falling from the top right to the bottom left.
  const count = Math.max(4, Math.round(w / 70))
  for (let i = 0; i < count; i++) {
    const period = 2.2 + hash2(i, 3, 61) * 2.6
    const cycle = Math.floor((t + hash2(i, 4, 61) * period) / period)
    const k = ((t + hash2(i, 4, 61) * period) % period) / period
    if (k > 0.45) continue
    const q = k / 0.45
    const sx = hash2(i, cycle, 63) * (w + 120)
    const x = Math.round(sx - q * 160)
    const y = Math.round(-20 + q * (h * 0.7 + hash2(cycle, i, 65) * h * 0.3))
    for (let j = 1; j < 12; j++) {
      ctx.globalAlpha = 1 - j / 12
      ctx.fillStyle = j < 4 ? '#f8d070' : '#f86830'
      ctx.fillRect(x + j * 2, y - j * 3, 2, 2)
    }
    ctx.globalAlpha = 1
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x - 1, y - 1, 3, 3)
  }
}

/** Darkrai's new moon: the screen sinks into the night as the omen goes on, a black moon rimmed in cyan rises and eyes open in the dark. */
const newMoon: Painter = (ctx, w, h, camX, camY, t, g) => {
  const omen = g.rift.omen
  // In the domain its own dark does the rest (`render/darkrai.ts`): only the moon and the eyes stay.
  const inside = g.rift.arena !== null
  const k = inside ? 1 : omen ? Math.min(1, (1 - omen.left / RIFT.omenTime) * 1.4) : 1
  ctx.fillStyle = `rgba(6,2,16,${(inside ? 0.06 : 0.18 + 0.4 * k).toFixed(2)})`
  ctx.fillRect(0, 0, w, h)
  // The moon, high on the right: a black disc with a thin cyan rim, its halo dithered.
  const mx = Math.round(w - 46)
  const my = Math.round(30 + (1 - k) * 18)
  ctx.globalAlpha = k
  blitEllipse(ctx, 15, 15, 'rgba(88,232,240,0.12)', mx, my)
  blitRing(ctx, 12, 1, '#58e8f0', mx, my)
  blitEllipse(ctx, 11, 11, '#04020a', mx, my)
  ctx.globalAlpha = 1
  // Eyes opening in the dark: pairs of cyan pixels that blink on their own cycles.
  const eyes = Math.round((w * h) / 9000 * k)
  ctx.fillStyle = '#58e8f0'
  for (let i = 0; i < eyes; i++) {
    const period = 2.4 + hash2(i, 1, 91) * 3
    if (((t + hash2(i, 2, 91) * period) % period) / period > 0.4) continue
    const x = Math.round(mod(hash2(i, 3, 91) * 4096 - camX * 0.2, w))
    const y = Math.round(mod(hash2(i, 4, 91) * 4096 - camY * 0.2, h))
    ctx.fillRect(x, y, 1, 1)
    ctx.fillRect(x + 3, y, 1, 1)
  }
}

const TINTS: Record<LegendSky, string> = {
  downpour: 'rgba(8,18,52,0.42)',
  harshSun: 'rgba(248,152,40,0.18)',
  gale: 'rgba(200,232,216,0.16)',
  timeWarp: 'rgba(80,120,200,0.22)',
  storm: 'rgba(24,32,64,0.3)',
  embers: 'rgba(200,64,24,0.18)',
  mist: 'rgba(232,224,248,0.22)',
  meteors: 'rgba(16,8,40,0.3)',
  newMoon: 'rgba(6,2,16,0.5)',
}

/** The skies painted so far; the others get their tint until theirs are written. */
const PAINTERS: Partial<Record<LegendSky, Painter>> = { downpour, harshSun, gale, storm, embers, timeWarp, mist, meteors, newMoon }

/** The sky in play: a domain legendary's omen or open portal on the map, or its domain once it has shown itself. */
export const skyNow = (g: Game): LegendSky | null => {
  const arena = g.rift.arena
  const d = arena?.domain
  if (d) {
    const shown = d.act === 'battle' || d.act === 'capture' || d.act === 'after' || (d.act === 'encounter' && d.scene >= REVEAL_AT)
    return shown ? (domainOf(d.legend)?.omen.sky ?? null) : null
  }
  if (arena) return null
  const legend = g.rift.omen?.legend ?? g.rift.portal?.legend
  return legend ? (riftDomain(g, legend)?.omen.sky ?? null) : null
}

/** Paints the sky in play over the frame, if any. */
export const drawLegendSky = (ctx: Ctx, g: Game, camX: number, camY: number, t: number) => {
  const sky = skyNow(g)
  if (!sky) return
  const { w, h } = g.view
  const paint = PAINTERS[sky]
  if (paint) return paint(ctx, w, h, camX, camY, t, g)
  ctx.fillStyle = TINTS[sky]
  ctx.fillRect(0, 0, w, h)
}

/** Grid step (world px) of the cracks Groudon's drought opens in the ground. */
const CRACK_CELL = 44

/**
 * The ground under a legendary's omen, in world space under the entities:
 * Groudon's drought cracks the earth, the cracks spreading as the omen goes
 * on and staying while its portal is open. Drawn only on the map.
 */
export const drawOmenGround = (ctx: Ctx, g: Game) => {
  if (g.rift.arena || skyNow(g) !== 'harshSun') return
  const omen = g.rift.omen
  const k = omen ? 1 - omen.left / RIFT.omenTime : 1
  if (k <= 0) return
  const { x: camX, y: camY } = g.camera
  const { w, h } = g.view
  ctx.fillStyle = 'rgba(56,28,10,0.55)'
  for (let cy = Math.floor(camY / CRACK_CELL) - 1; cy <= Math.floor((camY + h) / CRACK_CELL) + 1; cy++) {
    for (let cx = Math.floor(camX / CRACK_CELL) - 1; cx <= Math.floor((camX + w) / CRACK_CELL) + 1; cx++) {
      // Cracks open one after another through the omen.
      if (hash2(cx, cy, 81) > 0.45 * Math.min(1, k * 1.6)) continue
      const ox = (cx + hash2(cx, cy, 82)) * CRACK_CELL
      const oy = (cy + hash2(cx, cy, 83)) * CRACK_CELL
      const arms = 2 + Math.floor(hash2(cx, cy, 84) * 2)
      for (let a = 0; a < arms; a++) {
        let dir = hash2(cx, cy, 85 + a) * Math.PI * 2
        let x = ox
        let y = oy
        const len = k * (10 + hash2(cx, cy, 90 + a) * 18)
        for (let d = 0; d < len; d += 2) {
          dir += (hash2(cx * 7 + a, Math.floor(d), 95) - 0.5) * 0.9
          x += Math.cos(dir) * 2
          y += Math.sin(dir) * 2
          ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
        }
      }
    }
  }
}
