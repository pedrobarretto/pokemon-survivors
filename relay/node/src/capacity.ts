/**
 * When a VPS relay takes no new room. A VPS relay is one Node process on a
 * shared machine: it must never cap the game, so past its capacity (or while
 * the machine starves it) `POST /rooms` answers `full` and `/health` says so,
 * and the game creates on Cloudflare, which scales on its own. Rooms already
 * here (joins, resumes, moves into one) are never refused for it.
 */

/**
 * Rooms a relay takes by default (`MAX_ROOMS` overrides it). A running
 * 2-player room costs ~1.1% of a core (a 4-player one ~1.5%), and the whole
 * relay is one event loop: one core at most, on a VPS it shares with the API.
 * 40 rooms keep it near half a core, where the 60 Hz frame timers stay
 * punctual (event-loop p99 ~7 ms); the starvation guard below covers a
 * machine busy with something else.
 */
export const DEFAULT_MAX_ROOMS = 40

/**
 * The starvation guard, read over the last minute (`relay.stats`'s window, so
 * it changes at most once a minute and doesn't flap). A healthy relay's
 * event-loop p99 is ~7 ms; on 2026-10-22 the São Paulo VPS starved it to
 * ~75 ms with no room at all, and rooms played with ~500 stalls a minute.
 * The whole machine's CPU busy past 90% is the same story coming.
 */
export const STARVING = { loopP99Ms: 30, hostBusyPct: 90 } as const

/** The relay's recent load (the last full minute), null before the first one or where it can't be read. */
export type Load = { loopP99Ms: number | null; hostBusyPct: number | null }

/** Why a relay is full: its rooms, its event loop's lag or the machine's CPU. */
export type FullWhy = 'rooms' | 'loop' | 'host'

/** Why the relay takes no new room now, or null when it takes one. `rooms`: the rooms it holds (`counts().live`). */
export const fullWhy = (rooms: number, maxRooms: number, load: Load): FullWhy | null => {
  if (rooms >= maxRooms) return 'rooms'
  if (load.loopP99Ms !== null && load.loopP99Ms > STARVING.loopP99Ms) return 'loop'
  if (load.hostBusyPct !== null && load.hostBusyPct > STARVING.hostBusyPct) return 'host'
  return null
}
