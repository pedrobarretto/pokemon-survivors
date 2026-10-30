import type { ArenaReport } from '../../src/net/arena'
import type { LooksRequest } from '../../src/net/looks'
import { parseWireLook, type WireLook } from '../../src/net/protocol'

/**
 * What the relay posts to the API about the Arena (`net/arena.ts`): signed
 * with a secret both share (header `x-arena-signature`: hex HMAC-SHA256 of
 * the raw body), and for a match's report, kept in an outbox and retried with
 * backoff until the API takes it. WebCrypto only, so the Worker, the VPS
 * relay and the tests run the same code; each shell keeps its outbox (the
 * shard's storage and alarm, the VPS relay's vault and a timer).
 */

export const SIGNATURE_HEADER = 'x-arena-signature'

/** Where reports go and how they are signed; a shell without both posts nothing (it logs and drops the report). */
export type ArenaApi = { url: string; secret: string }

/** The API's settings from the shell's variables, or null when either is missing. */
export const arenaApiOf = (url: string | undefined, secret: string | undefined): ArenaApi | null => (url && secret ? { url: url.replace(/\/+$/, ''), secret } : null)

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('')

/** The hex HMAC-SHA256 of `body` with `secret`. */
export const sign = async (secret: string, body: string): Promise<string> => {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(body)))
}

/** A request to the API gives up after this long (the outbox tries again). */
const TIMEOUT_MS = 10_000

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

