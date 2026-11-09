/**
 * The Hora do Realm: three short windows a day when something happens in one
 * room, so the few trainers online end up in the same place at the same time.
 * A pure function of the clock, the same on the relay, the API and the game,
 * so there's nothing to schedule or store. Import-free, like `net/realm.ts`:
 * the relay reads it to know who was in the right room.
 *
 * Hours are UTC, picked for evenings where the players are: 12:00 is 20:00 in
 * Taiwan and Hong Kong, 20:00 is 21:00 in Central Europe, 00:00 is 21:00 in
 * Brasília and 19:00 on the US East Coast. Names live in i18n `realm.hours`.
 */

/** What a kind of hour is: the room it happens in and the mini games it pays double (`payMult`, before the daily caps). */
export type RealmEventDef = { room: 'pier' | 'arcade' | 'cafe'; games: readonly string[]; payMult: number }

export const REALM_EVENTS = {
  tide: { room: 'pier', games: ['fishing'], payMult: 2 },
  storm: { room: 'arcade', games: ['berryCatch', 'whackDiglett'], payMult: 2 },
  tables: { room: 'cafe', games: ['fourInRow', 'typeDuel'], payMult: 2 },
} as const satisfies Record<string, RealmEventDef>

export type RealmEventKind = keyof typeof REALM_EVENTS

const KINDS = Object.keys(REALM_EVENTS) as RealmEventKind[]

const DAY_MS = 86_400_000
const HOUR_MS = 3_600_000

/** The day's windows, as UTC hours, in order. */
export const REALM_HOURS = [0, 12, 20] as const

/** How long a window lasts. */
export const REALM_HOUR_MS = 15 * 60_000

/** One window of one day: its kind, when it starts and ends (ms since the epoch). */
export type RealmHour = { kind: RealmEventKind; start: number; end: number }

/** The window `index` of the UTC day `day`; the kinds rotate, so each hour of the day changes kind from one day to the next. */
const windowOf = (day: number, index: number): RealmHour => {
  const start = day * DAY_MS + REALM_HOURS[index]! * HOUR_MS
  return { kind: KINDS[(day + index) % KINDS.length]!, start, end: start + REALM_HOUR_MS }
}

/** The window running at `now`, or null. */
export const hourAt = (now: number): RealmHour | null => {
  const day = Math.floor(now / DAY_MS)
  return REALM_HOURS.map((_, i) => windowOf(day, i)).find((w) => now >= w.start && now < w.end) ?? null
}

/** The window running at `now`, or else the next one to start. */
export const nextHour = (now: number): RealmHour => {
  const day = Math.floor(now / DAY_MS)
  return [...REALM_HOURS.map((_, i) => windowOf(day, i)), windowOf(day + 1, 0)].find((w) => now < w.end)!
}

/** What `game` pays times at `now`: the running hour's `payMult` if it's one of its games, else 1. */
export const hourPay = (game: string, now: number): number => {
  const hour = hourAt(now)
  if (!hour) return 1
  const def: RealmEventDef = REALM_EVENTS[hour.kind]
  return def.games.includes(game) ? def.payMult : 1
}
