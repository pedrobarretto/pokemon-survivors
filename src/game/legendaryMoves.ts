import { dirTo, fromAngle, TAU } from '../engine/math'
import { range } from '../engine/rng'
import { burst, shakeScreen } from './effects'
import { strike } from './moveKit'
import type { Look, MoveDef, MoveId, MoveStats } from './moves'
import { enemiesInView, nearestEnemy } from './queries'
import { densestFoe } from './signatureRules'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import type { Enemy, Game, OwnedMove } from './types'
import * as dm from '../engine/dmath'

/**
 * Legendary moves: one capstone per rift legendary and per mythical of the
 * finale, the biggest effects in the game. They are evolved-tier (Lv1–5, a
 * fork at Lv4), never evolve (`legendary: true`, exempt from the evolution
 * rule) and come from the legendaries themselves (`LEGENDARY_MOVE_OF` in
 * `data/legendaryMoves.ts`). Spread at the end of `MOVES`; their per-tick side
 * (launches, the cyclone's last gust) lives in `legendary.ts` and their art in
 * `render/legendaryFx.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

export const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

/** Angles spread evenly around `center`, `step` radians apart. */
export const fan = (center: number, count: number, step: number) =>
  Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

/** Toward `foe`, else toward the nearest foe within `range`, else the way the player faces. */
export const aimAt = (g: Game, range: number, foe: Enemy | null = null) => {
  const p = g.player
  const target = foe ?? nearestEnemy(g, p.x, p.y, range)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

export const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSfx.ts`). */
export const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Whether the second branch was taken at the Lv4 fork (step index 2), like `branchAt` in `moves.ts`. */
export const tookB = (owned: OwnedMove) => owned.level >= 4 && ((owned.path ?? 0) >> 2) & 1

/** Up to `count` foes in view, densest crowds first, never two within `apart` px of each other. */
export const crowdTargets = (g: Game, count: number, apart: number, reach: number) => {
  const p = g.player
  const pool = enemiesInView(g).filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= reach * reach)
  const picked: Enemy[] = []
  while (picked.length < count) {
    const free = pool.filter((e) => picked.every((o) => dm.sq(o.x - e.x) + dm.sq(o.y - e.y) > apart * apart))
    const best = densestFoe(free, p.x, p.y, reach, 50)
    if (!best) break
    picked.push(best)
  }
  return picked
}

/** The visuals of the legendary moves, drawn by `render/legendaryFx.ts`. */
export type LegendaryVisual =
  | 'whirlwind' | 'whirlBurst' | 'phoenix' | 'sacredFlame' | 'originRing' | 'originBeam' | 'sandWave' | 'hotSand'
  | 'ascentRise' | 'ascentComet' | 'ascentImpact' | 'timeClock' | 'timeRing' | 'timeSnap' | 'mistBall' | 'mistCloud'
  | 'lusterBeam' | 'boostCore' | 'boostComet' | 'boostBurst' | 'wishStar' | 'wishFall' | 'wishBurst'
  | 'ancientRock' | 'magicalLeaf' | 'voidOrb' | 'voidBurst' | 'voidPool'

/** Whirlwind: the cyclone's pull (px/s) and the gust it ends with (× damage, × area). */
export const WHIRL = { pull: 150, burst: 2.2, burstR: 46 } as const
/** Sacred Fire: px between the flames the phoenix leaves, and how far it flies. */
export const SACRED = { gap: 22, reach: 420, flame: 0.3 } as const
/** Origin Pulse: the ring's final radius (× area), its seconds, and the beams' length and share of the damage. */
export const ORIGIN = { reach: 150, time: 0.7, beam: 180, beamShare: 0.6, beamAt: 0.22 } as const
/** Scorching Sands: the wall's span in rad, its seconds, and the hot sand it leaves (rows, share of damage). */
export const SANDS = { span: 1.2, wall: 26, time: 0.85, rows: 4, share: 0.25 } as const
/** Dragon Ascent: seconds before the first dive lands and between dives, the impact's radius. */
export const ASCENT = { first: 0.55, gap: 0.3, r: 34 } as const
/** Roar of Time: the time ring's reach and seconds; time snaps back for this share of the damage. */
export const TIME = { reach: 230, time: 0.8, snap: 0.6 } as const
/** Mist Ball: the shortest and longest flight in seconds, and the mist's share of the damage. */
export const MIST = { minFlight: 0.5, maxFlight: 1.5, share: 0.5 } as const
/** Luster Purge: the beam's arc (rad), length and segment radius. */
export const LUSTER = { arc: 1.5, length: 180, segments: 10, r: 9 } as const
/** Psycho Boost: when the comets launch from the core, a beat between each, and their blast radius. */
export const BOOST = { launch: 0.5, stagger: 0.06, blast: 26 } as const
/** Wish: when the first star lands and the beat between stars; the share of their damage that heals. */
export const WISH = { first: 0.45, gap: 0.08, drain: 0.25 } as const
/** Ancient Power: when the stones launch, the odds that a cast raises every stat, and by how much. */
export const ANCIENT = { launch: 0.5, odds: 0.3, surgeOdds: 0.6 } as const
/** Magical Leaf: when the leaves launch (plus a stagger each) and how hard they turn: they never miss. */
export const LEAF = { launch: 0.3, stagger: 0.025, turn: 10 } as const

/** Dark Void: the orbs' flight, the void's first and full radius (× area), how fast it opens, and how long its sleep lasts. */
export const VOID = { flight: 0.4, stagger: 0.08, start: 8, r: 44, open: 0.3, sleep: 3 } as const

/** Ancient Power's raise of every stat (the games' Ancient Power), while its buff lasts. */
export const ANCIENT_BOOST = { might: 0.12, area: 0.08, cooldown: -0.06, speed: 8, armor: 1 } as const

export const LEGENDARY_MOVES = {
  /* Lugia */
  whirlwind: {
    name: 'Whirlwind',
    type: 'flying',
    legendary: true,
    base: stats({ damage: 26, cooldown: 4.6, amount: 1, speed: 46, duration: 3.2, knockback: 30 }),
    upgrades: [
      { damage: 7 },
      { area: 0.2, duration: 0.5 },
      { fork: [{ stats: { amount: 1, damage: -3 } }, { stats: { damage: 6 }, mods: ['arc'] }] },
      { cooldown: -0.7, damage: 7 },
    ],
    // A silver cyclone rises on the densest crowd and roams, pulling foes into its eye; it ends in a gust that flings them away.
    fire: (g, s) => {
      const targets = crowdTargets(g, s.amount, 80, 220)
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const at = t ? { x: t.x, y: t.y } : { x: p.x + fromAngle(i * 2.4, 60).x, y: p.y + fromAngle(i * 2.4, 60).y * 0.7 }
        spawnAttack(g, {
          ...look('whirlwind', 'flying', 'whirlwind'), x: at.x, y: at.y,
          shape: { kind: 'circle', r: 24 * s.area },
          motion: { kind: 'wander', heading: g.rng() * TAU, speed: s.speed, turn: 2.5, leash: 140 },
          damage: s.damage, knockback: s.knockback, hitInterval: 0.3, ttl: s.duration, pull: WHIRL.pull, age: -i * 0.15,
        })
      }
      cast(g, 'whirlwind')
    },
  },

  /* Ho-Oh */
  sacredFire: {
    name: 'Sacred Fire',
    type: 'fire',
    legendary: true,
    base: stats({ damage: 50, cooldown: 3.4, amount: 1, speed: 240, duration: 2.4, knockback: 60 }),
    status: { kind: 'burn', chance: 0.5, duration: 3, power: 0.45 },
    upgrades: [
      { damage: 12 },
      { duration: 0.6, statusChance: 0.15 },
      { fork: [{ stats: { damage: 6 }, mods: ['burstOnKill'] }, { stats: { amount: 1, damage: -5 } }] },
      { cooldown: -0.5, amount: 1 },
    ],
    // A phoenix of sacred flame streaks through the crowd and leaves a line of rainbow fire that burns.
    fire: (g, s) => {
      const p = g.player
      const crowd = crowdTargets(g, 1, 0, 260)[0] ?? null
      const reach = SACRED.reach * Math.max(1, s.area)
      for (const angle of fan(aimAt(g, 260, crowd), s.amount, 0.55)) {
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('sacredFire', 'fire', 'phoenix'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 15 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: reach / s.speed, memo: angle,
        })
        for (let d = SACRED.gap; d < reach; d += SACRED.gap) {
          const at = fromAngle(angle, d)
          spawnAttack(g, {
            ...look('sacredFire', 'fire', 'sacredFlame'), x: p.x + at.x, y: p.y - 4 + at.y,
            shape: { kind: 'circle', r: 10 * s.area }, motion: { kind: 'static' },
            damage: s.damage * SACRED.flame, status: s.status, hitInterval: 0.5, ttl: s.duration,
            age: -d / s.speed, flip: d % (SACRED.gap * 2) === 0,
          })
        }
      }
      cast(g, 'sacredFire')
    },
  },

  /* Kyogre */
  originPulse: {
    name: 'Origin Pulse',
    type: 'water',
    legendary: true,
    base: stats({ damage: 56, cooldown: 3.4, amount: 6, duration: ORIGIN.time, knockback: 130 }),
    upgrades: [
      { damage: 14 },
      { amount: 2, area: 0.1 },
      { fork: [{ stats: { area: 0.2 }, mods: ['echo'] }, { stats: { damage: 16 }, mods: ['arc'] }] },
      { cooldown: -0.6, amount: 2 },
    ],
    // A tidal ring of glowing water bursts from the player to the edge of the screen, then beams of light shoot out of it.
    fire: (g, s) => {
      const p = g.player
      const reach = ORIGIN.reach * s.area
      spawnAttack(g, {
        ...look('originPulse', 'water', 'originRing'), x: p.x, y: p.y - 6,
        shape: { kind: 'circle', r: 10 }, motion: { kind: 'follow', ox: 0, oy: -6 },
        damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (reach - 10) / s.duration, memo: reach,
      })
      const length = ORIGIN.beam * s.area
      const turn = g.time * 0.9
      for (let i = 0; i < s.amount; i++) {
        const angle = turn + (i / s.amount) * TAU
        const d = fromAngle(angle)
        const hits = new Map<number, number>()
        for (let k = 1; k <= 9; k++) {
          const dist = (length * k) / 9
          spawnAttack(g, {
            ...look('originPulse', 'water', 'hitbox'), x: p.x + d.x * dist, y: p.y - 8 + d.y * dist,
            shape: { kind: 'circle', r: 8 * s.area }, motion: { kind: 'static' },
            damage: s.damage * ORIGIN.beamShare, knockback: 40, hits, ttl: 0.12, age: -ORIGIN.beamAt - k * 0.012,
          })
        }
        spawnAttack(g, {
          ...look('originPulse', 'water', 'originBeam'), x: p.x + d.x * length, y: p.y - 8 + d.y * length,
          from: { x: p.x, y: p.y - 8 }, shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'static' },
          damage: 0, ttl: 0.32, activeFrom: Infinity, age: -ORIGIN.beamAt, memo: angle,
        })
      }
      shakeScreen(g, 2.5)
      cast(g, 'originPulse')
    },
  },

  /* Groudon */
  scorchingSands: {
    name: 'Scorching Sands',
    type: 'ground',
    legendary: true,
    base: stats({ damage: 46, cooldown: 2.6, amount: 1, speed: 180, duration: 2.6, knockback: 110 }),
    status: { kind: 'burn', chance: 0.3, duration: 2.5, power: 0.35 },
    upgrades: [
      { damage: 10 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 } }, { stats: { damage: 14, duration: 1, statusDamage: 0.3 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4, damage: 12 },
    ],
    // A wall of scorching sand surges out toward the foes and leaves the ground glowing hot, burning whoever stands on it.
    fire: (g, s) => {
      const p = g.player
      const aim = aimAt(g, 220)
      const span = SANDS.span * Math.min(1.4, s.area)
      for (const angle of fan(aim, s.amount, Math.PI * 0.6)) {
        const v = fromAngle(angle, s.speed)
        const hits = new Map<number, number>()
        for (let k = -3; k <= 3; k++) {
          const off = fromAngle(angle + (k / 3) * (span / 2), SANDS.wall * s.area)
          spawnAttack(g, {
            ...look('scorchingSands', 'ground', 'hitbox'), x: p.x + off.x, y: p.y - 6 + off.y,
            shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
            damage: s.damage, knockback: s.knockback, status: s.status, hits, ttl: SANDS.time,
          })
        }
        spawnAttack(g, {
          ...look('scorchingSands', 'ground', 'sandWave'), x: p.x, y: p.y - 6,
          shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: 0, ttl: SANDS.time, activeFrom: Infinity, memo: span,
        })
        // The hot sand: a few rows across the wall's path, laid as it passes.
        for (let row = 1; row <= SANDS.rows; row++) {
          const dist = (row / SANDS.rows) * s.speed * SANDS.time * 0.92
          for (let k = -1; k <= 1; k++) {
            const off = fromAngle(angle + k * span * 0.32, dist)
            spawnAttack(g, {
              ...look('scorchingSands', 'ground', 'hotSand'), x: p.x + off.x, y: p.y + off.y,
              shape: { kind: 'circle', r: 13 * s.area }, motion: { kind: 'static' },
              damage: s.damage * SANDS.share, status: s.status, hitInterval: 0.5, ttl: s.duration,
              age: -dist / s.speed, flip: (row + k) % 2 === 0,
            })
          }
        }
      }
      shakeScreen(g, 1.5)
      cast(g, 'scorchingSands')
    },
  },

  /* Rayquaza */
  dragonAscent: {
    name: 'Dragon Ascent',
    type: 'flying',
    legendary: true,
    base: stats({ damage: 110, cooldown: 3.4, amount: 2, knockback: 170 }),
    upgrades: [
      { damage: 25 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 } }, { stats: { damage: 40 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, amount: 1 },
    ],
    // The player soars into the sky in a green streak, then dives as a comet onto the densest crowds, one after another.
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('dragonAscent', 'flying', 'ascentRise'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: 0 },
        damage: 0, ttl: 0.45, activeFrom: Infinity,
      })
      const targets = crowdTargets(g, s.amount, 70, 240)
      const r = ASCENT.r * s.area
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const at = t ? { x: t.x, y: t.y } : { x: p.x + fromAngle(i * 2.1 + 0.6, 70).x, y: p.y + fromAngle(i * 2.1 + 0.6, 70).y * 0.7 }
        const delay = ASCENT.first + i * ASCENT.gap
        spawnAttack(g, {
          ...look('dragonAscent', 'flying', 'ascentComet'), x: at.x, y: at.y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: 0, ttl: delay, activeFrom: Infinity, flip: i % 2 === 1,
        })
        strike(g, s, look('dragonAscent', 'flying', 'ascentImpact'), at.x, at.y, r, delay, 0.5)
      }
      cast(g, 'dragonAscent')
    },
  },

  /* Dialga */
  roarOfTime: {
    name: 'Roar of Time',
    type: 'dragon',
    legendary: true,
    base: stats({ damage: 140, cooldown: 5.4, duration: 1.3, knockback: 0 }),
    // Time stops: the foes freeze where they stand, and the next hit on them lands twice as hard.
    status: { kind: 'freeze', chance: 1, duration: 1.3, power: 0 },
    upgrades: [
      { damage: 35 },
      { area: 0.15, duration: 0.3 },
      { fork: [{ stats: { cooldown: -0.7 } }, { stats: { damage: 40 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.6, damage: 35 },
    ],
    // A clock rings out from the player across the whole screen and stops time; when it starts again, it snaps back on them.
    fire: (g, s) => {
      const p = g.player
      const reach = TIME.reach * s.area
      spawnAttack(g, {
        ...look('roarOfTime', 'dragon', 'timeClock'), x: p.x, y: p.y - 10,
        shape: { kind: 'circle', r: 14 }, motion: { kind: 'follow', ox: 0, oy: -10 },
        damage: 0, ttl: TIME.time + s.duration, activeFrom: Infinity, memo: s.duration,
      })
      spawnAttack(g, {
        ...look('roarOfTime', 'dragon', 'timeRing'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 12 }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage, status: s.status, ttl: TIME.time, grow: (reach - 12) / TIME.time, memo: reach,
      })
      // Time starts again: a snap over everything the ring reached, which the freeze doubles.
      spawnAttack(g, {
        ...look('roarOfTime', 'dragon', 'timeSnap'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: reach }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage * TIME.snap, knockback: 90, ttl: 0.4, activeUntil: 0.05, age: -(TIME.time * 0.5 + s.duration),
      })
      shakeScreen(g, 3)
      cast(g, 'roarOfTime')
    },
  },

  /* Latias */
  mistBall: {
    name: 'Mist Ball',
    type: 'psychic',
    legendary: true,
    base: stats({ damage: 24, cooldown: 2.4, amount: 2, speed: 120, duration: 2.6, knockback: 30 }),
    // Mist Ball lowers the foes' power: weakened foes deal less contact damage.
    status: { kind: 'weaken', chance: 1, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 7 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.25 }, mods: ['echo'] }, { stats: { duration: 1, damage: 5 }, mods: ['arc'] }] },
      { cooldown: -0.4, amount: 1 },
    ],
    // Glowing orbs of down drift toward different foes and burst into a lingering mist that keeps hurting and weakening them.
    fire: (g, s) => {
      const p = g.player
      const taken = new Set<number>()
      for (let i = 0; i < s.amount; i++) {
        const t = nearestEnemy(g, p.x, p.y, 240, taken)
        if (t) taken.add(t.id)
        const angle = t ? aimAt(g, 240, t) : g.time * 2 + (i / s.amount) * TAU
        const dist = t ? dm.hypot(t.x - p.x, t.y - p.y) : s.speed
        const flight = Math.max(MIST.minFlight, Math.min(MIST.maxFlight, dist / s.speed))
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('mistBall', 'psychic', 'mistBall'), x: p.x, y: p.y - 10,
          shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, status: s.status, hitInterval: 0.4, ttl: flight, age: -i * 0.1,
        })
        spawnAttack(g, {
          ...look('mistBall', 'psychic', 'mistCloud'), x: p.x + v.x * flight, y: p.y - 4 + v.y * flight,
          shape: { kind: 'circle', r: 30 * s.area }, motion: { kind: 'static' },
          damage: s.damage * MIST.share, status: s.status, hitInterval: 0.5, ttl: s.duration, age: -flight - i * 0.1, flip: i % 2 === 1,
        })
      }
      cast(g, 'mistBall')
    },
  },

  /* Latios */
  lusterPurge: {
    name: 'Luster Purge',
    type: 'psychic',
    legendary: true,
    base: stats({ damage: 72, cooldown: 2.4, amount: 1, duration: 0.55, knockback: 80 }),
    // Luster Purge lowers the foes' defense: marked foes take more damage from every hit.
    status: { kind: 'mark', chance: 0.6, duration: 4, power: 0.15 },
    upgrades: [
      { damage: 16 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 } }, { stats: { damage: 16, statusChance: 0.3 }, mods: ['arc'] }] },
      { cooldown: -0.4, damage: 16 },
    ],
    // A beam of pure light sweeps across the foes in front of the player.
    fire: (g, s, owned) => {
      const p = g.player
      const aim = aimAt(g, 220)
      const length = LUSTER.length * s.area
      // Each cast sweeps the other way.
      const side = (owned.stacks ?? 0) % 2 === 0 ? 1 : -1
      owned.stacks = ((owned.stacks ?? 0) + 1) % 2
      for (let i = 0; i < s.amount; i++) {
        const center = aim + (i / s.amount) * TAU
        const from = center - (side * LUSTER.arc) / 2
        const spin = (side * LUSTER.arc) / s.duration
        const hits = new Map<number, number>()
        for (let k = 0; k < LUSTER.segments; k++) {
          const radius = 12 + ((length - 12) * k) / (LUSTER.segments - 1)
          spawnAttack(g, {
            ...look('lusterPurge', 'psychic', 'hitbox'), x: p.x + dm.cos(from) * radius, y: p.y - 8 + dm.sin(from) * radius,
            shape: { kind: 'circle', r: LUSTER.r * s.area }, motion: { kind: 'orbit', angle: from, spin, radius },
            damage: s.damage, knockback: s.knockback, status: s.status, hits, ttl: s.duration,
          })
        }
        spawnAttack(g, {
          ...look('lusterPurge', 'psychic', 'lusterBeam'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: LUSTER.r * s.area }, motion: { kind: 'orbit', angle: from, spin, radius: 0 },
          damage: 0, ttl: s.duration + 0.12, activeFrom: Infinity, memo: length,
        })
      }
      cast(g, 'lusterPurge')
    },
  },

  /* Deoxys */
  psychoBoost: {
    name: 'Psycho Boost',
    type: 'psychic',
    legendary: true,
    base: stats({ damage: 64, cooldown: 3, amount: 4, speed: 250, knockback: 90 }),
    upgrades: [
      { damage: 14 },
      { amount: 2 },
      { fork: [{ stats: { damage: 16 }, mods: ['burstOnKill'] }, { stats: { amount: 2, damage: -8 }, mods: ['arc'] }] },
      { cooldown: -0.4, damage: 14 },
    ],
    // Deoxys's power gathers into a core over the player, then fires homing comets that blow up on the foes.
    fire: (g, s) => {
      spawnAttack(g, {
        ...look('psychoBoost', 'psychic', 'boostCore'), x: g.player.x, y: g.player.y - 30,
        shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -30 },
        damage: 0, ttl: BOOST.launch + s.amount * BOOST.stagger + 0.1, activeFrom: Infinity,
      })
      for (let i = 0; i < s.amount; i++) {
        const o = fromAngle((i / s.amount) * TAU, 15)
        spawnAttack(g, {
          ...look('psychoBoost', 'psychic', 'boostComet'), x: g.player.x + o.x, y: g.player.y - 30 + o.y * 0.5,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'follow', ox: o.x, oy: -30 + o.y * 0.5 },
          damage: s.damage, knockback: s.knockback, pierce: 1, ttl: 3,
          activeFrom: BOOST.launch + i * BOOST.stagger, blast: BOOST.blast * s.area, blastVisual: 'boostBurst',
          memo: BOOST.launch + i * BOOST.stagger,
        })
      }
      cast(g, 'psychoBoost')
    },
  },

  /* Jirachi */
  wish: {
    name: 'Wish',
    type: 'normal',
    legendary: true,
    base: stats({ damage: 62, cooldown: 3.6, amount: 6, knockback: 70 }),
    upgrades: [
      { amount: 2 },
      { damage: 14 },
      { fork: [{ stats: { area: 0.25 }, mods: ['burstOnKill'] }, { stats: { amount: 3, damage: -8 }, mods: ['echo'] }] },
      { cooldown: -0.5, amount: 2 },
    ],
    // Jirachi's wish: a shower of wishing stars falls on the foes across the screen, and part of their damage heals.
    fire: (g, s) => {
      const p = g.player
      spawnAttack(g, {
        ...look('wish', 'normal', 'wishStar'), x: p.x, y: p.y - 30,
        shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -30 },
        damage: 0, ttl: WISH.first + 0.25, activeFrom: Infinity,
      })
      const pool = enemiesInView(g)
      const r = 18 * s.area
      for (let i = 0; i < s.amount; i++) {
        const e = pool.length > 0 ? pool.splice(Math.floor(g.rng() * pool.length), 1)[0]! : null
        const at = e ? { x: e.x, y: e.y } : { x: p.x + range(g.rng, -120, 120), y: p.y + range(g.rng, -70, 70) }
        const delay = WISH.first + i * WISH.gap
        spawnAttack(g, {
          ...look('wish', 'normal', 'wishFall'), x: at.x, y: at.y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: 0, ttl: delay, activeFrom: Infinity, flip: i % 2 === 1,
        })
        const hit = strike(g, s, look('wish', 'normal', 'wishBurst'), at.x, at.y, r, delay, 0.4)
        hit.drain = WISH.drain
      }
      cast(g, 'wish')
    },
  },

  /* Mew */
  ancientPower: {
    name: 'Ancient Power',
    type: 'rock',
    legendary: true,
    base: stats({ damage: 50, cooldown: 2.4, amount: 6, speed: 290, duration: 6, pierce: 4, knockback: 100 }),
    upgrades: [
      { damage: 12 },
      { amount: 2 },
      { fork: [{ stats: { duration: 2 } }, { stats: { damage: 14 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4, damage: 12 },
    ],
    // Ancient stones rise around the player glowing with Mew's power and shoot at the foes; sometimes every stat rises too.
    fire: (g, s, owned) => {
      for (let i = 0; i < s.amount; i++) {
        const o = fromAngle(g.time * 1.3 + (i / s.amount) * TAU, 30 * s.area)
        spawnAttack(g, {
          ...look('ancientPower', 'rock', 'ancientRock'), x: g.player.x + o.x, y: g.player.y - 10 + o.y * 0.6,
          shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'follow', ox: o.x, oy: -10 + o.y * 0.6 },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 3, activeFrom: ANCIENT.launch,
          memo: ANCIENT.launch + i * 0.04, flip: i % 2 === 1,
        })
      }
      // The surge branch (Lv4 A) raises every stat twice as often.
      const odds = owned.level >= 4 && !tookB(owned) ? ANCIENT.surgeOdds : ANCIENT.odds
      if (g.rng() < odds) {
        addMoveBuff(g, 'ancientPower', s.duration, ANCIENT_BOOST)
        burst(g, g.player.x, g.player.y - 12, { colors: ['#f8a8d8', '#ffffff', '#d8b878'], count: 16, speed: 90, ttl: 0.5, size: 2 })
        g.events.push({ kind: 'cast', move: 'ancientPower' })
      }
    },
  },

  /* Celebi */
  magicalLeaf: {
    name: 'Magical Leaf',
    type: 'grass',
    legendary: true,
    base: stats({ damage: 32, cooldown: 1.8, amount: 10, speed: 240, pierce: 1, knockback: 30 }),
    upgrades: [
      { amount: 2 },
      { damage: 8 },
      { fork: [{ stats: { damage: 4 }, mods: ['echo'] }, { stats: { amount: 4, damage: -6 } }] },
      { cooldown: -0.3, damage: 8 },
    ],
    // A ring of glowing leaves bursts around the player, hovers a beat, then each leaf homes in on its own foe: it never misses.
    fire: (g, s) => {
      for (let i = 0; i < s.amount; i++) {
        const o = fromAngle((i / s.amount) * TAU + g.time, 34 * s.area)
        spawnAttack(g, {
          ...look('magicalLeaf', 'grass', 'magicalLeaf'), x: g.player.x + o.x, y: g.player.y - 10 + o.y * 0.7,
          shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'follow', ox: o.x, oy: -10 + o.y * 0.7 },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 2.4, activeFrom: LEAF.launch,
          memo: LEAF.launch + i * LEAF.stagger, flip: i % 2 === 1,
        })
      }
      cast(g, 'magicalLeaf')
    },
  },

  /* Darkrai (the Noite das Bruxas' event legend) */
  darkVoid: {
    name: 'Dark Void',
    type: 'dark',
    legendary: true,
    base: stats({ damage: 62, cooldown: 3, amount: 2, duration: VOID.sleep, knockback: 0 }),
    // The foes fall asleep where they stand: no steps, no contact damage, until a hit wakes them (Bad Dreams hurts without waking them).
    status: { kind: 'sleep', chance: 1, duration: VOID.sleep, power: 0 },
    upgrades: [
      { damage: 14 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 } }, { stats: { damage: 16 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 14 },
    ],
    // Orbs of darkness float to the densest crowds and open into voids that swallow the foes into sleep.
    fire: (g, s) => {
      const p = g.player
      const targets = crowdTargets(g, s.amount, 90, 230)
      const r = VOID.r * s.area
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const o = fromAngle(i * 2.4 + 0.8, 70)
        const at = t ? { x: t.x, y: t.y } : { x: p.x + o.x, y: p.y + o.y * 0.7 }
        const delay = i * VOID.stagger
        spawnAttack(g, {
          ...look('darkVoid', 'dark', 'voidOrb'), x: p.x, y: p.y - 12,
          shape: { kind: 'circle', r: 6 }, motion: { kind: 'linear', vx: (at.x - p.x) / VOID.flight, vy: (at.y - 4 - (p.y - 12)) / VOID.flight },
          damage: 0, ttl: VOID.flight, activeFrom: Infinity, age: -delay,
        })
        spawnAttack(g, {
          ...look('darkVoid', 'dark', 'voidPool'), x: at.x, y: at.y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: 0, ttl: s.duration, activeFrom: Infinity, age: -VOID.flight - delay, memo: r,
        })
        spawnAttack(g, {
          ...look('darkVoid', 'dark', 'voidBurst'), x: at.x, y: at.y - 4,
          shape: { kind: 'circle', r: VOID.start }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: VOID.open + 0.1,
          grow: (r - VOID.start) / VOID.open, age: -VOID.flight - delay, memo: r,
        })
      }
      cast(g, 'darkVoid')
    },
  },
} as const satisfies Record<string, MoveDef>

export type LegendaryMoveId = keyof typeof LEGENDARY_MOVES
