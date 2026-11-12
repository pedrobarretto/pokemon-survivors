import { describe, expect, it } from 'vitest'
import { FORCE_ROAM, FORCE_WEATHER, RUINS } from '../data/forces'
import { captureByGift, NO_CAPTURES, legendSource, winCounts, type Captures } from './capture'
import { createGame } from './game'
import { ruinsRun } from './legendPaths'
import { spawnMapEvent, updateMapEvents } from './mapEvents'
import { parseWild, rollForce, rollRoamer, type WildStart } from './quests'
import { forceDue, wildOf } from './questSave'
import { createRoam, forcePhase, roamerBody, updateRoam } from './roamers'
import { ruinThreshold } from './splitRuins'

const capture = (ids: readonly Parameters<typeof captureByGift>[1][]): Captures => ids.reduce(captureByGift, NO_CAPTURES)

const run = () => {
  const g = createGame('charmander', { w: 480, h: 270 }, 11)
  g.player.phase = 'playing'
  g.phase = 'playing'
  return g
}

describe('the Forces of Nature', () => {
  it('come in turn: Landorus once Tornadus and Thundurus are caught, Enamorus once all three are', () => {
    expect(wildOf({ legends: NO_CAPTURES, roamers: {} }).forces).toEqual({ tornadus: 1, thundurus: 1 })
    expect(forceDue(capture(['tornadus']), 'landorus')).toBe(false)
    const two = capture(['tornadus', 'thundurus'])
    expect(wildOf({ legends: two, roamers: { landorus: 0.4 } }).forces).toEqual({ landorus: 0.4 })
    expect(forceDue(two, 'enamorus')).toBe(false)
    expect(wildOf({ legends: capture(['tornadus', 'thundurus', 'landorus']), roamers: {} }).forces).toEqual({ enamorus: 1 })
    expect(winCounts(two, 'enamorus', false)).toBe(false)
    expect(legendSource('landorus')).toBe('force')
  })

  it('roll only in a run whose seed brings no lake legend, and only the free ones', () => {
    const wild: WildStart = { lake: { uxie: 1 }, swords: [], forces: { tornadus: 1, thundurus: 0.5 } }
    const seeds = Array.from({ length: 600 }, (_, i) => i * 7919 + 13)
    const forces = seeds.map((s) => rollForce(s, wild))
    for (const [i, s] of seeds.entries()) if (rollRoamer(s, wild) !== null) expect(forces[i]).toBeNull()
    const brought = forces.filter((f) => f !== null)
    expect(new Set(brought)).toEqual(new Set(['tornadus', 'thundurus']))
    expect(brought.length / seeds.length).toBeLessThan(FORCE_ROAM.odds)
    expect(seeds.every((s) => rollForce(s, { lake: {}, swords: [] }) === null)).toBe(true)
  })

  it('read a replay’s Forces strictly, and replays from before them as they were', () => {
    expect(parseWild({ lake: {}, swords: [], forces: { landorus: 0.3 } })).toEqual({ lake: {}, swords: [], forces: { landorus: 0.3 } })
    expect(parseWild({ lake: {}, swords: [] })).toEqual({ lake: {}, swords: [] })
    expect(parseWild({ lake: {}, swords: [], forces: { uxie: 0.3 } })).toBeNull()
    expect(parseWild({ lake: {}, swords: [], forces: { tornadus: 2 } })).toBeNull()
  })

  it('bring their weather with each visit and fight harder as their HP wears down across runs', () => {
    const g = run()
    g.quests.roam = { ...createRoam(11, 'thundurus', 0.5), next: 0 }
    updateRoam(g, 1 / 60)
    expect(roamerBody(g)?.kind).toBe('thundurus')
    expect(g.weather.id).toBe(FORCE_WEATHER.thundurus)
    // Its first visit plays its entrance.
    expect(g.legendScene?.kind).toBe('entrance')
    expect([forcePhase(1), forcePhase(0.5), forcePhase(0.2)]).toEqual([0, 1, 2])
  })
})

describe('the Ruínas da Decisão', () => {
  it('come only once Regigigas is caught, with the Regis still free', () => {
    const seeds = Array.from({ length: 300 }, (_, i) => i * 104729 + 7)
    const caught = (ids: readonly string[]) => (id: string) => ids.includes(id)
    expect(seeds.every((s) => ruinsRun(s, caught([])).length === 0)).toBe(true)
    const brought = seeds.map((s) => ruinsRun(s, caught(['regigigas']))).filter((r) => r.length > 0)
    expect(brought.length / seeds.length).toBeGreaterThan(RUINS.odds * 0.6)
    expect(brought.every((r) => r.join() === 'regieleki,regidrago')).toBe(true)
    expect(seeds.map((s) => ruinsRun(s, caught(['regigigas', 'regieleki']))).filter((r) => r.length > 0).every((r) => r.join() === 'regidrago')).toBe(true)
    expect(seeds.every((s) => ruinsRun(s, caught(['regigigas', 'regieleki', 'regidrago'])).length === 0)).toBe(true)
  })

  it('wake the Regi whose ruin the player walks into, and only that one', () => {
    const g = run()
    g.paths.ruinsFree = ['regieleki', 'regidrago']
    const ev = spawnMapEvent(g, 'splitRuins', g.player.x, g.player.y - 120)
    for (let t = 0; t < RUINS.rise + 0.2; t += 1 / 60) updateMapEvents(g, 1 / 60)
    const gate = ruinThreshold(ev!, 'regidrago')
    g.player.x = gate.x
    g.player.y = gate.y
    for (let t = 0; t < 2.5; t += 1 / 60) updateMapEvents(g, 1 / 60)
    expect(ev!.state.pick).toBe('regidrago')
    expect(g.enemies.find((e) => e.id === g.bossId)?.kind).toBe('regidrago')
    expect(g.enemies.some((e) => e.kind === 'regieleki')).toBe(false)
  })
})
