import { chance, range } from '../engine/rng'
import { dotDamage, drainHeal } from './combat'
import { burst } from './effects'
import { DOT_INTERVAL, dotDps, isAfflicted, SEED_HEAL, tickStatus } from './status'
import { onAnyScreen, ownerOf } from './players'
import type { Enemy, Game } from './types'

/** Cosmetic per-second particle rates and looks, emitted only for on-screen enemies. */
const PARTICLES = {
  burn: { rate: 7, colors: ['#f8d030', '#f08030', '#c03020'], speed: 8, gravity: -45, ttl: 0.55 },
  poison: { rate: 3.5, colors: ['#e0a0f8', '#a040c0', '#702890'], speed: 4, gravity: -18, ttl: 0.8 },
  paralysis: { rate: 6, colors: ['#ffffff', '#f8e030', '#f8b800'], speed: 70, gravity: 0, ttl: 0.16 },
  freeze: { rate: 3, colors: ['#ffffff', '#c8f0f8'], speed: 3, gravity: 12, ttl: 0.5 },
  seed: { rate: 4, colors: ['#a8e070', '#78c850', '#e0f8a0'], speed: 6, gravity: -24, ttl: 0.6 },
  weaken: { rate: 4, colors: ['#886030', '#a07840', '#584020'], speed: 3, gravity: 50, ttl: 0.45 },
} as const

const emitParticles = (g: Game, e: Enemy, dt: number) => {
  const st = e.status
  for (const kind of ['burn', 'poison', 'paralysis', 'freeze', 'seed', 'weaken'] as const) {
    if (st[kind].time <= 0) continue
    const p = PARTICLES[kind]
    if (!chance(g.rng, p.rate * dt)) continue
    const x = e.x + range(g.rng, -e.radius, e.radius)
    const y = e.y - range(g.rng, 2, e.radius * 2.4)
    burst(g, x, y, { colors: p.colors, count: 1, speed: p.speed, gravity: p.gravity, ttl: p.ttl, drag: 2 })
  }
}

/**
 * Ticks every enemy's conditions: timers, paralysis stutters, DoT damage and
 * status particles. Unafflicted enemies cost a few comparisons.
 */
export const updateStatuses = (g: Game, dt: number) => {
  const margin = 24
  for (const e of g.enemies) {
    if (e.dying >= 0 || !isAfflicted(e.status)) continue
    const st = e.status
    // Particles only where someone can see them.
    if (onAnyScreen(g, e.x, e.y, margin, margin * 2)) emitParticles(g, e, dt)
    const burn = dotDps(st.burn) * DOT_INTERVAL
    const poison = dotDps(st.poison) * DOT_INTERVAL
    const seed = dotDps(st.seed) * DOT_INTERVAL
    const burnMove = st.burn.move
    const poisonMove = st.poison.move
    const seedMove = st.seed.move
    // Read before the tick, which clears an affliction that runs out.
    const burnBy = st.burn.by
    const poisonBy = st.poison.by
    const seedBy = st.seed.by
    if (!tickStatus(st, dt, e.boss, g.rng)) continue
    // Each DoT acts as the player who put it on: the damage, a kill and Leech Seed's heal are theirs.
    const actor = g.player
    if (burn > 0) {
      g.player = ownerOf(g, burnBy)
      dotDamage(g, e, burn, burnMove, 'burn')
    }
    if (poison > 0 && e.dying < 0) {
      g.player = ownerOf(g, poisonBy)
      dotDamage(g, e, poison, poisonMove, 'poison')
    }
    if (seed > 0 && e.dying < 0) {
      g.player = ownerOf(g, seedBy)
      dotDamage(g, e, seed, seedMove, 'seed')
      drainHeal(g, seed, SEED_HEAL, seedMove ?? 'ability')
    }
    g.player = actor
  }
}
