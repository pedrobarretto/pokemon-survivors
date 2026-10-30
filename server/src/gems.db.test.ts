import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { GEM_PATREON, GEM_PLAY, packGems } from '../../src/data/gems'
import { seasonById, type ArenaResult } from '../../src/game/arenaRank'
import { arenaStore, parseArenaReport } from './arena'
import type { Sql } from './db'
import { gemStore } from './gems'
import { supporterStore } from './supporters'

/**
 * The gem ledger against a real Postgres: set `GEMS_TEST_DATABASE_URL` to a
 * throwaway database (it's wiped). Skipped without it, like `arena.db.test.ts`.
 */
const url = process.env.GEMS_TEST_DATABASE_URL

const REF = '8f14e45f-ceea-467f-a0e6-1b7a2c1c9a01'

const seat = (slot: number, team: 0 | 1) => ({ slot, team, starter: 'charmander', form: 'Charmander', bot: false, kos: 2, deaths: 1, scored: 10, damage: 500, assists: 1, dealt: 300, taken: 250, healed: 0, interrupts: 0, afk: 0 }) as const

/** Blue (slot 0) beats Red (slot 2), in a casual match. */
const result: ArenaResult = { v: 1, score: [40, 20], winner: 0, seconds: 420, objective: null, surrender: null, seats: [seat(0, 0), seat(1, 0), seat(2, 1), seat(3, 1)] }

const report = (run: number, over: Record<string, unknown> = {}) =>
  parseArenaReport({
    v: 1,
    room: 'GEMS1',
    run,
    kind: 'casual',
    region: 'sa',
    endedAt: seasonById(1).startMs + run * 600_000,
    seats: [
      { slot: 0, userId: 'u_a', handle: null, left: false },
      { slot: 2, userId: 'u_b', handle: null, left: false },
    ],
    result,
    ...over,
  })!

