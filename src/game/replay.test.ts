import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { chooseOffer, step } from './game'
import { recomputeStats } from './leveling'
import { grantStone } from './mega'
import { NO_RANKS } from './meta'
import { OUTBREAK_SPECIES } from './outbreak'
import type { Game } from './types'
import { moveCode, moveOf, parseReplay, recordEvent, recordStep, resimulate, RULES_VERSION, rulesStanding, startGame, startRecording, TICK, type ReplayStart } from './replay'

const START: ReplayStart = { seed: 7, starter: 'squirtle', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, lure: false, incense: false, view: { w: 480, h: 270 } }

/**
 * Plays `seconds` like the shell would, with a wandering stick, picks and a
 * rotation, recording it. The special is pressed every `every` ticks, the Mega
 * button every 400 ticks and the lunge every 100. `stage` sets the run up first (a test-only shortcut).
 */
const play = (seconds: number, start = START, every = 300, stage: (g: Game) => void = () => {}) => {
  const view = { ...start.view }
  const g = startGame(start, view)
  stage(g)
  const rec = startRecording(start)
  const bot = createRng(3)
  let angle = 0
  while (g.time < seconds && g.phase !== 'gameover') {
    if (g.phase === 'levelup') {
      const i = Math.floor(bot() * g.player.offers.length)
      recordEvent(rec, ['offer', i])
      chooseOffer(g, g.player.offers[i]!)
      continue
    }
    if (rec.tick === 600) Object.assign(view, { w: 300, h: 520 })
    angle += (bot() - 0.5) * 0.2
    const special = rec.tick % every === 0
    const mega = rec.tick % 400 === 100
    const lunge = rec.tick % 100 === 50
    if (special) recordEvent(rec, ['special'])
    if (mega) recordEvent(rec, ['mega'])
    if (lunge) recordEvent(rec, ['lunge'])
    step(g, { move: recordStep(rec, view, { x: Math.cos(angle), y: Math.sin(angle) }), special, mega, lunge }, TICK)
  }
  return { g, replay: rec.replay }
}

describe('moveCode', () => {
  it('keeps the 8 keyboard directions exact and standing still at zero', () => {
    const d = Math.SQRT1_2
    for (const v of [{ x: 1, y: 0 }, { x: 0, y: -1 }, { x: -d, y: d }, { x: d, y: d }]) {
      const back = moveOf(moveCode(v))
      expect(back.x).toBeCloseTo(v.x, 12)
      expect(back.y).toBeCloseTo(v.y, 12)
    }
    expect(moveCode({ x: 0.02, y: 0 })).toBe(0)
  })

  it('lands within 6° and one speed step of any stick', () => {
    const rng = createRng(1)
    for (let i = 0; i < 500; i++) {
      const a = rng() * Math.PI * 2
      const len = rng()
      const back = moveOf(moveCode({ x: Math.cos(a) * len, y: Math.sin(a) * len }))
      expect(Math.abs(Math.hypot(back.x, back.y) - len)).toBeLessThanOrEqual(1 / 14 + 1e-9)
      if (Math.hypot(back.x, back.y) > 0) expect(Math.abs(Math.cos(Math.atan2(back.y, back.x) - a) - 1)).toBeLessThan(1 - Math.cos((6 * Math.PI) / 180))
    }
  })
})

