import { blitCentered, blitEllipse, blitRotated, lazy } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { MIND, ROCKET, WALL, WIRE } from '../game/ultraMoves'
import type { Attack, Game } from '../game/types'
import { art } from './art'
import { band, clamp01, fadeOut, px, radiusOf, thickLine, type Ctx } from './legendaryFx'

/**
 * Art of the Ultra Beasts' moves (`game/ultraMoves.ts`). Like the legendary
 * moves', two passes a frame from `draw.ts`: `drawUltraGround` under the
 * Pokémon (puddles, the maw, the plugs' glow) and `drawUltraAir` over them.
 * Everything snaps to whole pixels.
 */

const ROCKET_ART = lazy(() =>
  art(['.1.', '121', '131', '131', '121', '111', '4.4'], { 1: '#204838', 2: '#88f0a8', 3: '#e8fff0', 4: '#f88830' }, '#081810'),
)
const HEAD_ART = lazy(() =>
  art(['.4.4.', '45454', '12221', '23232', '22222', '.222.'], { 1: '#f8f0f8', 2: '#f0e8f0', 3: '#302040', 4: '#3870f8', 5: '#f84878' }, '#401830'),
)
const BLOCK_ART = lazy(() =>
  art(['11111111', '12233221', '12222221', '13222231', '12222221', '12222321', '11111111'], { 1: '#30343c', 2: '#a0a8b0', 3: '#d8e0e8' }, '#14161a'),
)
const PLUG_ART = lazy(() => art(['.11.', '1221', '1331', '1221', '.11.', '.44.'], { 1: '#202830', 2: '#f8f060', 3: '#ffffff', 4: '#606870' }, '#0c1014'))

/* ---------------- Ground ---------------- */

/** Acid Spray's puddle: a pool of venom bubbling, fading out at the end. */
const drawAcidPool = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.3) * clamp01(a.age / 0.12)
  blitEllipse(ctx, Math.round(r), Math.max(2, Math.round(r * 0.5)), '#245c40', a.x, a.y)
  blitEllipse(ctx, Math.round(r - 2), Math.max(1, Math.round(r * 0.5) - 1), '#3c8858', a.x, a.y)
  for (let i = 0; i < 4; i++) {
    const k = (t * 1.5 + hash2(a.id, i, 3)) % 1
    if (k > 0.6) continue
    px(ctx, a.x + (hash2(a.id, i, 4) - 0.5) * r * 1.4, a.y + (hash2(a.id, i, 5) - 0.5) * r * 0.6, '#c8f078', 1, 1)
  }
  ctx.globalAlpha = 1
}

/** Guzzlord's maw on the ground: a dark pit ringed with teeth closing in as it shuts; its bite, two rows of teeth snapping. */
const drawMaw = (ctx: Ctx, a: Attack, t: number) => {
  const r = radiusOf(a)
  if (a.memo === 1) {
    const k = clamp01(a.age / 0.12)
    const gap = Math.round(r * (1 - k))
    for (let i = -3; i <= 3; i++) {
      px(ctx, a.x + i * (r / 3.5) - 1, a.y - gap - 3, '#ffffff', 2, 3)
      px(ctx, a.x + i * (r / 3.5) - 1, a.y + gap, '#ffffff', 2, 3)
    }
    return
  }
  const shut = clamp01(a.age / a.ttl)
  const rr = Math.max(4, r * (1 - shut * 0.4))
  blitEllipse(ctx, Math.round(rr), Math.round(rr * 0.5), '#1c0828', a.x, a.y)
  blitEllipse(ctx, Math.round(rr * 0.7), Math.round(rr * 0.32), '#06020a', a.x, a.y)
  band(ctx, a.x, a.y, rr, 1, '#7040a8', 0.5)
  const teeth = 12
  for (let i = 0; i < teeth; i++) {
    const ang = (i / teeth) * TAU + t * 0.6
    px(ctx, a.x + Math.cos(ang) * (rr - 1) - 1, a.y + Math.sin(ang) * (rr - 1) * 0.5 - 1, '#f0e8f8', 2, 2)
  }
}

