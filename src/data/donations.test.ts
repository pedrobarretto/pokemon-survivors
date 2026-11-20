import { describe, expect, it } from 'vitest'
import { DONATION, parseDonation } from './donations'

describe('parseDonation', () => {
  it('takes whole reais in range, as numbers or form strings', () => {
    expect(parseDonation(25)).toBe(25)
    expect(parseDonation('50')).toBe(50)
    expect(parseDonation(DONATION.min)).toBe(DONATION.min)
    expect(parseDonation(DONATION.max)).toBe(DONATION.max)
  })

  it('refuses fractions, out of range amounts and junk', () => {
    for (const v of [DONATION.min - 1, DONATION.max + 1, 10.5, '', ' ', 'abc', null, undefined, Infinity]) expect(parseDonation(v)).toBeNull()
  })
})
