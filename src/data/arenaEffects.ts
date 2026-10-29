import type { CosmeticBase, CosmeticSlot, WearableSlot } from './arenaCosmetics'

/**
 * The Arena's cosmetics that aren't worn (`data/arenaCosmetics.ts` spreads
 * them into the catalog): a follower that trots after the Pokémon, a trail,
 * the spawn, KO and goal effects, emotes, titles and name plates. Pure
 * presentation, drawn by the shell from what the simulation already says
 * happened (a goal, a KO), never feeding back into it.
 */
export type ArenaEffectDef = CosmeticBase & { slot: Exclude<CosmeticSlot, WearableSlot> }

export const ARENA_EFFECTS = {
  sparkTrail: { slot: 'trail', rarity: 'common' },
} as const satisfies Record<string, ArenaEffectDef>

export type ArenaEffectId = keyof typeof ARENA_EFFECTS
