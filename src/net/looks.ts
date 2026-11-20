/**
 * The looks a room's accounts wear, and the legends they have captured, as
 * the API vouches for them (relay → API, signed like the Arena's reports,
 * `relay/src/report.ts`): every room asks as its run starts, co-op and Arena
 * alike, so a client's own claim never reaches anyone else. Import-free, like
 * `net/arena.ts`, for the relay.
 */

/** `POST /looks`: the accounts in a room about to start. */
export type LooksRequest = { userIds: string[] }

/**
 * What `POST /looks` answers: each asked account's vouched look (slot to
 * cosmetic id, and `skins`, a list of skin ids; `parseLook`; `{}` for none),
 * by user id; and `legends`, each account's captured legends from its stored
 * save (`isCaptured`), an empty list for none. An API from before it leaves
 * `legends` out: no seat then has a vouched legend.
 */
export type LooksResponse = { looks: Record<string, Partial<Record<string, string | readonly string[]>>>; legends?: Record<string, readonly string[]> }

/** At most this many legend ids in a list (well above every legend there is), each at most `LEGEND_ID_MAX` characters. */
const LEGEND_LIST_MAX = 128
const LEGEND_ID_MAX = 32

/**
 * A legend list from an untrusted body (the API's answer, or a dev guest's
 * claim), or null when it isn't one: an array of short non-empty strings.
 * The ids stay opaque here; the game's `parseLoadout` only lets a seat play a
 * legend it knows and finds in its list.
 */
export const parseLegendList = (v: unknown): string[] | null =>
  Array.isArray(v) && v.length <= LEGEND_LIST_MAX && v.every((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= LEGEND_ID_MAX) ? [...v] : null
