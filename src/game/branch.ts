import { weightedPick, type Rng } from '../engine/rng'
import type { BiomeId, WeatherId } from '../data/biomes'
import { BRANCH_FAVOR_WEIGHT, BRANCHES, branchStage, type BranchDef, type BranchId } from '../data/branches'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import type { EvoItemId } from '../data/shop'
import type { EvolutionStage } from '../data/starters'
import { branchNeeds, evoItemFor } from './evoItems'
import type { Game, Player } from './types'
import { legendStage } from './legend'
import { weatherHere } from './weather'

/**
 * Branching evolutions in a run (`data/branches.ts`). The branch picked lives
 * in `Game.branch` and replaces its stage of the line from then on, so
 * everything that asks "which form is the player" goes through `formAt` /
 * `playerForm`. Which branches a run can take hangs on its evolution items
 * (`evolutionOffers`); the draw is pure and takes the run's rng, so a replay
 * draws the same.
 */

/** The stage of a line at `stage`, or the branch picked when it replaces that stage. */
export const formAt = (starter: PlayableId, branch: BranchId | null, stage: number): EvolutionStage => {
  const line: readonly EvolutionStage[] = PLAYABLE[starter].line
  const at = Math.min(stage, line.length - 1)
  const b = branch ? BRANCHES[branch] : null
  if (!b || b.line !== starter || at < b.stage) return line[at]!
  // The branch keeps the line's evolution level, for a branch that evolves on (none yet).
  const own = line[at]!
  return own.evolveAt === undefined ? branchStage(branch!) : { ...branchStage(branch!), evolveAt: own.evolveAt }
}

/** The whole line as the run plays it, with the branch in place. */
export const formLine = (starter: PlayableId, branch: BranchId | null): readonly EvolutionStage[] =>
  PLAYABLE[starter].line.map((_, i) => formAt(starter, branch, i))

/** The form the acting player is in right now (before a Mega form): a legend's awakened form and Multitype's typing included (`legendStage`). */
export const playerForm = (g: Game): EvolutionStage => formOf(g, g.player)

/** A player's current form, for the shell reading a player that isn't acting (`localPlayer`). */
export const formOf = (g: Game, p: Player): EvolutionStage => (p.legend ? legendStage(g, p.legend) : formAt(p.starter, p.branch, p.stage))

/** What nudges the draw: the weather where the player stands and the biome. */
export type BranchContext = { weather: WeatherId; biome: BiomeId }

export const branchContext = (g: Game): BranchContext => ({ weather: weatherHere(g), biome: g.player.biome })

/** Why a branch is offered: the weather or the biome favored its draw, or an evolution item the run holds unlocks it (null: drawn plainly). */
export type BranchFavor = 'weather' | 'biome' | 'item' | null

/** How the run's context favors a branch: the weather first, then the biome. */
export const favorOf = (id: BranchId, ctx: BranchContext): BranchFavor => {
  const def: BranchDef = BRANCHES[id]
  const f = def.favors ?? {}
  if (f.weather?.includes(ctx.weather)) return 'weather'
  if (f.biome?.includes(ctx.biome)) return 'biome'
  return null
}

export type BranchOffer = { id: BranchId; favor: BranchFavor }

/** Whether `items` holds the item that names `id` (for a `free` branch, the one that adds it to the choice). */
const unlockedBy = (id: BranchId, items: readonly EvoItemId[]) => {
  const item = evoItemFor(id)
  return item !== null && items.includes(item)
}

/**
 * Where an evolution into `options` may go with the evolution items the run
 * holds (`items`: the save's and the ones found, `runEvoItems`). Every branch
 * whose item is held is offered, marked `item`; of the free branches left
 * (`branchNeeds` null), one joins them, drawn, the ones the weather or biome
 * favors `BRANCH_FAVOR_WEIGHT` times likelier. In data order. Empty: no free
 * branch and no item, so the evolution waits (`holdEvolution`); one: it goes
 * there without asking. It draws from `rng` only between two or more free
 * branches (Eevee's), so the others never move the run's rng.
 */
export const evolutionOffers = (rng: Rng, options: readonly BranchId[], ctx: BranchContext, items: readonly EvoItemId[]): BranchOffer[] => {
  const free = options.filter((id) => branchNeeds(id) === null && !unlockedBy(id, items))
  const drawn = free.length > 1 ? weightedPick(rng, free.map((id) => [id, favorOf(id, ctx) ? BRANCH_FAVOR_WEIGHT : 1] as const)) : free[0]
  return options.filter((id) => id === drawn || unlockedBy(id, items)).map((id) => ({ id, favor: unlockedBy(id, items) ? 'item' : favorOf(id, ctx) }))
}

/** Whether an evolution into `options` can go anywhere with `items`: false while it waits for an item. */
export const canBranch = (options: readonly BranchId[], items: readonly EvoItemId[]) =>
  options.some((id) => {
    const item = branchNeeds(id)
    return item === null || items.includes(item)
  })
