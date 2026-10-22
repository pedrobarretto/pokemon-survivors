import { blitCentered, blitEllipse, blitRotated, canvasCache, fromStrings, lazy, blitText, type PixelSprite } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { ENEMIES } from '../data/enemies'
import { ALPHA } from '../game/alphas'
import type { Enemy, Game } from '../game/types'
import { t } from '../i18n'
import { sprites } from './sprites'

/**
 * Alpha Pokémon's look (`game/alphas.ts`): the crimson glow on the ground, the
 * charge's aim line, the embers, HP bar and "ALFA" tag over it (the in-world pixel font), and the arrow
 * on the screen edge while it's out of view. Everything blinks faster as a hit gets close.
 */

type Ctx = CanvasRenderingContext2D
type Visible = (x: number, y: number, margin?: number) => boolean

const CRIMSON = '#f83838'
const DARK = '#401018'

/** On/off blink that speeds up as `k` (0..1) gets close to 1. */
const blink = (time: number, k: number) => Math.floor(time * (6 + k * 18)) % 2 === 0

/** A charge lane's cross-section, `w` px wide: solid edges, a see-through fill. Stretched along the line. */
const lane = canvasCache<string, PixelSprite>()
const laneOf = (w: number, edge: string) => {
  const key = `${w}|${edge}`
  const hit = lane.get(key)
  if (hit) return hit
  const rows = Array.from({ length: w }, (_, i) => (i === 0 || i === w - 1 ? '1' : '2'))
  const sprite = fromStrings(rows, { 1: edge, 2: 'rgba(248,56,56,0.22)' })
  lane.set(key, sprite)
  return sprite
}

const stripe = (ctx: Ctx, sprite: PixelSprite, x: number, y: number, angle: number, length: number) => {
  ctx.save()
  ctx.translate(Math.round(x), Math.round(y))
  ctx.rotate(angle)
  ctx.drawImage(sprite, 0, -Math.floor(sprite.height / 2), Math.round(length), sprite.height)
  ctx.restore()
}

const alive = (e: Enemy) => e.alpha !== null && e.dying < 0

/** Ground layer: the glow under every Alpha and the lane of an aimed charge. */
export const drawAlphaGround = (ctx: Ctx, g: Game, time: number, visible: Visible) => {
  for (const e of g.enemies) {
    const a = e.alpha
    if (!a || e.dying >= 0) continue
    if (a.phase === 'aim' && visible(a.ox, a.oy, a.length)) {
      const k = Math.min(1, a.t / ALPHA.charge.aim)
      ctx.globalAlpha = 0.55 + k * 0.45
      stripe(ctx, laneOf(Math.round(e.radius * 2), blink(a.t, k) ? CRIMSON : '#f8d030'), a.ox, a.oy, Math.atan2(a.dy, a.dx), a.length)
      ctx.globalAlpha = 1
    }
    if (!visible(e.x, e.y, 40)) continue
    const r = Math.round(e.radius * 1.3 + Math.sin(time * 4 + e.id) * 2)
    blitEllipse(ctx, r, Math.max(2, Math.round(r * 0.45)), a.enraged ? 'rgba(248,48,32,0.4)' : 'rgba(248,56,56,0.26)', e.x, e.y)
  }
}

/** Crimson throb of an Alpha's outline (a fast red-orange flicker once enraged, steady red when `calm`: Flashes reduced). */
export const alphaOutline = (e: Enemy, time: number, calm: boolean) => {
  if (!e.alpha) return undefined
  if (e.alpha.enraged) return calm || Math.floor(time * 8) % 2 === 0 ? '#f83020' : '#f8a020'
  return Math.floor(time * 3 + e.id * 0.37) % 2 === 0 ? '#f82828' : '#c01020'
}

