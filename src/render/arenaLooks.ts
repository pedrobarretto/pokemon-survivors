import type { ArenaLook } from '../data/arenaCosmetics'

/**
 * The running Arena match's equipped looks, by seat (`Game.players` index).
 * Shell state, never the simulation's: the shell sets them from the match's
 * loadouts when it starts and clears them when it ends, and whatever draws a
 * seat's Pokémon (`render/wearables.ts`, the Arena's effects) reads them here.
 */
let looks: readonly ArenaLook[] = []

export const setArenaLooks = (bySeat: readonly ArenaLook[]) => {
  looks = bySeat
}

/**
 * The running match, as the shell names it (room and run), or null: the
 * effects (`render/arenaFx.ts`) take up a new match when it changes, so a
 * snapshot heal or a rejoin of the same match (new state objects) doesn't
 * play the openings again.
 */
let match: string | null = null

export const setArenaMatch = (key: string | null) => {
  match = key
}

export const arenaMatchKey = (): string | null => match

const NONE: ArenaLook = {}

export const lookOf = (seat: number): ArenaLook => looks[seat] ?? NONE

/**
 * This player's own equipped look, outside a match too (the hub's profile
 * shows its title): the shop sets it from what the account wears.
 */
let own: ArenaLook = {}

export const setLocalLook = (look: ArenaLook) => {
  own = look
}

export const localLook = (): ArenaLook => own
