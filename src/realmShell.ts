import { accountHandle, sessionToken } from './account'
import { webSocket, type SocketHandlers, type SocketLike } from './coop/client'
import { playsShiny } from './game/shinyPicks'
import { equippedLook } from './gems'
import { isCityId, type CityId } from './net/realm'
import { fakeErrandsDone, fakeFriendsFrom, fakeRealm, fakeStamp, realmFaked } from './realm/api'
import { STAMP_IDS, STAMPS, isStampId } from './data/realmStamps'
import { createRealmClient, type RealmClient } from './realm/client'
import { startLocalRealm, type LocalRealm } from './realm/localRealm'
import { isLocalRealm, realmUrl, setLocalRealm } from './realmUrl'
import { loadSave } from './ui/save'

/**
 * The browser's side of the Poké Realm's connection: the realm lives on the
 * VPS relays (`VITE_COOP_URL_SA`, or a dev build's `ps.coop('relay', 'sa', u)`),
 * signed in with Clerk. A dev build can swap in the in-page realm with bots
 * (`ps.realm('local')`, `realm/localRealm.ts`) and the faked API (`fakeRealm`),
 * and does on its own without a VPS relay (as co-op falls back to the dev relay).
 * Its own chunk with the realm's screens (`realmMode.ts`); where the realm is
 * lives in `realmUrl.ts`, for the lobby.
 */

/** Bots the in-page realm fills a city with. */
const LOCAL_BOTS = 14

/** Where the faked friends among the bots start (`realm/api.ts`'s `FAKE_FOLLOWED`), so "Ir até" has somewhere to go. */
const LOCAL_START = { misty: 'cafe', brock: 'arcade', dawn: 'pier' } as const

let host: { city: CityId; realm: LocalRealm } | null = null
let client: RealmClient | null = null

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
  const inPage = isLocalRealm()
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
  setLocalRealm(on)
  fakeRealm(on, accountHandle() ?? 'you')
}

/** Dev: sends two of the in-page realm's bots to play at a town game table (`ps.realm('table', 'cafe-2')`, or `'cafe-2 fourInRow'` for a game), to watch or join. */
export const stageRealmTable = (table: string, game?: string) => (host ? host.realm.stage(table, game) : 0)

/** Dev: a bot of the in-page realm invites the player to its base (`ps.realm('invite', 'misty')`); whether one did. */
export const realmInviteFrom = (handle: string) => host?.realm.inviteFrom(handle) ?? false

/**
 * Dev (`ps.realm('stamp', id)`): the player earns a stamp, in the faked book
 * and out loud in the in-page town; the next unheld one without an id, and
 * `'bot'` for a bot of the room (a hidden one half the time, for its notice).
 */
export const devStamp = (arg?: string) => {
  if (arg === 'bot') {
    const hidden = STAMP_IDS.filter((id) => 'hidden' in STAMPS[id])
    const id = Math.random() < 0.5 ? hidden[Math.floor(Math.random() * hidden.length)]! : STAMP_IDS[Math.floor(Math.random() * STAMP_IDS.length)]!
    return host?.realm.botStamped([id]) ? id : 'ps.realm: no bot in your room'
  }
  if (arg !== undefined && !isStampId(arg)) return `ps.realm: stamp id (${STAMP_IDS.join(', ')}) or 'bot'`
  if (!realmFaked()) fakeRealm(true, accountHandle() ?? 'you')
  const id = arg ?? STAMP_IDS.find((s) => fakeStamp(s) !== null)
  if (!id) return 'ps.realm: every stamp held'
  if (arg !== undefined) fakeStamp(arg)
  host?.realm.stamped([id])
  return id
}

/** Dev (`ps.realm('errands')`): today's faked errands all finish; the board and the toast hear it as they'd hear the relay. */
export const devErrands = () => {
  if (!realmFaked()) fakeRealm(true, accountHandle() ?? 'you')
  const done = fakeErrandsDone()
  host?.realm.errandsDone(done)
  return done
}

/** Dev: what the realm's shell is on now. */
export const realmDevState = () => ({ local: isLocalRealm(), faked: realmFaked(), url: realmUrl(), city: client?.city() ?? null, room: client?.room() ?? null, status: client?.status() ?? null, rtt: client?.rtt() ?? null })
