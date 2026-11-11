import { blitCentered, blitEllipse, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { CORE } from '../game/pathLegendMoves'
import { ownerOf } from '../game/players'
import type { Attack, Game } from '../game/types'
import { band, clamp01, fadeOut, px, radiusOf, spokes, thickLine, twinkle, type Ctx } from './legendaryFx'
import { PATH_ART } from './pathLegendArt'

/**
 * Art of the path legends' moves (`game/pathLegendMoves.ts`), in the two
 * passes the other legendary batches use from `draw.ts`: `drawPathLegendGround`
 * under the Pokémon (rings, shadows, the moon's glow) and `drawPathLegendAir`
 * over them (strokes, comets, fists, the hand). Everything on whole pixels.
 */

const GREEN = ['#ffffff', '#b8f8c8', '#4cc068', '#2f8a48'] as const
const SUN = ['#ffffff', '#fff0a0', '#f8c838', '#e88020'] as const
const MOON = ['#ffffff', '#e0d8ff', '#a888f8', '#6848c8'] as const
const STEEL = ['#ffffff', '#e8e8f0', '#b0b0c0', '#686878'] as const

/* ---------------- Zygarde: Core Enforcer ---------------- */

/** A stroke of the Z: drawn out from `from` over `CORE.stroke` s, a wide green band with a white core, fraying at the end. */
const drawCoreStroke = (ctx: Ctx, a: Attack, t: number) => {
  const k = clamp01(a.age / CORE.stroke)
  const fade = fadeOut(a, 0.25)
  const x1 = a.from.x + (a.x - a.from.x) * k
  const y1 = a.from.y + (a.y - a.from.y) * k
  const w = fade > 0.5 ? 7 : 5
  thickLine(ctx, a.from.x, a.from.y, x1, y1, w, GREEN[3])
  thickLine(ctx, a.from.x, a.from.y, x1, y1, w - 2, GREEN[2])
  thickLine(ctx, a.from.x, a.from.y, x1, y1, fade > 0.5 ? 2 : 1, GREEN[0])
  // Hex flecks drifting off the stroke.
  const len = Math.hypot(a.x - a.from.x, a.y - a.from.y) * k
  for (let i = 0; i < 6; i++) {
    const f = hash2(a.id, i, 3)
    const d = f * len
    const ux = (a.x - a.from.x) / Math.max(1, Math.hypot(a.x - a.from.x, a.y - a.from.y))
    const uy = (a.y - a.from.y) / Math.max(1, Math.hypot(a.x - a.from.x, a.y - a.from.y))
    const rise = ((t * 18 + i * 7) % 14) - 4
    px(ctx, a.from.x + ux * d, a.from.y + uy * d - rise - 4, i % 2 === 0 ? GREEN[1] : GREEN[2])
  }
  // The head of the stroke, bright while it's drawn.
  if (k < 1) twinkle(ctx, x1, y1, 3, GREEN[0])
}

/** A corner of the Z: a Cell's hex lighting up and going out. */
const drawCoreCell = (ctx: Ctx, a: Attack, t: number) => {
  const cell = PATH_ART.cell()[Math.floor(t * 8) % 2]!
  const k = fadeOut(a, 0.3)
  if (k < 0.3 && Math.floor(t * 20) % 2 === 0) return
  blitCentered(ctx, cell, a.x, a.y - Math.round((1 - k) * 4))
}

/* ---------------- Solgaleo: Sunsteel Strike ---------------- */

/** The comet: a small sun with turning rays and a burning tail behind it. */
const drawSunComet = (ctx: Ctx, a: Attack, t: number) => {
  const angle = a.memo
  const r = Math.max(5, Math.round(radiusOf(a) * 0.7))
  for (let i = 1; i <= 6; i++) {
    const d = i * 6
    const tx = a.x - Math.cos(angle) * d
    const ty = a.y - Math.sin(angle) * d
    const size = Math.max(1, r - i)
    blitEllipse(ctx, size, size, i < 3 ? SUN[2] : SUN[3], tx, ty)
  }
  spokes(ctx, a.x, a.y, r + 1, r + 6, 10, [SUN[1], SUN[2]], t * 6)
  blitEllipse(ctx, r, r, SUN[2], a.x, a.y)
  blitEllipse(ctx, r - 2, r - 2, SUN[1], a.x, a.y)
  blitEllipse(ctx, Math.max(1, r - 4), Math.max(1, r - 4), SUN[0], a.x, a.y)
}

/** Where the comet stops: a sun opening into rings, on the ground under it. */
const drawSunBurst = (ctx: Ctx, a: Attack, t: number, ground: boolean) => {
  const r = Math.round(radiusOf(a))
  const fade = fadeOut(a, 0.15)
  if (ground) {
    band(ctx, a.x, a.y + 8, r, 2, SUN[3], 0.45)
    band(ctx, a.x, a.y + 8, Math.max(2, r - 6), 1, SUN[2], 0.45)
    return
  }
  band(ctx, a.x, a.y, r, fade > 0.5 ? 3 : 2, SUN[2])
  band(ctx, a.x, a.y, Math.max(2, r - 3), 1, SUN[0])
  spokes(ctx, a.x, a.y, Math.max(2, r - 10), r + 6, 12, [SUN[0], SUN[1], SUN[2]], t * 2)
}

/* ---------------- Lunala: Moongeist Beam ---------------- */

/** The beam: from the player to its tip, a violet band with a white heart, ghost wisps trailing off it. */
const drawMoonBeam = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const p = ownerOf(g, a.owner)
  const sx = p.x
  const sy = p.y - 8
  const open = clamp01(a.age / 0.1)
  const w = Math.round(9 * open * Math.min(1, fadeOut(a, 0.15) * 2))
  if (w <= 0) return
  thickLine(ctx, sx, sy, a.x, a.y, w, MOON[3])
  thickLine(ctx, sx, sy, a.x, a.y, Math.max(1, w - 3), MOON[2])
  thickLine(ctx, sx, sy, a.x, a.y, Math.max(1, w - 6), MOON[0])
  const len = Math.hypot(a.x - sx, a.y - sy) || 1
  const nx = -(a.y - sy) / len
  const ny = (a.x - sx) / len
  for (let i = 0; i < 8; i++) {
    const f = (hash2(a.id, i, 5) + t * 0.6) % 1
    const side = (i % 2 === 0 ? 1 : -1) * (w / 2 + 2 + Math.sin(t * 9 + i) * 2)
    px(ctx, sx + (a.x - sx) * f + nx * side, sy + (a.y - sy) * f + ny * side, i % 3 === 0 ? MOON[1] : MOON[2])
  }
  blitEllipse(ctx, 5, 5, MOON[1], a.x, a.y)
  blitEllipse(ctx, 3, 3, MOON[0], a.x, a.y)
}

