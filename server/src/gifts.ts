import type { GiftContent, GiftReason } from '../../src/game/gifts'
import { canRefer, creditDue, MAX_INVITED, milestonesReached, REFERRAL, WELCOME_GIFT, type InvitedFriend } from '../../src/game/referral'
import type { TransactionSql } from 'postgres'
import type { Sql } from './db'

/** A gift as the API sends it to the game (`parseGift` reads it). */
export type GiftOut = { id: string; content: unknown; reason: unknown; at: string }

/** Gifts listed per call at most: the rest come next sync. */
const INBOX_SIZE = 20

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Mystery Gifts and invites. `send` is the way in for anything that rewards a
 * player outside a run (invites here, the challenge's ribbons in
 * `challenge.ts`): `key` keeps one gift per occasion, so sending again does nothing.
 *
 * Invites: `refer` records who brought a new account (`canRefer`), makes
 * them follow each other and welcomes the newcomer with a Friendship Egg;
 * `credit` (after each finished run) counts the invite for the inviter once
 * the newcomer has finished enough runs that really played (`playedRun`,
 * `creditDue`) and sends the
 * milestone gifts (`milestoneGifts`). Everything is counted here, never on the device.
 */
/**
 * Sends a gift inside a transaction (`userId` must have a users row). With a
 * `key`, only the first send of that key lands. `sentBy` is the admin who
 * sent it by hand. Whether it landed now.
 */
export const sendGift = async (q: TransactionSql, userId: string, content: GiftContent, reason: GiftReason | null, key: string | null, sentBy: string | null = null) => {
  const rows = await q`
    insert into gifts (user_id, kind, payload, reason, key, sent_by)
    values (${userId}, ${content.kind}, ${q.json(content)}, ${reason ? q.json(reason) : null}, ${key}, ${sentBy})
    on conflict (user_id, key) do nothing
    returning id`
  return rows.length > 0
}

/**
 * A run of `runs r` that counts for an invite: reported (finished), not
 * failed by its check, and at least `REFERRAL.minSeconds` long both in the
 * game and on the API's clock, so a farm of alt accounts has to really play.
 */
const playedRun = (q: Sql | TransactionSql) =>
  q`r.finished_at is not null and r.verified is not false and r.survived >= ${REFERRAL.minSeconds} and r.finished_at >= r.started_at + make_interval(secs => ${REFERRAL.minSeconds})`

/**
 * Pays `inviter` the gifts of every milestone their counted friends reached,
 * each under its own key, so only the new ones land. Locks the inviter's row
 * first, so two friends counting at once don't read the same total. How many
 * friends counted.
 */
const reward = async (tx: TransactionSql, inviter: string) => {
  await tx`select id from users where id = ${inviter} for update`
  const [brought] = await tx<{ n: number }[]>`select count(*)::int as n from users where referred_by = ${inviter} and referral_credited_at is not null`
  const friends = brought?.n ?? 0
  for (const m of milestonesReached(friends)) {
    for (const [i, content] of m.gifts.entries()) await sendGift(tx, inviter, content, { kind: 'friends', count: m.friends }, `friends:${m.friends}:${i}`)
  }
  return friends
}

