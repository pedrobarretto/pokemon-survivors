import { describe, expect, it } from 'vitest'
import { BAG_ITEMS, SHOP_LEVEL_IDS, SHOP_LEVELS, VITRINE, VITRINE_POOL, type VitrineKey } from '../data/shop'
import { bagCount } from './bag'
import { addDays } from './day'
import { EGGS } from './eggs'
import { buyUpgrade, EMPTY_SAVE, refundAll, type Save } from './meta'
import {
  buyFromVitrine,
  buyKecleonEgg,
  buyStyle,
  claimGift,
  dayStyle,
  investInShop,
  kecleonEggBlock,
  kecleonEggPrice,
  mergeShop,
  mergeVisit,
  nextAppearance,
  NO_SHOP,
  onPick,
  parseShop,
  recordVisit,
  setWish,
  shopInvested,
  stockLeft,
  vitrineBlock,
  vitrineCards,
  vitrineOf,
  vitrinePrice,
  type ShopSave,
  type Vitrine,
} from './shop'
import { equipStyle, grantStyle, mergeStyle, NO_STYLES, ownsStyle, parseStyle } from './style'

const rich = (wallet: number, shop: Partial<ShopSave> = {}): Save => ({ ...EMPTY_SAVE, wallet, shop: { ...NO_SHOP, ...shop } })

const DAY = '2026-10-21'

/** A day from `DAY` on whose Vitrine shows `key` to a Lv 1 shop, as the deal or not. */
const dayWith = (key: VitrineKey, deal: boolean) => {
  for (let i = 0; i < 60; i++) {
    const day = addDays(DAY, i)
    const v = vitrineOf(day)
    if (vitrineCards(v, 1).includes(key) && (v.cards[0] === key) === deal) return v
  }
  throw new Error(`no day with ${key}`)
}

describe('the Vitrine do dia', () => {
  it('is the same for everyone on a day, with distinct cards, the most any level sees', () => {
    expect(vitrineOf(DAY)).toEqual(vitrineOf(DAY))
    const v = vitrineOf(DAY)
    expect(new Set(v.cards).size).toBe(v.cards.length)
    expect(v.cards.length).toBe(Math.min(VITRINE_POOL.length, 1 + SHOP_LEVELS[5].vitrineSlots))
    // Higher levels see more of the same Vitrine.
    for (const level of SHOP_LEVEL_IDS) expect(vitrineCards(v, level)).toEqual(v.cards.slice(0, 1 + SHOP_LEVELS[level].vitrineSlots))
    const eggs = new Set(Array.from({ length: 60 }, (_, i) => vitrineOf(addDays(DAY, i)).egg))
    expect(eggs.has('common') && eggs.has('rare')).toBe(true)
  })

  it('brings every card back within 7 days, even at Lv 1, over years of days', () => {
    // The core cards (the deal and Lv 1's slots) carry the guarantee: the pool must fit in 7 days of them.
    expect(Math.ceil(VITRINE_POOL.length / VITRINE.core)).toBeLessThanOrEqual(7)
    const seen = new Map<VitrineKey, number>()
    const longest = new Map<VitrineKey, number>()
    for (let i = 0; i < 3 * 365; i++) {
      for (const key of vitrineCards(vitrineOf(addDays(VITRINE.epoch, i)), 1)) {
        const last = seen.get(key) ?? -1
        longest.set(key, Math.max(longest.get(key) ?? 0, i - last))
        seen.set(key, i)
      }
    }
    for (const key of VITRINE_POOL) {
      expect(longest.get(key), key).toBeLessThanOrEqual(7)
    }
  })

  it('tells the wishlist when a card comes back', () => {
    for (const key of VITRINE_POOL) {
      const day = nextAppearance(key, DAY)!
      expect(vitrineCards(vitrineOf(day), 1)).toContain(key)
      for (let d = DAY; d < day; d = addDays(d, 1)) expect(vitrineCards(vitrineOf(d), 1)).not.toContain(key)
      // A bigger shop sees it the same day or sooner.
      expect(nextAppearance(key, DAY, 5)! <= day).toBe(true)
    }
  })

  it('takes 30% off the deal, and offers each save the first style of the day it lacks', () => {
    const deal = dayWith('lure', true)
    expect(vitrinePrice(deal, 'lure', NO_STYLES)).toBe(BAG_ITEMS.lure.price * (1 - VITRINE.deal))
    expect(vitrinePrice(dayWith('lure', false), 'lure', NO_STYLES)).toBe(BAG_ITEMS.lure.price)
    const v = vitrineOf(DAY)
    const first = dayStyle(v, NO_STYLES)!
    const owner = onPick(first, (slot, id) => buyStyle(rich(100_000), slot, id))!
    expect(dayStyle(v, owner.style)).toEqual(v.styles[1])
  })
})

