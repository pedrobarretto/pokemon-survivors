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

const NONE: ArenaLook = {}

export const lookOf = (seat: number): ArenaLook => looks[seat] ?? NONE
