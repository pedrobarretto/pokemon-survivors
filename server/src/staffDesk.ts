import type { GiftContent } from '../../src/game/gifts'
import { parseHandle } from '../../src/game/ranking'
import { supporterTier, type SupporterTier } from '../../src/game/supporters'
import type { Sql } from './db'
import { sendGift } from './gifts'
import { giftRefusal, tally, type GiftRefusal, type StaffGift, type StaffRank } from './staffGifts'

/**
 * The Discord staff's desk, behind the bot (`staffAgent.ts`, the slash
 * commands in `discord.ts`): finds a player by Discord account or @handle,
 * reads their profile and sends them gifts within the staff's allowance
 * (`staffGifts.ts`). Nothing here asks Clerk.
 */

/** Who a staff member means: a Discord account (a mention or a bare id) or a game @handle. */
export type Who = { by: 'discord'; id: string } | { by: 'handle'; handle: string }

/** `<@123>`, `<@!123>` or `123…` (a Discord id) → that account; anything else → a handle (`@` and case dropped). Null when neither. */
export const parseWho = (text: string): Who | null => {
  const raw = text.trim()
  const discord = /^<@!?(\d{15,22})>$/.exec(raw)?.[1] ?? (/^\d{15,22}$/.test(raw) ? raw : null)
  if (discord) return { by: 'discord', id: discord }
  const handle = parseHandle(raw.replace(/^@/, ''))
  return handle ? { by: 'handle', handle } : null
}

/** What staff see about a player. */
export type PlayerProfile = {
  id: string
  handle: string | null
  name: string | null
  discordId: string | null
  joined: string
  seen: string
  banned: { at: string; reason: string | null } | null
  supporter: SupporterTier | null
  /** Finished runs per difficulty: how many, wins and the longest survived (seconds). */
  runs: { difficulty: string; runs: number; wins: number; best: number }[]
}

/** A player found, or the handles that start like the one asked for (none found exactly). */
export type Found = { ok: true; player: PlayerProfile } | { ok: false; similar: string[] }

type UserRow = {
  id: string
  handle: string | null
  name: string | null
  discord_id: string | null
  created_at: Date
  seen_at: Date
  banned_at: Date | null
  banned_reason: string | null
  supporter_points: number
}

/** The day's keys of a staff member's gifts start with this: they count towards the allowance. */
const keyPrefix = (staffDiscordId: string, day: string) => `dstaff:${staffDiscordId}:${day}:`

/** What sending came to: sent, a key sent already (a retry), a player not found, or refused by the rules. */
export type StaffSend = { ok: true; sent: boolean; to: PlayerProfile } | { ok: false; error: 'unknown' } | { ok: false; error: GiftRefusal }

export const staffDesk = (sql: Sql) => {
  const profile = async (u: UserRow): Promise<PlayerProfile> => {
    const runs = await sql<{ difficulty: string; runs: number; wins: number; best: number }[]>`
      select difficulty, count(*)::int as runs, count(*) filter (where outcome = 'victory')::int as wins, coalesce(max(survived), 0)::float8 as best
      from runs where user_id = ${u.id} and finished_at is not null and difficulty is not null
      group by difficulty order by runs desc`
    return {
      id: u.id,
      handle: u.handle,
      name: u.name,
      discordId: u.discord_id,
      joined: u.created_at.toISOString(),
      seen: u.seen_at.toISOString(),
      banned: u.banned_at ? { at: u.banned_at.toISOString(), reason: u.banned_reason } : null,
      supporter: supporterTier(u.supporter_points),
      runs,
    }
  }

  const find = async (who: Who): Promise<Found> => {
    const [row] =
      who.by === 'discord'
        ? await sql<UserRow[]>`select id, handle, name, discord_id, created_at, seen_at, banned_at, banned_reason, supporter_points from users where discord_id = ${who.id}`
        : await sql<UserRow[]>`select id, handle, name, discord_id, created_at, seen_at, banned_at, banned_reason, supporter_points from users where handle = ${who.handle}`
    if (row) return { ok: true, player: await profile(row) }
    if (who.by === 'discord') return { ok: false, similar: [] }
    const similar = await sql<{ handle: string }[]>`select handle from users where starts_with(handle, ${who.handle}) order by seen_at desc limit 5`
    return { ok: false, similar: similar.map((r) => r.handle) }
  }

  return {
    find,

    /** What the staff member sent today (Brasília `day`). */
    sentToday: async (staffDiscordId: string, day: string) =>
      tally((await sql<{ payload: GiftContent }[]>`select payload from gifts where starts_with(key, ${keyPrefix(staffDiscordId, day)})`).map((r) => r.payload)),

    /**
     * Sends `gift` from a staff member to `who`, if the rules let it, as a
     * Mystery Gift from the staff's handle. `ref` (the Discord message or
     * interaction it came from) keeps a retry from sending twice. The check
     * and the send hold a lock per staff member, so two at once can't both
     * squeeze into the last of the allowance.
     */
    send: async (staff: { discordId: string; rank: StaffRank; account: { id: string; handle: string } | null }, who: Who, gift: StaffGift, day: string, ref: string): Promise<StaffSend> => {
      const found = await find(who)
      if (!found.ok) return { ok: false, error: 'unknown' }
      const prefix = keyPrefix(staff.discordId, day)
      return sql.begin(async (tx): Promise<StaffSend> => {
        await tx`select pg_advisory_xact_lock(hashtext(${prefix}))`
        const sent = tally((await tx<{ payload: GiftContent }[]>`select payload from gifts where starts_with(key, ${prefix})`).map((r) => r.payload))
        const refusal = giftRefusal(staff.rank, gift, sent)
        if (refusal) return { ok: false, error: refusal }
        const content: GiftContent = gift.kind === 'egg' ? { kind: 'egg', tier: gift.tier } : { kind: 'coins', amount: gift.amount }
        const landed = await sendGift(tx, found.player.id, content, { kind: 'staff', from: staff.account?.handle ?? null }, `${prefix}${ref}`, staff.account?.id ?? null)
        if (landed) console.log(`discord staff ${staff.discordId} sent ${content.kind} to ${found.player.id}`)
        return { ok: true, sent: landed, to: found.player }
      })
    },
  }
}

export type StaffDesk = ReturnType<typeof staffDesk>
