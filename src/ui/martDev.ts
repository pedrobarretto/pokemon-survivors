import type { EnemyId } from '../data/enemies'
import { STYLE_SLOTS, styleIds } from '../data/style'
import { EVO_ITEM_IDS, MAX_CAPS, SHOP_LEVEL_IDS, VITRINE, type EvoItemId, type ShopLevel } from '../data/shop'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { grantCaps } from '../game/evoItems'
import { EGGS, MAX_SLOTS } from '../game/eggs'
import { armTm, isShelfTm, shelfTms, tmLimit, tmRotation, type ShelfTm } from '../game/tmShelf'
import { addToBag, BAG_ITEM_IDS, type BagItem } from '../game/bag'
import { brasiliaDay, isDayKey } from '../game/day'
import { OUTBREAK_SPECIES } from '../game/outbreak'
import { boughtToday, dayStyle, isDeal, kecleonEggBlock, vitrineCards, vitrineOf, vitrinePrice } from '../game/shop'
import { grantStyle, type StyleSave } from '../game/style'
import { loadSave, outbreakToday, setOutbreak, today, writeSave } from './save'

/**
 * Dev console helpers for the Surto do dia and the Kecleon Shop (`ps.*` in dev
 * builds). `refresh` rebuilds the screen showing, so changes show up right away.
 */
