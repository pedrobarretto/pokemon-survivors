import { drawable } from '../engine/pixelart'
import type { FurnitureId } from '../data/furniture'

/**
 * The furniture's art (`public/assets/furniture/<id>.png`, PixelLab pieces
 * trimmed to what they paint): a piece standing on the floor or hanging on
 * the wall is drawn with the bottom middle of its image on the bottom middle
 * of its footprint (`footprint`, `BASE_GRID.tile` px a tile), about as wide;
 * a rug's image covers its footprint from above; a wallpaper or a flooring is
 * one tile (`BASE_GRID.tile` px square) the room repeats. A turned piece
 * draws the same image (its footprint turns, its art stays front-facing).
 * Dolls have no file: they're drawn from the legend's own sprite.
 */

/** Tries a PNG gets (it may fail on a flaky network), and the wait before the next. */
const TRIES = 3
const RETRY_MS = 5000

const images = new Map<FurnitureId, HTMLImageElement>()
const asked = new Set<FurnitureId>()

/** Whether a piece has a PNG of its own (a doll doesn't). */
export const hasFurnitureArt = (id: FurnitureId) => !id.startsWith('doll:')

const load = (id: FurnitureId, tries: number) => {
  const img = new Image()
  img.src = `${import.meta.env.BASE_URL}assets/furniture/${id}.png`
  const landed = () => {
    if (drawable(img)) images.set(id, img)
    else if (tries > 1) setTimeout(() => load(id, tries - 1), RETRY_MS)
  }
  void img.decode().then(landed, landed)
}

/** A piece's image, loading it on the first ask: null until it's in (and always for a doll). */
export const furnitureImage = (id: FurnitureId): HTMLImageElement | null => {
  const img = images.get(id)
  if (img) return img
  if (!asked.has(id) && hasFurnitureArt(id)) {
    asked.add(id)
    load(id, TRIES)
  }
  return null
}
