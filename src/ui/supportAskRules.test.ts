import { describe, expect, it } from 'vitest'
import { reachedMilestones, supportAskDue } from './supportAskRules'

const base = { runs: 30, nightmare: false, sessions: 5, supporter: false, asked: [] }

describe('supportAskDue', () => {
  it('asks at the first milestone this device was not asked about', () => {
    expect(supportAskDue(base)).toBe('runs25')
    expect(supportAskDue({ ...base, asked: ['runs25'] })).toBeNull()
    expect(supportAskDue({ ...base, nightmare: true, asked: ['runs25'] })).toBe('nightmare')
    expect(supportAskDue({ ...base, runs: 120, nightmare: true, asked: ['runs25', 'nightmare'] })).toBe('runs100')
  })

  it('never asks a supporter, nor in the first sessions', () => {
    expect(supportAskDue({ ...base, supporter: true })).toBeNull()
    expect(supportAskDue({ ...base, sessions: 2 })).toBeNull()
    expect(supportAskDue({ ...base, runs: 24 })).toBeNull()
  })

  it('lists every milestone reached, so one ask covers a player past several', () => {
    expect(reachedMilestones({ runs: 150, nightmare: true, sessions: 9 })).toEqual(['runs25', 'nightmare', 'runs100'])
  })
})
