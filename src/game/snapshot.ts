import { rngFrom, type RngState, type SeededRng } from '../engine/rng'
import { createGrid } from '../engine/spatial'
import { rebuildGrid } from './enemies'
import { RULES_VERSION } from './replay'
import type { Game } from './types'

/**
 * Snapshots of a running game: `snapshot(g)` writes the whole simulation state
 * as bytes, `restore(bytes)` brings it back as a `Game` that steps on exactly
 * like the original, and `stateHash(g)` hashes it without writing anything
 * (what co-op peers compare every second).
 *
 * The state is walked structurally, not field by field, so new fields and
 * moved ones (per-player state) need nothing here. What it takes:
 * - plain objects, arrays, `Map`s and `Set`s, strings, numbers, booleans,
 *   `null` and `undefined`. Key and insertion order are kept (the simulation
 *   iterates some of them), a field set to `undefined` stays apart from a
 *   missing one, and numbers keep their exact bits (`-0` and `Infinity`
 *   included; every `NaN` is written as the same one).
 * - shared references: an object reachable from two places (an enemy in
 *   `enemies` and in a homing shot's `target`, the hit list two hitboxes
 *   share) comes back as one object, so identity checks still hold. Cycles too.
 * - the run's rng (`SeededRng`): written as its state record and rebound on
 *   restore (`rngFrom`), wherever it sits.
 * - derived caches are left out and rebuilt (`DERIVED`): the spatial grid
 *   (refilled from the enemies) and the terrain's cells (rebuilt from the
 *   seed on demand).
 * Anything else (a function, a class instance, a typed array) is a bug in the
 * state and throws, naming where it sits.
 *
 * No game code depends on this module: it's for the co-op netcode, the tests
 * and the determinism harness (`npm run determinism`). It runs outside the hot loop.
 */

/** Bump when the byte layout changes. */
export const SNAPSHOT_FORMAT = 1

const MAGIC = [0x50, 0x53] as const // 'PS'

const T = {
  undefined: 0,
  null: 1,
  false: 2,
  true: 3,
  int: 4,
  f64: 5,
  str: 6,
  array: 7,
  object: 8,
  map: 9,
  set: 10,
  ref: 11,
  rng: 12,
  grid: 13,
} as const
/** Tags from here up are the whole numbers 0..`SMALL_MAX` themselves. */
const SMALL = 32
const SMALL_MAX = 255 - SMALL

