import { onServer } from './client'
import type { FriendPresence } from './protocol'

/**
 * Which mutual friends are online right now (signed-in players only), from
 * the play server's `welcome` and `presence` messages, and the invites that
 * came in. The friends screen reads it; the shell toasts invites.
 */

const online = new Map<string, FriendPresence>()
const listeners = new Set<() => void>()
const inviteListeners = new Set<(from: FriendPresence, code: string) => void>()

/** Mutual friends online, by handle. */
export const onlineFriends = (): ReadonlyMap<string, FriendPresence> => online

export const isOnline = (handle: string) => online.has(handle)

/** Calls `fn` whenever someone comes online or goes offline. Returns the unsubscribe. */
export const onPresence = (fn: () => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

/** Calls `fn` for every invite into a room. Returns the unsubscribe. */
export const onInvite = (fn: (from: FriendPresence, code: string) => void) => {
  inviteListeners.add(fn)
  return () => void inviteListeners.delete(fn)
}

onServer((m) => {
  if (m.t === 'welcome') {
    online.clear()
    for (const f of m.online) online.set(f.handle, f)
  } else if (m.t === 'presence') {
    if (m.online) online.set(m.friend.handle, m.friend)
    else online.delete(m.friend.handle)
  } else if (m.t === 'invited') {
    return inviteListeners.forEach((fn) => fn(m.from, m.code))
  } else return
  listeners.forEach((fn) => fn())
})
