import { accountUserId, onAccountChange } from './account'
import { apiCall } from './api'
import type { PollKind, PollOption } from './data/supporters'
import type { Save } from './game/meta'
import { isRecord } from './game/parse'
import { parseHidden, parsePoll, parseSupporterStatus, parseWall, savedSupporterTier, withVote, type Poll, type SupporterStatus, type SupporterTier, type Wall } from './game/supporters'

/**
 * The supporters' side of the API (`server/`): the player's own standing,
 * redeeming a donation's code, linking a Patreon, the wall and the polls. Like `ranking.ts`,
 * every call fails soft (null), so the screens just say they're out of reach.
 */

const STATUS_KEY = 'ps:supporter'

/** The standing the API last gave this device, kept per account (a dev hook stages one). */
const storeStatus = (status: SupporterStatus) => {
  try {
    localStorage.setItem(STATUS_KEY, JSON.stringify({ userId: accountUserId() ?? '', status }))
  } catch {
    // Storage blocked: the device asks again next time.
  }
}

/** The signed-in player's standing the API last gave, or null (another account's, or never asked). */
export const knownStatus = (): SupporterStatus | null => {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(STATUS_KEY) ?? 'null')
    return isRecord(kept) && kept.userId === (accountUserId() ?? '') ? parseSupporterStatus(kept.status) : null
  } catch {
    return null
  }
}

/**
 * The account's tier as this device knows it: the API's last word, else the
 * save's thank-yous (`savedSupporterTier`, never Diamond). Diamond, and a
 * pledge that ended, only come from the API. It only decides what's drawn
 * (the badge, the companion), never anything in a run.
 */
export const knownTier = (save: Save): SupporterTier | null => {
  const status = knownStatus()
  return status ? status.tier : savedSupporterTier(save)
}

/** Whether the API last said this account is an OG Supporter (its plate beside the heart). Only the API knows. */
export const knownOg = () => knownStatus()?.og ?? false

/** The signed-in player's standing (kept for `knownTier`), or null (guest, offline). */
export const fetchSupporterStatus = async (): Promise<SupporterStatus | null> => {
  const { status, body } = await apiCall('/me/supporter', { auth: true })
  const parsed = status === 200 ? parseSupporterStatus(body) : null
  if (parsed) storeStatus(parsed)
  return parsed
}

/** Dev: stands the device at `tier` (an OG for `og`) as if the API said so (`ps.supporter`). */
export const stageSupporterStatus = (tier: SupporterTier, og = false) =>
  storeStatus({ tier, since: new Date().toISOString(), public: true, og, vote: null, diamondVote: null, patreon: null })

let asked: string | null = null

/** Asks the API for the standing once per signed-in account per page, so `knownTier` follows a pledge that changed. */
export const watchSupporterStatus = () =>
  onAccountChange((s) => {
    const userId = accountUserId()
    if (s.kind !== 'signedIn' || !userId || asked === userId) return
    asked = userId
    void fetchSupporterStatus()
  })

/** Shows or hides the player's badge and name. Their standing after it, or null when it didn't go through. */
export const setSupporterPublic = async (show: boolean): Promise<SupporterStatus | null> => {
  const { status, body } = await apiCall('/me/supporter', { method: 'PUT', body: { public: show }, auth: true })
  const parsed = status === 200 ? parseSupporterStatus(body) : null
  if (parsed) storeStatus(parsed)
  return parsed
}

/** What redeeming a code came to: the tier the account has now, or why not. */
export type Redeemed = { ok: true; tier: SupporterTier | null } | { ok: false; reason: 'unknown' | 'used' | 'offline' }

/** Redeems a donation's code (already normalized by `parseCode`) for the signed-in player. */
export const redeemCode = async (code: string): Promise<Redeemed> => {
  const { status, body } = await apiCall('/donations/redeem', { method: 'POST', body: { code }, auth: true })
  if (status === 200) return { ok: true, tier: parseSupporterStatus(body)?.tier ?? null }
  if (status === 404) return { ok: false, reason: 'unknown' }
  if (status === 409) return { ok: false, reason: 'used' }
  return { ok: false, reason: 'offline' }
}

/**
 * "Link Patreon": leaves for Patreon's approval page, which comes back to
 * this page with `?patreon=linked` (or `failed`). False when the API
 * wouldn't give the way there.
 */
export const linkPatreon = async (): Promise<boolean> => {
  const { status, body } = await apiCall(`/patreon/link?page=${encodeURIComponent(location.pathname)}`, { auth: true })
  if (status !== 200 || !isRecord(body) || typeof body.url !== 'string') return false
  location.assign(body.url)
  return true
}

/** Forgets the player's Patreon. Whether it went through. */
export const unlinkPatreon = async () => (await apiCall('/patreon/link', { method: 'DELETE', auth: true })).status === 200

/** `?votar`, the polls' own link: the supporters' poll, Diamond's with `?votar=diamante` (or `diamond`); null without it. */
export const linkedPoll = (): PollKind | null => {
  const v = new URLSearchParams(location.search).get('votar')
  if (v === null) return null
  return v === 'diamante' || v === 'diamond' ? 'diamond' : 'supporters'
}

/** `?patreon=` on the way back from Patreon: how the link went, or null when the page didn't come from there. */
export const patreonReturn = (): 'linked' | 'failed' | null => {
  const v = new URLSearchParams(location.search).get('patreon')
  return v === 'linked' || v === 'failed' ? v : null
}

let wall: Promise<Wall | null> | null = null

/** The wall and the hidden supporters' counts, asked once per page (a failure asks again next time). Null when the API can't be reached. */
export const fetchWall = () =>
  (wall ??= apiCall('/supporters').then(({ status, body }) => {
    if (status !== 200 || !isRecord(body)) {
      wall = null
      return null
    }
    return { entries: parseWall(body.supporters), hidden: parseHidden(body.hidden) }
  }))

const POLL_PATHS = { supporters: '/poll', diamond: '/poll/diamond' } as const satisfies Record<PollKind, string>

/** The `kind` poll, or null when the API can't be reached. */
export const fetchPoll = async <K extends PollKind>(kind: K): Promise<Poll<K> | null> => {
  const { status, body } = await apiCall(POLL_PATHS[kind])
  return status === 200 ? parsePoll(body, kind) : null
}

/**
 * A vote in the `kind` poll, kept in the standing on the device (so the
 * lobby's Hall card stops calling to it). The poll after it, `denied` for
 * anyone who may not vote there, null offline.
 */
export const vote = async <K extends PollKind>(kind: K, choice: PollOption<K>): Promise<Poll<K> | 'denied' | null> => {
  const { status, body } = await apiCall(POLL_PATHS[kind], { method: 'PUT', body: { choice }, auth: true })
  if (status === 403) return 'denied'
  if (status !== 200) return null
  const kept = knownStatus()
  if (kept) storeStatus(withVote(kept, kind, choice))
  return parsePoll(body, kind)
}
