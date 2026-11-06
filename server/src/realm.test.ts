import { describe, expect, it } from 'vitest'
import { furniturePrice, groupRealmReports, parseBaseSave, parseGameClaim, parsePresenceReport, parseRealmReport, parseRealmSettings, statsAfter } from './realm'

describe('presence', () => {
  it('takes a relay report of its own cities, handles cleaned', () => {
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { pallet: ['Ash', 'ash', 'misty'], pewter: [] } })).toEqual({ home: 'sa', at: 1, cities: { pallet: ['ash', 'misty'], pewter: [] } })
    expect(parsePresenceReport({ home: 'eu', at: 1, cities: {} })).toBeNull()
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { atlantis: ['ash'] } })).toBeNull()
  })

  it('keeps each handle\'s room when the relay sends them lined up, and none when they don\'t', () => {
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { pallet: ['Ash', 'ash', 'misty'] }, rooms: { pallet: ['cafe', 'plaza', 'base:Brock'] } })).toEqual({
      home: 'sa',
      at: 1,
      cities: { pallet: ['ash', 'misty'] },
    })
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { pallet: ['Ash', 'ash', 'misty'] }, rooms: { pallet: ['cafe', 'plaza', 'base:brock'] } })).toEqual({
      home: 'sa',
      at: 1,
      cities: { pallet: ['ash', 'misty'] },
      rooms: { pallet: ['cafe', 'base:brock'] },
    })
    expect(parsePresenceReport({ home: 'sa', at: 1, cities: { pallet: ['ash', 'misty'] }, rooms: { pallet: ['cafe'] } })).toEqual({ home: 'sa', at: 1, cities: { pallet: ['ash', 'misty'] } })
  })

  it('reads the realm settings', () => {
    expect(parseRealmSettings({ showWhere: false })).toEqual({ showWhere: false })
    expect(parseRealmSettings({ showWhere: 'no' })).toBeNull()
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

describe('mini game claims', () => {
  it('reads a claim of either outcome, and nothing malformed', () => {
    expect(parseGameClaim({ game: 'fishing', outcome: { score: 120 }, ms: 90_000.4, feats: ['feebas'] })).toEqual({ game: 'fishing', outcome: { score: 120 }, ms: 90_000, feats: ['feebas'] })
    expect(parseGameClaim({ game: 'fourInRow', outcome: { result: 'win', vs: 'bot' }, ms: 40_000 })).toEqual({ game: 'fourInRow', outcome: { result: 'win', vs: 'bot' }, ms: 40_000, feats: [] })
    expect(parseGameClaim({ game: 'chess', outcome: { score: 1 }, ms: 1, feats: [] })).toBeNull()
    expect(parseGameClaim({ game: 'fishing', outcome: { score: 1.5 }, ms: 90_000, feats: [] })).toBeNull()
    expect(parseGameClaim({ game: 'fishing', outcome: { score: -1 }, ms: 90_000, feats: [] })).toBeNull()
    expect(parseGameClaim({ game: 'fourInRow', outcome: { result: 'win', vs: 'cat' }, ms: 40_000, feats: [] })).toBeNull()
    expect(parseGameClaim({ game: 'fishing', outcome: { score: 1 }, ms: Number.NaN, feats: [] })).toBeNull()
    expect(parseGameClaim({ game: 'fishing', outcome: { score: 1 }, ms: 90_000, feats: [7] })).toBeNull()
  })

  it('counts a play, a win and the best score, and keeps only the game\'s own feats', () => {
    const was = { plays: 2, wins: 0, best: 300, feats: ['feebas'] }
    expect(statsAfter('fishing', was, { score: 120 }, ['shinyGyarados', 'made-up', 'feebas'])).toEqual({ plays: 3, wins: 0, best: 300, feats: ['feebas', 'shinyGyarados'] })
    expect(statsAfter('fishing', was, { score: 450 }, []).best).toBe(450)
    expect(statsAfter('fourInRow', { plays: 0, wins: 0, best: 0, feats: [] }, { result: 'win', vs: 'human' }, [])).toEqual({ plays: 1, wins: 1, best: 0, feats: [] })
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
