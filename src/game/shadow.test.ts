import { describe, expect, it } from 'vitest'
import { canPurify, grantShadow, mergeShadows, NO_SHADOWS, parseShadows, pickShadow, purify, purifySteps, runVariant, SHADOW, variantDeltas, walkShadows } from './shadow'

describe('Shadow Pokémon', () => {
  it('play as Shadow once owned, Purified once purified, plain when switched off', () => {
    const owned = grantShadow(NO_SHADOWS, 'ditto')
    expect(runVariant(owned, 'ditto')).toBe('shadow')
    expect(runVariant(pickShadow(owned, 'ditto', false), 'ditto')).toBeNull()
    expect(runVariant(NO_SHADOWS, 'ditto')).toBeNull()
    expect(variantDeltas('shadow')).toEqual([SHADOW.shadow])
    expect(variantDeltas(undefined)).toEqual([])
  })

  it('purify only once their heart gauge is walked full, and a legend asks for more', () => {
    const owned = grantShadow(grantShadow(NO_SHADOWS, 'absol'), 'mewtwo')
    expect(canPurify(owned, 'absol')).toBe(false)
    expect(purify(owned, 'absol')).toBe(owned)
    const walked = walkShadows(owned, SHADOW.steps)
    expect(canPurify(walked, 'absol')).toBe(true)
    expect(canPurify(walked, 'mewtwo')).toBe(false)
    expect(walkShadows(walked, 10 ** 9).mewtwo!.steps).toBe(purifySteps('mewtwo'))
    expect(runVariant(purify(walked, 'absol'), 'absol')).toBe('purified')
  })

  it('merge for good: purified wins, the further gauge wins, the incoming pick wins', () => {
    const a = { absol: { purified: true, steps: 100, pick: true } }
    const b = { absol: { purified: false, steps: 500, pick: false }, ditto: { purified: false, steps: 3, pick: true } }
    expect(mergeShadows(a, b)).toEqual({ absol: { purified: true, steps: 500, pick: false }, ditto: { purified: false, steps: 3, pick: true } })
    expect(parseShadows({ absol: { purified: true, steps: -4, pick: 1 }, nope: { steps: 3 } })).toEqual({ absol: { purified: true, steps: 0, pick: false } })
  })
})
