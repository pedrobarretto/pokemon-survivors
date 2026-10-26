import type { BiomeId, WeatherId } from '../data/biomes'
import type { EnemyId } from '../data/enemies'
import { evolvedFrom } from '../data/evolutions'
import type { RiftLegend } from '../data/rifts'
import type { PlaceId } from '../data/places'
import type { PlayableId } from '../data/hatchlings'
import type { PokeType } from '../data/types'
import type { Difficulty } from './difficulty'
import { toSteps } from './eggs'
import { wonRun } from './meta'
import type { MapEventNotice } from './mapEvents'
import type { MoveId } from './moves'
import type { Enemy, Game } from './types'

/**
 * Run statistics for missions and achievements. The simulation only bumps a
 * few counters at rare moments (a faint, a map event notice), never per tick;
 * the shell reads them through `summarizeRun` when the run ends.
 */
export type RunTally = {
  /** Faints per enemy type (a dual-type enemy counts for both). */
  killsByType: Partial<Record<PokeType, number>>
  killsByWeather: Partial<Record<WeatherId, number>>
  killsByBiome: Partial<Record<BiomeId, number>>
  shinyKills: number
  /** World bosses, rift legendaries and Arceus. */
  bossKills: number
  /** Shiny bosses: only rift legendaries can be. */
  shinyBossKills: number
  /** Enemies with a behavior trait (healer, kamikaze…). */
  traitKills: number
  /** Pokémon of the day's outbreak. */
  outbreakKills: number
  /** Alpha Pokémon (`alphas.ts`), which aren't bosses here. */
  alphaKills: number
  /** Map event notices heard, by kind (`chestOpen`, `payDay`, `altar`…). */
  notices: Partial<Record<MapEventNotice['kind'], number>>
  /** Legendary bosses beaten, by species: how many times, and how many of them shiny (capturing them, Legend mode). */
  legendWins: Partial<Record<EnemyId, LegendWins>>
  /** Noite das Bruxas night bosses beaten in a haunted run, in order (`nightBossDown`): the Caça aos Fantasmas checklist. */
  nightBosses: EnemyId[]
  /** TM moves learned (or raised) from a disc or a Move Tutor, in order (`tms.ts`): the save lists them on the shop's TM shelf for good. */
  tms: MoveId[]
}

/** A legendary's defeats in a run. */
export type LegendWins = { beaten: number; shiny: number }

export const createTally = (): RunTally => ({
  killsByType: {},
  killsByWeather: {},
  killsByBiome: {},
  shinyKills: 0,
  bossKills: 0,
  shinyBossKills: 0,
  traitKills: 0,
  outbreakKills: 0,
  alphaKills: 0,
  notices: {},
  legendWins: {},
  nightBosses: [],
  tms: [],
})

const bump = <K extends string>(counts: Partial<Record<K, number>>, key: K) => {
  counts[key] = (counts[key] ?? 0) + 1
}

/** Counts a fainted enemy, with the weather and biome it fell in and the run's outbreak species. */
export const countKill = (tally: RunTally, e: Enemy, weather: WeatherId, biome: BiomeId, outbreak: EnemyId | null) => {
  for (const type of e.types) bump(tally.killsByType, type)
  bump(tally.killsByWeather, weather)
  bump(tally.killsByBiome, biome)
  if (e.shiny) tally.shinyKills++
  // An Alpha is a boss to the combat rules only.
  if (e.boss && !e.alpha) tally.bossKills++
  if (e.alpha) tally.alphaKills++
  if (e.boss && e.shiny) tally.shinyBossKills++
  if (e.trait.act) tally.traitKills++
  if (e.kind === outbreak) tally.outbreakKills++
}

export const countNotice = (tally: RunTally, notice: MapEventNotice) => bump(tally.notices, notice.kind)

/** Counts a legendary boss's defeat (rift, trio, mythical, Mewtwo, Arceus). */
export const countLegend = (tally: RunTally, legend: EnemyId, shiny: boolean) => {
  const wins = tally.legendWins[legend] ?? { beaten: 0, shiny: 0 }
  tally.legendWins[legend] = { beaten: wins.beaten + 1, shiny: wins.shiny + (shiny ? 1 : 0) }
}

