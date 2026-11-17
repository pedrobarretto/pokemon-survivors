import { describe, expect, it } from 'vitest'
import { KEEP, keptBuilds, type CdnBuild } from './builds'

const DAY = 86_400_000
const now = 100 * DAY
const build = (id: string, daysAgo: number, files: string[]): CdnBuild => ({ id, at: now - daysAgo * DAY, files })

describe('keptBuilds', () => {
  it('keeps the new build and the recent ones, newest first', () => {
    const live = [build('a', 3, ['assets/a.js']), build('b', 1, ['assets/b.js'])]
    expect(keptBuilds(live, build('c', 0, ['assets/c.js']), now, 1000).map((b) => b.id)).toEqual(['c', 'b', 'a'])
  })

  it('drops the old ones but the newest two', () => {
    const live = [build('a', 30, ['assets/a.js']), build('b', 20, ['assets/b.js']), build('c', 10, ['assets/c.js'])]
    expect(keptBuilds(live, null, now, 1000).map((b) => b.id)).toEqual(['c', 'b'])
    expect(keptBuilds(live, build('d', 0, []), now, 1000).map((b) => b.id)).toEqual(['d', 'c'])
  })

  it('replaces a build deployed again', () => {
    const kept = keptBuilds([build('a', 1, ['assets/old.js'])], build('a', 0, ['assets/new.js']), now, 1000)
    expect(kept).toEqual([build('a', 0, ['assets/new.js'])])
  })

  it('stops at the file budget, counting shared files once, and at the cap', () => {
    const live = [build('a', 2, ['assets/s.js', 'assets/a.js']), build('b', 1, ['assets/s.js', 'assets/b.js'])]
    expect(keptBuilds(live, build('c', 0, ['assets/s.js']), now, 2).map((b) => b.id)).toEqual(['c', 'b'])
    const many = Array.from({ length: KEEP.max + 5 }, (_, i) => build(`b${i}`, i / 100, []))
    expect(keptBuilds(many, null, now, 1000)).toHaveLength(KEEP.max)
  })
})
