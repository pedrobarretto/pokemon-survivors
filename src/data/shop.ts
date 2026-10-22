import type { EggTier } from '../game/eggs'
import type { StatDelta } from '../game/stats'
import type { BranchId } from './branches'

/**
 * The Kecleon Shop's catalog, as data: the five shop levels a player invests
 * ₽ into, the Bag's consumables and the Vitrine do dia's pool. The rules that
 * read it live in `game/shop.ts` (the Vitrine, buying, investing) and
 * `game/bag.ts` (arming); what each consumable does in a run is its `effect`,
 * read by the simulation (`createGame`, `recomputeStats`, `tryMaxRevive`).
 * Item names stay in English (official); descriptions live in `i18n`.
 */

/** What a consumable does to the run that uses it. */
export type BagEffect =
  /** Wild shinies this many times likelier (the outbreak's too). */
  | { shinyOdds: number }
  /** Eggs this many times likelier to drop. */
  | { eggOdds: number }
  /** The run starts at this level: the level-ups in between come right after the opening draft. */
  | { startLevel: number }
  /** A stat layer for the whole run (`recomputeStats`). */
  | { stat: StatDelta }
  /** The day's outbreak species spawns this many times as often. */
  | { outbreakWeight: number }
  /** The first faint gets back up with this share of max HP, once. */
  | { revive: number }
  /** The run never evolves, and the base form's stats grow by this share (`runBoost`). */
  | { everstone: number }

type BagItemDef = {
  name: string
  /** Full price on the Vitrine, in ₽. */
  price: number
  /** How many one save may buy on a day. */
  stock: number
  /** How likely the day's free gift is this item, against the others' weights (0: never the gift). */
  gift: number
  effect: BagEffect
  /** The shop level that sells it (1 when omitted): below it, its Vitrine card is locked. */
  minLevel?: ShopLevel
}

/** The Bag's consumables, one of each armed per run at most. */
export const BAG_ITEMS = {
  lure: { name: 'Lure', price: 800, stock: 3, gift: 3, effect: { shinyOdds: 2 } },
  incense: { name: 'Incense', price: 600, stock: 3, gift: 3, effect: { eggOdds: 2 } },
  rareCandy: { name: 'Rare Candy', price: 1200, stock: 3, gift: 2, effect: { startLevel: 3 } },
  luckyEgg: { name: 'Lucky Egg', price: 1500, stock: 3, gift: 2, effect: { stat: { growth: 0.25 } } },
  luckIncense: { name: 'Luck Incense', price: 2000, stock: 2, gift: 1, effect: { stat: { greed: 0.5 } } },
  honey: { name: 'Honey', price: 700, stock: 3, gift: 3, effect: { outbreakWeight: 2 } },
  xAttack: { name: 'X Attack', price: 1500, stock: 3, gift: 2, effect: { stat: { might: 0.1 } } },
  maxRevive: { name: 'Max Revive', price: 5000, stock: 1, gift: 1, effect: { revive: 0.5 } },
  everstone: { name: 'Everstone', price: 3000, stock: 2, gift: 0, effect: { everstone: 0.15 }, minLevel: 3 },
} as const satisfies Record<string, BagItemDef>

/** The shop level that sells a consumable (`BagItemDef.minLevel`). */
export const bagItemLevel = (id: BagItem): ShopLevel => {
  const def: BagItemDef = BAG_ITEMS[id]
  return def.minLevel ?? 1
}

export type BagItem = keyof typeof BAG_ITEMS

export const BAG_ITEM_IDS = Object.keys(BAG_ITEMS) as BagItem[]

type ShopLevelDef = {
  /** ₽ to reach this level from the one before (never refunded). */
  cost: number
  /** Cards on the Vitrine besides the deal. */
  vitrineSlots: number
  /** Different Bag items a run may take. */
  bagSlots: number
  /** TMs that can be armed at once (the TM shelf, PR 4). */
  armedTms: number
  /** Shelves this level has open: TMs from the Tent, evolution items and Bottle Caps from the Shop. */
  shelves: { tms: boolean; evolution: boolean; caps: boolean }
  /** Pin one Vitrine item and hear when it comes back. */
  wishlist: boolean
  /** The purple Kecleon tends the TM and evolution shelves. */
  brother: boolean
  /** Meowth's weekend caravan parks at the plaza (PR 5). */
  caravan: boolean
  /** The Tycoon title, the gold Kecleon frame and the golden statue (PR 5). */
  tycoon: boolean
  /** Props this level adds to the plaza (PR 2). */
  props: readonly ShopProp[]
}

export type ShopProp = 'board' | 'flowers' | 'lights' | 'statue'

const SHELVES_LV1 = { tms: false, evolution: false, caps: false } as const
const SHELVES_LV2 = { tms: true, evolution: false, caps: false } as const
const SHELVES_LV3 = { tms: true, evolution: true, caps: true } as const

