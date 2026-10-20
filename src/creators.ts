import { apiCall } from './api'
import { parseLive, type CreatorId, type CreatorLive } from './data/creators'
import { isRecord } from './game/parse'

/**
 * Content creators live now (`data/creators.ts`), the game's side of the API.
 * Like `supporters.ts`, every call fails soft: offline, nobody is live.
 */

/** How long one answer is trusted: the lobby rebuilds often, and the API caches it as long. */
const FRESH_MS = 30_000

let asked: { at: number; live: Promise<CreatorLive[]> } | null = null

/** Set from the console (`ps.live`) to stage the lobby: who is live, instead of asking the API. */
let staged: CreatorId[] | null = null

/** Who is live now, newest stream first (asked at most every `FRESH_MS`). Empty offline. */
export const fetchLive = (): Promise<CreatorLive[]> => {
  if (staged) return Promise.resolve(staged.map((id) => ({ id, until: new Date(Date.now() + 3_600_000).toISOString() })))
  if (asked && performance.now() - asked.at < FRESH_MS) return asked.live
  const live = apiCall('/creators/live').then(({ status, body }) => (status === 200 && isRecord(body) ? parseLive(body.live, Date.now()) : []))
  asked = { at: performance.now(), live }
  return live
}

/** Turns a creator's live on or off (the creator themselves, or an admin). Until when it holds, null once off, `failed` when it didn't go. */
export const setLive = async (id: CreatorId, live: boolean): Promise<string | null | 'failed'> => {
  const { status, body } = await apiCall(`/creators/${id}/live`, { method: 'PUT', body: { live }, auth: true })
  if (status !== 200 || !isRecord(body)) return 'failed'
  asked = null
  return typeof body.until === 'string' ? body.until : null
}

/** Stages who is live for the lobby (dev console), or goes back to the API with null. */
export const stageLive = (ids: CreatorId[] | null) => {
  staged = ids
  asked = null
}
