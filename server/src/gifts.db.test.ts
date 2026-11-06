import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { REFERRAL } from '../../src/game/referral'
import type { Sql } from './db'
import { giftStore } from './gifts'

/**
 * Invites against a real Postgres: the same throwaway database as
 * `arena.db.test.ts` (`ARENA_TEST_DATABASE_URL`, wiped). Skipped without it.
 */
const url = process.env.ARENA_TEST_DATABASE_URL

describe.skipIf(!url)('invites (Postgres)', () => {
  let sql: Sql
  let gifts: ReturnType<typeof giftStore>

  /** A finished run of `user` that lasted `seconds`, in the game and on the clock. */
  const run = (user: string, seconds: number, verified: boolean | null = null) =>
    sql`insert into runs (user_id, started_at, finished_at, survived, verified) values (${user}, now() - make_interval(secs => ${seconds}), now(), ${seconds}, ${verified})`

  /** `n` friends of `inviter` who signed up with the link (`f0`, `f1`…), each with three runs of `seconds`. */
  const friends = async (inviter: string, n: number, seconds: number) => {
    for (let i = 0; i < n; i++) {
      const id = `f${i}`
      await sql`insert into users (id, handle) values (${id}, ${id})`
      expect(await gifts.refer(id, inviter)).toBe(true)
      for (let r = 0; r < REFERRAL.runs; r++) await run(id, seconds)
      await gifts.credit(id)
    }
  }

  const keys = async (user: string) => (await sql<{ key: string }[]>`select key from gifts where user_id = ${user} order by key`).map((r) => r.key)

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
    gifts = giftStore(sql)
  })

  beforeEach(async () => {
    await sql`truncate gifts, runs, follows, users cascade`
    await sql`insert into users (id, handle, name) values ('ash', 'ash', 'Ash')`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('welcomes the friend and counts them only after runs that really played', async () => {
    await sql`insert into users (id, handle) values ('misty', 'misty')`
    expect(await gifts.refer('misty', 'ash')).toBe(true)
    expect(await keys('misty')).toEqual(['welcome'])
    // Runs that end at once, or failed their check, never count.
    for (let r = 0; r < REFERRAL.runs; r++) await run('misty', REFERRAL.minSeconds - 1)
    await run('misty', 300, false)
    await gifts.credit('misty')
    expect(await keys('ash')).toEqual([])
    expect((await gifts.invites('ash'))[0]).toMatchObject({ runs: 0, counted: false })
    for (let r = 0; r < REFERRAL.runs; r++) await run('misty', REFERRAL.minSeconds)
    await gifts.credit('misty')
    expect(await keys('ash')).toEqual(['friends:1:0'])
    expect((await gifts.invites('ash'))[0]).toMatchObject({ runs: REFERRAL.runs, counted: true })
  })

  it("pays the 10 friends' title and background once, and settles them for whoever already passed it", async () => {
    await friends('ash', 10, 120)
    expect(await keys('ash')).toEqual(expect.arrayContaining(['friends:3:0', 'friends:3:1', 'friends:10:0', 'friends:10:1', 'friends:10:2']))
    const before = (await keys('ash')).length
    // An inviter paid before the new gifts: settling sends only what's missing, and again nothing.
    await sql`delete from gifts where user_id = 'ash' and key in ('friends:10:1', 'friends:10:2')`
    await gifts.settle()
    await gifts.settle()
    expect((await keys('ash')).length).toBe(before)
    const [legend] = await sql<{ payload: unknown }[]>`select payload from gifts where user_id = 'ash' and key = 'friends:10:1'`
    expect(legend?.payload).toEqual({ kind: 'title', title: 'friendLegend' })
  })
})
