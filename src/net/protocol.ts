import { isDifficulty, type Difficulty } from '../game/difficulty'
import type { PlayerSetup } from '../game/game'
import { parseRanks } from '../game/meta'
import { isRecord } from '../game/parse'
import { isPlayable, parseDisplayName } from '../game/ranking'

/**
 * The co-op wire protocol, shared by the game and the realtime server
 * (`server/src/play`). Co-op runs in lockstep: every player runs the same
 * deterministic simulation from the same seed, and the server only relays
 * inputs. It owns the clock: it stamps each player's latest input into
 * numbered ticks and sends them out in frames, never waiting for anyone, so a
 * slow or hidden tab only falls behind itself and catches up later. JSON over
 * one WebSocket, which also carries presence and invites. Pure.
 */

/** Bumped with any change to the messages; a client and server of different versions refuse each other. */
export const PROTOCOL = 1

export const MAX_PLAYERS = 4

/** Ticks per frame message: 60 Hz simulation, 30 frames a second. */
export const FRAME_TICKS = 2

/** Room codes: 5 letters and digits without the look-alikes (0/O, 1/I/L). */
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
export const ROOM_CODE_LENGTH = 5

/** The room code in a shared link (`/?sala=K7QF2`). */
export const ROOM_PARAM = 'sala'

export const parseRoomCode = (v: unknown) => {
  if (typeof v !== 'string') return null
  const code = v.trim().toUpperCase()
  return code.length === ROOM_CODE_LENGTH && [...code].every((c) => ROOM_CODE_ALPHABET.includes(c)) ? code : null
}

/** World px the co-op simulation spawns around (the largest screen in the room, within these bounds). */
export const VIEW_LIMITS = { min: 160, max: 720 } as const

export type View = { w: number; h: number }

/** The shared simulation view: wide and tall enough for every member's screen, so nobody sees enemies pop in. */
export const roomView = (views: readonly View[]): View => {
  const clamp = (n: number) => Math.min(VIEW_LIMITS.max, Math.max(VIEW_LIMITS.min, Math.round(n)))
  return { w: clamp(Math.max(VIEW_LIMITS.min, ...views.map((v) => v.w))), h: clamp(Math.max(VIEW_LIMITS.min, ...views.map((v) => v.h))) }
}

/**
 * What a member brings into the run: their Pokémon, its shininess and their
 * Poké Mart ranks. Loosely typed on the wire, so the relay never needs the
 * game's data (a server older than the game still carries a new Pokémon);
 * clients read it with `setupOf`, all on the same build.
 */
export type Loadout = { starter: string; shiny: boolean; ranks: Readonly<Record<string, number>> }

/** A member's loadout as the simulation takes it: an unknown Pokémon plays Bulbasaur, ranks are clamped. */
export const setupOf = (l: Loadout): PlayerSetup => ({ starter: isPlayable(l.starter) ? l.starter : 'bulbasaur', shiny: l.shiny, ranks: parseRanks(l.ranks) })

/** A member of a room as everyone sees it. `slot` is their index in the run's players. */
export type Member = Loadout & {
  slot: number
  name: string
  /** Ranking handle when signed in, so friends can find each other. */
  handle: string | null
  ready: boolean
  /** False while their connection is down (their slot is held a while). */
  online: boolean
  view: View
}

export type RoomPhase = 'lobby' | 'loading' | 'playing'

/* ---------------- Ticks ---------------- */

/** Buttons a player pressed this tick: the special, the Mega button, the manual lunge. */
export const PRESSES = ['special', 'mega', 'lunge'] as const
export type Press = (typeof PRESSES)[number]

/** Level-up and run choices: reroll or skip the offers, go on into endless mode. */
export const CHOICES = ['reroll', 'skip', 'endless'] as const
export type Choice = (typeof CHOICES)[number]

/**
 * What happened to a player at a tick, applied before that tick's step:
 * the stick moved (`code` is `moveCode`, `sample` the client's input counter, for prediction),
 * a press or choice, a level-up pick (`round` is the player's level-up count it was
 * offered at, so a pick that arrives after the timer already picked is dropped),
 * their connection dropped or came back, or they left for good.
 */
