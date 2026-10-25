import { isRecord } from './parse'
import { HANDLE, normalizeHandle, type ProfileName } from './ranking'

/**
 * Friends, presence and co-op invites (`server/src/friends.ts`). Pure; shared
 * with the API. Friends are mutual follows: following someone is a request,
 * following back accepts it. Guests have no friends (they join rooms by link).
 *
 * Presence is short polling: while the player is somewhere friends care about
 * (`Activity`), the game sends a heartbeat every `PRESENCE.beatMs[activity]`
 * (`PUT /presence`), and each answer brings the friends' presence and the
 * invites waiting. No socket stays open.
 */

/** Shortest handle prefix `/players` searches for, how many players it answers, and how many friends a list holds. */
export const FRIENDS = { searchMin: 2, searchMax: 8, list: 200 } as const

/** What a signed-in player is doing: in the menus, in a co-op room (waiting to start), or in a run (solo or co-op). */
export const ACTIVITIES = ['lobby', 'room', 'run'] as const

export type Activity = (typeof ACTIVITIES)[number]

/**
 * Heartbeat cadence per activity (a run beats rarely: only "in a run" needs
 * keeping), the slack past two missed beats before a player reads offline, and
 * the slowest pace, for a player who follows nobody (`beatMsFor`).
 */
export const PRESENCE = { beatMs: { lobby: 20_000, room: 20_000, run: 180_000 }, graceMs: 10_000, aloneMs: 180_000 } as const satisfies {
  beatMs: Record<Activity, number>
  graceMs: number
  aloneMs: number
}

/**
 * When the API asks for the next heartbeat. A player who follows nobody has no
 * friend to see them nor to invite them (both need a follow each way), and
 * only their own follow can change that (`follow` beats at once), so they beat
 * at `PRESENCE.aloneMs` wherever they are.
 */
export const beatMsFor = (activity: Activity, followsSomeone: boolean) =>
  followsSomeone ? PRESENCE.beatMs[activity] : Math.max(PRESENCE.beatMs[activity], PRESENCE.aloneMs)

/** How long an invite stays up, and how many a player sees at once. */
export const INVITE = { ttlMs: 10 * 60_000, shown: 20 } as const

/** How the asker and another player follow each other. */
export type Relation = 'none' | 'following' | 'follower' | 'friend'

/** A player found by `/players?q=` (handle prefix search), with how they relate to the asker. */
export type PlayerMatch = ProfileName & { relation: Relation }

/** What `/friends` answers: `incoming` follow me and I don't follow back (requests), `outgoing` the other way round. */
export type FriendList = { friends: ProfileName[]; incoming: ProfileName[]; outgoing: ProfileName[] }

/** What a heartbeat says: the activity, and the room code in a room or a co-op run. */
export type PresenceUpdate = { activity: Activity; room: string | null }

/** A friend as presence shows them. Offline (or appearing so) has no activity and no room. */
export type FriendPresence = ProfileName & { online: boolean; activity: Activity | null; room: string | null }

/** A friend's invite into their co-op room. */
export type CoopInvite = { id: string; from: ProfileName; room: string; at: string; expiresAt: string }

/** What a heartbeat answers. `beatMs`: when to send the next one. */
export type PresenceView = { friends: FriendPresence[]; invites: CoopInvite[]; appearOffline: boolean; beatMs: number }

export const relationOf = (iFollow: boolean, followsMe: boolean): Relation =>
  iFollow && followsMe ? 'friend' : iFollow ? 'following' : followsMe ? 'follower' : 'none'

/** Splits the players linked to the asker by a follow (either way) into friends and requests both ways, in order. */
export const splitFollows = (rows: readonly (ProfileName & { iFollow: boolean; followsMe: boolean })[]): FriendList => {
  const of = (relation: Relation) => rows.filter((r) => relationOf(r.iFollow, r.followsMe) === relation).map(({ handle, name }) => ({ handle, name }))
  return { friends: of('friend'), incoming: of('follower'), outgoing: of('following') }
}

