import { STALL_IDS, STALLS, type StallGoodId, type StallId } from '../data/visitors'
import type { DayKey } from './day'
import { grantEgg, incubatorFull, type EggTier } from './eggs'
import { candiesLeft, spendCandies } from './halloween'
import type { Save } from './meta'

/**
 * Seasonal stalls (`STALLS` in `data/visitors.ts`): during an event's Brasília
 * days its stall stands on the plaza, and one with goods sells them from its
 * shelf in the shop (Duskull's Haunted Egg on the Noite das Bruxas, for ₽ or
 * for candies). No stock: a good sells while the incubator has room. ₽ go
 * into `spent`, like the Vitrine; candies into the jar's `spent`. Pure; shared with the API.
 */

/** The seasonal stall standing on the plaza on a Brasília `day` (`STALLS`), or null between events. */
export const stallOn = (day: DayKey): StallId | null => STALL_IDS.find((id) => day >= STALLS[id].from && day <= STALLS[id].to) ?? null

/** A good's terms, with the stall that sells it. */
type Good = { stall: StallId; egg: EggTier; price: number; pay: 'coins' | 'candies' }

const GOODS = Object.fromEntries(
  STALL_IDS.flatMap((stall) => Object.entries(STALLS[stall].goods).map(([key, good]) => [key, { stall, ...good }] as const)),
) as Record<StallGoodId, Good>

/** What a stall sells, in its order. */
export const stallGoods = (id: StallId) => (Object.keys(GOODS) as StallGoodId[]).filter((good) => GOODS[good].stall === id)

/** A good's terms: its stall, egg tier, price and what pays it. */
export const stallGood = (good: StallGoodId): Good => GOODS[good]

export type StallBlock = 'closed' | 'full' | 'poor'

/** What the save has to pay `good` with: ₽ in the wallet, or the candies left to spend. */
const funds = (save: Save, good: StallGoodId) => (GOODS[good].pay === 'candies' ? candiesLeft(save.halloween) : save.wallet)

/** Why `good` can't be bought on `day`, or null: its stall isn't up, the incubator is full or the save can't pay. */
export const stallBlock = (save: Save, good: StallGoodId, day: DayKey): StallBlock | null => {
  if (stallOn(day) !== GOODS[good].stall) return 'closed'
  if (incubatorFull(save)) return 'full'
  return funds(save, good) < GOODS[good].price ? 'poor' : null
}

/** Buys `good` on `day`: its egg goes into the incubator, paid in ₽ or candies. Null when blocked. */
export const buyFromStall = (save: Save, good: StallGoodId, day: DayKey): Save | null => {
  if (stallBlock(save, good, day)) return null
  const { price, egg, pay } = GOODS[good]
  const paid = pay === 'candies' ? spendCandies(save, price) : { ...save, wallet: save.wallet - price, spent: save.spent + price }
  return grantEgg(paid, egg).save
}
