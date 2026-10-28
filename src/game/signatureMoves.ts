import { dirTo, fromAngle, TAU } from '../engine/math'
import { chance, pick, range } from '../engine/rng'
import { burst, shakeScreen } from './effects'
import { damageEnemy } from './combat'
import { guard, hpFraction, stacksOf, sweep } from './moveKit'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { enemiesInView, nearestEnemy } from './queries'
import {
  aquaSpeed, aquaStacks, chargeScale, densestFoe, eruptionScale, PETAL_CASTS, petalTempo,
} from './signatureRules'
import { spawnAttack } from './spawn'
import type { DamageBonus } from './kitRules'
import type { StatDelta } from './stats'
import { ownAttack } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * Signature moves of the starter families, each with a verb of its own: seeds
 * that leech and spread, a shell spin that guards, a dance that gets dizzy, an
 * eruption that wants full HP, a rampage that tires, a leap onto the crowd,
 * thorns that answer contact, bubbles that heal, a sniper's shot… They are
 * spread at the top of `MOVES` (`moves.ts`); their per-tick behaviors (Thrash's
 * bites, Petal Dance's spiral, the bubbles popping…) live in `signatures.ts`
 * and their art in `render/signatureFx.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first),
 * so the few cast helpers it shares with it are its own.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

/** Angles spread evenly around `center`, `step` radians apart. */
const fan = (center: number, count: number, step: number) =>
  Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

/** Toward the nearest foe within `range`, else the way the player faces. */
const aimAngle = (g: Game, range: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, range)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Offset `dist` px towards `angle`, at body height, for strikes glued to the player. */
const reachOffset = (angle: number, dist: number) => {
  const d = fromAngle(angle, dist)
  return { ox: d.x, oy: d.y - 8 }
}

/** The player's speed without `move`'s own buff, so a refreshed buff never compounds. */
const ownSpeed = (g: Game, move: MoveId) => {
  const p = g.player
  const own = p.moveBuffs.find((b) => b.move === move && b.applied)
  return p.stats.speed - (own?.stats.speed ?? 0)
}

/**
 * Puts (or refreshes) `move`'s timed effect on the player's stats for `seconds`.
 * `signatures.ts` folds it into the stats on the next tick and takes it off when it runs out.
 */
export const addMoveBuff = (g: Game, move: MoveId, seconds: number, delta: StatDelta) => {
  const p = g.player
  const i = p.moveBuffs.findIndex((b) => b.move === move)
  if (i >= 0) p.moveBuffs.splice(i, 1)
  p.moveBuffs.push({ move, left: seconds, stats: delta, applied: false })
}

/** Lets the shell play the move's own sound (`ui/castSfx.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Seconds a Leech Seed flies before it lands, and how far ahead of a walking foe it aims. */
const SEED_LOB = 0.38
/** Damage taken while Rapid Spin lasts is cut by this share; the spin also speeds the player up. */
export const SPIN_GUARD = 0.4
const SPIN_HASTE = 0.15
/** Dizziness after Petal Dance's last cast in a row: speed lost. */
const DIZZY_SLOW = 0.4
/** Eruption: seconds a bomb takes to fly up and come down. */
export const ERUPTION_FALL = 0.62
/** Thrash's reach is drawn as a red ring; it tires the player this long, slowed by `TIRED_SLOW`. */
export const TIRED_TIME = 1
export const TIRED_SLOW = 0.4
/** Seconds between Double Kick's two kicks. */
const KICK_GAP = 0.15
/** Wood Hammer: seconds raised before the slam lands. */
export const HAMMER_RAISE = 0.26
/** Flame Charge: how far it looks for a crowd, the leap's seconds, and the retry delay when nobody is in reach. */
const CHARGE_RANGE = 150
export const CHARGE_TIME = 0.34
const CHARGE_RETRY = 0.4
/** Snipe Shot: seconds the crosshair holds before the shot, and how near a foe can be to be picked first. */
export const SNIPE_AIM = 0.3
const SNIPE_MIN = 70
const SNIPE_RANGE = 280
/** Aqua Step: the dance's dash seconds, and how long its speed lingers after the last dance. */
const STEP_TIME = 0.2
const AQUA_STEP_TIME = 6

/** Flower Trick never misses and hits elites and bosses harder. */
const FLOWER_BONUS: readonly DamageBonus[] = [{ when: 'elite', mult: 1.5 }, { when: 'boss', mult: 1.5 }]

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

export const SIGNATURE_MOVES = {
  leechSeed: {
    name: 'Leech Seed',
    type: 'grass',
    base: stats({ damage: 6, cooldown: 2.2, amount: 2, knockback: 10 }),
    status: { kind: 'seed', chance: 1, duration: 4, power: 0.5 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { statusDamage: 0.15 }, mods: ['trail'] }, { stats: { damage: -1 }, mods: ['arc'] }] },
      { cooldown: -0.3 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { amount: 2 },
    ],
    // Seeds are lobbed at different foes, a little ahead of them: they sprout on landing.
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, 200, taken)
        if (t) taken.add(t.id)
        const lead = t ? Math.min(t.speed * SEED_LOB, dm.hypot(t.x - p.x, t.y - p.y) * 0.4) : 0
        const d = t ? dirTo(t.x, t.y, p.x, p.y) : fromAngle(g.time * 3 + i * 2.4, -50)
        spawnAttack(g, {
          ...look('leechSeed', 'grass', 'leechSeed'),
          x: t ? t.x + d.x * lead : p.x - d.x, y: t ? t.y + d.y * lead : p.y - d.y * 0.7,
          shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: s.status,
          ttl: SEED_LOB + 0.3, activeFrom: SEED_LOB, activeUntil: SEED_LOB + 0.06,
          from: { x: p.x, y: p.y - 10 }, age: -i * 0.09, flip: i % 2 === 1,
        })
      }
      cast(g, 'leechSeed')
    },
  },

  rapidSpin: {
    name: 'Rapid Spin',
    type: 'normal',
    base: stats({ damage: 10, cooldown: 4, duration: 1.2, knockback: 170 }),
    upgrades: [
      { damage: 3 },
      { duration: 0.3 },
      { fork: [{ stats: { area: 0.1 }, mods: ['arc'] }, { stats: { area: 0.1 }, mods: ['drain'] }] },
      { cooldown: -0.5 },
      { damage: 4 },
      { fork: [{ stats: { duration: 0.3 }, mods: ['burstOnKill'] }, { stats: { area: 0.15, damage: 16 }, mods: ['execute'] }] },
      { damage: 5, knockback: 50 },
    ],
    // The player spins in their shell: the body hits and flings foes outward, takes less damage and blows enemy shots away.
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('rapidSpin', 'normal', 'rapidSpin'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 15 * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage, knockback: s.knockback, hitInterval: 0.25, ttl: s.duration,
      })
      addMoveBuff(g, 'rapidSpin', s.duration, { damageTaken: -SPIN_GUARD, speed: ownSpeed(g, 'rapidSpin') * SPIN_HASTE })
      cast(g, 'rapidSpin')
    },
  },

  petalDance: {
    name: 'Petal Dance',
    type: 'grass',
    base: stats({ damage: 8, cooldown: 2.4, amount: 5, speed: 3.4, duration: 1.5, knockback: 30 }),
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { damage: 2 }, mods: ['twin'] }, { stats: { duration: 0.3 }, mods: ['trail'] }] },
      { amount: 1 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { area: 0.15 }, mods: ['vortex'] }] },
      { amount: 2 },
    ],
    // Petals spiral out from the player, spinning faster each cast in a row; the third is wilder and leaves them dizzy.
    fire: (g, s, owned) => {
      const p = g.player
      const n = stacksOf(owned)
      const tempo = petalTempo(n)
      owned.stacks = (n + 1) % PETAL_CASTS
      const count = s.amount + (tempo.dizzy ? 2 : 0)
      const reach = 66 * s.area
      for (let i = 0; i < count; i++) {
        spawnAttack(g, {
          ...look('petalDance', 'grass', 'petal'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * s.area },
          motion: { kind: 'orbit', angle: g.time * 2 + (i / count) * TAU, spin: s.speed * tempo.spin, radius: 8 },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.35, ttl: s.duration,
          memo: (reach - 8) / s.duration, flip: i % 2 === 1,
        })
      }
      if (tempo.dizzy) addMoveBuff(g, 'petalDance', s.duration * 0.7, { speed: -ownSpeed(g, 'petalDance') * DIZZY_SLOW })
      cast(g, 'petalDance')
    },
  },

  eruption: {
    name: 'Eruption',
    type: 'fire',
    base: stats({ damage: 22, cooldown: 3, amount: 5, knockback: 60 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.3 },
    upgrades: [
      { amount: 1 },
      { damage: 6 },
      { fork: [{ stats: { area: 0.1 }, mods: ['trail'] }, { stats: { damage: -4 }, mods: ['echo'] }] },
      { amount: 2 },
      { cooldown: -0.4 },
      { fork: [{ stats: { damage: 8 }, mods: ['burstOnKill'] }, { stats: { damage: 11 }, mods: ['hunter'] }] },
      { amount: 2, area: 0.15 },
    ],
    // Fire bombs burst from the player's back and rain around them; they hit as hard as the player is healthy.
    fire: (g, s) => {
      const p = g.player
      const power = eruptionScale(hpFraction(p))
      const foes = enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < 150 * 150)
      const r = 17 * s.area
      for (let i = 0; i < s.amount; i++) {
        const t = i % 2 === 0 && foes.length > 0 ? pick(g.rng, foes) : null
        const a = range(g.rng, 0, TAU)
        const d = range(g.rng, 30, 120)
        const x = t ? t.x + range(g.rng, -6, 6) : p.x + dm.cos(a) * d
        const y = t ? t.y + range(g.rng, -4, 4) : p.y + dm.sin(a) * d * 0.8
        const delay = ERUPTION_FALL + i * 0.09
        spawnAttack(g, {
          ...look('eruption', 'fire', 'eruptionFall'), x, y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: 0, ttl: delay, activeFrom: Infinity, from: { x: p.x + range(g.rng, -4, 4), y: p.y - 14 },
        })
        spawnAttack(g, {
          ...look('eruption', 'fire', 'eruption'), x, y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: s.damage * power, knockback: s.knockback, status: s.status,
          age: -delay, ttl: 0.5, activeUntil: 0.08, flip: chance(g.rng, 0.5),
        })
      }
      burst(g, p.x, p.y - 14, { colors: ['#fff0a0', '#f8b030', '#f05818', '#a02010'], count: 18, speed: 90, ttl: 0.5, gravity: -120, size: 2 })
      shakeScreen(g, 2)
      cast(g, 'eruption')
    },
  },

  thrash: {
    name: 'Thrash',
    type: 'normal',
    base: stats({ damage: 9, cooldown: 5.5, amount: 5, duration: 2.5, knockback: 45 }),
    upgrades: [
      { damage: 3 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.1 }, mods: ['arc'] }, { stats: { area: 0.2 }, mods: ['drain'] }] },
      { duration: 0.5 },
      { damage: 4 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { amount: 1 }, mods: ['hunter'] }] },
      { cooldown: -1, damage: 3 },
    ],
    // A rampage: `amount` bites a second on foes around the player for `duration`, then they're worn out for a moment.
    // The carrier never hits; `signatures.ts` bites with it every `hitInterval` (1 / amount) seconds.
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('thrash', 'normal', 'thrash'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 46 * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage, knockback: s.knockback, ttl: s.duration, activeFrom: Infinity, hitInterval: 1 / s.amount,
      })
      cast(g, 'thrash')
    },
  },

  doubleKick: {
    name: 'Double Kick',
    type: 'fighting',
    base: stats({ damage: 10, cooldown: 1.3, amount: 1, knockback: 50 }),
    status: { kind: 'mark', chance: 1, duration: 0.5, power: 0.5 },
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['arc'] }, { stats: { cooldown: 0.1, damage: 6 }, mods: ['echo'] }] },
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { damage: 10 }, mods: ['execute'] }, { stats: { damage: 2 }, mods: ['burstOnKill'] }] },
      { area: 0.25, knockback: 40 },
    ],
    // Two kicks in a quick arc: the first one marks, so the second lands ×1.5 on whatever the first one caught.
    // More pairs kick the other ways.
    fire: (g, s) => {
      const p = g.player
      const angle = aimAngle(g, 110)
      for (let i = 0; i < s.amount; i++) {
        const dir = angle + (i * TAU) / s.amount
        for (let k = 0; k < 2; k++) {
          spawnAttack(g, {
            ...look('doubleKick', 'fighting', 'kick'), x: p.x, y: p.y,
            shape: { kind: 'circle', r: (12 + k * 3) * s.area },
            motion: { kind: 'follow', ...reachOffset(dir, 17 * s.area) },
            damage: s.damage, knockback: s.knockback * (k === 0 ? 0.4 : 1.4), ttl: 0.17,
            status: k === 0 ? s.status : null, flip: k === 1, age: -(k * KICK_GAP + i * 0.05), memo: k,
          })
        }
      }
      cast(g, 'doubleKick')
    },
  },

  mudShot: {
    name: 'Mud Shot',
    type: 'ground',
    base: stats({ damage: 9, cooldown: 1.8, amount: 1, speed: 130, knockback: 30 }),
    status: { kind: 'weaken', chance: 1, duration: 3, power: 0.25 },
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 7 }, mods: ['rear'] }, { stats: { amount: 1 }, mods: ['trail'] }] },
      { cooldown: -0.25 },
      { damage: 4 },
      { fork: [{ stats: { area: 0.1, damage: 5 }, mods: ['split'] }, { stats: { cooldown: 0.1 }, mods: ['boomerang'] }] },
      { amount: 1, damage: 4 },
    ],
    // A wave of mud rolls out and widens: everything it splashes is slowed and hits the player softer.
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 220), s.amount, 0.5)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('mudShot', 'ground', 'mudWave'), x: p.x + v.x * 0.06, y: p.y - 4 + v.y * 0.06,
          shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, ttl: 0.85, grow: 14 * s.area, status: s.status,
        })
      }
      cast(g, 'mudShot')
    },
  },

  woodHammer: {
    name: 'Wood Hammer',
    type: 'grass',
    base: stats({ damage: 30, cooldown: 2.6, knockback: 150 }),
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['arc'] }, { stats: { cooldown: -0.3 }, mods: ['trail'] }] },
      { damage: 8 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2, damage: -10 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3, damage: 11 }, mods: ['hunter'] }] },
      { damage: 10 },
    ],
    // A huge log hammer is raised and slammed in front of the player; a swing that connects costs a little HP.
    fire: (g, s) => {
      const p = g.player
      const angle = aimAngle(g, 90)
      spawnAttack(g, {
        ...look('woodHammer', 'grass', 'hammer'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: 22 * s.area }, motion: { kind: 'follow', ...reachOffset(angle, 26 * s.area) },
        damage: s.damage, knockback: s.knockback, ttl: HAMMER_RAISE + 0.36, activeFrom: HAMMER_RAISE, activeUntil: HAMMER_RAISE + 0.06,
        flip: dm.cos(angle) < 0,
      })
    },
  },

  drillPeck: {
    name: 'Drill Peck',
    type: 'flying',
    base: stats({ damage: 6, cooldown: 1.6, amount: 1, speed: 210, knockback: 8 }),
    upgrades: [
      { damage: 2 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['seek'] }, { stats: { damage: -1 }, mods: ['rear'] }] },
      { cooldown: -0.25 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.1, damage: 4 }, mods: ['split'] }, { stats: { area: 0.25 }, mods: ['trail'] }] },
      { amount: 1, damage: 3 },
    ],
    // A spinning beak-drill that bores through a line of foes, slowing down to grind each one it goes through.
    fire: (g, s) => {
      const p = g.player
      fan(aimAngle(g, 260), s.amount, 0.25).forEach((angle, i) => {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('drillPeck', 'flying', 'drill'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.1, ttl: 1.2, memo: s.speed, age: -i * 0.08,
        })
      })
      cast(g, 'drillPeck')
    },
  },

  leafTornado: {
    name: 'Leaf Tornado',
    type: 'grass',
    base: stats({ damage: 6, cooldown: 3.2, amount: 1, speed: 55, duration: 1.8 }),
    status: { kind: 'slow', chance: 1, duration: 0.6, power: 0.4 },
    upgrades: [
      { damage: 2 },
      { area: 0.2 },
      { fork: [{ stats: { duration: 0.3 }, mods: ['seek'] }, { stats: { damage: 3 }, mods: ['halo'] }] },
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { area: 0.2 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
      { amount: 1, damage: 3 },
    ],
    // A leafy whirlwind drifts out, sucking foes in and slowing them, then bursts into a ring of blades.
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAngle(g, 200), s.amount, 0.7)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('leafTornado', 'grass', 'leafTornado'), x: p.x + v.x * 0.25, y: p.y - 6 + v.y * 0.25,
          shape: { kind: 'circle', r: 16 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, hitInterval: 0.3, ttl: s.duration, pull: 150, status: s.status,
        })
      }
      cast(g, 'leafTornado')
    },
  },

  flameCharge: {
    name: 'Flame Charge',
    type: 'fire',
    base: stats({ damage: 16, cooldown: 3.4, knockback: 160 }),
    status: { kind: 'burn', chance: 0.4, duration: 2.5, power: 0.3 },
    upgrades: [
      { damage: 5 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.3 }, mods: ['trail'] }, { stats: { cooldown: -0.4 }, mods: ['arc'] }] },
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.4 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['drain'] }] },
      { damage: 8, area: 0.15 },
    ],
    // Wrapped in flames, the player leaps onto the biggest crowd nearby (ahead, while walking) and lands in a fiery crash. Bulk hits harder.
    fire: (g, s, owned) => {
      const p = g.player
      const t = densestFoe(g.enemies, p.x, p.y, CHARGE_RANGE, 40, p.moving ? p.facing : null)
      if (!t) {
        owned.cooldown -= s.cooldown - CHARGE_RETRY
        return
      }
      const power = chargeScale(p.stats.maxHp)
      const dx = t.x - p.x
      const dy = t.y - p.y
      p.iframes = Math.max(p.iframes, CHARGE_TIME + 0.3)
      spawnAttack(g, {
        ...look('flameCharge', 'fire', 'flameCharge'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'lunge', vx: dx / CHARGE_TIME, vy: dy / CHARGE_TIME, left: CHARGE_TIME },
        damage: s.damage * power * 0.4, knockback: 40, ttl: CHARGE_TIME + 0.12, activeUntil: CHARGE_TIME,
      })
      spawnAttack(g, {
        ...look('flameCharge', 'fire', 'flameLanding'), x: t.x, y: t.y,
        shape: { kind: 'circle', r: 32 * s.area }, motion: { kind: 'static' },
        damage: s.damage * power, knockback: s.knockback, status: s.status, age: -CHARGE_TIME, ttl: 0.55, activeUntil: 0.07,
      })
      cast(g, 'flameCharge')
    },
  },

  needleArm: {
    name: 'Needle Arm',
    type: 'grass',
    base: stats({ damage: 12, cooldown: 4.5, amount: 8, duration: 1.5, knockback: 140 }),
    upgrades: [
      { damage: 3 },
      { amount: 2 },
      { fork: [{ stats: { duration: 0.3 }, mods: ['arc'] }, { stats: { damage: 16 }, mods: ['drain'] }] },
      { cooldown: -0.5 },
      { damage: 4 },
      { fork: [{ stats: { amount: 1, damage: -4 }, mods: ['burstOnKill'] }, { stats: { amount: 1, damage: 8 }, mods: ['echo'] }] },
      { duration: 0.4, damage: 4 },
    ],
    // The quills bristle: needles fly out, and for `duration` any foe that touches the player is hurt and thrown back instead.
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(g.time * 1.3 + (i / s.amount) * TAU, 220)
        spawnAttack(g, {
          ...look('needleArm', 'grass', 'needle'), x: p.x, y: p.y - 9,
          shape: { kind: 'circle', r: 3 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage * 0.8, knockback: 40, pierce: 2, ttl: 0.4,
        })
      }
      spawnAttack(g, {
        ...look('needleArm', 'grass', 'needleArm'), x: p.x, y: p.y - 9,
        shape: { kind: 'circle', r: 16 }, motion: { kind: 'follow', ox: 0, oy: -9 },
        damage: s.damage, knockback: s.knockback, ttl: s.duration, activeFrom: Infinity,
      })
      guard(g, 'needleArm', s.duration)
      cast(g, 'needleArm')
    },
    onGuard: (g, s, _owned, from) => {
      const p = g.player
      const quills = g.attacks.find((a) => ownAttack(g, a) && a.visual === 'needleArm' && a.age < a.ttl)
      if (from && from.dying < 0) {
        const jab = spawnAttack(g, {
          ...look('needleArm', 'grass', 'needle'), x: p.x, y: p.y - 9,
          shape: { kind: 'circle', r: 1 }, motion: { kind: 'static' },
          damage: s.damage * 1.6, knockback: s.knockback, ttl: 0.22, activeFrom: Infinity,
          from: { x: from.x, y: from.y - from.radius },
        })
        damageEnemy(g, from, jab)
      }
      const left = quills ? quills.ttl - quills.age : 0
      if (left > 0.05) guard(g, 'needleArm', left)
    },
  },

  psybeam: {
    name: 'Psybeam',
    type: 'psychic',
    base: stats({ damage: 8, cooldown: 1.7, amount: 6, speed: 190, knockback: 15 }),
    status: { kind: 'confuse', chance: 0.12, duration: 2, power: 0 },
    upgrades: [
      { amount: 2 },
      { damage: 3 },
      { fork: [{ stats: {}, mods: ['rear'] }, { stats: { statusChance: 0.06 }, mods: ['cruel'] }] },
      { cooldown: -0.25 },
      { damage: 3, area: 0.2 },
      { fork: [{ stats: { amount: 1 }, mods: ['split'] }, { stats: { amount: 1 }, mods: ['halo'] }] },
      { damage: 4, statusChance: 0.06 },
    ],
    // A wavy stream of rainbow rings: each one may confuse, and confused foes stumble into the others.
    fire: (g, s) => {
      const p = g.player
      const v = fromAngle(aimAngle(g, 240), s.speed)
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          ...look('psybeam', 'psychic', 'psybeam'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, ttl: 0.95, grow: 4 * s.area, status: s.status, age: -i * 0.055, memo: i,
        })
      }
      cast(g, 'psybeam')
    },
  },

  darkestLariat: {
    name: 'Darkest Lariat',
    type: 'dark',
    base: stats({ damage: 11, cooldown: 3.4, amount: 2, duration: 1.5, knockback: 60 }),
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { duration: 0.3 }, mods: ['vortex'] }, { stats: { duration: 0.4 }, mods: ['drain'] }] },
      { cooldown: -0.4 },
      { damage: 4 },
      { fork: [{ stats: { damage: -2 }, mods: ['twin'] }, { stats: { amount: 1, damage: 9 }, mods: ['execute'] }] },
      { damage: 5, area: 0.15 },
    ],
    // The player spins with arms out for `duration`, clotheslining everything around; it goes through wards.
    fire: (g, s) => {
      const p = g.player
      const start = dm.atan2(p.facing.y, p.facing.x)
      const length = 36 * s.area
      const before = g.attacks.length
      for (let i = 0; i < s.amount; i++) {
        sweep(g, s, look('darkestLariat', 'dark', 'lariat'), {
          from: start + (i * TAU) / s.amount, arc: 10 * s.duration, time: s.duration, length, segments: 4, r: 7, inner: 11, hitInterval: 0.3,
        })
      }
      for (let i = before; i < g.attacks.length; i++) {
        const a = g.attacks[i]!
        a.ignoreWards = true
        // The fist at the end of each arm.
        if (a.motion.kind === 'orbit' && a.motion.radius >= length - 0.5) a.memo = 1
      }
      cast(g, 'darkestLariat')
    },
  },

  sparklingAria: {
    name: 'Sparkling Aria',
    type: 'water',
    base: stats({ damage: 12, cooldown: 2.2, amount: 4, speed: 70, duration: 1.8, knockback: 50 }),
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { damage: 4 }, mods: ['trail'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { cooldown: -0.3 },
      { amount: 2 },
      { fork: [{ stats: { damage: 5 }, mods: ['burstOnKill'] }, { stats: {}, mods: ['echo'] }] },
      { amount: 2, area: 0.15 },
    ],
    // Slow bubbles float out and pop on a foe (or when they run out), splashing around; a pop near the player heals them.
    // The bubbles never hit by themselves; `signatures.ts` pops them.
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        const v = fromAngle(g.time * 1.3 + (i / s.amount) * TAU + range(g.rng, -0.25, 0.25), s.speed * range(g.rng, 0.75, 1.1))
        spawnAttack(g, {
          ...look('sparklingAria', 'water', 'bubble'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'drift', vx: v.x, vy: v.y, drag: 1.2 },
          damage: s.damage, knockback: s.knockback, ttl: s.duration + range(g.rng, 0, 0.3), activeFrom: Infinity, age: -i * 0.07,
        })
      }
      cast(g, 'sparklingAria')
    },
  },

  snipeShot: {
    name: 'Snipe Shot',
    type: 'water',
    base: stats({ damage: 14, cooldown: 1.9, amount: 1, speed: 430, pierce: 1, knockback: 70 }),
    upgrades: [
      { damage: 5 },
      { pierce: 1 },
      { fork: [{ stats: { cooldown: -0.2, damage: 8 }, mods: ['hunter'] }, { stats: { cooldown: -0.3 }, mods: ['split'] }] },
      { damage: 6 },
      { amount: 1 },
      { fork: [{ stats: { pierce: 1, damage: 13 }, mods: ['execute'] }, { stats: { pierce: 2, damage: -9 }, mods: ['arc'] }] },
      { damage: 8 },
    ],
    // A crosshair locks on a foe a little away, then a long shot flies straight through: the farther it flies, the harder it hits.
    // It goes through wards. `signatures.ts` fires it from where the player is when the aim ends.
    fire: (g, s) => {
      const p = g.player
      const far = enemiesInView(g).filter((e) => {
        const d = dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
        return d >= SNIPE_MIN * SNIPE_MIN && d <= SNIPE_RANGE * SNIPE_RANGE
      })
      far.sort((a, b) => dm.sq(a.x - p.x) + dm.sq(a.y - p.y) - (dm.sq(b.x - p.x) + dm.sq(b.y - p.y)) || a.id - b.id)
      const t = far[0] ?? nearestEnemy(g, p.x, p.y, SNIPE_RANGE)
      const aim = t ? { x: t.x, y: t.y - t.radius } : { x: p.x + p.facing.x * 160, y: p.y - 8 + p.facing.y * 160 }
      spawnAttack(g, {
        ...look('snipeShot', 'water', 'snipeSight'), x: aim.x, y: aim.y,
        shape: { kind: 'circle', r: 9 }, motion: { kind: 'static' },
        damage: 0, ttl: SNIPE_AIM + 0.12 * s.amount, activeFrom: Infinity,
      })
      const d = dirTo(p.x, p.y - 8, aim.x, aim.y, p.facing)
      for (let i = 0; i < s.amount; i++) {
        spawnAttack(g, {
          ...look('snipeShot', 'water', 'snipeShot'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'linear', vx: d.x * s.speed, vy: d.y * s.speed },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.1, ignoreWards: true,
          memo: s.damage, from: aim, age: -(SNIPE_AIM + i * 0.12),
        })
      }
    },
  },

  flowerTrick: {
    name: 'Flower Trick',
    type: 'grass',
    base: stats({ damage: 14, cooldown: 1.4, amount: 1, speed: 180, pierce: 1, knockback: 30 }),
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { cooldown: -0.1 }, mods: ['split'] }, { stats: { cooldown: -0.2 }, mods: ['trail'] }] },
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { speed: 60, damage: -5 }, mods: ['burstOnKill'] }, { stats: { speed: 60, damage: 6 }, mods: ['execute'] }] },
      { amount: 2 },
    ],
    // A thrown flower that locks on and never misses, blooming on impact; elites and bosses take ×1.5.
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      fan(aimAngle(g, 300), s.amount, 0.7).forEach((angle, i) => {
        const target = nearestEnemy(g, p.x, p.y, 300, taken)
        if (target) taken.add(target.id)
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('flowerTrick', 'grass', 'flowerTrick'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 14, target },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 3, bonus: FLOWER_BONUS, age: -i * 0.1,
        })
      })
      cast(g, 'flowerTrick')
    },
  },

  aquaStep: {
    name: 'Aqua Step',
    type: 'water',
    base: stats({ damage: 26, cooldown: 1.8, knockback: 80 }),
    upgrades: [
      { damage: 4 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.2 }, mods: ['trail'] }, { stats: { cooldown: -0.25 }, mods: ['drain'] }] },
      { damage: 5 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.25, damage: 8 }, mods: ['arc'] }, { stats: { cooldown: -0.25 }, mods: ['burstOnKill'] }] },
      { damage: 6, area: 0.2 },
    ],
    // A dance step: a short dash, untouchable while it lasts (ahead while walking, side to side standing),
    // splashing where it leaves and where it lands.
    // Each step in a row adds speed (up to 5 steps' worth), which lingers a few seconds after the last one.
    fire: (g, s, owned) => {
      const p = g.player
      const active = p.moveBuffs.some((b) => b.move === 'aquaStep')
      const stacks = aquaStacks(stacksOf(owned), active)
      owned.stacks = stacks
      const dist = 44 * s.area
      // Walking, it steps ahead; standing, it sways side to side and comes back to where it was.
      const sway = stacks % 2 === 0 ? 1 : -1
      const d = p.moving ? p.facing : { x: -p.facing.y * sway, y: p.facing.x * sway }
      p.iframes = Math.max(p.iframes, STEP_TIME + 0.12)
      spawnAttack(g, {
        ...look('aquaStep', 'water', 'aquaStep'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'lunge', vx: (d.x * dist) / STEP_TIME, vy: (d.y * dist) / STEP_TIME, left: STEP_TIME },
        damage: s.damage, knockback: s.knockback, ttl: STEP_TIME + 0.16, activeUntil: STEP_TIME, memo: stacks,
      })
      // A splash where the step leaves (it catches what was chasing) and one where it lands.
      for (const [k, delay] of [[0, 0], [1, STEP_TIME]] as const) {
        spawnAttack(g, {
          ...look('aquaStep', 'water', 'bubblePop'), x: p.x + d.x * dist * k, y: p.y + d.y * dist * k - 4,
          shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, ttl: 0.32, activeUntil: 0.12, grow: 190 * s.area, age: -delay,
        })
      }
      addMoveBuff(g, 'aquaStep', AQUA_STEP_TIME, { speed: ownSpeed(g, 'aquaStep') * aquaSpeed(stacks) })
      cast(g, 'aquaStep')
    },
  },
} as const satisfies Record<string, MoveDef>

export type SignatureMoveId = keyof typeof SIGNATURE_MOVES
