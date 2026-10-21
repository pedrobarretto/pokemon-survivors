import type { BranchId } from '../../src/data/branches'
import type { PlayableId } from '../../src/data/hatchlings'
import type { Difficulty } from '../../src/game/difficulty'
import type { RunOutcome } from '../../src/game/ranking'
import { groupReports, REPORT, type Moderation, type OpenReport, type ReportDraft, type ReportGroup, type ReportReason } from '../../src/game/reports'
import type { Sql } from './db'

/** Open reports the Denúncias tab reads at most (before grouping). */
const OPEN_LIST = 500

/** What a report came to. `stored` also covers the ones dropped without a word (unknown player, a run that isn't theirs, sent before). */
export type Reported = 'stored' | 'self' | 'limit'

type OpenRow = {
  id: string
  reason: ReportReason
  note: string | null
  created_at: Date
  reporter: string | null
  target_id: string
  handle: string | null
  name: string | null
  banned_at: Date | null
  banned_reason: string | null
  run_id: string | null
  starter: PlayableId | null
  stage: number | null
  branch: BranchId | null
  difficulty: Difficulty | null
  survived: number | null
  kills: number | null
  level: number | null
  outcome: RunOutcome | null
  verified: boolean | null
  started_at: Date | null
}

const toOpen = (r: OpenRow): OpenReport => ({
  id: r.id,
  reason: r.reason,
  note: r.note,
  at: r.created_at.toISOString(),
  by: r.reporter,
  target: { id: r.target_id, handle: r.handle, name: r.name, banned: r.banned_at ? { at: r.banned_at.toISOString(), reason: r.banned_reason } : null },
  run:
    r.run_id && r.starter && r.difficulty && r.outcome && r.started_at
      ? {
          id: r.run_id,
          starter: r.starter,
          stage: r.stage ?? 0,
          branch: r.branch,
          difficulty: r.difficulty,
          time: r.survived ?? 0,
          kills: r.kills ?? 0,
          level: r.level ?? 0,
          outcome: r.outcome,
          verified: r.verified,
          at: r.started_at.toISOString(),
        }
      : null,
})

/**
 * Reports and bans. Players report a run or a player (`report`); the admin
 * lists the open ones grouped (`open`) and acts on a player (`act`), which
 * resolves their reports. A ban is `users.banned_at`: `banned` is what the
 * API's write gate asks (`BAN_GATED`), and the boards, profiles, the wall and
 * the ribbons leave banned players out on their own (`ranking.ts`, `supporters.ts`).
 */
