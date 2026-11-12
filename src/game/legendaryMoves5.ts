import { fromAngle, TAU } from '../engine/math'
import { OGERPON, OGERPON_MASKS } from '../data/mythicals'
import { aimAt, cast, crowdTargets, look, stats, tookB } from './legendaryMoves'
import { sweep } from './moveKit'
import type { MoveDef, MoveId } from './moves'
import { ogerponMask } from './ogerpon'
import { spawnAttack } from './spawn'
import type { StatDelta } from './stats'
import type { Game } from './types'
import { burst, shakeScreen } from './effects'
import * as dm from '../engine/dmath'

/**
 * Legendary moves, fifth batch: the capstones of the Grande Atualização's
 * mythicals (`MYTHICAL_LEGENDS` in `data/legends.ts`): Diancie's Diamond
 * Storm, Zeraora's Plasma Fists and Ogerpon's Ivy Cudgel. Same tier and rules
 * as the first batch (`legendaryMoves.ts`): Lv1–5 with a fork at Lv4,
 * `legendary: true`, never evolve. No per-tick side: every hitbox runs on the
 * regular motions. Their art is `render/legendaryFx5.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of this batch, drawn by `render/legendaryFx5.ts`. */
export type LegendaryVisual5 = 'diamondShard' | 'diamondHalo' | 'plasmaFist' | 'plasmaArc' | 'cudgelSwing' | 'cudgelSlam' | 'maskBurst'

/** Power Gem: the ring the diamonds form around the player, the beat between them (a spiral), how long they spin before flying out, and the armor each cast lends for its `duration`. */
export const DIAMOND = { ring: 18, stagger: 0.025, spin: 0.22, armor: 1, r: 5 } as const

/** Plasma Fists: how far it reaches for foes, the beat between fists, each fist's radius (× area), and the plasma arc's radius and share of the damage. */
export const PLASMA = { reach: 170, beat: 0.11, fist: 15, arc: 30, share: 0.45 } as const

/** Ivy Cudgel: the swing's reach (× area), arc and seconds, its segments and radius; the slam where it lands (radius × area, its delay); the mask's burst (share of the damage, and how many blows ring the slam). */
export const CUDGEL = { reach: 58, arc: 2.2, time: 0.16, segments: 6, r: 10, slam: 28, delay: 0.16, share: 0.6, ring: 6 } as const

/** Puts (or refreshes) `move`'s timed stat effect on the acting player, as `addMoveBuff` does (kept here so this module stays clear of `signatureMoves.ts`). */
const buff = (g: Game, move: MoveId, seconds: number, delta: StatDelta) => {
  const p = g.player
  const i = p.moveBuffs.findIndex((b) => b.move === move)
  if (i >= 0) p.moveBuffs.splice(i, 1)
  p.moveBuffs.push({ move, left: seconds, stats: delta, applied: false })
}

/** Whether the acting player's legend wears its second awakening's form (Mega Diancie, Mega Zeraora). */
const megaForm = (g: Game) => (g.player.legend?.awakened ?? 0) >= 2

