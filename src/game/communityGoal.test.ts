import { afterEach, describe, expect, it } from 'vitest'
import { HALLOWEEN } from '../data/halloween'
import { AWAKEN_AT, LEGEND_IDS, LEGENDS, type LegendDef } from '../data/legends'
import { candyGoalAt, parseCandyGoal, setCommunityOpen, sheetsLocked } from './communityGoal'
import { advancePhase, chooseOffer, createGame, EVOLUTION_TIME, step } from './game'
import { playerForm } from './branch'
import { xpFor } from './leveling'

const { goal } = HALLOWEEN.community

afterEach(() => setCommunityOpen(false))

describe('community goal', () => {
  it('is reached at the goal, and trusts only the candies the API counted', () => {
    expect(candyGoalAt(goal - 1).reached).toBe(false)
    expect(candyGoalAt(goal).reached).toBe(true)
    expect(parseCandyGoal({ candies: 3_013_342, goal: 1, reached: true })).toEqual({ candies: 3_013_342, goal, reached: false })
    expect(parseCandyGoal({ candies: 'lots' })).toBeNull()
  })

  it('keeps a form behind it from changing the types, so the run plays the same locked or open', () => {
    for (const id of LEGEND_IDS) {
      const def: LegendDef = LEGENDS[id]
      if (def.form?.community) expect(def.form.types).toBeUndefined()
    }
  })

  it("shows Darkrai's second awakening as Mega Darkrai only once the goal opens it", () => {
    const g = createGame('darkrai', { w: 480, h: 270 }, 1)
    for (const level of AWAKEN_AT) {
      g.player.level = level
      g.player.xpNext = xpFor(level)
      advancePhase(g)
      while (g.phase === 'evolving') step(g, { move: { x: 0, y: 0 }, special: false }, EVOLUTION_TIME / 4)
      if (g.phase === 'ability') chooseOffer(g, g.player.offers[0]!)
    }
    expect(g.player.legend?.awakened).toBe(2)
    expect(playerForm(g).name).toBe('Darkrai')
    expect(sheetsLocked(491, 'mega')).toBe(true)
    setCommunityOpen(true)
    expect(playerForm(g).name).toBe('Mega Darkrai')
    expect(playerForm(g).types).toEqual(['dark'])
    expect(sheetsLocked(491, 'mega')).toBe(false)
  })
})
