import { describe, expect, it } from 'vitest'
import {
  bonusMult, BURROW_SHARE, burrowTime, DRAIN_RATE, drainAmount, drainRefill, executes, learnable, LOW_HP, nearestFoes, nextStacks, scaleBy, WARD_GAP, wardOpens, type StackRule,
} from './kitRules'
import { HEX_BONUS } from './moveRules'
import type { MoveId } from './moves'
import { applyStatus, breakOnHit, createStatus, FREEZE_SHATTER, hitTakenMult, statusAttack, statusPace } from './status'
import { createTraitState } from './traits'
import type { Enemy } from './types'

let nextId = 1
const enemy = (over: Partial<Enemy> = {}): Enemy => ({
  id: nextId++,
  kind: 'rattata',
  types: ['normal'],
  x: 0, y: 0, kx: 0, ky: 0,
  hp: 100, maxHp: 100,
  damage: 10, speed: 40, mass: 1, radius: 6, xp: 1,
  boss: false, shiny: false, elite: false, runner: false, fight: null, bornAt: 0, cooldowns: [],
  behavior: { kind: 'chase' },
  dir: 0, animTime: 0, flash: 0,
  status: createStatus(),
  trait: createTraitState(undefined, 0),
  dying: -1,
  fled: false,
  thrown: null,
  alpha: null,
  ...over,
})

describe('conditional bonus', () => {
  const hex = [{ when: 'afflicted', mult: HEX_BONUS }] as const

  it('is exactly ×1 when nothing applies, so plain hits keep their numbers', () => {
    expect(bonusMult([], enemy())).toBe(1)
    expect(bonusMult(hex, enemy())).toBe(1)
  })

  it("applies Hex's ×1.7 to a foe with any condition", () => {
    const e = enemy()
    applyStatus(e.status, { kind: 'burn', chance: 1, duration: 2, power: 0.3 }, 10, false, 'ember')
    expect(bonusMult(hex, e)).toBe(HEX_BONUS)
  })

  it('multiplies every bonus that applies and skips the rest', () => {
    const e = enemy({ hp: LOW_HP * 100 - 1, types: ['flying'], elite: true })
    expect(bonusMult([{ when: 'lowHp', mult: 2 }, { when: 'flying', mult: 1.5 }, { when: 'boss', mult: 3 }, { when: 'elite', mult: 1.2 }], e)).toBeCloseTo(3.6)
    expect(bonusMult([{ when: 'lowHp', mult: 2 }], enemy({ hp: LOW_HP * 100 }))).toBe(1)
  })
})

describe('execute', () => {
  it('fells regular foes at or under the threshold, never bosses or with no execute', () => {
    expect(executes(0.15, 15, 100, false)).toBe(true)
    expect(executes(0.15, 16, 100, false)).toBe(false)
    expect(executes(0.15, 5, 100, true)).toBe(false)
    expect(executes(0, 1, 100, false)).toBe(false)
    expect(executes(0.15, 0, 100, false)).toBe(false)
  })
})

describe('drain', () => {
  const maxHp = 200
  const cap = maxHp * DRAIN_RATE

  it('refills at DRAIN_RATE of max HP per second, holding one second of it', () => {
    expect(drainRefill(0, 0.5, maxHp)).toBeCloseTo(cap / 2)
    expect(drainRefill(0, 60, maxHp)).toBe(cap)
  })

  it('heals its share of the damage, within the budget', () => {
    expect(drainAmount(10, 0.3, cap)).toBeCloseTo(3)
    expect(drainAmount(1000, 0.3, cap)).toBe(cap)
    expect(drainAmount(10, 0.3, 0)).toBe(0)
  })
})

describe('stacks', () => {
  const rule: StackRule = { grow: 'hit', max: 3, reset: 'cast' }

  it('grows on its event up to max, resets on its reset and ignores the rest', () => {
    let s = 0
    for (let i = 0; i < 5; i++) s = nextStacks(rule, s, 'hit')
    expect(s).toBe(3)
    expect(nextStacks(rule, s, 'hurt')).toBe(3)
    expect(nextStacks(rule, s, 'cast')).toBe(0)
  })

  it('grows by `by`, and a reset wins on the same event', () => {
    expect(nextStacks({ grow: 'still', max: 10, by: 4 }, 8, 'still')).toBe(10)
    expect(nextStacks({ grow: 'hurt', max: 5, reset: 'hurt' }, 2, 'hurt')).toBe(0)
  })

  it('scales a reading up to a cap', () => {
    expect(scaleBy(0.5, 2)).toBe(2)
    expect(scaleBy(3, 2, 4)).toBe(4)
    expect(scaleBy(-1, 2)).toBe(1)
  })
})

