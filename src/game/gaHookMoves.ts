import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { GA_HOOK_UPGRADES } from './gaHookUpgrades'
import { returnShot } from './moveKit'
import { LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN } from './moveRules'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { Game, Visual } from './types'

/**
 * The hook families' moves (`data/gaFamiliesHook.ts`): a signature each, and
 * the two Tyrogue's branches bring (Jump Kick, Triple Kick). Power Gem
 * reads Minior's shell (`kitH`). Their steps live in `gaHookUpgrades.ts`,
 * their look in `render/gaHookFx.ts`. Seeded rng and `dmath` only, and no
 * `moves.ts` at runtime (it is evaluated first): only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: PokeType, visual: Visual): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else where the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Triple Kick's three spins: seconds apart, and each one's share of the hit and of the reach (the games' 20, 40, 60). */
export const TRIPLE_KICK = { gap: 0.16, power: [1, 2, 3], reach: [0.8, 1, 1.2] } as const

/** Jump Kick's leap: how far it looks for a foe, the time aloft and the landing's ring. */
export const HIGH_JUMP_KICK = { reach: 170, air: 0.28, r: 26 } as const

export const GA_HOOK_MOVES = {
  /* Scatterbug's line: a buzz of wing-beats rolling out ahead in widening arcs, through everything it meets. */
  bugBuzz: {
    name: 'Bug Buzz',
    type: 'bug',
    base: stats({ damage: 7, cooldown: 1.6, speed: 150, knockback: 25 }),
    tags: ['sound'],
    status: { kind: 'weaken', chance: 0.2, duration: 2, power: 0.2 },
    upgrades: GA_HOOK_UPGRADES.bugBuzz,
    fire: (g, s) => {
      const p = g.player
      const angle = aimAngle(g, 220)
      const waves = s.amount + 1
      for (let i = 0; i < waves; i++) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('bugBuzz', 'bug', 'hookBuzz'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y }, grow: 18 * s.area,
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.9, age: -i * 0.14, memo: angle,
        })
      }
      cast(g, 'bugBuzz')
    },
  },

  /* Minior: gems loosed at the nearest foes. The Meteor shell throws chunks of rock; the Core, prisms that cut through more. */
  powerGem: {
    name: 'Power Gem',
    type: 'rock',
    base: stats({ damage: 9, cooldown: 1.3, amount: 2, speed: 190, pierce: 1, knockback: 30 }),
    upgrades: GA_HOOK_UPGRADES.powerGem,
    fire: (g, s) => {
      const p = g.player
      const core = p.kitH?.kind === 'shields' && p.kitH.core
      const center = aimAngle(g, 260)
      const step = core ? 0.22 : 0.34
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * step, s.speed * (core ? 1.25 : 1))
        spawnAttack(g, {
          ...look('powerGem', 'rock', 'hookGem'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: (core ? 5 : 6) * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage * (core ? 1.2 : 1), knockback: s.knockback, pierce: s.pierce + (core ? 2 : 0), status: s.status,
          ttl: 1.2, age: -i * 0.04, tier: core ? 1 : 0, flip: i % 2 === 1,
        })
      }
      cast(g, 'powerGem')
    },
  },

  /* Tyrogue's line: a quick jab at the nearest foe that makes it flinch. */
  fakeOut: {
    name: 'Fake Out',
    type: 'normal',
    base: stats({ damage: 9, cooldown: 1.2, knockback: 60 }),
    tags: ['punch'],
    status: { kind: 'paralysis', chance: 1, duration: 0.45, power: 0 },
    upgrades: GA_HOOK_UPGRADES.fakeOut,
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const e = nearestEnemy(g, p.x, p.y, 70, taken)
        if (e) taken.add(e.id)
        const angle = e ? dm.atan2(e.y - p.y, e.x - p.x) : dm.atan2(p.facing.y, p.facing.x)
        const d = fromAngle(angle, 16)
        spawnAttack(g, {
          ...look('fakeOut', 'normal', 'hookJab'), x: p.x + d.x, y: p.y - 8 + d.y,
          shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.2, activeUntil: 0.08, age: -i * 0.12, flip: dm.cos(angle) < 0, memo: angle,
        })
      }
      cast(g, 'fakeOut')
    },
  },

  /* Hitmonlee: a leap onto a foe from afar, the knee landing in a shockwave. It waits for a foe in reach. */
  jumpKick: {
    name: 'Jump Kick',
    type: 'fighting',
    base: stats({ damage: 22, cooldown: 2.6, speed: 520, knockback: 110 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: GA_HOOK_UPGRADES.jumpKick,
    fire: (g, s) => {
      const p = g.player
      const e = nearestEnemy(g, p.x, p.y, HIGH_JUMP_KICK.reach * s.area)
      if (!e) return
      const dist = dm.hypot(e.x - p.x, e.y - p.y)
      const air = Math.min(HIGH_JUMP_KICK.air, dist / s.speed)
      const d = dirTo(p.x, p.y, e.x, e.y)
      p.iframes = Math.max(p.iframes, air + LUNGE_IFRAMES)
      spawnAttack(g, {
        ...look('jumpKick', 'fighting', 'hookLeap'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'lunge', vx: d.x * (dist / Math.max(0.05, air)), vy: d.y * (dist / Math.max(0.05, air)), left: air },
        damage: s.damage * 0.4, knockback: s.knockback * 0.5, ttl: air,
      })
      spawnAttack(g, {
        ...look('jumpKick', 'fighting', 'hookKnee'), x: e.x, y: e.y - 4,
        shape: { kind: 'circle', r: HIGH_JUMP_KICK.r * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, age: -air, ttl: 0.34, activeUntil: 0.08,
      })
      cast(g, 'jumpKick')
    },
  },

  /* Hitmontop: three spinning kicks around it, each harder and wider than the last. */
  tripleKick: {
    name: 'Triple Kick',
    type: 'fighting',
    base: stats({ damage: 5, cooldown: 2, knockback: 50 }),
    upgrades: GA_HOOK_UPGRADES.tripleKick,
    fire: (g, s) => {
      const p = g.player
      TRIPLE_KICK.power.forEach((power, i) => {
        const r = 30 * TRIPLE_KICK.reach[i]! * s.area
        spawnAttack(g, {
          ...look('tripleKick', 'fighting', 'hookSpin'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: 0, oy: -8 },
          damage: s.damage * power, knockback: s.knockback * (0.6 + i * 0.3), status: s.status,
          ttl: 0.2, activeUntil: 0.1, age: -i * TRIPLE_KICK.gap, tier: i,
        })
      })
      cast(g, 'tripleKick')
    },
  },

  /* Plusle: a bolt that zips out to the nearest foe and back to its paws, hitting on both legs. */
  voltSwitch: {
    name: 'Volt Switch',
    type: 'electric',
    base: stats({ damage: 7, cooldown: 1.25, speed: 240, pierce: 2, knockback: 20 }),
    upgrades: GA_HOOK_UPGRADES.voltSwitch,
    fire: (g, s) => {
      const center = aimAngle(g, 160)
      for (let i = 0; i < s.amount; i++) returnShot(g, s, look('voltSwitch', 'electric', 'hookBolt'), center + (i - (s.amount - 1) / 2) * 0.45, 130, 6)
      cast(g, 'voltSwitch')
    },
  },

  /* Minun: a ring of strange current around it that weakens every foe it touches. */
  eerieImpulse: {
    name: 'Eerie Impulse',
    type: 'electric',
    base: stats({ damage: 5, cooldown: 1.9, knockback: 30 }),
    status: { kind: 'weaken', chance: 1, duration: 2.5, power: 0.25 },
    upgrades: GA_HOOK_UPGRADES.eerieImpulse,
    fire: (g, s) => {
      const p = g.player
      const r = 58 * s.area
      spawnAttack(g, {
        ...look('eerieImpulse', 'electric', 'hookImpulse'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 }, grow: (r - 6) / 0.32,
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.4, activeUntil: 0.32,
      })
      cast(g, 'eerieImpulse')
    },
  },
} as const satisfies Record<string, MoveDef>

export const GA_HOOK_MOVE_IDS = Object.keys(GA_HOOK_MOVES) as ReadonlyArray<keyof typeof GA_HOOK_MOVES>