export const moderationStore = (sql: Sql) => ({
  /** Whether `userId` is banned now. */
  banned: async (userId: string) => {
    const [row] = await sql<{ banned: boolean }[]>`select banned_at is not null as banned from users where id = ${userId}`
    return row?.banned ?? false
  },

  /**
   * Stores `reporterId`'s report. Whatever becomes of it, the answer says
   * nothing about the target: an unknown handle, a run that isn't theirs (or
   * didn't finish) and a report sent before are dropped as if stored. Only
   * what's about the reporter comes back: reporting oneself, and the daily limit.
   */
  report: (reporterId: string, draft: ReportDraft): Promise<Reported> =>
    sql.begin(async (tx) => {
      await tx`insert into users (id) values (${reporterId}) on conflict (id) do nothing`
      // Locking the reporter's row makes two reports at once take turns, so the limit holds.
      await tx`select id from users where id = ${reporterId} for update`
      const [target] = await tx<{ id: string }[]>`select id from users where handle = ${draft.target}`
      if (target?.id === reporterId) return 'self'
      const [recent] = await tx<{ n: number }[]>`select count(*)::int as n from reports where reporter_id = ${reporterId} and created_at > now() - interval '1 day'`
      if ((recent?.n ?? 0) >= REPORT.perDay) return 'limit'
      if (!target) return 'stored'
      if (draft.run) {
        const [run] = await tx`select 1 from runs where id = ${draft.run} and user_id = ${target.id} and finished_at is not null`
        if (!run) return 'stored'
        await tx`
          insert into reports (reporter_id, target_id, run_id, reason, note) values (${reporterId}, ${target.id}, ${draft.run}, ${draft.reason}, ${draft.note})
          on conflict (reporter_id, run_id) where run_id is not null do nothing`
      } else {
        await tx`
          insert into reports (reporter_id, target_id, reason, note) values (${reporterId}, ${target.id}, ${draft.reason}, ${draft.note})
          on conflict (reporter_id, target_id) where run_id is null do nothing`
      }
      console.log(`report on ${target.id}${draft.run ? ` run ${draft.run}` : ''} (${draft.reason}) by ${reporterId}`)
      return 'stored'
    }),

  /** The open reports, grouped (`groupReports`), and how many there are. */
  open: async (): Promise<{ groups: ReportGroup[]; open: number }> => {
    const rows = await sql<OpenRow[]>`
      select r.id, r.reason, r.note, r.created_at, p.handle as reporter, r.target_id, t.handle, t.name, t.banned_at, t.banned_reason,
        r.run_id, x.starter, x.stage, x.branch, x.difficulty, x.survived, x.kills, x.level, x.outcome, x.verified, x.started_at
      from reports r
      join users t on t.id = r.target_id
      left join users p on p.id = r.reporter_id
      left join runs x on x.id = r.run_id
      where r.resolved_at is null
      order by r.created_at limit ${OPEN_LIST}`
    const [count] = await sql<{ n: number }[]>`select count(*)::int as n from reports where resolved_at is null`
    return { groups: groupReports(rows.map(toOpen)), open: count?.n ?? 0 }
  },

  /**
   * Does what `m` says, as `adminId`, and resolves the reports it answers:
   * a run's removal (or dismissal) closes that run's reports, a player's
   * dismissal the ones without a run, and what touches the whole account
   * (reset, ban, unban) every open report on the player. A reset does what
   * server/README "Resetting a save" does by hand. Null for an unknown player or run.
   */
  act: (adminId: string, m: Moderation): Promise<{ resolved: number } | null> =>
    sql.begin(async (tx) => {
      await tx`insert into users (id) values (${adminId}) on conflict (id) do nothing`
      switch (m.action) {
        case 'remove': {
          const runs = await tx`update runs set verified = false where id = ${m.run} and user_id = ${m.userId} and finished_at is not null returning id`
          if (runs.length === 0) return null
          break
        }
        case 'dismiss': {
          const [user] = await tx`select 1 from users where id = ${m.userId}`
          if (!user) return null
          break
        }
        case 'ban':
          // A Clerk account that never synced gets its row now, so its first write is refused too.
          await tx`
            insert into users (id, banned_at, banned_reason) values (${m.userId}, now(), ${m.reason})
            on conflict (id) do update set banned_at = coalesce(users.banned_at, now()), banned_reason = excluded.banned_reason`
          break
        case 'unban': {
          const users = await tx`update users set banned_at = null, banned_reason = null where id = ${m.userId} returning id`
          if (users.length === 0) return null
          break
        }
        case 'reset': {
          const [user] = await tx`select 1 from users where id = ${m.userId} for update`
          if (!user) return null
          await tx`insert into save_resets (user_id, data, revision, reason) select user_id, data, revision, ${m.reason ?? 'edited save'} from saves where user_id = ${m.userId}`
          await tx`update saves set data = '{"version": 1}', version = 1, revision = revision + 1, updated_at = now() where user_id = ${m.userId}`
          // The wiped save's kit doesn't count as earned anymore (`rankedKit.ts`).
          await tx`update users set save_reset_revision = (select revision from saves where user_id = ${m.userId}), kit_amnesty = 0, kit_amnesty_at = now() where id = ${m.userId}`
          await tx`update runs set verified = false where user_id = ${m.userId} and finished_at is not null`
          break
        }
      }
      const run = m.action === 'remove' || m.action === 'dismiss' ? m.run : null
      const scope = run ? tx`and run_id = ${run}` : m.action === 'dismiss' ? tx`and run_id is null` : tx``
      const resolved = await tx`
        update reports set resolved_at = now(), resolved_by = ${adminId}, resolution = ${m.action}
        where resolved_at is null and target_id = ${m.userId} ${scope} returning id`
      console.log(`admin ${adminId}: ${m.action} on ${m.userId}${'run' in m && m.run ? ` run ${m.run}` : ''}${'reason' in m && m.reason ? ` (${m.reason})` : ''}, ${resolved.length} reports resolved`)
      return { resolved: resolved.length }
    }),
})

export type ModerationStore = ReturnType<typeof moderationStore>
