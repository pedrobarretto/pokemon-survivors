import type { Difficulty } from './difficulty'
import * as dm from '../engine/dmath'

/**
 * Pure rules of the pressure director ("tension"): a strong build earns more
 * pressure instead of silence. It watches how much the player is getting
 * hurt (`harm`) and how far into the screen the horde gets before dying
 * (`reach`): while nothing hurts, tension climbs over a minute or two, faster
 * when regulars die near the screen edge; when the player gets hurt or runs
 * low it eases off, so it settles where the player starts taking hits.
 * Tension speeds up regular spawns, brings them in just outside the screen
 * edge instead of the far ring, makes them walk faster, turns more of them
 * into elites, grows the cap a little and throws in extra rings and swarms of
 * the run's horde, all split from the same EXP. The runtime side lives in
 * `tensionSystem.ts`; not to be confused with the map events' `DIRECTOR`
 * (`mapEventRules.ts`).
 */

export type TensionState = {
  /** 0..1: how far the director has pushed toward the difficulty's peak (`TENSION_PEAK`). */
  level: number
  /** Moving average of where regulars die: distance from the player over the distance to the screen edge that way (1 = at the edge). */
  reach: number
  /** Moving average of the max HP share the player loses per second. */
  harm: number
  /** Seconds of tension (`level` × dt) banked toward the next surge. */
  surge: number
  /** Surges fired so far (they alternate ring and swarm). */
  surges: number
  /** Share of the usual loot (EXP, berries, item drops) a regular's faint gives now: 1 over the tension's spawn rate multiplier. */
  share: number
}

export const TENSION = {
  /** Weight of each regular's death in `reach`. */
  reachWeight: 0.02,
  /** `reach` at the start of a run. Under `crowded` the horde is at the player's feet and tension falls (at `rise`). */
  calm: 0.5,
  crowded: 0.3,
  /** `reach` at or above which an unhurt player counts fully dominant: tension rises twice as fast as at `calm`. */
  dominant: 0.75,
  /** Seconds from 0 to full tension for a fully dominant player (twice that for one who is merely unhurt). */
  rise: 90,
  /** Run time (s) before tension starts building: the first waves are a warm-up for everyone. */
  from: 90,
  /** Run time (s) from which tension may reach its peak; before it, its ceiling climbs from 0 at `from` (`tensionCeiling`). */
  full: 600,
  /** Seconds from full tension to 0 while the player is hurting or low. */
  fall: 30,
  /** Time constant (s) of `harm`. */
  harmTau: 6,
  /** `harm` above which tension eases (max HP share per second): a hit of about 6% of max HP eases it for a few seconds. */
  hurting: 0.01,
  /** HP share under which tension eases whatever the reach. */
  lowHp: 0.5,
  /** A surge's size: `base` plus `extra` × tension. */
  surgeBase: 10,
  surgeExtra: 14,
  /** Px beyond the screen edge a close spawn lands, so no sprite pops in. */
  margin: 36,
} as const

/**
 * What full tension does on each difficulty: regular spawn `rate` and `cap`
 * multipliers, how much of the way spawns move from the far ring to just
 * outside the screen edge (`near`), how much faster they walk (`speed`), the
 * chance a regular spawn comes in elite (`elite`, under `ELITE.share`), and
 * seconds of full tension per surge. Prefers rate, closeness, pace and elites
 * over raw count (the cap is what costs frames).
 */
export const TENSION_PEAK = {
  normal: { rate: 1.25, cap: 1.05, near: 0.5, speed: 1.05, elite: 0.05, surgeEvery: 60 },
  hard: { rate: 1.6, cap: 1.1, near: 0.75, speed: 1.12, elite: 0.12, surgeEvery: 30 },
  nightmare: { rate: 2.5, cap: 1.15, near: 1, speed: 1.2, elite: 0.2, surgeEvery: 20 },
} as const satisfies Record<Difficulty, { rate: number; cap: number; near: number; speed: number; elite: number; surgeEvery: number }>

export type TensionPeak = (typeof TENSION_PEAK)[Difficulty]

export const createTension = (): TensionState => ({ level: 0, reach: TENSION.calm, harm: 0, surge: 0, surges: 0, share: 1 })

/** Distance from the screen center to its edge along the unit direction (`ux`, `uy`) for a `view` of w × h. */
export const edgeDistance = (view: { w: number; h: number }, ux: number, uy: number) => {
  const x = Math.abs(ux) > 1e-6 ? view.w / 2 / Math.abs(ux) : Infinity
  const y = Math.abs(uy) > 1e-6 ? view.h / 2 / Math.abs(uy) : Infinity
  return Math.min(x, y)
}

/** `reach` after a regular died `ratio` of the way to the screen edge (capped at 1.5, so a kill far off screen doesn't swamp it). */
export const reachAfter = (reach: number, ratio: number) => reach + (Math.min(1.5, ratio) - reach) * TENSION.reachWeight

/** `harm` after `dt` seconds in which the player lost `lost` of their max HP. */
export const harmAfter = (harm: number, lost: number, dt: number) => harm * dm.exp(-dt / TENSION.harmTau) + lost / TENSION.harmTau

/**
 * Tension after `dt` seconds: it eases at `fall` while the player hurts or is
 * under `lowHp`, and slowly while the horde dies at their feet (`crowded`).
 * Otherwise an unhurt player is winning, and it climbs: at half speed, up to
 * full speed (1 per `rise` seconds) as the horde dies near the screen edge.
 * So it settles where the player starts getting hurt, never past the peak.
 */
export const tensionAfter = (s: Pick<TensionState, 'level' | 'reach' | 'harm'>, hpShare: number, dt: number) => {
  if (s.harm > TENSION.hurting || hpShare < TENSION.lowHp) return Math.max(0, s.level - dt / TENSION.fall)
  if (s.reach < TENSION.crowded) return Math.max(0, s.level - dt / TENSION.rise)
  const dominance = Math.min(1, Math.max(0, (s.reach - TENSION.calm) / (TENSION.dominant - TENSION.calm)))
  return Math.min(1, s.level + ((0.5 + dominance * 0.5) * dt) / TENSION.rise)
}

/** The most tension the director may hold at run time `time`: none before `TENSION.from`, all of it from `TENSION.full`, so the early game stays a warm-up. */
export const tensionCeiling = (time: number) => Math.min(1, Math.max(0, (time - TENSION.from) / (TENSION.full - TENSION.from)))

/**
 * The spawn multipliers at tension `level` on a difficulty's `peak`: each knob
 * goes linearly from nothing at 0 to the peak at 1. In endless mode the cap
 * stays (`endlessPressure` already grows it every minute).
 */
export const tensionMods = (level: number, peak: TensionPeak, endless: boolean) => ({
  rate: 1 + (peak.rate - 1) * level,
  cap: endless ? 1 : 1 + (peak.cap - 1) * level,
  near: peak.near * level,
  speed: 1 + (peak.speed - 1) * level,
  elite: peak.elite * level,
})

/** Size of a surge at tension `level`. */
export const surgeSize = (level: number) => TENSION.surgeBase + dm.round(TENSION.surgeExtra * level)
