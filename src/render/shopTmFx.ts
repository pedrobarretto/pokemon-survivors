import { blitCentered, blitPacked, context2d, createCanvas, ellipse, fromStrings, lazy, ring, type Palette, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import { hash2 } from '../engine/rng'
import { HYPER_BEAM, type ShopTmMoveId } from '../game/shopTmMoves'
import type { ShopTmMove2Id } from '../game/shopTmMoves2'
import type { Attack, Game } from '../game/types'
import { ownerOf } from '../game/players'

/**
 * Art of the shop-exclusive TMs (`game/shopTmMoves.ts`): Pay Day's spinning
 * coins, Thief's shadow claws, Protect's bubble and Hyper Beam's charge and
 * beam, plus their level-up icons. `draw.ts` calls `drawShopTmAir` once a
 * frame over the Pokémon. Everything snaps to whole pixels; flicker comes
 * from `hash2` and the clock, never from Math.random.
 */

type Ctx = CanvasRenderingContext2D

export const px = (ctx: Ctx, x: number, y: number, color: string, w = 1, h = 1) => {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

/** Square-brush line from (x0, y0) to (x1, y1), `w` px thick. */
export const thickLine = (ctx: Ctx, x0: number, y0: number, x1: number, y1: number, w: number, color: string) => {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)))
  const half = Math.floor(w / 2)
  ctx.fillStyle = color
  for (let i = 0; i <= n; i++) {
    const k = i / n
    ctx.fillRect(Math.round(x0 + (x1 - x0) * k) - half, Math.round(y0 + (y1 - y0) * k) - half, w, w)
  }
}

const radiusOf = (a: Attack) => (a.shape.kind === 'circle' ? a.shape.r : 8)

/* ---------------- Sprites ---------------- */

const outlined = (s: PixelSprite, color = '#181818'): PixelSprite => {
  const canvas = createCanvas(s.width + 2, s.height + 2)
  const ctx = context2d(canvas)
  const sil = createCanvas(s.width, s.height)
  const sctx = context2d(sil)
  sctx.drawImage(s, 0, 0)
  sctx.globalCompositeOperation = 'source-in'
  sctx.fillStyle = color
  sctx.fillRect(0, 0, sil.width, sil.height)
  for (const [dx, dy] of [[0, 1], [2, 1], [1, 0], [1, 2]] as const) ctx.drawImage(sil, dx, dy)
  ctx.drawImage(s, 1, 1)
  return canvas
}

export const sprite = (rows: readonly string[], palette: Palette) => outlined(fromStrings(rows, palette))

const GOLD = { 1: '#805000', 2: '#f8c830', 3: '#fff3a0', 4: '#c89010' } as const

/** Pay Day's coin, face on and edge on (it spins). */
const COIN = lazy(() => [
  sprite(['.1111.', '123321', '132241', '132241', '124441', '.1111.'], GOLD),
  sprite(['.111.', '12341', '13241', '12441', '.111.'], GOLD),
  sprite(['.11.', '1241', '1341', '1241', '.11.'], GOLD),
  sprite(['11', '24', '34', '24', '11'], GOLD),
])

/* ---------------- Icons ---------------- */

/** The first batch's icons; `shopTmFx2.ts` draws the second's (`SHOP_TM_ICONS_2`). */
export const SHOP_TM_ICONS: Record<Exclude<ShopTmMoveId, ShopTmMove2Id>, () => PixelSprite> = {
  payDay: () => sprite(['..1111..', '.122221.', '12333221', '12322421', '12233421', '12444421', '.122221.', '..1111..'], GOLD),
  thief: () =>
    sprite(
      ['.......1.', '......121', '..1..1231', '.121.121.', '12321.1..', '.1231....', '..121....', '...1.....'],
      { 1: '#201828', 2: '#705898', 3: '#e0d0ff' },
    ),
  protect: () =>
    sprite(
      ['..11111..', '.1222221.', '122333221', '123444321', '123444321', '122333221', '.1222221.', '..1...1..'],
      { 1: '#206838', 2: '#58c878', 3: '#a8f0b8', 4: '#ffffff' },
    ),
  hyperBeam: () =>
    sprite(
      ['.11......', '1221.....', '1232111111', '1233333334', '1232111111', '1221.....', '.11......'].map((r) => r.padEnd(10, '.')),
      { 1: '#a04000', 2: '#f89830', 3: '#f8e070', 4: '#ffffff' },
    ),
}

