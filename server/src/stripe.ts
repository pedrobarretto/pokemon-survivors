import { GEM_PACKS, packGems, type GemCurrency, type GemPackId } from '../../src/data/gems'

/** A gem pack's Stripe Checkout: our purchase `ref`, who buys, the pack and its currency, and where Stripe sends them back. */
export type StripeGemOrder = { ref: string; userId: string; pack: GemPackId; currency: GemCurrency; successUrl: string; cancelUrl: string }

/** Opens a Stripe Checkout Session for a gem pack: its URL and id. */
export type StripeCheckout = (o: StripeGemOrder) => Promise<{ url: string; session: string }>

/**
 * The form `POST /v1/checkout/sessions` takes for a gem pack: one line priced
 * inline (`price_data`, so no Product is kept in Stripe), in the pack's price
 * of `currency`. No `payment_method_types`: the account's payment method
 * configuration decides (card, Apple Pay, Google Pay where it's on), as
 * Checkout's dynamic payment methods do. The metadata (`kind: gems`, the
 * purchase ref, the account and the pack) rides on the session and its
 * PaymentIntent, which is how the webhook tells a pack from a donation and
 * the Dashboard shows who bought what.
 */
export const stripeGemForm = (o: StripeGemOrder): [string, string][] => {
  const gems = packGems(o.pack)
  const brl = o.currency === 'brl'
  const meta = { kind: 'gems', ref: o.ref, user: o.userId, pack: o.pack }
  return [
    ['mode', 'payment'],
    ['line_items[0][quantity]', '1'],
    ['line_items[0][price_data][currency]', o.currency],
    ['line_items[0][price_data][unit_amount]', String(GEM_PACKS[o.pack][o.currency])],
    ['line_items[0][price_data][product_data][name]', brl ? `${gems} gemas · Pokémon Survivors` : `${gems} gems · Pokémon Survivors`],
    [
      'line_items[0][price_data][product_data][description]',
      brl ? 'Gemas da Arena: só para itens cosméticos, sem valor em dinheiro.' : 'Arena gems: for cosmetic items only, no cash value.',
    ],
    ['success_url', o.successUrl],
    ['cancel_url', o.cancelUrl],
    ['client_reference_id', o.ref],
    ...Object.entries(meta).flatMap(([k, v]): [string, string][] => [
      [`metadata[${k}]`, v],
      [`payment_intent_data[metadata][${k}]`, v],
    ]),
  ]
}

/**
 * Stripe Checkout with the account's secret key (a restricted `rk_` key that
 * may write Checkout Sessions is enough). The purchase ref is the request's
 * idempotency key, so a retry never opens a second session.
 */
export const stripeCheckout =
  (secretKey: string): StripeCheckout =>
  async (o) => {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `gems:${o.ref}` },
      body: new URLSearchParams(stripeGemForm(o)),
    })
    const body = (await res.json().catch(() => null)) as { id?: unknown; url?: unknown; error?: { message?: string } } | null
    if (!res.ok || typeof body?.url !== 'string' || typeof body.id !== 'string') throw new Error(`Stripe checkout: ${res.status} ${body?.error?.message ?? ''}`)
    return { url: body.url, session: body.id }
  }
