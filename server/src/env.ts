/** Origins the game is served from. `CORS_ORIGINS` (comma separated) adds more, like a preview deploy. */
const ORIGINS = ['https://www.pokemonsurvivors.com', 'https://pokemonsurvivors.com']

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/** Server config, read once at boot. Throws when a required variable is missing. */
export const loadEnv = () => {
  const origins = [...ORIGINS, ...(process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)]
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    clerkSecretKey: required('CLERK_SECRET_KEY'),
    /** Optional PEM public key: verifies tokens without fetching Clerk's keys. */
    clerkJwtKey: process.env.CLERK_JWT_KEY || undefined,
    /** Optional AbacatePay key (donations by Pix and Brazilian cards). Without it `POST /donations` answers 503. */
    abacatePayKey: process.env.ABACATEPAY_API_KEY || undefined,
    /**
     * Optional: the AbacatePay webhook's secret, `whsec_…` (Standard Webhooks), or for a webhook made
     * before 01/10/2026 the one in its URL (`?webhookSecret=`). Without it `POST /webhooks/abacatepay` answers 503.
     */
    abacatePayWebhookSecret: process.env.ABACATEPAY_WEBHOOK_SECRET || undefined,
    /** Optional: the Stripe webhook's signing secret (`whsec_…`). Without it `POST /webhooks/stripe` answers 503. */
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    /** Optional: the donation Payment Link's id (`plink_…`); set, other Checkout Sessions of the account are ignored. */
    stripePaymentLink: process.env.STRIPE_PAYMENT_LINK || null,
    /**
     * Optional: the community Discord's bot (`src/discord.ts`), its token and the server's id. Without both
     * there's no bot: no introduction gate, patch notes or daily posts.
     */
    discord:
      process.env.DISCORD_BOT_TOKEN && process.env.DISCORD_GUILD_ID
        ? { token: process.env.DISCORD_BOT_TOKEN, guildId: process.env.DISCORD_GUILD_ID }
        : null,
    /**
     * Optional: OpenRouter, for the Discord staff's bot (`src/staffAgent.ts`, `src/ideaWriter.ts`). `OPENROUTER_MODEL`
     * picks the model (one with tool calls). Without the key, tagging the bot does nothing and `/ask` and `/idea` say so.
     */
    openRouter: process.env.OPENROUTER_API_KEY
      ? { key: process.env.OPENROUTER_API_KEY, model: process.env.OPENROUTER_MODEL || 'anthropic/claude-haiku-5.5' }
      : null,
    /** Optional: the game's PostHog project token (`phc_…`, the client's `VITE_POSTHOG_KEY`). Without it errors only go to the log. */
    posthogKey: process.env.POSTHOG_KEY || undefined,
    /** Optional: the #bug-reports forum's channel id, where the bot posts bug reports. Unset, it's found by name. */
    discordBugForumId: process.env.DISCORD_BUG_FORUM_ID || null,
    /** Emails (comma separated, `ADMIN_EMAILS`) whose verified owners run the gift desk (`admin.ts`). Empty: nobody is admin. */
    adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    /**
     * `STREAM_ENFORCE=1`: a ranked run whose replay wasn't streamed in time (`streamedInTime` in
     * `src/game/replayStream.ts`) stays off the public boards. Off (the default), the API only stores and logs the lag.
     */
    streamEnforce: ['1', 'true', 'on'].includes((process.env.STREAM_ENFORCE ?? '').trim().toLowerCase()),
    /** Whether the game at `origin` may call the API (CORS) and own its tokens (`azp`). */
    allowedOrigin: (origin: string) => origins.includes(origin) || LOCALHOST.test(origin),
  }
}

export type Env = ReturnType<typeof loadEnv>
