import { ACHIEVEMENT_IDS, ACHIEVEMENTS, GIFT_TITLES, TITLE_IDS, type AchievementDef, type AchievementId, type AchievementStat, type GiftTitleId, type TitleId } from '../data/achievements'
import { isHiddenPlace, PLACE_IDS, type PlaceId } from '../data/places'
import { isStarter } from '../data/hatchlings'
import { RIFT_LEGENDS, type RiftLegend } from '../data/rifts'
import { REGIONS, STARTER_IDS, STARTERS, type StarterId } from '../data/starters'
import { POKE_TYPES, type PokeType } from '../data/types'
import { dexCounts, dexStatus, EMPTY_DEX, type Pokedex } from './dex'
import { overtime } from './endless'
import { isRecord, knownIds, wholeNumber } from './parse'
import type { RunSummary } from './tally'

/**
 * Lifetime records and the achievements they unlock. Pure: the shell
 * persists the result in the save (`achievements` and `title`).
 */

/** Run summary fields that add up over a lifetime as they are. */
const SUMMED = ['kills', 'shinyKills', 'bossKills', 'shinyLegends', 'chests', 'meowths', 'altars', 'coins', 'moveEvolutions', 'reaperDefeats', 'megas', 'alphaKills', 'placeClears', 'landmarks'] as const satisfies readonly (keyof RunSummary)[]

const COUNTERS = [...SUMMED, 'runs', 'wins', 'rifts', 'finalStages', 'shinyStarters', 'missions', 'bestTime', 'bestLevel', 'bestOvertime', 'hatches', 'shinyHatches'] as const

type Counter = (typeof COUNTERS)[number]

export type Lifetime = Readonly<Record<Counter, number>> & {
  /** Rift legendaries ever beaten. */
  legends: readonly RiftLegend[]
  /** Places ever cleared (a hidden zone counts once found and entered). */
  places: readonly PlaceId[]
  /** Generations (regions) whose starter beat Mewtwo. */
  winGens: readonly number[]
  /** Base types of the starters that beat Mewtwo. */
  winTypes: readonly PokeType[]
  /** Starters ever played. */
  starters: readonly StarterId[]
}

export const NO_LIFETIME: Lifetime = {
  ...(Object.fromEntries(COUNTERS.map((c) => [c, 0])) as Record<Counter, number>),
  legends: [],
  places: [],
  winGens: [],
  winTypes: [],
  starters: [],
}

const union = <T>(list: readonly T[], ...more: readonly T[]) => [...new Set([...list, ...more])]

const regionGen = (id: StarterId) => REGIONS.find((r) => r.starters.includes(id))?.gen ?? 0

/**
 * Adds a run to the lifetime records. Like missions, `before` is what was
 * already recorded for this same run, so only the difference counts.
 */
export const addRun = (l: Lifetime, s: RunSummary, before: RunSummary | null, missionsDone = 0): Lifetime => {
  const summed = Object.fromEntries(SUMMED.map((k) => [k, l[k] + s[k] - (before?.[k] ?? 0)])) as Record<(typeof SUMMED)[number], number>
  const won = s.victory && !before?.victory
  // Starter goals (regions, the trio, starters played) skip hatched families and legends.
  const starter = isStarter(s.starter) ? s.starter : null
  const starterWon = s.victory && starter !== null
  return {
    ...l,
    ...summed,
    runs: l.runs + (before ? 0 : 1),
    wins: l.wins + (won ? 1 : 0),
    rifts: l.rifts + s.legends.length - (before?.legends.length ?? 0),
    finalStages: l.finalStages + (s.stage >= 2 && (before?.stage ?? 0) < 2 ? 1 : 0),
    shinyStarters: l.shinyStarters + (s.shinyStarter && !before ? 1 : 0),
    missions: l.missions + missionsDone,
    bestTime: Math.max(l.bestTime, s.time),
    bestLevel: Math.max(l.bestLevel, s.level),
    bestOvertime: Math.max(l.bestOvertime, s.victory ? overtime(s.time) : 0),
    legends: union(l.legends, ...s.legends),
    places: union(l.places, ...s.places),
    winGens: starterWon ? union(l.winGens, regionGen(starter)) : l.winGens,
    winTypes: starterWon ? union(l.winTypes, ...STARTERS[starter].line[0].types.slice(0, 1)) : l.winTypes,
    starters: starter ? union(l.starters, starter) : l.starters,
  }
}

/** Every form of every starter line, for `starterLines`. */
export const STARTER_LINE_DEX = STARTER_IDS.flatMap((id) => STARTERS[id].line.map((stage) => stage.dex))

/** Where a lifetime (and the Pokédex, for its goals) stands on an achievement's stat. */
const statValue = (l: Lifetime, stat: AchievementStat, dex: Pokedex): number => {
  switch (stat) {
    case 'dexSeen': return dexCounts(dex).seen
    case 'starterLines': return STARTER_LINE_DEX.filter((n) => dexStatus(dex, n).caught).length
    case 'bestMinutes': return Math.floor(l.bestTime / 60)
    case 'overtimeMinutes': return Math.floor(l.bestOvertime / 60)
    case 'legends': return l.legends.length
    case 'places': return l.places.filter((id) => !isHiddenPlace(id)).length
    case 'hiddenZones': return l.places.filter(isHiddenPlace).length
    case 'regions': return l.winGens.length
    case 'starters': return l.starters.length
    case 'trio': return l.winTypes.filter((t) => t === 'grass' || t === 'fire' || t === 'water').length
    default: return l[stat]
  }
}

