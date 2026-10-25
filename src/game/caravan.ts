import { createRng, seedFrom } from '../engine/rng'
import { CARAVAN } from '../data/visitors'
import type { PlayableId } from '../data/hatchlings'
import { canPlay } from './capture'
import { dayNumber, type DayKey } from './day'
import { grantEgg, incubatorFull } from './eggs'
import { capLevel, grantCaps } from './evoItems'
import { MAX_CAPS } from '../data/shop'
import type { Save } from './meta'
import { isRecord } from './parse'
import { shopTmMoveIds, type ShopTmMoveId } from './shopTmMoves'
import { grantStyle, ownsStyle } from './style'
import { ownTm, tmPrice } from './tmShelf'
import * as dm from '../engine/dmath'

/**
 * Meowth's weekend caravan (`CARAVAN` in `data/visitors.ts`): on Friday,
 * Saturday and Sunday in Brasília it parks at the plaza of a shop at the
 * Kecleon Mart (Lv 4) or up. Its stock is the same for everyone, drawn from
 * the ISO week (`caravanStock`): the ultra egg, the Gold Bottle Cap, Meowth's
 * frame and some of the shop-exclusive TMs, one of each per weekend per save.
 * Haggling with enough loyalty stamps takes 20% off the whole weekend; it's
 * never random. Buying spends ₽ into `spent`, like the Vitrine. Pure.
 */

/** What the caravan sells: the egg, the Gold Bottle Cap, Meowth's frame or an exclusive TM. */
export type CaravanKey = 'egg' | 'goldCap' | 'frame' | ShopTmMoveId

/** The save's side of the caravan: the weekend (ISO week) it last traded on, what it bought then, and whether Meowth gave in to haggling. */
export type CaravanSave = { week: string; bought: readonly CaravanKey[]; haggled: boolean }

export const NO_CARAVAN: CaravanSave = { week: '', bought: [], haggled: false }

/**
 * The Mystery Gift id that vouches for Meowth's frame: the frame is never on
 * the style shelf, so the API keeps it only for a save that bought it here
 * (`game/gameGifts.ts`, `keepGiven`).
 */
export const CARAVAN_FRAME_ID = 'caravan:frame'

/** A Brasília day's weekday (0 Sunday … 6 Saturday). */
const weekday = (day: DayKey) => (((dayNumber(day) + 4) % 7) + 7) % 7

/** Whether the caravan parks on `day` (Friday to Sunday). */
export const isCaravanDay = (day: DayKey) => CARAVAN.days.some((d) => d === weekday(day))

/** The ISO week holding `day`, as `YYYY-Www` (Monday to Sunday, so a Friday, Saturday and Sunday share it). */
export const isoWeek = (day: DayKey) => {
  const n = dayNumber(day)
  // The week's Thursday decides its year.
  const thursday = n - ((weekday(day) + 6) % 7) + 3
  const year = new Date(thursday * 86_400_000).getUTCFullYear()
  const jan1 = dm.round(Date.UTC(year, 0, 1) / 86_400_000)
  return `${year}-W${String(Math.floor((thursday - jan1) / 7) + 1).padStart(2, '0')}`
}

/** The caravan's stock on the weekend of ISO week `week`: the egg, the Gold Bottle Cap, the frame, then `CARAVAN.tms` exclusive TMs drawn from the week. */
export const caravanStock = (week: string): CaravanKey[] => {
  const rng = createRng(seedFrom(`caravan:${week}`))
  const tms = [...shopTmMoveIds()]
  for (let i = tms.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[tms[i], tms[j]] = [tms[j]!, tms[i]!]
  }
  return ['egg', 'goldCap', 'frame', ...tms.slice(0, CARAVAN.tms)]
}

/** Whether the caravan is at this save's plaza on `day`: a weekend day and a shop at `CARAVAN.minLevel` or up. */
export const caravanHere = (save: Save, day: DayKey) => save.shop.level >= CARAVAN.minLevel && isCaravanDay(day)

/** The save's caravan as of `day`'s weekend: another weekend starts it over. */
const onWeek = (c: CaravanSave, day: DayKey): CaravanSave => (c.week === isoWeek(day) ? c : { week: isoWeek(day), bought: [], haggled: false })

/** Whether Meowth knocked his prices down for this save on `day`'s weekend. */
export const haggled = (save: Save, day: DayKey) => onWeek(save.caravan, day).haggled

/** What a key costs on the shelf (before haggling). */
export const listPrice = (key: CaravanKey) =>
  key === 'egg' ? CARAVAN.egg.price : key === 'goldCap' ? CARAVAN.goldCap.price : key === 'frame' ? CARAVAN.frame.price : tmPrice(key)