/** Tail Glow's plug on the ground: its glow pooling under it. */
const drawPlugGlow = (ctx: Ctx, a: Attack) => {
  ctx.globalAlpha = 0.5 * fadeOut(a, 0.2)
  blitEllipse(ctx, 6, 3, '#f8f060', a.x, a.y + 10)
  ctx.globalAlpha = 1
}

export const drawUltraGround = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'acidPool':
        drawAcidPool(ctx, a, t)
        break
      case 'maw':
        drawMaw(ctx, a, t)
        break
      case 'wireNode':
        drawPlugGlow(ctx, a)
        break
    }
  }
}

/* ---------------- Air ---------------- */

/** The way a moving attack flies, or 0. */
const heading = (a: Attack) => {
  const m = a.motion
  return m.kind === 'linear' || m.kind === 'homing' ? Math.atan2(m.vy, m.vx) : 0
}

/** Acid Spray's glob: a drop of venom with a highlight, two drips trailing. */
const drawAcidGlob = (ctx: Ctx, a: Attack) => {
  const ang = heading(a)
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  px(ctx, a.x - ux * 6, a.y - uy * 6, '#3c8858', 1, 1)
  px(ctx, a.x - ux * 4, a.y - uy * 4, '#58b880', 2, 2)
  blitEllipse(ctx, 2, 2, '#58b880', a.x, a.y)
  px(ctx, a.x - 1, a.y - 1, '#c8f8d8', 2, 1)
}

/** Power-Up Punch's blow: an impact star and a shockwave ring, hotter with every pump. */
const drawPumpBlow = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = clamp01(a.age / a.ttl)
  const hot = a.memo >= 4
  ctx.globalAlpha = 1 - k * 0.7
  band(ctx, a.x, a.y, r, 2, hot ? '#f8d040' : '#f86848', 0.75)
  band(ctx, a.x, a.y, Math.max(2, r - 3), 1, '#ffffff', 0.75)
  if (k < 0.5) {
    const s = Math.round(4 + a.memo)
    px(ctx, a.x - s, a.y, '#ffffff', s * 2 + 1, 1)
    px(ctx, a.x, a.y - s, '#ffffff', 1, s * 2 + 1)
    px(ctx, a.x - 2, a.y - 2, hot ? '#f8d040' : '#f86848', 5, 5)
  }
  ctx.globalAlpha = 1
}

/** Lunge's streak: a white blur with a pale blue edge, afterimage specks behind it. */
const drawLungeStreak = (ctx: Ctx, a: Attack) => {
  const ang = heading(a)
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  const len = 22
  thickLine(ctx, a.x - ux * len, a.y - uy * len, a.x, a.y, 4, '#88a8d8')
  thickLine(ctx, a.x - ux * (len - 4), a.y - uy * (len - 4), a.x, a.y, 2, '#ffffff')
  for (let i = 1; i <= 3; i++) px(ctx, a.x - ux * (len + i * 6), a.y - uy * (len + i * 6), '#c8d8f8', 1, 1)
}

/** Tail Glow's wire: a jagged spark along its segment, flickering. */
const drawWire = (ctx: Ctx, a: Attack, t: number) => {
  const len = WIRE.gap + 1
  const ux = Math.cos(a.memo)
  const uy = Math.sin(a.memo)
  const beat = Math.floor(t * 20)
  const off = (hash2(a.id, beat, 7) - 0.5) * 4
  const mx = a.x + ux * len * 0.5 - uy * off
  const my = a.y + uy * len * 0.5 + ux * off
  ctx.globalAlpha = fadeOut(a, 0.2)
  thickLine(ctx, a.x, a.y, mx, my, 2, '#f8e040')
  thickLine(ctx, mx, my, a.x + ux * len, a.y + uy * len, 2, '#f8e040')
  px(ctx, mx, my, '#ffffff', 1, 1)
  ctx.globalAlpha = 1
}

/** Tail Glow's plug: blinking at its tip. */
const drawPlug = (ctx: Ctx, a: Attack, t: number) => {
  ctx.globalAlpha = fadeOut(a, 0.2)
  blitCentered(ctx, PLUG_ART(), a.x, a.y)
  if (Math.floor(t * 8 + a.id) % 3 === 0) px(ctx, a.x - 1, a.y - 5, '#ffffff', 2, 2)
  ctx.globalAlpha = 1
}

