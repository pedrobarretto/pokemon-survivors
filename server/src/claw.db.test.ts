import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PLUSH_POOL, type PlushFamily } from '../../src/data/plushes'
import { weekStart, brasiliaDay } from '../../src/game/day'
import { CLAW, pitLayout, weeklyPrizes } from '../../src/realm/games/claw.rules'
import { clawStore } from './claw'
import type { Sql } from './db'

/**
 * The claw machine's store against a real Postgres: set
 * `REALM_TEST_DATABASE_URL` to a throwaway database (it's wiped). Skipped
 * without it, like `realm.db.test.ts`.
 */
const url = process.env.REALM_TEST_DATABASE_URL

describe.skipIf(!url)('claw machine (Postgres)', () => {
  let sql: Sql
  let claw: ReturnType<typeof clawStore>
  const now = () => new Date('2026-11-10T15:00:00Z')
  const week = weekStart(brasiliaDay(now()))
  const prizes = weeklyPrizes(week, PLUSH_POOL)
  const plain = 0

  const inserted = async (base: number | null = null) => {
    const got = await claw.insert('u_ash', base)
    if (!got.ok) throw new Error(got.error)
    return got
  }

  /** Drops the next credit dead on the plush at `index`, as things stand. */
  const dropOn = async (index: number, offCenter = 0) => {
    const state = (await claw.state('u_ash'))!
    const { play } = state.open ? { play: state.open } : await inserted()
    const spot = pitLayout(play.week, state.misses, play.seed)[index]!
    const got = await claw.drop('u_ash', play.id, { x: spot.x + offCenter, y: spot.y })
    if (!got.ok) throw new Error(got.error)
    return { play, dropped: got.dropped }
  }

  const owned = async (family: PlushFamily) => (await sql<{ count: number }[]>`select count from furniture_owned where user_id = 'u_ash' and furniture = ${`plush:${family}`} and source = 'claw'`)[0]?.count ?? 0

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
  })

  beforeEach(async () => {
    await sql`truncate claw_plays, claw_progress, furniture_owned, gifts, saves, users cascade`
    claw = clawStore(sql, { closed: async () => false, now })
    await sql`insert into users (id, handle, name) values ('u_ash', 'ash', 'Ash')`
    await sql`insert into users (id) values ('u_nohandle')`
    await sql`insert into saves (user_id, version, revision, data) values ('u_ash', 1, 3, ${sql.json({ version: 1, partner: 'squirtle', wallet: 3000, spent: 0 })})`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('needs a handle', async () => {
    expect(await claw.insert('u_nohandle', null)).toEqual({ ok: false, error: 'profile' })
    expect(await claw.state('u_nohandle')).toBeNull()
  })

  it('charges the free credit once, keeps an open credit uncharged, then takes ₽ from the stored save', async () => {
    const first = await inserted()
    expect(first.used).toBe(1)
    expect((await inserted()).play.id).toBe(first.play.id)
    await dropOn(plain, CLAW.reach - 1)
    expect(await claw.insert('u_ash', null)).toEqual({ ok: false, error: 'stale' })
    expect(await claw.insert('u_ash', 2)).toEqual({ ok: false, error: 'stale' })
    const paid = await inserted(3)
    expect(paid.paid?.revision).toBe(4)
    expect(paid.paid?.save.wallet).toBe(1000)
    expect(paid.paid?.save.spent).toBe(CLAW.price)
    await claw.drop('u_ash', paid.play.id, { x: 0, y: 0 })
    expect(await claw.insert('u_ash', 4)).toEqual({ ok: false, error: 'funds' })
  })

  it('stops at the daily cap', async () => {
    await sql`insert into claw_plays (user_id, day, week, seed, dropped_at) select 'u_ash', ${brasiliaDay(now())}::date, ${week}::date, 1, now() from generate_series(1, ${CLAW.dailyCap})`
    expect(await claw.insert('u_ash', 3)).toEqual({ ok: false, error: 'cap' })
  })

  it('moves a missed plush a step and answers a repeated drop the same', async () => {
    const { play, dropped } = await dropOn(plain, CLAW.reach - 1)
    expect(dropped.won).toBe(false)
    expect(dropped.misses[plain]).toBe(1)
    expect((await claw.state('u_ash'))!.misses[plain]).toBe(1)
    expect(await claw.drop('u_ash', play.id, { x: 1, y: 1 })).toEqual({ ok: true, dropped: JSON.parse(JSON.stringify(dropped)) })
    expect((await claw.state('u_ash'))!.misses[plain]).toBe(1)
  })

  it('gives the piece on a win and starts the plush over; only the owner can drop', async () => {
    const { play } = await inserted()
    expect(await claw.drop('u_nohandle', play.id, { x: 0, y: 0 })).toEqual({ ok: false, error: 'profile' })
    const { dropped } = await dropOn(plain)
    expect(dropped.won).toBe(true)
    expect(await owned(prizes[plain]!)).toBe(1)
    expect(dropped.misses[plain]).toBe(0)
  })

  it('wins by the tenth credit however it drops, and only ever gives a plush', async () => {
    await sql`insert into claw_progress (user_id, family, misses) values ('u_ash', ${prizes[plain]!}, ${CLAW.guarantee - 1})`
    const { dropped } = await dropOn(plain, CLAW.reach * 0.9)
    expect(dropped.won).toBe(true)
    expect(await owned(prizes[plain]!)).toBe(1)
    expect((await sql<{ n: number }[]>`select count(*)::int as n from gifts where user_id = 'u_ash'`)[0]!.n).toBe(0)
  })
})
