import type { EggTier } from '../game/eggs'
import { RIFT_LEGENDS } from './rifts'

/**
 * Achievements: lifetime goals with a bronze, silver or gold medal. Names,
 * titles and goal lines live in `i18n` (`achievements`); the rules in
 * `game/achievements.ts`. Some grant a title the player can show off.
 */

export const MEDALS = ['bronze', 'silver', 'gold'] as const

export type Medal = (typeof MEDALS)[number]

/** ₽ paid when a medal is earned. */
export const MEDAL_REWARD = { bronze: 100, silver: 500, gold: 2000 } as const satisfies Record<Medal, number>

/** Egg given on top of the ₽ (through `grantEgg`, so a full incubator pays it out instead). */
export const MEDAL_EGG: Partial<Record<Medal, EggTier>> = { gold: 'rare' }

/** Lifetime numbers an achievement can track (see `statValue` in `game/achievements.ts`). */
export type AchievementStat =
  | 'runs' | 'kills' | 'bestMinutes' | 'bestLevel' | 'finalStages'
  | 'wins' | 'trio' | 'regions' | 'starters'
  | 'shinyKills' | 'shinyStarters' | 'shinyLegends'
  | 'rifts' | 'legends' | 'overtimeMinutes' | 'reaperDefeats'
  | 'bossKills' | 'chests' | 'meowths' | 'altars' | 'coins' | 'moveEvolutions' | 'missions'
  | 'dexSeen' | 'starterLines' | 'hatches' | 'shinyHatches' | 'megas' | 'alphaKills'

export type AchievementDef = {
  medal: Medal
  /** Unlocks a title the player can pick. */
  title?: true
} & ({ stat: AchievementStat; target: number } | { stat: 'region'; gen: number })

/** Beat Mewtwo with a starter from the region of `gen`. */
const region = (gen: number) => ({ medal: 'silver', stat: 'region', gen }) as const

