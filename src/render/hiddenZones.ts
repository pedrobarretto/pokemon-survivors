import { blitCentered, blitEllipse, blitRotated, lazy } from '../engine/pixelart'
import { hash2 } from '../engine/rng'
import { UNDERGROUND } from '../data/places'
import type { PlaceEntrance } from '../game/place'
import { localPlayer } from '../game/players'
import type { Game } from '../game/types'
import { art } from './art'
import { grid, limb, outline, put, toSprite } from './sculpt'

type Ctx = CanvasRenderingContext2D

/**
 * Hidden zones on screen (`game/hidden.ts`): the tells on the map (leaves
 * rustling out of the grotto's hollow, a glint on the boulder's crack), the
 * "!" over the player who found one, and the insides' live parts: the
 * grotto's tall grass shaking and Shaymin's Gracidea, the Underground's holes
 * rumbling and the glints in its walls. Their floors are baked with the
 * places' (`render/places.ts`), their scenery sculpted in `placePieces.ts`.
 */

/** A tuft of tall grass, Black and White's shaking grass: tapering blades fanned out of a clump, lit from the left. */
export const TALL_GRASS = lazy(() => {
  const g = grid(26, 20)
  const base = 17
  const ramp = ['#1c4a18', '#2e7424', '#45983a', '#69b84c', '#94d468']
  const blades = [[-9, 9, -0.5], [-6, 13, -0.3], [-3, 16, -0.12], [0, 17, 0.05], [3, 15, 0.2], [6, 12, 0.35], [9, 8, 0.55], [-1, 11, -0.2], [4, 10, 0.1]] as const
  for (const [dx, h, lean] of blades) limb(g, 13 + dx, base, 13 + dx + lean * h, base - h, 1.6, 0.4, ramp)
  for (let x = 4; x <= 22; x++) put(g, x, base + 1, ramp[1]!)
  outline(g, '#0c2408')
  return toSprite(g)
})

/** Gracidea in bloom, where Shaymin comes out. */
const GRACIDEA = lazy(() =>
  art(
    ['..11....11....11..', '.1221..1221..1221.', '.1231..1231..1231.', '..11.1..11.1..11..', '.1...414...41..1..', '.414.444.41441.41.', '.44444444444444444', '..4444444444444444.'],
    { 1: '#c83878', 2: '#f890b8', 3: '#fff0a0', 4: '#3c8c2c' },
  ),
)

/** A Diglett's hole: dark inside, a ring of loose dirt. */
const HOLE = lazy(() =>
  art(['...111111...', '.1122222211.', '122333333221', '123333333321', '.1223333221.', '..11111111..'], { 1: '#8a6a48', 2: '#3a2c20', 3: '#0c0806' }),
)

/** A Prism Sphere: the Underground's icon. */
const SPHERE = lazy(() => art(['..1111..', '.122321.', '12232221', '12222221', '12222221', '.122221.', '..1111..'], { 1: '#2c4c88', 2: '#68b8f8', 3: '#ffffff' }, '#0c1424'))

/** The "!" over a player who just found a hidden zone. */
const MARK = lazy(() =>
  art(['.1111111.', '122242221', '122242221', '122242221', '122222221', '122242221', '.1111111.', '...11....', '....1....'], { 1: '#202020', 2: '#ffffff', 4: '#e83828' }),
)

/** A hidden zone's icon for the DOM (the results, its toasts): a tuft of tall grass, a Prism Sphere. */
export const hiddenIconSprite = (id: 'grotto' | 'underground') => (id === 'grotto' ? TALL_GRASS() : SPHERE())

const LEAVES = ['#2c7030', '#45983a', '#69b84c', '#94d468'] as const
const SPARKS = ['#ffffff', '#fff8c0', '#f8e070'] as const

/** A four-point sparkle at (x, y), `k` 0 → 1 → 0 over its life. */
const sparkle = (ctx: Ctx, x: number, y: number, k: number) => {
  const r = Math.round(1 + k * 3)
  ctx.fillStyle = SPARKS[k > 0.6 ? 0 : 1]!
  ctx.fillRect(Math.round(x), Math.round(y - r), 1, r * 2 + 1)
  ctx.fillRect(Math.round(x - r), Math.round(y), r * 2 + 1, 1)
  if (k > 0.5) {
    ctx.fillStyle = SPARKS[2]!
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3)
    ctx.fillStyle = SPARKS[0]!
    ctx.fillRect(Math.round(x), Math.round(y), 1, 1)
  }
}

/**
 * A hidden entrance's tell on the map: every couple of seconds leaves burst
 * out of the grotto's hollow (Black and White's shaking grass), or the
 * boulder's crack glints. Once closed the hollow is overgrown and the crack
 * goes dull. After it's found, its door shows a soft glow.
 */
