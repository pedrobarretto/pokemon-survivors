import { createRng, seedFrom, weightedPick, type Rng } from '../engine/rng'
import { BAG_ITEM_IDS, BAG_ITEMS, bagItemLevel, MAX_SHOP_LEVEL, SHOP_BOUGHT_KEYS, SHOP_LEVEL_IDS, SHOP_LEVELS, VITRINE, VITRINE_POOL, type BagItem, type ShopBoughtKey, type ShopLevel, type VitrineEgg, type VitrineKey } from '../data/shop'
import { styleIds, stylePrice, type StyleId, type StyleSlot } from '../data/style'
import { addToBag } from './bag'
import { addDays, dayNumber, isDayKey, type DayKey } from './day'
import { grantEgg, incubatorFull } from './eggs'
import type { Save } from './meta'
import { isRecord, wholeNumber } from './parse'
import { grantStyle, ownsStyle, type StyleSave } from './style'

/**
 * The Kecleon Shop's rules (its catalog is `data/shop.ts`). The Vitrine do
 * dia turns over at midnight in Brasília and is the same for everyone: a free
 * gift (one consumable, once per day per save), the Kecleon Egg's fixed card
 * (several a day, each double the last), a deal at 30% off and the day's
 * cards, drawn from the pool of consumables, the day's egg and the day's style. A higher shop level sees more cards of
 * the same Vitrine. Each card has a daily stock per save. Buying spends ₽ into the save's `spent`;
 * investing in the shop's next level spends into the level itself, which the
 * sync counts like the upgrades' ranks (`game/sync.ts`) and nothing refunds.
 * The style shelf sells looks for good. Pure.
 */

/* ---------------- The Vitrine do dia ---------------- */

/** A style the Vitrine can offer: one with a price on the style shelf. */
export type StylePick = { [S in StyleSlot]: { slot: S; id: StyleId<S> } }[StyleSlot]

/** Calls `f` with a pick's slot and id typed together. */
export const onPick = <R>(p: StylePick, f: <S extends StyleSlot>(slot: S, id: StyleId<S>) => R): R => {
  switch (p.slot) {
    case 'frame':
      return f(p.slot, p.id)
    case 'background':
      return f(p.slot, p.id)
    case 'wallpaper':
      return f(p.slot, p.id)
  }
}

const soldOf = <S extends StyleSlot>(slot: S) => styleIds(slot).flatMap((id) => ((stylePrice(slot, id) ?? 0) > 0 ? [{ slot, id }] : []))

/** Every style sold, in shelf order. */
const SOLD_STYLES: readonly StylePick[] = [...soldOf('frame'), ...soldOf('background'), ...soldOf('wallpaper')]

/** What the Vitrine shows on a day. */
export type Vitrine = {
  day: DayKey
  /** The free gift. */
  gift: BagItem
  /** The tier of the day's egg (`VITRINE.eggs`). */
  egg: VitrineEgg
  /** The day's cards, the deal first: `VITRINE.core` that every level sees, then the ones higher levels see (`vitrineCards`). */
  cards: readonly VitrineKey[]
  /** The day's styles in order: the style card offers the first one a save doesn't own (`dayStyle`). */
  styles: readonly StylePick[]
}

/** The most cards any level sees: the deal and the top level's slots. */
const MAX_CARDS = 1 + SHOP_LEVELS[MAX_SHOP_LEVEL].vitrineSlots

const shuffled = <T>(rng: Rng, items: readonly T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j]!, out[i]!]
  }
  return out
}

/**
 * The `VITRINE.core` cards of day number `n`: those shown longest ago come
 * first, each nudged by up to `VITRINE.jitter` days of the day's seed so the
 * same cards don't keep coming back together.
 */
const dealCore = (n: number, last: ReadonlyMap<VitrineKey, number>): VitrineKey[] => {
  const rng = createRng(seedFrom(`vitrine:${n}`))
  return VITRINE_POOL.map((key) => ({ key, age: n - (last.get(key) ?? 0) + rng() * VITRINE.jitter }))
    .sort((a, b) => b.age - a.age)
    .slice(0, VITRINE.core)
    .map((c) => c.key)
}

const EPOCH = dayNumber(VITRINE.epoch)

