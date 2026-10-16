import { track } from './analytics'
import { accountHandle, accountUserId, API_URL, sessionToken, storedRef, storeRef } from './account'
import type { PlayableId } from './data/hatchlings'
import type { Difficulty } from './game/difficulty'
import { isRecord } from './game/parse'
import type { DayKey } from './game/day'
import { parseChallengePlace, parseRunResult, type Board, type BoardPeriod, type ChallengeBoard, type ChallengePlace, type FriendList, type PlayerMatch, type PublicProfile, type RunRanks, type RunResult } from './game/ranking'
import { firstTouch, landingRef, REF_PARAM } from './game/referral'
import type { Replay } from './game/replay'
import { SITE_URL } from './site/routes'
import { locale, type Locale } from './i18n'
import { ROOM_PARAM } from './net/protocol'

/**
 * Ranked runs and the public side of accounts (boards, profiles, follows),
 * through the API (`server/`). Like `account.ts`, nothing here may block the
 * game: a signed-in run asks for its start token in the background, its result
 * waits in a queue in `localStorage` until the API takes it, and every read
 * fails soft (null), so the screens just say the ranking is out of reach.
 */

/** The boards and profiles read from the API; ranked runs also need an account. */
export const rankingEnabled = Boolean(API_URL)

const TIMEOUT_MS = 10_000

/** The API, with the player's token when there is one. Rejects offline. */
const call = (path: string, token: string | null, init: RequestInit = {}) =>
  fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })

/** A JSON body, or null when the call failed or answered an error. */
const read = async (path: string, token: string | null, init?: RequestInit) => {
  try {
    const res = await call(path, token, init)
    const body: unknown = res.ok ? await res.json() : null
    return { status: res.status, body }
  } catch {
    return { status: 0, body: null }
  }
}

/* ---------------- Ranked runs ---------------- */

const QUEUE_KEY = 'ps:runs'

/** Results kept for the API at most (a long run's replay is ~60 KB); older ones give way. */
const MAX_PENDING = 10

/**
 * A run result waiting for the API, under the start token of the player who
 * played it, with its replay for the server to re-simulate (checked there).
 */
type Pending = { userId: string; token: string; result: RunResult; replay: unknown }

const readQueue = (): Pending[] => {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]')
    if (!Array.isArray(data)) return []
    return data.flatMap((p: unknown) => {
      const result = isRecord(p) ? parseRunResult(p.result) : null
      return isRecord(p) && result && typeof p.userId === 'string' && typeof p.token === 'string' ? [{ userId: p.userId, token: p.token, result, replay: p.replay }] : []
    })
  } catch {
    return []
  }
}

const writeQueue = (queue: Pending[]) => {
  try {
    if (queue.length > 0) localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_PENDING)))
    else localStorage.removeItem(QUEUE_KEY)
  } catch {
    // Storage blocked: the result only gets this one try.
  }
}

/**
 * What became of a ranked run's result: on the boards (`ranked`, with the
 * player's position, and the challenge board's for a Desafio do dia run),
 * waiting for a connection (`queued`), refused by the server (`rejected`),
 * or never ranked because its start got no token (`unranked`).
 */
export type RankOutcome = { kind: 'ranked'; ranks: RunRanks; challenge: ChallengePlace | null } | { kind: 'queued' | 'rejected' | 'unranked' }

const parseRanks = (body: unknown): RunRanks | null => {
  const ranks = isRecord(body) && isRecord(body.ranks) ? body.ranks : null
  const at = (v: unknown) => (typeof v === 'number' ? v : null)
  return ranks ? { day: at(ranks.day), week: at(ranks.week), all: at(ranks.all) } : null
}

/**
 * Sends the queued results of the signed-in player, oldest first. An answer
 * takes a result off the queue, whatever it says; no connection, an expired
 * session or the rate limit keep it (and the rest) for next time. Returns
 * what the API said, by token.
 */
const flushOnce = async () => {
  const done = new Map<string, RankOutcome>()
  const userId = accountUserId()
  const token = userId ? await sessionToken() : null
  if (!token) return done
  for (const p of readQueue().filter((q) => q.userId === userId)) {
    const { status, body } = await read(`/runs/${p.token}`, token, { method: 'PUT', body: JSON.stringify({ ...p.result, replay: p.replay }) })
    if (status === 0 || status === 401 || status === 429 || status >= 500) break
    const ranks = parseRanks(body)
    done.set(p.token, ranks ? { kind: 'ranked', ranks, challenge: isRecord(body) ? parseChallengePlace(body.challenge) : null } : { kind: 'rejected' })
    // A newer result of the same run (endless mode) may have queued meanwhile: only this one is done.
    writeQueue(readQueue().filter((q) => q.token !== p.token || q.result.time > p.result.time))
  }
  return done
}

