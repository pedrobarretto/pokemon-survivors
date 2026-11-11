import { fromAngle, TAU } from '../engine/math'
import { aimAt, cast, crowdTargets, fan, look, stats } from './legendaryMoves'
import { guard, stacksOf } from './moveKit'
import type { MoveDef } from './moves'
import { nearestEnemy } from './queries'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'
import { shakeScreen } from './effects'

/**
 * The Ultra Beasts' moves (`LEGENDARY_MOVE_OF` in `data/legendaryMoves.ts`),
 * one per playable beast, each its own kit: the legendary tier and rules
 * (Lv1–5, a fork at Lv4, `legendary: true`, never evolve). Their art is
 * `render/ultraFx.ts`, their icons `render/ultraArt.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of the Ultra Beasts' moves, drawn by `render/ultraFx.ts`. */
export type UltraVisual =
  | 'acidGlob' | 'acidPool' | 'pumpBlow' | 'lungeStreak' | 'wireNode' | 'wireArc' | 'rocket' | 'rocketBlast'
  | 'paperCut' | 'cutHit' | 'maw' | 'belch' | 'stoneBlock' | 'headBomb' | 'mindBlast' | 'stinger' | 'jab'

/** Acid Spray: the globs' flight (s) and the puddle each leaves where it lands (radius, share of the damage). */
export const ACID = { flight: 0.75, spread: 0.2, pool: 11, share: 0.25 } as const
/** Power-Up Punch: its reach, the blow's radius, and what each pump (a stack: a hit, lost on getting hurt) adds to its damage and radius. */
export const PUMP_PUNCH = { reach: 90, r: 18, perStack: 0.12, grow: 2, max: 6 } as const
/** Lunge: the streak's speed, length and life. */
export const LUNGE = { speed: 430, r: 7, ttl: 0.42 } as const
/** Tail Glow: how far the nodes stand off Xurkitree (× area), the gap between a wire's segments and how often a wire bites. */
export const WIRE = { reach: 66, gap: 9, r: 6, bite: 0.35 } as const
/** Autotomize: the rockets' rise and fall (s), the beat between them, their blast (× area) and the speed boost after (the weight it shed). */
export const ROCKET = { flight: 0.7, stagger: 0.12, blast: 30, grow: 0.2, haste: { speed: 6 }, hasteFor: 2.4 } as const
/** Guillotine: the cuts' length (× area) and segments, and how long they show. */
export const CUT = { length: 64, segments: 7, r: 6, show: 0.32, execute: 0.08 } as const
/** Belch: Guzzlord's maw (radius × area, pull px/s, its bites' share of the damage) and the belch every third cast (radius × area, damage ×). */
export const MAW = { r: 30, pull: 150, share: 0.35, bite: 0.3, reach: 170, belchR: 74, belch: 2.2, cycle: 3, drain: 0.12 } as const
/** Wide Guard: the wall's arc (rad) and distance, a block's radius, how it rises, and the guard it holds up. */
export const WALL = { arc: 1.5, reach: 34, r: 9, rise: 0.18, guard: 1.2 } as const
/** Mind Blown: the head's flight (s), the blast's first and full radius (× area) and how fast it opens. */
export const MIND = { flight: 0.55, start: 8, r: 46, open: 0.25, reach: 220 } as const
/** Fell Stinger: the needles' turn, life and the boost a KO with one gives (seconds, stats). */
export const STINGER = { turn: 7, ttl: 1.1, r: 3, boostFor: 5, boost: { might: 0.15 } } as const
/** Poison Jab: its reach, the beat between jabs and a jab's radius. */
export const JAB = { reach: 64, gap: 0.08, r: 8, ahead: 22 } as const

/** Where a move lands on `foe`, else `ahead` px the way the player faces. */
const spotOn = (g: Game, foe: Enemy | null, ahead: number) => {
  const p = g.player
  return foe ? { x: foe.x, y: foe.y } : { x: p.x + p.facing.x * ahead, y: p.y - 6 + p.facing.y * ahead }
}

