/**
 * The API (`ROLE` unset, `index.ts`): migrations, the routes, the Discord bot and
 * the periodic jobs. It never re-simulates runs: the verifier does, in its own
 * process (`verifier.ts`).
 */
import { createClerkClient } from '@clerk/backend'
import { serve } from '@hono/node-server'
import { adminStore } from './admin'
import { createApp } from './app'
import { bugReportStore, createBugReports, discordBugForum } from './bugReports'
import { clerkVerifier } from './auth'
import { coopBeta } from './coopBeta'
import { connect, migrate, saveStore } from './db'
import { retrying } from './retrying'
import { createRibbons } from './challenge'
import { discordStore, startDiscord } from './discord'
import { discordLink } from './discordLink'
import { candyGoalStore } from './candyGoal'
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
await retrying('migrations', () => migrate(sql, new URL('../migrations/', import.meta.url)))

const clerk = createClerkClient({ secretKey: env.clerkSecretKey })
// With STREAM_ENFORCE on, runs not streamed in time stay off the boards; off, the API only measures (`replayStream.ts`).
const ranking = rankingStore(sql, { streamEnforce: env.streamEnforce })
// Chunks of runs that never reported, once an hour.
setInterval(() => void ranking.sweepChunks().catch((err) => console.error('chunk sweep failed', err)), 3600_000).unref()
// The player's Discord account: linking joins them to the server (with a gift); a donation that raises their tier updates their role.
const discord = discordLink(sql, clerk, env.discord)
void discord.settle().catch((err) => console.error('discord gifts settle failed', err))
const gifts = giftStore(sql)
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
  bot = startDiscord(env.discord, {
    store: discordStore(sql),
    ranking,
    ideas: suggestions,
    desk: staffDesk(sql),
    bugs: bugReports,
    beta: env.posthogPersonalKey ? coopBeta(env.posthogPersonalKey) : null,
    openRouter: env.openRouter,
  })
}

const app = createApp({
  store: saveStore(sql),
  ranking,
  friends: friendStore(sql),
  gifts,
  verify: clerkVerifier(env),
  donate: env.abacatePayKey ? abacatePay(env.abacatePayKey) : null,
  supporters: supporterStore(sql, { onTierUp: (userId) => void discord.syncRoles(userId) }),
  festival: festivalStore(sql),
  candyGoal: candyGoalStore(sql),
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

/**
 * Swarm kills the container 10 s after SIGTERM (its stop grace period), so the
 * shutdown fits in that: stop taking connections and keep dropping idle
 * keep-alive ones (Traefik reuses them, so `close` alone waited until the kill),
 * give requests in flight `drainMs`, then end the pool, which lets the queries
 * already sent finish and closes each connection cleanly. A connection cut with
 * a query half sent (postgres.js sends a parameterized query in two steps
 * without `prepare`) leaves its pooler backend mid-statement, and that
 * backend's 2-minute statement timer later cancels whoever it serves next.
 */
const STOP = { drainMs: 4000, poolSeconds: 3, hardMs: 9500 } as const
let stopping = false
const shutdown = () => {
  if (stopping) return
  stopping = true
  setTimeout(() => process.exit(0), STOP.hardMs).unref()
  const http = 'closeIdleConnections' in server ? server : null
  const idle = setInterval(() => http?.closeIdleConnections(), 250)
  const closed = new Promise<void>((resolve) => server.close(() => resolve()))
  const drained = new Promise<void>((resolve) => setTimeout(resolve, STOP.drainMs).unref())
  void Promise.race([closed, drained])
    .then(() => {
      clearInterval(idle)
      http?.closeAllConnections()
      return Promise.all([sql.end({ timeout: STOP.poolSeconds }), errors.flush()])
    })
    .finally(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
