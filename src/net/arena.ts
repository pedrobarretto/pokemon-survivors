/**
 * The Arena's public queue and match reports on the wire, shared by the game,
 * the relay's matchmaker (`relay/`) and the API (`server/`). Like
 * `protocol.ts`, this file imports nothing: the relay bundles it alone.
 *
 * The flow: a signed-in client opens a WebSocket to the matchmaker
 * (`/arena/queue` on the relay) and sends `queue`; the matchmaker (one
 * Durable Object, on Cloudflare) groups tickets by MMR (the API's,
 * `POST /arena/tickets`) and wait, splits teams (`splitTeams` in
 * `net/arenaQueue.ts`), makes a locked Arena room
 * on the relay with every seat's team set, and sends each ticket `matched`.
 * Bots fill what's missing after `botsAfter`. When the match ends, the room
 * counts its clients' `ArenaResult`s (opaque to it) and posts the agreed one
 * to the API as an `ArenaReport`, signed with a secret both share; a match
 * every human left goes as an abandoned one when its room closes.
 *
 * Fair Play rides on the same calls: the API answers each ticket's score
 * with its rating, and the matchmaker refuses a Ranqueada below its minimum
 * (`refused` `fairPlay`) and holds a low score's ticket (`queued`'s `hold`)
 * by the rules in `net/arenaQueue.ts`. The client is never asked.
 */

/** Bumped with any incompatible change to these messages. */
export const ARENA_PROTOCOL = 1

/**
 * Who queues: a Clerk session token, or a guest id where the relay seats guests (dev only). The same
 * shape as the rooms' `Auth` (`protocol.ts`), spelled out since this file imports nothing.
 */
export type QueueAuth = { kind: 'clerk'; token: string } | { kind: 'guest'; id: string }

/**
 * What a client in the queue sends. `party`: the code of the friends' party it queues with (all of it
 * joins the same team). `build`: the co-op build id (`__SIM_BUILD__`), the matched room's.
 */
export type QueueClientMessage =
  | { t: 'queue'; kind: 'casual' | 'ranked'; starter: string; party: string | null; build: string; auth: QueueAuth }
  | { t: 'cancel' }
  /** The client's round trip to each relay home, so the match lands where it plays best. */
  | { t: 'rtt'; homes: Record<string, number> }

/** What the matchmaker sends a queued client. */
export type QueueServerMessage =
  /**
   * In the queue: how long it has waited, how many humans the forming match has, and the seconds until bots fill it.
   * `hold`: seconds Fair Play still keeps the ticket out of any match (`queueHold`; absent or 0: none).
   */
  | { t: 'queued'; kind: 'casual' | 'ranked'; waited: number; found: number; botsIn: number; hold?: number }
  /** A match: the room to join, the seat's team and whether it's rated. Join within `joinTimeout`. */
  | { t: 'matched'; room: string; team: 0 | 1; ranked: boolean; humans: number }
  /**
   * Refused: not signed in, already queued in another tab, an old build, the queue is closed, or a Fair Play
   * under the Ranqueada's minimum (`fairPlay`: the score then).
   */
  | { t: 'refused'; why: 'auth' | 'duplicate' | 'build' | 'closed' }
  | { t: 'refused'; why: 'fairPlay'; fairPlay: number }

/** The room settings a matchmade Arena room carries (the relay's room sets them with its lock; `coop/start.ts` reads them). */
export type MatchedSettings = { difficulty: 'normal'; mode: 'versus'; queue: 'casual' | 'ranked'; locked: true }

/**
 * `POST /arena/report` (relay → API), with header `x-arena-signature`: hex
 * HMAC-SHA256 of the raw body with `ARENA_REPORT_SECRET`. `result` is the
 * clients' agreed `ArenaResult` as they sent it (the API parses it with
 * `parseArenaResult`); `seats` maps each slot to its account (null for a bot
 * seat; a human who left keeps theirs and `left: true`). `confirmed`: whether
 * at least `minHumansRanked` clients agreed on the result. A ranked match its
 * humans left until one was alone is still reported as ranked, unconfirmed:
 * the API then rates only the leavers (as a loss), since who left is the
 * relay's word and the lone client's result isn't. Absent reads as true.
 * `abandoned`: every human left before the end (the room closed with the
 * match unfinished): `result` is null, every account's seat `left`, and the
 * API only takes Fair Play from them.
 */
export type ArenaReport = {
  v: 1
  room: string
  run: number
  kind: 'casual' | 'ranked' | 'room'
  region: string
  endedAt: number
  seats: { slot: number; userId: string | null; handle: string | null; left: boolean }[]
  result: unknown
  confirmed?: boolean
  abandoned?: true
}

/** What `POST /arena/report` answers: the stored match, whether it moved ratings, and whether it was already in (a retry). */
export type ArenaReportResponse = { match: string; rated: boolean; duplicate: boolean }

/** `POST /arena/tickets` (relay → API), signed like `ArenaReport`: the players a matchmaker is about to match. */
export type ArenaTicketsRequest = { userIds: string[] }

/** One player's numbers in the current season, as the matchmaker matches on them (a fresh rating for a newcomer), and their Fair Play (full without one). */
export type ArenaTicketRating = { mmr: number; rp: number; games: number; fairPlay: number }

/** What `POST /arena/tickets` answers: the season it read (the first one before it starts) and each asked player's rating, by user id. */
export type ArenaTicketsResponse = { season: number; ratings: Record<string, ArenaTicketRating> }
