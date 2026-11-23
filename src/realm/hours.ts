import { hourAt, nextHour, REALM_EVENTS, REALM_HOUR_MS, type RealmEventKind, type RealmHour } from '../data/realmEvents'

/**
 * What the screens read of the Hora do Realm (`data/realmEvents.ts`, the
 * clock everyone shares): the hour running now and the notice to show. A dev
 * override (`ps.realm('hour', 'tide')`) changes this screen and nothing else:
 * the relay and the API keep to the real clock.
 */

/** How long before an hour the city and the lobby start counting down to it. */
export const HOUR_WARN_MS = 30 * 60_000

/** Whether `v` names a kind of hour. */
export const isHourKind = (v: string): v is RealmEventKind => Object.hasOwn(REALM_EVENTS, v)

let forced: RealmHour | null = null

/** Dev: runs `kind` on this screen, starting `inMs` from now; null goes back to the clock. */
export const forceHour = (kind: RealmEventKind | null, inMs = 0) => {
  const start = Date.now() + inMs
  forced = kind ? { kind, start, end: start + REALM_HOUR_MS } : null
}

/** The hour running at `now`, as this screen sees it. */
export const runningHour = (now: number): RealmHour | null => (forced ? (now >= forced.start && now < forced.end ? forced : null) : hourAt(now))

/** What to tell the player: `hour`, whether it's on, and the ms left until it starts (or, on, until it ends). */
export type HourNotice = { hour: RealmHour; on: boolean; left: number }

/** The notice for `hour` at `now`: while it runs and in the `HOUR_WARN_MS` before it, else null. */
export const noticeOf = (hour: RealmHour, now: number): HourNotice | null => {
  if (now >= hour.end) return null
  if (now >= hour.start) return { hour, on: true, left: hour.end - now }
  return hour.start - now <= HOUR_WARN_MS ? { hour, on: false, left: hour.start - now } : null
}

/** The notice to show at `now`, as this screen sees the hours. */
export const hourNotice = (now: number): HourNotice | null => noticeOf(forced ?? nextHour(now), now)

/** `ms` as a countdown, `mm:ss`, rounded up so it reads 00:01 until the very end. */
export const clockOf = (ms: number) => {
  const secs = Math.max(0, Math.ceil(ms / 1000))
  return `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`
}