/** The shop's levels, 1 (Cart) to 5 (Department Store); names live in `i18n` (`shop.levels`). */
export const SHOP_LEVELS = {
  1: { cost: 0, vitrineSlots: 4, bagSlots: 2, armedTms: 1, shelves: SHELVES_LV1, wishlist: false, brother: false, caravan: false, tycoon: false, props: [] },
  2: { cost: 30_000, vitrineSlots: 5, bagSlots: 3, armedTms: 1, shelves: SHELVES_LV2, wishlist: true, brother: true, caravan: false, tycoon: false, props: ['board'] },
  3: { cost: 100_000, vitrineSlots: 6, bagSlots: 3, armedTms: 1, shelves: SHELVES_LV3, wishlist: true, brother: true, caravan: false, tycoon: false, props: ['flowers'] },
  4: { cost: 300_000, vitrineSlots: 6, bagSlots: 4, armedTms: 2, shelves: SHELVES_LV3, wishlist: true, brother: true, caravan: true, tycoon: false, props: ['lights'] },
  5: { cost: 800_000, vitrineSlots: 7, bagSlots: 4, armedTms: 2, shelves: SHELVES_LV3, wishlist: true, brother: true, caravan: true, tycoon: true, props: ['statue'] },
} as const satisfies Record<number, ShopLevelDef>

export type ShopLevel = keyof typeof SHOP_LEVELS

export const SHOP_LEVEL_IDS = Object.keys(SHOP_LEVELS).map(Number) as ShopLevel[]

export const MAX_SHOP_LEVEL = SHOP_LEVEL_IDS[SHOP_LEVEL_IDS.length - 1]!

/** The most Bag items any level lets a run take: a replay with more is malformed (`parseReplay`). */
export const MAX_BAG_SLOTS = Math.max(...SHOP_LEVEL_IDS.map((l) => SHOP_LEVELS[l].bagSlots))

/**
 * The Vitrine do dia's pool: every consumable, the day's egg and the day's
 * style. A card's id is its key here; PR 4 adds TMs and evolution items by
 * adding keys (and their price and stock in `game/shop.ts`). Each day deals
 * `VITRINE.core` cards that every level sees (the deal first), the ones shown
 * longest ago first, so every card is back within 7 days even at Lv 1; that
 * needs the pool to fit in 7 days of core cards (`shop.test.ts` checks both).
 */
export const VITRINE_POOL = [...BAG_ITEM_IDS, 'egg', 'style'] as const

export type VitrineKey = (typeof VITRINE_POOL)[number]

export const VITRINE = {
  /** Cards every level sees: the deal and Lv 1's slots. The rotation guarantee rides on these. */
  core: 1 + SHOP_LEVELS[1].vitrineSlots,
  /** The deal (the first card) takes this much off. */
  deal: 0.3,
  /** Days of seeded nudge on how long ago each card showed, so the rotation mixes (0 would deal the same groups over and over). */
  jitter: 2.5,
  /** The rotation counts from this day (a Monday); earlier days start fresh. */
  epoch: '2026-10-19',
  /** The day's egg: each tier's price and its odds of being the day's (shown on screen). One per day. */
  eggs: {
    common: { price: 1500, weight: 60 },
    rare: { price: 4000, weight: 34 },
    ultra: { price: 9000, weight: 6 },
  },
  /** How many eggs and styles one save may buy on a day. */
  eggStock: 1,
  styleStock: 1,
  /**
   * The Kecleon Egg's fixed card, beside the day's cards and never one of
   * them (the rotation and its 7-day guarantee don't see it, nor the deal):
   * the price of each egg one save buys on a Brasília day, at any shop level,
   * each double the last, so the more ₽ a player sits on the more eggs they
   * take home. Its length is the daily stock (`kecleonEggPrice`). Its four
   * families hatch from no other egg (`EGG_TIERS.kecleon`).
   */
  kecleonEgg: {
    prices: [10_000, 20_000, 40_000, 80_000, 160_000, 320_000],
    /** From this price on, the shop asks before selling one (a click buys on desktop). */
    confirmFrom: 80_000,
  },
} as const satisfies { eggs: Record<Exclude<EggTier, 'friend' | 'haunted' | 'kecleon' | 'kecleonShiny'>, { price: number; weight: number }> } & Record<string, unknown>

export type VitrineEgg = keyof typeof VITRINE.eggs

/** What the save counts as bought on a day (`ShopSave.bought`): the rotation's cards and the Kecleon Egg's fixed card. */
export const SHOP_BOUGHT_KEYS = [...VITRINE_POOL, 'kecleonEgg'] as const

export type ShopBoughtKey = (typeof SHOP_BOUGHT_KEYS)[number]

/* ---------------- The purple brother's shelves (TMs, evolution items) and Bottle Caps ---------------- */

/**
 * The TM shelf: every regular TM (the boss discs' moves) and the
 * shop-exclusive ones, owned for good once bought. The TMs a run ever taught
 * are always listed; the rest rotate `rotation` a day, each back within 7
 * days (`game/tmShelf.ts`). Legendary (gold) TMs are never sold.
 */
