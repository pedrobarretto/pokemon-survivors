import { VERSUS_PICKS, type VersusPick } from '../data/versus'
import { ARENA_RANKED, type MatchKind } from '../data/arenaRanked'
import { seasonAt, seasonById, tierOf, type ArenaHistoryEntry, type ArenaLeaderboardRow, type ArenaProfile, type FairPlayView } from '../game/arenaRank'

/**
 * Made-up Arena standing, history and board (`ps.arena('fake')`), so the
 * hub and the end screen can be seen without the API. Fixed numbers: the
 * same shots every time. A scenario (`ps.arena('fake', s)`) stages Fair Play
 * and the protection meter: `fine` (full score, meter part way), `full`
 * (meter full: the next ranked loss is protected), `left` (just left a
 * match) and `low` (under the Ranqueada's minimum and held in the queue).
 */

export const FAKE_SCENARIOS = ['fine', 'full', 'left', 'low'] as const
export type FakeScenario = (typeof FAKE_SCENARIOS)[number]
export const isFakeScenario = (x: unknown): x is FakeScenario => typeof x === 'string' && (FAKE_SCENARIOS as readonly string[]).includes(x)

const season = () => seasonAt(Date.now()) ?? seasonById(1)

const ago = (minutes: number) => Date.now() - minutes * 60_000

const FAIR_PLAY: Record<FakeScenario, () => FairPlayView> = {
  fine: () => ({ score: ARENA_RANKED.fairPlay.max, penalties: [] }),
  full: () => ({ score: ARENA_RANKED.fairPlay.max, penalties: [] }),
  left: () => ({ score: 85, penalties: [{ conduct: 'left', change: ARENA_RANKED.fairPlay.left, at: ago(18) }] }),
  low: () => ({
    score: 52,
    penalties: [
      { conduct: 'left', change: ARENA_RANKED.fairPlay.left, at: ago(9) },
      { conduct: 'afk', change: ARENA_RANKED.fairPlay.afk, at: ago(64) },
      { conduct: 'left', change: ARENA_RANKED.fairPlay.left, at: ago(190) },
    ],
  }),
}

const PROTECTION: Record<FakeScenario, number> = { fine: 64, full: ARENA_RANKED.protection.max, left: 40, low: 12 }

export const fakeProfile = (scenario: FakeScenario = 'fine'): ArenaProfile => {
  const rp = 372
  return {
    season: season(),
    rating: { mmr: 1184, rp, peak: 410, games: 41, protection: PROTECTION[scenario] },
    tier: tierOf(rp),
    place: 37,
    totals: { matches: 41, wins: 24, losses: 15, draws: 2, kos: 133, scored: 1890 },
    favorites: [
      { starter: 'charmander', matches: 19, wins: 12 },
      { starter: 'froakie', matches: 13, wins: 8 },
      { starter: 'bulbasaur', matches: 9, wins: 4 },
    ],
    fairPlay: FAIR_PLAY[scenario](),
    preseason: seasonAt(Date.now()) === null ? 12 : 0,
  }
}

const KINDS: readonly MatchKind[] = ['ranked', 'ranked', 'casual', 'ranked', 'practice', 'room', 'ranked', 'ranked', 'casual', 'practice', 'ranked', 'ranked']
const STARTERS: readonly VersusPick[] = ['charmander', 'froakie', 'charmander', 'bulbasaur', 'piplup', 'charmander', 'froakie', 'treecko', 'charmander', 'fennekin', 'froakie', 'charmander']

/** The fake history's entry whose loss the protection meter took (a ranked loss). */
const PROTECTED = 7

export const fakeHistory = (): ArenaHistoryEntry[] => {
  const now = Date.now()
  return KINDS.map((kind, i) => {
    const outcome = i % 5 === 2 ? 'loss' : i % 7 === 6 ? 'draw' : i % 3 === 1 ? 'loss' : 'win'
    const team = i % 2 === 0 ? 0 : 1
    const mine = outcome === 'win' ? 140 + i * 7 : outcome === 'draw' ? 110 : 90 + i * 3
    const theirs = outcome === 'win' ? 95 + i * 4 : outcome === 'draw' ? 110 : 150 + i * 2
    const rp = kind !== 'ranked' ? null : outcome === 'win' ? 30 + (i % 4) * 2 : outcome === 'draw' ? 7 : -20 + (i % 3) * 3
    return {
      id: `fake:${i}`,
      at: now - (i * 47 + 12) * 60_000,
      kind,
      team,
      outcome,
      score: team === 0 ? [mine, theirs] : [theirs, mine],
      starter: STARTERS[i]!,
      kos: 2 + ((i * 3) % 6),
      deaths: 1 + (i % 4),
      scored: 20 + ((i * 13) % 50),
      damage: 6000 + i * 731,
      // A ranked loss a full meter took.
      rp: i === PROTECTED ? 0 : rp,
      protected: i === PROTECTED,
    }
  })
}

const HANDLES = ['ashk', 'mistyw', 'brock', 'garyoak', 'cynthia', 'n_harmonia', 'leon', 'iris', 'steven', 'lance', 'red', 'blue', 'dawn', 'serena', 'hop', 'marnie', 'bea', 'raihan', 'nemona', 'penny']

export const fakeBoard = (): ArenaLeaderboardRow[] =>
  HANDLES.map((handle, i) => {
    const rp = Math.max(0, 1260 - i * 47 - (i * i * 3))
    const matches = 90 - i * 2
    return { place: i + 1, handle, name: handle, rp, tier: tierOf(rp), wins: Math.round(matches * (0.68 - i * 0.01)), matches, favorite: VERSUS_PICKS[(i * 5) % VERSUS_PICKS.length]! }
  })
