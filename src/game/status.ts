import type { Rng } from '../engine/rng'
import type { DamageSource } from './types'

/**
 * Pure status-condition rules (burn, poison, paralysis, slow, sleep). Moves declare a
 * `StatusSpec` in data; hits roll its chance and call `applyStatus`. The
 * per-tick system (DoT damage, particles) lives in `statusSystem.ts`.
 */
export type StatusKind = 'burn' | 'poison' | 'paralysis' | 'slow' | 'sleep'

/**
 * What a hit can inflict. `power` is DoT damage per second as a fraction of the
 * hit's damage (burn, poison: per stack) or the speed lost (slow). Paralysis and sleep ignore it.
 */
export type StatusSpec = { kind: StatusKind; chance: number; duration: number; power: number }

type StatusRule = {
  maxStacks: number
  /** Duration multiplier against bosses. */
  boss: number
  /** Deals damage over time. */
  dot: boolean
  color: string
}

export const STATUS_RULES = {
  burn: { maxStacks: 1, boss: 1, dot: true, color: '#f89838' },
  poison: { maxStacks: 5, boss: 1, dot: true, color: '#c878f0' },
  paralysis: { maxStacks: 1, boss: 0.35, dot: false, color: '#f8d830' },
  slow: { maxStacks: 1, boss: 0.5, dot: false, color: '#78a8f8' },
  sleep: { maxStacks: 1, boss: 0.35, dot: false, color: '#a8b8f0' },
} as const satisfies Record<StatusKind, StatusRule>

export const STATUS_KINDS = Object.keys(STATUS_RULES) as StatusKind[]

/** Seconds between DoT ticks (cheap: one damage number per tick, not per frame). */
export const DOT_INTERVAL = 0.5
/** Burned enemies deal this much contact damage. */
export const BURN_ATTACK = 0.5
/** Full stop when paralysis lands, then random stutters while it lasts. */
export const PARALYSIS_STUN = 0.45
export const STUTTER_TIME = 0.2
/** Stutters per second while paralyzed (and not already stunned). */
export const STUTTER_RATE = 1.6
/** Movement speed while paralyzed between stutters. */
export const PARALYSIS_PACE = 0.75

/** `by` is the slot of the player whose move inflicted it (its damage counts as theirs). */
export type Affliction = { time: number; power: number; stacks: number; move: DamageSource | null; by: number }

export type EnemyStatus = Record<StatusKind, Affliction> & {
  /** Seconds frozen in place (paralysis). */
  stun: number
  /** Seconds until the next DoT tick. */
  tick: number
}

const none = (): Affliction => ({ time: 0, power: 0, stacks: 0, move: null, by: 0 })

export const createStatus = (): EnemyStatus => ({ burn: none(), poison: none(), paralysis: none(), slow: none(), sleep: none(), stun: 0, tick: 0 })

export const isAfflicted = (st: EnemyStatus) => st.burn.time > 0 || st.poison.time > 0 || st.paralysis.time > 0 || st.slow.time > 0 || st.sleep.time > 0 || st.stun > 0

const hasDot = (st: EnemyStatus) => st.burn.time > 0 || st.poison.time > 0

/** DoT damage per second of one affliction. */
export const dotDps = (a: Affliction) => (a.time > 0 ? a.power * a.stacks : 0)

/**
 * Inflicts `spec` (already rolled) from a hit of `damage` by player `by`.
 * Re-applying refreshes the duration and keeps the strongest power (and its
 * source); poison also adds a stack.
 */
export const applyStatus = (st: EnemyStatus, spec: StatusSpec, damage: number, boss: boolean, move: DamageSource | null, by = 0) => {
  const rule = STATUS_RULES[spec.kind]
  const a = st[spec.kind]
  const resist = boss ? rule.boss : 1
  const power = rule.dot ? spec.power * damage : spec.power
  if (rule.dot && !hasDot(st)) st.tick = DOT_INTERVAL
  if (a.time <= 0) {
    a.stacks = 1
    a.power = power
    a.move = move
    a.by = by
  } else {
    a.stacks = Math.min(rule.maxStacks, a.stacks + 1)
    if (power >= a.power) {
      a.power = power
      a.move = move
      a.by = by
    }
  }
  a.time = Math.max(a.time, spec.duration * resist)
  if (spec.kind === 'paralysis') st.stun = Math.max(st.stun, PARALYSIS_STUN * resist)
}

/**
 * Advances timers by `dt`. Returns true when a DoT tick is due (the caller then
 * deals `dotDps * DOT_INTERVAL` for each active DoT).
 */
export const tickStatus = (st: EnemyStatus, dt: number, boss: boolean, rng: Rng) => {
  let due = false
  if (hasDot(st)) {
    st.tick -= dt
    if (st.tick <= 0) {
      st.tick += DOT_INTERVAL
      due = true
    }
  }
  st.stun = Math.max(0, st.stun - dt)
  if (st.paralysis.time > 0 && st.stun <= 0 && rng() < STUTTER_RATE * dt) {
    st.stun = STUTTER_TIME * (boss ? STATUS_RULES.paralysis.boss : 1)
  }
  for (const kind of STATUS_KINDS) {
    const a = st[kind]
    if (a.time <= 0) continue
    a.time -= dt
    if (a.time <= 0) {
      a.time = 0
      a.stacks = 0
      a.power = 0
      a.move = null
    }
  }
  return due
}

/** Asleep enemies stand still and deal no contact damage (Poké Flute). */
export const isAsleep = (st: EnemyStatus) => st.sleep.time > 0

/** Movement multiplier from sleep, slow, paralysis and stun. */
export const statusPace = (st: EnemyStatus) =>
  st.stun > 0 || isAsleep(st) ? 0 : (st.slow.time > 0 ? 1 - st.slow.power : 1) * (st.paralysis.time > 0 ? PARALYSIS_PACE : 1)

/** Contact damage multiplier: burn weakens attacks, like in the games; sleepers don't attack. */
export const statusAttack = (st: EnemyStatus) => (isAsleep(st) ? 0 : st.burn.time > 0 ? BURN_ATTACK : 1)

export type StatusBonus = { chance: number; damage: number; duration: number }

/** A move's base status after upgrades and player modifiers. `damage` only boosts DoTs. */
export const scaleStatus = (spec: StatusSpec, bonus: StatusBonus): StatusSpec => ({
  kind: spec.kind,
  chance: Math.min(1, spec.chance + bonus.chance),
  duration: spec.duration * bonus.duration,
  power: STATUS_RULES[spec.kind].dot ? spec.power * (1 + bonus.damage) : spec.power,
})

/** The condition shown on an enemy (badge, tint): the most impactful active one. */
export const mainStatus = (st: EnemyStatus): StatusKind | null =>
  st.sleep.time > 0 ? 'sleep' : st.paralysis.time > 0 ? 'paralysis' : st.burn.time > 0 ? 'burn' : st.poison.time > 0 ? 'poison' : st.slow.time > 0 ? 'slow' : null
