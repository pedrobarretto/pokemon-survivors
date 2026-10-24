import { VPS_HOMES, type VpsHome } from '../../../src/net/protocol'
import { DEFAULT_MAX_ROOMS } from './capacity'

/** A VPS relay's settings, from its environment (the Dokploy app's env vars; defaults in the Dockerfile). */
export type Config = {
  /** Which relay this is (`RELAY_HOMES`): the codes it makes start with its characters. */
  home: VpsHome
  port: number
  host: string
  /** Where the rooms' and the dumps' SQLite files live (the persistent volume). */
  dataDir: string
  /** The Clerk instance whose session tokens sign players in. */
  clerkIssuer: string
  /** Comma-separated origins the game is served from; `*` stands for one DNS label. */
  allowedOrigins: string
  /** Seat guests (no Clerk token): a dev relay and local runs only. */
  allowGuests: boolean
  /** Bearer token of `/admin/dumps`; null answers 404 there. */
  adminToken: string | null
  /** The header the reverse proxy (Traefik) puts the player's address in (`x-real-ip`); null: the socket's own. */
  ipHeader: string | null
  /** The build, shown by `/health` (a deploy is done when it changes). */
  version: string
  /** Rooms held (`counts().live`) past which new rooms go to Cloudflare (`capacity.ts`); 0 takes none (a drain). */
  maxRooms: number
}

const maxRoomsOf = (v: string | undefined) => {
  const n = Number(v)
  return v !== undefined && v !== '' && Number.isInteger(n) && n >= 0 ? n : DEFAULT_MAX_ROOMS
}

export const configFrom = (env: Record<string, string | undefined>): Config => ({
  home: VPS_HOMES.find((h) => h === env.RELAY_HOME) ?? 'sa',
  port: Number(env.PORT ?? 8080),
  host: env.HOST ?? '0.0.0.0',
  dataDir: env.DATA_DIR ?? '/data',
  clerkIssuer: env.CLERK_ISSUER ?? 'https://clerk.pokemonsurvivors.com',
  allowedOrigins: env.ALLOWED_ORIGINS ?? 'https://www.pokemonsurvivors.com,https://pokemonsurvivors.com',
  allowGuests: env.ALLOW_GUESTS === 'on',
  adminToken: env.ADMIN_TOKEN || null,
  ipHeader: env.IP_HEADER?.toLowerCase() || null,
  version: env.RELAY_VERSION ?? 'dev',
  maxRooms: maxRoomsOf(env.MAX_ROOMS),
})
