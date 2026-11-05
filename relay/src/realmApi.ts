import type { RealmIdentity } from '../../src/net/realm'
import { REALM_API_PATHS, type IdentityRequest, type IdentityResponse, type PresenceReport, type VisitRequest, type VisitResponse } from '../../src/net/realmRelay'
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
  return { userId, handle, partner, shiny, look: parseWireLook(v.look) ?? {}, supporter: supporter ?? null }
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
  return { identities, banned }
}

/** `POST /realm/visit`'s answer, or null. */
export const parseVisitResponse = (v: unknown): VisitResponse | null => {
  if (!isRecord(v)) return null
  if (v.allowed === true) return { allowed: true }
  return v.allowed === false && (v.why === 'private' || v.why === 'missing') ? { allowed: false, why: v.why } : null
}

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
export const guestIdentity = (userId: string): RealmIdentity => ({ userId, handle: userId.replace(/^guest-/, ''), partner: 'charmander', shiny: false, look: {}, supporter: null })
