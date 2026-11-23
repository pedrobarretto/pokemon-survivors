import { CITY_IDS, REALM, type CityId } from '../net/realm'

/** Trainers in the Realm the lobby needs to see before it says how many (under this, a count reads as empty). */
export const REALM_CROWD = 3

/**
 * Where the way in lands: the first city in order with room and not refused
 * yet, so trainers gather instead of spreading out. Without counts (the API
 * didn't answer) every city looks free and the order alone decides. Null: none left.
 */
export const firstOpenCity = (counts: Partial<Record<CityId, number>> | null, tried: ReadonlySet<CityId> = new Set()): CityId | null =>
  CITY_IDS.find((id) => !tried.has(id) && (counts?.[id] ?? 0) < REALM.cityCap) ?? null
