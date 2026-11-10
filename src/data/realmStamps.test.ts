import { describe, expect, it } from 'vitest'
import { MINIGAME_IDS, MINIGAMES } from './minigames'
import { REALM_EVENTS } from './realmEvents'
import { REALM_ROOMS, TOWN_ROOMS } from './realmMap'
import { isDeed, STAMP_IDS, STAMP_MILESTONES, STAMPS, type StampCondition } from './realmStamps'
import { REALM_EMOTES } from '../net/realm'
import { drawErrands } from '../realm/errands'
import { newStamps, stampProgress } from '../realm/stamps'

const deedsOf = (when: StampCondition) => ('all' in when ? when.all : [when.deed])

describe('the stamp book', () => {
  it('names every town room, bench and free emote', () => {
    const benches = TOWN_ROOMS.flatMap((room) => REALM_ROOMS[room].spots.flatMap((s, i) => (s.kind === 'bench' ? [`bench:${room}:${i}`] : [])))
    expect(STAMPS.benchWarmer.when.all).toEqual(benches)
    expect(STAMPS.tourist.when.all).toEqual(TOWN_ROOMS.map((r) => `room:${r}`))
    expect(STAMPS.expressive.when.all).toEqual(REALM_EMOTES.filter((e) => e !== 'look').map((e) => `emote:${e}`))
  })

  it('knows every mini game, feat and kind of hour', () => {
    for (const game of MINIGAME_IDS) {
      expect(isDeed(`game:${game}`)).toBe(true)
      for (const feat of MINIGAMES[game].feats) expect(isDeed(`feat:${game}:${feat}`)).toBe(true)
    }
    for (const kind of Object.keys(REALM_EVENTS)) expect(isDeed(`event:${kind}`)).toBe(true)
  })

  it('has milestones the book can reach', () => {
    expect(STAMP_MILESTONES.at(-1)!.at).toBeLessThanOrEqual(STAMP_IDS.length)
  })

  it('earns a stamp once its condition holds and never twice', () => {
    expect(newStamps({ say: 1 }, new Set())).toEqual(['hello'])
    expect(newStamps({ say: 1 }, new Set(['hello']))).toEqual([])
    expect(newStamps({ 'base:visit': 14 }, new Set(['neighbor']))).toEqual([])
    expect(newStamps({ 'base:visit': 15 }, new Set(['neighbor']))).toEqual(['wanderer'])
  })

  it('counts progress for a count and for a list', () => {
    expect(stampProgress('wanderer', { 'base:visit': 3 })).toEqual({ done: 3, of: 15 })
    expect(stampProgress('arcadeRat', { 'game:berryCatch': 9 })).toEqual({ done: 1, of: 2 })
  })

  it('only uses deeds that exist', () => {
    for (const id of STAMP_IDS) for (const deed of deedsOf(STAMPS[id].when)) expect(isDeed(deed)).toBe(true)
  })
})

describe('the errands', () => {
  it('draws the same three for everyone on a day, and they differ across days', () => {
    expect(drawErrands('2026-11-10')).toEqual(drawErrands('2026-11-10'))
    expect(drawErrands('2026-11-10')).toHaveLength(3)
    const week = Array.from({ length: 7 }, (_, i) => drawErrands(`2026-11-1${i}`).map((e) => e.id).join())
    expect(new Set(week).size).toBeGreaterThan(1)
  })
})
