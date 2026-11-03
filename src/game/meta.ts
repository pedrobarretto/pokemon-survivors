import { chance, type Rng } from '../engine/rng'
import { ACHIEVEMENTS, MEDAL_EGG, MEDAL_REWARD, type AchievementId, type GiftTitleId, type TitleId } from '../data/achievements'
import { parseAttempt, type Attempt } from './attempt'
import { NO_ACHIEVEMENTS, parseAchievements, parseGiftTitles, parseTitle, recordAchievements, recordHatchAchievements, type AchievementsSave } from './achievements'
import { addClear, mergeClears, parseClears, pastClears, type Clears } from './clears'
import { EMPTY_DEX, parseDex, type Pokedex } from './dex'
import { DEFAULT_DIFFICULTY, parseDifficulty, type Difficulty } from './difficulty'
import { EGG_TIERS, EGGS, grantEgg, incubatorSlots, parseEggPity, parseEggs, parseHatched, type Egg, type EggPity, type EggTier, type Hatched } from './eggs'
import { NO_INCUBATOR, parseIncubator, type IncubatorSave } from './incubator'
import { ENDLESS, overtime } from './endless'
import { parseClaimedGifts } from './gifts'
import { NO_HALLOWEEN, parseHalloween, recordHunt, type HalloweenSave } from './halloween'
import { NO_MISSIONS, parseMissions, recordHatchMissions, recordMissions, type Mission, type MissionsSave } from './missions'
import { addToBag, EMPTY_BAG, parseBag, type Bag, type BagItem } from './bag'
import { NO_SHOP, parseShop, type ShopSave } from './shop'
import { learnTms, NO_TMS, parseTms, type TmCase } from './tmShelf'
import { parseCaps, parseEvoItems, type Caps } from './evoItems'
import { parseCaravan, type CaravanSave } from './caravan'
import { parseBuilds, type Builds } from './builds'
import type { EvoItemId } from '../data/shop'
import { isRecord, wholeNumber } from './parse'
import { parseRibbons, type Ribbon } from './ribbons'
import { NO_STYLES, parseStyle, type StyleSave } from './style'
import { NO_SHINY_STARTERS, parseShinyStarters, type ShinyStarters } from './shinyStarters'
import { parseShinyPicks, type ShinyPick } from './shinyPicks'
import { isPlayable } from './ranking'
import type { SpecialCompanionId } from '../data/companions'
import { parseCompanion, parseCompanions, type Companion } from './supporters'
import { NO_CAPTURES, parseCaptures, type Captures } from './capture'
import { BRANCHES, isBranch, type BranchId } from '../data/branches'
import type { PlayableId } from '../data/hatchlings'
import type { StatDelta } from './stats'
import type { RunSummary } from './tally'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Meta progression: Poké Dollars (₽) earned across runs and the Poké Mart's
 * permanent upgrades. Everything here is pure; persistence lives in `ui/save.ts`.
 */

type UpgradeDef = {
  /** Official English name; descriptions live in `i18n`. */
  name: string
  maxRank: number
  /** Price of the first rank; each later one costs `growth` times more (`PRICE_GROWTH` by default). */
  basePrice: number
  growth?: number
  /**
   * A stat bonus per rank, one extra per-run level-up charge per rank, or
   * better wild shiny odds (`shinyBoost` in `game/shiny.ts`).
   */
  effect: { stat: StatDelta } | { charge: 'rerolls' | 'skips' } | { odds: 'shiny' }
}

