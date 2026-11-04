import { FURNITURE, FURNITURE_IDS, FURNITURE_SETS, type FurnitureId, type FurnitureSet } from '../data/furniture'
import { dayNumber, type DayKey } from '../game/day'
import { onSale } from './placement'

/**
 * Bibarel's catalog as pure rules (`ui/carpentry.ts`): the pages are the
 * collections (`FURNITURE_SETS`, Club Penguin catalog style), filtered by
 * where a piece goes (`shelfOf`) and by what it costs (₽ or gems); a piece
 * dated within `FRESH_DAYS` wears NOVO and leads its page.
 */

/** Where a piece goes, as the catalog's secondary filter: the room's styles (wallpaper, flooring) share one. */
export const SHELVES = ['floor', 'rug', 'top', 'wall', 'style'] as const
export type Shelf = (typeof SHELVES)[number]

export type ShelfFilter = 'all' | Shelf
export type PayFilter = 'all' | 'coins' | 'gems'

/** How many days from its `from` a piece is NOVO. */
export const FRESH_DAYS = 14

export const shelfOf = (id: FurnitureId): Shelf => {
  const kind = FURNITURE[id].kind
  return kind === 'wallpaper' || kind === 'flooring' ? 'style' : kind
}

/** What a piece is paid with, or null for one that's only earned. */
export const payOf = (id: FurnitureId): 'coins' | 'gems' | null => {
  const price = FURNITURE[id].price
  return price === null ? null : 'gems' in price ? 'gems' : 'coins'
}

/**
 * Whether a drop dated `from` is NOVO on `day`: on sale from a day less than
 * `FRESH_DAYS` ago. The launch catalog has no `from`, so it never is; only
 * pieces added after it wear the tag.
 */
export const freshOn = (from: DayKey | undefined, day: DayKey): boolean =>
  from !== undefined && from <= day && dayNumber(day) - dayNumber(from) < FRESH_DAYS

export const isFresh = (id: FurnitureId, day: DayKey): boolean => freshOn(FURNITURE[id].from, day)

/**
 * A collection's page on `day`: what it has on sale and what's earned in it
 * (the legends' paintings in the gallery); `trophies` gathers every earned
 * piece (the dolls and the paintings). NOVO pieces first, then as the data
 * lists them.
 */
export const pageOf = (set: FurnitureSet, day: DayKey): FurnitureId[] => {
  const sale = new Set(onSale(day))
  const earned = (id: FurnitureId) => FURNITURE[id].source === 'trophy'
  const ids = FURNITURE_IDS.filter((id) => (set === 'trophies' ? earned(id) : FURNITURE[id].set === set && (sale.has(id) || earned(id))))
  return [...ids.filter((id) => isFresh(id, day)), ...ids.filter((id) => !isFresh(id, day))]
}

/** The collections with anything on their page on `day`, in `FURNITURE_SETS` order. */
export const collectionsOn = (day: DayKey): FurnitureSet[] => FURNITURE_SETS.filter((set) => pageOf(set, day).length > 0)

/** A page's pieces through the filters (an earned piece has no price, so it only shows unfiltered by price). */
export const filterPage = (ids: readonly FurnitureId[], shelf: ShelfFilter, pay: PayFilter): FurnitureId[] =>
  ids.filter((id) => (shelf === 'all' || shelfOf(id) === shelf) && (pay === 'all' || payOf(id) === pay))
