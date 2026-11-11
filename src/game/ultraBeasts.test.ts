import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { RIFT } from '../data/rifts'
import { ULTRA_BEASTS, WORMHOLE } from '../data/ultraBeasts'
import { RUN_LENGTH } from '../data/waves'
import { addDays } from './day'
import { captureByGift, isCaptured, winCounts } from './capture'
import { gameGiftsApplied, isGameGift } from './gameGifts'
import { applyGift, keepGiven } from './gifts'
import { EMPTY_SAVE, type Save } from './meta'
import { POIPOLE_GIFT, ultraGifts } from './ultraGifts'
import { ultraFits, ultraOfWeek, ultraWeekEnd } from './ultraWeek'
import { drawUltraBeast, wormholeDue } from './wormhole'

/** A Monday (2026-11-09) and the days after it. */
const MONDAY = '2026-11-09'

describe('the Ultra Beast of the week', () => {
  it('holds Monday to Sunday and walks every beast in turn', () => {
    const week = ultraOfWeek(MONDAY)
    for (let d = 1; d < 7; d++) expect(ultraOfWeek(addDays(MONDAY, d))).toBe(week)
    expect(ultraWeekEnd(MONDAY)).toBe('2026-11-15')
    const next = Array.from({ length: ULTRA_BEASTS.length }, (_, w) => ultraOfWeek(addDays(MONDAY, w * 7)))
    expect(new Set(next)).toEqual(new Set(ULTRA_BEASTS))
    const at = ULTRA_BEASTS.indexOf(week)
    expect(ultraOfWeek(addDays(MONDAY, 7))).toBe(ULTRA_BEASTS[(at + 1) % ULTRA_BEASTS.length])
  })

  it('fits a run of its week, or one picked the day before (none fits too)', () => {
    // Monday noon in Brasília (UTC-3).
    const monday = new Date('2026-11-09T15:00:00Z')
    expect(ultraFits(ultraOfWeek(MONDAY), monday)).toBe(true)
    expect(ultraFits(ultraOfWeek('2026-11-08'), monday)).toBe(true)
    expect(ultraFits(null, monday)).toBe(true)
    expect(ultraFits(ultraOfWeek(addDays(MONDAY, 7)), monday)).toBe(false)
  })
})

describe('the Ultra Wormhole', () => {
  it('opens once its time came, with no rift under way, waiting a while for a boss, never so late it would meet the finale', () => {
    const at = WORMHOLE.at
    const base = { time: at, at, busy: false, bossAlive: false, endless: false }
    expect(wormholeDue({ ...base, time: at - 1 })).toBe(false)
    expect(wormholeDue(base)).toBe(true)
    expect(wormholeDue({ ...base, busy: true })).toBe(false)
    expect(wormholeDue({ ...base, bossAlive: true })).toBe(false)
    expect(wormholeDue({ ...base, bossAlive: true, time: at + RIFT.bossWait })).toBe(true)
    expect(wormholeDue({ ...base, time: RUN_LENGTH - RIFT.omenTime })).toBe(false)
    expect(wormholeDue({ ...base, at: Infinity, time: RUN_LENGTH * 2, endless: true })).toBe(false)
  })

  it('draws the week’s beast more often, and never the one the team plays', () => {
    const rng = createRng(7)
    const draws = Array.from({ length: 4000 }, () => drawUltraBeast(rng, 'kartana', 'guzzlord'))
    expect(draws).not.toContain('guzzlord')
    const share = draws.filter((b) => b === 'kartana').length / draws.length
    const expected = WORMHOLE.weekly / (WORMHOLE.weekly + ULTRA_BEASTS.length - 2)
    expect(Math.abs(share - expected)).toBeLessThan(0.03)
    expect(new Set(draws).size).toBe(ULTRA_BEASTS.length - 1)
  })
})

describe('Poipole, the Ultra Beasts’ gift', () => {
  const caught = (n: number): Save => ({ ...EMPTY_SAVE, legends: Object.fromEntries(ULTRA_BEASTS.slice(0, n).map((b) => [b, 1])) })

  it('comes once every beast is captured, never for a win, and the API keeps it', () => {
    expect(ultraGifts(caught(ULTRA_BEASTS.length - 1))).toEqual([])
    expect(winCounts(EMPTY_SAVE.legends, 'poipole', false)).toBe(false)
    const [gift] = ultraGifts(caught(ULTRA_BEASTS.length))
    expect(gift?.content).toEqual(POIPOLE_GIFT.content)
    expect(isGameGift(gift!.id)).toBe(true)
    const out = applyGift(caught(ULTRA_BEASTS.length), gift!)
    if (out.status !== 'applied') throw new Error(out.status)
    expect(isCaptured(out.save.legends, 'poipole')).toBe(true)
    expect(ultraGifts(out.save)).toEqual([])
    expect(keepGiven(out.save, gameGiftsApplied(out.save))).toEqual(out.save)
  })

  it('isn’t vouched for a save that never captured them all', () => {
    const edited: Save = { ...EMPTY_SAVE, legends: captureByGift(EMPTY_SAVE.legends, 'poipole') }
    expect(isCaptured(keepGiven(edited, gameGiftsApplied(edited)).legends, 'poipole')).toBe(false)
  })
})
