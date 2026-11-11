import { blitEllipse, blitRing } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { ENEMIES } from '../data/enemies'
import { RUSH } from '../data/rush'
import { rushGate } from '../game/rush'
import type { Game } from '../game/types'
import { drawPokemon, sprites } from './sprites'

type Ctx = CanvasRenderingContext2D

/**
 * Hoopa's Rings on screen (`game/rush.ts`): the golden circle the rush is
 * fought in, Hoopa's ring portals standing round it, the big ring at its north
 * opening on each legend, and Hoopa floating over it until the last ring,
 * when it comes through itself.
 */

const GOLD = '#f8d048'
const DEEP_GOLD = '#a87010'
const VOID = '#28103c'

/** One of Hoopa's rings standing on the ground: a golden hoop around a dark portal, its glint running round it. */
const standingRing = (ctx: Ctx, x: number, y: number, size: number, t: number, open = 1) => {
  const rx = Math.max(2, Math.round(size * 0.6 * open))
  const ry = Math.max(2, Math.round(size * open))
  const cy = y - ry - 2
  blitEllipse(ctx, rx + 3, 3, 'rgba(16,8,24,0.35)', x, y)
  blitEllipse(ctx, rx + 2, ry + 2, DEEP_GOLD, x, cy)
  blitEllipse(ctx, rx, ry, GOLD, x, cy)
  blitEllipse(ctx, Math.max(1, rx - 3), Math.max(1, ry - 3), VOID, x, cy)
  const a = t * 3 + x * 0.01
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(Math.round(x + Math.cos(a) * (rx - 1)), Math.round(cy + Math.sin(a) * (ry - 1)), 2, 2)
  // Motes drifting into the portal.
  ctx.fillStyle = '#c890f0'
  for (let i = 0; i < 3; i++) {
    const q = (t * 0.7 + i / 3 + x * 0.003) % 1
    ctx.fillRect(Math.round(x + Math.cos(i * 2.1 + t) * (rx - 3) * (1 - q)), Math.round(cy + Math.sin(i * 2.1 + t) * (ry - 3) * (1 - q)), 1, 1)
  }
}

/** Ground layer: the rush's circle and the rings standing round it, the gate's ring last (behind whoever steps out of it). */
export const drawRushGround = (ctx: Ctx, g: Game, t: number) => {
  const r = g.rush
  if (!r) return
  const { x, y } = r.home
  blitRing(ctx, RUSH.arena + 2, 1, DEEP_GOLD, x, y)
  blitRing(ctx, RUSH.arena, 2, GOLD, x, y)
  ctx.globalAlpha = 0.3
  blitRing(ctx, RUSH.arena - 4, 3, '#f8e8a8', x, y)
  ctx.globalAlpha = 1
  // Seven rings round the circle (the north spot is the gate's).
  for (let i = 1; i < 8; i++) {
    const a = -Math.PI / 2 + (i / 8) * TAU
    standingRing(ctx, Math.round(x + Math.cos(a) * (RUSH.arena + 8)), Math.round(y + Math.sin(a) * (RUSH.arena + 8)), 10, t)
  }
  const gate = rushGate(r)
  const opening = r.stage === 'gate' ? Math.min(1, 1 - r.clock / RUSH.gate + 0.15) : r.stage === 'fight' ? 1 : 0.55
  standingRing(ctx, Math.round(gate.x), Math.round(gate.y - 6), 22, t, opening)
}

/** Air layer: Hoopa floating over the gate, watching, until it comes through on the last ring. */
export const drawRushAir = (ctx: Ctx, g: Game, t: number) => {
  const r = g.rush
  if (!r || r.lineup[r.ring] === 'hoopa' || r.stage === 'cleared') return
  const s = sprites(ENEMIES.hoopa.dex)
  const gate = rushGate(r)
  const bob = Math.round(Math.sin(t * 2.4) * 2)
  drawPokemon(ctx, s, 'Idle', 0, t, Math.round(gate.x + 40), Math.round(gate.y - 44 + bob))
}
