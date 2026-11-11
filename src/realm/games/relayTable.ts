import type { TableGameId } from '../../data/minigames'
import type { RealmServerMessage } from '../../net/realm'
import type { TableView } from '../../net/realmTables'
import type { RealmClient } from '../client'
import type { TableLobby, TableSource } from './frame'

/** What the relay's table needs from the realm's connection. */
export type TableLink = Pick<RealmClient, 'send' | 'onMessage'>

export type RelayTableOpts = {
  link: TableLink
  /** The table's id in the room, and the game to open it with if it's free. */
  id: string
  game: TableGameId
  /** This trainer's avatar id. */
  you: number
  /** The table as the room last showed it (`tables`/`table`), null when nobody sits at it. */
  initial: TableView | null
  /** A match against the bot on this device, for the wait (`localTable`). */
  bot: () => TableSource
  /** An open table (`TableGame.open`): two or more people start it when all are ready, bots in the other seats. */
  open?: boolean
}

/** How long after an opponent sits during a bot match the screen says so (ms). */
const ARRIVED_MS = 2200

/**
 * A table of the realm relay's (`relay/src/realmTables.ts`) as a
 * `TableSource`: it sits on open (a full table is only watched, `seat()`
 * null), reads the room's `tables`/`table` messages, sends `play`, `ready`
 * and, on leave, `stand`. The turn clock counts down between the relay's
 * messages from when each arrived.
 *
 * While its seat waits for an opponent it offers a match against the bot
 * (`playBot`): the source then plays a `localTable` (`vs` reads `bot`) until
 * someone sits down, and goes back to the relay's match at once.
 *
 * At an open table the seat waits for a second person the same way; with two
 * or more seated it gathers instead (`gather`: Começar sends `ready`;
 * `gathered` once sent), and a bot's seat mid-match is a seat to take over.
 */
export const relayTable = (opts: RelayTableOpts): TableSource => {
  const { link, id, you } = opts
  let view: TableView | null = opts.initial
  let at = 0
  let now = 0
  let bot: TableSource | null = null
  let arrivedAt: number | null = null
  let left = false

  const open = opts.open ?? false
  const mine = (v: TableView | null) => (v ? v.seats.indexOf(you) : -1)
  const free = (v: TableView | null) => v === null || v.seats.includes(null)
  const people = (v: TableView | null) => (v ? v.seats.filter((s) => s !== null).length : 0)

  const land = (next: TableView | null) => {
    view = next
    at = now
    // Someone sat down while the bot played: back to the table (an open one gathers before it plays).
    if (bot && next && mine(next) >= 0 && (next.phase === 'playing' || (open && people(next) >= 2))) {
      bot.leave()
      bot = null
      arrivedAt = now
    }
  }

  const off = link.onMessage((m: RealmServerMessage) => {
    if (left) return
    if (m.t === 'tables') land(m.tables.find((tb) => tb.id === id) ?? null)
    else if (m.t === 'table' && m.table.id === id) land(m.table.seats.every((s) => s === null) ? null : m.table)
  })

  /** Sits down unless every seat is taken (then it only watches). */
  const sitDown = () => {
    if (free(view) && mine(view) < 0) link.send({ t: 'sit', table: id, game: view?.game ?? opts.game })
  }
  sitDown()

  /** The table now: the turn clock run down since the view arrived. */
  const current = (): TableView | null => (view && view.leftMs !== null ? { ...view, leftMs: Math.max(0, view.leftMs - (now - at)) } : view)

  const lobby = (): TableLobby | null => {
    if (bot) return 'bot'
    if (arrivedAt !== null && now - arrivedAt < ARRIVED_MS) return 'arrived'
    const seat = mine(view)
    if (seat < 0) return free(view) ? 'seatFree' : 'watching'
    if (!view || view.phase === 'playing') return null
    if (open && people(view) >= 2) return view.ready.includes(you) ? 'gathered' : view.phase === 'waiting' ? 'gather' : null
    return view.seats.includes(null) ? 'opponent' : null
  }

  return {
    get vs() {
      return bot ? 'bot' : 'human'
    },
    table: () => (bot ? bot.table() : current()),
    seat: () => {
      if (bot) return bot.seat()
      const seat = mine(view)
      return seat >= 0 ? seat : null
    },
    play: (move) => (bot ? bot.play(move) : link.send({ t: 'play', move })),
    ready: () => (bot ? bot.ready() : link.send({ t: 'ready' })),
    frame: (t) => {
      now = t
      if (at === 0) at = t
      bot?.frame(t)
    },
    leave: () => {
      if (left) return
      left = true
      bot?.leave()
      bot = null
      off()
      if (mine(view) >= 0 || view === null) link.send({ t: 'stand' })
    },
    lobby,
    playBot: () => {
      if (lobby() === 'opponent') bot = opts.bot()
    },
    takeSeat: sitDown,
  }
}
