import { dirTo, fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { shakeScreen } from './effects'
import { MEGA_KIT_B, VENOM_SPLASH, venomSizes } from './megaKitBRules'
import { MEGA_KIT_B_UPGRADES } from './megaKitBUpgrades'
import { LUNGE_MIN_COOLDOWN } from './moveRules'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { StatusSpec } from './status'
import type { Attack, Game, Visual } from './types'

/**
 * The Mega families' signatures, one per family (`data/megaFamiliesB.ts`).
 * High Jump Kick and Dizzy Punch read the family's mechanic (`Player.megaB`),
 * Venom Drench grows as it flies (`megaKitBSystem.ts` weighs it each tick).
 * Their steps live in `megaKitBUpgrades.ts`, their look in
 * `render/megaKitBFx.ts`. Seeded rng and `dmath` only, and no `moves.ts` at
 * runtime (it is evaluated first): only its types.
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

/** A short hit glued to the player, `dist` px toward `angle`, landing `delay` s from now. */
const jab = (g: Game, s: CastStats, l: Look, angle: number, dist: number, r: number, delay: number, damage: number, status: StatusSpec | null) => {
  const d = fromAngle(angle, dist)
  return spawnAttack(g, {
    ...l, x: g.player.x + d.x, y: g.player.y - 8 + d.y,
    shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: d.x, oy: d.y - 8 },
    damage, knockback: s.knockback, status, ttl: 0.2, activeUntil: 0.08, age: -delay, flip: dm.cos(angle) < 0,
  })
}

/** Dizzy Punch: the confusion it may leave, and the counter's (sure). */
const DIZZY: StatusSpec = { kind: 'confuse', chance: 0.2, duration: 1.6, power: 0 }
const DIZZY_COUNTER: StatusSpec = { kind: 'confuse', chance: 1, duration: 2.4, power: 0 }

/** Seconds between Dizzy Punch's fists. */
const PUNCH_GAP = 0.09

/** Magnitude's roll: 4 to 10, as in the games; its reach and power follow (×`area`). */
export const MAGNITUDE = { low: 4, high: 10, r: [24, 52], power: [0.55, 1.5], knockback: [0.6, 1.4], grow: 0.2 } as const

/** Venom Drench's glob: its flight, before the venom's growth (`venomSizes`). */
const GLOB = { ttl: 2.2, spread: 0.18 } as const

