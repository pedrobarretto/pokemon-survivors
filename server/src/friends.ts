import {
  beatMsFor,
  FRIENDS,
  INVITE,
  likePrefix,
  presenceOnline,
  relationOf,
  splitFollows,
  type Activity,
  type CoopInvite,
  type FriendList,
  type FriendPresence,
  type PlayerMatch,
  type PresenceUpdate,
  type PresenceView,
} from '../../src/game/friends'
import type { Sql } from './db'
import { rateLimiter } from './rateLimit'

type FollowRow = { handle: string; name: string; i_follow: boolean; follows_me: boolean }

type PresenceRow = { handle: string; name: string; appear_offline: boolean; activity: Activity | null; room: string | null; ago: number | null }

/** How a friend's row reads to the asker: offline, or appearing so, shows nothing of what they do. */
export const toFriendPresence = (r: PresenceRow): FriendPresence => {
  const online = !r.appear_offline && r.activity !== null && r.ago !== null && presenceOnline(r.activity, r.ago)
  return { handle: r.handle, name: r.name, online, activity: online ? r.activity : null, room: online ? r.room : null }
}

/** What inviting a friend came to. `notFriend` also covers an unknown handle, so nobody learns who exists. */
export type Invited = { ok: true; expiresAt: string } | { ok: false; error: 'notFriend' | 'limit' }

/** Rate limits, per instance: searches per minute (per player, and a looser one per IP: a carrier's NAT puts many players behind one), invites per 10 minutes and one per friend every 10 s, follows per hour, heartbeats per minute (3 is normal). */
const LIMITS = { search: { n: 30, ms: 60_000 }, searchIp: { n: 120, ms: 60_000 }, invite: { n: 30, ms: 10 * 60_000 }, sameFriend: { n: 1, ms: 10_000 }, follow: { n: 60, ms: 60 * 60_000 }, beat: { n: 12, ms: 60_000 } } as const

/**
 * Friendship on top of the one-way `follows` (following is a request,
 * following back accepts it), presence by heartbeat and co-op invites.
 * Friends see each other's presence and room; nobody else does.
 */
