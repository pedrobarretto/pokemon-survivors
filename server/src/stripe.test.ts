import { describe, expect, it } from 'vitest'
import { checkoutLocale, stripeGemForm } from './stripe'

describe('stripeGemForm', () => {
  const order = { ref: 'r1', userId: 'u_a', pack: 'bag', currency: 'usd', successUrl: 'https://x/?gems=r1', cancelUrl: 'https://x/' } as const

  it("speaks the buyer's language, asks for the immediate delivery and expires within the checkout's hold", () => {
    const form = new Map(stripeGemForm({ ...order, locale: 'fr' }, 1_000_000))
    expect(form.get('locale')).toBe('fr')
    expect(form.get('custom_text[submit][message]')).toContain('rétractation')
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('499')
    expect(form.get('expires_at')).toBe(String(1000 + 31 * 60))
    expect(new Map(stripeGemForm({ ...order, locale: 'pt' })).get('line_items[0][price_data][product_data][description]')).toMatch(/^Gemas do Pokémon Survivors/)
  })

  it("takes only the game's languages", () => {
    expect(checkoutLocale('zh')).toBe('zh')
    expect(checkoutLocale('de')).toBeNull()
  })
})
