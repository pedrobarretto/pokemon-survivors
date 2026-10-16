import { chance, type Rng } from '../engine/rng'
import { ACHIEVEMENTS, MEDAL_EGG, MEDAL_REWARD, type AchievementId, type GiftTitleId, type TitleId } from '../data/achievements'
import { NO_ACHIEVEMENTS, parseAchievements, parseGiftTitles, parseTitle, recordAchievements, recordHatchAchievements, type AchievementsSave } from './achievements'
import { EMPTY_DEX, parseDex, type Pokedex } from './dex'
import { DEFAULT_DIFFICULTY, parseDifficulty, type Difficulty } from './difficulty'
import { EGG_TIERS, EGGS, grantEgg, parseEggs, parseHatched, type Egg, type EggTier, type Hatched } from './eggs'
import { ENDLESS, overtime } from './endless'
import { parseClaimedGifts } from './gifts'
import { NO_MISSIONS, parseMissions, recordHatchMissions, recordMissions, type Mission, type MissionsSave } from './missions'
import { addToBag, EMPTY_BAG, parseBag, type Bag, type BagItem } from './bag'
import { NO_COUNTER, parseCounter, type CounterSave } from './mart'
import { isRecord, wholeNumber } from './parse'
import { parseRibbons, type Ribbon } from './ribbons'
import { NO_STYLES, parseStyle, type StyleSave } from './style'
import { NO_SHINY_STARTERS, parseShinyStarters, type ShinyStarters } from './shinyStarters'
import type { StatDelta } from './stats'
import type { RunSummary } from './tally'
import type { Game } from './types'

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

/** Ranks from untrusted data, each clamped to its upgrade's max (unknown or missing ones are 0). */
export const parseRanks = (v: unknown): Ranks => {
  const ranks = isRecord(v) ? v : {}
  return Object.fromEntries(UPGRADE_IDS.map((id) => [id, wholeNumber(ranks[id], UPGRADES[id].maxRank)])) as Record<UpgradeId, number>
}

/* ---------------- Prices ---------------- */

const PRICE_GROWTH = 1.6

/** Price of the next rank when `rank` ranks are already owned. Rounded to ₽10. */
export const upgradePrice = (id: UpgradeId, rank: number) => {
  const def: UpgradeDef = UPGRADES[id]
  return Math.round((def.basePrice * (def.growth ?? PRICE_GROWTH) ** rank) / 10) * 10
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

/** Level-up rerolls and skips a run starts with. */
export const runCharges = (ranks: Ranks) => ({ rerolls: ranks.abilityCapsule, skips: ranks.escapeRope })

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
  /** The incubator (`game/eggs.ts`). */
  eggs: readonly Egg[]
  /** Families unlocked from eggs (`game/eggs.ts`). */
  hatched: Hatched
  /** Daily and weekly mission progress (`game/missions.ts`). */
  missions: MissionsSave
  /** Unlocked achievements and lifetime records (`game/achievements.ts`). */
  achievements: AchievementsSave
  /** Title shown on the title and results screens. */
  title: TitleId | null
  /** Difficulty picked last on the starter select screen. */
  difficulty: Difficulty
  /** Shiny starters unlocked by a lucky roll, and the Normal/Shiny pick of each (`game/shinyStarters.ts`). */
  shinyStarters: ShinyStarters
  /** Lures and Incenses, and the ones armed for the next run (`game/bag.ts`). */
  bag: Bag
  /** What was bought from the Poké Mart's daily counter today (`game/mart.ts`). */
  counter: CounterSave
  /** Card frames, backgrounds and PC wallpapers owned and worn (`game/style.ts`). */
  style: StyleSave
  /** ₽ ever spent at the counter and on styles: the sync counts it as part of the fortune (`game/sync.ts`). */
  spent: number
  /** Titles a Mystery Gift gave (the Ambassador's); medal titles come from `achievements`. */
  titles: readonly GiftTitleId[]
  /** Ids of the Mystery Gifts applied, so none lands twice (`game/gifts.ts`). */
  gifts: readonly string[]
  /** Desafio do dia ribbons, one per day (`game/ribbons.ts`), from Mystery Gifts. */
  ribbons: readonly Ribbon[]
}

