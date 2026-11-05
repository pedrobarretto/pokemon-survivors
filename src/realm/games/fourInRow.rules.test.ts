import { describe, expect, it } from 'vitest'
import { tableGame } from '../../net/realmTables'
import { COLS, ROWS, botColumn, cellOf, drop, emptyBoard, fourInRowRules as rules, openColumns, parseFour, type Cell, type FourState } from './fourInRow.rules'

/** A state with `seat`'s turn from a picture of the board (`.` empty, `x` seat 0, `o` seat 1), top row first. */
const board = (rows: readonly string[], turn: 0 | 1 = 0): FourState => {
  const cells: Cell[] = emptyBoard()
  rows.forEach((line, i) => {
    const r = ROWS - rows.length + i
    for (let c = 0; c < COLS; c++) cells[cellOf(r, c)] = line[c] === 'x' ? 0 : line[c] === 'o' ? 1 : -1
  })
  const moves = cells.filter((c) => c !== -1).length
  return { board: cells, turn, first: 0, last: null, line: null, winner: null, moves }
}

/** Plays a list of columns from a start where seat 0 drops first. */
const playCols = (cols: readonly number[]) => {
  let s: FourState | null = { ...rules.start(0), turn: 0, first: 0 }
  for (const c of cols) s = s && drop(s, s.turn, c)
  return s
}

describe('Four in a Row rules', () => {
  it('drops a token to the lowest free cell and passes the turn', () => {
    const s = playCols([3, 3])!
    expect(s.board[cellOf(ROWS - 1, 3)]).toBe(0)
    expect(s.board[cellOf(ROWS - 2, 3)]).toBe(1)
    expect(s.turn).toBe(0)
    expect(s.last).toBe(cellOf(ROWS - 2, 3))
  })

  it('refuses a full column, the wrong seat and a move after the end', () => {
    const full = playCols([0, 0, 0, 0, 0, 0])!
    expect(drop(full, full.turn, 0)).toBeNull()
    expect(drop(full, full.turn === 0 ? 1 : 0, 1)).toBeNull()
    const won = playCols([0, 1, 0, 1, 0, 1, 0])!
    expect(won.winner).toBe(0)
    expect(drop(won, won.turn, 3)).toBeNull()
    expect(rules.pending(won)).toEqual([])
  })

  it('finds four across, down and both slants, with the line', () => {
    expect(playCols([0, 0, 1, 1, 2, 2, 3])!.line).toEqual([cellOf(5, 0), cellOf(5, 1), cellOf(5, 2), cellOf(5, 3)])
    expect(playCols([2, 3, 2, 3, 2, 3, 2])!.winner).toBe(0)
    // Up to the right: 0 at (5,0) (4,1) (3,2) (2,3).
    expect(playCols([0, 1, 1, 2, 2, 3, 2, 3, 3, 6, 3])!.winner).toBe(0)
    // Up to the left.
    expect(playCols([6, 5, 5, 4, 4, 3, 4, 3, 3, 0, 3])!.winner).toBe(0)
  })

  it('keeps every cell of a five-long run', () => {
    const s = drop(board(['xx.xx..', 'ooxooo.']), 0, 2)!
    expect(s.winner).toBe(0)
    expect(s.line).toEqual([0, 1, 2, 3, 4].map((c) => cellOf(4, c)))
  })

  it('calls a full board with no four a draw', () => {
    // Columns filled in pairs of a pattern that never lines up four.
    const order = [0, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 2, 3, 2, 3, 2, 3, 3, 2, 3, 2, 3, 2, 4, 5, 4, 5, 4, 5, 5, 4, 5, 4, 5, 4, 6, 6, 6, 6, 6, 6]
    const s = playCols(order)!
    expect(s.moves).toBe(42)
    expect(s.winner).toBeNull()
    expect(rules.result(s)).toEqual({ winner: null, forfeit: null })
  })

  it('seeds who drops first', () => {
    const firsts = new Set(Array.from({ length: 20 }, (_, i) => rules.start(i).first))
    expect(firsts).toEqual(new Set([0, 1]))
  })

  it('reads its own view back and refuses a bad one', () => {
    const s = playCols([3, 4, 3])!
    expect(parseFour(JSON.parse(JSON.stringify(rules.view(s, null))))).toEqual(s)
    expect(parseFour({ ...s, board: s.board.slice(1) })).toBeNull()
    expect(parseFour({ ...s, turn: 2 })).toBeNull()
    expect(rules.parseMove(7)).toBeNull()
    expect(rules.parseMove('3')).toBeNull()
    expect(rules.parseMove(6)).toBe(6)
  })
})

describe('Four in a Row bot', () => {
  it('takes a win', () => {
    expect(botColumn(board(['.......', 'ooo....', 'xxx....'], 0), 0, 1)).toBe(3)
  })

  it('blocks the rival’s four', () => {
    expect(botColumn(board(['.......', '.......', 'ooo.x.x'], 0), 0, 1)).toBe(3)
  })

  it('plays only legal drops, whatever the seed, to the end of a game', () => {
    for (let seed = 0; seed < 6; seed++) {
      const game = tableGame(rules).start(seed)
      for (let n = 0; n < 42 && game.result() === null; n++) {
        const seat = game.pending()[0]!
        expect(game.play(seat, game.bot(seat, seed * 100 + n))).toBe(true)
      }
      expect(game.result()).not.toBeNull()
    }
  })

  it('never picks a full column', () => {
    const s = board(['x.xoxox', 'o.oxoxo', 'x.xoxox', 'o.oxoxo', 'x.xoxox', 'o.oxoxo'], 0)
    expect(openColumns(s.board)).toEqual([1])
    expect(botColumn(s, 0, 5)).toBe(1)
  })
})
