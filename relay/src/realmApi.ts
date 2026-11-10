import type { RealmIdentity } from '../../src/net/realm'
import { isStampId } from '../../src/data/realmStamps'
import { REALM_API_PATHS, type DeedsAnswer, type DeedsReport, type IdentityRequest, type IdentityResponse, type PresenceReport, type VisitRequest, type VisitResponse } from '../../src/net/realmRelay'
import { parseWireLook } from '../../src/net/protocol'
import { postSigned, type ArenaApi, type Fetcher } from './report'

/**
 * What the realm (`realm.ts`) asks the API, signed like the Arena's reports
 * (`report.ts`), and the answers read defensively: anything malformed counts
 * as no answer (the realm then refuses with `busy`), never as a client's word.
 */

/** An identity ask gives up after this long (the hellos waiting on it are told `busy`). */
const ASK_TIMEOUT_MS = 4000

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** One identity from the API, or null when a field is missing or the wrong type. */
export const parseIdentity = (v: unknown): RealmIdentity | null => {
  if (!isRecord(v)) return null
  const { userId, handle, partner, shiny, supporter } = v
  if (typeof userId !== 'string' || typeof handle !== 'string' || handle.length === 0 || typeof partner !== 'string' || typeof shiny !== 'boolean') return null
  if (supporter !== null && supporter !== undefined && typeof supporter !== 'string') return null
  const stamps = typeof v.stamps === 'number' && Number.isSafeInteger(v.stamps) && v.stamps >= 0 ? v.stamps : 0
  return { userId, handle, partner, shiny, look: parseWireLook(v.look) ?? {}, supporter: supporter ?? null, stamps }
}

/** `POST /realm/identity`'s answer, keeping only the asked accounts whose identity is well formed. */
export const parseIdentityResponse = (v: unknown, asked: readonly string[]): IdentityResponse | null => {
  if (!isRecord(v) || !isRecord(v.identities)) return null
  const raw = v.identities
  const identities: Record<string, RealmIdentity> = {}
  for (const id of asked) {
    const identity = parseIdentity(raw[id])
    if (identity && identity.userId === id) identities[id] = identity
  }
  const banned = Array.isArray(v.banned) ? v.banned.filter((id): id is string => typeof id === 'string' && asked.includes(id)) : []
  return { identities, banned, friends: parseFriendLists(v.friends, asked) }
}

/** Mutual friends a trainer keeps at most (the API's `FRIENDS.list`), and a handle's longest. */
const FRIEND_LISTS = { n: 200, handle: 32 } as const

/** Each asked account's mutual friends (handles, lower case), from the identity answer; none for an API from before them. */
export const parseFriendLists = (v: unknown, asked: readonly string[]): Record<string, string[]> => {
  if (!isRecord(v)) return {}
  const lists: Record<string, string[]> = {}
  for (const id of asked) {
    const list = v[id]
    if (Array.isArray(list))
      lists[id] = list
        .filter((h): h is string => typeof h === 'string' && h.length > 0 && h.length <= FRIEND_LISTS.handle)
        .slice(0, FRIEND_LISTS.n)
        .map((h) => h.toLowerCase())
  }
  return lists
}

/** `POST /realm/visit`'s answer, or null. */
export const parseVisitResponse = (v: unknown): VisitResponse | null => {
  if (!isRecord(v)) return null
  if (v.allowed === true) return { allowed: true }
  return v.allowed === false && (v.why === 'private' || v.why === 'missing') ? { allowed: false, why: v.why } : null
}

/** Lines one account's list in a deeds answer keeps at most, and an errand id's longest. */
const DEEDS_ANSWER = { n: 64, errand: 64 } as const

/** Each account's list of wanted strings, dropping what isn't one. */
const listsOf = (v: unknown, keep: (s: unknown) => s is string): Record<string, string[]> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).flatMap(([id, list]) => (Array.isArray(list) ? [[id, list.filter(keep).slice(0, DEEDS_ANSWER.n)] as const] : []))) : {}

const isErrandId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= DEEDS_ANSWER.errand

/** `POST /realm/deeds`'s answer, or null: only known stamps and sensible errand ids. */
export const parseDeedsAnswer = (v: unknown): DeedsAnswer | null => (isRecord(v) ? { stamps: listsOf(v.stamps, isStampId), errands: listsOf(v.errands, isErrandId) } : null)

const ask = async <T>(api: ArenaApi, path: string, body: unknown, parse: (v: unknown) => T | null, fetcher: Fetcher): Promise<T | null> => {
  try {
    const res = await postSigned(api, path, JSON.stringify(body), fetcher, ASK_TIMEOUT_MS)
    return res.ok ? parse(await res.json()) : null
  } catch {
    return null
  }
}

export const lookUpIdentities = (api: ArenaApi, userIds: string[], fetcher: Fetcher = fetch): Promise<IdentityResponse | null> =>
  ask(api, REALM_API_PATHS.identity, { userIds } satisfies IdentityRequest, (v) => parseIdentityResponse(v, userIds), fetcher)

export const askVisit = (api: ArenaApi, req: VisitRequest, fetcher: Fetcher = fetch): Promise<VisitResponse | null> =>
  ask(api, REALM_API_PATHS.visit, req, parseVisitResponse, fetcher)

/** Reports what trainers did; the answer, or null if it failed (the trainers walk on either way). */
export const postDeeds = (api: ArenaApi, report: DeedsReport, fetcher: Fetcher = fetch): Promise<DeedsAnswer | null> => ask(api, REALM_API_PATHS.deeds, report, parseDeedsAnswer, fetcher)

/** Posts a presence report; a failure is only logged (the next one, `PRESENCE_EVERY_MS` on, says it all again). */
export const postPresence = async (api: ArenaApi, report: PresenceReport, fetcher: Fetcher = fetch): Promise<number | null> =>
  postSigned(api, REALM_API_PATHS.presence, JSON.stringify(report), fetcher).then(
    (res) => res.status,
    () => null,
  )

/** A dev relay's guests (`ALLOW_GUESTS`): the token `guest:<id>` walks as `guest-<id>`, with no API asked. */
export const GUEST_TOKEN = /^guest:([a-z0-9_]{1,24})$/

export const guestUserId = (token: string): string | null => {
  const m = GUEST_TOKEN.exec(token)
  return m ? `guest-${m[1]}` : null
}

/** A guest's made-up identity on a dev relay: its id for a handle, a starter, bare. */
export const guestIdentity = (userId: string): RealmIdentity => ({ userId, handle: userId.replace(/^guest-/, ''), partner: 'charmander', shiny: false, look: {}, supporter: null, stamps: 0 })
