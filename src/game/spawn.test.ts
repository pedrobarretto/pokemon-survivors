import { describe, expect, it } from 'vitest'
import { NO_RANKS } from './meta'
import { startGame } from './replay'
import { dropPatch, PATCH_CAP } from './spawn'

const patch = (x: number) => ({ move: 'fireSpin' as const, type: 'fire' as const, visual: 'modTrail' as const, x, y: 0, shape: { kind: 'circle' as const, r: 9 }, motion: { kind: 'static' as const }, damage: 3, ttl: 1.4, hitInterval: 0.5 })

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

  it('past the cap, the oldest hands the new one what it had left to deal', () => {
    const g = game()
    for (let i = 0; i < PATCH_CAP; i++) dropPatch(g, patch(i)).age = 1.4 - i * 0.01
    // The first one's life is already up (age 1.4), so the next drop only fills the cap back; past it, the oldest left had 0.01 s of its 1.4 s to go.
    const fresh = dropPatch(g, patch(100))
    expect(live(g)).toHaveLength(PATCH_CAP)
    expect(fresh.damage).toBe(3)
    const next = dropPatch(g, patch(101))
    expect(live(g)).toHaveLength(PATCH_CAP)
    expect(next.damage).toBeCloseTo(3 + (3 * 0.01) / 1.4, 12)
    expect(g.attacks.find((a) => a.x === 1)!.activeUntil).toBe(-Infinity)
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
