/**
 * The co-op wire protocol, shared by the game and the room relay (`relay/`, a
 * Cloudflare Worker with one Durable Object per room). Co-op runs in
 * deterministic lockstep: every player simulates the whole run from the same
 * seed, and the relay owns the clock. It stamps each input into the next 60 Hz
 * tick it hasn't sent yet and broadcasts frames of ticks, never waiting for
 * anyone. It also keeps the run's input log, the latest snapshot the players
 * agreed on and their state hashes, so a reconnecting or diverged client resumes
 * from a snapshot plus a short tail instead of replaying the run.
 *
 * This file must import nothing: the relay bundles it alone, so it never carries
 * game code and game deploys never touch it. Inputs, loadouts and settings are
 * opaque to the relay (small JSON the game reads), so a new move or pick needs no
 * relay change. JSON over one WebSocket per player.
 */

/** Bumped with any incompatible change; a client and relay of different versions refuse each other. */
export const PROTOCOL = 2

/** Simulation ticks per second. Tick `t` covers `[t, t + 1) / TICK_HZ` s of the run's clock. */
export const TICK_HZ = 60

export const MAX_PLAYERS = 4

/**
 * Humans in an Arena room (settings `mode: 'versus'`): two teams of four
 * (`ARENA_RANKED.queue.players`, which a relay test keeps equal). A co-op room
 * stays at `MAX_PLAYERS`; a relay before this takes 4 everywhere.
 */
export const MAX_ARENA_PLAYERS = 8

/** Clients send `hash` at every tick that is a multiple of this (once a second). */
export const HASH_EVERY = 60

/** The snapshot uploader sends one at every tick that is a multiple of this (every 10 s). */
export const SNAPSHOT_EVERY = 600

/** Room codes: 5 letters and digits without the look-alikes (0/O, 1/I/L). 31^5 ≈ 28.6 million codes. */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5

/**
 * Which relay a room lives on, told by its code's first character, so a link
 * or a typed code finds its room without asking anyone. Each relay only makes
 * codes of its own home:
 *
 * - `cf`: Cloudflare (a letter, 23 × 31^4 ≈ 21 million codes), the default.
 * - `sa`: the São Paulo VPS relay (`relay/node`), 2 to 5 (4 × 31^4 ≈ 3.7 million).
 *
 * 6 to 9 are free (the retired US east relay's until 2026-10-25): another VPS
 * relay takes them, one entry here, one in the game's `RELAY_URLS`
 * (`coopShell.ts`) and its `VITE_COOP_URL_*`. A code of no home, or of a home
 * this build has no URL for, is Cloudflare's.
 */
export const RELAY_HOMES = { cf: 'ABCDEFGHJKMNPQRSTUVWXYZ', sa: '2345' } as const satisfies Record<string, string>
export type RelayHome = keyof typeof RELAY_HOMES

/** The relays that aren't Cloudflare (each a `relay/node` server). */
export type VpsHome = Exclude<RelayHome, 'cf'>

export const isRelayHome = (v: unknown): v is RelayHome => typeof v === 'string' && Object.hasOwn(RELAY_HOMES, v)

const HOMES: readonly RelayHome[] = Object.keys(RELAY_HOMES).filter(isRelayHome)

/** The VPS relays' homes. */
export const VPS_HOMES: readonly VpsHome[] = HOMES.filter((h): h is VpsHome => h !== 'cf')

/** The relay a (valid) room code belongs to. */
export const homeOf = (code: string): RelayHome => HOMES.find((h) => RELAY_HOMES[h].includes(code.charAt(0))) ?? 'cf'

/** The room code in a shared link (`/?sala=K7QF2`). */
export const ROOM_PARAM = 'sala'

/** Input kinds where a newer input replaces an older one from the same seat in the same tick (the stick). */
export const COALESCED_KINDS = ['move'] as const

/** Entry kinds only the relay stamps: a seat went silent, came back, or left the run for good. */
export const SYSTEM_KINDS = ['away', 'back', 'leave'] as const
export type SystemKind = (typeof SYSTEM_KINDS)[number]

