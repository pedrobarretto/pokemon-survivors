import { blitCentered, blitEllipse, canvasCache, context2d, createCanvas, drawable, type PixelSprite } from '../engine/pixelart'
import { TAU } from '../engine/math'
import type { EvoItemId } from '../data/shop'
import type { Pickup } from '../game/types'
import { itemArt } from './art'
import { px } from './shopTmFx'

type Ctx = CanvasRenderingContext2D

/** The items' official sprites, loaded once each (decoded or not): the ground sprite is copied from them. */
const images = new Map<EvoItemId, HTMLImageElement>()

/** The ground sprites, the official sprites at 1× (15 to 23 px, a bit over a TM disc). */
const sprites = canvasCache<EvoItemId, PixelSprite>()

/** The ground sprite of an item, or null while its sprite loads (the first call starts it). */
const groundSprite = (id: EvoItemId): PixelSprite | null => {
  const cached = sprites.get(id)
  if (cached) return cached
  let img = images.get(id)
  if (!img) {
    img = new Image()
    img.src = itemArt(id)
    images.set(id, img)
  }
  if (!drawable(img)) return null
  const sprite = createCanvas(img.naturalWidth, img.naturalHeight)
  context2d(sprite).drawImage(img, 0, 0)
  sprites.set(id, sprite)
  return sprite
}

/** An evolution item a boss dropped: its icon over a soft glow, with sparkles turning round it. */
export const drawEvoItem = (ctx: Ctx, k: Extract<Pickup, { kind: 'evoItem' }>, x: number, y: number, t: number) => {
  if (!k.attracted) blitEllipse(ctx, 10, 10, 'rgba(248,240,168,0.22)', x, y)
  const sprite = groundSprite(k.item)
  if (sprite) blitCentered(ctx, sprite, x, y)
  else blitEllipse(ctx, 4, 4, '#f8f0a8', x, y)
  for (let i = 0; i < 3; i++) {
    const ph = (t * 0.8 + i / 3 + k.id * 0.37) % 1
    if (ph > 0.45) continue
    const ang = (i / 3) * TAU + t * 0.6
    const sx = x + Math.cos(ang) * 10
    const sy = y + Math.sin(ang) * 8 - 2
    px(ctx, sx, sy, '#ffffff')
    if (ph < 0.2) {
      px(ctx, sx - 1, sy, '#fff8c0')
      px(ctx, sx + 1, sy, '#fff8c0')
      px(ctx, sx, sy - 1, '#fff8c0')
      px(ctx, sx, sy + 1, '#fff8c0')
    }
  }
}
