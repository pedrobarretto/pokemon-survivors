import { describe, expect, it } from 'vitest'
import { brasiliaDay, msToNextDay, previousDay, weekStart } from './day'

describe('the Brasília day', () => {
  it('turns over at midnight in Brasília (UTC-3), not in UTC', () => {
    expect(brasiliaDay(new Date('2026-10-16T02:59:59Z'))).toBe('2026-10-15')
    expect(brasiliaDay(new Date('2026-10-16T03:00:00Z'))).toBe('2026-10-16')
    expect(msToNextDay(new Date('2026-10-16T02:00:00Z'))).toBe(3_600_000)
  })

  it('steps back across months and years', () => {
    expect(previousDay('2026-03-01')).toBe('2026-02-28')
    expect(previousDay('2027-01-01')).toBe('2026-12-31')
  })
})

describe('weekStart', () => {
  it('names the Monday of a Monday-to-Sunday week', () => {
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
    expect(weekStart('2026-11-08')).toBe('2026-11-02')
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })
})