const isPlainObject = (v: object): v is Record<string, unknown> => {
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

const isSeededRng = (v: unknown): v is SeededRng => typeof v === 'function' && 'state' in v && typeof v.state === 'object' && v.state !== null

/**
 * Root fields that are caches: a snapshot carries what rebuilds them, not
 * them. The grid goes as its cell size (`restore` refills it from the
 * enemies, as every tick does before reading it); the terrain goes without its
 * cells (`featureAt` rebuilds any cell from the seed, the same).
 */
type Derived = { kind: 'grid'; cell: number } | { kind: 'value'; value: unknown }
const DERIVED: { readonly [K in keyof Game]?: (value: Game[K]) => Derived } = {
  grid: (grid) => ({ kind: 'grid', cell: grid.cell }),
  terrain: (terrain) => ({ kind: 'value', value: { ...terrain, cells: new Map() } }),
}

/** The rule for a root field that is a cache, if `key` is one. */
const derivedOf = (key: string) => DERIVED[key as keyof Game] as ((value: unknown) => Derived) | undefined

/** Thrown at a value the snapshot can't hold; the walk's caller turns it into a message with its path. */
type Unsupported = { unsupported: unknown; why: string }

const unsupported = (v: unknown, why: string): Unsupported => ({ unsupported: v, why })

/** Runs a walk over `g`, turning an `Unsupported` throw into an error that says where the value sits. */
const guarded = <R>(g: Game, walk: () => R): R => {
  try {
    return walk()
  } catch (e) {
    if (typeof e === 'object' && e !== null && 'unsupported' in e && 'why' in e) {
      throw new Error(`snapshot: ${String(e.why)} at ${pathTo(g, e.unsupported) ?? '(somewhere in the game)'}`)
    }
    throw e
  }
}

/** Where `target` sits in `root`, as a path (`enemies[3].fight`), for error messages. Slow; errors only. */
export const pathTo = (root: unknown, target: unknown): string | null => {
  const visited = new Set<unknown>()
  const search = (v: unknown, path: string): string | null => {
    if (v === target) return path
    if ((typeof v !== 'object' && typeof v !== 'function') || v === null || visited.has(v)) return null
    visited.add(v)
    const entries: Array<[string, unknown]> = Array.isArray(v)
      ? v.map((x, i) => [`${path}[${i}]`, x])
      : v instanceof Map
        ? [...v].flatMap(([k, x]): Array<[string, unknown]> => [[`${path}<key ${String(k)}>`, k], [`${path}<${String(k)}>`, x]])
        : v instanceof Set
          ? [...v].map((x, i) => [`${path}{${i}}`, x])
          : Object.entries(v).map(([k, x]) => [path ? `${path}.${k}` : k, x])
    for (const [p, x] of entries) {
      const found = search(x, p)
      if (found) return found
    }
    return null
  }
  return search(root, '')
}

/* ---------------- Writing ---------------- */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

/** A trie of key lists, so an object's shape (its keys in order) goes once and then as a number. */
type ShapeNode = { id: number; next: Map<string, ShapeNode> }

/**
 * The game's whole simulation state as bytes: `PS`, the format, the rules
 * version, then the state. Same state, same bytes. Strings, object shapes and
 * objects get numbers in the order they're first met, and a repeat goes as
 * its number.
 */
export const snapshot = (g: Game): Uint8Array<ArrayBuffer> => {
  let buf = new Uint8Array(1 << 16)
  let view = new DataView(buf.buffer)
  let n = 0
  const room = (extra: number) => {
    if (n + extra <= buf.length) return
    let size = buf.length * 2
    while (size < n + extra) size *= 2
    const next = new Uint8Array(size)
    next.set(buf.subarray(0, n))
    buf = next
    view = new DataView(buf.buffer)
  }
  const byte = (b: number) => {
    room(1)
    buf[n++] = b
  }
  /** A whole number in [0, 2^32) as a varint. */
  const uint = (v: number) => {
    room(5)
    while (v >= 0x80) {
      buf[n++] = (v & 0x7f) | 0x80
      v >>>= 7
    }
    buf[n++] = v
  }

  const strings = new Map<string, number>()
  const refs = new Map<object, number>()
  const shapes: ShapeNode = { id: -1, next: new Map() }
  let shapeCount = 0

  /** A string: 0 and its UTF-8 the first time, its number + 1 after. */
  const str = (s: string) => {
    const i = strings.get(s)
    if (i !== undefined) return uint(i + 1)
    strings.set(s, strings.size)
    uint(0)
    const bytes = encoder.encode(s)
    uint(bytes.length)
    room(bytes.length)
    buf.set(bytes, n)
    n += bytes.length
  }

  const num = (v: number) => {
    if ((v | 0) === v && (v !== 0 || 1 / v > 0)) {
      if (v >= 0 && v <= SMALL_MAX) return byte(SMALL + v)
      byte(T.int)
      return uint(((v << 1) ^ (v >> 31)) >>> 0)
    }
    byte(T.f64)
    room(8)
    if (v !== v) {
      view.setUint32(n, 0, true)
      view.setUint32(n + 4, 0x7ff80000, true)
    } else view.setFloat64(n, v, true)
    n += 8
  }

  /** Whether `o` was written before: then it goes as a reference. */
  const repeat = (o: object) => {
    const i = refs.get(o)
    if (i === undefined) {
      refs.set(o, refs.size)
      return false
    }
    byte(T.ref)
    uint(i)
    return true
  }

  const object = (o: Record<string, unknown>, root: boolean) => {
    let node = shapes
    let count = 0
    for (const k in o) {
      let next = node.next.get(k)
      if (!next) node.next.set(k, (next = { id: -1, next: new Map() }))
      node = next
      count++
    }
    byte(T.object)
    if (node.id >= 0) uint(node.id + 1)
    else {
      node.id = shapeCount++
      uint(0)
      uint(count)
      for (const k in o) str(k)
    }
    for (const k in o) {
      const derived = root ? derivedOf(k) : undefined
      if (!derived) {
        value(o[k])
        continue
      }
      const d = derived(o[k])
      if (d.kind === 'value') value(d.value)
      else {
        byte(T.grid)
        uint(d.cell)
      }
    }
  }

  const value = (v: unknown): void => {
    switch (typeof v) {
      case 'number':
        return num(v)
      case 'string':
        byte(T.str)
        return str(v)
      case 'boolean':
        return byte(v ? T.true : T.false)
      case 'undefined':
        return byte(T.undefined)
      case 'function':
        if (!isSeededRng(v)) throw unsupported(v, 'a function')
        if (repeat(v)) return
        byte(T.rng)
        return value(v.state)
      case 'object': {
        if (v === null) return byte(T.null)
        if (repeat(v)) return
        if (Array.isArray(v)) {
          byte(T.array)
          uint(v.length)
          for (let i = 0; i < v.length; i++) {
            if (!(i in v)) throw unsupported(v, `an array with a hole at ${i}`)
            value(v[i])
          }
          return
        }
        if (v instanceof Map) {
          byte(T.map)
          uint(v.size)
          for (const [k, x] of v) {
            value(k)
            value(x)
          }
          return
        }
        if (v instanceof Set) {
          byte(T.set)
          uint(v.size)
          for (const x of v) value(x)
          return
        }
        if (!isPlainObject(v)) throw unsupported(v, `an instance of ${v.constructor?.name ?? 'something'}`)
        return object(v, false)
      }
      default:
        throw unsupported(v, `a ${typeof v}`)
    }
  }

  byte(MAGIC[0])
  byte(MAGIC[1])
  uint(SNAPSHOT_FORMAT)
  uint(RULES_VERSION)
  // The game is reference 0, like the first object a restore creates.
  refs.set(g, 0)
  guarded(g, () => object(g as unknown as Record<string, unknown>, true))
  return buf.slice(0, n)
}

/* ---------------- Reading ---------------- */

/** A snapshot's header. */
export type SnapshotHeader = { format: number; rules: number }

/**
 * Reads a snapshot back into plain values (the rng rebound, the grid empty)
 * without checking its rules version: what the diff tool inspects. `restore`
 * is the way to get a game to play.
 */
export const decodeSnapshot = (bytes: Uint8Array): SnapshotHeader & { state: Record<string, unknown> } => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let n = 0
  const byte = () => {
    if (n >= bytes.length) throw new Error('snapshot: cut short')
    return bytes[n++]!
  }
  const uint = () => {
    let v = 0
    let scale = 1
    for (;;) {
      const b = byte()
      v += (b & 0x7f) * scale
      if (b < 0x80) return v
      scale *= 128
    }
  }
  if (byte() !== MAGIC[0] || byte() !== MAGIC[1]) throw new Error('snapshot: not a snapshot')
  const format = uint()
  const rules = uint()
  if (format !== SNAPSHOT_FORMAT) throw new Error(`snapshot: format ${format}, this build reads ${SNAPSHOT_FORMAT}`)

  const strings: string[] = []
  const refs: unknown[] = []
  const shapes: string[][] = []

  const str = () => {
    const i = uint()
    if (i > 0) return strings[i - 1]!
    const len = uint()
    if (n + len > bytes.length) throw new Error('snapshot: cut short')
    const s = decoder.decode(bytes.subarray(n, n + len))
    n += len
    strings.push(s)
    return s
  }

  // Containers join `refs` before their contents, so references inside them (cycles) resolve.
  const value = (): unknown => {
    const t = byte()
    if (t >= SMALL) return t - SMALL
    switch (t) {
      case T.undefined:
        return undefined
      case T.null:
        return null
      case T.false:
        return false
      case T.true:
        return true
      case T.int: {
        const z = uint()
        return (z >>> 1) ^ -(z & 1)
      }
      case T.f64: {
        if (n + 8 > bytes.length) throw new Error('snapshot: cut short')
        const v = view.getFloat64(n, true)
        n += 8
        return v
      }
      case T.str:
        return str()
      case T.array: {
        const len = uint()
        const a: unknown[] = []
        refs.push(a)
        for (let i = 0; i < len; i++) a.push(value())
        return a
      }
      case T.object: {
        const id = uint()
        let keys = shapes[id - 1]
        if (id === 0) {
          const count = uint()
          keys = []
          for (let i = 0; i < count; i++) keys.push(str())
          shapes.push(keys)
        }
        if (!keys) throw new Error('snapshot: bad shape')
        const o: Record<string, unknown> = {}
        refs.push(o)
        for (const k of keys) o[k] = value()
        return o
      }
      case T.map: {
        const size = uint()
        const m = new Map<unknown, unknown>()
        refs.push(m)
        for (let i = 0; i < size; i++) {
          const k = value()
          m.set(k, value())
        }
        return m
      }
      case T.set: {
        const size = uint()
        const s = new Set<unknown>()
        refs.push(s)
        for (let i = 0; i < size; i++) s.add(value())
        return s
      }
      case T.ref: {
        const i = uint()
        if (i >= refs.length) throw new Error('snapshot: bad reference')
        return refs[i]
      }
      case T.rng: {
        const at = refs.length
        refs.push(null)
        const rng = rngFrom(value() as RngState)
        refs[at] = rng
        return rng
      }
      case T.grid:
        return createGrid(uint())
      default:
        throw new Error(`snapshot: unknown tag ${t}`)
    }
  }

  const state = value()
  if (typeof state !== 'object' || state === null || Array.isArray(state)) throw new Error('snapshot: no game in it')
  if (n !== bytes.length) throw new Error('snapshot: trailing bytes')
  return { format, rules, state: state as Record<string, unknown> }
}