describe('buying from the Vitrine', () => {
  it('sells into the bag up to the daily stock and spends into `spent`; a new day restocks', () => {
    const v = dayWith('rareCandy', false)
    let save = rich(100_000)
    for (let i = 0; i < BAG_ITEMS.rareCandy.stock; i++) save = buyFromVitrine(save, v, 'rareCandy')!
    expect(bagCount(save.bag, 'rareCandy')).toBe(BAG_ITEMS.rareCandy.stock)
    expect(vitrineBlock(save, v, 'rareCandy')).toBe('soldOut')
    expect(buyFromVitrine(save, v, 'rareCandy')).toBeNull()
    expect(save.wallet + save.spent).toBe(100_000)
    const later = vitrineOf(nextAppearance('rareCandy', addDays(v.day, 1))!)
    expect(stockLeft(save.shop, later, 'rareCandy')).toBe(BAG_ITEMS.rareCandy.stock)
    expect(buyFromVitrine(save, later, 'rareCandy')).not.toBeNull()
  })

  it('never gives as the free gift the item that is the deal, and never gives an Everstone', () => {
    let dealtItem = 0
    for (let i = 0; i < 365; i++) {
      const v = vitrineOf(addDays(VITRINE.epoch, i))
      expect(v.gift).not.toBe(v.cards[0])
      expect(v.gift).not.toBe('everstone')
      if (v.cards[0] !== 'egg' && v.cards[0] !== 'style') dealtItem++
    }
    expect(dealtItem).toBeGreaterThan(100)
  })

  it('keeps the Everstone locked until the Shop (Lv 3)', () => {
    const v = dayWith('everstone', false)
    expect(vitrineBlock(rich(100_000, { level: 2 }), v, 'everstone')).toBe('locked')
    expect(vitrineBlock(rich(100_000, { level: 3 }), v, 'everstone')).toBeNull()
  })

  it("only sells the cards the shop's level shows, to a wallet that can pay", () => {
    const v = vitrineOf(DAY)
    const hidden = v.cards[v.cards.length - 1]!
    expect(vitrineBlock(rich(100_000), v, hidden)).toBe('locked')
    expect(vitrineBlock(rich(100_000, { level: 5 }), v, hidden)).not.toBe('locked')
    expect(vitrineBlock(rich(0), v, v.cards[0]!)).toBe('poor')
  })

  it("puts the day's egg in the incubator, but not into a full one", () => {
    const v = dayWith('egg', false)
    const save = buyFromVitrine(rich(10_000), v, 'egg')!
    expect(save.eggs).toEqual([{ tier: v.egg, steps: 0 }])
    const full = { ...rich(10_000), eggs: Array.from({ length: EGGS.slots }, () => ({ tier: 'common' as const, steps: 0 })) }
    expect(vitrineBlock(full, v, 'egg')).toBe('full')
  })

  it("sells the day's style for good, and says so once a save owns every one", () => {
    const v = dayWith('style', false)
    const pick = dayStyle(v, NO_STYLES)!
    const save = buyFromVitrine(rich(100_000), v, 'style')!
    expect(onPick(pick, (slot, id) => ownsStyle(save.style, slot, id))).toBe(true)
    const collector = { ...rich(100_000), style: v.styles.reduce((s, p) => onPick(p, (slot, id) => grantStyle(s, slot, id)), NO_STYLES) }
    expect(vitrineBlock(collector, v, 'style')).toBe('owned')
  })

  it('gives the free gift once a day', () => {
    const v = vitrineOf(DAY)
    const save = claimGift(rich(0), v)!
    expect(bagCount(save.bag, v.gift)).toBe(1)
    expect(save.wallet).toBe(0)
    expect(claimGift(save, v)).toBeNull()
    expect(claimGift(save, vitrineOf(addDays(DAY, 1)))).not.toBeNull()
  })

  it('pins a wishlist card only from the Tent on', () => {
    expect(setWish(rich(0), 'maxRevive')).toBeNull()
    expect(setWish(rich(0, { level: 2 }), 'maxRevive')!.shop.wishlist).toBe('maxRevive')
  })
})

