import { dirTo, fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { atStage, clawLink, clawPower, crossReady, KIT_F } from './fossilKitRules'
import { kitFFirstStrike } from './fossilKitSystem'
import { FOSSIL_KIT_UPGRADES } from './fossilKitUpgrades'
import { strike, sweep } from './moveKit'
import { LUNGE_IFRAMES, LUNGE_MIN_COOLDOWN } from './moveRules'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { isAlive, nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import type { Enemy, Game, Visual } from './types'
import { unseen } from './versusRules'

/**
 * The fossil families' signatures, one per family (`data/gaFossils.ts`).
 * Several read the family's mechanic in `fire` (Omastar's Shell Smash,
 * Cradily's roots, Armaldo's claw combo) or answer a first strike in
 * `onHit` (Bolt Beak, Icicle Crash, Fishious Rend). Their steps live in
 * `fossilKitUpgrades.ts`, their look in `render/fossilKitFx.ts`. Seeded rng
 * and `dmath` only, and no `moves.ts` at runtime (it is evaluated first):
 * only its types.
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

/**
 * The nearest foe within `reach` that still has all its HP (a first strike's
 * prey), else the nearest of any. An Arena cast aims as every move does.
 */
const freshPrey = (g: Game, reach: number): Enemy | null => {
  const p = g.player
  if (p.versus) return nearestEnemy(g, p.x, p.y, reach)
  let best: Enemy | null = null
  let bestD = reach * reach
  for (const e of g.enemies) {
    if (!isAlive(e) || unseen(g, e) || e.hp < e.maxHp) continue
    const d = dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best ?? nearestEnemy(g, p.x, p.y, reach)
}

/** A dash that carries the player into `target` (else ahead), with a moment of i-frames. */
const lungeInto = (g: Game, s: CastStats, l: Look, target: Enemy | null, r: number) => {
  const p = g.player
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  const v = fromAngle(dm.atan2(d.y, d.x), s.speed)
  p.iframes = Math.max(p.iframes, LUNGE_IFRAMES)
  return spawnAttack(g, {
    ...l, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'lunge', vx: v.x, vy: v.y, left: 0.2 },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.26,
  })
}

/** First strikes land double (Bolt Beak, Fishious Rend). */
const FIRST_STRIKE = [{ when: 'unhurt', mult: 2 }] as const

export const FOSSIL_KIT_MOVES = {
  /* Aerodactyl: both wings cleave ahead at once, two blades of rock-hard wind crossing in front. */
  wingAttack: {
    name: 'Wing Attack',
    type: 'flying',
    base: stats({ damage: 10, cooldown: 1.3, knockback: 50 }),
    tags: ['slice'],
    upgrades: FOSSIL_KIT_UPGRADES.wingAttack,
    fire: (g, s) => {
      const angle = aimAngle(g, 90)
      const l = look('wingAttack', 'flying', 'kitFWing')
      sweep(g, s, l, { from: angle - 1.2, arc: 1.2, time: 0.16, length: 40 * s.area, segments: 4, r: 8 })
      sweep(g, s, l, { from: angle + 1.2, arc: -1.2, time: 0.16, length: 40 * s.area, segments: 4, r: 8 })
      cast(g, 'wingAttack')
    },
  },

  /* Omanyte's line: a volley of shell spikes in a fan. With the shell smashed, more spikes fly. */
  spikeCannon: {
    name: 'Spike Cannon',
    type: 'normal',
    base: stats({ damage: 5, cooldown: 1.2, amount: 3, speed: 230, pierce: 1, knockback: 18 }),
    upgrades: FOSSIL_KIT_UPGRADES.spikeCannon,
    fire: (g, s) => {
      const p = g.player
      const kit = p.kitF
      const smashed = kit?.kind === 'smash' && kit.left > 0
      const amount = s.amount + (smashed ? KIT_F.smash.cannon : 0)
      const center = aimAngle(g, 240)
      for (let i = 0; i < amount; i++) {
        const v = fromAngle(center + (i - (amount - 1) / 2) * 0.2, s.speed)
        spawnAttack(g, {
          ...look('spikeCannon', 'normal', 'kitFSpike'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 1.1, age: -i * 0.04, tier: smashed ? 1 : 0,
        })
      }
      cast(g, 'spikeCannon')
    },
  },

  /* Lileep's line: roots burst up under the nearest foes and hold them. Rooted, they bite harder and wider. */
  ingrain: {
    name: 'Ingrain',
    type: 'grass',
    base: stats({ damage: 9, cooldown: 1.6, amount: 2, knockback: 10 }),
    status: { kind: 'slow', chance: 1, duration: 1.2, power: 0.5 },
    upgrades: FOSSIL_KIT_UPGRADES.ingrain,
    fire: (g, s) => {
      const p = g.player
      const kit = p.kitF
      const rooted = kit?.kind === 'roots' && kit.rooted
      const fired = rooted ? { ...s, damage: s.damage * KIT_F.roots.ingrain } : s
      const r = (rooted ? 18 : 14) * s.area
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const e = nearestEnemy(g, p.x, p.y, 200, taken)
        if (e) taken.add(e.id)
        const angle = (i / Math.max(1, s.amount)) * TAU
        const at = e ?? { x: p.x + dm.cos(angle) * 50, y: p.y + dm.sin(angle) * 35, radius: 0 }
        strike(g, fired, look('ingrain', 'grass', 'kitFRoot'), at.x, at.y, r, 0.35 + i * 0.07, 0.42).tier = rooted ? 1 : 0
      }
      cast(g, 'ingrain')
    },
  },

  /* Anorith's line: a claw raked across what's ahead that cracks its guard (marks it). Landing in a row builds the combo; Armaldo spends a full one on a cross cleave. */
  crushClaw: {
    name: 'Crush Claw',
    type: 'normal',
    base: stats({ damage: 11, cooldown: 1.35, knockback: 40 }),
    status: { kind: 'mark', chance: 0.5, duration: 3, power: 0.1 },
    tags: ['slice'],
    upgrades: FOSSIL_KIT_UPGRADES.crushClaw,
    onHit: (g) => {
      const kit = g.player.kitF
      if (kit?.kind !== 'claws' || kit.landed) return
      kit.landed = true
      kit.links = clawLink(kit.links, g.player.stage)
      kit.left = KIT_F.claws.window
    },
    fire: (g, s) => {
      const p = g.player
      const kit = p.kitF?.kind === 'claws' ? p.kitF : null
      const angle = aimAngle(g, 90)
      if (kit && crossReady(kit.links, p.stage)) {
        // The full combo: Armaldo's two claws cross in an X all around it.
        const C = KIT_F.claws.cross
        const r = atStage(C.r, p.stage) * s.area
        spawnAttack(g, {
          ...look('crushClaw', 'normal', 'kitFCross'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: -8 }, grow: (r - 10) / 0.14,
          damage: s.damage * C.power, knockback: s.knockback * 1.6, status: s.status, ttl: 0.34, activeUntil: 0.14,
        })
        kit.links = 0
        kit.left = 0
        kit.landed = true
        g.events.push({ kind: 'quake' })
      } else {
        const power = kit ? clawPower(kit.links) : 1
        if (kit) kit.landed = false
        sweep(g, { ...s, damage: s.damage * power }, look('crushClaw', 'normal', 'kitFClaw'), { from: angle - 0.9, arc: 1.8, time: 0.14, length: 32 * s.area, segments: 3, r: 9 })
      }
      cast(g, 'crushClaw')
    },
  },

  /* Dracozolt: a charging beak of lightning into the nearest unhurt foe: first strikes land double and charge its tail. */
  boltBeak: {
    name: 'Bolt Beak',
    type: 'electric',
    base: stats({ damage: 10, cooldown: 1.6, speed: 280, knockback: 46 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    tags: ['bite'],
    upgrades: FOSSIL_KIT_UPGRADES.boltBeak,
    onHit: (g, _a, _e, unhurt) => {
      if (unhurt) kitFFirstStrike(g)
    },
    fire: (g, s) => {
      lungeInto(g, s, look('boltBeak', 'electric', 'kitFBeak'), freshPrey(g, 150), 12).bonus = FIRST_STRIKE
      cast(g, 'boltBeak')
    },
  },

  /* Arctozolt: icicles crash down on the nearest foes; an unhurt one freezes, so the next hit lands double. */
  icicleCrash: {
    name: 'Icicle Crash',
    type: 'ice',
    base: stats({ damage: 10, cooldown: 1.7, amount: 2, knockback: 30 }),
    upgrades: FOSSIL_KIT_UPGRADES.icicleCrash,
    onHit: (g, _a, e, unhurt) => {
      if (unhurt && e.hp > 0) applyStatus(e.status, KIT_F.shiver.freeze, 0, e.boss, 'icicleCrash', g.player.slot)
    },
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const e = nearestEnemy(g, p.x, p.y, 210, taken)
        if (e) taken.add(e.id)
        const at = e ?? { x: p.x + p.facing.x * 60 + (i - (s.amount - 1) / 2) * 24, y: p.y + p.facing.y * 60, radius: 0 }
        strike(g, s, look('icicleCrash', 'ice', 'kitFIcicle'), at.x, at.y, 13 * s.area, 0.4 + i * 0.06, 0.36)
      }
      cast(g, 'icicleCrash')
    },
  },

  /* Dracovish: a leap for the nearest unhurt foe and a crushing bite: first strikes land double and feed its frenzy. */
  fishiousRend: {
    name: 'Fishious Rend',
    type: 'water',
    base: stats({ damage: 11, cooldown: 1.5, speed: 300, knockback: 40 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    tags: ['bite'],
    upgrades: FOSSIL_KIT_UPGRADES.fishiousRend,
    onHit: (g, _a, _e, unhurt) => {
      if (unhurt) kitFFirstStrike(g)
    },
    fire: (g, s) => {
      lungeInto(g, s, look('fishiousRend', 'water', 'kitFJaws'), freshPrey(g, 150), 13).bonus = FIRST_STRIKE
      cast(g, 'fishiousRend')
    },
  },
} as const satisfies Record<string, MoveDef>

export const FOSSIL_KIT_MOVE_IDS = Object.keys(FOSSIL_KIT_MOVES) as ReadonlyArray<keyof typeof FOSSIL_KIT_MOVES>
