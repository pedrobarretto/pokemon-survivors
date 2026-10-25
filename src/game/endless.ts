import type { EnemyId } from '../data/enemies'
import { RUN_LENGTH } from '../data/waves'
import * as dm from '../engine/dmath'

/**
 * Pure rules of the endless mode, offered after Mewtwo falls: the horde keeps
 * escalating and a reaper (Arceus) comes to hunt the player. The runtime side
 * lives in `endlessSystem.ts`.
 */

/** The reaper that hunts the player in endless mode. */
export const REAPER = 'arceus' as const satisfies EnemyId

export const ENDLESS = {
  /** Arceus descends at 20:00 (at least a minute after Mewtwo fell). */
  reaperAt: 20 * 60,
  /** Seconds after a defeat until Arceus comes back, stronger. */
  reaperReturn: 120,
  reaperHp: 300_000,
  /** Each defeat multiplies the next Arceus's HP. */
  reaperHpGrowth: 1.5,
  /** Hunting speed grows from the base to `reaperMaxSpeed`× over `reaperRamp` seconds. */
  reaperRamp: 150,
  reaperMaxSpeed: 2,
  /** A ring or swarm of the current horde every this many seconds. */
  eventEvery: 40,
  /** ₽ the run bonus pays per defeated Arceus. */
  reaperBonus: 2500,
} as const

export type EndlessState = {
  /** Run time when the player chose to go on (Mewtwo's defeat). */
  since: number
  nextEvent: number
  /** Endless horde events fired so far (they alternate ring and swarm). */
  events: number
  reaperAt: number
  /** The living Arceus, and the run time it arrived. */
  reaperId: number | null
  reaperSince: number
  reaperDefeats: number
}

export const startEndless = (time: number): EndlessState => ({
  since: time,
  nextEvent: time + ENDLESS.eventEvery,
  events: 0,
  reaperAt: Math.max(ENDLESS.reaperAt, time + 60),
  reaperId: null,
  reaperSince: 0,
  reaperDefeats: 0,
})

/** Seconds survived past the regular 15:00 run (the endless score). */
export const overtime = (time: number) => Math.max(0, time - RUN_LENGTH)

/** Arceus arrives when its time comes and none is hunting yet. */
export const reaperDue = (s: Pick<EndlessState, 'reaperAt' | 'reaperId'>, time: number) => s.reaperId === null && time >= s.reaperAt

export const reaperHp = (defeats: number) => dm.round(ENDLESS.reaperHp * dm.powInt(ENDLESS.reaperHpGrowth, defeats))

/** The longer Arceus hunts, the faster it gets, until nobody can outrun it. */
export const reaperSpeed = (base: number, hunting: number) => base * Math.min(ENDLESS.reaperMaxSpeed, 1 + hunting / ENDLESS.reaperRamp)

/**
 * Extra spawn pressure on top of the last wave stage, growing per overtime
 * minute. The spawner applies it only once the player chose endless mode, so
 * a regular run that outlasts 15:00 (Mewtwo still standing) doesn't escalate.
 */
export const endlessPressure = (time: number) => {
  const minutes = overtime(time) / 60
  return { rate: 1 + minutes * 0.12, max: 1 + minutes * 0.08 }
}

/** Size of the n-th endless horde event: rings and swarms that grow every minute. */
export const endlessEventSize = (time: number) => 30 + dm.round((overtime(time) / 60) * 4)
