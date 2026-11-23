import { describe, expect, it } from 'vitest'
import { BADGES_SHOWN, boardPlace, BOARD_SHOWN, runBadges, showcase } from './card'

describe('showcase', () => {
  it('shows every item that fits, else one cell fewer and "+N" for the rest', () => {
    expect(showcase([1, 2, 3])).toEqual({ shown: [1, 2, 3], more: 0 })
    expect(showcase([1, 2, 3, 4, 5, 6])).toEqual({ shown: [1, 2, 3, 4, 5, 6], more: 0 })
    expect(showcase([1, 2, 3, 4, 5, 6, 7, 8, 9])).toEqual({ shown: [1, 2, 3, 4, 5], more: 4 })
  })
})

describe('boardPlace', () => {
  it('brags about all time first, then the week, then the day, within the shown depth', () => {
    expect(boardPlace({ day: 6, week: 34, all: 31 })).toEqual({ period: 'all', rank: 31 })
    expect(boardPlace({ day: 6, week: 34, all: BOARD_SHOWN + 1 })).toEqual({ period: 'week', rank: 34 })
    expect(boardPlace({ day: 6, week: null, all: null })).toEqual({ period: 'day', rank: 6 })
    expect(boardPlace({ day: BOARD_SHOWN + 5, week: null, all: null })).toBeNull()
  })
})

describe('runBadges', () => {
  const none = { challenge: null, record: false, board: null, shinies: 0, legends: 0 }

  it('puts the most telling highlights first and keeps only what fits', () => {
    expect(runBadges(none)).toEqual([])
    expect(runBadges({ ...none, shinies: 2, legends: 1 })).toEqual(['shinies', 'legends'])
    const all = runBadges({ challenge: { rank: 3, total: 90 }, record: true, board: { period: 'day', rank: 1 }, shinies: 1, legends: 1 })
    expect(all).toEqual(['challenge', 'record', 'board'])
    expect(all).toHaveLength(BADGES_SHOWN)
  })
})
