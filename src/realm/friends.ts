import { isTownRoomId, roomCap } from '../data/realmMap'
import { presenceOnline, type Activity } from '../game/friends'
import { BASE_PREFIX, CITY_IDS, REALM, type CityId, type RoomKey } from '../net/realm'
import type { FriendState, RealmFriend } from '../net/realmApi'
import { PRESENCE_STALE_MS, type PresenceReport } from '../net/realmRelay'

/**
 * "Amigos no Realm": who of the players someone follows walks the realm, and
 * where, as far as each lets them see. Pure, shared by the API
 * (`GET /realm/friends`) and the faked API (`realm/api.ts`).
 *
 * Who sees whom:
 * - Only mutual follows (friends, `game/friends.ts`) see anything. Following
 *   needs nobody's consent, so a one-way follow (`pending`) shows nothing,
 *   not even whether they're online.
 * - "Aparecer offline" (`appearOffline`, the game's presence setting) reads
 *   offline here too.
 * - "Mostrar onde estou para amigos" (`showWhere`, the realm's setting) is on
 *   by default: friends already see each other's activity and co-op room in
 *   the lobby, and anyone in a room sees who's in it, so where a friend walks
 *   reveals no more to someone they chose. Off, friends see `hidden` (in the
 *   Realm, nowhere in particular) and can still invite them; nobody can walk
 *   to them.
 */

/** A relay's presence report as the API keeps it: when it arrived (the API's clock, so a relay's drift doesn't matter). */
export type HeldPresence = { report: PresenceReport; at: number }

/** Where a trainer walks: the city and the room (null from a relay that doesn't say). */
export type Walking = { city: CityId; room: RoomKey | null }

const live = (held: Iterable<HeldPresence>, now: number) => [...held].filter((h) => now - h.at < PRESENCE_STALE_MS)

/** A room key from a presence report: a town room or `base:<handle>` (lower case), else null. */
export const parseReportRoom = (v: unknown): RoomKey | null =>
  typeof v === 'string' && (isTownRoomId(v) || (v.startsWith(BASE_PREFIX) && /^[a-z0-9_]{1,32}$/.test(v.slice(BASE_PREFIX.length)))) ? v : null

/** Where every trainer of the live reports walks, by handle (lower case). */
export const walking = (held: Iterable<HeldPresence>, now: number): Map<string, Walking> => {
  const where = new Map<string, Walking>()
  for (const { report } of live(held, now))
    for (const city of CITY_IDS) {
      const rooms = report.rooms?.[city]
      report.cities[city]?.forEach((h, i) => where.set(h.toLowerCase(), { city, room: rooms?.[i] ?? null }))
    }
  return where
}

/** Trainers in each city now (a silent relay's count as empty). */
export const cityCounts = (held: Iterable<HeldPresence>, now: number): Partial<Record<CityId, number>> => {
  const counts: Partial<Record<CityId, number>> = {}
  for (const { report } of live(held, now)) for (const city of CITY_IDS) if (report.cities[city]) counts[city] = (counts[city] ?? 0) + report.cities[city].length
  return counts
}

/** The key `roomCounts` keeps a city's room under. */
export const roomKeyOf = (city: CityId, room: RoomKey) => `${city} ${room}`

/** Trainers in each room of each city now (`roomKeyOf`). */
export const roomCounts = (where: ReadonlyMap<string, Walking>): Map<string, number> => {
  const counts = new Map<string, number>()
  for (const { city, room } of where.values()) if (room) counts.set(roomKeyOf(city, room), (counts.get(roomKeyOf(city, room)) ?? 0) + 1)
  return counts
}

/** Whether `room` of `city` can take one more: `city` when the city is at its cap, `room` when the room is (`roomCap`), else null. */
export const fullness = (city: CityId, room: RoomKey | null, cities: Partial<Record<CityId, number>>, rooms: ReadonlyMap<string, number>): 'city' | 'room' | null => {
  if ((cities[city] ?? 0) >= REALM.cityCap) return 'city'
  const cap = room ? roomCap(room) : null
  return room && cap !== null && (rooms.get(roomKeyOf(city, room)) ?? 0) >= cap ? 'room' : null
}

/** What the API knows of a followed player, before the privacy rules. `ago`: how old their last game heartbeat is (ms), null without one. */
export type Followed = {
  handle: string
  name: string
  followsBack: boolean
  appearOffline: boolean
  showWhere: boolean
  walking: Walking | null
  activity: Activity | null
  ago: number | null
}

/** A followed player as the asker may see them (see the rules up top). `full`: the city or room they walk is at its cap. */
export const friendWhere = (f: Followed, full: 'city' | 'room' | null = null): RealmFriend => {
  const who = { handle: f.handle, name: f.name }
  if (!f.followsBack) return { ...who, state: 'pending' }
  if (f.appearOffline) return { ...who, state: 'offline' }
  if (f.walking) return f.showWhere ? { ...who, state: 'realm', city: f.walking.city, room: f.walking.room, full } : { ...who, state: 'hidden' }
  if (f.activity !== null && f.ago !== null && presenceOnline(f.activity, f.ago)) return { ...who, state: 'game', activity: f.activity }
  return { ...who, state: 'offline' }
}

/** The order the panel lists: mutual friends first, those walking the realm on top, the pending follows last. */
export const STATE_ORDER: readonly FriendState[] = ['realm', 'hidden', 'game', 'offline', 'pending']

export const sortFriends = (friends: readonly RealmFriend[]): RealmFriend[] =>
  [...friends].sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state) || a.handle.localeCompare(b.handle))

/** Each followed player as the asker may see them, in the panel's order, from the live presence. */
export const friendsFrom = (followed: readonly Omit<Followed, 'walking'>[], held: Iterable<HeldPresence>, now: number): RealmFriend[] => {
  const reports = [...held]
  const where = walking(reports, now)
  const cities = cityCounts(reports, now)
  const rooms = roomCounts(where)
  return sortFriends(
    followed.map((f) => {
      const w = where.get(f.handle.toLowerCase()) ?? null
      return friendWhere({ ...f, walking: w }, w ? fullness(w.city, w.room, cities, rooms) : null)
    }),
  )
}
