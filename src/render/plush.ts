import { fitSprites, loadSpecies, drawPokemon, sprites } from './sprites'

/**
 * A plush, for the claw machine and the secret bases: the species' Idle
 * sprite with a stitched outline and a sewn-on tag. Placeholder art until the
 * final plushes are drawn; whatever replaces it only has to fill this canvas.
 */

const made = new Map<string, HTMLCanvasElement>()

/** Room to draw a sprite in before it's cropped, and the feet's height in it. */
const ROOM = { w: 96, h: 96, feet: 88 } as const

const STITCH = { thread: [248, 236, 208], shade: [106, 74, 56] } as const

/** Whether a pixel of the sheet's data is drawn. */
const inked = (d: Uint8ClampedArray, x: number, y: number) => x >= 0 && y >= 0 && x < ROOM.w && y < ROOM.h && d[(y * ROOM.w + x) * 4 + 3]! > 40

/**
 * The plush of species `dex` at most `max` px wide, its feet on the canvas's
 * bottom row; null until the sprite is in (it loads on the first ask).
 */
export const plushArt = (dex: number, max: number): HTMLCanvasElement | null => {
  const key = `${dex}:${max}`
  const hit = made.get(key)
  if (hit) return hit
  const raw = sprites(dex)
  if (raw.variant === undefined) {
    void loadSpecies(dex).catch(() => {})
    return null
  }
  const c = document.createElement('canvas')
  c.width = ROOM.w
  c.height = ROOM.h
  const g = c.getContext('2d', { willReadFrequently: true })
  if (!g) return null
  drawPokemon(g, fitSprites(raw, max), 'Idle', 0, 0, ROOM.w / 2, ROOM.feet)
  const image = g.getImageData(0, 0, ROOM.w, ROOM.h)
  const d = image.data
  const box: Record<'l' | 'r' | 't' | 'b', number> = { l: ROOM.w, r: -1, t: ROOM.h, b: -1 }
  for (let y = 0; y < ROOM.h; y++) {
    for (let x = 0; x < ROOM.w; x++) {
      if (!inked(d, x, y)) continue
      box.l = Math.min(box.l, x)
      box.r = Math.max(box.r, x)
      box.t = Math.min(box.t, y)
      box.b = Math.max(box.b, y)
    }
  }
  // Nothing drawn yet: the Idle sheet is still on its way.
  if (box.r < 0) return null
  const out = new Uint8ClampedArray(d)
  for (let y = box.t - 1; y <= box.b + 1; y++) {
    for (let x = box.l - 1; x <= box.r + 1; x++) {
      if (inked(d, x, y) || !(inked(d, x - 1, y) || inked(d, x + 1, y) || inked(d, x, y - 1) || inked(d, x, y + 1))) continue
      const [r, gr, b] = (x + y) % 3 === 0 ? STITCH.thread : STITCH.shade
      const at = (y * ROOM.w + x) * 4
      out[at] = r
      out[at + 1] = gr
      out[at + 2] = b
      out[at + 3] = 255
    }
  }
  g.putImageData(new ImageData(out, ROOM.w, ROOM.h), 0, 0)
  // The sewn-on tag, by the feet.
  g.fillStyle = '#e85048'
  g.fillRect(box.r - 1, box.b - 3, 3, 3)
  g.fillStyle = '#ffffff'
  g.fillRect(box.r, box.b - 2, 1, 1)
  const w = box.r - box.l + 3
  const h = box.b - box.t + 3
  const crop = document.createElement('canvas')
  crop.width = w
  crop.height = h
  crop.getContext('2d')?.drawImage(c, box.l - 1, box.t - 1, w, h, 0, 0, w, h)
  made.set(key, crop)
  return crop
}
