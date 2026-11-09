import type { Dir8 } from '../engine/math'
import { fromStrings, lazy } from '../engine/pixelart'
import type { Dex } from './sprites'

/**
 * The life around the Poké Realm's café on the lobby's platform: two friends
 * chatting at the table, the waiter coming out of the door to them, a customer
 * reading the menu. Each is a loop of keys, played by time alone. `x` is art px
 * from the middle of the café's picture.
 */

export type CafeBubble = 'heart' | 'note'

/** From `t` (seconds into the loop) it heads for `x`, then holds there; `face` is where it looks when still, `gone` is inside the door. */
type Key = { t: number; x: number; face?: Dir8; bubble?: CafeBubble; gone?: boolean }

type Patron = { dex: Dex; loop: number; keys: readonly Key[] }

export const CAFE_PATRONS: readonly Patron[] = [
  // Jigglypuff and Meowth at the table, facing each other, taking turns to talk.
  { dex: 39, loop: 8, keys: [{ t: 0, x: -54, face: 2 }, { t: 1, x: -54, face: 2, bubble: 'note' }, { t: 3, x: -54, face: 2 }, { t: 5.2, x: -54, face: 2, bubble: 'heart' }, { t: 6.6, x: -54, face: 2 }] },
  { dex: 52, loop: 8, keys: [{ t: 0, x: -24, face: 6 }, { t: 3.2, x: -24, face: 6, bubble: 'note' }, { t: 4.8, x: -24, face: 6 }] },
  // Chansey comes out of the door, serves them and goes back in.
  { dex: 113, loop: 13, keys: [{ t: 0, x: -9, face: 0, gone: true }, { t: 2, x: -9, face: 0 }, { t: 2.4, x: 2, face: 6 }, { t: 4.2, x: 2, face: 6, bubble: 'heart' }, { t: 5.6, x: 2, face: 6 }, { t: 7, x: -9, face: 4 }, { t: 7.8, x: -9, face: 4, gone: true }] },
  // Eevee walks up to the menu board, reads it and strolls off.
  { dex: 133, loop: 16, keys: [{ t: 0, x: 66, face: 6 }, { t: 2, x: 66, face: 6 }, { t: 6, x: 24, face: 4 }, { t: 9, x: 24, face: 4, bubble: 'note' }, { t: 10.2, x: 24, face: 4 }, { t: 14, x: 66, face: 6 }] },
]

/** Where a patron is right now: the shell draws from this one record, so a frame allocates nothing. */
export type CafePose = { x: number; anim: 'Idle' | 'Walk'; dir: Dir8; gone: boolean; bubble: CafeBubble | null }

export const newCafePose = (): CafePose => ({ x: 0, anim: 'Idle', dir: 0, gone: false, bubble: null })

/** Fills `out` with `patron` at `time` seconds. Keys are in order: each runs until the next one starts, moving to its own `x` at the end of the walk that follows. */
export const cafePose = (patron: Patron, time: number, out: CafePose) => {
  const t = ((time % patron.loop) + patron.loop) % patron.loop
  const { keys } = patron
  let i = keys.length - 1
  while (i > 0 && keys[i]!.t > t) i--
  const key = keys[i]!
  const next = keys[(i + 1) % keys.length]!
  const nextT = i + 1 < keys.length ? next.t : patron.loop + next.t
  const span = nextT - key.t
  const walking = next.x !== key.x && !next.gone && !key.gone
  const k = walking ? Math.min(1, (t - key.t) / span) : 0
  out.x = key.x + (next.x - key.x) * k
  out.anim = walking ? 'Walk' : 'Idle'
  out.dir = walking ? (next.x > key.x ? 2 : 6) : (key.face ?? 0)
  out.gone = key.gone === true
  out.bubble = key.bubble ?? null
}

const HEART = ['.r.r.', 'rrrrr', 'rrrrr', '.rrr.', '..r..']
const NOTE = ['..kk', '..k.', '..k.', 'kkk.', 'kk..']

/** The little heart and note that pop over a patron talking. */
export const cafeBubbles = lazy(
  (): Record<CafeBubble, HTMLCanvasElement> => ({
    heart: fromStrings(HEART, { r: '#e8506a' }),
    note: fromStrings(NOTE, { k: '#2b2748' }),
  }),
  'lobby',
)
