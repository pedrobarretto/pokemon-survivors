import { CLOSE_CODES, type Auth, type ServerMessage } from '../../src/net/protocol'
import { jwksKeys, verifyClerkToken } from './auth'
import type { Env } from './env'
import { allowedOrigin } from './origins'
import type { Identity } from './room'
import { parseTrace, type LogLine, type Where } from './telemetry'

/** What the Worker and the shards (`ShardObject`) share: timeouts, logging, sign-in. */

/** A socket not seated within this long is closed: no valid `hello`, or one whose auth is still being checked. */
export const HELLO_TIMEOUT_MS = 10_000

/** Waits for `where` at most this long before a welcome goes out without it. */
export const WHERE_WAIT_MS = 500

/** Lazy writes (`store.ts`): never held by the output gate. */
export const LAZY = { allowUnconfirmed: true } as const

/** Keys a delete takes at most. */
export const DELETE_MAX = 128

export const log = (line: LogLine) => console.log(JSON.stringify(line))

export const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Where this isolate runs (Cloudflare's trace from inside it), asked once per isolate. */
let where: Promise<Where> | null = null
export const whereOnce = () =>
  (where ??= fetch('https://www.cloudflare.com/cdn-cgi/trace')
    .then((res) => res.text())
    .then(parseTrace)
    .catch(() => ({ colo: null })))

/** One JWKS cache per isolate, shared by the rooms it runs. */
let jwks: ReturnType<typeof jwksKeys> | null = null

/** Who a `hello`'s auth is: a guest as it says, a Clerk session token once verified, else null. */
export const identify = async (env: Env, auth: Auth): Promise<Identity | null> => {
  if (auth.kind === 'guest') return { id: `g:${auth.id}`, account: false }
  jwks ??= jwksKeys(`${env.CLERK_ISSUER}/.well-known/jwks.json`)
  const sub = await verifyClerkToken(auth.token, {
    keys: jwks,
    issuer: env.CLERK_ISSUER,
    allowedParty: (origin) => allowedOrigin(env, origin),
    now: Date.now(),
  })
  return sub ? { id: `u:${sub}`, account: true } : null
}

/**
 * The answer to a socket for a room that isn't here (expired, or never made):
 * `refused` (`unavailable`) and the final close, as a room's own refusal goes.
 * No Durable Object holds it: the socket is the Worker's or the shard's own.
 */
export const noSuchRoom = (): Response => {
  const [client, server] = Object.values(new WebSocketPair()) as [WebSocket, WebSocket]
  server.accept()
  server.send(JSON.stringify({ t: 'refused', code: 'unavailable' } satisfies ServerMessage))
  server.close(CLOSE_CODES.refused, 'refused')
  return new Response(null, { status: 101, webSocket: client })
}
