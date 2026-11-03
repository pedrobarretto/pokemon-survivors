import { createHmac, timingSafeEqual } from 'node:crypto'
import { isRecord } from '../../src/game/parse'

/**
 * Linking a Patreon account to a game account (Patreon isn't a Clerk
 * provider, so the API does the OAuth itself). `GET /patreon/link` hands the
 * game Patreon's authorize URL with a `state` that names the player and the
 * page to come back to, signed and short-lived; Patreon sends the player to
 * `GET /patreon/callback`, which trades the code for a token once, asks who
 * they are and keeps only their Patreon user id. Pledges and charges come in
 * by webhook (`patreonMember`, `patreonCharge` in `webhooks.ts`), never
 * through the player's token.
 */

export type PatreonConfig = { clientId: string; clientSecret: string; redirectUri: string }

/** Who links and where they go back to (an allowed origin plus a path, checked before signing). */
export type LinkState = { userId: string; back: string }

/** How long a link may take on Patreon's side. */
const STATE_TTL = 15 * 60

/** Only who the patron is: charges come from the campaign's webhook. */
const SCOPE = 'identity'

const sign = (secret: string, payload: string) => createHmac('sha256', secret).update(`patreon-state.${payload}`).digest('base64url')

/** A `state` for `s`, good for `STATE_TTL` from `now` (seconds). */
export const signState = (secret: string, s: LinkState, now: number) => {
  const payload = Buffer.from(JSON.stringify({ u: s.userId, b: s.back, e: Math.floor(now) + STATE_TTL })).toString('base64url')
  return `${payload}.${sign(secret, payload)}`
}

/** The link a `state` stands for, or null when it isn't ours or ran out. */
export const readState = (secret: string, state: string | undefined, now: number): LinkState | null => {
  const [payload, mac, ...rest] = state?.split('.') ?? []
  if (!payload || !mac || rest.length > 0) return null
  const expected = Buffer.from(sign(secret, payload))
  const given = Buffer.from(mac)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  const v: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (!isRecord(v) || typeof v.u !== 'string' || typeof v.b !== 'string' || typeof v.e !== 'number' || v.e < now) return null
  return { userId: v.u, back: v.b }
}

/** Where the game sends the player to approve the link. */
export const authorizeUrl = (cfg: PatreonConfig, state: string) =>
  `https://www.patreon.com/oauth2/authorize?${new URLSearchParams({ response_type: 'code', client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: SCOPE, state })}`

/** Patreon's OAuth: the authorize URL for a player, and who an authorization code belongs to. */
export const patreonOAuth = (cfg: PatreonConfig) => ({
  /** The authorize URL for `userId`, coming back to `back`. */
  linkUrl: (userId: string, back: string, now: number) => authorizeUrl(cfg, signState(cfg.clientSecret, { userId, back }, now)),

  /** The link a callback's `state` carries, or null. */
  readState: (state: string | undefined, now: number) => readState(cfg.clientSecret, state, now),

  /** The Patreon user id an authorization code belongs to (the token is used once and dropped). Throws when Patreon fails. */
  patronOf: async (code: string): Promise<string> => {
    const res = await fetch('https://www.patreon.com/api/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ code, grant_type: 'authorization_code', client_id: cfg.clientId, client_secret: cfg.clientSecret, redirect_uri: cfg.redirectUri }),
    })
    const token: unknown = await res.json().catch(() => null)
    if (!res.ok || !isRecord(token) || typeof token.access_token !== 'string') throw new Error(`patreon token: ${res.status}`)
    const me = await fetch('https://www.patreon.com/api/oauth2/v2/identity', { headers: { Authorization: `Bearer ${token.access_token}` } })
    const body: unknown = await me.json().catch(() => null)
    if (!me.ok || !isRecord(body) || !isRecord(body.data) || typeof body.data.id !== 'string') throw new Error(`patreon identity: ${me.status}`)
    return body.data.id
  },
})

export type PatreonOAuth = ReturnType<typeof patreonOAuth>