let flushing: Promise<Map<string, RankOutcome>> = Promise.resolve(new Map())

/** Sends what's queued (boot, end of a run). Calls take turns. Never throws. */
export const flushRuns = () => (flushing = flushing.then(flushOnce, flushOnce).catch(() => new Map<string, RankOutcome>()))

/** A start token from the API, or null (guest, offline, rate limited, a challenge that closed). */
const requestToken = async (challenge: DayKey | null) => {
  const token = await sessionToken()
  if (!token) return null
  const { body } = await read('/runs', token, { method: 'POST', ...(challenge ? { body: JSON.stringify({ challenge }) } : {}) })
  return isRecord(body) && typeof body.token === 'string' ? body.token : null
}

/**
 * A run played signed in. `submit` reports its result with the replay so far
 * and resolves once the API took it (or the queue did); reporting again only
 * sends a longer run (a victory that went on into endless mode), else it
 * answers what it did last.
 */
export type RankedRun = { submit: (result: RunResult, replay: Replay) => Promise<RankOutcome> }

/** Asks for the start token of a run that begins now (`challenge`: the day of the Desafio do dia it plays). Null for guests. */
export const startRanked = (challenge: DayKey | null = null): RankedRun | null => {
  const userId = accountUserId()
  if (!rankingEnabled || !userId) return null
  const token = requestToken(challenge)
  let sent = -1
  let last: Promise<RankOutcome> = Promise.resolve({ kind: 'unranked' })
  return {
    submit: (result, replay) => {
      if (result.time <= sent) return last
      sent = result.time
      // A copy now: the recorder keeps writing if the run goes on.
      const recorded: unknown = JSON.parse(JSON.stringify(replay))
      last = token.then(async (t): Promise<RankOutcome> => {
        if (!t) return { kind: 'unranked' }
        writeQueue([...readQueue().filter((q) => q.token !== t), { userId, token: t, result, replay: recorded }])
        return (await flushRuns()).get(t) ?? { kind: 'queued' }
      })
      return last
    },
  }
}

/* ---------------- Boards, profiles, follows ---------------- */

/** Which board to show (see `BoardQuery` on the server). */
export type BoardFilter = { difficulty: Difficulty; period: BoardPeriod; starter: PlayableId | null; friends: boolean }

/** A board, or null when the API can't be reached. Friends boards need an account. */
export const fetchBoard = async (f: BoardFilter): Promise<Board | null> => {
  const params = new URLSearchParams({ period: f.period, ...(f.starter ? { starter: f.starter } : {}), ...(f.friends ? { friends: '1' } : {}) })
  const { body } = await read(`/boards/${f.difficulty}?${params}`, await sessionToken())
  // Our own API: a quick look at the shape is enough, the screens only show text.
  return isRecord(body) && Array.isArray(body.entries) ? (body as Board) : null
}

/** A day's challenge board (friends only: who the player follows), or null when the API can't be reached. */
export const fetchChallengeBoard = async (day: DayKey, friends = false): Promise<ChallengeBoard | null> => {
  const { body } = await read(`/challenge/${day}${friends ? '?friends=1' : ''}`, await sessionToken())
  return isRecord(body) && Array.isArray(body.entries) && typeof body.total === 'number' ? (body as ChallengeBoard) : null
}

/** A public profile, `missing` when nobody has that handle, null when the API can't be reached. */
export const fetchProfile = async (handle: string): Promise<PublicProfile | 'missing' | null> => {
  const { status, body } = await read(`/profiles/${encodeURIComponent(handle)}`, await sessionToken())
  if (status === 404 || status === 400) return 'missing'
  return isRecord(body) && typeof body.handle === 'string' && Array.isArray(body.recent) ? (body as PublicProfile) : null
}

/** Follows or unfollows `handle`. Their follower count after it, or null when it didn't go through. */
export const setFollow = async (handle: string, follow: boolean) => {
  const token = await sessionToken()
  if (!token) return null
  const { body } = await read(`/follows/${encodeURIComponent(handle)}`, token, { method: follow ? 'PUT' : 'DELETE' })
  return isRecord(body) && typeof body.followers === 'number' ? { followed: body.followed === true, followers: body.followers } : null
}

/* ---------------- Friends ---------------- */