/** The rotation dealt so far from `VITRINE.epoch`: each day's core cards and when each card was last dealt. */
const rotation = { through: EPOCH - 1, last: new Map<VitrineKey, number>(), cores: new Map<number, readonly VitrineKey[]>() }

/**
 * The core cards of day number `n`. The rotation walks from the epoch,
 * dealing the cards shown longest ago (`dealCore`), so every card is back
 * within 7 days at any level (`shop.test.ts`). Memoized: it's the same for
 * every save. A day before the epoch deals without history.
 */
const coreOf = (n: number): readonly VitrineKey[] => {
  if (n < EPOCH) return dealCore(n, new Map())
  while (rotation.through < n) {
    const day = ++rotation.through
    const core = dealCore(day, rotation.last)
    for (const key of core) rotation.last.set(key, day)
    rotation.cores.set(day, core)
  }
  return rotation.cores.get(n)!
}

/** The Vitrine of a Brasília day, drawn from the date alone. */
export const vitrineOf = (day: DayKey): Vitrine => {
  const core = coreOf(dayNumber(day))
  const rng = createRng(seedFrom(`vitrine-day:${day}`))
  const dealAt = Math.floor(rng() * core.length)
  const extras = shuffled(
    rng,
    VITRINE_POOL.filter((key) => !core.includes(key)),
  )
  const deal = core[dealAt]!
  return {
    day,
    // Never the deal's item: a free one and the same at 30% off on one day would waste a slot.
    gift: weightedPick(rng, BAG_ITEM_IDS.flatMap((id) => (id !== deal && BAG_ITEMS[id].gift > 0 ? [[id, BAG_ITEMS[id].gift] as const] : []))),
    egg: weightedPick(rng, (Object.keys(VITRINE.eggs) as VitrineEgg[]).map((tier) => [tier, VITRINE.eggs[tier].weight] as const)),
    cards: [deal, ...core.filter((_, i) => i !== dealAt), ...extras].slice(0, MAX_CARDS),
    styles: shuffled(rng, SOLD_STYLES),
  }
}

/** The cards a shop of `level` shows: the deal and its level's slots. */
export const vitrineCards = (v: Vitrine, level: ShopLevel) => v.cards.slice(0, 1 + SHOP_LEVELS[level].vitrineSlots)

/** Whether `key` is the day's deal. */
export const isDeal = (v: Vitrine, key: VitrineKey) => v.cards[0] === key

/** The style the day's style card offers a save: the day's first one it doesn't own, null when it owns them all. */
export const dayStyle = (v: Vitrine, style: StyleSave): StylePick | null => v.styles.find((p) => !onPick(p, (slot, id) => ownsStyle(style, slot, id))) ?? null

/**
 * The first day from `from` on (that day included) whose Vitrine shows `key`
 * to a shop of `level`, for the wishlist; null if not within `horizon` days.
 */
export const nextAppearance = (key: VitrineKey, from: DayKey, level: ShopLevel = 1, horizon = 14): DayKey | null => {
  for (let i = 0; i <= horizon; i++) {
    const day = addDays(from, i)
    if (vitrineCards(vitrineOf(day), level).includes(key)) return day
  }
  return null
}

/** Whether a shop of `level` sells `key` at all (the Everstone waits for the Shop, `bagItemLevel`). */
export const sellsAt = (key: VitrineKey, level: ShopLevel) => key === 'egg' || key === 'style' || bagItemLevel(key) <= level

/** How many of a card one save may buy on a day (the Kecleon Egg's fixed card too). */
export const vitrineStock = (key: ShopBoughtKey) =>
  key === 'egg' ? VITRINE.eggStock : key === 'style' ? VITRINE.styleStock : key === 'kecleonEgg' ? VITRINE.kecleonEgg.prices.length : BAG_ITEMS[key].stock

/** A card's price today for a save (its style card offers its own style), rounded to ₽10 after the deal; null for a style card with nothing left to offer. */
export const vitrinePrice = (v: Vitrine, key: VitrineKey, style: StyleSave): number | null => {
  const pick = key === 'style' ? dayStyle(v, style) : null
  const full = key === 'egg' ? VITRINE.eggs[v.egg].price : key === 'style' ? pick && onPick(pick, stylePrice) : BAG_ITEMS[key].price
  if (full === null) return null
  return Math.round((full * (isDeal(v, key) ? 1 - VITRINE.deal : 1)) / 10) * 10
}

