import {
  REALM_CLOSE,
  connect,
  createRealm,
  disconnect,
  hello,
  message,
  parseRealmMessage,
  tick,
  visited,
  identified,
  type ConnId,
  type RealmEffect,
  type RealmState,
} from '../../relay/src/realm'
import { COSMETIC_IDS, slotOf, type CosmeticSlot } from '../data/cosmetics'
import { PLAYABLE_IDS } from '../data/hatchlings'
import { REALM_ROOMS, isTownRoomId, type Door, type Point, type Shape, type Spot, type TownRoomId } from '../data/realmMap'
import { REALM, REALM_LINES, REALM_EMOTES, type CityId, type Facing, type RealmIdentity, type RealmServerMessage, type RoomKey } from '../net/realm'
import type { SocketHandlers, SocketLike } from '../coop/client'
import { dir8 } from '../engine/math'

/**
 * The Poké Realm inside the tab: the relay's own machine (`relay/src/realm.ts`,
 * the one the VPS relay runs) behind a fake socket, with bots that walk, talk,
 * emote and answer party invites, and made-up identities (the API's part), so
 * the realm's screen works with no relay and no API (`ps.realm('local')`).
 *
 * `startLocalRealm({ city, bots })` → `{ socket, dispose }`: open the client's
 * socket with `socket(url, handlers)` (any url ending in `realmPath(city)`,
 * e.g. `LOCAL_REALM_URL + realmPath(city)`), as `coop/localRelay.ts`'s. Its
 * hello's token is read unverified (a Clerk token's `sub`, or the token
 * itself): the player is `me` (handle, partner, look), every other account a
 * bot. Every base may be visited.
 */

export const LOCAL_REALM_URL = 'local://realm'

/** Timers, injected for tests (the globals by default). */
export type RealmTimers = { set: (fn: () => void, ms: number) => unknown; clear: (handle: unknown) => void; every: (fn: () => void, ms: number) => unknown; stop: (handle: unknown) => void }

export type LocalRealmOptions = {
  city: CityId
  /** Bots walking the town, at most `REALM.cityCap - 1`. */
  bots: number
  /** The player's identity (what the API would vouch for); a made-up trainer by default. */
  me?: Partial<Omit<RealmIdentity, 'userId'>>
  /** Uniform in [0, 1): the bots' names, looks and walks. */
  random?: () => number
  now?: () => number
  timers?: RealmTimers
  /** The machine's events (`realm.seated`…), for the console; dropped by default. */
  log?: (ev: string, data: Record<string, unknown>) => void
}

export type LocalRealm = {
  socket: (url: string, on: SocketHandlers) => SocketLike
  /** The bots' avatar ids (once seated), for a test or a dev hook. */
  bots: () => number[]
  /** Stops the bots and the beat, and closes every socket. */
  dispose: () => void
}

const BOT_NAMES = ['misty', 'brock', 'dawn', 'gary', 'iris', 'cilan', 'serena', 'clemont', 'lillie', 'hop', 'nemona', 'arven', 'may', 'max', 'tracey', 'bea', 'marnie', 'leon', 'kiawe', 'mallow']

/** A bot's walk, as a fraction of `REALM.speed`. */
const BOT_PACE = 0.55

/** A bot's mind: where it is, where it's headed and when it next speaks. */
type Bot = {
  conn: ConnId
  userId: string
  id: number | null
  room: RoomKey
  x: number
  y: number
  facing: Facing
  moving: boolean
  target: Point | null
  /** A door it's walking to (its room and spawn), or null. */
  door: { to: TownRoomId; spawn: Point } | null
  restUntil: number
  /** Walking to an arcade cabinet (`cabinet` spot) to play it there, or playing it (`at`). */
  arcade: 'going' | 'at' | null
  talkAt: number
  emoteAt: number
  pingAt: number
}

type FakeSocket = { id: ConnId; on: SocketHandlers; open: boolean }

/** A Clerk session token's `sub`, unverified (nobody to keep out of the player's own tab), else the token itself. */
const userIdOf = (token: string): string | null => {
  try {
    const part = token.split('.')[1]
    if (part) {
      const payload: unknown = JSON.parse(atob(part.replace(/-/g, '+').replace(/_/g, '/')))
      if (typeof payload === 'object' && payload !== null && 'sub' in payload && typeof payload.sub === 'string') return payload.sub
    }
  } catch {
    /* not a JWT: the token itself names the player */
  }
  return token.length > 0 ? token : null
}

