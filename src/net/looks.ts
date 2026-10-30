/**
 * The looks a room's accounts wear, as the API vouches for them (relay →
 * API, signed like the Arena's reports, `relay/src/report.ts`): every room
 * asks as its run starts, co-op and Arena alike, so a client's own claim
 * never reaches anyone else. Import-free, like `net/arena.ts`, for the relay.
 */

/** `POST /looks`: the accounts in a room about to start. */
export type LooksRequest = { userIds: string[] }

/** What `POST /looks` answers: each asked account's vouched look (slot to cosmetic id, `parseLook`; `{}` for none), by user id. */
export type LooksResponse = { looks: Record<string, Partial<Record<string, string>>> }
