import { describe, expect, it } from 'vitest'
import { RAID, RAID_STARS } from '../data/tera'
import { addDays } from './day'
import { createGame } from './game'
import { enterRaid, openDen, raidFits, raidOfDay, shieldTakes, updateRaid, updateRaidDen } from './teraRaid'

const DT = 1 / 60

const run = () => {
  const g = createGame('charmander', { w: 480, h: 270 }, 11)
  g.player.phase = 'playing'
  g.phase = 'playing'
  return g
}

describe('the raid of the day', () => {
  it('comes from the date alone: its stars by weekday, Stellar Terapagos on weekends', () => {
    // 2026-11-09 is a Monday.
    const week = Array.from({ length: 7 }, (_, i) => raidOfDay(addDays('2026-11-09', i)))
    expect(week.map((r) => r.stars)).toEqual([3, 4, 5, 4, 6, 7, 7])
    expect(week.slice(5)).toEqual([{ boss: 'terapagos', tera: 'stellar', stars: 7 }, { boss: 'terapagos', tera: 'stellar', stars: 7 }])
    expect(raidOfDay('2026-11-11')).toEqual(raidOfDay('2026-11-11'))
    const weekdays = Array.from({ length: 60 }, (_, i) => raidOfDay(addDays('2026-11-09', i))).filter((r) => r.stars < 7)
    expect(new Set(weekdays.map((r) => r.boss)).size).toBeGreaterThan(5)
    expect(new Set(weekdays.map((r) => r.tera)).size).toBeGreaterThan(8)
  })

  it("fits a run of the day it started or the day before (a run begun before midnight), and one that plays none", () => {
    const at = new Date('2026-11-11T15:00:00Z')
    expect([raidFits('2026-11-11', at), raidFits('2026-11-10', at), raidFits('2026-11-09', at), raidFits(undefined, at)]).toEqual([true, true, false, true])
  })
})

describe('Tera Raids', () => {
  it('opens the first den around 8:10, never draws the run rng before it, and steps the team in from its mouth', () => {
    const g = run()
    const rng = g.rng.state
    expect(Math.abs(g.raid.nextAt - RAID.slots[0])).toBeLessThanOrEqual(RAID.jitter)
    expect(g.rng.state).toBe(rng)
    g.time = g.raid.nextAt
    updateRaidDen(g, DT)
    const den = g.raid.den!
    expect(den.raid.stars).toBe(RAID.ownStars.normal)
    g.player.x = den.x
    g.player.y = den.y
    for (let t = 0; t <= RAID.enterTime + DT; t += DT) updateRaidDen(g, DT)
    expect(g.raid.arena?.raid).toEqual(den.raid)
    expect(g.enemies.find((e) => e.id === g.raid.arena!.bossId)?.types).toEqual(den.raid.tera === 'stellar' ? expect.anything() : [den.raid.tera])
  })

  it('raises the Tera shield at its HP shares; the shield takes the hit, faster on a weakness, until it breaks', () => {
    const g = run()
    g.raid.den = null
    enterRaid(g, openDen(g, { boss: 'raidGarchomp', tera: 'ice', stars: 5 }, { x: 0, y: 0 }))
    const arena = g.raid.arena!
    const boss = g.enemies.find((e) => e.id === arena.bossId)!
    expect(shieldTakes(g, boss, 100, 1, 'normal')).toBe(100)
    boss.hp = boss.maxHp * RAID_STARS[5].shields[0]
    updateRaid(g, DT)
    expect(arena.shield.up).toBe(true)
    const max = arena.shield.max
    expect(shieldTakes(g, boss, 100, 1, 'normal')).toBe(Math.round(100 * RAID.shielded))
    expect(max - arena.shield.hp).toBe(100)
    shieldTakes(g, boss, 100, 1.5, 'fire')
    expect(max - arena.shield.hp).toBe(100 + 100 * RAID.weak)
    shieldTakes(g, boss, max, 1.5, 'fire')
    expect([arena.shield.up, arena.shield.broken, boss.status.stun]).toEqual([false, RAID.broken, RAID.broken])
    expect(shieldTakes(g, boss, 100, 1, 'normal')).toBe(Math.round(100 * RAID.open))
  })

  it('pays a shard of its Tera type and a full orb when the boss falls, then lets the team out', () => {
    const g = run()
    g.raid.den = null
    enterRaid(g, openDen(g, { boss: 'raidLucario', tera: 'ghost', stars: 4 }, { x: 0, y: 0 }))
    const boss = g.enemies.find((e) => e.id === g.raid.arena!.bossId)!
    boss.dying = 0
    updateRaid(g, DT)
    expect(g.pickups.some((k) => k.kind === 'teraShard' && k.tera === 'ghost')).toBe(true)
    expect(g.player.tera.orb).toBe(1)
    expect(g.raid.cleared).toEqual([{ boss: 'raidLucario', tera: 'ghost', stars: 4, day: false }])
    for (let t = 0; t <= RAID.lootTime + DT; t += DT) updateRaid(g, DT)
    expect(g.raid.arena).toBeNull()
  })
})