/** The moon the beam leaves at its end: a pale disc with a turning ring and its glow on the ground. */
const drawMoonOrb = (ctx: Ctx, a: Attack, t: number, ground: boolean) => {
  const r = radiusOf(a)
  const k = Math.min(clamp01(a.age / 0.2), fadeOut(a, 0.3))
  if (ground) {
    blitEllipse(ctx, Math.round(r * k), Math.max(1, Math.round(r * 0.4 * k)), MOON[3], a.x, a.y + 10)
    return
  }
  const body = Math.max(2, Math.round(r * 0.45 * k))
  band(ctx, a.x, a.y, Math.round(r * k), 1, MOON[2])
  for (let i = 0; i < 6; i++) {
    const ang = t * 2 + (i / 6) * TAU
    px(ctx, a.x + Math.cos(ang) * r * k, a.y + Math.sin(ang) * r * k, MOON[0], 2, 2)
  }
  blitEllipse(ctx, body, body, MOON[2], a.x, a.y)
  blitEllipse(ctx, Math.max(1, body - 2), Math.max(1, body - 2), MOON[1], a.x - 1, a.y - 1)
  blitEllipse(ctx, Math.max(1, Math.round(body / 3)), Math.max(1, Math.round(body / 3)), MOON[0], a.x - 2, a.y - 2)
}

/* ---------------- Kubfu and Urshifu: Wicked Blow, Surging Strikes ---------------- */

/** The blow: a dark fist driving in, then a cracked shockwave with a red flash. */
const drawWickedFist = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const k = clamp01(a.age / 0.12)
  const fade = fadeOut(a, 0.2)
  if (k < 1) {
    const back = (1 - k) * 22
    const x = a.x - Math.cos(a.memo) * back
    const y = a.y - Math.sin(a.memo) * back
    blitEllipse(ctx, 6, 5, '#181020', x, y)
    blitEllipse(ctx, 4, 3, '#3a3050', x - 1, y - 1)
    px(ctx, x + 2, y - 2, '#e83848', 2, 1)
    return
  }
  band(ctx, a.x, a.y, Math.round(r * (0.6 + 0.4 * (1 - fade))), 2, '#281838')
  band(ctx, a.x, a.y, Math.round(r * (0.4 + 0.6 * (1 - fade))), 1, '#e83848')
  spokes(ctx, a.x, a.y, 4, Math.round(r * 0.9), 8, ['#ffffff', '#c8b8d8', '#584870'], a.memo)
  if (fade > 0.6) blitEllipse(ctx, 3, 3, '#ffffff', a.x, a.y)
}