export const UPGRADES = {
  hpUp: { name: 'HP Up', maxRank: 5, basePrice: 200, effect: { stat: { maxHp: 10 } } },
  protein: { name: 'Protein', maxRank: 5, basePrice: 300, effect: { stat: { might: 0.05 } } },
  iron: { name: 'Iron', maxRank: 3, basePrice: 400, effect: { stat: { armor: 1 } } },
  carbos: { name: 'Carbos', maxRank: 3, basePrice: 250, effect: { stat: { speed: 3.4 } } },
  calcium: { name: 'Calcium', maxRank: 3, basePrice: 300, effect: { stat: { area: 0.05 } } },
  zinc: { name: 'Zinc', maxRank: 3, basePrice: 450, effect: { stat: { cooldown: -0.025 } } },
  ppUp: { name: 'PP Up', maxRank: 1, basePrice: 3000, effect: { stat: { amount: 1 } } },
  expCharm: { name: 'Exp. Charm', maxRank: 5, basePrice: 250, effect: { stat: { growth: 0.03 } } },
  amuletCoin: { name: 'Amulet Coin', maxRank: 5, basePrice: 250, effect: { stat: { greed: 0.1 } } },
  abilityCapsule: { name: 'Ability Capsule', maxRank: 3, basePrice: 500, effect: { charge: 'rerolls' } },
  escapeRope: { name: 'Escape Rope', maxRank: 3, basePrice: 300, effect: { charge: 'skips' } },
  shinyCharm: { name: 'Shiny Charm', maxRank: 3, basePrice: 6000, growth: 2, effect: { odds: 'shiny' } },
} as const satisfies Record<string, UpgradeDef>

export type UpgradeId = keyof typeof UPGRADES

export const UPGRADE_IDS = Object.keys(UPGRADES) as UpgradeId[]

export type Ranks = Readonly<Record<UpgradeId, number>>

export const NO_RANKS: Ranks = Object.fromEntries(UPGRADE_IDS.map((id) => [id, 0])) as Record<UpgradeId, number>

/* ---------------- Prices ---------------- */

const PRICE_GROWTH = 1.6

/** Price of the next rank when `rank` ranks are already owned. Rounded to ₽10. */
export const upgradePrice = (id: UpgradeId, rank: number) => {
  const def: UpgradeDef = UPGRADES[id]
  return dm.round((def.basePrice * dm.powInt(def.growth ?? PRICE_GROWTH, rank)) / 10) * 10
}

/** Everything spent on the given ranks, i.e. what a full refund gives back. */
export const totalSpent = (ranks: Ranks) =>
  UPGRADE_IDS.reduce((sum, id) => sum + Array.from({ length: ranks[id] }, (_, r) => upgradePrice(id, r)).reduce((a, b) => a + b, 0), 0)

/* ---------------- Applying ranks ---------------- */

/** One stat layer per owned rank (deltas are additive), ready for `applyDeltas`. */
export const rankDeltas = (ranks: Ranks): StatDelta[] =>
  UPGRADE_IDS.flatMap((id) => {
    const effect: UpgradeDef['effect'] = UPGRADES[id].effect
    return 'stat' in effect ? Array.from({ length: ranks[id] }, () => effect.stat) : []
  })

/** Level-up rerolls, skips and Esquecer charges a run starts with (an Escape Rope rank gives a skip and an Esquecer). */
export const runCharges = (ranks: Ranks) => ({ rerolls: ranks.abilityCapsule, skips: ranks.escapeRope, banishes: ranks.escapeRope })

/* ---------------- Save ---------------- */

export const SAVE_VERSION = 1

/**
 * Saves from before a field existed load it empty, so every field below the
 * upgrades is additive.
 */
