import { describe, expect, it } from 'vitest'
import { sameTime } from './ranking'

describe('sameTime', () => {
  it('matches a time read back with 15 digits, not one a tick apart', () => {
    // The re-simulation's time and what the pooled connection reads for it.
    expect(sameTime(231.2333333334095, 231.233333333409)).toBe(true)
    expect(sameTime(231.2333333334095, 231.2333333334095 + 1 / 60)).toBe(false)
  })
})
