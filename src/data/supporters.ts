/**
 * Supporters: what support counts for (`game/supporters.ts` has the rules).
 * One-time donations add up as points, one per centavo, so they read the same
 * in reais and dollars: any donation makes a Supporter. Gold and Diamond are
 * monthly, by the Patreon pledge a member keeps (`PATREON_TIERS`); `gold` is
 * the cumulative total that made Gold before them (R$ 50, or US$ 10), which
 * the OG migration froze into `users.og_tier` and nothing reaches any more.
 */

import type { SupporterTier } from '../game/supporters'

export const SUPPORTER = {
  gold: 5000,
  /** Points per cent of each currency. Stripe may charge in another one: those count as dollars. */
  perCent: { brl: 1, usd: 5 },
  /** Names on the victory screen's thanks, at most. */
  credits: 40,
} as const

/** Patreon's tiers by their price, cents of the campaign's currency (US dollars): US$ 5, 10 and 20 a month. */
export const PATREON_TIERS = { supporter: 500, gold: 1000, diamond: 2000 } as const

/**
 * The campaign's Patreon tiers by id (Patreon's `tier` resources), as a
 * member's `currently_entitled_tiers` names them. A member's amounts are in
 * the patron's own currency (a Brazilian pays in reais), so the tier comes
 * from these ids, never from `currently_entitled_amount_cents`. A tier added
 * on Patreon goes here; until then its price in the payload decides
 * (`patreonMember`).
 */
export const PATREON_TIER_IDS: Readonly<Record<string, SupporterTier>> = { '29913157': 'supporter', '29913165': 'gold', '29913169': 'diamond' }

/** The Patreon page, for the monthly tiers (the support page links it). */
export const PATREON_URL = 'https://www.patreon.com/c/pokemonsurvivors'

/**
 * Supporters vote on the next family to hatch from eggs. A new poll is a new
 * `id` (the old votes stay under the old one); each option is a base form the
 * game already has sprites for (it walks in the wild horde).
 */
export const POLL = {
  id: '2026-11',
  options: [
    { id: 'axew', name: 'Axew', dex: 610 },
    { id: 'absol', name: 'Absol', dex: 359 },
    { id: 'duskull', name: 'Duskull', dex: 355 },
    { id: 'sableye', name: 'Sableye', dex: 302 },
    { id: 'wooper', name: 'Wooper', dex: 194 },
  ],
} as const

/**
 * Diamond supporters' own monthly vote, on a new ultra-rare Pokémon. Same
 * mechanics as `POLL` (a new month is a new `id`); everyone sees it, only
 * Diamond accounts vote. Options need sprites in the game (`npm run assets`).
 */
export const DIAMOND_POLL = {
  id: '2026-11-diamond',
  options: [
    { id: 'lapras', name: 'Lapras', dex: 131 },
    { id: 'ditto', name: 'Ditto', dex: 132 },
    { id: 'spiritomb', name: 'Spiritomb', dex: 442 },
    { id: 'goomy', name: 'Goomy', dex: 704 },
    { id: 'frigibax', name: 'Frigibax', dex: 996 },
  ],
} as const

/** The polls by who votes: `supporters` any supporter, `diamond` Diamond only. */
export const POLLS = { supporters: POLL, diamond: DIAMOND_POLL } as const

export type PollKind = keyof typeof POLLS

/** An option of the `K` poll. */
export type PollOption<K extends PollKind> = (typeof POLLS)[K]['options'][number]['id']

export type PollOptionId = PollOption<'supporters'>

export const pollOptionIds = <K extends PollKind>(kind: K): readonly PollOption<K>[] => POLLS[kind].options.map((o): PollOption<K> => o.id)

/** The `kind` poll's options, typed by it. */
export const pollOptions = <K extends PollKind>(kind: K): readonly { id: PollOption<K>; name: string; dex: number }[] => POLLS[kind].options

export const isPollOptionOf = <K extends PollKind>(kind: K, v: unknown): v is PollOption<K> => pollOptionIds(kind).some((id) => id === v)

export const POLL_OPTION_IDS: readonly PollOptionId[] = pollOptionIds('supporters')

export const isPollOption = (v: unknown): v is PollOptionId => isPollOptionOf('supporters', v)
