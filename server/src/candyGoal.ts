import { HALLOWEEN } from '../../src/data/halloween'
import { candyGoalAt, type CandyGoal } from '../../src/game/communityGoal'
import type { Sql } from './db'

/** How long the sum is kept per instance: it reads every stored save (about 350 ms), and the bar needn't move faster. */
const CACHE_MS = 120_000

/**
 * Meta da comunidade (`game/communityGoal.ts`): every account's candy jar
 * summed, each counting up to `HALLOWEEN.community.cap`, banned players' left
 * out. A jar only grows (`mergeSaves` keeps the fuller one), so the sum does
 * too, and once it reaches the goal it stays reached.
 */
export const candyGoalStore = (sql: Sql, now = () => Date.now()) => {
  let cached: { at: number; goal: CandyGoal } | null = null

  return {
    /** `GET /candy-goal`: the candies counted, the goal and whether they reached it. */
    status: async (): Promise<CandyGoal> => {
      const at = now()
      if (cached && at - cached.at < CACHE_MS) return cached.goal
      const [row] = await sql<{ candies: number }[]>`
        select coalesce(sum(least((s.data->'halloween'->>'candies')::float8, ${HALLOWEEN.community.cap})), 0)::float8 as candies
        from saves s join users u on u.id = s.user_id
        where u.banned_at is null and jsonb_typeof(s.data->'halloween'->'candies') = 'number'`
      const goal = candyGoalAt(Math.floor(row?.candies ?? 0))
      cached = { at, goal }
      return goal
    },
  }
}

export type CandyGoalStore = ReturnType<typeof candyGoalStore>
