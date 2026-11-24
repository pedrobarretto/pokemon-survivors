import { describe, expect, it } from 'vitest'
import { NO_RANKS } from './meta'
import { startGame } from './replay'
import { dropPatch, PATCH_CAP, PATCH_CEILING } from './spawn'

// Patches 20 px apart: none lands on another (`PATCH_OVERLAP`).
const patch = (i: number) => ({ move: 'fireSpin' as const, type: 'fire' as const, visual: 'modTrail' as const, x: i * 20, y: 0, shape: { kind: 'circle' as const, r: 9 }, motion: { kind: 'static' as const }, damage: 3, ttl: 1.4, hitInterval: 0.5 })

describe('patches of ground', () => {
  const game = () => {
    const g = startGame({ seed: 1, starter: 'charmander', difficulty: 'normal', ranks: NO_RANKS, shiny: false, luckyEgg: false, outbreak: null, halloween: false, bag: [], view: { w: 480, h: 270 } })
    g.attacks.length = 0
    return g
  }
  const live = (g: ReturnType<typeof game>) => g.attacks.filter((a) => a.ground && a.age < a.ttl)

  it('keeps every patch under the cap', () => {
    const g = game()
    for (let i = 0; i < PATCH_CAP; i++) dropPatch(g, patch(i)).age = 1
    expect(live(g)).toHaveLength(PATCH_CAP)
    expect(live(g).every((a) => a.damage === 3)).toBe(true)
  })

  it('a patch landing on live ground refreshes it, adding what it had left to deal', () => {
    const g = game()
    const first = dropPatch(g, patch(0))
    first.age = 0.7
    const again = dropPatch(g, { ...patch(0), x: 3 })
    expect(again).toBe(first)
    expect(live(g)).toHaveLength(1)
    expect([first.age, first.x]).toEqual([0, 0])
    expect(first.damage).toBeCloseTo(3 + 3 * 0.5, 12)
  })

  it('past the cap, the oldest spent one hands the new one what it had left to deal', () => {
    const g = game()
    for (let i = 0; i < PATCH_CAP; i++) dropPatch(g, patch(i)).age = 1.39 - i * 0.01
    const fresh = dropPatch(g, patch(100))
    expect(live(g)).toHaveLength(PATCH_CAP)
    expect(fresh.damage).toBeCloseTo(3 + (3 * 0.01) / 1.4, 12)
    expect(g.attacks.find((a) => a.x === 0)!.activeUntil).toBe(-Infinity)
  })

  it('never cuts fresh ground short of the ceiling, so one cast keeps its whole area', () => {
    const g = game()
    for (let i = 0; i < PATCH_CEILING; i++) dropPatch(g, patch(i)).age = 0.1
    expect(live(g)).toHaveLength(PATCH_CEILING)
    dropPatch(g, patch(PATCH_CEILING))
    expect(live(g)).toHaveLength(PATCH_CEILING)
  })

  it('counts each move of each player on its own', () => {
    const g = game()
    for (let i = 0; i < PATCH_CAP; i++) dropPatch(g, patch(i)).age = 1
    dropPatch(g, { ...patch(200), move: 'ember' })
    g.attacks.forEach((a) => a.move === 'fireSpin' && a.x === 0 && (a.owner = 1))
    dropPatch(g, patch(201))
    expect(live(g)).toHaveLength(PATCH_CAP + 2)
  })
})