export const LIMITS = {
  /** Any text message but a snapshot chunk, in UTF-16 code units. */
  message: 4096,
  /** A snapshot chunk message (base64 data plus its envelope). */
  chunkMessage: 270_000,
  /** Base64 characters in one snapshot chunk (192 KiB of bytes). */
  chunk: 262_144,
  /** Chunks in one snapshot (4.5 MiB of compressed state at most). */
  parts: 24,
  name: 24,
  /** A loadout or the room settings, as JSON. */
  loadout: 1024,
  settings: 512,
  /** Values after an input's kind. */
  inputValues: 8,
  /** Messages in one `batch`. */
  batch: 16,
  /** Characters of a string input value or input kind. */
  inputString: 24,
  build: 40,
  hash: 32,
  /** An Arena match's result riding on `over` (`ArenaResult` as JSON, opaque to the relay). */
  result: 2048,
  /** A Clerk session token. */
  token: 4096,
  /** An Arena look (`WireLook`): its slots, and the characters of a slot's name or a cosmetic's id. */
  lookSlots: 16,
  lookId: 32,
} as const

/* ---------------- Shared shapes ---------------- */

export type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json }

/** What a player brings into the run (their Pokémon and so on). The relay only stores and relays it; the game reads it. */
export type Loadout = { readonly [key: string]: Json }

/** Run options the host picks in the lobby (difficulty and so on). Opaque to the relay, like `Loadout`. */
export type Settings = { readonly [key: string]: Json }

export type Scalar = number | string | boolean

/**
 * Something that happened to a seat at a tick, applied before that tick's step:
 * a client input (`[seat, kind, ...values]`, as the client sent it) or one the
 * relay stamped (`SystemKind`: away, back, leave).
 */
export type Entry = readonly [seat: number, kind: string, ...values: Scalar[]]

/** One tick's entries, in the order the relay stamped them. */
export type TickEntries = readonly [tick: number, entries: readonly Entry[]]

/**
 * Ticks `from` to `to - 1`. Only ticks with entries are listed (in order); the
 * rest are empty. Live frames list at most tick `from`; catch-up frames many.
 */
export type Frame = { t: 'frame'; from: number; to: number; ticks: readonly TickEntries[] }

/** A snapshot the relay holds: the state at `tick` (after ticks `0..tick - 1`), whose hash a majority agreed on. */
export type SnapshotRef = { tick: number; h: string; parts: number }

/** Who a seat belongs to: a signed-in Clerk user (verified by the relay) or a guest id kept by the device (dev and local relays only). */
export type Auth = { kind: 'clerk'; token: string } | { kind: 'guest'; id: string }

export type Phase = 'lobby' | 'playing' | 'ended'

/**
 * A player's round trips (ms) to the relays, as its client measured them in the room's lobby: each VPS
 * relay of its build by its `/health`, and Cloudflare (`cf`) only as the room it is in now (its socket's
 * pings: a Cloudflare room elsewhere can't be measured). Null: that relay didn't answer.
 */
export type Rtts = { readonly [H in RelayHome]?: number | null }

export type Member = {
  seat: number
  name: string
  /** Signed in (a verified Clerk account) rather than a guest. */
  account: boolean
  host: boolean
  online: boolean
  /** In a run: silent long enough to be stamped `away`. */
  away: boolean
  ready: boolean
  loadout: Loadout | null
  /** Its round trips to the relays (`rtt`), absent until it reported them (a client before it never does). */
  rtt?: Rtts
}

/** The room as everyone sees it, sent on every change. */
export type RoomView = {
  code: string
  phase: Phase
  members: readonly Member[]
  settings: Settings
  /** The current (or last) run's id, 0 before the first. */
  run: number
}

export type RunPlayer = { seat: number; name: string; account: boolean; loadout: Loadout }

/** Everything a client needs to start the run's simulation at tick 0. */
export type RunStart = {
  id: number
  seed: number
  build: string
  settings: Settings
  /** By seat. A seat's entries name it by `seat`. */
  players: readonly RunPlayer[]
}

/* ---------------- HTTP ---------------- */

/**
 * Where a new room's relay runs (Durable Object location hints). `auto` picks
 * the region nearest the host. There are no Durable Objects in South America:
 * `sam` lands anywhere from Miami to Chicago, so `auto` sends South America to
 * `enam` (New Jersey answers São Paulo first).
 */
export const REGIONS = ['auto', 'sam', 'enam', 'wnam', 'weur', 'eeur', 'apac', 'oc'] as const
export type Region = (typeof REGIONS)[number]

