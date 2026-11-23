import type { TransactionSql } from 'postgres'
import type { GiftContent } from '../../src/game/gifts'
import { mayRequest, parseCreatorLinks, reviewed, type CreatorDesk, type CreatorDeskEntry, type CreatorLink, type CreatorRequest, type CreatorReview, type CreatorStatus } from '../../src/net/creatorTag'
import type { Sql } from './db'
import { sendGift } from './gifts'
import type { StaffChannel } from './realm'

/**
 * The verified content creator's tag (`src/net/creatorTag.ts`): a player's
 * request (`creator_requests`, one row per account), the admin desk's review
 * and what an approved account shows to others (`approvedLinks`, read by the
 * Realm's identity and the public profile). Approving sends the Criador(a) de
 * Conteúdo title and frame as staff gifts, once per account (keyed), so a
 * revoked creator approved again gets nothing twice; revoking takes the tag
 * and its links away, not what the gifts gave.
 */

/** The gifts an approval sends, each under its key. */
export const CREATOR_GIFTS = [
  { key: 'creator:title', content: { kind: 'title', title: 'creator' } },
  { key: 'creator:frame', content: { kind: 'style', style: { slot: 'frame', id: 'creator' } } },
] as const satisfies readonly { key: string; content: GiftContent }[]

/** Approved creators the desk lists (to revoke), newest first. */
const APPROVED_LISTED = 100

type Row = { status: CreatorStatus; links: unknown; requested_at: Date; reviewed_at: Date | null }

const requestOf = (r: Row): CreatorRequest | null => {
  const links = parseCreatorLinks(r.links)
  return links && { status: r.status, links, at: r.requested_at.toISOString(), reviewedAt: r.reviewed_at?.toISOString() ?? null }
}

/** Why a request can't go: no @handle, a ban, or one already waiting or approved. */
export type CreatorRefusal = 'profile' | 'banned' | 'open'

/** Why a review can't go: no request from that account, or it isn't in a state the action takes. */
export type ReviewRefusal = 'unknown' | 'state'

/** The approved links of these accounts (only the ones whose links still read as valid). */
export const approvedLinks = async (sql: Sql | TransactionSql, userIds: readonly string[]): Promise<Map<string, CreatorLink[]>> => {
  if (userIds.length === 0) return new Map()
  const rows = await sql<{ user_id: string; links: unknown }[]>`select user_id, links from creator_requests where status = 'approved' and user_id = any(${[...userIds]}::text[])`
  return new Map(rows.flatMap((r) => {
    const links = parseCreatorLinks(r.links)
    return links ? [[r.user_id, links] as const] : []
  }))
}

/** A new request as a line for the staff's #mod-chat: links in `<>` so Discord doesn't unfurl them. */
export const requestLine = (handle: string, links: readonly CreatorLink[]) =>
  `🎥 @${handle} pediu a tag de criador de conteúdo: ${links.map((l) => `<${l.url}>`).join(' · ')} (aprove no Painel admin › Criadores)`

