import { accountHandle, sessionToken } from './account'
import { webSocket, type SocketHandlers, type SocketLike } from './coop/client'
import { coopVpsUrls } from './coopShell'
import { playsShiny } from './game/shinyPicks'
import { equippedLook } from './gems'
import { isCityId, type CityId } from './net/realm'
import { fakeFriendsFrom, fakeRealm, realmFaked } from './realm/api'
import { createRealmClient, type RealmClient } from './realm/client'
import { LOCAL_REALM_URL, startLocalRealm, type LocalRealm } from './realm/localRealm'
import { loadSave } from './ui/save'

/**
 * The browser's side of the Poké Realm's connection: the realm lives on the
 * VPS relays (`VITE_COOP_URL_SA`, or a dev build's `ps.coop('relay', 'sa', u)`),
 * signed in with Clerk. A dev build can swap in the in-page realm with bots
 * (`ps.realm('local')`, `realm/localRealm.ts`) and the faked API (`fakeRealm`),
 * and does on its own without a VPS relay (as co-op falls back to the dev relay).
 */

/** Bots the in-page realm fills a city with. */
const LOCAL_BOTS = 14

/** Where the faked friends among the bots start (`realm/api.ts`'s `FAKE_FOLLOWED`), so "Ir até" has somewhere to go. */
const LOCAL_START = { misty: 'cafe', brock: 'arcade', dawn: 'pier' } as const

/** The in-page realm on (true), off (false), or as the build has it (null: a dev build without a VPS relay). */
let local: boolean | null = null
let host: { city: CityId; realm: LocalRealm } | null = null
let client: RealmClient | null = null

const isLocal = () => local ?? (import.meta.env.DEV && !coopVpsUrls().sa)

/** The relay the realm is on, or null in a build without one. */
export const realmUrl = (): string | null => (isLocal() ? LOCAL_REALM_URL : (coopVpsUrls().sa ?? null))

/** The in-page realm for the city a socket asks for (one at a time: another city starts it over). */
const localSocket = (url: string, on: SocketHandlers): SocketLike => {
  const asked = /\/realm\/([^/]+)\/ws$/.exec(url)?.[1]
  const city: CityId = isCityId(asked) ? asked : 'pallet'
  if (host?.city !== city) {
    host?.realm.dispose()
    const save = loadSave()
    host = {
      city,
      realm: startLocalRealm({
        city,
        bots: LOCAL_BOTS,
        start: LOCAL_START,
        me: { handle: accountHandle() ?? 'you', partner: save.partner, shiny: playsShiny(save, save.partner), look: equippedLook() },
      }),
    }
  }
  return host.realm.socket(url, on)
}

/** This tab's realm client (made on first use), or null without a relay. */
export const realmClient = (): RealmClient | null => {
  const url = realmUrl()
  if (!url) return null
  const inPage = isLocal()
  if (inPage && !realmFaked()) fakeRealm(true, accountHandle() ?? 'you')
  // The faked friends among the bots walk where the in-page realm has them.
  if (inPage) fakeFriendsFrom(() => host?.realm.presence() ?? null)
  client ??= createRealmClient({
    url,
    socket: inPage ? localSocket : webSocket,
    token: inPage ? async () => accountHandle() ?? 'you' : sessionToken,
    now: () => performance.now(),
  })
  return client
}

/** Dev: the in-page realm with bots and the faked API (on), or the relay again (off). */
export const useLocalRealm = (on: boolean) => {
  client?.leave()
  client = null
  host?.realm.dispose()
  host = null
  local = on
  fakeRealm(on, accountHandle() ?? 'you')
}

/** Dev: sends two of the in-page realm's bots to play at a town game table (`ps.realm('table', 'cafe-2')`, or `'cafe-2 fourInRow'` for a game), to watch or join. */
export const stageRealmTable = (table: string, game?: string) => (host ? host.realm.stage(table, game) : 0)

/** Dev: a bot of the in-page realm invites the player to its base (`ps.realm('invite', 'misty')`); whether one did. */
export const realmInviteFrom = (handle: string) => host?.realm.inviteFrom(handle) ?? false

/** Dev: what the realm's shell is on now. */
export const realmDevState = () => ({ local: isLocal(), faked: realmFaked(), url: realmUrl(), city: client?.city() ?? null, room: client?.room() ?? null, status: client?.status() ?? null, rtt: client?.rtt() ?? null })
