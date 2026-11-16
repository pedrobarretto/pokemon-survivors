import { describe, expect, it } from 'vitest'
import { holdsPass, mergeHideout, NO_HIDEOUT, readPoster, usePass } from './hideoutPass'

describe('the Rocket Hideout pass', () => {
  it('comes from the poster once a day and is spent by one run', () => {
    const first = readPoster(NO_HIDEOUT, '2026-11-11')
    expect(first.got).toBe('new')
    expect(readPoster(first.save, '2026-11-11').got).toBe('held')
    const spent = usePass(first.save)
    expect(holdsPass(spent)).toBe(false)
    expect(readPoster(spent, '2026-11-11').got).toBe('tomorrow')
    expect(readPoster(spent, '2026-11-12').got).toBe('new')
  })

  it('is never used twice across devices once synced', () => {
    const given = readPoster(NO_HIDEOUT, '2026-11-11').save
    expect(holdsPass(mergeHideout(given, usePass(given)))).toBe(false)
  })
})
