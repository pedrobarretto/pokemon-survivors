import { ellipse, fromStrings, lazy, drawPacked } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { TUNNEL, type LandmarkId } from '../data/landmarks'
import { openTimeOf } from '../game/landmarks'
import { featuresNear, type Landmark } from '../game/terrain'
import { roomOf } from '../game/room'
import { localPlayer } from '../game/players'
import type { Game } from '../game/types'
import { grid, outline, put, sculpt, stamp, toSprite, type Ramp } from './sculpt'

/**
 * Landmarks' live bits over their sculpted pieces (`render/landmarkPieces.ts`):
 * the camp's fire and smoke, a glint on every treasure still closed, the
 * ring filling while one opens, the ruins' glyphs breathing once woken, the
 * tunnel's lanterns, the Snorlax's Zzz (and its temper while it's poked), the
 * Meowth balloon bobbing on its rope and blasting off, Mew darting out from
 * under the truck, MissingNo.'s coast flickering, and the dark while the
 * player walks under a ridge.
 */

type Ctx = CanvasRenderingContext2D

const FLAMES = [
  ['...1...', '..121..', '.12321.', '.13331.', '1233321', '.12221.'],
  ['..1....', '..11...', '.1221..', '.12321.', '1233321', '.12221.'],
  ['....1..', '...11..', '..1221.', '.12331.', '1233321', '.12221.'],
] as const

const flames = FLAMES.map((rows) => lazy(() => fromStrings(rows, { 1: '#e83818', 2: '#f88828', 3: '#f8e070' })))

/** How far above a treasure's spot its ring and glint show: over the tall ones' heads. */
const LIFT: Partial<Record<LandmarkId, number>> = { snorlax: 26, truck: 12, glitch: 14 }

/** Treasures without a glint: the Snorlax snores instead, and the truck keeps its secret. */
const NO_GLINT: Partial<Record<LandmarkId, true>> = { snorlax: true, truck: true }

/** A glyph's rows framed in a 1 px dark outline (`2`), so a white letter reads on any ground. */
const outlined = (rows: readonly string[]) => {
  const w = rows[0]!.length + 2
  const at = (x: number, y: number) => rows[y - 1]?.[x - 1] === '1'
  return Array.from({ length: rows.length + 2 }, (_, y) =>
    Array.from({ length: w }, (_, x) => (at(x, y) ? '1' : at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) || at(x - 1, y - 1) || at(x + 1, y + 1) ? '2' : '.')).join(''),
  )
}
const zOf = (rows: readonly string[]) => lazy(() => fromStrings(outlined(rows), { 1: '#f4faff', 2: '#1c2c3c' }))
const Z_SMALL = zOf(['111', '.1.', '111'])
const Z_MID = zOf(['1111', '..1.', '.1..', '1111'])
const Z_BIG = zOf(['11111', '...1.', '..1..', '.1...', '11111'])
const VEIN = lazy(() => fromStrings(['.1.1.', '11.11', '.....', '11.11', '.1.1.'], { 1: '#f03030' }))
const TWINKLE = lazy(() => fromStrings(['...1...', '...1...', '..121..', '1122211', '..121..', '...1...', '...1...'], { 1: '#fff8c0', 2: '#ffffff' }))

const MEOWTH: Ramp = ['#a08850', '#d0b878', '#ecdca0', '#fcf4d0']
const WICKER: Ramp = ['#5c3c20', '#7c5430', '#a07040']