describe('replays', () => {
  it('re-simulate to the same run', () => {
    const { g, replay } = play(40)
    const again = resimulate(parseReplay(JSON.parse(JSON.stringify(replay)))!)
    expect(again).toEqual({ time: g.time, kills: g.kills, level: g.player.level, phase: g.phase, stuck: false })
    expect(replay.events.some((e) => e[1] === 'view')).toBe(true)
  })

  it('play the same run whether the starter was picked shiny or not', () => {
    const { replay } = play(30)
    const normal = resimulate(replay)
    const picked = resimulate({ ...replay, start: { ...replay.start, shiny: true } })
    expect(picked).toEqual(normal)
  })

  it('re-simulate a chain dash run, presses inside the windows included', () => {
    const { g, replay } = play(40, { ...START, starter: 'treecko' }, 20)
    expect(resimulate(parseReplay(JSON.parse(JSON.stringify(replay)))!)).toEqual({ time: g.time, kills: g.kills, level: g.player.level, phase: g.phase, stuck: false })
  })

  it('re-simulate a Mega Evolution, its transformation and its special', () => {
    /** Charizard with the Charizardite Y, as if a rift had dropped it: Drought brings the sun in. */
    const megaReady = (g: Game) => {
      g.player.stage = 2
      recomputeStats(g)
      grantStone(g, 'charizardY')
    }
    const start: ReplayStart = { ...START, starter: 'charmander' }
    const { g, replay } = play(40, start, 90, megaReady)
    expect(g.player.mega.count).toBe(1)
    const staged = startGame(start)
    megaReady(staged)
    expect(resimulate(parseReplay(JSON.parse(JSON.stringify(replay)))!, staged)).toEqual({ time: g.time, kills: g.kills, level: g.player.level, phase: g.phase, stuck: false })
  })

  it('re-simulate Quick Attack, which only lunges on a press', () => {
    const quickAttack = (g: Game) => {
      g.player.moves.push({ id: 'quickAttack', level: 1, cooldown: 0 })
    }
    const start: ReplayStart = { ...START, starter: 'riolu' }
    const { g, replay } = play(40, start, 300, quickAttack)
    const staged = startGame(start)
    quickAttack(staged)
    expect(resimulate(parseReplay(JSON.parse(JSON.stringify(replay)))!, staged)).toEqual({ time: g.time, kills: g.kills, level: g.player.level, phase: g.phase, stuck: false })
  })

  it("re-simulate a run of the day's outbreak with a Lure and an Incense, which change how it plays", () => {
    const start: ReplayStart = { ...START, outbreak: OUTBREAK_SPECIES[0]!, lure: true, incense: true }
    const { g, replay } = play(40, start)
    expect(g.roster.stages.every((pool) => pool.some(([id]) => id === start.outbreak))).toBe(true)
    expect(g.shinyBoost).toBe(2)
    expect(resimulate(parseReplay(JSON.parse(JSON.stringify(replay)))!)).toEqual({ time: g.time, kills: g.kills, level: g.player.level, phase: g.phase, stuck: false })
    expect(resimulate({ ...replay, start: { ...replay.start, outbreak: null } })).not.toEqual(resimulate(replay))
    expect(parseReplay({ ...JSON.parse(JSON.stringify(replay)), start: { ...replay.start, outbreak: 'mewtwo' } })!.start.outbreak).toBeNull()
  })

  it('give a run played on another seed away', () => {
    const { g, replay } = play(40)
    const other = resimulate({ ...replay, start: { ...replay.start, seed: 8 } })
    expect([other.kills, other.level, other.time]).not.toEqual([g.kills, g.player.level, g.time])
  })

  it('refuse broken shapes', () => {
    const { replay } = play(2)
    const json = JSON.parse(JSON.stringify(replay))
    expect(parseReplay({ ...json, moves: [1] })).toBeNull()
    expect(parseReplay({ ...json, moves: [999, 1] })).toBeNull()
    expect(parseReplay({ ...json, events: [[5, 'special'], [2, 'special']] })).toBeNull()
    expect(parseReplay({ ...json, start: { ...json.start, starter: 'mewtwo' } })).toBeNull()
    expect(parseReplay({ ...json, start: { ...json.start, ranks: { hpUp: 99 } } })!.start.ranks.hpUp).toBe(5)
  })

  it('carry the rules they were recorded under, and only those are judged as they are', () => {
    const json = JSON.parse(JSON.stringify(play(2).replay))
    expect(parseReplay(json)!.rules).toBe(RULES_VERSION)
    const { rules: _, ...before } = json
    expect(parseReplay(before)!.rules).toBe(1)
    expect(rulesStanding(RULES_VERSION)).toBe('same')
    expect(rulesStanding(1)).toBe('older')
    expect(rulesStanding(RULES_VERSION + 1)).toBe('newer')
  })
})
