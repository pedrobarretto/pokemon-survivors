import type { ClerkClient } from '@clerk/backend'
import { DISCORD_GIFT } from '../../src/game/gifts'
import { SUPPORTER_TIERS, type SupporterTier } from '../../src/game/supporters'
import { isRecord } from '../../src/game/parse'
import type { Sql } from './db'
import { idsByName, restClient, type DiscordConfig } from './discord'
import { sendGift } from './gifts'
import { standingOf, tierOfRow, type StandingRow } from './supporters'

/**
 * A game account linked to Discord. The player connects Discord to their
 * Clerk account in the game (or signs up with it); `link` then reads that
 * account from Clerk, remembers its id on `users`, puts the player in the
 * community server (Discord's `guilds.join`, with the OAuth token Clerk keeps)
 * and gives them their supporter role. Once they're in, the account gets
 * its thank-you (`DISCORD_GIFT`, key `discord`: once per account, however
 * often they relink). A donation or a pledge that changes a linked player's
 * tier, up or down, updates the role (`syncRoles`). An OG supporter also
 * wears the OG role, for good (`settleOg` on boot gives it to the OGs already
 * linked). Linking never grants Trainer: that one is earned in #introductions (`discord.ts`).
 */

/** The server's supporter roles, by name (`scripts/discord/setup.mjs`). */
export const SUPPORTER_ROLES = { supporter: 'Supporter', gold: 'Gold Supporter', diamond: 'Diamond Supporter' } as const satisfies Record<SupporterTier, string>

/** The OG supporters' role (`users.og_tier`), beside their tier's. */
export const OG_ROLE = 'OG Supporter'

/**
 * The roles a tier adds and removes: its own, never the others (one heart on
 * the member list), and the OG role for an OG. No tier removes all three: a
 * pledge that ended takes its role back (only `syncRoles` passes null, when
 * the tier went down). The OG role is never removed.
 */
export const supporterRoleChanges = (tier: SupporterTier | null, og: boolean): { add: string[]; remove: string[] } => ({
  add: [...(tier ? [SUPPORTER_ROLES[tier]] : []), ...(og ? [OG_ROLE] : [])],
  remove: SUPPORTER_TIERS.filter((t) => t !== tier).map((t) => SUPPORTER_ROLES[t]),
})

/** What Clerk says of one of a user's external accounts (the fields `discordAccount` reads). */
export type ExternalAccountInfo = { provider: string; providerUserId: string; username: string | null; verification: { status: string } | null }

/**
 * The user's verified Discord account (`provider` is `discord`, or
 * `oauth_discord` from older APIs), or null. Clerk sometimes finishes a
 * connection without reading the profile: `id` and `username` come empty, and
 * `link` asks Discord itself (`discordMe`).
 */
export const discordAccount = (accounts: readonly ExternalAccountInfo[]) => {
  const found = accounts.find((a) => (a.provider === 'discord' || a.provider === 'oauth_discord') && a.verification?.status === 'verified')
  return found ? { id: found.providerUserId, username: found.username ?? '' } : null
}

/** Who a Discord OAuth token belongs to (`GET /users/@me`), or null when Discord won't say. */
const discordMe = async (token: string) => {
  const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'DiscordBot (https://www.pokemonsurvivors.com, 1)' } })
  const me: unknown = res.ok ? await res.json() : null
  return isRecord(me) && typeof me.id === 'string' ? { id: me.id, username: typeof me.username === 'string' ? me.username : '' } : null
}

/** What linking came to: `joined` when the player is in the server now (false without the bot or when Discord refused). */
export type LinkResult = { linked: false } | { linked: true; username: string; joined: boolean }

