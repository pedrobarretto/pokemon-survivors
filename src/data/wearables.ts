import type { CosmeticBase, WearableSlot } from './cosmetics'

/**
 * The cosmetics worn on the sprite (`data/cosmetics.ts` spreads them
 * into the catalog): hats, glasses, scarves, capes. Each is a small 3D model
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
  beanie: { slot: 'head', rarity: 'common' },
  partyHat: { slot: 'head', rarity: 'common' },
  hairBow: { slot: 'head', rarity: 'common' },
  headband: { slot: 'head', rarity: 'common' },
  topHat: { slot: 'head', rarity: 'rare' },
  flowerCrown: { slot: 'head', rarity: 'rare' },
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

  /* ---------- Face ---------- */
  roundGlasses: { slot: 'face', rarity: 'common' },
  sunglasses: { slot: 'face', rarity: 'common' },
  noseGlasses: { slot: 'face', rarity: 'common' },
  heartShades: { slot: 'face', rarity: 'rare' },
  monocle: { slot: 'face', rarity: 'rare' },
  eyePatch: { slot: 'face', rarity: 'rare' },
  goggles: { slot: 'face', rarity: 'rare' },
  starShades: { slot: 'face', rarity: 'epic' },
  masquerade: { slot: 'face', rarity: 'epic' },

  /* ---------- Neck ---------- */
  scarf: { slot: 'neck', rarity: 'common' },
  bandana: { slot: 'neck', rarity: 'common' },
  bowTie: { slot: 'neck', rarity: 'common' },
  stripedScarf: { slot: 'neck', rarity: 'rare' },
  bellCollar: { slot: 'neck', rarity: 'rare' },
  lei: { slot: 'neck', rarity: 'rare' },
  pearls: { slot: 'neck', rarity: 'rare' },
  medal: { slot: 'neck', rarity: 'epic' },
  heroScarf: { slot: 'neck', rarity: 'legendary' },

  /* ---------- Back ---------- */
  backpack: { slot: 'back', rarity: 'common' },
  cape: { slot: 'back', rarity: 'rare' },
  balloon: { slot: 'back', rarity: 'rare' },
  batWings: { slot: 'back', rarity: 'epic' },
  fairyWings: { slot: 'back', rarity: 'epic' },
  jetpack: { slot: 'back', rarity: 'epic' },
  angelWings: { slot: 'back', rarity: 'legendary' },
  royalCape: { slot: 'back', rarity: 'legendary' },
} as const satisfies Record<string, WearableDef>

export type WearableId = keyof typeof WEARABLES

export const WEARABLE_IDS = Object.keys(WEARABLES) as WearableId[]

export const isWearableId = (v: unknown): v is WearableId => typeof v === 'string' && Object.hasOwn(WEARABLES, v)
