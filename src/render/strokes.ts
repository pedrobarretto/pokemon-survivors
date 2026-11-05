import { TAU } from '../engine/math'
import { beginRects } from '../engine/pixelart'

type Ctx = CanvasRenderingContext2D

/** Pixel-plotted circle outline with gaps – cheap "swirl" rings. `squash` flattens it into an ellipse. Each color is one path (its pixels take turns around the ring). */
export const dashedRing = (ctx: Ctx, x: number, y: number, r: number, rot: number, colors: readonly string[], density = 0.5, squash = 1) => {
  const steps = Math.max(12, Math.floor(r * TAU * 0.6))
  for (let c = 0; c < colors.length; c++) {
    beginRects(ctx, colors[c]!)
    for (let i = c; i < steps; i += colors.length) {
      const a = (i / steps) * TAU
      if (Math.sin(a * 3 + rot) < 1 - density * 2) continue
      ctx.rect(Math.round(x + Math.cos(a + rot * 0.3) * r), Math.round(y + Math.sin(a + rot * 0.3) * r * squash), 1, 1)
    }
    ctx.fill()
  }
}

type BoltStyle = { width: number; edge: string; core: string }

/** Jagged lightning bolt falling from `height` px above (x, y). */
export const bolt = (ctx: Ctx, x: number, y: number, height: number, style: BoltStyle = { width: 3, edge: '#f8d030', core: '#ffffff' }) => {
  const half = Math.floor(style.width / 2)
  let cx = x
  for (let yy = y - height; yy < y; yy += 6) {
    const nx = yy + 6 >= y ? x : x + (Math.random() - 0.5) * 14
    const steps = 6
    for (let s = 0; s < steps; s++) {
      const px = Math.round(cx + ((nx - cx) * s) / steps)
      ctx.fillStyle = style.edge
      ctx.fillRect(px - half, yy + s, style.width, 1)
      ctx.fillStyle = style.core
      ctx.fillRect(px - Math.floor(half / 2), yy + s, Math.max(1, half), 1)
    }
    cx = nx
  }
}