/**
 * The game a snapshot holds, ready to step on. Throws on a snapshot of
 * another format or rules version: it would play by other rules.
 */
export const restore = (bytes: Uint8Array): Game => {
  const { rules, state } = decodeSnapshot(bytes)
  if (rules !== RULES_VERSION) throw new Error(`snapshot: rules ${rules}, this build plays ${RULES_VERSION}`)
  const g = state as unknown as Game
  rebuildGrid(g)
  return g
}

/* ---------------- Hash ---------------- */

const f64 = new Float64Array(1)
const words = new Uint32Array(f64.buffer)

/** Deeper than this, the state must hold a cycle (the hash walks shared objects once per path). */
const MAX_DEPTH = 64

/**
 * A 64-bit hash of the simulation state (two murmur3-style lanes, as 16 hex
 * digits), the same on every engine. It covers every value a snapshot holds,
 * in the same order, with each container's kind and size (an object's key
 * count, so `undefined` and missing differ), leaving out the derived caches;
 * it skips what can't change on its own between two runs of one build: the
 * key names and which objects are shared. Twice as fast as `snapshot`, with
 * nothing allocated per object, so it can run every second on a phone.
 *
 * The contract for comparing hashes across clients: since key names aren't
 * mixed in, two builds whose state differs only by a renamed (or reordered)
 * key hash the same, which is why rooms are pinned to a sim build id, not to
 * this hash. And `g.events` and `g.view` are part of the state like the rest:
 * the co-op runner drains `events` every tick before hashing (`coop/runner.ts`)
 * and every client simulates the same `COOP.view` (480×270), so a shell that
 * left events queued or resized its sim view would hash differently.
 */
