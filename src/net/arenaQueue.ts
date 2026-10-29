import { ARENA_RANKED, type MatchKind, type QueueKind } from '../data/arenaRanked'
import { ARENA_FORMATS, type ArenaFormat } from '../data/arenaFormats'

/**
 * The public queue's pure rules (the numbers are `ARENA_RANKED.queue`): the
 * MMR window a ticket matches within, how a match's humans split into teams
 * and when bots fill it. Here rather than in `game/arenaRank.ts` (which
 * re-exports them) because the relay's matchmaker runs them: like the rest
 * of `src/net`, this imports no game code, only the import-free data files.
 */

/** 0: Blue, 1: Red (`Team` in `data/versus.ts`). */
type Side = 0 | 1

/** The MMR window a ticket that waited `seconds` matches within. */
export const mmrWindow = (seconds: number) => {
  const w = ARENA_RANKED.queue.window
  return Math.min(w.max, w.base + w.perSecond * Math.max(0, seconds))
}

/** A party in the queue: its players' MMRs (1 to 4), kept on one team. */
export type QueueGroup = { id: string; mmrs: readonly number[] }

/**
 * A split of groups into Blue and Red: each group's team, by the input order,
 * the gap between the teams' summed MMR, and the score it was picked by (the
 * gap plus the extra humans' penalty).
 */
export type TeamSplit = { teams: Side[]; gap: number; score: number }

/**
 * Splits humans (in parties) into two teams of at most `half` each (the
 * format's team size; the standard's by default), never separating a party, minimizing the difference between the
 * teams' summed MMR (bots fill the short side later, at `mmr.bot`) plus
 * `humanSplitPenalty` per human one side has over the other, so humans don't
 * land together against bots. Brute force over the groups' assignments
 * (2^groups, at most 256). Null when no split fits.
 */
export const splitTeams = (groups: readonly QueueGroup[], half: number = ARENA_RANKED.queue.players / 2): TeamSplit | null => {
  const n = groups.length
  let best: TeamSplit | null = null
  // Group 0 always plays Blue: a split and its mirror are the same match.
  for (let mask = 0; mask < 1 << Math.max(0, n - 1); mask++) {
    const teams = groups.map((_, i): Side => (i > 0 && (mask >> (i - 1)) & 1 ? 1 : 0))
    const side = (t: Side) => groups.reduce((acc, g, i) => (teams[i] === t ? { size: acc.size + g.mmrs.length, sum: acc.sum + g.mmrs.reduce((a, b) => a + b, 0) } : acc), { size: 0, sum: 0 })
    const blue = side(0)
    const red = side(1)
    if (blue.size > half || red.size > half) continue
    // The short side gets bots at their MMR.
    const gap = Math.abs(blue.sum + (half - blue.size) * ARENA_RANKED.mmr.bot - (red.sum + (half - red.size) * ARENA_RANKED.mmr.bot))
    const score = gap + ARENA_RANKED.queue.humanSplitPenalty * Math.abs(blue.size - red.size)
    if (!best || score < best.score) best = { teams, gap, score }
  }
  return best
}

/** Whether a finished match moves ratings: a ranked queue's, in a ranked format, with enough humans. */
export const countsForRank = (kind: MatchKind, humans: number, format: ArenaFormat = 'standard') =>
  kind === 'ranked' && ARENA_FORMATS[format].ranked && humans >= ARENA_RANKED.queue.minHumansRanked

/** Seconds a queue's ticket waits before bots fill its match. */
export const botsAfter = (kind: QueueKind) => ARENA_RANKED.queue.botsAfter[kind]
