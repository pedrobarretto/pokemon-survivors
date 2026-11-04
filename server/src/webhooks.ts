import { createHmac, timingSafeEqual } from 'node:crypto'
import { isRecord } from '../../src/game/parse'
import { parseHandle } from '../../src/game/ranking'
import { PATREON_TIER_IDS } from '../../src/data/supporters'
import { brasiliaDay } from '../../src/game/day'
import { highestTier, pledgeTier, type SupporterTier } from '../../src/game/supporters'
import type { GemEvent } from './gems'

/**
 * Payment webhooks, as pure functions: checking that an event really came
 * from Stripe, AbacatePay or Patreon, and reading the paid donation, a gem
 * pack's payment, refund or dispute, or a patron's pledge out of it.
 */

/** A paid donation, as a webhook tells it. `handle`: the account it's for, when the donor gave one. */
export type PaidDonation = { provider: 'stripe' | 'abacatepay'; ref: string; amount: number; currency: string; handle: string | null }

/** Prefix of our AbacatePay checkouts' `externalId` (the account is shared with other products). */
export const ABACATE_REF = 'pokemon-survivors-donation:'

/** A count of cents (or reais' centavos), or null. */
const cents = (v: unknown) => (typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 ? v : null)

/** Events older than this are refused, so a captured one can't be replayed later (Stripe's default). */
const STRIPE_TOLERANCE = 300

const sameText = (a: string, b: string) => {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

/**
 * Whether `header` (`Stripe-Signature: t=…,v1=…`) signs `body` with the
 * endpoint's secret: an HMAC-SHA256 of `t.body`, hex, within `STRIPE_TOLERANCE` of `now` (seconds).
 */
export const verifyStripe = (body: string, header: string | undefined, secret: string, now: number) => {
  if (!header) return false
  const parts = header.split(',').map((p) => ({ key: p.slice(0, p.indexOf('=')), value: p.slice(p.indexOf('=') + 1) }))
  const t = Number(parts.find((p) => p.key === 't')?.value)
  if (!Number.isInteger(t) || Math.abs(now - t) > STRIPE_TOLERANCE) return false
  const expected = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')
  return parts.some((p) => p.key === 'v1' && sameText(p.value, expected))
}

/**
 * The donation a Stripe event pays, or null for any other event: a finished
 * Checkout Session that's paid (`checkout.session.completed`, or
 * `async_payment_succeeded` for slower methods), of our Payment Link when
 * `paymentLink` is set. The handle comes as `client_reference_id`; with
 * Adaptive Pricing the amount is read in the link's own currency.
 */
export const stripeDonation = (event: unknown, paymentLink: string | null): PaidDonation | null => {
  if (!isRecord(event) || !isRecord(event.data) || !isRecord(event.data.object)) return null
  const type = event.type
  const s = event.data.object
  if (type !== 'checkout.session.completed' && type !== 'checkout.session.async_payment_succeeded') return null
  if (s.payment_status !== 'paid' || typeof s.id !== 'string') return null
  // A gem pack's session (`stripeGems`), never a donation.
  if (isRecord(s.metadata) && s.metadata.kind === 'gems') return null
  if (paymentLink && s.payment_link !== paymentLink) return null
  const conversion = isRecord(s.currency_conversion) ? s.currency_conversion : null
  const amount = conversion ? conversion.amount_total : s.amount_total
  const currency = conversion ? conversion.source_currency : s.currency
  if (typeof amount !== 'number' || typeof currency !== 'string') return null
  return { provider: 'stripe', ref: s.id, amount, currency, handle: parseHandle(s.client_reference_id) }
}

/** Our purchase refs (`gem_purchases.ref`): uuids, nothing else reaches a query. */
const PURCHASE_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** A Stripe object id (`pi_…`, `ch_…`, `du_…`, `cs_…`). */
const STRIPE_ID = /^[a-z]{2,4}_[A-Za-z0-9_]{6,250}$/

const stripeId = (v: unknown) => (typeof v === 'string' && STRIPE_ID.test(v) ? v : null)

/**
 * What a Stripe event says about a gem pack (`GemEvent`), or null for any
 * other event:
 * - a paid Checkout Session whose metadata says `kind: gems`
 *   (`checkout.session.completed`, or `async_payment_succeeded` for slower
 *   methods): `paid`, with its session, PaymentIntent and what it charged
 *   (in the pack's own currency when Adaptive Pricing converted it);
 * - `charge.refunded`: how much of the charge went back so far
 *   (`amount_refunded`, cumulative), keyed by that total so each refund lands once;
 * - `charge.dispute.created`: a dispute (a chargeback), the whole pack. An
 *   inquiry (`warning_*`: no money withdrawn yet) takes nothing; if it
 *   escalates, Stripe opens a real dispute, which does;
 * - `charge.dispute.closed` as `won`: the dispute's gems come back.
 * Refunds and disputes name the PaymentIntent; one that isn't a pack's
 * (a donation's) finds no purchase and changes nothing.
 */
export const stripeGems = (event: unknown): GemEvent | null => {
  if (!isRecord(event) || !isRecord(event.data) || !isRecord(event.data.object)) return null
  const o = event.data.object
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const meta = isRecord(o.metadata) ? o.metadata : null
      if (meta?.kind !== 'gems' || o.payment_status !== 'paid' || typeof meta.ref !== 'string' || !PURCHASE_REF.test(meta.ref)) return null
      const conversion = isRecord(o.currency_conversion) ? o.currency_conversion : null
      const amount = cents(conversion ? conversion.amount_total : o.amount_total)
      const currency = conversion ? conversion.source_currency : o.currency
      return { kind: 'paid', provider: 'stripe', ref: meta.ref, session: stripeId(o.id), payment: stripeId(o.payment_intent), amount, currency: typeof currency === 'string' ? currency.toLowerCase() : null }
    }
    case 'charge.refunded': {
      const payment = stripeId(o.payment_intent)
      const id = stripeId(o.id)
      const amount = typeof o.amount === 'number' && Number.isSafeInteger(o.amount) ? o.amount : null
      const refunded = typeof o.amount_refunded === 'number' && Number.isSafeInteger(o.amount_refunded) ? o.amount_refunded : null
      if (!payment || !id || amount === null || refunded === null || refunded <= 0) return null
      return { kind: 'refund', provider: 'stripe', purchase: { payment }, share: { refunded, amount }, key: `refund:stripe:${id}:${refunded}` }
    }
    case 'charge.dispute.created':
    case 'charge.dispute.closed': {
      const payment = stripeId(o.payment_intent)
      const id = stripeId(o.id)
      if (!payment || !id) return null
      if (event.type === 'charge.dispute.created') {
        return typeof o.status === 'string' && o.status.startsWith('warning_') ? null : { kind: 'dispute', provider: 'stripe', purchase: { payment }, key: `dispute:stripe:${id}` }
      }
      return o.status === 'won' ? { kind: 'disputeWon', provider: 'stripe', purchase: { payment }, dispute: `dispute:stripe:${id}`, key: `dispute-won:stripe:${id}` } : null
    }
    default:
      return null
  }
}