export type Save = {
  version: typeof SAVE_VERSION
  wallet: number
  ranks: Ranks
  /** Pokédex progress (`game/dex.ts`). */
  dex: Pokedex
  /** The incubator (`game/eggs.ts`), up to `incubatorSlots` eggs. */
  eggs: readonly Egg[]
  /** The incubator's upgrades (`game/incubator.ts`): extra slots bought for good and the Quick Incubators got and used. */
  incubator: IncubatorSave
  /** Families unlocked from eggs (`game/eggs.ts`). */
  hatched: Hatched
  /** The egg pity (`game/eggs.ts`): eggs of each kind hatched in a row with no new family. */
  eggPity: EggPity
  /** Daily and weekly mission progress (`game/missions.ts`). */
  missions: MissionsSave
  /** Unlocked achievements and lifetime records (`game/achievements.ts`). */
  achievements: AchievementsSave
  /** Title shown on the title and results screens. */
  title: TitleId | null
  /** Difficulty picked last on the starter select screen. */
  difficulty: Difficulty
  /** The Pokémon of the last run started from the starter select (not the Desafio do dia's): the Trainer chip's face and the select's first pick. */
  partner: PlayableId
  /** Shiny starters unlocked by a lucky roll, and the Normal/Shiny pick of each (`game/shinyStarters.ts`). */
  shinyStarters: ShinyStarters
  /** The Bag's consumables, and the ones armed for the next run (`game/bag.ts`). */
  bag: Bag
  /** The Kecleon Shop: its level, what was bought from today's Vitrine, the gift, the wishlist and the visits (`game/shop.ts`). */
  shop: ShopSave
  /** Card frames, backgrounds and PC wallpapers owned and worn (`game/style.ts`). */
  style: StyleSave
  /** ₽ ever spent on the Vitrine and on styles: the sync counts it as part of the fortune (`game/sync.ts`). */
  spent: number
  /** Titles a Mystery Gift gave (the Ambassador's); medal titles come from `achievements`. */
  titles: readonly GiftTitleId[]
  /** Ids of the Mystery Gifts applied, so none lands twice (`game/gifts.ts`). */
  gifts: readonly string[]
  /** Desafio do dia ribbons, one per day (`game/ribbons.ts`), from Mystery Gifts. */
  ribbons: readonly Ribbon[]
  /** Shiny-of-your-choice tickets, spent or waiting (`game/shinyPicks.ts`), from Mystery Gifts. */
  shinyPicks: readonly ShinyPick[]
  /** The supporter's companion, drawn after the player in runs (`game/supporters.ts`). */
  companion: Companion | null
  /** Companions only a Mystery Gift brings (`data/companions.ts`): the Noite das Bruxas supporters' Pumpkaboo. */
  companions: readonly SpecialCompanionId[]
  /** Where each branching family evolved last (`data/branches.ts`): the Trainer Card shows that form. */
  branches: Branches
  /** The hardest difficulty each Pokémon beat Mewtwo on (`game/clears.ts`): the Pokédex and partner select badges. */
  clears: Clears
  /** The Noite das Bruxas candy jar (`game/halloween.ts`): what it holds pays the event's rewards. */
  halloween: HalloweenSave
  /** Wins toward capturing each legend for the Legend mode (`game/capture.ts`); its shiny lives in `shinyStarters`. */
  legends: Captures
  /** The TM case (`game/tmShelf.ts`): TMs bought at the shop, the ones armed for the next runs and the TM moves runs ever taught. */
  tms: TmCase
  /** Evolution items bought at the shop (`game/evoItems.ts`): each unlocks its branches (`evolutionOffers`). */
  evo: readonly EvoItemId[]
  /** Bottle Cap levels per Pokémon (`game/evoItems.ts`): every stat a bit stronger in its runs. */
  caps: Caps
  /** Meowth's weekend caravan (`game/caravan.ts`): the weekend last traded on, what was bought then and whether Meowth haggled. */
  caravan: CaravanSave
  /** The last official Desafio do dia attempt finished (`game/attempt.ts`): synced, so every device of the account shows practice after it. */
  attempt: Attempt | null
  /** Builds planned at the Dojo (`game/builds.ts`), one per family: the level-up screen marks the cards that follow one. */
  builds: Builds
}

/** The branch each branching family took in its latest run that got there. */
export type Branches = Partial<Record<PlayableId, BranchId>>

/** Saved branches, keeping only branches of the family they're saved under. */
export const parseBranches = (raw: unknown): Branches =>
  isRecord(raw)
    ? Object.fromEntries(
        Object.entries(raw).filter(([id, branch]) => isPlayable(id) && isBranch(branch) && BRANCHES[branch].line === id),
      )
    : {}

/** The partner of a save that never started a run. */
export const DEFAULT_PARTNER: PlayableId = 'charmander'

