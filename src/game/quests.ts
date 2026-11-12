import { DUEL, ROAM } from '../data/quests'
import { LAKE_TRIO, SWORDS, type LakeId, type SwordId } from '../data/legends'
import { hash2 } from '../engine/rng'
import { coopLocked } from '../data/coop'
import { createDuel, updateDuel, type DuelState } from './duels'
import { isRecord } from './parse'
import { createRoam, updateRoam, type RoamState } from './roamers'
import { ZERAORA } from '../data/mythicals'
import { createStorm, updateStorm, type StormState } from './zeraora'
import type { Game } from './types'

/**
 * The legends met on the open map: the roaming lake trio (`roamers.ts`), the
 * Swords of Justice's duels (`duels.ts`) and Zeraora's storm (`zeraora.ts`). What the save still has to
 * catch comes in with the run (`WildStart`, part of `ReplayStart`), and the
 * run's seed decides whether one shows up, apart from the run's rng: a run
 * that brings none plays exactly as one before them did. Solo only, on the
 * open map (`COOP_LOCKS`).
 */

/** The legends still free in the save as a run starts: each lake legend's share of HP left (one caught is left out) and the Swords not caught yet. */
export type WildStart = { lake: Partial<Record<LakeId, number>>; swords: readonly SwordId[] }

export const NO_WILD: WildStart = { lake: {}, swords: [] }

/** A run's roamer, duel and storm (each null when its seed didn't bring it). */
export type QuestState = { roam: RoamState | null; duel: DuelState | null; storm: StormState | null }

const SALT = 4421

/** A number 0..1 of the seed for draw `n`, apart from the run's rng. */
export const seedDraw = (seed: number, n: number) => hash2(seed, n, SALT)

/** A pick among `list` by a 0..1 draw. */
const pickBy = <T>(list: readonly T[], k: number) => list[Math.min(list.length - 1, Math.floor(k * list.length))]

/** Which free lake legend this seed brings, if any (`ROAM.odds`). */
export const rollRoamer = (seed: number, wild: WildStart): LakeId | null => {
  const free = LAKE_TRIO.filter((id) => (wild.lake[id] ?? 0) > 0)
  if (free.length === 0 || seedDraw(seed, 1) >= ROAM.odds) return null
  return pickBy(free, seedDraw(seed, 2)) ?? null
}

/** Which free Sword this seed brings, if any (`DUEL.odds`). */
export const rollSword = (seed: number, wild: WildStart): SwordId | null => {
  if (wild.swords.length === 0 || seedDraw(seed, 3) >= DUEL.odds) return null
  return pickBy(wild.swords, seedDraw(seed, 4)) ?? null
}

/** Whether this seed brings Zeraora's storm (`ZERAORA.odds`): it comes caught or not, a rematch for an owner. */
export const rollStorm = (seed: number) => seedDraw(seed, 5) < ZERAORA.odds

/** A run's quests from its seed and the save's free legends; none in co-op. */
export const createQuests = (seed: number, wild: WildStart | undefined, coop: boolean): QuestState => {
  if (coop || !wild) return { roam: null, duel: null, storm: null }
  const lake = rollRoamer(seed, wild)
  const sword = rollSword(seed, wild)
  return { roam: lake ? createRoam(seed, lake, wild.lake[lake] ?? 1) : null, duel: sword ? createDuel(sword) : null, storm: rollStorm(seed) ? createStorm() : null }
}

/** The run's roamer, duel and storm, every tick on the open map (solo). */
export const updateQuests = (g: Game, dt: number) => {
  if (coopLocked(g, 'quests') || g.versus || g.training !== null) return
  updateRoam(g, dt)
  updateDuel(g, dt)
  updateStorm(g, dt)
}

/** A replay's `wild`, or null when its shape is wrong: shares within 0..1 for known lake legends, known Swords once each. */
export const parseWild = (raw: unknown): WildStart | null => {
  if (!isRecord(raw) || !isRecord(raw.lake) || !Array.isArray(raw.swords)) return null
  const listed: unknown[] = raw.swords
  const lake: Partial<Record<LakeId, number>> = {}
  for (const [id, v] of Object.entries(raw.lake)) {
    const known = LAKE_TRIO.find((l) => l === id)
    if (!known || typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 1) return null
    lake[known] = v
  }
  const swords = SWORDS.filter((s) => listed.includes(s))
  return swords.length === listed.length ? { lake, swords } : null
}
