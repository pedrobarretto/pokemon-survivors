import { BASE_GRID, BASE_ROOM, LANDING, REALM_ROOMS, isTownRoomId, roomBounds, roomCap, type Point, type Rect, type Spot, type TownRoomId } from '../../src/data/realmMap'
import { CATALOG, isCatalogId } from '../../src/data/furnitureCatalog'
import { placedTurn, type FurnitureDef, type TurnMode } from '../../src/data/furnitureDef'
import { JUKEBOX, pieceKey, seatsOf, turnedSize, type FurnitureUse } from '../../src/data/furnitureUse'
import {
  BASE_PREFIX,
  REALM,
  REALM_LIMITS,
  REALM_PROTOCOL,
  baseOwner,
  baseRoom,
  isBusyAct,
  isCityId,
  isRealmEmote,
  isRealmLine,
  type Avatar,
  type CityId,
  type Facing,
  type MoveRow,
  type PartyView,
  type PerchAct,
  type PieceRef,
  type RealmAct,
  type RealmClientMessage,
  type RealmHome,
  type RealmIdentity,
  type RealmRefusal,
  type RealmServerMessage,
  type RoomFurniture,
  type RoomKey,
} from '../../src/net/realm'
import { isFeat, isMinigameId } from '../../src/data/minigames'
import { isTableId } from '../../src/net/realmTables'
import { PRESENCE_EVERY_MS, type IdentityResponse, type PresenceReport, type VisitRequest, type VisitResponse } from '../../src/net/realmRelay'
import { play, ready, sit, stand, tablesFor, tickTables, type Table } from './realmTables'

/**
 * The Poké Realm as a pure state machine (`net/realm.ts` is its wire): every
 * city a relay hosts, their rooms and the trainers walking them. Like
 * `room.ts`, it has no sockets, timers, clock or randomness: the caller passes
 * `now` (ms), and every function mutates the plain state and returns the
 * effects to apply, in order. Nothing is persisted: a restart drops every
 * socket, and the clients say hello again.
 *
 * The realm never simulates. It trusts a client with its own walk inside the
 * room's bounds and a speed budget (`MOVE`), batches the positions out per
 * room at `REALM.moveHz` (`tick`), and asks the API who a trainer is
 * (`identify` effect, batched) and whether it may enter a base (`visit`).
 * The shell answers those with `identified` and `visited`. The rooms' game
 * tables are `realmTables.ts`'s, wired in here. Furniture (`perch`, `use`):
 * a seat is held by the trainer on it (one a seat, its next step stands it
 * up), and a base room's lights and music live in `City.furniture` while
 * anyone is in the room.
 *
 * Shells: the VPS relay (`relay/node/src/realms.ts`) and the in-page host
 * (`src/realm/localRealm.ts`). The shell calls `tick` at `REALM.moveHz`.
 */

export type ConnId = string

/** Per-socket token bucket: burst and refill per second, a token per message. A walker sends `REALM.moveHz` moves a second. */
export const REALM_BUCKET = { capacity: 40, perSecond: 20 } as const

/** Dropped messages within `window` ms past which a socket is closed as abusive. */
export const REALM_ABUSE = { drops: 200, window: 10_000 } as const

/**
 * The walk check. A trainer earns `REALM.speed * REALM.speedSlack` px of
 * walk a second, kept up to `bankS` seconds' worth (so jittery packets that
 * arrive bunched still pass), and each step spends its length; a step past
 * what's in the bank, or out of the room's bounds, is refused (`snap`).
 * A trainer lands in a room with `startS` seconds' worth (its first report
 * may come in quicker than it walked, behind the welcome's latency).
 * `epsilon`: px forgiven per step (positions are whole px).
 */
export const MOVE = { bankS: 1, startS: 0.5, epsilon: 2 } as const

/** The walk banked as a trainer lands in a room. */
const startBank = () => REALM.speed * REALM.speedSlack * MOVE.startS

/** How far from a door (px around its rect) a trainer may take it, and from its spawn it may land. */
export const DOOR_REACH = 40

/** The close codes the realm's sockets end with (after a `refused`, if any). */
export const REALM_CLOSE = { refused: 4100, idle: 4101, abuse: 4102 } as const

export type CloseKind = keyof typeof REALM_CLOSE

/** A trainer seated in a city. */
export type Trainer = {
  conn: ConnId
  id: number
  city: CityId
  identity: RealmIdentity
  room: RoomKey
  x: number
  y: number
  facing: Facing
  moving: boolean
  /** What the trainer is busy at (`act`), shown to the room. */
  act: RealmAct | null
  /** Walk banked (px), as of `bankAt`. */
  bank: number
  bankAt: number
  /** Moved since the last batch went out. */
  dirty: boolean
  /** Last time anything came from the socket (idle drop), and last time the trainer did something (AFK). */
  heard: number
  active: number
  /** When the last lines and emotes went out (the burst limit). */
  said: number[]
  emoted: number[]
  /** When the last brags went out (the talk burst limit, on its own count). */
  bragged: number[]
  /** A base visit waiting on the API (`visit` effect), or null. */
  going: { ask: number; room: RoomKey; x: number; y: number } | null
  party: Party | null
  /** The table it sits at (its key in `City.tables`), or null. */
  table: string | null
  /** Its mutual friends' handles (lower case, the API's at its hello): the ones it may invite to its base. */
  friends: ReadonlySet<string>
  /** Base invites it sent: the friend's handle → when it may invite them again; and when the last went out (the talk burst limit). */
  baseInvites: Map<string, number>
  invitedAt: number[]
  /** The seat it's on (`seatKey`) and its spot, or null; while on one, `act` is its pose. */
  perch: { key: string; x: number; y: number } | null
  /** When its last furniture uses went out (`REALM.useBurst`). */
  used: number[]
}

