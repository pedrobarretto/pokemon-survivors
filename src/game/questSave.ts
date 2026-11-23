import { FORCE_LEGENDS, LAKE_TRIO, LEGENDS, ROAMER_IDS, SWORDS, type ForceId, type LegendUnlock, type RoamerId } from '../data/legends'
import { DIFFICULTY_IDS, type Difficulty } from './difficulty'
import type { Captures } from './capture'
import { isCaptured } from './capture'
import { isRecord } from './parse'
import type { WildStart } from './quests'

/**
 * The save's side of the legends met on the open map, shared with the API:
 * each roaming lake legend's HP carried from run to run (`Save.roamers`, the
 * share of its max HP left; absent is whole), and what a run brings along of
 * them (`wildOf`). A legend caught leaves the run's draw; its capture lives in
 * `Save.legends` like any other. Pure.
 */

/** Each roaming legend's share of max HP left (the lake trio's, the Forces of Nature's), worn down across runs (absent: whole). */
export type Roamers = Readonly<Partial<Record<RoamerId, number>>>

export const NO_ROAMERS: Roamers = {}

/** The save's `roamers`: known roaming legends with a share in (0, 1). */
export const parseRoamers = (raw: unknown): Roamers =>
  isRecord(raw)
    ? Object.fromEntries(ROAMER_IDS.flatMap((id) => {
      const v = raw[id]
      return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1 ? [[id, v]] : []
    }))
    : NO_ROAMERS

/** Both sides in one: per legend, the lower share (the HP taken on either device stays taken; safe to merge again). */
export const mergeRoamers = (a: Roamers, b: Roamers): Roamers =>
  Object.fromEntries(ROAMER_IDS.flatMap((id) => {
    const v = Math.min(a[id] ?? 1, b[id] ?? 1)
    return v < 1 ? [[id, v]] : []
  }))

/** The roamers after a visit left `legend` with `left` of its HP: never back up (a lower share stays). */
export const bankRoamer = (roamers: Roamers, legend: RoamerId, left: number): Roamers => {
  const v = Math.min(roamers[legend] ?? 1, Math.max(0, left))
  return v > 0 && v < 1 ? { ...roamers, [legend]: v } : Object.fromEntries(Object.entries(roamers).filter(([id]) => id !== legend))
}

/** Whether a Force of Nature may show: not caught yet, and the Forces it waits for are (Landorus after Tornadus and Thundurus, Enamorus after all three). */
export const forceDue = (legends: Captures, id: ForceId) => {
  const unlock: LegendUnlock = LEGENDS[id].unlock
  return !isCaptured(legends, id) && (unlock.after ?? []).every((other) => isCaptured(legends, other))
}

/** What a run brings along: the lake legends not caught yet with their HP left, the Swords not caught yet, and the Forces whose turn has come with theirs. */
export const wildOf = (save: { legends: Captures; roamers: Roamers }): WildStart => {
  const forces = Object.fromEntries(FORCE_LEGENDS.flatMap((id) => (forceDue(save.legends, id) ? [[id, save.roamers[id] ?? 1]] : [])))
  return {
    lake: Object.fromEntries(LAKE_TRIO.flatMap((id) => (isCaptured(save.legends, id) ? [] : [[id, save.roamers[id] ?? 1]]))),
    swords: SWORDS.filter((id) => !isCaptured(save.legends, id)),
    ...(Object.keys(forces).length > 0 ? { forces } : {}),
  }
}

/** Hoopa's Rings cleared: each level's best time in seconds (a level cleared has one). */
export type RushBest = Readonly<Partial<Record<Difficulty, number>>>

export const NO_RUSH: RushBest = {}

export const parseRushBest = (raw: unknown): RushBest =>
  isRecord(raw)
    ? Object.fromEntries(DIFFICULTY_IDS.flatMap((d) => {
      const v = raw[d]
      return typeof v === 'number' && Number.isFinite(v) && v > 0 ? [[d, v]] : []
    }))
    : NO_RUSH

/** Both sides in one: each level's faster time. */
export const mergeRushBest = (a: RushBest, b: RushBest): RushBest =>
  Object.fromEntries(DIFFICULTY_IDS.flatMap((d) => {
    const v = Math.min(a[d] ?? Infinity, b[d] ?? Infinity)
    return Number.isFinite(v) ? [[d, v]] : []
  }))

/** The best times after clearing `difficulty` in `seconds`, and whether it's a record. */
export const recordRush = (best: RushBest, difficulty: Difficulty, seconds: number): { best: RushBest; record: boolean } => {
  const was = best[difficulty]
  const record = was === undefined || seconds < was
  return { best: record ? { ...best, [difficulty]: seconds } : best, record }
}
