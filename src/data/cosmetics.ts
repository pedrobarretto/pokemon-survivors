import { WEARABLES, type WearableDef } from './wearables'
import { ARENA_EFFECTS, type ArenaEffectDef } from './arenaEffects'

/**
 * The game's cosmetics, bought with gems (`data/gems.ts`) in the gem shop:
 * looks only, never power, so nothing here may reach the simulation. They
 * show in every mode a slot makes sense in (`SLOT_MODES`): a run, solo or
 * co-op, and the Arena. The catalog spreads two tables that live in their
 * own modules:
 *
 * - `WEARABLES` (`data/wearables.ts`): worn on the Pokémon's sprite, anchored
 *   to the head, neck or back of every frame from SpriteCollab's offsets and
 *   drawn by `render/wearables.ts`. Generic: one hat fits every Pokémon the
 *   anchors measured (`data/wearAnchors/`); any other draws bare.
 * - `ARENA_EFFECTS` (`data/arenaEffects.ts`): everything that isn't worn: a
 *   follower, trails, spawn/KO/goal effects, emotes, titles and name plates.
 *
 * A player's equipped set is an `Look`: one id per slot. It travels in
 * the room's loadout (shell side, like the name: the simulation never holds
 * it) and the API keeps it with what the account owns. Names live in i18n
 * (`wearables`, `arenaEffects`), keyed by the same ids.
 */

/** Where a cosmetic goes. The first four are worn on the sprite (`WEARABLE_SLOTS`). */
export const COSMETIC_SLOTS = ['head', 'face', 'neck', 'back', 'follower', 'trail', 'spawn', 'ko', 'goal', 'emote', 'title', 'plate'] as const

export type CosmeticSlot = (typeof COSMETIC_SLOTS)[number]

export const WEARABLE_SLOTS = ['head', 'face', 'neck', 'back'] as const satisfies readonly CosmeticSlot[]

export type WearableSlot = (typeof WEARABLE_SLOTS)[number]

/** The modes a look shows in: a run (solo or co-op, the Dojo and Legend mode too) and the Arena. A new mode is a new entry here and in `SLOT_MODES`. */
export const COSMETIC_MODES = ['run', 'arena'] as const

export type CosmeticMode = (typeof COSMETIC_MODES)[number]

const EVERYWHERE = COSMETIC_MODES

/**
 * Where each slot shows. What's worn, the follower, the trail, the title and
 * the plate go everywhere; the spawn, KO and goal effects and the emote need
 * moments only the Arena has (a respawn, a knock-out of a rival, a goal, the
 * emote's tick entry), so they show there alone for now. The shop says so on
 * an item whose slot doesn't show everywhere (`arenaOnly`).
 */
export const SLOT_MODES: Readonly<Record<CosmeticSlot, readonly CosmeticMode[]>> = {
  head: EVERYWHERE,
  face: EVERYWHERE,
  neck: EVERYWHERE,
  back: EVERYWHERE,
  follower: EVERYWHERE,
  trail: EVERYWHERE,
  title: EVERYWHERE,
  plate: EVERYWHERE,
  spawn: ['arena'],
  ko: ['arena'],
  goal: ['arena'],
  emote: ['arena'],
}

/** Whether a slot's cosmetics show in `mode`. */
export const showsIn = (slot: CosmeticSlot, mode: CosmeticMode): boolean => SLOT_MODES[slot].includes(mode)

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'

/** Gems a cosmetic of each rarity costs, unless its entry sets its own `price`. */
export const RARITY_PRICE = { common: 150, rare: 400, epic: 900, legendary: 1800 } as const satisfies Record<Rarity, number>

/**
 * What every catalog entry has. `price`: its own price in gems; `null` is
 * never sold (a gift, a Patreon or event reward); absent, its rarity's.
 * `from`: the day (`YYYY-MM-DD`, Brasília) it shows in the shop, for drops.
 */
export type CosmeticBase = { slot: CosmeticSlot; rarity: Rarity; price?: number | null; from?: string }

export const COSMETICS = { ...WEARABLES, ...ARENA_EFFECTS } as const satisfies Record<string, WearableDef | ArenaEffectDef>

export type CosmeticId = keyof typeof COSMETICS & string

export const COSMETIC_IDS = Object.keys(COSMETICS) as CosmeticId[]

export const isCosmeticId = (v: unknown): v is CosmeticId => typeof v === 'string' && Object.hasOwn(COSMETICS, v)

const entry = (id: CosmeticId): CosmeticBase => COSMETICS[id]

/** A cosmetic's price in gems, or null when it isn't sold. */
export const cosmeticPrice = (id: CosmeticId): number | null => {
  const { price, rarity } = entry(id)
  return price === undefined ? RARITY_PRICE[rarity] : price
}

export const slotOf = (id: CosmeticId): CosmeticSlot => entry(id).slot

/** Whether a cosmetic shows only in the Arena (the shop tells the buyer). */
export const arenaOnly = (id: CosmeticId): boolean => !showsIn(slotOf(id), 'run')

/** A player's equipped cosmetics: at most one per slot. */
export type Look = Partial<Record<CosmeticSlot, CosmeticId>>

/**
 * A look from the wire or a save: only known ids in their own slot survive,
 * so an old client's or a forged look never draws something that isn't there.
 * Ownership is the API's to check (`PUT /gems/look`), not this.
 */
export const parseLook = (raw: unknown): Look => {
  if (typeof raw !== 'object' || raw === null) return {}
  const look: Look = {}
  for (const slot of COSMETIC_SLOTS) {
    const id: unknown = (raw as Record<string, unknown>)[slot]
    if (isCosmeticId(id) && slotOf(id) === slot) look[slot] = id
  }
  return look
}

/** The part of a look that shows in `mode` (`SLOT_MODES`). */
export const lookIn = (look: Look, mode: CosmeticMode): Look => {
  const shown: Look = {}
  for (const slot of COSMETIC_SLOTS) if (look[slot] !== undefined && showsIn(slot, mode)) shown[slot] = look[slot]
  return shown
}
