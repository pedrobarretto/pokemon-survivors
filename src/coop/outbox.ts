import type { BatchedMessage, Entry } from '../net/protocol'
import { inputValues, isReliable, type Input, type ReliableInput } from './entries'

/**
 * What the client still has to send of the player's inputs. The stick is
 * coalesced: only its latest value waits (`stickPace.ts` decides when one is
 * worth sending, slower after the relay said `slow`). Picks and the other screen
 * inputs are reliable: each carries a nonce and is sent again until it comes
 * back stamped in a frame, after a timeout or a reconnect (the relay can lose
 * what it hadn't stamped yet when it restarts). A duplicate is harmless: it
 * quotes the screen's round, which the first one already moved on. Everything
 * is bounded, and a reconnect drops the stale stick. Pure: the caller passes
 * the clock and sends what `due` returns.
 */

export const OUTBOX = {
  /** Reliable inputs waiting at once; past it the oldest goes (a stale screen's pick). */
  reliable: 16,
  /** A reliable input not seen back after max(this, 3 × RTT) ms is sent again. */
  resendMs: 400,
  /** A reliable input is given up after this long (ms): its screen's timer picked for the player long before. */
  giveUpMs: 30_000,
  /** Reliable sends per `due` call, at most. */
  burst: 4,
  /** Ms the stick stays at half rate after a `slow` (`slowed`). */
  slowMs: 10_000,
} as const

type Pending = { nonce: number; input: ReliableInput; queuedAt: number; sentAt: number | null; tries: number }

export type Outbox = {
  /** The stick waiting to go out, or null. */
  move: Extract<Input, { k: 'move' }> | null
  /** Presses (special, Mega, lunge, an Arena cast) waiting: a press lost in a crash window is fine, so they're sent once. */
  presses: Extract<Input, { k: 'special' | 'mega' | 'lunge' | 'cast' }>[]
  reliable: Pending[]
  nonce: number
  slowUntil: number
  /** Totals, for the soak's checks. */
  stats: { moves: number; reliableSent: number; resent: number; acked: number; dropped: number; maxQueued: number }
}

export const createOutbox = (): Outbox => ({
  move: null,
  presses: [],
  reliable: [],
  nonce: 1,
  slowUntil: -Infinity,
  stats: { moves: 0, reliableSent: 0, resent: 0, acked: 0, dropped: 0, maxQueued: 0 },
})

const track = (o: Outbox) => {
  o.stats.maxQueued = Math.max(o.stats.maxQueued, o.reliable.length + o.presses.length + (o.move ? 1 : 0))
}

/** Queues an input: the stick replaces the one waiting, a press waits once, a reliable input gets a nonce. Returns the nonce (0 if none). */
export const push = (o: Outbox, input: Input, now: number): number => {
  if (input.k === 'move') {
    o.move = input
    track(o)
    return 0
  }
  if (!isReliable(input)) {
    // One of each press waits (one cast per skill).
    if (!o.presses.some((p) => p.k === input.k && (p.k !== 'cast' || input.k !== 'cast' || p.skill === input.skill))) o.presses.push(input)
    track(o)
    return 0
  }
  const nonce = o.nonce++
  o.reliable.push({ nonce, input, queuedAt: now, sentAt: null, tries: 0 })
  while (o.reliable.length > OUTBOX.reliable) {
    o.reliable.shift()
    o.stats.dropped++
  }
  track(o)
  return nonce
}

const message = (input: Input, nonce = 0): BatchedMessage => ({ t: 'in', k: input.k, d: inputValues(input, nonce) })

/**
 * What to send now: the presses, the stick, and the
 * reliable inputs never sent or not seen back in time (a few per call). Marks
 * them sent. `rtt` is the last round trip (ms).
 */
export const due = (o: Outbox, now: number, rtt: number): BatchedMessage[] => {
  const out: BatchedMessage[] = []
  for (const p of o.presses) out.push(message(p))
  o.presses = []
  if (o.move) {
    out.push(message(o.move))
    o.move = null
    o.stats.moves++
  }
  o.reliable = o.reliable.filter((p) => {
    if (now - p.queuedAt < OUTBOX.giveUpMs) return true
    o.stats.dropped++
    return false
  })
  const wait = Math.max(OUTBOX.resendMs, 3 * rtt)
  let sent = 0
  for (const p of o.reliable) {
    if (sent >= OUTBOX.burst) break
    if (p.sentAt !== null && now - p.sentAt < wait) continue
    if (p.sentAt !== null) o.stats.resent++
    p.sentAt = now
    p.tries++
    o.stats.reliableSent++
    sent++
    out.push(message(p.input, p.nonce))
  }
  return out
}

/** An entry of a frame: one of this seat's reliable inputs came back stamped, so it's delivered. */
export const ack = (o: Outbox, seat: number, e: Entry) => {
  if (e[0] !== seat || o.reliable.length === 0) return
  const nonce = e[e.length - 1]
  const i = o.reliable.findIndex((p) => p.nonce === nonce && p.input.k === e[1])
  if (i < 0) return
  o.reliable.splice(i, 1)
  o.stats.acked++
}

/** A fresh socket: the stick waiting is stale (the shell sends the current one), presses go, every reliable input goes again. */
export const onReconnect = (o: Outbox) => {
  o.move = null
  o.presses = []
  for (const p of o.reliable) p.sentAt = null
}

/** The relay dropped some inputs for coming too fast: the stick slows down for a while. */
export const onSlow = (o: Outbox, now: number) => {
  o.slowUntil = now + OUTBOX.slowMs
}

/** Whether the stick is slowed down (after a `slow`). */
export const slowed = (o: Outbox, now: number) => now < o.slowUntil

/** Inputs waiting (the soak checks it stays bounded). */
export const queued = (o: Outbox) => o.reliable.length + o.presses.length + (o.move ? 1 : 0)
