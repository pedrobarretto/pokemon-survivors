import { describe, expect, it } from 'vitest'
import { SAFARI, applyAction, catchChanceOf, startRun, type SafariAction, type SafariRarity, type SafariRun } from './safari.rules'
import { SAFARI_PLANS, chainOdds, planChance, type SafariPlan } from './safariOdds'

const RARITIES: readonly SafariRarity[] = ['common', 'rare', 'ultra', 'special']

/** A small seeded generator (mulberry32), so the sampled runs below are the same every time. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return ((r ^ (r >>> 14)) >>> 0) / 4294967296
}

/** The plans as moves on a real run, to play them through `applyAction`. */
const move = (plan: SafariPlan, run: SafariRun<string>, step: number): SafariAction['kind'] => {
  const e = run.encounter!
  if (plan === 'rock') return e.mood === 'angry' ? 'ball' : 'rock'
  if (plan === 'baitBerries' && step === 0) return 'bait'
  return plan !== 'balls' && run.berries > 0 && e.calm < SAFARI.maxCalm ? 'berry' : 'ball'
}

/** The share of `n` encounters `plan` catches, played through the rules with seeded dice. */
const sampled = (rarity: SafariRarity, plan: SafariPlan, n: number) => {
  const next = seeded(7)
  let caught = 0
  for (let i = 0; i < n; i++) {
    let run = applyAction(startRun([{ family: 'x', rarity, level: 5, sure: false }], []), { kind: 'grass' }, next)!.run
    for (let step = 0; run.encounter; step++) {
      const got = applyAction(run, { kind: move(plan, run, step) } as SafariAction, next)!
      if (got.turn.kind === 'ball' && got.turn.caught) caught++
      run = got.run
    }
  }
  return caught / n
}

describe('planChance', () => {
  it('is a single ball’s chance with one ball and nothing else', () => {
    for (const rarity of RARITIES) expect(planChance(rarity, 'balls', 1, 0)).toBeCloseTo(catchChanceOf(rarity, 0), 12)
  })

  it('matches the rules played out', () => {
    for (const plan of SAFARI_PLANS) expect(planChance('rare', plan)).toBeCloseTo(sampled('rare', plan, 40_000), 2)
  })

  // The guide's tips say so (`safariGuide.ts`): if a retune breaks one, rewrite the tip.
  it('ranks the plans as the guide’s tips tell them, for every rarity', () => {
    for (const rarity of RARITIES) {
      const [balls, berries, baitBerries, rock] = SAFARI_PLANS.map((plan) => planChance(rarity, plan))
      expect(baitBerries).toBeGreaterThan(berries!)
      expect(berries).toBeGreaterThan(balls!)
      expect(rock).toBeGreaterThan(balls!)
      if (rarity !== 'common') expect(rock).toBeLessThan(berries!)
    }
  })
})

describe('chainOdds', () => {
  it('starts at the base odds and climbs with the chain', () => {
    const odds = chainOdds()
    expect(odds[0]).toEqual({ n: 1, oneIn: Math.round(1 / SAFARI.shinyOdds) })
    expect(odds).toHaveLength(SAFARI.chainBoost.length)
    for (let i = 1; i < odds.length; i++) expect(odds[i]!.oneIn).toBeLessThan(odds[i - 1]!.oneIn)
  })
})
