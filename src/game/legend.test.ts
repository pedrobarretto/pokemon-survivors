import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { ABILITIES, FAMILY_ABILITIES, type AbilityEffect } from '../data/abilities'
import { EVOLUTIONS } from '../data/evolutions'
import { PLAYABLE, PLAYABLE_IDS } from '../data/hatchlings'
import { AWAKEN_AT, EVENT_LEGENDS, FESTIVAL_LEGENDS, LEGEND_IDS, LEGENDS, REGULAR_LEGENDS, type LegendDef } from '../data/legends'
import { ENEMIES, type EnemyDef } from '../data/enemies'
import { EVENTS, MYTHICALS, STAGES, TRIOS } from '../data/waves'
import { DIFFICULTIES, DIFFICULTY_IDS } from './difficulty'
import { advancePhase, chooseOffer, createGame, EVOLUTION_TIME, LEGEND_RADIUS, step } from './game'
import { avoidLegend, innateEffects, legendMods, pendingAwakening, PRESSURE } from './legend'
import { starterStats, xpFor } from './leveling'
import { NO_RANKS } from './meta'
import { OUTBREAK_SPECIES } from './outbreak'
import { runRoster, startGame } from './replay'
import { pickLegend } from './rift'
import { drawRoster, withTrio } from './roster'
import { applyDeltas, BASE_STATS } from './stats'
import type { Game } from './types'

const VIEW = { w: 480, h: 270 }

/** Effects whose running state (`AbilityState`) an innate and the Ability picked would share. */
const STATEFUL: ReadonlySet<AbilityEffect['kind']> = new Set(['summon', 'contact', 'aura', 'timer', 'heal', 'onKill', 'onHurt', 'moody', 'guard', 'sturdy'])

const awakenTo = (g: Game, n: number) => {
  g.player.level = AWAKEN_AT[n - 1]!
  g.player.xpNext = xpFor(g.player.level)
  advancePhase(g)
  while (g.phase === 'evolving') step(g, { move: { x: 0, y: 0 }, special: false }, EVOLUTION_TIME / 4)
}

describe('legends data', () => {
  it('has the 23 regular ones, the event and the festival ones, out of the regular cast the Desafio do dia draws from', () => {
    const regular: readonly string[] = PLAYABLE_IDS
    expect(REGULAR_LEGENDS).toHaveLength(23)
    expect(LEGEND_IDS).toEqual([...REGULAR_LEGENDS, ...EVENT_LEGENDS, ...FESTIVAL_LEGENDS])
    for (const id of LEGEND_IDS) {
      expect(id in PLAYABLE).toBe(true)
      expect(regular.includes(id)).toBe(false)
    }
  })

  it('open with their legendary move, from one list of moves to draft from and no evolved move', () => {
    const evolved = new Set<string>(EVOLUTIONS.map((e) => e.to))
    for (const id of LEGEND_IDS) {
      const def: LegendDef = LEGENDS[id]
      const list = def.learnset[0]
      expect([id, list[0]]).toEqual([id, def.signature])
      expect([id, list.length >= 7, new Set(list).size === list.length]).toEqual([id, true, true])
      for (const m of list) expect([id, m, evolved.has(m)]).toEqual([id, m, false])
    }
  })

  it('end both awakenings clearly above a final-stage starter', () => {
    const charizard = starterStats('charmander', 2)
    for (const id of LEGEND_IDS) {
      const def: LegendDef = LEGENDS[id]
      const s = applyDeltas(BASE_STATS, [def.stats, ...def.awakenings])
      expect([id, s.maxHp + s.armor * 15 > charizard.maxHp, s.might >= charizard.might]).toEqual([id, true, true])
    }
  })

  it('never pick an Ability that shares its running state with the innate', () => {
    for (const id of LEGEND_IDS) {
      const innate = new Set(innateEffects(id).map((e) => e.kind).filter((k) => STATEFUL.has(k)))
      for (const ability of FAMILY_ABILITIES[id]) {
        const clash = ABILITIES[ability].effects.filter((e: AbilityEffect) => innate.has(e.kind))
        expect([id, ability, clash]).toEqual([id, ability, []])
      }
    }
  })
})

