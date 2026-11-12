import { describe, expect, it } from 'vitest'
import { SWORDS } from '../data/legends'
import { captureByGift, legendSource, NO_CAPTURES, winCounts } from './capture'
import { parseWild, rollRoamer, rollSword, type WildStart } from './quests'
import { bankRoamer, mergeRoamers, mergeRushBest, parseRoamers, recordRush, wildOf } from './questSave'
import { questGifts } from './questGifts'
import { gameGiftsApplied } from './gameGifts'
import { keepGiven } from './gifts'
import { EMPTY_SAVE } from './meta'

const FREE: WildStart = { lake: { uxie: 0.5, mesprit: 1, azelf: 0.2 }, swords: ['cobalion', 'terrakion', 'virizion'] }

describe('the open map’s legends', () => {
  it('bring only what the save still has to catch, from the seed alone', () => {
    const seeds = Array.from({ length: 400 }, (_, i) => i * 7919 + 13)
    const lakes = seeds.map((s) => rollRoamer(s, FREE)).filter((l) => l !== null)
    // About one run in five brings a roamer, each of the free ones in turn.
    expect(lakes.length / seeds.length).toBeGreaterThan(0.12)
    expect(lakes.length / seeds.length).toBeLessThan(0.32)
    expect(new Set(lakes)).toEqual(new Set(['uxie', 'mesprit', 'azelf']))
    expect(seeds.map((s) => rollRoamer(s, { lake: { mesprit: 0.4 }, swords: [] })).filter((l) => l !== null && l !== 'mesprit')).toEqual([])
    expect(seeds.some((s) => rollRoamer(s, { lake: {}, swords: [] }) !== null || rollSword(s, { lake: {}, swords: [] }) !== null)).toBe(false)
    expect(seeds.map((s) => rollSword(s, { lake: {}, swords: ['virizion'] })).filter((w) => w !== null && w !== 'virizion')).toEqual([])
  })

  it('read a replay’s wild legends strictly', () => {
    expect(parseWild(FREE)).toEqual(FREE)
    expect(parseWild({ lake: { uxie: 1.5 }, swords: [] })).toBeNull()
    expect(parseWild({ lake: { mew: 0.5 }, swords: [] })).toBeNull()
    expect(parseWild({ lake: {}, swords: ['cobalion', 'keldeo'] })).toBeNull()
  })

  it('keep a roamer’s HP taken on every device, never giving it back', () => {
    expect(mergeRoamers({ uxie: 0.6, azelf: 0.3 }, { uxie: 0.4 })).toEqual({ uxie: 0.4, azelf: 0.3 })
    expect(bankRoamer({ uxie: 0.4 }, 'uxie', 0.7)).toEqual({ uxie: 0.4 })
    expect(bankRoamer({ uxie: 0.4 }, 'uxie', 0)).toEqual({})
    expect(parseRoamers({ uxie: 0.5, mesprit: 2, mew: 0.1 })).toEqual({ uxie: 0.5 })
    const caught = captureByGift(NO_CAPTURES, 'azelf')
    expect(wildOf({ legends: caught, roamers: { uxie: 0.25 } })).toEqual({ lake: { uxie: 0.25, mesprit: 1 }, swords: [...SWORDS], forces: { tornadus: 1, thundurus: 1 } })
  })

  it('catch each its own way: Keldeo only as the Swords’ gift', () => {
    expect([legendSource('uxie'), legendSource('cobalion'), legendSource('keldeo'), legendSource('hoopa'), legendSource('palkia')]).toEqual(['roam', 'duel', 'swords', 'rush', 'rift'])
    expect(winCounts(NO_CAPTURES, 'keldeo', false)).toBe(false)
    const two = captureByGift(captureByGift(NO_CAPTURES, 'cobalion'), 'terrakion')
    expect(questGifts({ legends: two, gifts: [] }).map((g) => g.id)).toEqual([])
    const three = captureByGift(two, 'virizion')
    expect(questGifts({ legends: three, gifts: [] }).map((g) => g.content)).toEqual([{ kind: 'legend', legend: 'keldeo' }])
    expect(questGifts({ legends: three, gifts: ['quest:keldeo'] })).toEqual([])
  })

  it('keep Keldeo on the API only with its gift, as a festival’s or a path’s legend', () => {
    const swords = captureByGift(captureByGift(captureByGift(NO_CAPTURES, 'cobalion'), 'terrakion'), 'virizion')
    const save = { ...EMPTY_SAVE, legends: captureByGift(swords, 'keldeo'), gifts: ['quest:keldeo'] }
    expect(keepGiven(save, gameGiftsApplied(save)).legends.keldeo).toBeDefined()
    // A save edited to list Keldeo without the Swords (so no gift vouches for it) loses it.
    const edited = { ...EMPTY_SAVE, legends: captureByGift(NO_CAPTURES, 'keldeo'), gifts: ['quest:keldeo'] }
    expect(keepGiven(edited, gameGiftsApplied(edited)).legends.keldeo).toBeUndefined()
  })

  it('keep each level’s best time in Hoopa’s Rings', () => {
    expect(mergeRushBest({ normal: 300, hard: 500 }, { normal: 280 })).toEqual({ normal: 280, hard: 500 })
    expect(recordRush({ normal: 280 }, 'normal', 300)).toEqual({ best: { normal: 280 }, record: false })
    expect(recordRush({ normal: 280 }, 'hard', 700)).toEqual({ best: { normal: 280, hard: 700 }, record: true })
  })
})
