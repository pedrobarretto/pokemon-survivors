import { isTableGame, isMinigameId, type TableGameId } from '../../src/data/minigames'
import { REALM_ROOMS, isTownRoomId, type Spot } from '../../src/data/realmMap'
import { BASE_PREFIX, type RealmServerMessage, type RoomKey } from '../../src/net/realm'
import { TABLE, turnMsOf, type TableMatch, type TableResult, type TableView } from '../../src/net/realmTables'
import { TABLE_GAMES } from '../../src/realm/games/tables'
import { noteDeed } from './realmDeeds'
import type { City, RealmEffect, Trainer } from './realm'

/**
 * The realm's game tables (`net/realmTables.ts` is their wire), pure like
 * `realm.ts`, which wires them into its `message`, `tick` and its room
 * changes: no sockets, clock or randomness (the caller passes `now`; a
 * match's seed mixes `now` with a count of the city's matches), and every
 * function mutates the city's plain state and returns the effects.
 *
 * A table lives in a room of a city from the first `sit` (which picks its
 * game) until its last seat stands. A town table is a `gameTable` spot of the
 * room (`REALM_ROOMS`: its `id` and `games`), sat at from within its reach; a
 * base's is a piece of furniture the relay can't see, so any `f<x>-<y>` id of
 * the base the trainer stands in takes a table game. A trainer sits at one
 * table at a time.
 *
 * When the seats fill, a match starts with the game's rules (`TABLE_GAMES`),
 * which take every `play` (a refused one resends that trainer the table). A
 * seat that keeps the match waiting `TABLE.turnMs` forfeits (`tickTables`),
 * and so does one that stands, leaves the room or drops mid-match. After the
 * end the seats `ready` (a trainer who sits down then is ready at once) and
 * the next match starts when every seat is taken and ready. Every change goes
 * to everyone in the room, each with their own view (`table`); a trainer
 * landing in a room gets the room's tables (`tables`).
 *
 * An open table (`TableGame.open`: Ludo, Unown) starts with the seats it has
 * once two or more are taken and all of them are `ready` (or at once when
 * full), and here the game's bot plays every seat nobody holds, after its
 * think (`open.botMs`). Standing up mid-match hands the seat to the bot, and
 * sitting down takes a bot's seat over; a seat awaited past `open.turnMs`
 * gets the bot's move instead of forfeiting, and is stood up after
 * `TABLE.idleStand` of those in a row.
 */

export type Table = {
  room: RoomKey
  id: string
  game: TableGameId
  /** Avatar ids, null when free. */
  seats: (number | null)[]
  match: TableMatch | null
  /** `waiting` until the first match, `over` after each. */
  phase: TableView['phase']
  /** The seats the match awaits, and since when (the turn clock). */
  awaited: readonly number[]
  since: number
  /** Avatar ids ready for another match. */
  ready: number[]
  result: TableResult | null
  /** An open table's turns each seat let run out in a row (`TABLE.idleStand` stands it up). */
  idle: number[]
}

/** A table's key in its city: its room and id. */
const keyOf = (room: RoomKey, id: string) => `${room}#${id}`

/** How far past a town table's spot reach a trainer may still sit (px: positions arrive a beat behind). */
export const SIT_SLACK = 24

const BASE_TABLE = /^f\d{1,2}-\d{1,2}$/

/**
 * The game a trainer may start at table `id` of `room` from where it stands,
 * or null: a town room's `gameTable` spot that plays `game` within reach, or
 * any furniture id in a base.
 */
export const tableGameAt = (room: RoomKey, id: string, game: string, x: number, y: number): TableGameId | null => {
  if (!isMinigameId(game) || !isTableGame(game)) return null
  if (room.startsWith(BASE_PREFIX)) return BASE_TABLE.test(id) ? game : null
  if (!isTownRoomId(room)) return null
  const spots: readonly Spot[] = REALM_ROOMS[room].spots
  const spot = spots.find((s) => s.kind === 'gameTable' && s.id === id)
  if (!spot?.games?.includes(game)) return null
  return Math.hypot(spot.at.x - x, spot.at.y - y) <= spot.reach + SIT_SLACK ? game : null
}

const tableOf = (city: City, t: Trainer): Table | null => (t.table ? (city.tables.get(t.table) ?? null) : null)

/** A table as `viewer` (an avatar id) sees it now. */
export const viewOf = (tb: Table, viewer: number, now: number): TableView => {
  const seat = tb.seats.indexOf(viewer)
  const pending = tb.phase === 'playing' ? tb.awaited : []
  return {
    id: tb.id,
    game: tb.game,
    seats: [...tb.seats],
    phase: tb.phase,
    view: tb.match ? tb.match.view(seat >= 0 ? seat : null) : null,
    pending: [...pending],
    leftMs: pending.length > 0 ? Math.max(0, turnMsOf(TABLE_GAMES[tb.game]) - (now - tb.since)) : null,
    result: tb.result,
    ready: [...tb.ready],
  }
}

