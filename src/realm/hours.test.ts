import { describe, expect, it } from 'vitest'
import type { RealmHour } from '../data/realmEvents'
import { clockOf, HOUR_WARN_MS, noticeOf } from './hours'

const hour: RealmHour = { kind: 'tide', start: 1_000_000_000, end: 1_000_900_000 }

describe('the notice of an hour', () => {
  it('stays quiet until the warning starts', () => {
    expect(noticeOf(hour, hour.start - HOUR_WARN_MS - 1)).toBeNull()
    expect(noticeOf(hour, hour.start - HOUR_WARN_MS)).toEqual({ hour, on: false, left: HOUR_WARN_MS })
  })

  it('counts to the end while it runs, and is gone at the end', () => {
    expect(noticeOf(hour, hour.start)).toEqual({ hour, on: true, left: hour.end - hour.start })
    expect(noticeOf(hour, hour.end)).toBeNull()
  })
})

describe('clockOf', () => {
  it('rounds up and pads', () => {
    expect(clockOf(61_000)).toBe('01:01')
    expect(clockOf(1)).toBe('00:01')
    expect(clockOf(-5)).toBe('00:00')
  })
})
