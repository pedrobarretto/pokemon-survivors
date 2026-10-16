import type { BiomeId, WeatherId } from '../data/biomes'
import type { EnemyId } from '../data/enemies'
import { evolvedFrom } from '../data/evolutions'
import type { RiftLegend } from '../data/rifts'
import type { PlayableId } from '../data/hatchlings'
import type { PokeType } from '../data/types'
import type { Difficulty } from './difficulty'
import { toSteps } from './eggs'
import { wonRun } from './meta'
import type { MapEventNotice } from './mapEvents'
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
  /** Map event notices heard, by kind (`chestOpen`, `payDay`, `altar`…). */
  notices: Partial<Record<MapEventNotice['kind'], number>>
}

export const createTally = (): RunTally => ({
  killsByType: {},
  killsByWeather: {},
  killsByBiome: {},
  shinyKills: 0,
  bossKills: 0,
  shinyBossKills: 0,
  traitKills: 0,
  outbreakKills: 0,
  notices: {},
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
  if (e.boss) tally.bossKills++
  if (e.boss && e.shiny) tally.shinyBossKills++
  if (e.trait.act) tally.traitKills++
  if (e.kind === outbreak) tally.outbreakKills++
}

export const countNotice = (tally: RunTally, notice: MapEventNotice) => bump(tally.notices, notice.kind)

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
  reaperDefeats: number
  /** Moves evolved with their paired held item. */
  moveEvolutions: number
  /** Times the player Mega Evolved. */
  megas: number
  /** Steps walked (`toSteps`). */
  steps: number
  /** Different species seen (the run's Pokédex log). */
  species: number
  killsByType: Partial<Record<PokeType, number>>
  killsByWeather: Partial<Record<WeatherId, number>>
  killsByBiome: Partial<Record<BiomeId, number>>
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
    reaperDefeats: g.endless?.reaperDefeats ?? 0,
    moveEvolutions: g.player.moves.filter((m) => evolvedFrom(m.id)).length,
    megas: g.player.mega.count,
    steps: toSteps(g.player.walked),
    species: g.dexLog.seen.size,
    killsByType: { ...t.killsByType },
    killsByWeather: { ...t.killsByWeather },
    killsByBiome: { ...t.killsByBiome },
  }
}
