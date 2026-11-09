import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { brasiliaDay, weekStart } from '../../src/game/day'
import { DIG, shapeCells, type DigWall } from '../../src/realm/games/dig.rules'
import { digStore } from './dig'
import type { Sql } from './db'

/**
 * The Escavação's store against a real Postgres: set `REALM_TEST_DATABASE_URL`
 * to a throwaway database (it's wiped). Skipped without it, like the claw's.
 */
const url = process.env.REALM_TEST_DATABASE_URL

describe.skipIf(!url)('escavação (Postgres)', () => {
  let sql: Sql
  let dig: ReturnType<typeof digStore>
  const now = () => new Date('2026-11-10T15:00:00Z')

  const started = async (base: number | null = null, partner: string | null = null) => {
    const got = await dig.start('u_ash', base, partner)
    if (!got.ok) throw new Error(got.error)
    return got
  }

  /** Reads what the client must never see, straight from the store. */
  const hidden = async (id: string) => (await sql<{ built: { wall: DigWall } }[]>`select built from dig_walls where id = ${id}::uuid`)[0]!.built.wall

  /** Digs the treasure at `index` out fully with picks, from where the wall stands. */
  const digOut = async (id: string, t: number, start: number): Promise<number> => {
    let seq = start
    const wall = await hidden(id)
    const treasure = wall.treasures[t]!
    for (const { col, row } of shapeCells(treasure.id)) {
      const i = (treasure.y + row) * DIG.cols + treasure.x + col
      const left = wall.depths[i] ?? 1
      for (let k = 0; k < left; k++) {
        seq++
        const got = await dig.hit('u_ash', id, seq, 'pick', i)
        if (!got.ok) throw new Error(got.error)
      }
    }
    return seq
  }

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
  })

  beforeEach(async () => {
    await sql`truncate dig_walls, dig_hits, dig_progress, furniture_owned, gifts, saves, users cascade`
    dig = digStore(sql, { closed: async () => false, now })
    await sql`insert into users (id, handle, name) values ('u_ash', 'ash', 'Ash')`
    await sql`insert into users (id) values ('u_nohandle')`
    await sql`insert into saves (user_id, version, revision, data) values ('u_ash', 1, 3, ${sql.json({ version: 1, partner: 'squirtle', wallet: 3000, spent: 0 })})`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('needs a handle', async () => {
    expect(await dig.start('u_nohandle', null, null)).toEqual({ ok: false, error: 'profile' })
    expect(await dig.state('u_nohandle')).toBeNull()
  })

  it('charges the free wall once, an open wall comes back uncharged, then ₽ from the stored save', async () => {
    const first = await started()
    expect(first.used).toBe(1)
    expect((await started()).wall.id).toBe(first.wall.id)
    expect(await dig.stop('u_ash', first.wall.id)).toMatchObject({ ok: true })
    expect(await dig.start('u_ash', null, null)).toEqual({ ok: false, error: 'stale' })
    expect(await dig.start('u_ash', 2, null)).toEqual({ ok: false, error: 'stale' })
    const paid = await started(3)
    expect(paid.paid?.revision).toBe(4)
    expect(paid.paid?.save.wallet).toBe(1000)
    expect(paid.paid?.save.spent).toBe(DIG.price)
    await dig.stop('u_ash', paid.wall.id)
    expect(await dig.start('u_ash', 4, null)).toEqual({ ok: false, error: 'funds' })
  })

  it('stops at the daily cap', async () => {
    await sql`insert into dig_walls (user_id, day, week, seed, built, left_layers, ended_at) select 'u_ash', ${brasiliaDay(now())}::date, ${weekStart(brasiliaDay(now()))}::date, 1, '{}'::jsonb, '[]'::jsonb, now() from generate_series(1, ${DIG.dailyCap})`
    expect(await dig.start('u_ash', 3, null)).toEqual({ ok: false, error: 'cap' })
  })

  it('keeps the layout off the client: a view holds no treasures and shows only opened cells', async () => {
    const { wall } = await started()
    expect(JSON.stringify(wall)).not.toContain('treasures')
    const state = await dig.state('u_ash')
    expect(JSON.stringify(state)).not.toContain('"treasures"')
    expect(state?.open?.id).toBe(wall.id)
  })

  it('answers a repeated hit from the store, and refuses a hit out of order', async () => {
    const { wall } = await started()
    const a = await dig.hit('u_ash', wall.id, 1, 'pick', 0)
    if (!a.ok) throw new Error(a.error)
    expect(a.answer.cells.length).toBe(1)
    expect(await dig.hit('u_ash', wall.id, 3, 'pick', 1)).toEqual({ ok: false, error: 'seq' })
    expect(await dig.hit('u_ash', wall.id, 1, 'pick', 50)).toEqual({ ok: true, answer: JSON.parse(JSON.stringify(a.answer)) })
    const row = (await sql<{ seq: number; crack: number }[]>`select seq, crack from dig_walls where id = ${wall.id}::uuid`)[0]!
    expect(row.seq).toBe(1)
    expect(row.crack).toBe(DIG.pick)
  })

  it('pays out in one go when the wall collapses, and answers a stop after that the same', async () => {
    const { wall } = await started()
    await sql`update dig_walls set crack = ${(await hidden(wall.id)).cap - 1} where id = ${wall.id}::uuid`
    const last = await dig.hit('u_ash', wall.id, 1, 'hammer', 0)
    if (!last.ok) throw new Error(last.error)
    expect(last.answer.end?.outcome).toBe('collapse')
    const repeat = await dig.stop('u_ash', wall.id)
    expect(repeat).toEqual({ ok: true, end: JSON.parse(JSON.stringify(last.answer.end)) })
    expect((await dig.hit('u_ash', wall.id, 2, 'pick', 1))).toEqual({ ok: false, error: 'over' })
  })

  it('sends a treasure dug out as a keyed gift, and a lacked fossil as its family', async () => {
    // A wall that is one fossil only, dug out by the numbers the store holds.
    const { wall } = await started()
    const built = { wall: { ...(await hidden(wall.id)), treasures: [{ id: 'skullFossil' as const, x: 0, y: 0 }], depths: new Array<number>(DIG.cols * DIG.rows).fill(1), cap: 500 }, powers: { bigHammer: false, hold: 0, reveal: false, deepPick: false }, lacking: ['cranidos', 'shieldon', 'archen', 'tyrunt', 'amaura'] }
    await sql`update dig_walls set built = ${sql.json(built)}, left_layers = ${sql.json(new Array<number>(DIG.cols * DIG.rows).fill(1))} where id = ${wall.id}::uuid`
    const seq = await digOut(wall.id, 0, 0)
    const end = await dig.stop('u_ash', wall.id)
    if (!end.ok) throw new Error(end.error)
    expect(seq).toBeGreaterThan(0)
    expect(end.end.outcome).toBe('stopped')
    expect(end.end.kept).toEqual([{ id: 'skullFossil', prize: { kind: 'fossil', family: 'cranidos' }, repeat: false, coins: 0 }])
    expect(end.end.gifts.map((g) => g.content)).toEqual([{ kind: 'family', family: 'cranidos' }])
    expect((await sql<{ n: number }[]>`select count(*)::int as n from gifts where user_id = 'u_ash' and key like ${`dig:${wall.id}:%`}`)[0]!.n).toBe(1)
    expect((await sql<{ dry: number }[]>`select dry from dig_progress where user_id = 'u_ash'`)[0]!.dry).toBe(0)
  })

  it('pays a repeat fossil in ₽ instead of a family', async () => {
    await sql`update saves set data = ${sql.json({ version: 1, partner: 'squirtle', wallet: 0, spent: 0, hatched: { cranidos: { shiny: false } } })} where user_id = 'u_ash'`
    const { wall } = await started()
    const built = { wall: { ...(await hidden(wall.id)), treasures: [{ id: 'skullFossil' as const, x: 0, y: 0 }], depths: new Array<number>(DIG.cols * DIG.rows).fill(1), cap: 500 }, powers: { bigHammer: false, hold: 0, reveal: false, deepPick: false }, lacking: [] }
    await sql`update dig_walls set built = ${sql.json(built)}, left_layers = ${sql.json(new Array<number>(DIG.cols * DIG.rows).fill(1))} where id = ${wall.id}::uuid`
    await digOut(wall.id, 0, 0)
    const end = await dig.stop('u_ash', wall.id)
    if (!end.ok) throw new Error(end.error)
    expect(end.end.kept[0]).toMatchObject({ repeat: true, coins: 800 })
    expect(end.end.gifts.map((g) => g.content)).toEqual([{ kind: 'coins', amount: 800 }])
  })

  it('adds a dry wall to the streak and resets nothing when a guaranteed fossil gets buried', async () => {
    await sql`insert into dig_progress (user_id, dry) values ('u_ash', ${DIG.fossilGuarantee})`
    const { wall } = await started()
    const held = await hidden(wall.id)
    expect(held.guaranteed).toBe(true)
    await dig.stop('u_ash', wall.id)
    expect((await sql<{ dry: number }[]>`select dry from dig_progress where user_id = 'u_ash'`)[0]!.dry).toBe(DIG.fossilGuarantee)
  })

  it('reads a Rock partner off the stored save, not the client', async () => {
    await sql`update saves set data = ${sql.json({ version: 1, partner: 'squirtle', wallet: 0, spent: 0, hatched: { aron: { shiny: false } } })} where user_id = 'u_ash'`
    const asked = await started(null, 'aron')
    expect(asked.wall.powers.hold).toBeGreaterThan(0)
    await dig.stop('u_ash', asked.wall.id)
    await sql`delete from dig_walls where user_id = 'u_ash'`
    await sql`update saves set data = ${sql.json({ version: 1, partner: 'squirtle', wallet: 0, spent: 0 })} where user_id = 'u_ash'`
    const cheat = await started(null, 'aron')
    expect(cheat.wall.powers.hold).toBe(0)
  })
})