describe('the Kecleon Egg’s fixed card', () => {
  /** Buys the day's Kecleon Eggs one after another, hatching each away so the incubator has room; returns the save and each price paid. */
  const buyAll = (save: Save, v: Vitrine) => {
    const paid: number[] = []
    let s = save
    for (let next = buyKecleonEgg(s, v); next; next = buyKecleonEgg(s, v)) {
      paid.push(s.wallet - next.wallet)
      s = { ...next, eggs: [] }
    }
    return { save: s, paid }
  }

  it('climbs a ladder each day, every egg double the last and 6 at most, beside the rotation', () => {
    expect(VITRINE_POOL).not.toContain('kecleonEgg')
    expect([0, 1, 2, 3, 4, 5, 6].map(kecleonEggPrice)).toEqual([10_000, 20_000, 40_000, 80_000, 160_000, 320_000, null])
    const v = vitrineOf(DAY)
    expect(buyKecleonEgg(rich(50_000), v)!.eggs).toEqual([{ tier: 'kecleon', steps: 0 }])
    const { save, paid } = buyAll(rich(1_000_000), v)
    expect(paid).toEqual([10_000, 20_000, 40_000, 80_000, 160_000, 320_000])
    expect([save.wallet, save.spent, save.shop.bought.kecleonEgg]).toEqual([370_000, 630_000, 6])
    expect(kecleonEggBlock(save, v)).toBe('soldOut')
    // The next Brasília day starts the ladder over.
    expect(save.wallet - buyKecleonEgg(save, vitrineOf(addDays(DAY, 1)))!.wallet).toBe(10_000)
  })

  it('refuses a full incubator before taking any ₽, and a wallet short of the next rung', () => {
    const v = vitrineOf(DAY)
    const full = { ...rich(500_000), eggs: Array.from({ length: EGGS.slots }, () => ({ tier: 'common', steps: 0 }) as const) }
    expect(kecleonEggBlock(full, v)).toBe('full')
    expect(buyKecleonEgg(full, v)).toBeNull()
    const twice = buyAll(rich(30_000), v).save
    expect([twice.wallet, twice.shop.bought.kecleonEgg]).toEqual([0, 2])
    expect(kecleonEggBlock({ ...twice, wallet: 39_999 }, v)).toBe('poor')
    expect(kecleonEggBlock({ ...twice, wallet: 40_000 }, v)).toBeNull()
  })

  it('keeps the ladder through the merge and the parse', () => {
    const v = vitrineOf(DAY)
    const one = buyKecleonEgg(rich(50_000), v)!
    const two = buyKecleonEgg({ ...one, eggs: [] }, v)!
    // Two devices that bought apart merge as the one that bought more: the next egg is the rung after it.
    const merged = mergeShop(one.shop, two.shop)
    expect(merged.bought.kecleonEgg).toBe(2)
    expect(kecleonEggPrice(merged.bought.kecleonEgg ?? 0)).toBe(40_000)
    expect(mergeShop(two.shop, { ...two.shop, day: addDays(DAY, -1), bought: {} }).bought.kecleonEgg).toBe(2)
    expect(parseShop({ ...two.shop, bought: { kecleonEgg: 9 } }).bought).toEqual({ kecleonEgg: 6 })
    expect(stockLeft(parseShop(JSON.parse(JSON.stringify(two.shop))), v, 'kecleonEgg')).toBe(4)
  })
})

describe('investing in the shop', () => {
  it('climbs one level at a time at its cost, for good', () => {
    const costs = [30_000, 100_000, 300_000, 800_000]
    let save = rich(2_000_000)
    for (const cost of costs) {
      const next = investInShop(save)!
      expect(next.wallet).toBe(save.wallet - cost)
      save = next
    }
    expect(save.shop.level).toBe(5)
    expect(shopInvested(5)).toBe(1_230_000)
    expect(investInShop(save)).toBeNull()
    expect(investInShop(rich(29_999))).toBeNull()
    // A refund gives back the upgrades, never the shop.
    const refunded = refundAll(buyUpgrade(save, 'hpUp')!)
    expect(refunded.shop.level).toBe(5)
    expect(refunded.wallet).toBe(save.wallet)
  })
})

