import type { EggTier } from '../game/eggs'
import type { StatDelta } from '../game/stats'
import type { EvolutionStage, PlayableDef } from './starters'
import type { PokeType } from './types'

/**
 * Playable families that hatch from eggs (`game/eggs.ts`), on top of the 27
 * starters. They share the starters' shape; `egg` is the egg tier they hatch from
 * (Munchlax alone hatches from the Friendship Egg, which only invites bring;
 * the Haunted Egg's ghosts only from the egg Duskull's stall sells on the
 * Noite das Bruxas, and the Kecleon Egg's four only from the Vitrine's fixed
 * card, so both stay out of the Desafio do dia and the shiny tickets).
 */
export type HatchlingDef = PlayableDef & { egg: EggTier }

export type Stage = readonly [name: string, dex: number, types: readonly PokeType[]]

/** A 3-stage line that evolves at Lv 12 and Lv 28, like the starters. */
export const line3 = (a: Stage, b: Stage, c: Stage, bonuses: readonly [StatDelta, StatDelta]) =>
  [
    { name: a[0], dex: a[1], types: a[2], evolveAt: 12, bonus: {} },
    { name: b[0], dex: b[1], types: b[2], evolveAt: 28, bonus: bonuses[0] },
    { name: c[0], dex: c[1], types: c[2], bonus: bonuses[1] },
  ] as const satisfies readonly EvolutionStage[]

/** A 2-stage line evolves once, at Lv 20, and gets the whole bonus there. */
export const line2 = (a: Stage, b: Stage, bonus: StatDelta) =>
  [
    { name: a[0], dex: a[1], types: a[2], evolveAt: 20, bonus: {} },
    { name: b[0], dex: b[1], types: b[2], bonus },
  ] as const satisfies readonly EvolutionStage[]
