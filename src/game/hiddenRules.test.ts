import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { HIDDEN, HIDDEN_PLACE_IDS, isHiddenPlace } from '../data/places'
import { hiddenDue, nextBossAt, pickHidden, rollDig, rollHidden } from './hiddenRules'

describe('rollHidden', () => {
  it('gives about `HIDDEN.odds` of runs a hidden zone, due inside its window, the same for the same seed', () => {
    const rolls = Array.from({ length: 4000 }, (_, i) => rollHidden(i * 7919 + 13))
    const some = rolls.filter((at): at is number => at !== null)
    expect(Math.abs(some.length / rolls.length - HIDDEN.odds)).toBeLessThan(0.03)
    expect(some.every((at) => at >= HIDDEN.from && at <= HIDDEN.until)).toBe(true)
    expect(rollHidden(42)).toBe(rollHidden(42))
  })
})

describe('hiddenDue', () => {
  // 3:20: Onix (2:30) is over, Snorlax (5:00) far off, the next rift omen at 6:00.
  const clear = { time: 200, at: 200, busy: false, bossAlive: false, riftAt: 360 }

  it('opens once due, with nothing else going on', () => {
    expect(hiddenDue(clear)).toBe(true)
    expect(hiddenDue({ ...clear, at: null })).toBe(false)
    expect(hiddenDue({ ...clear, time: 199 })).toBe(false)
    expect(hiddenDue({ ...clear, busy: true })).toBe(false)
    expect(hiddenDue({ ...clear, bossAlive: true })).toBe(false)
  })

  it('never opens right before a wave boss or a rift omen, nor too late in the run', () => {
    const boss = nextBossAt(clear.time)
    expect(hiddenDue({ ...clear, time: boss - HIDDEN.clear + 1 })).toBe(false)
    expect(hiddenDue({ ...clear, riftAt: clear.time + HIDDEN.clear })).toBe(false)
    expect(hiddenDue({ ...clear, riftAt: clear.time - 5 })).toBe(false)
    // 12:40: past `HIDDEN.last`, though the trio (12:00) is over and Mewtwo far off.
    expect(hiddenDue({ ...clear, time: 760, riftAt: Infinity })).toBe(false)
  })
})

describe('pickHidden', () => {
  it('only picks hidden zones, the Underground likelier in the cave', () => {
    const rng = createRng(3)
    const picks = Array.from({ length: 400 }, () => pickHidden(rng, 'cave'))
    expect(picks.every(isHiddenPlace)).toBe(true)
    expect(picks.filter((id) => id === 'underground').length).toBeGreaterThan(picks.filter((id) => id === 'grotto').length * 3)
    expect(new Set(Array.from({ length: 400 }, () => pickHidden(rng, 'meadow')))).toEqual(new Set(HIDDEN_PLACE_IDS))
  })
})

describe('rollDig', () => {
  it('digs up an evolution stone only when one is missing, and Old Amber only once', () => {
    const rng = createRng(9)
    const finds = new Set(Array.from({ length: 500 }, () => rollDig(rng, { stone: false, fossil: false })))
    expect(finds.has('stone') || finds.has('fossil')).toBe(false)
    expect(new Set(Array.from({ length: 500 }, () => rollDig(rng, { stone: true, fossil: true })))).toEqual(new Set(['expCandy', 'sphere', 'rareCandy', 'stone', 'fossil']))
  })
})
