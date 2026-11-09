import { apiCall } from '../api'
import { isRecord } from '../game/parse'

/**
 * How many of the players followed walk the Poké Realm now (seen, or hiding
 * where), for the lobby's way in: `GET /realm/friends` read without the
 * realm's chunk (`fetchFriends` in `realm/api.ts` reads it all). Null offline.
 */
export const realmFriendsCount = async (): Promise<number | null> => {
  const { status, body } = await apiCall('/realm/friends', { auth: true })
  if (status !== 200 || !isRecord(body) || !Array.isArray(body.friends)) return null
  return body.friends.filter((f) => isRecord(f) && (f.state === 'realm' || f.state === 'hidden')).length
}

/**
 * Trainers in the whole Realm now, for the lobby's way in: `GET /realm/cities`
 * (public, cached by the API) read without the realm's chunk. Null offline.
 */
export const realmTrainersCount = async (): Promise<number | null> => {
  const { status, body } = await apiCall('/realm/cities')
  if (status !== 200 || !isRecord(body) || !isRecord(body.cities)) return null
  return Object.values(body.cities).reduce<number>((sum, n) => sum + (typeof n === 'number' ? n : 0), 0)
}
