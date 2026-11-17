import { describe, expect, it } from 'vitest'
import { answerGate, furthest, isFirstLoad, NO_STEPS, reach } from './firstSteps'

describe('first visit steps', () => {
  it('keeps the first time a step is reached, to a tenth of a second', () => {
    const s = reach(reach(NO_STEPS, 'lobby', 3.14159), 'lobby', 40)
    expect(s.times).toEqual({ lobby: 3.1 })
  })

  it('judges a visit by its furthest step, skipped ones and all', () => {
    expect(furthest({})).toEqual({ step: null, stepIndex: -1 })
    // Back from signing in: no intro, no gate, straight to the select.
    expect(furthest({ lobby: 1, select: 4 })).toEqual({ step: 'select', stepIndex: 8 })
    // Reached out of order (a co-op link draws a frame before any lobby): the order of the steps decides.
    expect(furthest({ firstFrame: 2, lobby: 9 })).toEqual({ step: 'firstFrame', stepIndex: 10 })
  })

  it('puts the onboarding before the lobby and the run', () => {
    // Arm `tour`: the training run skipped, the pick made, its run loading.
    expect(furthest({ intro: 1, welcome: 2, tutorial: 4, tutorialEnd: 30, partner: 31, play: 40, loading: 40 })).toEqual({ step: 'loading', stepIndex: 9 })
    expect(furthest({ intro: 1, welcome: 2, tutorial: 4 })).toEqual({ step: 'tutorial', stepIndex: 2 })
  })

  it('takes the last answer at the gate', () => {
    expect(answerGate(answerGate(NO_STEPS, 'back'), 'guest').gate).toBe('guest')
  })

  it('counts only the first few loads of a device with no run', () => {
    expect(isFirstLoad(0, 0)).toBe(true)
    expect(isFirstLoad(0, 2)).toBe(true)
    expect(isFirstLoad(0, 3)).toBe(false)
    expect(isFirstLoad(1, 0)).toBe(false)
  })
})
