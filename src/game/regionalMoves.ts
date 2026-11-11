import { dirTo, fromAngle, TAU } from '../engine/math'
import * as dm from '../engine/dmath'
import { burst, floatText, shakeScreen } from './effects'
import { bestLine, recoilCost } from './eggMove2Rules'
import { guardWard } from './kitRules'
import { guard, stacksOf } from './moveKit'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { ownAttack } from './players'
import { nearestEnemy } from './queries'
import {
  BARBS, barbCount, BULL, bullBreed, CHLORO, CLAW, clawMult, JOUST, MALICE, OBSTRUCT, SHELL, shellSide, TOXIC,
} from './regionalRules'
import { addMoveBuff } from './signatureMoves'
import { densestFoe } from './signatureRules'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import type { Attack, Game } from './types'

/**
 * The regional forms' own moves (`data/regionalFamilies.ts`), each a verb
 * that tells the form apart from its Kanto or Johto self: claws that sharpen
 * while nothing hurts you (Metal Claw), a move that picks shell or poison by
 * the distance (Shell Side Arm), a guard that answers with a Defense-breaking
 * X (Obstruct), a leek joust through the longest line (Meteor Assault), a
 * blast that costs HP (Chloroblast), a spite that saps the crowd (Bitter Malice), barbs fired all round (Poison Sting), a
 * pool whose poison grows the longer they stand in it and jumps when they fall
 * (Toxic) and a charge whose type is the breed's (Raging Bull). Numbers live
 * in `regionalRules.ts`, the art in `render/regionalFx.ts`. Spread at the end
 * of `MOVES`; this module must not use `moves.ts` at load time (only its types).
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** HP a hit costs the player (`share` of max HP, never the last point), with the number over its head. */
const recoil = (g: Game, share: number) => {
  const p = g.player
  const cost = recoilCost(p.stats.maxHp, p.hp, 0, share, share)
  if (cost <= 0) return
  p.hp -= cost
  floatText(g, p.x, p.y - 26, String(cost), '#f87858', true)
}