/** In list order: from first steps to feats. */
export const ACHIEVEMENTS = {
  firstRun: { medal: 'bronze', stat: 'runs', target: 1 },
  regular: { medal: 'silver', stat: 'runs', target: 25 },
  veteran: { medal: 'gold', stat: 'runs', target: 100, title: true },
  kills1k: { medal: 'bronze', stat: 'kills', target: 1000 },
  kills10k: { medal: 'silver', stat: 'kills', target: 10_000 },
  kills100k: { medal: 'gold', stat: 'kills', target: 100_000, title: true },
  survive5: { medal: 'bronze', stat: 'bestMinutes', target: 5 },
  survive10: { medal: 'bronze', stat: 'bestMinutes', target: 10 },
  finalForm: { medal: 'bronze', stat: 'finalStages', target: 1 },
  level30: { medal: 'bronze', stat: 'bestLevel', target: 30 },
  level50: { medal: 'silver', stat: 'bestLevel', target: 50 },
  moveEvo: { medal: 'bronze', stat: 'moveEvolutions', target: 1 },
  moveEvo50: { medal: 'silver', stat: 'moveEvolutions', target: 50 },
  boss10: { medal: 'bronze', stat: 'bossKills', target: 10 },
  boss100: { medal: 'silver', stat: 'bossKills', target: 100 },
  chests10: { medal: 'bronze', stat: 'chests', target: 10 },
  meowths5: { medal: 'bronze', stat: 'meowths', target: 5 },
  altars25: { medal: 'bronze', stat: 'altars', target: 25 },
  coins10k: { medal: 'bronze', stat: 'coins', target: 10_000 },
  coins100k: { medal: 'silver', stat: 'coins', target: 100_000 },
  coins1m: { medal: 'gold', stat: 'coins', target: 1_000_000, title: true },
  starters9: { medal: 'bronze', stat: 'starters', target: 9 },
  starters27: { medal: 'silver', stat: 'starters', target: 27, title: true },
  missions10: { medal: 'bronze', stat: 'missions', target: 10 },
  missions100: { medal: 'gold', stat: 'missions', target: 100, title: true },
  shiny1: { medal: 'bronze', stat: 'shinyKills', target: 1 },
  shiny10: { medal: 'silver', stat: 'shinyKills', target: 10 },
  shiny50: { medal: 'gold', stat: 'shinyKills', target: 50, title: true },
  shinyStarter: { medal: 'silver', stat: 'shinyStarters', target: 1, title: true },
  dex100: { medal: 'silver', stat: 'dexSeen', target: 100 },
  /** Every form of the 27 starter lines caught, i.e. each one taken to its final evolution. */
  starterLines: { medal: 'gold', stat: 'starterLines', target: 81, title: true },
  firstHatch: { medal: 'bronze', stat: 'hatches', target: 1 },
  shinyHatch: { medal: 'gold', stat: 'shinyHatches', target: 1, title: true },
  rift1: { medal: 'bronze', stat: 'rifts', target: 1 },
  rift25: { medal: 'silver', stat: 'rifts', target: 25 },
  mega1: { medal: 'bronze', stat: 'megas', target: 1 },
  mega25: { medal: 'silver', stat: 'megas', target: 25 },
  alpha1: { medal: 'bronze', stat: 'alphaKills', target: 1 },
  alpha25: { medal: 'silver', stat: 'alphaKills', target: 25 },
  alpha100: { medal: 'gold', stat: 'alphaKills', target: 100, title: true },
  /** Every rift legendary beaten at least once (unlocked ones stay unlocked when the list grows). */
  legends: { medal: 'gold', stat: 'legends', target: RIFT_LEGENDS.length, title: true },
  shinyLegend: { medal: 'gold', stat: 'shinyLegends', target: 1 },
  champion: { medal: 'silver', stat: 'wins', target: 1, title: true },
  wins10: { medal: 'gold', stat: 'wins', target: 10 },
  trio: { medal: 'silver', stat: 'trio', target: 3 },
  kanto: region(1),
  johto: region(2),
  hoenn: region(3),
  sinnoh: region(4),
  unova: region(5),
  kalos: region(6),
  alola: region(7),
  galar: region(8),
  paldea: region(9),
  regions: { medal: 'gold', stat: 'regions', target: 9, title: true },
  endless: { medal: 'silver', stat: 'overtimeMinutes', target: 1 },
  reaperSurvivor: { medal: 'gold', stat: 'overtimeMinutes', target: 10 },
  reaperDown: { medal: 'gold', stat: 'reaperDefeats', target: 1, title: true },
} as const satisfies Record<string, AchievementDef>

export type AchievementId = keyof typeof ACHIEVEMENTS

export const ACHIEVEMENT_IDS = Object.keys(ACHIEVEMENTS) as AchievementId[]

/** Achievements that grant a title. */
export type MedalTitleId = { [K in AchievementId]: (typeof ACHIEVEMENTS)[K] extends { title: true } ? K : never }[AchievementId]

/**
 * Titles that only come as a Mystery Gift (`game/gifts.ts`), kept in the save's `titles`:
 * the Ambassador's for bringing friends (`game/referral.ts`), the Supporter's for donating (`game/supporters.ts`),
 * the Creator's for streaming or making videos of the game (sent from the admin desk, `data/creators.ts`).
 */
export const GIFT_TITLES = ['ambassador', 'supporter', 'creator'] as const

export type GiftTitleId = (typeof GIFT_TITLES)[number]

/** Every title a player can wear: from a medal or from a gift. */
export type TitleId = MedalTitleId | GiftTitleId

export const MEDAL_TITLE_IDS = ACHIEVEMENT_IDS.filter((id): id is MedalTitleId => 'title' in ACHIEVEMENTS[id])

export const TITLE_IDS: readonly TitleId[] = [...GIFT_TITLES, ...MEDAL_TITLE_IDS]
