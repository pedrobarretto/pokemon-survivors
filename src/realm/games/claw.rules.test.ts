import { describe, expect, it } from 'vitest'
import { CLAW, creditPrice, gripNeeded, gripOn, pitLayout, resolveDrop, weeklyPrizes } from './claw.rules'

const WEEK = '2026-11-09'
const EXCLUSIVES = ['mimikyu', 'morpeko', 'tandemaus']
const POOL = [...EXCLUSIVES, ...Array.from({ length: 40 }, (_, i) => `family${i}`)]
const none = Array<number>(CLAW.prizes).fill(0)

const missesOn = (i: number, n: number) => none.map((m, k) => (k === i ? n : m))

describe('weekly rotation', () => {
  it('is the same all week, six different plushes, exactly one exclusive', () => {
    const prizes = weeklyPrizes(WEEK, POOL, EXCLUSIVES)
    expect(weeklyPrizes(WEEK, POOL, EXCLUSIVES)).toEqual(prizes)
    expect(new Set(prizes).size).toBe(CLAW.prizes)
    expect(prizes.filter((p) => EXCLUSIVES.includes(p))).toHaveLength(1)
  })

  it('brings every exclusive within three weeks', () => {
    const weeks = ['2026-11-09', '2026-11-16', '2026-11-23']
    const seen = weeks.map((w) => weeklyPrizes(w, POOL, EXCLUSIVES).find((p) => EXCLUSIVES.includes(p)))
    expect(new Set(seen).size).toBe(3)
  })
})

describe('centering', () => {
  it('is 1 dead on and 0 at the reach', () => {
    expect(gripOn({ x: 50, y: 50 }, { x: 50, y: 50 })).toBe(1)
    expect(gripOn({ x: 50 + CLAW.reach, y: 50 }, { x: 50, y: 50 })).toBe(0)
  })

  it('goes for the nearest plush and wins a centered first try', () => {
    const layout = pitLayout(WEEK, none, 123)
    const got = resolveDrop(layout[2]!, layout, none)
    expect(got).toEqual({ target: 2, grip: 1, won: true })
  })

  it('needs less after every miss', () => {
    for (let m = 1; m < CLAW.guarantee; m++) expect(gripNeeded(m)).toBeLessThan(gripNeeded(m - 1))
  })

  it('keeps a sloppy first try from winning', () => {
    const layout = pitLayout(WEEK, none, 123)
    const off = { x: layout[0]!.x + CLAW.reach / 2, y: layout[0]!.y }
    expect(resolveDrop(off, layout, none).won).toBe(false)
  })
})

describe('the guarantee', () => {
  it('wins the tenth credit on a plush from anywhere in the pit', () => {
    for (let target = 0; target < CLAW.prizes; target++) {
      const misses = missesOn(target, CLAW.guarantee - 1)
      const layout = pitLayout(WEEK, misses, 77)
      for (let i = 0; i < CLAW.prizes; i++) {
        const near = layout[target]!
        const off = { x: near.x + (i - 3) * 2, y: near.y - i }
        const got = resolveDrop(off, layout, misses)
        if (got.target === target) expect(got.won).toBe(true)
      }
      expect(gripNeeded(misses[target]!)).toBe(0)
    }
  })

  it('needs at most ten credits aiming at one plush, even dropping badly', () => {
    let misses = [...none]
    let credits = 0
    let won = false
    while (!won && credits < 20) {
      credits++
      const layout = pitLayout(WEEK, misses, credits * 991)
      // As far off center as still goes for this plush.
      const got = resolveDrop({ x: layout[1]!.x + CLAW.reach * 0.95, y: layout[1]!.y }, layout, misses)
      const t = got.target
      won = got.won
      if (!won) misses = misses.map((m, k) => (k === t ? m + 1 : m))
    }
    expect(won).toBe(true)
    expect(credits).toBeLessThanOrEqual(CLAW.guarantee)
  })
})

describe('the nudge', () => {
  it('brings a missed plush closer to the chute, and only that one', () => {
    const before = pitLayout(WEEK, none, 0)
    const after = pitLayout(WEEK, missesOn(4, 5), 0)
    const toChute = (p: { x: number; y: number }) => Math.hypot(CLAW.chute.x - p.x, CLAW.chute.y - p.y)
    expect(toChute(after[4]!)).toBeLessThan(toChute(before[4]!))
    after.forEach((p, i) => i !== 4 && expect(p).toEqual(before[i]))
  })
})

describe('credits', () => {
  it('prices the first free, the rest paid, and stops at the cap', () => {
    expect(creditPrice(0)).toBe(0)
    expect(creditPrice(1)).toBe(CLAW.price)
    expect(creditPrice(CLAW.dailyCap - 1)).toBe(CLAW.price)
    expect(creditPrice(CLAW.dailyCap)).toBeNull()
  })
})
