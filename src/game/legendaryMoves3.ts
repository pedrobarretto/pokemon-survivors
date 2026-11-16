import { fromAngle, TAU } from '../engine/math'
import { aimAt, cast, crowdTargets, fan, look, stats, tookB } from './legendaryMoves'
import { sweep } from './moveKit'
import type { MoveDef } from './moves'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import * as dm from '../engine/dmath'
import { shakeScreen } from './effects'

/**
 * Legendary moves, third batch: the capstones of the legends with a road of
 * their own (`QUEST_LEGENDS` in `data/legends.ts`): Palkia's Spacial Rend,
 * the lake trio's Mystical Power, the Swords of Justice's Retaliate, Keldeo's
 * Secret Sword and Hoopa's Hyperspace Fury. Same tier and rules as the first
 * batch (`legendaryMoves.ts`): Lv1–5 with a fork at Lv4, `legendary: true`,
 * never evolve. No per-tick side: every hitbox runs on the regular motions.
 * Their art is `render/legendaryFx3.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of this batch, drawn by `render/legendaryFx3.ts`. */
export type LegendaryVisual3 = 'rendTear' | 'mysticOrb' | 'mysticHalo' | 'retaliateCut' | 'secretBlade' | 'furyRing' | 'furyFist'

/**
 * Spacial Rend: each tear's length (× area), the spacing between parallel
 * tears, how long space shows the cut before it tears, the segments along a
 * tear and their radius; a vacuum tear (the Lv4 fork's second branch) stays
 * open `linger` s pulling foes in at `pull` px/s.
 */
export const REND = { length: 240, gap: 26, windup: 0.32, segments: 12, r: 8, cut: 0.08, linger: 0.9, pull: 220 } as const

/** Mystical Power: the orbs' ring radius, the beat between them, their speed and turn; the might each cast lends, for how long; the halo's flash. */
export const MYSTIC = { ring: 30, stagger: 0.05, speed: 210, turn: 9, might: 0.08, buff: 4, halo: 0.35 } as const

/** Retaliate: the two cuts' arc, sweep time and reach, the second cut's delay; the damage it adds at no HP left (scaled by the share missing). */
export const RETALIATE = { arc: 1.6, time: 0.2, reach: 62, second: 0.14, avenge: 0.7 } as const

/** Secret Sword: the blade's reach (× area), its arc and sweep time, segments and their radius. */
export const SECRET = { reach: 150, arc: 2.6, time: 0.42, segments: 11, r: 9 } as const

/** Hyperspace Fury: how long a ring takes to open, the fists out of it (count, beat between them, their scatter and radius), and the ring's size. */
export const FURY = { open: 0.3, gap: 0.07, scatter: 22, fist: 13, ring: 24 } as const