/** Everything missions and achievements need to know about a run, as plain data. */
export type RunSummary = {
  /** The Pokémon played: a starter or a hatched family. */
  starter: PlayableId
  /** What the ranking files the run under: each level has its own board. */
  difficulty: Difficulty
  /** The 1/64 roll hit (a shiny picked on the select screen doesn't count). */
  shinyStarter: boolean
  /** Seconds survived, endless overtime included. */
  time: number
  level: number
  /** Evolution stage reached (2 = final). */
  stage: number
  /** Mewtwo fell (victory screen or endless mode). */
  victory: boolean
  kills: number
  /** ₽ picked up during the run (the end bonus not included). */
  coins: number
  shinyKills: number
  /** Pokémon of the day's outbreak defeated. */
  outbreakKills: number
  bossKills: number
  shinyLegends: number
  traitKills: number
  chests: number
  meowths: number
  altars: number
  /** Rift legendaries beaten, in order. */
  legends: readonly RiftLegend[]
  /** Places whose goal was reached (`place.ts`), in order, and how many. */
  places: readonly PlaceId[]
  placeClears: number
  /** Landmark treasures opened (`landmarks.ts`). */
  landmarks: number
  /** Times Mew showed up from under the truck by the pier (`sightMew`). */
  mews: number
  reaperDefeats: number
  /** Moves evolved with their paired held item. */
  moveEvolutions: number
  /** Times the player Mega Evolved. */
  megas: number
  /** Alpha Pokémon defeated. */
  alphaKills: number
  /** Steps walked (`toSteps`). */
  steps: number
  /** Different species seen (the run's Pokédex log). */
  species: number
  killsByType: Partial<Record<PokeType, number>>
  killsByWeather: Partial<Record<WeatherId, number>>
  killsByBiome: Partial<Record<BiomeId, number>>
  /** Legendary bosses beaten, by species (`countLegend`): the save counts them toward capturing each one. */
  legendWins: Partial<Record<EnemyId, LegendWins>>
  /** Night bosses beaten in a haunted run, in order: the save ticks them off its Caça aos Fantasmas (`recordHunt`). */
  nightBosses: readonly EnemyId[]
  /** TM moves the run learned (`RunTally.tms`): the shop's TM shelf lists them for good (`learnTms`). */
  tms: readonly MoveId[]
}

/** Snapshot of a run for missions and achievements. Safe to take again later: recording works on deltas. */
export const summarizeRun = (g: Game): RunSummary => {
  const t = g.tally
  return {
    starter: g.player.starter,
    difficulty: g.difficulty,
    shinyStarter: g.player.luckyShiny,
    time: g.time,
    level: g.player.level,
    stage: g.player.stage,
    victory: wonRun(g),
    kills: g.kills,
    coins: g.coins,
    shinyKills: t.shinyKills,
    outbreakKills: t.outbreakKills,
    bossKills: t.bossKills,
    shinyLegends: t.shinyBossKills,
    traitKills: t.traitKills,
    chests: t.notices.chestOpen ?? 0,
    meowths: t.notices.payDay ?? 0,
    altars: t.notices.altar ?? 0,
    legends: [...g.rift.cleared],
    places: [...g.place.cleared],
    placeClears: g.place.cleared.length,
    landmarks: g.landmarks.opened,
    mews: g.landmarks.mew.size,
    reaperDefeats: g.endless?.reaperDefeats ?? 0,
    moveEvolutions: g.player.moves.filter((m) => evolvedFrom(m.id)).length,
    megas: g.player.mega.count,
    alphaKills: t.alphaKills,
    steps: toSteps(g.player.walked),
    species: g.dexLog.seen.size,
    killsByType: { ...t.killsByType },
    killsByWeather: { ...t.killsByWeather },
    killsByBiome: { ...t.killsByBiome },
    legendWins: { ...t.legendWins },
    nightBosses: [...t.nightBosses],
    tms: [...t.tms],
  }
}