/** A handle prefix to search for from what a player typed, or null when it's too short or can't start a handle. */
export const parseHandlePrefix = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const prefix = normalizeHandle(raw)
  return prefix.length >= FRIENDS.searchMin && prefix.length <= HANDLE.max && /^[a-z0-9_]+$/.test(prefix) ? prefix : null
}

/** `LIKE` treats `_` (allowed in handles) as a wildcard: escapes it for a prefix match. */
export const likePrefix = (prefix: string) => `${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/**
 * A co-op room code from an untrusted body, upper cased, or null. Loose on
 * purpose (letters and digits, 4 to 10): the relay owns the exact format and
 * checks it on join; here it only travels between friends.
 */
export const parseRoomCode = (raw: unknown) => {
  if (typeof raw !== 'string') return null
  const code = raw.trim().toUpperCase()
  return /^[A-Z0-9]{4,10}$/.test(code) ? code : null
}

const isActivity = (v: unknown): v is Activity => ACTIVITIES.some((a) => a === v)

/** A heartbeat's body, or null. The room only counts in a room (required) or a run (optional: a solo run has none). */
export const parsePresenceUpdate = (body: unknown): PresenceUpdate | null => {
  if (!isRecord(body) || !isActivity(body.activity)) return null
  const room = body.room === undefined || body.room === null ? null : parseRoomCode(body.room)
  if (body.room !== undefined && body.room !== null && room === null) return null
  if (body.activity === 'room' && room === null) return null
  return { activity: body.activity, room: body.activity === 'lobby' ? null : room }
}

/** Whether a heartbeat `agoMs` old still reads as online: two beats of its activity plus the grace. */
export const presenceOnline = (activity: Activity, agoMs: number) => agoMs >= 0 && agoMs <= 2 * PRESENCE.beatMs[activity] + PRESENCE.graceMs

/* ---------------- Parsing the API's answers (the game's side) ---------------- */

const parseName = (v: unknown): ProfileName | null => (isRecord(v) && typeof v.handle === 'string' && typeof v.name === 'string' ? { handle: v.handle, name: v.name } : null)

const parseList = <T>(v: unknown, parse: (item: unknown) => T | null): T[] => (Array.isArray(v) ? v.map(parse).filter((x): x is T => x !== null) : [])

const isRelation = (v: unknown): v is Relation => v === 'none' || v === 'following' || v === 'follower' || v === 'friend'

export const parsePlayerMatches = (v: unknown): PlayerMatch[] =>
  parseList(v, (item) => {
    const name = parseName(item)
    return name && isRecord(item) && isRelation(item.relation) ? { ...name, relation: item.relation } : null
  })

export const parseFriendList = (v: unknown): FriendList | null =>
  isRecord(v) ? { friends: parseList(v.friends, parseName), incoming: parseList(v.incoming, parseName), outgoing: parseList(v.outgoing, parseName) } : null

const parseFriendPresence = (v: unknown): FriendPresence | null => {
  const name = parseName(v)
  if (!name || !isRecord(v) || typeof v.online !== 'boolean') return null
  return { ...name, online: v.online, activity: isActivity(v.activity) ? v.activity : null, room: parseRoomCode(v.room) }
}

const parseInvite = (v: unknown): CoopInvite | null => {
  const from = isRecord(v) ? parseName(v.from) : null
  const room = isRecord(v) ? parseRoomCode(v.room) : null
  return from && room && isRecord(v) && typeof v.id === 'string' && typeof v.at === 'string' && typeof v.expiresAt === 'string'
    ? { id: v.id, from, room, at: v.at, expiresAt: v.expiresAt }
    : null
}

export const parsePresenceView = (v: unknown): PresenceView | null =>
  isRecord(v) && typeof v.beatMs === 'number' && v.beatMs > 0
    ? { friends: parseList(v.friends, parseFriendPresence), invites: parseList(v.invites, parseInvite), appearOffline: v.appearOffline === true, beatMs: v.beatMs }
    : null
