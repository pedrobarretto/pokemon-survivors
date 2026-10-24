import { evolvedFrom } from '../data/evolutions'
import type { ItemId } from '../data/items'
import type { PokeType } from '../data/types'
import type { DuoMoveId } from './duoMoves'
import { maxMoveLevel, MOVES, moveStats, type MoveDef, type MoveId } from './moves'
import { BASE_STATS } from './stats'
import type { OwnedMove } from './types'

/**
 * Duo moves, Vampire Survivors unions in Pokémon terms (the Pledges, Fusion
 * Flare and Bolt…): two maxed moves of a recipe's two types fuse into one duo
 * move that takes the first one's slot and frees the other's. Recipes go by
 * type, so they work with any learnset. A move counts once it's at max level,
 * or as an evolved move at any level. A run fuses at most one duo: it's the
 * capstone. Pure rules, tested in `duoRules.test.ts`; the moves live in `duoMoves.ts`.
 */

/** `to` (of `types[0]`, whose move's slot it takes) comes from a move of `types[0]` and one of `types[1]`; `alt` instead when the second is the stronger one. */
export type DuoRecipe = { types: readonly [PokeType, PokeType]; to: DuoMoveId; alt?: DuoMoveId }

export const DUO_RECIPES = [
  { types: ['fire', 'grass'], to: 'firePledge' },
  { types: ['water', 'fire'], to: 'waterPledge' },
  { types: ['grass', 'water'], to: 'grassPledge' },
  { types: ['fire', 'electric'], to: 'fusionFlare', alt: 'fusionBolt' },
  { types: ['electric', 'water'], to: 'ionDeluge' },
  { types: ['ice', 'water'], to: 'freezeDry' },
  { types: ['ghost', 'poison'], to: 'nightmare' },
] as const satisfies readonly DuoRecipe[]

/** Whether a move is a duo move (`MoveDef.duo`). */
export const isDuo = (id: MoveId) => {
  const def: MoveDef = MOVES[id]
  return def.duo === true
}

/** The recipe a duo move comes from. */
export const recipeOf = (id: MoveId): DuoRecipe | undefined => DUO_RECIPES.find((r) => r.to === id || ('alt' in r && r.alt === id))

/** Whether an owned move can go into a fusion: a base move at max level, or an evolved one at any level. */
export const fusable = (m: OwnedMove) => !isDuo(m.id) && (evolvedFrom(m.id) !== undefined || m.level >= maxMoveLevel(m.id))

/** A move's punch at its level, without the player's stats: damage × shots ÷ cooldown. */
export const movePower = (m: OwnedMove) => {
  const s = moveStats(m.id, m.level, BASE_STATS, m.path ?? 0)
  return (s.damage * s.amount) / s.cooldown
}

/** The weakest fusable move of `type` other than `keep`, so a fusion spends the lesser move of the pair (ties to the earlier slot). */
const ingredient = (moves: readonly OwnedMove[], type: PokeType, keep: MoveId | null) => {
  let best: OwnedMove | null = null
  for (const m of moves) {
    if (MOVES[m.id].type !== type || m.id === keep || !fusable(m)) continue
    if (!best || movePower(m) < movePower(best)) best = m
  }
  return best
}

export type ReadyDuo = { from: readonly [MoveId, MoveId]; to: DuoMoveId }

/**
 * Fusions the loadout can make right now, in recipe order: none once it holds
 * a duo move. `keep` never goes in (a legend's own legendary move, `legendSignature`);
 * recipes whose duo was forgotten (`banished`, Esquecer) are gone for the run.
 */
export const readyDuos = (moves: readonly OwnedMove[], keep: MoveId | null = null, banished: ReadonlySet<MoveId | ItemId> = new Set()): ReadyDuo[] => {
  if (moves.some((m) => isDuo(m.id))) return []
  return DUO_RECIPES.flatMap((recipe: DuoRecipe): ReadyDuo[] => {
    if (banished.has(recipe.to)) return []
    const a = ingredient(moves, recipe.types[0], keep)
    const b = ingredient(moves, recipe.types[1], keep)
    if (!a || !b) return []
    const to = recipe.alt && movePower(b) > movePower(a) ? recipe.alt : recipe.to
    return [{ from: [a.id, b.id], to }]
  })
}

/** Recipes a run could make: both types among the moves it can learn (the pause screen and the inspect panel list them). */
export const reachableDuos = (types: ReadonlySet<PokeType>): readonly DuoRecipe[] =>
  DUO_RECIPES.filter((r) => types.has(r.types[0]) && types.has(r.types[1]))