export const TM_SHELF = {
  /** A regular TM. */
  price: 6000,
  /** A shop-exclusive TM (`game/shopTmMoves.ts`): always listed. */
  exclusive: 20_000,
  /** Regular TMs not learned yet that the shelf shows on a day. */
  rotation: 3,
  /** The rotation counts from this day (a Monday), like the Vitrine's. */
  epoch: '2026-10-19',
} as const

/**
 * The evolution shelf's items, each owned for good: the branches it names
 * need it in a run (`evolutionOffers`; Eevee's three `free` ones don't, the
 * item only adds them to the choice), and so do the line steps that name it
 * (`EvolutionStage.item`: the Up-Grade for Porygon2, the Dubious Disc for
 * Porygon-Z, the Leaf Stone for Exeggutor besides Leafeon). A run can also
 * find one: a wave boss may drop a missing one (`EVO_FIND`), good for that
 * run only. Names stay official English.
 */
/**
 * The evolution items' ids, in catalog order. Spelled out (not `keyof typeof
 * EVO_ITEMS`): the lines name their step's item (`EvolutionStage.item`), and
 * the items name branches of those lines, so the ids can't hang on either.
 */
export const EVO_ITEM_IDS = [
  'waterStone', 'thunderStone', 'fireStone', 'sunStone', 'moonStone', 'leafStone', 'iceStone', 'shinyStone', 'dawnStone',
  'metalCoat', 'blackAugurite', 'kingsRock', 'auspiciousArmor', 'maliciousArmor', 'upgrade', 'dubiousDisc',
] as const

export type EvoItemId = (typeof EVO_ITEM_IDS)[number]

export const EVO_ITEMS = {
  waterStone: { name: 'Water Stone', branches: ['vaporeon'] },
  thunderStone: { name: 'Thunder Stone', branches: ['jolteon'] },
  fireStone: { name: 'Fire Stone', branches: ['flareon'] },
  sunStone: { name: 'Sun Stone', branches: ['espeon'] },
  moonStone: { name: 'Moon Stone', branches: ['umbreon'] },
  leafStone: { name: 'Leaf Stone', branches: ['leafeon'] },
  iceStone: { name: 'Ice Stone', branches: ['glaceon'] },
  shinyStone: { name: 'Shiny Stone', branches: ['sylveon'] },
  dawnStone: { name: 'Dawn Stone', branches: ['gallade', 'froslass'] },
  metalCoat: { name: 'Metal Coat', branches: ['scizor'] },
  blackAugurite: { name: 'Black Augurite', branches: ['kleavor'] },
  kingsRock: { name: "King's Rock", branches: ['politoed'] },
  auspiciousArmor: { name: 'Auspicious Armor', branches: ['armarouge'] },
  maliciousArmor: { name: 'Malicious Armor', branches: ['ceruledge'] },
  upgrade: { name: 'Up-Grade', branches: [] },
  dubiousDisc: { name: 'Dubious Disc', branches: [] },
} as const satisfies Record<EvoItemId, { name: string; branches: readonly BranchId[] }>

/** What an evolution item costs. */
export const EVO_ITEM_PRICE = 10_000

/**
 * Evolution items found in a run (`game/evoGate.ts`): while the run's
 * Pokémon still has a branch ahead that needs an item it lacks, each boss
 * defeated drops one of those items with this chance. It lasts the run.
 */
export const EVO_FIND = { chance: 0.3 } as const

/**
 * Bottle Caps (Hyper Training): per Pokémon, `prices.length` levels, each
 * making every stat `boost` stronger, only in runs played as that Pokémon
 * (`runBoost`). The Treino shelf sells them from the Shop (Lv 3).
 */
export const BOTTLE_CAPS = { prices: [2000, 6000, 18_000], boost: 0.03 } as const

/** The most Bottle Cap levels a Pokémon can have. */
export const MAX_CAPS = BOTTLE_CAPS.prices.length

/**
 * The incubator's upgrades, on the shop's Incubadora shelf (`game/incubator.ts`).
 * `slots`: extra slots past `EGGS.slots`, owned for good, each after the one
 * before and from its shop level: the 4th from the Tent (Lv 2, so a player
 * who hoarded ₽ grows the shop first), the 5th from the Kecleon Mart (Lv 4,
 * the endgame's sink, past most of the ladder). Like the shop's levels, the sync
 * counts them in the fortune and nothing refunds them. `quick`: the Quick
 * Incubator, a consumable that makes one egg walk `speed` times as fast until it hatches.
 */
export const INCUBATOR = {
  slots: [
    { price: 150_000, minLevel: 2 },
    { price: 500_000, minLevel: 4 },
  ],
  quick: { price: 8000, speed: 2 },
} as const satisfies { slots: readonly { price: number; minLevel: ShopLevel }[]; quick: { price: number; speed: number } }

/** The most TMs any level arms at once: a replay that arms more is malformed (`parseReplay`). */
export const MAX_ARMED_TMS = Math.max(...SHOP_LEVEL_IDS.map((l) => SHOP_LEVELS[l].armedTms))