/**
 * `POST /rooms`: reserves a room for the host, who then joins it like anyone (`GET /rooms/<code>/ws`, then
 * `hello`). `claim`: whoever says it in a `hello` is the room's host, whoever joined first (a room the group
 * moves to, `move`, where the others may land before the host). Relays before it leave it out. `full`: a VPS
 * relay at capacity takes no new room (joining one never is refused for it); the game creates on Cloudflare.
 */
export type CreateRequest = { v: number; build: string; region?: Region }
export type CreateResponse = { code: string; region: Region; claim?: string } | { error: 'version' | 'invalid' | 'rate' | 'busy' | 'full' }

/* ---------------- Client → relay ---------------- */

/** How often a client in a run reports its link (`net`), in ms. */
export const NET_REPORT_MS = 15_000

export type NetReport = { t: 'net'; rtt: number; rtt95: number; hold: number; underruns: number; stalls: number; reconnects: number }

export type Hello = {
  t: 'hello'
  v: number
  /** The client's build id; a room only takes the build it was created with. */
  build: string
  room: string
  auth: Auth
  /** The seat secret the relay gave this device for this room (`welcome`), kept in localStorage by room code. */
  secret: string | null
  name: string
  /** The run this client has state for, and the tick that state is at (it applied every tick below `from`). */
  resume: { run: number; from: number } | null
  /** The room's `claim` (`CreateResponse`): the host of a room the group moved to takes it back with this. */
  claim?: string | null
}

/** A chunk of the compressed snapshot at `tick` (a multiple of `SNAPSHOT_EVERY`), only from the client told to upload them (`role`). */
export type SnapChunk = { t: 'snap'; tick: number; h: string; part: number; parts: number; data: string }

export type ClientMessage =
  | Hello
  /** Serialize it with `t` first: the relay picks the bigger size limit from that prefix. Never batched. */
  | SnapChunk
  | BatchedMessage
  /**
   * Several messages in one (Cloudflare bills a Durable Object per message it receives), handled in order as if
   * they had come one by one at once: their inputs land in the same tick, in order (a later stick replaces an
   * earlier one), and each pays its own token. Only to a relay whose `welcome` said `batch`.
   */
  | { t: 'batch'; m: readonly BatchedMessage[] }

/** The messages a `batch` may carry: all but the hello, snapshot chunks and batches. */
export type BatchedMessage =
  /** Lobby (or after a run): what you bring, whether you're ready. */
  | { t: 'loadout'; loadout: Loadout }
  | { t: 'ready'; ready: boolean }
  /** Host only, outside a run. */
  | { t: 'settings'; settings: Settings }
  | { t: 'kick'; seat: number }
  | { t: 'start' }
  /** An input, stamped into the next tick. `k` is its kind (never a `SystemKind`), `d` its values. */
  | { t: 'in'; k: string; d: readonly Scalar[] }
  /** Nothing to send for a while but still here (keeps the seat from going `away`). */
  | { t: 'hb' }
  /** The full-state hash at `tick` (a multiple of `HASH_EVERY`). */
  | { t: 'hash'; tick: number; h: string }
  /**
   * The run ended in this client's simulation at `tick`, with this state hash. An Arena match adds its
   * `result` (`ArenaResult` from `game/arenaRank.ts`, as JSON): the relay reports the one the end's
   * majority agrees on (string equality) to the API. A relay before it drops `result`.
   */
  | { t: 'over'; tick: number; h: string; result?: string }
  /**
   * The agreed snapshot at `tick` (a `sync`'s base) didn't hash to its label once restored: its bytes are bad.
   * The relay drops it and stops taking snapshots from whoever uploaded it; the client joins afresh.
   */
  | { t: 'badSnap'; tick: number }
  | { t: 'leave' }
  | { t: 'ping'; at: number }
  /**
   * Lobby: this client's round trips to the relays (`Rtts`), kept on its seat and shown to the room, so the
   * host can pick the relay that is best for the whole group. Only to a relay whose `welcome` said `moves`;
   * never batched (a relay before it would drop the whole batch).
   */
  | { t: 'rtt'; ms: Rtts }
  /**
   * Host only, in the lobby before the first run: the group moves to room `code` (made on another relay).
   * Every seat is told `moved` and the room answers any later `hello` with it. Never batched.
   */
  | { t: 'move'; code: string }
  /**
   * How the link looks from this client in a run (every `NET_REPORT_MS`): round trip (ms, median and
   * p95), the hold (ticks), and since the run began, underruns, stalled frames and reconnects. The relay
   * only logs it (`run.summary`) and keeps the laggiest runs' input logs for the lab. Relays before it
   * drop it as unparsed.
   */
  | NetReport

