import type { TableRules } from '../../net/realmTables'

/**
 * Ludo's rules (`MINIGAMES.ludo`), cut to a café table's length (5 to 8
 * minutes with four people): the classic race on an 11 × 11 cross, 40
 * squares round, a 4-square lane home, but **2 pieces a team** instead of 4
 * and no exact roll into the goal, so a match ends in about 25 turns a seat
 * rather than 60.
 *
 * - On your turn, roll. A 6 brings a piece out of the yard onto your start
 *   square, and rolls again after its move.
 * - With nothing out on the board, you get 3 rolls to throw that 6.
 * - Move one piece the roll's squares, clockwise. Landing on a rival's piece
 *   sends it home to its yard, unless it stands on a start square (the four
 *   start squares are safe). Your own pieces may share a square.
 * - After a lap a piece turns into its lane; a roll past the goal still gets
 *   it there. Both pieces home wins.
 *
 * Seats go clockwise from the bottom (0: Poké Ball, 1: Great Ball, 2: Ultra
 * Ball, 3: Safari Ball); the seed says who rolls first. Pure, and imports
 * only `net/realmTables.ts`: the relay and the local table both run it. The
 * dice come from the state's own seeded generator, which the view leaves
 * out (no seat can read its next rolls).
 */

export const LUDO = {
  seats: 4,
  pieces: 2,
  /** Squares round the board. */
  track: 40,
  /** A seat's start square is `seat * spacing` squares round from seat 0's. */
  spacing: 10,
  /** Squares of a lane before the goal. */
  lane: 4,
  /** Rolls to throw a 6 while nothing is out. */
  tries: 3,
  /** A match past this many moves ends with whoever is furthest ahead (a guard; play never gets near). */
  maxMoves: 1200,
} as const

/** A piece's place: -1 in the yard, 0..39 squares travelled from its start, 40..43 its lane, 44 the goal. */
export const YARD = -1
export const LANE = LUDO.track
export const GOAL = LUDO.track + LUDO.lane

/** What just happened, for the screen to play out: a roll (and whether it moved nothing), a move and whom it sent home. */
export type LudoEvent =
  | { n: number; k: 'roll'; seat: number; roll: number; stuck: boolean }
  | { n: number; k: 'move'; seat: number; piece: number; from: number; to: number; sent: readonly { seat: number; piece: number; from: number }[] }

export type LudoState = {
  /** `pieces[seat][piece]`: each piece's place (`YARD`, a step count, `GOAL`). */
  pieces: readonly (readonly number[])[]
  turn: number
  /** Whether the seat on turn rolls now, or picks a piece to move `roll`. */
  phase: 'roll' | 'move'
  roll: number | null
  /** Rolls this turn while nothing was out (`LUDO.tries`). */
  tries: number
  winner: number | null
  /** Moves made so far (the guard, and the events' numbers). */
  moves: number
  /** The latest events, oldest first (a few, so a screen a beat behind catches up). */
  events: readonly LudoEvent[]
  /** Every piece each seat lost to a capture this match (the `untouchable` feat). */
  lost: readonly number[]
  /** The dice's generator state. Never in a view. */
  rng: number
}

/** A seat's view: the state without the dice's generator. */
export type LudoView = Omit<LudoState, 'rng'>

/** A move: roll the die, or move one of your pieces (its index). */
export type LudoMove = 'roll' | number

const EVENTS_KEPT = 6

/* ---------------- Dice ---------------- */

/** Mulberry32: the next generator state and a number in [0, 1). */
const next = (rng: number): [number, number] => {
  const s = (rng + 0x6d2b79f5) >>> 0
  let x = Math.imul(s ^ (s >>> 15), s | 1)
  x ^= x + Math.imul(x ^ (x >>> 7), x | 61)
  return [s, ((x ^ (x >>> 14)) >>> 0) / 4294967296]
}

/* ---------------- The board ---------------- */

/** The square round the board (0..39, seat 0's start at 0) a piece of `seat` at step `p` stands on, or null off the track. */
export const squareOf = (seat: number, p: number): number | null => (p >= 0 && p < LANE ? (seat * LUDO.spacing + p) % LUDO.track : null)

/** Whether a square of the track is safe (a start square). */
export const isSafe = (square: number) => square % LUDO.spacing === 0

const isOut = (p: number) => p >= 0 && p < GOAL

/** The place a piece at `p` reaches with `roll`, or null when it can't move (in the yard without a 6, or home). */
export const target = (p: number, roll: number): number | null => {
  if (p === GOAL) return null
  if (p === YARD) return roll === 6 ? 0 : null
  return Math.min(GOAL, p + roll)
}

/** The pieces `seat` may move with `roll`. */
export const legalPieces = (s: LudoView, seat: number, roll: number): number[] =>
  (s.pieces[seat] ?? []).flatMap((p, i) => (target(p, roll) === null ? [] : [i]))

/** The rival pieces a piece of `seat` landing on step `to` sends home. */
const victims = (s: LudoView, seat: number, to: number) => {
  const sq = squareOf(seat, to)
  if (sq === null || isSafe(sq)) return []
  return s.pieces.flatMap((row, other) => (other === seat ? [] : row.flatMap((p, piece) => (squareOf(other, p) === sq ? [{ seat: other, piece, from: p }] : []))))
}

