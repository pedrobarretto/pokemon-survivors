import { describe, expect, it } from 'vitest'
import { revenueCapture } from './revenue'

describe('revenueCapture', () => {
  it("puts a pack on the buyer's distinct id, in the currency's units", () => {
    const c = revenueCapture({ source: 'gems', provider: 'stripe', amount: 1999, currency: 'usd', pack: 'hoard', userId: 'user_2abc', ref: 'r1' })
    expect(c.distinctId).toBe('user_2abc')
    expect(c.properties).toMatchObject({ revenue: 19.99, currency: 'USD', pack: 'hoard', source: 'gems' })
    expect(c.properties).not.toHaveProperty('$process_person_profile')
  })

  it('gives a payment without an account its own id and no person', () => {
    const c = revenueCapture({ source: 'patreon', provider: 'patreon', amount: 500, currency: 'BRL', pack: null, userId: null, ref: 'patreon:m:2026-11-05' })
    expect(c.distinctId).toBe('payment:patreon:m:2026-11-05')
    expect(c.properties).toMatchObject({ revenue: 5, $process_person_profile: false })
  })
})
