/** Origins the game is served from. `CORS_ORIGINS` (comma separated) adds more, like a preview deploy. */
const ORIGINS = ['https://www.pokemonsurvivors.com', 'https://pokemonsurvivors.com']

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** Server config, read once at boot (`defaultPort` when `PORT` isn't set). Throws when a required variable is missing. */
export const loadEnv = (defaultPort = 3000) => {
  const origins = [...ORIGINS, ...(process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)]
  return {
    port: Number(process.env.PORT ?? defaultPort),
    databaseUrl: required('DATABASE_URL'),
    clerkSecretKey: required('CLERK_SECRET_KEY'),
    /** Optional PEM public key: verifies tokens without fetching Clerk's keys. */
    clerkJwtKey: process.env.CLERK_JWT_KEY || undefined,
    /** Whether the game at `origin` may call the API (CORS) and own its tokens (`azp`). */
    allowedOrigin: (origin: string) => origins.includes(origin) || LOCALHOST.test(origin),
  }
}

export type Env = ReturnType<typeof loadEnv>
