import type { SocketHandlers, SocketLike } from '../coop/client'
import { isRecord } from '../game/parse'
import type { QueueKind } from '../data/arenaRanked'
import type { ArenaFormat } from '../data/arenaFormats'
import type { QueueAuth, QueueClientMessage, QueueServerMessage } from '../net/arena'

/**
 * The Arena's public queue from the client's side: one WebSocket to the
 * matchmaker (`/arena/queue` on the co-op relay's origin, `net/arena.ts`)
 * per ticket. It sends `queue` once open, the round trips to the relay homes
 * when they're measured (`rtt`) and `cancel` when the player backs out, and
 * passes on what the matchmaker says (`queued`, `matched`, `refused`), plus
 * `lost` when the socket drops before a match. DOM-free: the shell passes
 * the socket and who's queuing (`auth`: the Clerk token, or the guest id the
 * dev relay seats).
 */

/** What the queue tells the screen: the matchmaker's messages, or the socket gone before a match. */
export type QueueEvent = QueueServerMessage | { t: 'lost' }

export type QueueDeps = {
  /** The co-op relay's base URL (`https://…`). */
  relay: string
  /** The simulation's build id (`__SIM_BUILD__`): the matchmaker refuses an old one. */
  build: string
  /** Who queues: a fresh Clerk session token, or this device's guest id (only the dev relay takes guests). Sent in `queue`, never in the URL. */
  auth: () => Promise<QueueAuth>
  socket: (url: string, on: SocketHandlers) => SocketLike
  /** Round trips (ms) to each relay home this build has; sent when it resolves. */
  rtts?: () => Promise<Record<string, number>>
}

/** A ticket: its queue, the format it plays and its Pokémon. */
export type Ticket = { kind: QueueKind; format: ArenaFormat; starter: string; party: string | null }

/** The matchmaker's WebSocket URL from the relay's: same origin, `ws(s)`, path `/arena/queue`. */
export const queueUrl = (relay: string) => `${relay.replace(/^http/, 'ws').replace(/\/+$/, '')}/arena/queue`

const REFUSALS = ['auth', 'duplicate', 'build', 'closed'] as const
const QUEUES = ['casual', 'ranked'] as const
const whole = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? Math.max(0, Math.round(x)) : null)

/** A matchmaker message from the wire (a JSON string); null when it isn't one. */
export const parseQueueMessage = (data: unknown): QueueServerMessage | null => {
  let m: unknown
  try {
    m = typeof data === 'string' ? JSON.parse(data) : null
  } catch {
    return null
  }
  if (!isRecord(m)) return null
  if (m.t === 'queued') {
    const waited = whole(m.waited)
    const found = whole(m.found)
    const botsIn = whole(m.botsIn)
    const kind = QUEUES.find((k) => k === m.kind)
    const hold = whole(m.hold) ?? 0
    return kind && waited !== null && found !== null && botsIn !== null ? { t: 'queued', kind, waited, found, botsIn, ...(hold > 0 && { hold }) } : null
  }
  if (m.t === 'matched') {
    const humans = whole(m.humans)
    return typeof m.room === 'string' && (m.team === 0 || m.team === 1) && typeof m.ranked === 'boolean' && humans !== null ? { t: 'matched', room: m.room, team: m.team, ranked: m.ranked, humans } : null
  }
  if (m.t === 'refused') {
    if (m.why === 'fairPlay') {
      const fairPlay = whole(m.fairPlay)
      return fairPlay === null ? null : { t: 'refused', why: 'fairPlay', fairPlay }
    }
    const why = REFUSALS.find((w) => w === m.why)
    return why ? { t: 'refused', why } : null
  }
  return null
}

/** Joins the queue with `ticket`; `on` hears every event. `cancel` leaves it (nothing more is heard after). */
export const joinQueue = (deps: QueueDeps, ticket: Ticket, on: (e: QueueEvent) => void) => {
  let ws: SocketLike | null = null
  let over = false
  const send = (m: QueueClientMessage) => ws?.isOpen() && ws.send(JSON.stringify(m))
  const end = () => {
    over = true
    ws?.close()
    ws = null
  }
  void (async () => {
    const auth = await deps.auth()
    if (over) return
    ws = deps.socket(queueUrl(deps.relay), {
      open: () => {
        // The standard 4v4 goes without a format, as every ticket before formats did.
        send({ t: 'queue', kind: ticket.kind, ...(ticket.format !== 'standard' && { format: ticket.format }), starter: ticket.starter, party: ticket.party, build: deps.build, auth })
        void deps.rtts?.().then((homes) => !over && Object.keys(homes).length > 0 && send({ t: 'rtt', homes }))
      },
      message: (data) => {
        if (over) return
        const m = parseQueueMessage(data)
        if (!m) return
        // A match or a refusal ends the ticket: the socket's job is done.
        if (m.t !== 'queued') end()
        on(m)
      },
      close: () => {
        if (over) return
        end()
        on({ t: 'lost' })
      },
    })
  })()
  return {
    cancel: () => {
      if (over) return
      send({ t: 'cancel' })
      end()
    },
  }
}

export type QueueHandle = ReturnType<typeof joinQueue>
