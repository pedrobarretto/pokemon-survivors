import { CITY_IDS, type CityId } from '../net/realm'
import { REPORT_REASONS, type ReportReason } from '../net/realmApi'
import { isRecord } from '../game/parse'

/**
 * The Poké Realm's moderation, shared by the API (`server/src/realm.ts`) and
 * the admin's panel (`ui/admin.ts`, its Realm tab): trainers reported from
 * the realm (`POST /realm/report`) and realm bans, which keep an account out
 * of every city (the relay refuses it `banned`) without touching the rest of
 * the game. A ban lasts `days` or, with none, for good.
 */

/** How long a realm ban may be set for, in days (the panel offers a few; null is for good). */
export const REALM_BAN_DAYS = [1, 7, 30] as const

export const REALM_BAN_REASON_MAX = 200

/** What the admin does about a reported trainer: ban (for `days`, null for good), unban, or dismiss the reports. */
export type RealmModeration =
  | { action: 'ban'; userId: string; days: number | null; reason: string }
  | { action: 'unban' | 'dismiss'; userId: string }

/** `POST /admin/realm/moderation`'s body, or null when anything is off (a ban needs a reason). */
export const parseRealmModeration = (v: unknown): RealmModeration | null => {
  if (!isRecord(v) || typeof v.userId !== 'string' || !v.userId || v.userId.length > 100) return null
  const { userId } = v
  if (v.action === 'unban' || v.action === 'dismiss') return { action: v.action, userId }
  if (v.action !== 'ban') return null
  const reason = typeof v.reason === 'string' ? v.reason.replace(/\s+/g, ' ').trim() : ''
  const days = v.days === null || v.days === undefined ? null : typeof v.days === 'number' && Number.isInteger(v.days) && v.days > 0 && v.days <= 3650 ? v.days : undefined
  if (!reason || [...reason].length > REALM_BAN_REASON_MAX || days === undefined) return null
  return { action: 'ban', userId, days, reason }
}

/** A realm ban as the admin sees it: `until` null for good (ISO dates). */
export type RealmBan = { userId: string; handle: string | null; until: string | null; reason: string; at: string }

/** The open realm reports on one trainer: how many, why (count per reason), the cities and the latest. */
export type RealmReportGroup = {
  userId: string
  handle: string | null
  count: number
  reasons: Partial<Record<ReportReason, number>>
  cities: CityId[]
  latest: string
  reporters: string[]
  ban: RealmBan | null
}

/** `GET /admin/realm`: the open reports grouped by trainer, most reported first, and the bans in force. */
export type RealmDesk = { groups: RealmReportGroup[]; bans: RealmBan[] }

const parseBan = (v: unknown): RealmBan | null =>
  isRecord(v) && typeof v.userId === 'string' && typeof v.reason === 'string' && typeof v.at === 'string' && (v.until === null || typeof v.until === 'string')
    ? { userId: v.userId, handle: typeof v.handle === 'string' ? v.handle : null, until: v.until, reason: v.reason, at: v.at }
    : null

const parseGroup = (v: unknown): RealmReportGroup | null => {
  if (!isRecord(v) || typeof v.userId !== 'string' || typeof v.count !== 'number' || typeof v.latest !== 'string' || !isRecord(v.reasons)) return null
  const reasons: Partial<Record<ReportReason, number>> = {}
  for (const r of REPORT_REASONS) {
    const n = v.reasons[r]
    if (typeof n === 'number') reasons[r] = n
  }
  const listed = v.cities
  const cities = Array.isArray(listed) ? CITY_IDS.filter((c) => listed.includes(c)) : []
  const reporters = Array.isArray(v.reporters) ? v.reporters.filter((r): r is string => typeof r === 'string') : []
  return { userId: v.userId, handle: typeof v.handle === 'string' ? v.handle : null, count: v.count, reasons, cities, latest: v.latest, reporters, ban: parseBan(v.ban) }
}

/** `GET /admin/realm`'s answer, or null for anything else. */
export const parseRealmDesk = (v: unknown): RealmDesk | null =>
  isRecord(v) && Array.isArray(v.groups) && Array.isArray(v.bans)
    ? { groups: v.groups.flatMap((g) => parseGroup(g) ?? []), bans: v.bans.flatMap((b) => parseBan(b) ?? []) }
    : null
