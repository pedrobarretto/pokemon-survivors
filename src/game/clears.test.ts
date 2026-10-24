import { describe, expect, it } from 'vitest'
import type { StarterId } from '../data/starters'
import type { PokeType } from '../data/types'
import { NO_LIFETIME } from './achievements'
import { addClear, mergeClears, pastClears, wonClears } from './clears'
import { EMPTY_SAVE, parseSave } from './meta'
import { mergeSaves } from './sync'

describe('clears', () => {
  it('records a win at the hardest difficulty it reached, and ignores runs that lost', () => {
    const won = addClear({}, { starter: 'gible', difficulty: 'hard', victory: true })
    expect(won).toEqual({ gible: 'hard' })
    expect(addClear(won, { starter: 'gible', difficulty: 'normal', victory: true })).toEqual({ gible: 'hard' })
    expect(addClear(won, { starter: 'gible', difficulty: 'nightmare', victory: true })).toEqual({ gible: 'nightmare' })
    expect(addClear(won, { starter: 'eevee', difficulty: 'nightmare', victory: false })).toBe(won)
  })

  it('merges as a union at the harder difficulty, in either order', () => {
    const a = { gible: 'hard', eevee: 'normal' } as const
    const b = { gible: 'normal', eevee: 'nightmare', squirtle: 'normal' } as const
    const want = { gible: 'hard', eevee: 'nightmare', squirtle: 'normal' }
    expect(mergeClears(a, b)).toEqual(want)
    expect(mergeClears(b, a)).toEqual(want)
    expect(mergeSaves({ ...EMPTY_SAVE, clears: a }, { ...EMPTY_SAVE, clears: b }).clears).toEqual(want)
  })

  it('backfills only the starters an older save proves won', () => {
    const past = (winGens: number[], winTypes: PokeType[], starters: StarterId[]) => pastClears({ ...NO_LIFETIME, winGens, winTypes, starters })
    const kanto: StarterId[] = ['bulbasaur', 'charmander', 'squirtle']
    expect(past([1], ['fire', 'water'], kanto)).toEqual({ charmander: 'normal', squirtle: 'normal' })
    expect(past([1, 4], ['grass'], ['bulbasaur', 'turtwig', 'chimchar'])).toEqual({ bulbasaur: 'normal', turtwig: 'normal' })
    // Sprigatito was never played, so Paldea's winner can only be Fuecoco, and the grass winner Bulbasaur.
    expect(past([1, 9], ['grass', 'fire'], ['bulbasaur', 'charmander', 'fuecoco', 'quaxly'])).toEqual({ bulbasaur: 'normal', fuecoco: 'normal' })
    // Two regions and two types, every pair played: it could be either pair.
    expect(past([1, 2], ['fire', 'water'], [...kanto, 'cyndaquil', 'totodile'])).toEqual({})
  })

  it('adds the proven clears to the saved ones, and drops unknown entries', () => {
    const achievements = { unlocked: [], lifetime: { ...NO_LIFETIME, wins: 2, winGens: [3], winTypes: ['water'], starters: ['mudkip', 'torchic'] } }
    expect(parseSave(JSON.stringify({ version: 1, achievements })).clears).toEqual({ mudkip: 'normal' })
    const clears = { beldum: 'hard', mudkip: 'hard', nope: 'hard', eevee: 'easy' }
    expect(parseSave(JSON.stringify({ version: 1, achievements, clears })).clears).toEqual({ beldum: 'hard', mudkip: 'hard' })
  })

  it('keeps a legend clear (Legend mode) through a reload, a merge and the won runs the API reads', () => {
    const clears = addClear({}, { starter: 'kyogre', difficulty: 'hard', victory: true })
    expect(parseSave(JSON.stringify({ ...EMPTY_SAVE, clears })).clears).toEqual({ kyogre: 'hard' })
    expect(mergeClears({ gible: 'normal' }, clears)).toEqual({ gible: 'normal', kyogre: 'hard' })
    expect(wonClears([{ starter: 'lugia', difficulty: 'normal' }])).toEqual({ lugia: 'normal' })
  })

  it('reads clears from won runs at the hardest difficulty, skipping unknown rows', () => {
    const runs = [
      { starter: 'fuecoco', difficulty: 'normal' },
      { starter: 'fuecoco', difficulty: 'hard' },
      { starter: 'beldum', difficulty: 'nightmare' },
      { starter: 'missingno', difficulty: 'hard' },
      { starter: 'gible', difficulty: 'easy' },
    ]
    expect(wonClears(runs)).toEqual({ fuecoco: 'hard', beldum: 'nightmare' })
  })
})
