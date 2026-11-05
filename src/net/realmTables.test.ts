import { describe, expect, it } from 'vitest'
import { stubRules } from '../realm/games/stubs'
import { tableGame } from './realmTables'

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
