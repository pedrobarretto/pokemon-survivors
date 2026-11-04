import type { CityId, RealmHome, RealmIdentity } from './realm'

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
 * `profile`, `banned`; `banned` lists those).
 */
export type IdentityResponse = { identities: Record<string, RealmIdentity>; banned: string[] }

/** `POST /realm/visit`: may `visitor` come into `owner`'s base (a handle)? The API counts the visit when it's someone else's. */
export type VisitRequest = { visitor: string; owner: string; city: CityId }

/** `missing`: no such handle (or it has no base yet). */
export type VisitResponse = { allowed: true } | { allowed: false; why: 'private' | 'missing' }

/**
 * `POST /realm/presence`: who is in each city of a relay right now, every
 * `PRESENCE_EVERY_MS` (and once a city empties). The API keeps the newest
 * report per relay for the city picker's counts and the friends list
 * (`GET /realm/cities`, `GET /realm/friends`); a relay silent for
 * `PRESENCE_STALE_MS` counts as empty.
 */
export type PresenceReport = { home: RealmHome; at: number; cities: Partial<Record<CityId, string[]>> }

export const PRESENCE_EVERY_MS = 15_000

export const PRESENCE_STALE_MS = 60_000

/** The relay paths on the API. */
export const REALM_API_PATHS = { identity: '/realm/identity', visit: '/realm/visit', presence: '/realm/presence' } as const