/* ---------------- In the air ---------------- */

const drawCoin = (ctx: Ctx, a: Attack, t: number) => {
  const frames = COIN()
  const spin = Math.floor((t * 14 + a.id) % 6)
  const frame = frames[[0, 1, 2, 3, 2, 1][spin]!]!
  // A short glint trail behind it.
  const m = a.motion
  if (m.kind === 'linear') {
    const len = Math.hypot(m.vx, m.vy) || 1
    for (let i = 1; i <= 3; i++) px(ctx, a.x - (m.vx / len) * i * 3, a.y - (m.vy / len) * i * 3, i === 1 ? '#fff3a0' : '#f8c830')
  }
  blitCentered(ctx, frame, a.x, a.y)
  if (hash2(a.id, Math.floor(t * 10)) > 0.8) px(ctx, a.x + 2, a.y - 3, '#ffffff')
}

/**
 * Thief's swipe: three dark claw marks raking diagonally across the foe, as
 * big as the hitbox, each with a lilac edge; then a burst of shadow specks.
 */
const drawClaw = (ctx: Ctx, a: Attack) => {
  const r = Math.max(8, radiusOf(a))
  const k = Math.min(1, a.age / Math.max(0.01, a.activeFrom))
  const side = a.flip ? -1 : 1
  ctx.globalAlpha = Math.min(1, (a.ttl - a.age) / 0.15)
  for (let i = -1; i <= 1; i++) {
    // Each mark runs from a top corner down to the opposite one, drawn in as the swipe goes.
    const x0 = a.x + side * (i * 5 - r)
    const y0 = a.y - r + Math.abs(i) * 2
    const x1 = x0 + side * 2 * r * k
    const y1 = y0 + (2 * r - Math.abs(i) * 4) * k
    thickLine(ctx, x0, y0, x1, y1, 4, '#201828')
    thickLine(ctx, x0, y0, x1, y1, 2, '#8068b8')
    thickLine(ctx, x0 - side, y0, x1 - side, y1, 1, '#e8e0ff')
  }
  if (a.age >= a.activeFrom && a.age < a.activeFrom + 0.14) {
    for (let i = 0; i < 8; i++) {
      const ang = hash2(a.id, i) * TAU
      const d = r * 0.6 + (a.age - a.activeFrom) * 110
      px(ctx, a.x + Math.cos(ang) * d, a.y + Math.sin(ang) * d, i % 2 ? '#c8b8f0' : '#383048', 2, 2)
    }
  }
  ctx.globalAlpha = 1
}

/** Protect's bubble around the player: a green-white shell with a turning glint, flashing when it blocks. */
const drawBubble = (ctx: Ctx, g: Game, a: Attack, t: number) => {
  const r = Math.round(radiusOf(a))
  const left = a.ttl - a.age
  // It blinks in its last moments, so the player sees it about to pop.
  if (left < 0.25 && Math.floor(t * 20) % 2 === 0) return
  const pop = Math.min(1, a.age / 0.08)
  const rr = Math.max(2, Math.round(r * (0.6 + 0.4 * pop)))
  blitPacked(ctx, ellipse(rr, rr, 'rgba(120,232,152,0.22)'), a.x, a.y)
  blitPacked(ctx, ring(rr, 1, '#a8f0b8'), a.x, a.y)
  blitPacked(ctx, ring(rr + 1, 1, 'rgba(32,104,56,0.8)'), a.x, a.y)
  const guarding = ownerOf(g, a.owner).guard?.move === 'protect'
  // Hexagon facets turning around the shell.
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * TAU + t * 1.2
    px(ctx, a.x + Math.cos(ang) * (rr - 3), a.y + Math.sin(ang) * (rr - 3) * 0.9, guarding ? '#ffffff' : '#d8f8e0')
  }
  const glint = (t * 2.5) % TAU
  for (let i = -2; i <= 2; i++) px(ctx, a.x + Math.cos(glint + i * 0.08) * rr, a.y + Math.sin(glint + i * 0.08) * rr, '#ffffff', 2, 2)
}

