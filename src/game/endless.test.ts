import { describe, expect, it } from 'vitest'
import { RUN_LENGTH } from '../data/waves'
import { ENEMIES, type EnemyId } from '../data/enemies'
import { ENDLESS, endlessPressure, fitsFlyby, overtime, reaperDue, reaperHp, reaperSpeed, startEndless } from './endless'

describe('endless mode', () => {
  it('sends Arceus at 20:00, or a minute after a late Mewtwo', () => {
    expect(startEndless(RUN_LENGTH + 20).reaperAt).toBe(ENDLESS.reaperAt)
    expect(startEndless(ENDLESS.reaperAt - 10).reaperAt).toBe(ENDLESS.reaperAt + 50)
  })

  it('summons the reaper only when its time comes and none is hunting', () => {
    const s = startEndless(RUN_LENGTH + 20)
    expect(reaperDue(s, ENDLESS.reaperAt - 1)).toBe(false)
    expect(reaperDue(s, ENDLESS.reaperAt)).toBe(true)
    expect(reaperDue({ ...s, reaperId: 7 }, ENDLESS.reaperAt + 60)).toBe(false)
  })

  it('makes every new Arceus tougher, and faster the longer it hunts, up to a cap', () => {
    expect(reaperHp(1)).toBe(reaperHp(0) * ENDLESS.reaperHpGrowth)
    expect(reaperSpeed(60, 0)).toBe(60)
    expect(reaperSpeed(60, ENDLESS.reaperRamp / 2)).toBe(90)
    expect(reaperSpeed(60, 10_000)).toBe(60 * ENDLESS.reaperMaxSpeed)
  })

  it('leaves the regular 15 minutes untouched and keeps escalating past them', () => {
    expect(endlessPressure(600)).toEqual({ rate: 1, max: 1 })
    expect(endlessPressure(RUN_LENGTH)).toEqual({ rate: 1, max: 1 })
    expect(endlessPressure(RUN_LENGTH + 600).rate).toBeGreaterThan(endlessPressure(RUN_LENGTH + 300).rate)
    expect(overtime(RUN_LENGTH + 75)).toBe(75)
    expect(overtime(300)).toBe(0)
  })

  it('leads a swarm only with a flyer or a fast species, so no slow walker crawls through the screen', () => {
    const ids = Object.keys(ENEMIES) as EnemyId[]
    const flies = (id: EnemyId) => (ENEMIES[id].types as readonly string[]).includes('flying')
    const slowFlyer = ids.find((id) => flies(id) && ENEMIES[id].speed < ENDLESS.flybySpeed)
    const slowWalker = ids.find((id) => !flies(id) && ENEMIES[id].speed < ENDLESS.flybySpeed)
    const fastWalker = ids.find((id) => !flies(id) && ENEMIES[id].speed >= ENDLESS.flybySpeed)
    expect([slowFlyer, slowWalker, fastWalker].map((id) => id !== undefined && fitsFlyby(id))).toEqual([true, false, true])
  })
})
