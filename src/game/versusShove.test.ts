import { describe, expect, it } from 'vitest'
import { VERSUS } from '../data/versus'
import { createVersusGame } from './versus'
import { avatarOf, syncAvatars } from './versusCombat'
import { throwFoe } from './moveKit'
import { actAs } from './players'

/** A match with a Blue and a Red Pokémon side by side, their bodies on the field. */
const duel = () => {
  const g = createVersusGame(3, [], 'standard', 'vale')
  const blue = g.players.find((p) => p.versus!.team === 0)!
  const red = g.players.find((p) => p.versus!.team === 1)!
  red.x = blue.x + 20
  red.y = blue.y
  syncAvatars(g)
  return { g, blue, red }
}

describe('throws in a match', () => {
  it('never throw the thrower or a teammate', () => {
    const { g, blue } = duel()
    const mate = g.players.find((p) => p !== blue && p.versus!.team === 0)!
    const at = [blue.x, blue.y, mate.x, mate.y]
    actAs(g, blue)
    throwFoe(g, avatarOf(g, blue)!, 0, 620, 10, 'dragonTail')
    throwFoe(g, avatarOf(g, mate)!, 0, 620, 10, 'dragonTail')
    syncAvatars(g)
    expect([blue.x, blue.y, mate.x, mate.y]).toEqual(at)
  })

  it('shove a rival a few px, not across the map', () => {
    const { g, blue, red } = duel()
    const x = red.x
    actAs(g, blue)
    throwFoe(g, avatarOf(g, red)!, 0, 620, 10, 'dragonTail')
    syncAvatars(g)
    expect(red.x - x).toBeCloseTo(VERSUS.pvp.shoveMax)
    expect(avatarOf(g, red)!.thrown).toBeNull()
  })
})
