import { blitCentered, blitRotated } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { COOP } from '../data/coop'
import type { Game, Player } from '../game/types'
import { art, PICKUPS } from './art'

/**
 * Co-op overlays: a fainted player's Poké Ball with the revive filling around
 * it, and arrows at the screen edge toward teammates out of view. Names are
 * DOM labels (`ui/nameTags.ts`): the pixel font only has digits.
 */

/** One color per room slot: names, arrows, the lobby. */
export const SLOT_COLORS = ['#f8d030', '#58b0f8', '#68d868', '#f878c8'] as const

export const slotColor = (slot: number) => SLOT_COLORS[slot % SLOT_COLORS.length]!

/** A fainted player: their Poké Ball bobbing over them and a ring that fills while a teammate stands by. */
export const drawDowned = (ctx: CanvasRenderingContext2D, p: Player, top: number, t: number) => {
  if (!p.down) return
  blitCentered(ctx, PICKUPS.pokeball(), p.x, top - 4 + Math.round(Math.sin(t * 5) * 1.5))
  const r = COOP.revive.radius
  const filled = Math.floor((p.down.revive / COOP.revive.time) * 48)
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * TAU - Math.PI / 2
    const lit = i < filled
    if (!lit && i % 3 !== 0) continue
    ctx.fillStyle = lit ? '#f8d830' : '#f04030'
    ctx.fillRect(Math.round(p.x + Math.cos(a) * r), Math.round(p.y - 4 + Math.sin(a) * r * 0.5), lit ? 2 : 1, 1)
  }
}

const ARROW_ROWS = ['11....', '1221..', '12221.', '122221', '12221.', '1221..', '11....'] as const

const arrows = new Map<string, ReturnType<typeof art>>()

/** The edge arrow in `color` (with a light rim), cached per color. */
const arrowOf = (color: string) => {
  let sprite = arrows.get(color)
  if (!sprite) arrows.set(color, (sprite = art(ARROW_ROWS, { 1: '#ffffff', 2: color }, '#181010')))
  return sprite
}

/**
 * Where an arrow toward screen point (sx, sy) sits on the edge of a `w`×`h`
 * screen (world px), clear of the HUD like the rift arrow, and its angle.
 * Null when the point is on screen.
 */
export const edgePoint = (w: number, h: number, sx: number, sy: number) => {
  if (sx > 0 && sx < w && sy > 0 && sy < h) return null
  const cx = w / 2
  const cy = h / 2
  const angle = Math.atan2(sy - cy, sx - cx)
  const dx = Math.cos(angle)
  const dy = Math.sin(angle)
  const k = Math.min(dx > 0 ? (w - 22 - cx) / dx : dx < 0 ? (22 - cx) / dx : Infinity, dy > 0 ? (h - 44 - cy) / dy : dy < 0 ? (76 - cy) / dy : Infinity)
  return { x: cx + dx * k, y: cy + dy * k, dx, dy, angle }
}

/**
 * Arrows on the screen edge toward teammates out of view, tinted by their
 * slot (red and blinking while they're fainted). Screen space; their names
 * are DOM labels (`ui/nameTags.ts`).
 */
export const drawTeamArrows = (ctx: CanvasRenderingContext2D, g: Game, camX: number, camY: number, t: number) => {
  for (const p of g.players) {
    if (p === g.player || p.gone) continue
    const at = edgePoint(g.view.w, g.view.h, p.x - camX, p.y - 12 - camY)
    if (!at || (p.down && Math.floor(t * 4) % 2 === 0)) continue
    blitRotated(ctx, arrowOf(p.down ? '#f04030' : slotColor(p.slot)), at.x, at.y, at.angle, 2)
  }
}
