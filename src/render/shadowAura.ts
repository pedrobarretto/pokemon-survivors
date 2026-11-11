import type { Dir8 } from '../engine/math'
import { hash2 } from '../engine/rng'
import { frameEdges, type AnimName, type SpeciesSprites } from './sprites'

/**
 * The Shadow aura (`game/shadow.ts`): dark violet flames licking up from a
 * Pokémon's silhouette, code-drawn pixel by pixel from the frame being drawn
 * (`frameEdges`), so it hugs every pose. Drawn before the sprite, so the body
 * stays readable on top; a few embers float off its head. Presentation only.
 */

type Ctx = CanvasRenderingContext2D

/** Dark to bright: the flame's root against the body, its body, its lick and its tip. */
const FLAME = ['#1c0828', '#4a1478', '#7a2cc0', '#b468f0', '#ead0ff'] as const

/** Flames flicker at this many steps a second. */
const FLICKER = 10

/**
 * Draws the aura of the frame `drawPokemon` would draw with these arguments
 * (feet at `y`). `t` drives the flicker; `lean` (a struggling phone, reduced
 * flashes) keeps the flames and leaves the embers out.
 */
export const drawShadowAura = (ctx: Ctx, s: SpeciesSprites, anim: AnimName, dir: Dir8, seconds: number, x: number, y: number, t: number, lean = false) => {
  const placed = frameEdges(s, anim, dir, seconds, x, y)
  if (!placed) return
  const { edges, dx, dy } = placed
  const { fw, fh, top, left, right } = edges
  const tick = Math.floor(t * FLICKER)
  let headY = fh
  let bottom = -1
  for (let r = 0; r < fh; r++) if (left[r]! >= 0) bottom = r
  // The tongues off the top of the silhouette, two columns wide, swaying as they rise.
  for (let c = 0; c < fw; c++) {
    const y0 = top[c]!
    if (y0 < 0) continue
    headY = Math.min(headY, y0)
    const n = hash2(c >> 1, tick, 41)
    const h = 1 + Math.floor(n * 4) + ((c >> 1) % 3 === 0 ? 2 : 0)
    for (let i = 0; i < h; i++) {
      const k = i / Math.max(1, h - 1)
      const color = i === 0 ? FLAME[1] : k > 0.85 && h >= 4 ? FLAME[4] : k > 0.55 ? FLAME[3] : FLAME[2]
      const sway = i >= 2 ? Math.round(Math.sin(t * 7 + c * 0.6) * (i / 4)) : 0
      ctx.fillStyle = color
      ctx.fillRect(dx + c + sway, dy + y0 - 1 - i, 1, 1)
    }
  }
  // The sides: short licks off each row's ends, longer near the shoulders, none at the feet.
  const span = Math.max(1, bottom - headY)
  for (let r = 0; r <= bottom; r++) {
    const l = left[r]!
    if (l < 0) continue
    const rise = 1 - (r - headY) / span
    if (rise < 0.15) continue
    for (const [edge, side] of [[l, -1], [right[r]!, 1]] as const) {
      const n = hash2(r >> 1, tick + side * 7, 13)
      const w = Math.floor(n * (1 + rise * 3))
      ctx.fillStyle = FLAME[0]
      ctx.fillRect(dx + edge + side, dy + r, 1, 1)
      for (let i = 1; i <= w; i++) {
        ctx.fillStyle = i === w && w >= 3 ? FLAME[3] : i === 1 ? FLAME[1] : FLAME[2]
        ctx.fillRect(dx + edge + side * (1 + i), dy + r - (i >> 1), 1, 1)
      }
    }
  }
  if (lean || headY >= fh) return
  // Embers drifting up off the head.
  for (let i = 0; i < 4; i++) {
    const k = (t * 0.9 + hash2(i, 3, 77)) % 1
    const col = Math.floor(hash2(i, Math.floor(t * 0.9 + hash2(i, 3, 77)), 5) * fw)
    if (top[col]! < 0) continue
    ctx.fillStyle = k > 0.6 ? FLAME[4] : FLAME[3]
    ctx.fillRect(dx + col, Math.round(dy + headY - 3 - k * 14), 1, 1)
  }
}

/** The Purified mark: a small white lotus with a pink heart, drawn beside the HP bar. */
const LOTUS = ['.1.1.', '12121', '13331', '.111.']

export const drawPurifiedMark = (ctx: Ctx, x: number, y: number) => {
  const colors: Record<string, string> = { 1: '#584870', 2: '#ffffff', 3: '#f8a8d0' }
  for (let r = 0; r < LOTUS.length; r++)
    for (let c = 0; c < 5; c++) {
      const ch = LOTUS[r]![c]!
      if (ch === '.') continue
      ctx.fillStyle = colors[ch]!
      ctx.fillRect(Math.round(x) + c, Math.round(y) + r, 1, 1)
    }
}
