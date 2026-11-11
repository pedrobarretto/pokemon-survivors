import type { PlayableId } from '../data/hatchlings'
import type { PokeType } from '../data/types'
import type { StatDelta } from './stats'

/**
 * Pure numbers and rules of the Rocket Game Corner's prize families
 * (`data/rocketFamilies.ts`). `rocketKitSystem.ts` runs them on
 * `Player.rocket`; nothing here touches the game, so each rule is tested on its
 * own. Like Temporada 1's kits, every bonus is capped.
 */
export const ROCKET_KIT = {
  /**
   * Ditto's Transform: how far it looks for a foe to copy, how long a copy
   * holds without a new cast, the boost its moves of the copied type get, and
   * the stat each kind of foe lends it.
   */
  transform: {
    reach: 180,
    hold: 14,
    typeBoost: 0.35,
    perks: {
      boss: { might: 0.22, damageTaken: -0.1 },
      elite: { maxHp: 30, armor: 2 },
      fast: { speed: 9, cooldown: -0.05 },
      plain: { might: 0.1, area: 0.06 },
    },
    /** A foe at least this fast (px/s) counts as `fast`. */
    fastAt: 62,
  },
  /**
   * Absol's Omen: every `every` s the toughest foe within `reach` is doomed
   * for `duration` s (a mark of `power`); Absol's hits on it deal `mult` more,
   * and when it falls its doom takes everything within `r` px with it.
   */
  omen: { every: 4.5, duration: 7, power: 0.35, reach: 220, mult: 1.4, fall: { r: 48, power: 26 } },
  /**
   * Gimmighoul's coins: each ₽ picked up in the run is a coin, up to `cap`;
   * `evolve` of them evolve it into Gholdengo. Make It Rain throws `per`
   * coins' worth of extra damage, up to `bonusCap` times its base.
   */
  coins: { cap: 3000, evolve: 999, per: 0.0012, bonusCap: 1.6 },
  /**
   * Mawile's Deceiver: every `every` s, a foe within `reach` px behind it
   * (a half circle opposite where it faces) gets bitten for `power`; a Mega
   * Mawile's second jaw bites in front too.
   */
  deceiver: { every: 1.15, reach: 30, power: 16 },
} as const

/** What kind of foe Ditto copied, for the stat it lends (`ROCKET_KIT.transform.perks`). */
export type CopyRole = keyof typeof ROCKET_KIT.transform.perks

/** Each family's running state on `Player.rocket`; absent for anyone else. */
export type RocketKit =
  /** `dex` 0: not transformed. `left` s until the copy wears off. */
  | { kind: 'transform'; dex: number; type: PokeType; role: CopyRole; left: number }
  /** `target`: the doomed foe's id (0 for none), `next` s until the next Omen. */
  | { kind: 'omen'; target: number; next: number }
  | { kind: 'coins'; coins: number }
  | { kind: 'deceiver'; bite: number }

const CREATE = {
  ditto: () => ({ kind: 'transform', dex: 0, type: 'normal', role: 'plain', left: 0 }),
  absol: () => ({ kind: 'omen', target: 0, next: 1.5 }),
  gimmighoul: () => ({ kind: 'coins', coins: 0 }),
  mawile: () => ({ kind: 'deceiver', bite: 0 }),
} as const satisfies Partial<Record<PlayableId, () => RocketKit>>

const hasKit = (id: PlayableId): id is keyof typeof CREATE => id in CREATE

/** The fresh state of a prize family's mechanic, or null for anyone else (`createPlayer` then leaves the field out). */
export const createRocketKit = (starter: PlayableId): RocketKit | null => (hasKit(starter) ? CREATE[starter]() : null)

/** What a foe counts as for Ditto: a boss (an Alpha too), an elite, a fast one or a plain one. */
export const copyRole = (foe: { boss: boolean; elite: boolean; speed: number }): CopyRole =>
  foe.boss ? 'boss' : foe.elite ? 'elite' : foe.speed >= ROCKET_KIT.transform.fastAt ? 'fast' : 'plain'

/** Which foe Absol dooms among candidates: the one with the most HP left (bosses and elites first by their HP). */
export const omenPick = <E extends { hp: number; boss: boolean; elite: boolean }>(foes: readonly E[]): E | null => {
  let best: E | null = null
  const weight = (e: E) => e.hp * (e.boss ? 4 : e.elite ? 2 : 1)
  for (const e of foes) if (best === null || weight(e) > weight(best)) best = e
  return best
}

/** Coins after picking up `amount` ₽ more, capped. */
export const coinsAfter = (coins: number, amount: number) => Math.min(ROCKET_KIT.coins.cap, coins + Math.max(0, amount))

/** Whether Gimmighoul has gathered enough coins to evolve. */
export const coinsEvolve = (coins: number) => coins >= ROCKET_KIT.coins.evolve

/** Make It Rain's damage multiplier from the coins held: 1 with none, up to `1 + bonusCap`. */
export const rainMult = (coins: number) => 1 + Math.min(ROCKET_KIT.coins.bonusCap, coins * ROCKET_KIT.coins.per)

/**
 * Whether a foe at (dx, dy) from Mawile, which faces (fx, fy), is behind it:
 * past the line through Mawile square to its facing. `front` (the Mega's
 * second jaw) takes the other side too.
 */
export const behind = (dx: number, dy: number, fx: number, fy: number, front: boolean) => front || dx * fx + dy * fy < 0

/** The family's bonuses right now, on top of its other stats (`recomputeStats`). */
export const rocketKitDeltas = (kit: RocketKit | undefined): readonly StatDelta[] => {
  if (kit?.kind !== 'transform' || kit.dex === 0) return []
  return [{ typeDamage: { [kit.type]: ROCKET_KIT.transform.typeBoost } }, ROCKET_KIT.transform.perks[kit.role]]
}
