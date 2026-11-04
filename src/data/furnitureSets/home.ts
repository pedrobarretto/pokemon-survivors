import type { FurnitureDef } from '../furniture'

/**
 * The home collections (`classic`, `cozy`, `elegant`, `modern`, `pop`,
 * `garden`, `aqua`, `arcade`, `kitchen`): tables, chairs, sofas, shelves,
 * plants, lamps, rugs, wallpapers and floorings in every material and color,
 * and the Club Penguin / Habbo classics. Spread into `FURNITURE`; each piece's
 * name in i18n `furniture.names`, its art `public/assets/furniture/<id>.png`.
 */
export const HOME_FURNITURE = {} as const satisfies Record<string, FurnitureDef>
