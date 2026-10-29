import type { TransactionSql } from 'postgres'
import type { ArenaLook, CosmeticId } from '../../src/data/arenaCosmetics'
import type { GemCurrency, GemPackId } from '../../src/data/gems'
import { knownOwned, playGems, refundedGems, wearableLook, type GemBuyResponse, type GemLedgerEntry, type GemReason, type GemsStatus } from '../../src/game/gems'
import type { DayKey } from '../../src/game/day'
import type { Sql } from './db'
import { rateLimiter } from './rateLimit'

/**
 * Gems: every account's ledger, the packs bought with money, the cosmetics
 * bought with gems and the equipped Arena look. The rules (prices, the play
 * cap, what a look keeps) are `../src/game/gems.ts`; this file stores what
 * they decide. Every credit and debit is a `gem_ledger` row with a unique
 * `ref` (`moveGems`), and `users.gems` moves with it in the same
 * transaction, so a webhook, a report or a click that comes twice lands once.
 */

type Q = Sql | TransactionSql

/**
 * Moves `userId`'s gems by `amount` (signed) under `ref`, once: a ref the
 * ledger already holds changes nothing. The account's row must exist.
 * Whether it landed.
 */
export const moveGems = async (tx: TransactionSql, userId: string, amount: number, reason: GemReason, ref: string, day: DayKey | null = null) => {
  if (amount === 0) return false
  const [row] = await tx<{ id: string }[]>`
    insert into gem_ledger (user_id, amount, reason, ref, day) values (${userId}, ${amount}, ${reason}, ${ref}, ${day})
    on conflict (ref) do nothing returning id`
  if (!row) return false
  await tx`update users set gems = gems + ${amount} where id = ${userId}`
  return true
}

type StatusRow = { id: string; gems: number; arena_look: unknown; owned: string[] }

/** Each account's balance, owned cosmetics and stored look, by user id (absent: no row yet). */
const statusRows = (q: Q, userIds: readonly string[]) => q<StatusRow[]>`
  select u.id, u.gems, u.arena_look, coalesce(array_agg(c.cosmetic) filter (where c.cosmetic is not null), '{}') as owned
  from users u left join cosmetics_owned c on c.user_id = u.id
  where u.id = any(${userIds}::text[]) group by u.id`

const toStatus = (r: StatusRow | undefined): GemsStatus => {
  const owned = knownOwned(r?.owned ?? [])
  return { balance: r?.gems ?? 0, owned, look: wearableLook(r?.arena_look, new Set(owned)) }
}

/**
 * The looks the accounts may wear, as the API vouches for them (stored and
 * read back through what each owns), by user id: the matchmaker's ticket
 * lookup sends them so queue matches show these instead of a client's word.
 */
export const vouchedLooks = async (q: Q, userIds: readonly string[]): Promise<Map<string, ArenaLook>> => {
  const rows = userIds.length > 0 ? await statusRows(q, userIds) : []
  return new Map(rows.map((r) => [r.id, toStatus(r).look] as const))
}

/** One Arena seat that played its match out, for its play gems. */
export type PlaySeat = { userId: string; won: boolean }

/**
 * Credits each seat's play gems for match (`room`, `run`) ended on Brasília
 * `day` (`playGems`, capped per day by the day's play rows so far). The
 * accounts' rows are locked in id order first, so two reports sharing a
 * player take turns and the cap holds.
 */
export const creditPlay = async (tx: TransactionSql, seats: readonly PlaySeat[], room: string, run: number, day: DayKey) => {
  const ids = [...new Set(seats.map((s) => s.userId))].sort()
  if (ids.length === 0) return
  await tx`select id from users where id = any(${ids}::text[]) order by id for update`
  const earned = await tx<{ user_id: string; n: number }[]>`
    select user_id, sum(amount)::int as n from gem_ledger where reason = 'play' and day = ${day} and user_id = any(${ids}::text[]) group by user_id`
  for (const s of seats) {
    const n = playGems(s.won, earned.find((e) => e.user_id === s.userId)?.n ?? 0)
    await moveGems(tx, s.userId, n, 'play', `play:${room}:${run}:${s.userId}`, day)
  }
}

/** Which purchase a payment event is about: our ref (AbacatePay's `externalId`) or the provider's payment (Stripe's PaymentIntent). */
export type PurchaseKey = { ref: string } | { payment: string }