const seatsOf = (s: LudoView) => s.pieces.length

/** An event without its number (`push` numbers it). */
type Unnumbered = LudoEvent extends infer E ? (E extends LudoEvent ? Omit<E, 'n'> : never) : never

const push = (s: LudoState, e: Unnumbered): LudoEvent[] => [...s.events, { ...e, n: s.moves }].slice(-EVENTS_KEPT)

/** Hands the turn to the next seat clockwise. */
const pass = (s: LudoState, rng: number, events: readonly LudoEvent[]): LudoState => ({ ...s, rng, events, turn: (s.turn + 1) % seatsOf(s), phase: 'roll', roll: null, tries: 0, moves: s.moves + 1 })

/** The seat furthest ahead (the guard's winner): most pieces home, then most steps. */
const leader = (s: LudoView) => {
  const worth = (row: readonly number[]) => row.reduce((sum, p) => sum + (p === GOAL ? 1000 : Math.max(0, p + 1)), 0)
  let best = 0
  s.pieces.forEach((row, seat) => {
    if (worth(row) > worth(s.pieces[best]!)) best = seat
  })
  return best
}

/** Rolls for the seat on turn: on to its pick, or (with nothing to move) on to its next try or the next seat. */
export const roll = (s: LudoState, seat: number): LudoState | null => {
  if (s.winner !== null || seat !== s.turn || s.phase !== 'roll') return null
  const [rng, u] = next(s.rng)
  const r = 1 + Math.floor(u * 6)
  const movable = legalPieces(s, seat, r)
  const events = push(s, { k: 'roll', seat, roll: r, stuck: movable.length === 0 })
  if (movable.length > 0) return { ...s, rng, events, phase: 'move', roll: r, moves: s.moves + 1 }
  const nothingOut = !s.pieces[seat]!.some(isOut)
  const capped = s.moves + 1 >= LUDO.maxMoves
  if (capped) return { ...s, rng, events, winner: leader(s), roll: r, moves: s.moves + 1 }
  if (nothingOut && s.tries + 1 < LUDO.tries) return { ...s, rng, events, roll: r, tries: s.tries + 1, moves: s.moves + 1 }
  return pass(s, rng, events)
}

/** Moves `piece` of the seat on turn by the roll: captures, the goal, and a 6's extra roll. */
export const move = (s: LudoState, seat: number, piece: number): LudoState | null => {
  if (s.winner !== null || seat !== s.turn || s.phase !== 'move' || s.roll === null) return null
  const from = s.pieces[seat]?.[piece]
  if (from === undefined) return null
  const to = target(from, s.roll)
  if (to === null) return null
  const sent = victims(s, seat, to)
  const pieces = s.pieces.map((row, i) =>
    row.map((p, j) => (i === seat && j === piece ? to : sent.some((v) => v.seat === i && v.piece === j) ? YARD : p)),
  )
  const lost = s.lost.map((n, i) => n + sent.filter((v) => v.seat === i).length)
  const events = push(s, { k: 'move', seat, piece, from, to, sent })
  const won = pieces[seat]!.every((p) => p === GOAL)
  const after: LudoState = { ...s, pieces, lost, events }
  if (won) return { ...after, winner: seat, roll: null, moves: s.moves + 1 }
  if (s.moves + 1 >= LUDO.maxMoves) return { ...after, winner: leader(after), roll: null, moves: s.moves + 1 }
  // A 6 rolls again.
  if (s.roll === 6) return { ...after, phase: 'roll', roll: null, tries: 0, moves: s.moves + 1 }
  return pass(after, s.rng, events)
}

/* ---------------- The bot ---------------- */

/** How many rival pieces stand 1 to 6 squares behind `square` on the track (each could land on it with one roll). */
const threats = (s: LudoView, seat: number, square: number) => {
  if (isSafe(square)) return 0
  let n = 0
  s.pieces.forEach((row, other) => {
    if (other === seat) return
    for (const p of row) {
      const sq = squareOf(other, p)
      if (sq === null) continue
      const gap = (square - sq + LUDO.track) % LUDO.track
      // A rival can't reach past its own lane's turn: count it only if the square is still on its lap.
      if (gap >= 1 && gap <= 6 && p + gap < LANE) n++
    }
  })
  return n
}

/** How good moving `piece` with `roll` looks for `seat`: captures first, then home, out of the yard, out of reach. */
export const scoreMove = (s: LudoView, seat: number, piece: number, roll: number): number => {
  const from = s.pieces[seat]![piece]!
  const to = target(from, roll)
  if (to === null) return -Infinity
  let score = to - Math.max(0, from)
  const hit = victims(s, seat, to)
  score += hit.reduce((sum, v) => sum + 60 + v.from, 0)
  if (to === GOAL) score += 45
  else if (to >= LANE && from < LANE) score += 28
  if (from === YARD) score += 40
  const fromSq = squareOf(seat, from)
  const toSq = squareOf(seat, to)
  if (fromSq !== null) score += threats(s, seat, fromSq) * (14 + from / 4)
  if (toSq !== null) score -= threats(s, seat, toSq) * (16 + to / 4)
  if (toSq !== null && isSafe(toSq)) score += 6
  return score
}

