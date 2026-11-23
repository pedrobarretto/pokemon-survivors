import { blitCentered, blitEllipse, blitRotated, fillPlotted, plot } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { GALLOP } from '../game/gallopRules'
import type { Attack, Game, Player } from '../game/types'
import { GALLOP_EVO_FX, GALLOP_FX } from './gallopArt'
import { detail } from './quality'
import { dashedRing } from './strokes'

/**
 * How Ponyta's gallop batch looks (`game/gallopMoves.ts`): the erupting
 * earth, the kicks, the drills, the morning sun and the hops' landings, and
 * how high a hop lifts the player (`gallopLift`). Presentation only; whole
 * pixels (rotated sprites keep their chunky pixels at the low resolution).
 */

type Ctx = CanvasRenderingContext2D

const fadeOut = (a: Attack, window: number) => Math.max(0, Math.min(1, (a.ttl - a.age) / window))
/** Headlong Rush's shard: how long it stands, and how long it takes to shatter. */
const PILLAR_TIMES = { hold: 0.24, shatter: 0.1 } as const

const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/** A few chunks flung from (x, y), by the attack's id so each eruption scatters its own way. */
const chunks = (ctx: Ctx, a: Attack, x: number, y: number, count: number, reach: number, color: string) => {
  const k = Math.min(1, a.age / 0.25)
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + ((i / Math.max(1, count - 1)) - 0.5) * 2.2 + (a.id % 7) * 0.05
    const d = reach * k
    // A short arc: out, then down again.
    ctx.fillRect(Math.round(x + Math.cos(ang) * d), Math.round(y + Math.sin(ang) * d + k * k * reach * 0.9), 2, 2)
  }
}


/** `n` straight rays out of (x, y) from `r0` to `r1` px, flattened by `squash`, plotted in `color`. */
const rays = (x: number, y: number, n: number, r0: number, r1: number, rot: number, color: string, squash = 1) => {
  for (let i = 0; i < n; i++) {
    const ang = (i / n) * TAU + rot
    const c = Math.cos(ang)
    const sn = Math.sin(ang) * squash
    for (let d = r0; d <= r1; d++) plot(color, x + c * d, y + sn * d)
  }
}

/** A ring `thick` px thick, solid, flattened onto the ground by `squash`. */
const solidRing = (x: number, y: number, r: number, thick: number, color: string, squash = 0.45) => {
  const steps = Math.max(16, Math.floor(r * TAU))
  for (let j = 0; j < thick; j++) {
    const rr = r - j
    if (rr < 1) break
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * TAU
      plot(color, x + Math.cos(a) * rr, y + Math.sin(a) * rr * squash)
    }
  }
}

/**
 * Jagged cracks splitting the ground out of (x, y): `arms` of them, `len` px
 * long, by the attack's id. `hot`, they glow (a light core, an orange edge);
 * cooled, they're dark.
 */
const fissure = (x: number, y: number, seed: number, arms: number, len: number, hot: boolean) => {
  for (let k = 0; k < arms; k++) {
    const ang = (k / arms) * TAU + hash2(seed, k, 11) * 0.9
    const c = Math.cos(ang)
    const sn = Math.sin(ang) * 0.5
    const reach = len * (0.6 + hash2(seed, k, 12) * 0.4)
    for (let d = 2; d <= reach; d++) {
      const jit = Math.round((hash2(seed, k * 31 + Math.floor(d / 3), 13) - 0.5) * 3)
      const px = x + c * d - sn * jit
      const py = y + sn * d + c * jit * 0.5
      if (hot) {
        plot('#a83010', px, py + 1)
        plot(d < reach * 0.55 ? '#fff0a0' : '#f88828', px, py)
      } else plot('#3a2410', px, py)
    }
  }
}