/** A party: its leader and members (avatar ids, the leader among them), all in one city. */
export type Party = { leader: number; members: number[] }

export type City = {
  id: CityId
  /** The next avatar id (per city, never reused while the relay runs). */
  next: number
  trainers: Map<number, Trainer>
  /** Party invites waiting: invitee id → inviter id → when it expires. */
  invites: Map<number, Map<number, number>>
  /** The game tables in use, by room and id (`realmTables.ts`), and how many matches started here (their seeds count them). */
  tables: Map<string, Table>
  matches: number
  /** Each base room's lights and music, while anyone is in it. */
  furniture: Map<RoomKey, { lit: string[]; music: { piece: string; track: number } | null }>
}

/** A socket, as the realm knows it. */
export type Conn = {
  id: ConnId
  /** The city of the socket's path (`/realm/<city>/ws`). */
  city: CityId
  /** Its trainer's avatar id once seated. */
  avatar: number | null
  /** A hello waiting on its identity (the user id), or null. */
  waiting: { userId: string; room: RoomKey } | null
  tokens: number
  refilledAt: number
  drops: number[]
  heard: number
  /** Sent away by `tick` (idle, AFK): only its close is awaited. */
  bye: boolean
}

export type RealmState = {
  home: RealmHome
  cities: Map<CityId, City>
  conns: Map<ConnId, Conn>
  /** Hellos waiting for an `identify` ask (user ids), and the ask in flight, if any. */
  queued: Set<string>
  asking: { ask: number; userIds: string[] } | null
  /** Base visits asked of the API, by ask. */
  visits: Map<number, { conn: ConnId; avatar: number }>
  asks: number
  /** When the next presence report is due, and whether a city emptied since the last. */
  presenceAt: number
  presenceDirty: boolean
}

export type RealmEffect =
  | { k: 'send'; to: ConnId; msg: RealmServerMessage }
  /** Close the socket (after what was sent to it), with `REALM_CLOSE[why]`. */
  | { k: 'close'; to: ConnId; why: CloseKind }
  /** Ask the API who these accounts are (`POST /realm/identity`) and hand the answer (null: failed) to `identified` with this `ask`. */
  | { k: 'identify'; ask: number; userIds: string[] }
  /** Ask the API whether a trainer may enter a base (`POST /realm/visit`) and hand the answer (null: failed) to `visited`. */
  | { k: 'visit'; ask: number; req: VisitRequest }
  /** Post who walks each city (`POST /realm/presence`); fire and forget. */
  | { k: 'presence'; report: PresenceReport }
  | { k: 'event'; ev: string; data: Record<string, string | number | boolean | null> }

export const createRealm = (home: RealmHome, now: number): RealmState => ({
  home,
  cities: new Map(),
  conns: new Map(),
  queued: new Set(),
  asking: null,
  visits: new Map(),
  asks: 0,
  presenceAt: now + PRESENCE_EVERY_MS,
  presenceDirty: false,
})

/* ---------------- Parsing ---------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const isFacing = (v: unknown): v is Facing => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 7

const coord = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 100_000 ? Math.round(v) : null)

const HANDLE = /^[a-z0-9_]{1,32}$/

/** A room key a client may name: a town room or `base:<handle>`, lowercased. */
export const parseRoomKey = (v: unknown): RoomKey | null => {
  if (typeof v !== 'string' || v.length > REALM_LIMITS.room) return null
  if (isTownRoomId(v)) return v
  const owner = baseOwner(v.toLowerCase())
  return owner !== null && HANDLE.test(owner) ? baseRoom(owner) : null
}

/** A piece of furniture a client names: a town spot's index, or a base piece as placed (a catalog id, whole tiles). */
const parsePiece = (v: unknown): PieceRef | null => {
  if (!isRecord(v)) return null
  const tile = (n: unknown) => typeof n === 'number' && Number.isInteger(n) && n >= 0 && n < 64
  if ('spot' in v) return tile(v.spot) && typeof v.spot === 'number' ? { spot: v.spot } : null
  return isCatalogId(v.id) && tile(v.x) && tile(v.y) && typeof v.x === 'number' && typeof v.y === 'number' ? { id: v.id, x: v.x, y: v.y, turned: v.turned === true } : null
}

/** A co-op room code (`ROOM_CODE_LENGTH` letters and digits, uppercase). */
const CODE = new RegExp(`^[A-Z0-9]{${REALM_LIMITS.code}}$`)