export const stateHash = (g: Game): string => {
  let h1 = 0x9e3779b9
  let h2 = 0x7f4a7c15
  const mix = (w: number) => {
    let k = Math.imul(w, 0xcc9e2d51)
    k = (k << 15) | (k >>> 17)
    k = Math.imul(k, 0x1b873593)
    h1 ^= k
    h1 = (h1 << 13) | (h1 >>> 19)
    h1 = (Math.imul(h1, 5) + 0xe6546b64) | 0
    h2 ^= Math.imul(w ^ (w >>> 16), 0x85ebca6b)
    h2 = (h2 << 17) | (h2 >>> 15)
    h2 = (Math.imul(h2, 0x2c1b3c6d) + 0x297a2d39) | 0
  }
  const str = (s: string) => {
    mix(s.length)
    for (let i = 0; i < s.length; i++) mix(s.charCodeAt(i))
  }
  const value = (v: unknown, depth: number): void => {
    switch (typeof v) {
      case 'number':
        if ((v | 0) === v && (v !== 0 || 1 / v > 0)) {
          mix(T.int)
          return mix(v)
        }
        mix(T.f64)
        if (v !== v) {
          mix(0)
          return mix(0x7ff80000)
        }
        f64[0] = v
        mix(words[0]!)
        return mix(words[1]!)
      case 'string':
        mix(T.str)
        return str(v)
      case 'boolean':
        return mix(v ? T.true : T.false)
      case 'undefined':
        return mix(T.undefined)
      case 'function':
        if (!isSeededRng(v)) throw unsupported(v, 'a function')
        mix(T.rng)
        return value(v.state, depth + 1)
      case 'object': {
        if (v === null) return mix(T.null)
        if (depth > MAX_DEPTH) throw unsupported(v, 'a cycle (or a very deep nest)')
        if (Array.isArray(v)) {
          mix(T.array)
          mix(v.length)
          for (let i = 0; i < v.length; i++) value(v[i], depth + 1)
          return
        }
        if (v instanceof Map) {
          mix(T.map)
          mix(v.size)
          for (const [k, x] of v) {
            value(k, depth + 1)
            value(x, depth + 1)
          }
          return
        }
        if (v instanceof Set) {
          mix(T.set)
          mix(v.size)
          for (const x of v) value(x, depth + 1)
          return
        }
        if (!isPlainObject(v)) throw unsupported(v, `an instance of ${v.constructor?.name ?? 'something'}`)
        mix(T.object)
        let count = 0
        const root = depth === 0
        for (const k in v) {
          count++
          const derived = root ? derivedOf(k) : undefined
          if (!derived) value(v[k], depth + 1)
          else {
            const d = derived(v[k])
            if (d.kind === 'value') value(d.value, depth + 1)
            else {
              mix(T.grid)
              mix(d.cell)
            }
          }
        }
        return mix(count)
      }
      default:
        throw unsupported(v, `a ${typeof v}`)
    }
  }
  mix(SNAPSHOT_FORMAT)
  mix(RULES_VERSION)
  guarded(g, () => value(g, 0))
  const fmix = (h: number) => {
    h ^= h >>> 16
    h = Math.imul(h, 0x85ebca6b)
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35)
    h ^= h >>> 16
    return (h >>> 0).toString(16).padStart(8, '0')
  }
  return fmix(h1 ^ Math.imul(h2, 0x27d4eb2f)) + fmix(h2 ^ h1)
}

/* ---------------- Compression ---------------- */

const pipe = async (bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer())

/** Whether this engine's streams do raw deflate both ways: Safari before 16.4 has no compression streams, Chrome before 103 no raw deflate. */
const NATIVE = (() => {
  try {
    new CompressionStream('deflate-raw')
    new DecompressionStream('deflate-raw')
    return true
  } catch {
    return false
  }
})()

/**
 * Deflates a snapshot (raw deflate: the engine's streams, or fflate where they
 * lack it, loaded only there; both write the same format, so a room mixes
 * them). Separate from `snapshot`, so callers choose.
 */
export const deflate = async (bytes: Uint8Array<ArrayBuffer>) =>
  NATIVE ? pipe(bytes, new CompressionStream('deflate-raw')) : (await import('fflate')).deflateSync(bytes)

/** Inflates what `deflate` wrote. */
export const inflate = async (bytes: Uint8Array<ArrayBuffer>) =>
  NATIVE ? pipe(bytes, new DecompressionStream('deflate-raw')) : (await import('fflate')).inflateSync(bytes)
