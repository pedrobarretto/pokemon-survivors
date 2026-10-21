/**
 * The ranked kit's amnesty (`src/game/rankedKit.ts`, server/README "Ranked kit"): every account with a
 * stored save gets the kit it holds (what its ranks cost) as earned. Run it once, right after the deploy
 * that adds `users.kit_amnesty`, so the snapshot is of the saves as they were then.
 *
 *   npx tsx --env-file=.env scripts/kitAmnesty.ts [--exclude user_a,user_b] [--apply]
 *
 * A dry run by default: it prints what it would set and writes nothing. `--exclude` takes Clerk user ids
 * (comma separated) that get no amnesty (0), even if they already have one or no save yet. Idempotent: only
 * accounts still undecided (`kit_amnesty is null`) with a save are set, so running it again only applies exclusions.
 */
import { parseSaveData, totalSpent } from '../../src/game/meta'
import { selfConsistent } from '../../src/game/rankedKit'
import { worth } from '../../src/game/sync'
import { connect } from '../src/db'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const excludeAt = args.indexOf('--exclude')
const excluded = excludeAt >= 0 ? (args[excludeAt + 1] ?? '').split(',').map((id) => id.trim()).filter(Boolean) : []

const url = process.env.DATABASE_URL
if (!url) throw new Error('Missing DATABASE_URL')
const sql = connect(url)

type Row = { id: string; handle: string | null; was: number | null; data: unknown }

const rows = await sql<Row[]>`
  select u.id, u.handle, u.kit_amnesty as was, s.data from users u join saves s on s.user_id = u.id
  where u.kit_amnesty is null or u.id in ${sql(excluded.length > 0 ? excluded : [''])}`

const decided = rows.map((r) => {
  const save = parseSaveData(r.data)
  const out = excluded.includes(r.id)
  return { ...r, kit: totalSpent(save.ranks), worth: worth(save), coins: save.achievements.lifetime.coins, consistent: selfConsistent(save), out, amnesty: out ? 0 : totalSpent(save.ranks) }
})
const missing = excluded.filter((id) => !rows.some((r) => r.id === id))
const who = (r: { id: string; handle: string | null }) => `${r.id}${r.handle ? ` (@${r.handle})` : ''}`

console.log(`${decided.length} accounts to decide${apply ? '' : ' (dry run)'}`)
console.log(`  with a kit: ${decided.filter((r) => r.kit > 0).length}, amnesty total ${decided.reduce((sum, r) => sum + r.amnesty, 0)} ₽`)
console.log(`  saves that don't add up (for reference: they get their kit all the same, only an import after the deploy is held to it):`)
for (const r of decided.filter((r) => !r.consistent)) console.log(`    ${who(r)}: kit ${r.kit} ₽, fortune ${r.worth} ₽, coins picked up ${r.coins}`)
console.log(`  excluded (amnesty 0):`)
for (const r of decided.filter((r) => r.out)) console.log(`    ${who(r)}: kit ${r.kit} ₽, was ${r.was ?? 'undecided'}`)
if (missing.length > 0) console.log(`  excluded ids without a save (amnesty 0 all the same): ${missing.join(', ')}`)

if (apply) {
  await sql.begin(async (tx) => {
    const kept = decided.filter((r) => !r.out)
    const set = await tx`
      update users u set kit_amnesty = d.amnesty, kit_amnesty_at = now()
      from unnest(${kept.map((r) => r.id)}::text[], ${kept.map((r) => r.amnesty)}::int[]) as d(id, amnesty)
      where u.id = d.id and u.kit_amnesty is null`
    // An excluded account gets its row now if it has none, so its first push can't decide an amnesty.
    for (const id of excluded) {
      await tx`
        insert into users (id, kit_amnesty, kit_amnesty_at) values (${id}, 0, now())
        on conflict (id) do update set kit_amnesty = 0, kit_amnesty_at = now()`
    }
    console.log(`set ${set.count} accounts, excluded ${excluded.length}`)
  })
}
await sql.end()
