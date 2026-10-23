import { context2d, createCanvas, onCanvasReset } from '../engine/pixelart'

type Ctx = CanvasRenderingContext2D

/**
 * The players' moves drawn see-through, as Settings → Game asks: your own
 * (`attackOpacity`) and, in co-op, your teammates' (`teamAttackOpacity`).
 * One side's moves draw into a cleared view-sized layer, then the layer lays
 * over the world at that side's opacity, so overlapping beams fade as one
 * shape instead of stacking back up to opaque. Fully opaque moves skip the
 * layer and draw straight onto the world.
 */
export type AttackSide = 'own' | 'team'

type Layer = { canvas: HTMLCanvasElement; ctx: Ctx }

const layers: Partial<Record<AttackSide, Layer>> = {}
onCanvasReset(
  () => {
    delete layers.own
    delete layers.team
  },
  () => layers,
)

/** A cleared layer the size of the view, in world coordinates (top-left at the camera). One canvas per side, reused every frame. */
const layerFor = (side: AttackSide, w: number, h: number, camX: number, camY: number): Layer => {
  let layer = layers[side]
  if (!layer || layer.canvas.width !== w || layer.canvas.height !== h) {
    const canvas = createCanvas(w, h)
    layer = layers[side] = { canvas, ctx: context2d(canvas) }
  }
  layer.ctx.setTransform(1, 0, 0, 1, 0, 0)
  layer.ctx.clearRect(0, 0, w, h)
  layer.ctx.setTransform(1, 0, 0, 1, -camX, -camY)
  return layer
}

/**
 * Draws one side's moves (`draw`, given where to draw) onto the world at
 * `alpha` (`ctx` translated to the camera). At 1 they draw straight onto it.
 */
export const paintAttacks = (ctx: Ctx, side: AttackSide, alpha: number, view: { w: number; h: number }, camX: number, camY: number, draw: (into: Ctx) => void) => {
  if (alpha >= 1) return draw(ctx)
  if (alpha <= 0) return
  const layer = layerFor(side, view.w, view.h, camX, camY)
  draw(layer.ctx)
  ctx.globalAlpha = alpha
  ctx.drawImage(layer.canvas, camX, camY)
  ctx.globalAlpha = 1
}
