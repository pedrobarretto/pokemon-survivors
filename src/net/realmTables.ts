/**
 * The Poké Realm's game tables (the `table` mini games, `data/minigames.ts`):
 * the rules interface every table game implements, how a table looks on the
 * wire, and its numbers. Import-free: the realm relay bundles it.
 *
 * A table stands in a room: a town table is a spot with an `id`
 * (`data/realmMap.ts`), a base's is a piece of furniture (`gameSpots` in
 * `ui/realm.ts`, id `f<x>-<y>` from its tile). The first trainer to `sit`
 * picks the game; when the seats fill the relay starts a match with the
 * game's rules (`start`), takes each seat's `play` through them (refusing
 * what they refuse), and sends everyone in the room the table as each one
 * may see it (`view`: a seat sees its own hand, a spectator neither). A seat
 * that keeps the table waiting past `TABLE.turnMs` forfeits. At the end the
 * seats `ready` for another match, or `stand`.
 *
 * An open table (`TableRules.open`: Ludo, Unown) seats 2 to `seats` people:
 * a match starts once every seat is taken, or once two or more sit and all of
 * them are `ready`, and the rules' bot plays every seat nobody holds (a null
 * seat in a match is the bot's). Nobody forfeits there: a seat that stands
 * or drops mid-match goes to the bot, someone sitting down mid-match takes a
 * bot's seat over, and a seat awaited past `open.turnMs` gets the bot's move
 * (twice running, and the relay stands it up).
 *
 * The rules are pure: no clock, no randomness but the `seed` they're given,
 * the same on the relay and on a device playing the bot
 * (`realm/games/localTable.ts`).
 */

/** How a match ended: the winning seat (null: a draw), and the seat that forfeited, if one did. */
export type TableResult = { winner: number | null; forfeit: number | null }

/**
 * A table game's rules over its state `S`, a move `M` and what a seat (or a
 * spectator, `null`) sees, `V`. `play` returns the next state (it may reuse
 * the one given) or null for a move the rules refuse (not that seat's turn,
 * an illegal move). `pending`: the seats whose move is awaited now (both,
 * in a game played at once); empty once it's over. `parseMove` and
 * `parseView` read the wire, never trusting it.
 */
export type TableRules<S, M, V> = {
  /** Seats at the table (a 2-seat game plays both; an open one plays all of them, bots in the empty ones). */
  seats: number
  /** An open table's numbers: the turn clock and how long its bot thinks (ms). Absent: a 2-seat table, every seat a person's. */
  open?: OpenTable
  start: (seed: number) => S
  parseMove: (v: unknown) => M | null
  play: (s: S, seat: number, m: M) => S | null
  pending: (s: S) => readonly number[]
  result: (s: S) => TableResult | null
  view: (s: S, seat: number | null) => V
  parseView: (v: unknown) => V | null
  /** A move the bot would make for `seat` now (it must pass `play`); `seed` for its choices. */
  bot: (s: S, seat: number, seed: number) => M
}

/** A match in progress, its state held in closures: what the relay and the local table drive, whatever the game. */
export type TableMatch = {
  /** Parses and plays a seat's move; false when refused (nothing changes). */
  play: (seat: number, move: unknown) => boolean
  pending: () => readonly number[]
  /** The match's end, once it's over (a forfeit ends it at once). */
  result: () => TableResult | null
  forfeit: (seat: number) => void
  view: (seat: number | null) => unknown
  /** The bot's move for `seat` (already a valid wire move). */
  bot: (seat: number, seed: number) => unknown
}

/** An open table's numbers (`TableRules.open`): a seat's turn clock, and the bot's think before each move (ms). */
export type OpenTable = { turnMs: number; botMs: number }

/** A game the tables can host: its seats, whether it's open (null: every seat a person's), and how to start a match. */
export type TableGame = { seats: number; open: OpenTable | null; start: (seed: number) => TableMatch }

/** How long a seat of `game` may keep its match waiting (ms). */
export const turnMsOf = (game: TableGame) => game.open?.turnMs ?? TABLE.turnMs

/** Hides a game's types behind `TableMatch`, so the relay and the local table host every game the same way. */
export const tableGame = <S, M, V>(rules: TableRules<S, M, V>): TableGame => ({
  seats: rules.seats,
  open: rules.open ?? null,
  start: (seed) => {
    let s = rules.start(seed)
    let forfeited: number | null = null
    const result = (): TableResult | null => (forfeited !== null ? { winner: rules.seats === 2 ? 1 - forfeited : null, forfeit: forfeited } : rules.result(s))
    return {
      play: (seat, raw) => {
        if (result() !== null || !rules.pending(s).includes(seat)) return false
        const m = rules.parseMove(raw)
        const next = m === null ? null : rules.play(s, seat, m)
        if (next === null) return false
        s = next
        return true
      },
      pending: () => (result() !== null ? [] : rules.pending(s)),
      result,
      forfeit: (seat) => {
        if (result() === null) forfeited = seat
      },
      view: (seat) => rules.view(s, seat),
      bot: (seat, seed) => rules.bot(s, seat, seed),
    }
  },
})

/** The tables' numbers. */
export const TABLE = {
  /** A seat that keeps the match waiting this long forfeits (ms); an open table's is its own (`OpenTable.turnMs`). */
  turnMs: 30_000,
  /** An open table's seat whose clock runs out this many turns running is stood up (the bot keeps playing it). */
  idleStand: 2,
  /** People an open table needs to start before every seat is taken. */
  openMin: 2,
  /** A table's id on the wire: a town spot's `id` or a base piece's `f<x>-<y>`. */
  idMax: 16,
} as const

export const isTableId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9-]{1,16}$/.test(v)

/** A base's table id from its furniture's tile. */
export const baseTableId = (x: number, y: number) => `f${x}-${y}`

/**
 * A table as one trainer sees it (`table`/`tables` messages): the game, the
 * seats (avatar ids, null when free), where the match is, the game's view for
 * this trainer (`TableRules.view`; the client reads it with `parseView`), the
 * seats awaited and how long the first of them has left (ms), the result once
 * over, and who's `ready` for another match (at an open table, also for the
 * first). At an open table a null seat during a match is the bot's.
 */
export type TableView = {
  id: string
  game: string
  seats: readonly (number | null)[]
  phase: 'waiting' | 'playing' | 'over'
  view: unknown
  pending: readonly number[]
  leftMs: number | null
  result: TableResult | null
  ready: readonly number[]
}
