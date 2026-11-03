import { describe, expect, it } from 'vitest'
import { REGULAR_LEGENDS } from '../data/legends'
import { canPlay, captureByGift, captureOutcome, isCaptured, legendSource, mergeCaptures, parseCaptures, recordLegendWin, stillMissing, type LegendWin } from './capture'
import { EMPTY_SAVE, parseSaveData, type Save } from './meta'
import { mergeSaves } from './sync'

const win = (legend: LegendWin['legend'], patch: Partial<LegendWin> = {}): LegendWin => ({ legend, shiny: false, endless: false, ...patch })

const beat = (save: Save, ...wins: LegendWin[]) => wins.reduce((s, w) => recordLegendWin(s, w).save, save)

/** Every regular legend but Arceus captured (the event's Darkrai not). */
const all22 = (): Save => ({ ...EMPTY_SAVE, legends: Object.fromEntries(REGULAR_LEGENDS.filter((id) => id !== 'arceus').map((id) => [id, 5])) })

describe('recordLegendWin', () => {
  it('escapes until the legend’s wins are in, then catches it', () => {
    const one = recordLegendWin(EMPTY_SAVE, win('kyogre'))
    expect(one.result).toMatchObject({ outcome: 'escaped', wins: 1, need: 3 })
    const two = recordLegendWin(one.save, win('kyogre'))
    expect(two.result).toMatchObject({ outcome: 'escaped', wins: 2 })
    const three = recordLegendWin(two.save, win('kyogre'))
    expect(three.result).toMatchObject({ outcome: 'caught', wins: 3 })
    expect(canPlay(three.save, 'kyogre')).toBe(true)
    expect(recordLegendWin(three.save, win('kyogre')).result.outcome).toBe('owned')
  })

  it('catches a mythical on its first win, Mewtwo on its fifth', () => {
    expect(recordLegendWin(EMPTY_SAVE, win('jirachi')).result.outcome).toBe('caught')
    const four = beat(EMPTY_SAVE, ...Array.from({ length: 4 }, () => win('mewtwo')))
    expect(isCaptured(four.legends, 'mewtwo')).toBe(false)
    expect(recordLegendWin(four, win('mewtwo')).result.outcome).toBe('caught')
  })

  it('counts Arceus only in endless mode, once the other 22 are captured', () => {
    expect(recordLegendWin(EMPTY_SAVE, win('arceus', { endless: true })).result).toMatchObject({ outcome: 'escaped', counted: false, wins: 0 })
    expect(recordLegendWin(all22(), win('arceus')).result).toMatchObject({ outcome: 'escaped', counted: false })
    const caught = recordLegendWin(all22(), win('arceus', { endless: true }))
    expect(caught.result.outcome).toBe('caught')
    expect(canPlay(caught.save, 'arceus')).toBe(true)
  })

  it('names the regular legends Arceus still waits for: a short one, never an event legend or itself', () => {
    const { jirachi: _, ...noJirachi } = all22().legends
    expect(stillMissing({ ...noJirachi, darkrai: 2, celebi: 1 }, 'arceus')).toEqual(['jirachi'])
    expect(stillMissing(all22().legends, 'arceus')).toEqual([])
  })

  it('never makes Arceus wait for an event legend: Darkrai, caught in two wins of its own', () => {
    expect(isCaptured(all22().legends, 'darkrai')).toBe(false)
    expect(legendSource('darkrai')).toBe('event')
    const two = beat(EMPTY_SAVE, win('darkrai'), win('darkrai'))
    expect(isCaptured(two.legends, 'darkrai')).toBe(true)
  })

  it('unlocks the shiny on a shiny capturing win or any shiny win after, never on an escape', () => {
    const escaped = recordLegendWin(EMPTY_SAVE, win('lugia', { shiny: true }))
    expect(escaped.result.shiny).toBe(false)
    expect('lugia' in escaped.save.shinyStarters).toBe(false)
    const caught = recordLegendWin(beat(EMPTY_SAVE, win('lugia'), win('lugia')), win('lugia', { shiny: true }))
    expect(caught.result).toMatchObject({ outcome: 'caught', shiny: true })
    expect(caught.save.shinyStarters.lugia).toBe(true)
    const later = recordLegendWin(beat(EMPTY_SAVE, win('mew')), win('mew', { shiny: true }))
    expect(later.result).toMatchObject({ outcome: 'owned', shiny: true })
  })
})

describe('captureOutcome', () => {
  it('reads the save once the defeat is banked', () => {
    const banked = beat(EMPTY_SAVE, win('entei'), win('entei'))
    expect(captureOutcome(banked, 'entei')).toBe('escaped')
    expect(captureOutcome(beat(banked, win('entei')), 'entei')).toBe('caught')
    expect(captureOutcome(banked, 'snorlax')).toBe('escaped')
  })
})

describe('saves', () => {
  it('merges counts per legend at the larger side, idempotently', () => {
    const a = { kyogre: 2, mew: 1 }
    const b = { kyogre: 1, lugia: 3 }
    const merged = mergeCaptures(a, b)
    expect(merged).toEqual({ kyogre: 2, mew: 1, lugia: 3 })
    expect(mergeCaptures(merged, b)).toEqual(merged)
    const m = mergeSaves({ ...EMPTY_SAVE, legends: a, shinyStarters: { mew: true } }, { ...EMPTY_SAVE, legends: b })
    expect(m.legends).toEqual(merged)
    expect(m.shinyStarters.mew).toBe(true)
  })

  it('parses only known legends with whole counts, and keeps shiny legends', () => {
    expect(parseCaptures({ kyogre: 2.7, snorlax: 3, lugia: -1, mew: 'x' })).toEqual({ kyogre: 2 })
    const save = parseSaveData({ ...EMPTY_SAVE, legends: { rayquaza: 3 }, shinyStarters: { rayquaza: true } })
    expect(save.legends).toEqual({ rayquaza: 3 })
    expect(save.shinyStarters.rayquaza).toBe(true)
  })

  it('tells where each legend is met', () => {
    expect([legendSource('kyogre'), legendSource('zapdos'), legendSource('celebi'), legendSource('mewtwo'), legendSource('arceus'), legendSource('cresselia')]).toEqual(['rift', 'trio', 'mythical', 'finale', 'endless', 'festival'])
  })

  it('never counts a win toward a festival legend: only its gift captures it', () => {
    expect(recordLegendWin(EMPTY_SAVE, win('cresselia')).result).toMatchObject({ outcome: 'escaped', counted: false })
    expect(isCaptured(captureByGift({}, 'cresselia'), 'cresselia')).toBe(true)
  })
})
