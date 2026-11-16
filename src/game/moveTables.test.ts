import { describe, expect, it } from 'vitest'
import { MOVE_TABLES, MOVES } from './moves'

describe('the move tables', () => {
  it('give every id one move: none is in two tables, nor written over in MOVES', () => {
    const lookup: Readonly<Record<string, unknown>> = MOVES
    const overridden = Object.entries(MOVE_TABLES).flatMap(([table, moves]) => Object.entries(moves).flatMap(([id, def]) => (lookup[id] === def ? [] : [`${table}.${id}`])))
    expect(overridden).toEqual([])
  })
})
