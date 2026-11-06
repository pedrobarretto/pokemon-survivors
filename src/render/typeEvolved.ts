import { blitCentered, blitEllipse, blitRing, blitRotated, fillPlotted, fromStrings, lazy, plot, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { JAW_BEAT, JAW_BITES, JAW_RISE } from '../game/typeEvolutions'
import type { Attack, Game } from '../game/types'
import { art, FX } from './art'
import { dashedRing } from './strokes'
import * as A from './typeEvolvedArt'
import { ownerOf } from '../game/players'
import { detail } from './quality'

/**
 * Visuals of the moves the newer type items (and a few generic ones) evolve
 * (`game/typeEvolutions.ts`). Kept apart like `evolved.ts`; both frame passes
 * of `draw.ts` fall through here, and `drawDrainVines` runs after the attacks
 * because Giga Drain's vines start at the player. Positions snap to pixels.
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
const fadeIn = (a: Attack, window: number) => Math.max(0, Math.min(1, a.age / window))
const radius = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

/** Generated chasm pieces, long along x (three jagged variants): 1 rim dust, 2 walls, 3 depth. */
const chasm = (seed: number) => {
  const w = 22
  const h = 11
  const rows = Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const along = 1 - Math.abs(x - (w - 1) / 2) / (w / 2)
      const jag = (hash2(Math.floor(x / 2), seed) - 0.5) * 2.4
      const half = Math.max(0, along * 4.6 + 0.8) + jag * along
      const d = Math.abs(y - (h - 1) / 2 + Math.sin(x * 0.55 + seed) * 1.1)
      return d > half + 1 ? '.' : d > half ? '1' : d > half - 1.4 ? '2' : '3'
    }).join(''),
  )
  return fromStrings(rows, { 1: '#e8d090', 2: '#7a5028', 3: '#160c06' })
}

const SPR = {
  mawTop: lazy(() => art(A.MAW_TOP, A.MAW, '#080408')),
  mawBottom: lazy(() => art(A.MAW_BOTTOM, A.MAW, '#080408')),
  fist: lazy(() => art(A.BIG_FIST, A.FIST_PAL, '#281010')),
  eye: lazy(() => art(A.EYE, A.EYE_PAL, '#401030')),
  beam: lazy(() => fromStrings(A.BEAM_CROSS, A.STEEL)),
  parade: lazy(() => [art(A.PARADE_FLAME, A.PARADE_PAL, '#181030'), art([...A.PARADE_FLAME].map((r) => [...r].reverse().join('')), A.PARADE_PAL, '#181030')]),
  arrow: lazy(() => art(A.SPECTRAL_ARROW, A.SPECTRAL_PAL, '#181028')),
  pinwheel: lazy(() => art(A.PINWHEEL, A.AQUA, '#102060')),
  searing: lazy(() => art(A.SEARING_BALL, A.SEARING_PAL, '#401008')),
  ember: lazy(() => [art(A.SEARING_EMBER, A.SEARING_PAL), art(A.SEARING_EMBER, { ...A.SEARING_PAL, 3: '#ffffff', 4: '#fff8c0' })]),
  envy: lazy(() => [art(A.ENVY_FLAME, A.ENVY_PAL, '#300818'), art([...A.ENVY_FLAME].map((r) => [...r].reverse().join('')), A.ENVY_PAL, '#300818')]),
  blade: lazy(() => art(A.GIANT_BLADE, A.BLADE_PAL, '#103010')),
  chasms: lazy(() => [chasm(1), chasm(2), chasm(3)]),
}

/* ---------------- Strokes ---------------- */

/** A crescent arc of `thick` pixel rings at radius `r` around (x, y), facing `dir` and `span` rad wide, edge colors first. */
const crescent = (ctx: Ctx, x: number, y: number, r: number, dir: number, span: number, colors: readonly string[]) => {
  const steps = Math.ceil(r * span * 1.6)
  for (let i = 0; i <= steps; i++) {
    const k = i / steps
    const angle = dir - span / 2 + span * k
    const thick = Math.max(1, Math.round(Math.sin(k * Math.PI) * colors.length))
    for (let j = 0; j < thick; j++) plot(colors[j]!, x + Math.cos(angle) * (r - j), y + Math.sin(angle) * (r - j))
  }
  fillPlotted(ctx)
}