/** Dust puffing out sideways from a foot at (x, y), `k` 0 → 1 over its life: solid clumps that thin out as they go. */
const dust = (x: number, y: number, k: number, spread: number, seed: number) => {
  for (let i = 0; i < 8; i++) {
    if (hash2(seed, i, 21) < k * 0.9) continue
    const side = i % 2 === 0 ? -1 : 1
    const out = 3 + k * spread * (0.6 + hash2(seed, i, 22) * 0.6)
    const size = k < 0.4 ? 3 : 2
    plot(i % 3 === 0 ? '#f0e0c0' : '#c8a878', x + side * out - 1, y - k * 7 - (i >> 1) * 1.5, size, size - 1)
  }
}

/** Rock debris flung up out of (x, y) and falling back: chunky bits in two tones. */
const debris = (x: number, y: number, age: number, seed: number, count: number, reach: number) => {
  for (let i = 0; i < count; i++) {
    const ang = -Math.PI / 2 + (hash2(seed, i, 31) - 0.5) * 2.4
    const v = reach * (0.7 + hash2(seed, i, 32) * 0.6)
    const px = x + Math.cos(ang) * v * age * 4
    const py = y + Math.sin(ang) * v * age * 4 + 220 * age * age
    const size = i % 3 === 0 ? 3 : 2
    plot(i % 2 ? '#8a7458' : '#5a4a38', px, py, size, size)
  }
}

