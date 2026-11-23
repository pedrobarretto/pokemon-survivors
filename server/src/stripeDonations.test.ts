import { describe, expect, it } from 'vitest'
import { stripeDonationForm } from './stripeDonations'

describe('stripeDonationForm', () => {
  const order = { ref: '8f14e45f-ceea-467f-a0e6-1b7a2c1c9a01', amount: 25, handle: 'ash', locale: 'en', successUrl: 'https://x/apoie/?thanks=r', cancelUrl: 'https://x/apoie/' } as const

  it('asks for the amount in reais, as a donation the webhook can tell apart', () => {
    const form = new Map(stripeDonationForm(order))
    expect(form.get('line_items[0][price_data][currency]')).toBe('brl')
    expect(form.get('line_items[0][price_data][unit_amount]')).toBe('2500')
    expect(form.get('submit_type')).toBe('donate')
    expect(form.get('metadata[kind]')).toBe('donation')
    expect(form.get('metadata[ref]')).toBe(order.ref)
    expect(form.get('payment_intent_data[metadata][handle]')).toBe('ash')
    expect(form.get('locale')).toBe('en')
    // The account's payment methods decide: Pix and cards in reais, never a fixed list.
    expect([...form.keys()].some((k) => k.startsWith('payment_method_types'))).toBe(false)
  })

  it('leaves the handle out when the donor gave none', () => {
    expect(new Map(stripeDonationForm({ ...order, handle: null })).has('metadata[handle]')).toBe(false)
  })
})
