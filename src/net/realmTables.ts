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
  seats: number
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

/** A game the tables can host: its seats and how to start a match. */
export type TableGame = { seats: number; start: (seed: number) => TableMatch }

/** Hides a game's types behind `TableMatch`, so the relay and the local table host every game the same way. */
export const tableGame = <S, M, V>(rules: TableRules<S, M, V>): TableGame => ({
  seats: rules.seats,
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
  /** A seat that keeps the match waiting this long forfeits (ms). */
  turnMs: 30_000,
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
 * over, and who's `ready` for another match.
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
