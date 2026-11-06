import { coopVpsUrls } from './coopShell'
import { LOCAL_REALM_URL } from './realm/localUrl'

/**
 * Where the Poké Realm is, light enough for the lobby (its tile, the `?realm`
 * link): the realm's own code, `realmShell.ts` and the screens, is a chunk
 * that loads as a player goes in (`realmMode.ts`).
 */

/** The in-page realm on (true), off (false), or as the build has it (null: a dev build without a VPS relay). */
let local: boolean | null = null

/** Dev: the in-page realm on or off (`useLocalRealm` in `realmShell.ts` starts it over). */
export const setLocalRealm = (on: boolean) => {
  local = on
}

export const isLocalRealm = () => local ?? (import.meta.env.DEV && !coopVpsUrls().sa)

/** The relay the realm is on, or null in a build without one. */
export const realmUrl = (): string | null => (isLocalRealm() ? LOCAL_REALM_URL : (coopVpsUrls().sa ?? null))