/** Hyper Beam gathering: light streams into an orb in front of the player, growing until it fires. */
const drawCharge = (ctx: Ctx, a: Attack, t: number) => {
  const k = Math.min(1, a.age / HYPER_BEAM.charge)
  const ox = a.x + Math.cos(a.memo) * 12
  const oy = a.y + Math.sin(a.memo) * 12
  for (let i = 0; i < 10; i++) {
    const ang = hash2(a.id, i) * TAU + t * 3
    const d = (1 - ((k + hash2(i, a.id)) % 1)) * 26
    px(ctx, ox + Math.cos(ang) * d, oy + Math.sin(ang) * d, i % 3 === 0 ? '#ffffff' : '#f8c060', 2, 2)
  }
  const r = Math.max(1, Math.round(2 + k * 5))
  blitPacked(ctx, ellipse(r + 2, r + 2, 'rgba(248,152,48,0.5)'), ox, oy)
  blitPacked(ctx, ellipse(r, r, '#f8e070'), ox, oy)
  blitPacked(ctx, ellipse(Math.max(1, r - 2), Math.max(1, r - 2), '#ffffff'), ox, oy)
}

/** Hyper Beam's segments drawn as one thick beam in three layers, with a flare at its tip. */
const drawBeam = (ctx: Ctx, g: Game, t: number) => {
  for (let layer = 0; layer < 3; layer++) {
    for (const a of g.attacks) {
      const m = a.motion
      if (a.visual !== 'hyperBeam' || a.age < 0 || m.kind !== 'orbit') continue
      const p = ownerOf(g, a.owner)
      const r = radiusOf(a)
      const k = a.age / a.ttl
      const w = r * Math.min(1, a.age / 0.06) * Math.min(1, (1 - k) / 0.35 + 0.1)
      const length = HYPER_BEAM.length * (r / HYPER_BEAM.r)
      const half = Math.max(5, (length - 12) / (HYPER_BEAM.segments - 1) / 2 + 1)
      const cx = Math.cos(m.angle)
      const cy = Math.sin(m.angle)
      const x0 = p.x + cx * (m.radius - half)
      const y0 = p.y - 8 + cy * (m.radius - half)
      const x1 = p.x + cx * (m.radius + half)
      const y1 = p.y - 8 + cy * (m.radius + half)
      const wobble = Math.floor(t * 30 + m.radius) % 2
      const color = layer === 0 ? 'rgba(248,120,32,0.55)' : layer === 1 ? '#f8d050' : '#ffffff'
      const thick = layer === 0 ? w * 2.2 + wobble : layer === 1 ? w * 1.2 : w * 0.5
      thickLine(ctx, x0, y0, x1, y1, Math.max(1, Math.round(thick)), color)
      if (layer === 2 && a.flip) {
        const f = Math.round(w * 1.6) + 4
        blitPacked(ctx, ellipse(f, f, 'rgba(248,152,48,0.6)'), a.x, a.y)
        blitPacked(ctx, ellipse(Math.max(1, f - 3), Math.max(1, f - 3), '#fff8d0'), a.x, a.y)
        for (let i = 0; i < 8; i++) {
          const ang = (i / 8) * TAU + t * 6
          px(ctx, a.x + Math.cos(ang) * (f + 3), a.y + Math.sin(ang) * (f + 3), '#ffffff', 2, 2)
        }
      }
    }
  }
}

/** The shop TMs' pass over the Pokémon (`draw.ts`). */
export const drawShopTmAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  drawBeam(ctx, g, t)
  for (const a of g.attacks) {
    if (a.age < 0 || !visible(a.x, a.y, 120)) continue
    switch (a.visual) {
      case 'payDay':
        drawCoin(ctx, a, t)
        break
      case 'thief':
        drawClaw(ctx, a)
        break
      case 'protect':
        drawBubble(ctx, g, a, t)
        break
      case 'hyperCharge':
        drawCharge(ctx, a, t)
        break
    }
  }
}