/* ---------------- The save's shop ---------------- */

/**
 * The save's side of the shop: its level, what it bought and whether it took
 * the gift on `day` (an older day's counts start over), the card pinned on
 * the wishlist, its visits (the last Brasília day it came by and how many
 * days in a row), for what Kecleon says (`ui/kecleon.ts`), and the loyalty
 * card's stamps: one per Brasília day with a visit, for good (`game/loyalty.ts`).
 */
export type ShopSave = {
  level: ShopLevel
  day: DayKey
  bought: Readonly<Partial<Record<ShopBoughtKey, number>>>
  gift: boolean
  wishlist: VitrineKey | null
  visit: ShopVisit
  stamps: number
}

/** The last day the player came to the shop ('' never) and the days in a row up to it. */
export type ShopVisit = { day: DayKey; streak: number }

const NO_VISIT: ShopVisit = { day: '', streak: 0 }

export const NO_SHOP: ShopSave = { level: 1, day: '', bought: {}, gift: false, wishlist: null, visit: NO_VISIT, stamps: 0 }

/**
 * The player comes to the shop on `day`: the streak grows if the last visit
 * was the day before, starts over after a gap, and stays on the same day; a
 * new day stamps the loyalty card (a gap never takes stamps away).
 */
export const recordVisit = (shop: ShopSave, day: DayKey): ShopSave => {
  const { visit } = shop
  if (visit.day === day) return shop
  return { ...shop, visit: { day, streak: visit.day !== '' && addDays(visit.day, 1) === day ? visit.streak + 1 : 1 }, stamps: shop.stamps + 1 }
}

/** The shop as of `day`: a new day restocks and brings a new gift. */
const onDay = (shop: ShopSave, day: DayKey): ShopSave => (shop.day === day ? shop : { ...shop, day, bought: {}, gift: false })

/** How many of `key` a save bought on the Vitrine's day. */
export const boughtToday = (shop: ShopSave, v: Vitrine, key: ShopBoughtKey) => onDay(shop, v.day).bought[key] ?? 0

/** How many of `key` a save can still buy on the Vitrine's day. */
export const stockLeft = (shop: ShopSave, v: Vitrine, key: ShopBoughtKey) => Math.max(0, vitrineStock(key) - boughtToday(shop, v, key))

export type VitrineBlock = 'locked' | 'soldOut' | 'owned' | 'full' | 'poor'

/**
 * Why a card can't be bought now, or null when it can: not shown (or not
 * sold) at the save's level, sold out today, a style card with nothing left to offer, an
 * egg for a full incubator, or not enough ₽.
 */
export const vitrineBlock = (save: Save, v: Vitrine, key: VitrineKey): VitrineBlock | null => {
  if (!vitrineCards(v, save.shop.level).includes(key) || !sellsAt(key, save.shop.level)) return 'locked'
  if (stockLeft(save.shop, v, key) === 0) return 'soldOut'
  const price = vitrinePrice(v, key, save.style)
  if (price === null) return 'owned'
  if (key === 'egg' && incubatorFull(save)) return 'full'
  return save.wallet < price ? 'poor' : null
}

/** Buys one card from the day's Vitrine: an item goes into the bag, the egg into the incubator, the style into the wardrobe. Null when blocked (`vitrineBlock`). */
export const buyFromVitrine = (save: Save, v: Vitrine, key: VitrineKey): Save | null => {
  if (vitrineBlock(save, v, key)) return null
  const price = vitrinePrice(v, key, save.style)!
  const shop = onDay(save.shop, v.day)
  const paid: Save = { ...save, wallet: save.wallet - price, spent: save.spent + price, shop: { ...shop, bought: { ...shop.bought, [key]: (shop.bought[key] ?? 0) + 1 } } }
  if (key === 'egg') return grantEgg(paid, v.egg).save
  if (key === 'style') return { ...paid, style: onPick(dayStyle(v, save.style)!, (slot, id) => grantStyle(paid.style, slot, id)) }
  return { ...paid, bag: addToBag(paid.bag, key) }
}