export const EMPTY_SAVE: Save = {
  version: SAVE_VERSION,
  wallet: 0,
  ranks: NO_RANKS,
  dex: EMPTY_DEX,
  eggs: [],
  hatched: {},
  missions: NO_MISSIONS,
  achievements: NO_ACHIEVEMENTS,
  title: null,
  difficulty: DEFAULT_DIFFICULTY,
  shinyStarters: NO_SHINY_STARTERS,
  bag: EMPTY_BAG,
  counter: NO_COUNTER,
  style: NO_STYLES,
  spent: 0,
  titles: [],
  gifts: [],
  ribbons: [],
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
  const achievements = parseAchievements(data.achievements)
  const titles = parseGiftTitles(data.titles)
  return {
    version: SAVE_VERSION,
    wallet: wholeNumber(data.wallet),
    ranks: parseRanks(data.ranks),
    dex: parseDex(data.dex),
    eggs: parseEggs(data.eggs),
    hatched: parseHatched(data.hatched),
    missions: parseMissions(data.missions),
    achievements,
    title: parseTitle(data.title, achievements.unlocked, titles),
    difficulty: parseDifficulty(data.difficulty),
    shinyStarters: parseShinyStarters(data.shinyStarters),
    bag: parseBag(data.bag),
    counter: parseCounter(data.counter),
    style: parseStyle(data.style),
    spent: wholeNumber(data.spent),
    titles,
    gifts: parseClaimedGifts(data.gifts),
    ribbons: parseRibbons(data.ribbons),
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
 * Coins dropped by a fainted enemy. Regular Pokémon drop one now and then
 * (tougher ones more often), shinies always pay out and bosses shower ₽.
 */
export const coinDrops = (rng: Rng, enemy: { boss: boolean; xp: number; shiny?: boolean }): number[] => {
  if (enemy.boss) return [250, 50, 50, 50, 50, 50]
  if (enemy.shiny) return [50, 50, 50]
  if (!chance(rng, 0.025 + enemy.xp * 0.01)) return []
  return [chance(rng, 0.1) ? 50 : 10]
}

/**
 * End-of-run bonus for surviving and fainting foes, scaled by greed (Amulet Coin).
 * Beating Mewtwo pays a lump sum; after it, every endless minute pays triple
 * and every defeated Arceus a fortune, so surviving longer always pays more.
 */
export const runBonus = (run: { time: number; kills: number; victory: boolean; greed: number; reaperDefeats?: number }) => {
  const endlessMinutes = run.victory ? overtime(run.time) / 60 : 0
  const reaper = (run.reaperDefeats ?? 0) * ENDLESS.reaperBonus
  return Math.round(((run.time / 60) * 30 + endlessMinutes * 60 + run.kills * 0.25 + (run.victory ? 1000 : 0) + reaper) * run.greed)
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

type EggPay = { save: Save; eggs: EggTier[]; refund: number }

/**
 * Puts reward eggs in the incubator (`grantEgg`: a full one pays their ₽).
 * Past `room` they are paid in ₽ too, so a run's rewards share its
 * `EGGS.perRun` with the eggs it found.
 */
const payEggs = (save: Save, eggs: readonly EggTier[], room: number) =>
  eggs.reduce<EggPay>(
    (acc, tier, i) => {
      if (i >= room) return { ...acc, save: { ...acc.save, wallet: acc.save.wallet + EGG_TIERS[tier].refund }, refund: acc.refund + EGG_TIERS[tier].refund }
      const granted = grantEgg(acc.save, tier)
      return { save: granted.save, eggs: granted.converted.length > 0 ? acc.eggs : [...acc.eggs, tier], refund: acc.refund + granted.refund }
    },
    { save, eggs: [], refund: 0 },
  )

/** Saves the boards and records, and pays every mission completed and medal earned (₽, then items into the bag, then eggs). */
const settle = (save: Save, m: Progress, a: Medals, eggRoom: number) => {
  const coins = m.completed.reduce((sum, mission) => sum + mission.reward, 0) + a.unlocked.reduce((sum, id) => sum + MEDAL_REWARD[ACHIEVEMENTS[id].medal], 0)
  const items = m.completed.flatMap((mission): BagItem[] => (mission.item ? [mission.item] : []))
  const bag = items.reduce((b, id) => addToBag(b, id), save.bag)
  const paid = payEggs({ ...save, wallet: save.wallet + coins, bag, missions: m.missions, achievements: a.achievements }, rewardEggs(m.completed, a.unlocked), eggRoom)
  return { save: paid.save, completed: m.completed, unlocked: a.unlocked, reward: coins + paid.refund, eggs: paid.eggs, items }
}

/**
 * Records a run (or what changed since `before`, the snapshot already recorded
 * for it) into the missions and lifetime records, and pays the rewards. `save`
 * already has the run's Pokédex log; `eggRoom` is how many reward eggs the run
 * can still take (`EGGS.perRun` minus the eggs it found or got already).
 */
export const recordRun = (save: Save, summary: RunSummary, before: RunSummary | null, date: Date, eggRoom: number = EGGS.perRun) => {
  const m = recordMissions(save.missions, summary, before, date)
  return settle(save, m, recordAchievements(save.achievements, summary, before, m.completed.length, save.dex), eggRoom)
}

/** Records a hatched egg (`save` already has it hatched) into the missions and records, and pays the rewards. */
export const recordHatch = (save: Save, shiny: boolean, date: Date) => {
  const m = recordHatchMissions(save.missions, date)
  return settle(save, m, recordHatchAchievements(save.achievements, shiny, m.completed.length, save.dex), Infinity)
}

export type RunRecord = ReturnType<typeof recordRun>