/* ---------------- Relay → client ---------------- */

/**
 * Why the relay refused a `hello`. `unavailable` covers every reason a room
 * can't be joined (no such room, full, already playing, kicked), so codes
 * can't be probed; `build` says the room runs another build (update the game);
 * `signIn`: co-op takes signed-in players only, and this hello came as a guest
 * (said before anything about the room, so it tells nothing about it).
 */
export type Refusal = 'version' | 'build' | 'unavailable' | 'auth' | 'invalid' | 'signIn'

/** Why the relay closed the socket (after the matching message). */
export type CloseReason = 'replaced' | 'kicked' | 'left' | 'refused' | 'abuse' | 'expired'

/**
 * The WebSocket close code of each reason. A client reconnects after any other
 * close (a network drop, a relay restart), never after one of these.
 */
export const CLOSE_CODES = {
  replaced: 4001,
  kicked: 4002,
  left: 4003,
  refused: 4004,
  expired: 4005,
  abuse: 4008,
} as const satisfies Record<CloseReason, number>

/**
 * Where the relay's room runs (`colo`: the Cloudflare data center, `region`: the location hint it was
 * created with) and where this client meets Cloudflare (`edge` and its TCP round trip, ms), for the
 * client's telemetry. Unknown fields are null.
 */
export type WelcomeNet = { colo: string | null; region: string | null; edge: string | null; edgeRtt: number | null }

export type ServerMessage =
  /**
   * You hold `seat`; keep `secret` (by room code) to take it back from any tab. `batch`: this relay takes `batch`
   * messages (an older one doesn't say it, and gets every message on its own). `net`: where things run (relays
   * before it leave it out). `moves`: this relay takes `rtt` and `move` (an older one doesn't say it).
   */
  | { t: 'welcome'; seat: number; secret: string; room: RoomView; batch?: boolean; net?: WelcomeNet; moves?: boolean }
  /** `build`: with a `build` refusal, the build the room runs (the client tells whether it is older or newer). */
  | { t: 'refused'; code: Refusal; build?: string }
  | { t: 'room'; room: RoomView }
  /** A run starts: its tick 0 goes out in `startsIn` ms. */
  | { t: 'start'; run: RunStart; startsIn: number }
  /**
   * You are (re)joining a run: bring your state to tick `from` (restore `base`,
   * whose chunks follow as `snapPart`; from the run's seed when `base` is null
   * and `from` is 0; or keep your own state when resuming), then frames up to
   * `to` follow, then live frames.
   */
  | { t: 'sync'; reason: 'join' | 'resume' | 'heal'; run: RunStart; from: number; to: number; base: SnapshotRef | null }
  | { t: 'snapPart'; tick: number; part: number; data: string }
  | Frame
  /** Your hash at `tick` disagreed with the majority's: a `sync` with the agreed state follows. */
  | { t: 'heal'; tick: number }
  /** Whether you upload snapshots (`snap`). */
  | { t: 'role'; snapshots: boolean }
  /** The run is over, confirmed by a majority of the connected players. */
  | { t: 'ended'; run: number; tick: number; h: string }
  /** The host's `start` was turned down: not the host, or someone online isn't ready (or has no loadout). */
  | { t: 'denied'; what: 'start'; why: 'notHost' | 'notReady' }
  /** Some of your inputs were dropped for coming too fast (said once per socket). */
  | { t: 'slow' }
  | { t: 'pong'; at: number; tick: number }
  /** Sent right before the relay closes the socket. */
  | { t: 'bye'; reason: CloseReason }
  /**
   * The room moved to room `code` (the host's `move`): join that one, bringing your Pokémon and ready. Said to
   * every seat when it happens, and to any `hello` after it (an old link), then the socket is closed as refused
   * (`unavailable`, all a client before it understands).
   */
  | { t: 'moved'; code: string }