export const EMPTY_SAVE: Save = {
  version: SAVE_VERSION,
  wallet: 0,
  ranks: NO_RANKS,
  dex: EMPTY_DEX,
  eggs: [],
  incubator: NO_INCUBATOR,
  hatched: {},
  eggPity: {},
  missions: NO_MISSIONS,
  achievements: NO_ACHIEVEMENTS,
  title: null,
  difficulty: DEFAULT_DIFFICULTY,
  partner: DEFAULT_PARTNER,
  shinyStarters: NO_SHINY_STARTERS,
  bag: EMPTY_BAG,
  shop: NO_SHOP,
  style: NO_STYLES,
  spent: 0,
  titles: [],
  gifts: [],
  ribbons: [],
  shinyPicks: [],
  companion: null,
  companions: [],
  branches: {},
  clears: {},
  halloween: NO_HALLOWEEN,
  legends: NO_CAPTURES,
  tms: NO_TMS,
  evo: [],
  caps: {},
  // Spelled out (not `NO_CARAVAN`): `game/caravan.ts` reaches this module back through the save's helpers.
  caravan: { week: '', bought: [], haggled: false },
  attempt: null,
  builds: {},
}

/** Brings any older save shape up to the current version. Add a case per schema bump. */
const migrate = (data: Record<string, unknown>): Record<string, unknown> | null => {
  switch (data.version) {
    case SAVE_VERSION:
      return data
    default:
      return null
  }
}

/**
 * Parses raw `localStorage` text into a valid save. Never throws: corrupt JSON
 * falls back to an empty save (see `parseSaveData`).
 */
export const parseSave = (raw: string | null): Save => {
  try {
    return parseSaveData(raw === null ? null : JSON.parse(raw))
  } catch {
    return EMPTY_SAVE
  }
}

/**
 * Turns untrusted save data (`localStorage`, a request body) into a valid save.
 * Unknown versions or bad fields fall back to safe defaults, unknown upgrades
 * are dropped and ranks are clamped to each upgrade's max. Each field parses
 * on its own, so a save from before a field existed just gets it empty.
 */
export const parseSaveData = (json: unknown): Save => {
  const data = isRecord(json) ? migrate(json) : null
  if (!data) return EMPTY_SAVE
  const ranks = isRecord(data.ranks) ? data.ranks : {}
  const achievements = parseAchievements(data.achievements)
  const titles = parseGiftTitles(data.titles)
  const incubator = parseIncubator(data.incubator)
  return {
    version: SAVE_VERSION,
    wallet: wholeNumber(data.wallet),
    ranks: Object.fromEntries(UPGRADE_IDS.map((id) => [id, wholeNumber(ranks[id], UPGRADES[id].maxRank)])) as Record<UpgradeId, number>,
    dex: parseDex(data.dex),
    eggs: parseEggs(data.eggs, incubatorSlots({ incubator })),
    incubator,
    hatched: parseHatched(data.hatched),
    eggPity: parseEggPity(data.eggPity),
    missions: parseMissions(data.missions),
    achievements,
    title: parseTitle(data.title, achievements.unlocked, titles),
    difficulty: parseDifficulty(data.difficulty),
    partner: isPlayable(data.partner) ? data.partner : DEFAULT_PARTNER,
    shinyStarters: parseShinyStarters(data.shinyStarters),
    bag: parseBag(data.bag),
    // A save from before the Kecleon Shop brings its Balcão do dia counts.
    shop: parseShop(data.shop, data.counter),
    style: parseStyle(data.style),
    spent: wholeNumber(data.spent),
    titles,
    gifts: parseClaimedGifts(data.gifts),
    ribbons: parseRibbons(data.ribbons),
    shinyPicks: parseShinyPicks(data.shinyPicks),
    companion: parseCompanion(data.companion),
    companions: parseCompanions(data.companions),
    branches: parseBranches(data.branches),
    // Plus the clears the lifetime records prove, for wins from before clears were tracked.
    clears: mergeClears(pastClears(achievements.lifetime), parseClears(data.clears)),
    halloween: parseHalloween(data.halloween),
    legends: parseCaptures(data.legends),
    tms: parseTms(data.tms),
    evo: parseEvoItems(data.evo),
    caps: parseCaps(data.caps),
    caravan: parseCaravan(data.caravan),
    attempt: parseAttempt(data.attempt),
    builds: parseBuilds(data.builds),
  }
}

/* ---------------- Shop transactions ---------------- */

