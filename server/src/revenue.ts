import type { GemPackId } from '../../src/data/gems'

/**
 * A payment the API just confirmed, told once however often its webhook
 * retries: a gem pack credited, a donation paid, a Patreon charge recorded.
 */
export type Revenue = {
  source: 'gems' | 'donation' | 'patreon'
  provider: 'stripe' | 'abacatepay' | 'patreon'
  /** In the currency's cents (centavos). */
  amount: number
  currency: string
  /** The gem pack bought; null for a donation or a charge. */
  pack: GemPackId | null
  /** The account (its Clerk user id, the distinct id the game identifies with); null when the payment has none (a donation without a handle, a patron not linked yet). */
  userId: string | null
  /** The payment's own ref (a purchase's uuid, a donation's or a charge's ref), never anything about the payer. */
  ref: string
}

/** The event name PostHog's revenue analytics reads (`revenue` in the currency, `currency` its ISO code). */
export const REVENUE_EVENT = 'payment'

/**
 * `r` as a PostHog capture: on the account's distinct id, so it lands on the
 * player's person next to their events from the game; a payment without one
 * gets an id of its own and no person profile.
 */
export const revenueCapture = (r: Revenue) => ({
  distinctId: r.userId ?? `payment:${r.ref}`,
  event: REVENUE_EVENT,
  properties: {
    revenue: r.amount / 100,
    currency: r.currency.toUpperCase(),
    source: r.source,
    provider: r.provider,
    pack: r.pack,
    ref: r.ref,
    service: 'api',
    ...(r.userId ? {} : { $process_person_profile: false }),
  },
})