/* ---------------- Parsing ---------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const isWhole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

const isScalar = (v: unknown): v is Scalar =>
  typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v)) || (typeof v === 'string' && v.length <= LIMITS.inputString)

const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T => options.some((o) => o === v)

const MAX_TICK = 2 ** 31

const isJson = (v: unknown, depth = 0): v is Json => {
  if (v === null || typeof v === 'string' || typeof v === 'boolean') return true
  if (typeof v === 'number') return Number.isFinite(v)
  if (depth > 4) return false
  if (Array.isArray(v)) return v.every((x) => isJson(x, depth + 1))
  return isRecord(v) && Object.values(v).every((x) => isJson(x, depth + 1))
}

/** A small JSON object (a loadout or settings) within `max` characters, or null. */
const parseObject = (v: unknown, max: number): { readonly [key: string]: Json } | null =>
  isRecord(v) && isJson(v) && JSON.stringify(v).length <= max ? v : null

export const parseRoomCode = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const code = v.trim().toUpperCase()
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null
}

/** A display name: control characters out, spaces collapsed, 1 to `LIMITS.name` characters. */
export const parseName = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const name = [...v.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()]
  return name.length > 0 ? name.slice(0, LIMITS.name).join('') : null
}

/**
 * An Arena look on the wire, in a loadout's `look` (`ArenaLook` in
 * `data/arenaCosmetics.ts`): slot to cosmetic id. Shell side only: the
 * simulation never reads it, the relay only checks its shape.
 */
export type WireLook = { readonly [slot: string]: string }

const LOOK_KEY = /^[a-zA-Z0-9]+$/

/**
 * A look's shape, or null: a plain object of at most `LIMITS.lookSlots`
 * short alphanumeric names to short alphanumeric ids. The relay drops
 * anything else; which ids exist and who owns them are the game's and the
 * API's to say (`parseLook`, `PUT /gems/look`).
 */
export const parseWireLook = (v: unknown): WireLook | null => {
  if (!isRecord(v)) return null
  const entries = Object.entries(v)
  if (entries.length > LIMITS.lookSlots) return null
  for (const [slot, id] of entries) {
    if (slot.length > LIMITS.lookId || !LOOK_KEY.test(slot) || typeof id !== 'string' || id.length > LIMITS.lookId || !LOOK_KEY.test(id)) return null
  }
  return v as WireLook
}

const parseBuild = (v: unknown) => (typeof v === 'string' && /^[\w.-]{1,40}$/.test(v) ? v : null)

const parseHash = (v: unknown) => (typeof v === 'string' && /^[0-9a-zA-Z_-]{1,32}$/.test(v) ? v : null)

/** A hello's (or the Arena queue's) auth, or null. */
export const parseAuth = (v: unknown): Auth | null => {
  if (!isRecord(v)) return null
  if (v.kind === 'clerk') return typeof v.token === 'string' && v.token.length > 0 && v.token.length <= LIMITS.token ? { kind: 'clerk', token: v.token } : null
  if (v.kind === 'guest') return typeof v.id === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v.id) ? { kind: 'guest', id: v.id } : null
  return null
}

const parseSecret = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{16,64}$/.test(v) ? v : null)

const parseResume = (v: unknown): Hello['resume'] =>
  isRecord(v) && isWhole(v.run, MAX_TICK) && isWhole(v.from, MAX_TICK) ? { run: v.run, from: v.from } : null

const parseHello = (m: Record<string, unknown>): Hello | null => {
  const build = parseBuild(m.build)
  const room = parseRoomCode(m.room)
  const auth = parseAuth(m.auth)
  const name = parseName(m.name)
  if (!isWhole(m.v, 1e6) || !build || !room || !auth || !name) return null
  const claim = parseSecret(m.claim)
  return { t: 'hello', v: m.v, build, room, auth, secret: parseSecret(m.secret), name, resume: parseResume(m.resume), ...(claim ? { claim } : {}) }
}

/** The kind of the message in `raw`, cheaply, to pick its size limit before parsing. */
const isChunkMessage = (raw: string) => raw.startsWith('{"t":"snap"')

/** The size limit of a raw message (snapshot chunks are bigger). */
export const messageLimit = (raw: string) => (isChunkMessage(raw) ? LIMITS.chunkMessage : LIMITS.message)

const parseSnap = (m: Record<string, unknown>): SnapChunk | null => {
  const h = parseHash(m.h)
  const { tick, part, parts, data } = m
  if (!h || !isWhole(tick, MAX_TICK) || tick % SNAPSHOT_EVERY !== 0 || !isWhole(parts, LIMITS.parts) || parts < 1) return null
  if (!isWhole(part, parts - 1) || typeof data !== 'string' || data.length > LIMITS.chunk || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) return null
  return { t: 'snap', tick, h, part, parts, data }
}

