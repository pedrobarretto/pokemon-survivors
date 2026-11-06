import { describe, expect, it } from 'vitest'
import { brasiliaDay } from '../game/day'
import { boardKeeps, boardPoints, periodStart } from './boards'

describe('periodStart', () => {
  it("starts a week on the Brasília Monday, so Sunday night stays in the week that's ending", () => {
    // 2026-11-09 is a Monday. 02:30 UTC on it is still Sunday 23:30 in Brasília.
    const sundayNight = brasiliaDay(new Date('2026-11-09T02:30:00Z'))
    expect(sundayNight).toBe('2026-11-08')
    expect(periodStart('week', sundayNight)).toBe('2026-11-02')
    const mondayMorning = brasiliaDay(new Date('2026-11-09T03:30:00Z'))
    expect(periodStart('week', mondayMorning)).toBe('2026-11-09')
    expect(periodStart('day', mondayMorning)).toBe('2026-11-09')
  })
})

describe('boardPoints', () => {
  it('ranks a solo game by its score, kept at the best', () => {
    expect(boardPoints('fishing', { score: 420 })).toBe(420)
    expect(boardKeeps('fishing')).toBe('best')
  })

  it('counts only a table win against a person, added up', () => {
    expect(boardPoints('fourInRow', { result: 'win', vs: 'human' })).toBe(1)
    expect(boardPoints('fourInRow', { result: 'win', vs: 'bot' })).toBeNull()
    expect(boardPoints('typeDuel', { result: 'draw', vs: 'human' })).toBeNull()
    expect(boardPoints('typeDuel', { result: 'loss', vs: 'human' })).toBeNull()
    expect(boardKeeps('typeDuel')).toBe('sum')
  })

  it("takes nothing from an outcome of the other game's kind", () => {
    expect(boardPoints('berryCatch', { result: 'win', vs: 'human' })).toBeNull()
    expect(boardPoints('fourInRow', { score: 10 })).toBeNull()
  })
})