export const friendStore = (sql: Sql, now: () => number = Date.now) => {
  const searches = rateLimiter(LIMITS.search.n, LIMITS.search.ms)
  const ipSearches = rateLimiter(LIMITS.searchIp.n, LIMITS.searchIp.ms)
  const invites = rateLimiter(LIMITS.invite.n, LIMITS.invite.ms)
  const pairs = rateLimiter(LIMITS.sameFriend.n, LIMITS.sameFriend.ms)
  const follows = rateLimiter(LIMITS.follow.n, LIMITS.follow.ms)
  const beats = rateLimiter(LIMITS.beat.n, LIMITS.beat.ms)

  const userByHandle = async (handle: string) => (await sql<{ id: string }[]>`select id from users where handle = ${handle}`)[0]?.id ?? null

  /** The player with `handle` if they and `userId` follow each other. */
  const friendByHandle = async (userId: string, handle: string) =>
    (
      await sql<{ id: string }[]>`
        select u.id from users u
        join follows a on a.follower_id = ${userId} and a.followee_id = u.id
        join follows b on b.follower_id = u.id and b.followee_id = ${userId}
        where u.handle = ${handle}`
    )[0]?.id ?? null

  /** The presence of every mutual friend, then the invites waiting from them (live, not dismissed). */
  const view = async (userId: string): Promise<Pick<PresenceView, 'friends' | 'invites'>> => {
    const [rows, waiting] = await Promise.all([
      sql<PresenceRow[]>`
        select u.handle, coalesce(u.name, u.handle) as name, u.appear_offline, p.activity, p.room,
          (extract(epoch from (now() - p.seen_at)) * 1000)::float8 as ago
        from follows a
        join follows b on b.follower_id = a.followee_id and b.followee_id = a.follower_id
        join users u on u.id = a.followee_id
        left join presence p on p.user_id = u.id
        where a.follower_id = ${userId} and u.handle is not null
        order by u.handle limit ${FRIENDS.list}`,
      sql<{ id: string; handle: string; name: string; room: string; at: Date; expires_at: Date }[]>`
        select i.id, u.handle, coalesce(u.name, u.handle) as name, i.room, i.created_at as at, i.expires_at
        from coop_invites i join users u on u.id = i.from_id
        where i.to_id = ${userId} and i.expires_at > now() and i.dismissed_at is null and u.handle is not null
          and exists (select 1 from follows where follower_id = ${userId} and followee_id = i.from_id)
          and exists (select 1 from follows where follower_id = i.from_id and followee_id = ${userId})
        order by i.created_at desc limit ${INVITE.shown}`,
    ])
    return {
      friends: rows.map(toFriendPresence),
      invites: waiting.map((r): CoopInvite => ({ id: r.id, from: { handle: r.handle, name: r.name }, room: r.room, at: r.at.toISOString(), expiresAt: r.expires_at.toISOString() })),
    }
  }

  return {
    /** Takes one search from the player's and the IP's budget; false past `LIMITS.search`. */
    takeSearch: (userId: string, ip: string) => ipSearches.take([`ip:${ip}`], now()) && searches.take([`user:${userId}`], now()),

    /** Takes one follow from the player's budget: a follow is a request the other player sees. */
    takeFollow: (userId: string) => follows.take([`user:${userId}`], now()),

    /** Takes one heartbeat from the player's budget. */
    takeBeat: (userId: string) => beats.take([`user:${userId}`], now()),

    /** Players whose handle starts with `prefix` (already `parseHandlePrefix`ed), without the asker or banned players, with how they relate. Uses `users_handle_prefix`. */
    search: async (prefix: string, viewer: string): Promise<PlayerMatch[]> => {
      const rows = await sql<FollowRow[]>`
        select handle, coalesce(name, handle) as name,
          exists (select 1 from follows where follower_id = ${viewer} and followee_id = users.id) as i_follow,
          exists (select 1 from follows where follower_id = users.id and followee_id = ${viewer}) as follows_me
        from users
        where handle like ${likePrefix(prefix)} and id <> ${viewer} and banned_at is null
        order by handle limit ${FRIENDS.searchMax}`
      return rows.map((r) => ({ handle: r.handle, name: r.name, relation: relationOf(r.i_follow, r.follows_me) }))
    },

    /** Everyone linked to `userId` by a follow, split into friends and pending requests both ways. */
    list: async (userId: string): Promise<FriendList> => {
      const rows = await sql<FollowRow[]>`
        select u.handle, coalesce(u.name, u.handle) as name,
          exists (select 1 from follows where follower_id = ${userId} and followee_id = u.id) as i_follow,
          exists (select 1 from follows where follower_id = u.id and followee_id = ${userId}) as follows_me
        from users u
        where u.handle is not null and u.id in (
          select followee_id from follows where follower_id = ${userId}
          union select follower_id from follows where followee_id = ${userId})
        order by u.handle limit ${FRIENDS.list * 3}`
      return splitFollows(rows.map((r) => ({ handle: r.handle, name: r.name, iFollow: r.i_follow, followsMe: r.follows_me })))
    },

    /** Whether `handle` follows `userId` back (after a follow: it made friends). */
    followsBack: async (userId: string, handle: string) =>
      (await sql<{ id: string }[]>`select u.id from users u join follows f on f.follower_id = u.id and f.followee_id = ${userId} where u.handle = ${handle}`).length > 0,

    /** Declines `handle`'s request: drops their follow of `userId`. False when nobody has that handle. */
    decline: async (userId: string, handle: string) => {
      const id = await userByHandle(handle)
      if (!id) return false
      await sql`delete from follows where follower_id = ${id} and followee_id = ${userId}`
      return true
    },

    /** Unfriends `handle`: drops the follows both ways (so it doesn't turn into a request). False when nobody has that handle. */
    unfriend: async (userId: string, handle: string) => {
      const id = await userByHandle(handle)
      if (!id) return false
      await sql`delete from follows where (follower_id = ${userId} and followee_id = ${id}) or (follower_id = ${id} and followee_id = ${userId})`
      return true
    },

    /**
     * A heartbeat: stores what the player is doing and answers the friends' presence and the invites waiting.
     * One round trip writes and asks whether the player follows anyone; one who doesn't has no friends nor
     * invites (both need a follow each way), so their answer skips the reads and asks for a slower beat (`beatMsFor`).
     */
    beat: async (userId: string, update: PresenceUpdate): Promise<PresenceView> => {
      // The `users` row a first beat inserts isn't in this statement's snapshot: its `appear_offline` is the default, false.
      const [me] = await sql<{ appear_offline: boolean; follows: boolean }[]>`
        with joined as (insert into users (id) values (${userId}) on conflict (id) do nothing),
        seen as (
          insert into presence (user_id, activity, room, seen_at) values (${userId}, ${update.activity}, ${update.room}, now())
          on conflict (user_id) do update set activity = excluded.activity, room = excluded.room, seen_at = now())
        select coalesce((select appear_offline from users where id = ${userId}), false) as appear_offline,
          exists (select 1 from follows where follower_id = ${userId}) as follows`
      const follows = me?.follows ?? false
      const { friends, invites } = follows ? await view(userId) : { friends: [], invites: [] }
      return { friends, invites, appearOffline: me?.appear_offline ?? false, beatMs: beatMsFor(update.activity, follows) }
    },

    /** The player left (closed the panel, signed out): offline at once instead of when the window runs out. */
    offline: async (userId: string) => {
      await sql`delete from presence where user_id = ${userId}`
    },

    setAppearOffline: async (userId: string, on: boolean) => {
      await sql`insert into users (id, appear_offline) values (${userId}, ${on}) on conflict (id) do update set appear_offline = ${on}`
    },

    /**
     * Invites the friend with `handle` into `room`, replacing an earlier invite
     * to them. Works whether they look online or not (it waits `INVITE.ttlMs`),
     * so appearing offline gives nothing away.
     */
    invite: async (userId: string, handle: string, room: string): Promise<Invited> => {
      const to = await friendByHandle(userId, handle)
      if (!to) return { ok: false, error: 'notFriend' }
      if (!pairs.take([`${userId}>${to}`], now()) || !invites.take([`user:${userId}`], now())) return { ok: false, error: 'limit' }
      const [row] = await sql<{ expires_at: Date }[]>`
        insert into coop_invites (from_id, to_id, room, expires_at)
        values (${userId}, ${to}, ${room}, now() + make_interval(secs => ${INVITE.ttlMs / 1000}))
        on conflict (from_id, to_id) do update
        set id = gen_random_uuid(), room = excluded.room, created_at = now(), expires_at = excluded.expires_at, dismissed_at = null
        returning expires_at`
      return { ok: true, expiresAt: row!.expires_at.toISOString() }
    },

    /** Dismisses an invite sent to `userId`. False when there's no such invite for them. */
    dismiss: async (userId: string, id: string) =>
      (await sql`update coop_invites set dismissed_at = now() where id = ${id} and to_id = ${userId} and dismissed_at is null`).count > 0,
  }
}

export type FriendStore = ReturnType<typeof friendStore>
