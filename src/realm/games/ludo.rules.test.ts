import { describe, expect, it } from 'vitest'
import { tableGame } from '../../net/realmTables'
import { GOAL, LANE, LUDO, YARD, isSafe, ludoRules as R, move, roll, startLudo, target, type LudoState } from './ludo.rules'

/** A state with the given pieces, `seat` to move `r` (the roll already made). */
const at = (pieces: number[][], seat: number, r: number | null = null): LudoState => ({ ...startLudo(1), pieces, turn: seat, phase: r === null ? 'roll' : 'move', roll: r })

const yards = () => Array.from({ length: LUDO.seats }, () => [YARD, YARD])

/** Plays a whole match bot against bot; returns it and how many turns each seat took. */
const botMatch = (seed: number) => {
  let s = R.start(seed)
  let turns = 0
  let last = s.turn
  while (s.winner === null) {
    s = R.play(s, s.turn, R.bot(s, s.turn, seed + s.moves))!
    if (s.turn !== last) (turns++, (last = s.turn))
  }
  return { s, turns: turns / LUDO.seats }
}

describe('ludo', () => {
  it('needs a 6 to leave the yard, and moves round, into the lane, past the goal’s count', () => {
    expect(target(YARD, 5)).toBeNull()
    expect(target(YARD, 6)).toBe(0)
    expect(target(37, 4)).toBe(41)
    expect(target(42, 6)).toBe(GOAL)
    expect(target(GOAL, 1)).toBeNull()
  })

  it('sends a rival home on a plain square, never on a start square', () => {
    const p = yards()
    p[0] = [8, YARD]
    p[1] = [0, YARD] // seat 1's start: square 10, safe
    p[2] = [33, YARD] // square (20 + 33) % 40 = 13
    expect(isSafe(10)).toBe(true)
    const safe = move(at(p, 0, 2), 0, 0)!
    expect(safe.pieces[1]![0]).toBe(0)
    const hit = move(at(p, 0, 5), 0, 0)!
    expect(hit.pieces[2]![0]).toBe(YARD)
    expect(hit.lost[2]).toBe(1)
    expect(hit.events.at(-1)).toMatchObject({ k: 'move', sent: [{ seat: 2, piece: 0, from: 33 }] })
  })

  it('rolls again after a 6, and passes on after anything else', () => {
    const p = yards()
    p[0] = [3, YARD]
    expect(move(at(p, 0, 6), 0, 0)).toMatchObject({ turn: 0, phase: 'roll' })
    expect(move(at(p, 0, 4), 0, 0)).toMatchObject({ turn: 1, phase: 'roll' })
  })

  it('gives three tries for a 6 with nothing out, then passes', () => {
    let s = at(yards(), 2)
    const seen: number[] = []
    for (let i = 0; i < 40 && s.turn === 2; i++) {
      s = roll(s, 2)!
      seen.push(s.events.at(-1)!.k === 'roll' ? 1 : 0)
      if (s.phase === 'move') break
    }
    // Either a 6 came (and it waits for the move) within three rolls, or the turn passed after the third.
    expect(seen.length).toBeLessThanOrEqual(LUDO.tries)
    expect(s.phase === 'move' || s.turn === 3).toBe(true)
  })

  it('refuses moves out of turn or out of phase', () => {
    const s = at(yards(), 0)
    expect(roll(s, 1)).toBeNull()
    expect(move(s, 0, 0)).toBeNull()
    expect(R.parseMove('roll')).toBe('roll')
    expect(R.parseMove(2)).toBeNull()
  })

  it('wins with both pieces home', () => {
    const p = yards()
    p[3] = [GOAL, LANE + 2]
    expect(move(at(p, 3, 3), 3, 1)).toMatchObject({ winner: 3 })
  })

  it('keeps the dice out of every view, and reads its own views back', () => {
    const s = R.start(9)
    const v = R.view(s, 0)
    expect('rng' in (v as object)).toBe(false)
    expect(R.parseView(JSON.parse(JSON.stringify(R.view(roll(s, s.turn)!, null))))).not.toBeNull()
    expect(R.parseView({ ...v, pieces: [[0, 0]] })).toBeNull()
  })

  it('plays out bot against bot in a café table’s length, every seat winning sometimes', () => {
    const wins = [0, 0, 0, 0]
    let turns = 0
    for (let seed = 1; seed <= 60; seed++) {
      const m = botMatch(seed)
      wins[m.s.winner!]!++
      turns += m.turns
    }
    // About 20–30 turns a seat: with 4 seats and ~3 s a turn, 5 to 8 minutes.
    expect(turns / 60).toBeGreaterThan(15)
    expect(turns / 60).toBeLessThan(35)
    for (const w of wins) expect(w).toBeGreaterThan(0)
  })

  it('runs as a table game, its bot seats driving a match to the end', () => {
    const m = tableGame(R).start(5)
    for (let i = 0; i < 2000 && !m.result(); i++) {
      const seat = m.pending()[0]!
      expect(m.play(seat, m.bot(seat, i))).toBe(true)
    }
    expect(m.result()).toMatchObject({ forfeit: null })
  })
})
