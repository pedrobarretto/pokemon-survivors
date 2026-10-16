import type { Difficulty } from '../game/difficulty'
import { connect, onServer, send } from './client'
import type { Choice, Loadout, Member, Press, RefusalCode, RoomPhase, ServerMessage, TickEntry, View } from './protocol'

/**
 * The co-op room this device is in, as the play server tells it: the lobby,
 * the run once it starts, and the ticks relayed so far. Screens read `room()`
 * and subscribe with `onRoom`; the run driver pulls ticks with `takeTick`.
 * The code and secret survive a reload (sessionStorage), so a dropped player
 * rejoins their own slot and fast-forwards through the backlog.
 */

export type Lobby = { host: number; difficulty: Difficulty; phase: RoomPhase; members: Member[] }

/** What `start` said: the run's seed, rules and players by slot. */
export type RunStart = { seed: number; difficulty: Difficulty; view: View; members: Member[] }

export type Room = {
  code: string
  slot: number
  secret: string
  lobby: Lobby | null
  run: RunStart | null
  /** The clock started (`go`): ticks are flowing. */
  going: boolean
  /** Ticks relayed so far (0..known-1). */
  known: number
  /** Ticks with entries not taken yet, by tick. */
  entries: Map<number, TickEntry[]>
  /** First tick the room's checksums disagreed at, if they did. */
  desync: number | null
}

/** Something about the room changed (after `room()` already shows it). `refused` carries why a request failed. */
export type RoomEvent = ServerMessage | { t: 'closed' }

const SAVED = 'ps:room'

let current: Room | null = null
const listeners = new Set<(e: RoomEvent) => void>()

export const room = () => current

/** Calls `fn` after every room change. Returns the unsubscribe. */
export const onRoom = (fn: (e: RoomEvent) => void) => {
  listeners.add(fn)
  return () => void listeners.delete(fn)
}

const emit = (e: RoomEvent) => listeners.forEach((fn) => fn(e))

const save = (r: Pick<Room, 'code' | 'secret'> | null) => {
  try {
    if (r) sessionStorage.setItem(SAVED, JSON.stringify({ code: r.code, secret: r.secret }))
    else sessionStorage.removeItem(SAVED)
  } catch {
    // Storage blocked: a reload just loses the room.
  }
}

/** The room this tab was in before a reload, to rejoin. */
export const savedRoom = (): { code: string; secret: string } | null => {
  try {
    const raw: unknown = JSON.parse(sessionStorage.getItem(SAVED) ?? 'null')
    if (typeof raw === 'object' && raw !== null && 'code' in raw && 'secret' in raw && typeof raw.code === 'string' && typeof raw.secret === 'string') return { code: raw.code, secret: raw.secret }
  } catch {
    // Nothing to rejoin.
  }
  return null
}

const close = () => {
  current = null
  save(null)
  emit({ t: 'closed' })
}

const apply = (m: ServerMessage) => {
  switch (m.t) {
    case 'welcome': {
      // After a drop the server forgot this connection: take the slot back.
      const back = current ?? savedRoom()
      if (back) send({ t: 'join', code: back.code, secret: back.secret })
      return
    }
    case 'room':
      current = current?.code === m.code ? { ...current, slot: m.slot, secret: m.secret } : { code: m.code, slot: m.slot, secret: m.secret, lobby: null, run: null, going: false, known: 0, entries: new Map(), desync: null }
      save(current)
      return emit(m)
    case 'lobby':
      if (!current || current.code !== m.code) return
      current.lobby = { host: m.host, difficulty: m.difficulty, phase: m.phase, members: m.members }
      // Back in the lobby after a run: the run is over for this room.
      if (m.phase === 'lobby') {
        current.run = null
        current.going = false
      }
      return emit(m)
    case 'start':
      if (!current) return
      current.run = { seed: m.seed, difficulty: m.difficulty, view: m.view, members: m.members }
      current.going = false
      current.known = 0
      current.entries = new Map()
      current.desync = null
      return emit(m)
    case 'go':
      if (current) current.going = true
      return emit(m)
    case 'frame': {
      if (!current) return
      for (const [offset, entry] of m.entries) {
        const tick = m.first + offset
        const list = current.entries.get(tick)
        if (list) list.push(entry)
        else current.entries.set(tick, [entry])
      }
      current.known = Math.max(current.known, m.first + m.count)
      return
    }
    case 'desync':
      if (current) current.desync ??= m.tick
      return emit(m)
    case 'left':
      close()
      return emit(m)
    case 'refused':
      // A rejoin that found no room (it ended, or the server restarted) forgets it.
      if (m.code === 'notFound' || m.code === 'started') {
        if (!current || !current.run) {
          current = null
          save(null)
        }
      }
      return emit(m)
    default:
      return emit(m)
  }
}

onServer(apply)

const NOTHING: readonly TickEntry[] = []

/** The entries of tick `tick` (once known), forgotten as they're taken. */
export const takeTick = (tick: number): readonly TickEntry[] => {
  if (!current) return NOTHING
  const list = current.entries.get(tick)
  if (!list) return NOTHING
  current.entries.delete(tick)
  return list
}

/* ---------------- Requests ---------------- */

export const createRoom = () => (connect(), send({ t: 'create' }))
export const joinRoom = (code: string) => (connect(), send({ t: 'join', code, secret: null }))

/** Leaves for good (the slot isn't held). */
export const leaveRoom = () => {
  if (current) send({ t: 'leave' })
  close()
}

export const setLoadout = (loadout: Loadout, view: View) => send({ t: 'loadout', loadout, view })
export const setReady = (ready: boolean) => send({ t: 'ready', ready })
export const setDifficulty = (difficulty: Difficulty) => send({ t: 'difficulty', difficulty })
export const kick = (slot: number) => send({ t: 'kick', slot })
export const startRun = () => send({ t: 'start' })
export const loaded = () => send({ t: 'loaded' })
export const sendMove = (code: number, sample: number) => send({ t: 'move', code, sample })
export const sendPress = (press: Press) => send({ t: 'press', press })
export const sendChoice = (choice: Choice) => send({ t: 'choice', choice })
export const sendOffer = (index: number, round: number) => send({ t: 'offer', index, round })
export const sendAway = (away: boolean) => send({ t: 'away', away })
export const sendSum = (tick: number, sum: number) => send({ t: 'sum', tick, sum })
export const runOver = () => send({ t: 'over' })
export const backToLobby = () => send({ t: 'lobby' })
export const inviteFriend = (handle: string) => send({ t: 'invite', handle })

/** Whether this device runs the room (the host picks the difficulty and starts). */
export const isHost = (r: Room | null = current) => r !== null && r.lobby !== null && r.lobby.host === r.slot

/** Why a request was refused, for the toasts. */
export type Refusal = RefusalCode
