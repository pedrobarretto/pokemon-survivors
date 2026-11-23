import { describe, expect, it } from 'vitest'
import { REALM } from '../net/realm'
import { firstOpenCity } from './entry'

describe('firstOpenCity', () => {
  it('lands in pallet when the API has nothing to say', () => {
    expect(firstOpenCity(null)).toBe('pallet')
    expect(firstOpenCity({})).toBe('pallet')
  })

  it('fills the cities in order, skipping the full ones', () => {
    expect(firstOpenCity({ pallet: REALM.cityCap - 1, cerulean: 12 })).toBe('pallet')
    expect(firstOpenCity({ pallet: REALM.cityCap, cerulean: 12 })).toBe('cerulean')
  })

  it('moves past a city that refused it, whatever the counts said', () => {
    expect(firstOpenCity({ pallet: 3 }, new Set(['pallet']))).toBe('cerulean')
    expect(firstOpenCity(null, new Set(['pallet', 'cerulean']))).toBe('goldenrod')
  })

  it('has nowhere to land once every city is full', () => {
    expect(firstOpenCity({ pallet: REALM.cityCap, cerulean: REALM.cityCap, goldenrod: REALM.cityCap, jubilife: REALM.cityCap })).toBeNull()
    expect(firstOpenCity(null, new Set(['pallet', 'cerulean', 'goldenrod', 'jubilife']))).toBeNull()
  })
})
