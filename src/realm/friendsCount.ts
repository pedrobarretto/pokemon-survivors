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
