import { clerkVerifier } from './auth'
import { connect } from './db'
import { loadEnv } from './env'
import { friendStore } from './friends'
import { startPlayServer } from './play/server'

/**
 * The realtime co-op server (`play/`), its own process so the API's frequent
 * deploys don't end the runs in progress. It reads the API's tables (users,
 * follows) but never migrates them: the API owns the schema.
 */
const env = loadEnv(3001)
const sql = connect(env.databaseUrl)

const play = startPlayServer({ port: env.port, allowedOrigin: env.allowedOrigin, verify: clerkVerifier(env), friends: friendStore(sql) })

const shutdown = () => {
  setTimeout(() => process.exit(0), 5000).unref()
  void play.close().then(() => sql.end({ timeout: 2 })).then(() => process.exit(0))
}
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
