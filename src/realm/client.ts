import type { SocketHandlers, SocketLike } from '../coop/client'
import { isTableId, type TableResult, type TableView } from '../net/realmTables'
import { parseWireLook } from '../net/protocol'
import {
  REALM_LIMITS,
  REALM_PROTOCOL,
  isCityId,
  isRealmAct,
  isRealmEmote,
  isRealmLine,
  realmPath,
  type Avatar,
  type CityId,
  type Facing,
  type MoveRow,
  type PartyView,
  type RealmClientMessage,
  type RealmRefusal,
  type RealmServerMessage,
  type RoomKey,
} from '../net/realm'

/**
 * The Poké Realm's connection (`net/realm.ts`): one socket to a city on its
 * relay (`<relay>/realm/<city>/ws`), the hello with the Clerk token, the
 * keep-alive pings, and a reconnect after a drop (back into the room it was
 * in). Every message from the relay is parsed here, never trusted as typed;
 * the screen (`ui/realm.ts`) reads them through `onMessage`. No DOM: the
 * socket, the token and the clock are injected, so the in-page realm
 * (`ps.realm('local')`) plugs in its own.
 */

export type RealmDeps = {
  /** The relay's origin (`https://…`; `ws` is derived), or the in-page host's own URL. */
  url: string
  socket: (url: string, on: SocketHandlers) => SocketLike
  /** A fresh Clerk session token (asked on every connect), or null signed out. */
  token: () => Promise<string | null>
  now: () => number
}

export type RealmStatus =
  | { kind: 'idle' }
  | { kind: 'connecting' }
  | { kind: 'open'; you: number }
  | { kind: 'retrying'; at: number }
  | { kind: 'refused'; why: RealmRefusal }

/** What a client may send once seated (the hello is the client's own). */
export type RealmSend = Exclude<RealmClientMessage, { t: 'hello' }>

export type RealmClient = {
  /** Connects to `city`, landing in `room` (a town room or a base). Any previous city is left. */
  join: (city: CityId, room: RoomKey) => void
  /** Leaves the city for good (no reconnect). */
  leave: () => void
  /** Sends a message if seated (dropped otherwise: the walk reports again, a line is just lost). */
  send: (m: RealmSend) => void
  /** Call every frame: reconnects when due and pings while idle. */
  frame: () => void
  status: () => RealmStatus
  city: () => CityId | null
  /** The room the relay last put this trainer in. */
  room: () => RoomKey | null
  /** The round trip of the last ping (ms), or null before one. */
  rtt: () => number | null
  /** Every message from the relay, parsed; returns the unsubscribe. */
  onMessage: (fn: (m: RealmServerMessage) => void) => () => void
}

/** A ping goes out after this long without sending anything (well inside `REALM.idleDropMs`). */
const PING_EVERY_MS = 10_000
/** Reconnect delays (ms) by attempt; the last repeats. */
const RETRY_MS = [500, 1000, 2000, 4000, 8000] as const

/** Refusals of a `go` that leave a seated trainer where it stands. */
const STAYS: ReadonlySet<RealmRefusal> = new Set(['private', 'room', 'busy', 'roomFull'])

const REFUSALS: readonly RealmRefusal[] = ['version', 'signIn', 'profile', 'full', 'city', 'room', 'private', 'elsewhere', 'afk', 'banned', 'busy', 'roomFull']

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const isStr = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max
const isFacing = (v: unknown): v is Facing => Number.isInteger(v) && isNum(v) && v >= 0 && v <= 7

/** A look from the wire: slot to id strings only (the game's `parseLook` keeps the known ones). */
export const parseAvatar = (v: unknown): Avatar | null => {
  if (!isRecord(v)) return null
  const { id, handle, partner, shiny, look, supporter, x, y, facing, moving, act } = v
  if (!isNum(id) || !isStr(handle, 32) || !isStr(partner, 32) || !isNum(x) || !isNum(y) || !isFacing(facing)) return null
  return {
    id,
    handle,
    partner,
    shiny: shiny === true,
    look: parseWireLook(look) ?? {},
    supporter: isStr(supporter, 32) ? supporter : null,
    x,
    y,
    facing,
    moving: moving === true,
    act: isRealmAct(act) ? act : null,
  }
}