/** The Meowth balloon: its head (ears, the charm coin, whiskers), the ropes and the wicker basket. Anchored at the basket's bottom middle. */
const BALLOON = lazy(() => {
  const g = grid(36, 48)
  const cx = 18
  for (const side of [-1, 1]) {
    const x0 = cx + side * 9
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i <= j >> 1; i++) {
        put(g, x0 - side * i, 1 + j, MEOWTH[2]!)
        put(g, x0 + side * (i + 1), 1 + j, MEOWTH[1]!)
      }
      if (j > 2) put(g, x0, 1 + j, '#4c2c1c')
    }
  }
  sculpt(g, [{ x: cx, y: 16, rx: 14, ry: 11 }], MEOWTH, { seed: 3 })
  sculpt(g, [{ x: cx, y: 8, rx: 3.2, ry: 3 }], ['#a07818', '#d0a828', '#f8d038', '#fff0a0'], { seed: 4, tag: 3 })
  for (const ex of [cx - 6, cx + 5]) stamp(g, ['12', '11', '11'], { 1: '#2c1c10', 2: '#ffffff' }, ex, 14)
  stamp(g, ['1.1.1', '.1.1.'], { 1: '#5c3c28' }, cx - 2, 20)
  for (const side of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      put(g, cx + side * (11 + i), 18 - (i >> 2), '#3c2c20')
      put(g, cx + side * (11 + i), 20 + (i >> 2), '#3c2c20')
    }
  }
  for (const [x0, x1] of [[cx - 8, cx - 5], [cx + 8, cx + 5]] as const) for (let y = 27; y <= 36; y++) put(g, Math.round(x0 + ((x1 - x0) * (y - 27)) / 9), y, '#3c2c20')
  for (let y = 37; y <= 44; y++) for (let x = cx - 6; x <= cx + 6; x++) put(g, x, y, y === 37 ? WICKER[2]! : (x + y) % 3 === 0 ? WICKER[0]! : WICKER[1]!)
  outline(g, '#2c1c10')
  return { sprite: toSprite(g), ax: cx, ay: 45 }
})

const MEW_PINK: Ramp = ['#c8608c', '#f090b8', '#f8b8d4', '#ffe0ee']

/** Mew, small and quick: a big head, the long thin tail with its bulb. Faces left. */
const MEW = lazy(() => {
  const g = grid(22, 18)
  for (let i = 0; i <= 9; i++) put(g, 10 + i, 13 - Math.round(Math.sin((i / 9) * Math.PI) * 4) - (i >> 2), MEW_PINK[1]!)
  sculpt(g, [{ x: 19.5, y: 6.5, rx: 1.8, ry: 1.8 }], MEW_PINK, { seed: 1, tag: 0 })
  sculpt(g, [{ x: 9, y: 12, rx: 3.6, ry: 3 }], MEW_PINK, { seed: 2, tag: 2 })
  sculpt(g, [{ x: 8, y: 7, rx: 5.2, ry: 4.6 }], MEW_PINK, { seed: 3, tag: 4 })
  stamp(g, ['1.', '11'], { 1: MEW_PINK[2]! }, 4, 1)
  stamp(g, ['.1', '11'], { 1: MEW_PINK[2]! }, 11, 1)
  for (const ex of [6, 10]) stamp(g, ['2', '1'], { 1: '#2858b8', 2: '#ffffff' }, ex, 6)
  outline(g, '#6c2848')
  return { sprite: toSprite(g), ax: 9, ay: 15 }
})

const SCRAMBLE = ['#101010', '#585858', '#a8a8a8', '#f8f8f8', '#f838a8', '#38d8f8'] as const

const GLINT = lazy(() => fromStrings(['..1..', '..1..', '11211', '..1..', '..1..'], { 1: '#fff8c0', 2: '#ffffff' }))
const MOTE = lazy(() => fromStrings(['.1.', '121', '.1.'], { 1: '#68f0f8', 2: '#ffffff' }))

