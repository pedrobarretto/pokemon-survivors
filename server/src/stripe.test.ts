import { describe, expect, it } from 'vitest'
import { GEM_CHECKOUT, GEM_PACKS } from '../../src/data/gems'
import { checkoutLocale, PIX_SECONDS, stripeGemForm } from './stripe'

describe('stripeGemForm', () => {
  const order = { ref: 'r1', userId: 'u_a', pack: 'bag', market: 'intl', successUrl: 'https://x/?gems=r1', cancelUrl: 'https://x/?gems=r1&cancel=bag' } as const

  it("speaks the buyer's language, asks for the immediate delivery and expires within the checkout's hold", () => {
    const form = new Map(stripeGemForm({ ...order, locale: 'fr' }, 1_000_000))
    expect(form.get('locale')).toBe('fr')
    expect(form.get('custom_text[submit][message]')).toContain('rétractation')
    expect(form.get('expires_at')).toBe(String(1000 + 31 * 60))
    expect(form.get('cancel_url')).toBe(order.cancelUrl)
    expect(new Map(stripeGemForm({ ...order, locale: 'pt' })).get('line_items[0][price_data][product_data][description]')).toMatch(/^Gemas do Pokémon Survivors/)
  })

  it('charges in reais at the market\'s price, whatever the buyer\'s currency, and leaves the methods to the account', () => {
    const abroad = new Map(stripeGemForm({ ...order, locale: 'zh' }))
    expect(abroad.get('line_items[0][price_data][currency]')).toBe('brl')
    expect(abroad.get('line_items[0][price_data][unit_amount]')).toBe(String(GEM_PACKS.bag.intl))
    expect(abroad.get('metadata[market]')).toBe('intl')
    const home = new Map(stripeGemForm({ ...order, market: 'br', locale: 'pt' }))
    expect(home.get('line_items[0][price_data][unit_amount]')).toBe(String(GEM_PACKS.bag.brl))
    expect([...home.keys()].some((k) => k.startsWith('payment_method_types'))).toBe(false)
  })

  it('stops counting an unpaid pack only once neither its session nor its Pix can be paid', () => {
    expect(31 * 60 + PIX_SECONDS).toBeLessThanOrEqual(GEM_CHECKOUT.holdMinutes * 60)
  })

  it("takes only the game's languages", () => {
    expect(checkoutLocale('zh')).toBe('zh')
    expect(checkoutLocale('de')).toBeNull()
  })
})