export const creatorStore = (sql: Sql, deps: { staff?: StaffChannel | null } = {}) => ({
  /** The account's own request, or null. */
  mine: async (userId: string): Promise<CreatorRequest | null> => {
    const [row] = await sql<Row[]>`select status, links, requested_at, reviewed_at from creator_requests where user_id = ${userId}`
    return row ? requestOf(row) : null
  },

  /**
   * Sends (or sends again, after a rejection or a revocation) the account's
   * request with `links` (already normalized). Holds the account's row, so two
   * at once can't both go. Posts it in #mod-chat when the bot is set up.
   */
  request: async (userId: string, links: readonly CreatorLink[]): Promise<{ ok: true; request: CreatorRequest } | { ok: false; error: CreatorRefusal }> => {
    const out = await sql.begin(async (tx) => {
      const [user] = await tx<{ handle: string | null; banned: boolean }[]>`select handle, banned_at is not null as banned from users where id = ${userId} for update`
      if (!user?.handle) return { ok: false, error: 'profile' } as const
      if (user.banned) return { ok: false, error: 'banned' } as const
      const [had] = await tx<{ status: CreatorStatus }[]>`select status from creator_requests where user_id = ${userId}`
      if (!mayRequest(had?.status ?? null)) return { ok: false, error: 'open' } as const
      const [row] = await tx<Row[]>`
        insert into creator_requests (user_id, links, status, requested_at, reviewed_at, reviewed_by)
        values (${userId}, ${tx.json(links.map((l) => ({ platform: l.platform, url: l.url })))}, 'pending', now(), null, null)
        on conflict (user_id) do update set links = excluded.links, status = 'pending', requested_at = now(), reviewed_at = null, reviewed_by = null
        returning status, links, requested_at, reviewed_at`
      const request = row ? requestOf(row) : null
      return request ? ({ ok: true, request, handle: user.handle } as const) : ({ ok: false, error: 'profile' } as const)
    })
    if (!out.ok) return out
    await deps.staff?.post(requestLine(out.handle, out.request.links)).catch((err) => console.error('creator request post failed', err))
    return { ok: true, request: out.request }
  },

  /** The desk: requests waiting, oldest first, and the approved creators, newest first. */
  desk: async (): Promise<CreatorDesk> => {
    type DeskRow = Row & { user_id: string; handle: string | null; name: string | null; reviewer: string | null }
    const [pending, approved] = await Promise.all([
      sql<DeskRow[]>`
        select c.user_id, c.status, c.links, c.requested_at, c.reviewed_at, u.handle, u.name, r.handle as reviewer
        from creator_requests c join users u on u.id = c.user_id left join users r on r.id = c.reviewed_by
        where c.status = 'pending' order by c.requested_at`,
      sql<DeskRow[]>`
        select c.user_id, c.status, c.links, c.requested_at, c.reviewed_at, u.handle, u.name, r.handle as reviewer
        from creator_requests c join users u on u.id = c.user_id left join users r on r.id = c.reviewed_by
        where c.status = 'approved' order by c.reviewed_at desc limit ${APPROVED_LISTED}`,
    ])
    const entries = (rows: readonly DeskRow[]) =>
      rows.flatMap((r): CreatorDeskEntry[] => {
        const request = requestOf(r)
        return request ? [{ ...request, userId: r.user_id, handle: r.handle, name: r.name, reviewedBy: r.reviewer }] : []
      })
    return { pending: entries(pending), approved: entries(approved) }
  },

  /**
   * `adminId` approves, rejects or revokes `userId`'s request. Approving sends
   * the creator title and frame as gifts from the admin's handle (keyed per
   * account: never twice). The new status, or why it didn't go.
   */
  review: (adminId: string, userId: string, action: CreatorReview): Promise<{ ok: true; status: CreatorStatus } | { ok: false; error: ReviewRefusal }> =>
    sql.begin(async (tx) => {
      const [row] = await tx<{ status: CreatorStatus }[]>`select status from creator_requests where user_id = ${userId} for update`
      if (!row) return { ok: false, error: 'unknown' } as const
      const next = reviewed(row.status, action)
      if (!next) return { ok: false, error: 'state' } as const
      await tx`insert into users (id) values (${adminId}) on conflict (id) do nothing`
      await tx`update creator_requests set status = ${next}, reviewed_at = now(), reviewed_by = ${adminId} where user_id = ${userId}`
      if (next === 'approved') {
        const [admin] = await tx<{ handle: string | null }[]>`select handle from users where id = ${adminId}`
        for (const g of CREATOR_GIFTS) await sendGift(tx, userId, g.content, { kind: 'staff', from: admin?.handle ?? null }, g.key, adminId)
      }
      console.log(`admin ${adminId} set the creator request of ${userId} to ${next}`)
      return { ok: true, status: next } as const
    }),
})

export type CreatorStore = ReturnType<typeof creatorStore>
