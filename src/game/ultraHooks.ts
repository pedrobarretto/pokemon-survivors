import type { DomainHooks } from './domainHooks'
import { burst } from './effects'

/**
 * The Ultra Beasts' mechanics beyond their data (`data/domains/ultra.ts`):
 * Buzzwole's muscle pump. Every `PUMP.every` s of the battle it flexes (a
 * `pump` cue) and, up to `PUMP.max` times, hits harder (its body and every
 * shot, strike and beam it throws from then on) and walks faster.
 */
export const PUMP = { every: 9, max: 4, damage: 0.12, speed: 0.06 } as const

/** Buzzwole's memo slots: pumps so far, seconds toward the next, and the last hazard id already pumped. */
const PUMPS = 0
const CLOCK = 1
const SEEN = 2

const BUZZWOLE: DomainHooks = {
  reveal: (_g, d) => {
    d.memo[PUMPS] = 0
    d.memo[CLOCK] = 0
    d.memo[SEEN] = -1
  },
  battle: (g, d, boss, dt) => {
    const pumps = d.memo[PUMPS] ?? 0
    // What it threw since the last tick hits as hard as its muscles are pumped (in here only Buzzwole throws).
    let seen = d.memo[SEEN] ?? -1
    for (const h of g.hazards) {
      if (h.id <= seen || h.world) continue
      if (pumps > 0) h.damage *= 1 + PUMP.damage * pumps
      seen = Math.max(seen, h.id)
    }
    d.memo[SEEN] = seen
    if (pumps >= PUMP.max) return
    d.memo[CLOCK] = (d.memo[CLOCK] ?? 0) + dt
    if ((d.memo[CLOCK] ?? 0) < PUMP.every) return
    d.memo[CLOCK] = 0
    d.memo[PUMPS] = pumps + 1
    boss.damage *= 1 + PUMP.damage
    boss.speed *= 1 + PUMP.speed
    boss.flash = 0.4
    burst(g, boss.x, boss.y - 14, { colors: ['#f86858', '#f8c040', '#ffffff'], count: 30, speed: 120, ttl: 0.5, gravity: 80 })
    g.events.push({ kind: 'domainCue', enemy: 'buzzwole', cue: 'pump' })
  },
}

export const ULTRA_HOOKS = { buzzwole: BUZZWOLE } as const satisfies Partial<Record<string, DomainHooks>>
