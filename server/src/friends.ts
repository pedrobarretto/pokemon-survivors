import { ACHIEVEMENT_IDS } from '../../src/data/achievements'
import { parseTitle } from '../../src/game/achievements'
import { knownIds } from '../../src/game/parse'
import { PLAYER_SEARCH, type Friend, type FriendList, type PlayerMatch } from '../../src/game/ranking'
import type { Sql } from './db'

type FriendRow = { handle: string; name: string | null; title: unknown; unlocked: unknown; i_follow: boolean; follows_me: boolean }

const toFriend = (r: FriendRow): Friend => ({ handle: r.handle, name: r.name ?? r.handle, title: parseTitle(r.title, knownIds(r.unlocked, ACHIEVEMENT_IDS)) })

/** `LIKE` treats `_` (allowed in handles) as a wildcard. */
const likePrefix = (prefix: string) => `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** A mutual friend as the realtime server tracks them. */
export type MutualFriend = { userId: string; handle: string; name: string }

/**
 * Friendship on top of the one-way `follows`: following someone is a request,
 * following back accepts it, and both directions make friends. Shared by the
 * API (`/friends`, `/players`) and the realtime server's presence.
 */
export const friendStore = (sql: Sql) => {
  const userByHandle = async (handle: string) => (await sql<{ id: string }[]>`select id from users where handle = ${handle}`)[0]?.id ?? null

  return {
    /** Everyone linked to `userId` by a follow, split into friends and pending requests both ways. */
    list: async (userId: string): Promise<FriendList> => {
      const rows = await sql<FriendRow[]>`
        select u.handle, u.name, s.data->'title' as title, s.data->'achievements'->'unlocked' as unlocked,
          exists (select 1 from follows where follower_id = ${userId} and followee_id = u.id) as i_follow,
          exists (select 1 from follows where follower_id = u.id and followee_id = ${userId}) as follows_me
        from users u left join saves s on s.user_id = u.id
        where u.handle is not null and u.id in (
          select followee_id from follows where follower_id = ${userId}
          union select follower_id from follows where followee_id = ${userId})
        order by u.handle`
      return {
        friends: rows.filter((r) => r.i_follow && r.follows_me).map(toFriend),
        incoming: rows.filter((r) => !r.i_follow && r.follows_me).map(toFriend),
        outgoing: rows.filter((r) => r.i_follow && !r.follows_me).map(toFriend),
      }
    },

    /** Declines `handle`'s request: drops their follow of `userId`. False when nobody has that handle. */
    decline: async (userId: string, handle: string) => {
      const id = await userByHandle(handle)
      if (!id) return false
      await sql`delete from follows where follower_id = ${id} and followee_id = ${userId}`
      return true
    },

    /** Unfriends `handle`: drops the follows both ways. False when nobody has that handle. */
    unfriend: async (userId: string, handle: string) => {
      const id = await userByHandle(handle)
      if (!id) return false
      await sql`delete from follows where (follower_id = ${userId} and followee_id = ${id}) or (follower_id = ${id} and followee_id = ${userId})`
      return true
    },

    /** Players whose handle starts with `prefix` (already `parseHandlePrefix`ed), without the asker. Uses `users_handle_prefix`. */
    search: (prefix: string, viewer: string | null) =>
      sql<PlayerMatch[]>`
        select handle, coalesce(name, handle) as name from users
        where handle like ${likePrefix(prefix)} and id <> ${viewer ?? ''}
        order by handle limit ${PLAYER_SEARCH.max}`.then((rows) => rows.map(({ handle, name }): PlayerMatch => ({ handle, name }))),

    /** The player's handle and display name (null handle before they pick one), or null for an unknown user. */
    profile: async (userId: string) => {
      const [row] = await sql<{ handle: string | null; name: string | null }[]>`select handle, name from users where id = ${userId}`
      return row ? { handle: row.handle, name: row.name ?? row.handle } : null
    },

    /** The players `userId` follows who follow them back. */
    mutual: (userId: string) =>
      sql<MutualFriend[]>`
        select u.id as "userId", u.handle, coalesce(u.name, u.handle) as name
        from follows a
        join follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
        join users u on u.id = a.followee_id
        where a.follower_id = ${userId} and u.handle is not null`.then((rows) => rows.map(({ userId, handle, name }): MutualFriend => ({ userId, handle, name }))),
  }
}

export type FriendStore = ReturnType<typeof friendStore>