/**
 * Round trips by relay (`Rtts`): each a whole number of ms up to a minute, or
 * null. A home this side doesn't know (a build with a relay since retired, or
 * one added later) is left out, not refused.
 */
export const parseRtts = (v: unknown): Rtts | null => {
  if (!isRecord(v)) return null
  const out: { [H in RelayHome]?: number | null } = {}
  for (const [home, ms] of Object.entries(v)) {
    if (ms !== null && !isWhole(ms, 60_000)) return null
    if (isRelayHome(home)) out[home] = ms
  }
  return out
}

/** A message a `batch` may carry, or null. */
const parseBatched = (m: Record<string, unknown>): BatchedMessage | null => {
  switch (m.t) {
    case 'loadout': {
      const loadout = parseObject(m.loadout, LIMITS.loadout)
      return loadout ? { t: 'loadout', loadout } : null
    }
    case 'ready':
      return { t: 'ready', ready: m.ready === true }
    case 'settings': {
      const settings = parseObject(m.settings, LIMITS.settings)
      return settings ? { t: 'settings', settings } : null
    }
    case 'kick':
      return isWhole(m.seat, MAX_ARENA_PLAYERS - 1) ? { t: 'kick', seat: m.seat } : null
    case 'in': {
      const k = m.k
      const d = m.d
      if (typeof k !== 'string' || !/^[A-Za-z][\w-]{0,23}$/.test(k) || oneOf(k, SYSTEM_KINDS)) return null
      if (!Array.isArray(d) || d.length > LIMITS.inputValues || !d.every(isScalar)) return null
      return { t: 'in', k, d }
    }
    case 'hash': {
      const h = parseHash(m.h)
      return h && isWhole(m.tick, MAX_TICK) && m.tick % HASH_EVERY === 0 ? { t: 'hash', tick: m.tick, h } : null
    }
    case 'over': {
      const h = parseHash(m.h)
      if (!h || !isWhole(m.tick, MAX_TICK)) return null
      const result = typeof m.result === 'string' && m.result.length > 0 && m.result.length <= LIMITS.result ? m.result : null
      return { t: 'over', tick: m.tick, h, ...(result !== null && { result }) }
    }
    case 'badSnap':
      return isWhole(m.tick, MAX_TICK) && m.tick % SNAPSHOT_EVERY === 0 ? { t: 'badSnap', tick: m.tick } : null
    case 'ping':
      return typeof m.at === 'number' && Number.isFinite(m.at) ? { t: 'ping', at: m.at } : null
    case 'net': {
      const { rtt, rtt95, hold, underruns, stalls, reconnects } = m
      const max = 1e6
      if (!isWhole(rtt, max) || !isWhole(rtt95, max) || !isWhole(hold, max) || !isWhole(underruns, max) || !isWhole(stalls, max) || !isWhole(reconnects, max)) return null
      return { t: 'net', rtt, rtt95, hold, underruns, stalls, reconnects }
    }
    case 'rtt': {
      const ms = parseRtts(m.ms)
      return ms ? { t: 'rtt', ms } : null
    }
    case 'move': {
      const code = parseRoomCode(m.code)
      return code ? { t: 'move', code } : null
    }
    case 'start':
    case 'hb':
    case 'leave':
      return { t: m.t }
    default:
      return null
  }
}

/** A batch of 1 to `LIMITS.batch` messages, or null when any of them is malformed (or isn't one a batch may carry). */
const parseBatch = (m: Record<string, unknown>): ClientMessage | null => {
  if (!Array.isArray(m.m) || m.m.length < 1 || m.m.length > LIMITS.batch) return null
  const out: BatchedMessage[] = []
  for (const x of m.m) {
    const one = isRecord(x) ? parseBatched(x) : null
    if (!one) return null
    out.push(one)
  }
  return { t: 'batch', m: out }
}

/** A client message from an untrusted string, or null when it is too big or its shape is wrong. */
export const parseClientMessage = (raw: string): ClientMessage | null => {
  if (raw.length > messageLimit(raw)) return null
  let m: unknown
  try {
    m = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(m)) return null
  if (m.t === 'hello') return parseHello(m)
  if (m.t === 'snap') return parseSnap(m)
  if (m.t === 'batch') return parseBatch(m)
  return parseBatched(m)
}
