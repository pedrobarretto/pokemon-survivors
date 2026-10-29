import { WEARABLES, type WearableDef } from './wearables'
import { ARENA_EFFECTS, type ArenaEffectDef } from './arenaEffects'

/**
 * The Arena's cosmetics, bought with gems (`data/gems.ts`) in the Arena's
 * shop: looks only, never power, so nothing here may reach the simulation.
 * The catalog spreads two tables that live in their own modules:
 *
 * - `WEARABLES` (`data/wearables.ts`): worn on the Pokémon's sprite, anchored
 *   to the head, neck or back of every frame from SpriteCollab's offsets and
 *   drawn by `render/wearables.ts`. Generic: one hat fits every Pokémon of the
 *   Arena's roster.
 * - `ARENA_EFFECTS` (`data/arenaEffects.ts`): everything that isn't worn: a
 *   follower, trails, spawn/KO/goal effects, emotes, titles and name plates.
 *
 * A player's equipped set is an `ArenaLook`: one id per slot. It travels in
 * the room's loadout (shell side, like the name: the simulation never holds
 * it) and the API keeps it with what the account owns. Names live in i18n
 * (`wearables`, `arenaEffects`), keyed by the same ids.
 */

/** Where a cosmetic goes. The first four are worn on the sprite (`WEARABLE_SLOTS`). */
export const COSMETIC_SLOTS = ['head', 'face', 'neck', 'back', 'follower', 'trail', 'spawn', 'ko', 'goal', 'emote', 'title', 'plate'] as const

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number]

export const WEARABLE_SLOTS = ['head', 'face', 'neck', 'back'] as const satisfies readonly CosmeticSlot[]

export type WearableSlot = (typeof WEARABLE_SLOTS)[number]

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

/** Gems a cosmetic of each rarity costs, unless its entry sets its own `price`. */
export const RARITY_PRICE = { common: 150, rare: 400, epic: 900, legendary: 1800 } as const satisfies Record<Rarity, number>

/**
 * What every catalog entry has. `price`: its own price in gems; `null` is
 * never sold (a gift, a Patreon or event reward); absent, its rarity's.
 * `from`: the day (`YYYY-MM-DD`, Brasília) it shows in the shop, for drops.
 */
export type CosmeticBase = { slot: CosmeticSlot; rarity: Rarity; price?: number | null; from?: string }

export const ARENA_COSMETICS = { ...WEARABLES, ...ARENA_EFFECTS } as const satisfies Record<string, WearableDef | ArenaEffectDef>

export type CosmeticId = keyof typeof ARENA_COSMETICS & string

export const COSMETIC_IDS = Object.keys(ARENA_COSMETICS) as CosmeticId[]

export const isCosmeticId = (v: unknown): v is CosmeticId => typeof v === 'string' && Object.hasOwn(ARENA_COSMETICS, v)

const entry = (id: CosmeticId): CosmeticBase => ARENA_COSMETICS[id]

/** A cosmetic's price in gems, or null when it isn't sold. */
export const cosmeticPrice = (id: CosmeticId): number | null => {
  const { price, rarity } = entry(id)
  return price === undefined ? RARITY_PRICE[rarity] : price
}

export const slotOf = (id: CosmeticId): CosmeticSlot => entry(id).slot

/** A player's equipped cosmetics: at most one per slot. */
export type ArenaLook = Partial<Record<CosmeticSlot, CosmeticId>>

/**
 * A look from the wire or a save: only known ids in their own slot survive,
 * so an old client's or a forged look never draws something that isn't there.
 * Ownership is the API's to check (`PUT /gems/look`), not this.
 */
export const parseLook = (raw: unknown): ArenaLook => {
  if (typeof raw !== 'object' || raw === null) return {}
  const look: ArenaLook = {}
  for (const slot of COSMETIC_SLOTS) {
    const id: unknown = (raw as Record<string, unknown>)[slot]
    if (isCosmeticId(id) && slotOf(id) === slot) look[slot] = id
  }
  return look
}
