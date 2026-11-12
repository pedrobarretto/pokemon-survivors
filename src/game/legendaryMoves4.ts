import { fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { floatText } from './effects'
import { cast, look, stats, tookB } from './legendaryMoves'
import type { MoveDef } from './moves'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import { applyStatus, type StatusSpec } from './status'

/**
 * Legendary moves, fourth batch: the Safári's legend (`SAFARI_LEGENDS` in
 * `data/legends.ts`), Manaphy's Heart Swap. Same tier and rules as the first
 * batch (`legendaryMoves.ts`): Lv1–5 with a fork at Lv4, `legendary: true`,
 * never evolve. Its art is `render/legendaryFx4.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of this batch, drawn by `render/legendaryFx4.ts`. */
export type LegendaryVisual4 = 'heartOrb' | 'heartRing'

/**
 * Heart Swap: hearts burst from a ring round Manaphy (its radius, the beat
 * between them, their speed and turn) and home in. Each one that lands swaps
 * hearts: the foe's strength drains (`weaken`) and Manaphy's might grows by
 * `might` for `buff` s. Fork A charms instead (the foe wanders, confused);
 * fork B heals `heal` of max HP per heart.
 */
export const HEART = { ring: 22, stagger: 0.05, speed: 190, turn: 8, might: 0.12, buff: 3, heal: 0.01, halo: 0.35 } as const

/** Fork A's charm: the foe wanders, confused (bosses shrug it off). */
const CHARM: StatusSpec = { kind: 'confuse', chance: 1, duration: 1.6, power: 0 }

/** Which heart a cast sends: a plain swap, a charming one (fork A) or a healing one (fork B). */
const HEART_KIND = { swap: 0, charm: 1, mend: 2 } as const

export const LEGENDARY_MOVES_4 = {
  /* Manaphy */
  heartSwap: {
    name: 'Heart Swap',
    type: 'psychic',
    legendary: true,
    base: stats({ damage: 26, cooldown: 1.8, amount: 4, speed: HEART.speed, pierce: 1, knockback: 24 }),
    status: { kind: 'weaken', chance: 1, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 7 },
      { amount: 2 },
      { fork: [{ stats: { damage: 4 } }, { stats: { amount: 2 } }] },
      { cooldown: -0.35, damage: 7 },
    ],
    onHit: (g, a, e) => {
      addMoveBuff(g, 'heartSwap', HEART.buff, { might: HEART.might })
      if (a.tier === HEART_KIND.charm && e.dying < 0) applyStatus(e.status, CHARM, 0, e.boss, 'heartSwap', g.player.slot)
      if (a.tier !== HEART_KIND.mend) return
      const p = g.player
      const healed = healPlayer(g, p.stats.maxHp * HEART.heal)
      if (healed > 0.5) floatText(g, p.x, p.y - 26, `+${dm.round(healed)}`, '#f8a8c8', true)
    },
    // Manaphy's hearts burst from a ring round it and home in on the foes: each one that lands drains the foe's strength into Manaphy's.
    fire: (g, s, owned) => {
      const p = g.player
      const kind = owned.level < 4 ? HEART_KIND.swap : tookB(owned) === 1 ? HEART_KIND.mend : HEART_KIND.charm
      for (let i = 0; i < s.amount; i++) {
        const o = fromAngle((i / s.amount) * TAU + g.time * 1.2, HEART.ring * s.area)
        const v = fromAngle((i / s.amount) * TAU, 50)
        spawnAttack(g, {
          ...look('heartSwap', 'psychic', 'heartOrb'), x: p.x + o.x, y: p.y - 10 + o.y * 0.7,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: HEART.turn, target: null },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 2.4, age: -i * HEART.stagger, tier: kind,
        })
      }
      spawnAttack(g, {
        ...look('heartSwap', 'psychic', 'heartRing'), x: p.x, y: p.y - 10,
        shape: { kind: 'circle', r: HEART.ring }, motion: { kind: 'follow', ox: 0, oy: -10 },
        damage: 0, activeFrom: Infinity, ttl: HEART.halo,
      })
      cast(g, 'heartSwap')
    },
  },
} as const satisfies Record<string, MoveDef>

export type LegendaryMove4Id = keyof typeof LEGENDARY_MOVES_4
