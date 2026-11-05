import { describe, expect, it } from 'vitest'
import { tableGame, type TableRules } from './realmTables'

type Nim = { left: number; turn: number; winner: number | null }

/** Take 1 to 3 from 10 in turns, whoever takes the last wins: the smallest table game. */
const stubRules: TableRules<Nim, number, Nim> = {
  seats: 2,
  start: () => ({ left: 10, turn: 0, winner: null }),
  parseMove: (v) => (v === 1 || v === 2 || v === 3 ? v : null),
  play: (s, seat, m) => (seat !== s.turn || m > s.left ? null : { left: s.left - m, turn: 1 - s.turn, winner: s.left - m === 0 ? seat : null }),
  pending: (s) => (s.winner === null ? [s.turn] : []),
  result: (s) => (s.winner === null ? null : { winner: s.winner, forfeit: null }),
  view: (s) => s,
  parseView: () => null,
  bot: () => 1,
}

describe('tableGame', () => {
  it('plays only the pending seat and refuses what the rules refuse', () => {
    const m = tableGame(stubRules).start(1)
    expect(m.play(1, 1)).toBe(false)
    expect(m.play(0, 9)).toBe(false)
    expect(m.play(0, 3)).toBe(true)
    expect(m.pending()).toEqual([1])
  })

  it('ends on a forfeit for the other seat, and takes no move after', () => {
    const m = tableGame(stubRules).start(1)
    m.forfeit(0)
    expect(m.result()).toEqual({ winner: 1, forfeit: 0 })
    expect(m.pending()).toEqual([])
    expect(m.play(0, 1)).toBe(false)
  })
})
