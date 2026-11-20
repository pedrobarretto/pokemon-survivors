import type { CheckoutLocale } from './stripe'

/**
 * A one-time donation's Stripe Checkout: our donation `ref` (the row
 * `supporters.open` made), `amount` whole reais, the account's handle when the
 * donor gave one, the page's language, and where Stripe sends them back.
 */
export type StripeDonationOrder = { ref: string; amount: number; handle: string | null; locale: CheckoutLocale; successUrl: string; cancelUrl: string }

/** Opens a donation's Checkout Session: its URL. */
export type StripeDonate = (o: StripeDonationOrder) => Promise<string>

/** The line on the Checkout page, in the donor's language: Stripe's own `locale`, its name and description. */
const DONATION_TEXT: Record<CheckoutLocale, { stripe: string; name: string; description: string }> = {
  pt: { stripe: 'pt-BR', name: 'Doação · Pokémon Survivors', description: 'Apoio ao Pokémon Survivors, um fan game gratuito e sem anúncios. Com uma conta, dá um agradecimento cosmético no jogo.' },
  en: { stripe: 'en', name: 'Donation · Pokémon Survivors', description: 'Support for Pokémon Survivors, a free fan game with no ads. With an account, it brings a cosmetic thank-you in the game.' },
  es: { stripe: 'es-419', name: 'Donación · Pokémon Survivors', description: 'Apoyo a Pokémon Survivors, un fan game gratis y sin anuncios. Con una cuenta, trae un agradecimiento cosmético en el juego.' },
  fr: { stripe: 'fr', name: 'Don · Pokémon Survivors', description: 'Soutien à Pokémon Survivors, un fan game gratuit et sans pubs. Avec un compte, il apporte un remerciement cosmétique en jeu.' },
  zh: { stripe: 'zh-TW', name: '捐款 · Pokémon Survivors', description: '支持 Pokémon Survivors，一款免費、無廣告的同人遊戲。有帳號的話，會在遊戲中收到外觀類的謝禮。' },
  zhHans: { stripe: 'zh', name: '捐款 · Pokémon Survivors', description: '支持 Pokémon Survivors，一款免费、无广告的同人游戏。有账号的话，会在游戏中收到外观类的谢礼。' },
}

/**
 * The form `POST /v1/checkout/sessions` takes for a donation: one line priced
 * inline in reais (`price_data`, no Product kept in Stripe), the pay button
 * saying Donate (`submit_type`), the page in the donor's language. No
 * `payment_method_types`: the account's payment method configuration decides
 * (Pix and cards in reais; Adaptive Pricing, on for the account, shows a
 * donor abroad their own currency, and the webhook still reads the reais,
 * `stripeDonation`). The metadata (`kind: donation`, the ref, the handle)
 * rides on the session and its PaymentIntent, which is how the webhook tells
 * a donation from a gem pack and the Dashboard shows whose it was.
 */
export const stripeDonationForm = (o: StripeDonationOrder): [string, string][] => {
  const text = DONATION_TEXT[o.locale]
  const meta = { kind: 'donation', ref: o.ref, ...(o.handle ? { handle: o.handle } : {}) }
  return [
    ['mode', 'payment'],
    ['submit_type', 'donate'],
    ['line_items[0][quantity]', '1'],
    ['line_items[0][price_data][currency]', 'brl'],
    ['line_items[0][price_data][unit_amount]', String(o.amount * 100)],
    ['line_items[0][price_data][product_data][name]', text.name],
    ['line_items[0][price_data][product_data][description]', text.description],
    ['locale', text.stripe],
    ['success_url', o.successUrl],
    ['cancel_url', o.cancelUrl],
    ['client_reference_id', o.ref],
    ...Object.entries(meta).flatMap(([k, v]): [string, string][] => [
      [`metadata[${k}]`, v],
      [`payment_intent_data[metadata][${k}]`, v],
    ]),
  ]
}

/** Donations through Stripe Checkout with the account's secret key. The ref is the idempotency key, so a retry never opens a second session. */
export const stripeDonate =
  (secretKey: string): StripeDonate =>
  async (o) => {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded', 'Idempotency-Key': `donation:${o.ref}` },
      body: new URLSearchParams(stripeDonationForm(o)),
    })
    const body = (await res.json().catch(() => null)) as { url?: unknown; error?: { message?: string } } | null
    if (!res.ok || typeof body?.url !== 'string') throw new Error(`Stripe donation: ${res.status} ${body?.error?.message ?? ''}`)
    return body.url
  }
