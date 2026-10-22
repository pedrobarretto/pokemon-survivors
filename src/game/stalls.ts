import { STALL_IDS, STALLS, type StallGoodId, type StallId } from '../data/visitors'
import { isDayKey, type DayKey } from './day'
import { grantEgg, incubatorFull, type EggTier } from './eggs'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'

/**
 * Seasonal stalls (`STALLS` in `data/visitors.ts`): during an event's Brasília
 * days its stall stands on the plaza, and one with goods sells them from its
 * shelf in the shop (Duskull's Haunted Egg on the Noite das Bruxas). Each good
 * has a daily stock per save; outside its stall's days it isn't sold at all.
 * Buying spends ₽ into `spent`, like the Vitrine. Pure; shared with the API.
 */

/** The seasonal stall standing on the plaza on a Brasília `day` (`STALLS`), or null between events. */
export const stallOn = (day: DayKey): StallId | null => STALL_IDS.find((id) => day >= STALLS[id].from && day <= STALLS[id].to) ?? null

/** A good's terms, with the stall that sells it. */
type Good = { stall: StallId; egg: EggTier; price: number; perDay: number }

const GOODS = Object.fromEntries(
  STALL_IDS.flatMap((stall) => Object.entries(STALLS[stall].goods).map(([key, good]) => [key, { stall, ...good }] as const)),
) as Record<StallGoodId, Good>

/** What a stall sells, in its order. */
export const stallGoods = (id: StallId) => (Object.keys(GOODS) as StallGoodId[]).filter((good) => GOODS[good].stall === id)

/** A good's terms: its stall, egg tier, price and daily stock. */
export const stallGood = (good: StallGoodId): Good => GOODS[good]

/** The save's side of the stalls: the Brasília day it last bought on, and how many of each good it bought then. */
export type StallSave = { day: DayKey; bought: Readonly<Partial<Record<StallGoodId, number>>> }

export const NO_STALL: StallSave = { day: '', bought: {} }

/** The save's purchases as of `day`: another day starts the stock over. */
const onDay = (s: StallSave, day: DayKey): StallSave => (s.day === day ? s : { day, bought: {} })

/** How many of `good` this save may still buy on `day`. */
export const stallStockLeft = (save: Save, good: StallGoodId, day: DayKey) => Math.max(0, GOODS[good].perDay - (onDay(save.stall, day).bought[good] ?? 0))

export type StallBlock = 'closed' | 'soldOut' | 'full' | 'poor'

/** Why `good` can't be bought on `day`, or null: its stall isn't up, today's stock is gone, the incubator is full or not enough ₽. */
export const stallBlock = (save: Save, good: StallGoodId, day: DayKey): StallBlock | null => {
  if (stallOn(day) !== GOODS[good].stall) return 'closed'
  if (stallStockLeft(save, good, day) <= 0) return 'soldOut'
  if (incubatorFull(save)) return 'full'
  return save.wallet < GOODS[good].price ? 'poor' : null
}

/** Buys `good` on `day`: its egg goes into the incubator and the day's count goes up. Null when blocked. */
export const buyFromStall = (save: Save, good: StallGoodId, day: DayKey): Save | null => {
  if (stallBlock(save, good, day)) return null
  const { price, egg } = GOODS[good]
  const s = onDay(save.stall, day)
  return grantEgg({ ...save, wallet: save.wallet - price, spent: save.spent + price, stall: { day, bought: { ...s.bought, [good]: (s.bought[good] ?? 0) + 1 } } }, egg).save
}

/* ---------------- Sync and parsing ---------------- */

/** Two sides' purchases: the later day's; on the same day, the most of each good either side bought (a day's stock is never sold twice). */
export const mergeStall = (base: StallSave, incoming: StallSave): StallSave => {
  if (base.day !== incoming.day) return base.day > incoming.day ? base : incoming
  const goods = Object.keys(GOODS) as StallGoodId[]
  return { day: base.day, bought: Object.fromEntries(goods.flatMap((g) => { const n = Math.max(base.bought[g] ?? 0, incoming.bought[g] ?? 0); return n > 0 ? [[g, n]] : [] })) }
}

/** The save's `stall`: a day key, known goods counted up to their daily stock. */
export const parseStall = (raw: unknown): StallSave => {
  if (!isRecord(raw) || !isDayKey(raw.day)) return NO_STALL
  const bought = isRecord(raw.bought) ? raw.bought : {}
  const goods = Object.keys(GOODS) as StallGoodId[]
  return { day: raw.day, bought: Object.fromEntries(goods.flatMap((g) => { const n = wholeNumber(bought[g], GOODS[g].perDay); return n > 0 ? [[g, n]] : [] })) }
}
