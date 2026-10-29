import { randomFillSync } from 'node:crypto'
import type { TransactionSql } from 'postgres'
import { POLLS, pollOptionIds, type PollKind, type PollOption } from '../../src/data/supporters'
import { atLeast, donationPoints, effectiveTier, hallTier, highestTier, newCode, OG_GIFT, parseTier, TIER_GIFTS, tiersReached } from '../../src/game/supporters'
import type { DonationStatus, HiddenSupporters, Poll, Standing, SupporterStatus, SupporterTier, WallEntry } from '../../src/game/supporters'
import { parseSaveData } from '../../src/game/meta'
import { hallPokemon } from '../../src/game/trainer'
import type { Sql } from './db'
import { GEM_PATREON } from '../../src/data/gems'
import { moveGems } from './gems'
import { sendGift } from './gifts'
import { patreonAmount, type PaidDonation, type PatreonCharge, type PatreonMember } from './webhooks'

/** Names on the wall at most. */
const WALL_SIZE = 500

/** A user row's support columns, as every query that needs a tier selects them. */
export type StandingRow = { supporter_points: number; og_tier: string | null; patreon_tier: string | null; patreon_best: string | null }

/** The `Standing` of a user row. */
export const standingOf = (r: StandingRow): Standing => ({ points: r.supporter_points, og: parseTier(r.og_tier), patreon: parseTier(r.patreon_tier), patreonBest: parseTier(r.patreon_best) })

/** The account's tier (`effectiveTier`) from its row. */
export const tierOfRow = (r: StandingRow) => effectiveTier(standingOf(r))

/**
 * Donations, patrons and supporters. A paid one-time donation counts for an
 * account once (`credit`): its points join the account's total (any makes a
 * Supporter, never more). A Patreon member's tier follows their active
 * pledge (`patreonPledge`, from every member webhook; `patreon_members` keeps
 * it for a patron who links later); their charges are recorded, never
 * added up, and each brings the pledge tier's gems (`GEM_PATREON`, ledger
 * ref the charge's own) once it has an account. Whenever the account's tier (`effectiveTier`) rises, each tier it
 * reaches sends its thank-you as Mystery Gifts (`TIER_GIFTS`, `key`
 * `support:<tier>:<i>`, so nothing lands twice, however often a pledge comes
 * and goes). Every OG account gets the OG Supporter title once too
 * (`OG_GIFT`, `ogGifts` on boot). A paid donation with no account gets a code
 * instead, which an account redeems later.
 *
 * `onTierChange` hears of an account whose tier went up or down, once the
 * transaction committed (the Discord bot updates its role).
 */
