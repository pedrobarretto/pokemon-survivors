import { PLAYABLE_IDS, type PlayableId } from '../data/hatchlings'
import type { CoopInvite } from '../game/friends'
import type { Member, RoomView } from '../net/protocol'

/**
 * The co-op room's rules as the lobby screens read them (`ui/coopRoom.ts`):
 * what a member's card says, who the host's start waits on (the relay's
 * own check, `relay/src/room.ts`) and which invites to show. DOM-free and
 * not part of the simulation's build id.
 */

/** What a member's card says, most pressing first: gone quiet, away in a run, the host, ready, still choosing. */
export type MemberState = 'offline' | 'away' | 'host' | 'ready' | 'picking'

export const memberState = (m: Member): MemberState => (!m.online ? 'offline' : m.away ? 'away' : m.host ? 'host' : m.ready && m.loadout ? 'ready' : 'picking')

/** The members online and how many of them are set (the host counts as set): what "Começar" waits on. Matches the relay's `start`. */
export const readiness = (room: RoomView) => {
  const online = room.members.filter((m) => m.online)
  const ready = online.filter((m) => (m.host || m.ready) && m.loadout !== null).length
  return { ready, total: online.length, all: ready === online.length }
}

/**
 * What a `build` refusal means for this page: the room runs `room` (null: a
 * relay that doesn't say), this page `own`, the site serves `latest` now
 * (null: couldn't tell). A room on the site's build means this page is behind
 * and a reload brings it up; any other room is older than the site (or a
 * preview's), so reloading can't help and the host needs a new room. A tab
 * that already reloaded for this room's build (`reloaded`) is never offered
 * another: a refusal can't loop.
 */
export const buildAdvice = (o: { own: string; room: string | null; latest: string | null; reloaded: boolean }): 'reload' | 'oldRoom' => {
  if (o.reloaded) return 'oldRoom'
  if (o.latest === null) return 'reload'
  return (o.room ?? o.latest) === o.latest && o.own !== o.latest ? 'reload' : 'oldRoom'
}

/** The Pokémon a player brings to a room: their partner, unless it's a legend (the Legend mode stays solo, `COOP_LOCKS`), then the first starter. */
export const coopStarter = (partner: PlayableId) => PLAYABLE_IDS.find((id) => id === partner) ?? PLAYABLE_IDS[0]!

/** What co-op needs before it opens: nothing, an account (`signIn`), its @handle (`handle`), or a moment while the account is settling (`wait`). */
export type CoopAccess = 'open' | 'signIn' | 'handle' | 'wait'

/**
 * Co-op is for signed-in players with a handle (the name teammates see).
 * `accounts`: the build has them; a build without (only dev builds keep
 * co-op then, as guests on the dev relay) opens as it is. `handle`
 * undefined: the API hasn't said yet.
 */
export const coopAccess = (accounts: boolean, account: { kind: 'guest' | 'busy' | 'signedIn'; handle?: string | null }): CoopAccess => {
  if (!accounts) return 'open'
  if (account.kind === 'guest') return 'signIn'
  if (account.kind === 'busy' || account.handle === undefined) return 'wait'
  return account.handle === null ? 'handle' : 'open'
}

/** Invites worth a banner now: not shown yet, not expired (by `now`, ms), and not into the room the player is already in. */
export const freshInvites = (invites: readonly CoopInvite[], shown: ReadonlySet<string>, room: string | null, now: number) =>
  invites.filter((i) => !shown.has(i.id) && i.room !== room && Date.parse(i.expiresAt) > now)
