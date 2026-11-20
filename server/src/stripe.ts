import { packPrice, type GemMarket, type GemPackId } from '../../src/data/gems'

/** The game's languages, as a checkout names the buyer's (`GemCheckoutRequest.locale`). */
const CHECKOUT_LOCALES = ['pt', 'en', 'es', 'fr', 'zh', 'zhHans'] as const

export type CheckoutLocale = (typeof CHECKOUT_LOCALES)[number]

/** The buyer's language from a checkout's body, or null for one the game doesn't have. */
export const checkoutLocale = (v: unknown): CheckoutLocale | null => CHECKOUT_LOCALES.find((l) => l === v) ?? null

/** A gem pack's Stripe Checkout: our purchase `ref`, who buys, the pack, the gems it brings (`packGemsOn`: a promotion's included), the price it's bought at (`market`), the buyer's language, and where Stripe sends them back. */
export type StripeGemOrder = { ref: string; userId: string; pack: GemPackId; gems: number; market: GemMarket; locale: CheckoutLocale; successUrl: string; cancelUrl: string }

/**
 * What the Checkout page says, in the buyer's language: Stripe's own
 * `locale`, the line's name and description, and the note over the pay
 * button (`custom_text[submit]`) asking for the gems' immediate delivery,
 * which ends the EU right of withdrawal once they land, while the game's
 * own 7-day refund of unspent gems (the legal page) still stands.
 */
const CHECKOUT_TEXT: Record<CheckoutLocale, { stripe: string; name: (gems: number) => string; description: string; submit: string }> = {
  pt: {
    stripe: 'pt-BR',
    name: (n) => `${n} gemas · Pokémon Survivors`,
    description: 'Gemas do Pokémon Survivors: só para itens cosméticos, sem valor em dinheiro.',
    submit:
      'As gemas chegam à sua conta logo após o pagamento. Ao pagar, você pede essa entrega imediata de conteúdo digital e reconhece que, entregue, ele deixa de ter direito de desistência onde a lei permite. Gemas não gastas podem ser reembolsadas em até 7 dias: pokemonsurvivors.com/legal/',
  },
  en: {
    stripe: 'en',
    name: (n) => `${n} gems · Pokémon Survivors`,
    description: 'Pokémon Survivors gems: for cosmetic items only, no cash value.',
    submit:
      'Your gems reach your account right after payment. By paying, you ask for this immediate delivery of digital content and acknowledge that, once delivered, you lose your right of withdrawal where the law allows. Unspent gems can be refunded within 7 days: pokemonsurvivors.com/en/legal/',
  },
  es: {
    stripe: 'es-419',
    name: (n) => `${n} gemas · Pokémon Survivors`,
    description: 'Gemas de Pokémon Survivors: solo para objetos cosméticos, sin valor en dinero.',
    submit:
      'Tus gemas llegan a tu cuenta justo después del pago. Al pagar, pides esta entrega inmediata de contenido digital y aceptas que, una vez entregado, pierdes el derecho de desistimiento donde la ley lo permite. Las gemas no gastadas se pueden reembolsar en un plazo de 7 días: pokemonsurvivors.com/es/legal/',
  },
  fr: {
    stripe: 'fr',
    name: (n) => `${n} gemmes · Pokémon Survivors`,
    description: 'Gemmes de Pokémon Survivors : pour des objets cosmétiques uniquement, sans valeur monétaire.',
    submit:
      'Tes gemmes arrivent sur ton compte juste après le paiement. En payant, tu demandes cette fourniture immédiate d’un contenu numérique et tu reconnais perdre ton droit de rétractation dès qu’il est fourni, là où la loi le permet. Les gemmes non dépensées peuvent être remboursées sous 7 jours : pokemonsurvivors.com/fr/legal/',
  },
  zh: {
    stripe: 'zh-TW',
    name: (n) => `${n} 顆寶石 · Pokémon Survivors`,
    description: 'Pokémon Survivors 寶石：只能購買造型物品，沒有現金價值。',
    submit:
      '付款後寶石會立即存入你的帳號。付款即表示你要求立即交付這項數位內容，並了解在法律允許的範圍內，交付後即不再享有撤回權。未使用的寶石可在 7 天內申請退款：pokemonsurvivors.com/zh-tw/legal/',
  },
  zhHans: {
    stripe: 'zh',
    name: (n) => `${n} 颗宝石 · Pokémon Survivors`,
    description: 'Pokémon Survivors 宝石：只能购买造型物品，没有现金价值。',
    submit:
      '付款后宝石会立即存入你的账号。付款即表示你要求立即交付这项数字内容，并了解在法律允许的范围内，交付后即不再享有撤回权。未使用的宝石可在 7 天内申请退款：pokemonsurvivors.com/zh-cn/legal/',
  },
}

/** How long a gem pack's Checkout Session lives (Stripe takes 30 minutes at least). */
const SESSION_SECONDS = 31 * 60

/**
 * How long a Pix asked for at the session's end can still be paid (Stripe's
 * default is 4 hours). Session and Pix together fit in
 * `GEM_CHECKOUT.holdMinutes`, so an unpaid pack stops counting against the
 * day's limit only once it can't be paid.
 */
export const PIX_SECONDS = 30 * 60

/** Opens a Stripe Checkout Session for a gem pack: its URL and id. */
export type StripeCheckout = (o: StripeGemOrder) => Promise<{ url: string; session: string }>

/**
 * The form `POST /v1/checkout/sessions` takes for a gem pack, at `now` (ms):
 * one line priced inline (`price_data`, so no Product is kept in Stripe),
 * always in reais at the pack's price in `market` (the account settles in
 * reais, and Adaptive Pricing converts only prices in that currency: it
 * shows each buyer abroad the price in their own), and the page in the
 * buyer's language (`CHECKOUT_TEXT`), expiring after `SESSION_SECONDS`. No
 * `payment_method_types`: the account's payment method configuration decides
 * (card, Pix, Apple Pay, Google Pay, Link, where they're on and the buyer
 * can use them), as Checkout's dynamic payment methods do; a Pix lasts
 * `PIX_SECONDS`. The metadata (`kind: gems`, the purchase ref, the account,
 * the pack and the market) rides on the session and its PaymentIntent,
 * which is how the webhook tells a pack from a donation and the Dashboard
 * shows who bought what.
 */
export const stripeGemForm = (o: StripeGemOrder, now = Date.now()): [string, string][] => {
  const text = CHECKOUT_TEXT[o.locale]
  const meta = { kind: 'gems', ref: o.ref, user: o.userId, pack: o.pack, market: o.market }
  return [
    ['mode', 'payment'],
    ['line_items[0][quantity]', '1'],
    ['line_items[0][price_data][currency]', 'brl'],
    ['line_items[0][price_data][unit_amount]', String(packPrice(o.pack, o.market))],
    ['line_items[0][price_data][product_data][name]', text.name(o.gems)],
    ['line_items[0][price_data][product_data][description]', text.description],
    ['locale', text.stripe],
    ['custom_text[submit][message]', text.submit],
    ['expires_at', String(Math.floor(now / 1000) + SESSION_SECONDS)],
    ['payment_method_options[pix][expires_after_seconds]', String(PIX_SECONDS)],
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
