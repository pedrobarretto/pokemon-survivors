import { range } from '../../engine/rng'
import { spawnHazard } from '../bosses'
import { harmBy } from '../harm'
import type { DomainHooks } from '../domainHooks'
import { anchorPlayer } from '../players'

/**
 * Rayquaza's Sky Pillar (`data/domains/rayquaza.ts`) beyond its data: gusts
 * shear across the pillar ahead of the player, a blade of wind from one side
 * of the sky to the other, its line blinking before it cuts (sometimes two).
 * Their beat follows the crossing's clock, so no state is kept.
 */

const SHEAR = { every: 3.4, ahead: [60, 130], windup: 1.15, duration: 0.3, width: 10, damage: 9, span: 640 } as const

export const RAYQUAZA_HOOKS: DomainHooks = {
  crossing: (g, d, dt) => {
    if (Math.floor(d.age / SHEAR.every) === Math.floor((d.age - dt) / SHEAR.every) || d.age < SHEAR.every) return
    // Aimed at a player: they take turns (`anchorPlayer`).
    const p = anchorPlayer(g)
    const lines = g.rng() < 0.35 ? 2 : 1
    for (let i = 0; i < lines; i++) {
      const y = p.y - range(g.rng, SHEAR.ahead[0], SHEAR.ahead[1]) - i * 46
      // A little slanted, blowing from either side.
      const fromWest = g.rng() < 0.5
      const angle = (fromWest ? 0 : Math.PI) + range(g.rng, -0.12, 0.12)
      const dx = fromWest ? 1 : -1
      spawnHazard(g, {
        kind: 'beam', visual: 'aero', x: p.x - dx * (SHEAR.span / 2), y, r: SHEAR.width / 2, damage: SHEAR.damage, angle, len: SHEAR.span,
        armAt: SHEAR.windup, disarmAt: SHEAR.windup + SHEAR.duration, ttl: SHEAR.windup + SHEAR.duration + 0.25, by: harmBy('rayquaza'),
      })
    }
  },
}
