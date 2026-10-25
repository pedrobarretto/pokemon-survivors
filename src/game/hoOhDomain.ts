import { range } from '../engine/rng'
import { HO_OH_DOMAIN } from '../data/domains/hoOh'
import { spawnHazard } from './bosses'
import { harmBy } from './harm'
import type { DomainHooks } from './domainHooks'
import { anchorPlayer } from './players'
import { burst, shakeScreen } from './effects'
import * as dm from '../engine/dmath'

/**
 * Ho-Oh's hooks: in the burning Bell Tower, beams fall from the ceiling on
 * the player's path and the fire spreads where they land; on the roof, its
 * rebirth (`BossPhase.rebirth`, phase 3) bursts into flames and refills its
 * HP over the phase's opening. `memo[0]`: seconds until the next beam;
 * `memo[1]`: beams fallen.
 */
/** Ho-Oh signs its tower's falling fire (`Hazard.by`). */
const HO_OH = harmBy('hoOh')

export const HO_OH_FALL = {
  /** Seconds between falling beams, and how long their warning lasts. */
  every: 1.9,
  delay: 1.2,
  /** How far along the player's path a beam aims (seconds of their walk), and the fire it leaves. */
  lead: 0.9,
  fire: 4.2,
  /** At most this many burning patches at once. */
  max: 22,
} as const

/** The rebirth phase (from 0), how long its opening lasts and the share of HP it comes back with. */
const REBIRTH = HO_OH_DOMAIN.phases.findIndex((ph) => ph.rebirth !== undefined)
const REBORN = HO_OH_DOMAIN.phases[REBIRTH]!

export const HO_OH_HOOKS: DomainHooks = {
  crossing: (g, d, dt) => {
    d.memo[0] = (d.memo[0] ?? 2.5) - dt
    if (d.memo[0] > 0) return
    d.memo[0] += HO_OH_FALL.every
    d.memo[1] = (d.memo[1] ?? 0) + 1
    let fires = 0
    for (const h of g.hazards) if (h.kind === 'zone' && h.visual === 'fire') fires++
    // Aimed at a player: they take turns (`anchorPlayer`).
    const p = anchorPlayer(g)
    // Every other beam falls in the hall ahead instead, so the fire spreads up the tower.
    const ahead = d.memo[1] % 2 === 0
    const x = ahead ? p.x + range(g.rng, -60, 60) : p.x + p.vx * HO_OH_FALL.lead
    const y = ahead ? p.y - range(g.rng, 70, 120) : p.y + p.vy * HO_OH_FALL.lead
    spawnHazard(g, { kind: 'strike', visual: 'fire', x, y, r: 12, damage: 10, armAt: HO_OH_FALL.delay, disarmAt: HO_OH_FALL.delay + 0.15, ttl: HO_OH_FALL.delay + 0.45, by: HO_OH })
    if (fires < HO_OH_FALL.max) {
      const end = HO_OH_FALL.delay + HO_OH_FALL.fire
      spawnHazard(g, { kind: 'zone', visual: 'fire', x, y, r: 11, damage: 8, armAt: HO_OH_FALL.delay, disarmAt: end - 0.3, ttl: end, by: HO_OH })
    }
  },
  phase: (g, _d, boss, phase) => {
    if (phase !== REBIRTH) return
    // It fell: a pillar of flame takes it, and it rises again from its ashes.
    boss.hp = 1
    burst(g, boss.x, boss.y - boss.radius, { colors: ['#f83018', '#f8a020', '#fff0a0', '#ffffff'], count: 120, speed: 240, ttl: 0.9, size: 2, gravity: -60 })
    g.flash = Math.max(g.flash, 0.8)
    shakeScreen(g, 12, 'team')
    g.events.push({ kind: 'quake' })
  },
  battle: (g, _d, boss) => {
    const f = boss.fight
    if (!f || f.phase !== REBIRTH || f.shift <= 0) return
    // The HP bar fills back up as it rises from the ashes.
    boss.hp = Math.max(1, dm.round(boss.maxHp * (REBORN.rebirth ?? 0.5) * Math.min(1, 1 - f.shift / (REBORN.shift ?? 1))))
    if (f.shift < 1.2 && g.rng() < 0.4) burst(g, boss.x + range(g.rng, -12, 12), boss.y - 4, { colors: ['#f8e070', '#f85030', '#70d0f8', '#78e048'], count: 2, speed: 60, ttl: 0.6, gravity: -80 })
  },
}