/** The key AbacatePay signs every webhook with (public, from their docs: "Segurança dos webhooks"). */
export const ABACATEPAY_PUBLIC_KEY =
  't9dXRhHHo3yDEj5pVDYz0frf7q6bMKyMRmxxCPIPp3RCplBfXRxqlC6ZpiWmOqj4L63qEaeUOtrCI8P0VMUgo6iIga2ri9ogaHFs0WIIywSMg0q7RmBfybe1E5XJcfC4IW3alNqym0tXoAKkzvfEjZxV6bE0oG2zJrNNYmUCKZyV0KZ3JS8Votf9EAWWYdiDkMkpbMdPggfh1EqHlVkMiTady6jOR3hyzGEHrIz2Ret0xHKMbiqkr9HS1JhNHDX9'

/**
 * Whether `signature` (`X-Webhook-Signature`) signs `body`: an HMAC-SHA256
 * with AbacatePay's public key, base64. The secret in the URL is checked apart.
 */
export const verifyAbacate = (body: string, signature: string | undefined, publicKey = ABACATEPAY_PUBLIC_KEY) =>
  signature !== undefined && sameText(signature, createHmac('sha256', publicKey).update(body).digest('base64'))

/** A Standard Webhooks delivery's headers (`webhook-id`, `webhook-timestamp`, `webhook-signature`). */
export type StandardHeaders = { id: string | undefined; timestamp: string | undefined; signature: string | undefined }

/**
 * Whether a delivery signed the Standard Webhooks way (standardwebhooks.com,
 * AbacatePay's since 01/10/2026) is ours: an HMAC-SHA256 of `id.timestamp.body`
 * with the secret's key (the base64 after `whsec_`), base64, among the
 * header's space-separated `v1,<signature>`, within `STRIPE_TOLERANCE` of `now` (seconds).
 */
export const verifyStandard = (body: string, h: StandardHeaders, secret: string, now: number) => {
  if (!h.id || !h.timestamp || !h.signature) return false
  const t = Number(h.timestamp)
  if (!Number.isInteger(t) || Math.abs(now - t) > STRIPE_TOLERANCE) return false
  const key = Buffer.from(secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret, 'base64')
  const expected = createHmac('sha256', key).update(`${h.id}.${t}.${body}`).digest('base64')
  return h.signature.split(' ').some((part) => part.startsWith('v1,') && sameText(part.slice(3), expected))
}