const parseAvatars = (v: unknown): Avatar[] | null => (Array.isArray(v) ? v.map(parseAvatar).filter((a): a is Avatar => a !== null) : null)

const parseRow = (v: unknown): MoveRow | null => {
  if (!Array.isArray(v) || v.length !== 5) return null
  const [id, x, y, facing, moving] = v as unknown[]
  return isNum(id) && isNum(x) && isNum(y) && isFacing(facing) && (moving === 0 || moving === 1) ? [id, x, y, facing, moving] : null
}

const parseParty = (v: unknown): PartyView | null => {
  if (!isRecord(v) || !isNum(v.leader) || !Array.isArray(v.members)) return null
  return { leader: v.leader, members: v.members.filter(isNum) }
}

const parseResult = (v: unknown): TableResult | null =>
  isRecord(v) && (v.winner === null || isNum(v.winner)) && (v.forfeit === null || isNum(v.forfeit)) ? { winner: v.winner, forfeit: v.forfeit } : null

/** A table from the wire; its game's `view` stays unknown (the game's `parseView` reads it). */
export const parseTableView = (v: unknown): TableView | null => {
  if (!isRecord(v) || !isTableId(v.id) || !isStr(v.game, 32) || !Array.isArray(v.seats) || !Array.isArray(v.pending) || !Array.isArray(v.ready)) return null
  if (v.phase !== 'waiting' && v.phase !== 'playing' && v.phase !== 'over') return null
  return {
    id: v.id,
    game: v.game,
    seats: v.seats.map((s) => (isNum(s) ? s : null)),
    phase: v.phase,
    view: v.view,
    pending: v.pending.filter(isNum),
    leftMs: isNum(v.leftMs) ? v.leftMs : null,
    result: parseResult(v.result),
    ready: v.ready.filter(isNum),
  }
}

const isRoomKey = (v: unknown): v is RoomKey => isStr(v, REALM_LIMITS.room) && v.length > 0
const isCode = (v: unknown): v is string => isStr(v, REALM_LIMITS.code) && /^[A-Z0-9]+$/.test(v)

/** A relay message from its JSON text, or null for anything malformed (dropped). */
export const parseRealmMessage = (text: unknown): RealmServerMessage | null => {
  if (typeof text !== 'string') return null
  let v: unknown
  try {
    v = JSON.parse(text)
  } catch {
    return null
  }
  if (!isRecord(v)) return null
  switch (v.t) {
    case 'welcome': {
      const avatars = parseAvatars(v.avatars)
      return isNum(v.you) && isRoomKey(v.room) && avatars ? { t: 'welcome', you: v.you, room: v.room, avatars } : null
    }
    case 'room': {
      const avatars = parseAvatars(v.avatars)
      return isRoomKey(v.room) && avatars ? { t: 'room', room: v.room, avatars } : null
    }
    case 'join': {
      const avatar = parseAvatar(v.avatar)
      return avatar ? { t: 'join', avatar } : null
    }
    case 'gone':
      return isNum(v.id) ? { t: 'gone', id: v.id } : null
    case 'moves':
      return Array.isArray(v.rows) ? { t: 'moves', rows: v.rows.map(parseRow).filter((r): r is MoveRow => r !== null) } : null
    case 'snap':
      return isNum(v.x) && isNum(v.y) ? { t: 'snap', x: v.x, y: v.y } : null
    case 'said':
      return isNum(v.id) && isRealmLine(v.line) ? { t: 'said', id: v.id, line: v.line } : null
    case 'emoted':
      return isNum(v.id) && isRealmEmote(v.emote) ? { t: 'emoted', id: v.id, emote: v.emote } : null
    case 'acted':
      return isNum(v.id) && (v.act === null || isRealmAct(v.act)) ? { t: 'acted', id: v.id, act: v.act } : null
    case 'bragged':
      return isNum(v.id) && isStr(v.game, 32) && isStr(v.feat, 32) ? { t: 'bragged', id: v.id, game: v.game, feat: v.feat } : null
    case 'tables': {
      const tables = Array.isArray(v.tables) ? v.tables.map(parseTableView).filter((x): x is TableView => x !== null) : null
      return tables ? { t: 'tables', tables } : null
    }
    case 'table': {
      const table = parseTableView(v.table)
      return table ? { t: 'table', table } : null
    }
    case 'invited':
      return isNum(v.from) ? { t: 'invited', from: v.from } : null
    case 'party': {
      const party = v.party === null ? null : parseParty(v.party)
      return v.party === null || party ? { t: 'party', party } : null
    }
    case 'partyGo':
      return (v.mode === 'coop' || v.mode === 'arena') && isCode(v.code) ? { t: 'partyGo', mode: v.mode, code: v.code } : null
    case 'pong':
      return isNum(v.at) ? { t: 'pong', at: v.at } : null
    case 'baseInvited':
      return isStr(v.from, 32) && /^[A-Za-z0-9_]+$/.test(v.from) && isCityId(v.city) ? { t: 'baseInvited', from: v.from, city: v.city } : null
    case 'refused': {
      const why = REFUSALS.find((r) => r === v.why)
      return why ? { t: 'refused', why } : null
    }
    default:
      return null
  }
}

