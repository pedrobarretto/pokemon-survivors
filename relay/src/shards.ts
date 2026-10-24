import { RELAY_HOMES, ROOM_CODE_ALPHABET, ROOM_CODE_LENGTH, type Region } from '../../src/net/protocol'
import type { Room } from './room'

/**
 * Shards: the Cloudflare relay packs many rooms into one Durable Object
 * (`ShardObject`), because Cloudflare bills an object's wall-clock time at
 * 128 MB whatever it uses, and a room never sleeps (the relay owns its 60 Hz
 * clock). A shard is named by its region (the location hint it was created
 * with, `auto` without one) and an index, and a room's code says its shard, so
 * a socket is routed without asking anyone. All pure: the Worker and the shard
 * do the I/O.
 *
 * A shard's code, 5 characters of `ROOM_CODE_ALPHABET` (`a`..`e`: their
 * positions; the first one's in `RELAY_HOMES.cf`, so the game keeps sending it
 * to Cloudflare):
 * - `a`: a letter, `a % 8` the region (`SHARD_REGIONS`; three letters each,
 *   two for `oc`).
 * - `b`: the shard's index (`SHARD_INDEXES` of them per region).
 * - `c`, `d`: random.
 * - `e`: a check character over the other four (`check`). It is the marker:
 *   codes made before shards (one room per object) are uniformly random, so
 *   only 1 in 31 of them passes it, and the Worker sends that one to its old
 *   object when the shard says it has no such room (`NO_ROOM`).
 * That leaves 2 883 codes per shard (2 for `oc`: 1 922), plenty for its cap.
 */

/** The regions in code order. Never reorder or insert: live codes name their shard by position. */
export const SHARD_REGIONS = ['auto', 'sam', 'enam', 'wnam', 'weur', 'eeur', 'apac', 'oc'] as const satisfies readonly Region[]

/** Shards per region: the index is one character. */
export const SHARD_INDEXES = ROOM_CODE_ALPHABET.length

export type ShardRegion = (typeof SHARD_REGIONS)[number]

export type Shard = { region: ShardRegion; index: number }

const LETTERS: string = RELAY_HOMES.cf
const N = ROOM_CODE_ALPHABET.length

/** The Durable Object's name of a shard. */
export const shardName = (s: Shard) => `${s.region}:${s.index}`

/** The check character's position: a weighted sum mod 31 (a prime), so changing any one character changes it. */
const check = (a: number, b: number, c: number, d: number) => (3 + a + 7 * b + 11 * c + 17 * d) % N

const at = (i: number) => ROOM_CODE_ALPHABET.charAt(i)

/** Uniform integers below `n`, from random bytes (rejection sampling). */
const picker = (random: (n: number) => Uint8Array) => {
  let pool: number[] = []
  return (n: number) => {
    const limit = 256 - (256 % n)
    for (;;) {
      if (pool.length === 0) pool = [...random(16)]
      const b = pool.pop() ?? 0
      if (b < limit) return b % n
    }
  }
}

/** A random code of shard `s`. */
export const shardCode = (s: Shard, random: (n: number) => Uint8Array): string => {
  const region = SHARD_REGIONS.indexOf(s.region)
  const pick = picker(random)
  const letters = [...LETTERS].flatMap((_, i) => (i % SHARD_REGIONS.length === region ? [i] : []))
  const a = letters[pick(letters.length)] ?? region
  const [c, d] = [pick(N), pick(N)]
  return LETTERS.charAt(a) + at(s.index) + at(c) + at(d) + at(check(a, s.index, c, d))
}

/** The shard a (parsed) room code names, or null: a VPS relay's code, or one made before shards (no check character). */
export const shardOf = (code: string): Shard | null => {
  if (code.length !== ROOM_CODE_LENGTH) return null
  const a = LETTERS.indexOf(code.charAt(0))
  const [b, c, d, e] = [1, 2, 3, 4].map((i) => ROOM_CODE_ALPHABET.indexOf(code.charAt(i)))
  if (a < 0 || b === undefined || c === undefined || d === undefined || e === undefined || Math.min(b, c, d, e) < 0) return null
  if (check(a, b, c, d) !== e) return null
  const region = SHARD_REGIONS[a % SHARD_REGIONS.length]
  return region ? { region, index: b } : null
}

/** The header a shard answers a socket for a room it doesn't hold with: the Worker then tries the code's one-room object. */
export const NO_ROOM_HEADER = 'X-PS-No-Room'

/** The rooms a shard holds by default (`ROOMS_PER_SHARD`): the README's "Limits and costs" says why. */
export const DEFAULT_ROOMS_PER_SHARD = 24

/** The cap from its var (a whole number from 1 to 200), else the default. */
export const capOf = (raw: string | undefined) => {
  const n = Number(raw)
  return Number.isInteger(n) && n >= 1 && n <= 200 ? n : DEFAULT_ROOMS_PER_SHARD
}

/** A room that weighs on its shard: any but one the group moved away from (it only answers old links with `moved`). */
export const weighs = (room: Room | null) => room !== null && room.movedTo === null

/**
 * Inbound socket messages a second past which a shard turns new rooms away,
 * whatever its count: a Durable Object starts failing past about 1 000 (on the
 * dev relay 24 probe rooms at 30 Hz, ~1 500 a second, had their shard reset
 * about once a minute; 12 of them, ~750, never). Real rooms send ~6 a second
 * (24 rooms: ~150); this leaves the rooms already in a busy shard room to grow.
 */
export const INBOUND_BUDGET = 600

/** The inbound rate is measured over windows this long. */
export const RATE_WINDOW_MS = 10_000

/** A shard's inbound messages: those since `since`, and `rate` (a second) over the last whole window. */
export type Meter = { since: number; count: number; rate: number }

export const createMeter = (now: number): Meter => ({ since: now, count: 0, rate: 0 })

/** Counts `n` messages at `now`, closing the window once it is `RATE_WINDOW_MS` old (an idle spell makes a slow window). */
export const tally = (m: Meter, now: number, n = 0) => {
  if (now - m.since >= RATE_WINDOW_MS) {
    m.rate = (m.count * 1000) / (now - m.since)
    m.since = now
    m.count = 0
  }
  m.count += n
}

/**
 * Whether a shard holding `rooms`, taking `rate` messages a second, takes one
 * more (`create`): under its cap and its inbound budget. The Worker tries the
 * next index when it doesn't.
 */
export const admits = (rooms: Iterable<Room | null>, cap: number, rate = 0) => {
  let load = 0
  for (const r of rooms) if (weighs(r)) load++
  return load < cap && rate < INBOUND_BUDGET
}

/** The earliest of the rooms' deadlines (a shard has one alarm), or null when none has one. */
export const earliest = (deadlines: Iterable<number | null>): number | null => {
  let min: number | null = null
  for (const d of deadlines) if (d !== null && (min === null || d < min)) min = d
  return min
}

/** Whether a room's deadline has come when the shard's alarm fires at `now`. */
export const due = (deadline: number | null, now: number) => deadline !== null && deadline <= now
