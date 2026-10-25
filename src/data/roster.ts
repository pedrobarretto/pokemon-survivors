import roster from './roster.generated.json'
import type { EnemyDef } from './enemies'
import { POKE_TYPES, type PokeType } from './types'
import * as dm from '../engine/dmath'

/**
 * The wild horde: species from every generation, fetched by `npm run roster`
 * (names, types and base stats from PokeAPI, sprites checked on SpriteCollab)
 * into `roster.generated.json`. Game stats are derived here, never typed by hand.
 */

export const TIERS = [1, 2, 3, 4, 5] as const

/** Difficulty band of a wild species: tier 1 shows up in the first minute, tier 5 near the end. */
export type Tier = (typeof TIERS)[number]

export type BaseStats = { hp: number; attack: number; defense: number; spAttack: number; spDefense: number; speed: number }

export type RosterSpecies = {
  dex: number
  name: string
  types: readonly PokeType[]
  stats: BaseStats
}

export const baseStatTotal = (s: BaseStats) => s.hp + s.attack + s.defense + s.spAttack + s.spDefense + s.speed

/** Lowest base stat total of tiers 2 to 5: weak basics, basics, sturdy basics and middle stages, evolved, strong finals. */
export const TIER_FLOORS = [270, 330, 400, 470] as const

export const tierOf = (bst: number): Tier => TIERS[TIER_FLOORS.filter((floor) => bst >= floor).length]!

/**
 * Game stats of a tier for a species with average bulk and offense. Calibrated
 * so each run stage averages what the hand-tuned Kanto horde had: the late
 * game keeps its toughness from `scaling` in `waves.ts`, not from bigger tiers.
 */
export const TIER_STATS = {
  1: { hp: 9, damage: 4, speed: 0.92 },
  2: { hp: 20, damage: 6.5, speed: 1 },
  3: { hp: 50, damage: 9, speed: 0.95 },
  4: { hp: 58, damage: 10, speed: 0.85 },
  5: { hp: 64, damage: 10, speed: 0.8 },
} as const satisfies Record<Tier, { hp: number; damage: number; speed: number }>

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const round1 = (v: number) => dm.round(v * 10) / 10

/**
 * Game stats from base stats (Spe, Atk… are base stats, total = base stat total):
 * - hp: tier hp × bulk share, where bulk = HP + (Def + SpD) / 2 and a balanced species has total / 3 (share kept in 0.7..1.5).
 * - damage: tier damage × offense share^0.7, where offense = max(Atk, SpA) and a balanced species has total / 6.
 * - speed (px/s): (8 + 60 × Spe / (Spe + 45)) × tier speed, a curve that flattens out so fast species stay
 *   dodgeable; flyers +12%.
 * - xp: one per 13 hp. mass (knockback resistance): (HP + Def) / 65, lighter for flying and ghost types.
 */
export const deriveEnemy = (s: RosterSpecies): EnemyDef => {
  const st = s.stats
  const bst = baseStatTotal(st)
  const tier = tierOf(bst)
  const bulk = clamp((st.hp + (st.defense + st.spDefense) / 2) / (bst / 3), 0.7, 1.5)
  const offense = clamp(Math.max(st.attack, st.spAttack) / (bst / 6), 0.6, 1.8)
  const flying = s.types.includes('flying')
  const light = flying || s.types.includes('ghost')
  const stats = TIER_STATS[tier]
  const hp = Math.max(4, dm.round(stats.hp * bulk))
  return {
    dex: s.dex,
    name: s.name,
    types: s.types,
    hp,
    speed: dm.round((8 + (60 * st.speed) / (st.speed + 45)) * stats.speed * (flying ? 1.12 : 1)),
    damage: Math.max(3, dm.round(stats.damage * dm.pow(offense, 0.7))),
    xp: Math.max(1, dm.round(hp / 13)),
    mass: round1(clamp(((st.hp + st.defense) / 65) * (light ? 0.65 : 1), 0.5, 3)),
    tier,
  }
}

const isPokeType = (t: string): t is PokeType => (POKE_TYPES as readonly string[]).includes(t)

type RosterId = keyof typeof roster

/** `Object.fromEntries` loses the keys; this keeps them. */
const mapValues = <K extends string, A, B>(record: Record<K, A>, f: (a: A) => B) =>
  Object.fromEntries(Object.entries<A>(record).map(([k, v]) => [k, f(v)])) as Record<K, B>

/** Every roster species as an enemy, keyed like `ENEMIES` (`rattata`, `mrMime`…). */
export const ROSTER: Record<RosterId, EnemyDef> = mapValues(roster, (s) => deriveEnemy({ ...s, types: s.types.filter(isPokeType) }))
