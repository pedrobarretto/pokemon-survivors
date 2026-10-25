/// <reference types="vite/client" />

/** Build-time settings (`.env`, Vercel). The first two are needed for accounts; without them the game is guest only. */
interface ImportMetaEnv {
  /** Clerk's publishable key (`pk_…`). */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
  /** Base URL of the accounts API (`server/`), e.g. `https://api.pokemonsurvivors.com`. */
  readonly VITE_API_URL?: string
  /** PostHog's project key (`phc_…`, public): analytics and error reports (`src/analytics.ts`). Without it, neither. */
  readonly VITE_POSTHOG_KEY?: string
  /** The co-op relay (`relay/`), e.g. `https://ps-coop.pedrobarretto.workers.dev`. Dev builds default to the dev relay. */
  readonly VITE_COOP_URL?: string
  /**
   * The São Paulo co-op relay (`relay/node` on the VPS, `https://coop-sa.pokemonsurvivors.com`), for South American
   * hosts' rooms (`coop/relays.ts`). Unset: every room is Cloudflare's, as before.
   */
  readonly VITE_COOP_URL_SA?: string
}

/** The build that's playing (the commit, or `dev`): ranked runs report it. Set in `vite.config.ts`. */
declare const __GAME_VERSION__: string

/** The co-op build id: a hash of the simulation's source (`src/coop/simBuild.ts`). Rooms only take clients of the same. Set in `vite.config.ts`. */
declare const __SIM_BUILD__: string
