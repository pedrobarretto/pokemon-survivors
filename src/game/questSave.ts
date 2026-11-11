import { LAKE_TRIO, SWORDS, type LakeId } from '../data/legends'
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

/** Each lake legend's share of max HP left, worn down across runs (absent: whole). */
export type Roamers = Readonly<Partial<Record<LakeId, number>>>

export const NO_ROAMERS: Roamers = {}

/** The save's `roamers`: known lake legends with a share in (0, 1). */
export const parseRoamers = (raw: unknown): Roamers =>
  isRecord(raw)
    ? Object.fromEntries(LAKE_TRIO.flatMap((id) => {
      const v = raw[id]
      return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 1 ? [[id, v]] : []
    }))
    : NO_ROAMERS

/** Both sides in one: per legend, the lower share (the HP taken on either device stays taken; safe to merge again). */
export const mergeRoamers = (a: Roamers, b: Roamers): Roamers =>
  Object.fromEntries(LAKE_TRIO.flatMap((id) => {
    const v = Math.min(a[id] ?? 1, b[id] ?? 1)
    return v < 1 ? [[id, v]] : []
  }))

/** The roamers after a visit left `legend` with `left` of its HP: never back up (a lower share stays). */
export const bankRoamer = (roamers: Roamers, legend: LakeId, left: number): Roamers => {
  const v = Math.min(roamers[legend] ?? 1, Math.max(0, left))
  return v > 0 && v < 1 ? { ...roamers, [legend]: v } : Object.fromEntries(Object.entries(roamers).filter(([id]) => id !== legend))
}

/** What a run brings along: the lake legends not caught yet with their HP left, and the Swords not caught yet. */
export const wildOf = (save: { legends: Captures; roamers: Roamers }): WildStart => ({
  lake: Object.fromEntries(LAKE_TRIO.flatMap((id) => (isCaptured(save.legends, id) ? [] : [[id, save.roamers[id] ?? 1]]))),
  swords: SWORDS.filter((id) => !isCaptured(save.legends, id)),
})
