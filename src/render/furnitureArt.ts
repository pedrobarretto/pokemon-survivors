import type { FurnitureId } from '../data/furniture'

/**
 * STUB (feat/realm-bases): the art PR (feat/realm-art) replaces this file with
 * the real one, loading `public/assets/furniture/<id>.png` lazily. Until then
 * every piece answers null and `render/base.ts` draws its stand-in box.
 *
 * A piece's art: its PNG once loaded (asking starts the load), null meanwhile
 * and for the dolls (drawn from the legend's own sprite).
 */
export const furnitureImage = (_id: FurnitureId): HTMLImageElement | null => null