/** One of Surging Strikes' blows: a burst of water, spray flying off it. */
const drawSurgingStrike = (ctx: Ctx, a: Attack) => {
  const r = radiusOf(a)
  const fade = fadeOut(a, 0.15)
  band(ctx, a.x, a.y, Math.round(r * (1.1 - fade * 0.4)), 2, '#3878d8')
  band(ctx, a.x, a.y, Math.round(r * (0.8 - fade * 0.3)), 1, '#a8e0ff')
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + a.memo
    const d = r * (1.2 - fade * 0.6)
    px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, '#ffffff', 2, 2)
  }
  if (fade > 0.5) blitEllipse(ctx, 3, 3, '#e8f8ff', a.x, a.y)
}

/* ---------------- Meltan and Melmetal: Double Iron Bash ---------------- */

/** A hex nut spinning through the air. */
const drawIronNut = (ctx: Ctx, a: Attack, t: number) => {
  const nut = PATH_ART.nut()
  const turn = Math.round(t * 10 + a.memo * 2) * (Math.PI / 6)
  blitRotated(ctx, nut, Math.round(a.x), Math.round(a.y), turn, Math.max(1, Math.round(radiusOf(a) / 4.5)))
}

/** The slam: a grey shockwave rolling out on the ground with a few shards. */
const drawIronSlam = (ctx: Ctx, a: Attack, ground: boolean) => {
  const r = Math.round(radiusOf(a))
  if (ground) {
    band(ctx, a.x, a.y + 4, r, 3, STEEL[3], 0.5)
    band(ctx, a.x, a.y + 4, Math.max(2, r - 4), 1, STEEL[1], 0.5)
    return
  }
  for (let i = 0; i < 8; i++) {
    const ang = (i / 8) * TAU + hash2(a.id, i, 2)
    px(ctx, a.x + Math.cos(ang) * r * 0.9, a.y + 4 + Math.sin(ang) * r * 0.45 - 4, STEEL[i % 2 === 0 ? 0 : 2], 2, 2)
  }
}

/* ---------------- Regigigas: Crush Grip ---------------- */

/** The giant's hand closing over its foe: four fingers coming down and in, with each squeeze a jolt. */
const drawGripHand = (ctx: Ctx, a: Attack, t: number) => {
  const r = Math.max(10, a.memo + 6)
  const k = clamp01(a.age / 0.15)
  const squeeze = Math.sin(t * 34) > 0.6 ? 1 : 0
  const spread = Math.round(r * (1.3 - k * 0.45) - squeeze)
  const top = Math.round(a.y - r - 6 + k * 6)
  // The palm over the foe, and the fingers wrapping down around it.
  px(ctx, a.x - spread, top - 4, '#a89878', spread * 2 + 1, 5)
  px(ctx, a.x - spread + 1, top - 4, '#d8d0b8', spread * 2 - 1, 3)
  for (let i = 0; i < 4; i++) {
    const fx = Math.round(a.x - spread + (i * (spread * 2)) / 3)
    const len = Math.round(r * 0.9 * k) + 2
    px(ctx, fx - 1, top, '#a89878', 3, len)
    px(ctx, fx, top, '#e8e0c8', 1, len - 1)
  }
  // The three lines across its palm glow in the Regis' colors.
  px(ctx, a.x - 4, top - 3, '#c87848', 2, 1)
  px(ctx, a.x - 1, top - 3, '#78c0e8', 2, 1)
  px(ctx, a.x + 2, top - 3, '#a0a8b8', 2, 1)
  if (squeeze) twinkle(ctx, a.x, a.y, 3, '#ffffff')
}

/* ---------------- Passes ---------------- */

/** Ground layer (under the Pokémon). */
export const drawPathLegendGround = (ctx: Ctx, g: Game, t: number) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    switch (a.visual) {
      case 'sunBurst':
        drawSunBurst(ctx, a, t, true)
        break
      case 'moonOrb':
        drawMoonOrb(ctx, a, t, true)
        break
      case 'ironSlam':
        drawIronSlam(ctx, a, true)
        break
    }
  }
}

/** Air layer (over the Pokémon). */
export const drawPathLegendAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    // Strokes and beams span the screen: they draw even when their end is off it.
    switch (a.visual) {
      case 'coreStroke':
        drawCoreStroke(ctx, a, t)
        continue
      case 'moonBeam':
        drawMoonBeam(ctx, g, a, t)
        continue
    }
    if (!visible(a.x, a.y, 80)) continue
    switch (a.visual) {
      case 'coreCell':
        drawCoreCell(ctx, a, t)
        break
      case 'sunComet':
        drawSunComet(ctx, a, t)
        break
      case 'sunBurst':
        drawSunBurst(ctx, a, t, false)
        break
      case 'moonOrb':
        drawMoonOrb(ctx, a, t, false)
        break
      case 'wickedFist':
        drawWickedFist(ctx, a)
        break
      case 'surgingStrike':
        drawSurgingStrike(ctx, a)
        break
      case 'ironNut':
        drawIronNut(ctx, a, t)
        break
      case 'ironSlam':
        drawIronSlam(ctx, a, false)
        break
      case 'gripHand':
        drawGripHand(ctx, a, t)
        break
    }
  }
}
