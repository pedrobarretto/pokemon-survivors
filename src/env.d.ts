/// <reference types="vite/client" />

/** Build-time settings (`.env`, Vercel). Both are needed for accounts; without them the game is guest only. */
interface ImportMetaEnv {
  /** Clerk's publishable key (`pk_…`). */
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string
  /** Base URL of the accounts API (`server/`), e.g. `https://api.pokemonsurvivors.com`. */
  readonly VITE_API_URL?: string
  /** The co-op play server's WebSocket URL; defaults to the API's host at `/ws`. */
  readonly VITE_PLAY_URL?: string
}

/** The build that's playing (the commit, or `dev`): ranked runs report it. Set in `vite.config.ts`. */
declare const __GAME_VERSION__: string
