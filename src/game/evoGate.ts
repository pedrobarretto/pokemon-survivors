import { chance, pick, range } from '../engine/rng'
import { BRANCHES, branchesAt, branchesOf } from '../data/branches'
import { PLAYABLE, type PlayableId } from '../data/hatchlings'
import { EVO_FIND, EVO_ITEM_IDS, type EvoItemId } from '../data/shop'
import type { EvolutionStage } from '../data/starters'
import { canBranch } from './branch'
import { burst } from './effects'
import { branchNeeds } from './evoItems'
import type { Game, Pickup } from './types'

/**
 * Evolution items in a run. A branch that needs an item (`branchNeeds`) is
 * only offered when the run holds it: owned (the save's, `ReplayStart.evo`)
 * or found here; so is a line's own step that names one
 * (`EvolutionStage.item`: Porygon2's Up-Grade, Porygon-Z's Dubious Disc,
 * Exeggutor's Leaf Stone). While the Pokémon still has such a branch ahead,
 * or such a step next, without its item, a boss down may drop one
 * (`EVO_FIND`); a found item lasts the run (`Player.evoFound`). A family with
 * no free way on stays in its form at its evolution, as strong as with an
 * Everstone (`Player.evoHeld`), until an item turns up. All from the
 * simulation and its rng, so a replay finds the same items.
 */

/** The evolution items the acting player holds: their save's and the ones they found in the run. */
export const runEvoItems = (g: Game): readonly EvoItemId[] => {
  const p = g.player
  return p.evoFound.length === 0 ? p.evoItems : [...p.evoItems, ...p.evoFound]
}

/** The item a line's step into `stage` needs (`EvolutionStage.item`), or null: a level evolution, or past the line's end. */
export const stepNeeds = (starter: PlayableId, stage: number): EvoItemId | null => {
  const line: readonly EvolutionStage[] = PLAYABLE[starter].line
  return line[stage]?.item ?? null
}

/**
 * The items the acting player's Pokémon lacks for a branch still ahead of it
 * (none once it has branched) or for its line's next step, in catalog order;
 * none under an Everstone (it never evolves). A later step's item waits for
 * the step before it (Porygon drops the Up-Grade, Porygon2 the Dubious Disc).
 */
export const missingEvoItems = (g: Game): EvoItemId[] => {
  const p = g.player
  if (p.everstone) return []
  const held = runEvoItems(g)
  const branches = p.branch === null ? branchesOf(p.starter).flatMap((b) => (BRANCHES[b].stage > p.stage ? [branchNeeds(b)] : [])) : []
  const needed = [...branches, stepNeeds(p.starter, p.stage + 1)]
  return EVO_ITEM_IDS.filter((id) => needed.includes(id) && !held.includes(id))
}

/** Whether the acting player's line's next step can go on with the items they hold: a level step always, an item step once they hold the item. */
export const stepOpen = (g: Game) => {
  const item = stepNeeds(g.player.starter, g.player.stage + 1)
  return item === null || runEvoItems(g).includes(item)
}

/**
 * A boss down: with `odds` (`EVO_FIND.chance`) it drops one of the items the
 * acting player lacks (never one already lying on the ground for them); the
 * Underground's glints dig one up for sure. Co-op runs it as each player
 * (`dropForEach`), so each drop is that player's own (`Pickup.owner`).
 */
export const dropEvoItem = (g: Game, x: number, y: number, odds: number = EVO_FIND.chance) => {
  const mine = (k: Pickup) => g.coop === null || k.owner === g.player.slot
  const missing = missingEvoItems(g).filter((id) => !g.pickups.some((k) => k.kind === 'evoItem' && k.item === id && mine(k)))
  if (missing.length === 0 || !chance(g.rng, odds)) return
  g.pickups.push({ id: g.nextId++, x, y, vx: range(g.rng, -20, 20), vy: range(g.rng, -40, -20), attracted: false, age: 0, kind: 'evoItem', item: pick(g.rng, missing) })
}

/** An evolution item picked up by the acting player: they hold it to the end. An evolution waiting on it goes on at once (`evolutionFreed`, checked by `step`). */
export const collectEvoItem = (g: Game, item: EvoItemId) => {
  const p = g.player
  if (!p.evoFound.includes(item)) p.evoFound.push(item)
  burst(g, p.x, p.y - 12, { colors: ['#f8f0a8', '#ffffff', '#a8e0f8', '#c890f8'], count: 36, speed: 110, ttl: 0.8, gravity: -30 })
  g.events.push({ kind: 'evoItem', item })
}

/** The acting player's held evolution (`Player.evoHeld`) can go on: they now hold an item for one of its branches, or for its line's next step. */
export const evolutionFreed = (g: Game) => {
  const p = g.player
  if (!p.evoHeld) return false
  const branches = p.branch === null ? branchesAt(p.starter, p.stage + 1) : []
  return branches.length > 0 ? canBranch(branches, runEvoItems(g)) : stepOpen(g)
}
