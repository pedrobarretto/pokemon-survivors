import { describe, expect, it } from 'vitest'
import { canPurify, grantShadow, mergeShadows, NO_SHADOWS, parseShadows, pickShadow, purifiedIds, purify, purifySteps, reshadow, runVariant, SHADOW, variantDeltas, walkShadows } from './shadow'

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
    expect(purify(walked, 'absol').absol!.rev).toBe(1)
  })

  it('the Shadow Serum turns a Purified one back, its gauge to walk again; anything else stays', () => {
    const purified = purify(walkShadows(grantShadow(NO_SHADOWS, 'absol'), SHADOW.steps), 'absol')
    expect(purifiedIds(purified)).toEqual(['absol'])
    const back = reshadow(pickShadow(purified, 'absol', false), 'absol')
    expect(back.absol).toEqual({ purified: false, steps: 0, pick: true, rev: 2 })
    expect(runVariant(back, 'absol')).toBe('shadow')
    expect(canPurify(back, 'absol')).toBe(false)
    expect(reshadow(back, 'absol')).toBe(back)
    expect(reshadow(back, 'ditto')).toBe(back)
  })

  it('merge: at the same rev purified wins and the further gauge; a later purify or Serum wins over a stale side', () => {
    const a = { absol: { purified: true, steps: 100, pick: true, rev: 0 } }
    const b = { absol: { purified: false, steps: 500, pick: false, rev: 0 }, ditto: { purified: false, steps: 3, pick: true, rev: 0 } }
    expect(mergeShadows(a, b)).toEqual({ absol: { purified: true, steps: 500, pick: false, rev: 0 }, ditto: { purified: false, steps: 3, pick: true, rev: 0 } })
    // A device still holding the purified Absol (rev 1) can't undo the Serum (rev 2), nor bring back its full gauge.
    const stale = { absol: { purified: true, steps: SHADOW.steps, pick: true, rev: 1 } }
    const reverted = { absol: { purified: false, steps: 0, pick: true, rev: 2 } }
    expect(mergeShadows(reverted, stale).absol).toEqual({ purified: false, steps: 0, pick: true, rev: 2 })
    expect(mergeShadows(stale, reverted).absol).toEqual({ purified: false, steps: 0, pick: true, rev: 2 })
    // And a stale revert loses to the purify that came after it.
    const again = { absol: { purified: true, steps: SHADOW.steps, pick: false, rev: 3 } }
    expect(mergeShadows(again, reverted).absol).toEqual({ purified: true, steps: SHADOW.steps, pick: true, rev: 3 })
  })

  it('parse: old entries (no rev) at rev 0, malformed ones cleaned', () => {
    expect(parseShadows({ absol: { purified: true, steps: -4, pick: 1 }, nope: { steps: 3 } })).toEqual({ absol: { purified: true, steps: 0, pick: false, rev: 0 } })
    expect(parseShadows({ absol: { purified: false, steps: 30, pick: true, rev: 2 } }).absol!.rev).toBe(2)
  })
})
