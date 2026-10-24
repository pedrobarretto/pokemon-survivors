import { isVotable, SUGGESTION, type Suggestion, type SuggestionDraft, type SuggestionSort, type SuggestionStatus, type Vote } from '../../src/game/suggestions'
import type { Sql } from './db'

/** An idea's id (a uuid): anything else is an unknown idea, never a query. */
export const SUGGESTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Row = {
  id: string
  title: string
  body: string
  handle: string
  name: string | null
  status: Suggestion['status']
  score: number
  created_at: Date
  done_at: Date | null
  vote: number
  mine: boolean
}

const toSuggestion = (r: Row): Suggestion => ({
  id: r.id,
  title: r.title,
  body: r.body,
  handle: r.handle,
  name: r.name ?? r.handle,
  status: r.status,
  score: r.score,
  at: r.created_at.toISOString(),
  doneAt: r.done_at?.toISOString() ?? null,
  vote: r.vote === 1 || r.vote === -1 ? r.vote : 0,
  mine: r.mine,
})

export type Posted = { ok: true; suggestion: Suggestion } | { ok: false; error: 'profile' | 'limit' }

export type Voted = { ok: true; score: number; vote: Vote } | { ok: false; error: 'unknown' | 'closed' }

/** The decisions a review in the Discord makes: the Backlog, or off the board. */
export type Review = Extract<SuggestionStatus, 'open' | 'hidden'>

/**
 * The idea board, a kanban. Posting needs a handle (the board shows who
 * suggested it) and comes with the author's own up vote; a player posts
 * `SUGGESTION.perDay` ideas in 24 hours at most. A new idea waits for
 * review (`pending`, seen only by its author) until staff approve it in the
 * Discord (`review`); `onPosted` hands it to the bot. Anyone with an account
 * votes on the ideas on the board that haven't shipped, once each (changing
 * or taking it back). Only the admin moves an idea between columns (the
 * desk's route in `app.ts`); hidden ideas, and the ideas of a banned player,
 * leave every list.
 */