export type GemProvider = 'stripe' | 'abacatepay'

/**
 * What a payment webhook says about a gem pack (`stripeGems`, `abacateGems`
 * in `webhooks.ts`): paid; refunded (`refunded` cents of `amount` back so
 * far); disputed; or a dispute won back. `key` is the event's ledger ref.
 */
export type GemEvent =
  | { kind: 'paid'; provider: GemProvider; ref: string; session: string | null; payment: string | null }
  | { kind: 'refund'; provider: GemProvider; purchase: PurchaseKey; refunded: number; amount: number; key: string }
  | { kind: 'dispute'; provider: GemProvider; purchase: PurchaseKey; key: string }
  | { kind: 'disputeWon'; provider: GemProvider; purchase: PurchaseKey; dispute: string; key: string }

/** A checkout about to open: the pack, its price and who buys it. */
export type GemOrder = { ref: string; userId: string; pack: GemPackId; gems: number; provider: GemProvider; currency: GemCurrency; amount: number }

export type BuyOutcome = ({ ok: true } & GemBuyResponse) | { ok: false; error: 'gems' | 'owned' }

/** Ledger lines `GET /gems/ledger` shows. */
const LEDGER_PAGE = 50

/** Brakes for a script: checkouts per 10 minutes (each opens a session at the provider), buys and look changes per minute. */
const LIMITS = { checkout: { n: 6, ms: 600_000 }, buy: { n: 30, ms: 60_000 }, look: { n: 30, ms: 60_000 } } as const

type PurchaseRow = { ref: string; user_id: string; gems: number; provider: string; taken_back: number }