export const REGIONAL_MOVES = {
  /* Alolan Diglett, Galarian Meowth: claws on the nearest foe that grow sharper with every hit, until something hurts you. */
  metalClaw: {
    name: 'Metal Claw',
    type: 'steel',
    base: stats({ damage: 9, cooldown: 0.9, knockback: 30 }),
    stacks: { grow: 'hit', max: CLAW.max, reset: 'hurt' },
    upgrades: [
      { damage: 3 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.1 }, mods: ['arc'] }] },
      { damage: 3 },
      { cooldown: -0.08 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['cruel'] }] },
      { damage: 6 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, CLAW.reach * s.area)
      if (!t) {
        owned.cooldown -= s.cooldown - CLAW.retry
        return
      }
      const stacks = stacksOf(owned)
      spawnAttack(g, {
        ...look('metalClaw', 'steel', 'metalClaw'), x: t.x, y: t.y - t.radius,
        shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'static' },
        damage: s.damage * clawMult(stacks), knockback: s.knockback, ttl: 0.22, activeFrom: 0.03, activeUntil: 0.09, flip: owned.level % 2 === 0, tier: stacks,
      })
      cast(g, 'metalClaw')
    },
  },

  /* Galarian Slowpoke: the shell slams a foe that came close; one farther off gets a poison bolt. */
  shellSideArm: {
    name: 'Shell Side Arm',
    type: 'poison',
    base: stats({ damage: 13, cooldown: 1.5, speed: SHELL.speed, knockback: 60, pierce: 1 }),
    status: { kind: 'poison', chance: 0.4, duration: 4, power: 0.3 },
    upgrades: [
      { damage: 3 },
      { statusChance: 0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['trail'] }] },
      { damage: 4 },
      { cooldown: -0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['cruel'] }] },
      { damage: 6 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, SHELL.reach)
      if (!t) {
        owned.cooldown -= s.cooldown - SHELL.retry
        return
      }
      if (shellSide(dm.hypot(t.x - p.x, t.y - p.y)) === 'slam') {
        spawnAttack(g, {
          ...look('shellSideArm', 'poison', 'shellSlam'), x: t.x, y: t.y - t.radius,
          shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'static' },
          damage: s.damage * SHELL.slam, knockback: s.knockback * 1.6, ttl: 0.28, activeFrom: 0.05, activeUntil: 0.12,
        })
        shakeScreen(g, 1.5)
      } else {
        const d = dirTo(p.x, p.y, t.x, t.y, p.facing)
        spawnAttack(g, {
          ...look('shellSideArm', 'poison', 'shellShot'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'linear', vx: d.x * s.speed, vy: d.y * s.speed },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 1.2,
        })
      }
      cast(g, 'shellSideArm')
    },
  },

  /* Galarian Zigzagoon: arms crossed, the next hit is blocked and answered with an X that breaks the Defense of all it strikes. */
  obstruct: {
    name: 'Obstruct',
    type: 'dark',
    base: stats({ damage: 18, cooldown: 4.6, duration: 1.8, knockback: 140 }),
    status: OBSTRUCT.mark,
    minCooldown: 2.6,
    upgrades: [
      { damage: 5 },
      { duration: 0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.5 }, mods: ['arc'] }] },
      { damage: 6 },
      { cooldown: -0.4 },
      { fork: [{ stats: { area: 0.25 }, mods: ['hunter'] }, { stats: { damage: 6 }, mods: ['drain'] }] },
      { damage: 8, duration: 0.2 },
    ],
    ward: guardWard,
    fire: (g, s, owned) => {
      const p = g.player
      const span = guardWard(s)
      if (!guard(g, 'obstruct', span)) {
        owned.cooldown -= s.cooldown - OBSTRUCT.retry
        return
      }
      spawnAttack(g, {
        ...look('obstruct', 'dark', 'obstructGuard'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 14 }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: 0, ttl: span, activeFrom: Infinity,
      })
      cast(g, 'obstruct')
    },
    onGuard: (g, s) => {
      const p = g.player
      // The guard is spent: its crossed arms go with it.
      for (const a of g.attacks) if (a.move === 'obstruct' && a.visual === 'obstructGuard' && ownAttack(g, a)) a.ttl = a.age
      spawnAttack(g, {
        ...look('obstruct', 'dark', 'obstructX'), x: p.x, y: p.y - 6,
        shape: { kind: 'circle', r: OBSTRUCT.r * 0.5 * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.4, grow: OBSTRUCT.grow * s.area, activeUntil: 0.24,
      })
      shakeScreen(g, 3)
    },
  },

  /* Galarian Farfetch'd: a leek joust through the longest line of foes; it needs a breath after (slower for a moment). */
  meteorAssault: {
    name: 'Meteor Assault',
    type: 'fighting',
    base: stats({ damage: 28, cooldown: 2.7, knockback: 120 }),
    minCooldown: 1.4,
    upgrades: [
      { damage: 6 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['trail'] }] },
      { damage: 7 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 8 }, mods: ['hunter'] }, { stats: { damage: -4 }, mods: ['echo'] }] },
      { damage: 10, area: 0.2 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const target = bestLine(g.enemies, p, JOUST.reach, JOUST.length, JOUST.r * 2)
      if (!target) {
        owned.cooldown -= s.cooldown - JOUST.retry
        return
      }
      const d = dirTo(p.x, p.y, target.x, target.y, p.facing)
      const v = JOUST.length / JOUST.time
      p.iframes = Math.max(p.iframes, JOUST.time + 0.15)
      spawnAttack(g, {
        ...look('meteorAssault', 'fighting', 'leekJoust'), x: p.x, y: p.y - 8, from: { x: p.x, y: p.y },
        shape: { kind: 'circle', r: JOUST.r * s.area }, motion: { kind: 'lunge', vx: d.x * v, vy: d.y * v, left: JOUST.time },
        damage: s.damage, knockback: s.knockback, ttl: JOUST.time + 0.18, activeUntil: JOUST.time,
      })
      // The recharge: Sirfetch'd's lore, the joust leaves it winded.
      addMoveBuff(g, 'meteorAssault', JOUST.time + JOUST.recharge, { speed: -p.stats.speed * JOUST.slow })
      cast(g, 'meteorAssault')
    },
    onHit: (g, a) => {
      if (a.visual === 'leekJoust' && a.hits.size === 1) shakeScreen(g, 2)
    },
  },

  /* Hisuian Voltorb: a burst of green energy all round, strong, that costs a little HP when it lands. */
  chloroblast: {
    name: 'Chloroblast',
    type: 'grass',
    base: stats({ damage: 30, cooldown: 3, knockback: 110 }),
    upgrades: [
      { damage: 6 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.4 }, mods: ['vortex'] }] },
      { damage: 7 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 6 }, mods: ['drain'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { damage: 10, area: 0.15 },
    ],
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('chloroblast', 'grass', 'chloroblast'), x: p.x, y: p.y - 6,
        shape: { kind: 'circle', r: CHLORO.r * 0.45 * s.area }, motion: { kind: 'follow', ox: 0, oy: -6 },
        damage: s.damage, knockback: s.knockback, ttl: 0.42, grow: CHLORO.r * 1.4 * s.area, activeUntil: 0.24,
      })
      burst(g, p.x, p.y - 10, { colors: ['#a8f070', '#f8f880', '#ffffff'], count: 16, speed: 120, ttl: 0.4 })
      cast(g, 'chloroblast')
    },
    onHit: (g, a) => {
      if (a.visual === 'chloroblast' && a.hits.size === 1) recoil(g, CHLORO.recoil)
    },
  },

  /* Hisuian Zorua: a spiteful chill on the thickest crowd that saps their strength and slows them; the afflicted take more. */
  bitterMalice: {
    name: 'Bitter Malice',
    type: 'ghost',
    base: stats({ damage: 12, cooldown: 1.9, knockback: 20 }),
    status: MALICE.weaken,
    upgrades: [
      { damage: 3 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.25 }, mods: ['arc'] }] },
      { damage: 4 },
      { cooldown: -0.2 },
      { fork: [{ stats: { damage: 4 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['vortex'] }] },
      { damage: 6, area: 0.15 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = densestFoe(g.enemies, p.x, p.y, MALICE.reach, MALICE.r * s.area)
      if (!t) {
        owned.cooldown -= s.cooldown - 0.3
        return
      }
      spawnAttack(g, {
        ...look('bitterMalice', 'ghost', 'bitterMalice'), x: t.x, y: t.y - t.radius,
        shape: { kind: 'circle', r: MALICE.r * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.5, activeFrom: 0.08, activeUntil: 0.16,
        bonus: [{ when: 'afflicted', mult: MALICE.afflicted }],
      })
      cast(g, 'bitterMalice')
    },
    onHit: (g, a, e) => {
      if (a.visual === 'bitterMalice') applyStatus(e.status, MALICE.slow, 1, e.boss, 'bitterMalice', g.player.slot)
    },
  },

  /* Hisuian Qwilfish: puffs up and fires barbs all round; poisoned foes take more from them, and Overqwil sprouts more. */
  poisonSting: {
    name: 'Poison Sting',
    type: 'poison',
    base: stats({ damage: 6, cooldown: 1.6, amount: 8, speed: BARBS.speed, pierce: 1 }),
    status: { kind: 'poison', chance: 0.45, duration: 4, power: 0.3 },
    upgrades: [
      { amount: 2 },
      { damage: 2 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { pierce: 1 }, mods: ['trail'] }] },
      { amount: 2 },
      { cooldown: -0.2 },
      { fork: [{ stats: { statusChance: 0.15 }, mods: ['cruel'] }, { stats: { damage: 2 }, mods: ['hunter'] }] },
      { amount: 2, damage: 3 },
    ],
    fire: (g, s) => {
      const p = g.player
      const n = barbCount(s.amount, p.stage)
      const turn = (p.level * 0.37) % 1
      for (let i = 0; i < n; i++) {
        const v = fromAngle(((i + turn) / n) * TAU, s.speed)
        spawnAttack(g, {
          ...look('poisonSting', 'poison', 'barb'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: BARBS.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, pierce: s.pierce, status: s.status, ttl: BARBS.ttl, bonus: [{ when: 'poisoned', mult: BARBS.poisoned }],
        })
      }
      cast(g, 'poisonSting')
    },
  },

  /* Paldean Wooper: a toxic pool on the thickest crowd; each tick there adds a poison stack, and a foe that falls badly poisoned passes it on. */
  toxic: {
    name: 'Toxic',
    type: 'poison',
    base: stats({ damage: 5, cooldown: 2.6, duration: TOXIC.ttl }),
    status: { kind: 'poison', chance: 1, duration: 4, power: 0.3 },
    upgrades: [
      { damage: 1 },
      { area: 0.15 },
      { fork: [{ stats: { duration: 0.6 }, mods: ['vortex'] }, { stats: { cooldown: -0.3 }, mods: ['burstOnKill'] }] },
      { damage: 2 },
      { cooldown: -0.3 },
      { fork: [{ stats: { statusDamage: 0.15 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['cruel'] }] },
      { damage: 2, duration: 0.6 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = densestFoe(g.enemies, p.x, p.y, TOXIC.reach, TOXIC.r * s.area)
      if (!t) {
        owned.cooldown -= s.cooldown - 0.3
        return
      }
      spawnAttack(g, {
        ...look('toxic', 'poison', 'toxicGlob'), x: p.x, y: p.y - 10, from: { x: p.x, y: p.y - 10 },
        shape: { kind: 'circle', r: 4 }, motion: { kind: 'linear', vx: (t.x - p.x) / TOXIC.flight, vy: (t.y - p.y) / TOXIC.flight },
        damage: 0, ttl: TOXIC.flight, activeFrom: Infinity, mod: null,
      })
      spawnAttack(g, {
        ...look('toxic', 'poison', 'toxicPool'), x: t.x, y: t.y,
        shape: { kind: 'circle', r: TOXIC.r * s.area }, motion: { kind: 'static' },
        damage: s.damage, status: s.status, hitInterval: TOXIC.hitInterval, ttl: s.duration + TOXIC.flight, age: -TOXIC.flight,
      })
      cast(g, 'toxic')
    },
  },

  /* Paldean Tauros: a charge at the nearest foe that breaks through bosses; its type is the breed's (Fire burns, Water slows). */
  ragingBull: {
    name: 'Raging Bull',
    type: 'fighting',
    base: stats({ damage: 22, cooldown: 2.2, knockback: 150 }),
    minCooldown: 1.2,
    upgrades: [
      { damage: 5 },
      { area: 0.2 },
      { fork: [{ stats: { damage: 5 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['trail'] }] },
      { damage: 6 },
      { cooldown: -0.25 },
      { fork: [{ stats: { damage: 6 }, mods: ['hunter'] }, { stats: { damage: -3 }, mods: ['echo'] }] },
      { damage: 9, area: 0.2 },
    ],
    fire: (g, s, owned) => {
      const p = g.player
      const t = nearestEnemy(g, p.x, p.y, BULL.reach)
      if (!t) {
        owned.cooldown -= s.cooldown - BULL.retry
        return
      }
      const breed = bullBreed(p.branch)
      const d = dirTo(p.x, p.y, t.x, t.y, p.facing)
      const v = BULL.length / BULL.time
      p.iframes = Math.max(p.iframes, BULL.time + 0.15)
      spawnAttack(g, {
        ...look('ragingBull', breed.type, 'bullCharge'), x: p.x, y: p.y - 8, from: { x: p.x, y: p.y },
        shape: { kind: 'circle', r: BULL.r * s.area }, motion: { kind: 'lunge', vx: d.x * v, vy: d.y * v, left: BULL.time },
        damage: s.damage, knockback: s.knockback, ttl: BULL.time + 0.2, activeUntil: BULL.time,
        ...(breed.status && { status: { ...breed.status, chance: Math.min(1, breed.status.chance + s.statusChance) } }),
        bonus: [{ when: 'boss', mult: BULL.boss }, { when: 'elite', mult: BULL.boss }],
      })
      cast(g, 'ragingBull')
    },
    onHit: (g: Game, a: Attack) => {
      if (a.visual === 'bullCharge' && a.hits.size === 1) shakeScreen(g, 2)
    },
  },
} as const satisfies Record<string, MoveDef>

export type RegionalMoveId = keyof typeof REGIONAL_MOVES

/** The regional moves' ids: they are signatures, so they never evolve (`neverEvolves`). */
export const REGIONAL_MOVE_IDS = Object.keys(REGIONAL_MOVES) as RegionalMoveId[]
