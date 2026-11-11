import { describe, expect, it } from 'vitest'
import { REGIGIGAS } from '../data/legendPaths'
import { createGame } from './game'
import { momentBusy } from './legendMoments'
import { createPathRun, updatePathRun } from './pathRun'
import { spawnMapEvent } from './mapEvents'
import { openDen, updateRaidDen } from './teraRaid'

const run = () => {
  const g = createGame('charmander', { w: 480, h: 270 }, 11)
  g.player.phase = 'playing'
  g.phase = 'playing'
  return g
}

describe('legend moments', () => {
  it('wait for each other: no temple rises and no den opens while the other is under way', () => {
    const g = run()
    g.time = REGIGIGAS.at[1]
    g.paths = createPathRun(11, true)
    openDen(g)
    expect(momentBusy(g, 'temple')).toBe(true)
    updatePathRun(g, spawnMapEvent)
    expect(g.mapEvents.list.some((ev) => ev.kind === 'regiTemple')).toBe(false)
    // The den gone, the temple rises; while it rises, the next den waits.
    g.raid.den = null
    g.time += 1
    updatePathRun(g, spawnMapEvent)
    expect(g.mapEvents.list.some((ev) => ev.kind === 'regiTemple')).toBe(true)
    g.raid.nextAt = g.time
    updateRaidDen(g, 1 / 60)
    expect(g.raid.den).toBe(null)
  })
})
