import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { PLAYABLE_IDS } from '../data/hatchlings'
import { challengeOpen, challengeProblem, challengeStart, dailyChallenge, nextIsOfficial, ribbonsDue } from './challenge'
import { previousDay } from './day'
import { chooseOffer, step } from './game'
import { NO_RANKS } from './meta'
import { outbreakOf } from './outbreak'
import { parseReplay, recordEvent, recordStep, resimulate, startGame, startRecording, TICK } from './replay'

const DAY = '2026-10-15'
const VIEW = { w: 480, h: 270 }

describe('dailyChallenge', () => {
  it('is the same for everyone on a day, with the day’s outbreak', () => {
    expect(dailyChallenge(DAY)).toEqual(dailyChallenge(DAY))
    expect(dailyChallenge(DAY).outbreak).toBe(outbreakOf(DAY))
    expect(dailyChallenge(DAY).seed).not.toBe(dailyChallenge(previousDay(DAY)).seed)
  })

  it('gives every playable Pokémon its day once per cycle, egg families included', () => {
    let day = '2026-01-01'
    const days: string[] = []
    // A whole cycle starts at a multiple of its length in days since 1970.
    while (days.length < PLAYABLE_IDS.length * 2) days.push((day = previousDay(day)))
    const starters = days.map((d) => dailyChallenge(d).starter)
    const counts = new Map(starters.map((s) => [s, starters.filter((x) => x === s).length]))
    expect(new Set(starters)).toEqual(new Set(PLAYABLE_IDS))
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(3)
  })
})

describe('challengeProblem', () => {
  const start = challengeStart(dailyChallenge(DAY), VIEW, false)

  it('takes the day’s challenge, shiny colors or not', () => {
    expect(challengeProblem(start, DAY)).toBeNull()
    expect(challengeProblem({ ...start, shiny: true }, DAY)).toBeNull()
  })

  it('refuses upgrades, Bag items and the lucky egg', () => {
    expect(challengeProblem({ ...start, ranks: { ...NO_RANKS, protein: 1 } }, DAY)).toBe('ranks')
    expect(challengeProblem({ ...start, ranks: { ...NO_RANKS, shinyCharm: 3 } }, DAY)).toBe('ranks')
    expect(challengeProblem({ ...start, lure: true }, DAY)).toBe('items')
    expect(challengeProblem({ ...start, incense: true }, DAY)).toBe('items')
    expect(challengeProblem({ ...start, luckyEgg: true }, DAY)).toBe('items')
  })

  it('refuses another seed, Pokémon, difficulty, outbreak or day', () => {
    const other = PLAYABLE_IDS.find((id) => id !== start.starter)!
    expect(challengeProblem({ ...start, seed: start.seed + 1 }, DAY)).toBe('seed')
    expect(challengeProblem({ ...start, starter: other }, DAY)).toBe('starter')
    expect(challengeProblem({ ...start, difficulty: start.difficulty === 'normal' ? 'hard' : 'normal' }, DAY)).toBe('difficulty')
    expect(challengeProblem({ ...start, outbreak: null }, DAY)).toBe('outbreak')
    expect(challengeProblem(start, previousDay(DAY))).not.toBeNull()
  })
})

describe('a challenge replay', () => {
  it('re-simulates to the same run', () => {
    const start = challengeStart(dailyChallenge(DAY), VIEW, false)
    const view = { ...VIEW }
    const g = startGame(start, view)
    const rec = startRecording(start)
    const bot = createRng(5)
    let angle = 0
    while (g.time < 30 && g.phase !== 'gameover') {
      if (g.phase === 'levelup') {
        const i = Math.floor(bot() * g.player.offers.length)
        recordEvent(rec, ['offer', i])
        chooseOffer(g, g.player.offers[i]!)
        continue
      }
      angle += (bot() - 0.5) * 0.2
      const special = rec.tick % 240 === 0
      if (special) recordEvent(rec, ['special'])
      step(g, { move: recordStep(rec, view, { x: Math.cos(angle), y: Math.sin(angle) }), special, mega: false, lunge: false }, TICK)
    }
    const replay = parseReplay(JSON.parse(JSON.stringify(rec.replay)))!
    expect(challengeProblem(replay.start, DAY)).toBeNull()
    expect(resimulate(replay)).toEqual({ time: g.time, kills: g.kills, level: g.player.level, phase: g.phase, stuck: false })
  })
})

describe('the challenge clock', () => {
  it('opens on its day and for a few minutes past midnight', () => {
    expect(challengeOpen(DAY, new Date('2026-10-15T15:00:00-03:00'))).toBe(true)
    expect(challengeOpen(DAY, new Date('2026-10-16T00:05:00-03:00'))).toBe(true)
    expect(challengeOpen(DAY, new Date('2026-10-16T00:30:00-03:00'))).toBe(false)
    expect(challengeOpen('2026-10-16', new Date('2026-10-15T23:00:00-03:00'))).toBe(false)
  })

  it('sends a day’s ribbons a few hours after it ends', () => {
    expect(ribbonsDue(DAY, new Date('2026-10-15T23:59:00-03:00'))).toBe(false)
    expect(ribbonsDue(DAY, new Date('2026-10-16T01:00:00-03:00'))).toBe(false)
    expect(ribbonsDue(DAY, new Date('2026-10-16T03:00:00-03:00'))).toBe(true)
    expect(ribbonsDue(DAY, new Date('2026-10-18T01:00:00-03:00'))).toBe(true)
  })
})

describe('nextIsOfficial', () => {
  it('is practice once this device or the server knows of a finished attempt', () => {
    expect(nextIsOfficial(DAY, null, null)).toBe(true)
    expect(nextIsOfficial(DAY, { day: previousDay(DAY), time: 300 }, false)).toBe(true)
    expect(nextIsOfficial(DAY, { day: DAY, time: 300 }, null)).toBe(false)
    expect(nextIsOfficial(DAY, null, true)).toBe(false)
  })
})