/** A client's message from its text, or null when it's malformed or too big (it still costs the sender a token). */
export const parseRealmMessage = (text: string): RealmClientMessage | null => {
  if (text.length > REALM_LIMITS.message) return null
  let m: unknown
  try {
    m = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(m) || typeof m.t !== 'string') return null
  switch (m.t) {
    case 'hello': {
      const room = parseRoomKey(m.room)
      if (typeof m.v !== 'number' || !isCityId(m.city) || typeof m.token !== 'string' || m.token.length > REALM_LIMITS.token || room === null) return null
      return { t: 'hello', v: m.v, city: m.city, token: m.token, room }
    }
    case 'move': {
      const x = coord(m.x)
      const y = coord(m.y)
      return x === null || y === null || !isFacing(m.facing) || typeof m.moving !== 'boolean' ? null : { t: 'move', x, y, facing: m.facing, moving: m.moving }
    }
    case 'go': {
      const room = parseRoomKey(m.room)
      const x = coord(m.x)
      const y = coord(m.y)
      return room === null || x === null || y === null ? null : { t: 'go', room, x, y }
    }
    case 'say':
      return isRealmLine(m.line) ? { t: 'say', line: m.line } : null
    case 'emote':
      return isRealmEmote(m.emote) ? { t: 'emote', emote: m.emote } : null
    case 'invite':
      return typeof m.id === 'number' && Number.isInteger(m.id) ? { t: 'invite', id: m.id } : null
    case 'answer':
      return typeof m.from === 'number' && Number.isInteger(m.from) && typeof m.yes === 'boolean' ? { t: 'answer', from: m.from, yes: m.yes } : null
    case 'leaveParty':
      return { t: 'leaveParty' }
    case 'partyGo':
      return (m.mode === 'coop' || m.mode === 'arena') && typeof m.code === 'string' && CODE.test(m.code) ? { t: 'partyGo', mode: m.mode, code: m.code } : null
    case 'ping':
      return typeof m.at === 'number' && Number.isFinite(m.at) ? { t: 'ping', at: m.at } : null
    case 'act':
      return m.act === null || isBusyAct(m.act) ? { t: 'act', act: m.act } : null
    case 'perch': {
      const piece = parsePiece(m.piece)
      return piece && typeof m.seat === 'number' && Number.isInteger(m.seat) && m.seat >= 0 && m.seat < 8 ? { t: 'perch', piece, seat: m.seat } : null
    }
    case 'use': {
      const piece = parsePiece(m.piece)
      return piece ? { t: 'use', piece } : null
    }
    case 'brag':
      return isFeat(m.game, m.feat) && typeof m.game === 'string' && typeof m.feat === 'string' ? { t: 'brag', game: m.game, feat: m.feat } : null
    case 'sit':
      return isTableId(m.table) && isMinigameId(m.game) ? { t: 'sit', table: m.table, game: m.game } : null
    case 'stand':
      return { t: 'stand' }
    case 'play':
      return 'move' in m ? { t: 'play', move: m.move } : null
    case 'ready':
      return { t: 'ready' }
    case 'baseInvite':
      return typeof m.handle === 'string' && HANDLE.test(m.handle.toLowerCase()) ? { t: 'baseInvite', handle: m.handle.toLowerCase() } : null
    default:
      return null
  }
}

/* ---------------- Helpers ---------------- */

const send = (to: ConnId, msg: RealmServerMessage): RealmEffect => ({ k: 'send', to, msg })

const event = (ev: string, data: Record<string, string | number | boolean | null> = {}): RealmEffect => ({ k: 'event', ev, data })

/** Refuses or sends a socket away: `refused` then the close. */
const refuse = (conn: ConnId, why: RealmRefusal): RealmEffect[] => [send(conn, { t: 'refused', why }), { k: 'close', to: conn, why: 'refused' }]

const cityOf = (state: RealmState, id: CityId): City => {
  let city = state.cities.get(id)
  if (!city) {
    city = { id, next: 1, trainers: new Map(), invites: new Map(), tables: new Map(), matches: 0, furniture: new Map() }
    state.cities.set(id, city)
  }
  return city
}

const trainerOf = (state: RealmState, conn: Conn | undefined): Trainer | null =>
  conn && conn.avatar !== null ? (state.cities.get(conn.city)?.trainers.get(conn.avatar) ?? null) : null

export const avatarOf = (t: Trainer): Avatar => ({
  id: t.id,
  handle: t.identity.handle,
  partner: t.identity.partner,
  shiny: t.identity.shiny,
  look: t.identity.look,
  supporter: t.identity.supporter,
  x: t.x,
  y: t.y,
  facing: t.facing,
  moving: t.moving,
  act: t.act,
})

const inRoom = (city: City, room: RoomKey): Trainer[] => [...city.trainers.values()].filter((t) => t.room === room)

/** `msg` to everyone in `room` (but `except`). */
const toRoom = (city: City, room: RoomKey, msg: RealmServerMessage, except: number | null = null): RealmEffect[] =>
  inRoom(city, room).flatMap((t) => (t.id === except ? [] : [send(t.conn, msg)]))

const spawnOf = (room: RoomKey): Point => (isTownRoomId(room) ? REALM_ROOMS[room].spawn : BASE_ROOM.spawn)

const inBounds = (room: RoomKey, x: number, y: number) => {
  const b = roomBounds(room)
  return b !== null && x >= 0 && y >= 0 && x <= b.w && y <= b.h
}

const near = (r: Rect, x: number, y: number, reach: number) => x >= r.x - reach && x <= r.x + r.w + reach && y >= r.y - reach && y <= r.y + r.h + reach

const ownBase = (t: Trainer, room: RoomKey) => baseOwner(room) === t.identity.handle.toLowerCase()

/* ---------------- Connections ---------------- */

/** A socket opened on `/realm/<city>/ws`. */
export const connect = (state: RealmState, id: ConnId, city: CityId, now: number): Conn => {
  const conn: Conn = { id, city, avatar: null, waiting: null, tokens: REALM_BUCKET.capacity, refilledAt: now, drops: [], heard: now, bye: false }
  state.conns.set(id, conn)
  return conn
}

/**
 * The first message. `userId`: the Clerk token's account, as the shell
 * verified it (null: it didn't, `signIn`). The hello then waits for the
 * account's identity (`identify`, batched with every other hello that comes
 * in while one ask is out).
 */
export const hello = (state: RealmState, connId: ConnId, msg: Extract<RealmClientMessage, { t: 'hello' }>, userId: string | null, now: number): RealmEffect[] => {
  const conn = state.conns.get(connId)
  if (!conn || conn.avatar !== null || conn.waiting !== null) return []
  conn.heard = now
  if (msg.v !== REALM_PROTOCOL) return refuse(connId, 'version')
  if (msg.city !== conn.city) return refuse(connId, 'city')
  if (!userId) return refuse(connId, 'signIn')
  if (cityOf(state, conn.city).trainers.size >= REALM.cityCap && !seatedIn(state, userId, conn.city)) return refuse(connId, 'full')
  conn.waiting = { userId, room: msg.room }
  state.queued.add(userId)
  return askIdentities(state)
}

