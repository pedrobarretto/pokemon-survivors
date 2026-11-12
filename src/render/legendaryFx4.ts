import { blitCentered, context2d, createCanvas, fromStrings, lazy, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import type { LegendaryMove4Id } from '../game/legendaryMoves4'
import type { Game } from '../game/types'
import { medallion } from './legendaryArt'
import { fadeOut } from './legendaryFx'
import { dashedRing } from './strokes'

type Ctx = CanvasRenderingContext2D

/**
 * The fourth batch of legendary moves on screen (`game/legendaryMoves4.ts`)
 * and their icons: Manaphy's hearts, homing in, and the ring they burst from.
 */

const HEART_ROWS = ['.11.11.', '1221221', '1233221', '1222221', '.12221.', '..121..', '...1...']

/** A heart by kind: a plain swap's pink, a charming one's rose with a sparkle, a mending one's with a green core. */
const HEARTS = [
  lazy(() => fromStrings(HEART_ROWS, { 1: '#a8306c', 2: '#f878b0', 3: '#ffffff' })),
  lazy(() => fromStrings(HEART_ROWS, { 1: '#882058', 2: '#f85898', 3: '#fff0a0' })),
  lazy(() => fromStrings(HEART_ROWS, { 1: '#a8306c', 2: '#f8a0c8', 3: '#a8f0a0' })),
] as const

export const LEGENDARY_ICONS_4: Record<LegendaryMove4Id, () => PixelSprite> = {
  heartSwap: () => {
    const canvas = createCanvas(11, 11)
    const ctx = context2d(canvas)
    // Two hearts trading places: one big, one small, swapping round a ring.
    ctx.drawImage(HEARTS[0](), 1, 3)
    ctx.drawImage(HEARTS[2](), 5, 0)
    ctx.fillStyle = '#58a8e0'
    for (const [x, y] of [[0, 1], [1, 0], [9, 10], [10, 9], [10, 8]] as const) ctx.fillRect(x, y, 1, 1)
    return medallion(canvas)
  },
}

/** Air layer: the hearts bob as they fly; the ring they burst from fades out round the player. */
export const drawLegendary4Air = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  for (const a of g.attacks) {
    if (a.age < 0) continue
    if (a.visual === 'heartOrb') {
      if (!visible(a.x, a.y, 12)) continue
      const heart = HEARTS[Math.max(0, Math.min(2, a.tier))]!()
      const bob = Math.round(Math.sin(t * 9 + a.id) * 1)
      ctx.globalAlpha = fadeOut(a, 0.2)
      blitCentered(ctx, heart, a.x, a.y + bob)
      // A trail of little pink sparks behind it.
      ctx.fillStyle = '#f8b8d8'
      if (a.motion.kind === 'homing') {
        const h = Math.atan2(a.motion.vy, a.motion.vx)
        for (let i = 1; i <= 2; i++) ctx.fillRect(Math.round(a.x - Math.cos(h) * (5 + i * 3)), Math.round(a.y - Math.sin(h) * (5 + i * 3)), 1, 1)
      }
      ctx.globalAlpha = 1
    } else if (a.visual === 'heartRing' && a.shape.kind === 'circle') {
      ctx.globalAlpha = fadeOut(a, 0.3)
      dashedRing(ctx, a.x, a.y, a.shape.r * (0.6 + 0.4 * Math.min(1, a.age / 0.15)), Math.floor(t * 8), ['#f878b0', '#ffffff', '#58a8e0'], 0.6, 0.7)
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * TAU + t * 3
        blitCentered(ctx, HEARTS[0](), Math.round(a.x + Math.cos(ang) * a.shape.r), Math.round(a.y + Math.sin(ang) * a.shape.r * 0.7))
      }
      ctx.globalAlpha = 1
    }
  }
}
