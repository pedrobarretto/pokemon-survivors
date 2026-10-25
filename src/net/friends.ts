import { accountState } from '../account'
import { apiCall } from '../api'
import {
  parseFriendList,
  parsePlayerMatches,
  parsePresenceView,
  type Activity,
  type FriendList,
  type PlayerMatch,
  type PresenceView,
} from '../game/friends'
import { isRecord } from '../game/parse'

/**
 * The game's side of friends, presence and co-op invites (`server/src/friends.ts`).
 * Signed-in players only; like `suggestions.ts`, every call fails soft (null
 * or `offline`), so nothing here can hold up guest play.
 *
 * Presence is short polling, never a socket. Nothing runs until the shell says
 * what the player is doing (`setActivity`): from then on a heartbeat goes out
 * every `beatMs` the API answers (20 s in the lobby or a room, 3 min in a run
 * or for a player who follows nobody) while the page is visible, and every answer reaches `onPresence`.
 * `setActivity(null)` stops it and tells the API the player left.
 */

/** Players whose handle starts with what was typed (2+ characters), or null offline. `limit`: too many searches, wait a bit. */
export const searchPlayers = async (q: string): Promise<PlayerMatch[] | 'limit' | null> => {
  const { status, body } = await apiCall(`/players?q=${encodeURIComponent(q)}`, { auth: true })
  if (status === 429) return 'limit'
  return status === 200 && isRecord(body) ? parsePlayerMatches(body.players) : null
}

/** Friends and pending requests both ways, or null offline. */
export const fetchFriends = async (): Promise<FriendList | null> => {
  const { status, body } = await apiCall('/friends', { auth: true })
  return status === 200 ? parseFriendList(body) : null
}

/** What following someone came to: `friend` when they already followed back (a request accepted). */
export type Followed = { ok: true; friend: boolean } | { ok: false; reason: 'unknown' | 'limit' | 'offline' }

/**
 * Follows `handle`: sends a friend request, or accepts theirs. A heartbeat goes
 * out at once: a player who followed nobody was beating slowly (`beatMsFor`),
 * and a new friend's invite should show within a lobby beat.
 */
export const follow = async (handle: string): Promise<Followed> => {
  const { status, body } = await apiCall(`/follows/${encodeURIComponent(handle)}`, { method: 'PUT', auth: true })
  if (status === 200) {
    if (activity) void beat()
    return { ok: true, friend: isRecord(body) && body.friend === true }
  }
  return { ok: false, reason: status === 404 ? 'unknown' : status === 429 ? 'limit' : 'offline' }
}

/** Takes a follow (or a request not yet accepted) back. Whether it went through. */
export const unfollow = async (handle: string) => (await apiCall(`/follows/${encodeURIComponent(handle)}`, { method: 'DELETE', auth: true })).status === 200

/** Declines `handle`'s friend request. Whether it went through. */
export const declineRequest = async (handle: string) => (await apiCall(`/followers/${encodeURIComponent(handle)}`, { method: 'DELETE', auth: true })).status === 200

/** Unfriends `handle` (both follows go). Whether it went through. */
export const unfriend = async (handle: string) => (await apiCall(`/friends/${encodeURIComponent(handle)}`, { method: 'DELETE', auth: true })).status === 200

/** What inviting a friend came to. `notFriend`: they aren't (any more). */
export type InviteSent = { ok: true; expiresAt: string } | { ok: false; reason: 'notFriend' | 'limit' | 'offline' }

/** Invites the friend `handle` into the co-op room `room`; they see it on their next heartbeat. */
export const inviteFriend = async (handle: string, room: string): Promise<InviteSent> => {
  const { status, body } = await apiCall('/coop-invites', { method: 'POST', body: { to: handle, room }, auth: true })
  if (status === 201 && isRecord(body) && typeof body.expiresAt === 'string') return { ok: true, expiresAt: body.expiresAt }
  return { ok: false, reason: status === 404 ? 'notFriend' : status === 429 ? 'limit' : 'offline' }
}

/** Dismisses an invite: it stops coming with the heartbeats (and leaves the latest view at once). */
export const dismissInvite = async (id: string) => {
  if (view) publish({ ...view, invites: view.invites.filter((i) => i.id !== id) })
  return (await apiCall(`/coop-invites/${id}`, { method: 'DELETE', auth: true })).status === 200
}

/** Turns "appear offline" on or off. Whether it went through. */
export const setAppearOffline = async (appearOffline: boolean) => {
  const ok = (await apiCall('/presence/settings', { method: 'PUT', body: { appearOffline }, auth: true })).status === 200
  if (ok && view) publish({ ...view, appearOffline })
  return ok
}

/* ---------------- Presence (heartbeats) ---------------- */

/** Longest wait between two tries when the API is out of reach or says to slow down. */
const MAX_BACKOFF_MS = 5 * 60_000

let activity: Activity | null = null
let room: string | null = null
let view: PresenceView | null = null
let timer: ReturnType<typeof setTimeout> | null = null
let backoff = 0
const listeners = new Set<(v: PresenceView) => void>()

const publish = (next: PresenceView) => {
  view = next
  listeners.forEach((fn) => fn(next))
}

const schedule = (ms: number) => {
  if (timer) clearTimeout(timer)
  timer = activity && document.visibilityState === 'visible' ? setTimeout(() => void beat(), ms) : null
}

/** Sends one heartbeat and schedules the next: at the API's pace, or backing off while it fails. */
const beat = async () => {
  if (timer) clearTimeout(timer)
  timer = null
  if (!activity || accountState().kind !== 'signedIn') return
  const sent = { activity, room }
  const { status, body } = await apiCall('/presence', { method: 'PUT', body: sent, auth: true })
  // A newer `setActivity` sent its own beat meanwhile.
  if (activity !== sent.activity || room !== sent.room) return
  const next = status === 200 ? parsePresenceView(body) : null
  if (next) {
    backoff = 0
    publish(next)
    return schedule(next.beatMs)
  }
  backoff = Math.min(MAX_BACKOFF_MS, backoff ? backoff * 2 : 30_000)
  schedule(backoff)
}

/**
 * Says what the player is doing (`room`: the co-op room code, in a room or a
 * co-op run), and beats at once when it changed. `null` stops the heartbeats
 * and tells friends the player left. Guests: nothing happens.
 */
export const setActivity = (next: Activity | null, code: string | null = null) => {
  const changed = next !== activity || code !== room
  const was = activity
  activity = next
  room = next === 'lobby' ? null : code
  if (!changed) return
  if (next) return void beat()
  schedule(0)
  if (was && accountState().kind === 'signedIn') void apiCall('/presence', { method: 'DELETE', auth: true })
}

/** The latest heartbeat's answer, null before the first one. */
export const presenceView = () => view

/** Calls `fn` with every heartbeat's answer. Returns the unsubscribe. */
export const onPresence = (fn: (v: PresenceView) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

// A hidden page stops beating (friends see it go offline when the window runs out); coming back beats at once.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && activity) void beat()
  else schedule(0)
})
