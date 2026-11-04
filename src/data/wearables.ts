import type { CosmeticBase, WearableSlot } from './cosmetics'

/**
 * The cosmetics worn on the sprite (`data/cosmetics.ts` spreads them
 * into the catalog): hats, and a balloon held at the back. Each is a small 3D model
 * (`render/wearModels.ts`, keyed by the same id) that `render/wearables.ts`
 * turns and sizes to each Pokémon, anchored per frame and direction from the
 * species' SpriteCollab offsets, so one entry fits every Pokémon the anchors
 * measured, in every mode. A species that can't wear one well is left out by hand
 * (`data/wearFits.ts`), never drawn badly. Legendary ones move.
 */
export type WearableDef = CosmeticBase & { slot: WearableSlot }

export const WEARABLES = {
  /* ---------- Head ---------- */
  strawHat: { slot: 'head', rarity: 'common' },
  cap: { slot: 'head', rarity: 'common' },
  partyHat: { slot: 'head', rarity: 'common' },
  hairBow: { slot: 'head', rarity: 'common' },
  topHat: { slot: 'head', rarity: 'rare' },
  chefHat: { slot: 'head', rarity: 'rare' },
  cowboyHat: { slot: 'head', rarity: 'rare' },
  gradCap: { slot: 'head', rarity: 'rare' },
  santaHat: { slot: 'head', rarity: 'rare' },
  witchHat: { slot: 'head', rarity: 'epic' },
  pirateHat: { slot: 'head', rarity: 'epic' },
  vikingHelmet: { slot: 'head', rarity: 'epic' },
  bunnyEars: { slot: 'head', rarity: 'epic' },
  propellerCap: { slot: 'head', rarity: 'epic' },
  crown: { slot: 'head', rarity: 'legendary' },
  halo: { slot: 'head', rarity: 'legendary' },

  /* ---------- Back ---------- */
  balloon: { slot: 'back', rarity: 'rare' },
} as const satisfies Record<string, WearableDef>

export type WearableId = keyof typeof WEARABLES

export const WEARABLE_IDS = Object.keys(WEARABLES) as WearableId[]

export const isWearableId = (v: unknown): v is WearableId => typeof v === 'string' && Object.hasOwn(WEARABLES, v)
