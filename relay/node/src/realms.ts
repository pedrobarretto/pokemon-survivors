import { randomUUID } from 'node:crypto'
import type { RawData, WebSocket } from 'ws'
import { REALM, type CityId, type RealmHome, type RealmServerMessage } from '../../../src/net/realm'
import type { IdentityResponse, PresenceReport, VisitRequest, VisitResponse } from '../../../src/net/realmRelay'
import {
  REALM_CLOSE,
  connect,
  createRealm,
  disconnect,
  hello,
  identified,
  message,
  parseRealmMessage,
  realmCounts,
  tick,
  visited,
  type ConnId,
  type RealmEffect,
} from '../../src/realm'
import type { Log } from './rooms'

/**
 * The Poké Realm on a VPS relay: one realm machine (`relay/src/realm.ts`)
 * for every city this relay is home to, its sockets and its beat (`tick`
 * at `REALM.moveHz`). Nothing is stored: a restart closes the sockets as a
 * restart, and the clients say hello again.
 *
 * A socket's first message must be a `hello`; its token is checked here
 * (`verify`, Clerk) before the machine sees it, and the machine's asks
 * (identities, base visits, presence) go to the API through `deps`.
 */

/** A socket not seated within this long is closed (no valid `hello`, or its checks still out). */
const HELLO_TIMEOUT_MS = 10_000

/** The standard "service restart" close (`rooms.ts`): clients reconnect at once. */
const RESTART_CLOSE = 1012

export type RealmsDeps = {
  home: RealmHome
  log: Log
  now: () => number
  /** The account a hello's token is (a Clerk user id, or a dev guest's), or null. */
  verify: (token: string) => Promise<string | null>
  /** The API's identities for these accounts (null: it failed). Never throws. */
  identities: (userIds: string[]) => Promise<IdentityResponse | null>
  /** Whether a visitor may enter a base (null: the API failed). Never throws. */
  visit: (req: VisitRequest) => Promise<VisitResponse | null>
  /** Posts who walks each city; fire and forget. */
  presence: (report: PresenceReport) => void
}

const textOf = (data: RawData) => (Array.isArray(data) ? Buffer.concat(data) : Buffer.isBuffer(data) ? data : Buffer.from(new Uint8Array(data))).toString('utf8')

export const createRealms = (deps: RealmsDeps) => {
  const { log, now } = deps
  const state = createRealm(deps.home, now())
  const sockets = new Map<ConnId, WebSocket>()
  /** Sockets whose hello's token is being checked: anything else they send meanwhile is dropped. */
  const verifying = new Set<ConnId>()
  let closing = false

  const apply = (effects: readonly RealmEffect[]) => {
    const texts = new Map<RealmServerMessage, string>()
    for (const e of effects) {
      if (e.k === 'send') {
        const ws = sockets.get(e.to)
        if (!ws || ws.readyState !== ws.OPEN) continue
        const text = texts.get(e.msg) ?? JSON.stringify(e.msg)
        texts.set(e.msg, text)
        ws.send(text)
      } else if (e.k === 'close') sockets.get(e.to)?.close(REALM_CLOSE[e.why], e.why)
      else if (e.k === 'identify') void deps.identities(e.userIds).then((res) => step(() => identified(state, e.ask, res, now())))
      else if (e.k === 'visit') void deps.visit(e.req).then((res) => step(() => visited(state, e.ask, res)))
      else if (e.k === 'presence') deps.presence(e.report)
      else log(e.ev, e.data)
    }
  }

  /** Runs one of the machine's steps; one that throws (a bug) is logged, and the realm goes on. */
  const step = (fn: () => readonly RealmEffect[]) => {
    try {
      apply(fn())
    } catch (err) {
      log('realm.error', { error: err instanceof Error ? (err.stack ?? err.message) : String(err) })
    }
  }

  const beat = setInterval(() => step(() => tick(state, now())), 1000 / REALM.moveHz)
  beat.unref()

  /** A socket upgraded on `/realm/<city>/ws` (a city this relay is home to). */
  const accept = (city: CityId, ws: WebSocket) => {
    if (closing) return ws.close(RESTART_CLOSE, 'restart')
    const id: ConnId = randomUUID()
    sockets.set(id, ws)
    connect(state, id, city, now())
    const timeout = setTimeout(() => {
      if (state.conns.get(id)?.avatar === null) ws.close(REALM_CLOSE.idle, 'hello')
    }, HELLO_TIMEOUT_MS)
    timeout.unref()
    ws.on('message', (data) => {
      const msg = parseRealmMessage(textOf(data))
      const conn = state.conns.get(id)
      if (!conn || verifying.has(id)) return
      if (conn.avatar === null) {
        if (msg?.t !== 'hello' || conn.waiting) return
        verifying.add(id)
        void deps.verify(msg.token).then(
          (userId) => {
            verifying.delete(id)
            if (sockets.has(id)) step(() => hello(state, id, msg, userId, now()))
          },
          () => verifying.delete(id),
        )
        return
      }
      step(() => message(state, id, msg, now()))
    })
    ws.on('close', () => {
      clearTimeout(timeout)
      sockets.delete(id)
      verifying.delete(id)
      step(() => disconnect(state, id))
    })
    ws.on('error', () => ws.terminate())
  }

  /** The graceful stop: every socket closed as a restart. */
  const shutdown = () => {
    closing = true
    clearInterval(beat)
    for (const ws of sockets.values()) ws.close(RESTART_CLOSE, 'restart')
  }

  return { accept, counts: () => realmCounts(state), shutdown }
}

export type Realms = ReturnType<typeof createRealms>