export const gemStore = (sql: Sql) => {
  const limits = {
    checkout: rateLimiter(LIMITS.checkout.n, LIMITS.checkout.ms),
    buy: rateLimiter(LIMITS.buy.n, LIMITS.buy.ms),
    look: rateLimiter(LIMITS.look.n, LIMITS.look.ms),
  }

  /** The purchase `key` names, of `provider`, locked for the rest of the transaction. */
  const lockPurchase = async (tx: TransactionSql, provider: GemProvider, key: PurchaseKey) => {
    const [p] = await tx<PurchaseRow[]>`
      select ref, user_id, gems, provider, taken_back from gem_purchases
      where provider = ${provider} and ${'ref' in key ? tx`ref = ${key.ref}::uuid` : tx`payment = ${key.payment}`}
      for update`
    return p ?? null
  }

  /** Takes up to `target` gems back from purchase `p` in all (what earlier refunds and disputes took counts), under `ref`. */
  const takeBack = async (tx: TransactionSql, p: PurchaseRow, target: number, reason: 'refund' | 'dispute', ref: string) => {
    const n = Math.min(p.gems, target) - p.taken_back
    if (n <= 0 || !(await moveGems(tx, p.user_id, -n, reason, ref))) return
    await tx`update gem_purchases set taken_back = taken_back + ${n} where ref = ${p.ref}::uuid`
    console.log(`gems: ${reason} took ${n} back from ${p.user_id} (purchase ${p.ref})`)
  }

  return {
    /** `GET /gems`. */
    status: async (userId: string): Promise<GemsStatus> => toStatus((await statusRows(sql, [userId]))[0]),

    /** `GET /gems/ledger`: the account's latest lines, newest first. */
    ledger: async (userId: string): Promise<GemLedgerEntry[]> => {
      const rows = await sql<{ amount: number; reason: GemReason; ref: string; at: Date }[]>`
        select amount, reason, ref, at from gem_ledger where user_id = ${userId} order by id desc limit ${LEDGER_PAGE}`
      return rows.map((r) => ({ amount: r.amount, reason: r.reason, ref: r.ref, at: r.at.getTime() }))
    },

    /**
     * Buys cosmetic `id` for `price` gems: the debit and the ownership in one
     * transaction, behind the account's row lock, so a double click buys once
     * (the second sees it owned). `gems` when the balance is short (or
     * negative), `owned` when it's had already.
     */
    buy: (userId: string, id: CosmeticId, price: number): Promise<BuyOutcome> =>
      sql.begin(async (tx) => {
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        const [u] = await tx<{ gems: number }[]>`select gems from users where id = ${userId} for update`
        const [had] = await tx`select 1 from cosmetics_owned where user_id = ${userId} and cosmetic = ${id}`
        if (had) return { ok: false, error: 'owned' } as const
        if ((u?.gems ?? 0) < price) return { ok: false, error: 'gems' } as const
        if (!(await moveGems(tx, userId, -price, 'buy', `buy:${userId}:${id}`))) return { ok: false, error: 'owned' } as const
        await tx`insert into cosmetics_owned (user_id, cosmetic, source) values (${userId}, ${id}, 'buy')`
        const { balance, owned } = toStatus((await statusRows(tx, [userId]))[0])
        return { ok: true, balance, owned } as const
      }),

    /** `PUT /gems/look`: stores the look the account may wear (`wearableLook`) and returns it. */
    setLook: (userId: string, raw: unknown): Promise<ArenaLook> =>
      sql.begin(async (tx) => {
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        const owned = await tx<{ cosmetic: string }[]>`select cosmetic from cosmetics_owned where user_id = ${userId}`
        const look = wearableLook(raw, new Set(owned.map((o) => o.cosmetic)))
        await tx`update users set arena_look = ${tx.json(look)} where id = ${userId}`
        return look
      }),

    /** A checkout about to open: its purchase row, unpaid. */
    open: async (o: GemOrder) => {
      await sql.begin(async (tx) => {
        await tx`insert into users (id) values (${o.userId}) on conflict (id) do nothing`
        await tx`
          insert into gem_purchases (ref, user_id, pack, gems, provider, currency, amount)
          values (${o.ref}::uuid, ${o.userId}, ${o.pack}, ${o.gems}, ${o.provider}, ${o.currency}, ${o.amount})`
      })
    },

    /** The provider's session for purchase `ref` (Stripe's Checkout Session), once it's made. */
    opened: async (ref: string, session: string) => {
      await sql`update gem_purchases set session = ${session} where ref = ${ref}::uuid`
    },

    /**
     * A payment webhook's word on a pack (`GemEvent`): paid credits the pack
     * (`pack:<ref>`); a refund takes back its share of the gems
     * (`refundedGems`), a dispute the whole pack, each counting what earlier
     * ones took; a dispute won gives back what that dispute took. Events about
     * payments that aren't gem packs (a donation's refund) change nothing.
     */
    event: (e: GemEvent) =>
      sql.begin(async (tx) => {
        const p = await lockPurchase(tx, e.provider, e.kind === 'paid' ? { ref: e.ref } : e.purchase)
        if (!p) {
          if (e.kind === 'paid') console.warn(`gems: ${e.provider} paid an unknown purchase ${e.ref}`)
          return
        }
        if (e.kind === 'paid') {
          await tx`
            update gem_purchases set paid_at = coalesce(paid_at, now()), session = coalesce(session, ${e.session}), payment = coalesce(payment, ${e.payment})
            where ref = ${p.ref}::uuid`
          if (await moveGems(tx, p.user_id, p.gems, 'pack', `pack:${p.ref}`)) console.log(`gems: pack ${p.ref} paid, ${p.gems} to ${p.user_id}`)
        } else if (e.kind === 'refund') {
          await takeBack(tx, p, refundedGems(p.gems, e.amount, e.refunded), 'refund', e.key)
        } else if (e.kind === 'dispute') {
          await takeBack(tx, p, p.gems, 'dispute', e.key)
        } else {
          const [taken] = await tx<{ amount: number }[]>`select amount from gem_ledger where ref = ${e.dispute}`
          const n = taken ? -taken.amount : 0
          if (n > 0 && (await moveGems(tx, p.user_id, n, 'disputeWon', e.key))) {
            await tx`update gem_purchases set taken_back = taken_back - ${n} where ref = ${p.ref}::uuid`
          }
        }
      }),

    /** Counts a checkout against the account's limit; false past it. */
    takeCheckout: (userId: string, now = Date.now()) => limits.checkout.take([userId], now),
    /** Counts a buy against the account's limit; false past it. */
    takeBuy: (userId: string, now = Date.now()) => limits.buy.take([userId], now),
    /** Counts a look change against the account's limit; false past it. */
    takeLook: (userId: string, now = Date.now()) => limits.look.take([userId], now),
  }
}

export type GemStore = ReturnType<typeof gemStore>