describe('the save’s shop', () => {
  it('merges to the higher level, the newest day, and the most bought on the same day', () => {
    const visit = { day: DAY, streak: 2 }
    const a: ShopSave = { level: 3, day: DAY, bought: { lure: 1, egg: 1 }, gift: true, wishlist: 'honey', visit, stamps: 12 }
    const b: ShopSave = { level: 2, day: DAY, bought: { lure: 2, incense: 1 }, gift: false, wishlist: null, visit, stamps: 5 }
    expect(mergeShop(a, b)).toEqual({ level: 3, day: DAY, bought: { lure: 2, incense: 1, egg: 1 }, gift: true, wishlist: null, visit, stamps: 12 })
    const tomorrow = { ...b, day: addDays(DAY, 1) }
    // The loyalty stamps keep the larger count, whichever day wins.
    expect(mergeShop(a, tomorrow)).toEqual({ ...tomorrow, level: 3, stamps: 12 })
    expect(mergeShop(tomorrow, a)).toEqual({ ...tomorrow, level: 3, wishlist: 'honey', stamps: 12 })
  })

  it("parses tolerantly, and an older save's counter keeps that day's stock", () => {
    expect(parseShop(undefined)).toEqual(NO_SHOP)
    expect(parseShop({ level: 9, day: 'x', bought: { lure: 3 }, gift: true, wishlist: 'rocket', visit: { day: 'x', streak: 4 } })).toEqual(NO_SHOP)
    expect(parseShop({ level: 4, day: DAY, bought: { lure: 99, rocket: 1, egg: -1 }, gift: true, wishlist: 'egg', visit: { day: DAY, streak: 0 } })).toEqual({
      level: 4,
      day: DAY,
      bought: { lure: 3 },
      gift: true,
      wishlist: 'egg',
      visit: { day: DAY, streak: 1 },
      // A save from before the loyalty card gets its last visit's stamp.
      stamps: 1,
    })
    expect(parseShop({ level: 2, stamps: 41.7 }).stamps).toBe(41)
    expect(parseShop(undefined, { day: DAY, bought: { lure: 2, incense: 3, egg: 1 } })).toEqual({ ...NO_SHOP, day: DAY, bought: { lure: 2, incense: 3, egg: 1 } })
  })
})

describe('shop visits', () => {
  it('count the days in a row, once a day, and start over after a gap', () => {
    const first = recordVisit(NO_SHOP, DAY)
    expect(first.visit).toEqual({ day: DAY, streak: 1 })
    expect(recordVisit(first, DAY)).toBe(first)
    const next = recordVisit(first, addDays(DAY, 1))
    expect(next.visit).toEqual({ day: addDays(DAY, 1), streak: 2 })
    expect(recordVisit(next, addDays(DAY, 3)).visit).toEqual({ day: addDays(DAY, 3), streak: 1 })
  })

  it('stamp the loyalty card once a day, and a gap never takes stamps away', () => {
    const first = recordVisit(NO_SHOP, DAY)
    expect(first.stamps).toBe(1)
    expect(recordVisit(first, DAY).stamps).toBe(1)
    const later = recordVisit(recordVisit(first, addDays(DAY, 1)), addDays(DAY, 9))
    expect(later.stamps).toBe(3)
    expect(later.visit.streak).toBe(1)
  })

  it('merge to the latest day, and the longer streak on the same day', () => {
    const today = { day: DAY, streak: 2 }
    const loyal = { day: DAY, streak: 6 }
    const yesterday = { day: addDays(DAY, -1), streak: 9 }
    expect(mergeVisit(yesterday, today)).toBe(today)
    expect(mergeVisit(today, yesterday)).toBe(today)
    expect(mergeVisit(today, loyal)).toBe(loyal)
    expect(mergeShop({ ...NO_SHOP, visit: loyal }, { ...NO_SHOP, day: DAY, visit: yesterday }).visit).toBe(loyal)
  })
})

describe('styles', () => {
  it('are bought once, then worn', () => {
    expect(buyStyle(rich(100), 'frame', 'master')).toBeNull()
    const save = buyStyle(rich(10_000), 'frame', 'poke')!
    expect(ownsStyle(save.style, 'frame', 'poke')).toBe(true)
    expect(save.spent).toBe(10_000 - save.wallet)
    expect(buyStyle(save, 'frame', 'poke')).toBeNull()
    expect(equipStyle(save.style, 'frame', 'master').equipped.frame).toBe('classic')
    expect(equipStyle(save.style, 'frame', 'poke').equipped.frame).toBe('poke')
  })

  it("parse and merge: unknown ids dropped, a style not owned isn't worn", () => {
    expect(parseStyle({ owned: { frame: ['poke', 'rocket', 'poke'] }, equipped: { frame: 'great', background: 'cave' } })).toEqual({
      owned: { frame: ['poke'], background: [], wallpaper: [] },
      equipped: { frame: 'classic', background: 'night', wallpaper: 'classic' },
    })
    const a = equipStyle({ ...NO_STYLES, owned: { ...NO_STYLES.owned, frame: ['poke'] } }, 'frame', 'poke')
    const b = { ...NO_STYLES, owned: { ...NO_STYLES.owned, wallpaper: ['snow' as const] } }
    expect(mergeStyle(a, b)).toEqual({ owned: { frame: ['poke'], background: [], wallpaper: ['snow'] }, equipped: NO_STYLES.equipped })
    expect(mergeStyle(b, a).equipped.frame).toBe('poke')
  })
})
