import { HATCHLING_IDS, HATCHLINGS, type HatchlingId } from '../data/hatchlings'
import { REGION_IDS, type RegionId } from '../data/regionalForms'
import { VITRINE } from '../data/shop'
import { addDays, dayNumber, type DayKey } from './day'
import { grantEgg, incubatorFull, type Hatched } from './eggs'
import type { Save } from './meta'
import { boughtToday, onDay, type Vitrine } from './shop'

/**
 * A Viagem: every Brasília week (Monday to Sunday) the game travels to one
 * region, in turn (`REGION_IDS`: Alola, Galar, Hisui, Paldea), the same for
 * everyone and with no schedule to run. The week's region is what the
 * Vitrine's Ovo de Viagem card sells (its families hatch from no other egg,
 * `data/regionalFamilies.ts`) and whose families join the Zona Safári's tall
 * grass (`habitatPool`). Pure.
 */
export const TRAVEL = {
  /** The Monday the first trip (Alola) starts; the turn counts from it, back and forth. */
  epoch: '2026-11-16',
} as const

/** The region a Brasília day's week travels to. */
export const regionOfWeek = (day: DayKey): RegionId => {
  const weeks = Math.floor((dayNumber(day) - dayNumber(TRAVEL.epoch)) / 7)
  return REGION_IDS[((weeks % REGION_IDS.length) + REGION_IDS.length) % REGION_IDS.length]!
}

/** The Monday the trip after `day`'s starts, and where it goes. */
export const nextTrip = (day: DayKey): { day: DayKey; region: RegionId } => {
  const offset = (((dayNumber(day) - dayNumber(TRAVEL.epoch)) % 7) + 7) % 7
  const monday = addDays(day, 7 - offset)
  return { day: monday, region: regionOfWeek(monday) }
}

/** A region's families, in data order: the ones its Ovo de Viagem hatches. */
export const regionFamilies = (region: RegionId): HatchlingId[] => HATCHLING_IDS.filter((id) => HATCHLINGS[id].egg === region)

/** How many of a region's families a save has hatched, out of all of them. */
export const regionProgress = (region: RegionId, hatched: Hatched) => {
  const all = regionFamilies(region)
  return { got: all.filter((id) => hatched[id] !== undefined).length, of: all.length }
}

/* ---------------- The Vitrine's Ovo de Viagem card ---------------- */

export type TravelEggBlock = 'soldOut' | 'full' | 'poor'

/** Why the day's Ovo de Viagem can't be bought: today's is taken, the incubator is full (it would land as its refund) or not enough ₽. */
export const travelEggBlock = (save: Save, v: Vitrine): TravelEggBlock | null => {
  if (boughtToday(save.shop, v, 'travelEgg') >= VITRINE.travelEgg.stock) return 'soldOut'
  if (incubatorFull(save)) return 'full'
  return save.wallet < VITRINE.travelEgg.price ? 'poor' : null
}

/** Buys the day's Ovo de Viagem, of the week's region (or `region`), into the incubator (₽ into `spent`). Null when blocked (`travelEggBlock`). */
export const buyTravelEgg = (save: Save, v: Vitrine, region: RegionId = regionOfWeek(v.day)): Save | null => {
  if (travelEggBlock(save, v)) return null
  const shop = onDay(save.shop, v.day)
  const price = VITRINE.travelEgg.price
  const bought = shop.bought.travelEgg ?? 0
  return grantEgg({ ...save, wallet: save.wallet - price, spent: save.spent + price, shop: { ...shop, bought: { ...shop.bought, travelEgg: bought + 1 } } }, region).save
}
