import { describe, expect, it } from 'vitest'
import { parsePlace } from './signInPlace'

describe('parsePlace', () => {
  it('reads the places a sign in comes back to, with their tab', () => {
    expect(parsePlace('boutique:skins')).toEqual({ to: 'boutique', tab: 'skins' })
    expect(parsePlace('arena:ranking')).toEqual({ to: 'arena', tab: 'ranking' })
    expect(parsePlace('friends')).toEqual({ to: 'friends' })
  })

  it('refuses anything else a URL could bring', () => {
    expect(parsePlace(null)).toBeNull()
    expect(parsePlace('boutique')).toBeNull()
    expect(parsePlace('boutique:gems')).toBeNull()
    expect(parsePlace('realm')).toBeNull()
  })
})
