/**
 * Gems: the Arena shop's currency (`data/cosmetics.ts`). They buy looks
 * only, never power. The API keeps every account's balance in a ledger (the
 * device never decides one), fed from three sources:
 *
 * - `GEM_PACKS`: bought with money. Card, Apple Pay and Google Pay through
 *   Stripe Checkout, in reais in Brazil and dollars elsewhere; Pix through
 *   AbacatePay. A refund or a dispute takes the pack's gems back. An account
 *   buys at most `GEM_CHECKOUT.daily` of them a Brasília day, and a `once`
 *   pack (the welcome pack) once ever.
 * - `GEM_PATREON`: a member's first paid Patreon charge each Brasília month,
 *   by that pledge's active tier, worth what the pack of the same price gives.
 * - `GEM_PLAY`: play the API saw on its own (a run's report, a relay's): the
 *   day's first long run, five such days in a week, and Arena matches, each
 *   with its own limit. Never from the device's word (missions, a save).
 */

/** Gems a pack gives (`gems` + `bonus`) and its price in cents of each currency. `once`: an account buys it once ever (the shop shows it until then). */
export type GemPack = { gems: number; bonus: number; brl: number; usd: number; once?: true }

/** The packs, in the shop's order. Prices and gems match the cosmetics' (`RARITY_PRICE`): the Bolsa buys one epic, the Baú one legendary. */
export const GEM_PACKS = {
  welcome: { gems: 400, bonus: 0, brl: 990, usd: 199, once: true },
  pouch: { gems: 200, bonus: 0, brl: 990, usd: 199 },
  bag: { gems: 500, bonus: 50, brl: 2490, usd: 499 },
  chest: { gems: 1000, bonus: 200, brl: 4990, usd: 999 },
  hoard: { gems: 2000, bonus: 600, brl: 9990, usd: 1999 },
  vault: { gems: 5000, bonus: 2000, brl: 24990, usd: 4999 },
} as const satisfies Record<string, GemPack>

export type GemPackId = keyof typeof GEM_PACKS

export const GEM_PACK_IDS = Object.keys(GEM_PACKS) as GemPackId[]

export const isGemPackId = (v: unknown): v is GemPackId => typeof v === 'string' && Object.hasOwn(GEM_PACKS, v)

export const packGems = (id: GemPackId) => GEM_PACKS[id].gems + GEM_PACKS[id].bonus

/** Whether an account buys pack `id` only once (`once`). */
export const oncePack = (id: GemPackId) => {
  const pack: GemPack = GEM_PACKS[id]
  return pack.once === true
}

export type GemCurrency = 'brl' | 'usd'

/** How a pack is paid: `card` is Stripe Checkout (cards, Apple Pay, Google Pay), `pix` AbacatePay (reais only). */
export type GemMethod = 'card' | 'pix'

/**
 * The checkout's brakes, per account: `daily` cents of packs a Brasília day
 * in each currency (paid ones and pending ones count), and `holdMinutes`, how
 * long an unpaid checkout counts as pending (a Stripe session expires sooner,
 * `stripe.ts`; a Pix paid later still lands).
 */
export const GEM_CHECKOUT = { daily: { brl: 25000, usd: 5000 }, holdMinutes: 35 } as const

/**
 * Gems each paid Patreon charge brings, by the pledge's active tier
 * (`game/supporters.ts`): what the pack of the same price gives (US$ 5 the
 * Bolsa, US$ 10 the Baú, US$ 20 the Tesouro, `PATREON_TIERS`).
 */
export const GEM_PATREON = { supporter: 550, gold: 1200, diamond: 2600 } as const

/**
 * Gems from playing, from what the API recorded itself (never the device's
 * word), each under its own ledger ref so a report that comes twice lands once:
 *
 * - `run`: the Brasília day's first run (solo, from its report; co-op, from
 *   the relay's, to the seats that stayed) that lasted `seconds` or more.
 * - `week`: once a Monday-to-Sunday week (Brasília) holds `days` such days.
 * - `arena`: a public Arena match played out (`match`, plus `win`), up to
 *   `daily` a Brasília day; private rooms give none (two accounts and bots
 *   could farm them). The cap counts Arena gems only.
 */
export const GEM_PLAY = {
  run: { gems: 15, seconds: 300 },
  week: { gems: 35, days: 5 },
  arena: { match: 5, win: 5, daily: 30 },
} as const
