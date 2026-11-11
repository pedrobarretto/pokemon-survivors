import { describe, expect, it } from 'vitest'
import { behind, coinsAfter, coinsEvolve, copyRole, omenPick, rainMult, ROCKET_KIT, rocketKitDeltas } from './rocketKitRules'

describe("the Game Corner families' kits", () => {
  it("Ditto copies a foe's kind and boosts the copied type only while it holds", () => {
    expect(copyRole({ boss: true, elite: false, speed: 10 })).toBe('boss')
    expect(copyRole({ boss: false, elite: false, speed: ROCKET_KIT.transform.fastAt })).toBe('fast')
    expect(rocketKitDeltas({ kind: 'transform', dex: 0, type: 'fire', role: 'plain', left: 0 })).toEqual([])
    expect(rocketKitDeltas({ kind: 'transform', dex: 4, type: 'fire', role: 'plain', left: 3 })[0]).toEqual({ typeDamage: { fire: ROCKET_KIT.transform.typeBoost } })
  })

  it("Absol dooms the toughest foe, bosses and elites first", () => {
    expect(omenPick([{ hp: 50, boss: false, elite: false }, { hp: 30, boss: true, elite: false }])?.hp).toBe(30)
    expect(omenPick([])).toBeNull()
  })

  it("Gimmighoul's coins are capped, feed Make It Rain up to its cap and evolve it at 999", () => {
    expect(coinsAfter(ROCKET_KIT.coins.cap - 1, 50)).toBe(ROCKET_KIT.coins.cap)
    expect(coinsEvolve(998)).toBe(false)
    expect(coinsEvolve(999)).toBe(true)
    expect(rainMult(10 ** 6)).toBe(1 + ROCKET_KIT.coins.bonusCap)
  })

  it("Mawile's jaws bite behind it, and both ways as a Mega", () => {
    expect(behind(-5, 0, 1, 0, false)).toBe(true)
    expect(behind(5, 0, 1, 0, false)).toBe(false)
    expect(behind(5, 0, 1, 0, true)).toBe(true)
  })
})
