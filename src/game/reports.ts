import type { BranchId } from '../data/branches'
import type { Ban } from './admin'
import type { PlayableId } from '../data/hatchlings'
import type { Difficulty } from './difficulty'
import { isRecord } from './parse'
import { parseHandle, type RunOutcome } from './ranking'

/**
 * Reports and bans: a signed-in player reports a run on the boards, or a
 * player from their profile (`POST /reports`), and the admin's Denúncias tab
 * looks at them grouped (`server/src/moderation.ts`). Moderation is reactive:
 * runs count as soon as they're reported, and only a report brings one
 * before an admin. Pure; shared with the API.
 */

/** Why a player is reported: cheating (a run or a save that can't be), an offensive name, or something else (the note says). */
export const REPORT_REASONS = ['cheating', 'name', 'other'] as const

export type ReportReason = (typeof REPORT_REASONS)[number]

/** The note's length in characters (code points), and how many reports a player may send in 24 hours. */
export const REPORT = { note: { max: 200 }, perDay: 10 } as const

/** What a player sends: who (their handle), the run if it's about one (its id), why, and an optional note. */
export type ReportDraft = { target: string; run: string | null; reason: ReportReason; note: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Control and invisible formatting characters (zero-width, bidi overrides). Whitespace ones are collapsed instead.
const INVISIBLE = /(?!\s)[\p{Cc}\p{Cf}]/gu

export const isReportReason = (v: unknown): v is ReportReason => REPORT_REASONS.some((r) => r === v)

/** A one-line text without invisible characters, null when empty; `undefined` when it's too long or not a string. */
const cleanLine = (v: unknown, max: number): string | null | undefined => {
  if (v === undefined || v === null) return null
  if (typeof v !== 'string') return undefined
  const text = v.replace(INVISIBLE, '').replace(/\s+/g, ' ').trim()
  if ([...text].length > max) return undefined
  return text || null
}

/** `POST /reports`'s body, cleaned: a valid handle and reason, a run id when given, the note on one line. Null when anything is off. */
export const parseReport = (v: unknown): ReportDraft | null => {
  if (!isRecord(v)) return null
  const target = parseHandle(v.target)
  const run = v.run === undefined || v.run === null ? null : typeof v.run === 'string' && UUID.test(v.run) ? v.run.toLowerCase() : undefined
  const note = cleanLine(v.note, REPORT.note.max)
  if (!target || run === undefined || !isReportReason(v.reason) || note === undefined) return null
  return { target, run, reason: v.reason, note }
}

/* ---------------- Bans ---------------- */

/**
 * The writes a banned account is refused (403): starting and finishing
 * ranked runs, pushing the save, reporting, posting ideas and voting.
 * `:x` stands for one path segment. Reads stay open, and the game keeps
 * playing as a guest would.
 */
export const BAN_GATED = ['POST /runs', 'POST /runs/:token/start', 'PUT /runs/:token/chunks/:seq', 'PUT /runs/:token', 'PUT /save', 'POST /reports', 'POST /suggestions', 'PUT /suggestions/:id/vote', 'PUT /poll', 'POST /coop-invites', 'POST /festival/donate', 'PUT /festival/public'] as const

const GATES = BAN_GATED.map((route) => {
  const [method, path] = route.split(' ') as [string, string]
  return { method, parts: path.split('/') }
})

/** Whether `method path` is one of `BAN_GATED`. */
export const banGated = (method: string, path: string) => {
  const parts = path.split('/')
  return GATES.some((g) => g.method === method.toUpperCase() && g.parts.length === parts.length && g.parts.every((p, i) => (p.startsWith(':') ? parts[i] !== '' : p === parts[i])))
}

/* ---------------- The admin's side ---------------- */

/** A reported player as the admin sees them. `banned`: since when and why, null when they aren't. */
export type ReportTarget = { id: string; handle: string | null; name: string | null; banned: Ban | null }

/** A reported run's numbers. `verified`: null while it wasn't checked (or is waiting). */
export type ReportedRun = {
  id: string
  starter: PlayableId
  stage: number
  branch: BranchId | null
  difficulty: Difficulty
  time: number
  kills: number
  level: number
  outcome: RunOutcome
  verified: boolean | null
  at: string
}

/** One open report, as the API reads it. `by`: the reporter's handle (null before they picked one). */
export type OpenReport = { id: string; reason: ReportReason; note: string | null; at: string; by: string | null; target: ReportTarget; run: ReportedRun | null }

/** A note left with a report, and who left it. */
export type ReportNote = { text: string; by: string | null; at: string }

/**
 * The open reports on one run, or on one player when they aren't about a
 * run: how many, by reason, the notes, and when the first and last came.
 * `key` is `run:<id>` or `player:<id>`.
 */
export type ReportGroup = {
  key: string
  target: ReportTarget
  run: ReportedRun | null
  count: number
  reasons: Record<ReportReason, number>
  notes: ReportNote[]
  first: string
  last: string
}

const noReasons = (): Record<ReportReason, number> => ({ cheating: 0, name: 0, other: 0 })

/** Groups open reports by run, or by player for the ones without a run: the most reported first, then the oldest. */
export const groupReports = (reports: readonly OpenReport[]): ReportGroup[] => {
  const groups = new Map<string, ReportGroup>()
  for (const r of [...reports].sort((a, b) => a.at.localeCompare(b.at))) {
    const key = r.run ? `run:${r.run.id}` : `player:${r.target.id}`
    const group = groups.get(key) ?? { key, target: r.target, run: r.run, count: 0, reasons: noReasons(), notes: [], first: r.at, last: r.at }
    group.count++
    group.reasons[r.reason]++
    if (r.note) group.notes.push({ text: r.note, by: r.by, at: r.at })
    group.last = r.at
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || a.first.localeCompare(b.first))
}

/**
 * What an admin does about a player, from a report group or from the
 * player search: take a run off the boards (`remove`), wipe the save
 * (`reset`), ban (with a reason) or unban, or dismiss the reports with no action.
 */
export const MODERATION_ACTIONS = ['remove', 'reset', 'ban', 'unban', 'dismiss'] as const

export type ModerationAction = (typeof MODERATION_ACTIONS)[number]

/** `run`: the run `remove` takes off, or the run group `dismiss` closes (null: the player's reports without a run). */
export type Moderation =
  | { action: 'remove'; userId: string; run: string }
  | { action: 'dismiss'; userId: string; run: string | null }
  | { action: 'ban'; userId: string; reason: string }
  | { action: 'reset' | 'unban'; userId: string; reason: string | null }

/** A ban's reason, or a reset's: one line, this long at most. */
export const MODERATION_REASON_MAX = 200

/** `POST /admin/moderation`'s body. Null when it doesn't make one action (a ban without a reason, a removal without a run). */
export const parseModeration = (v: unknown): Moderation | null => {
  if (!isRecord(v) || typeof v.userId !== 'string' || !v.userId || v.userId.length > 100) return null
  const { userId } = v
  const run = typeof v.run === 'string' && UUID.test(v.run) ? v.run.toLowerCase() : null
  const reason = cleanLine(v.reason, MODERATION_REASON_MAX)
  if (reason === undefined) return null
  switch (v.action) {
    case 'remove':
      return run ? { action: 'remove', userId, run } : null
    case 'dismiss':
      return { action: 'dismiss', userId, run }
    case 'ban':
      return reason ? { action: 'ban', userId, reason } : null
    case 'reset':
    case 'unban':
      return { action: v.action, userId, reason }
    default:
      return null
  }
}
