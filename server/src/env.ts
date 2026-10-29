/** Origins the game is served from. `CORS_ORIGINS` (comma separated) adds more, like a preview deploy. */
const ORIGINS = ['https://www.pokemonsurvivors.com', 'https://pokemonsurvivors.com']

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/

const required = (name: string) => {
  const value = process.env[name]
  if (!value) throw new Error(`Missing environment variable ${name}`)
  return value
}

/**
 * What this process runs (`ROLE`): the API (the default: routes, the Discord bot,
 * migrations and periodic jobs), or `checks`, the verifier alone (`verifier.ts`).
 */
export const serverRole = (): 'api' | 'checks' => ((process.env.ROLE ?? '').trim().toLowerCase() === 'checks' ? 'checks' : 'api')

/** The verifier's config (`ROLE=checks`): only the database. Throws without `DATABASE_URL`. */
export const loadChecksEnv = () => ({
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  /** `CHECKS=off` pauses the re-simulation of ranked runs (`checks.ts`): runs stay pending, replays kept, until a start without it. */
  checksPaused: (process.env.CHECKS ?? '').trim().toLowerCase() === 'off',
})

/** The API's config, read once at boot. Throws when a required variable is missing. */
export const loadEnv = () => {
  const origins = [...ORIGINS, ...(process.env.CORS_ORIGINS ?? '').split(',').map((o) => o.trim()).filter(Boolean)]
  return {
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: required('DATABASE_URL'),
    clerkSecretKey: required('CLERK_SECRET_KEY'),
    /** Optional PEM public key: verifies tokens without fetching Clerk's keys. */
    clerkJwtKey: process.env.CLERK_JWT_KEY || undefined,
    /** Optional AbacatePay key (donations by Pix and Brazilian cards, gem packs by Pix). Without it `POST /donations` and Pix gem checkouts answer 503. */
    abacatePayKey: process.env.ABACATEPAY_API_KEY || undefined,
    /**
     * Optional: the AbacatePay webhook's secret, `whsec_…` (Standard Webhooks), or for a webhook made
     * before 01/10/2026 the one in its URL (`?webhookSecret=`). Without it `POST /webhooks/abacatepay` answers 503.
     */
    abacatePayWebhookSecret: process.env.ABACATEPAY_WEBHOOK_SECRET || undefined,
    /** Optional: the Stripe webhook's signing secret (`whsec_…`). Without it `POST /webhooks/stripe` answers 503. */
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || undefined,
    /**
     * Optional: a Stripe secret key for gem packs' Checkout Sessions (`src/stripe.ts`), best a restricted `rk_` key
     * that may write Checkout Sessions. Without it `POST /gems/checkout` answers 503 for `card`.
     */
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || undefined,
    /** Optional: the donation Payment Link's id (`plink_…`); set, other Checkout Sessions of the account are ignored. */
    stripePaymentLink: process.env.STRIPE_PAYMENT_LINK || null,
    /**
     * Optional: the Patreon OAuth client (patreon.com/portal) and its redirect URI (the API's `/patreon/callback`),
     * for linking a Patreon account (`src/patreon.ts`). Without all three the `/patreon` routes answer 503 and the game hides the button.
     */
    patreon:
      process.env.PATREON_CLIENT_ID && process.env.PATREON_CLIENT_SECRET && process.env.PATREON_REDIRECT_URI
        ? { clientId: process.env.PATREON_CLIENT_ID, clientSecret: process.env.PATREON_CLIENT_SECRET, redirectUri: process.env.PATREON_REDIRECT_URI }
        : null,
    /** Optional: the Patreon webhook's secret. Without it `POST /webhooks/patreon` answers 503. */
    patreonWebhookSecret: process.env.PATREON_WEBHOOK_SECRET || undefined,
    /** The Patreon campaign's currency, for a webhook whose payload doesn't say (`PATREON_CURRENCY`, default `usd`). */
    patreonCurrency: (process.env.PATREON_CURRENCY || 'usd').trim().toLowerCase(),
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
    /**
     * Optional: a PostHog personal API key (`phx_…`, scope `feature_flag:write` on the game's project), for the Discord
     * staff's `/coop-beta` (`src/coopBeta.ts`), which edits the `coop-beta` flag's handles. Without it `/coop-beta` says so.
     */
    posthogPersonalKey: process.env.POSTHOG_PERSONAL_API_KEY || null,
    /** Optional: the #bug-reports forum's channel id, where the bot posts bug reports. Unset, it's found by name. */
    discordBugForumId: process.env.DISCORD_BUG_FORUM_ID || null,
    /** Emails (comma separated, `ADMIN_EMAILS`) whose verified owners run the gift desk (`admin.ts`). Empty: nobody is admin. */
    adminEmails: (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    /**
     * `STREAM_ENFORCE=1`: a ranked run whose replay wasn't streamed in time (`streamedInTime` in
     * `src/game/replayStream.ts`) stays off the public boards. Off (the default), the API only stores and logs the lag.
     */
    streamEnforce: ['1', 'true', 'on'].includes((process.env.STREAM_ENFORCE ?? '').trim().toLowerCase()),
    /**
     * Optional: the secret the co-op relay signs Arena reports and ticket lookups with (`x-arena-signature`, hex
     * HMAC-SHA256 of the body; the relay's own `ARENA_REPORT_SECRET`). Without it `POST /arena/report` and `/arena/tickets` answer 503.
     */
    arenaReportSecret: process.env.ARENA_REPORT_SECRET || undefined,
    /** Whether the game at `origin` may call the API (CORS) and own its tokens (`azp`). */
    allowedOrigin: (origin: string) => origins.includes(origin) || LOCALHOST.test(origin),
  }
}

export type Env = ReturnType<typeof loadEnv>
