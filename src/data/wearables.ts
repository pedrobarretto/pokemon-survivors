import type { CosmeticBase, WearableSlot } from './arenaCosmetics'

/**
 * The cosmetics worn on the sprite (`data/arenaCosmetics.ts` spreads them
 * into the catalog): hats, glasses, scarves, capes. Each is drawn by
 * `render/wearables.ts`, anchored per frame and direction, so one entry fits
 * every Pokémon of the Arena's roster.
 */
export type WearableDef = CosmeticBase & { slot: WearableSlot }

export const WEARABLES = {
  strawHat: { slot: 'head', rarity: 'common' },
} as const satisfies Record<string, WearableDef>

export type WearableId = keyof typeof WEARABLES
