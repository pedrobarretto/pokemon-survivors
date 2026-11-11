import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { HATCHLING_IDS, type HatchlingId } from '../../src/data/hatchlings'
import { SAFARI_ONLY } from '../../src/data/safari'
import { brasiliaDay } from '../../src/game/day'
import type { SafariSession } from '../../src/net/realmApi'
import { SAFARI } from '../../src/realm/games/safari.rules'
import type { Sql } from './db'
import { applyDeeds } from './realmDeeds'
import { safariStore } from './safari'

/**
 * The Zona Safári's store against a real Postgres: set
 * `REALM_TEST_DATABASE_URL` to a throwaway database (it's wiped). Skipped
 * without it, like `claw.db.test.ts`.
 */
const url = process.env.REALM_TEST_DATABASE_URL

describe.skipIf(!url)('Zona Safári (Postgres)', () => {
  let sql: Sql
  let safari: ReturnType<typeof safariStore>
  /** What the dice answer next: the list in turn, then `after`. */
  let rolls: number[] = []
  let after = 0.5
  const now = () => new Date('2026-11-10T15:00:00Z')
  const dice = () => rolls.shift() ?? after

  const started = async (base: number | null = null) => {
    const got = await safari.start('u_ash', base)
    if (!got.ok) throw new Error(got.error)
    return got
  }

  const act = async (session: SafariSession, turn: number, action: Parameters<typeof safari.act>[3]) => {
    const got = await safari.act('u_ash', session.id, turn, action)
    if (!got.ok) throw new Error(got.error)
    return got.acted
  }

  /** Who the API rolled for a session, in order, which only it knows. */
  const hiding = async (id: string) => await sql<{ family: HatchlingId; sure: boolean }[]>`select b->>'family' as family, (b->>'sure')::boolean as sure from safari_sessions, jsonb_array_elements(state->'run'->'queue') b where id = ${id}::uuid`

  /** What reached the Estampas: the deed counts and the stamps. */
  const book = async () => ({
    deeds: Object.fromEntries((await sql<{ deed: string; count: number }[]>`select deed, count from realm_deeds where user_id = 'u_ash'`).map((r) => [r.deed, r.count])),
    stamps: (await sql<{ stamp: string }[]>`select stamp from realm_stamps where user_id = 'u_ash' order by stamp`).map((r) => r.stamp),
  })

  const dry = async () => (await sql<{ dry: number }[]>`select dry from safari_progress where user_id = 'u_ash'`)[0]?.dry ?? 0

  const setSave = async (data: Record<string, unknown>, revision = 3) => {
    await sql`delete from saves where user_id = 'u_ash'`
    await sql`insert into saves (user_id, version, revision, data) values ('u_ash', 1, ${revision}, ${sql.json({ version: 1, partner: 'squirtle', wallet: 3000, spent: 0, ...data } as never)})`
  }

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
  })

  beforeEach(async () => {
    await sql`truncate safari_sessions, safari_progress, gifts, saves, users cascade`
    safari = safariStore(sql, { closed: async () => false, earn: (userId, deeds) => sql.begin((tx) => applyDeeds(tx, userId, deeds, brasiliaDay(now()))).then(() => undefined), now, dice })
    rolls = []
    after = 0.5
    await sql`insert into users (id, handle, name) values ('u_ash', 'ash', 'Ash')`
    await sql`insert into users (id) values ('u_nohandle')`
    await setSave({})
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('needs a handle', async () => {
    expect(await safari.start('u_nohandle', null)).toEqual({ ok: false, error: 'profile' })
    expect(await safari.state('u_nohandle')).toBeNull()
  })

  it('charges the free session once, keeps an open one uncharged, then takes ₽ from the stored save', async () => {
    const first = await started()
    expect(first.used).toBe(1)
    expect((await started()).session.id).toBe(first.session.id)
    await act(first.session, 0, { kind: 'finish' })
    expect(await safari.start('u_ash', null)).toEqual({ ok: false, error: 'stale' })
    expect(await safari.start('u_ash', 2)).toEqual({ ok: false, error: 'stale' })
    const paid = await started(3)
    expect(paid.paid?.revision).toBe(4)
    expect(paid.paid?.save.wallet).toBe(0)
    expect(paid.paid?.save.spent).toBe(SAFARI.price)
    await act(paid.session, 0, { kind: 'finish' })
    expect(await safari.start('u_ash', 4)).toEqual({ ok: false, error: 'funds' })
  })

  it('stops at the daily cap', async () => {
    const day = brasiliaDay(now())
    await sql`insert into safari_sessions (user_id, day, week, habitat, state, finished_at) select 'u_ash', ${day}::date, ${day}::date, 'meadow', '{}'::jsonb, now() from generate_series(1, ${SAFARI.dailyCap})`
    expect(await safari.start('u_ash', 3)).toEqual({ ok: false, error: 'cap' })
  })

  it('never names who is still to come, and reveals them in the order they were rolled', async () => {
    const { session } = await started()
    const names = await hiding(session.id)
    const sent = JSON.stringify(session)
    for (const { family } of names) expect(sent).not.toContain(`"${family}"`)
    expect(session.encounter).toBeNull()
    expect(session.left).toBe(SAFARI.encounters)
    const met = await act(session, 0, { kind: 'grass' })
    expect(met.turn).toMatchObject({ kind: 'appear', family: names[0]!.family })
    expect(met.session.encounter?.family).toBe(names[0]!.family)
    expect(met.session.left).toBe(SAFARI.encounters - 1)
    await act(session, 1, { kind: 'leave' })
    expect((await act(session, 2, { kind: 'grass' })).turn).toMatchObject({ family: names[1]!.family })
  })

  it('answers a repeated action the same, refuses one from the future and another player’s session', async () => {
    const { session } = await started()
    const met = await act(session, 0, { kind: 'grass' })
    rolls = [0.99]
    const thrown = await act(session, 1, { kind: 'ball' })
    rolls = [0, 0, 0]
    const again = await act(session, 1, { kind: 'ball' })
    expect(again.turn).toEqual(JSON.parse(JSON.stringify(thrown.turn)))
    expect(again.session.balls).toBe(thrown.session.balls)
    expect((await act(session, 0, { kind: 'leave' })).turn).toEqual(JSON.parse(JSON.stringify(met.turn)))
    expect(await safari.act('u_ash', session.id, 9, { kind: 'leave' })).toEqual({ ok: false, error: 'stale' })
    await sql`insert into users (id, handle, name) values ('u_gary', 'gary', 'Gary')`
    expect(await safari.act('u_gary', session.id, 2, { kind: 'leave' })).toEqual({ ok: false, error: 'missing' })
  })

  /** Meets the first encounter and throws a ball that holds; what the turn answered. */
  const catchFirst = async (session: SafariSession) => {
    await act(session, 0, { kind: 'grass' })
    rolls = [0, 0, 0]
    return act(session, 1, { kind: 'ball' })
  }

  it('sends a family gift for a catch, with a key per catch, and starts the count over', async () => {
    await sql`insert into safari_progress (user_id, dry) values ('u_ash', 4)`
    const { session } = await started()
    const [first] = await hiding(session.id)
    const caught = await catchFirst(session)
    expect(caught.turn).toMatchObject({ kind: 'ball', caught: true, family: first!.family })
    expect(caught.gift).toMatchObject({ content: { kind: 'family', family: first!.family }, reason: { kind: 'season', way: 'safari' } })
    expect((await sql<{ n: number }[]>`select count(*)::int as n from gifts where user_id = 'u_ash' and key = ${`safari:${session.id}:1`}`)[0]!.n).toBe(1)
    await act(session, 2, { kind: 'finish' })
    expect(await dry()).toBe(0)
  })

  it('counts a catch for the Estampas once, never a ball that missed or a repeated throw', async () => {
    const { session } = await started()
    await act(session, 0, { kind: 'grass' })
    rolls = [0.99, 0.99]
    const missed = await act(session, 1, { kind: 'ball' })
    expect(missed.turn).toMatchObject({ caught: false, fled: false })
    expect(await book()).toEqual({ deeds: {}, stamps: [] })
    rolls = [0, 0, 0]
    await act(session, 2, { kind: 'ball' })
    await Promise.all([act(session, 2, { kind: 'ball' }), act(session, 2, { kind: 'ball' })])
    expect(await book()).toEqual({ deeds: { 'safari:catch': 1 }, stamps: ['safariCatch'] })
  })

  it('counts a shiny caught as a shiny too', async () => {
    const { session } = await started()
    await sql`update safari_sessions set state = jsonb_set(state, '{run,queue,0,shiny}', 'true') where id = ${session.id}::uuid`
    const caught = await catchFirst(session)
    expect(caught.turn).toMatchObject({ caught: true, shiny: true })
    expect(await book()).toEqual({ deeds: { 'safari:catch': 1, 'safari:shiny': 1 }, stamps: ['safariCatch', 'safariShiny'] })
  })

  it('counts a session whose catch the account already had', async () => {
    const hatched = Object.fromEntries(HATCHLING_IDS.map((id) => [id, { shiny: false }]))
    await setSave({ hatched })
    const { session } = await started()
    await catchFirst(session)
    await act(session, 2, { kind: 'finish' })
    expect(await dry()).toBe(1)
  })

  it('brings the guarantee at the tenth dry session: a Safari-only family, a catch that can’t fail or flee', async () => {
    await sql`insert into safari_progress (user_id, dry) values ('u_ash', ${SAFARI.guarantee})`
    expect((await safari.state('u_ash'))!.sure).toBe(true)
    const { session } = await started()
    expect(session.sureNext).toBe(true)
    const family = (await hiding(session.id))[0]!.family
    expect(SAFARI_ONLY as readonly string[]).toContain(family)
    await act(session, 0, { kind: 'grass' })
    after = 0.999
    const caught = await act(session, 1, { kind: 'ball' })
    expect(caught.turn).toMatchObject({ caught: true, shakes: 3, fled: false, family })
    await act(session, 2, { kind: 'finish' })
    expect(await dry()).toBe(0)
  })

  it('has no guarantee once nothing is left to get', async () => {
    await setSave({ hatched: Object.fromEntries(HATCHLING_IDS.map((id) => [id, { shiny: false }])) })
    await sql`insert into safari_progress (user_id, dry) values ('u_ash', ${SAFARI.guarantee + 5})`
    expect((await safari.state('u_ash'))!.sure).toBe(false)
    const { session } = await started()
    expect(session.sureNext).toBe(false)
  })
})