/* ---------------- The Kecleon Egg (the Vitrine's fixed card) ---------------- */

export type KecleonEggBlock = 'soldOut' | 'full' | 'poor'

/**
 * What the next Kecleon Egg costs after `bought` of them on the same day
 * (`VITRINE.kecleonEgg.prices`: ₽10k, then each double the last); null once
 * the day's are sold. The deal never touches it: it's no card of the rotation,
 * and 30% off the top of the ladder would undo the point of it.
 */
export const kecleonEggPrice = (bought: number): number | null => VITRINE.kecleonEgg.prices[bought] ?? null

/**
 * Why the next Kecleon Egg can't be bought on the Vitrine's day: today's are
 * sold, the incubator has no free slot (the egg would land as its ₽2.5k refund,
 * a scam at ₽80k) or not enough ₽.
 */
export const kecleonEggBlock = (save: Save, v: Vitrine): KecleonEggBlock | null => {
  const price = kecleonEggPrice(boughtToday(save.shop, v, 'kecleonEgg'))
  if (price === null) return 'soldOut'
  if (incubatorFull(save)) return 'full'
  return save.wallet < price ? 'poor' : null
}

/** Buys the day's next Kecleon Egg into the incubator at its rung of the ladder (₽ into `spent`). Null when blocked (`kecleonEggBlock`). */
export const buyKecleonEgg = (save: Save, v: Vitrine): Save | null => {
  if (kecleonEggBlock(save, v)) return null
  const shop = onDay(save.shop, v.day)
  const bought = shop.bought.kecleonEgg ?? 0
  const price = kecleonEggPrice(bought)!
  return grantEgg({ ...save, wallet: save.wallet - price, spent: save.spent + price, shop: { ...shop, bought: { ...shop.bought, kecleonEgg: bought + 1 } } }, 'kecleon').save
}

/** Why the day's free gift can't be taken: it was already. */
export const giftBlock = (save: Save, v: Vitrine): 'claimed' | null => (onDay(save.shop, v.day).gift ? 'claimed' : null)

/** Takes the day's free gift into the bag; null when already taken. */
export const claimGift = (save: Save, v: Vitrine): Save | null =>
  giftBlock(save, v) ? null : { ...save, bag: addToBag(save.bag, v.gift), shop: { ...onDay(save.shop, v.day), gift: true } }

/** Pins a card on the wishlist (null unpins); null when the shop's level has no wishlist yet. */
export const setWish = (save: Save, key: VitrineKey | null): Save | null => (SHOP_LEVELS[save.shop.level].wishlist ? { ...save, shop: { ...save.shop, wishlist: key } } : null)

/* ---------------- Investing ---------------- */

/** ₽ invested to reach `level` (the levels' costs up to it): what the sync counts in the fortune. */
export const shopInvested = (level: ShopLevel) => SHOP_LEVEL_IDS.reduce((sum, l) => sum + (l <= level ? SHOP_LEVELS[l].cost : 0), 0)

/** The level after `level`, or null at the top. */
export const nextShopLevel = (level: ShopLevel): ShopLevel | null => SHOP_LEVEL_IDS.find((l) => l === level + 1) ?? null

/** Why the shop can't grow now: it's at the top, or the wallet can't pay the next level. */
export const investBlock = (save: Save): 'max' | 'poor' | null => {
  const next = nextShopLevel(save.shop.level)
  if (next === null) return 'max'
  return save.wallet < SHOP_LEVELS[next].cost ? 'poor' : null
}

/** Invests in the shop's next level, for good (nothing refunds it). Null when blocked (`investBlock`). */
export const investInShop = (save: Save): Save | null => {
  const next = nextShopLevel(save.shop.level)
  if (next === null || investBlock(save)) return null
  return { ...save, wallet: save.wallet - SHOP_LEVELS[next].cost, shop: { ...save.shop, level: next } }
}

/* ---------------- Styles ---------------- */

/** Buys a style for good. Null when it's owned already, not sold or too expensive. */
export const buyStyle = <S extends StyleSlot>(save: Save, slot: S, id: StyleId<S>): Save | null => {
  const price = stylePrice(slot, id)
  if (price === null || ownsStyle(save.style, slot, id) || save.wallet < price) return null
  return { ...save, wallet: save.wallet - price, spent: save.spent + price, style: grantStyle(save.style, slot, id) }
}