/** Progress towards an achievement, as `value` out of `target`. */
export const achievementProgress = (l: Lifetime, id: AchievementId, dex: Pokedex = EMPTY_DEX) => {
  const def: AchievementDef = ACHIEVEMENTS[id]
  if (def.stat === 'region') return { value: l.winGens.includes(def.gen) ? 1 : 0, target: 1 }
  return { value: Math.min(def.target, statValue(l, def.stat, dex)), target: def.target }
}

export type AchievementsSave = { unlocked: readonly AchievementId[]; lifetime: Lifetime }

export const NO_ACHIEVEMENTS: AchievementsSave = { unlocked: [], lifetime: NO_LIFETIME }

/** Moves the records to `lifetime` and lists the achievements that unlocks, in list order. */
const advance = (save: AchievementsSave, lifetime: Lifetime, dex: Pokedex) => {
  const unlocked = ACHIEVEMENT_IDS.filter((id) => {
    if (save.unlocked.includes(id)) return false
    const p = achievementProgress(lifetime, id, dex)
    return p.value >= p.target
  })
  return { achievements: { unlocked: [...save.unlocked, ...unlocked], lifetime }, unlocked }
}

/** Adds a run to the records and lists the achievements it unlocked. `dex` is the Pokédex with the run in it. */
export const recordAchievements = (save: AchievementsSave, s: RunSummary, before: RunSummary | null, missionsDone = 0, dex: Pokedex = EMPTY_DEX) =>
  advance(save, addRun(save.lifetime, s, before, missionsDone), dex)

/** Adds a hatched egg to the records (and `missionsDone` missions it completed); `dex` already has it caught. */
export const recordHatchAchievements = (save: AchievementsSave, shiny: boolean, missionsDone: number, dex: Pokedex) => {
  const l = save.lifetime
  return advance(save, { ...l, hatches: l.hatches + 1, shinyHatches: l.shinyHatches + (shiny ? 1 : 0), missions: l.missions + missionsDone }, dex)
}

/* ---------------- Save ---------------- */

const GENS = REGIONS.map((r) => r.gen)

/**
 * Two sets of records in one: every achievement unlocked on either side, and
 * each counter at the larger of the two (not the sum: merging the same
 * records again must change nothing). Medals were paid where they unlocked.
 */
export const mergeAchievements = (a: AchievementsSave, b: AchievementsSave): AchievementsSave => {
  const [x, y] = [a.lifetime, b.lifetime]
  return {
    unlocked: ACHIEVEMENT_IDS.filter((id) => a.unlocked.includes(id) || b.unlocked.includes(id)),
    lifetime: {
      ...(Object.fromEntries(COUNTERS.map((c) => [c, Math.max(x[c], y[c])])) as Record<Counter, number>),
      legends: knownIds([...x.legends, ...y.legends], RIFT_LEGENDS),
      places: knownIds([...x.places, ...y.places], PLACE_IDS),
      winGens: knownIds([...x.winGens, ...y.winGens], GENS),
      winTypes: knownIds([...x.winTypes, ...y.winTypes], POKE_TYPES),
      starters: knownIds([...x.starters, ...y.starters], STARTER_IDS),
    },
  }
}

/** Parses the `achievements` field of the save, field by field; anything malformed falls back to empty. */
export const parseAchievements = (raw: unknown): AchievementsSave => {
  const data = isRecord(raw) ? raw : {}
  const l = isRecord(data.lifetime) ? data.lifetime : {}
  return {
    unlocked: knownIds(data.unlocked, ACHIEVEMENT_IDS),
    lifetime: {
      ...(Object.fromEntries(COUNTERS.map((c) => [c, wholeNumber(l[c])])) as Record<Counter, number>),
      legends: knownIds(l.legends, RIFT_LEGENDS),
      places: knownIds(l.places, PLACE_IDS),
      winGens: knownIds(l.winGens, GENS),
      winTypes: knownIds(l.winTypes, POKE_TYPES),
      starters: knownIds(l.starters, STARTER_IDS),
    },
  }
}

/** The equipped title, kept only while it's owned: its achievement unlocked, or the gift (`gifts`) received. */
export const parseTitle = (raw: unknown, unlocked: readonly AchievementId[], gifts: readonly GiftTitleId[] = []): TitleId | null =>
  TITLE_IDS.find((id) => id === raw && (unlocked.some((a) => a === id) || gifts.some((g) => g === id))) ?? null

/** The save's `titles` (gift titles owned): unknown ones are dropped. */
export const parseGiftTitles = (raw: unknown): GiftTitleId[] => knownIds(raw, GIFT_TITLES)

/** Both sets of gift titles in one (a union). */
export const mergeGiftTitles = (a: readonly GiftTitleId[], b: readonly GiftTitleId[]): GiftTitleId[] => knownIds([...a, ...b], GIFT_TITLES)
