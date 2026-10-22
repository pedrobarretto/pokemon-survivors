import { CLOSE_CODES, LIMITS, type CloseReason, type Entry, type ServerMessage, type TickEntries } from '../net/protocol'

/**
 * The client's side of the wire: relay messages read from text (our own
 * relay, so the shapes are checked only as far as the client relies on them),
 * the close codes, and snapshots as base64 chunks.
 */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0

const isEntry = (v: unknown): v is Entry => Array.isArray(v) && v.length >= 2 && whole(v[0]) && typeof v[1] === 'string'

const isTicks = (v: unknown): v is TickEntries[] =>
  Array.isArray(v) && v.every((t) => Array.isArray(t) && t.length === 2 && whole(t[0]) && Array.isArray(t[1]) && t[1].every(isEntry))

const KINDS: ReadonlySet<string> = new Set<ServerMessage['t']>(['welcome', 'refused', 'room', 'start', 'sync', 'snapPart', 'frame', 'heal', 'role', 'ended', 'denied', 'slow', 'pong', 'bye', 'moved'])

/**
 * A relay message from its text, or null. Frames are checked down to their
 * entries (the lockstep reads them); the rest only by kind and the numbers the
 * client steps on.
 */
export const parseServerMessage = (raw: unknown): ServerMessage | null => {
  if (typeof raw !== 'string') return null
  let m: unknown
  try {
    m = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(m) || typeof m.t !== 'string' || !KINDS.has(m.t)) return null
  if (m.t === 'frame' && !(whole(m.from) && whole(m.to) && m.to >= m.from && isTicks(m.ticks))) return null
  if (m.t === 'sync' && !(whole(m.from) && whole(m.to) && isRecord(m.run) && (m.base === null || isRecord(m.base)))) return null
  if (m.t === 'snapPart' && !(whole(m.tick) && whole(m.part) && typeof m.data === 'string')) return null
  // Our relay's own message (`protocol.ts`), checked where the client relies on it above.
  return m as ServerMessage
}

const REASONS = Object.fromEntries(Object.entries(CLOSE_CODES).map(([k, v]) => [v, k])) as Record<number, CloseReason>

/** Why the relay closed a socket, from its close code, or null for any other close (a drop: reconnect). */
export const closeReason = (code: number): CloseReason | null => REASONS[code] ?? null

/** Base64 of bytes, in slices (a spread of 100 KB would blow the stack). */
export const toBase64 = (bytes: Uint8Array) => {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export const fromBase64 = (text: string): Uint8Array<ArrayBuffer> => {
  const s = atob(text)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

/** Base64 text cut into the relay's chunk size (a multiple of 4, so every chunk decodes on its own). */
export const chunks = (text: string, size: number = LIMITS.chunk - (LIMITS.chunk % 4)) => {
  const out: string[] = []
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size))
  return out.length > 0 ? out : ['']
}
