import { clamp, dirTo, lerp, TAU, type Vec } from '../engine/math'
import { range, weightedPick, type Rng } from '../engine/rng'
import { BUFFS, type BuffId } from '../data/consumables'
import { COIN_VALUES } from './meta'
import type { Buff } from './types'
import * as dm from '../engine/dmath'

/**
 * Pure rules and tuning of the map events (`mapEvents.ts`): no DOM, no game
 * state, so the guide and the tests can read them directly.
 */

export { MEOWTH_DEX } from '../data/species'

/** Event director: first spawn, gap between spawns and how crowded the map may get. */
export const DIRECTOR = {
  first: 22,
  gap: [24, 38],
  maxAlive: 3,
  /** Minimum distance between two events (and between an event and a prop). */
  spacing: 96,
  /** Events this far from the player are dropped silently. */
  despawn: 1100,
} as const

/** Seconds a spent event takes to fade out before it's removed. */
export const FADE = 0.6

/* ---------------- Spawn spots ---------------- */

/**
 * A random spot on the ring `[min, max]` px around (px, py) that keeps
 * `spacing` px from every point in `taken`. Null when a few tries all collide.
 */
export const spawnSpot = (
  rng: Rng,
  px: number,
  py: number,
  distance: readonly [number, number],
  taken: readonly Vec[],
  spacing: number = DIRECTOR.spacing,
): Vec | null => {
  for (let i = 0; i < 10; i++) {
    const a = range(rng, 0, TAU)
    const d = range(rng, distance[0], distance[1])
    const x = dm.round(px + dm.cos(a) * d)
    const y = dm.round(py + dm.sin(a) * d)
    if (taken.every((o) => dm.sq(o.x - x) + dm.sq(o.y - y) >= spacing * spacing)) return { x, y }
  }
  return null
}

/* ---------------- Altar ---------------- */

export const ALTAR = {
  /** Step this close (px) to activate it. */
  radius: 12,
  /** Altar buffs last this much longer than the bottled ones. */
  boost: 1.5,
  weights: { xAttack: 3, xSpeed: 3, maxRepel: 1.5 } satisfies Record<BuffId, number>,
  /** Weight factor of a buff that's already running (it would only extend it). */
  running: 0.2,
} as const

const ALTAR_BUFFS = Object.keys(ALTAR.weights) as BuffId[]

/** Rolls the buff an altar grants, favoring buffs the player doesn't have running. */
export const rollAltarBuff = (rng: Rng, active: readonly Buff[]): BuffId =>
  weightedPick(
    rng,
    ALTAR_BUFFS.map((id) => [id, ALTAR.weights[id] * (active.some((b) => b.id === id) ? ALTAR.running : 1)] as const),
  )

export const altarDuration = (id: BuffId) => BUFFS[id].duration * ALTAR.boost

/* ---------------- Fountain ---------------- */

export const FOUNTAIN = {
  radius: 18,
  charges: 6,
  /** Seconds between sips while standing in it. */
  interval: 0.45,
  /** Fraction of max HP healed per sip. */
  heal: 0.07,
} as const

export type FountainState = { charges: number; timer: number }

/**
 * Advances a fountain by `dt`. Returns true when the player takes a sip now:
 * standing in it, hurt, with charges left and the sip interval elapsed.
 * Full-HP visits never waste charges.
 */
export const fountainSip = (f: FountainState, inside: boolean, hurt: boolean, dt: number) => {
  f.timer = Math.max(0, f.timer - dt)
  if (!inside || !hurt || f.charges <= 0 || f.timer > 0) return false
  f.charges--
  f.timer = FOUNTAIN.interval
  return true
}

/* ---------------- Locked chest ---------------- */

export const CHEST = {
  /** Unlock ring radius (px). */
  radius: 36,
  /** Seconds inside the ring to open it. */
  unlock: 3,
  /** Outside the ring, progress drains at this fraction of the fill speed. */
  decay: 0.5,
  /** Wild Pokémon that ambush you when you start unlocking, plus one per minute. */
  ambush: 8,
  ambushRadius: 140,
} as const

/** Unlock progress (0..1) after `dt` seconds: fills inside the ring and drains outside. */
export const chestProgress = (progress: number, inside: boolean, dt: number) =>
  clamp(progress + (inside ? dt : -dt * CHEST.decay) / CHEST.unlock, 0, 1)

/** Coins in an opened chest: two ₽50 coins, one more every four minutes (halved with the foes' coins, `FOE_COINS`). */
export const chestCoins = (time: number): number[] => Array.from({ length: 2 + Math.floor(time / 240) }, () => COIN_VALUES[1])

/* ---------------- Traps ---------------- */

export const SPIKES = {
  radius: 20,
  /** Cycle: retracted, peeking (warning), up (hurts whatever stands on it). */
  down: 1.5,
  warn: 0.7,
  up: 0.5,
  /** Damage to wild Pokémon, scaled like their HP (`scaling`). */
  damage: 22,
  /** Fraction of the player's max HP. */
  playerDamage: 0.08,
} as const

export type SpikePhase = 'down' | 'warn' | 'up'

/** Where a spike trap is in its cycle, `age` seconds after it appeared. */
export const spikePhase = (age: number): SpikePhase => {
  const t = age % (SPIKES.down + SPIKES.warn + SPIKES.up)
  return t < SPIKES.down ? 'down' : t < SPIKES.down + SPIKES.warn ? 'warn' : 'up'
}

export const BOMB = {
  /** Anything (player or wild Pokémon) this close lights the fuse. */
  trigger: 22,
  fuse: 1.6,
  radius: 56,
  damage: 80,
  playerDamage: 0.2,
  /** Bosses lose this fraction of their max HP instead. */
  bossDamage: 0.04,
} as const

/* ---------------- Fleeing Meowth ---------------- */

export const MEOWTH = {
  /** Hits it takes before it drops the jackpot. */
  hp: 10,
  /** Seconds it can be hit again after a hit. */
  hitCooldown: 0.18,
  /** Runs this fast when you're close and slows down when you fall behind, so it stays catchable. */
  speedNear: 76,
  speedFar: 38,
  near: 50,
  far: 180,
  /** Past this distance it gives up the chase and escapes. */
  escape: 420,
  radius: 8,
  /** Coins dropped by every hit, and the Pay Day jackpot when it faints. */
  hitCoins: [COIN_VALUES[0]],
  jackpot: [COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[1], COIN_VALUES[1]],
} as const

/** Meowth's run speed at `dist` px from the player: panics up close, slows down far away. */
export const meowthSpeed = (dist: number) => lerp(MEOWTH.speedNear, MEOWTH.speedFar, clamp((dist - MEOWTH.near) / (MEOWTH.far - MEOWTH.near), 0, 1))

/** Heading away from the player, weaving side to side (up to ~35°) so it's not a straight line. */
export const fleeHeading = (mx: number, my: number, px: number, py: number, t: number, seed: number): Vec => {
  const away = dirTo(px, py, mx, my)
  const weave = dm.sin(t * 2.6 + seed) * 0.6
  const c = dm.cos(weave)
  const s = dm.sin(weave)
  return { x: away.x * c - away.y * s, y: away.x * s + away.y * c }
}