describe('awakenings', () => {
  it('come at Lv 12 and 28 instead of an evolution: the Ability pick first, a form on the second', () => {
    const g = createGame('kyogre', VIEW, 1)
    const banishes = g.player.banishes
    const hp = g.player.stats.maxHp
    expect(pendingAwakening(g)).toBe(0)
    awakenTo(g, 1)
    expect([g.player.legend?.awakened, g.phase, g.player.stage, g.player.banishes]).toEqual([1, 'ability', 0, banishes + 1])
    expect(g.player.stats.maxHp).toBeGreaterThan(hp)
    chooseOffer(g, g.player.offers[0]!)
    awakenTo(g, 2)
    expect([g.player.legend?.awakened, g.phase]).toEqual([2, 'playing'])
    expect(g.events.some((e) => e.kind === 'awakened' && e.form === 'primal')).toBe(true)
  })

  it('cap a big legend’s hitbox', () => {
    expect(createGame('lugia', VIEW, 1).player.radius).toBe(LEGEND_RADIUS)
    expect(createGame('charmander', VIEW, 1).player.radius).toBeLessThan(LEGEND_RADIUS)
  })
})

describe('Pressure', () => {
  it('stacks on every difficulty and leaves the rest of the run alone', () => {
    for (const d of DIFFICULTY_IDS) {
      const mods = legendMods(d)
      expect(mods.spawnRate).toBeCloseTo(DIFFICULTIES[d].spawnRate * PRESSURE[d].spawnRate)
      expect(mods.iframes).toBe(DIFFICULTIES[d].iframes)
    }
  })
})

describe("the legend's horde", () => {
  it('draws no basics: every species of the stages (the event ghosts too), swarms, rings and spitters is tier 4 or 5, and no outbreak', () => {
    for (const [seed, halloween] of [[1, false], [2, true], [3, true]] as const) {
      const outbreak = OUTBREAK_SPECIES[0]!
      const { roster } = startGame({ seed, starter: 'kyogre', difficulty: 'nightmare', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak, halloween, bag: [], view: VIEW })
      const horde = [
        ...roster.stages.flatMap((pool) => pool.map(([id]) => id)),
        ...roster.spitters.flatMap((id) => (id ? [id] : [])),
        ...roster.events.flatMap((id, i) => (id && EVENTS[i]?.kind !== 'boss' && !('enemy' in EVENTS[i]!) ? [id] : [])),
      ]
      for (const id of horde) {
        const def: EnemyDef = ENEMIES[id]
        expect([id, def.tier]).toEqual([id, expect.toSatisfy((tier) => tier === 4 || tier === 5)])
      }
      expect(horde).not.toContain(outbreak)
    }
  })

  it('keeps the bosses and the shape of the run: same stages, same events', () => {
    const roster = runRoster(4, null, false, true)
    expect(roster.stages).toHaveLength(STAGES.length)
    expect(roster.events.map((id, i) => (EVENTS[i]?.kind === 'boss' ? id : null))).toEqual(
      runRoster(4, null, false).events.map((id, i) => (EVENTS[i]?.kind === 'boss' ? id : null)),
    )
  })
})

describe('never facing yourself', () => {
  it('swaps out the trio and the mythical the legend belongs to, and nothing else', () => {
    const roster = withTrio(drawRoster(createRng(5)), 'beasts')
    expect(avoidLegend(roster, 'charmander')).toBe(roster)
    const entei = avoidLegend(roster, 'entei')
    expect(TRIOS[entei.trio]).not.toContain('entei')
    expect(entei.events).not.toContain('entei')
    expect(entei.stages).toEqual(roster.stages)
    for (const m of MYTHICALS) expect(avoidLegend(roster, m).events).not.toContain(m)
  })

  it('never opens a rift to the legend played', () => {
    const rng = createRng(2)
    for (let i = 0; i < 200; i++) expect(pickLegend(rng, [], 'kyogre')).not.toBe('kyogre')
    expect(pickLegend(rng, ['lugia', 'hoOh', 'groudon', 'rayquaza', 'dialga', 'latias', 'latios', 'deoxys'], 'kyogre')).not.toBe('kyogre')
  })
})
