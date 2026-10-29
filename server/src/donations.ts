import { GEM_PACKS, packGems, type GemPackId } from '../../src/data/gems'

const API = 'https://api.abacatepay.com/v2'

/** Where AbacatePay's checkout sends the donor back to. */
export type DonationUrls = { completionUrl: string; returnUrl: string }

/**
 * Opens a checkout for a donation of `amount` reais and returns its URL.
 * `externalId` comes back in the webhook that says it's paid (`webhooks.ts`).
 */
export type Donate = (amount: number, urls: DonationUrls, externalId: string) => Promise<string>

type Envelope<T> = { data: T | null; error: string | null; success: boolean }

/** Opens a Pix checkout (AbacatePay) for a gem pack and returns its URL. `externalId` comes back in its webhooks. */
export type GemPix = (pack: GemPackId, urls: DonationUrls, externalId: string) => Promise<string>

/** A product of the AbacatePay catalog, by its `externalId` (prefixed `pokemon-survivors-`: the account is shared with other products). */
type Product = { externalId: string; name: string; description: string; price: number }

const donationProduct = (amount: number): Product => ({
  externalId: `pokemon-survivors-donation-${amount}`,
  name: `Doação Pokémon Survivors (R$ ${amount})`,
  description: 'Apoio ao Pokémon Survivors, um fan game gratuito. Com uma conta, dá um agradecimento cosmético no jogo.',
  price: amount * 100,
})

/**
 * A gem pack's product. Its id doesn't carry the price: a price change in
 * `GEM_PACKS` needs the product's price changed in AbacatePay too (the
 * checkout refuses to open while they differ, `productFor`).
 */
const gemProduct = (pack: GemPackId): Product => ({
  externalId: `pokemon-survivors-gems-${pack}`,
  name: `Pokémon Survivors: ${packGems(pack)} gemas`,
  description: 'Gemas da Arena do Pokémon Survivors: só para itens cosméticos, sem valor em dinheiro.',
  price: GEM_PACKS[pack].brl,
})

/**
 * Checkouts through AbacatePay's hosted page: donations (Pix and Brazilian
 * cards) and gem packs (Pix only: cards go through Stripe). A checkout only
 * sells catalog products, so each donation amount and each pack gets its own
 * product (`donationProduct`, `gemProduct`), found or created the first time
 * someone pays it and remembered afterwards. Donation amounts come from
 * `parseDonation`, so there are at most a thousand of them.
 */
export const abacatePay = (apiKey: string): { donate: Donate; gems: GemPix } => {
  /**
   * One API call: its `data`, or null when AbacatePay refuses the request
   * (a 4xx such as "Product not found", which it answers with 400, not 404).
   * Throws when the key is refused, on rate limits, server errors and network failures.
   */
  const call = async <T>(path: string, init?: { body: unknown }): Promise<T | null> => {
    const res = await fetch(`${API}${path}`, {
      method: init ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: init && JSON.stringify(init.body),
    })
    const body = (await res.json().catch(() => null)) as Envelope<T> | null
    if (res.ok && body?.success && body.data) return body.data
    if (res.status >= 400 && res.status < 500 && ![401, 403, 429].includes(res.status)) return null
    throw new Error(`AbacatePay ${path}: ${res.status} ${body?.error ?? ''}`)
  }

  const products = new Map<string, Promise<string>>()

  const findOrCreate = async (p: Product) => {
    const find = () => call<{ id: string; price?: number }>(`/products/get?externalId=${p.externalId}`)
    const create = () => call<{ id: string; price?: number }>('/products/create', { body: { ...p, currency: 'BRL' } })
    // Found, else created, else found again: another instance may have just created it.
    const product = (await find()) ?? (await create()) ?? (await find())
    if (!product) throw new Error(`AbacatePay: no product ${p.externalId}`)
    if (product.price !== undefined && product.price !== p.price) throw new Error(`AbacatePay: product ${p.externalId} costs ${product.price}, not ${p.price}`)
    return product.id
  }

  const productFor = (p: Product) => {
    const known = products.get(p.externalId)
    if (known) return known
    // A failed lookup is forgotten, so the next buyer tries again.
    const id = findOrCreate(p).catch((err: unknown) => {
      products.delete(p.externalId)
      throw err
    })
    products.set(p.externalId, id)
    return id
  }

  const checkout = async (p: Product, methods: string[], urls: DonationUrls, externalId: string) => {
    const id = await productFor(p)
    const opened = await call<{ url: string }>('/checkouts/create', { body: { items: [{ id, quantity: 1 }], methods, externalId, ...urls } })
    if (!opened) throw new Error(`AbacatePay refused a checkout of ${p.externalId}`)
    return opened.url
  }

  return {
    donate: (amount, urls, externalId) => checkout(donationProduct(amount), ['PIX', 'CARD'], urls, externalId),
    gems: (pack, urls, externalId) => checkout(gemProduct(pack), ['PIX'], urls, externalId),
  }
}