export const MEGA_KIT_B_MOVES = {
  /* Meditite's line: a leap onto the nearest foe that lands in a kick. A landing builds Pure Power; a kick on nothing crashes. */
  highJumpKick: {
    name: 'High Jump Kick',
    type: 'fighting',
    base: stats({ damage: 22, cooldown: 2.1, knockback: 80 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    upgrades: MEGA_KIT_B_UPGRADES.highJumpKick,
    onHit: (g, a) => {
      const kit = g.player.megaB
      if (a.visual === 'mbKick' && kit?.kind === 'pure' && kit.resolve > 0) kit.landed = true
    },
    fire: (g, s) => {
      const p = g.player
      const K = MEGA_KIT_B.kick
      const target = nearestEnemy(g, p.x, p.y, K.reach)
      const l = look('highJumpKick', 'fighting', 'mbKick')
      // No foe to leap at: a plain kick ahead, never judged.
      if (!target) {
        jab(g, s, l, dm.atan2(p.facing.y, p.facing.x), 18, 11 * s.area, 0, s.damage * 0.5, s.status ?? null)
        cast(g, 'highJumpKick')
        return
      }
      const tx = target.x
      const ty = target.y
      p.iframes = Math.max(p.iframes, K.leap + 0.1)
      spawnAttack(g, {
        ...look('highJumpKick', 'fighting', 'mbLeap'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: 6 }, motion: { kind: 'lunge', vx: (tx - p.x) / K.leap, vy: (ty - p.y) / K.leap, left: K.leap },
        damage: 0, ttl: K.leap, activeFrom: Infinity, mod: null,
      })
      spawnAttack(g, {
        ...l, x: tx, y: ty - 4,
        shape: { kind: 'circle', r: K.r * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.32, activeUntil: K.window, age: -K.leap,
      })
      const kit = p.megaB
      if (kit?.kind === 'pure') {
        kit.leap = kit.total = K.leap
        kit.resolve = K.leap + K.window + 0.02
        kit.landed = false
      }
      cast(g, 'highJumpKick')
    },
  },

  /* Numel's line: the ground shakes around it, as hard as the magnitude rolled (4 to 10). */
  magnitude: {
    name: 'Magnitude',
    type: 'ground',
    base: stats({ damage: 13, cooldown: 2, knockback: 60 }),
    upgrades: MEGA_KIT_B_UPGRADES.magnitude,
    fire: (g, s) => {
      const p = g.player
      const M = MAGNITUDE
      const mag = M.low + Math.floor(g.rng() * (M.high - M.low + 1))
      const k = (mag - M.low) / (M.high - M.low)
      const r = (M.r[0] + (M.r[1] - M.r[0]) * k) * s.area
      spawnAttack(g, {
        ...look('magnitude', 'ground', 'mbQuake'), x: p.x, y: p.y - 4,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' }, grow: (r - 8) / M.grow,
        damage: s.damage * (M.power[0] + (M.power[1] - M.power[0]) * k), knockback: s.knockback * (M.knockback[0] + (M.knockback[1] - M.knockback[0]) * k),
        status: s.status, ttl: 0.5, activeUntil: M.grow, tier: mag,
      })
      if (mag >= 8) {
        shakeScreen(g, mag - 5)
        g.events.push({ kind: 'quake' })
      }
      cast(g, 'magnitude')
    },
  },

  /* Buneary's line: two quick ear punches ahead that may confuse. After a hop, the counter: harder, wider and sure to confuse. */
  dizzyPunch: {
    name: 'Dizzy Punch',
    type: 'normal',
    base: stats({ damage: 8, cooldown: 1.2, knockback: 30 }),
    status: DIZZY,
    tags: ['punch'],
    upgrades: MEGA_KIT_B_UPGRADES.dizzyPunch,
    fire: (g, s) => {
      const p = g.player
      const kit = p.megaB?.kind === 'hop' ? p.megaB : null
      const counter = kit !== null && kit.counter > 0
      const C = MEGA_KIT_B.hop.counter
      const punches = counter ? (p.mega.active > 0 ? C.megaPunches : C.punches) : 2
      const angle = aimAngle(g, 80)
      const r = 11 * s.area * (counter ? C.area : 1)
      for (let i = 0; i < punches; i++) {
        const side = i % 2 === 0 ? -0.35 : 0.35
        const hit = jab(g, s, look('dizzyPunch', 'normal', 'mbPunch'), angle + side, 18 * (counter ? C.area : 1), r, i * PUNCH_GAP, s.damage * (counter ? C.power : 1), counter ? DIZZY_COUNTER : (s.status ?? null))
        hit.tier = counter ? 1 : 0
        hit.flip = side > 0
      }
      if (kit && counter) kit.counter = 0
      cast(g, 'dizzyPunch')
    },
  },

  /* Flabébé's line: a fan of glittering wind ahead that cuts through a few foes. */
  fairyWind: {
    name: 'Fairy Wind',
    type: 'fairy',
    base: stats({ damage: 6, cooldown: 1.15, amount: 3, speed: 190, pierce: 2, knockback: 26 }),
    upgrades: MEGA_KIT_B_UPGRADES.fairyWind,
    fire: (g, s) => {
      const p = g.player
      const center = aimAngle(g, 200)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * 0.28, s.speed)
        spawnAttack(g, {
          ...look('fairyWind', 'fairy', 'mbWind'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 0.55, age: -i * 0.04, flip: i % 2 === 1,
        })
      }
      cast(g, 'fairyWind')
    },
  },

  /* Skrelp's line: a glob of venom spat at the farthest foe in sight; it grows as it flies and splashes where it lands. */
  venomDrench: {
    name: 'Venom Drench',
    type: 'poison',
    base: stats({ damage: 10, cooldown: 1.5, speed: 150, pierce: 1, knockback: 30 }),
    status: { kind: 'poison', chance: 0.5, duration: 3, power: 0.3 },
    upgrades: MEGA_KIT_B_UPGRADES.venomDrench,
    onHit: (g, a, e) => {
      if (a.visual !== 'mbGlob') return
      splash(g, a, e.x, e.y - e.radius)
    },
    fire: (g, s) => {
      const p = g.player
      const center = aimAngle(g, MEGA_KIT_B.venom.far + 40)
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(center + (i - (s.amount - 1) / 2) * GLOB.spread, s.speed)
        spawnAttack(g, {
          ...look('venomDrench', 'poison', 'mbGlob'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: MEGA_KIT_B.venom.r[0] * g.player.stats.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: GLOB.ttl, age: -i * 0.07,
          // How much of the venom's growth it carries so far (`megaKitBSystem.ts` grows it each tick).
          memo: 1,
        })
      }
      cast(g, 'venomDrench')
    },
  },
} as const satisfies Record<string, MoveDef>

/**
 * Where a glob lands: a splash as wide as the glob grew, poisoning all it
 * catches. Mega Dragalge's throws droplets of its own all around.
 */
const splash = (g: Game, a: Attack, x: number, y: number): void => {
  const p = g.player
  const V = MEGA_KIT_B.venom
  const r = venomSizes(dm.hypot(a.x - a.from.x, a.y - a.from.y)).splash * p.stats.area
  spawnAttack(g, {
    move: 'venomDrench', type: 'poison', visual: 'mbSplash', x, y,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' }, grow: Math.max(0, r - 6) / 0.16,
    damage: a.damage * V.share, knockback: 20, status: VENOM_SPLASH, ttl: 0.4, activeUntil: 0.16, tier: a.memo > 1.4 ? 1 : 0, mod: null,
  })
  if (p.mega.active <= 0) return
  for (let i = 0; i < V.droplets; i++) {
    const v = fromAngle((i / V.droplets) * TAU + 0.4, 120)
    spawnAttack(g, {
      move: 'venomDrench', type: 'poison', visual: 'mbDrop', x, y,
      shape: { kind: 'circle', r: 4 }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: a.damage * V.share, knockback: 10, pierce: 1, status: VENOM_SPLASH, ttl: 0.45, mod: null,
    })
  }
}

export const MEGA_KIT_B_MOVE_IDS = Object.keys(MEGA_KIT_B_MOVES) as ReadonlyArray<keyof typeof MEGA_KIT_B_MOVES>