export type TickEntry =
  | readonly [slot: number, kind: 'move', code: number, sample: number]
  | readonly [slot: number, kind: Press | Choice]
  | readonly [slot: number, kind: 'offer', index: number, round: number]
  | readonly [slot: number, kind: 'away' | 'back' | 'leave']

/**
 * Ticks `first..first + count - 1`, sparse: each entry carries its tick as an
 * offset from `first`, in tick order, and ticks without entries send nothing.
 */
export type Frame = { first: number; count: number; entries: ReadonlyArray<readonly [offset: number, entry: TickEntry]> }

/* ---------------- Client → server ---------------- */

export type ClientMessage =
  /** First message on every connection. `token` is a Clerk session token when signed in; `guest` a random id kept by the device. */
  | { t: 'hello'; protocol: number; build: string; name: string; guest: string; token: string | null }
  | { t: 'create' }
  /** Joins a room in its lobby; `secret` takes back a held slot after a drop (any phase). */
  | { t: 'join'; code: string; secret: string | null }
  | { t: 'leave' }
  | { t: 'loadout'; loadout: Loadout; view: View }
  | { t: 'ready'; ready: boolean }
  /** Host only. */
  | { t: 'difficulty'; difficulty: Difficulty }
  | { t: 'kick'; slot: number }
  | { t: 'start' }
  /** The run's sprites are loaded: the clock starts once everyone sent it (or after a timeout). */
  | { t: 'loaded' }
  /** The stick changed, or a heartbeat with the same code. */
  | { t: 'move'; code: number; sample: number }
  | { t: 'press'; press: Press }
  | { t: 'choice'; choice: Choice }
  | { t: 'offer'; index: number; round: number }
  /** The tab went to the background (its stick is stamped still) or came back. */
  | { t: 'away'; away: boolean }
  /** State checksum at a tick, compared across the room to spot a desync. */
  | { t: 'sum'; tick: number; sum: number }
  /** The run ended on this client (game over or victory). */
  | { t: 'over' }
  /** Back to the room's lobby after a run. */
  | { t: 'lobby' }
  /** Invites a mutual friend (by handle) into the room. */
  | { t: 'invite'; handle: string }
  /** The friend list changed (a request accepted): presence reloads it. */
  | { t: 'friends' }
  | { t: 'ping'; at: number }