export const suggestionStore = (sql: Sql, opts: { onPosted?: (s: Suggestion) => void } = {}) => {
  const ORDER = {
    top: sql`s.score desc, s.created_at desc`,
    new: sql`s.created_at desc`,
    done: sql`s.done_at desc`,
  } as const satisfies Record<Exclude<SuggestionSort, 'board'>, unknown>

  /** Ideas as `viewer` sees them (their vote, whether they posted it). */
  const select = (viewer: string | null) => sql`
    select s.id, s.title, s.body, u.handle, u.name, s.status, s.score, s.created_at, s.done_at,
      coalesce((select v.value from suggestion_votes v where v.suggestion_id = s.id and v.user_id = ${viewer}), 0)::int as vote,
      coalesce(s.user_id = ${viewer}, false) as mine
    from suggestions s join users u on u.id = s.user_id`

  return {
    /**
     * The board: every column (`SUGGESTION.list` ideas each at most) plus the
     * viewer's own ideas waiting for review. The other sorts are earlier
     * builds' tabs: the Backlog by votes or newest first, or the shipped ones.
     */
    list: async (sort: SuggestionSort, viewer: string | null): Promise<Suggestion[]> => {
      if (sort === 'board') {
        // Each column ranked on its own: done_at is null outside `done`, so the others go by votes.
        const rows = await sql<Row[]>`
          select * from (
            select b.*, row_number() over (partition by b.status order by b.done_at desc nulls last, b.score desc, b.created_at desc) as n
            from (${select(viewer)}
              where (s.status in ('open', 'todo', 'cooking', 'done') or (s.status = 'pending' and s.user_id = ${viewer}))
                and u.handle is not null and u.banned_at is null) b
          ) x where n <= ${SUGGESTION.list} order by n`
        return rows.map(toSuggestion)
      }
      const status = sort === 'done' ? 'done' : 'open'
      const rows = await sql<Row[]>`${select(viewer)} where s.status = ${status} and u.handle is not null and u.banned_at is null order by ${ORDER[sort]} limit ${SUGGESTION.list}`
      return rows.map(toSuggestion)
    },

    /** Posts an idea for `userId`, with their up vote. `profile`: no handle yet; `limit`: too many in the last 24 hours. */
    post: (userId: string, draft: SuggestionDraft): Promise<Posted> =>
      sql.begin(async (tx) => {
        // Locking the author's row makes two posts at once take turns, so the limit holds.
        const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
        if (!user?.handle) return { ok: false, error: 'profile' } as const
        const [recent] = await tx<{ n: number }[]>`select count(*)::int as n from suggestions where user_id = ${userId} and created_at > now() - interval '1 day'`
        if ((recent?.n ?? 0) >= SUGGESTION.perDay) return { ok: false, error: 'limit' } as const
        const [row] = await tx<{ id: string }[]>`insert into suggestions (user_id, title, body, status, score) values (${userId}, ${draft.title}, ${draft.body}, 'pending', 1) returning id`
        await tx`insert into suggestion_votes (suggestion_id, user_id, value) values (${row!.id}, ${userId}, 1)`
        const [posted] = await tx<Row[]>`${select(userId)} where s.id = ${row!.id}`
        console.log(`suggestion ${row!.id} posted by ${userId}`)
        return { ok: true, suggestion: toSuggestion(posted!) } as const
      }).then((posted) => {
        if (posted.ok) opts.onPosted?.(posted.suggestion)
        return posted
      }),

    /** `userId`'s vote on an idea (0 takes it back), and its score after it. `unknown`: no such idea (or hidden, or under review); `closed`: it shipped. */
    vote: (userId: string, id: string, vote: Vote): Promise<Voted> =>
      sql.begin(async (tx) => {
        const [idea] = await tx<{ status: SuggestionStatus }[]>`select status from suggestions where id = ${id} for update`
        if (!idea || idea.status === 'hidden' || idea.status === 'pending') return { ok: false, error: 'unknown' } as const
        if (!isVotable(idea.status)) return { ok: false, error: 'closed' } as const
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        if (vote === 0) await tx`delete from suggestion_votes where suggestion_id = ${id} and user_id = ${userId}`
        else {
          await tx`
            insert into suggestion_votes (suggestion_id, user_id, value) values (${id}, ${userId}, ${vote})
            on conflict (suggestion_id, user_id) do update set value = excluded.value, voted_at = now()`
        }
        const [after] = await tx<{ score: number }[]>`
          update suggestions set score = (select coalesce(sum(value), 0) from suggestion_votes where suggestion_id = ${id})
          where id = ${id} returning score`
        return { ok: true, score: after!.score, vote } as const
      }),

    /** The game account with a handle linked to a Discord user, or null. */
    accountOf: async (discordId: string) =>
      (await sql<{ id: string; handle: string }[]>`select id, handle from users where discord_id = ${discordId} and handle is not null and banned_at is null`)[0] ?? null,

    /** An idea staff took from the Discord (`ideaWriter.ts`), credited to `userId` with their up vote: straight to the Backlog, past the review and the daily limit. */
    add: (userId: string, draft: SuggestionDraft): Promise<Suggestion> =>
      sql.begin(async (tx) => {
        const [row] = await tx<{ id: string }[]>`insert into suggestions (user_id, title, body, status, score) values (${userId}, ${draft.title}, ${draft.body}, 'open', 1) returning id`
        await tx`insert into suggestion_votes (suggestion_id, user_id, value) values (${row!.id}, ${userId}, 1)`
        const [added] = await tx<Row[]>`${select(userId)} where s.id = ${row!.id}`
        console.log(`suggestion ${row!.id} added from discord for ${userId}`)
        return toSuggestion(added!)
      }),

    /** Ideas still waiting for review, oldest first: the bot posts the ones it hasn't yet. */
    pending: async (): Promise<Suggestion[]> => {
      const rows = await sql<Row[]>`${select(null)} where s.status = 'pending' and u.handle is not null and u.banned_at is null order by s.created_at limit ${SUGGESTION.list}`
      return rows.map(toSuggestion)
    },

    /** Staff's review in the Discord: only an idea still pending moves, so a second reaction (or instance) changes nothing. Whether it moved. */
    review: async (id: string, status: Review) => {
      const rows = await sql`update suggestions set status = ${status} where id = ${id} and status = 'pending' returning id`
      return rows.length > 0
    },

    /** The admin sets an idea's status (`done` stamps when it shipped). False for an unknown idea. */
    setStatus: async (id: string, status: SuggestionStatus) => {
      const rows = await sql`
        update suggestions set status = ${status}, done_at = case when ${status} = 'done' then coalesce(done_at, now()) end
        where id = ${id} returning id`
      return rows.length > 0
    },
  }
}

export type SuggestionStore = ReturnType<typeof suggestionStore>
