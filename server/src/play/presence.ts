import type { FriendPresence, ServerMessage } from '../../../src/net/protocol'
import type { MutualFriend } from '../friends'
import type { ConnId, Out } from './rooms'

/**
 * Signed-in players' presence and room invites, pure like `rooms.ts`: the
 * server verifies the token and loads the profile and mutual friends
 * (`friendStore`), then hands them in. Friends are mutual follows. Only
 * players online are tracked; guests aren't at all.
 */

/** Ms between two invites from the same player to the same friend. */
export const INVITE_INTERVAL = 10_000

type User = {
  userId: string
  /** How friends see them; null without a handle (nobody can friend them then). */
  me: FriendPresence | null
  conns: Set<ConnId>
  /** Mutual friends by user id, as last loaded. */
  friends: Map<string, FriendPresence>
}

export type Presence = {
  /** Players with at least one connection. */
  users: Map<string, User>
  byConn: Map<ConnId, User>
  /** When each `sender>target` pair last invited. */
  invites: Map<string, number>
}

/** A signed-in player's profile row (both null before they pick a handle). */
export type Profile = { handle: string | null; name: string | null }

export const createPresence = (): Presence => ({ users: new Map(), byConn: new Map(), invites: new Map() })

const toUser = (user: User, msg: ServerMessage, skip: ConnId | null = null): Out[] => [...user.conns].filter((c) => c !== skip).map((to) => ({ to, msg }))

const presence = (friend: FriendPresence, online: boolean): ServerMessage => ({ t: 'presence', friend, online })

/**
 * Replaces a player's mutual friends with a fresh load. Friends who just
 * became mutual and are online learn of each other (both sides' sets are
 * updated); friends lost see each other go offline. `skip` is a connection of
 * the player that hears it another way (its `welcome`).
 */
const setFriends = (p: Presence, user: User, fresh: readonly MutualFriend[], skip: ConnId | null): Out[] => {
  const next = new Map(fresh.map((f): [string, FriendPresence] => [f.userId, { handle: f.handle, name: f.name }]))
  const out: Out[] = []
  for (const [id, info] of next) {
    const friend = p.users.get(id)
    if (user.friends.has(id) || !friend) continue
    if (user.me) {
      friend.friends.set(user.userId, user.me)
      out.push(...toUser(friend, presence(user.me, true)))
    }
    out.push(...toUser(user, presence(info, true), skip))
  }
  for (const [id, info] of user.friends) {
    const friend = p.users.get(id)
    if (next.has(id) || !friend) continue
    friend.friends.delete(user.userId)
    if (user.me) out.push(...toUser(friend, presence(user.me, false)))
    out.push(...toUser(user, presence(info, false), skip))
  }
  user.friends = next
  return out
}

/**
 * Answers a connection's handshake. `userId` is null for guests (no or an
 * invalid token), who get an empty `welcome`. A player's first connection
 * tells their online friends they're here.
 */
export const signIn = (p: Presence, conn: ConnId, userId: string | null, profile: Profile | null, friends: readonly MutualFriend[], name: string): Out[] => {
  if (userId === null) return [{ to: conn, msg: { t: 'welcome', me: null, online: [] } }]
  const handle = profile?.handle ?? null
  const shown = profile?.name ?? name
  const user = p.users.get(userId) ?? { userId, me: null, conns: new Set<ConnId>(), friends: new Map<string, FriendPresence>() }
  user.me = handle ? { handle, name: shown } : null
  user.conns.add(conn)
  p.users.set(userId, user)
  p.byConn.set(conn, user)
  const out = setFriends(p, user, friends, conn)
  const online = [...user.friends].filter(([id]) => p.users.has(id)).map(([, f]) => f)
  return [{ to: conn, msg: { t: 'welcome', me: { handle, name: shown }, online } }, ...out]
}

/** The signed-in player behind a connection, or null for guests. */
export const userOf = (p: Presence, conn: ConnId) => p.byConn.get(conn)?.userId ?? null

/** A fresh load of the player's mutual friends (`friends`, after a request was accepted). */
export const reloadFriends = (p: Presence, conn: ConnId, fresh: readonly MutualFriend[]): Out[] => {
  const user = p.byConn.get(conn)
  return user ? setFriends(p, user, fresh, null) : []
}

/** A connection closed. A player's last one tells their online friends they left. */
export const signOut = (p: Presence, conn: ConnId): Out[] => {
  const user = p.byConn.get(conn)
  p.byConn.delete(conn)
  if (!user) return []
  user.conns.delete(conn)
  if (user.conns.size > 0) return []
  p.users.delete(user.userId)
  const me = user.me
  if (!me) return []
  return [...user.friends.keys()].flatMap((id) => {
    const friend = p.users.get(id)
    return friend ? toUser(friend, presence(me, false)) : []
  })
}

/**
 * Invites the mutual friend with `handle` into the sender's room (`code`,
 * null outside one), on all their connections.
 */
export const invite = (p: Presence, conn: ConnId, handle: string, code: string | null, now: number): Out[] => {
  const refuse = (code: Extract<ServerMessage, { t: 'refused' }>['code']): Out[] => [{ to: conn, msg: { t: 'refused', code } }]
  const user = p.byConn.get(conn)
  if (!user?.me) return refuse('notFriend')
  if (code === null) return refuse('noRoom')
  const id = [...user.friends].find(([, f]) => f.handle === handle)?.[0]
  if (id === undefined) return refuse('notFriend')
  const target = p.users.get(id)
  if (!target) return refuse('offline')
  const key = `${user.userId}>${id}`
  const last = p.invites.get(key)
  if (last !== undefined && now - last < INVITE_INTERVAL) return refuse('rate')
  p.invites.set(key, now)
  return toUser(target, { t: 'invited', from: user.me, code })
}

/** Forgets invite times that no longer limit anything. */
export const prunePresence = (p: Presence, now: number) => {
  for (const [key, at] of p.invites) if (now - at >= INVITE_INTERVAL) p.invites.delete(key)
}