const seatedIn = (state: RealmState, userId: string, city: CityId) => [...(state.cities.get(city)?.trainers.values() ?? [])].some((t) => t.identity.userId === userId)

/** Sends the queued hellos' ask, unless one is already out (its answer sends the next). */
const askIdentities = (state: RealmState): RealmEffect[] => {
  if (state.asking || state.queued.size === 0) return []
  const userIds = [...state.queued]
  state.queued.clear()
  state.asking = { ask: ++state.asks, userIds }
  return [{ k: 'identify', ask: state.asking.ask, userIds }]
}

/** The API's answer to an `identify` ask (null: it failed): seats every hello it covers, or refuses it. */
export const identified = (state: RealmState, ask: number, res: IdentityResponse | null, now: number): RealmEffect[] => {
  if (state.asking?.ask !== ask) return []
  const asked = new Set(state.asking.userIds)
  state.asking = null
  const out: RealmEffect[] = []
  for (const conn of [...state.conns.values()]) {
    const w = conn.waiting
    if (!w || !asked.has(w.userId)) continue
    conn.waiting = null
    const identity = res?.identities[w.userId]
    if (!res) out.push(...refuse(conn.id, 'busy'))
    else if (res.banned.includes(w.userId)) out.push(...refuse(conn.id, 'banned'))
    else if (!identity || identity.userId !== w.userId) out.push(...refuse(conn.id, 'profile'))
    else out.push(...seat(state, conn, identity, w.room, now, res.friends?.[w.userId] ?? []))
  }
  return [...out, ...askIdentities(state)]
}

/**
 * Seats a verified trainer: one seat per account (an older one is sent
 * `elsewhere`), the city's cap, then the room it asked for (a town room at
 * its cap lands it in the landing instead, told `roomFull`).
 */
const seat = (state: RealmState, conn: Conn, identity: RealmIdentity, asked: RoomKey, now: number, friends: readonly string[]): RealmEffect[] => {
  const out: RealmEffect[] = []
  for (const city of state.cities.values())
    for (const old of [...city.trainers.values()])
      if (old.identity.userId === identity.userId) {
        out.push(...unseat(state, city, old, now), ...refuse(old.conn, 'elsewhere'))
        const oc = state.conns.get(old.conn)
        if (oc) oc.avatar = null
      }
  const city = cityOf(state, conn.city)
  if (city.trainers.size >= REALM.cityCap) return [...out, ...refuse(conn.id, 'full')]
  // Someone else's base is entered through a visit (the API's say), from the landing room.
  const own = baseOwner(asked) === identity.handle.toLowerCase()
  const crowded = isTownRoomId(asked) && full(city, asked)
  const direct = (isTownRoomId(asked) && !crowded) || own
  const room = direct ? asked : LANDING
  const at = spawnOf(room)
  const t: Trainer = {
    conn: conn.id,
    id: city.next++,
    city: city.id,
    identity,
    room,
    x: at.x,
    y: at.y,
    facing: 0,
    moving: false,
    act: null,
    bank: startBank(),
    bankAt: now,
    dirty: false,
    heard: now,
    active: now,
    said: [],
    emoted: [],
    bragged: [],
    going: null,
    party: null,
    table: null,
    friends: new Set(friends.map((f) => f.toLowerCase())),
    baseInvites: new Map(),
    invitedAt: [],
    perch: null,
    used: [],
  }
  city.trainers.set(t.id, t)
  conn.avatar = t.id
  out.push(
    send(conn.id, { t: 'welcome', you: t.id, room, avatars: inRoom(city, room).map(avatarOf) }),
    tablesFor(city, t, now),
    ...furnitureFor(city, t),
    ...toRoom(city, room, { t: 'join', avatar: avatarOf(t) }, t.id),
    event('realm.seated', { city: city.id, room, trainers: city.trainers.size }),
  )
  if (crowded) out.push(send(conn.id, { t: 'refused', why: 'roomFull' }))
  else if (!direct) out.push(...go(state, t, asked, BASE_ROOM.spawn.x, BASE_ROOM.spawn.y, now))
  return out
}

/** Whether `room` of `city` holds its cap already (`roomCap`; the landing has none of its own). */
const full = (city: City, room: RoomKey) => {
  const cap = roomCap(room)
  return cap !== null && inRoom(city, room).length >= cap
}

/** Takes a trainer out of its city: its room told `gone`, its party left, its invites forgotten. */
const unseat = (state: RealmState, city: City, t: Trainer, now: number): RealmEffect[] => {
  // A match it sat at is forfeited first, while its room still holds it.
  const out = [...stand(city, t, now), ...leaveParty(city, t)]
  city.trainers.delete(t.id)
  city.invites.delete(t.id)
  for (const from of city.invites.values()) from.delete(t.id)
  if (t.going) state.visits.delete(t.going.ask)
  vacate(city, t.room)
  out.push(...toRoom(city, t.room, { t: 'gone', id: t.id }), event('realm.left', { city: city.id, trainers: city.trainers.size }))
  if (city.trainers.size === 0) {
    state.cities.delete(city.id)
    state.presenceDirty = true
  }
  return out
}

/** The socket closed (or the shell gave up on it). */
export const disconnect = (state: RealmState, connId: ConnId, now: number): RealmEffect[] => {
  const conn = state.conns.get(connId)
  if (!conn) return []
  state.conns.delete(connId)
  if (conn.waiting) state.queued.delete(conn.waiting.userId)
  const t = trainerOf(state, conn)
  const city = state.cities.get(conn.city)
  return t && city ? unseat(state, city, t, now) : []
}

