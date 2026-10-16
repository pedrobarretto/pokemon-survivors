import { chance, range } from '../engine/rng'
import { dotDamage } from './combat'
import { burst } from './effects'
import { DOT_INTERVAL, dotDps, isAfflicted, tickStatus } from './status'
import { onAnyScreen } from './players'
import type { Enemy, Game } from './types'

/** Cosmetic per-second particle rates and looks, emitted only for on-screen enemies. */
const PARTICLES = {
  burn: { rate: 7, colors: ['#f8d030', '#f08030', '#c03020'], speed: 8, gravity: -45, ttl: 0.55 },
  poison: { rate: 3.5, colors: ['#e0a0f8', '#a040c0', '#702890'], speed: 4, gravity: -18, ttl: 0.8 },
  paralysis: { rate: 6, colors: ['#ffffff', '#f8e030', '#f8b800'], speed: 70, gravity: 0, ttl: 0.16 },
} as const

const emitParticles = (g: Game, e: Enemy, dt: number) => {
  const st = e.status
  for (const kind of ['burn', 'poison', 'paralysis'] as const) {
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
    if (onAnyScreen(g, e.x, e.y, margin, margin * 2)) emitParticles(g, e, dt)
    const burn = dotDps(st.burn) * DOT_INTERVAL
    const poison = dotDps(st.poison) * DOT_INTERVAL
    const burnMove = st.burn.move
    const poisonMove = st.poison.move
    const burnBy = st.burn.by
    const poisonBy = st.poison.by
    if (!tickStatus(st, dt, e.boss, g.rng)) continue
    if (burn > 0) dotDamage(g, e, burn, burnMove, 'burn', burnBy)
    if (poison > 0 && e.dying < 0) dotDamage(g, e, poison, poisonMove, 'poison', poisonBy)
  }
}
