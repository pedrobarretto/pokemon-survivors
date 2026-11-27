import { TAU } from '../engine/math'
import type { Rng } from '../engine/rng'
import type { DamageSource } from './types'

/**
 * Pure status-condition rules. Moves declare a `StatusSpec` in data; hits roll
 * its chance and call `applyStatus`. The per-tick system (DoT damage, seed
 * heals, particles) lives in `statusSystem.ts`, hit-time effects (freeze
 * shatter, mark, waking) in `combat.ts`.
 *
 * - burn, poison: DoT (poison stacks to 5); burn halves contact damage.
 * - paralysis: a stun, then stutters. slow: speed lost.
 * - sleep: stops and deals no contact damage. A sleep a move put on breaks on
 *   the next hit; the Poké Flute's and the specials' hold.
 * - freeze: stops; the next hit deals ×`FREEZE_SHATTER` and breaks it.
 * - mark: takes +`power` damage per stack from hits, up to 3 stacks.
 * - confuse: wanders at random and its body hurts the foes it bumps into.
 * - seed: DoT that heals the player (`SEED_HEAL`, through its move's drain budget);
 *   when the foe faints it jumps to `SEED_JUMPS` neighbors (`kitRules.ts`).
 * - weaken: deals `power` less contact damage (0.25 = −25%), like burn's cut (Mud Shot).
 */
export type StatusKind = 'burn' | 'poison' | 'paralysis' | 'slow' | 'sleep' | 'freeze' | 'mark' | 'confuse' | 'seed' | 'weaken'

/**
 * What a hit can inflict. `power` is DoT damage per second as a fraction of the
 * hit's damage (burn, poison: per stack; seed), the speed lost (slow) or the
 * damage taken per stack (mark, 0.15 = +15%) or the contact damage lost (weaken).
 * Paralysis, sleep, freeze and confuse ignore it.
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
  freeze: { maxStacks: 1, boss: 0.25, dot: false, color: '#a8e8f8' },
  mark: { maxStacks: 3, boss: 1, dot: false, color: '#f85868' },
  // Bosses can't be confused: their fights need them to keep coming.
  confuse: { maxStacks: 1, boss: 0, dot: false, color: '#f8a0d0' },
  seed: { maxStacks: 1, boss: 1, dot: true, color: '#78c850' },
  weaken: { maxStacks: 1, boss: 0.5, dot: false, color: '#a07840' },
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
/** A hit on a frozen foe deals this much more, and shatters the ice. */
export const FREEZE_SHATTER = 2
/** Heading changes per second of a confused foe, and the seconds between its bumps on the same neighbor. */
export const CONFUSE_TURN = 1.4
export const CONFUSE_BUMP = 0.5
/** A confused foe's bump deals this many times its contact damage to the foe it runs into. */
export const CONFUSE_CONTACT = 2
/** Share of a seed's DoT that heals the player. */
export const SEED_HEAL = 0.5

/** `by`: slot of the player whose hit put it on (its DoT, kills and Leech Seed heals are theirs). */
export type Affliction = { time: number; power: number; stacks: number; move: DamageSource | null; by: number }

export type EnemyStatus = Record<StatusKind, Affliction> & {
  /** Seconds frozen in place (paralysis). */
  stun: number
  /** Seconds until the next DoT tick. */
  tick: number
  /** Direction a confused foe wanders in, radians. */
  heading: number
  /** Seconds until a confused foe's body can hurt another foe again. */
  bump: number
}

const none = (): Affliction => ({ time: 0, power: 0, stacks: 0, move: null, by: 0 })

export const createStatus = (): EnemyStatus => ({
  burn: none(), poison: none(), paralysis: none(), slow: none(), sleep: none(),
  freeze: none(), mark: none(), confuse: none(), seed: none(), weaken: none(),
  stun: 0, tick: 0, heading: 0, bump: 0,
})

