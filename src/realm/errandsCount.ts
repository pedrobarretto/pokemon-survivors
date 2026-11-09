import { apiCall } from '../api'
import { isRecord } from '../game/parse'

/**
 * How many of today's Recados the player hasn't collected yet, for the
 * lobby's way in: `GET /realm/book` read without the realm's chunk
 * (`fetchBook` in `realm/api.ts` reads it all). Null offline.
 */
export const realmErrandsCount = async (): Promise<number | null> => {
  const { status, body } = await apiCall('/realm/book', { auth: true })
  if (status !== 200 || !isRecord(body) || !Array.isArray(body.errands)) return null
  return body.errands.filter((e) => isRecord(e) && e.claimed !== true).length
}
