import type { Matchmaker } from './matchmakerObject'
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
  /** The Arena's matchmaker (`/arena/queue`), one object. */
  MATCHMAKER: DurableObjectNamespace<Matchmaker>
  /** The API the Arena's match reports and MMR lookups go to (`https://api.pokemonsurvivors.com`). Unset: nothing is posted. */
  ARENA_API_URL?: string
  /** The secret those posts are signed with (`wrangler secret put ARENA_REPORT_SECRET`), the API's own. Unset: nothing is posted. */
  ARENA_REPORT_SECRET?: string
  /** `off` closes the queue (`refused: closed`). */
  ARENA_QUEUE?: string
  /**
   * The site's `/sim-build.json` (`https://www.pokemonsurvivors.com/sim-build.json`): the queue refuses
   * any other build (`refused: build`). Unset (the dev relay, shared by Vercel previews): every build.
   */
  SIM_BUILD_URL?: string
}
