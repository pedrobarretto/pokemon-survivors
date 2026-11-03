import { describe, expect, it } from 'vitest'
import { ARENA_REWARDS, seasonReward } from './arenaRewards'

describe('seasonReward', () => {
  const games = ARENA_REWARDS.minGames

  it('gives the title of the peak tier, once per season by its key', () => {
    expect(seasonReward(3, { mmr: 1200, rp: 450, peak: 720, games, protection: 0 })).toEqual({
      content: { kind: 'title', title: 'arenaUltra' },
      reason: { kind: 'arenaSeason', season: 3, tier: 'ultra' },
      key: 'arena:season:3',
    })
    expect(seasonReward(1, { mmr: 1000, rp: 0, peak: 40, games, protection: 0 })?.content).toEqual({ kind: 'title', title: 'arenaPoke' })
  })

  it('gives nothing below the season’s minimum of rated matches', () => {
    expect(seasonReward(1, { mmr: 1300, rp: 990, peak: 990, games: games - 1, protection: 0 })).toBeNull()
  })
})