export const ULTRA_MOVES = {
  /* Nihilego */
  acidSpray: {
    name: 'Acid Spray',
    type: 'poison',
    legendary: true,
    base: stats({ damage: 22, cooldown: 1.8, amount: 5, speed: 170, pierce: 2, duration: 1.6, knockback: 25 }),
    // Its neurotoxin: a foe it gets into wanders off and bumps into the others (bosses shrug it off).
    status: { kind: 'confuse', chance: 0.3, duration: 2, power: 0 },
    upgrades: [
      { damage: 6 },
      { amount: 2 },
      { fork: [{ stats: { statusChance: 0.25, duration: 0.6 } }, { stats: { damage: 8 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4, damage: 6 },
    ],
    // Nihilego sprays a fan of acid that eats through two foes, each glob leaving a puddle of it where it lands.
    fire: (g, s) => {
      const p = g.player
      for (const angle of fan(aimAt(g, 220), s.amount, ACID.spread)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('acidSpray', 'poison', 'acidGlob'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: ACID.flight,
        })
        spawnAttack(g, {
          ...look('acidSpray', 'poison', 'acidPool'), x: p.x + v.x * ACID.flight, y: p.y + v.y * ACID.flight,
          shape: { kind: 'circle', r: ACID.pool * s.area }, motion: { kind: 'static' },
          damage: s.damage * ACID.share, status: s.status, hitInterval: 0.5, ttl: s.duration, age: -ACID.flight,
        })
      }
      cast(g, 'acidSpray')
    },
  },

  /* Buzzwole */
  powerUpPunch: {
    name: 'Power-Up Punch',
    type: 'fighting',
    legendary: true,
    tags: ['punch'],
    base: stats({ damage: 50, cooldown: 1.3, knockback: 140 }),
    // Its muscle pump: every hit adds a stack, getting hurt deflates them.
    stacks: { grow: 'hit', max: PUMP_PUNCH.max, reset: 'hurt' },
    upgrades: [
      { damage: 12 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 12 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.25 }, mods: ['drain'] }] },
      { cooldown: -0.25, damage: 12 },
    ],
    // Buzzwole throws a haymaker at the nearest foe; each blow that lands pumps it up, and the next hits harder and wider.
    fire: (g, s, owned) => {
      const pumps = stacksOf(owned)
      const at = spotOn(g, nearestEnemy(g, g.player.x, g.player.y, PUMP_PUNCH.reach), 26)
      const r = (PUMP_PUNCH.r + PUMP_PUNCH.grow * pumps) * s.area
      spawnAttack(g, {
        ...look('powerUpPunch', 'fighting', 'pumpBlow'), x: at.x, y: at.y,
        shape: { kind: 'circle', r }, motion: { kind: 'static' },
        damage: s.damage * (1 + PUMP_PUNCH.perStack * pumps), knockback: s.knockback, status: s.status,
        ttl: 0.3, activeUntil: 0.08, memo: pumps,
      })
      if (pumps >= PUMP_PUNCH.max) shakeScreen(g, 2)
      cast(g, 'powerUpPunch')
    },
  },

  /* Pheromosa */
  lunge: {
    name: 'Lunge',
    type: 'bug',
    legendary: true,
    base: stats({ damage: 34, cooldown: 1.6, amount: 2, speed: LUNGE.speed, knockback: 60 }),
    // The lunge saps the foe's strength: it hits a quarter softer for a while.
    status: { kind: 'weaken', chance: 0.5, duration: 3, power: 0.25 },
    upgrades: [
      { damage: 8 },
      { amount: 1 },
      { fork: [{ stats: { statusChance: 0.3, damage: 4 } }, { stats: { damage: 10 }, mods: ['hunter'] }] },
      { cooldown: -0.35, damage: 8 },
    ],
    // Pheromosa's afterimages streak through the nearest foes faster than the eye, through every foe in the way.
    fire: (g, s) => {
      const p = g.player
      const foes = crowdTargets(g, s.amount, 30, 240)
      for (let i = 0; i < s.amount; i++) {
        const foe = foes[i] ?? null
        const angle = foe ? dm.atan2(foe.y - (p.y - 8), foe.x - p.x) : aimAt(g, 240) + (i - (s.amount - 1) / 2) * 0.5
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('lunge', 'bug', 'lungeStreak'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: LUNGE.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: LUNGE.ttl, age: -i * 0.06,
        })
      }
      cast(g, 'lunge')
    },
  },

  /* Xurkitree */
  tailGlow: {
    name: 'Tail Glow',
    type: 'electric',
    legendary: true,
    base: stats({ damage: 16, cooldown: 3.6, amount: 3, duration: 2.4, knockback: 10 }),
    status: { kind: 'paralysis', chance: 0.12, duration: 1, power: 0 },
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { duration: 1, area: 0.15 } }, { stats: { statusChance: 0.2, damage: 3 }, mods: ['arc'] }] },
      { cooldown: -0.6, damage: 4 },
    ],
    // Xurkitree plants glowing plugs around itself and strings live wires between them: foes caught on a wire are shocked again and again.
    fire: (g, s) => {
      const p = g.player
      const turn = g.time * 0.9
      const reach = WIRE.reach * s.area
      const nodes = Array.from({ length: s.amount }, (_, i) => fromAngle(turn + (i / s.amount) * TAU, reach))
      for (let i = 0; i < s.amount; i++) {
        const a = nodes[i]!
        const b = nodes[(i + 1) % s.amount]!
        spawnAttack(g, {
          ...look('tailGlow', 'electric', 'wireNode'), x: p.x + a.x, y: p.y - 8 + a.y * 0.75,
          shape: { kind: 'circle', r: 5 }, motion: { kind: 'follow', ox: a.x, oy: a.y * 0.75 - 8 },
          damage: 0, ttl: s.duration, activeFrom: Infinity, age: -i * 0.05,
        })
        // The wire: segments along it share one hit list, so a foe on it is bitten once per beat.
        const dx = b.x - a.x
        const dy = (b.y - a.y) * 0.75
        const len = dm.hypot(dx, dy)
        const steps = Math.max(2, Math.ceil(len / WIRE.gap))
        const angle = dm.atan2(dy, dx)
        const hits = new Map<number, number>()
        for (let k = 0; k < steps; k++) {
          const ox = a.x + (dx * k) / steps
          const oy = a.y * 0.75 + (dy * k) / steps - 8
          spawnAttack(g, {
            ...look('tailGlow', 'electric', 'wireArc'), x: p.x + ox, y: p.y + oy,
            shape: { kind: 'circle', r: WIRE.r * s.area }, motion: { kind: 'follow', ox, oy },
            damage: s.damage, knockback: s.knockback, status: s.status, hitInterval: WIRE.bite, hits,
            ttl: s.duration, age: -0.15 - i * 0.05, memo: angle,
          })
        }
      }
      cast(g, 'tailGlow')
    },
  },

  /* Celesteela */
  autotomize: {
    name: 'Autotomize',
    type: 'steel',
    legendary: true,
    base: stats({ damage: 56, cooldown: 3, amount: 3, knockback: 80 }),
    // Its boosters' exhaust can burn.
    status: { kind: 'burn', chance: 0.3, duration: 2, power: 0 },
    upgrades: [
      { damage: 12 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.2 } }, { stats: { damage: 14 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 12 },
    ],
    // Celesteela sheds its plating as rockets: they launch off its arms, arc over and crash down on the densest crowds; lighter, it speeds up.
    fire: (g, s) => {
      const p = g.player
      const targets = crowdTargets(g, s.amount, 70, 240)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const o = fromAngle(i * 2.1 + 0.4, 80)
        const at = t ? { x: t.x, y: t.y } : { x: p.x + o.x, y: p.y + o.y * 0.7 }
        const delay = i * ROCKET.stagger
        spawnAttack(g, {
          ...look('autotomize', 'steel', 'rocket'), x: at.x, y: at.y, from: { x: p.x + (i % 2 ? 8 : -8), y: p.y - 16 },
          shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' },
          damage: 0, ttl: ROCKET.flight, activeFrom: Infinity, age: -delay, flip: i % 2 === 1,
        })
        const r = ROCKET.blast * s.area
        spawnAttack(g, {
          ...look('autotomize', 'steel', 'rocketBlast'), x: at.x, y: at.y,
          shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: ROCKET.grow + 0.2,
          grow: (r - 8) / ROCKET.grow, age: -ROCKET.flight - delay, memo: r,
        })
      }
      addMoveBuff(g, 'autotomize', ROCKET.hasteFor, ROCKET.haste)
      cast(g, 'autotomize')
    },
  },

  /* Kartana */
  guillotine: {
    name: 'Guillotine',
    type: 'normal',
    legendary: true,
    tags: ['slice'],
    base: stats({ damage: 58, cooldown: 1.8, amount: 2, knockback: 40 }),
    upgrades: [
      { damage: 12 },
      { amount: 1 },
      { fork: [{ stats: { damage: 12 }, mods: ['execute'] }, { stats: { cooldown: -0.3 }, mods: ['hunter'] }] },
      { cooldown: -0.3, damage: 12 },
    ],
    // Kartana cuts an X through each of the nearest foes, paper-thin and never missing; a regular foe it leaves nearly spent falls outright.
    fire: (g, s) => {
      const p = g.player
      const foes = crowdTargets(g, s.amount, 40, 200)
      const len = CUT.length * s.area
      for (let i = 0; i < s.amount; i++) {
        const foe = foes[i]
        const o = fromAngle(i * 2.4 + g.time, 50)
        const at = foe ? { x: foe.x, y: foe.y - 6 } : { x: p.x + o.x, y: p.y - 6 + o.y * 0.7 }
        const hits = new Map<number, number>()
        for (const [n, base] of [[0, 0.7], [1, -0.7]] as const) {
          const angle = base + (i % 2 ? 0.3 : 0)
          const delay = i * 0.07 + n * 0.09
          spawnAttack(g, {
            ...look('guillotine', 'steel', 'paperCut'), x: at.x, y: at.y,
            // A cut only shows (its segments hit): its radius is half its length, for the art.
            shape: { kind: 'circle', r: len / 2 }, motion: { kind: 'static' },
            damage: 0, ttl: CUT.show, activeFrom: Infinity, age: -delay, memo: angle,
          })
          for (let k = 0; k < CUT.segments; k++) {
            const d = fromAngle(angle, (k / (CUT.segments - 1) - 0.5) * len)
            spawnAttack(g, {
              ...look('guillotine', 'steel', 'cutHit'), x: at.x + d.x, y: at.y + d.y,
              shape: { kind: 'circle', r: CUT.r * s.area }, motion: { kind: 'static' },
              damage: s.damage, knockback: s.knockback, status: s.status, hits, sure: true, execute: CUT.execute,
              ttl: 0.1, activeUntil: 0.08, age: -delay,
            })
          }
        }
      }
      cast(g, 'guillotine')
    },
  },

  /* Guzzlord */
  belch: {
    name: 'Belch',
    type: 'dark',
    legendary: true,
    tags: ['bite'],
    base: stats({ damage: 44, cooldown: 2.4, duration: 1.2, knockback: 60 }),
    upgrades: [
      { damage: 10 },
      { area: 0.15 },
      { fork: [{ stats: { duration: 0.5, damage: 6 } }, { stats: { damage: 12 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4, damage: 10 },
    ],
    // Guzzlord's maw opens on the densest crowd and drags it in, biting, then shuts on what it caught; every third cast it belches all of it back out around itself.
    fire: (g, s, owned) => {
      const p = g.player
      const turn = stacksOf(owned)
      owned.stacks = (turn + 1) % MAW.cycle
      if (turn === MAW.cycle - 1) {
        const r = MAW.belchR * s.area
        spawnAttack(g, {
          ...look('belch', 'dark', 'belch'), x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: -6 },
          damage: s.damage * MAW.belch, knockback: s.knockback * 2, status: s.status, ttl: 0.4,
          grow: (r - 10) / 0.25, memo: r,
        })
        shakeScreen(g, 3)
        cast(g, 'belch')
        return
      }
      const [t] = crowdTargets(g, 1, 60, MAW.reach)
      const at = spotOn(g, t ?? null, 50)
      const r = MAW.r * s.area
      spawnAttack(g, {
        ...look('belch', 'dark', 'maw'), x: at.x, y: at.y,
        shape: { kind: 'circle', r }, motion: { kind: 'static' },
        damage: s.damage * MAW.share, status: s.status, hitInterval: MAW.bite, pull: MAW.pull, ttl: s.duration,
      })
      // The bite as the maw shuts: it heals on what it devours.
      spawnAttack(g, {
        ...look('belch', 'dark', 'maw'), x: at.x, y: at.y,
        shape: { kind: 'circle', r: r * 0.8 }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, drain: MAW.drain, ttl: 0.25, activeUntil: 0.08, age: -s.duration, memo: 1,
      })
      cast(g, 'belch')
    },
  },

  /* Stakataka */
  wideGuard: {
    name: 'Wide Guard',
    type: 'rock',
    legendary: true,
    base: stats({ damage: 30, cooldown: 3.6, amount: 5, duration: 2.4, knockback: 170 }),
    upgrades: [
      { damage: 8 },
      { amount: 2 },
      { fork: [{ stats: { duration: 1, area: 0.15 } }, { stats: { damage: 10, knockback: 60 }, mods: ['hunter'] }] },
      { cooldown: -0.6, damage: 8 },
    ],
    // Stakataka's stones leave it and stack into a wall across its front, shoving back every foe that runs into it; while it rises, the first hit on Stakataka is blocked.
    fire: (g, s) => {
      const p = g.player
      const aim = aimAt(g, 200)
      const reach = WALL.reach * s.area
      for (const [i, angle] of fan(aim, s.amount, WALL.arc / Math.max(1, s.amount - 1)).entries()) {
        const o = fromAngle(angle, reach)
        spawnAttack(g, {
          ...look('wideGuard', 'rock', 'stoneBlock'), x: p.x + o.x, y: p.y - 4 + o.y * 0.8,
          shape: { kind: 'circle', r: WALL.r * s.area }, motion: { kind: 'follow', ox: o.x, oy: o.y * 0.8 - 4 },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.6, ttl: s.duration, age: -i * 0.03, flip: i % 2 === 1,
        })
      }
      guard(g, 'wideGuard', WALL.guard)
      cast(g, 'wideGuard')
    },
  },

  /* Blacephalon */
  mindBlown: {
    name: 'Mind Blown',
    type: 'fire',
    legendary: true,
    base: stats({ damage: 68, cooldown: 2.4, amount: 1, knockback: 120 }),
    status: { kind: 'burn', chance: 0.35, duration: 2, power: 0 },
    upgrades: [
      { damage: 14 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 1, damage: -6 } }, { stats: { damage: 16 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4, damage: 14 },
    ],
    // Blacephalon lobs its own head onto the densest crowd, where it blows up in a burst of fire and confetti; a new one lights up on its shoulders.
    fire: (g, s) => {
      const p = g.player
      const targets = crowdTargets(g, s.amount, 70, MIND.reach)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const o = fromAngle(i * 2.4 + 0.6, 70)
        const at = t ? { x: t.x, y: t.y } : { x: p.x + o.x, y: p.y + o.y * 0.7 }
        const delay = i * 0.12
        spawnAttack(g, {
          ...look('mindBlown', 'fire', 'headBomb'), x: at.x, y: at.y, from: { x: p.x, y: p.y - 20 },
          shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' },
          damage: 0, ttl: MIND.flight, activeFrom: Infinity, age: -delay,
        })
        const r = MIND.r * s.area
        spawnAttack(g, {
          ...look('mindBlown', 'fire', 'mindBlast'), x: at.x, y: at.y,
          shape: { kind: 'circle', r: MIND.start }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: MIND.open + 0.2,
          grow: (r - MIND.start) / MIND.open, age: -MIND.flight - delay, memo: r,
        })
      }
      cast(g, 'mindBlown')
    },
  },

  /* Naganadel */
  fellStinger: {
    name: 'Fell Stinger',
    type: 'bug',
    legendary: true,
    base: stats({ damage: 26, cooldown: 1.2, amount: 4, speed: 300, pierce: 1, knockback: 30 }),
    upgrades: [
      { damage: 6 },
      { amount: 2 },
      { fork: [{ stats: { pierce: 1, damage: 4 } }, { stats: { damage: 6 }, mods: ['split'] }] },
      { cooldown: -0.25, damage: 6 },
    ],
    // Naganadel fires stingers that home in on the nearest foes; a foe one finishes off sharpens it (+15% damage for 5 s).
    fire: (g, s) => {
      const p = g.player
      const foes = crowdTargets(g, s.amount, 20, 260)
      for (const [i, angle] of fan(aimAt(g, 260), s.amount, 0.35).entries()) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('fellStinger', 'bug', 'stinger'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: STINGER.r * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: STINGER.turn, target: foes[i] ?? null },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: STINGER.ttl, age: -i * 0.04,
        })
      }
      cast(g, 'fellStinger')
    },
    onHit: (g, _a, e) => {
      if (e.hp <= 0) addMoveBuff(g, 'fellStinger', STINGER.boostFor, STINGER.boost)
    },
  },

  /* Poipole */
  poisonJab: {
    name: 'Poison Jab',
    type: 'poison',
    legendary: true,
    base: stats({ damage: 18, cooldown: 1.1, amount: 3, knockback: 50 }),
    status: { kind: 'poison', chance: 0.4, duration: 3, power: 0 },
    upgrades: [
      { damage: 5 },
      { amount: 1 },
      { fork: [{ stats: { statusChance: 0.3, statusDamage: 0.25 } }, { stats: { damage: 6 }, mods: ['drain'] }] },
      { cooldown: -0.2, damage: 5 },
    ],
    // Poipole jabs its venom needle into the nearest foe in quick succession.
    fire: (g, s) => {
      const p = g.player
      const foe = nearestEnemy(g, p.x, p.y, JAB.reach)
      const angle = foe ? dm.atan2(foe.y - (p.y - 8), foe.x - p.x) : dm.atan2(p.facing.y, p.facing.x)
      for (let i = 0; i < s.amount; i++) {
        const sway = (i % 2 ? 1 : -1) * 0.25 * (i > 0 ? 1 : 0)
        const o = fromAngle(angle + sway, JAB.ahead)
        spawnAttack(g, {
          ...look('poisonJab', 'poison', 'jab'), x: p.x + o.x, y: p.y - 8 + o.y,
          shape: { kind: 'circle', r: JAB.r * s.area }, motion: { kind: 'follow', ox: o.x, oy: o.y - 8 },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.14, activeUntil: 0.06, age: -i * JAB.gap, memo: angle + sway,
        })
      }
      cast(g, 'poisonJab')
    },
  },
} as const satisfies Record<string, MoveDef>

export type UltraMoveId = keyof typeof ULTRA_MOVES
