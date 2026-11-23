import { describe, expect, it } from 'vitest'
import { EVENTS, MYTHICAL_PITY, MYTHICALS } from '../data/waves'
import { recordLegendWin } from './capture'
import { step } from './game'
import { EMPTY_SAVE, NO_RANKS } from './meta'
import { countFinale, mergeMythicalPity, mythicalChance, mythicalHunt, parseHunt, withHunt } from './mythicalHunt'
import { drawRoster } from './roster'
import { createRng } from '../engine/rng'
import { startGame, TICK, type ReplayStart } from './replay'
import type { GameEvent } from './types'

const START: ReplayStart = { seed: 7, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } }
const SLOT = EVENTS.findIndex((e) => e.kind === 'boss' && 'mythical' in e)

/** Plays the tick the finale's mythical slot rolls in and returns what it announced. */
const rollFinale = (start: ReplayStart) => {
  const g = startGame(start)
  g.phase = 'playing'
  g.time = EVENTS[SLOT]!.at
  g.nextEvent = SLOT
  step(g, { move: { x: 0, y: 0 }, special: false }, TICK)
  return { g, roll: g.events.find((e): e is Extract<GameEvent, { kind: 'mythicalRoll' }> => e.kind === 'mythicalRoll') }
}

describe('mythical odds', () => {
  it('keeps the base chance at first, then climbs to a sure thing', () => {
    expect(mythicalChance(0.1, 0)).toBe(0.1)
    expect(mythicalChance(0.1, MYTHICAL_PITY.free)).toBe(0.1)
    expect(mythicalChance(0.1, MYTHICAL_PITY.free + 1)).toBeCloseTo(0.1 + MYTHICAL_PITY.step)
    expect(mythicalChance(0.1, MYTHICAL_PITY.sure)).toBe(1)
  })
})

describe('the hunt a save brings', () => {
  it('lists who is missing and how long the player has gone without one', () => {
    const save = { legends: { mew: 1 }, mythicalPity: { finales: 12, beaten: 5 } }
    expect(mythicalHunt(save)).toEqual({ dry: 7, missing: ['celebi', 'jirachi'] })
  })

  it('stops once all three are captured', () => {
    expect(mythicalHunt({ legends: { mew: 1, celebi: 1, jirachi: 1 }, mythicalPity: { finales: 40, beaten: 0 } })).toBeUndefined()
  })

  it('starts over when a mythical falls, and a merge with an older device keeps that', () => {
    const before = { ...EMPTY_SAVE, mythicalPity: { finales: 9, beaten: 0 } }
    const { save } = recordLegendWin(before, { legend: 'celebi', shiny: false, endless: false })
    expect(mythicalHunt(save)?.dry).toBe(0)
    const merged = mergeMythicalPity(before.mythicalPity, save.mythicalPity)
    expect(mythicalHunt({ legends: save.legends, mythicalPity: merged })?.dry).toBe(0)
    expect(mergeMythicalPity(countFinale(merged), merged).finales).toBe(10)
  })

  it('leaves the count alone when another legendary falls', () => {
    const before = { ...EMPTY_SAVE, mythicalPity: { finales: 9, beaten: 0 } }
    expect(recordLegendWin(before, { legend: 'mewtwo', shiny: false, endless: false }).save.mythicalPity).toEqual(before.mythicalPity)
  })
})

describe('a replay\'s hunt', () => {
  it.each([
    [{ dry: MYTHICAL_PITY.sure + 1, missing: ['mew'] }],
    [{ dry: 1.5, missing: ['mew'] }],
    [{ dry: 1, missing: [] }],
    [{ dry: 1, missing: ['mewtwo'] }],
    [{ dry: 1, missing: ['mew', 'mew'] }],
  ])('refuses %j', (raw) => expect(parseHunt(raw)).toBeNull())

  it('takes a valid one', () => expect(parseHunt({ dry: 3, missing: ['celebi'] })).toEqual({ dry: 3, missing: ['celebi'] }))
})

describe('the finale with a hunt', () => {
  it('only swaps the mythical slot, for one the player misses', () => {
    const roster = drawRoster(createRng(5))
    const hunted = withHunt(roster, { dry: 0, missing: ['jirachi'] }, 5)
    expect(hunted.events[SLOT]).toBe('jirachi')
    expect(hunted.events.filter((_, i) => i !== SLOT)).toEqual(roster.events.filter((_, i) => i !== SLOT))
  })

  it('draws every missing mythical across seeds', () => {
    const seen = new Set(Array.from({ length: 60 }, (_, seed) => withHunt(drawRoster(createRng(seed)), { dry: 0, missing: MYTHICALS }, seed).events[SLOT]))
    expect(seen).toEqual(new Set(MYTHICALS))
  })

  it('brings the mythical for sure at the guarantee', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const { g, roll } = rollFinale({ ...START, seed, mythical: { dry: MYTHICAL_PITY.sure, missing: ['celebi'] } })
      expect(roll?.enemy).toBe('celebi')
      expect(g.enemies.some((e) => e.kind === 'celebi' && e.boss)).toBe(true)
    }
  })

  it('draws as many numbers with or without a hunt, so the run stays in step', () => {
    const plain = rollFinale(START).g
    const hunted = rollFinale({ ...START, mythical: { dry: 0, missing: MYTHICALS } }).g
    expect(hunted.rng()).toBe(plain.rng())
  })
})
