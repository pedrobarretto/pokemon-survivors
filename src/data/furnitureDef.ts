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
  /** How it turns, when not its kind's way (`turnMode`): `quarter` for art seen from above (a bed), `still` for art a turn wouldn't change (symmetric, or with text). */
  turn?: 'quarter' | 'still'
  source?: 'trophy' | 'event'
  /** The day (`YYYY-MM-DD`, Brasília) it shows at the carpentry, for drops. */
  from?: string
  /** What it does in the Poké Realm when a trainer uses it (sit, light up, play music; `data/furnitureUse.ts`). */
  use?: FurnitureUse
}


/** What the editor's Girar does to a piece (`Placed.turned`): turns it a quarter, or mirrors it. */
export type TurnMode = 'quarter' | 'mirror'

/**
 * How a piece turns: `quarter` turns its footprint and art a quarter (art
 * seen from above: beds, rugs), `mirror` faces it the other way (art drawn in
 * 3/4 from the front, the most of it: the footprint stays), null when it
 * doesn't turn (a wallpaper, a flooring, art that looks the same turned or
 * carries text, `turn: 'still'`). Here, import-light, so the relay turns
 * seats as the client does (`seatsOf`).
 */
export const turnMode = (def: Pick<FurnitureDef, 'kind' | 'turn'>): TurnMode | null => {
  if (def.kind === 'wallpaper' || def.kind === 'flooring' || def.turn === 'still') return null
  return def.turn ?? (def.kind === 'rug' ? 'quarter' : 'mirror')
}

/** How a placed piece stands: its `turnMode` when it's turned, else null. */
export const placedTurn = (def: Pick<FurnitureDef, 'kind' | 'turn'>, turned: boolean): TurnMode | null => (turned ? turnMode(def) : null)