/** The signed-in player's friends and requests, or null offline (or as a guest). */
export const fetchFriends = async (): Promise<FriendList | null> => {
  const token = await sessionToken()
  if (!token) return null
  const { body } = await read('/friends', token)
  return isRecord(body) && Array.isArray(body.friends) && Array.isArray(body.incoming) && Array.isArray(body.outgoing) ? (body as FriendList) : null
}

/** Declines `handle`'s request (or unfriends them, dropping both follows). True when it went through. */
export const dropFriend = async (handle: string, how: 'decline' | 'unfriend') => {
  const token = await sessionToken()
  if (!token) return false
  const { body } = await read(`/${how === 'decline' ? 'followers' : 'friends'}/${encodeURIComponent(handle)}`, token, { method: 'DELETE' })
  return isRecord(body) && body.ok === true
}

/** Players whose handle starts with `query`, or null offline. */
export const searchPlayers = async (query: string): Promise<PlayerMatch[] | null> => {
  const { body } = await read(`/players?q=${encodeURIComponent(query)}`, await sessionToken())
  return isRecord(body) && Array.isArray(body.players) ? (body.players as PlayerMatch[]) : null
}

/* ---------------- Links ---------------- */

/** The game's page per language: a profile link opens the game in the language it was shared in. */
const PLAY_PATH = { pt: '/', en: '/en/' } as const satisfies Record<Locale, string>

/** Query parameter of a shared profile link (`/?u=handle`). */
export const PROFILE_PARAM = 'u'

/** The shareable link to a co-op room: the game opens straight in its lobby, crediting this player as the inviter (`?ref=`) when they have a handle. */
export const roomUrl = (code: string) => {
  const own = accountHandle()
  return `${location.origin}${PLAY_PATH[locale()]}?${ROOM_PARAM}=${code}${own ? `&${REF_PARAM}=${encodeURIComponent(own)}` : ''}`
}

/** The shareable link to a profile: the game opens straight on it, crediting whoever shares it when that's someone else (`?ref=`). */
export const profileUrl = (handle: string) => {
  const own = accountHandle()
  const ref = own && own !== handle ? `&${REF_PARAM}=${encodeURIComponent(own)}` : ''
  return `${location.origin}${PLAY_PATH[locale()]}?${PROFILE_PARAM}=${encodeURIComponent(handle)}${ref}`
}

/**
 * The game's link for a share card or its text, crediting `handle` (`?ref=`)
 * when the player has one. Always the public site, so a card shared from a
 * preview build still sends people to the game.
 */
export const gameUrl = (handle: string | null) => `${SITE_URL}${PLAY_PATH[locale()]}${handle ? `?${REF_PARAM}=${encodeURIComponent(handle)}` : ''}`

/* ---------------- Invites ---------------- */

const inviters = new Map<string, Promise<string | null>>()

/**
 * The display name of the device's inviter (`storedRef`), for the title's
 * invite banner: asked once per page, null offline or when nobody has that handle.
 */
export const inviterName = (): Promise<string | null> => {
  const ref = storedRef()
  if (!ref || !rankingEnabled) return Promise.resolve(null)
  let name = inviters.get(ref)
  if (!name) inviters.set(ref, (name = fetchProfile(ref).then((p) => (p && p !== 'missing' ? p.name : null))))
  return name
}

/** Dev: lands as if invited by `handle` (shown as `name`), without asking the API. */
export const stageInvite = (handle: string, name: string = handle) => {
  storeRef(handle)
  inviters.set(handle, Promise.resolve(name))
}

/**
 * On boot: a link with `?ref=` (or a profile's `?u=`) keeps its handle as the
 * device's inviter, first touch only and never the player's own, and counts
 * the landing. `?ref=` then leaves the address bar, so a reload isn't counted again.
 */
export const captureRef = () => {
  const params = new URLSearchParams(location.search)
  const landed = landingRef(params, PROFILE_PARAM)
  if (!landed) return
  const own = accountHandle()
  const stored = storedRef()
  const keep = firstTouch(stored, landed, own)
  if (keep !== stored && keep !== null) storeRef(keep)
  if (landed !== own) track('ref_land', { ref: landed, via: params.has(REF_PARAM) ? 'ref' : 'profile', first: stored === null ? 1 : 0 })
  if (params.has(REF_PARAM)) {
    params.delete(REF_PARAM)
    const query = params.toString()
    history.replaceState(null, '', `${location.pathname}${query ? `?${query}` : ''}${location.hash}`)
  }
}
