import { describe, expect, it } from 'vitest'
import { createStatus } from './status'
import { createTraitState } from './traits'
import { isRenewable, oldestRenewable, RENEWAL } from './renewal'
import type { Enemy } from './types'

const camera = { x: 0, y: 0 }
const view = { w: 300, h: 200 }
const NOW = 100
const OFF = 300 + RENEWAL.margin + 1

const enemy = (over: Partial<Enemy> = {}): Enemy => ({
  id: 1,
  kind: 'rattata',
  types: ['normal'],
  x: OFF, y: 100, kx: 0, ky: 0,
  hp: 50, maxHp: 100,
  damage: 10, speed: 40, mass: 1, radius: 6, xp: 1,
  boss: false, shiny: false, elite: false, runner: false, fight: null, bornAt: 0, cooldowns: [],
  behavior: { kind: 'chase' },
  dir: 0, animTime: 0, flash: 0,
  status: createStatus(),
  trait: createTraitState(undefined, 0),
  dying: -1,
  fled: false,
  ...over,
})

describe('horde renewal', () => {
  it('only takes old regular chasers that are fully off-screen', () => {
    expect(isRenewable(enemy(), [camera], view, NOW)).toBe(true)
    expect(isRenewable(enemy({ x: 150 }), [camera], view, NOW)).toBe(false)
    expect(isRenewable(enemy({ x: 300 + RENEWAL.margin - 1 }), [camera], view, NOW)).toBe(false)
    expect(isRenewable(enemy({ bornAt: NOW - RENEWAL.minAge + 1 }), [camera], view, NOW)).toBe(false)
  })

  it('in co-op, keeps anyone still on a teammate\'s screen', () => {
    const far = enemy()
    expect(isRenewable(far, [camera, { x: far.x - 10, y: far.y - 10 }], view, NOW)).toBe(false)
  })

  it('never takes bosses, shinies, swarms, the fainting or a leaper mid-air', () => {
    const leaper = createTraitState('leaper', 0)
    if (leaper.act?.kind === 'leaper') leaper.act.phase = 'air'
    for (const over of [
      { boss: true },
      { shiny: true },
      { behavior: { kind: 'flyby', vx: 1, vy: 0, ttl: 5 } },
      { dying: 0 },
      { trait: leaper },
    ] satisfies Partial<Enemy>[]) {
      expect(isRenewable(enemy(over), [camera], view, NOW)).toBe(false)
    }
  })

  it('picks the oldest renewable one, or -1', () => {
    const horde = [enemy({ bornAt: 30 }), enemy({ bornAt: 5, x: 100 }), enemy({ bornAt: 10, y: -RENEWAL.margin - 1 }), enemy({ bornAt: 1, boss: true })]
    expect(oldestRenewable(horde, [camera], view, NOW)).toBe(2)
    expect(oldestRenewable([enemy({ x: 10 })], [camera], view, NOW)).toBe(-1)
  })
})
