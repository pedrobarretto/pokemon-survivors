import type { TransactionSql } from 'postgres'
import { FESTIVAL, FESTIVALS, type FestivalId } from '../../src/data/festivals'
import { brasiliaDay } from '../../src/game/day'
import {
  donateFrom,
  donationRefusal,
  festivalEnd,
  festivalOn,
  isHeld,
  latestFestival,
  reachedMilestones,
  type DonationRefusal,
  type FestivalDonor,
  type FestivalMine,
  type FestivalTotals,
} from '../../src/game/festival'
import { parseSaveData, type Save } from '../../src/game/meta'
import type { Sql } from './db'
import { rateLimiter } from './rateLimit'

/** How long the public part of `GET /festival` (pots, plaque) is kept per instance. */
const CACHE_MS = 30_000

/** Write limits per account. The daily cap is the real brake on donating; these only brake a script. */
const LIMITS = { donate: { n: 10, ms: 60_000 }, setPublic: { n: 10, ms: 60_000 } } as const

/** Held donations the admin's list shows at most. */
const HELD_LIST = 100

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type Q = Sql | TransactionSql

type SumRow = { festival: string; amount: number }

/** Sums per festival as totals, known festivals only. */
export const toTotals = (rows: readonly SumRow[]): Partial<Record<FestivalId, number>> =>
  Object.fromEntries(FESTIVALS.flatMap((f) => rows.filter((r) => r.festival === f.id).map((r) => [f.id, r.amount] as const)))

/** Every festival's pot: the donations that count (neither held nor voided). */
const sumPots = async (q: Q) =>
  toTotals(await q<SumRow[]>`select festival, sum(amount)::float8 as amount from festival_donations where not held and not voided group by festival`)

/** What `userId` gave to each festival, counted donations only (the Mecenas title). */
const sumGiven = async (q: Q, userId: string) =>
  toTotals(await q<SumRow[]>`select festival, sum(amount)::float8 as amount from festival_donations where user_id = ${userId} and not held and not voided group by festival`)

/**
 * The pots and what `userId` gave, for `festivalGiftsVouched` on a push: the
 * festival gifts a save applied stay only if these sums reach them.
 */
export const festivalTotals = async (q: Q, userId: string): Promise<FestivalTotals> => {
  const [pots, given] = await Promise.all([sumPots(q), sumGiven(q, userId)])
  return { pots, given }
}

/** ₽ `userId` put in the fountain on Brasília `day` (held ones too: the cap counts every donation not voided). */
const donatedOn = async (q: Q, userId: string, day: string) => {
  const [row] = await q<{ n: number }[]>`select coalesce(sum(amount), 0)::float8 as n from festival_donations where user_id = ${userId} and day = ${day}::date and not voided`
  return row?.n ?? 0
}

/** The public part of `GET /festival`, the same for everyone (cached `CACHE_MS`). */
export type FestivalBoard = {
  day: string
  festival: FestivalId | null
  start: string | null
  end: string | null
  pots: Partial<Record<FestivalId, number>>
  /** The shown festival's pot and how many of its milestones it reached. */
  pot: number
  reached: number
  top: FestivalDonor[]
  donors: number
}

/** Why a donation didn't go: a rule of `donationRefusal`, no save stored yet (`nosave`), or a `base` behind the stored revision (`stale`: sync, then try again). */
export type DonateError = DonationRefusal | 'nosave' | 'stale'

export type Donated = { ok: true; save: Save; revision: number; held: boolean; today: number } | { ok: false; error: DonateError }

/** A held donation as the admin reviews it, with the donor's wallet now. */
export type HeldDonation = { id: string; festival: string; amount: number; day: string; at: string; handle: string | null; name: string | null; wallet: number | null }

/**
 * Festival da Praça: donations (`festival_donations`), the pot and the
 * plaque. Only the API takes ₽, always from the save it stores, inside one
 * transaction that locks the player's rows, so the wallet must cover it and
 * two donations take turns. The donation moves the ₽ from the wallet to
 * `spent` (`donateFrom`), so a merge never refunds it. Held donations (a
 * wallet above `FESTIVAL.heldWallet`) count only once the admin approves
 * them; a voided one never counts and its ₽ stays spent.
 */
