import { describe, expect, it } from 'vitest'
import { smoothedRate, tierList, TIER_RULES, TIERS } from './tierList'

const cell = (runs: number, wins: number) => ({ runs, wins, minute: 10 })

describe('tier list', () => {
  it('pulls a small sample toward its difficulty’s mean, and barely moves a big one', () => {
    const small = smoothedRate(5, 5, 0.5, TIER_RULES.prior)
    expect(small).toBeGreaterThan(0.5)
    expect(small).toBeLessThan(0.65)
    expect(smoothedRate(800, 1000, 0.5, TIER_RULES.prior)).toBeCloseTo(0.79, 2)
  })

  it('ranks a proven family over a lucky small one, cuts tiers in order and holds back families without enough runs', () => {
    const list = tierList(
      {
        bulbasaur: { normal: cell(400, 320), hard: cell(200, 100), nightmare: cell(200, 30) },
        squirtle: { normal: cell(400, 200), hard: cell(200, 60), nightmare: cell(200, 10) },
        charmander: { normal: cell(400, 120), hard: cell(200, 20), nightmare: cell(200, 2) },
        pichu: { normal: cell(20, 20), hard: cell(20, 15), nightmare: cell(20, 6) },
        eevee: { normal: cell(10, 10) },
      },
      ['bulbasaur', 'squirtle', 'charmander', 'pichu', 'eevee', 'gible'],
    )
    expect(list.ranked.map((f) => f.id)).toEqual(['bulbasaur', 'pichu', 'squirtle', 'charmander'])
    const tiers = list.ranked.map((f) => TIERS.indexOf(f.tier))
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b))
    expect(list.ranked[0]!.tier).toBe('S')
    expect(list.ranked.at(-1)!.tier).toBe('D')
    expect(list.unranked).toEqual([{ id: 'eevee', runs: 10 }, { id: 'gible', runs: 0 }])
  })
})