/** The donation an AbacatePay event pays, or null: a `checkout.completed` of one of our checkouts, paid. */
export const abacateDonation = (event: unknown): PaidDonation | null => {
  if (!isRecord(event) || event.event !== 'checkout.completed' || !isRecord(event.data) || !isRecord(event.data.checkout)) return null
  const c = event.data.checkout
  if (c.status !== 'PAID' || typeof c.externalId !== 'string' || !c.externalId.startsWith(ABACATE_REF)) return null
  const amount = typeof c.paidAmount === 'number' ? c.paidAmount : c.amount
  if (typeof amount !== 'number') return null
  return { provider: 'abacatepay', ref: c.externalId.slice(ABACATE_REF.length), amount, currency: 'brl', handle: null }
}

/** Prefix of our gem packs' AbacatePay `externalId`, before the purchase ref. */
export const ABACATE_GEMS_REF = 'pokemon-survivors-gems:'

/**
 * What an AbacatePay event says about a gem pack (`GemEvent`), or null: the
 * checkout's `externalId` names the purchase. `checkout.completed` and
 * `PAID`: paid, with what it charged (`paidAmount`, reais). `checkout.refunded`:
 * the whole pack, whatever the payload's amounts say (AbacatePay refunds only
 * in full). `checkout.disputed` (a dispute or a Pix MED opened): the whole
 * pack, once per checkout. Their payloads still say `PAID`, so the event's
 * name decides. AbacatePay sends nothing when a dispute is won: support
 * gives those gems back by hand.
 */
export const abacateGems = (event: unknown): GemEvent | null => {
  if (!isRecord(event) || !isRecord(event.data) || !isRecord(event.data.checkout)) return null
  const c = event.data.checkout
  const ext = typeof c.externalId === 'string' && c.externalId.startsWith(ABACATE_GEMS_REF) ? c.externalId.slice(ABACATE_GEMS_REF.length) : null
  const id = typeof c.id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(c.id) ? c.id : null
  if (!ext || !PURCHASE_REF.test(ext) || !id) return null
  switch (event.event) {
    case 'checkout.completed':
      return c.status === 'PAID' ? { kind: 'paid', provider: 'abacatepay', ref: ext, session: id, payment: id, amount: cents(c.paidAmount) ?? cents(c.amount), currency: 'brl' } : null
    case 'checkout.refunded':
      return { kind: 'refund', provider: 'abacatepay', purchase: { ref: ext }, share: 'all', key: `refund:abacatepay:${id}` }
    case 'checkout.disputed':
      return { kind: 'dispute', provider: 'abacatepay', purchase: { ref: ext }, key: `dispute:abacatepay:${id}` }
    default:
      return null
  }
}

/**
 * Whether `signature` (`X-Patreon-Signature`) signs `body`: an HMAC-MD5 of the
 * raw body with the webhook's secret, hex (Patreon's docs, "Webhooks").
 */
export const verifyPatreon = (body: string, signature: string | undefined, secret: string) =>
  signature !== undefined && sameText(signature.toLowerCase(), createHmac('md5', secret).update(body).digest('hex'))

/**
 * A patron's paid charge, as a Patreon member event tells it. `ref` is
 * `patreon:<member id>:<charge date>`, the same however many events repeat it.
 * `patron`: their Patreon user id, the one a game account links. `lifetime`:
 * all they ever paid the campaign (null when the payload leaves it out);
 * `entitled`: what their pledge covers this period. Cents of the patron's
 * currency, which the payload doesn't name: `currency` is the campaign's.
 * `tier`: the pledge's entitled tier (`entitledTier`), which sets the
 * charge's gems (`GEM_PATREON`).
 */
export type PatreonCharge = { ref: string; member: string; patron: string; lifetime: number | null; entitled: number; currency: string; tier: SupporterTier | null }

/** Patreon's ids (members are uuids, users numbers): nothing else goes into a ref. */
const PATREON_ID = /^[A-Za-z0-9-]{1,64}$/

/** The member a Patreon `members:` event is about: its id, attributes and Patreon user id (`patron`), or null. */
const memberOf = (event: string | undefined, body: unknown) => {
  if (!event?.startsWith('members:') || !isRecord(body) || !isRecord(body.data)) return null
  const m = body.data
  if (m.type !== 'member' || typeof m.id !== 'string' || !PATREON_ID.test(m.id) || !isRecord(m.attributes)) return null
  const user = isRecord(m.relationships) && isRecord(m.relationships.user) && isRecord(m.relationships.user.data) ? m.relationships.user.data.id : null
  if (typeof user !== 'string' || !PATREON_ID.test(user)) return null
  return { id: m.id, attributes: m.attributes, relationships: isRecord(m.relationships) ? m.relationships : {}, patron: user }
}

