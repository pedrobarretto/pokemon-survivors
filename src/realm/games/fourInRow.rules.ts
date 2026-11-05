import type { TableRules } from '../../net/realmTables'

/**
 * Four in a Row's rules (`MINIGAMES.fourInRow`): a 7 × 6 board standing up,
 * tokens dropped down a column fall to its lowest free cell; four of a seat's
 * in a line (across, down or slanted) win, a full board with none is a draw.
 * Seat 0 drops Poké Balls, seat 1 Great Balls; the seed says who drops first,
 * so a table's rematches don't always start the same way.
 *
 * Pure, and import only `net/realmTables.ts`: the realm relay and the local
 * table both run it. Nothing's hidden, so every seat and spectator sees the
 * same view: the state itself.
 */

export const COLS = 7
export const ROWS = 6

/** A cell: the seat whose token is there, or -1. Row 0 is the top. */
export type Cell = -1 | 0 | 1

/** A finished line: its cells as `row * COLS + col`. */
export type Line = readonly number[]

export type FourState = {
  /** `ROWS * COLS` cells, row by row from the top. */
  board: readonly Cell[]
  /** Whose drop it is (0 or 1). */
  turn: 0 | 1
  /** Who dropped first this match. */
  first: 0 | 1
  /** The last drop (its cell), for the screen's fall and highlight. */
  last: number | null
  /** The winner's line(s), once someone has four (every cell in a run of 4+ through the last drop). */
  line: Line | null
  winner: 0 | 1 | null
  /** Drops so far: 42 with no winner is a draw. */
  moves: number
}

export const cellOf = (row: number, col: number) => row * COLS + col

/** The row a token dropped in `col` lands on, or -1 when the column is full. */
export const landing = (board: readonly Cell[], col: number): number => {
  for (let row = ROWS - 1; row >= 0; row--) if (board[cellOf(row, col)] === -1) return row
  return -1
}

/** The columns a token can still go down. */
export const openColumns = (board: readonly Cell[]): number[] => {
  const out: number[] = []
  for (let c = 0; c < COLS; c++) if (board[c] === -1) out.push(c)
  return out
}

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
] as const

/** Every cell of a run of four or more of `seat` through (`row`, `col`), or null when there's none. */
export const linesThrough = (board: readonly Cell[], row: number, col: number, seat: Cell): Line | null => {
  const cells = new Set<number>()
  for (const [dr, dc] of DIRS) {
    const run = [cellOf(row, col)]
    for (const sign of [1, -1]) {
      let r = row + dr * sign
      let c = col + dc * sign
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && board[cellOf(r, c)] === seat) {
        run.push(cellOf(r, c))
        r += dr * sign
        c += dc * sign
      }
    }
    if (run.length >= 4) for (const x of run) cells.add(x)
  }
  return cells.size > 0 ? [...cells].sort((a, b) => a - b) : null
}

/** Drops `seat`'s token down `col`: the next state, or null when the column is full or the game is over. */
export const drop = (s: FourState, seat: 0 | 1, col: number): FourState | null => {
  if (s.winner !== null || s.moves >= ROWS * COLS || seat !== s.turn) return null
  const row = landing(s.board, col)
  if (row < 0) return null
  const board = s.board.slice()
  const at = cellOf(row, col)
  board[at] = seat
  const line = linesThrough(board, row, col, seat)
  return { board, turn: seat === 0 ? 1 : 0, first: s.first, last: at, line, winner: line ? seat : null, moves: s.moves + 1 }
}

export const emptyBoard = (): Cell[] => Array.from({ length: ROWS * COLS }, () => -1 as const)

/* ---------------- The bot ---------------- */

/** How deep the bot looks (its drops and the rival's answers). */
export const BOT_DEPTH = 4

const WIN = 1_000_000

/** How a window of four cells scores for `me`: open threes and twos count, the rival's threes count against. */
const windowScore = (mine: number, theirs: number) => {
  if (mine > 0 && theirs > 0) return 0
  if (mine === 3) return 6
  if (mine === 2) return 2
  if (theirs === 3) return -8
  if (theirs === 2) return -2
  return 0
}

/** The board's worth for `me` with no four yet: tokens near the middle and every open window of four. */
export const evaluate = (board: readonly Cell[], me: 0 | 1): number => {
  let score = 0
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const v = board[cellOf(r, c)]
      // The middle columns are in the most lines.
      if (v !== -1) score += (v === me ? 1 : -1) * (3 - Math.abs(3 - c))
    }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      for (const [dr, dc] of DIRS) {
        const er = r + dr * 3
        const ec = c + dc * 3
        if (er < 0 || er >= ROWS || ec < 0 || ec >= COLS) continue
        let mine = 0
        let theirs = 0
        for (let k = 0; k < 4; k++) {
          const v = board[cellOf(r + dr * k, c + dc * k)]
          if (v === me) mine++
          else if (v !== -1) theirs++
        }
        score += windowScore(mine, theirs)
      }
  return score
}