const isWhole = (v: unknown, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max

const parseView = (v: unknown): View | null =>
  isRecord(v) && isWhole(v.w, 4096) && isWhole(v.h, 4096) && v.w > 0 && v.h > 0 ? { w: v.w, h: v.h } : null

const parseRankRecord = (v: unknown): Record<string, number> =>
  isRecord(v) ? Object.fromEntries(Object.entries(v).slice(0, 24).flatMap(([k, n]) => (/^[A-Za-z]{1,24}$/.test(k) && isWhole(n, 20) ? [[k, n]] : []))) : {}

const parseLoadout = (v: unknown): Loadout | null =>
  isRecord(v) && typeof v.starter === 'string' && /^[a-z0-9]{1,24}$/.test(v.starter) ? { starter: v.starter, shiny: v.shiny === true, ranks: parseRankRecord(v.ranks) } : null

const oneOf = <T extends string>(v: unknown, options: readonly T[]): v is T => options.some((o) => o === v)

/** A client message from an untrusted string, or null when its shape is wrong. */
export const parseClientMessage = (raw: string): ClientMessage | null => {
  if (raw.length > 4096) return null
  let m: unknown
  try {
    m = JSON.parse(raw)
  } catch {
    return null
  }
  if (!isRecord(m)) return null
  switch (m.t) {
    case 'hello': {
      const name = parseDisplayName(m.name)
      if (!isWhole(m.protocol, 1e6) || typeof m.build !== 'string' || m.build.length > 40 || !name) return null
      if (typeof m.guest !== 'string' || !/^[a-z0-9]{8,32}$/.test(m.guest)) return null
      const token = typeof m.token === 'string' && m.token.length < 4096 ? m.token : null
      return { t: 'hello', protocol: m.protocol, build: m.build, name, guest: m.guest, token }
    }
    case 'join': {
      const code = parseRoomCode(m.code)
      const secret = typeof m.secret === 'string' && /^[a-z0-9]{16,64}$/.test(m.secret) ? m.secret : null
      return code ? { t: 'join', code, secret } : null
    }
    case 'loadout': {
      const loadout = parseLoadout(m.loadout)
      const view = parseView(m.view)
      return loadout && view ? { t: 'loadout', loadout, view } : null
    }
    case 'ready':
      return { t: 'ready', ready: m.ready === true }
    case 'difficulty':
      return isDifficulty(m.difficulty) ? { t: 'difficulty', difficulty: m.difficulty } : null
    case 'kick':
      return isWhole(m.slot, MAX_PLAYERS - 1) ? { t: 'kick', slot: m.slot } : null
    case 'move':
      return isWhole(m.code, 255) && isWhole(m.sample, 2 ** 31) ? { t: 'move', code: m.code, sample: m.sample } : null
    case 'press':
      return oneOf(m.press, PRESSES) ? { t: 'press', press: m.press } : null
    case 'choice':
      return oneOf(m.choice, CHOICES) ? { t: 'choice', choice: m.choice } : null
    case 'offer':
      return isWhole(m.index, 7) && isWhole(m.round, 1e6) ? { t: 'offer', index: m.index, round: m.round } : null
    case 'away':
      return { t: 'away', away: m.away === true }
    case 'sum':
      return isWhole(m.tick, 2 ** 31) && isWhole(m.sum, 2 ** 32) ? { t: 'sum', tick: m.tick, sum: m.sum } : null
    case 'invite':
      return typeof m.handle === 'string' && m.handle.length <= 32 ? { t: 'invite', handle: m.handle.toLowerCase() } : null
    case 'ping':
      return typeof m.at === 'number' && Number.isFinite(m.at) ? { t: 'ping', at: m.at } : null
    case 'create':
    case 'leave':
    case 'start':
    case 'loaded':
    case 'over':
    case 'lobby':
    case 'friends':
      return { t: m.t }
    default:
      return null
  }
}

/* ---------------- Server → client ---------------- */

/** Why the server refused something. */
export type RefusalCode = 'version' | 'notFound' | 'full' | 'started' | 'notHost' | 'notReady' | 'kicked' | 'rate' | 'notFriend' | 'offline' | 'noRoom'

/** A friend as presence reports them. */
export type FriendPresence = { handle: string; name: string }

export type ServerMessage =
  /** Answer to `hello`: who the token belongs to (null for guests) and which mutual friends are online. */
  | { t: 'welcome'; me: { handle: string | null; name: string } | null; online: FriendPresence[] }
  | { t: 'refused'; code: RefusalCode }
  /** You are in a room, at `slot`; keep `secret` to take the slot back after a drop. */
  | { t: 'room'; code: string; slot: number; secret: string }
  /** The room as it stands (sent on every change while in the lobby, and once on rejoin). */
  | { t: 'lobby'; code: string; host: number; difficulty: Difficulty; phase: RoomPhase; members: Member[] }
  /** The run starts: load its sprites, then send `loaded`. `members` are the run's players by slot. */
  | { t: 'start'; seed: number; difficulty: Difficulty; view: View; members: Member[] }
  /** The clock started. Frames follow from tick 0. */
  | { t: 'go' }
  /** The next ticks. On rejoin the backlog from tick 0 arrives as one big frame. */
  | ({ t: 'frame' } & Frame)
  /** Checksums disagreed at `tick`: the simulations drifted apart. */
  | { t: 'desync'; tick: number }
  | { t: 'presence'; friend: FriendPresence; online: boolean }
  | { t: 'invited'; from: FriendPresence; code: string }
  /** You left the room (or were kicked). */
  | { t: 'left'; reason: 'leave' | 'kicked' }
  | { t: 'pong'; at: number }