export const discordLink = (sql: Sql, clerk: ClerkClient, bot: DiscordConfig | null) => {
  const call = bot ? restClient(bot.token) : null
  const guild = bot ? `/guilds/${bot.guildId}` : ''
  let roles: Map<string, string> | null = null

  /** The server's role ids by name, read once (again when one is missing, after `setup.mjs` added it). */
  const roleId = async (name: string) => {
    if (!call) return null
    if (!roles?.has(name)) roles = idsByName(await call('GET', `${guild}/roles`))
    return roles.get(name) ?? null
  }

  /** Puts the member's supporter roles in line with `tier` and `og`. Throws when Discord does (a member who left: 404). */
  const applyRoles = async (discordId: string, tier: SupporterTier | null, og: boolean) => {
    if (!call) return
    const { add, remove } = supporterRoleChanges(tier, og)
    for (const name of add) {
      const id = await roleId(name)
      if (id) await call('PUT', `${guild}/members/${discordId}/roles/${id}`)
    }
    for (const name of remove) {
      const id = await roleId(name)
      if (id) await call('DELETE', `${guild}/members/${discordId}/roles/${id}`)
    }
  }

  /** The account's tier and whether it's an OG. */
  const rolesOf = async (userId: string) => {
    const [row] = await sql<StandingRow[]>`select supporter_points, og_tier, patreon_tier, patreon_best from users where id = ${userId}`
    return row ? { tier: tierOfRow(row), og: standingOf(row).og !== null } : { tier: null, og: false }
  }

  /** The Discord OAuth token Clerk keeps for the player (`identify guilds.join`), or null. */
  const oauthToken = async (userId: string) => {
    const { data } = await clerk.users.getUserOauthAccessToken(userId, 'discord')
    return data[0]?.token ?? null
  }

  /** Sends the account its thank-you for joining (once: the key). */
  const thank = (userId: string) => sql.begin((tx) => sendGift(tx, userId, DISCORD_GIFT, { kind: 'discord' }, 'discord'))

  /** Adds the player to the server with their token (`guilds.join`); already in, Discord just answers 204. */
  const join = async (discordId: string, token: string | null) => {
    if (!call || !token) return false
    await call('PUT', `${guild}/members/${discordId}`, { access_token: token })
    return true
  }

  return {
    /**
     * Reads the player's Discord account from Clerk and links it, asking
     * Discord who it is with Clerk's token (Clerk's own copy may be empty).
     * Throws when Clerk can't answer.
     */
    link: async (userId: string): Promise<LinkResult> => {
      const user = await clerk.users.getUser(userId)
      const connected = discordAccount(user.externalAccounts)
      if (!connected) return { linked: false }
      const token = await oauthToken(userId)
      const me = token ? await discordMe(token).catch(() => null) : null
      const account = me ?? (connected.id ? connected : null)
      if (!account) return { linked: false }
      // One game account per Discord account: Clerk keeps it on one user at a time, so another row holding it is stale (it moved).
      await sql`update users set discord_id = null, discord_name = null where discord_id = ${account.id} and id <> ${userId}`
      await sql`
        insert into users (id, discord_id, discord_name) values (${userId}, ${account.id}, ${account.username})
        on conflict (id) do update set discord_id = excluded.discord_id, discord_name = excluded.discord_name`
      let joined = false
      try {
        joined = await join(account.id, token)
        if (joined) {
          await thank(userId)
          // Only adds: a role a moderator gave someone who has no tier stays.
          const { tier, og } = await rolesOf(userId)
          if (tier) await applyRoles(account.id, tier, og)
        }
      } catch (err) {
        console.error(`discord join failed for ${userId}`, err)
      }
      return { linked: true, username: account.username, joined }
    },

    /**
     * On boot: thanks the linked players still in the server who never got
     * the gift (they linked before it existed, or Discord failed then).
     * Someone who left (404) waits for their next link.
     */
    settle: async () => {
      if (!call) return
      const due = await sql<{ id: string; discord_id: string }[]>`
        select id, discord_id from users u
        where discord_id is not null and not exists (select 1 from gifts g where g.user_id = u.id and g.key = 'discord')`
      for (const row of due) {
        const member = await call('GET', `${guild}/members/${row.discord_id}`).catch(() => null)
        if (member) await thank(row.id)
      }
      if (due.length > 0) console.log(`discord gifts settled for ${due.length} linked players`)
    },

    /**
     * On boot: gives the OG role to every linked OG (they linked before it
     * existed). Adding a role a member has is a no-op for Discord, so each
     * boot may run it; it waits until `setup.mjs` created the role. Someone
     * who left (404) gets it at their next link.
     */
    settleOg: async () => {
      const role = await roleId(OG_ROLE)
      if (!call || !role) return
      const linked = await sql<{ discord_id: string }[]>`select discord_id from users where og_tier is not null and discord_id is not null`
      let given = 0
      for (const row of linked) {
        if (await call('PUT', `${guild}/members/${row.discord_id}/roles/${role}`).then(() => true, () => false)) given++
      }
      if (linked.length > 0) console.log(`discord OG role settled for ${given} of ${linked.length} linked OGs`)
    },

    /** Forgets the player's Discord account (they unlinked it). They stay in the server with their roles. */
    unlink: async (userId: string) => {
      await sql`update users set discord_id = null, discord_name = null where id = ${userId}`
    },

    /** Puts a linked player's supporter role in line with their tier (after it changed, up or down). Never throws. */
    syncRoles: async (userId: string) => {
      if (!call) return
      try {
        const [row] = await sql<(StandingRow & { discord_id: string | null })[]>`
          select discord_id, supporter_points, og_tier, patreon_tier, patreon_best from users where id = ${userId}`
        if (row?.discord_id) await applyRoles(row.discord_id, tierOfRow(row), row.og_tier !== null)
      } catch (err) {
        console.error(`discord roles failed for ${userId}`, err)
      }
    },
  }
}

export type DiscordLink = ReturnType<typeof discordLink>
