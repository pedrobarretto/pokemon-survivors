import { describe, expect, it } from 'vitest'
import { afterCrash, afterRun, isSafe, NO_CRASHES, parseSafeMode, SAFE_MODE, safeLevel, type SafeMode } from './safeMode'

const AT = '2026-10-22T12:00:00.000Z'
const runs = (s: SafeMode, n: number, minutes = 10) => Array.from({ length: n }).reduce<SafeMode>((acc) => afterRun(acc, minutes), s)

describe('safe mode', () => {
  it('turns on with a crash and off after enough long clean runs in a row', () => {
    expect(isSafe(NO_CRASHES)).toBe(false)
    const crashed = afterCrash(NO_CRASHES, AT)
    expect(safeLevel(crashed)).toBe(1)
    expect(crashed.told).toBe(false)
    expect(isSafe(runs(crashed, SAFE_MODE.stepDown[1] - 1))).toBe(true)
    expect(isSafe(runs(crashed, SAFE_MODE.stepDown[1]))).toBe(false)
  })

  it('goes a level further on another crash, and steps back down one level at a time', () => {
    const twice = afterCrash(afterCrash(NO_CRASHES, AT), AT)
    expect(safeLevel(twice)).toBe(2)
    expect(safeLevel(afterCrash(twice, AT))).toBe(2)
    expect(safeLevel(runs(twice, SAFE_MODE.stepDown[2] - 1))).toBe(2)
    const down = runs(twice, SAFE_MODE.stepDown[2])
    expect(safeLevel(down)).toBe(1)
    expect(safeLevel(runs(down, SAFE_MODE.stepDown[1]))).toBe(0)
  })

  it('counts only runs that reach the crash zone', () => {
    const crashed = afterCrash(NO_CRASHES, AT)
    expect(runs(crashed, 10, SAFE_MODE.cleanMinutes - 1)).toBe(crashed)
  })

  it('starts the streak over on another crash, before or after it turned off', () => {
    const almost = runs(afterCrash(NO_CRASHES, AT), SAFE_MODE.stepDown[1] - 1)
    expect(afterCrash(almost, AT).clean).toBe(0)
    const off = runs(afterCrash(NO_CRASHES, AT), SAFE_MODE.stepDown[1])
    expect(safeLevel(afterCrash(off, AT))).toBe(1)
  })

  it('follows the player, but a crash undoes turning it off', () => {
    const on: SafeMode = { ...NO_CRASHES, choice: 'on' }
    expect(safeLevel(runs(on, 10))).toBe(1)
    expect(afterCrash(on, AT).told).toBe(true)
    const off: SafeMode = { ...afterCrash(afterCrash(NO_CRASHES, AT), AT), choice: 'off' }
    expect(isSafe(off)).toBe(false)
    expect(safeLevel(afterCrash(off, AT))).toBe(2)
  })

  it('reads garbage as no crashes, and a state from before the levels as level 1 until its clean runs', () => {
    expect(parseSafeMode(null)).toEqual(NO_CRASHES)
    expect(parseSafeMode({ choice: 'maybe', crashes: -2, clean: 'x' })).toEqual(NO_CRASHES)
    expect(parseSafeMode({ choice: 'auto', crashes: 2, clean: 1, at: AT }).level).toBe(1)
    expect(parseSafeMode({ choice: 'auto', crashes: 2, clean: 3, at: AT }).level).toBe(0)
    expect(parseSafeMode({ choice: 'auto', crashes: 2, level: 7, clean: 1 }).level).toBe(0)
  })
})