export const LEGENDARY_MOVES_5 = {
  /* Diancie */
  powerGem: {
    name: 'Power Gem',
    type: 'rock',
    legendary: true,
    base: stats({ damage: 30, cooldown: 2.8, amount: 8, speed: 170, knockback: 40, duration: 3 }),
    upgrades: [
      { damage: 8 },
      { amount: 2 },
      { fork: [{ stats: { amount: 4, damage: -2 } }, { stats: { duration: 2, damage: 6 } }] },
      { cooldown: -0.4, damage: 8 },
    ],
    // Diamonds spiral out of a glittering whirl around Diancie and fly out at every side; each cast hardens its guard for a while
    // (the games' Power Gem raises Defense). Mega Diancie's whirl throws a second spiral the other way.
    fire: (g, s) => {
      const p = g.player
      const spirals = megaForm(g) ? 2 : 1
      const start = g.time * 2.3
      for (let k = 0; k < spirals; k++) {
        const dir = k === 0 ? 1 : -1
        for (let i = 0; i < s.amount; i++) {
          const a = start + dir * (i / s.amount) * TAU
          const at = fromAngle(a, DIAMOND.ring * s.area)
          const v = fromAngle(a + dir * 0.35, s.speed)
          spawnAttack(g, {
            ...look('powerGem', 'rock', 'diamondShard'), x: p.x + at.x, y: p.y - 8 + at.y * 0.8,
            shape: { kind: 'circle', r: DIAMOND.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
            damage: s.damage, knockback: s.knockback, pierce: 2, ttl: 1.4, age: -(DIAMOND.spin + i * DIAMOND.stagger + k * 0.1), memo: a, tier: (i + k) % 3,
          })
        }
      }
      spawnAttack(g, {
        ...look('powerGem', 'rock', 'diamondHalo'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: DIAMOND.ring }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: 0, activeFrom: Infinity, ttl: DIAMOND.spin + s.amount * DIAMOND.stagger + 0.25, memo: DIAMOND.ring * s.area, flip: spirals > 1,
      })
      buff(g, 'powerGem', s.duration, { armor: DIAMOND.armor * (megaForm(g) ? 2 : 1) })
      cast(g, 'powerGem')
    },
  },

  /* Zeraora */
  plasmaFists: {
    name: 'Plasma Fists',
    type: 'electric',
    legendary: true,
    tags: ['punch'],
    base: stats({ damage: 40, cooldown: 2.2, amount: 3, knockback: 60 }),
    status: { kind: 'paralysis', chance: 0.15, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 10 },
      { amount: 1 },
      { fork: [{ stats: { amount: 2, damage: -4 } }, { stats: { damage: 12, statusChance: 0.2 } }] },
      { cooldown: -0.4, damage: 10 },
    ],
    // Zeraora flashes from foe to foe: a fist of plasma lands on each of the crowds in reach, one after another, and the plasma
    // it charges the air with arcs out around each blow. Mega Zeraora's fists strike twice.
    fire: (g, s) => {
      const p = g.player
      const foes = crowdTargets(g, s.amount, 26, PLASMA.reach)
      const twice = megaForm(g) ? 2 : 1
      const aim = aimAt(g, PLASMA.reach)
      for (let i = 0; i < s.amount; i++) {
        const foe = foes[i]
        const ahead = fromAngle(aim + (i - (s.amount - 1) / 2) * 0.5, 46)
        const x = foe ? foe.x : p.x + ahead.x
        const y = foe ? foe.y - foe.radius * 0.5 : p.y - 8 + ahead.y
        for (let j = 0; j < twice; j++) {
          const age = -(i + j * s.amount) * PLASMA.beat
          spawnAttack(g, {
            ...look('plasmaFists', 'electric', 'plasmaFist'), x, y,
            shape: { kind: 'circle', r: PLASMA.fist * s.area }, motion: { kind: 'static' },
            damage: s.damage, knockback: s.knockback, status: s.status, age, ttl: 0.3, activeUntil: 0.06, memo: dm.atan2(y - p.y, x - p.x), flip: j === 1,
          })
          spawnAttack(g, {
            ...look('plasmaFists', 'electric', 'plasmaArc'), x, y,
            shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
            damage: s.damage * PLASMA.share, knockback: 20, age: age - 0.04, ttl: 0.34, activeUntil: 0.12, grow: (PLASMA.arc * s.area - 8) / 0.12, tier: dm.round(PLASMA.arc * s.area),
          })
        }
      }
      cast(g, 'plasmaFists')
    },
  },

  /* Ogerpon */
  ivyCudgel: {
    name: 'Ivy Cudgel',
    type: 'grass',
    legendary: true,
    base: stats({ damage: 62, cooldown: 2, area: 1, knockback: 110 }),
    upgrades: [
      { damage: 14 },
      { area: 0.15 },
      { fork: [{ stats: { area: 0.25 } }, { stats: { damage: 18 } }] },
      { cooldown: -0.3, damage: 14 },
    ],
    // Ogerpon swings its cudgel overhead and brings it down ahead: an arc, then a slam where it lands, in its mask's type (the
    // Teal Mask's Grass, Wellspring's Water, Hearthflame's Fire, Cornerstone's Rock). Terastallized (its Embody Aspect) the slam
    // bursts in the mask's element all around where it lands.
    fire: (g, s, owned) => {
      const p = g.player
      const mask = ogerponMask(p)
      const def = OGERPON_MASKS[mask]
      const type = def.type
      const aim = aimAt(g, 140)
      const reach = CUDGEL.reach * s.area
      const dir = tookB(owned) === 1 ? -1 : 1
      const from = aim - (dir * CUDGEL.arc) / 2
      sweep(g, s, look('ivyCudgel', type, 'hitbox'), { from, arc: dir * CUDGEL.arc, time: CUDGEL.time, length: reach, segments: CUDGEL.segments, r: CUDGEL.r, inner: 12 })
      spawnAttack(g, {
        ...look('ivyCudgel', type, 'cudgelSwing'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 4 }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: 0, activeFrom: Infinity, ttl: CUDGEL.time + 0.12, memo: from, tier: dm.round(reach), flip: dir < 0,
      })
      const land = fromAngle(aim, reach * 0.8)
      const x = p.x + land.x
      const y = p.y - 6 + land.y
      const r = CUDGEL.slam * s.area
      spawnAttack(g, {
        ...look('ivyCudgel', type, 'cudgelSlam'), x, y,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, age: -CUDGEL.delay, ttl: 0.32, activeUntil: 0.1, grow: (r - 8) / 0.1, tier: dm.round(r),
      })
      const tera = p.tera.active > 0
      if (tera) {
        // Embody Aspect: the mask's element bursts all around the slam.
        const ring = OGERPON.burst * s.area
        for (let i = 0; i < CUDGEL.ring; i++) {
          const o = fromAngle(aim + (i / CUDGEL.ring) * TAU, ring)
          spawnAttack(g, {
            ...look('ivyCudgel', type, 'maskBurst'), x: x + o.x, y: y + o.y * 0.8,
            shape: { kind: 'circle', r: 13 * s.area }, motion: { kind: 'static' },
            damage: s.damage * CUDGEL.share, knockback: s.knockback * 0.5, age: -(CUDGEL.delay + 0.06 + i * 0.03), ttl: 0.42, activeUntil: 0.1, memo: i,
          })
        }
        burst(g, x, y, { colors: [...def.colors], count: 14, speed: 120, ttl: 0.5, size: 2 })
        shakeScreen(g, 3)
      } else shakeScreen(g, 1.5)
      cast(g, 'ivyCudgel')
    },
  },
} as const satisfies Record<string, MoveDef>

export type LegendaryMove5Id = keyof typeof LEGENDARY_MOVES_5