/** Sparks and wisps of the camp's fire, a glint on closed treasures, motes over a woken altar, lantern flicker. */
export const drawLandmarkAir = (ctx: Ctx, g: Game, t: number, visible: (x: number, y: number, m?: number) => boolean) => {
  if (roomOf(g)) return
  const p = g.player
  for (const f of featuresNear(g, p.x, p.y, g.view.w / 2 + 60, g.view.h / 2 + 60)) {
    const lm = f.landmark
    if (!lm || !visible(lm.x, lm.y, 160)) continue
    const takenAt = g.landmarks.looted.get(lm.cell)
    const looted = takenAt !== undefined
    for (const s of f.solids) {
      if (s.kind === 'campfire') drawFire(ctx, s.x, s.y, t, lm.cell)
      if (s.kind === 'ridge') drawLanterns(ctx, s.x, s.y, t)
    }
    const chest = lm.treasure
    if (!chest || lm.id === 'tunnel') continue
    const since = looted ? g.now - takenAt : Infinity
    const open = localPlayer(g).landmark.opening
    const opening = open?.cell === lm.cell ? open.t / openTimeOf(lm.id) : 0
    if (lm.id === 'snorlax' && !looted) drawSnore(ctx, chest.x, chest.y, t, opening)
    if (lm.id === 'rocket') drawBalloon(ctx, chest.x, chest.y, t, since, lm.variant)
    if (lm.id === 'truck' && since < MEW_FLIGHT && g.landmarks.mew.has(lm.cell)) drawMew(ctx, chest.x, chest.y, since, lm.variant)
    if (lm.id === 'glitch') drawGlitch(ctx, lm, chest.x, chest.y, t, since)
    const lift = LIFT[lm.id] ?? 0
    if (!looted) {
      // Every couple of seconds the treasure catches the light.
      const k = (t * 0.5 + hash2(lm.cell, 1, 3)) % 1
      if (k < 0.18 && !NO_GLINT[lm.id]) {
        ctx.globalAlpha = 1 - Math.abs(k - 0.09) / 0.09
        ctx.drawImage(GLINT(), Math.round(chest.x + 4 - 2), Math.round(chest.y - 14 - 2 - lift))
        ctx.globalAlpha = 1
      }
      if (opening > 0) drawProgress(ctx, chest.x, chest.y - 22 - lift, opening)
    } else if (lm.id === 'ruins') {
      for (let i = 0; i < 4; i++) {
        const k = (t * 0.35 + i / 4) % 1
        ctx.globalAlpha = Math.sin(k * Math.PI)
        ctx.drawImage(MOTE(), Math.round(chest.x - 1 + Math.sin(t * 1.3 + i * 1.7) * 9), Math.round(chest.y - 30 - k * 16))
      }
      ctx.globalAlpha = 1
    }
  }
}

/** Zzz drifting up off the sleeping Snorlax; poked (`k` of the way to waking), it twitches an angry vein. */
const drawSnore = (ctx: Ctx, x: number, y: number, t: number, k: number) => {
  const hx = Math.round(x + 8)
  const hy = Math.round(y - 36)
  for (let i = 0; i < 3; i++) {
    const ph = (t * (k > 0 ? 0.9 : 0.4) + i / 3) % 1
    ctx.globalAlpha = Math.min(1, Math.sin(ph * Math.PI) * 1.6)
    const z = ph > 0.66 ? Z_BIG() : ph > 0.33 ? Z_MID() : Z_SMALL()
    ctx.drawImage(z, Math.round(hx + ph * 16 + Math.sin(t * 2 + i) * 2), Math.round(hy - ph * 24))
  }
  ctx.globalAlpha = 1
  if (k > 0.3) ctx.drawImage(VEIN(), Math.round(x - 12 + (Math.floor(t * 12) % 2)), Math.round(y - 46))
}

/** Seconds the balloon takes to blast off out of sight, the twinkle at its end. */
const BLAST_OFF = 3.4

