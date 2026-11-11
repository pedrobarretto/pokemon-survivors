import { range } from '../../engine/rng'
import { onFloor } from '../arenaFloor'
import { spawnHazard } from '../bosses'
import { harmBy } from '../harm'
import type { DomainHooks } from '../domainHooks'
import { anchorPlayer } from '../players'
import type { Game } from '../types'

/**
 * Groudon's magma tunnel (`data/domains/groudon.ts`) beyond its data: the
 * floor spits geysers of magma on the way ahead, and the ceiling drops rocks
 * just past the lava front as the tunnel caves in. Both are telegraphed
 * circles; their beat follows the crossing's clock, so no state is kept.
 */

/** Seconds between geysers (two at a time ahead of the player) and between rocks falling by the front. */
const GEYSER = { every: 2.6, count: 2, radius: 14, delay: 1.2, damage: 10 } as const
const ROCKFALL = { every: 1.7, radius: 12, delay: 1, damage: 9 } as const

/** True on the tick the crossing's clock passes a multiple of `every`. */
const beat = (age: number, dt: number, every: number) => Math.floor(age / every) !== Math.floor((age - dt) / every)

/** A telegraphed strike at domain-floor point (x, y) if it lands on floor. */
const strike = (g: Game, x: number, y: number, r: number, delay: number, damage: number, visual: 'fire' | 'rock') => {
  const arena = g.rift.arena
  if (!arena || !onFloor(arena.layout.floor, x - arena.x, y - arena.y, -r * 0.5)) return
  spawnHazard(g, { kind: 'strike', visual, x, y, r, damage, armAt: delay, disarmAt: delay + 0.15, ttl: delay + 0.45, by: harmBy('groudon') })
}

export const GROUDON_HOOKS: DomainHooks = {
  crossing: (g, d, dt) => {
    const arena = g.rift.arena
    if (!arena) return
    // Aimed at a player: they take turns (`anchorPlayer`).
    const p = anchorPlayer(g)
    if (beat(d.age, dt, GEYSER.every)) {
      for (let i = 0; i < GEYSER.count; i++) strike(g, p.x + range(g.rng, -46, 46), p.y - range(g.rng, 40, 120), GEYSER.radius, GEYSER.delay, GEYSER.damage, 'fire')
    }
    // Only once the front is moving and close enough to matter.
    if (beat(d.age, dt, ROCKFALL.every) && d.front - (p.y - arena.y) < 120) {
      strike(g, p.x + range(g.rng, -30, 30), arena.y + d.front - range(g.rng, 16, 50), ROCKFALL.radius, ROCKFALL.delay, ROCKFALL.damage, 'rock')
    }
  },
}
