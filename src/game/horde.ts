import { ELITE, ENDLESS_HORDE, RUN_LENGTH, RUNNER } from '../data/waves'
import type { Difficulty } from './difficulty'
import type { Enemy } from './types'
import * as dm from '../engine/dmath'

/** New regular spawns are elites once `regular` enemies fill `ELITE.fill` of the effective `cap`, while `elites` stay under `ELITE.share` of it. */
export const eliteSpawn = (regular: number, elites: number, cap: number) => regular >= cap * ELITE.fill && elites < cap * ELITE.share

/** Promotes a fresh regular spawn to an elite (`ELITE`). */
export const makeElite = (e: Pick<Enemy, 'elite' | 'hp' | 'maxHp' | 'xp' | 'damage' | 'radius'>) => {
  e.elite = true
  e.hp = e.maxHp = dm.round(e.maxHp * ELITE.hp)
  e.xp *= ELITE.xp
  e.damage *= ELITE.damage
  e.radius *= ELITE.size
}

/** How many foes each regular spawn stands for when the endless mode asks for a horde of `want` (`ENDLESS_HORDE`): 1 up to the ceiling. */
export const hordeWeight = (want: number) => Math.max(1, want / ENDLESS_HORDE.ceiling)

/** Makes a fresh regular spawn stand for `weight` foes (`ENDLESS_HORDE`): HP times it, damage times its `damage` power. Its faint pays as all of them (`killEnemy`, `PlayerRecord.folded`). */
export const weighSpawn = (e: Pick<Enemy, 'hp' | 'maxHp' | 'damage' | 'weight'>, weight: number) => {
  if (weight <= 1) return
  e.weight = weight
  e.hp = e.maxHp = dm.round(e.maxHp * weight)
  e.damage *= dm.pow(weight, ENDLESS_HORDE.damage)
}

/** Turns a fresh regular spawn into a runner (`RUNNER`): faster but capped under the player's pace, and frailer. */
export const makeRunner = (e: Pick<Enemy, 'runner' | 'hp' | 'maxHp' | 'speed'>) => {
  e.runner = true
  e.speed = Math.min(e.speed * RUNNER.speed, RUNNER.maxSpeed)
  e.hp = e.maxHp = Math.max(1, dm.round(e.maxHp * RUNNER.hp))
}

/**
 * How far ahead (s) a runner `dist` px away at `speed` px/s aims: about the
 * time it needs to get there, at most `RUNNER.lead`. It heads for the player's
 * position plus the player's velocity times this, so circling doesn't shake it.
 */
export const leadTime = (dist: number, speed: number) => (speed > 0 ? Math.min(RUNNER.lead, dist / speed) : 0)

/**
 * How much harder the regular horde is to knock back by the end of the run:
 * ×1 until `GRIT_FROM` (the early game keeps its bounce, or a weak start gets
 * swamped), then it grows to this at `RUN_LENGTH` (and stays there in endless
 * mode), so a late horde stops bouncing off an aura and presses in.
 */
export const HORDE_GRIT = { normal: 2.5, hard: 3, nightmare: 3.5 } as const satisfies Record<Difficulty, number>

/** Run time (s) the horde starts stiffening at. */
export const GRIT_FROM = 300

/** Knockback divisor on top of a regular foe's `mass` at `time` (`damageEnemy`). */
export const hordeGrit = (time: number, difficulty: Difficulty) =>
  1 + (HORDE_GRIT[difficulty] - 1) * Math.min(1, Math.max(0, (time - GRIT_FROM) / (RUN_LENGTH - GRIT_FROM)))
