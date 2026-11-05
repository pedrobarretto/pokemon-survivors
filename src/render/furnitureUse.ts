import { blitCentered, blitEllipse, fromStrings, lazy } from '../engine/pixelart'
import type { RoomFurniture } from '../net/realm'
import type { UsePiece } from '../realm/pieces'
import { furnitureImage } from './furnitureArt'

/**
 * A base's furniture in use, over its pieces (`render/base.ts` draws them;
 * `ui/realm.ts` calls this before the trainers): a lit lamp's warm halo and
 * the light it pools on the floor, a screen's flicker, a fire's glow, and
 * music notes drifting up from the piece that plays. Hard-edged ellipses at
 * low alpha, whole pixels only.
 */

type Ctx = CanvasRenderingContext2D

/** A screen's flicker, as the arcade's (`render/realmScene.ts`). */
const SCREEN = ['rgba(120,230,255,0.28)', 'rgba(170,140,255,0.28)', 'rgba(140,255,190,0.28)'] as const

/** An eighth note, 5 × 7. */
const NOTE = lazy(() => fromStrings(['..11.', '..1.1', '..1..', '..1..', '111..', '111..', '.1...'], { 1: '#f8f8f8' }))

/**
 * Draws what's on in a base room: every lit piece's glow and the playing
 * piece's notes, camera at (`camX`, `camY`), `now` the drawing clock (s).
 */
export const drawFurnitureUse = (ctx: Ctx, pieces: readonly UsePiece[], state: RoomFurniture | null, camX: number, camY: number, now: number) => {
  if (!state) return
  for (const p of pieces) {
    const bottom = { x: Math.round(p.box.x + p.box.w / 2 - camX), y: Math.round(p.box.y + p.box.h - p.lift - camY) }
    if ('toggle' in p.use && state.lit.includes(p.key)) {
      const gx = bottom.x + p.use.glow[0]
      const gy = bottom.y + p.use.glow[1]
      const look = p.use.toggle
      // The light it pools at its feet (a wall piece's falls on the floor below the wall).
      if (look !== 'screen') {
        const pool = look === 'fire' ? 'rgba(255,150,70,0.18)' : 'rgba(255,224,150,0.2)'
        const floor = Math.round(p.box.y + p.box.h - camY + 4)
        blitEllipse(ctx, 26, 10, pool, bottom.x, floor)
        blitEllipse(ctx, 16, 6, pool, bottom.x, floor)
      }
      if (look === 'lamp') {
        blitEllipse(ctx, 16, 14, 'rgba(255,232,160,0.18)', gx, gy)
        blitEllipse(ctx, 10, 9, 'rgba(255,236,170,0.28)', gx, gy)
        blitEllipse(ctx, 5, 5, 'rgba(255,250,220,0.55)', gx, gy)
      } else if (look === 'fire') {
        const flicker = Math.round(Math.sin(now * 9 + p.box.x) + Math.sin(now * 13.7) * 0.6)
        blitEllipse(ctx, 16 + flicker, 13 + flicker, 'rgba(255,140,50,0.2)', gx, gy)
        blitEllipse(ctx, 7, 7, 'rgba(255,214,120,0.45)', gx, gy)
      } else {
        const color = SCREEN[Math.floor(now * 2.5 + p.box.x) % SCREEN.length]!
        blitEllipse(ctx, 18, 12, color, gx, gy)
        blitEllipse(ctx, 12, 8, color, gx, gy)
        if (Math.floor(now * 7) % 4 !== 0) blitEllipse(ctx, 22, 7, color, bottom.x, Math.round(p.box.y + p.box.h - camY + 6))
      }
    }
    if ('music' in p.use && state.music?.piece === p.key) {
      const top = bottom.y - ((p.id && furnitureImage(p.id)?.height) || 24)
      for (let i = 0; i < 2; i++) {
        const k = (now * 0.6 + i / 2) % 1
        ctx.globalAlpha = 1 - k
        blitCentered(ctx, NOTE(), Math.round(bottom.x + (i === 0 ? -8 : 8) + Math.sin(now * 3 + i * 2) * 3), Math.round(top - k * 16))
      }
      ctx.globalAlpha = 1
    }
  }
}