/** Columns from the middle out: the order alpha-beta prunes best in. */
const CENTER_OUT = [3, 2, 4, 1, 5, 0, 6] as const

/** Negamax with alpha-beta from `turn`'s side: how good the board is for whoever drops next. */
const search = (board: Cell[], turn: 0 | 1, depth: number, alpha: number, beta: number, moves: number): number => {
  if (moves >= ROWS * COLS) return 0
  if (depth === 0) return evaluate(board, turn)
  let best = -Infinity
  for (const col of CENTER_OUT) {
    const row = landing(board, col)
    if (row < 0) continue
    const at = cellOf(row, col)
    board[at] = turn
    // A quicker win is a better one (and a later loss a lesser one).
    const score = linesThrough(board, row, col, turn) ? WIN + depth : -search(board, turn === 0 ? 1 : 0, depth - 1, -beta, -alpha, moves + 1)
    board[at] = -1
    if (score > best) best = score
    if (best > alpha) alpha = best
    if (alpha >= beta) break
  }
  return best
}

/** A seeded number in [0, 1) from `seed` and `k` (the bot's only randomness). */
const unit = (seed: number, k: number) => {
  let x = Math.imul((seed ^ Math.imul(k + 1, 0x9e3779b9)) >>> 0, 0x85ebca6b)
  x ^= x >>> 15
  x = Math.imul(x, 0xc2b2ae35)
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}

/**
 * The bot's drop for `seat`: the best column at `BOT_DEPTH` (it takes a win
 * and blocks the rival's at once), ties broken by `seed`. Always an open
 * column of a game still on.
 */
export const botColumn = (s: FourState, seat: 0 | 1, seed: number): number => {
  const open = openColumns(s.board)
  if (open.length === 0) return 0
  // An empty board: a seeded pick of the middle three, so games open differently.
  if (s.moves === 0) return 2 + Math.floor(unit(seed, 0) * 3)
  const board = s.board.slice()
  let best = -Infinity
  let picks: number[] = []
  for (const col of open) {
    const row = landing(board, col)
    const at = cellOf(row, col)
    board[at] = seat
    const score = linesThrough(board, row, col, seat) ? WIN * 2 : -search(board, seat === 0 ? 1 : 0, BOT_DEPTH - 1, -Infinity, Infinity, s.moves + 1)
    board[at] = -1
    if (score > best) {
      best = score
      picks = [col]
    } else if (score === best) picks.push(col)
  }
  return picks[Math.floor(unit(seed, 1) * picks.length)] ?? open[0]!
}

/* ---------------- The wire ---------------- */

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

const isSeat = (v: unknown): v is 0 | 1 => v === 0 || v === 1

const isCell = (v: unknown): v is Cell => v === -1 || v === 0 || v === 1

const isIndex = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < ROWS * COLS

/** Reads a state off the wire (a view is the whole state), checking every field. */
export const parseFour = (v: unknown): FourState | null => {
  if (!isRecord(v) || !Array.isArray(v.board) || v.board.length !== ROWS * COLS || !v.board.every(isCell)) return null
  if (!isSeat(v.turn) || !isSeat(v.first) || !(v.winner === null || isSeat(v.winner)) || !(v.last === null || isIndex(v.last))) return null
  if (typeof v.moves !== 'number' || !Number.isInteger(v.moves) || v.moves < 0 || v.moves > ROWS * COLS) return null
  const line = v.line === null ? null : Array.isArray(v.line) && v.line.every(isIndex) ? v.line.filter(isIndex) : undefined
  if (line === undefined) return null
  return { board: v.board.filter(isCell), turn: v.turn, first: v.first, last: v.last, line, winner: v.winner, moves: v.moves }
}

/** Four in a row's rules (`MINIGAMES.fourInRow`): pure, run by the relay and the local table. Import only `net/realmTables.ts`. */
export const fourInRowRules: TableRules<FourState, number, FourState> = {
  seats: 2,
  start: (seed) => {
    const first: 0 | 1 = unit(seed, 7) < 0.5 ? 0 : 1
    return { board: emptyBoard(), turn: first, first, last: null, line: null, winner: null, moves: 0 }
  },
  parseMove: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < COLS ? v : null),
  play: (s, seat, col) => (isSeat(seat) ? drop(s, seat, col) : null),
  pending: (s) => (s.winner !== null || s.moves >= ROWS * COLS ? [] : [s.turn]),
  result: (s) => (s.winner !== null ? { winner: s.winner, forfeit: null } : s.moves >= ROWS * COLS ? { winner: null, forfeit: null } : null),
  view: (s) => s,
  parseView: parseFour,
  bot: (s, seat, seed) => botColumn(s, isSeat(seat) ? seat : 1, seed),
}
