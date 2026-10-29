/**
 * The Arena's competitive layer (`game/arenaRank.ts`): seasons, tiers, the
 * hidden MMR and the visible ranking points (RP), and the public queue's
 * numbers. Only matchmade matches with humans count (`countsForRank`):
 * a quick match against bots on the in-page relay never touches a rating.
 * Shared by the game, the API (`server/`) and the relay's matchmaker.
 */

/** The two public queues: casual (no rating) and ranked. */
export type QueueKind = 'casual' | 'ranked'

/** Where a match came from: a public queue, a friends' room, or a quick match against bots (device only). */
export type MatchKind = QueueKind | 'room' | 'practice'

/** The ranked ladder, low to high. Master has no divisions. */
export const TIER_IDS = ['poke', 'great', 'ultra', 'master'] as const
export type TierId = (typeof TIER_IDS)[number]

export const ARENA_RANKED = {
  /**
   * Seasons last `days` Brasília days, back to back from `epoch` (season 1),
   * each starting at 00:00 in Brasília (UTC−3, no daylight saving).
   */
  season: { epoch: '2026-11-02', days: 14, utcOffsetHours: -3 },
  /** Hidden MMR (team Elo on the humans' mean): a newcomer moves fast for `settledAfter` matches. */
  mmr: { start: 1000, kNew: 48, kSettled: 24, settledAfter: 10, scale: 400, bot: 1000 },
  /**
   * Visible ranking points: a win, a loss or a draw, plus a performance bonus
   * up to `perfMax` (points scored, KOs and the objective, against the team's),
   * which also softens a loss. The whole delta scales by the share of humans
   * when bots filled seats.
   */
  rp: { win: 30, loss: -20, draw: 5, perfMax: 10 },
  /** RP per division; a tier has 3 (III, II, I) and Master starts after the last. */
  division: 100,
  /** A new season: MMR moves this share back toward `mmr.start`; RP drops to the floor one tier below where it ended. */
  softReset: 0.25,
  queue: {
    /** The MMR window a ticket matches within: `base + perSecond × waited`, at most `max`. */
    window: { base: 100, perSecond: 25, max: 600 },
    /** Seconds a ticket waits before bots fill the rest of the match. */
    botsAfter: { casual: 90, ranked: 90 },
    /**
     * A ranked match with fewer humans plays as casual, and one whose result
     * fewer clients agreed on rates only its leavers (a lone client could forge its own end).
     */
    minHumansRanked: 2,
    /**
     * What `splitTeams` charges per human one side has over the other, in
     * summed MMR, so humans spread across the teams instead of farming bots
     * together. Above half the widest window (`window.max`), so two solos
     * the queue matches always split; a lopsided split wins only against a
     * balanced one off by more than 2× this.
     */
    humanSplitPenalty: 400,
    /** Seconds the matched players have to join the room; who's missing plays as a bot. */
    joinTimeout: 20,
    /** Most humans in one match: the biggest format's room (`arenaPlayers` in `arenaFormats.ts` has each format's). */
    players: 8,
  },
} as const

/** Each tier's colors, for badges: the ball's top half and its rim. */
export const TIER_COLORS = {
  poke: { top: '#e83838', rim: '#801818' },
  great: { top: '#3878e8', rim: '#183c80' },
  ultra: { top: '#f8c830', rim: '#303030' },
  master: { top: '#8848c8', rim: '#401860' },
} as const satisfies Record<TierId, { top: string; rim: string }>
