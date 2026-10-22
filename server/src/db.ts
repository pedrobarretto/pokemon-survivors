import { readdir, readFile } from 'node:fs/promises'
import postgres from 'postgres'
import { mergeClears, wonClears } from '../../src/game/clears'
import { keepGiven, parseGiftContent } from '../../src/game/gifts'
import { gameGiftsApplied } from '../../src/game/gameGifts'
import { isFestivalGift } from '../../src/game/festival'
import { parseSaveData } from '../../src/game/meta'
import { applyPush, type Push, type Stored } from '../../src/game/sync'
import { festivalTotals } from './festival'

/**
 * Production goes through Supabase's transaction pooler, which hands each
 * transaction to any server connection, so named prepared statements are off.
 * Everything that needs one connection stays inside `sql.begin` (locks are `_xact_`).
 */
export const connect = (url: string) => postgres(url, { max: 10, prepare: false, onnotice: () => {} })

export type Sql = ReturnType<typeof connect>

/**
 * Runs the `.sql` files in `dir` that haven't run yet, in name order, each in
 * its own transaction. An advisory lock keeps two booting instances from racing.
 */
export const migrate = async (sql: Sql, dir: URL) => {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()
  await sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(7428)`
    await tx`create table if not exists migrations (name text primary key, ran_at timestamptz not null default now())`
    const done = new Set((await tx<{ name: string }[]>`select name from migrations`).map((r) => r.name))
    for (const file of files.filter((f) => !done.has(f))) {
      await tx.unsafe(await readFile(new URL(file, dir), 'utf8'))
      await tx`insert into migrations (name) values (${file})`
      console.log(`migrated ${file}`)
    }
  })
}

type SaveRow = { data: unknown; revision: number }

/** Stored rows go through `parseSaveData` too, so an older schema comes back current. */
const toStored = (row: SaveRow | undefined): Stored | null => (row ? { save: parseSaveData(row.data), revision: row.revision } : null)

/** Saves of players, by Clerk user id. */
export const saveStore = (sql: Sql) => ({
  read: async (userId: string) => toStored((await sql<SaveRow[]>`select data, revision from saves where user_id = ${userId}`)[0]),

  /**
   * Applies a push (`applyPush`) and returns what was stored. Locking the
   * player's row makes pushes from two devices take turns. The player's ranked
   * wins (not failed by their check) add their clears, so wins from before
   * clears were tracked, or from a device that lost its save, still count.
   * Gift-only rewards stay only if the player's gifts brought them (`keepGiven`):
   * an edited save can't give itself the Supporter title or a ribbon. The
   * game's own gifts it applied and earned (`gameGiftsApplied`: the candy jar's, the
   * loyalty card's, the Tycoon's) count as given, and a Festival da Praça's
   * only as far as the pot this API sums reached them (`festivalTotals`). After a
   * reset (`users.save_reset_revision`), devices that haven't seen it get the reset save back.
   */
  push: (userId: string, push: Push) =>
    sql.begin(async (tx) => {
      const [user] = await tx<{ reset: number | null }[]>`
        insert into users (id) values (${userId}) on conflict (id) do update set seen_at = now() returning save_reset_revision as reset`
      const stored = toStored((await tx<SaveRow[]>`select data, revision from saves where user_id = ${userId} for update`)[0])
      const applied = applyPush(stored, push, user?.reset ?? null)
      const won = await tx<{ starter: string; difficulty: string }[]>`
        select distinct starter, difficulty from runs
        where user_id = ${userId} and outcome = 'victory' and verified is not false`
      const gifts = await tx<{ id: string; payload: unknown }[]>`select id, payload from gifts where user_id = ${userId}`
      const given = gifts.flatMap((g) => {
        const content = parseGiftContent(g.payload)
        return content ? [{ id: g.id, content }] : []
      })
      // Only a save that opened a festival gift pays for the sums.
      const festival = applied.save.gifts.some(isFestivalGift) ? await festivalTotals(tx, userId) : undefined
      const next = { ...applied, save: keepGiven({ ...applied.save, clears: mergeClears(applied.save.clears, wonClears(won)) }, [...given, ...gameGiftsApplied(applied.save, festival)]) }
      await tx`
        insert into saves (user_id, version, revision, data)
        values (${userId}, ${next.save.version}, ${next.revision}, ${tx.json(next.save)})
        on conflict (user_id) do update
        set version = excluded.version, revision = excluded.revision, data = excluded.data, updated_at = now()`
      return next
    }),
})

export type SaveStore = ReturnType<typeof saveStore>
