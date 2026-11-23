import { describe, expect, it } from 'vitest'
import { GOAL, LANE, LUDO } from './ludo.rules'
import { CENTER, TRACK, cellAt, rotate, yardOf } from './ludoBoard'

const near = (a: readonly number[], b: readonly number[]) => Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) === 1

describe('the Ludo board', () => {
  it('runs 40 different squares round, each next to the one before', () => {
    expect(TRACK).toHaveLength(LUDO.track)
    expect(new Set(TRACK.map(([c, r]) => `${c},${r}`)).size).toBe(LUDO.track)
    TRACK.forEach((cell, i) => expect(near(cell, TRACK[(i + 1) % TRACK.length]!), `square ${i}`).toBe(true))
  })

  it('puts each seat’s start a quarter turn from the last, and its lane after its last square into the middle', () => {
    for (let seat = 0; seat < LUDO.seats; seat++) {
      expect(cellAt(seat, 0)).toEqual(rotate(TRACK[0]!, seat))
      expect(near(cellAt(seat, LANE - 1)!, cellAt(seat, LANE)!)).toBe(true)
      expect(near(cellAt(seat, GOAL - 1)!, CENTER)).toBe(true)
    }
  })

  it('keeps the yards off the track', () => {
    for (let turns = 0; turns < 4; turns++) {
      const [c0, r0] = yardOf(turns)
      for (let c = c0; c < c0 + 4; c++) for (let r = r0; r < r0 + 4; r++) expect(TRACK.some(([x, y]) => x === c && y === r)).toBe(false)
    }
  })
})
