import { describe, expect, it } from 'vitest'
import { PRESENCE_STALE_MS } from '../../src/net/realmRelay'
import { cityCounts, furniturePrice, groupRealmReports, parseBaseSave, parsePresenceReport, parseRealmReport, walkingIn } from './realm'

describe('presence', () => {
  it('takes a relay report of its own cities, handles cleaned', () => {
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { pallet: ['Ash', 'ash', 'misty'], pewter: [] } })).toEqual({ home: 'sa', at: 1, cities: { pallet: ['ash', 'misty'], pewter: [] } })
    expect(parsePresenceReport({ home: 'eu', at: 1, cities: {} })).toBeNull()
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { atlantis: ['ash'] } })).toBeNull()
  })

  it('counts and finds trainers only from relays heard from lately', () => {
    const report = { home: 'sa', at: 0, cities: { pallet: ['ash', 'misty'], cerulean: ['brock'] } } as const
    const held = [{ report: { ...report, cities: { pallet: [...report.cities.pallet], cerulean: [...report.cities.cerulean] } }, at: 1000 }]
    expect(cityCounts(held, 2000)).toEqual({ pallet: 2, cerulean: 1 })
    expect(walkingIn(held, 2000, ['brock', 'gary', 'ash'])).toEqual([
      { handle: 'brock', city: 'cerulean' },
      { handle: 'ash', city: 'pallet' },
    ])
    expect(cityCounts(held, 1000 + PRESENCE_STALE_MS)).toEqual({})
  })
})

describe('furniturePrice', () => {
  it('sells a piece only in its own currency, and never a trophy', () => {
    expect(furniturePrice('woodChair', 'coins', '2026-11-04')).toBe(1500)
    expect(furniturePrice('woodChair', 'gems', '2026-11-04')).toBeNull()
    expect(furniturePrice('pikachuBed', 'gems', '2026-11-04')).toBe(250)
    expect(furniturePrice('doll:kyogre', 'gems', '2026-11-04')).toBeNull()
  })
})

describe('request bodies', () => {
  it('refuses a base whose pieces do not all parse, rather than saving fewer', () => {
    const layout = { exterior: 'tree', wallpaper: null, flooring: null, items: [{ id: 'woodChair', x: 2, y: 5, turned: false }] }
    expect(parseBaseSave({ layout, visibility: 'friends' })?.layout.items).toHaveLength(1)
    expect(parseBaseSave({ layout: { ...layout, items: [...layout.items, { id: 'throne', x: 1, y: 5 }] }, visibility: 'public' })).toBeNull()
    expect(parseBaseSave({ layout, visibility: 'everyone' })).toBeNull()
  })

  it('reads a report by handle, reason and city', () => {
    expect(parseRealmReport({ handle: 'Misty', reason: 'spam', city: 'cerulean' })).toEqual({ handle: 'misty', reason: 'spam', city: 'cerulean' })
    expect(parseRealmReport({ handle: 'misty', reason: 'rude', city: null })).toBeNull()
    expect(parseRealmReport({ handle: 'misty', reason: 'name', city: 'atlantis' })).toBeNull()
  })
})

describe('groupRealmReports', () => {
  it('groups by trainer, most reported first, with their ban', () => {
    const row = (targetId: string, at: string, reason: 'spam' | 'name', reporter: string) => ({ targetId, handle: targetId, reason, city: 'pallet', at, reporter })
    const ban = { userId: 'b', handle: 'b', until: null, reason: 'spam', at: '2026-11-01T00:00:00.000Z' }
    const groups = groupRealmReports([row('a', '2026-11-03T10:00:00.000Z', 'spam', 'x'), row('b', '2026-11-03T09:00:00.000Z', 'spam', 'x'), row('b', '2026-11-03T11:00:00.000Z', 'name', 'y')], [ban])
    expect(groups.map((g) => [g.userId, g.count, g.latest])).toEqual([
      ['b', 2, '2026-11-03T11:00:00.000Z'],
      ['a', 1, '2026-11-03T10:00:00.000Z'],
    ])
    expect(groups[0]).toMatchObject({ reasons: { spam: 1, name: 1 }, cities: ['pallet'], reporters: ['x', 'y'], ban })
  })
})
