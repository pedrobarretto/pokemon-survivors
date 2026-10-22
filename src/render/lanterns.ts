import { canvasCache, context2d, createCanvas, fromStrings, lazy, type Palette } from '../engine/pixelart'

/**
 * The Lantern Festival's small code-drawn art for the Kecleon plaza
 * (`render/plaza.ts`), in the shop's palette: paper lanterns (Poké Ball,
 * Kecleon green, warm cream), the lantern strings that tie the square together
 * (a sagging cord between two tie points, a lantern every few pixels), a
 * lantern floating on a lily pad, the sky lanterns and the fireflies.
 */

/** The lanterns' iron, also the line over the cord. */
const IRON = '#1d1c1b'

const PALETTE: Palette = {
  K: IRON,
  R: '#e01b39',
  r: '#a60738',
  p: '#f2646a',
  W: '#f9f3d9',
  w: '#c9c2b0',
  G: '#34d14f',
  g: '#0e9842',
  L: '#59e76e',
  y: '#f8c747',
  o: '#efab34',
  O: '#dd8e20',
  f: '#fdd970',
  F: '#f2f6bf',
}

/** The cord's colors: the cord, and the dark line over it. */
const CORD = '#6e4a2c'
const CORD_TOP = IRON

/** The paper lanterns a string can carry. */
export type LanternKind = 'ball' | 'kecleon' | 'cream'

const LANTERN_ROWS = {
  ball: ['..K..', '.KKK.', 'KpRrK', 'KKWKK', 'KWWwK', '.KKK.'],
  kecleon: ['..K..', '.KKK.', 'KLGgK', 'KRRrK', 'KGggK', '.KKK.', '..y..'],
  cream: ['..K..', '.KKK.', 'KFfoK', 'KffoK', 'KfoOK', '.KKK.', '..O..'],
} as const satisfies Record<LanternKind, readonly string[]>

/** The sprites, built on first use. */
export const LANTERN_ART = lazy(() => ({
  ball: fromStrings(LANTERN_ROWS.ball, PALETTE),
  kecleon: fromStrings(LANTERN_ROWS.kecleon, PALETTE),
  cream: fromStrings(LANTERN_ROWS.cream, PALETTE),
  /** A paper lantern on a lily pad, for the fountain's water. */
  floating: fromStrings(['.KKK.', 'KFfoK', 'KfoOK', 'gGLGg', '.ggg.'], PALETTE),
  /** A sky lantern rising, and a farther, smaller one. */
  sky: fromStrings(['.OOO.', 'OFffO', 'OffoO', 'OfooO', '.OOO.', '..y..'], PALETTE),
  skyFar: fromStrings(['.O.', 'OfO', 'OoO', '.y.'], PALETTE),
  firefly: fromStrings(['F'], PALETTE),
}))

/** A lantern string from a tie point to another `dx`, `dy` px away, sagging `sag` px, a lantern each `step` px from `start` px in, cycling `kinds`. */
export type LanternString = { dx: number; dy: number; sag: number; step: number; start: number; kinds: readonly LanternKind[] }

/** Where along the string (from its first tie) the cord passes at `t` (0 to 1). */
const cordAt = (s: LanternString, t: number) => ({ x: Math.round(s.dx * t), y: Math.round(s.dy * t + s.sag * 4 * t * (1 - t)) })

/** Where the string's lanterns hang (the cord's point each hangs from, from its first tie). Pure. */
export const stringLanterns = (s: LanternString) => {
  const n = Math.max(Math.abs(s.dx), 1)
  const out: { x: number; y: number; kind: LanternKind }[] = []
  for (let t = s.start / n, i = 0; t < 1 - (s.start * 0.6) / n; t += s.step / n, i++) out.push({ ...cordAt(s, t), kind: s.kinds[i % s.kinds.length]! })
  return out
}

/** How far around the cord its canvas reaches, for the lanterns hanging under it. */
const PAD = 10
const BELOW = 12

/**
 * A string drawn once into a canvas: the cord with its dark top line, a tie
 * pixel and a lantern under each of its points. Draw it at the first tie
 * minus `ox`, `oy`. Cached per shape, dropped on a GPU reset.
 */
export const lanternString = (() => {
  const cache = canvasCache<string, { canvas: HTMLCanvasElement; ox: number; oy: number }>()
  return (s: LanternString) => {
    const key = `${s.dx},${s.dy},${s.sag},${s.step},${s.start},${s.kinds.join('+')}`
    const hit = cache.get(key)
    if (hit) return hit
    const x0 = Math.min(0, s.dx) - PAD
    const y0 = Math.min(0, s.dy) - PAD
    const canvas = createCanvas(Math.abs(s.dx) + PAD * 2 + 1, Math.abs(s.dy) + s.sag + PAD * 2 + BELOW)
    const ctx = context2d(canvas)
    const dot = (x: number, y: number, color: string) => {
      ctx.fillStyle = color
      ctx.fillRect(x - x0, y - y0, 1, 1)
    }
    // Twice as many samples as columns, filling the gaps down steep spans.
    const samples = Math.max(Math.abs(s.dx), 1) * 2
    let prev = cordAt(s, 0)
    for (let i = 0; i <= samples; i++) {
      const p = cordAt(s, i / samples)
      ctx.fillStyle = CORD
      ctx.fillRect(p.x - x0, Math.min(prev.y, p.y) - y0, 1, Math.abs(p.y - prev.y) + 1)
      dot(p.x, p.y - 1, CORD_TOP)
      prev = p
    }
    // The cord again over the dark line where a steep span drew it.
    for (let i = 0; i <= samples; i++) {
      const p = cordAt(s, i / samples)
      dot(p.x, p.y, CORD)
    }
    const art = LANTERN_ART()
    for (const l of stringLanterns(s)) {
      const sprite = art[l.kind]
      dot(l.x, l.y + 1, CORD_TOP)
      ctx.drawImage(sprite, l.x - x0 - (sprite.width >> 1), l.y - y0 + 2)
    }
    const built = { canvas, ox: -x0, oy: -y0 }
    cache.set(key, built)
    return built
  }
})()