/** An outlined heart `r` px tall around (x, y), dashed and turning with `rot` (Alluring Voice). Drawing lean, every other step. */
const heartLine = (ctx: Ctx, x: number, y: number, r: number, rot: number, colors: readonly string[]) => {
  const steps = Math.max(24, Math.round(r * 7))
  const s = r / 16
  for (let i = 0; i < steps; i += detail.lean ? 2 : 1) {
    const u = (i / steps) * Math.PI * 2
    // Skip the dashes and the dip between the lobes, where every wave's outline would bunch up.
    if (Math.sin(u * 9 + rot) < -0.55 || Math.cos(u) > 0.93) continue
    const hx = 16 * Math.sin(u) ** 3
    const hy = -(13 * Math.cos(u) - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u))
    plot(colors[i % colors.length]!, x + hx * s, y + hy * s + r * 0.15, 2, 2)
  }
  fillPlotted(ctx)
}

/** Sprite stretched along a line from (x, y) toward `angle` (Steel Beam's slices). */
const stretch = (ctx: Ctx, sprite: PixelSprite, x: number, y: number, angle: number, length: number, thick: number) => {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(angle)
  ctx.drawImage(sprite, -length / 2, -thick / 2, length, thick)
  ctx.restore()
}

/** Eight short rays (an impact). */
const rays = (ctx: Ctx, x: number, y: number, size: number, colors: readonly [string, string]) => {
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.2
    const len = i % 2 === 0 ? size : size * 0.6
    for (let d = 2; d <= len; d++) px(ctx, x + Math.cos(angle) * d, y + Math.sin(angle) * d, d < 4 ? colors[0] : colors[1])
  }
}

/* ---------------- Ground layer ---------------- */

