import { describe, expect, it } from 'vitest'
import { createRng } from '../engine/rng'
import { RIFT, RIFT_DRAWS, type RiftLegend } from '../data/rifts'
import { EVENTS, RUN_LENGTH } from '../data/waves'
import { chargePortal, createRiftState, endlessRiftAt, pickLegend, riftAt, riftDue, riftLoot, riftScale } from './rift'

const due = { time: 300, nextAt: 210, busy: false, bossAlive: false, endless: false }

describe('rift schedule', () => {
  it('opens a portal once due, but waits while one is open or the player is in an arena', () => {
    expect(riftDue(due)).toBe(true)
    expect(riftDue({ ...due, time: 200 })).toBe(false)
    expect(riftDue({ ...due, busy: true })).toBe(false)
  })

  it('waits for a living boss to fall, but only for so long; the endless reaper always holds it', () => {
    const fight = { ...due, time: due.nextAt, bossAlive: true }
    expect(riftDue(fight)).toBe(false)
    expect(riftDue({ ...fight, time: due.nextAt + RIFT.bossWait - 1 })).toBe(false)
    expect(riftDue({ ...fight, time: due.nextAt + RIFT.bossWait })).toBe(true)
    expect(riftDue({ ...fight, time: due.nextAt + RIFT.bossWait, endless: true })).toBe(false)
  })

  it('never starts so late in a regular run that its portal could still be open for Mewtwo, but does in endless mode', () => {
    const late = { ...due, time: RUN_LENGTH - RIFT.omenTime - RIFT.portalTime }
    expect(riftDue(late)).toBe(false)
    expect(riftDue({ ...late, endless: true })).toBe(true)
  })

  /** Plays a regular run's clock second by second; each rift's omen and portal take their full time (the clock stops inside). */
  const riftsInRun = (rng: () => number, bossAlive: (time: number) => boolean) => {
    let { nextAt, slot } = createRiftState()
    let busyUntil = 0
    const opened: number[] = []
    for (let time = 0; time < RUN_LENGTH; time++) {
      if (!riftDue({ time, nextAt, busy: time < busyUntil, bossAlive: bossAlive(time), endless: false })) continue
      opened.push(time + RIFT.omenTime)
      nextAt = riftAt(++slot, rng)
      busyUntil = time + RIFT.omenTime + RIFT.portalTime
    }
    return opened
  }
  const bosses = EVENTS.flatMap((e) => (e.kind === 'boss' && e.at < RUN_LENGTH ? [e.at] : []))
  const trios = EVENTS.flatMap((e) => (e.kind === 'boss' && 'trio' in e ? [e.at] : []))

  it.each([
    ['the earliest', () => 0],
    ['the latest', () => 0.999],
  ])('gives two rifts with %s jitter, whether bosses fall at once or never, none on a trio slot', (_, rng) => {
    for (const alive of [() => false, (time: number) => bosses.some((at) => at <= time)]) {
      const opened = riftsInRun(rng, alive)
      expect(opened).toHaveLength(2)
      // A portal stays open for its full time without reaching the next trio member's arrival.
      for (const at of opened) expect(trios.some((t) => t > at - 1 && t < at + RIFT.portalTime)).toBe(false)
    }
  })

  it('keeps its own cadence in endless mode', () => {
    expect(riftAt(RIFT.slots.length, createRng(1))).toBe(Infinity)
    const next = endlessRiftAt(1000, createRng(1))
    expect(next).toBeGreaterThanOrEqual(1000 + RIFT.every - RIFT.jitter)
    expect(next).toBeLessThanOrEqual(1000 + RIFT.every + RIFT.jitter)
  })
})

describe('rift portal', () => {
  it('takes standing inside for the enter time; stepping out drains it at a quarter of the pace', () => {
    let charge = 0
    for (let i = 0; i < 30; i++) charge = chargePortal(charge, true, 1 / 60)
    expect(charge).toBeLessThan(RIFT.enterTime)
    for (let i = 0; i < 30; i++) charge = chargePortal(charge, true, 1 / 60)
    expect(charge).toBeCloseTo(RIFT.enterTime)
    expect(chargePortal(0.5, false, 0.4)).toBeCloseTo(0.4)
    expect(chargePortal(0.1, false, 1)).toBe(0)
  })

  it('lets in a player hopped out and back sooner than the enter time (Aqua Step swaying in place)', () => {
    let charge = 0
    let t = 0
    // In for 0.7 s, then out for 1.4 s, over and over.
    for (; t < 10 && charge < RIFT.enterTime; t += 1 / 60) charge = chargePortal(charge, t % 2.1 < 0.7, 1 / 60)
    expect(charge).toBeGreaterThanOrEqual(RIFT.enterTime)
    expect(t).toBeLessThan(3)
  })

  it('brings a different legendary each time until all were met', () => {
    const rng = createRng(4)
    const seen: RiftLegend[] = []
    for (let i = 0; i < RIFT_DRAWS.length; i++) seen.push(pickLegend(rng, seen))
    expect(new Set(seen).size).toBe(RIFT_DRAWS.length)
    const next = pickLegend(rng, seen)
    expect(RIFT_DRAWS.some((l) => l === next)).toBe(true)
    // Latios only ever comes along with Latias.
    expect(seen).not.toContain('latios')
  })
})

describe('rift legendary', () => {
  it('is tuned for the first rift and grows with the run clock', () => {
    expect(riftScale(RIFT.slots[0])).toEqual({ hp: 1, damage: 1 })
    expect(riftScale(0)).toEqual({ hp: 1, damage: 1 })
    expect(riftScale(RIFT.slots[0] + 240).hp).toBeCloseTo(4)
    expect(riftScale(RIFT.slots[0] + 240).damage).toBeGreaterThan(1)
  })

  it('pays more later in the run, and a shiny doubles the ₽ and adds a Poké Ball', () => {
    const sum = (v: readonly number[]) => v.reduce((a, b) => a + b, 0)
    const early = riftLoot(RIFT.slots[0], false)
    const shiny = riftLoot(RIFT.slots[0], true)
    expect(riftLoot(700, false).xp).toBeGreaterThan(early.xp)
    expect(sum(shiny.coins)).toBe(sum(early.coins) * 2)
    expect(shiny.pokeballs).toBe(early.pokeballs + 1)
    expect(early.heal).toBeGreaterThan(0)
  })
})