/** Buys the next rank of `id`, or returns null when maxed out or too expensive. */
export const buyUpgrade = (save: Save, id: UpgradeId): Save | null => {
  const rank = save.ranks[id]
  if (rank >= UPGRADES[id].maxRank) return null
  const price = upgradePrice(id, rank)
  if (save.wallet < price) return null
  return { ...save, wallet: save.wallet - price, ranks: { ...save.ranks, [id]: rank + 1 } }
}

/** Sells every rank back at full price. */
export const refundAll = (save: Save): Save => ({ ...save, wallet: save.wallet + totalSpent(save.ranks), ranks: NO_RANKS })

/* ---------------- Earning ₽ ---------------- */

/** Coin pickup values, from a single coin to a money bag. */
export const COIN_VALUES = [10, 50, 250] as const

export const coinTier = (value: number) => (value >= COIN_VALUES[2] ? 2 : value >= COIN_VALUES[1] ? 1 : 0)

/**
 * ₽ fainted foes drop, before greed. A regular one drops a coin with chance
 * `chance + perXp × its EXP` (a pile in `pile` of those), `endless` times that
 * past Mewtwo; shinies and bosses (Alphas too) always shower ₽. Halved when the
 * Kecleon Shop opened: runs paid faster than its shelves could take, and
 * bosses, Alphas and shinies made more of a run's coins than the regular horde.
 */
export const FOE_COINS = {
  chance: 0.0125,
  perXp: 0.005,
  pile: 0.1,
  endless: 0.5,
  shiny: [COIN_VALUES[1], COIN_VALUES[0], COIN_VALUES[0]],
  boss: [COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[1]],
} as const

/** Coins dropped by a fainted enemy (`FOE_COINS`); `endless` once the run went on past Mewtwo. */
export const coinDrops = (rng: Rng, enemy: { boss: boolean; xp: number; shiny?: boolean }, endless = false): readonly number[] => {
  if (enemy.boss) return FOE_COINS.boss
  if (enemy.shiny) return FOE_COINS.shiny
  if (!chance(rng, (FOE_COINS.chance + enemy.xp * FOE_COINS.perXp) * (endless ? FOE_COINS.endless : 1))) return []
  return [chance(rng, FOE_COINS.pile) ? COIN_VALUES[1] : COIN_VALUES[0]]
}

/** ₽ per survived minute in the run bonus, and the extra per endless minute past 15:00 (after Mewtwo). */
const BONUS_PER_MINUTE = { run: 30, endless: 30 } as const

/**
 * End-of-run bonus for surviving and fainting foes, scaled by greed (Amulet Coin).
 * Beating Mewtwo pays a lump sum; after it, every endless minute pays double
 * and every defeated Arceus a fortune, so surviving longer always pays more.
 */
export const runBonus = (run: { time: number; kills: number; victory: boolean; greed: number; reaperDefeats?: number }) => {
  const endlessMinutes = run.victory ? overtime(run.time) / 60 : 0
  const reaper = (run.reaperDefeats ?? 0) * ENDLESS.reaperBonus
  const minutes = (run.time / 60) * BONUS_PER_MINUTE.run + endlessMinutes * BONUS_PER_MINUTE.endless
  return dm.round((minutes + run.kills * 0.25 + (run.victory ? 1000 : 0) + reaper) * run.greed)
}

/** Mewtwo fell this run: on the victory screen, or still going in endless mode. */
export const wonRun = (g: Game) => g.phase === 'victory' || g.endless !== null

/** What a finished run pays out. Coins were already scaled by greed when collected. */
export const runEarnings = (g: Game) => {
  const bonus = runBonus({ time: g.time, kills: g.kills, victory: wonRun(g), greed: g.player.stats.greed, reaperDefeats: g.endless?.reaperDefeats })
  return { coins: g.coins, bonus, total: g.coins + bonus }
}

/* ---------------- Missions and achievements ---------------- */

type Progress = { missions: MissionsSave; completed: readonly Mission[] }
type Medals = { achievements: AchievementsSave; unlocked: readonly AchievementId[] }