/** The Meowth balloon bobbing on its rope over the stake; let go (`since` seconds ago), it rises and drifts off to a twinkle. */
const drawBalloon = (ctx: Ctx, x: number, y: number, t: number, since: number, variant: number) => {
  const b = BALLOON()
  const bob = Math.round(Math.sin(t * 1.4 + variant) * 2)
  if (since === Infinity) {
    const bx = Math.round(x + 2)
    const by = Math.round(y - 22 + bob)
    // The rope, sagging from the basket to the stake.
    ctx.fillStyle = '#d8c8a0'
    for (let i = 0; i <= 12; i++) {
      const k = i / 12
      ctx.fillRect(Math.round(bx + (x - bx) * k + Math.sin(k * Math.PI) * 2), Math.round(by + (y - 9 - by) * k), 1, 1)
    }
    ctx.drawImage(b.sprite, bx - b.ax, by - b.ay)
    return
  }
  if (since > BLAST_OFF + 0.6) return
  const side = variant % 2 === 0 ? 1 : -1
  const k = Math.min(since, BLAST_OFF)
  const bx = Math.round(x + 2 + side * k * k * 18)
  const by = Math.round(y - 22 - k * 24 - k * k * 26)
  if (since < BLAST_OFF) {
    ctx.globalAlpha = Math.min(1, (BLAST_OFF - since) / 0.8)
    ctx.drawImage(b.sprite, bx - b.ax, by - b.ay)
  } else {
    // ...and Team Rocket's blasting off again: a twinkle where it vanished.
    ctx.globalAlpha = 1 - (since - BLAST_OFF) / 0.6
    ctx.drawImage(TWINKLE(), bx - 3, by - 30)
  }
  ctx.globalAlpha = 1
}

/** Seconds Mew is in sight after the search turned it up. */
const MEW_FLIGHT = 2.6

/** Mew darting out from under the truck, a pink shimmer in its wake, and up and away. */
const drawMew = (ctx: Ctx, x: number, y: number, since: number, variant: number) => {
  const m = MEW()
  const side = variant % 2 === 0 ? -1 : 1
  const at = (k: number) => ({ x: x + side * k * 120, y: y - 8 - k * 70 - Math.sin(k * Math.PI * 3) * 8 })
  const k = since / MEW_FLIGHT
  for (let i = 1; i <= 6; i++) {
    const trail = at(Math.max(0, k - i * 0.03))
    ctx.globalAlpha = (1 - i / 7) * (1 - k)
    ctx.fillStyle = i % 2 === 0 ? '#f8b8d4' : '#ffffff'
    ctx.fillRect(Math.round(trail.x + Math.sin(i * 2.1) * 3), Math.round(trail.y - 4), 1, 1)
  }
  const now = at(k)
  ctx.globalAlpha = Math.min(1, (1 - k) * 3)
  if (side > 0) {
    // Flying east: the sprite faces it.
    ctx.save()
    ctx.scale(-1, 1)
    ctx.drawImage(m.sprite, -Math.round(now.x) - (m.sprite.width - m.ax), Math.round(now.y) - m.ay)
    ctx.restore()
  } else ctx.drawImage(m.sprite, Math.round(now.x) - m.ax, Math.round(now.y) - m.ay)
  ctx.globalAlpha = 1
}

/** MissingNo.'s coast: scrambled blocks blinking in and out around it, a burst of them right after it showed up. */
const drawGlitch = (ctx: Ctx, lm: Landmark, x: number, y: number, t: number, since: number) => {
  const burst = since < 1.5
  const frame = Math.floor(t * (burst ? 16 : 6))
  const n = burst ? 14 : 3
  for (let i = 0; i < n; i++) {
    if (!burst && hash2(lm.cell, frame, i + 40) < 0.5) continue
    const bx = Math.round(x + (hash2(lm.cell, frame, i) - 0.5) * (burst ? 120 : 70))
    const by = Math.round(y - 14 + (hash2(lm.cell, frame, i + 20) - 0.5) * (burst ? 70 : 40))
    const w = hash2(lm.cell, frame, i + 60) < 0.5 ? 8 : 4
    for (let j = 0; j < 4; j++) {
      for (let c = 0; c < w; c++) {
        ctx.fillStyle = SCRAMBLE[Math.floor(hash2(bx + c, by + j, frame) * SCRAMBLE.length)]!
        ctx.fillRect(bx + c, by + j, 1, 1)
      }
    }
  }
}

