import type { Rarity } from './cosmetics'
import type { FurnitureUse } from './furnitureUse'

/**
 * A piece of furniture's shape (`data/furniture.ts` explains each field).
 * Its own module, free of the legends `furniture.ts` needs for the dolls, so
 * the catalog (`furnitureCatalog.ts`) and its sets stay light enough for the
 * realm relay to bundle.
 */

export type FurnitureKind = 'floor' | 'rug' | 'top' | 'wall' | 'wallpaper' | 'flooring'

export type FurniturePrice = { gems: number } | { coins: number }

/**
 * The carpentry's collections, Club Penguin catalog style: every piece
 * belongs to one, the carpentry filters by them and their names live in i18n
 * `furniture.sets`. `trophies` holds the earned pieces (the dolls).
 */
export const FURNITURE_SETS = ['classic', 'cozy', 'elegant', 'modern', 'pop', 'garden', 'aqua', 'arcade', 'kitchen', 'trainer', 'center', 'gallery', 'trophies'] as const

export type FurnitureSet = (typeof FURNITURE_SETS)[number]

export type FurnitureDef = {
  kind: FurnitureKind
  set: FurnitureSet
  size: readonly [w: number, h: number]
  rarity: Rarity
  price: FurniturePrice | null
  blocks?: true
  surface?: true
  turns?: true
  source?: 'trophy' | 'event'
  /** The day (`YYYY-MM-DD`, Brasília) it shows at the carpentry, for drops. */
  from?: string
  /** What it does in the Poké Realm when a trainer uses it (sit, light up, play music; `data/furnitureUse.ts`). */
  use?: FurnitureUse
}

