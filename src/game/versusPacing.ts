import { PLAYABLE } from '../data/hatchlings'
import { VERSUS_KIT } from '../data/versus'
import { draftOffers, type Loadout } from './leveling'
import type { Game, Offer, Player } from './types'

/**
 * The Arena's pace of the kit (`VERSUS_KIT`): Move 1 from the opening draft,
 * Move 2 at `secondMove`, and an evolution at each of `evolveAt` (a run's
 * Lv 12 and 28 don't fit a 7-minute match) whose new form offers its own
 * moves to take one's place: the first evolution Move 1's, the second Move
 * 2's, as Unite's Charmeleon picks Flamethrower or Fire Spin. Every other
 * level-up upgrades the kit (no new moves, no duo fusions: `Loadout.kit`).
 */

/** The moves of the form `p` stands in now (its stage's list) that it doesn't carry. */
const upgradeMoves = (p: Player) => {
  const owned = new Set<string>(p.moves.map((m) => m.id))
  return (PLAYABLE[p.starter].learnset[p.stage] ?? []).filter((id) => !owned.has(id))
}

/** After an evolution in the Arena: the new form's move upgrade waits as a level-up (stage 1 upgrades Move 1, stage 2 Move 2). */
export const queueUpgrade = (p: Player) => {
  const v = p.versus
  if (!v || p.stage < 1 || p.stage >= VERSUS_KIT.moves || !p.moves[p.stage] || upgradeMoves(p).length === 0) return
  v.upgrade = p.stage
  p.pendingLevelUps++
}

/**
 * The kit's own level-ups (`advancePhase`), or null for a regular one: after
 * an evolution (`VersusSeat.upgrade`) the new form's moves to take Move 1's or
 * Move 2's place, at its level; Move 2 once the level reaches `secondMove`
 * (the draft's cards, from the first form's moves). Marks the slot the screen
 * teaches (`VersusSeat.learn`), which the pick fills or replaces (`applyOffer`).
 */
export const kitOffers = (g: Game, loadout: Loadout): Offer[] | null => {
  const p = g.player
  const v = p.versus
  if (!v) return null
  if (v.upgrade > 0) {
    const slot = v.upgrade
    v.upgrade = 0
    const owned = p.moves[slot]
    const fresh = owned ? upgradeMoves(p) : []
    if (owned && fresh.length > 0) {
      v.learn = slot
      return fresh.map((id): Offer => ({ kind: 'move', id, level: owned.level }))
    }
  }
  if (p.moves.length === VERSUS_KIT.moves - 1 && p.level >= VERSUS_KIT.secondMove) {
    v.learn = VERSUS_KIT.moves - 1
    return draftOffers(loadout, g.rng)
  }
  return null
}
