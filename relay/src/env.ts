import type { ShardObject } from './shardObject'
import type { Vault } from './vault'

/** The relay's bindings (`wrangler.jsonc`), plus `ADMIN_TOKEN` from `wrangler secret put`. */
export type Env = {
  /** The co-op rooms, many per object (`shards.ts`). */
  SHARDS: DurableObjectNamespace<ShardObject>
  /** The rooms a shard holds at most (`capOf`; default `DEFAULT_ROOMS_PER_SHARD`). */
  ROOMS_PER_SHARD?: string
  VAULT: DurableObjectNamespace<Vault>
  /** Per IP and Cloudflare location: rooms created, and sockets opened. */
  CREATE_LIMIT: RateLimit
  CONNECT_LIMIT: RateLimit
  /** The Clerk instance whose session tokens sign players in (its JWKS is under `/.well-known/jwks.json`). */
  CLERK_ISSUER: string
  /** Comma-separated origins the game is served from; `*` stands for one DNS label (`https://*.vercel.app`). */
  ALLOWED_ORIGINS: string
  /**
   * `on` lets guests (no Clerk token) take seats: the dev relay and local `wrangler dev`, for the soak, the
   * in-tab bots and dev builds. Anything else (production) refuses them with `signIn`.
   */
  ALLOW_GUESTS?: string
  /** Bearer token of the admin endpoints (desync dumps). Unset, they answer 404. */
  ADMIN_TOKEN?: string
}
