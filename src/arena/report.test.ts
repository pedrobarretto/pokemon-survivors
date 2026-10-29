import { describe, expect, it } from 'vitest'
import { createVersusGame } from '../game/versus'
import { parseHeldVersus, versusReport } from './report'

describe('versusReport', () => {
  it('reports a match left mid-way as it stood, and an ended one as its end whatever the leave', () => {
    const g = createVersusGame(3, [])
    g.time = 185.7
    g.versus!.score = [12, 30]
    const left = versusReport(g, 0, 'casual', false, 'quit')!
    expect(left).toMatchObject({ outcome: 'quit', second: 185, winner: null, result: null, team: 'blue', blue: 12, red: 30 })
    g.versus!.result = { winner: 1, surrender: null }
    expect(versusReport(g, 0, 'casual', false, 'left')).toMatchObject({ outcome: 'end', winner: 'red', result: 'loss' })
    expect(versusReport(g, 99, 'casual', false, 'quit')).toBeNull()
  })

  it('says the format and, when one did, which team surrendered (still an `end`)', () => {
    const g = createVersusGame(3, [], 'quick')
    expect(versusReport(g, 0, 'casual', false, 'quit')).toMatchObject({ format: 'quick', surrender: null })
    g.versus!.result = { winner: 1, surrender: 0 }
    expect(versusReport(g, 0, 'casual', false, 'left')).toMatchObject({ outcome: 'end', winner: 'red', result: 'loss', surrender: 'blue', format: 'quick' })
  })
})

describe('parseHeldVersus', () => {
  it('reads back only a held match', () => {
    const g = createVersusGame(3, [])
    const data = versusReport(g, 0, 'ranked', false, 'gone')!
    const held = { at: 1_700_000_000_000, data }
    expect(parseHeldVersus(JSON.parse(JSON.stringify(held)))).toEqual(held)
    expect(parseHeldVersus({ at: 1, data: { ...data, outcome: 'end' } })).toBeNull()
    expect(parseHeldVersus('junk')).toBeNull()
  })
})