export const drawGallopAttack = (ctx: Ctx, a: Attack, t: number) => {
  switch (a.visual) {
    case 'gallopQuake': {
      if (a.age < 0) return
      const r = radiusOf(a)
      const fade = fadeOut(a, 0.15)
      ctx.globalAlpha = fade
      blitEllipse(ctx, Math.round(r * 0.8), Math.max(1, Math.round(r * 0.3)), 'rgba(40,24,8,0.4)', a.x, a.y + 2)
      blitCentered(ctx, GALLOP_FX.crack(), a.x, a.y + 2)
      // A full gallop throws the earth up tallest (`memo`: the cast's momentum).
      const size = a.memo >= 0.85 ? 2 : a.memo >= 0.55 ? 1 : 0
      const rise = Math.round(Math.min(1, a.age / 0.08) * (3 + size * 2))
      const plume = GALLOP_FX.plume[size]!()
      ctx.drawImage(plume, Math.round(a.x - plume.width / 2), Math.round(a.y - plume.height + 3 - rise + (1 - fade) * 4))
      if (!detail.lean) chunks(ctx, a, a.x, a.y - 2, 3 + size, 6 + size * 3, '#8a5a28')
      ctx.globalAlpha = 1
      return
    }
    case 'gallopPillar': {
      // Headlong Rush: the ground splits, a rock shard bursts up through it (overshooting, then settling), dust and
      // debris fly, then it shatters with a shockwave and leaves rubble while the hitbox lingers. The lines' shards go
      // off in sequence, so the eruption runs out ahead of the player like a wave.
      if (a.age < 0) return
      const seed = a.id
      const kind = seed % 3
      const hot = a.age < 0.2
      ctx.globalAlpha = fadeOut(a, 0.15)
      fissure(a.x, a.y + 2, seed, 4, 12 + kind * 2, hot)
      if (a.age < 0.06) {
        blitEllipse(ctx, 7, 3, '#fff0a0', a.x, a.y + 2)
        blitEllipse(ctx, 4, 2, '#ffffff', a.x, a.y + 2)
      }
      fillPlotted(ctx)
      const { hold, shatter } = PILLAR_TIMES
      if (a.age < hold + shatter) {
        const spire = (hot ? GALLOP_EVO_FX.spire : GALLOP_EVO_FX.spireCold)[kind]!()
        // Thrust: 0 → 1.15 → 1 of its height in the first 0.1 s; shattering, it sinks back in.
        const up = a.age < 0.06 ? (a.age / 0.06) * 1.15 : a.age < 0.1 ? 1.15 - ((a.age - 0.06) / 0.04) * 0.15 : 1
        const sink = Math.max(0, (a.age - hold) / shatter)
        const h = Math.max(2, Math.min(spire.height, Math.round(spire.height * Math.min(1, up) * (1 - sink * 0.8))))
        const lift = up > 1 ? Math.round((up - 1) * 12) : 0
        ctx.drawImage(spire, 0, 0, spire.width, h, Math.round(a.x - spire.width / 2), Math.round(a.y + 3 - h - lift), spire.width, h)
      }
      if (!detail.lean) {
        if (a.age < 0.35) dust(a.x, a.y + 2, a.age / 0.35, 12, seed)
        if (a.age < 0.3) debris(a.x, a.y - 6, a.age, seed, 6, 30)
      }
      if (a.age >= hold) {
        // The shockwave as it breaks, then the rubble it leaves.
        const k = Math.min(1, (a.age - hold) / 0.12)
        if (k < 1) {
          solidRing(a.x, a.y + 2, 4 + k * 14, k < 0.5 ? 2 : 1, '#f0e0c0')
          if (!detail.lean) debris(a.x, a.y - 2, (a.age - hold) * 0.6, seed + 7, 5, 26)
        }
        for (let i = 0; i < 5; i++) {
          const rx = a.x + (hash2(seed, i, 61) - 0.5) * 14
          const ry = a.y + (hash2(seed, i, 62) - 0.5) * 5
          plot('#3c3436', rx - 1, ry + 1, 4, 1)
          plot(i % 2 ? '#9a9090' : '#ddd6cc', rx - 1, ry - 1, i % 3 === 0 ? 3 : 2, 2)
        }
      }
      fillPlotted(ctx)
      ctx.globalAlpha = 1
      return
    }
    case 'lowKick': {
      if (a.motion.kind !== 'orbit') return
      // The outer segment draws the swoosh: an arc from where the sweep began to where it is, thick and fading at its tail.
      if (a.motion.radius < GALLOP.lowKick.length * 0.7) return
      const m = a.motion
      const k = a.age / a.ttl
      const cx = a.x - Math.cos(m.angle) * m.radius
      const cy = a.y - Math.sin(m.angle) * m.radius
      const swept = m.spin * a.age
      const steps = Math.max(6, Math.round(Math.abs(swept) * m.radius * 0.7))
      ctx.globalAlpha = Math.max(0, 1 - k * 0.5)
      for (let i = 0; i <= steps; i++) {
        const f = i / steps
        const ang = m.angle - swept * (1 - f)
        // Thin at the tail, three pixels at the head; the light core sits outside, the orange edge in.
        const w = 1 + Math.round(f * 2)
        for (let j = 0; j < w; j++) {
          const r = m.radius - j
          ctx.fillStyle = j === 0 ? '#ffffff' : j === 1 ? '#f8c880' : '#e86830'
          ctx.fillRect(Math.round(cx + Math.cos(ang) * r), Math.round(cy + 4 + Math.sin(ang) * r * 0.6), 1, 1)
        }
      }
      // Dust kicked up where the hoof is now.
      if (!detail.lean) {
        ctx.fillStyle = '#d8c0a0'
        ctx.fillRect(Math.round(a.x - 2), Math.round(a.y + 6), 2, 1)
        ctx.fillRect(Math.round(a.x + 1), Math.round(a.y + 5), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'axeKick': {
      // The heel lands: a white flash, the ground split red-hot under it, dust and rubble thrown out.
      const fade = fadeOut(a, 0.2)
      ctx.globalAlpha = fade
      fissure(a.x, a.y + 2, a.id, 6, 18, a.age < 0.2)
      if (!detail.lean) {
        dust(a.x, a.y + 2, Math.min(1, a.age / 0.4), 18, a.id)
        if (a.age < 0.35) debris(a.x, a.y - 2, a.age, a.id, 8, 34)
      }
      fillPlotted(ctx)
      if (a.age < 0.05) blitEllipse(ctx, 14, 7, '#ffffff', a.x, a.y)
      blitRotated(ctx, a.age < 0.08 ? GALLOP_EVO_FX.bigImpact() : GALLOP_FX.impactRed(), a.x, a.y - 4, 0, a.age < 0.14 ? 2 : 1)
      // The heel, planted for a moment before it lifts away.
      if (a.age < 0.08) blitRotated(ctx, GALLOP_FX.hoof(), a.x, a.y - 12, 0, 2)
      ctx.globalAlpha = 1
      return
    }
    case 'axeRing': {
      if (a.age < 0) return
      // The shockwave: a thick hot band and a white one racing ahead of it.
      const r = radiusOf(a)
      ctx.globalAlpha = fadeOut(a, 0.12)
      solidRing(a.x, a.y + 2, r, 2, '#e05830')
      solidRing(a.x, a.y + 2, r + 3, 1, '#ffffff')
      solidRing(a.x, a.y + 2, Math.max(2, r - 3), 1, '#f8c048')
      fillPlotted(ctx)
      ctx.globalAlpha = 1
      return
    }
    case 'hornDrill': {
      // On the foe, pointing the way it came from the player, its spiral turning.
      const ang = Math.atan2(a.y - a.from.y, a.x - a.from.x)
      if (a.move === 'hyperDrill') return drawHyperBore(ctx, a, t, ang)
      const frame = GALLOP_FX.drill[Math.floor(t * 30 + a.id) % 2]!()
      const back = Math.round(6 - Math.min(1, a.age / 0.08) * 4)
      ctx.globalAlpha = fadeOut(a, 0.08)
      blitRotated(ctx, frame, a.x - Math.cos(ang) * (back + 8), a.y - Math.sin(ang) * (back + 8), ang)
      if (!detail.lean && Math.floor(t * 20 + a.id) % 2 === 0) {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(Math.round(a.x + Math.cos(ang + 2) * 4), Math.round(a.y + Math.sin(ang + 2) * 4), 1, 1)
        ctx.fillRect(Math.round(a.x + Math.cos(ang - 2) * 5), Math.round(a.y + Math.sin(ang - 2) * 5), 1, 1)
      }
      ctx.globalAlpha = 1
      return
    }
    case 'hornBlow': {
      // Waits on the foe until the bores are done; its one hit pushes `tether.next` 99 s on, so from then it bursts.
      if (a.motion.kind !== 'tether' || a.motion.next < 50) return
      const since = a.age - (a.motion.next - 99)
      if (since < 0) return
      if (a.move === 'hyperDrill') return drawHyperBlow(ctx, a, since)
      ctx.globalAlpha = Math.max(0, 1 - since / 0.3)
      blitRotated(ctx, since < 0.06 ? GALLOP_FX.impact() : GALLOP_FX.impactRed(), a.x, a.y, 0, since < 0.1 ? 2 : 1)
      dashedRing(ctx, a.x, a.y, 6 + since * 70, a.id, ['#ffffff', '#f8c048'], 0.7)
      ctx.globalAlpha = 1
      return
    }
    case 'hyperLance': {
      if (a.age < 0 || a.motion.kind !== 'linear') return
      const ang = Math.atan2(a.motion.vy, a.motion.vx)
      const speed = Math.hypot(a.motion.vx, a.motion.vy)
      screwTrail(a.x, a.y, ang, Math.min(a.age * speed, GALLOP.hyperDrill.lance), t * 40, 1)
      fillPlotted(ctx)
      // A white-hot glow at the point, the lance spinning over it.
      const tip = { x: a.x + Math.cos(ang) * 14, y: a.y + Math.sin(ang) * 14 }
      blitEllipse(ctx, 5, 5, '#fff0a0', tip.x, tip.y)
      blitEllipse(ctx, 3, 3, '#ffffff', tip.x, tip.y)
      blitRotated(ctx, GALLOP_EVO_FX.lance[Math.floor(t * 30 + a.id) % 2]!(), a.x, a.y, ang)
      return
    }
    case 'morningSun': {
      const r = radiusOf(a)
      // The sun rises over the head and fades; the halo spreads once.
      const k = Math.min(1, a.age / 0.25)
      ctx.globalAlpha = fadeOut(a, 0.25)
      const sy = a.y - 18 - Math.round(k * 6)
      // Rays: short dashes turning around the disc, longer under a sunny sky (`tier`).
      if (!detail.lean) rays(a.x, sy, 8, 8, a.tier > 0 ? 12 : 10, a.age * 1.5, '#f8c040')
      fillPlotted(ctx)
      blitCentered(ctx, GALLOP_FX.sun(), a.x, sy)
      // A bold halo: a solid gold band with a pale rim inside, glints riding it.
      const hr = Math.max(3, r * Math.min(1, a.age / 0.18))
      solidRing(a.x, a.y + 6, hr, 2, '#f8c040', 0.5)
      solidRing(a.x, a.y + 6, hr - 3, 1, '#fff0a0', 0.5)
      fillPlotted(ctx)
      dashedRing(ctx, a.x, a.y + 6, hr + 1, a.id + a.age * 8, ['#ffffff'], a.tier > 0 ? 0.4 : 0.25, 0.5)
      ctx.globalAlpha = 1
      return
    }
    case 'revivalFlare':
      return drawRevival(ctx, a)
    case 'bounceLand': {
      if (a.age < 0) return
      const r = radiusOf(a) * Math.min(1, a.age / 0.1)
      ctx.globalAlpha = fadeOut(a, 0.18)
      blitEllipse(ctx, Math.round(radiusOf(a) * 0.35), Math.max(1, Math.round(radiusOf(a) * 0.12)), 'rgba(24,40,72,0.3)', a.x, a.y + 2)
      // A solid shock ring with a lighter one inside it, gold once the crescendo builds.
      dashedRing(ctx, a.x, a.y + 2, Math.max(2, r), a.id, ['#ffffff'], 1, 0.42)
      dashedRing(ctx, a.x, a.y + 2, Math.max(1, r - 2), a.id, [a.tier >= 2 ? '#f8d048' : '#88c0f0'], 0.7, 0.42)
      if (!detail.lean) chunks(ctx, a, a.x, a.y, 4, 6 + a.tier * 2, '#e8f4ff')
      ctx.globalAlpha = 1
      return
    }
    case 'skyDive': {
      // The dive lands: a flash, a crater, a gale ring and a second one inside it, feathers of wind flung out.
      const r = radiusOf(a)
      ctx.globalAlpha = fadeOut(a, 0.2)
      fissure(a.x, a.y + 2, a.id, 5, 14, false)
      const k = Math.min(1, a.age / 0.14)
      solidRing(a.x, a.y + 2, Math.max(2, r * k), 2, '#ffffff')
      solidRing(a.x, a.y + 2, Math.max(1, r * k - 4), 1, '#88b8f0')
      solidRing(a.x, a.y + 2, Math.max(1, r * k * 0.5), 1, '#f8d048')
      if (!detail.lean) {
        rays(a.x, a.y - 2, 10, 6 + a.age * 70, 11 + a.age * 70, a.id * 0.7, '#e8f4ff', 0.6)
        dust(a.x, a.y + 2, Math.min(1, a.age / 0.4), 20, a.id)
      }
      fillPlotted(ctx)
      if (a.age < 0.05) blitEllipse(ctx, 16, 8, '#ffffff', a.x, a.y)
      blitRotated(ctx, a.age < 0.08 ? GALLOP_EVO_FX.bigImpact() : GALLOP_FX.impact(), a.x, a.y - 4, 0, 2)
      ctx.globalAlpha = 1
      return
    }
  }
}

/**
 * A screw trail behind a point at (x, y) flying along `ang`: two strands
 * twisting round its line for `len` px back, gold and white, thinning toward
 * the tail; `spin` turns them. `fade` 1 → 0 thins the whole trail out (Hyper
 * Drill's lance, and its afterimage in `render/impacts.ts`).
 */
export const screwTrail = (x: number, y: number, ang: number, len: number, spin: number, fade: number) => {
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  for (let d = 0; d < len; d++) {
    const tail = d / Math.max(1, len)
    // A fading trail unwinds from the back first, ragged at its end.
    if (tail > fade || (tail > fade - 0.15 && hash2(d, 7, 41) < 0.5)) continue
    const amp = 5 * (1 - tail * 0.4)
    const ph = d * 0.4 + spin
    const bx = x - c * d
    const by = y - sn * d
    // The bore: a hot core with an orange edge, thinning out behind.
    if (tail < 0.75) {
      plot('#f8a830', bx - sn, by + c)
      plot('#f8a830', bx + sn, by - c)
      plot(tail < 0.4 ? '#ffffff' : '#fff0a0', bx, by)
    }
    // The two threads twisting round it: thick up front, the near one bright, the far one dark.
    const size = tail < 0.45 ? 2 : 1
    const o1 = Math.sin(ph) * amp
    const near = Math.cos(ph) > 0
    plot(near ? '#fff8d0' : '#a85810', bx - sn * o1, by + c * o1, size, size)
    plot(near ? '#a85810' : '#f8d060', bx + sn * o1, by - c * o1, size, size)
  }
}

/** Hyper Drill boring in: drawn back, then driven into the foe; a gold ring closing on it as the blow charges; sparks off the point. */
const drawHyperBore = (ctx: Ctx, a: Attack, t: number, ang: number) => {
  const c = Math.cos(ang)
  const sn = Math.sin(ang)
  const k = Math.min(1, a.age / Math.max(0.01, a.ttl))
  // Windup: it draws back over 0.1 s, then slams in.
  const back = a.age < 0.1 ? 8 + (a.age / 0.1) * 10 : Math.max(1, 18 - ((a.age - 0.1) / 0.05) * 17)
  const shake = a.age >= 0.15 ? (Math.floor(t * 60) % 2 === 0 ? 1 : -1) : 0
  ctx.globalAlpha = fadeOut(a, 0.05)
  // The charge: a ring closing in on the foe, faster as the blow nears.
  const closing = 6 + (1 - k) * 24
  solidRing(a.x, a.y, closing, 2, '#f8c048', 0.7)
  solidRing(a.x, a.y, closing + 3, 1, '#ffffff', 0.7)
  fillPlotted(ctx)
  if (a.age >= 0.15) {
    blitEllipse(ctx, 4 + (Math.floor(t * 30) % 2), 4, '#fff0a0', a.x - c * 2, a.y - sn * 2)
    if (!detail.lean) {
      // Sparks sprayed back off the point, new ones each frame.
      const f = Math.floor(t * 30)
      for (let i = 0; i < 6; i++) {
        const sa = ang + Math.PI + (hash2(f, i, 51) - 0.5) * 2.6
        const d = 4 + hash2(f, i, 52) * 12
        plot(i % 2 ? '#ffffff' : '#f8c048', a.x + Math.cos(sa) * d, a.y + Math.sin(sa) * d, i % 3 === 0 ? 2 : 1, 1)
      }
      fillPlotted(ctx)
    }
  }
  const drill = GALLOP_EVO_FX.bigDrill[Math.floor(t * 30 + a.id) % 2]!()
  blitRotated(ctx, drill, a.x - c * (back + 10) - sn * shake, a.y - sn * (back + 10) + c * shake, ang)
  ctx.globalAlpha = 1
}

/** Hyper Drill's finishing blow: a white flash, a big burst, shock rings and rays, a cross flare that lingers. */
const drawHyperBlow = (ctx: Ctx, a: Attack, since: number) => {
  const k = Math.min(1, since / 0.35)
  if (since < 0.05) {
    blitEllipse(ctx, 16, 12, '#fff0a0', a.x, a.y)
    blitEllipse(ctx, 10, 8, '#ffffff', a.x, a.y)
  }
  ctx.globalAlpha = Math.max(0, 1 - k * k)
  blitRotated(ctx, since < 0.1 ? GALLOP_EVO_FX.bigImpact() : GALLOP_FX.impactRed(), a.x, a.y, 0, since < 0.18 ? 2 : 1)
  // A cross flare, long and thin, shrinking as it fades.
  const arm = Math.round(22 * (1 - k))
  for (let d = 1; d <= arm; d++) {
    plot('#ffffff', a.x + d, a.y)
    plot('#ffffff', a.x - d, a.y)
    if (d <= arm * 0.6) {
      plot('#fff0a0', a.x, a.y + d)
      plot('#fff0a0', a.x, a.y - d)
    }
  }
  solidRing(a.x, a.y, 6 + since * 110, 2, '#ffffff', 0.7)
  solidRing(a.x, a.y, 4 + since * 70, 1, '#f8c048', 0.7)
  if (!detail.lean) rays(a.x, a.y, 12, 8 + since * 60, 13 + since * 60, a.id * 0.3, '#f8d060', 0.75)
  fillPlotted(ctx)
  ctx.globalAlpha = 1
}

/**
 * Revival Blessing: a pillar of light from the ground through a big sun,
 * sparkles rising up it, a double halo; when the heal spills over (`tier`),
 * a white flash and rays out to the flare's reach.
 */
const drawRevival = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = Math.min(1, a.age / 0.25)
  ctx.globalAlpha = fadeOut(a, 0.3)
  const sy = a.y - 26 - Math.round(k * 6)
  // The pillar: shoots up, then narrows as it goes.
  const top = a.y + 6 - Math.round(Math.min(1, a.age / 0.08) * 56)
  const half = a.age < 0.35 ? 3 : a.age < 0.55 ? 2 : 1
  for (let y = top; y <= a.y + 6; y++) {
    plot('#f8a0c8', a.x - half - 1, y)
    plot('#f8a0c8', a.x + half + 1, y)
    plot('#fff0a0', a.x - half, y, half * 2 + 1, 1)
    if (half > 1) plot('#ffffff', a.x - half + 1, y, half * 2 - 1, 1)
  }
  if (!detail.lean) {
    rays(a.x, sy, 12, 10, 13, a.age * 2, '#f8a0c8')
    rays(a.x, sy, 12, 10, 16, a.age * 2 + Math.PI / 12, '#f8d060')
    // Sparkles rising around the pillar.
    for (let i = 0; i < 10; i++) {
      const life = (a.age * 1.6 + hash2(a.id, i, 71)) % 1
      const px = a.x + (hash2(a.id, i, 72) - 0.5) * 34
      const py = a.y + 4 - life * 44
      const c = i % 2 ? '#ffffff' : '#f8c8e0'
      plot(c, px, py)
      if (life < 0.6) {
        plot(c, px - 1, py)
        plot(c, px + 1, py)
        plot(c, px, py - 1)
        plot(c, px, py + 1)
      }
    }
  }
  const hr = Math.max(3, r * Math.min(1, a.age / 0.2))
  solidRing(a.x, a.y + 6, hr, 2, '#f87aa8', 0.5)
  solidRing(a.x, a.y + 6, hr - 3, 2, '#f8d060', 0.5)
  if (a.tier > 0) {
    // The overflow flares out: rays to the reach and a white ring racing past it.
    if (!detail.lean) rays(a.x, a.y + 6, 16, hr * 0.4, hr * 0.4 + 6, a.id, '#ffffff', 0.5)
    solidRing(a.x, a.y + 6, Math.min(r * 1.15, 6 + a.age * 260), 1, '#ffffff', 0.5)
  }
  fillPlotted(ctx)
  if (a.tier > 0 && a.age < 0.08) blitEllipse(ctx, 14, 7, '#ffffff', a.x, a.y + 6)
  blitCentered(ctx, GALLOP_EVO_FX.bigSun(), a.x, sy)
  ctx.globalAlpha = 1
}

/**
 * What the gallop batch shows before a hit lands (the scene's attack pass
 * skips dormant hitboxes): Axe Kick's hoof dropping onto its warning, Sky
 * Drop's dive falling onto its own.
 */
export const drawGallopAir = (ctx: Ctx, g: Game, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age >= 0 || !visible(a.x, a.y, 120)) continue
    if (a.visual === 'axeKick') {
      const delay = GALLOP.axeKick.delay
      const k = Math.max(0, 1 + a.age / delay)
      const hoof = GALLOP_FX.hoof()
      // Its shadow grows on the ground as it comes down.
      blitEllipse(ctx, Math.max(1, Math.round(3 + k * 4)), Math.max(1, Math.round(1 + k * 1.5)), 'rgba(24,8,8,0.35)', a.x, a.y + 2)
      const hy = Math.round(a.y - hoof.height - 4 - (1 - k) * 48)
      // Speed lines trailing up from it, then the hoof at twice its size (a whole-number scale keeps the grid).
      if (!detail.lean) {
        ctx.fillStyle = '#ffffff'
        for (const dx of [-8, 8]) ctx.fillRect(Math.round(a.x + dx), hy - 18, 1, 10)
        // Fire trailing up off the heel as it drops.
        for (let i = 0; i < 6; i++) {
          const fy = hy - hoof.height - 2 - i * 3
          const fx = a.x + Math.round(Math.sin(i * 1.7 + a.age * 40) * 2)
          plot(i < 2 ? '#fff0a0' : i < 4 ? '#f8a030' : '#e05020', fx - (i < 3 ? 2 : 1), fy, i < 3 ? 4 : 2, 2)
        }
        fillPlotted(ctx)
      }
      blitRotated(ctx, hoof, a.x, hy, 0, 2)
      // A red mark closing on where it lands.
      ctx.globalAlpha = 1
      const mark = 6 + (1 - k) * 16
      solidRing(a.x, a.y + 2, mark, 1, Math.floor(k * 10) % 2 === 0 ? '#e83020' : '#f8c048', 0.5)
      for (const sx of [-1, 1]) {
        plot('#e83020', a.x + sx * (mark + 2), a.y + 2, 3, 1)
        plot('#e83020', a.x - 1, a.y + 2 + sx * (mark * 0.5 + 2), 3, 1)
      }
      fillPlotted(ctx)
    } else if (a.visual === 'skyDive') {
      const fall = -a.age / 0.4
      if (fall >= 1) continue
      const streak = GALLOP_FX.streak()
      blitEllipse(ctx, Math.max(1, Math.round(4 + (1 - fall) * 6)), Math.max(1, Math.round(1 + (1 - fall) * 2)), 'rgba(8,24,48,0.35)', a.x, a.y + 2)
      const sy = Math.round(a.y - streak.height - 6 - fall * 80)
      // Speed lines above the diver, and the wind spiraling in on the crowd it drags together.
      if (!detail.lean) {
        for (const dx of [-7, -3, 3, 7]) plot('#e8f4ff', a.x + dx, sy - 22 - Math.abs(dx), 1, 10)
        for (let i = 0; i < 4; i++) {
          const ang = (i / 4) * TAU - fall * 4 + a.id
          for (let d = 0; d < 6; d++) {
            const rr = 10 + fall * 26 + d * 2
            plot(d < 2 ? '#ffffff' : '#88b8f0', a.x + Math.cos(ang + d * 0.12) * rr, a.y + 2 + Math.sin(ang + d * 0.12) * rr * 0.5)
          }
        }
      }
      fillPlotted(ctx)
      blitRotated(ctx, streak, a.x, sy, 0, 2)
    }
  }
}

/**
 * How high the player's hops (Bounce, Sky Drop) lift its sprite now: an arc
 * up to the next pending landing, 0 when none is coming. The sprite keeps its
 * worn look (only its height changes).
 */
export const gallopLift = (g: Game, p: Player) => {
  let lift = 0
  for (const a of g.attacks) {
    if (a.visual !== 'bounceLand' || a.owner !== p.slot || a.age >= 0) continue
    const o = a.move === 'skyDrop' ? GALLOP.skyDrop : GALLOP.bounce
    if (a.age < -o.hop) continue
    const k = (a.age + o.hop) / o.hop
    lift = Math.max(lift, Math.sin(k * Math.PI) * o.lift * (1 + 0.15 * a.tier))
  }
  return Math.round(lift)
}
