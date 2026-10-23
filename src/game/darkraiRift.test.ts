import { describe, expect, it } from 'vitest'
import { NO_RANKS } from './meta'
import { startGame, type ReplayStart } from './replay'
import { drawRiftLegend } from './riftPortal'
import { isAsleep, sleepPlayer, SLEEP, tickSleep } from './playerSleep'

const START: ReplayStart = { seed: 7, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }

describe("Darkrai's event rift", () => {
  it('never comes outside a haunted run, and draws nothing more there', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const g = startGame({ ...START, seed })
      expect(drawRiftLegend(g)).not.toBe('darkrai')
      const next = g.rng()
      const h = startGame({ ...START, seed })
      drawRiftLegend(h)
      expect(h.rng()).toBe(next)
    }
  })

  it('takes about a third of the rifts in a haunted run', () => {
    let darkrai = 0
    for (let seed = 1; seed <= 200; seed++) if (drawRiftLegend(startGame({ ...START, seed, halloween: true })) === 'darkrai') darkrai++
    expect(darkrai).toBeGreaterThan(40)
    expect(darkrai).toBeLessThan(100)
  })
})

describe("Dark Void's sleep", () => {
  it('wears off into a drowsy spell that nothing puts back to sleep', () => {
    const g = startGame(START)
    const p = g.player
    sleepPlayer(g, p, 1)
    expect(isAsleep(p)).toBe(true)
    tickSleep(p, 1.01)
    expect(isAsleep(p)).toBe(false)
    sleepPlayer(g, p, 1)
    expect(isAsleep(p)).toBe(false)
    tickSleep(p, SLEEP.drowsy)
    sleepPlayer(g, p, 1)
    expect(isAsleep(p)).toBe(true)
  })
})
