import { describe, expect, it } from 'vitest'
import { afterCrash, afterRun, isSafe, NO_CRASHES, parseSafeMode, SAFE_MODE, type SafeMode } from './safeMode'

const AT = '2026-10-22T12:00:00.000Z'
const runs = (s: SafeMode, n: number, minutes = 10) => Array.from({ length: n }).reduce<SafeMode>((acc) => afterRun(acc, minutes), s)

describe('safe mode', () => {
  it('turns on with a crash and off after enough long clean runs in a row', () => {
    expect(isSafe(NO_CRASHES)).toBe(false)
    const crashed = afterCrash(NO_CRASHES, AT)
    expect(isSafe(crashed)).toBe(true)
    expect(crashed.told).toBe(false)
    expect(isSafe(runs(crashed, SAFE_MODE.cleanRuns - 1))).toBe(true)
    expect(isSafe(runs(crashed, SAFE_MODE.cleanRuns))).toBe(false)
  })

  it('counts only runs that reach the crash zone', () => {
    const crashed = afterCrash(NO_CRASHES, AT)
    expect(runs(crashed, 10, SAFE_MODE.cleanMinutes - 1)).toBe(crashed)
  })

  it('starts the streak over on another crash, before or after it turned off', () => {
    const almost = runs(afterCrash(NO_CRASHES, AT), SAFE_MODE.cleanRuns - 1)
    expect(afterCrash(almost, AT).clean).toBe(0)
    const off = runs(afterCrash(NO_CRASHES, AT), SAFE_MODE.cleanRuns)
    expect(isSafe(afterCrash(off, AT))).toBe(true)
  })

  it('follows the player, but a crash undoes turning it off', () => {
    const on: SafeMode = { ...NO_CRASHES, choice: 'on' }
    expect(isSafe(runs(on, 10))).toBe(true)
    expect(afterCrash(on, AT).told).toBe(true)
    const off: SafeMode = { ...afterCrash(NO_CRASHES, AT), choice: 'off' }
    expect(isSafe(off)).toBe(false)
    expect(isSafe(afterCrash(off, AT))).toBe(true)
  })

  it('reads garbage as no crashes', () => {
    expect(parseSafeMode(null)).toEqual(NO_CRASHES)
    expect(parseSafeMode({ choice: 'maybe', crashes: -2, clean: 'x' })).toEqual({ ...NO_CRASHES, crashes: 0, clean: 0 })
  })
})