/* ---------------- Sync and parsing ---------------- */

/**
 * Two shops of the same player: the higher level (an investment on either
 * side stands); the most recent day, with the most bought of each card and
 * the gift taken on either side on the same day. The Kecleon Egg's count too,
 * so its ladder holds across devices: the next egg costs the rung after the
 * larger count. Like every card (and `spent`, the larger side's in
 * `mergeSaves`), two devices that bought the same rungs apart merge as the
 * side that bought more, so a rung bought on both is paid once and its egg
 * kept once (`mergeEggs`, the most of each tier). The wishlist is
 * `incoming`'s, a setting like the difficulty; the loyalty stamps, the larger count.
 */
export const mergeShop = (base: ShopSave, incoming: ShopSave): ShopSave => {
  const level = Math.max(base.level, incoming.level) as ShopLevel
  const visit = mergeVisit(base.visit, incoming.visit)
  const stamps = Math.max(base.stamps, incoming.stamps)
  if (base.day !== incoming.day) return { ...(base.day > incoming.day ? base : incoming), level, wishlist: incoming.wishlist, visit, stamps }
  const bought = Object.fromEntries(SHOP_BOUGHT_KEYS.flatMap((key) => {
    const n = Math.max(base.bought[key] ?? 0, incoming.bought[key] ?? 0)
    return n > 0 ? [[key, n]] : []
  }))
  return { level, day: base.day, bought, gift: base.gift || incoming.gift, wishlist: incoming.wishlist, visit, stamps }
}

/** Two sides' visits: the later day's, and on the same day the longer streak (each side counted its own visits up to it). */
export const mergeVisit = (base: ShopVisit, incoming: ShopVisit): ShopVisit => {
  if (base.day !== incoming.day) return base.day > incoming.day ? base : incoming
  return base.streak >= incoming.streak ? base : incoming
}

const parseVisit = (raw: unknown): ShopVisit => {
  if (!isRecord(raw) || !isDayKey(raw.day)) return NO_VISIT
  return { day: raw.day, streak: Math.max(1, wholeNumber(raw.streak, 10_000)) }
}

const isShopLevel = (v: unknown): v is ShopLevel => SHOP_LEVEL_IDS.some((l) => l === v)

const isVitrineKey = (v: unknown): v is VitrineKey => VITRINE_POOL.some((k) => k === v)

/** Counts bought per card (the Kecleon Egg's too) from an untrusted record, clamped to each card's stock. */
const parseBought = (raw: Record<string, unknown>) =>
  Object.fromEntries(SHOP_BOUGHT_KEYS.flatMap((key) => {
    const n = wholeNumber(raw[key], vitrineStock(key))
    return n > 0 ? [[key, n]] : []
  }))

/**
 * The save's `shop`. A save from before it (the Balcão do dia's `counter`,
 * `legacyCounter`) keeps that day's Lure, Incense and egg counts, so its
 * stock isn't bought twice; anything malformed starts at level 1.
 */
export const parseShop = (raw: unknown, legacyCounter?: unknown): ShopSave => {
  if (!isRecord(raw)) {
    if (!isRecord(legacyCounter) || !isDayKey(legacyCounter.day)) return NO_SHOP
    return { ...NO_SHOP, day: legacyCounter.day, bought: parseBought(isRecord(legacyCounter.bought) ? legacyCounter.bought : {}) }
  }
  const day = isDayKey(raw.day) ? raw.day : ''
  const visit = parseVisit(raw.visit)
  return {
    level: isShopLevel(raw.level) ? raw.level : 1,
    day,
    bought: day && isRecord(raw.bought) ? parseBought(raw.bought) : {},
    gift: day !== '' && raw.gift === true,
    wishlist: isVitrineKey(raw.wishlist) ? raw.wishlist : null,
    visit,
    // A save from before the loyalty card gets the stamp of its last visit.
    stamps: raw.stamps === undefined ? (visit.day === '' ? 0 : 1) : wholeNumber(raw.stamps, 100_000),
  }
}
