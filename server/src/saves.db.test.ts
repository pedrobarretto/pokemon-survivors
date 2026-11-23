import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { LEGENDS } from '../../src/data/legends'
import { SAVE_VERSION } from '../../src/game/meta'
import type { Sql } from './db'
import { ownTestDatabase } from './testDatabase'

/**
 * The stored saves' captured legends (`capturedLegends`, what `POST /looks`
 * vouches for a co-op Legend room) against a real Postgres: the throwaway
 * database of `ARENA_TEST_DATABASE_URL`, like the boards'. Skipped without it.
 */
const url = process.env.ARENA_TEST_DATABASE_URL

describe.skipIf(!url)('captured legends of stored saves (Postgres)', () => {
  let sql: Sql

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(await ownTestDatabase(url!, 'saves'), 2)
    await migrate(sql, new URL('../migrations/', import.meta.url))
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('lists only the legends a save has captured, by the solo rules, and leaves out accounts without one', async () => {
    const { saveStore } = await import('./db')
    const legends = { kyogre: LEGENDS.kyogre.unlock.wins, lugia: LEGENDS.lugia.unlock.wins - 1, missingno: 9 }
    await sql`insert into users (id) values ('a'), ('b'), ('c')`
    await sql`insert into saves (user_id, version, revision, data) values
      ('a', ${SAVE_VERSION}, 1, ${sql.json({ version: SAVE_VERSION, legends })}),
      ('b', 99, 1, ${sql.json({ version: 99, legends })})`
    const got = await saveStore(sql).capturedLegends(['a', 'b', 'c'])
    expect(Object.fromEntries(got)).toEqual({ a: ['kyogre'], b: [] })
  })
})