describe('one manual move', () => {
  const manual = (id: MoveId) => id === 'quickAttack' || id === 'ember'

  it('offers a manual move only when the loadout has none', () => {
    expect(learnable(['waterGun'], 'quickAttack', manual)).toBe(true)
    expect(learnable(['ember', 'waterGun'], 'quickAttack', manual)).toBe(false)
    expect(learnable(['ember'], 'waterGun', manual)).toBe(true)
  })
})

describe('seed jump targets', () => {
  it('takes the nearest living foes in reach, ties to the lower id, skipping the seeded', () => {
    const from = enemy({ id: 100 })
    const far = enemy({ id: 1, x: 90 })
    const tieHigh = enemy({ id: 9, x: 30 })
    const tieLow = enemy({ id: 3, y: 30 })
    const near = enemy({ id: 7, x: 10 })
    const fainted = enemy({ id: 2, x: 1, dying: 0 })
    const seeded = enemy({ id: 4, x: 2 })
    const foes = [from, far, tieHigh, tieLow, near, fainted, seeded]
    const skip = (e: Enemy) => e === seeded
    expect(nearestFoes(foes, from, 2, 80, skip).map((e) => e.id)).toEqual([7, 3])
    expect(nearestFoes(foes, from, 5, 80, skip).map((e) => e.id)).toEqual([7, 3, 9])
  })
})

describe('new conditions', () => {
  it('freeze stops the foe, doubles the next hit and breaks on it', () => {
    const e = enemy()
    applyStatus(e.status, { kind: 'freeze', chance: 1, duration: 2, power: 0 }, 10, false, 'iceShard')
    expect(statusPace(e.status)).toBe(0)
    expect(statusAttack(e.status)).toBe(0)
    expect(hitTakenMult(e.status)).toBe(FREEZE_SHATTER)
    expect(breakOnHit(e.status)).toBe(true)
    expect(hitTakenMult(e.status)).toBe(1)
  })

  it("a move's sleep breaks on a hit; the Poké Flute's and the specials' hold", () => {
    const sleep = { kind: 'sleep', chance: 1, duration: 3, power: 0 } as const
    const byMove = enemy()
    applyStatus(byMove.status, sleep, 10, false, 'swift')
    breakOnHit(byMove.status)
    expect(byMove.status.sleep.time).toBe(0)
    for (const source of [null, 'special'] as const) {
      const held = enemy()
      applyStatus(held.status, sleep, 10, false, source)
      breakOnHit(held.status)
      expect(held.status.sleep.time).toBe(3)
    }
  })

  it('mark adds its power per stack, up to 3 stacks', () => {
    const e = enemy()
    for (let i = 0; i < 5; i++) applyStatus(e.status, { kind: 'mark', chance: 1, duration: 4, power: 0.15 }, 10, false, 'swift')
    expect(e.status.mark.stacks).toBe(3)
    expect(hitTakenMult(e.status)).toBeCloseTo(1.45)
  })

  it('bosses are immune to confusion', () => {
    const boss = enemy({ boss: true })
    applyStatus(boss.status, { kind: 'confuse', chance: 1, duration: 3, power: 0 }, 10, true, 'swift')
    expect(boss.status.confuse.time).toBe(0)
  })
})

describe('wardOpens', () => {
  it('lets protections from different moves not chain, and the holder renew its own', () => {
    // Nothing held yet: any move opens.
    expect(wardOpens(null, null, 'protect', 0)).toBe(true)
    // Fly is up: Protect fails, Fly renews.
    expect(wardOpens({ move: 'fly', at: 5 }, 'fly', 'protect', 5)).toBe(false)
    expect(wardOpens({ move: 'fly', at: 5 }, 'fly', 'fly', 5)).toBe(true)
    // Fly just landed: Protect waits out the gap, an echo of Fly doesn't.
    expect(wardOpens({ move: 'fly', at: 5 }, null, 'protect', 5 + WARD_GAP - 0.01)).toBe(false)
    expect(wardOpens({ move: 'fly', at: 5 }, null, 'fly', 5.1)).toBe(true)
    expect(wardOpens({ move: 'fly', at: 5 }, null, 'protect', 5 + WARD_GAP)).toBe(true)
  })
})

describe('burrowTime', () => {
  it('keeps the full time under while the cycle has room', () => {
    expect(burrowTime(0.9, 7, 0.35)).toBe(0.9)
  })

  it('leaves a gap before the next takeoff however much duration and haste stack', () => {
    // The reported Fly build: 1.3 s aloft on a 1.63 s cooldown chained the landings forever.
    const cooldown = 2
    const under = burrowTime(1.3, cooldown, 0.35)
    expect(under + 0.35).toBeLessThanOrEqual(cooldown * BURROW_SHARE)
    expect(under).toBeGreaterThan(0)
  })
})