export const festivalStore = (sql: Sql, now = () => new Date()) => {
  const donations = rateLimiter(LIMITS.donate.n, LIMITS.donate.ms)
  const toggles = rateLimiter(LIMITS.setPublic.n, LIMITS.setPublic.ms)
  let cached: { at: number; board: FestivalBoard } | null = null

  const board = async (): Promise<FestivalBoard> => {
    const at = now().getTime()
    if (cached && at - cached.at < CACHE_MS) return cached.board
    const day = brasiliaDay(now())
    const shown = latestFestival(day)
    const pots = await sumPots(sql)
    const top = shown
      ? await sql<FestivalDonor[]>`
          select u.handle, sum(d.amount)::float8 as amount
          from festival_donations d join users u on u.id = d.user_id
          where d.festival = ${shown.id} and not d.held and not d.voided
            and u.donor_public and u.handle is not null and u.banned_at is null
          group by u.id, u.handle
          order by amount desc, min(d.created_at)
          limit ${FESTIVAL.top}`
      : []
    const [donors] = shown ? await sql<{ n: number }[]>`select count(distinct user_id)::int as n from festival_donations where festival = ${shown.id} and not held and not voided` : []
    const pot = shown ? (pots[shown.id] ?? 0) : 0
    const next: FestivalBoard = {
      day,
      festival: shown?.id ?? null,
      start: shown?.start ?? null,
      end: shown ? festivalEnd(shown) : null,
      pots,
      pot,
      reached: shown ? reachedMilestones(shown, pot) : 0,
      top: top.map((r) => ({ handle: r.handle, amount: r.amount })),
      donors: donors?.n ?? 0,
    }
    cached = { at, board: next }
    return next
  }

  /** `userId`'s place among the donors of `festival` who gave it `amount` (counted donations, hidden names too). */
  const rankOf = async (festival: FestivalId, amount: number) => {
    const [row] = await sql<{ n: number }[]>`
      select count(*)::int as n from (
        select sum(amount) as total from festival_donations where festival = ${festival} and not held and not voided group by user_id
      ) x where total > ${amount}`
    return (row?.n ?? 0) + 1
  }

  const mine = async (userId: string): Promise<FestivalMine> => {
    const day = brasiliaDay(now())
    const shown = latestFestival(day)
    const [today, given, [row]] = await Promise.all([
      donatedOn(sql, userId, day),
      sumGiven(sql, userId),
      sql<{ held: number; public: boolean | null }[]>`
        select (select coalesce(sum(amount), 0)::float8 from festival_donations where user_id = ${userId} and held and not voided) as held,
          (select donor_public from users where id = ${userId}) as public`,
    ])
    const gave = shown ? (given[shown.id] ?? 0) : 0
    const rank = shown && gave > 0 ? await rankOf(shown.id, gave) : null
    return { today, given, held: row?.held ?? 0, public: row?.public ?? true, rank }
  }

  return {
    /** `GET /festival`: the board, with the asker's own donations when signed in. */
    status: async (viewer: string | null) => ({ ...(await board()), me: viewer ? await mine(viewer) : null }),

    /** Whether `userId` may try another donation now (`LIMITS.donate`). */
    takeDonate: (userId: string) => donations.take([`user:${userId}`], now().getTime()),

    /** Whether `userId` may change their plaque setting now. */
    takeToggle: (userId: string) => toggles.take([`user:${userId}`], now().getTime()),

    /**
     * Puts `amount` ₽ of `userId`'s stored save in the running festival's
     * pot, on top of revision `base` (the device's, so it took every push in
     * between). The new save goes in at the next revision and comes back for
     * the device to keep.
     */
    donate: (userId: string, amount: number, base: number | null): Promise<Donated> =>
      sql
        .begin(async (tx): Promise<Donated> => {
          const day = brasiliaDay(now())
          const festival = festivalOn(day)
          const [user] = await tx<{ handle: string | null }[]>`select handle from users where id = ${userId} for update`
          const [row] = await tx<{ data: unknown; revision: number }[]>`select data, revision from saves where user_id = ${userId} for update`
          if (!user || !row) return { ok: false, error: 'nosave' }
          const [runs] = await tx<{ n: number }[]>`
            select count(*)::int as n from (select 1 from runs where user_id = ${userId} and finished_at is not null and verified is not false limit ${FESTIVAL.minRuns}) x`
          const today = await donatedOn(tx, userId, day)
          const save = parseSaveData(row.data)
          const refusal = donationRefusal({ festival, amount, handle: user.handle, runs: runs?.n ?? 0, today, wallet: save.wallet })
          if (refusal || !festival) return { ok: false, error: refusal ?? 'closed' }
          if (base !== row.revision) return { ok: false, error: 'stale' }
          const held = isHeld(save.wallet)
          const next = donateFrom(save, amount)
          const revision = row.revision + 1
          await tx`insert into festival_donations (festival, user_id, amount, day, held) values (${festival.id}, ${userId}, ${amount}, ${day}::date, ${held})`
          await tx`update saves set version = ${next.version}, revision = ${revision}, data = ${tx.json(next)}, updated_at = now() where user_id = ${userId}`
          console.log(`festival ${festival.id}: ${userId} donated ${amount}${held ? ' (held)' : ''}`)
          return { ok: true, save: next, revision, held, today: today + amount }
        })
        .then((done) => {
          if (done.ok && !done.held) cached = null
          return done
        }),

    /** Shows (or hides) the player's @handle on the plaque. */
    setPublic: async (userId: string, show: boolean) => {
      await sql`update users set donor_public = ${show} where id = ${userId}`
      cached = null
    },

    /** The donations waiting for the admin, oldest first. */
    held: async (): Promise<HeldDonation[]> => {
      const rows = await sql<{ id: string; festival: string; amount: number; day: string; created_at: Date; handle: string | null; name: string | null; wallet: number | null }[]>`
        select d.id, d.festival, d.amount, d.day::text as day, d.created_at, u.handle, u.name, (s.data->>'wallet')::float8 as wallet
        from festival_donations d join users u on u.id = d.user_id left join saves s on s.user_id = d.user_id
        where d.held and not d.voided
        order by d.created_at limit ${HELD_LIST}`
      return rows.map((r) => ({ id: r.id, festival: r.festival, amount: r.amount, day: r.day, at: r.created_at.toISOString(), handle: r.handle, name: r.name, wallet: r.wallet }))
    },

    /** The admin approves a held donation (it counts in the pot from now) or voids any donation (it never counts). Whether it changed one. */
    review: async (adminId: string, id: string, action: 'approve' | 'void') => {
      if (!UUID.test(id)) return false
      const rows =
        action === 'approve'
          ? await sql`update festival_donations set held = false where id = ${id}::uuid and held and not voided returning id`
          : await sql`update festival_donations set voided = true where id = ${id}::uuid and not voided returning id`
      if (rows.length === 0) return false
      cached = null
      console.log(`admin ${adminId} ${action === 'approve' ? 'approved' : 'voided'} festival donation ${id}`)
      return true
    },
  }
}

export type FestivalStore = ReturnType<typeof festivalStore>
