import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { winsNeeded } from '../../src/game/capture'
import type { BaseLayout } from '../../src/data/secretBases'
import { MINIGAME_DAILY, MINIGAMES } from '../../src/data/minigames'
import type { GameClaim } from '../../src/net/realmApi'
import type { Sql } from './db'
import { realmStore } from './realm'

/**
 * The Poké Realm's store against a real Postgres: set
 * `REALM_TEST_DATABASE_URL` to a throwaway database (it's wiped). Skipped
 * without it, like `gems.db.test.ts`.
 */
const url = process.env.REALM_TEST_DATABASE_URL

const chairs = (n: number): BaseLayout => ({ exterior: 'tree', wallpaper: null, flooring: null, items: Array.from({ length: n }, (_, i) => ({ id: 'woodChair', x: i, y: 4, turned: false })) })

describe.skipIf(!url)('Poké Realm (Postgres)', () => {
  let sql: Sql
  let realm: ReturnType<typeof realmStore>
  let posted: string[]

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
  })

  beforeEach(async () => {
    await sql`truncate realm_game_days, realm_game_stats, furniture_owned, furniture_buys, bases, base_likes, base_visits, realm_bans, realm_reports, gem_ledger, cosmetics_owned, follows, saves, users cascade`
    posted = []
    realm = realmStore(sql, { staff: { post: async (line) => void posted.push(line) } })
    for (const [id, handle] of [['u_ash', 'ash'], ['u_misty', 'misty'], ['u_brock', 'brock']] as const) {
      await sql`insert into users (id, handle, name, gems) values (${id}, ${handle}, ${handle}, 1000)`
    }
    await sql`insert into users (id) values ('u_nohandle')`
    const save = { version: 1, partner: 'squirtle', wallet: 10_000, spent: 0, legends: { kyogre: winsNeeded('kyogre') } }
    await sql`insert into saves (user_id, version, revision, data) values ('u_ash', 1, 3, ${sql.json(save)})`
    // Misty and Ash follow each other; Brock follows Ash only.
    await sql`insert into follows (follower_id, followee_id) values ('u_ash', 'u_misty'), ('u_misty', 'u_ash'), ('u_brock', 'u_ash')`
  })

  afterAll(async () => {
    await sql?.end()
  })

  it('vouches for trainers with a handle, and keeps the banned out', async () => {
    await realm.act('u_admin', { action: 'ban', userId: 'u_brock', days: 7, reason: 'spam' })
    const got = await realm.identity(['u_ash', 'u_brock', 'u_nohandle', 'u_ghost'])
    expect(Object.keys(got.identities)).toEqual(['u_ash'])
    expect(got.identities.u_ash).toMatchObject({ handle: 'ash', partner: 'squirtle', shiny: false, supporter: null })
    expect(got.banned).toEqual(['u_brock'])
    await realm.act('u_admin', { action: 'unban', userId: 'u_brock' })
    expect(Object.keys((await realm.identity(['u_brock'])).identities)).toEqual(['u_brock'])
  })

  it('buys with gems through the ledger and with ₽ out of the stored save', async () => {
    const gems = await realm.buy('u_ash', { id: 'pikachuBed', pay: 'gems' }, 250)
    expect(gems).toMatchObject({ ok: true, pay: 'gems', balance: 750 })
    const [line] = await sql<{ reason: string; amount: number; ref: string }[]>`select reason, amount, ref from gem_ledger where user_id = 'u_ash'`
    expect(line).toMatchObject({ reason: 'furniture', amount: -250 })
    expect(line!.ref).toMatch(/^furniture:[0-9a-f-]{36}$/)
    expect(await realm.buy('u_ash', { id: 'woodChair', pay: 'coins', base: 2 }, 1500)).toEqual({ ok: false, error: 'stale' })
    const coins = await realm.buy('u_ash', { id: 'woodChair', pay: 'coins', base: 3 }, 1500)
    expect(coins).toMatchObject({ ok: true, pay: 'coins', revision: 4, save: { wallet: 8500, spent: 1500 } })
    // Bought pieces plus the captured legend's doll.
    expect(coins.ok && coins.furniture).toEqual({ woodChair: 1, pikachuBed: 1, 'doll:kyogre': 1 })
    expect(await realm.buy('u_misty', { id: 'woodChair', pay: 'coins', base: 0 }, 1500)).toEqual({ ok: false, error: 'nosave' })
    expect(await realm.buy('u_misty', { id: 'goldTrophyCase', pay: 'gems' }, 1200)).toEqual({ ok: false, error: 'gems' })
  })

  it('saves only what the account owns, and shows it by visibility', async () => {
    expect(await realm.save('u_ash', { layout: chairs(1), visibility: 'friends' })).toMatchObject({ ok: false, error: 'layout', layout: { error: 'owned', item: 0 } })
    await realm.buy('u_ash', { id: 'woodChair', pay: 'coins', base: 3 }, 1500)
    const saved = await realm.save('u_ash', { layout: chairs(1), visibility: 'friends' })
    expect(saved).toMatchObject({ ok: true, base: { handle: 'ash', partner: 'squirtle', visibility: 'friends', visits: 0 } })
    expect(await realm.base('u_misty', 'ash')).toMatchObject({ ok: true })
    expect(await realm.base('u_brock', 'ash')).toEqual({ ok: false, error: 'private' })
    expect(await realm.base('u_misty', 'brock')).toEqual({ ok: false, error: 'missing' })
    expect(await realm.save('u_nohandle', { layout: chairs(0), visibility: 'public' })).toEqual({ ok: false, error: 'profile' })
    const me = await realm.me('u_ash')
    expect(me.ok && me.base?.layout.items).toHaveLength(1)
    expect(await realm.me('u_nohandle')).toEqual({ ok: false, error: 'profile' })
  })

  it('counts a visit once per visitor a day, never the owner', async () => {
    await sql`insert into bases (user_id, layout, visibility, exterior, items) values ('u_ash', ${sql.json(chairs(0))}, 'public', 'tree', 0)`
    expect(await realm.visit('u_misty', 'ash')).toEqual({ allowed: true })
    expect(await realm.visit('u_misty', 'ash')).toEqual({ allowed: true })
    expect(await realm.visit('brock', 'ash')).toEqual({ allowed: true })
    expect(await realm.visit('u_ash', 'ash')).toEqual({ allowed: true })
    const [b] = await sql<{ visits: number }[]>`select visits from bases where user_id = 'u_ash'`
    expect(b!.visits).toBe(2)
    expect(await realm.visit('u_ash', 'misty')).toEqual({ allowed: false, why: 'missing' })
    // The owner comes into their own base before ever saving it.
    expect(await realm.visit('u_misty', 'misty')).toEqual({ allowed: true })
  })

  it('likes once, a second like takes it back; the board leaves private and empty bases out', async () => {
    await sql`insert into bases (user_id, layout, visibility, exterior, items) values ('u_ash', ${sql.json(chairs(0))}, 'public', 'tree', 1), ('u_misty', ${sql.json(chairs(0))}, 'private', 'cave', 3)`
    expect(await realm.like('u_misty', 'ash')).toEqual({ ok: true, likes: 1 })
    expect(await realm.like('u_brock', 'ash')).toEqual({ ok: true, likes: 2 })
    expect(await realm.like('u_misty', 'ash')).toEqual({ ok: true, likes: 1 })
    expect(await realm.like('u_ash', 'ash')).toEqual({ ok: false, error: 'self' })
    expect(await realm.like('u_ash', 'misty')).toEqual({ ok: false, error: 'private' })
    expect((await realm.list('u_brock', 'top')).map((b) => [b.handle, b.likes, b.exterior])).toEqual([['ash', 1, 'tree']])
    expect(await realm.list('u_brock', 'friends')).toEqual([])
    expect((await realm.list('u_misty', 'friends')).map((b) => b.handle)).toEqual(['ash'])
  })

  it('stores a report once, posts it to staff, and a ban resolves it', async () => {
    expect(await realm.report('u_ash', { handle: 'ash', reason: 'spam', city: 'pallet' })).toBe('self')
    expect(await realm.report('u_ash', { handle: 'brock', reason: 'harassment', city: 'pallet' })).toBe('stored')
    expect(await realm.report('u_ash', { handle: 'brock', reason: 'spam', city: 'pallet' })).toBe('stored')
    expect(await realm.report('u_ash', { handle: 'nobody', reason: 'spam', city: null })).toBe('stored')
    await new Promise((ok) => setTimeout(ok, 10))
    expect(posted).toHaveLength(1)
    expect(posted[0]).toContain('@brock for **harassment** by @ash in Pallet Town')
    const desk = await realm.desk()
    expect(desk.groups.map((g) => [g.handle, g.count])).toEqual([['brock', 1]])
    expect(await realm.act('u_admin', { action: 'ban', userId: 'u_brock', days: null, reason: 'harassment' })).toEqual({ resolved: 1 })
    const after = await realm.desk()
    expect(after.groups).toEqual([])
    expect(after.bans.map((b) => [b.handle, b.until])).toEqual([['brock', null]])
    expect(await realm.act('u_admin', { action: 'ban', userId: 'u_ghost', days: 1, reason: 'x' })).toBeNull()
  })

  it('tells the city counts and friends walking from the newest presence', async () => {
    realm.presence({ home: 'sa', at: 10, cities: { pallet: ['misty', 'brock'] } })
    realm.presence({ home: 'sa', at: 5, cities: { pallet: [] } })
    expect(realm.cities().cities).toEqual({ pallet: 2 })
    expect((await realm.friends('u_ash')).friends).toEqual([{ handle: 'misty', city: 'pallet' }])
  })

  /** The mini games' claims (`POST /realm/game/claim`). */
  describe('mini games', () => {
    const DAY = '2026-11-05'
    const fished = (score: number, feats: string[] = []): GameClaim => ({ game: 'fishing', outcome: { score }, ms: 90_000, feats })

    it('pays under the game\'s daily cap and counts the stats', async () => {
      const cap = MINIGAMES.fishing.pay.daily
      const perPlay = MINIGAMES.fishing.pay.perPlay
      let paid = 0
      for (let i = 0; i < 5; i++) {
        const got = await realm.claim('u_ash', fished(perPlay), perPlay, DAY)
        expect(got.ok).toBe(true)
        if (got.ok) paid += got.coins
      }
      expect(paid).toBe(cap)
      const [stats] = await sql<{ plays: number; best: number }[]>`select plays, best from realm_game_stats where user_id = 'u_ash' and game = 'fishing'`
      expect(stats).toEqual({ plays: 5, best: perPlay })
      // A new Brasília day pays again.
      expect(await realm.claim('u_ash', fished(100), 100, '2026-11-06')).toMatchObject({ ok: true, coins: 100, today: 100 })
    })

    it('caps every game together at the day\'s total', async () => {
      await sql`insert into realm_game_days (user_id, day, game, paid) values ('u_ash', ${DAY}::date, 'berryCatch', ${MINIGAME_DAILY - 30})`
      expect(await realm.claim('u_ash', fished(200), 200, DAY)).toMatchObject({ ok: true, coins: 30, today: MINIGAME_DAILY })
      expect(await realm.claim('u_ash', fished(200), 200, DAY)).toMatchObject({ ok: true, coins: 0, today: MINIGAME_DAILY })
    })

    it('grants a trophy once, when the stats first reach it, as game furniture', async () => {
      const first = await realm.claim('u_ash', fished(150, ['shinyGyarados', 'madeUp']), 150, DAY)
      expect(first).toMatchObject({ ok: true, trophies: ['shinyGyaradosTrophy'] })
      expect(first.ok && first.furniture?.shinyGyaradosTrophy).toBe(1)
      expect(await realm.claim('u_ash', fished(80, ['shinyGyarados']), 80, DAY)).toMatchObject({ ok: true, trophies: [], furniture: null })
      const [stats] = await sql<{ feats: string[] }[]>`select feats from realm_game_stats where user_id = 'u_ash'`
      expect(stats?.feats).toEqual(['shinyGyarados'])
      const owned = await sql<{ furniture: string; source: string; count: number }[]>`select furniture, source, count from furniture_owned where user_id = 'u_ash'`
      expect(owned).toEqual([{ furniture: 'shinyGyaradosTrophy', source: 'game', count: 1 }])
      // The best score's plaque.
      expect(await realm.claim('u_ash', fished(520), 250, DAY)).toMatchObject({ ok: true, trophies: ['goldenMagikarpPlaque'] })
      expect((await realm.me('u_ash')).ok && (await realm.me('u_ash'))).toMatchObject({ furniture: { shinyGyaradosTrophy: 1, goldenMagikarpPlaque: 1 } })
    })

    it('refuses an account without a handle, and one kept out of the realm', async () => {
      expect(await realm.claim('u_nohandle', fished(10), 10, DAY)).toEqual({ ok: false, error: 'profile' })
      await realm.act('u_admin', { action: 'ban', userId: 'u_misty', days: 3, reason: 'spam' })
      expect(await realm.claim('u_misty', fished(10), 10, DAY)).toEqual({ ok: false, error: 'banned' })
      expect(await sql`select 1 from realm_game_days where user_id = 'u_misty'`).toHaveLength(0)
    })
  })
})
