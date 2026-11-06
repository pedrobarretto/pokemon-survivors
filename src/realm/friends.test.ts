import { describe, expect, it } from 'vitest'
import { PRESENCE } from '../game/friends'
import { ROOM_CAP } from '../data/realmMap'
import { REALM } from '../net/realm'
import { PRESENCE_STALE_MS } from '../net/realmRelay'
import { cityCounts, friendWhere, friendsFrom, fullness, roomCounts, walking, type Followed } from './friends'

const friend = (over: Partial<Followed> = {}): Followed => ({
  handle: 'misty',
  name: 'Misty',
  followsBack: true,
  appearOffline: false,
  showWhere: true,
  walking: null,
  activity: null,
  ago: null,
  ...over,
})

describe('friendWhere: who sees whom', () => {
  const inCafe = { city: 'cerulean', room: 'cafe' } as const

  it('shows a mutual friend where they walk', () => {
    expect(friendWhere(friend({ walking: inCafe }))).toEqual({ handle: 'misty', name: 'Misty', state: 'realm', city: 'cerulean', room: 'cafe', full: null })
  })

  it('shows nothing of a one-way follow, not even that they are online', () => {
    expect(friendWhere(friend({ followsBack: false, walking: inCafe, activity: 'lobby', ago: 0 }))).toEqual({ handle: 'misty', name: 'Misty', state: 'pending' })
  })

  it('reads a friend appearing offline as offline, in the realm or not', () => {
    expect(friendWhere(friend({ appearOffline: true, walking: inCafe })).state).toBe('offline')
    expect(friendWhere(friend({ appearOffline: true, activity: 'lobby', ago: 0 })).state).toBe('offline')
  })

  it('keeps where a friend walks to themselves when they turned it off', () => {
    expect(friendWhere(friend({ showWhere: false, walking: inCafe }))).toEqual({ handle: 'misty', name: 'Misty', state: 'hidden' })
  })

  it('tells a friend online elsewhere in the game while their heartbeat is fresh', () => {
    expect(friendWhere(friend({ activity: 'run', ago: 1000 }))).toMatchObject({ state: 'game', activity: 'run' })
    expect(friendWhere(friend({ activity: 'lobby', ago: 3 * PRESENCE.beatMs.lobby })).state).toBe('offline')
  })
})

describe('presence reports', () => {
  const held = (at: number) => [
    { report: { home: 'sa' as const, at: 0, cities: { pallet: ['Ash', 'misty'], cerulean: ['brock'] }, rooms: { pallet: ['cafe', 'base:ash'] } }, at },
  ]

  it('finds each trainer and their room, from relays heard from lately', () => {
    const where = walking(held(1000), 2000)
    expect(where.get('ash')).toEqual({ city: 'pallet', room: 'cafe' })
    expect(where.get('misty')).toEqual({ city: 'pallet', room: 'base:ash' })
    // A relay that doesn't say rooms (the cerulean list has none) still says the city.
    expect(where.get('brock')).toEqual({ city: 'cerulean', room: null })
    expect(walking(held(1000), 1000 + PRESENCE_STALE_MS).size).toBe(0)
    expect(cityCounts(held(1000), 2000)).toEqual({ pallet: 2, cerulean: 1 })
  })

  it('marks a city or a room at its cap as full, but never the landing', () => {
    const rooms = new Map([['pallet cafe', ROOM_CAP.town], ['pallet base:ash', ROOM_CAP.base - 1], ['pallet plaza', 39]])
    expect(fullness('pallet', 'cafe', { pallet: 30 }, rooms)).toBe('room')
    expect(fullness('pallet', 'base:ash', { pallet: 30 }, rooms)).toBeNull()
    expect(fullness('pallet', 'plaza', { pallet: 39 }, rooms)).toBeNull()
    expect(fullness('pallet', 'plaza', { pallet: REALM.cityCap }, rooms)).toBe('city')
  })

  it('lists mutual friends walking the realm first, the pending follows last', () => {
    const where = walking(held(1000), 2000)
    expect(roomCounts(where).get('pallet cafe')).toBe(1)
    const listed = friendsFrom(
      [
        { ...friend({ handle: 'zed', followsBack: false }) },
        { ...friend({ handle: 'gary', activity: 'run', ago: 0 }) },
        { ...friend({ handle: 'tracey' }) },
        { ...friend({ handle: 'misty' }) },
        { ...friend({ handle: 'brock', showWhere: false }) },
      ],
      held(1000),
      2000,
    )
    expect(listed.map((f) => [f.handle, f.state])).toEqual([
      ['misty', 'realm'],
      ['brock', 'hidden'],
      ['gary', 'game'],
      ['tracey', 'offline'],
      ['zed', 'pending'],
    ])
  })
})