/** Ground layer (under Pokémon): shadows, chasms, sigils and scorch marks. */
export const drawTypeEvolvedGround = (ctx: Ctx, a: Attack, t: number) => {
  const r = radius(a)
  switch (a.visual) {
    case 'jawLock': {
      // The pool of shadow the maw rises from.
      ctx.globalAlpha = fadeIn(a, 0.12) * fadeOut(a, 0.2)
      blitEllipse(ctx, Math.round(r * 1.25), Math.round(r * 0.5), 'rgba(24,8,40,0.55)', a.x, a.y + r * 0.7)
      dashedRing(ctx, a.x, a.y + r * 0.7, r * 1.1, t * 6 + a.id, ['#7048a0', '#281838'], 0.5, 0.42)
      ctx.globalAlpha = 1
      return
    }
    case 'fissure': {
      const open = Math.min(1, a.age / 0.1) * fadeOut(a, 0.3)
      if (open <= 0) return
      const sprite = SPR.chasms()[a.id % 3]!
      const angle = Math.atan2(a.y - a.from.y, a.x - a.from.x)
      const scale = Math.max(1, r / 10)
      stretch(ctx, sprite, a.x, a.y, angle, sprite.width * scale * 1.15, Math.max(1, Math.round(sprite.height * scale * open)))
      return
    }
    case 'psyVortex': {
      // Rings drawn in toward the pupil: the pull you see.
      ctx.globalAlpha = Math.min(fadeIn(a, 0.15), fadeOut(a, 0.15))
      blitEllipse(ctx, Math.round(r), Math.round(r * 0.5), 'rgba(248,88,136,0.14)', a.x, a.y + 6)
      for (let i = 0; i < 3; i++) {
        const k = 1 - ((a.age * 1.6 + i / 3) % 1)
        dashedRing(ctx, a.x, a.y, r * k, -t * 8 + i, i % 2 ? ['#f85888', '#ffd0e8'] : ['#ffffff', '#f888b0'], 0.55 + 0.3 * (1 - k), 0.75)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'phantomFall': {
      // A ghostly sigil fills in where the arrow will land.
      const k = Math.min(1, a.age / a.ttl)
      blitEllipse(ctx, Math.round(r * (0.4 + 0.6 * k)), Math.max(1, Math.round(r * 0.45 * (0.4 + 0.6 * k))), 'rgba(40,16,64,0.4)', a.x, a.y)
      dashedRing(ctx, a.x, a.y, r, t * 5, ['#a070d8', '#58d888'], 0.7, 0.45)
      dashedRing(ctx, a.x, a.y, r * 0.6, -t * 7, ['#c8f0d8'], 0.4, 0.45)
      return
    }
    case 'phantomArrow': {
      ctx.globalAlpha = fadeOut(a, 0.3)
      blitEllipse(ctx, Math.round(r * 0.9), Math.round(r * 0.4), 'rgba(40,16,64,0.45)', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'searing':
    case 'jealousy': {
      const hot = a.visual === 'searing'
      if (a.age < a.activeFrom) {
        // Where it's coming down: a growing shadow (Searing Shot) or a flickering sigil (Burning Jealousy).
        const k = a.age / a.activeFrom
        if (hot) blitEllipse(ctx, Math.round(r * (0.3 + 0.5 * k)), Math.max(1, Math.round(r * 0.4 * (0.3 + 0.5 * k))), 'rgba(48,16,8,0.35)', a.x, a.y)
        else {
          blitEllipse(ctx, Math.round(r * 0.9), Math.max(1, Math.round(r * 0.4)), 'rgba(128,24,104,0.25)', a.x, a.y)
          dashedRing(ctx, a.x, a.y, r * (0.6 + 0.4 * k), t * 9, ['#f878c8', '#d03898'], 0.6, 0.42)
        }
        return
      }
      ctx.globalAlpha = fadeOut(a, 0.35)
      blitEllipse(ctx, Math.round(r * 1.05), Math.round(r * 0.45), hot ? 'rgba(48,20,8,0.5)' : 'rgba(64,8,48,0.45)', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'gigaDrain': {
      ctx.globalAlpha = Math.min(fadeIn(a, 0.1), fadeOut(a, 0.2)) * 0.8
      dashedRing(ctx, a.x, a.y + r, r * 1.1, t * 5, ['#a8e870', '#58b838'], 0.6, 0.4)
      ctx.globalAlpha = 1
      return
    }
  }
}

/* ---------------- Overlay layer ---------------- */

/** The maw: rises with its jaws wide, snaps shut on every bite, then sinks into its shadow. */
const drawMaw = (ctx: Ctx, a: Attack, t: number) => {
  const r = radius(a)
  const scale = Math.max(1, Math.round(r / 11))
  const top = SPR.mawTop()
  const bottom = SPR.mawBottom()
  const since = a.age - JAW_RISE
  const wide = r * 0.95
  const done = since >= JAW_BITES * JAW_BEAT
  // Each bite: shut at the beat, then open again until the next one.
  const gap = since < 0 ? wide * (0.6 + 0.4 * Math.min(1, a.age / JAW_RISE)) : done ? 0 : wide * 0.75 * Math.min(1, ((since % JAW_BEAT) / JAW_BEAT) * 1.6)
  const rise = Math.round((1 - Math.min(1, a.age / JAW_RISE)) * 6 + (done ? (since - JAW_BITES * JAW_BEAT) * 30 : 0))
  ctx.globalAlpha = fadeIn(a, 0.08) * fadeOut(a, 0.18)
  const jitter = !done && since >= 0 && since % JAW_BEAT < 0.04 ? (a.flip ? 1 : -1) : 0
  blitRotated(ctx, top, a.x + jitter, a.y + rise - gap - (top.height * scale) / 2 + 2, 0, scale)
  blitRotated(ctx, bottom, a.x - jitter, a.y + rise + gap + (bottom.height * scale) / 2 - 2, 0, scale)
  // Eyes glow brighter right before a bite.
  if (!done && Math.floor(t * 12 + a.id) % 2 === 0) {
    const ey = a.y + rise - gap - top.height * scale + 2 + 3 * scale
    px(ctx, a.x - 4 * scale, ey, '#ffc0c8', scale, scale)
    px(ctx, a.x + 4 * scale, ey, '#ffc0c8', scale, scale)
  }
  ctx.globalAlpha = 1
}

/** The tip of a steel beam: a white-hot flare with sparks flying off. */
const beamFlare = (ctx: Ctx, a: Attack, t: number, thick: number) => {
  const flick = Math.floor((t + a.id) * 20) % 2
  blitEllipse(ctx, Math.round(thick * 0.75) + flick, Math.round(thick * 0.75) + flick, 'rgba(200,216,248,0.55)', a.x, a.y)
  blitEllipse(ctx, Math.round(thick * 0.45), Math.round(thick * 0.45), '#ffffff', a.x, a.y)
  for (let i = 0; i < 5; i++) {
    const angle = hash2(i, Math.floor(t * 18) + a.id) * Math.PI * 2
    const d = thick * 0.6 + hash2(a.id, i + Math.floor(t * 18)) * thick * 1.2
    px(ctx, a.x + Math.cos(angle) * d, a.y + Math.sin(angle) * d, i % 2 ? '#ffffff' : '#c8d0e0')
  }
}

/** Overlay layer (above Pokémon). */
export const drawTypeEvolvedAttack = (ctx: Ctx, a: Attack, t: number) => {
  const m = a.motion
  const r = radius(a)
  switch (a.visual) {
    case 'jawLock':
      return drawMaw(ctx, a, t)
    case 'jawBite': {
      // The snap: a white flash and fang sparks.
      ctx.globalAlpha = fadeOut(a, 0.1)
      rays(ctx, a.x, a.y, r * 0.8, ['#ffffff', '#f87888'])
      ctx.globalAlpha = 1
      return
    }
    case 'superFist': {
      if (m.kind !== 'follow') return
      const angle = Math.atan2(m.oy + 8, m.ox)
      const out = Math.min(1, a.age / 0.06)
      const reach = Math.hypot(m.ox, m.oy + 8)
      const x = a.x - Math.cos(angle) * reach * (1 - out)
      const y = a.y - Math.sin(angle) * reach * (1 - out)
      ctx.globalAlpha = fadeOut(a, 0.12)
      // Speed lines behind the fist.
      for (let lane = -1; lane <= 1; lane++) {
        const ox = -Math.sin(angle) * lane * 4
        const oy = Math.cos(angle) * lane * 4
        for (let d = 8; d < 20 - Math.abs(lane) * 5; d++) px(ctx, x - Math.cos(angle) * d + ox, y - Math.sin(angle) * d + oy, lane === 0 ? '#f8b090' : '#ffffff')
      }
      blitRotated(ctx, SPR.fist(), x, y, angle, Math.max(1, Math.round(r / 12)))
      if (out >= 1) {
        const e = Math.min(1, (a.age - 0.06) / 0.2)
        blitRing(ctx, Math.round(r * (0.5 + e)), 1, e < 0.5 ? '#ffffff' : '#f8b090', x + Math.cos(angle) * 6, y + Math.sin(angle) * 6)
        if (a.age < 0.14) rays(ctx, x + Math.cos(angle) * 8, y + Math.sin(angle) * 8, r * 0.9, ['#ffffff', '#f8e070'])
      }
      ctx.globalAlpha = 1
      return
    }
    case 'superJab': {
      if (m.kind !== 'follow') return
      const angle = Math.atan2(m.oy + 8, m.ox)
      blitRotated(ctx, SPR.fist(), a.x, a.y, angle)
      if (a.age > a.ttl * 0.45) rays(ctx, a.x + Math.cos(angle) * 6, a.y + Math.sin(angle) * 6, 5, ['#ffffff', '#f8e070'])
      return
    }
    case 'psyVortex': {
      // The eye opens over the crowd, bobbing, then shuts as the burst lands.
      const eye = SPR.eye()
      const open = Math.min(1, a.age / 0.2) * Math.min(1, (a.ttl - a.age) / 0.12)
      const h = Math.max(1, Math.round(eye.height * open))
      const scale = Math.max(1, Math.round(r / 30))
      const y = Math.round(a.y - r * 0.55 + Math.sin(t * 5 + a.id) * 1.5)
      ctx.drawImage(eye, 0, 0, eye.width, eye.height, Math.round(a.x - (eye.width * scale) / 2), Math.round(y - (h * scale) / 2), eye.width * scale, h * scale)
      // Motes drawn into the pupil.
      for (let i = 0; i < 10; i++) {
        const k = 1 - ((a.age * 1.3 + i / 10) % 1)
        const angle = i * 2.4 + a.id - k * 2
        px(ctx, a.x + Math.cos(angle) * r * k, a.y + Math.sin(angle) * r * k * 0.75, k > 0.5 ? '#f888b0' : '#ffffff', 2, 2)
      }
      return
    }
    case 'psyBurst': {
      const e = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitEllipse(ctx, Math.round(r * (0.4 + 0.5 * e)), Math.round(r * (0.4 + 0.5 * e)), 'rgba(248,136,176,0.4)', a.x, a.y)
      if (a.age < 0.08) blitEllipse(ctx, Math.round(r * 0.5), Math.round(r * 0.5), '#ffffff', a.x, a.y)
      blitRing(ctx, Math.round(r * (0.6 + 0.6 * e)), 2, '#ffd0e8', a.x, a.y)
      blitRing(ctx, Math.round(r * (0.3 + 0.9 * e)), 1, '#f85888', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'steelBeam': {
      if (m.kind !== 'orbit') return
      // Thin as it fires up and as it dies, full in between, with a slight hum.
      const life = Math.min(1, a.age / 0.07, (a.ttl - a.age) / 0.14)
      const thick = Math.max(2, Math.round((A.BEAM_CROSS.length + Math.floor((t + a.id * 0.01) * 24) % 2) * Math.min(1.6, r / 8) * life))
      const length = r * 3.2
      const cos = Math.cos(m.angle)
      const sin = Math.sin(m.angle)
      if (m.radius < 15) {
        // The segment at the player starts a few px out, so the beams don't paint over the sprite.
        const near = 8
        const far = m.radius + length / 2
        const mid = (near + far) / 2 - m.radius
        stretch(ctx, SPR.beam(), a.x + cos * mid, a.y + sin * mid, m.angle, far - near, thick)
        // The muzzle: a flash as it fires, then a small hot spot.
        const mr = a.age < 0.1 ? Math.round(thick * 0.5) : Math.max(2, Math.round(thick * 0.25))
        blitEllipse(ctx, mr, mr, '#ffffff', a.x + cos * (near - m.radius), a.y + sin * (near - m.radius))
      } else stretch(ctx, SPR.beam(), a.x, a.y, m.angle, length, thick)
      if (a.flip) beamFlare(ctx, a, t, thick)
      return
    }
    case 'parade': {
      const frames = SPR.parade()
      const heading = m.kind === 'wander' ? m.heading : 0
      ctx.globalAlpha = Math.min(fadeIn(a, 0.2), fadeOut(a, 0.35))
      // Two fading afterimages trail behind each flame.
      for (let k = 2; k >= 1; k--) {
        blitEllipse(ctx, 3 - k, 3 - k, k === 2 ? 'rgba(112,72,192,0.35)' : 'rgba(176,144,240,0.5)', a.x - Math.cos(heading) * k * 6, a.y - Math.sin(heading) * k * 6 + 2)
      }
      const scale = Math.max(1, Math.round(r / 9))
      const glow = 7 + (Math.floor((t + a.id * 0.13) * 8) % 2)
      blitEllipse(ctx, glow, glow, 'rgba(176,144,240,0.3)', a.x, a.y - 2)
      blitEllipse(ctx, glow - 3, glow - 3, 'rgba(240,224,255,0.35)', a.x, a.y - 2)
      blitRotated(ctx, frames[Math.floor((t + a.id * 0.13) * 8) % 2]!, a.x, a.y - 2 + Math.round(Math.sin(t * 7 + a.id) * 1.5), 0, scale)
      ctx.globalAlpha = 1
      return
    }
    case 'phantomVolley': {
      ctx.globalAlpha = fadeOut(a, 0.15)
      blitRotated(ctx, SPR.arrow(), a.x, a.y, m.kind === 'linear' ? Math.atan2(m.vy, m.vx) - Math.PI / 2 : Math.PI)
      ctx.globalAlpha = 1
      return
    }
    case 'phantomFall': {
      // The arrow plunges from the sky, faster and faster, trailing spirit light.
      const k = Math.min(1, a.age / a.ttl)
      const drop = 150 * (1 - k * k)
      const arrow = SPR.arrow()
      const h = arrow.height * 2
      const y = a.y - h / 2 - drop
      ctx.globalAlpha = Math.min(1, k * 4)
      for (let d = 2; d < 30; d += 2) px(ctx, a.x - 1, y - h / 2 - d, d < 12 ? '#c8f0d8' : '#a070d8', 2, 1)
      blitRotated(ctx, arrow, a.x, y, 0, 2)
      ctx.globalAlpha = 1
      return
    }
    case 'phantomArrow': {
      // Stuck in the ground, head buried, with a spectral splash on impact.
      const arrow = SPR.arrow()
      const shown = arrow.height - 5
      ctx.globalAlpha = fadeOut(a, 0.25)
      ctx.drawImage(arrow, 0, 0, arrow.width, shown, Math.round(a.x - arrow.width + (a.flip ? 1 : 0)), Math.round(a.y - shown * 2 + 2), arrow.width * 2, shown * 2)
      if (a.age < 0.22) {
        const e = a.age / 0.22
        blitRing(ctx, Math.round(r * (0.4 + e)), 1, e < 0.5 ? '#ffffff' : '#58d888', a.x, a.y - 3)
        rays(ctx, a.x, a.y - 3, r * 0.8 * (1 - e * 0.5), ['#ffffff', '#a070d8'])
      }
      ctx.globalAlpha = 1
      return
    }
    case 'aquaCutter': {
      const scale = Math.max(1, Math.round(r / 8))
      dashedRing(ctx, a.x, a.y, r + 2, -a.age * 30, ['#ffffff', '#a8d8f8'], 0.35)
      return blitRotated(ctx, SPR.pinwheel(), a.x, a.y, a.age * 24, scale)
    }
    case 'searing': {
      if (a.age < a.activeFrom) {
        const k = a.age / a.activeFrom
        const x = a.from.x + (a.x - a.from.x) * k
        const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 60
        blitEllipse(ctx, 7, 7, 'rgba(248,160,48,0.35)', x, y)
        return blitRotated(ctx, SPR.searing(), x, y, a.age * 16)
      }
      // The blast: a white core, a fireball and a shock ring, with tongues of flame.
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      const rr = Math.round(r * (0.55 + 0.5 * e))
      ctx.globalAlpha = Math.max(0, 1 - e)
      blitEllipse(ctx, rr, Math.round(rr * 0.8), 'rgba(240,96,32,0.55)', a.x, a.y - 2)
      blitEllipse(ctx, Math.round(rr * 0.65), Math.round(rr * 0.52), '#f8c040', a.x, a.y - 3)
      blitEllipse(ctx, Math.round(rr * 0.32), Math.round(rr * 0.26), '#ffffff', a.x, a.y - 3)
      blitRing(ctx, Math.round(r * (0.7 + 0.7 * e)), 1, '#fff0a0', a.x, a.y - 2)
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 + a.id
        const d = rr * (0.9 + e * 0.4)
        blitCentered(ctx, FX.flame()[i % 2]!, a.x + Math.cos(angle) * d, a.y - 2 + Math.sin(angle) * d * 0.8 - 4)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'searingEmber':
      return blitCentered(ctx, SPR.ember()[Math.floor((t + a.id) * 14) % 2]!, a.x, a.y)
    case 'gigaDrain': {
      // A glowing bud where the vine bites in.
      const pulse = 1 + Math.floor((t * 6 + a.id) % 2)
      ctx.globalAlpha = Math.min(fadeIn(a, 0.1), fadeOut(a, 0.2))
      blitEllipse(ctx, 3 + pulse, 3 + pulse, 'rgba(120,232,96,0.4)', a.x, a.y)
      blitEllipse(ctx, 2, 2, '#c8f8a0', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'jealousySong': {
      ctx.globalAlpha = fadeOut(a, 0.3)
      dashedRing(ctx, a.x, a.y, r, a.age * 14, ['#f878c8', '#ffffff', '#d03898'], 0.6, 0.8)
      dashedRing(ctx, a.x, a.y, r * 0.7, -a.age * 18, ['#f8b8e0'], 0.35, 0.8)
      ctx.globalAlpha = 1
      return
    }
    case 'jealousy': {
      const frames = SPR.envy()
      const frame = frames[Math.floor((t + a.id * 0.1) * 12) % 2]!
      if (a.age < a.activeFrom) {
        // A little envious flame flickers on the sigil before the pillar bursts.
        const k = a.age / a.activeFrom
        ctx.globalAlpha = k
        blitCentered(ctx, frame, a.x, a.y - frame.height / 2)
        ctx.globalAlpha = 1
        return
      }
      const e = (a.age - a.activeFrom) / (a.ttl - a.activeFrom)
      // A column of crisp flames stacked tier on tier: it shoots up, sways, then burns down from the top.
      const tiers = Math.round(5 * Math.min(1, e * 7) * (1 - Math.max(0, e - 0.55) * 2))
      if (tiers <= 0) return
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, e - 0.7) * 3)
      blitEllipse(ctx, Math.round(r * 0.9), Math.round(r * 0.4), 'rgba(248,120,200,0.5)', a.x, a.y)
      const tick = Math.floor((t + a.id * 0.1) * 12)
      for (let j = tiers - 1; j >= 0; j--) {
        const sway = Math.round(Math.sin(t * 9 + j * 1.3 + a.id) * (1 + j * 0.4))
        const y = a.y - 4 - j * 8
        const spread = j === 0 ? 5 : j === 1 ? 3 : 0
        if (spread > 0) {
          blitCentered(ctx, frames[(tick + j) % 2]!, a.x - spread + sway, y)
          blitCentered(ctx, frames[(tick + j + 1) % 2]!, a.x + spread + sway, y)
        }
        blitCentered(ctx, frames[(tick + j) % 2]!, a.x + sway, y - 2)
      }
      if (e < 0.25) blitRing(ctx, Math.round(r * (0.5 + e * 3)), 1, '#fff0f8', a.x, a.y)
      ctx.globalAlpha = 1
      return
    }
    case 'trailblaze': {
      if (m.kind !== 'orbit' || !a.flip) return
      // The tip draws the whole swoosh: a fan from the player out to the blade,
      // bright right behind it and fraying into dither further back.
      const back = m.spin >= 0 ? -1 : 1
      const life = Math.min(1, (a.ttl - a.age) / 0.12)
      const trail = Math.min(0.9, a.age * 8) * life
      const cx = a.x - Math.cos(m.angle) * m.radius
      const cy = a.y - Math.sin(m.angle) * m.radius
      for (let rr = Math.max(14, Math.round(m.radius * 0.5)); rr <= m.radius + 1; rr += 2) {
        const edge = rr > m.radius - 3
        const steps = Math.ceil((rr * trail) / 2)
        for (let i = 0; i <= steps; i++) {
          const k = i / Math.max(1, steps)
          if (k > 0.35 && hash2(i, rr + a.id) < k * 0.9) continue
          const angle = m.angle + back * trail * k
          const color = edge ? (k < 0.3 ? '#ffffff' : '#3c7820') : k < 0.15 ? '#ffffff' : k < 0.4 ? '#f8ffb0' : '#c8f060'
          px(ctx, cx + Math.cos(angle) * rr, cy + Math.sin(angle) * rr, color, 2, 2)
        }
      }
      ctx.globalAlpha = life
      blitRotated(ctx, SPR.blade(), a.x, a.y, m.angle + Math.PI / 4 + back * -0.4, 2)
      ctx.globalAlpha = 1
      return
    }
    case 'liquidation': {
      if (m.kind !== 'linear') return
      // A breaking wave: a foam-capped crest leaning the way it rolls.
      const dir = Math.atan2(m.vy, m.vx)
      ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.15)
      const cx = a.x - Math.cos(dir) * r * 0.45
      const cy = a.y - Math.sin(dir) * r * 0.45
      crescent(ctx, cx, cy, r, dir, 2.3, ['#ffffff', '#e8f8ff', '#a8d8f8', '#4878e8', '#2848b0'])
      crescent(ctx, cx, cy, r - 5, dir, 2, ['#68a0f0', '#4878e8', '#3860d0', '#2848b0'])
      crescent(ctx, cx, cy, r - 9, dir, 1.6, ['#a8d8f8', '#68a0f0', '#4878e8'])
      crescent(ctx, cx, cy, r - 12, dir, 1.1, ['#e8f8ff', '#a8d8f8'])
      for (let i = 0; i < 6; i++) {
        const angle = dir + (hash2(i, a.id) - 0.5) * 2.2
        const d = r + 2 + hash2(a.id, i + Math.floor(t * 20)) * 5
        px(ctx, cx + Math.cos(angle) * d, cy + Math.sin(angle) * d, '#ffffff')
      }
      ctx.globalAlpha = 1
      return
    }
    case 'alluring': {
      const e = a.age / a.ttl
      ctx.globalAlpha = Math.max(0, 1 - e * e)
      heartLine(ctx, a.x, a.y, r, a.age * 16, ['#ffffff', '#f8a8d0', '#f878a8'])
      if (r > 14) heartLine(ctx, a.x, a.y, r * 0.78, -a.age * 12, ['#f8c8e0'])
      // Little hearts riding the wave.
      for (let i = 0; i < 4; i++) {
        const u = (i / 4) * Math.PI * 2 + a.id
        blitCentered(ctx, FX.heart(), a.x + Math.cos(u) * r * 0.9, a.y + Math.sin(u) * r * 0.8 - Math.round(Math.sin(a.age * 12 + i) * 2))
      }
      ctx.globalAlpha = 1
      return
    }
  }
}

/**
 * Giga Drain's vines, from the caster to each foe they latch onto, with motes
 * of life flowing back. Drawn after the attacks (they need the caster).
 */
export const drawDrainVines = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.visual !== 'gigaDrain' || a.age < 0) continue
    const p = ownerOf(g, a.owner)
    const x0 = p.x
    const y0 = p.y - 10
    const dx = a.x - x0
    const dy = a.y - y0
    const len = Math.hypot(dx, dy)
    if (len < 2) continue
    const nx = -dy / len
    const ny = dx / len
    const grow = Math.min(1, a.age / 0.12)
    const life = Math.min(1, (a.ttl - a.age) / 0.2)
    ctx.globalAlpha = life
    const steps = Math.round(len * grow)
    for (let i = 0; i <= steps; i++) {
      const k = i / len
      const wave = Math.sin(k * Math.PI * 4 - t * 10 + a.id) * 2.2 * Math.sin(k * Math.PI)
      const x = x0 + dx * k + nx * wave
      const y = y0 + dy * k + ny * wave
      px(ctx, x - 1, y - 1, '#2c6820', 3, 3)
      px(ctx, x, y, i % 9 < 2 ? '#f0ffd0' : '#98e060')
      // Leaves along the vine.
      if (i % 14 === 7) px(ctx, x + nx * 2, y + ny * 2, '#c8f8a0', 3, 2)
    }
    if (grow >= 1) {
      for (let i = 0; i < 3; i++) {
        const k = 1 - ((t * 1.4 + i / 3 + a.id * 0.17) % 1)
        const x = x0 + dx * k
        const y = y0 + dy * k
        blitEllipse(ctx, 2, 2, 'rgba(200,248,160,0.7)', x, y)
        px(ctx, x, y, '#ffffff')
      }
    }
    ctx.globalAlpha = 1
  }
}