/** The WebSocket URL of a city on a relay origin (`https://x` → `wss://x/realm/<city>/ws`). */
export const realmSocketUrl = (origin: string, city: CityId) => `${origin.replace(/\/+$/, '').replace(/^http/, 'ws')}${realmPath(city)}`

export const createRealmClient = (deps: RealmDeps): RealmClient => {
  let status: RealmStatus = { kind: 'idle' }
  let city: CityId | null = null
  let room: RoomKey | null = null
  let ws: SocketLike | null = null
  let attempt = 0
  let sentAt = 0
  let rtt: number | null = null
  /** Bumped by every `join`/`leave`: a token that lands for an older connection is dropped. */
  let generation = 0
  const listeners = new Set<(m: RealmServerMessage) => void>()

  const raw = (m: RealmClientMessage) => {
    if (!ws?.isOpen()) return
    ws.send(JSON.stringify(m))
    sentAt = deps.now()
  }

  const drop = () => {
    const s = ws
    ws = null
    s?.close()
  }

  const retry = () => {
    drop()
    status = { kind: 'retrying', at: deps.now() + (RETRY_MS[attempt] ?? 8000) }
    attempt++
  }

  const connect = async () => {
    if (!city || !room) return
    const gen = generation
    const at = city
    status = { kind: 'connecting' }
    const token = await deps.token().catch(() => null)
    if (gen !== generation) return
    if (!token) {
      status = { kind: 'refused', why: 'signIn' }
      return
    }
    let socket: SocketLike | null = null
    const mine = () => gen === generation && ws === socket
    socket = deps.socket(realmSocketUrl(deps.url, at), {
      open: () => {
        if (!mine() || !room) return
        raw({ t: 'hello', v: REALM_PROTOCOL, city: at, token, room })
      },
      message: (data) => {
        if (!mine()) return
        const m = parseRealmMessage(data)
        if (!m) return
        if (m.t === 'welcome') {
          attempt = 0
          room = m.room
          status = { kind: 'open', you: m.you }
        } else if (m.t === 'room') room = m.room
        else if (m.t === 'pong') rtt = deps.now() - m.at
        // Seated, a refused `go` (a private base, no such base, the API busy) leaves the trainer where it was; any other refusal ends the connection.
        else if (m.t === 'refused' && !(status.kind === 'open' && STAYS.has(m.why))) {
          status = { kind: 'refused', why: m.why }
          drop()
        }
        for (const fn of listeners) fn(m)
      },
      close: () => {
        if (!mine()) return
        ws = null
        if (status.kind !== 'refused') retry()
      },
    })
    ws = socket
  }

  return {
    join: (next, at) => {
      generation++
      drop()
      city = next
      room = at
      attempt = 0
      rtt = null
      void connect()
    },
    leave: () => {
      generation++
      drop()
      city = null
      room = null
      status = { kind: 'idle' }
    },
    send: (m) => {
      if (status.kind === 'open') raw(m)
    },
    frame: () => {
      const now = deps.now()
      if (status.kind === 'retrying' && now >= status.at) void connect()
      else if (status.kind === 'open' && now - sentAt >= PING_EVERY_MS) raw({ t: 'ping', at: now })
    },
    status: () => status,
    city: () => city,
    room: () => room,
    rtt: () => rtt,
    onMessage: (fn) => {
      listeners.add(fn)
      return () => void listeners.delete(fn)
    },
  }
}

