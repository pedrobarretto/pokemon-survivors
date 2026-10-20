import { LIVE_HOURS, parseLive, type CreatorId, type CreatorLive } from '../../src/data/creators'
import type { Sql } from './db'

/**
 * Who is live now (`creator_live`). Going live holds `LIVE_HOURS` (going live
 * again while live renews it from now, keeping the stream's start), and
 * ending it deletes the row. `onLive` hears of a stream that just started,
 * once (the Discord bot posts it).
 */
export const creatorStore = (sql: Sql, hooks: { onLive?: (id: CreatorId, startedAt: Date) => void } = {}) => ({
  /** Creators live now, the newest stream first. */
  live: async (): Promise<CreatorLive[]> => {
    const rows = await sql<{ creator: string; until: Date }[]>`select creator, until from creator_live where until > now() order by started_at desc`
    return parseLive(rows.map((r) => ({ id: r.creator, until: r.until.toISOString() })), Date.now())
  },

  /** Turns `id`'s live on or off. The `until` it holds to, null once off. */
  set: async (id: CreatorId, live: boolean): Promise<string | null> => {
    if (!live) {
      await sql`delete from creator_live where creator = ${id}`
      return null
    }
    const [row] = await sql<{ until: Date; started_at: Date; fresh: boolean }[]>`
      insert into creator_live (creator, until) values (${id}, now() + ${LIVE_HOURS}::int * interval '1 hour')
      on conflict (creator) do update
      set until = excluded.until,
          started_at = case when creator_live.until > now() then creator_live.started_at else now() end
      returning until, started_at, started_at = now() as fresh`
    if (!row) return null
    if (row.fresh) hooks.onLive?.(id, row.started_at)
    return row.until.toISOString()
  },
})

export type CreatorStore = ReturnType<typeof creatorStore>