/** A seeded number in [0, 1) from `seed` and `k`. */
const unit = (seed: number, k: number) => next((seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0)[1]

/** The bot's move for `seat`: it rolls, then moves the piece that scores best (ties by `seed`). */
export const botMove = (s: LudoView, seat: number, seed: number): LudoMove => {
  if (s.phase === 'roll' || s.roll === null) return 'roll'
  const legal = legalPieces(s, seat, s.roll)
  let best = -Infinity
  let picks: number[] = []
  for (const piece of legal) {
    const score = scoreMove(s, seat, piece, s.roll) + unit(seed, piece) * 2
    if (score > best) (best = score), (picks = [piece])
    else if (score === best) picks.push(piece)
  }
  return picks[0] ?? 0
}

/* ---------------- The wire ---------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isInt = (v: unknown, lo: number, hi: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
const isSeat = (v: unknown): v is number => isInt(v, 0, LUDO.seats - 1)
const isPlace = (v: unknown): v is number => isInt(v, YARD, GOAL)

const parseEvent = (v: unknown): LudoEvent | null => {
  if (!isRecord(v) || !isInt(v.n, 0, LUDO.maxMoves) || !isSeat(v.seat)) return null
  if (v.k === 'roll') return isInt(v.roll, 1, 6) && typeof v.stuck === 'boolean' ? { n: v.n, k: 'roll', seat: v.seat, roll: v.roll, stuck: v.stuck } : null
  if (v.k !== 'move' || !isInt(v.piece, 0, LUDO.pieces - 1) || !isPlace(v.from) || !isPlace(v.to) || !Array.isArray(v.sent)) return null
  const sent = v.sent.flatMap((x) => (isRecord(x) && isSeat(x.seat) && isInt(x.piece, 0, LUDO.pieces - 1) && isPlace(x.from) ? [{ seat: x.seat, piece: x.piece, from: x.from }] : []))
  return sent.length === v.sent.length ? { n: v.n, k: 'move', seat: v.seat, piece: v.piece, from: v.from, to: v.to, sent } : null
}

/** Reads a view off the wire, checking every field. */
export const parseLudo = (v: unknown): LudoView | null => {
  if (!isRecord(v) || !Array.isArray(v.pieces) || v.pieces.length !== LUDO.seats) return null
  const pieces = v.pieces.flatMap((row) => (Array.isArray(row) && row.length === LUDO.pieces && row.every(isPlace) ? [row.filter(isPlace)] : []))
  if (pieces.length !== LUDO.seats || !isSeat(v.turn) || (v.phase !== 'roll' && v.phase !== 'move')) return null
  if (!(v.roll === null || isInt(v.roll, 1, 6)) || !isInt(v.tries, 0, LUDO.tries) || !(v.winner === null || isSeat(v.winner)) || !isInt(v.moves, 0, LUDO.maxMoves)) return null
  if (!Array.isArray(v.events) || !Array.isArray(v.lost) || v.lost.length !== LUDO.seats || !v.lost.every((n) => isInt(n, 0, 99))) return null
  const events = v.events.map(parseEvent)
  if (events.some((e) => e === null)) return null
  return { pieces, turn: v.turn, phase: v.phase, roll: v.roll, tries: v.tries, winner: v.winner, moves: v.moves, events: events.filter((e): e is LudoEvent => e !== null), lost: v.lost.filter((n): n is number => typeof n === 'number') }
}

/** The start of a match: every piece in its yard, a seeded seat to roll first. */
export const startLudo = (seed: number): LudoState => {
  const [rng, u] = next(seed >>> 0)
  return {
    pieces: Array.from({ length: LUDO.seats }, () => Array.from({ length: LUDO.pieces }, () => YARD)),
    turn: Math.floor(u * LUDO.seats),
    phase: 'roll',
    roll: null,
    tries: 0,
    winner: null,
    moves: 0,
    events: [],
    lost: Array.from({ length: LUDO.seats }, () => 0),
    rng,
  }
}

/** Ludo's rules (`MINIGAMES.ludo`): an open table of 4, pure, run by the relay and the local table. Import only `net/realmTables.ts`. */
export const ludoRules: TableRules<LudoState, LudoMove, LudoView> = {
  seats: LUDO.seats,
  open: { turnMs: 15_000, botMs: 900 },
  start: startLudo,
  parseMove: (v) => (v === 'roll' ? 'roll' : isInt(v, 0, LUDO.pieces - 1) ? v : null),
  play: (s, seat, m) => (m === 'roll' ? roll(s, seat) : move(s, seat, m)),
  pending: (s) => (s.winner !== null ? [] : [s.turn]),
  result: (s) => (s.winner !== null ? { winner: s.winner, forfeit: null } : null),
  view: ({ rng: _, ...view }) => view,
  parseView: parseLudo,
  bot: (s, seat, seed) => botMove(s, seat, seed),
}