const send = (to: string, msg: RealmServerMessage): RealmEffect => ({ k: 'send', to, msg })

/** The table, as each of them sees it, to everyone in its room. */
const broadcast = (city: City, tb: Table, now: number): RealmEffect[] =>
  [...city.trainers.values()].flatMap((t) => (t.room === tb.room ? [send(t.conn, { t: 'table', table: viewOf(tb, t.id, now) })] : []))

/** The room's tables, for a trainer landing in it (`tables`). */
export const tablesFor = (city: City, t: Trainer, now: number): RealmEffect => send(t.conn, { t: 'tables', tables: [...city.tables.values()].filter((tb) => tb.room === t.room).map((tb) => viewOf(tb, t.id, now)) })

/** A seed for the next match: `now` and the city's count of matches, mixed. */
const seedOf = (city: City, now: number) => {
  city.matches++
  let x = Math.imul((now ^ Math.imul(city.matches, 0x9e3779b9)) >>> 0, 0x85ebca6b)
  x ^= x >>> 13
  return Math.imul(x, 0xc2b2ae35) >>> 0
}

const event = (ev: string, data: Record<string, string | number | boolean | null>): RealmEffect => ({ k: 'event', ev, data })

/** Restarts the turn clock when a seat not awaited before is awaited now (at an open table, after every move: a roll and its move are two turns). */
const awaitNext = (tb: Table, now: number) => {
  const next = tb.match ? tb.match.pending() : []
  if (TABLE_GAMES[tb.game].open || next.some((s) => !tb.awaited.includes(s))) tb.since = now
  tb.awaited = [...next]
}

/** The people at a table (avatar ids). */
const people = (tb: Table) => tb.seats.filter((s): s is number => s !== null)

const start = (city: City, tb: Table, now: number): RealmEffect[] => {
  tb.match = TABLE_GAMES[tb.game].start(seedOf(city, now))
  tb.phase = 'playing'
  tb.result = null
  tb.ready = []
  tb.awaited = []
  tb.idle = tb.seats.map(() => 0)
  awaitNext(tb, now)
  tb.since = now
  return [event('realm.table', { city: city.id, game: tb.game, start: true })]
}

/** Ends the match if its rules (or a forfeit) say it's over. A match played out counts for both seats (`table:human`, `table:win`); a forfeit for neither, or sitting and standing would farm them. */
const settle = (city: City, tb: Table, now: number): RealmEffect[] => {
  const result = tb.match?.result() ?? null
  if (tb.phase !== 'playing' || !result) return []
  tb.phase = 'over'
  tb.result = result
  tb.awaited = []
  // An open table's match counts only with two people still at it (one with three bots is a bot's match).
  if (result.forfeit === null && (!TABLE_GAMES[tb.game].open || people(tb).length >= TABLE.openMin))
    tb.seats.forEach((id, seat) => {
      const t = id === null ? undefined : city.trainers.get(id)
      if (!t) return
      noteDeed(city.deeds, t.identity.userId, 'table:human', now)
      if (result.winner === seat) noteDeed(city.deeds, t.identity.userId, 'table:win', now)
    })
  return [event('realm.table', { city: city.id, game: tb.game, draw: result.winner === null, forfeit: result.forfeit !== null })]
}

/**
 * Starts the next match once every seat is taken and (after a match) ready;
 * an open table also with `TABLE.openMin` or more people, all ready.
 */
const maybeStart = (city: City, tb: Table, now: number): RealmEffect[] => {
  if (tb.phase === 'playing') return []
  const sat = people(tb)
  const full = sat.length === tb.seats.length
  const allReady = sat.every((id) => tb.ready.includes(id))
  if (TABLE_GAMES[tb.game].open && !full) return sat.length >= TABLE.openMin && allReady ? start(city, tb, now) : []
  if (!full || (tb.phase === 'over' && !allReady)) return []
  return start(city, tb, now)
}

/**
 * Sits a trainer at a table of its room: the free table of `id` (`game` picks
 * the game of a new one), a free seat at one in use. Stands it up from any
 * other first. A full table or a seat it may not take sends it the table as
 * it is (it watches).
 */
export const sit = (city: City, t: Trainer, id: string, game: string, now: number): RealmEffect[] => {
  const key = keyOf(t.room, id)
  if (t.table === key) return []
  const out = stand(city, t, now)
  let tb = city.tables.get(key)
  if (!tb) {
    const g = tableGameAt(t.room, id, game, t.x, t.y)
    if (!g) return out
    tb = { room: t.room, id, game: g, seats: Array.from({ length: TABLE_GAMES[g].seats }, () => null), match: null, phase: 'waiting', awaited: [], since: now, ready: [], result: null, idle: [] }
    city.tables.set(key, tb)
  } else if (!tableGameAt(t.room, id, tb.game, t.x, t.y)) return out
  const free = tb.seats.indexOf(null)
  if (free < 0) return [...out, send(t.conn, { t: 'table', table: viewOf(tb, t.id, now) })]
  tb.seats[free] = t.id
  tb.idle[free] = 0
  t.table = key
  if (tb.phase === 'over') tb.ready.push(t.id)
  out.push(...maybeStart(city, tb, now), ...broadcast(city, tb, now))
  return out
}

