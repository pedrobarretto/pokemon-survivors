import { HATCHLINGS, HATCHLING_IDS, type HatchlingId } from './hatchlings'
import { STARTERS, STARTER_IDS, type StarterId } from './starters'

/**
 * The Máquina de Pelúcias' prizes (`realm/games/claw.rules.ts` rotates them):
 * a plush of any family a player can have, legends left out. Each is a piece
 * of furniture of its own (`plush:<family>`, `data/furniture.ts`), drawn from
 * the family's first form (`render/plush.ts`).
 */

export type PlushFamily = StarterId | HatchlingId

/** Every family that can stand in the machine. */
export const PLUSH_POOL: readonly PlushFamily[] = [...STARTER_IDS, ...HATCHLING_IDS]

/** Temporada 1's families that come only from the machine: one is always in it, and winning one brings the family to life (a `family` gift). */
export const PLUSH_EXCLUSIVES = ['mimikyu', 'morpeko', 'tandemaus'] as const satisfies readonly HatchlingId[]

export type PlushPiece = `plush:${PlushFamily}`

export const isPlushFamily = (v: unknown): v is PlushFamily => typeof v === 'string' && (Object.hasOwn(STARTERS, v) || Object.hasOwn(HATCHLINGS, v))

export type ExclusivePlush = (typeof PLUSH_EXCLUSIVES)[number]

export const isExclusivePlush = (family: PlushFamily): family is ExclusivePlush => (PLUSH_EXCLUSIVES as readonly PlushFamily[]).includes(family)

/** The furniture piece a family's plush is. */
export const plushPiece = (family: PlushFamily): PlushPiece => `plush:${family}`

/** The family a furniture id is the plush of, or null for any other piece. */
export const plushFamily = (id: string): PlushFamily | null => {
  const family = id.startsWith('plush:') ? id.slice(6) : null
  return isPlushFamily(family) ? family : null
}

/** A family's first form, the one its plush shows. */
export const plushForm = (family: PlushFamily) => (Object.hasOwn(STARTERS, family) ? STARTERS[family as StarterId] : HATCHLINGS[family as HatchlingId]).line[0]