export const drawHiddenEntrance = (ctx: Ctx, ent: PlaceEntrance, t: number) => {
  const x = Math.round(ent.x)
  const y = Math.round(ent.y - 6)
  if (ent.id === 'grotto') {
    if (!ent.open) {
      // Overgrown: leaves close over the hollow.
      blitEllipse(ctx, 9, 6, '#1a4c20', x, y - 6)
      blitEllipse(ctx, 7, 4, '#2c7030', x - 1, y - 8)
      return
    }
    const cycle = 2.4
    const k = (t % cycle) / 0.7
    if (k < 1) {
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (hash2(i, Math.floor(t / cycle), 3) - 0.5) * 2.4
        const d = 4 + k * (10 + i * 2)
        ctx.fillStyle = LEAVES[i % LEAVES.length]!
        ctx.fillRect(Math.round(x + Math.cos(a) * d), Math.round(y - 20 + Math.sin(a) * d * 0.7 + k * k * 10), 2, 1)
      }
    }
    return
  }
  if (!ent.open) return
  const cycle = 1.8
  const k = (t % cycle) / 0.5
  if (k < 1) sparkle(ctx, x + 1, y - 12 - Math.round(hash2(Math.floor(t / cycle), 1, 7) * 10), k < 0.5 ? k * 2 : (1 - k) * 2)
}

/** The "!" popping over the player who found a hidden zone, for a moment. */
export const drawFoundMark = (ctx: Ctx, g: Game) => {
  const ent = g.place.entrance
  if (!ent?.hidden || ent.foundAt === null || g.place.inside) return
  const age = g.now - ent.foundAt
  if (age > 1.4) return
  const p = localPlayer(g)
  const hop = age < 0.15 ? Math.round((0.15 - age) * 40) : 0
  blitRotated(ctx, MARK(), Math.round(p.x), Math.round(p.y - 44 - hop), 0, 2)
}

/** The grotto's tall grass (the shaking one jittering and shedding leaves) and Shaymin's Gracidea; the Underground's holes (rumbling) and glints (sparkling, or dug out). */
export const drawHiddenGround = (ctx: Ctx, g: Game, t: number, chargeArc: (ctx: Ctx, x: number, y: number, r: number, k: number) => void) => {
  const inside = g.place.inside
  if (inside?.id === 'grotto') {
    const d = inside.state.dwellers
    const [fx, fy] = d.rare.spot
    blitCentered(ctx, GRACIDEA(), Math.round(inside.x + fx), Math.round(inside.y + fy))
    if (Math.floor(t * 3) % 5 === 0) sparkle(ctx, inside.x + fx + 6, inside.y + fy - 4, 0.4)
    d.spots.forEach(([sx, sy], i) => {
      const shaking = d.rustle?.spot === i
      const jx = shaking ? (Math.floor(t * 30) % 2 === 0 ? -1 : 1) : 0
      const x = Math.round(inside.x + sx + jx)
      const y = Math.round(inside.y + sy)
      blitCentered(ctx, TALL_GRASS(), x, y)
      if (!shaking) return
      for (let k = 0; k < 3; k++) {
        const a = t * 7 + k * 2.1
        ctx.fillStyle = LEAVES[k % LEAVES.length]!
        ctx.fillRect(Math.round(x + Math.cos(a) * 7), Math.round(y - 6 - Math.abs(Math.sin(a)) * 6), 2, 1)
      }
    })
    return
  }
  if (inside?.id !== 'underground') return
  const s = inside.state
  s.dwellers.spots.forEach(([hx, hy], i) => {
    const x = Math.round(inside.x + hx)
    const y = Math.round(inside.y + hy)
    blitCentered(ctx, HOLE(), x, y)
    if (s.dwellers.rustle?.spot !== i) return
    // Dirt jumping out of a rumbling hole.
    for (let k = 0; k < 4; k++) {
      const a = t * 9 + k * 1.6
      ctx.fillStyle = k % 2 ? '#b89470' : '#8a6a48'
      ctx.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y - 2 - Math.abs(Math.sin(a * 1.3)) * 7), 1, 1)
    }
  })
  for (const gl of s.glints) {
    const x = inside.x + gl.x
    const y = inside.y + gl.y
    if (gl.dug) {
      blitEllipse(ctx, 5, 2, '#2a1e16', x, y)
      continue
    }
    blitEllipse(ctx, 6, 3, 'rgba(248,232,160,0.25)', x, y)
    const k = ((t * 1.3 + hash2(Math.round(gl.x), Math.round(gl.y), 2)) % 1) * 2
    sparkle(ctx, x, y - 3, k < 1 ? k : 2 - k)
    if (gl.progress > 0) chargeArc(ctx, x, y, UNDERGROUND.digRadius, gl.progress)
  }
}