const inShape = (s: Shape, x: number, y: number, pad: number) =>
  s.kind === 'rect' ? x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad : ((x - s.x) / (s.rx + pad)) ** 2 + ((y - s.y) / (s.ry + pad)) ** 2 <= 1

/** Whether a straight walk from `a` to `b` in a town room stays clear of its solids. */
const clearPath = (room: TownRoomId, a: Point, b: Point) => {
  const steps = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6)
  for (let i = 0; i <= steps; i++) {
    const x = a.x + ((b.x - a.x) * i) / Math.max(1, steps)
    const y = a.y + ((b.y - a.y) * i) / Math.max(1, steps)
    if (REALM_ROOMS[room].solid.some((s) => inShape(s, x, y, 8))) return false
  }
  return true
}

/** The facing (`Dir8` rows: 0 down, clockwise) of a step. */
const facingOf = (dx: number, dy: number): Facing => dir8(dx, dy)

/** The in-page realm (`LocalRealm`). */
export const startLocalRealm = (opts: LocalRealmOptions): LocalRealm => {
  const random = opts.random ?? Math.random
  const now = opts.now ?? Date.now
  const timers: RealmTimers = opts.timers ?? {
    set: (fn, ms) => setTimeout(fn, ms),
    clear: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
    every: (fn, ms) => setInterval(fn, ms),
    stop: (h) => clearInterval(h as ReturnType<typeof setInterval>),
  }
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(random() * xs.length)]!
  const between = (a: number, b: number) => a + random() * (b - a)

  const state: RealmState = createRealm('sa', now())
  const sockets = new Map<ConnId, FakeSocket>()
  const identities = new Map<string, RealmIdentity>()
  const bots = new Map<ConnId, Bot>()
  let nextConn = 1
  let disposed = false

  /* ---------- Delivery: one ordered queue, flushed on a later task ---------- */

  const queue: (() => void)[] = []
  let flushing: unknown = null
  const later = (fn: () => void) => {
    queue.push(fn)
    flushing ??= timers.set(() => {
      flushing = null
      for (const fn of queue.splice(0)) {
        try {
          fn()
        } catch (err) {
          console.error('[localRealm] handler failed', err)
        }
      }
    }, 0)
  }

  const shut = (ws: FakeSocket, code: number) => {
    sockets.delete(ws.id)
    later(() => {
      if (!ws.open) return
      ws.open = false
      ws.on.close(code)
    })
  }

  /* ---------- The machine's effects ---------- */

  const look = (): RealmIdentity['look'] => {
    const out: Partial<Record<CosmeticSlot, string>> = {}
    for (const slot of ['head', 'back', 'emote', 'title', 'plate', 'trail'] as const) {
      if (random() < (slot === 'head' ? 0.5 : 0.2)) out[slot] = pick(COSMETIC_IDS.filter((id) => slotOf(id) === slot))
    }
    return out
  }

  const meFor = (userId: string): RealmIdentity => ({
    userId,
    handle: opts.me?.handle ?? 'you',
    partner: opts.me?.partner ?? 'charmander',
    shiny: opts.me?.shiny ?? false,
    look: opts.me?.look ?? {},
    supporter: opts.me?.supporter ?? null,
  })

  const apply = (effects: readonly RealmEffect[]) => {
    const texts = new Map<RealmServerMessage, string>()
    for (const e of effects) {
      if (e.k === 'send') {
        const bot = bots.get(e.to)
        if (bot) hear(bot, e.msg)
        const ws = sockets.get(e.to)
        if (!ws) continue
        const text = texts.get(e.msg) ?? JSON.stringify(e.msg)
        texts.set(e.msg, text)
        later(() => ws.open && ws.on.message(text))
      } else if (e.k === 'close') {
        const ws = sockets.get(e.to)
        bots.delete(e.to)
        if (ws) shut(ws, REALM_CLOSE[e.why])
        later(() => step(() => disconnect(state, e.to)))
      } else if (e.k === 'identify') {
        const identities_ = Object.fromEntries(e.userIds.map((id) => [id, identities.get(id) ?? meFor(id)]))
        later(() => step(() => identified(state, e.ask, { identities: identities_, banned: [] }, now())))
      } else if (e.k === 'visit') later(() => step(() => visited(state, e.ask, { allowed: true })))
      else if (e.k === 'event') opts.log?.(e.ev, e.data)
      // `presence`: no API in the tab.
    }
  }

  const step = (fn: () => readonly RealmEffect[]) => {
    if (!disposed) apply(fn())
  }

  /* ---------- Bots ---------- */

  /** What a bot hears from the machine: where it stands, and invites to answer. */
  const hear = (bot: Bot, msg: RealmServerMessage) => {
    if (msg.t === 'welcome' || msg.t === 'room') {
      bot.id = msg.t === 'welcome' ? msg.you : bot.id
      bot.room = msg.room
      const me = msg.avatars.find((a) => a.id === bot.id)
      if (me) {
        bot.x = me.x
        bot.y = me.y
      }
      bot.target = null
      bot.door = null
    } else if (msg.t === 'snap') {
      bot.x = msg.x
      bot.y = msg.y
      bot.target = null
      bot.door = null
    } else if (msg.t === 'invited') {
      const yes = random() < 0.7
      timers.set(() => step(() => message(state, bot.conn, { t: 'answer', from: msg.from, yes }, now())), between(800, 2500))
    }
  }

  /** A new place to walk to in the bot's room: a free spot, or (now and then) a door out. */
  const aim = (bot: Bot) => {
    if (!isTownRoomId(bot.room)) return
    const room = REALM_ROOMS[bot.room]
    const doors: readonly Door[] = room.doors
    const from = { x: bot.x, y: bot.y }
    if (bot.arcade === 'at') step(() => message(state, bot.conn, { t: 'act', act: null }, now()))
    bot.arcade = null
    // In the arcade, a bot often goes to play a cabinet.
    const cabinets: readonly Spot[] = room.spots.filter((s) => s.kind === 'cabinet')
    const cabinet = cabinets.length > 0 ? pick(cabinets) : null
    if (cabinet && random() < 0.5 && clearPath(bot.room, from, cabinet.at)) {
      bot.target = cabinet.at
      bot.arcade = 'going'
      return
    }
    if (doors.length > 0 && random() < 0.12) {
      const door = pick(doors)
      const to = { x: door.at.x + door.at.w / 2, y: door.at.y + door.at.h / 2 }
      if (clearPath(bot.room, from, to)) {
        bot.target = to
        bot.door = { to: door.to, spawn: door.spawn }
        return
      }
    }
    for (let i = 0; i < 12; i++) {
      const to = { x: Math.round(between(24, room.w - 24)), y: Math.round(between(24, room.h - 24)) }
      if (clearPath(bot.room, from, to)) {
        bot.target = to
        return
      }
    }
  }

  /** One beat of a bot: a step of its walk (or a rest), and now and then a line or an emote. */
  const think = (bot: Bot, t: number) => {
    if (bot.id === null) return
    if (t >= bot.talkAt) {
      bot.talkAt = t + between(8_000, 25_000)
      step(() => message(state, bot.conn, { t: 'say', line: pick(REALM_LINES) }, t))
    }
    if (t >= bot.emoteAt) {
      bot.emoteAt = t + between(10_000, 30_000)
      step(() => message(state, bot.conn, { t: 'emote', emote: pick(REALM_EMOTES.filter((e) => e !== 'look')) }, t))
    }
    if (t < bot.restUntil) {
      if (t >= bot.pingAt) {
        bot.pingAt = t + 10_000
        step(() => message(state, bot.conn, { t: 'ping', at: t }, t))
      }
      return
    }
    if (!bot.target) aim(bot)
    const target = bot.target
    if (!target) return
    const stride = (REALM.speed * BOT_PACE) / REALM.moveHz
    const dx = target.x - bot.x
    const dy = target.y - bot.y
    const dist = Math.hypot(dx, dy)
    if (dist <= stride) {
      bot.x = Math.round(target.x)
      bot.y = Math.round(target.y)
      bot.target = null
      bot.moving = false
      bot.restUntil = t + between(1_000, 6_000)
      bot.pingAt = t + 10_000
      if (bot.arcade === 'going') {
        // At the cabinet: facing it, playing a while.
        bot.arcade = 'at'
        bot.facing = 4
        bot.restUntil = t + between(12_000, 35_000)
        step(() => message(state, bot.conn, { t: 'act', act: 'arcade' }, t))
      }
      step(() => message(state, bot.conn, { t: 'move', x: bot.x, y: bot.y, facing: bot.facing, moving: false }, t))
      const door = bot.door
      bot.door = null
      if (door) step(() => message(state, bot.conn, { t: 'go', room: door.to, x: door.spawn.x, y: door.spawn.y }, t))
      return
    }
    bot.x = Math.round(bot.x + (dx / dist) * stride)
    bot.y = Math.round(bot.y + (dy / dist) * stride)
    bot.facing = facingOf(dx, dy)
    bot.moving = true
    step(() => message(state, bot.conn, { t: 'move', x: bot.x, y: bot.y, facing: bot.facing, moving: true }, t))
  }

  const addBot = (i: number) => {
    const userId = `bot-${i}`
    const handle = `${BOT_NAMES[i % BOT_NAMES.length]}${i >= BOT_NAMES.length ? Math.floor(i / BOT_NAMES.length) : ''}`
    identities.set(userId, { userId, handle, partner: pick(PLAYABLE_IDS), shiny: random() < 0.1, look: look(), supporter: random() < 0.15 ? pick(['supporter', 'gold', 'diamond']) : null })
    const conn = `bot-${nextConn++}`
    const t = now()
    bots.set(conn, { conn, userId, id: null, room: 'plaza', x: 0, y: 0, facing: 0, moving: false, target: null, door: null, arcade: null, restUntil: t + between(0, 3_000), talkAt: t + between(2_000, 20_000), emoteAt: t + between(4_000, 25_000), pingAt: t + 10_000 })
    connect(state, conn, opts.city, t)
    step(() => hello(state, conn, { t: 'hello', v: 1, city: opts.city, token: userId, room: 'plaza' }, userId, t))
  }

  for (let i = 0; i < Math.min(opts.bots, REALM.cityCap - 1); i++) addBot(i)

  const beat = timers.every(() => {
    if (disposed) return
    const t = now()
    for (const bot of [...bots.values()]) think(bot, t)
    step(() => tick(state, t))
  }, 1000 / REALM.moveHz)

  /* ---------- The socket ---------- */

  const socket = (url: string, on: SocketHandlers): SocketLike => {
    const city = /\/realm\/([^/]+)\/ws$/.exec(url)?.[1]
    const ws: FakeSocket = { id: `local-${nextConn++}`, on, open: false }
    later(() => {
      if (disposed) return on.close(REALM_CLOSE.refused)
      ws.open = true
      if (city !== opts.city) {
        on.open()
        later(() => ws.open && on.message(JSON.stringify({ t: 'refused', why: 'city' } satisfies RealmServerMessage)))
        return shut(ws, REALM_CLOSE.refused)
      }
      // Seated before `open`: a client says hello from its open handler, as on a real socket.
      sockets.set(ws.id, ws)
      connect(state, ws.id, opts.city, now())
      on.open()
    })
    return {
      send: (text) => {
        if (!ws.open || !sockets.has(ws.id)) return
        const msg = parseRealmMessage(text)
        const conn = state.conns.get(ws.id)
        if (msg?.t === 'hello' && conn && conn.avatar === null) return step(() => hello(state, ws.id, msg, userIdOf(msg.token), now()))
        step(() => message(state, ws.id, msg, now()))
      },
      close: () => {
        if (!ws.open) return
        const known = sockets.delete(ws.id)
        ws.open = false
        if (known) step(() => disconnect(state, ws.id))
        later(() => on.close(1000))
      },
      isOpen: () => ws.open,
      buffered: () => 0,
    }
  }

  const dispose = () => {
    if (disposed) return
    timers.stop(beat)
    for (const ws of [...sockets.values()]) shut(ws, 1001)
    disposed = true
  }

  return { socket, bots: () => [...bots.values()].flatMap((b) => (b.id === null ? [] : [b.id])), dispose }
}