/** POSTs `body` (JSON text) to `path` on the API, signed. Throws on a network failure or timeout (`timeout` ms). */
export const postSigned = async (api: ArenaApi, path: string, body: string, fetcher: Fetcher = fetch, timeout = TIMEOUT_MS): Promise<Response> =>
  fetcher(`${api.url}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [SIGNATURE_HEADER]: await sign(api.secret, body) },
    body,
    signal: AbortSignal.timeout(timeout),
  })

/** A room's run waits this long at most for its looks before starting without them. */
export const LOOKS_TIMEOUT_MS = 3000

/**
 * The looks the API vouches for (`POST /looks`, signed), by
 * identity (`u:<clerk id>`): what each account stored and owns. Anything
 * else (no API set, an API from before it, a failure, a slow answer, a
 * malformed look) leaves those seats bare: a client's own claim never stands.
 */
export const lookUpLooks = async (api: ArenaApi | null, ids: readonly string[], fetcher: Fetcher = fetch): Promise<Record<string, WireLook>> => {
  const userIds = ids.flatMap((id) => (id.startsWith('u:') ? [id.slice(2)] : []))
  if (!api || userIds.length === 0) return {}
  try {
    const res = await postSigned(api, '/looks', JSON.stringify({ userIds } satisfies LooksRequest), fetcher, LOOKS_TIMEOUT_MS)
    const body: unknown = res.ok ? await res.json() : null
    const looks = isRecord(body) && isRecord(body.looks) ? body.looks : {}
    return Object.fromEntries(
      userIds.flatMap((id) => {
        const look = parseWireLook(looks[id])
        return look ? [[`u:${id}`, look] as const] : []
      }),
    )
  } catch {
    return {}
  }
}

/** A report waiting in a shell's outbox: its body as posted, the attempts made and when the next is due (ms). */
export type Outgoing = { id: string; body: string; attempts: number; at: number }

/** Waits between attempts: the first goes at once, the last about 2 hours after the match. Past them the report is dropped (logged). */
export const RETRY_MS = [0, 5_000, 30_000, 120_000, 600_000, 1_800_000, 3_600_000] as const

/** A new report for the outbox, due now. Its id is the API's to deduplicate a retried post that had landed after all. */
export const outgoing = (report: ArenaReport, now: number): Outgoing => ({ id: `${report.room}-${report.run}-${report.endedAt}`, body: JSON.stringify(report), attempts: 0, at: now })

export type Outcome = 'done' | 'retry' | 'drop'

/**
 * What an answer means: taken (2xx, or 409, already taken), worth another try
 * (5xx, 408, 429, or no answer at all: `null`), or never going to be (any
 * other 4xx: a bad signature or body, which retrying won't fix).
 */
export const outcomeOf = (status: number | null): Outcome => {
  if (status === null || status >= 500 || status === 408 || status === 429) return 'retry'
  if ((status >= 200 && status < 300) || status === 409) return 'done'
  return 'drop'
}

/** The report after an attempt that ended in `outcome`: due again later, or null when it's done with (taken, refused or out of tries). */
export const afterAttempt = (o: Outgoing, outcome: Outcome, now: number): Outgoing | null => {
  if (outcome !== 'retry') return null
  const wait = RETRY_MS[o.attempts + 1]
  return wait === undefined ? null : { ...o, attempts: o.attempts + 1, at: now + wait }
}

/** One attempt at posting a report: what came of it and the status (null: no answer). */
export const deliver = async (api: ArenaApi, o: Outgoing, fetcher: Fetcher = fetch): Promise<{ outcome: Outcome; status: number | null }> => {
  const status = await postSigned(api, '/arena/report', o.body, fetcher).then(
    (res) => res.status,
    () => null,
  )
  return { outcome: outcomeOf(status), status }
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** An outbox entry kept as JSON (a shell's storage), or null. */
export const parseOutgoing = (v: unknown): Outgoing | null =>
  isRecord(v) && typeof v.id === 'string' && typeof v.body === 'string' && typeof v.attempts === 'number' && typeof v.at === 'number' ? { id: v.id, body: v.body, attempts: v.attempts, at: v.at } : null

export type OutboxDeps = {
  /** Null: the shell has no API configured (reports are logged and dropped). */
  api: ArenaApi | null
  /** Keep an entry (new, or due again later) / forget one, in the shell's storage. */
  save: (o: Outgoing) => void
  remove: (id: string) => void
  log: (ev: string, data: Record<string, string | number | boolean | null>) => void
  now: () => number
  /** The earliest due time may have moved (`next`): the shell re-arms its alarm or timer. */
  changed: () => void
  fetcher?: Fetcher
}

/**
 * A shell's outbox of match reports: `add` posts one at once, a failed post
 * is kept and tried again at its due time (`flush`, from the shell's alarm or
 * timer, which `next` sets), `kept` are the entries the shell found in its
 * storage after a restart. Each report goes out at most once at a time.
 */
export const createOutbox = (deps: OutboxDeps, kept: readonly Outgoing[] = []) => {
  const items = new Map(kept.map((o) => [o.id, o]))
  const sending = new Set<string>()

  const attempt = async (o: Outgoing) => {
    sending.add(o.id)
    const api = deps.api
    const { outcome, status } = api ? await deliver(api, o, deps.fetcher) : { outcome: 'drop' as const, status: null }
    sending.delete(o.id)
    const next = afterAttempt(o, outcome, deps.now())
    if (next) {
      items.set(o.id, next)
      deps.save(next)
    } else {
      items.delete(o.id)
      deps.remove(o.id)
    }
    const why = !api ? 'noApi' : outcome === 'done' ? null : next ? 'retry' : 'dropped'
    deps.log(why === null ? 'arena.report.sent' : `arena.report.${why}`, { id: o.id, attempts: o.attempts + 1, status })
    deps.changed()
  }

  return {
    /** Posts a match's report now, keeping it until the API takes it. */
    add: (report: ArenaReport): Promise<void> => {
      const o = outgoing(report, deps.now())
      items.set(o.id, o)
      deps.save(o)
      return attempt(o)
    },
    /** Tries every report due by now. */
    flush: (): Promise<void> => {
      const now = deps.now()
      return Promise.all([...items.values()].filter((o) => o.at <= now && !sending.has(o.id)).map(attempt)).then(() => undefined)
    },
    /** When the next report falls due (null: none waits). */
    next: (): number | null => {
      let min: number | null = null
      for (const o of items.values()) if (!sending.has(o.id) && (min === null || o.at < min)) min = o.at
      return min
    },
    size: () => items.size,
  }
}

export type Outbox = ReturnType<typeof createOutbox>
