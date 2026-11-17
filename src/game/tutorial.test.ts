import { describe, expect, it } from 'vitest'
import { edgeReach, furthestStep, nextStep, overdue, TUTORIAL, tutorialHp, type TutorialFacts } from './tutorial'

const idle: TutorialFacts = { walked: 0, foes: 1, packs: 0, leveled: false, ball: false, bossDown: false }

describe('the training run steps', () => {
  it('waits on each lesson until the player does it', () => {
    expect(nextStep('move', { ...idle, walked: TUTORIAL.walk - 1 })).toBe('move')
    expect(nextStep('move', { ...idle, walked: TUTORIAL.walk })).toBe('fight')
    expect(nextStep('fight', idle)).toBe('fight')
    expect(nextStep('fight', { ...idle, foes: 0 })).toBe('xp')
    expect(nextStep('xp', idle)).toBe('xp')
    expect(nextStep('xp', { ...idle, leveled: true })).toBe('wave')
    expect(nextStep('ball', { ...idle, ball: true })).toBe('boss')
    expect(nextStep('boss', { ...idle, bossDown: true })).toBe('end')
    expect(nextStep('end', { walked: 999, foes: 0, packs: 0, leveled: true, ball: true, bossDown: true })).toBe('end')
  })

  it('ends the wave only once every pack came and fell', () => {
    expect(nextStep('wave', { ...idle, foes: 0, packs: 2 })).toBe('wave')
    expect(nextStep('wave', { ...idle, foes: 3, packs: 0 })).toBe('wave')
    expect(nextStep('wave', { ...idle, foes: 0, packs: 0 })).toBe('ball')
  })

  it('hurries a step that waited past its timeout, never the end', () => {
    expect(overdue('move', TUTORIAL.timeout.move - 0.1)).toBe(false)
    expect(overdue('move', TUTORIAL.timeout.move)).toBe(true)
    expect(overdue('boss', TUTORIAL.timeout.boss)).toBe(true)
    expect(overdue('end', 1e6)).toBe(false)
  })

  it('reports the furthest step reached', () => {
    expect(furthestStep('xp', 'move')).toBe('xp')
    expect(furthestStep('move', 'boss')).toBe('boss')
  })
})

describe('the training run rules', () => {
  it('never lets HP drop under the floor', () => {
    expect(tutorialHp(-40, 100)).toBe(100 * TUTORIAL.floor)
    expect(tutorialHp(80, 100)).toBe(80)
  })

  it('reaches the screen edge along a direction', () => {
    expect(edgeReach({ w: 200, h: 400 }, 1, 0)).toBe(100)
    expect(edgeReach({ w: 200, h: 400 }, 0, -1)).toBe(200)
    expect(edgeReach({ w: 200, h: 200 }, Math.SQRT1_2, Math.SQRT1_2)).toBeCloseTo(100 * Math.SQRT2)
  })
})