describe.skipIf(!url)('gem ledger (Postgres)', () => {
  let sql: Sql
  let gems: ReturnType<typeof gemStore>

  beforeAll(async () => {
    const { connect, migrate } = await import('./db')
    sql = connect(url!, 4)
    await migrate(sql, new URL('../migrations/', import.meta.url))
    gems = gemStore(sql)
  })

  beforeEach(async () => {
    await sql`truncate gem_ledger, gem_purchases, cosmetics_owned, donations, arena_lines, arena_matches, arena_conduct, arena_fair_play, gifts, users cascade`
  })

  afterAll(async () => {
    await sql?.end()
  })

  const balance = async (user: string) => (await sql<{ gems: number }[]>`select gems from users where id = ${user}`)[0]?.gems
  const ledgerSum = async (user: string) => (await sql<{ n: number }[]>`select coalesce(sum(amount), 0)::int as n from gem_ledger where user_id = ${user}`)[0]?.n

  const paid = { kind: 'paid', provider: 'stripe', ref: REF, session: 'cs_test_1', payment: 'pi_test_1', amount: 2490, currency: 'brl' } as const

  const opened = () => gems.open({ ref: REF, userId: 'u_a', pack: 'bag', gems: packGems('bag'), provider: 'stripe', currency: 'brl', amount: 2490 })

  const bought = async () => {
    await opened()
    await gems.event(paid)
  }

  it('credits a paid pack once, however often the webhook comes', async () => {
    await opened()
    expect(await gems.purchase('u_a', REF)).toEqual({ status: 'pending', gems: packGems('bag'), balance: 0 })
    await gems.event(paid)
    await gems.event(paid)
    expect(await balance('u_a')).toBe(packGems('bag'))
    expect(await ledgerSum('u_a')).toBe(packGems('bag'))
    // Another provider can't pay it.
    await gems.event({ ...paid, provider: 'abacatepay', session: 'bill_1', payment: 'bill_1' })
    expect(await balance('u_a')).toBe(packGems('bag'))
    // Its buyer sees it land; nobody else sees it at all.
    expect(await gems.purchase('u_a', REF)).toEqual({ status: 'paid', gems: packGems('bag'), balance: packGems('bag') })
    expect(await gems.purchase('u_b', REF)).toBeNull()
    expect(await gems.purchase('u_a', 'not-a-uuid')).toBeNull()
  })

  it('holds a pack charged another amount or currency, uncredited, for support', async () => {
    await opened()
    await gems.event({ ...paid, amount: 99, currency: 'usd' })
    expect(await balance('u_a')).toBe(0)
    expect(await sql`select state, paid_amount, paid_currency from gem_purchases where ref = ${REF}::uuid`).toEqual([{ state: 'mismatch', paid_amount: 99, paid_currency: 'usd' }])
    expect((await gems.purchase('u_a', REF))?.status).toBe('pending')
    // A refund of it has nothing to take back.
    await gems.event({ kind: 'refund', provider: 'stripe', purchase: { payment: 'pi_test_1' }, share: { refunded: 99, amount: 99 }, key: 'refund:stripe:ch_1:99' })
    expect(await balance('u_a')).toBe(0)
    expect((await gems.purchase('u_a', REF))?.status).toBe('refunded')
  })

  it("keeps a deleted account's purchases and ledger", async () => {
    await bought()
    await sql`delete from users where id = 'u_a'`
    expect(await sql`select user_id, state from gem_purchases`).toEqual([{ user_id: null, state: 'paid' }])
    expect(await sql`select user_id, ref from gem_ledger`).toEqual([{ user_id: null, ref: `pack:${REF}` }])
    // Its webhooks still find the row, and move no gems.
    await gems.event({ kind: 'dispute', provider: 'stripe', purchase: { payment: 'pi_test_1' }, key: 'dispute:stripe:du_1' })
    expect(await sql`select state from gem_purchases`).toEqual([{ state: 'disputed' }])
  })

  it('takes refunds and disputes back without counting a gem twice', async () => {
    await bought()
    const full = packGems('bag')
    await gems.event({ kind: 'refund', provider: 'stripe', purchase: { payment: 'pi_test_1' }, share: { refunded: 1245, amount: 2490 }, key: 'refund:stripe:ch_1:1245' })
    await gems.event({ kind: 'refund', provider: 'stripe', purchase: { payment: 'pi_test_1' }, share: { refunded: 1245, amount: 2490 }, key: 'refund:stripe:ch_1:1245' })
    expect(await balance('u_a')).toBe(full - full / 2)
    await gems.event({ kind: 'dispute', provider: 'stripe', purchase: { payment: 'pi_test_1' }, key: 'dispute:stripe:du_1' })
    expect(await balance('u_a')).toBe(0)
    await gems.event({ kind: 'disputeWon', provider: 'stripe', purchase: { payment: 'pi_test_1' }, dispute: 'dispute:stripe:du_1', key: 'dispute-won:stripe:du_1' })
    expect(await balance('u_a')).toBe(full / 2)
    expect(await ledgerSum('u_a')).toBe(full / 2)
    expect((await gems.purchase('u_a', REF))?.status).toBe('paid')
    // A donation's refund finds no pack.
    await gems.event({ kind: 'refund', provider: 'stripe', purchase: { payment: 'pi_other' }, share: { refunded: 500, amount: 500 }, key: 'refund:stripe:ch_2:500' })
    expect(await ledgerSum('u_a')).toBe(full / 2)
  })

  it('buys once on a double click, refuses when short or already owned', async () => {
    expect(await gems.buy('u_a', 'strawHat', 150)).toEqual({ ok: false, error: 'gems' })
    await bought()
    const [one, two] = await Promise.all([gems.buy('u_a', 'strawHat', 150), gems.buy('u_a', 'strawHat', 150)])
    expect([one.ok, two.ok].sort()).toEqual([false, true])
    expect(await balance('u_a')).toBe(packGems('bag') - 150)
    expect((await gems.status('u_a')).owned).toEqual(['strawHat'])
  })

  it('blocks buying once a refund of spent gems leaves the balance negative', async () => {
    await bought()
    await gems.buy('u_a', 'strawHat', 150)
    await gems.event({ kind: 'refund', provider: 'stripe', purchase: { payment: 'pi_test_1' }, share: 'all', key: 'refund:stripe:ch_1:2490' })
    expect(await balance('u_a')).toBe(-150)
    expect(await gems.buy('u_a', 'sparkTrail', 150)).toEqual({ ok: false, error: 'gems' })
  })

  it('keeps only owned cosmetics in the stored look', async () => {
    await bought()
    await gems.buy('u_a', 'strawHat', 150)
    expect(await gems.setLook('u_a', { head: 'strawHat', trail: 'sparkTrail' })).toEqual({ head: 'strawHat' })
    expect((await gems.status('u_a')).look).toEqual({ head: 'strawHat' })
    const tickets = await arenaStore(sql).tickets(['u_a', 'u_z'])
    expect(tickets.ratings.u_a?.look).toEqual({ head: 'strawHat' })
    expect(tickets.ratings.u_z?.look).toEqual({})
    // A friends' room asks the same, at its start.
    expect(Object.fromEntries(await gems.looks(['u_a', 'u_z']))).toEqual({ u_a: { head: 'strawHat' } })
  })

  it("credits play gems for confirmed reports, up to the day's cap", async () => {
    const arena = arenaStore(sql)
    // Same Brasília day for every run: endedAt 10 minutes apart from the season's start.
    for (let run = 1; run <= 6; run++) await arena.report(report(run))
    await arena.report(report(1))
    expect(await balance('u_a')).toBe(GEM_PLAY.daily)
    expect(await balance('u_b')).toBe(Math.min(GEM_PLAY.daily, 6 * GEM_PLAY.match))
    // Unconfirmed, nobody earns; a leaver never does.
    await sql`truncate gem_ledger`
    await sql`update users set gems = 0`
    await arena.report(report(7, { confirmed: false }))
    await arena.report(report(8, { seats: [{ slot: 0, userId: 'u_a', handle: null, left: true }, { slot: 2, userId: 'u_b', handle: null, left: false }] }))
    expect(await balance('u_a')).toBe(0)
    expect(await balance('u_b')).toBe(GEM_PLAY.match)
  })

  it("credits a Patreon charge's gems once, waiting for the patron to link", async () => {
    const supporters = supporterStore(sql)
    const charge = { ref: 'patreon:m1:2026-11-01T12:00:00.000Z', member: 'm1', patron: '42', lifetime: 1000, entitled: 1000, currency: 'usd', tier: 'gold' as const }
    await supporters.patreonCharge(charge)
    await supporters.linkPatreon('u_a', '42')
    await supporters.patreonCharge(charge)
    expect(await balance('u_a')).toBe(GEM_PATREON.gold)
    await supporters.patreonCharge({ ...charge, ref: 'patreon:m1:2026-12-01T12:00:00.000Z', lifetime: 2000 })
    expect(await balance('u_a')).toBe(2 * GEM_PATREON.gold)
  })

  it('credits Patreon gems at most once a month, at its first charge’s tier', async () => {
    const supporters = supporterStore(sql)
    await supporters.linkPatreon('u_a', '42')
    const charge = { ref: 'patreon:m1:2026-11-03T12:00:00.000Z', member: 'm1', patron: '42', lifetime: 500, entitled: 500, currency: 'usd', tier: 'supporter' as const }
    await supporters.patreonCharge(charge)
    // Dropped to nothing and pledged again at Gold the same month: a new charge, no more gems.
    await supporters.patreonCharge({ ...charge, ref: 'patreon:m1:2026-11-20T12:00:00.000Z', lifetime: 2500, entitled: 2000, tier: 'gold' })
    expect(await balance('u_a')).toBe(GEM_PATREON.supporter)
    expect(await sql`select ref from gem_ledger`).toEqual([{ ref: 'patreon-gems:m1:2026-11' }])
    // Next month's charge brings the month's gems.
    await supporters.patreonCharge({ ...charge, ref: 'patreon:m1:2026-12-03T12:00:00.000Z', lifetime: 4500, entitled: 2000, tier: 'gold' })
    expect(await balance('u_a')).toBe(GEM_PATREON.supporter + GEM_PATREON.gold)
  })
})
