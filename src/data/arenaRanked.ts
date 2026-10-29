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

/** How an account played a matchmade match out, for Fair Play: to the end, gone before it, or on but idle (`ARENA_RANKED.fairPlay`). */
export type Conduct = 'finished' | 'left' | 'afk'

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
    /**
     * Seconds a party that said its size (`QueueClientMessage.size`, a
     * rematch's team) waits for the rest of it before it matches as it
     * stands, so teammates pressing "Revanche" a few seconds apart land together.
     */
    partyGrace: 12,
    /** Most humans in one match: the biggest format's room (`arenaPlayers` in `arenaFormats.ts` has each format's). */
    players: 8,
  },
  /**
   * Fair Play (`game/arenaRank.ts`): every account's conduct score, 0 to
   * `max`, starting full. In a matchmade match (Casual or Ranqueada) with
   * another trainer in it, leaving before the end costs `left`, playing on
   * but `afkAfter` seconds in a row without acting (stick idle, or away) costs
   * `afk`, and finishing gives back `finish`. Below `rankedMin` the Ranqueada
   * refuses the ticket; below `holdBelow`, every point short holds a public
   * queue's ticket `holdPerPoint` seconds before it can be matched.
   */
  fairPlay: { max: 100, left: -15, afk: -10, finish: 2, rankedMin: 80, holdBelow: 60, holdPerPoint: 6, afkAfter: 60 },
  /**
   * Proteção (Unite's Performance Points): every rated match played to the
   * end fills the meter by `performance × fill`, up to `max`; full, the next
   * rated loss costs no RP (MMR still moves) and empties it.
   */
  protection: { max: 100, fill: 35 },
} as const

/** Each tier's colors, for badges: the ball's top half and its rim. */
export const TIER_COLORS = {
  poke: { top: '#e83838', rim: '#801818' },
  great: { top: '#3878e8', rim: '#183c80' },
  ultra: { top: '#f8c830', rim: '#303030' },
  master: { top: '#8848c8', rim: '#401860' },
} as const satisfies Record<TierId, { top: string; rim: string }>
