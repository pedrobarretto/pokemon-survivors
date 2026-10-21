import { describe, expect, it } from 'vitest'
import { EMPTY_SAVE, NO_RANKS, UPGRADE_IDS, UPGRADES, type Ranks, type Save } from './meta'
import { importAmnesty, kitBacked, kitBacking, kitCost, kitListed, selfConsistent } from './rankedKit'

const MAXED = Object.fromEntries(UPGRADE_IDS.map((id) => [id, UPGRADES[id].maxRank])) as Ranks

const saveWith = (wallet: number, ranks: Ranks, coins: number): Save => ({
  ...EMPTY_SAVE,
  wallet,
  ranks,
  achievements: { ...EMPTY_SAVE.achievements, lifetime: { ...EMPTY_SAVE.achievements.lifetime, coins } },
})

describe('ranked kit', () => {
  it('prices the ranks and the Bag items a run started with', () => {
    expect(kitCost({ ranks: NO_RANKS, lure: false, incense: false })).toBe(0)
    expect(kitCost({ ranks: MAXED, lure: false, incense: false })).toBe(72_160)
    expect(kitCost({ ranks: { ...NO_RANKS, hpUp: 2 }, lure: true, incense: true })).toBe(200 + 320 + 800 + 600)
  })

  it('backs the base, the amnesty and 5k ₽ per minute of the other ranked runs', () => {
    expect(kitBacking(0, 0)).toBe(10_000)
    expect(kitBacking(30_000, 90)).toBe(47_500)
    // A new account with a maxed kit needs a bit over 12 minutes of ranked play.
    expect(kitBacked({ cost: 72_160, backing: kitBacking(0, 12 * 60) })).toBe(false)
    expect(kitBacked({ cost: 72_160, backing: kitBacking(0, 13 * 60) })).toBe(true)
  })

  it('only keeps an unbacked run off the boards when enforcing', () => {
    const unbacked = { cost: 72_160, backing: 10_000 }
    expect(kitListed(unbacked, false)).toBe(true)
    expect(kitListed(unbacked, true)).toBe(false)
    expect(kitListed({ cost: 0, backing: 10_000 }, true)).toBe(true)
  })

  it('takes the kit of an imported save as amnesty only when its fortune fits the coins its runs picked up', () => {
    const honest = saveWith(100_000, MAXED, 50_000)
    expect(selfConsistent(honest)).toBe(true)
    expect(importAmnesty(honest)).toBe(72_160)
    const forged = saveWith(100_000_000, MAXED, 450)
    expect(selfConsistent(forged)).toBe(false)
    expect(importAmnesty(forged)).toBe(0)
    expect(importAmnesty(EMPTY_SAVE)).toBe(0)
  })
})
