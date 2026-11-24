import { describe, expect, it } from 'vitest'
import { hintFor } from '../src/index'

describe('hintFor', () => {
  // Cloudflare's `request.cf` geolocates the client's IP, whatever host or colo it reached: the custom domain changes nothing.
  it('puts mainland China, Hong Kong and Taiwan in apac', () => {
    for (const country of ['CN', 'HK', 'TW', 'MO', 'SG']) {
      const cf = { continent: 'AS', country }
      expect(hintFor(cf)).toBe('apac')
    }
  })

  it('keeps the other continents where they were', () => {
    expect(hintFor({ continent: 'SA' })).toBe('enam')
    expect(hintFor({ continent: 'NA', longitude: '-122.4' })).toBe('wnam')
    expect(hintFor({ continent: 'NA', longitude: '-74.0' })).toBe('enam')
    expect(hintFor({ continent: 'EU' })).toBe('weur')
    expect(hintFor({ continent: 'OC' })).toBe('oc')
    expect(hintFor(undefined)).toBeNull()
  })
})
