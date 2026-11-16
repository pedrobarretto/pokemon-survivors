import { range } from '../engine/rng'
import { spawnHazard } from './bosses'
import { harmBy } from './harm'
import type { DomainHooks } from './domainHooks'
import { anchorPlayer } from './players'

/**
 * Deoxys's crossing (`data/domains/deoxys.ts`): a meteor shower over the
 * drifting rocks, small meteors falling around the player and now and then a
 * big one on their path.
 */
const SHOWER = { every: 1.05, delay: 1.3, radius: 13, damage: 12, bigEvery: 5, bigRadius: 26, bigDamage: 20 } as const

export const DEOXYS_HOOKS: DomainHooks = {
  crossing: (g, d, dt) => {
    const n = Math.floor(d.age / SHOWER.every)
    if (n === Math.floor((d.age - dt) / SHOWER.every) || d.age < 2) return
    // Aimed at a player: they take turns (`anchorPlayer`).
    const p = anchorPlayer(g)
    const big = n % SHOWER.bigEvery === 0
    const x = big ? p.x + p.vx * SHOWER.delay : p.x + range(g.rng, -90, 90)
    const y = big ? p.y + p.vy * SHOWER.delay : p.y + range(g.rng, -130, 30)
    const r = big ? SHOWER.bigRadius : SHOWER.radius
    spawnHazard(g, { kind: 'strike', visual: 'rock', x, y, r, damage: big ? SHOWER.bigDamage : SHOWER.damage, armAt: SHOWER.delay, disarmAt: SHOWER.delay + 0.15, ttl: SHOWER.delay + 0.45, by: harmBy('deoxys') })
  },
}