export const giftStore = (sql: Sql) => {
  /**
   * After a finished run of `userId`: if someone brought them and this is
   * the run that makes the invite count, credits it once and pays the
   * inviter's milestones (`reward`).
   */
  const credit = (userId: string) =>
    sql.begin(async (tx) => {
      const [me] = await tx<{ referred_by: string | null; credited: boolean }[]>`
        select referred_by, referral_credited_at is not null as credited from users where id = ${userId} for update`
      if (!me?.referred_by || me.credited) return
      const [runs] = await tx<{ n: number }[]>`select count(*)::int as n from runs r where r.user_id = ${userId} and ${playedRun(tx)}`
      if (!creditDue(runs?.n ?? 0, me.credited)) return
      await tx`update users set referral_credited_at = now() where id = ${userId}`
      const friends = await reward(tx, me.referred_by)
      console.log(`invite of ${userId} counted for ${me.referred_by} (${friends} friends)`)
    })

  return {
    /** Sends a gift to `userId` (who must have a users row). With a `key`, only the first send of that key lands. */
    send: (userId: string, content: GiftContent, reason: GiftReason | null = null, key: string | null = null) =>
      sql.begin((tx) => sendGift(tx, userId, content, reason, key)),

    /** Sends many gifts in one go (a day's ribbons), each like `send`. */
    sendAll: (list: ReadonlyArray<{ userId: string; content: GiftContent; key: string }>) =>
      sql.begin(async (tx) => {
        for (const g of list) await sendGift(tx, g.userId, g.content, null, g.key)
      }),

    /** The player's unclaimed gifts, oldest first. */
    inbox: async (userId: string): Promise<GiftOut[]> => {
      const rows = await sql<{ id: string; payload: unknown; reason: unknown; created_at: Date }[]>`
        select id, payload, reason, created_at from gifts
        where user_id = ${userId} and claimed_at is null
        order by created_at, id limit ${INBOX_SIZE}`
      return rows.map((r) => ({ id: r.id, content: r.payload, reason: r.reason, at: r.created_at.toISOString() }))
    },

    /** Marks the player's gifts with these ids claimed (the game applied them). How many it marked now. */
    claim: async (userId: string, ids: readonly string[]) => {
      const valid = ids.filter((id) => UUID.test(id))
      if (valid.length === 0) return 0
      const rows = await sql`update gifts set claimed_at = now() where user_id = ${userId} and id = any(${valid}::uuid[]) and claimed_at is null returning id`
      return rows.length
    },

    /**
     * A sign up that came with an inviter's handle. Records the invite only
     * for a new account (`canRefer`): both follow each other and the
     * newcomer gets a Friendship Egg. Whether it was recorded.
     */
    refer: (userId: string, handle: string) =>
      sql.begin(async (tx) => {
        await tx`insert into users (id) values (${userId}) on conflict (id) do nothing`
        const [me] = await tx<{ age: number; referred_by: string | null; has_save: boolean }[]>`
          select extract(epoch from now() - created_at)::float8 / 3600 as age, referred_by,
            exists (select 1 from saves where user_id = ${userId}) as has_save
          from users where id = ${userId} for update`
        const [inviter] = await tx<{ id: string; handle: string }[]>`select id, handle from users where handle = ${handle}`
        const ok = canRefer({ userId, referrer: inviter?.id ?? null, ageHours: me?.age ?? Infinity, hasSave: me?.has_save ?? true, referredBy: me?.referred_by ?? null })
        if (!ok || !inviter) return false
        await tx`update users set referred_by = ${inviter.id}, referred_at = now() where id = ${userId}`
        await tx`insert into follows (follower_id, followee_id) values (${userId}, ${inviter.id}), (${inviter.id}, ${userId}) on conflict do nothing`
        await sendGift(tx, userId, WELCOME_GIFT, { kind: 'welcome', from: inviter.handle }, 'welcome')
        return true
      }),

    credit,

    /**
     * On boot: credits the invites whose runs got there while nobody was
     * counting, and pays every inviter the milestones they reached (a
     * milestone added since reaches whoever already passed it). Keys make it
     * safe to run on every start.
     */
    settle: async () => {
      const pending = await sql<{ id: string }[]>`select id from users where referred_by is not null and referral_credited_at is null`
      for (const { id } of pending) await credit(id)
      const inviters = await sql<{ id: string }[]>`select distinct referred_by as id from users where referral_credited_at is not null and referred_by is not null`
      for (const { id } of inviters) await sql.begin((tx) => reward(tx, id))
    },

    /** The friends who signed up with `userId`'s link, newest first: their finished runs (up to what counts) and whether they counted. */
    invites: async (userId: string): Promise<InvitedFriend[]> => {
      const rows = await sql<{ handle: string | null; name: string | null; runs: number; counted: boolean }[]>`
        select u.handle, u.name, u.referral_credited_at is not null as counted,
          (select count(*)::int from (select 1 from runs r where r.user_id = u.id and ${playedRun(sql)} limit ${REFERRAL.runs}) x) as runs
        from users u where u.referred_by = ${userId}
        order by u.referred_at desc nulls last limit ${MAX_INVITED}`
      return rows.map((r) => ({ handle: r.handle, name: r.name ?? '', runs: r.runs, counted: r.counted }))
    },
  }
}

export type GiftStore = ReturnType<typeof giftStore>
