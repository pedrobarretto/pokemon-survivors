import { describe, expect, it } from 'vitest'
import { canRefer, creditDue, firstTouch, inviteMomentDue, landingRef, milestonesReached, nextMilestone, parseInvites, REFERRAL } from './referral'

describe('landingRef', () => {
  it('reads ?ref= first, then the profile link, and drops invalid handles', () => {
    expect(landingRef(new URLSearchParams('ref=Ash_K&u=misty'), 'u')).toBe('ash_k')
    expect(landingRef(new URLSearchParams('u=misty'), 'u')).toBe('misty')
    expect(landingRef(new URLSearchParams('ref=a!&u=x'), 'u')).toBeNull()
  })
})

describe('firstTouch', () => {
  it('keeps the first handle seen and never the player’s own', () => {
    expect(firstTouch(null, 'misty', null)).toBe('misty')
    expect(firstTouch('ash', 'misty', null)).toBe('ash')
    expect(firstTouch(null, 'misty', 'misty')).toBeNull()
    expect(firstTouch(null, null, 'ash')).toBeNull()
  })
})

describe('canRefer', () => {
  const signUp = { userId: 'new', referrer: 'ash', ageHours: 1, hasSave: false, referredBy: null }

  it('credits a new account once, never oneself', () => {
    expect(canRefer(signUp)).toBe(true)
    expect(canRefer({ ...signUp, referrer: 'new' })).toBe(false)
    expect(canRefer({ ...signUp, referrer: null })).toBe(false)
    expect(canRefer({ ...signUp, referredBy: 'misty' })).toBe(false)
  })

  it('refuses accounts that already played or are old', () => {
    expect(canRefer({ ...signUp, hasSave: true })).toBe(false)
    expect(canRefer({ ...signUp, ageHours: REFERRAL.newAccountHours + 1 })).toBe(false)
  })
})

describe('invite rewards', () => {
  it('count once the friend has finished enough runs', () => {
    expect(creditDue(REFERRAL.runs - 1, false)).toBe(false)
    expect(creditDue(REFERRAL.runs, false)).toBe(true)
    expect(creditDue(REFERRAL.runs + 5, true)).toBe(false)
  })

  it('reach every milestone up to the count, so a later one pays whoever already passed it', () => {
    expect(milestonesReached(0)).toEqual([])
    expect(milestonesReached(1).map((m) => m.friends)).toEqual([1])
    expect(milestonesReached(6).map((m) => m.friends)).toEqual([1, 3, 5])
    expect(milestonesReached(10).at(-1)?.gifts[0]).toEqual({ kind: 'shinyHatch', family: 'dratini' })
  })

  it('point at the next milestone, none past the last', () => {
    expect(nextMilestone(0)?.friends).toBe(1)
    expect(nextMilestone(3)?.friends).toBe(5)
    expect(nextMilestone(10)).toBeNull()
  })
})

describe('inviteMomentDue', () => {
  const run = { won: false, time: 300, bestBefore: 200, day: '2026-11-05', askedOn: null }

  it('asks after a win or a new best, never after a first run or an ordinary one', () => {
    expect(inviteMomentDue(run)).toBe(true)
    expect(inviteMomentDue({ ...run, won: true, time: 100 })).toBe(true)
    expect(inviteMomentDue({ ...run, time: 150 })).toBe(false)
    expect(inviteMomentDue({ ...run, bestBefore: 0 })).toBe(false)
  })

  it('asks at most once a day', () => {
    expect(inviteMomentDue({ ...run, won: true, askedOn: '2026-11-05' })).toBe(false)
    expect(inviteMomentDue({ ...run, askedOn: '2026-11-04' })).toBe(true)
  })
})

describe('parseInvites', () => {
  it('keeps well-formed friends and clamps their runs', () => {
    const friends = parseInvites({ friends: [{ handle: 'Misty', name: 'Misty', runs: 9, counted: true }, { handle: null, name: '', runs: 1 }, 'x'] })
    expect(friends).toEqual([
      { handle: 'misty', name: 'Misty', runs: REFERRAL.runs, counted: true },
      { handle: null, name: '', runs: 1, counted: false },
    ])
    expect(parseInvites({ friends: 'no' })).toBeNull()
  })
})