/* ---------------- Messages ---------------- */

/** Takes a token for a message; past the bucket it's dropped, and a flood closes the socket. */
const admit = (conn: Conn, ok: boolean, now: number): { ok: boolean; effects: RealmEffect[] } => {
  conn.tokens = Math.min(REALM_BUCKET.capacity, conn.tokens + (Math.max(0, now - conn.refilledAt) * REALM_BUCKET.perSecond) / 1000)
  conn.refilledAt = now
  if (ok && conn.tokens >= 1) {
    conn.tokens -= 1
    return { ok: true, effects: [] }
  }
  conn.drops = conn.drops.filter((t) => now - t < REALM_ABUSE.window)
  conn.drops.push(now)
  return { ok: false, effects: conn.drops.length > REALM_ABUSE.drops ? [event('realm.abuse', { city: conn.city }), { k: 'close', to: conn.id, why: 'abuse' }] : [] }
}

/** A message from a seated socket (`null`: it didn't parse). A hello goes to `hello` instead (the shell verifies its token first). */
export const message = (state: RealmState, connId: ConnId, msg: RealmClientMessage | null, now: number): RealmEffect[] => {
  const conn = state.conns.get(connId)
  if (!conn) return []
  const gate = admit(conn, msg !== null, now)
  if (!gate.ok || !msg) return gate.effects
  conn.heard = now
  const t = trainerOf(state, conn)
  const city = state.cities.get(conn.city)
  if (msg.t === 'ping') return [send(connId, { t: 'pong', at: msg.at })]
  if (!t || !city) return []
  t.heard = now
  switch (msg.t) {
    case 'hello':
      return []
    case 'move':
      return move(city, t, msg, now)
    case 'go':
      t.active = now
      return go(state, t, msg.room, msg.x, msg.y, now)
    case 'say':
      t.active = now
      return burst(t.said, now) ? toRoom(city, t.room, { t: 'said', id: t.id, line: msg.line }) : []
    case 'emote':
      t.active = now
      // The cosmetic emote plays only for a look that has one.
      if (msg.emote === 'look' && !t.identity.look.emote) return []
      return burst(t.emoted, now) ? toRoom(city, t.room, { t: 'emoted', id: t.id, emote: msg.emote }) : []
    case 'invite':
      t.active = now
      return invite(city, t, msg.id, now)
    case 'answer':
      t.active = now
      return answer(city, t, msg.from, msg.yes, now)
    case 'leaveParty':
      t.active = now
      return leaveParty(city, t)
    case 'partyGo':
      t.active = now
      return partyGo(city, t, msg.mode, msg.code)
    case 'act':
      t.active = now
      if (t.act === msg.act) return []
      t.perch = null
      t.act = msg.act
      return toRoom(city, t.room, { t: 'acted', id: t.id, act: t.act })
    case 'perch':
      t.active = now
      return perch(city, t, msg.piece, msg.seat, now)
    case 'use':
      t.active = now
      return useFurniture(city, t, msg.piece, now)
    case 'brag':
      t.active = now
      return burst(t.bragged, now) ? toRoom(city, t.room, { t: 'bragged', id: t.id, game: msg.game, feat: msg.feat }) : []
    // The tables: seats, matches and their moves (`net/realmTables.ts`).
    case 'sit':
      t.active = now
      return [...getUp(city, t), ...sit(city, t, msg.table, msg.game, now)]
    case 'stand':
      t.active = now
      return stand(city, t, now)
    case 'play':
      t.active = now
      return play(city, t, msg.move, now)
    case 'ready':
      t.active = now
      return ready(city, t, now)
    case 'baseInvite':
      t.active = now
      return baseInvite(state, t, msg.handle, now)
  }
}

/**
 * Invites a mutual friend to the trainer's base, wherever they walk on this
 * relay: they hear `baseInvited` (with the city, so they can come). Only a
 * friend the API listed at the hello, once per `REALM.inviteMs` each, within
 * the talk burst; nothing goes back to the inviter either way, so an invite
 * never tells whether someone is online.
 */
const baseInvite = (state: RealmState, t: Trainer, handle: string, now: number): RealmEffect[] => {
  const to = handle.toLowerCase()
  if (to === t.identity.handle.toLowerCase() || !t.friends.has(to) || (t.baseInvites.get(to) ?? 0) > now) return []
  for (const [h, until] of t.baseInvites) if (until <= now) t.baseInvites.delete(h)
  if (!burst(t.invitedAt, now)) return []
  t.baseInvites.set(to, now + REALM.inviteMs)
  for (const city of state.cities.values())
    for (const o of city.trainers.values())
      if (o.identity.handle.toLowerCase() === to) return [send(o.conn, { t: 'baseInvited', from: t.identity.handle, city: t.city }), event('realm.baseInvite', { city: t.city, across: o.city !== t.city })]
  return []
}

/** Whether one more line (or emote, or use) fits the burst limit (`cap` in any `windowMs`); takes it if so. */
const burst = (times: number[], now: number, cap: number = REALM.talkBurst, windowMs: number = REALM.talkWindowMs) => {
  while (times.length > 0 && now - times[0]! >= windowMs) times.shift()
  if (times.length >= cap) return false
  times.push(now)
  return true
}

const earn = (t: Trainer, now: number) => {
  const rate = REALM.speed * REALM.speedSlack
  t.bank = Math.min(rate * MOVE.bankS, t.bank + (Math.max(0, now - t.bankAt) * rate) / 1000)
  t.bankAt = now
}

