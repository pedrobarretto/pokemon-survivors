import type { FurnitureDef } from './furnitureDef'
import { SHOP_FURNITURE } from './furnitureSets/shop'
import { HOME_FURNITURE } from './furnitureSets/home'
import { POKEMON_FURNITURE } from './furnitureSets/pokemon'
import { GAME_FURNITURE } from './furnitureSets/games'

/**
 * Every piece the carpentry shows (all but the dolls; the mini games' trophies are earned, `GAME_FURNITURE`), named in i18n
 * `furniture.names`: the first catalog plus the collections that live in
 * their own modules (`data/furnitureSets/`), spread in like `MOVES`'s tables.
 * `data/furniture.ts` adds the dolls (`FURNITURE`). Its own module, free of
 * the legends the dolls need, because the realm relay bundles it to check a
 * piece's use (`FurnitureDef.use`, `data/furnitureUse.ts`): it and the sets
 * import only types and `furnitureUse.ts`.
 */
export const CATALOG = { ...SHOP_FURNITURE, ...HOME_FURNITURE, ...POKEMON_FURNITURE, ...GAME_FURNITURE } as const satisfies Record<string, FurnitureDef>

export type CatalogId = keyof typeof CATALOG

export const isCatalogId = (v: unknown): v is CatalogId => typeof v === 'string' && Object.hasOwn(CATALOG, v)
