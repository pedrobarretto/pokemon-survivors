import { REALM_ROOMS, type Shape, type SpotKind, type TownRoomId } from '../data/realmMap'
import { blitEllipse, blitRing } from '../engine/pixelart'

/**
 * STUB (feat/realm-client): the art PR (`feat/realm-art`) replaces this file
 * with the town's PixelLab layers under the same names. Until then each room
 * draws as flat shapes from its geometry (`REALM_ROOMS`): ground, paths,
 * what's solid, doors and spots.
 */

/** Something drawn in the y-sorted pass with the trainers (its feet at `y`), like the plaza's `Piece`. */
export type Piece = { y: number; draw: (ctx: CanvasRenderingContext2D, camX: number, camY: number, time: number) => void }

const GROUND: Record<TownRoomId, { base: string; path: string }> = {
  plaza: { base: '#78c060', path: '#d8c898' },
  pier: { base: '#e8d8a0', path: '#a87848' },
  cafe: { base: '#b08860', path: '#c8a070' },
  trail: { base: '#68a850', path: '#c8b080' },
}

/** The room's ground, under everything. */
export const drawTownGround = (ctx: CanvasRenderingContext2D, room: TownRoomId, camX: number, camY: number, time: number) => {
  const r = REALM_ROOMS[room]
  const g = GROUND[room]
  const ox = -Math.round(camX)
  const oy = -Math.round(camY)
  ctx.fillStyle = g.base
  ctx.fillRect(ox, oy, r.w, r.h)
  ctx.fillStyle = g.path
  ctx.fillRect(ox, oy + Math.round(r.h / 2) - 24, r.w, 48)
  ctx.fillRect(ox + Math.round(r.w / 2) - 24, oy, 48, r.h)
  if (room === 'pier') {
    const pool = r.spots.find((s) => s.kind === 'pool')
    if (pool) {
      blitEllipse(ctx, 110, 70, '#3878c8', ox + pool.at.x, oy + pool.at.y)
      blitEllipse(ctx, 100, 62, '#4890e0', ox + pool.at.x, oy + pool.at.y)
      const wave = Math.round(Math.sin(time * 2) * 3)
      ctx.fillStyle = '#a8d8f8'
      ctx.fillRect(ox + pool.at.x - 30 + wave, oy + pool.at.y - 10, 16, 2)
      ctx.fillRect(ox + pool.at.x + 20 - wave, oy + pool.at.y + 14, 12, 2)
    }
  }
  for (const d of r.doors) {
    ctx.fillStyle = 'rgba(40,24,16,0.35)'
    ctx.fillRect(ox + d.at.x, oy + d.at.y, d.at.w, d.at.h)
  }
  for (const s of r.spots) {
    if (s.kind === 'coopPortal' || s.kind === 'arenaPortal') {
      const color = s.kind === 'coopPortal' ? '#60c8f8' : '#f86860'
      blitEllipse(ctx, 20, 10, 'rgba(16,24,48,0.35)', ox + s.at.x, oy + s.at.y + 2)
      blitRing(ctx, 18 + Math.round(Math.sin(time * 3) * 1.5), 3, color, ox + s.at.x, oy + s.at.y)
    }
  }
}

const SPOT_ART: Partial<Record<SpotKind, { w: number; h: number; color: string }>> = {
  board: { w: 36, h: 22, color: '#8a5a30' },
  bases: { w: 30, h: 20, color: '#8a5a30' },
  myBase: { w: 26, h: 26, color: '#5a8a40' },
  carpenter: { w: 56, h: 40, color: '#a06838' },
  counter: { w: 0, h: 0, color: '' },
  bench: { w: 28, h: 8, color: '#a07040' },
}

const solidPiece = (s: Shape, room: TownRoomId): Piece =>
  s.kind === 'oval'
    ? {
        y: s.y + s.ry,
        draw: (ctx, camX, camY) => {
          blitEllipse(ctx, s.rx, s.ry, '#808890', s.x - Math.round(camX), s.y - Math.round(camY))
          blitEllipse(ctx, s.rx - 6, s.ry - 5, '#58a8e8', s.x - Math.round(camX), s.y - Math.round(camY) - 2)
        },
      }
    : {
        y: s.y + s.h,
        draw: (ctx, camX, camY) => {
          ctx.fillStyle = room === 'cafe' ? '#6a4028' : '#707070'
          ctx.fillRect(s.x - Math.round(camX), s.y - Math.round(camY) - 10, s.w, s.h + 10)
          ctx.fillStyle = room === 'cafe' ? '#986040' : '#909090'
          ctx.fillRect(s.x - Math.round(camX), s.y - Math.round(camY) - 10, s.w, 10)
        },
      }

/** The room's props, y-sorted with the trainers by the caller. */
export const townPieces = (room: TownRoomId): readonly Piece[] => {
  const r = REALM_ROOMS[room]
  const spots = r.spots.flatMap((s): Piece[] => {
    const art = SPOT_ART[s.kind]
    if (!art || art.w === 0) return []
    return [
      {
        y: s.at.y,
        draw: (ctx, camX, camY) => {
          const x = s.at.x - Math.round(camX) - art.w / 2
          const y = s.at.y - Math.round(camY) - art.h
          ctx.fillStyle = 'rgba(16,24,48,0.25)'
          ctx.fillRect(x + 2, y + art.h - 2, art.w, 4)
          ctx.fillStyle = art.color
          ctx.fillRect(x, y, art.w, art.h)
          ctx.fillStyle = 'rgba(255,255,255,0.25)'
          ctx.fillRect(x + 2, y + 2, art.w - 4, 3)
        },
      },
    ]
  })
  return [...r.solid.map((s) => solidPiece(s, room)), ...spots]
}

/** What draws over the trainers (roofs, tree tops); nothing in the stub. */
export const drawTownOverhead = (_ctx: CanvasRenderingContext2D, _room: TownRoomId, _camX: number, _camY: number, _time: number) => {}
