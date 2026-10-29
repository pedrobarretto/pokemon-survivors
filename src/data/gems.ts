/**
 * Gems: the Arena shop's currency (`data/arenaCosmetics.ts`). They buy looks
 * only, never power. The API keeps every account's balance in a ledger (the
 * device never decides one), fed from three sources:
 *
 * - `GEM_PACKS`: bought with money. Card, Apple Pay and Google Pay through
 *   Stripe Checkout, in reais in Brazil and dollars elsewhere; Pix through
 *   AbacatePay. A refund or a dispute takes the pack's gems back.
 * - `GEM_PATREON`: a member's first paid Patreon charge each Brasília month, by that pledge's active tier.
 * - `GEM_PLAY`: Arena matches the relay reported, capped per day.
 */

/** Gems a pack gives (`gems` + `bonus`) and its price in cents of each currency. */
export type GemPack = { gems: number; bonus: number; brl: number; usd: number }

export const GEM_PACKS = {
  pouch: { gems: 100, bonus: 0, brl: 490, usd: 99 },
  bag: { gems: 500, bonus: 50, brl: 2490, usd: 499 },
  chest: { gems: 1000, bonus: 200, brl: 4990, usd: 999 },
  hoard: { gems: 2000, bonus: 600, brl: 9990, usd: 1999 },
  vault: { gems: 5000, bonus: 2000, brl: 24990, usd: 4999 },
} as const satisfies Record<string, GemPack>

export type GemPackId = keyof typeof GEM_PACKS

export const GEM_PACK_IDS = Object.keys(GEM_PACKS) as GemPackId[]

export const isGemPackId = (v: unknown): v is GemPackId => typeof v === 'string' && Object.hasOwn(GEM_PACKS, v)

export const packGems = (id: GemPackId) => GEM_PACKS[id].gems + GEM_PACKS[id].bonus

export type GemCurrency = 'brl' | 'usd'

/** How a pack is paid: `card` is Stripe Checkout (cards, Apple Pay, Google Pay), `pix` AbacatePay (reais only). */
export type GemMethod = 'card' | 'pix'

/** Gems each paid Patreon charge brings, by the pledge's active tier (`game/supporters.ts`). */
export const GEM_PATREON = { supporter: 300, gold: 700, diamond: 1600 } as const

/** Gems from playing: a finished Arena match the relay reported, a win's extra, and the most a day (Brasília) gives. */
export const GEM_PLAY = { match: 5, win: 10, daily: 60 } as const