export const isAfflicted = (st: EnemyStatus) =>
  st.burn.time > 0 || st.poison.time > 0 || st.paralysis.time > 0 || st.slow.time > 0 || st.sleep.time > 0 || st.stun > 0 ||
  st.freeze.time > 0 || st.mark.time > 0 || st.confuse.time > 0 || st.seed.time > 0 || st.weaken.time > 0

const hasDot = (st: EnemyStatus) => st.burn.time > 0 || st.poison.time > 0 || st.seed.time > 0

/** Ends an affliction now. */
export const clearAffliction = (a: Affliction) => {
  a.time = 0
  a.stacks = 0
  a.power = 0
  a.move = null
  a.by = 0
}

/** DoT damage per second of one affliction. */
export const dotDps = (a: Affliction) => (a.time > 0 ? a.power * a.stacks : 0)

/**
 * Inflicts `spec` (already rolled) from a hit of `damage` by the player at slot
 * `by`. Re-applying refreshes the duration and keeps the strongest power (and
 * its player); poison also adds a stack.
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
  if (st.confuse.time > 0) {
    st.bump = Math.max(0, st.bump - dt)
    if (rng() < CONFUSE_TURN * dt) st.heading = rng() * TAU
  }
  for (const kind of STATUS_KINDS) {
    const a = st[kind]
    if (a.time <= 0) continue
    a.time -= dt
    if (a.time <= 0) clearAffliction(a)
  }
  return due
}

/** Asleep enemies stand still and deal no contact damage (Poké Flute). */
export const isAsleep = (st: EnemyStatus) => st.sleep.time > 0

/** Frozen enemies stand still, deal no contact damage and hold their attacks, like sleepers. */
export const isFrozen = (st: EnemyStatus) => st.freeze.time > 0

/** Asleep or frozen: out of the fight until it ends (or a hit breaks it). */
export const isHeld = (st: EnemyStatus) => isAsleep(st) || isFrozen(st)

/** Movement multiplier from sleep, freeze, slow, paralysis and stun. */
export const statusPace = (st: EnemyStatus) =>
  st.stun > 0 || isHeld(st) ? 0 : (st.slow.time > 0 ? 1 - st.slow.power : 1) * (st.paralysis.time > 0 ? PARALYSIS_PACE : 1)

/** Contact damage multiplier: burn weakens attacks, like in the games, and so does weaken; sleepers and frozen foes don't attack. */
export const statusAttack = (st: EnemyStatus) =>
  isHeld(st) ? 0 : (st.burn.time > 0 ? BURN_ATTACK : 1) * (st.weaken.time > 0 ? 1 - st.weaken.power : 1)

/** Damage multiplier a hit gets from the target's conditions: ×(1 + power × stacks) when marked, ×`FREEZE_SHATTER` when frozen. */
export const hitTakenMult = (st: EnemyStatus) =>
  (st.mark.time > 0 ? 1 + st.mark.power * st.mark.stacks : 1) * (st.freeze.time > 0 ? FREEZE_SHATTER : 1)

/**
 * What a landed hit breaks: a freeze always (returns true, the shatter), a
 * sleep only when a move put it on (`move` is a move id, not the Poké Flute's
 * null or the special's 'special').
 */
export const breakOnHit = (st: EnemyStatus) => {
  if (st.sleep.time > 0 && st.sleep.move !== null && st.sleep.move !== 'special') clearAffliction(st.sleep)
  if (st.freeze.time <= 0) return false
  clearAffliction(st.freeze)
  return true
}

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
  st.freeze.time > 0 ? 'freeze'
  : st.sleep.time > 0 ? 'sleep'
  : st.paralysis.time > 0 ? 'paralysis'
  : st.confuse.time > 0 ? 'confuse'
  : st.burn.time > 0 ? 'burn'
  : st.poison.time > 0 ? 'poison'
  : st.seed.time > 0 ? 'seed'
  : st.mark.time > 0 ? 'mark'
  : st.weaken.time > 0 ? 'weaken'
  : st.slow.time > 0 ? 'slow'
  : null