/**
 * The tier a member's entitled Patreon tiers make (the highest): each by its
 * id (`PATREON_TIER_IDS`), else by its price in the campaign's currency when
 * the payload includes the tier. Never by the member's own amounts, which are
 * in the patron's currency.
 */
const entitledTier = (relationships: Record<string, unknown>, included: unknown): SupporterTier | null => {
  const rel = relationships.currently_entitled_tiers
  const refs: unknown[] = isRecord(rel) && Array.isArray(rel.data) ? rel.data : []
  const tiers = Array.isArray(included) ? included : []
  return refs.reduce<SupporterTier | null>((best, ref) => {
    if (!isRecord(ref) || typeof ref.id !== 'string') return best
    const id = ref.id
    const known = PATREON_TIER_IDS[id]
    if (known) return highestTier(best, known)
    const tier: unknown = tiers.find((r: unknown) => isRecord(r) && r.type === 'tier' && r.id === id)
    const price = isRecord(tier) && isRecord(tier.attributes) ? cents(tier.attributes.amount_cents) : null
    return highestTier(best, price === null ? null : pledgeTier(price))
  }, null)
}

/**
 * The charge a Patreon webhook (`X-Patreon-Event`) tells of, or null: any
 * `members:` event whose member's last charge is `Paid`. The currency is the
 * campaign's when the payload includes it, else `fallbackCurrency`. A charge
 * is only history now: the tier comes from the pledge (`patreonMember`).
 */
export const patreonCharge = (event: string | undefined, body: unknown, fallbackCurrency: string): PatreonCharge | null => {
  const m = memberOf(event, body)
  if (!m || !isRecord(body)) return null
  const a = m.attributes
  const date = typeof a.last_charge_date === 'string' ? new Date(a.last_charge_date) : null
  if (a.last_charge_status !== 'Paid' || !date || Number.isNaN(date.getTime())) return null
  const lifetime = cents(a.campaign_lifetime_support_cents) ?? cents(a.lifetime_support_cents)
  const entitled = cents(a.currently_entitled_amount_cents) ?? 0
  const campaign: unknown = Array.isArray(body.included) ? body.included.find((r: unknown) => isRecord(r) && r.type === 'campaign') : undefined
  const currency = isRecord(campaign) && isRecord(campaign.attributes) && typeof campaign.attributes.currency === 'string' ? campaign.attributes.currency : fallbackCurrency
  const tier = entitledTier(m.relationships, body.included)
  return { ref: `patreon:${m.id}:${date.toISOString()}`, member: m.id, patron: m.patron, lifetime, entitled, currency: currency.toLowerCase(), tier }
}

/**
 * The ledger ref of the gems a Patreon charge (`PatreonCharge.ref`,
 * `patreon:<member>:<charge date>`) brings: one per member and Brasília
 * month (`patreon-gems:<member>:<YYYY-MM>`), so the month's first paid charge
 * credits its tier's gems and any later one that month (an upgrade's
 * prorated charge, a pledge dropped and made again) none. Null for a ref of
 * another shape.
 */
export const patreonGemsRef = (chargeRef: string): string | null => {
  const [kind, member, ...rest] = chargeRef.split(':')
  const date = new Date(rest.join(':'))
  if (kind !== 'patreon' || !member || Number.isNaN(date.getTime())) return null
  return `patreon-gems:${member}:${brasiliaDay(date).slice(0, 7)}`
}

/** A patron's tier now, as a Patreon member event tells it: `patron` their Patreon user id, `tier` null once the pledge ended. */
export type PatreonMember = { patron: string; tier: SupporterTier | null }

/**
 * The tier a Patreon `members:` event leaves the patron at, or null when it
 * isn't about a member: their entitled tiers' (`entitledTier`) while
 * `patron_status` is `active_patron`; none once it's declined or former, or
 * the event deletes the member or the pledge.
 */
export const patreonMember = (event: string | undefined, body: unknown): PatreonMember | null => {
  const m = memberOf(event, body)
  if (!m || !isRecord(body)) return null
  const ended = event === 'members:delete' || event === 'members:pledge:delete' || m.attributes.patron_status !== 'active_patron'
  return { patron: m.patron, tier: ended ? null : entitledTier(m.relationships, body.included) }
}

/**
 * What a charge paid, given what the member's earlier charges already
 * recorded (`prior`, cents): a member carries no per-charge amount, so it's
 * how far their lifetime total grew since (an upgrade's prorated charge or a
 * yearly pledge come out right), or the pledge's amount when the payload has
 * no lifetime total.
 */
export const patreonAmount = (c: PatreonCharge, prior: number) => (c.lifetime === null ? c.entitled : Math.max(0, c.lifetime - prior))
