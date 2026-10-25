import type { PokeType } from '../data/types'
import type { MoveTag } from './moves'
import * as dm from '../engine/dmath'

/**
 * Player-wide modifiers, Vampire Survivors style. Every source (starter,
 * evolution stage, held items, Poké Mart ranks) contributes additive deltas on top of BASE.
 */
export type PlayerStats = {
  maxHp: number
  /** px/s */
  speed: number
  /** damage multiplier */
  might: number
  /** attack size multiplier */
  area: number
  /** cooldown multiplier (lower is faster) */
  cooldown: number
  /** effect duration multiplier */
  duration: number
  /** extra projectiles */
  amount: number
  projectileSpeed: number
  /** pickup radius in px */
  magnet: number
  /** hp per second */
  regen: number
  /** flat damage reduction */
  armor: number
  /** xp multiplier */
  growth: number
  /** Poké Dollar multiplier */
  greed: number
  /** extra damage per move type, on top of might (0.1 = +10% for that type) */
  typeDamage: Partial<Record<PokeType, number>>
  /** extra damage per kind of move (`MoveTag`), from abilities (Iron Fist, Technician…) */
  tagDamage: Partial<Record<MoveTag, number>>
  /** added to every move's status chance */
  statusChance: number
  /** extra burn/poison damage (0.2 = +20%) */
  statusDamage: number
  /** multiplier on the damage the player takes, before armor (Aegislash's stances) */
  damageTaken: number
  /** loadout moves fired where the special lands (Metronome) */
  comboMoves: number
  /** seconds cut from the special's cooldown per kill it makes (Power Herb) */
  specialRecharge: number
}

export type StatDelta = Partial<PlayerStats>

export const BASE_STATS: PlayerStats = {
  maxHp: 100,
  speed: 68,
  might: 1,
  area: 1,
  cooldown: 1,
  duration: 1,
  amount: 0,
  projectileSpeed: 1,
  magnet: 30,
  regen: 0,
  armor: 0,
  growth: 1,
  greed: 1,
  typeDamage: {},
  tagDamage: {},
  statusChance: 0,
  statusDamage: 0,
  damageTaken: 1,
  comboMoves: 0,
  specialRecharge: 0,
}

export const applyDeltas = (base: PlayerStats, deltas: readonly StatDelta[]): PlayerStats =>
  deltas.reduce<PlayerStats>((acc, { typeDamage, tagDamage, ...delta }) => {
    const next = { ...acc, typeDamage: { ...acc.typeDamage }, tagDamage: { ...acc.tagDamage } }
    for (const k of Object.keys(delta) as (keyof typeof delta)[]) next[k] += delta[k] ?? 0
    for (const [type, bonus] of Object.entries(typeDamage ?? {}) as Array<[PokeType, number]>) {
      next.typeDamage[type] = (next.typeDamage[type] ?? 0) + bonus
    }
    for (const [tag, bonus] of Object.entries(tagDamage ?? {}) as Array<[MoveTag, number]>) {
      next.tagDamage[tag] = (next.tagDamage[tag] ?? 0) + bonus
    }
    return next
  }, base)

/**
 * Every stat `boost` stronger (0.09 = +9%), Pokémon-style: HP, power and
 * speed grow by it, and the damage taken shrinks by it (defense). Bottle Caps
 * and the Everstone (`runBoost`); 0 changes nothing.
 */
export const boostStats = (s: PlayerStats, boost: number): PlayerStats =>
  boost === 0 ? s : { ...s, maxHp: dm.round(s.maxHp * (1 + boost)), might: s.might * (1 + boost), speed: s.speed * (1 + boost), damageTaken: s.damageTaken / (1 + boost) }
