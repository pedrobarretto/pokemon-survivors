import { describe, expect, it } from 'vitest'
import { NO_RANKS } from '../game/meta'
import type { RunStart } from '../net/protocol'
import { loadoutOf, parseLoadout, runLoadouts } from './start'

describe('the Arena look in a loadout', () => {
  it('rides the wire, drops a malformed one and never reaches the run', () => {
    const pick = { starter: 'charmander', ranks: NO_RANKS, shiny: false, team: 1, look: { head: 'strawHat' } } as const
    expect(parseLoadout(loadoutOf(pick))).toEqual(pick)
    expect(parseLoadout({ ...loadoutOf(pick), look: { head: 42 } })).not.toHaveProperty('look')
    expect(loadoutOf({ ...pick, look: {} })).not.toHaveProperty('look')
    const start: RunStart = { id: 1, seed: 7, build: 'b1', settings: { difficulty: 'normal' }, players: [{ seat: 0, name: 'Ash', account: true, loadout: loadoutOf(pick) }] }
    expect(runLoadouts(start)).toEqual([{ starter: 'charmander', ranks: NO_RANKS, shiny: false, name: 'Ash' }])
  })
})