/** Autotomize's rocket: off Celesteela's arm straight up, then nose down onto its mark, its shadow growing. */
const drawRocket = (ctx: Ctx, a: Attack) => {
  const k = clamp01(a.age / ROCKET.flight)
  if (k < 0.4) {
    const q = k / 0.4
    const y = a.from.y - q * q * 90
    blitRotated(ctx, ROCKET_ART(), a.from.x, y, 0)
    for (let i = 1; i < 5; i++) px(ctx, a.from.x - 1, y + 4 + i * 3, i < 2 ? '#f8e060' : '#f88830', 2, 2)
    return
  }
  const q = (k - 0.4) / 0.6
  const y = a.y - 150 * (1 - q * q)
  blitEllipse(ctx, Math.round(2 + q * 6), Math.round(1 + q * 3), 'rgba(16,8,32,0.45)', a.x, a.y)
  blitRotated(ctx, ROCKET_ART(), a.x, y, Math.PI)
  for (let i = 1; i < 5; i++) px(ctx, a.x - 1, y - 6 - i * 3, i < 2 ? '#f8e060' : '#f88830', 2, 2)
}

/** A blast opening to its full radius (`memo`): rings in `colors`, outer to inner, fading as it ends. */
const drawBurst = (ctx: Ctx, a: Attack, colors: readonly string[]) => {
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.18)
  colors.forEach((c, i) => band(ctx, a.x, a.y, Math.max(2, r - i * 3), i === 0 ? 2 : 1, c, 0.7))
  if (a.age < 0.1) blitEllipse(ctx, Math.round(r * 0.4), Math.round(r * 0.28), '#ffffff', a.x, a.y)
  ctx.globalAlpha = 1
}

/** Guillotine's cut: a paper-thin line drawn through in a blink, white over green, gone as fast. */
const drawCut = (ctx: Ctx, a: Attack) => {
  const half = radiusOf(a)
  const k = clamp01(a.age / 0.07)
  const ux = Math.cos(a.memo)
  const uy = Math.sin(a.memo)
  const x0 = a.x - ux * half
  const y0 = a.y - uy * half
  const x1 = x0 + ux * half * 2 * k
  const y1 = y0 + uy * half * 2 * k
  ctx.globalAlpha = fadeOut(a, 0.12)
  thickLine(ctx, x0 + 1, y0 + 1, x1 + 1, y1 + 1, 1, '#58a868')
  thickLine(ctx, x0, y0, x1, y1, 1, '#ffffff')
  ctx.globalAlpha = 1
}

/** Belch: a wave of purple gas rolling out of Guzzlord, puffs riding it. */
const drawBelch = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.15)
  band(ctx, a.x, a.y, r, 3, '#7040a8', 0.7)
  band(ctx, a.x, a.y, Math.max(2, r - 4), 1, '#b8f078', 0.7)
  for (let i = 0; i < 10; i++) {
    const ang = (i / 10) * TAU + a.id
    blitEllipse(ctx, 3, 2, i % 2 ? '#9868d0' : '#5c3090', a.x + Math.cos(ang) * r, a.y + Math.sin(ang) * r * 0.7)
  }
  ctx.globalAlpha = 1
}

/** Wide Guard's stone: rising out of the ground, then crumbling at the end. */
const drawStone = (ctx: Ctx, a: Attack) => {
  const rise = clamp01(a.age / WALL.rise)
  const lift = Math.round((1 - rise) * 7)
  ctx.globalAlpha = fadeOut(a, 0.25)
  blitEllipse(ctx, 5, 2, 'rgba(16,8,32,0.4)', a.x, a.y + 5)
  ctx.save()
  ctx.beginPath()
  ctx.rect(Math.round(a.x) - 6, Math.round(a.y) - 12, 12, 17)
  ctx.clip()
  blitCentered(ctx, BLOCK_ART(), a.x, a.y + lift - 1)
  ctx.restore()
  ctx.globalAlpha = 1
}

