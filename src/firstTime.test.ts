import { describe, expect, it } from 'vitest'
import { drawArm, enrol, nextFirst, NOT_ENROLLED, parseFirstTime, signedInLeaves, tourDue, TOUR_RUNS, type FirstTime } from './firstTime'

const tour: FirstTime = { ...NOT_ENROLLED, arm: 'tour' }

describe('first visit onboarding', () => {
  it('draws half the devices into each arm', () => {
    expect(drawArm(0)).toBe('tour')
    expect(drawArm(0.49)).toBe('tour')
    expect(drawArm(0.5)).toBe('control')
    expect(drawArm(0.99)).toBe('control')
  })

  it('enrols only first visits of guests, once', () => {
    expect(enrol(NOT_ENROLLED, true, false, 0.9).arm).toBe('control')
    expect(enrol(NOT_ENROLLED, false, false, 0.1).arm).toBe(null)
    expect(enrol(NOT_ENROLLED, true, true, 0.1).arm).toBe(null)
    // An arm drawn stays, whatever the next load rolls.
    expect(enrol(tour, true, false, 0.9)).toBe(tour)
  })

  it('leads a first run to the welcome once, then the partner pick', () => {
    expect(nextFirst(NOT_ENROLLED)).toBe('fastLane')
    expect(nextFirst({ ...NOT_ENROLLED, arm: 'control' })).toBe('fastLane')
    expect(nextFirst(tour)).toBe('welcome')
    // A reload after the welcome (the training run finished, skipped or cut short) resumes at the pick.
    expect(nextFirst({ ...tour, welcome: true })).toBe('partner')
    expect(nextFirst({ ...tour, welcome: true, tutorial: { how: 'skipped', step: 'move' } })).toBe('partner')
  })

  it("asks the installed app's first run first, until it's answered as new", () => {
    expect(nextFirst(tour, true)).toBe('installed')
    expect(nextFirst({ ...NOT_ENROLLED, arm: 'control' }, true)).toBe('installed')
    expect(nextFirst({ ...tour, fresh: true }, true)).toBe('welcome')
    expect(nextFirst({ ...NOT_ENROLLED, arm: 'control', fresh: true }, true)).toBe('fastLane')
  })

  it('takes a device that signs in before its onboarding out of the test', () => {
    expect(signedInLeaves(tour).arm).toBe(null)
    expect(signedInLeaves({ ...NOT_ENROLLED, arm: 'control' }).arm).toBe(null)
    expect(signedInLeaves({ ...tour, welcome: true }).arm).toBe('tour')
    expect(signedInLeaves({ ...tour, welcome: true, partner: true }).arm).toBe('tour')
  })

  it('gives the tour once, after the first partner pick played its run', () => {
    const picked = { ...tour, welcome: true, partner: true }
    expect(tourDue(picked, 0)).toBe(false)
    expect(tourDue(picked, 1)).toBe(true)
    expect(tourDue(picked, TOUR_RUNS + 1)).toBe(false)
    expect(tourDue({ ...picked, tour: 'skipped' }, 1)).toBe(false)
    expect(tourDue({ ...picked, arm: 'control' }, 1)).toBe(false)
    expect(tourDue({ ...tour, welcome: true }, 1)).toBe(false)
  })

  it('reads a stored state back, dropping what does not fit', () => {
    const s: FirstTime = { arm: 'tour', welcome: true, tutorial: { how: 'finished', step: 'boss' }, partner: true, tour: 'done', fresh: true }
    expect(parseFirstTime(JSON.stringify(s))).toEqual(s)
    expect(parseFirstTime(null)).toEqual(NOT_ENROLLED)
    expect(parseFirstTime('{oops')).toEqual(NOT_ENROLLED)
    expect(parseFirstTime(JSON.stringify({ arm: 'maybe', tutorial: { how: 'lost' }, tour: 1 }))).toEqual(NOT_ENROLLED)
  })
})
