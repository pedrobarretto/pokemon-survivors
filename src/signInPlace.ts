import { ARENA_HUB_TABS, type ArenaHubTab } from './ui/arenaBits'
import { BOUTIQUE_TABS, type BoutiqueTab } from './ui/boutiqueSeen'

/**
 * Where a sign in began (`askSignIn` in `ui/account.ts`), so the player lands
 * back there: by email the sheet closes over it, and Google or Discord, which
 * leave for the provider and come back to a bare page, find it here
 * (`takeSignInPlace`, the shell's `reopen`). A tab a portal's frame opened to
 * sign in gets it in its URL (`handoff.ts`). Tab only (sessionStorage).
 */
export type SignInPlace =
  | { to: 'boutique'; tab: BoutiqueTab }
  | { to: 'arena'; tab: ArenaHubTab }
  | { to: (typeof PLAIN)[number] }

/** The places with nothing more to say than which they are. */
const PLAIN = ['carpentry', 'festival', 'trainer', 'friends', 'invites', 'supporters', 'ideas'] as const

const KEY = 'ps:signInPlace'

const isOneOf = <T extends string>(list: readonly T[], v: unknown): v is T => typeof v === 'string' && (list as readonly string[]).includes(v)

/** A place as `placeParam` wrote it (or anything else: null). */
export const parsePlace = (raw: string | null): SignInPlace | null => {
  const [to, tab] = (raw ?? '').split(':')
  if (to === 'boutique') return isOneOf(BOUTIQUE_TABS, tab) ? { to, tab } : null
  if (to === 'arena') return isOneOf(ARENA_HUB_TABS, tab) ? { to, tab } : null
  return isOneOf(PLAIN, to) ? { to } : null
}

const writePlace = (place: SignInPlace) => ('tab' in place ? `${place.to}:${place.tab}` : place.to)

const store = (raw: string | null) => {
  try {
    if (raw) sessionStorage.setItem(KEY, raw)
    else sessionStorage.removeItem(KEY)
  } catch {
    // Storage blocked: back from signing in, the lobby.
  }
}

/** Keeps where a sign in starts (null: nowhere to come back to but the lobby). */
export const keepSignInPlace = (place: SignInPlace | null) => store(place && writePlace(place))

/** The kept place as a URL parameter's value, for a tab of the site to keep in turn (`handoff.ts`), or null. */
export const placeParam = () => {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/** Keeps a place a URL brought (`placeParam`'s), if it is one. */
export const keepPlaceParam = (raw: string | null) => store(parsePlace(raw) && raw)

/** The kept place, read once (null: none). */
export const takeSignInPlace = () => {
  const place = parsePlace(placeParam())
  store(null)
  return place
}
