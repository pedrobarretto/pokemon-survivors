import { setPriority } from 'node:os'
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
// First: src/game's import cycles resolve by load order, and entering it through ranking.ts is an order that works (under tsx too).
import { rankingStore } from './ranking'
import { startChecks } from './checks'
import { connect } from './db'
import { loadChecksEnv } from './env'

/**
 * The verifier (`ROLE=checks`, `index.ts`): the same image as the API, running
 * only the re-simulation of ranked runs (`checks.ts`), pulled from the
 * database. No routes, no Discord bot, no migrations, no other jobs: just
 * `GET /health` on `PORT`, for the image's HEALTHCHECK (200 while Postgres
 * answers). It runs at the lowest OS priority, set before the worker thread
 * starts so the worker inherits it, so on a shared box the API always comes
 * first; `CHECKS=off` keeps it idle.
 */
try {
  setPriority(19)
} catch (err) {
  console.error('verifier: could not lower its priority', err)
}

const env = loadChecksEnv()
// One claim and a check's board queries at a time.
const sql = connect(env.databaseUrl, 3)
const checks = startChecks(rankingStore(sql), { paused: env.checksPaused })
console.log(env.checksPaused ? 'verifier paused (CHECKS=off)' : 'verifier checking ranked runs')

const ping = () => sql`select 1`.then(() => true, () => false)
const app = new Hono().get('/health', async (c) => ((await ping()) ? c.json({ ok: true }) : c.json({ ok: false }, 503)))
const server = serve({ fetch: app.fetch, port: env.port }, (info) => console.log(`verifier health on :${info.port}`))

/**
 * Swarm kills the container 10 s after SIGTERM. A check in hand is just
 * dropped (its claim runs out and it's checked again); the loop stops, then
 * the pool ends, letting the queries already sent finish.
 */
let stopping = false
const shutdown = () => {
  if (stopping) return
  stopping = true
  setTimeout(() => process.exit(0), 9500).unref()
  server.close()
  void Promise.race([checks.stop(), new Promise((resolve) => setTimeout(resolve, 4000).unref())])
    .then(() => sql.end({ timeout: 3 }))
    .finally(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
