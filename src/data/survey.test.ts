import { describe, expect, it } from 'vitest'
import { daysBetween, DESIGN_SURVEY, designSurveyDue, seenOn, toggleAspect } from './survey'

describe('design survey', () => {
  const first = seenOn(null, '2026-11-10', 8)

  it('counts each different day once and keeps the first sight', () => {
    expect(first).toEqual({ first: '2026-11-10', last: '2026-11-10', days: 1, runs: 8 })
    expect(seenOn(first, '2026-11-10', 12)).toBe(first)
    expect(seenOn(first, '2026-11-12', 12)).toEqual({ first: '2026-11-10', last: '2026-11-12', days: 2, runs: 8 })
  })

  it('is due only after enough days and enough runs since first sight', () => {
    const enoughDays = { ...first, days: DESIGN_SURVEY.minDays }
    expect(designSurveyDue(null, 100)).toBe(false)
    expect(designSurveyDue(first, 8 + DESIGN_SURVEY.minRuns)).toBe(false)
    expect(designSurveyDue(enoughDays, 8 + DESIGN_SURVEY.minRuns - 1)).toBe(false)
    expect(designSurveyDue(enoughDays, 8 + DESIGN_SURVEY.minRuns)).toBe(true)
  })

  it('holds two aspects at most, and never both sides of a pair', () => {
    expect(toggleAspect(['niceLook'], 'niceLook')).toEqual([])
    expect(toggleAspect(['niceLook'], 'badLook')).toEqual(['badLook'])
    expect(toggleAspect(['niceLook', 'readable'], 'easyToFind')).toEqual(['readable', 'easyToFind'])
  })

  it('counts whole days between local days', () => {
    expect(daysBetween('2026-11-10', '2026-11-13')).toBe(3)
    expect(daysBetween('2026-10-31', '2026-11-01')).toBe(1)
  })
})