/** A step: in the room's bounds and within the walk banked, it stands (and goes out in the next batch); otherwise `snap`. */
const move = (city: City, t: Trainer, m: Extract<RealmClientMessage, { t: 'move' }>, now: number): RealmEffect[] => {
  earn(t, now)
  const dist = Math.hypot(m.x - t.x, m.y - t.y)
  if (!inBounds(t.room, m.x, m.y) || dist > t.bank + MOVE.epsilon) return [send(t.conn, { t: 'snap', x: t.x, y: t.y })]
  // On a seat, it keeps its pose and facing until a step takes it off.
  if (t.perch && dist === 0) return []
  const up = getUp(city, t)
  t.bank = Math.max(0, t.bank - dist)
  if (dist > 0 || m.facing !== t.facing || m.moving !== t.moving) {
    t.dirty = true
    t.active = now
  }
  t.x = m.x
  t.y = m.y
  t.facing = m.facing
  t.moving = m.moving
  return up
}

/**
 * Through a door or into a base. Town to town takes a door of the room the
 * trainer stands in (within `DOOR_REACH`) and lands near its spawn; a base
 * lands inside its bounds. A room at its cap (`roomCap`) is refused
 * (`roomFull`), but a base to its owner. Someone else's base asks the API
 * first (`visit`); a refused `go` leaves the trainer where it stands
 * (`snap`, or `refused` `roomFull`/`private`/`room`/`busy`, which keep the
 * socket open).
 */
const go = (state: RealmState, t: Trainer, room: RoomKey, x: number, y: number, now: number): RealmEffect[] => {
  const stay = [send(t.conn, { t: 'snap', x: t.x, y: t.y })]
  if (t.going || room === t.room || !inBounds(room, x, y)) return stay
  const city = state.cities.get(t.city)
  const crowded = city !== undefined && !ownBase(t, room) && full(city, room)
  if (isTownRoomId(room) && isTownRoomId(t.room)) {
    const here: TownRoomId = t.room
    const door = REALM_ROOMS[here].doors.find((d) => d.to === room && near(d.at, t.x, t.y, DOOR_REACH))
    if (!door || Math.hypot(x - door.spawn.x, y - door.spawn.y) > DOOR_REACH) return stay
    return crowded ? [...stay, send(t.conn, { t: 'refused', why: 'roomFull' })] : enter(state, t, room, x, y, now)
  }
  if (crowded) return [...stay, send(t.conn, { t: 'refused', why: 'roomFull' })]
  if (isTownRoomId(room) || ownBase(t, room)) return enter(state, t, room, x, y, now)
  const owner = baseOwner(room)
  if (owner === null) return stay
  const ask = ++state.asks
  t.going = { ask, room, x, y }
  state.visits.set(ask, { conn: t.conn, avatar: t.id })
  return [{ k: 'visit', ask, req: { visitor: t.identity.handle, owner, city: t.city } }]
}

/** Moves a trainer into another room of its city: the old room told `gone`, the trainer `room`, the new one `join`. */
const enter = (state: RealmState, t: Trainer, room: RoomKey, x: number, y: number, now: number): RealmEffect[] => {
  const city = state.cities.get(t.city)
  if (!city) return []
  // Leaving the room stands it up from its table (a match in play is forfeited).
  const out = [...stand(city, t, now), ...toRoom(city, t.room, { t: 'gone', id: t.id }, t.id)]
  const left = t.room
  t.room = room
  vacate(city, left)
  t.perch = null
  t.x = x
  t.y = y
  t.moving = false
  t.act = null
  t.dirty = false
  t.bank = startBank()
  out.push(send(t.conn, { t: 'room', room, avatars: inRoom(city, room).map(avatarOf) }), tablesFor(city, t, now), ...furnitureFor(city, t), ...toRoom(city, room, { t: 'join', avatar: avatarOf(t) }, t.id))
  out.push(event('realm.room', { city: city.id, room: room.startsWith(BASE_PREFIX) ? 'base' : room }))
  return out
}

/** The API's answer to a base visit (null: it failed). */
export const visited = (state: RealmState, ask: number, res: VisitResponse | null, now: number): RealmEffect[] => {
  const v = state.visits.get(ask)
  state.visits.delete(ask)
  const conn = v ? state.conns.get(v.conn) : undefined
  const t = trainerOf(state, conn)
  if (!t || t.id !== v?.avatar || t.going?.ask !== ask) return []
  const { room, x, y } = t.going
  t.going = null
  if (!res) return [send(t.conn, { t: 'refused', why: 'busy' })]
  if (!res.allowed) return [send(t.conn, { t: 'refused', why: res.why === 'private' ? 'private' : 'room' })]
  // The base may have filled while the API answered.
  const city = state.cities.get(t.city)
  if (city && full(city, room)) return [send(t.conn, { t: 'refused', why: 'roomFull' })]
  return enter(state, t, room, x, y, now)
}

/* ---------------- Furniture ---------------- */

/** How far past a town bench's spot reach a trainer may still sit (px: positions arrive a beat behind). */
export const PERCH_SLACK = 24

/** A seat's key in its room: its piece's (a town spot's index, a base piece's `pieceKey`) and its index. */
const seatKey = (piece: string, seat: number) => `${piece}#${seat}`

/** A base piece as placed (`PieceRef`): its use, how it stands (`placedTurn`), its footprint (px) and key, when it's in the catalog and inside the base's grid. */
const basePiece = (p: Extract<PieceRef, { id: string }>): { use: FurnitureUse; box: Rect; size: readonly [number, number]; turn: TurnMode | null; key: string } | null => {
  if (!isCatalogId(p.id)) return null
  const def: FurnitureDef = CATALOG[p.id]
  if (!def.use) return null
  const turn = placedTurn(def, p.turned)
  const [w, h] = turnedSize(def.size, turn)
  if (p.x + w > BASE_GRID.cols || p.y + h > BASE_GRID.rows) return null
  const tile = BASE_GRID.tile
  return { use: def.use, size: def.size, turn, box: { x: p.x * tile, y: p.y * tile, w: w * tile, h: h * tile }, key: pieceKey(p) }
}

