import { lookIn, type CosmeticMode, type Look } from '../data/cosmetics'
import type { Game } from '../game/types'

/**
 * The running game's equipped looks, by seat (`Game.players` index): a run's
 * (solo: this player's own; co-op: each seat's, as the API vouched at the
 * room's Start) or an Arena match's. Shell state, never the simulation's: the
 * shell sets them when the game starts and clears them when it ends, and
 * whatever draws a seat's Pokémon (`render/wearables.ts`, `render/arenaFx.ts`,
 * the plates) reads them here, through `shownLook`.
 */
let looks: readonly Look[] = []

export const setLooks = (bySeat: readonly Look[]) => {
  looks = bySeat
}

/**
 * The running game, as the shell names it (a room's run, a match), or null:
 * the effects (`render/arenaFx.ts`) take up a new game when it changes, so a
 * snapshot heal or a rejoin of the same one (new state objects) doesn't play
 * the openings again.
 */
let key: string | null = null

export const setLooksGame = (k: string | null) => {
  key = k
}

export const looksGameKey = (): string | null => key

const NONE: Look = {}

/** A seat's whole look, whatever the mode (the Arena's screens: its board, its splash). */
export const lookOf = (seat: number): Look => looks[seat] ?? NONE

/** The mode a game shows looks in (`SLOT_MODES`). */
export const modeOf = (g: Pick<Game, 'versus'>): CosmeticMode => (g.versus ? 'arena' : 'run')

/** Each look as its mode shows it, kept while the look is (looks change seldom; the drawing asks every frame). */
const shown: Record<CosmeticMode, WeakMap<Look, Look>> = { run: new WeakMap(), arena: new WeakMap() }

/** The part of a seat's look that shows in `g`'s mode: what everything drawn in a game reads. */
export const shownLook = (g: Pick<Game, 'versus'>, seat: number): Look => {
  const look = lookOf(seat)
  if (look === NONE) return NONE
  const mode = modeOf(g)
  let out = shown[mode].get(look)
  if (!out) shown[mode].set(look, (out = lookIn(look, mode)))
  return out
}

/**
 * This player's own equipped look, outside a game too (the hub's profile
 * shows its title; a solo run wears it): the shop sets it from what the
 * account wears and owns.
 */
let own: Look = {}

export const setLocalLook = (look: Look) => {
  own = look
}

export const localLook = (): Look => own