export const martDevTools = (refresh: () => void) => ({
  /** Holds `id` as today's outbreak (`ps.outbreak('gastly')`), or goes back to the day's without one. Returns the outbreak. */
  outbreak: (id?: EnemyId) => {
    if (id && !OUTBREAK_SPECIES.includes(id)) return `Outbreak species: ${OUTBREAK_SPECIES.join(', ')}`
    setOutbreak(id ?? null)
    refresh()
    return outbreakToday()
  },
  /** Puts `n` of a bag item in the bag (`ps.item('maxRevive', 3)`; any of `BAG_ITEM_IDS`). */
  item: (id: BagItem = 'lure', n = 1) => {
    if (!BAG_ITEM_IDS.includes(id)) return `Items: ${BAG_ITEM_IDS.join(', ')}`
    const save = loadSave()
    writeSave({ ...save, bag: addToBag(save.bag, id, n) })
    refresh()
    return loadSave().bag
  },
  /** Sets the save's shop level, 1 to 5 (`ps.shopLevel(3)`), without paying for it. Returns the shop. */
  shopLevel: (level: ShopLevel = 1) => {
    if (!SHOP_LEVEL_IDS.includes(level)) return `Levels: ${SHOP_LEVEL_IDS.join(', ')}`
    const save = loadSave()
    writeSave({ ...save, shop: { ...save.shop, level } })
    refresh()
    return loadSave().shop
  },
  /**
   * Prints a day's Vitrine (`ps.vitrine('2026-10-25')`, today without one): the gift, the egg, each card
   * with its price for this save, the deal and the level that first shows it, and the Kecleon Egg's
   * ladder (the rungs this save bought that day, the next one and what blocks it). Returns the Vitrine.
   */
  vitrine: (day?: string) => {
    const v = vitrineOf(day && isDayKey(day) ? day : brasiliaDay(today()))
    const save = loadSave()
    const firstLevel = (i: number) => SHOP_LEVEL_IDS.find((l) => vitrineCards(v, l).length > i)
    const style = dayStyle(v, save.style)
    console.table(
      v.cards.map((key, i) => ({
        card: key === 'style' ? `style: ${style ? `${style.slot} ${style.id}` : '(all owned)'}` : key === 'egg' ? `egg: ${v.egg}` : key,
        price: vitrinePrice(v, key, save.style),
        deal: isDeal(v, key),
        fromLevel: firstLevel(i),
      })),
    )
    console.log(`${v.day} · gift: ${v.gift} · egg: ${v.egg}`)
    const bought = boughtToday(save.shop, v, 'kecleonEgg')
    const ladder = VITRINE.kecleonEgg.prices.map((p, i) => (i < bought ? `(${p})` : i === bought ? `[${p}]` : `${p}`))
    console.log(`Kecleon Egg ladder (bought, [next]): ${ladder.join(' → ')} · ${kecleonEggBlock(save, v) ?? 'buyable'}`)
    return v
  },
  /**
   * Owns a TM from the shop's shelf, as if bought, and arms it (`ps.ownTm('payDay')`; every one without an
   * argument, none armed). Prints today's rotation. Returns the TM case.
   */
  ownTm: (id?: ShelfTm) => {
    if (id !== undefined && !isShelfTm(id)) return `TMs: ${shelfTms().join(', ')}`
    const save = loadSave()
    const owned = shelfTms().filter((m) => m === id || id === undefined || save.tms.owned.includes(m))
    const tms = id ? armTm({ ...save.tms, owned }, id, true, tmLimit(save.shop.level)) : { ...save.tms, owned }
    writeSave({ ...save, tms })
    console.log(`Today's rotation: ${tmRotation(brasiliaDay(today())).join(', ')}`)
    refresh()
    return loadSave().tms
  },
  /** Sets a Pokémon's Bottle Caps, 0 to 3 (`ps.caps('charmander', 3)`; the partner's without an id). Returns the caps. */
  caps: (id?: PlayableId, n = 3) => {
    const save = loadSave()
    const who = id ?? save.partner
    if (!Object.hasOwn(PLAYABLE, who)) return 'Unknown Pokémon'
    const level = Math.max(0, Math.min(MAX_CAPS, n))
    const caps = level === 0 ? Object.fromEntries(Object.entries(save.caps).filter(([k]) => k !== who)) : { ...save.caps, [who]: 0 }
    writeSave({ ...save, caps: level === 0 ? caps : grantCaps(caps, who, level) })
    refresh()
    return loadSave().caps
  },
  /** Owns an evolution item, as if bought (`ps.evoItem('iceStone')`; all of them without an argument). Returns the items owned. */
  evoItem: (id?: EvoItemId) => {
    if (id !== undefined && !EVO_ITEM_IDS.includes(id)) return `Items: ${EVO_ITEM_IDS.join(', ')}`
    const save = loadSave()
    writeSave({ ...save, evo: EVO_ITEM_IDS.filter((x) => x === id || id === undefined || save.evo.includes(x)) })
    refresh()
    return loadSave().evo
  },
  /** Sets the incubator's slots, 3 to 5 (`ps.slots(4)`; all of them without an argument), without paying for them; eggs past them are dropped. Returns the incubator. */
  slots: (n: number = MAX_SLOTS) => {
    const save = loadSave()
    writeSave({ ...save, incubator: { ...save.incubator, slots: Math.max(0, Math.min(MAX_SLOTS, Math.floor(n)) - EGGS.slots) } })
    refresh()
    return loadSave().incubator
  },
  /** Adds `n` Quick Incubators (`ps.quick(3)`), as if bought (pays nothing). Returns the incubator. */
  quick: (n = 3) => {
    const save = loadSave()
    const { quick } = save.incubator
    writeSave({ ...save, incubator: { ...save.incubator, quick: { ...quick, got: quick.got + Math.max(0, Math.floor(n)) } } })
    refresh()
    return loadSave().incubator
  },
  /** Adds ₽ to the wallet (`ps.money(20000)`). */
  money: (amount = 10_000) => {
    const save = loadSave()
    writeSave({ ...save, wallet: save.wallet + amount })
    refresh()
    return loadSave().wallet
  },
  /** Owns every style of the shelf, as if bought (pays nothing). */
  unlockStyles: () => {
    const save = loadSave()
    const style = STYLE_SLOTS.reduce<StyleSave>((acc, slot) => styleIds(slot).reduce<StyleSave>((s, id) => grantStyle(s, slot, id), acc), save.style)
    writeSave({ ...save, style })
    refresh()
  },
})