/**
 * The seat a trainer may take, or null: a town bench's (its spot within
 * reach), or a base piece's that seats (`use.sit`) within `REALM.useReach` of
 * its footprint. The relay can't see a base's layout (as with its tables), so
 * a base piece is checked against the catalog and the grid, never against the
 * layout; the room's clients draw only what their copy of it holds.
 */
export const seatAt = (room: RoomKey, piece: PieceRef, seat: number, x: number, y: number): { key: string; x: number; y: number; facing: Facing; pose: PerchAct } | null => {
  if ('spot' in piece) {
    if (!isTownRoomId(room)) return null
    const spots: readonly Spot[] = REALM_ROOMS[room].spots
    const spot = spots[piece.spot]
    const s = spot?.seats?.[seat]
    if (!spot || !s || Math.hypot(spot.at.x - x, spot.at.y - y) > spot.reach + PERCH_SLACK) return null
    return { key: seatKey(`s${piece.spot}`, seat), x: s.x, y: s.y, facing: s.face, pose: 'sit' }
  }
  if (baseOwner(room) === null) return null
  const p = basePiece(piece)
  const s = p ? seatsOf(p.use, p.size, p.turn, BASE_GRID.tile)[seat] : undefined
  if (!p || !s || !near(p.box, x, y, REALM.useReach)) return null
  return { key: seatKey(p.key, seat), x: p.box.x + s.x, y: p.box.y + s.y, facing: s.facing, pose: s.pose }
}

/** Sits a trainer on a free seat within reach (off its table first): the room sees it there, posed. */
const perch = (city: City, t: Trainer, piece: PieceRef, seat: number, now: number): RealmEffect[] => {
  const at = seatAt(t.room, piece, seat, t.x, t.y)
  if (!at || t.perch?.key === at.key) return []
  if (inRoom(city, t.room).some((o) => o.perch?.key === at.key)) return []
  if (!burst(t.used, now, REALM.useBurst, REALM.useWindowMs)) return []
  const out = stand(city, t, now)
  t.perch = { key: at.key, x: at.x, y: at.y }
  t.x = at.x
  t.y = at.y
  t.facing = at.facing
  t.moving = false
  t.act = at.pose
  t.dirty = false
  return [...out, ...toRoom(city, t.room, { t: 'acted', id: t.id, act: at.pose, at: [at.x, at.y, at.facing] })]
}

/** Takes a trainer off its seat (its seat free again): the room sees it standing. */
const getUp = (city: City, t: Trainer): RealmEffect[] => {
  if (!t.perch) return []
  t.perch = null
  t.act = null
  return toRoom(city, t.room, { t: 'acted', id: t.id, act: null })
}

/** The furniture state of a base room (made on first use). */
const furnitureOf = (city: City, room: RoomKey) => {
  let f = city.furniture.get(room)
  if (!f) city.furniture.set(room, (f = { lit: [], music: null }))
  return f
}

const furnitureView = (f: { lit: string[]; music: { piece: string; track: number } | null }): RoomFurniture => ({ lit: [...f.lit], music: f.music ? { ...f.music } : null })

/** A base room's lights and music for a trainer landing in it, if anything's on. */
const furnitureFor = (city: City, t: Trainer): RealmEffect[] => {
  const f = city.furniture.get(t.room)
  return f ? [send(t.conn, { t: 'furniture', state: furnitureView(f) })] : []
}

/** Forgets a room's furniture state once nobody's in it: the next visit finds it as the art draws it. */
const vacate = (city: City, room: RoomKey) => {
  if (city.furniture.has(room) && !inRoom(city, room).length) city.furniture.delete(room)
}

/**
 * A base piece used within reach: a light switches (`toggle`), a music piece
 * plays the room's next track (`JUKEBOX`; another piece playing stops, one
 * source at a time; past the last track it stops). Rated by `REALM.useBurst`.
 */
const useFurniture = (city: City, t: Trainer, piece: PieceRef, now: number): RealmEffect[] => {
  if ('spot' in piece || baseOwner(t.room) === null) return []
  const p = basePiece(piece)
  if (!p || !near(p.box, t.x, t.y, REALM.useReach) || 'sit' in p.use) return []
  if (!burst(t.used, now, REALM.useBurst, REALM.useWindowMs)) return []
  const f = furnitureOf(city, t.room)
  if ('toggle' in p.use) {
    const i = f.lit.indexOf(p.key)
    if (i >= 0) f.lit.splice(i, 1)
    // A base holds `BASE_MAX_ITEMS` pieces; the relay can't see which, so it keeps that many lights at most.
    else if (f.lit.push(p.key) > 60) f.lit.shift()
  } else {
    const next = f.music?.piece === p.key ? f.music.track + 1 : 0
    f.music = next < JUKEBOX.length ? { piece: p.key, track: next } : null
  }
  return toRoom(city, t.room, { t: 'furniture', state: furnitureView(f) })
}

/* ---------------- Parties ---------------- */

const partyView = (p: Party | null): PartyView | null => (p ? { leader: p.leader, members: [...p.members] } : null)

const toParty = (city: City, p: Party, msg: RealmServerMessage, except: number | null = null): RealmEffect[] =>
  p.members.flatMap((id) => {
    const m = city.trainers.get(id)
    return m && id !== except ? [send(m.conn, msg)] : []
  })

