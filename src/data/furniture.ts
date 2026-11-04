import { LEGEND_IDS, type LegendId } from './legends'
import type { Rarity } from './cosmetics'

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
 *
 * Gem-bought and trophy furniture is never tradable (`tradable`); the trade
 * window comes in a later wave and only moves what `tradable` allows.
 *
 * `kind` says where it goes: `floor` stands on the floor (it blocks walkers
 * when `blocks`), `rug` lies under everything and never blocks, `top` sits on
 * a `surface` (a table, a shelf), `wall` hangs on the back wall's rows,
 * `wallpaper` and `flooring` dress the whole room (one each, `BaseLayout`).
 * `size` is in tiles `[w, h]`; `turns` lets it rotate a quarter (w and h
 * swap). Names live in i18n (`furniture`), keyed by id; art in
 * `public/assets/furniture/<id>.png` (`render/furnitureArt.ts`), dolls drawn from
 * the legend's own sprite.
 */

export type FurnitureKind = 'floor' | 'rug' | 'top' | 'wall' | 'wallpaper' | 'flooring'

export type FurniturePrice = { gems: number } | { coins: number }

export type FurnitureDef = {
  kind: FurnitureKind
  size: readonly [w: number, h: number]
  rarity: Rarity
  price: FurniturePrice | null
  blocks?: true
  surface?: true
  turns?: true
  source?: 'trophy' | 'event'
  /** The day (`YYYY-MM-DD`, Brasília) it shows at the carpentry, for drops. */
  from?: string
}

/**
 * The catalog's first pieces (the art pass fills it to ~30, each with its
 * PNG): a cheap ₽ basic of every kind so a fresh base can be furnished
 * without gems, and gem pieces of every rarity.
 */
const SHOP = {
  woodChair: { kind: 'floor', size: [1, 1], rarity: 'common', price: { coins: 1500 }, blocks: true, turns: true },
  woodTable: { kind: 'floor', size: [2, 1], rarity: 'common', price: { coins: 3000 }, blocks: true, surface: true, turns: true },
  pokeBallRug: { kind: 'rug', size: [3, 3], rarity: 'common', price: { coins: 4000 } },
  pottedPlant: { kind: 'floor', size: [1, 1], rarity: 'common', price: { coins: 1200 }, blocks: true },
  candle: { kind: 'top', size: [1, 1], rarity: 'common', price: { coins: 600 } },
  regionMap: { kind: 'wall', size: [2, 1], rarity: 'common', price: { coins: 2500 } },
  plankFloor: { kind: 'flooring', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  leafWallpaper: { kind: 'wallpaper', size: [1, 1], rarity: 'common', price: { coins: 5000 } },
  pikachuBed: { kind: 'floor', size: [2, 3], rarity: 'rare', price: { gems: 250 }, blocks: true, turns: true },
  snorlaxBeanbag: { kind: 'floor', size: [2, 2], rarity: 'epic', price: { gems: 550 }, blocks: true },
  aquarium: { kind: 'floor', size: [3, 1], rarity: 'epic', price: { gems: 550 }, blocks: true, surface: true },
  starryWallpaper: { kind: 'wallpaper', size: [1, 1], rarity: 'rare', price: { gems: 250 } },
  goldTrophyCase: { kind: 'floor', size: [3, 1], rarity: 'legendary', price: { gems: 1200 }, blocks: true, surface: true },
} as const satisfies Record<string, FurnitureDef>

/** A captured legend's doll, earned only: `doll:<legend>` (drawn from its sprite on a pedestal). */
const DOLL: FurnitureDef = { kind: 'top', size: [1, 1], rarity: 'legendary', price: null, source: 'trophy' }
const DOLLS = {} as Record<`doll:${LegendId}`, FurnitureDef>
for (const id of LEGEND_IDS) DOLLS[`doll:${id}`] = DOLL

export const FURNITURE: Readonly<Record<keyof typeof SHOP | `doll:${LegendId}`, FurnitureDef>> = { ...SHOP, ...DOLLS }

export type FurnitureId = keyof typeof FURNITURE & string

export const FURNITURE_IDS = Object.keys(FURNITURE) as FurnitureId[]

export const isFurnitureId = (v: unknown): v is FurnitureId => typeof v === 'string' && Object.hasOwn(FURNITURE, v)

export const dollOf = (legend: LegendId): FurnitureId => `doll:${legend}`

/** Whether a piece can change hands in a trade: only what's neither bought with gems nor earned by the account itself. */
export const tradable = (id: FurnitureId): boolean => {
  const f = FURNITURE[id]
  return f.source !== 'trophy' && !(f.price !== null && 'gems' in f.price)
}

/** A piece's footprint in tiles, turned or not. */
export const footprint = (id: FurnitureId, turned: boolean): readonly [w: number, h: number] => {
  const [w, h] = FURNITURE[id].size
  return turned && FURNITURE[id].turns ? [h, w] : [w, h]
}

/** How many of each piece an account has (the API's word, `GET /realm/me`). */
export type FurnitureCounts = Readonly<Partial<Record<FurnitureId, number>>>