export const supporterStore = (sql: Sql, hooks: { onTierChange?: (userId: string) => void } = {}) => {
  /** The user's standing, locked for the rest of the transaction. */
  const lockStanding = async (tx: TransactionSql, userId: string) => {
    const [row] = await tx<StandingRow[]>`select supporter_points, og_tier, patreon_tier, patreon_best from users where id = ${userId} for update`
    return row ? standingOf(row) : null
  }

  /** Sends the thank-you of each tier going from `before` to `after` reaches. Whether the tier changed. */
  const settle = async (tx: TransactionSql, userId: string, before: SupporterTier | null, after: SupporterTier | null) => {
    for (const tier of tiersReached(before, after)) {
      for (const [i, content] of TIER_GIFTS[tier].entries()) await sendGift(tx, userId, content, { kind: 'support', tier }, `support:${tier}:${i}`)
    }
    return before !== after
  }

  /**
   * Credits the one-time donation `id` if it's paid and not credited yet; one with no account just gets its code.
   * The account whose tier changed, if any.
   */
  const credit = async (tx: TransactionSql, id: string): Promise<string | null> => {
    const [d] = await tx<{ user_id: string | null; points: number; paid: boolean; credited: boolean; code: string | null }[]>`
      select user_id, points, paid_at is not null as paid, credited_at is not null as credited, code from donations where id = ${id} for update`
    if (!d?.paid || d.credited) return null
    if (!d.user_id) {
      if (!d.code) await tx`update donations set code = ${newCode((b) => randomFillSync(b))} where id = ${id}`
      return null
    }
    const s = await lockStanding(tx, d.user_id)
    if (!s) return null
    const after = s.points + d.points
    await tx`update users set supporter_points = ${after}, supporter_since = coalesce(supporter_since, now()) where id = ${d.user_id}`
    await tx`update donations set credited_at = now() where id = ${id}`
    console.log(`donation ${id} credited to ${d.user_id} (${s.points} → ${after} points)`)
    return (await settle(tx, d.user_id, effectiveTier(s), effectiveTier({ ...s, points: after }))) ? d.user_id : null
  }

  /** Puts `userId` at the Patreon `tier` (null: no active pledge). The account, when its tier changed. */
  const applyPatreon = async (tx: TransactionSql, userId: string, tier: SupporterTier | null): Promise<string | null> => {
    const s = await lockStanding(tx, userId)
    if (!s) return null
    await tx`
      update users set patreon_tier = ${tier}, patreon_best = ${highestTier(s.patreonBest, tier)},
        supporter_since = case when ${tier}::text is null then supporter_since else coalesce(supporter_since, now()) end
      where id = ${userId}`
    return (await settle(tx, userId, effectiveTier(s), effectiveTier({ ...s, patreon: tier }))) ? userId : null
  }

  const changed = (userIds: readonly (string | null)[]) => {
    for (const id of userIds) if (id) hooks.onTierChange?.(id)
  }

  return {
    /** An AbacatePay checkout about to open: its row, for the account of `handle` when given. False when nobody has that handle. */
    open: async (ref: string, handle: string | null) => {
      const [user] = handle ? await sql<{ id: string }[]>`select id from users where handle = ${handle}` : []
      if (handle && !user) return false
      await sql`insert into donations (provider, ref, handle, user_id) values ('abacatepay', ${ref}, ${handle}, ${user?.id ?? null})`
      return true
    },

    /** A webhook said `d` is paid: records it (once, however often the webhook retries) and credits it. */
    paid: async (d: PaidDonation) => {
      const raised = await sql.begin(async (tx) => {
        const points = donationPoints(d.amount, d.currency)
        const [row] = await tx<{ id: string }[]>`
          insert into donations (provider, ref, handle, user_id, amount, currency, points, paid_at)
          values (${d.provider}, ${d.ref}, ${d.handle}, (select id from users where handle = ${d.handle}), ${d.amount}, ${d.currency.toLowerCase()}, ${points}, now())
          on conflict (ref) do update
          set amount = excluded.amount, currency = excluded.currency, points = excluded.points, paid_at = coalesce(donations.paid_at, excluded.paid_at)
          returning id`
        return row ? await credit(tx, row.id) : null
      })
      changed([raised])
    },

    /**
     * A Patreon member event: the patron's tier now (`patreonMember`), kept
     * for them, and applied to the account that linked them, if any.
     */
    patreonPledge: async (m: PatreonMember) => {
      const moved = await sql.begin(async (tx) => {
        await tx`
          insert into patreon_members (patreon_id, tier) values (${m.patron}, ${m.tier})
          on conflict (patreon_id) do update set tier = excluded.tier, updated_at = now()`
        const [user] = await tx<{ id: string }[]>`select id from users where patreon_id = ${m.patron}`
        return user ? await applyPatreon(tx, user.id, m.tier) : null
      })
      changed([moved])
    },

    /**
     * A Patreon webhook said a patron's charge is paid: records it once (by
     * its ref, however many events repeat it), for the account that linked
     * the patron or waiting for one. Only history: the tier comes from the
     * pledge. Each charge's amount is what the member's lifetime total grew
     * past the others (`patreonAmount`), one member at a time; a charge that
     * adds nothing records nothing. Its gems (`GEM_PATREON` by the pledge's
     * tier) go to the linked account under the charge's ref, or wait on the
     * row (`donations.gems`) until the patron links.
     */
    patreonCharge: async (c: PatreonCharge) => {
      await sql.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(hashtext(${`patreon:${c.member}`}))`
        const [known] = await tx<{ id: string }[]>`select id from donations where ref = ${c.ref}`
        if (known) return
        const [prior] = await tx<{ cents: number }[]>`
          select coalesce(sum(amount), 0)::int as cents from donations where provider = 'patreon' and ref like ${`patreon:${c.member}:%`}`
        const amount = patreonAmount(c, prior?.cents ?? 0)
        if (amount <= 0) return
        const [user] = await tx<{ id: string }[]>`select id from users where patreon_id = ${c.patron}`
        const gems = c.tier ? GEM_PATREON[c.tier] : null
        await tx`
          insert into donations (provider, ref, patreon_id, user_id, amount, currency, points, paid_at, credited_at, gems)
          values ('patreon', ${c.ref}, ${c.patron}, ${user?.id ?? null}, ${amount}, ${c.currency}, ${donationPoints(amount, c.currency)}, now(), ${user ? new Date() : null}, ${gems})
          on conflict (ref) do nothing`
        if (user && gems) await moveGems(tx, user.id, gems, 'patreon', c.ref)
      })
    },

    /**
     * Links the Patreon user `patronId` to `userId` (one game account per
     * Patreon account: whoever links it last keeps it, and the one it leaves
     * loses its tier), gives the account the patron's tier the webhooks last
     * told (`patreon_members`; none yet, it comes with the next member event)
     * and files the patron's charges that were waiting for an account, with their gems.
     */
    linkPatreon: async (userId: string, patronId: string) => {
      const touched = await sql.begin(async (tx) => {
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        const left = await tx<{ id: string }[]>`select id from users where patreon_id = ${patronId} and id <> ${userId}`
        const dropped: (string | null)[] = []
        for (const u of left) {
          await tx`update users set patreon_id = null where id = ${u.id}`
          dropped.push(await applyPatreon(tx, u.id, null))
        }
        await tx`update users set patreon_id = ${patronId} where id = ${userId}`
        const waiting = await tx<{ ref: string; gems: number | null }[]>`
          update donations set user_id = ${userId}, credited_at = coalesce(credited_at, now())
          where provider = 'patreon' and patreon_id = ${patronId} and user_id is null returning ref, gems`
        if (waiting.length > 0) console.log(`patreon ${patronId} linked to ${userId}: ${waiting.length} waiting charges`)
        for (const w of waiting) if (w.gems) await moveGems(tx, userId, w.gems, 'patreon', w.ref)
        const [member] = await tx<{ tier: string | null }[]>`select tier from patreon_members where patreon_id = ${patronId}`
        return [...dropped, await applyPatreon(tx, userId, parseTier(member?.tier))]
      })
      changed(touched)
    },

    /** Forgets the player's Patreon, and the tier it gave: later charges wait for whoever links it next. What it already sent stays. */
    unlinkPatreon: async (userId: string) => {
      const moved = await sql.begin(async (tx) => {
        await tx`update users set patreon_id = null where id = ${userId}`
        return applyPatreon(tx, userId, null)
      })
      changed([moved])
    },

    /** What the thank-you page shows for `ref`, or null before any webhook (Stripe's row comes with it). */
    status: async (ref: string): Promise<DonationStatus | null> => {
      const [row] = await sql<{ paid: boolean; handle: string | null; code: string | null; redeemed: boolean }[]>`
        select d.paid_at is not null as paid, u.handle, d.code, d.code is not null and d.user_id is not null as redeemed
        from donations d left join users u on u.id = d.user_id where d.ref = ${ref}`
      if (!row) return null
      // A redeemed code is someone's account now: the page only says it was used.
      return { paid: row.paid, handle: row.redeemed ? null : row.handle, code: row.redeemed ? null : row.code, redeemed: row.redeemed }
    },

    /** Redeems a code for `userId`. `unknown`: no such code; `used`: it went to an account already. */
    redeem: async (userId: string, code: string): Promise<{ ok: true; tier: SupporterTier | null } | { ok: false; error: 'unknown' | 'used' }> => {
      const out = await sql.begin(async (tx) => {
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        const [d] = await tx<{ id: string; user_id: string | null }[]>`select id, user_id from donations where code = ${code} for update`
        if (!d) return { ok: false, error: 'unknown' } as const
        if (d.user_id) return { ok: false, error: 'used' } as const
        await tx`update donations set user_id = ${userId} where id = ${d.id}`
        const raised = await credit(tx, d.id)
        const s = await lockStanding(tx, userId)
        return { ok: true, tier: s ? effectiveTier(s) : null, raised } as const
      })
      if (!out.ok) return out
      changed([out.raised])
      return { ok: true, tier: out.tier }
    },

    /** The player's own standing, with their vote in each poll and whether they linked a Patreon. */
    mine: async (userId: string): Promise<SupporterStatus> => {
      const [row] = await sql<(StandingRow & { since: Date | null; public: boolean; vote: string | null; diamond_vote: string | null; patreon: boolean })[]>`
        select supporter_points, og_tier, patreon_tier, patreon_best, supporter_since as since, supporter_public as public, patreon_id is not null as patreon,
          (select choice from poll_votes where poll = ${POLLS.supporters.id} and user_id = ${userId}) as vote,
          (select choice from poll_votes where poll = ${POLLS.diamond.id} and user_id = ${userId}) as diamond_vote
        from users where id = ${userId}`
      return {
        tier: row ? tierOfRow(row) : null,
        since: row?.since?.toISOString() ?? null,
        public: row?.public ?? true,
        og: row ? row.og_tier !== null : false,
        vote: pollOptionIds('supporters').find((id) => id === row?.vote) ?? null,
        diamondVote: pollOptionIds('diamond').find((id) => id === row?.diamond_vote) ?? null,
        patreon: row?.patreon ?? false,
      }
    },

    /**
     * On boot: sends the OG Supporter title (`OG_GIFT`) to every OG account
     * that hasn't got it. Its key keeps it to one per account, so every boot,
     * and two instances side by side, may run it. How many it sent.
     */
    ogGifts: async () => {
      const due = await sql<{ id: string }[]>`
        select id from users u where og_tier is not null and not exists (select 1 from gifts g where g.user_id = u.id and g.key = ${OG_GIFT.key})`
      if (due.length === 0) return 0
      await sql.begin(async (tx) => {
        for (const u of due) await sendGift(tx, u.id, OG_GIFT.content, { kind: 'og' }, OG_GIFT.key)
      })
      console.log(`og title sent to ${due.length} OG supporters`)
      return due.length
    },

    /** Shows or hides the player's badge and name on the wall and the credits. */
    setPublic: async (userId: string, show: boolean) => {
      await sql`update users set supporter_public = ${show} where id = ${userId}`
    },

    /** Supporters on the Hall per tier who stay off the wall (hidden, or without a handle yet): the Hall counts them without naming them. */
    hidden: async (): Promise<HiddenSupporters> => {
      const rows = await sql<StandingRow[]>`
        select supporter_points, og_tier, patreon_tier, patreon_best from users
        where (supporter_points > 0 or patreon_tier is not null or patreon_best in ('gold', 'diamond'))
          and not (supporter_public and handle is not null)`
      const counts: HiddenSupporters = { supporter: 0, gold: 0, diamond: 0 }
      for (const r of rows) {
        const tier = hallTier(standingOf(r))
        if (tier) counts[tier]++
      }
      return counts
    },

    /**
     * The Hall da Fama's names (`hallTier`: one-time donors and OGs for good,
     * patrons while they pledge, Gold and Diamond patrons for good) who show
     * themselves and have a handle (never a banned one), oldest first, with
     * their title and Pokémon. Only the save fields those read come out of
     * Postgres, never the whole save.
     */
    wall: async (): Promise<WallEntry[]> => {
      const rows = await sql<(StandingRow & { handle: string; name: string | null; since: Date; save: unknown })[]>`
        select u.handle, u.name, u.supporter_points, u.og_tier, u.patreon_tier, u.patreon_best, u.supporter_since as since,
          case when s.user_id is null then null else jsonb_build_object(
            'version', s.data->'version', 'partner', s.data->'partner', 'shinyPicks', s.data->'shinyPicks',
            'companion', s.data->'companion', 'companions', s.data->'companions', 'shinyStarters', s.data->'shinyStarters', 'hatched', s.data->'hatched',
            'legends', s.data->'legends',
            'title', s.data->'title', 'titles', s.data->'titles', 'style', s.data->'style', 'achievements', jsonb_build_object('unlocked', s.data->'achievements'->'unlocked')
          ) end as save
        from users u left join saves s on s.user_id = u.id
        where (u.supporter_points > 0 or u.patreon_tier is not null or u.patreon_best in ('gold', 'diamond'))
          and u.supporter_since is not null and u.supporter_public and u.handle is not null and u.banned_at is null
        order by u.supporter_since, u.id limit ${WALL_SIZE}`
      return rows.flatMap((r) => {
        const tier = hallTier(standingOf(r))
        if (!tier) return []
        // Never synced: no title, and the Hall shows a Poké Ball.
        const save = r.save === null ? null : parseSaveData(r.save)
        return [{ handle: r.handle, name: r.name ?? r.handle, tier, since: r.since.toISOString(), og: r.og_tier !== null, title: save?.title ?? null, pokemon: save ? hallPokemon(save, tier) : null }]
      })
    },

    /** The `kind` poll's votes per option. */
    poll: async <K extends PollKind>(kind: K): Promise<Poll<K>> => {
      const { id } = POLLS[kind]
      const rows = await sql<{ choice: string; n: number }[]>`select choice, count(*)::int as n from poll_votes where poll = ${id} group by choice`
      return { id, votes: Object.fromEntries(pollOptionIds(kind).map((o) => [o, rows.find((r) => r.choice === o)?.n ?? 0])) as Record<PollOption<K>, number> }
    },

    /** A vote in the `kind` poll (replacing the previous one). False when `userId` may not vote there: a supporter's, Diamond's for `diamond`. */
    vote: async <K extends PollKind>(userId: string, kind: K, choice: PollOption<K>) => {
      const [row] = await sql<StandingRow[]>`select supporter_points, og_tier, patreon_tier, patreon_best from users where id = ${userId}`
      if (!row || !atLeast(tierOfRow(row), kind === 'diamond' ? 'diamond' : 'supporter')) return false
      await sql`
        insert into poll_votes (poll, user_id, choice) values (${POLLS[kind].id}, ${userId}, ${choice})
        on conflict (poll, user_id) do update set choice = excluded.choice, voted_at = now()`
      return true
    },
  }
}

export type SupporterStore = ReturnType<typeof supporterStore>
