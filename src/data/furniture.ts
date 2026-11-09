import { LEGEND_IDS, type LegendId } from './legends'
import { PLUSH_POOL, isExclusivePlush, plushPiece, type PlushPiece } from './plushes'
import { CATALOG } from './furnitureCatalog'
import { placedTurn, turnMode, type FurnitureDef, type TurnMode } from './furnitureDef'
import { turnedSize } from './furnitureUse'

/**
 * Furniture for secret bases (`data/secretBases.ts`), placed on the base's
 * grid (`BASE_GRID`). Like the cosmetics, it's looks only and never reaches
 * `src/game`. An account owns a count of each (`GET /realm/me`), from:
 *
 * - `price`: bought at Bibarel's carpentry on the plaza (`ui/carpentry.ts`),
 *   with gems (the gem shop's ledger, `POST /realm/furniture/buy`) or ₽
 *   (out of the stored save, like the Festival's donations: a ₽ sink). `null`
 *   is never sold.
 * - `source: 'trophy'`: earned by play, counted from the save by the API on
 *   its own (`trophyFurniture`): a legend's doll once it's captured, and so on.
 *   Never sold: a Pokémon is never for sale.
 * - `source: 'event'`: an event's reward (a gift), dated by `from`.
 * - `source: 'claw'`: a plush won at the arcade's Máquina de Pelúcias
 *   (`data/plushes.ts`, granted by the API into `furniture_owned`). Never sold.
 *
 * Gem-bought, trophy and claw furniture is never tradable (`tradable`); the trade
 * window comes in a later wave and only moves what `tradable` allows.
 *
 * `kind` says where it goes: `floor` stands on the floor (it blocks walkers
 * when `blocks`), `rug` lies under everything and never blocks, `top` sits on
 * a `surface` (a table, a shelf), `wall` hangs on the back wall's rows,
 * `wallpaper` and `flooring` dress the whole room (one each, `BaseLayout`).
 * `size` is in tiles `[w, h]`; how it turns is `turnOf`. Names live in i18n
 * (`furniture`), keyed by id; art in `public/assets/furniture/<id>.png`
 * (`render/furnitureArt.ts`), dolls drawn from the legend's own sprite. `use`
 * is what it does in the Poké Realm (sit on it, switch it on, play music on
 * it: `data/furnitureUse.ts`).
 */

export { FURNITURE_SETS, type FurnitureDef, type FurnitureKind, type FurniturePrice, type FurnitureSet, type TurnMode } from './furnitureDef'

/** Every piece the carpentry shows, its own module so the relay can bundle it (`data/furnitureCatalog.ts`). */
export type ShopFurnitureId = keyof typeof CATALOG

/** A captured legend's doll, earned only: `doll:<legend>` (drawn from its sprite on a pedestal). */
const DOLL: FurnitureDef = { kind: 'top', set: 'trophies', size: [1, 1], rarity: 'legendary', price: null, source: 'trophy' }
const DOLLS = {} as Record<`doll:${LegendId}`, FurnitureDef>
for (const id of LEGEND_IDS) DOLLS[`doll:${id}`] = DOLL

/** A plush won at the claw machine, one piece per family (drawn from the family's sprite, `render/plush.ts`). */
const PLUSHES = Object.fromEntries(
  PLUSH_POOL.map((family): [PlushPiece, FurnitureDef] => [plushPiece(family), { kind: 'floor', set: 'trophies', size: [1, 1], rarity: isExclusivePlush(family) ? 'epic' : 'common', price: null, blocks: true, source: 'claw' }]),
) as Record<PlushPiece, FurnitureDef>

export const FURNITURE: Readonly<Record<ShopFurnitureId | `doll:${LegendId}` | PlushPiece, FurnitureDef>> = { ...CATALOG, ...DOLLS, ...PLUSHES }

export type FurnitureId = keyof typeof FURNITURE & string

export const FURNITURE_IDS = Object.keys(FURNITURE) as FurnitureId[]

export const isFurnitureId = (v: unknown): v is FurnitureId => typeof v === 'string' && Object.hasOwn(FURNITURE, v)

export const dollOf = (legend: LegendId): FurnitureId => `doll:${legend}`

/** Whether a piece can change hands in a trade: only what's neither bought with gems nor earned by the account itself (a trophy, a plush). */
export const tradable = (id: FurnitureId): boolean => {
  const f = FURNITURE[id]
  return f.source !== 'trophy' && f.source !== 'claw' && !(f.price !== null && 'gems' in f.price)
}

/** How a piece turns (the editor's Girar, `Placed.turned`): a quarter, mirrored, or not at all (`turnMode`). */
export const turnOf = (id: FurnitureId): TurnMode | null => turnMode(FURNITURE[id])

/** A piece's footprint in tiles, turned or not (only a quarter turn swaps w and h). */
export const footprint = (id: FurnitureId, turned: boolean): readonly [w: number, h: number] => turnedSize(FURNITURE[id].size, placedTurn(FURNITURE[id], turned))

/** How many of each piece an account has (the API's word, `GET /realm/me`). */
export type FurnitureCounts = Readonly<Partial<Record<FurnitureId, number>>>
