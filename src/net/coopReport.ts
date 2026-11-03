/**
 * A finished co-op run on the wire from the relay to the API, for the co-op
 * boards (`game/coopBoard.ts`). Like `arena.ts`, this file imports nothing:
 * the relay bundles it alone.
 *
 * When a run-mode room's run ends, the relay counts its clients' results
 * (`CoopResult` as JSON, opaque to it) and posts the one more than half of
 * the end's voters sent to the API as a `CoopReport`, signed like the Arena's
 * (`x-arena-signature`, HMAC-SHA256 of the raw body with the same shared
 * secret) and through the same outbox. A run its players left before the end
 * is never reported.
 */

/** Where the relay posts it. */
export const COOP_REPORT_PATH = '/coop/report' as const

/**
 * `POST /coop/report` (relay → API). `seats` maps each slot that started the
 * run to its account (`userId`, the Clerk subject; null for a guest seat,
 * which only the dev relay seats) and its @handle, `left` when it left
 * before the end. `result`: the agreed `CoopResult` as the clients built it
 * (the API parses it with `parseCoopResult`). `votes`: how many clients sent
 * it. Once per (room, run, endedAt): a retry gets `duplicate`.
 */
export type CoopReport = {
  v: 1
  room: string
  run: number
  region: string
  endedAt: number
  seats: { slot: number; userId: string | null; handle: string | null; left: boolean }[]
  result: unknown
  votes: number
}

/**
 * What `POST /coop/report` answers: the stored run's id (null when it isn't
 * listed: a guest seat, a single player, a result that doesn't parse, a
 * challenge out of its day), and whether it was already in.
 */
export type CoopReportResponse = { run: string | null; duplicate: boolean }