/** Air layer: embers rising off every Alpha on screen, its HP bar and its tag. */
export const drawAlphaAir = (ctx: Ctx, g: Game, time: number, visible: Visible) => {
  for (const e of g.enemies) {
    if (!alive(e) || !visible(e.x, e.y, 40)) continue
    const s = sprites(ENEMIES[e.kind].dex)
    const h = s.bodyH * ALPHA.scale
    const w = s.bodyW * ALPHA.scale
    for (let i = 0; i < 6; i++) {
      const phase = (time * 0.7 + hash2(e.id, i, 5)) % 1
      ctx.globalAlpha = 1 - phase
      ctx.fillStyle = i % 2 === 0 ? CRIMSON : '#f87858'
      ctx.fillRect(Math.round(e.x + (hash2(e.id, i, 6) - 0.5) * w), Math.round(e.y - phase * h * 1.1), 1, 2)
    }
    ctx.globalAlpha = 1
    const top = Math.round(e.y - h - 6)
    const bw = Math.max(22, Math.min(40, Math.round(w * 0.7)))
    const x = Math.round(e.x - bw / 2)
    const k = Math.max(0, e.hp / e.maxHp)
    ctx.fillStyle = '#181010'
    ctx.fillRect(x - 1, top - 1, bw + 2, 4)
    ctx.fillStyle = '#582028'
    ctx.fillRect(x, top, bw, 2)
    ctx.fillStyle = e.alpha?.enraged && Math.floor(time * 8) % 2 === 0 ? '#f8a020' : CRIMSON
    ctx.fillRect(x, top, Math.max(1, Math.round(bw * k)), 2)
    blitText(ctx, t().alphas.tag, CRIMSON, e.x, top - 5, DARK)
  }
}

const ARROW = ['1......', '121....', '12221..', '1222221', '12221..', '121....', '1......']
/** A small crimson "α" for the edge marker. */
const GLYPH = ['.11..1', '1..1.1', '1...1.', '1..1.1', '.11..1']
const MARKER = lazy(() => ({ arrow: fromStrings(ARROW, { 1: '#181818', 2: CRIMSON }), glyph: fromStrings(GLYPH, { 1: '#ffffff' }) }))

/**
 * Screen layer: an arrow on the screen's edge toward every Alpha out of view,
 * with a crimson badge, kept clear of the HUD by `inset` (the map events' margins).
 */
export const drawAlphaMarkers = (ctx: Ctx, g: Game, time: number, inset: { top: number; bottom: number; side: number }) => {
  const { w, h } = g.view
  const cx = w / 2
  const cy = h / 2
  for (const e of g.enemies) {
    if (!alive(e)) continue
    const sx = e.x - g.camera.x
    const sy = e.y - e.radius - g.camera.y
    if (sx > 4 && sx < w - 4 && sy > 4 && sy < h - 4) continue
    const dx = sx - cx
    const dy = sy - cy
    const kx = dx === 0 ? Infinity : (cx - inset.side) / Math.abs(dx)
    const ky = dy === 0 ? Infinity : (dy > 0 ? h - inset.bottom - cy : cy - inset.top) / Math.abs(dy)
    const k = Math.min(kx, ky)
    const angle = Math.atan2(dy, dx)
    const bob = Math.round(Math.sin(time * 8 + e.id) * 1.5)
    const ix = cx + dx * k - Math.cos(angle) * 7
    const iy = cy + dy * k - Math.sin(angle) * 7
    blitEllipse(ctx, 7, 7, '#181010', ix, iy)
    blitEllipse(ctx, 6, 6, e.alpha?.enraged && Math.floor(time * 8) % 2 === 0 ? '#f8a020' : CRIMSON, ix, iy)
    blitCentered(ctx, MARKER().glyph, ix, iy)
    blitRotated(ctx, MARKER().arrow, cx + dx * k + Math.cos(angle) * (6 + bob), cy + dy * k + Math.sin(angle) * (6 + bob), angle)
  }
}

const GEM = ['...111...', '..12221..', '.1233321.', '123344321', '123444321', '.1234321.', '..12321..', '...121...', '....1....']

/** The Alpha's prize on the ground: a crimson gem (`alphaPrize` pickup). */
export const ALPHA_PRIZE = lazy(() => fromStrings(GEM, { 1: DARK, 2: '#c01828', 3: CRIMSON, 4: '#f8e0b0' }))
