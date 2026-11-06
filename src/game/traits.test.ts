import { describe, expect, it } from 'vitest'
import { TRAITS } from '../data/traits'
import { createStatus } from './status'
import { absorb, blastDamage, blastRadius, createTraitState, healAmount, inBlast, isHealTarget, isWardTarget, onBeam, summonCount } from './traits'
import type { Enemy } from './types'

let nextId = 1
const enemy = (over: Partial<Enemy> = {}): Enemy => ({
  id: nextId++,
  kind: 'rattata',
  types: ['normal'],
  x: 0, y: 0, kx: 0, ky: 0,
  hp: 50, maxHp: 100,
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
  weight: 1,
  ...over,
})

describe('healer', () => {
  const healer = enemy({ kind: 'chansey', trait: createTraitState('healer', 0) })
  const r = TRAITS.healer.radius

  it('heals wounded regular allies in range, never itself, bosses, the fainting or the healthy', () => {
    expect(isHealTarget(healer, enemy({ x: r - 1 }))).toBe(true)
    expect(isHealTarget(healer, enemy({ x: r + 1 }))).toBe(false)
    expect(isHealTarget(healer, healer)).toBe(false)
    expect(isHealTarget(healer, enemy({ boss: true }))).toBe(false)
    expect(isHealTarget(healer, enemy({ dying: 0 }))).toBe(false)
    expect(isHealTarget(healer, enemy({ hp: 100 }))).toBe(false)
  })

  it('restores a share of max HP, capped at full', () => {
    expect(healAmount(enemy({ hp: 10, maxHp: 100 }))).toBe(100 * TRAITS.healer.heal)
    expect(healAmount(enemy({ hp: 95, maxHp: 100 }))).toBe(5)
  })
})

describe('shield', () => {
  it('wards allies in range (even at full HP) but not itself or bosses', () => {
    const caster = enemy({ kind: 'bronzong', trait: createTraitState('shield', 0) })
    expect(isWardTarget(caster, enemy({ hp: 100, y: TRAITS.shield.radius - 1 }))).toBe(true)
    expect(isWardTarget(caster, caster)).toBe(false)
    expect(isWardTarget(caster, enemy({ boss: true }))).toBe(false)
  })

  it('soaks damage until the ward breaks, and nothing once it fades', () => {
    const st = { ...createTraitState(undefined, 0), ward: 30, wardTime: 2 }
    expect(absorb(st, 20)).toBe(0)
    expect(absorb(st, 20)).toBe(10)
    expect(absorb(st, 20)).toBe(20)
    expect(absorb({ ...st, ward: 30, wardTime: 0 }, 20)).toBe(20)
  })
})

describe('summoner', () => {
  it('summons a few per cast, never past the cap of living summons', () => {
    const rules = { perCast: 2, max: 4 }
    expect([0, 1, 2, 3, 4, 6].map((alive) => summonCount(alive, rules))).toEqual([2, 2, 2, 1, 0, 0])
  })
})

describe('kamikaze', () => {
  it('blows up bigger with a bigger body', () => {
    expect(blastRadius(10)).toBeGreaterThan(blastRadius(6))
  })

  it('catches bodies whose edge is inside the blast', () => {
    const r = blastRadius(6)
    expect(inBlast(0, 0, r, r + 3, 0, 4)).toBe(true)
    expect(inBlast(0, 0, r, r + 5, 0, 4)).toBe(false)
  })

  it('takes a share of max HP from enemies, and only the player damage from bosses', () => {
    expect(blastDamage(enemy({ maxHp: 200 }), 25)).toBe(Math.ceil(200 * TRAITS.kamikaze.enemyDamage))
    expect(blastDamage(enemy({ maxHp: 9000, boss: true }), 25)).toBe(25)
  })
})

describe('beam', () => {
  // A beam from the origin pointing right, 100px long and 6px wide.
  const hits = (x: number, y: number, r = 2) => onBeam(0, 0, 1, 0, 100, 3, x, y, r)

  it('hits bodies along its line and misses the ones that stepped aside', () => {
    expect(hits(50, 0)).toBe(true)
    expect(hits(50, 4)).toBe(true)
    expect(hits(50, 6)).toBe(false)
  })

  it('stops at its length and never fires backwards', () => {
    expect(hits(104, 0)).toBe(true)
    expect(hits(110, 0)).toBe(false)
    expect(hits(-10, 0)).toBe(false)
  })
})
