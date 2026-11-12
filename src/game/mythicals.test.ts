import { describe, expect, it } from 'vitest'
import { DIALGA_DOMAIN } from '../data/domains/dialga'
import { maskOf, OGERPON_MASKS, ZERAORA } from '../data/mythicals'
import { EVENTS } from '../data/waves'
import { phaseForm } from './bossFight'
import { legendSource, winCounts } from './capture'
import { createGame } from './game'
import { legendStage } from './legend'
import { NO_WILD, createQuests } from './quests'
import { collectShard, dropBossShards } from './tera'
import { openDen } from './teraRaid'
import type { Game } from './types'
import { createStorm, updateStorm } from './zeraora'

const VIEW = { w: 480, h: 270 }

const run = (starter: 'charmander' | 'ogerpon' = 'charmander', seed = 7) => {
  const g = createGame(starter, VIEW, seed, undefined, undefined, { wild: NO_WILD })
  g.phase = 'playing'
  g.player.phase = 'playing'
  return g
}

/** The clock at `time`, the schedule caught up to it (as a run's would be). */
const at = (g: Game, time: number) => {
  g.time = time
  g.nextEvent = EVENTS.findIndex((e) => e.at > time)
}

describe("Zeraora's storm", () => {
  it('waits for rain in the Power Plant, gathers, then brings Zeraora as a boss', () => {
    const g = run()
    g.quests.storm = createStorm()
    at(g, 200)
    g.weather.id = 'rain'
    g.player.biome = 'meadow'
    for (let i = 0; i < 600; i++) updateStorm(g, 1 / 60)
    expect(g.quests.storm.stage).toBe('hidden')
    g.player.biome = 'plant'
    for (let i = 0; i < 60 * (ZERAORA.dwell + 0.2); i++) updateStorm(g, 1 / 60)
    expect(g.quests.storm.stage).toBe('gathering')
    for (let i = 0; i < 60 * (ZERAORA.gather + 0.2); i++) updateStorm(g, 1 / 60)
    expect(g.quests.storm.stage).toBe('fight')
    expect(g.enemies.find((e) => e.id === g.quests.storm?.body)?.kind).toBe('zeraora')
  })

  it('never comes in co-op, and comes caught or not', () => {
    expect(createQuests(3, NO_WILD, true).storm).toBe(null)
    expect(winCounts({ zeraora: 1 }, 'zeraora', false)).toBe(true)
    expect(legendSource('zeraora')).toBe('storm')
  })
})

describe('Ogerpon', () => {
  it('starts in the Teal Mask, and its types follow the mask its Tera type picks', () => {
    const g = run('ogerpon')
    expect(g.player.tera.type).toBe('grass')
    expect(legendStage(g, g.player.legend!).types).toEqual(['grass'])
    collectShard(g, 'fire', -1)
    expect(maskOf(g.player.tera.type)).toBe('hearthflame')
    expect(legendStage(g, g.player.legend!).types).toEqual(['grass', 'fire'])
  })

  it('keeps its mask through a shard of another type, and a boss offers it two other masks', () => {
    const g = run('ogerpon')
    collectShard(g, 'dragon', -1)
    expect(g.player.tera.type).toBe('grass')
    dropBossShards(g, g.player.x, g.player.y, 'dragon')
    const shards = g.pickups.flatMap((k) => (k.kind === 'teraShard' ? [k.tera] : []))
    expect(shards).toHaveLength(2)
    expect(new Set(shards).size).toBe(2)
    for (const tera of shards) expect(maskOf(tera)).not.toBe('teal')
  })

  it("brings its own raid in its first den for some seeds, in the mask of the run's Tera type", () => {
    const raids = Array.from({ length: 200 }, (_, seed) => {
      const g = run('charmander', seed)
      g.player.tera.type = 'water'
      return openDen(g).raid
    })
    const own = raids.filter((r) => r.boss === 'ogerpon')
    expect(own.length).toBeGreaterThan(20)
    expect(own.length).toBeLessThan(120)
    for (const r of own) expect(r.tera).toBe(OGERPON_MASKS.wellspring.type)
  })

  it('never meets itself in its own run', () => {
    for (let seed = 0; seed < 60; seed++) expect(openDen(run('ogerpon', seed)).raid.boss).not.toBe('ogerpon')
  })
})

describe('Diancie and Primal Dialga', () => {
  it('Diancie comes only out of the Escavação: no win counts', () => {
    expect(legendSource('diancie')).toBe('dig')
    expect(winCounts({}, 'diancie', false)).toBe(false)
  })

  it("Dialga's last phase turns Primal on Nightmare only", () => {
    const last = DIALGA_DOMAIN.phases.at(-1)
    expect(phaseForm(last, 'nightmare')).toBe('primal')
    expect(phaseForm(last, 'hard')).toBe(undefined)
  })
})
