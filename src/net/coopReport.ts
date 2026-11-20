import { TICK_HZ } from './protocol'

/**
 * A finished co-op run on the wire from the relay to the API, for the co-op
 * boards (`game/coopBoard.ts`). Like `arena.ts`, this file imports nothing
 * but `protocol.ts`: the relay bundles it alone.
 *
 * When a run-mode room's run ends, the relay counts its clients' results
 * (`CoopResult` as JSON, opaque to it) and posts the one more than half of
 * the end's voters sent to the API as a `CoopReport`, signed like the Arena's
 * (`x-arena-signature`, HMAC-SHA256 of the raw body with the same shared
 * secret) and through the same outbox. A run its players left before the end
 * is never reported, nor one whose result claims more time than the relay
 * played it (`relayedTimeFits`): agreeing clients can be one person's.
 */

/** Where the relay posts it. */
export const COOP_REPORT_PATH = '/coop/report' as const

/**
 * `POST /coop/report` (relay → API). `seats` maps each slot that started the
 * run to its account (`userId`, the Clerk subject; null for a guest seat,
 * which only the dev relay seats) and its @handle, `left` when it left
 * before the end. `result`: the agreed `CoopResult` as the clients built it
 * (the API parses it with `parseCoopResult`). `votes`: how many clients sent
 * it. `startedAt`: the wall clock (ms) when its tick 0 fell due; `ticks`:
 * how many ticks the relay sent it (relays before them leave both out, and a
 * run saved before `startedAt` leaves it out). Once per (room, run,
 * endedAt): a retry gets `duplicate`.
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
  startedAt?: number
  ticks?: number
}

/** Seconds a result's `time` may run past what its relay saw. */
export const RELAYED_SLACK = {
  /** Past the ticks it sent: a client's clock moves one tick's time a tick at most (and stands still in rifts and picks), so only float drift. */
  ticks: 2,
  /** Past the wall clock since tick 0: a restarted relay resumes up to 3 s past what went out (`BOUND_AHEAD`), once per restart. */
  wall: 60,
} as const

/**
 * Whether a run's `time` (seconds, the result's) fits what its relay saw: no
 * more than the ticks it sent and the wall clock from its tick 0 to its end,
 * give or take `RELAYED_SLACK`. What `seen` leaves out isn't checked. The
 * relay checks it before reporting, the API again on the report.
 */
export const relayedTimeFits = (time: number, seen: Pick<CoopReport, 'endedAt' | 'startedAt' | 'ticks'>) =>
  Number.isFinite(time) &&
  (seen.ticks === undefined || time <= seen.ticks / TICK_HZ + RELAYED_SLACK.ticks) &&
  (seen.startedAt === undefined || time <= (seen.endedAt - seen.startedAt) / 1000 + RELAYED_SLACK.wall)

/**
 * What `POST /coop/report` answers: the stored run's id (null when it isn't
 * listed: a guest seat, a single player, a result that doesn't parse, a
 * challenge out of its day), and whether it was already in.
 */
export type CoopReportResponse = { run: string | null; duplicate: boolean }
