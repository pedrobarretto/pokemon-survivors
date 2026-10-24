import { createClerkClient } from '@clerk/backend'
import { serve } from '@hono/node-server'
import { adminStore } from './admin'
import { createApp } from './app'
import { bugReportStore, createBugReports, discordBugForum } from './bugReports'
import { clerkVerifier } from './auth'
import { connect, migrate, saveStore } from './db'
import { createChecks } from './checks'
import { createRibbons } from './challenge'
import { discordStore, startDiscord } from './discord'
import { discordLink } from './discordLink'
import { festivalStore } from './festival'
import { abacatePay } from './donations'
import { friendStore } from './friends'
import { giftStore } from './gifts'
import { moderationStore } from './moderation'
import { rankingStore } from './ranking'
import { staffDesk } from './staffDesk'
import { supporterStore } from './supporters'
import { suggestionStore } from './suggestions'
import { loadEnv } from './env'
import { errorReports } from './errors'

const env = loadEnv()
const errors = errorReports(env.posthogKey)
const sql = connect(env.databaseUrl)
await migrate(sql, new URL('../migrations/', import.meta.url))

const clerk = createClerkClient({ secretKey: env.clerkSecretKey })
// With STREAM_ENFORCE on, runs not streamed in time stay off the boards; off, the API only measures (`replayStream.ts`).
const ranking = rankingStore(sql, { streamEnforce: env.streamEnforce })
// Chunks of runs that never reported, once an hour.
setInterval(() => void ranking.sweepChunks().catch((err) => console.error('chunk sweep failed', err)), 3600_000).unref()
// The player's Discord account: linking joins them to the server (with a gift); a donation that raises their tier updates their role.
const discord = discordLink(sql, clerk, env.discord)
void discord.settle().catch((err) => console.error('discord gifts settle failed', err))
const gifts = giftStore(sql)
const checks = createChecks(ranking)
// Runs that were waiting for a check when the last instance stopped.
void checks.resume()
// Invites that came due, and milestones reached, while no instance was counting.
void gifts.settle().catch((err) => console.error('invites settle failed', err))
// The Desafio do dia's ribbons, once a day closes (safe on every instance: each gift has a key per day).
createRibbons(ranking, gifts).start()
// Stored always; posted to #bug-reports when the bot is set up.
const bugReports = createBugReports({
  store: bugReportStore(sql),
  forum: env.discord ? discordBugForum({ ...env.discord, forumId: env.discordBugForumId }) : null,
  handleOf: async (userId) => (await ranking.profileName(userId))?.handle ?? null,
})
// The community Discord's bot: introduction gate, patch notes, daily posts, the idea review and the staff's tools (only with its env).
// New ideas wait for staff to approve them in #idea-review; without the bot they wait for the admin.
let bot: ReturnType<typeof startDiscord> | null = null
const suggestions = suggestionStore(sql, { onPosted: (idea) => bot?.reviewIdea(idea) })
if (env.discord) {
  bot = startDiscord(env.discord, { store: discordStore(sql), ranking, ideas: suggestions, desk: staffDesk(sql), bugs: bugReports, openRouter: env.openRouter })
}

const app = createApp({
  store: saveStore(sql),
  ranking,
  friends: friendStore(sql),
  gifts,
  checks,
  verify: clerkVerifier(env),
  donate: env.abacatePayKey ? abacatePay(env.abacatePayKey) : null,
  supporters: supporterStore(sql, { onTierUp: (userId) => void discord.syncRoles(userId) }),
  festival: festivalStore(sql),
  discord,
  suggestions,
  bugReports,
  admin: adminStore(sql, clerk, env.adminEmails),
  moderation: moderationStore(sql),
  webhooks: { stripeSecret: env.stripeWebhookSecret, stripePaymentLink: env.stripePaymentLink, abacatePaySecret: env.abacatePayWebhookSecret },
  allowedOrigin: env.allowedOrigin,
  ping: () => sql`select 1`.then(() => true, () => false),
  report: errors.report,
})

const server = serve({ fetch: app.fetch, port: env.port }, (info) => console.log(`api listening on :${info.port}`))

const shutdown = () => server.close(() => void Promise.all([sql.end({ timeout: 5 }), errors.flush()]).then(() => process.exit(0)))
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
