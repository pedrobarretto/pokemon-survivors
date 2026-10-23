import { describe, expect, it } from 'vitest'
import { gameLookup } from './gameKnowledge'

describe('gameLookup', () => {
  it('finds a family by any stage’s name, with how to get it', () => {
    const facts = gameLookup('Charizard').join('\n')
    expect(facts).toContain('Playable: Charmander (id charmander), a starter')
    expect(facts).toContain('Signature move: Ember')
  })

  it('finds a move with its evolution, whatever the spacing and case', () => {
    expect(gameLookup('fire spin').join('\n')).toContain('Evolves into Fire Blast when maxed and holding Charcoal')
  })

  it('finds nothing for a name the game lacks', () => {
    expect(gameLookup('zzzz')).toEqual([])
  })
})
