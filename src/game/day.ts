/**
 * The day everyone shares: the Surto do dia, the Kecleon Shop's Vitrine do dia
 * and the ranking's boards all turn over at midnight in Brasília, so the
 * server can check a run against the day it started. (Missions keep the
 * player's local day.) Pure; shared with the API.
 */
import * as dm from '../engine/dmath'

export const DAY_TIME_ZONE = 'America/Sao_Paulo'

/** A day as `YYYY-MM-DD`. */
export type DayKey = string

const DAY_FORMAT = new Intl.DateTimeFormat('en-CA', { timeZone: DAY_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })

/** The wall clock in Brasília at `d`, as numbers. */
const clockAt = (d: Date) => {
  const parts = Object.fromEntries(DAY_FORMAT.formatToParts(d).map((p) => [p.type, p.value]))
  return { day: `${parts.year}-${parts.month}-${parts.day}`, seconds: Number(parts.hour) * 3600 + Number(parts.minute) * 60 + Number(parts.second) }
}

/** The Brasília day holding `d`, `YYYY-MM-DD`. */
export const brasiliaDay = (d: Date): DayKey => clockAt(d).day

/** Whether `v` is a real calendar day as `YYYY-MM-DD` (from an untrusted body). */
export const isDayKey = (v: unknown): v is DayKey => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [y, m, d] = v.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d!)).toISOString().slice(0, 10) === v
}

/** Days since 1970-01-01 of a `YYYY-MM-DD` key, for draws that walk through the days. */
export const dayNumber = (day: DayKey) => {
  const [y, m, d] = day.split('-').map(Number)
  return dm.round(Date.UTC(y!, m! - 1, d!) / 86_400_000)
}

/** The day before `day` (calendar arithmetic, no time zone involved). */
export const previousDay = (day: DayKey): DayKey => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! - 1)).toISOString().slice(0, 10)
}

/** The day `n` days after `day` (before it for a negative `n`; calendar arithmetic, no time zone involved). */
export const addDays = (day: DayKey, n: number): DayKey => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10)
}

/** Milliseconds from `d` to the next midnight in Brasília (when the day's outbreak and Vitrine turn over). */
export const msToNextDay = (d: Date) => (86_400 - clockAt(d).seconds) * 1000 - d.getMilliseconds()

/** Milliseconds since the last midnight in Brasília. */
export const msSinceDayStart = (d: Date) => 86_400_000 - msToNextDay(d)