/** Stands a trainer up (a match in play is forfeited; at an open table the bot takes the seat over); the table goes once nobody sits at it. */
export const stand = (city: City, t: Trainer, now: number): RealmEffect[] => {
  const tb = tableOf(city, t)
  t.table = null
  if (!tb) return []
  const seat = tb.seats.indexOf(t.id)
  const out: RealmEffect[] = []
  const open = TABLE_GAMES[tb.game].open !== null
  if (seat >= 0) {
    if (tb.phase === 'playing' && !open) {
      tb.match?.forfeit(seat)
      out.push(...settle(city, tb, now))
    }
    tb.seats[seat] = null
  }
  tb.ready = tb.ready.filter((id) => id !== t.id)
  if (tb.seats.every((s) => s === null)) city.tables.delete(keyOf(tb.room, tb.id))
  // The ones left at an open table may all be ready now.
  else if (open) out.push(...maybeStart(city, tb, now))
  out.push(...broadcast(city, tb, now))
  return out
}

/** A seat's move: through the game's rules; refused, the trainer gets the table back as it is. */
export const play = (city: City, t: Trainer, move: unknown, now: number): RealmEffect[] => {
  const tb = tableOf(city, t)
  if (!tb) return []
  const seat = tb.seats.indexOf(t.id)
  if (tb.phase !== 'playing' || !tb.match || seat < 0 || !tb.match.play(seat, move)) return [send(t.conn, { t: 'table', table: viewOf(tb, t.id, now) })]
  tb.idle[seat] = 0
  awaitNext(tb, now)
  return [...settle(city, tb, now), ...broadcast(city, tb, now)]
}

/** Ready for another match (after one; at an open table, for the first too). */
export const ready = (city: City, t: Trainer, now: number): RealmEffect[] => {
  const tb = tableOf(city, t)
  const can = tb && (tb.phase === 'over' || (tb.phase === 'waiting' && TABLE_GAMES[tb.game].open !== null))
  if (!tb || !can || tb.ready.includes(t.id)) return []
  tb.ready.push(t.id)
  return [...maybeStart(city, tb, now), ...broadcast(city, tb, now)]
}

/** A seed for a bot's move: `now` and the seat, mixed. */
const botSeed = (now: number, seat: number) => {
  const x = Math.imul((now ^ Math.imul(seat + 1, 0x9e3779b9)) >>> 0, 0x85ebca6b)
  return Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0
}

/**
 * An open table's beat: the bot moves for a seat nobody holds once it has
 * thought, and for a person whose clock ran out (standing them up after
 * `TABLE.idleStand` of those running).
 */
const tickOpen = (city: City, tb: Table, now: number): RealmEffect[] => {
  const open = TABLE_GAMES[tb.game].open
  const seat = tb.awaited[0]
  if (!open || !tb.match || seat === undefined) return []
  const id = tb.seats[seat] ?? null
  if (now - tb.since < (id === null ? open.botMs : open.turnMs)) return []
  if (!tb.match.play(seat, tb.match.bot(seat, botSeed(now, seat)))) return []
  awaitNext(tb, now)
  const out = [...settle(city, tb, now)]
  const late = id === null ? undefined : city.trainers.get(id)
  if (late && ++tb.idle[seat]! >= TABLE.idleStand && tb.phase === 'playing') out.push(...stand(city, late, now))
  else out.push(...broadcast(city, tb, now))
  return out
}

/** The tables' beat: a seat awaited past `TABLE.turnMs` forfeits; an open table's bots move (`tickOpen`). */
export const tickTables = (city: City, now: number): RealmEffect[] => {
  const out: RealmEffect[] = []
  for (const tb of [...city.tables.values()]) {
    if (tb.phase === 'playing' && TABLE_GAMES[tb.game].open) {
      out.push(...tickOpen(city, tb, now))
      continue
    }
    const late = tb.awaited[0]
    if (tb.phase !== 'playing' || late === undefined || now - tb.since < TABLE.turnMs) continue
    tb.match?.forfeit(late)
    out.push(...settle(city, tb, now), ...broadcast(city, tb, now))
  }
  return out
}

/** A city's table at `id` of `room`, if one is in use (the in-page realm's bots read their match through it). */
export const tableAt = (city: City, room: RoomKey, id: string): Table | null => city.tables.get(keyOf(room, id)) ?? null
