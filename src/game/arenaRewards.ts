import type { GiftTitleId } from '../data/achievements'
import type { TierId } from '../data/arenaRanked'
import { tierOf, type Rating } from './arenaRank'
import type { GiftContent, GiftReason } from './gifts'

/**
 * An Arena ranked season's reward: once it ends, every player with at least
 * `minGames` rated matches gets the title of the tier their peak reached, as
 * a Mystery Gift (the API sends it, `server/src/arena.ts`). Pure; text only.
 */
export const ARENA_REWARDS = {
  minGames: 5,
  titles: { poke: 'arenaPoke', great: 'arenaGreat', ultra: 'arenaUltra', master: 'arenaMaster' },
} as const satisfies { minGames: number; titles: Record<TierId, GiftTitleId> }

/** The gift a player's final `rating` of `season` earns (one per season, by `key`), or null below `minGames`. */
export const seasonReward = (season: number, rating: Rating): { content: GiftContent; reason: GiftReason; key: string } | null => {
  if (rating.games < ARENA_REWARDS.minGames) return null
  const tier = tierOf(rating.peak).tier
  return { content: { kind: 'title', title: ARENA_REWARDS.titles[tier] }, reason: { kind: 'arenaSeason', season, tier }, key: `arena:season:${season}` }
}
