import type { CityId, RealmHome, RealmIdentity, RoomKey } from './realm'

/**
 * What the realm relay asks the API (relay → API, signed like the Arena's
 * reports and `POST /looks`, `relay/src/report.ts`). Import-free but for the
 * realm's own wire types, so the relay bundles it alone.
 */

/** `POST /realm/identity`: who these accounts are (asked at each `hello`, in batches when several arrive together). */
export type IdentityRequest = { userIds: string[] }

/**
 * Each asked account that may walk the realm, by user id. An account without
 * a @handle, or banned from the realm, is left out (the relay refuses it:
 * `profile`, `banned`; `banned` lists those). `friends`: each account's mutual
 * friends' handles (lower case), the ones it may invite to its base (an API
 * from before it: nobody).
 */
export type IdentityResponse = { identities: Record<string, RealmIdentity>; banned: string[]; friends?: Record<string, string[]> }

/** `POST /realm/visit`: may `visitor` (its user id; a handle works too) come into `owner`'s base (a handle)? The API counts the visit when it's someone else's, once a Brasília day. */
export type VisitRequest = { visitor: string; owner: string; city: CityId }

/** `missing`: no such handle (or it has no base yet). */
export type VisitResponse = { allowed: true } | { allowed: false; why: 'private' | 'missing' }

/**
 * `POST /realm/presence`: who is in each city of a relay right now, every
 * `PRESENCE_EVERY_MS` (and once a city empties). The API keeps the newest
 * report per relay for the city picker's counts and the friends list
 * (`GET /realm/cities`, `GET /realm/friends`); a relay silent for
 * `PRESENCE_STALE_MS` counts as empty. `rooms[city][i]`: the room of
 * `cities[city][i]` (a relay from before it sends none).
 */
export type PresenceReport = { home: RealmHome; at: number; cities: Partial<Record<CityId, string[]>>; rooms?: Partial<Record<CityId, RoomKey[]>> }

export const PRESENCE_EVERY_MS = 15_000

export const PRESENCE_STALE_MS = 60_000

/**
 * `POST /realm/deeds`: what the relay saw trainers do since its last report
 * (`data/realmStamps.ts`; deeds are strings here, this file imports only the
 * wire types), batched every `DEEDS_EVERY_MS`. Each entry is one more of that
 * deed for that account; the API drops ones it doesn't know.
 */
export type DeedsReport = { deeds: readonly { userId: string; deed: string }[] }

/** What those deeds earned, by user id: new stamps (the relay tells the room) and errands now finished (it tells the trainer). */
export type DeedsAnswer = { stamps: Record<string, string[]>; errands: Record<string, string[]> }

export const DEEDS_EVERY_MS = 3_000

/** The relay paths on the API. */
export const REALM_API_PATHS = { identity: '/realm/identity', visit: '/realm/visit', presence: '/realm/presence', deeds: '/realm/deeds' } as const
