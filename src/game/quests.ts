import { DUEL, ROAM } from '../data/quests'
import { FORCE_ROAM } from '../data/forces'
import { FORCE_LEGENDS, LAKE_TRIO, SWORDS, type ForceId, type LakeId, type SwordId } from '../data/legends'
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

/**
 * The legends still free in the save as a run starts: each lake legend's
 * share of HP left (one caught is left out), the Swords not caught yet, and
 * each Force of Nature's share that may show (`forces`: only those whose
 * turn has come, `wildOf`; absent in replays from before them).
 */
export type WildStart = { lake: Partial<Record<LakeId, number>>; swords: readonly SwordId[]; forces?: Partial<Record<ForceId, number>> }

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

/** Which free Force of Nature this seed brings, if any (`FORCE_ROAM.odds`): only in a run whose seed brought no lake legend, so the lake trio's draws stay as they were. */
export const rollForce = (seed: number, wild: WildStart): ForceId | null => {
  const free = FORCE_LEGENDS.filter((id) => (wild.forces?.[id] ?? 0) > 0)
  if (free.length === 0 || rollRoamer(seed, wild) !== null || seedDraw(seed, 6) >= FORCE_ROAM.odds) return null
  return pickBy(free, seedDraw(seed, 7)) ?? null
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
  const force = rollForce(seed, wild)
  const sword = rollSword(seed, wild)
  const roam = lake ? createRoam(seed, lake, wild.lake[lake] ?? 1) : force ? createRoam(seed, force, wild.forces?.[force] ?? 1) : null
  return { roam, duel: sword ? createDuel(sword) : null, storm: rollStorm(seed) ? createStorm() : null }
}

/** The run's roamer, duel and storm, every tick on the open map (solo). */
export const updateQuests = (g: Game, dt: number) => {
  if (coopLocked(g, 'quests') || g.versus || g.training !== null) return
  updateRoam(g, dt)
  updateDuel(g, dt)
  updateStorm(g, dt)
}

/** Shares within 0..1 for known ids of `ids`, or null when one is off. */
const parseShares = <K extends string>(raw: Record<string, unknown>, ids: readonly K[]): Partial<Record<K, number>> | null => {
  const out: Partial<Record<K, number>> = {}
  for (const [id, v] of Object.entries(raw)) {
    const known = ids.find((l) => l === id)
    if (!known || typeof v !== 'number' || !Number.isFinite(v) || v <= 0 || v > 1) return null
    out[known] = v
  }
  return out
}

/** A replay's `wild`, or null when its shape is wrong: shares within 0..1 for known lake legends (and Forces, when listed), known Swords once each. */
export const parseWild = (raw: unknown): WildStart | null => {
  if (!isRecord(raw) || !isRecord(raw.lake) || !Array.isArray(raw.swords)) return null
  if (raw.forces !== undefined && !isRecord(raw.forces)) return null
  const listed: unknown[] = raw.swords
  const lake = parseShares(raw.lake, LAKE_TRIO)
  const forces = isRecord(raw.forces) ? parseShares(raw.forces, FORCE_LEGENDS) : {}
  if (!lake || !forces) return null
  const swords = SWORDS.filter((s) => listed.includes(s))
  if (swords.length !== listed.length) return null
  return Object.keys(forces).length > 0 ? { lake, swords, forces } : { lake, swords }
}