/** The campfire: a flickering flame, embers popping and smoke drifting up and away. */
const drawFire = (ctx: Ctx, x: number, y: number, t: number, seed: number) => {
  const fx = Math.round(x)
  const fy = Math.round(y)
  ctx.globalAlpha = 0.18 + 0.06 * Math.sin(t * 9)
  drawPacked(ctx, ellipse(16, 7, '#f8a040'), fx - 16, fy - 9)
  ctx.globalAlpha = 1
  ctx.drawImage(flames[Math.floor(t * 9 + seed) % flames.length]!(), fx - 3, fy - 9)
  for (let i = 0; i < 5; i++) {
    const k = (t * 0.45 + i / 5) % 1
    const sx = fx + Math.round(Math.sin(t * 0.8 + i * 2.1) * 3 + k * 10)
    const sy = fy - 10 - Math.round(k * 34)
    ctx.globalAlpha = 0.45 * (1 - k)
    drawPacked(ctx, ellipse(1 + Math.round(k * 3), 1 + Math.round(k * 2), '#c8c0b8'), sx - 2, sy - 2)
  }
  for (let i = 0; i < 3; i++) {
    const k = (t * 1.6 + i / 3 + hash2(seed, i, 5)) % 1
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = '#f8c040'
    ctx.fillRect(fx - 2 + Math.round(hash2(seed, Math.floor(t * 1.6 + i / 3), i) * 5), fy - 8 - Math.round(k * 14), 1, 1)
  }
  ctx.globalAlpha = 1
}

/** A warm glow around the lanterns at the tunnel's mouths. */
const drawLanterns = (ctx: Ctx, x: number, y: number, t: number) => {
  for (const side of [-1, 1]) {
    const lx = Math.round(x + side * 93)
    const ly = Math.round(y - 15)
    ctx.globalAlpha = 0.22 + 0.08 * Math.sin(t * 7 + side)
    drawPacked(ctx, ellipse(6, 6, '#f8d878'), lx - 6, ly - 6)
  }
  ctx.globalAlpha = 1
}

/** Dots around a ring, lit up to `k` (0..1) of the way round: a treasure being opened. */
const drawProgress = (ctx: Ctx, x: number, y: number, k: number) => {
  const n = 12
  for (let i = 0; i < n; i++) {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2
    ctx.fillStyle = i / n < k ? '#f8e070' : 'rgba(24,16,16,0.55)'
    ctx.fillRect(Math.round(x + Math.cos(a) * 6), Math.round(y + Math.sin(a) * 6), 1, 1)
  }
}

/** Under a ridge: the screen goes dark on the way in, a faint light moves with the player, and it opens up again at the far mouth. */
export const drawTunnelDark = (ctx: Ctx, g: Game, camX: number, camY: number) => {
  const p = localPlayer(g)
  const tr = p.landmark.transit
  if (!tr) return
  const k = tr.t / TUNNEL.travel
  const dark = Math.min(1, k / 0.22, (1 - k) / 0.22)
  const { w, h } = g.view
  ctx.globalAlpha = 0.92 * Math.max(0, dark)
  ctx.fillStyle = '#060404'
  ctx.fillRect(0, 0, w, h)
  // The player's own light down there, and the rails it follows.
  const px = Math.round(p.x - camX)
  const py = Math.round(p.y - camY - 10)
  ctx.globalAlpha = 0.5 * Math.max(0, dark)
  drawPacked(ctx, ellipse(18, 12, '#3a2e28'), px - 18, py - 12)
  ctx.fillStyle = '#7c7c88'
  for (let i = -6; i <= 6; i++) {
    const rx = Math.round(px + i * 6 - ((p.x * 1) % 6))
    ctx.fillRect(rx, py + 9, 1, 1)
    ctx.fillRect(rx, py + 13, 1, 1)
  }
  ctx.globalAlpha = 1
}

/** Whether the player's sprite hides (walking under a ridge). */
export const playerUnderground = (g: Game) => localPlayer(g).landmark.transit !== null