export const LEGENDARY_MOVES_3 = {
  /* Palkia */
  spacialRend: {
    name: 'Spacial Rend',
    type: 'dragon',
    legendary: true,
    base: stats({ damage: 64, cooldown: 3.2, amount: 2, knockback: 50 }),
    upgrades: [
      { damage: 16 },
      { amount: 1 },
      { fork: [{ stats: { damage: 6 } }, { stats: { area: 0.2 } }] },
      { cooldown: -0.5, damage: 16 },
    ],
    // Palkia tears space: parallel cuts across the densest crowd, a beat after the seams show. Fork A crosses them with a second
    // set at right angles; fork B leaves the tears open as a vacuum that drags foes in.
    fire: (g, s, owned) => {
      const p = g.player
      const target = crowdTargets(g, 1, 0, 260)[0]
      const toward = aimAt(g, 260, target ?? null)
      const cx = target ? target.x : p.x + dm.cos(toward) * 70
      const cy = target ? target.y : p.y + dm.sin(toward) * 70
      // Across the line from the player to the crowd, turning a little each cast so the cuts don't fall the same way twice.
      owned.stacks = ((owned.stacks ?? 0) + 1) % 4
      const angle = toward + Math.PI / 2 + (owned.stacks - 1.5) * 0.18
      const vacuum = tookB(owned) === 1
      const cross = owned.level >= 4 && !vacuum
      const length = REND.length * s.area
      for (const a of cross ? [angle, angle + Math.PI / 2] : [angle]) {
        for (let i = 0; i < s.amount; i++) {
          const off = (i - (s.amount - 1) / 2) * REND.gap * s.area
          const ox = cx + dm.cos(a + Math.PI / 2) * off
          const oy = cy + dm.sin(a + Math.PI / 2) * off
          const hits = new Map<number, number>()
          for (let k = 0; k < REND.segments; k++) {
            const along = (k / (REND.segments - 1) - 0.5) * length
            spawnAttack(g, {
              ...look('spacialRend', 'dragon', 'hitbox'), x: ox + dm.cos(a) * along, y: oy + dm.sin(a) * along,
              shape: { kind: 'circle', r: REND.r * s.area }, motion: { kind: 'static' },
              damage: s.damage, knockback: s.knockback, status: s.status, hits,
              age: -REND.windup, ttl: vacuum ? REND.linger : REND.cut + 0.05, activeUntil: vacuum ? REND.linger : REND.cut,
              hitInterval: vacuum ? 0.3 : Infinity, pull: vacuum ? REND.pull : 0,
            })
          }
          spawnAttack(g, {
            ...look('spacialRend', 'dragon', 'rendTear'), x: ox, y: oy,
            shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' },
            damage: 0, activeFrom: Infinity, ttl: REND.windup + (vacuum ? REND.linger : 0.35), memo: a, tier: dm.round(length), flip: vacuum,
          })
        }
      }
      shakeScreen(g, 2)
      cast(g, 'spacialRend')
    },
  },

  /* Uxie, Mesprit and Azelf */
  mysticalPower: {
    name: 'Mystical Power',
    type: 'psychic',
    legendary: true,
    base: stats({ damage: 30, cooldown: 2, amount: 3, speed: MYSTIC.speed, pierce: 1, knockback: 30, duration: MYSTIC.buff }),
    upgrades: [
      { damage: 8 },
      { amount: 3 },
      { fork: [{ stats: { duration: 2 } }, { stats: { amount: 3, damage: -4 } }] },
      { cooldown: -0.4, damage: 8 },
    ],
    // Orbs of knowledge, emotion and willpower (Uxie's gold, Mesprit's pink, Azelf's blue) burst out of a halo around the player and
    // home in on the foes; each cast lends the player a little might for a few seconds (the games' Mystical Power raises it).
    fire: (g, s) => {
      const p = g.player
      for (let i = 0; i < s.amount; i++) {
        const o = fromAngle((i / s.amount) * TAU + g.time * 1.5, MYSTIC.ring * s.area)
        const v = fromAngle((i / s.amount) * TAU, 40)
        spawnAttack(g, {
          ...look('mysticalPower', 'psychic', 'mysticOrb'), x: p.x + o.x, y: p.y - 10 + o.y * 0.7,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: MYSTIC.turn, target: null },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 2.6, age: -i * MYSTIC.stagger, tier: i % 3,
        })
      }
      spawnAttack(g, {
        ...look('mysticalPower', 'psychic', 'mysticHalo'), x: p.x, y: p.y - 10,
        shape: { kind: 'circle', r: MYSTIC.ring }, motion: { kind: 'follow', ox: 0, oy: -10 },
        damage: 0, activeFrom: Infinity, ttl: MYSTIC.halo,
      })
      addMoveBuff(g, 'mysticalPower', s.duration, { might: MYSTIC.might })
      cast(g, 'mysticalPower')
    },
  },

  /* Cobalion, Terrakion and Virizion */
  retaliate: {
    name: 'Retaliate',
    type: 'normal',
    legendary: true,
    base: stats({ damage: 58, cooldown: 1.6, area: 1, knockback: 70 }),
    upgrades: [
      { damage: 14 },
      { area: 0.2 },
      { fork: [{ stats: { cooldown: -0.3 } }, { stats: { damage: 18 } }] },
      { cooldown: -0.3, damage: 14 },
    ],
    // The Swords of Justice avenge: a horn cuts an X through the foes ahead, and it cuts harder the more HP the player is missing.
    fire: (g, s) => {
      const p = g.player
      const aim = aimAt(g, 120)
      const missing = 1 - Math.max(0, p.hp) / Math.max(1, p.stats.maxHp)
      const cut = { ...s, damage: s.damage * (1 + RETALIATE.avenge * missing) }
      const reach = RETALIATE.reach * s.area
      for (const [i, dir] of [[0, 1], [1, -1]] as const) {
        const from = aim - (dir * RETALIATE.arc) / 2
        sweep(g, cut, look('retaliate', 'normal', 'hitbox'), { from, arc: dir * RETALIATE.arc, time: RETALIATE.time, length: reach, segments: 5, r: 8, inner: 12 })
        for (const a of g.attacks.slice(-5)) a.age = -i * RETALIATE.second
        spawnAttack(g, {
          ...look('retaliate', 'normal', 'retaliateCut'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 4 }, motion: { kind: 'follow', ox: 0, oy: -8 },
          damage: 0, activeFrom: Infinity, ttl: RETALIATE.time + 0.12, age: -i * RETALIATE.second, memo: from, tier: dm.round(reach), flip: dir < 0,
        })
      }
      cast(g, 'retaliate')
    },
  },

  /* Keldeo */
  secretSword: {
    name: 'Secret Sword',
    type: 'fighting',
    legendary: true,
    base: stats({ damage: 70, cooldown: 2.6, amount: 1, knockback: 90 }),
    upgrades: [
      { damage: 16 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1 } }, { stats: { damage: 20 } }] },
      { cooldown: -0.4, damage: 16 },
    ],
    // Keldeo's horn grows into a long blade of water and light and sweeps a wide arc through the foes ahead (with two: one each way).
    fire: (g, s, owned) => {
      const aim = aimAt(g, 200)
      const reach = SECRET.reach * s.area
      owned.stacks = ((owned.stacks ?? 0) + 1) % 2
      const first = owned.stacks === 0 ? 1 : -1
      for (let i = 0; i < s.amount; i++) {
        const dir = i % 2 === 0 ? first : -first
        const from = aim - (dir * SECRET.arc) / 2
        sweep(g, s, look('secretSword', 'fighting', 'hitbox'), { from, arc: dir * SECRET.arc, time: SECRET.time, length: reach, segments: SECRET.segments, r: SECRET.r, inner: 14 })
        if (i > 0) for (const a of g.attacks.slice(-SECRET.segments)) a.age = -SECRET.time * 0.8
        spawnAttack(g, {
          ...look('secretSword', 'fighting', 'secretBlade'), x: g.player.x, y: g.player.y - 8,
          shape: { kind: 'circle', r: SECRET.r }, motion: { kind: 'orbit', angle: from, spin: (dir * SECRET.arc) / SECRET.time, radius: 0 },
          damage: 0, activeFrom: Infinity, ttl: SECRET.time + 0.1, age: i > 0 ? -SECRET.time * 0.8 : 0, memo: reach,
        })
      }
      shakeScreen(g, 2)
      cast(g, 'secretSword')
    },
  },

  /* Hoopa */
  hyperspaceFury: {
    name: 'Hyperspace Fury',
    type: 'dark',
    legendary: true,
    base: stats({ damage: 26, cooldown: 2.8, amount: 2, duration: 5, knockback: 40 }),
    // Hyperspace Fury lowers the foes' defense: marked foes take more damage from every hit.
    status: { kind: 'mark', chance: 0.5, duration: 4, power: 0.15 },
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { fork: [{ stats: { duration: 3 } }, { stats: { damage: 8, statusChance: 0.3 } }] },
      { cooldown: -0.4, damage: 6 },
    ],
    // Hoopa's rings open over the densest crowds and arms come punching out of them, a flurry of `duration` fists each.
    fire: (g, s) => {
      const p = g.player
      const targets = crowdTargets(g, s.amount, 70, 240)
      const fists = dm.round(s.duration)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const o = fromAngle(i * 2.4 + g.time, 60)
        const x = t ? t.x : p.x + o.x
        const y = t ? t.y : p.y + o.y * 0.7
        spawnAttack(g, {
          ...look('hyperspaceFury', 'dark', 'furyRing'), x, y: y - 6,
          shape: { kind: 'circle', r: FURY.ring }, motion: { kind: 'static' },
          damage: 0, activeFrom: Infinity, ttl: FURY.open + fists * FURY.gap + 0.3, memo: FURY.open + fists * FURY.gap,
        })
        for (const [k, a] of fan(i * 1.3 + g.time, fists, TAU / fists).entries()) {
          const at = fromAngle(a, FURY.scatter * (0.4 + ((k * 7) % 5) / 8))
          spawnAttack(g, {
            ...look('hyperspaceFury', 'dark', 'furyFist'), x: x + at.x, y: y + at.y * 0.7,
            shape: { kind: 'circle', r: FURY.fist * s.area }, motion: { kind: 'static' },
            damage: s.damage, knockback: s.knockback, status: s.status,
            age: -(FURY.open + k * FURY.gap), ttl: 0.22, activeUntil: 0.06, memo: a, flip: k % 2 === 1,
          })
        }
      }
      cast(g, 'hyperspaceFury')
    },
  },
} as const satisfies Record<string, MoveDef>

export type LegendaryMove3Id = keyof typeof LEGENDARY_MOVES_3