/** What a key costs this save on `day`: haggling takes `CARAVAN.haggle.off` off, rounded to ₽10. */
export const caravanPrice = (save: Save, key: CaravanKey, day: DayKey) =>
  dm.round((listPrice(key) * (haggled(save, day) ? 1 - CARAVAN.haggle.off : 1)) / 10) * 10

/** Whether a Pokémon can take the Gold Bottle Cap: one the save plays, below the top level. */
export const goldCapFits = (save: Save, id: PlayableId) => canPlay(save, id) && capLevel(save.caps, id) < MAX_CAPS

export type CaravanBlock = 'closed' | 'soldOut' | 'owned' | 'full' | 'poor'

/**
 * Why a key can't be bought on `day`, or null: the caravan isn't here (or
 * doesn't bring it this weekend), it was bought this weekend, the frame or
 * TM is owned already, an egg for a full incubator, or not enough ₽.
 */
export const caravanBlock = (save: Save, key: CaravanKey, day: DayKey): CaravanBlock | null => {
  if (!caravanHere(save, day) || !caravanStock(isoWeek(day)).includes(key)) return 'closed'
  if (onWeek(save.caravan, day).bought.includes(key)) return 'soldOut'
  if (key === 'frame' && ownsStyle(save.style, 'frame', CARAVAN.frame.id)) return 'owned'
  if (key !== 'egg' && key !== 'goldCap' && key !== 'frame' && save.tms.owned.includes(key)) return 'owned'
  if (key === 'egg' && incubatorFull(save)) return 'full'
  return save.wallet < caravanPrice(save, key, day) ? 'poor' : null
}

/**
 * Buys `key` from the caravan on `day`: the egg into the incubator, Meowth's
 * frame into the wardrobe (with the id that vouches for it), a TM into the
 * case, and the Gold Bottle Cap onto `target` (one the save plays, below the
 * top level; required). Null when blocked.
 */
export const buyFromCaravan = (save: Save, key: CaravanKey, day: DayKey, target?: PlayableId): Save | null => {
  if (caravanBlock(save, key, day)) return null
  if (key === 'goldCap' && (!target || !goldCapFits(save, target))) return null
  const price = caravanPrice(save, key, day)
  const c = onWeek(save.caravan, day)
  const paid: Save = { ...save, wallet: save.wallet - price, spent: save.spent + price, caravan: { ...c, bought: [...c.bought, key] } }
  if (key === 'egg') return grantEgg(paid, CARAVAN.egg.tier).save
  if (key === 'goldCap') return { ...paid, caps: grantCaps(paid.caps, target!, MAX_CAPS) }
  if (key === 'frame') return { ...paid, style: grantStyle(paid.style, 'frame', CARAVAN.frame.id), gifts: paid.gifts.includes(CARAVAN_FRAME_ID) ? paid.gifts : [...paid.gifts, CARAVAN_FRAME_ID] }
  return { ...paid, tms: ownTm(paid.tms, key, paid.shop.level) }
}

/**
 * Haggling on `day`: with `CARAVAN.haggle.stamps` loyalty stamps or more,
 * Meowth gives in for the whole weekend (`ok`); without, the save is as it was.
 */
export const haggle = (save: Save, day: DayKey): { save: Save; ok: boolean } => {
  if (save.shop.stamps < CARAVAN.haggle.stamps) return { save, ok: false }
  return { save: { ...save, caravan: { ...onWeek(save.caravan, day), haggled: true } }, ok: true }
}

/* ---------------- Sync and parsing ---------------- */

const isCaravanKey = (v: unknown): v is CaravanKey => v === 'egg' || v === 'goldCap' || v === 'frame' || shopTmMoveIds().some((id) => id === v)

/** Two sides' caravans: the later weekend's; on the same one, what either bought (a union) and haggled on either. */
export const mergeCaravan = (base: CaravanSave, incoming: CaravanSave): CaravanSave => {
  if (base.week !== incoming.week) return base.week > incoming.week ? base : incoming
  return { week: base.week, bought: [...new Set([...base.bought, ...incoming.bought])], haggled: base.haggled || incoming.haggled }
}

/** The save's `caravan`: a week key, known keys each once. */
export const parseCaravan = (raw: unknown): CaravanSave => {
  if (!isRecord(raw) || typeof raw.week !== 'string' || !/^\d{4}-W\d{2}$/.test(raw.week)) return NO_CARAVAN
  const bought = Array.isArray(raw.bought) ? [...new Set(raw.bought.filter(isCaravanKey))] : []
  return { week: raw.week, bought, haggled: raw.haggled === true }
}