/** Eggs earned on top of the ₽: missions with an `egg` and medals listed in `MEDAL_EGG`. */
const rewardEggs = (completed: readonly Mission[], unlocked: readonly AchievementId[]): EggTier[] => [
  ...completed.flatMap((m) => (m.egg ? [m.egg] : [])),
  ...unlocked.flatMap((id) => {
    const egg = MEDAL_EGG[ACHIEVEMENTS[id].medal]
    return egg ? [egg] : []
  }),
]

/** Reward eggs paid out in ₽ instead: `full`, the incubator had no room; `cap`, the run had its `EGGS.perRun` eggs already. */
export type ConvertedEggs = { full: EggTier[]; cap: EggTier[] }

type EggPay = { save: Save; eggs: EggTier[]; converted: ConvertedEggs }

/**
 * Puts reward eggs in the incubator (`grantEgg`: a full one pays their ₽).
 * Past `room` they are paid in ₽ too, so a run's rewards share its
 * `EGGS.perRun` with the eggs it found. `converted` says which became ₽ and why.
 */
const payEggs = (save: Save, eggs: readonly EggTier[], room: number) =>
  eggs.reduce<EggPay>(
    (acc, tier, i) => {
      const { full, cap } = acc.converted
      if (i >= room) return { ...acc, save: { ...acc.save, wallet: acc.save.wallet + EGG_TIERS[tier].refund }, converted: { full, cap: [...cap, tier] } }
      const granted = grantEgg(acc.save, tier)
      return granted.converted.length > 0
        ? { ...acc, save: granted.save, converted: { full: [...full, tier], cap } }
        : { ...acc, save: granted.save, eggs: [...acc.eggs, tier] }
    },
    { save, eggs: [], converted: { full: [], cap: [] } },
  )

/**
 * Saves the boards and records, and pays every mission completed and medal earned (₽, then items into the bag, then eggs).
 * `reward` is the ₽ of the missions and medals; the eggs that didn't fit (`converted`) pay theirs on top.
 */
const settle = (save: Save, m: Progress, a: Medals, eggRoom: number) => {
  const coins = m.completed.reduce((sum, mission) => sum + mission.reward, 0) + a.unlocked.reduce((sum, id) => sum + MEDAL_REWARD[ACHIEVEMENTS[id].medal], 0)
  const items = m.completed.flatMap((mission): BagItem[] => (mission.item ? [mission.item] : []))
  const bag = items.reduce((b, id) => addToBag(b, id), save.bag)
  const paid = payEggs({ ...save, wallet: save.wallet + coins, bag, missions: m.missions, achievements: a.achievements }, rewardEggs(m.completed, a.unlocked), eggRoom)
  return { save: paid.save, completed: m.completed, unlocked: a.unlocked, reward: coins, eggs: paid.eggs, converted: paid.converted, items }
}

/**
 * Records a run (or what changed since `before`, the snapshot already recorded
 * for it) into the missions, lifetime records, clears, the Caça aos Fantasmas
 * and the TM shelf's list of TMs found in runs, and pays the rewards. `save`
 * already has the run's Pokédex log; `eggRoom` is how many reward eggs the run
 * can still take (`EGGS.perRun` minus the eggs it found or got already).
 */
export const recordRun = (save: Save, summary: RunSummary, before: RunSummary | null, date: Date, eggRoom: number = EGGS.perRun) => {
  const m = recordMissions(save.missions, summary, before, date)
  const ticked = { ...save, clears: addClear(save.clears, summary), halloween: recordHunt(save.halloween, summary.nightBosses), tms: learnTms(save.tms, summary.tms) }
  return settle(ticked, m, recordAchievements(save.achievements, summary, before, m.completed.length, save.dex), eggRoom)
}

/** Records a hatched egg (`save` already has it hatched) into the missions and records, and pays the rewards. */
export const recordHatch = (save: Save, shiny: boolean, date: Date) => {
  const m = recordHatchMissions(save.missions, date)
  return settle(save, m, recordHatchAchievements(save.achievements, shiny, m.completed.length, save.dex), Infinity)
}

export type RunRecord = ReturnType<typeof recordRun>
