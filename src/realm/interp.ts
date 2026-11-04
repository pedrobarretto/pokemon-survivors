import { REALM, type Facing } from '../net/realm'
import type { Shape } from '../data/realmMap'
import { dir8 } from '../engine/math'

/**
 * The Poké Realm's motion on the client: other trainers drawn
 * `REALM.interpDelayMs` behind the newest position the relay sent
 * (interpolated between two samples, so a 6 Hz batch walks smoothly), and
 * the player's own trainer predicted at once (walked here, reported at
 * `REALM.moveHz`, put back where the relay says on a `snap`). Pure: the
 * caller passes the clock (ms).
 */

/** One position the relay sent for a trainer, stamped with when it arrived (ms). */
export type Sample = { at: number; x: number; y: number; facing: Facing; moving: boolean }

/** A trainer's recent samples, oldest first. */
export type Track = Sample[]

/** Samples kept per trainer: a couple of seconds at `moveHz`, far more than the delay needs. */
const KEEP = 16

/** Adds a sample (arrival order; one older than the newest is dropped). */
export const pushSample = (track: Track, s: Sample) => {
  const last = track[track.length - 1]
  if (last && s.at < last.at) return
  track.push(s)
  if (track.length > KEEP) track.splice(0, track.length - KEEP)
}

/** Where a trainer is drawn at `now`: between the two samples around `now - REALM.interpDelayMs`, the oldest before it and the newest past it (no guessing ahead). */
export const sampleAt = (track: Track, now: number): Omit<Sample, 'at'> | null => {
  const first = track[0]
  if (!first) return null
  const at = now - REALM.interpDelayMs
  if (at <= first.at) return { x: first.x, y: first.y, facing: first.facing, moving: track.length > 1 && first.moving }
  let a = first
  for (const b of track) {
    if (at > b.at) {
      a = b
      continue
    }
    const k = b.at > a.at ? (at - a.at) / (b.at - a.at) : 1
    return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, facing: b.facing, moving: a.moving || b.moving }
  }
  return { x: a.x, y: a.y, facing: a.facing, moving: false }
}

/* ---------------- The player's own trainer ---------------- */

/** The trainer this client walks: where it stands now, where it last told the relay, and when. */
export type Walker = {
  x: number
  y: number
  facing: Facing
  moving: boolean
  /** Where a tap sent it (world px), until it gets there or a key or the stick takes over. */
  target: { x: number; y: number } | null
  /** What the relay last heard (null: nothing since the room changed) and when (ms). */
  sent: { x: number; y: number; moving: boolean } | null
  sentAt: number
}

export const createWalker = (x: number, y: number): Walker => ({ x, y, facing: 0, moving: false, target: null, sent: null, sentAt: -Infinity })

/** A room's walkable area for the walker: its size and what blocks it. */
export type Ground = { w: number; h: number; solid: readonly Shape[] }

/** The trainer's feet keep this far (world px) from the room's edges and from what's solid. */
const FEET = 4
/** A tap's target is reached this close (world px). */
const ARRIVE = 0.5

const sq = (v: number) => v * v

/** Whether `x`, `y` is inside a solid shape (grown by the feet's radius). */
export const blocked = (ground: Ground, x: number, y: number) =>
  ground.solid.some((s) =>
    s.kind === 'rect'
      ? x > s.x - FEET && x < s.x + s.w + FEET && y > s.y - FEET && y < s.y + s.h + FEET
      : sq((x - s.x) / (s.rx + FEET)) + sq((y - s.y) / (s.ry + FEET)) < 1,
  )

const inside = (ground: Ground, x: number, y: number) => x >= FEET && y >= FEET && x <= ground.w - FEET && y <= ground.h - FEET

/**
 * Walks the trainer for `dt` seconds: `move` (keys or stick, length ≤ 1)
 * wins over a tap's target. A step into something solid slides along it (each
 * axis on its own) and the room's edges hold it in. At `REALM.speed`, so the
 * relay's speed check never refuses an honest walk.
 */
export const walk = (w: Walker, move: { x: number; y: number }, dt: number, ground: Ground) => {
  let mx = move.x
  let my = move.y
  if (mx !== 0 || my !== 0) w.target = null
  else if (w.target) {
    const dx = w.target.x - w.x
    const dy = w.target.y - w.y
    const d = Math.hypot(dx, dy)
    if (d <= ARRIVE) w.target = null
    else {
      const k = Math.min(1, d / (REALM.speed * dt))
      mx = (dx / d) * k
      my = (dy / d) * k
    }
  }
  const len = Math.hypot(mx, my)
  if (len < 0.05) {
    w.moving = false
    return
  }
  if (len > 1) {
    mx /= len
    my /= len
  }
  const step = REALM.speed * dt
  const nx = w.x + mx * step
  const ny = w.y + my * step
  const free = (x: number, y: number) => inside(ground, x, y) && !blocked(ground, x, y)
  const was = { x: w.x, y: w.y }
  if (free(nx, ny)) Object.assign(w, { x: nx, y: ny })
  else if (free(nx, w.y)) w.x = nx
  else if (free(w.x, ny)) w.y = ny
  else {
    // Stuck against the edge: clamp into the room (a door's spawn on the line).
    w.x = Math.min(Math.max(nx, FEET), ground.w - FEET)
    w.y = Math.min(Math.max(ny, FEET), ground.h - FEET)
    if (blocked(ground, w.x, w.y)) Object.assign(w, was)
  }
  w.moving = w.x !== was.x || w.y !== was.y
  if (w.moving) w.facing = dir8(mx, my)
  else w.target = null
}

/**
 * The `move` report due at `now`, or null: at most `REALM.moveHz` while the
 * trainer walks, and once more when it stops. Marks it sent.
 */
export const report = (w: Walker, now: number): { x: number; y: number; facing: Facing; moving: boolean } | null => {
  const x = Math.round(w.x)
  const y = Math.round(w.y)
  const s = w.sent
  if (w.moving) {
    if (now - w.sentAt < 1000 / REALM.moveHz) return null
    if (s && s.x === x && s.y === y && s.moving) return null
  } else if (!s || !s.moving) return null
  w.sent = { x, y, moving: w.moving }
  w.sentAt = now
  return { x, y, facing: w.facing, moving: w.moving }
}

/** The relay refused a step: the trainer stands where it says, the tap's walk is off, and that's what the relay knows now. */
export const snap = (w: Walker, x: number, y: number, now: number) => {
  Object.assign(w, { x, y, target: null, moving: false, sent: { x, y, moving: false }, sentAt: now })
}

/** Into a new room at `x`, `y` (a door's spawn, a base's door): nothing reported there yet. */
export const place = (w: Walker, x: number, y: number) => {
  Object.assign(w, { x, y, target: null, moving: false, sent: null, sentAt: -Infinity })
}