/** Mind Blown's head: lobbed in an arc from Blacephalon's shoulders, spinning, its fuse sparking. */
const drawHead = (ctx: Ctx, a: Attack, t: number) => {
  const k = clamp01(a.age / MIND.flight)
  const x = a.from.x + (a.x - a.from.x) * k
  const y = a.from.y + (a.y - a.from.y) * k - Math.sin(k * Math.PI) * 44
  blitEllipse(ctx, Math.round(2 + k * 3), Math.round(1 + k * 2), 'rgba(16,8,32,0.4)', a.x, a.y)
  blitRotated(ctx, HEAD_ART(), x, y, k * TAU * 1.5)
  if (Math.floor(t * 16) % 2 === 0) px(ctx, x + 2, y - 6, '#f8d030', 2, 2)
}

/** Mind Blown's blast: fire rings and confetti in Blacephalon's colors. */
const drawMindBlast = (ctx: Ctx, a: Attack) => {
  drawBurst(ctx, a, ['#f86030', '#f8d040', '#ffffff'])
  const r = radiusOf(a)
  ctx.globalAlpha = fadeOut(a, 0.18)
  for (let i = 0; i < 14; i++) {
    const ang = hash2(a.id, i, 9) * TAU
    const d = r * (0.4 + hash2(a.id, i, 10) * 0.8)
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d * 0.7, i % 3 === 0 ? '#3870f8' : i % 3 === 1 ? '#f84878' : '#f8f0f8', 2, 1)
  }
  ctx.globalAlpha = 1
}

/** Fell Stinger's needle: violet with a white tip, the way it flies. */
const drawStinger = (ctx: Ctx, a: Attack) => {
  const ang = heading(a)
  const ux = Math.cos(ang)
  const uy = Math.sin(ang)
  thickLine(ctx, a.x - ux * 7, a.y - uy * 7, a.x, a.y, 2, '#9858d8')
  px(ctx, a.x + ux * 1, a.y + uy * 1, '#ffffff', 1, 1)
  px(ctx, a.x - ux * 9, a.y - uy * 9, '#58285c', 1, 1)
}

/** Poison Jab's poke: the needle thrust out, a spark at its tip as it lands. */
const drawJab = (ctx: Ctx, a: Attack) => {
  const k = clamp01(a.age / 0.06)
  const ux = Math.cos(a.memo)
  const uy = Math.sin(a.memo)
  const tip = 4 + k * 6
  thickLine(ctx, a.x - ux * 6, a.y - uy * 6, a.x + ux * tip, a.y + uy * tip, 2, '#c060c8')
  px(ctx, a.x + ux * tip, a.y + uy * tip, '#f8d0f8', 1, 1)
  if (k >= 1 && a.age < 0.1) {
    px(ctx, a.x + ux * tip - 2, a.y + uy * tip, '#a8e838', 5, 1)
    px(ctx, a.x + ux * tip, a.y + uy * tip - 2, '#a8e838', 1, 5)
  }
}

export const drawUltraAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    // A rocket and a head fly in from the player: they draw even when their landing spot is off screen.
    if (a.visual === 'rocket') {
      drawRocket(ctx, a)
      continue
    }
    if (a.visual === 'headBomb') {
      drawHead(ctx, a, t)
      continue
    }
    if (!visible(a.x, a.y, 100)) continue
    switch (a.visual) {
      case 'acidGlob':
        drawAcidGlob(ctx, a)
        break
      case 'pumpBlow':
        drawPumpBlow(ctx, a)
        break
      case 'lungeStreak':
        drawLungeStreak(ctx, a)
        break
      case 'wireArc':
        drawWire(ctx, a, t)
        break
      case 'wireNode':
        drawPlug(ctx, a, t)
        break
      case 'rocketBlast':
        drawBurst(ctx, a, ['#f88830', '#88f0a8', '#ffffff'])
        break
      case 'paperCut':
        drawCut(ctx, a)
        break
      case 'belch':
        drawBelch(ctx, a)
        break
      case 'stoneBlock':
        drawStone(ctx, a)
        break
      case 'mindBlast':
        drawMindBlast(ctx, a)
        break
      case 'stinger':
        drawStinger(ctx, a)
        break
      case 'jab':
        drawJab(ctx, a)
        break
    }
  }
}