/** Invites a trainer of the same room into the inviter's party (a leader's, or a new one): it hears `invited` and answers within `REALM.inviteMs`. */
const invite = (city: City, t: Trainer, id: number, now: number): RealmEffect[] => {
  const other = city.trainers.get(id)
  if (!other || other.id === t.id || other.room !== t.room) return []
  if (t.party && (t.party.leader !== t.id || t.party.members.length >= REALM.partyCap || t.party.members.includes(id))) return []
  const pending = city.invites.get(id) ?? new Map<number, number>()
  if ((pending.get(t.id) ?? 0) > now) return []
  pending.set(t.id, now + REALM.inviteMs)
  city.invites.set(id, pending)
  return [send(other.conn, { t: 'invited', from: t.id })]
}

/** An answer to an invite still standing: yes joins the inviter's party (leaving any other first), founding it if the inviter had none. */
const answer = (city: City, t: Trainer, from: number, yes: boolean, now: number): RealmEffect[] => {
  const pending = city.invites.get(t.id)
  const until = pending?.get(from)
  pending?.delete(from)
  if (pending?.size === 0) city.invites.delete(t.id)
  const inviter = city.trainers.get(from)
  if (!yes || until === undefined || until <= now || !inviter) return []
  if (inviter.party && (inviter.party.leader !== inviter.id || inviter.party.members.length >= REALM.partyCap)) return []
  if (inviter.party === t.party && t.party) return []
  const out = leaveParty(city, t)
  const party: Party = inviter.party ?? { leader: inviter.id, members: [inviter.id] }
  party.members.push(t.id)
  inviter.party = party
  t.party = party
  return [...out, ...toParty(city, party, { t: 'party', party: partyView(party) })]
}

/** Leaves the trainer's party: the next member leads if it led, and a party of one is over. */
const leaveParty = (city: City, t: Trainer): RealmEffect[] => {
  const p = t.party
  if (!p) return []
  t.party = null
  p.members = p.members.filter((id) => id !== t.id)
  const out: RealmEffect[] = [send(t.conn, { t: 'party', party: null })]
  if (p.members.length < 2) {
    for (const id of p.members) {
      const m = city.trainers.get(id)
      if (m) m.party = null
    }
    return [...out, ...toParty(city, p, { t: 'party', party: null })]
  }
  if (p.leader === t.id) p.leader = p.members[0]!
  return [...out, ...toParty(city, p, { t: 'party', party: partyView(p) })]
}

/** The leader takes the party into a co-op or Arena room it made: every other member hears where. */
const partyGo = (city: City, t: Trainer, mode: 'coop' | 'arena', code: string): RealmEffect[] =>
  t.party && t.party.leader === t.id ? [...toParty(city, t.party, { t: 'partyGo', mode, code }, t.id), event('realm.partyGo', { city: city.id, mode, size: t.party.members.length })] : []

/* ---------------- Time ---------------- */

/**
 * The shell's beat, at `REALM.moveHz`: each room's moves batch (to the room,
 * only the trainers who moved), idle sockets dropped, AFK trainers sent
 * away, invites expired, the tables' turn clocks, and the presence report
 * when due.
 */
export const tick = (state: RealmState, now: number): RealmEffect[] => {
  const out: RealmEffect[] = []
  for (const conn of [...state.conns.values()]) {
    if (conn.bye) continue
    const t = trainerOf(state, conn)
    if (now - conn.heard >= REALM.idleDropMs) {
      conn.bye = true
      out.push(event('realm.idle', { seated: t !== null }), { k: 'close', to: conn.id, why: 'idle' })
    } else if (t && now - t.active >= REALM.afkMs) {
      conn.bye = true
      out.push(...refuse(conn.id, 'afk'))
    }
  }
  for (const city of state.cities.values()) {
    const rooms = new Map<RoomKey, MoveRow[]>()
    for (const t of city.trainers.values()) {
      if (!t.dirty) continue
      t.dirty = false
      const rows = rooms.get(t.room) ?? []
      rows.push([t.id, t.x, t.y, t.facing, t.moving ? 1 : 0])
      rooms.set(t.room, rows)
    }
    for (const [room, rows] of rooms) {
      const msg: RealmServerMessage = { t: 'moves', rows }
      // A lone mover hears nothing of its own walk.
      for (const t of inRoom(city, room)) if (rows.length > 1 || rows[0]![0] !== t.id) out.push(send(t.conn, msg))
    }
    for (const [to, from] of city.invites) {
      for (const [id, until] of from) if (until <= now) from.delete(id)
      if (from.size === 0) city.invites.delete(to)
    }
    out.push(...tickTables(city, now))
  }
  if (now >= state.presenceAt || state.presenceDirty) {
    state.presenceAt = now + PRESENCE_EVERY_MS
    state.presenceDirty = false
    out.push({ k: 'presence', report: presence(state, now) })
  }
  return out
}

/** Who walks each city now (handles) and in which room (lined up with them), for the API's city picker and friends list. */
export const presence = (state: RealmState, now: number): PresenceReport => {
  const walking = [...state.cities.values()].filter((c) => c.trainers.size > 0).map((c) => [c.id, [...c.trainers.values()]] as const)
  return {
    home: state.home,
    at: now,
    cities: Object.fromEntries(walking.map(([id, ts]) => [id, ts.map((t) => t.identity.handle)])),
    rooms: Object.fromEntries(walking.map(([id, ts]) => [id, ts.map((t) => t.room)])),
  }
}

/** Trainers per city and sockets, for `/health` and the stats. */
export const realmCounts = (state: RealmState) => ({
  sockets: state.conns.size,
  trainers: [...state.cities.values()].reduce((n, c) => n + c.trainers.size, 0),
  cities: Object.fromEntries([...state.cities.values()].map((c) => [c.id, c.trainers.size])) as Partial<Record<CityId, number>>,
})
