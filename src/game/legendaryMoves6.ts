import { fromAngle, TAU } from '../engine/math'
import { hpFraction } from './kitRules'
import { aimAt, cast, crowdTargets, fan, look, stats, tookB } from './legendaryMoves'
import { strike, trailer } from './moveKit'
import type { MoveDef } from './moves'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import { shakeScreen } from './effects'
import * as dm from '../engine/dmath'

/**
 * Legendary moves, sixth batch: the capstones of the Ruínas da Decisão's
 * Regis and the Forces of Nature (`RUINS_LEGENDS`, `FORCE_LEGENDS` in
 * `data/legends.ts`). Same tier and rules as the others
 * (`legendaryMoves.ts`): Lv1–5 with a fork at Lv4, `legendary: true`, never
 * evolve. Each plays its legend's way: Thunder Cage grows with Regieleki's
 * speed, Dragon Energy with Regidrago's HP, Bleakwind Storm lends Tornadus a
 * tailwind, Thundurus's Nasty Plot doubles its bolts in the rain, Sandsear Storm
 * spirals out burning, Springtide Storm stacks Enamorus's Contrary might.
 * Their art is `render/legendaryFx6.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of this batch, drawn by `render/legendaryFx6.ts`. */
export type LegendaryVisual6 = 'cageBars' | 'cageSpark' | 'dragonMaw' | 'dragonBeam' | 'bleakGust' | 'plotCloud' | 'plotBolt' | 'searSand' | 'springPetal'

/**
 * Thunder Cage: the cage's radius (× area), its bars, the zap's beat, the pull
 * that keeps foes in; its damage grows `speedK` per point of speed past the
 * base walk (`walk`), up to `speedMax` more; the sparks it leaves behind the
 * runner (Electro Drift) every `trail.every` px for `trail.time` s.
 */
export const CAGE = { ring: 34, bars: 10, zap: 0.35, pull: 70, walk: 68, speedK: 0.012, speedMax: 0.8, trail: { every: 14, r: 7, ttl: 0.9, share: 0.6, time: 2, long: 4 } } as const

/** Dragon Energy: the beam's length (× area), width, segments, wind-up and how long it burns; its damage floor at no HP left (scaled up to full at full HP); the bite's radius at its end. */
export const DRAGON_ENERGY = { length: 210, width: 13, segments: 11, windup: 0.32, burn: 0.3, floor: 0.4, bite: 34, fan: 0.32 } as const

/** Bleakwind Storm: the gusts' fan (rad) and radius, how long they fly; the Tailwind it lends (speed, cooldown). */
export const BLEAK = { arc: 1.3, r: 9, ttl: 1.1, speed: 14, cooldown: -0.06 } as const

/** Nasty Plot: the storm cloud's radius, the beat between bolts, a bolt's radius (× area) and its fall (rain doubles the bolts); the might each cast lends, for how long. */
export const WILDBOLT = { cloud: 44, beat: 0.28, r: 13, fall: 0.45, spread: 36, plot: 0.12, plotTime: 3 } as const

/** Sandsear Storm: shots per arm and the beat between them, the spiral's turn per shot, the shots' radius (× area) and life. */
export const SANDSEAR = { shots: 6, more: 9, beat: 0.07, turn: 0.42, r: 7, ttl: 1.6 } as const

/** Springtide Storm: the whirl's radius (× area) and spin, how often a petal hits; Contrary's might per stack and its cap (the fork's B raises it). */
export const SPRING = { ring: 44, spin: 3.2, hit: 0.4, might: 0.03, max: 5, maxB: 8 } as const

export const LEGENDARY_MOVES_6 = {
  /* Regieleki */
  thunderCage: {
    name: 'Thunder Cage',
    type: 'electric',
    legendary: true,
    base: stats({ damage: 16, cooldown: 3.4, amount: 1, duration: 2.4 }),
    status: { kind: 'paralysis', chance: 0.25, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { duration: 1 } }, { stats: { damage: 3 } }] },
      { cooldown: -0.5, damage: 4 },
    ],
    // Bars of lightning snap shut around the densest crowds and zap what's inside, pulling it in. Regieleki's raw speed is the power:
    // the faster it runs, the harder the cage hits, and it leaves a trail of sparks behind it (the fork's B makes the trail last).
    fire: (g, s, owned) => {
      const p = g.player
      const fast = 1 + Math.min(CAGE.speedMax, Math.max(0, p.stats.speed - CAGE.walk) * CAGE.speedK)
      const zap = { ...s, damage: s.damage * fast }
      const targets = crowdTargets(g, s.amount, 80, 220)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const o = fromAngle(i * 2.1 + g.time, 70)
        const x = t ? t.x : p.x + o.x
        const y = t ? t.y : p.y + o.y * 0.7
        const r = CAGE.ring * s.area
        spawnAttack(g, {
          ...look('thunderCage', 'electric', 'hitbox'), x, y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: zap.damage, status: s.status, hitInterval: CAGE.zap, pull: CAGE.pull, ttl: s.duration,
        })
        spawnAttack(g, {
          ...look('thunderCage', 'electric', 'cageBars'), x, y,
          shape: { kind: 'circle', r }, motion: { kind: 'static' },
          damage: 0, activeFrom: Infinity, ttl: s.duration, memo: r, tier: CAGE.bars,
        })
      }
      trailer(g, zap, look('thunderCage', 'electric', 'cageSpark'), {
        every: CAGE.trail.every, r: CAGE.trail.r, ttl: CAGE.trail.ttl, share: CAGE.trail.share, duration: tookB(owned) === 1 ? CAGE.trail.long : CAGE.trail.time,
      })
      cast(g, 'thunderCage')
    },
  },

  /* Regidrago */
  dragonEnergy: {
    name: 'Dragon Energy',
    type: 'dragon',
    legendary: true,
    base: stats({ damage: 66, cooldown: 3, amount: 1, knockback: 80 }),
    upgrades: [
      { damage: 16 },
      { area: 0.15 },
      { fork: [{ stats: { amount: 1, damage: -6 } }, { stats: { damage: 10 } }] },
      { cooldown: -0.5, damage: 16 },
    ],
    // Regidrago's dragon-head arms open and a beam of draconic energy roars out at the crowd: the more HP it has left, the harder it
    // hits (from `floor` at none to full at full HP). Fork A fans out a second beam; fork B ends each beam in the jaws biting shut.
    fire: (g, s, owned) => {
      const p = g.player
      const target = crowdTargets(g, 1, 0, 260)[0]
      const center = aimAt(g, 260, target ?? null)
      const power = DRAGON_ENERGY.floor + (1 - DRAGON_ENERGY.floor) * Math.min(1, hpFraction(p))
      const beam = { ...s, damage: s.damage * power }
      const length = DRAGON_ENERGY.length * s.area
      const bite = tookB(owned) === 1
      for (const a of s.amount > 1 ? fan(center, s.amount, DRAGON_ENERGY.fan) : [center]) {
        const hits = new Map<number, number>()
        for (let k = 0; k < DRAGON_ENERGY.segments; k++) {
          const along = 18 + (k / (DRAGON_ENERGY.segments - 1)) * (length - 18)
          spawnAttack(g, {
            ...look('dragonEnergy', 'dragon', 'hitbox'), x: p.x + dm.cos(a) * along, y: p.y - 8 + dm.sin(a) * along,
            shape: { kind: 'circle', r: DRAGON_ENERGY.width * s.area }, motion: { kind: 'static' },
            damage: beam.damage, knockback: s.knockback, hits, age: -DRAGON_ENERGY.windup, ttl: DRAGON_ENERGY.burn, activeUntil: 0.12,
          })
        }
        spawnAttack(g, {
          ...look('dragonEnergy', 'dragon', 'dragonBeam'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 4 }, motion: { kind: 'static' },
          damage: 0, activeFrom: Infinity, ttl: DRAGON_ENERGY.windup + DRAGON_ENERGY.burn + 0.15, memo: a, tier: dm.round(length),
        })
        if (bite) {
          const end = { ...beam, damage: beam.damage * 0.8 }
          strike(g, end, look('dragonEnergy', 'dragon', 'dragonMaw'), p.x + dm.cos(a) * length, p.y - 8 + dm.sin(a) * length, DRAGON_ENERGY.bite * s.area, DRAGON_ENERGY.windup + 0.1, 0.35)
          g.attacks[g.attacks.length - 1]!.memo = a
        }
      }
      shakeScreen(g, 3)
      cast(g, 'dragonEnergy')
    },
  },

  /* Tornadus */
  bleakwindStorm: {
    name: 'Bleakwind Storm',
    type: 'flying',
    legendary: true,
    base: stats({ damage: 24, cooldown: 2.2, amount: 7, speed: 240, pierce: Infinity, knockback: 90, duration: 3 }),
    // A freezing gale: it may chill foes stiff (frostbite, as in Legends: Arceus).
    status: { kind: 'slow', chance: 0.5, duration: 1.5, power: 0.35 },
    upgrades: [
      { damage: 6 },
      { amount: 2 },
      { fork: [{ stats: { duration: 2 } }, { stats: { amount: 3, damage: -3 } }] },
      { cooldown: -0.4, damage: 6 },
    ],
    // Tornadus whips a fan of icy gusts at the foes ahead, flinging them back; Prankster's Tailwind comes with each cast, speeding
    // it up and its moves with it for a few seconds.
    fire: (g, s) => {
      const p = g.player
      const center = aimAt(g, 220)
      for (const [i, a] of fan(center, s.amount, BLEAK.arc / Math.max(1, s.amount - 1)).entries()) {
        const v = fromAngle(a, s.speed)
        spawnAttack(g, {
          ...look('bleakwindStorm', 'flying', 'bleakGust'), x: p.x + dm.cos(a) * 12, y: p.y - 8 + dm.sin(a) * 12,
          shape: { kind: 'circle', r: BLEAK.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: BLEAK.ttl, age: -(i % 2) * 0.05, memo: a, tier: i,
        })
      }
      addMoveBuff(g, 'bleakwindStorm', s.duration, { speed: BLEAK.speed, cooldown: BLEAK.cooldown })
      cast(g, 'bleakwindStorm')
    },
  },

  /* Thundurus: its Legends: Arceus signature's name is Thunder's evolution's (Wildbolt Storm), so Prankster Nasty Plot, as it's known for. */
  nastyPlot: {
    name: 'Nasty Plot',
    type: 'electric',
    legendary: true,
    base: stats({ damage: 30, cooldown: 3, amount: 1, duration: 5, knockback: 30 }),
    status: { kind: 'paralysis', chance: 0.3, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 8 },
      { amount: 1 },
      { fork: [{ stats: { duration: 3 } }, { stats: { damage: 10 } }] },
      { cooldown: -0.4, damage: 8 },
    ],
    // Thundurus plots in its storm: a cloud rolls over the densest crowd and bolts rain down from it, one after another (in the
    // rain, which Thundurus calls, twice the bolts), and each cast sharply raises its might for a few seconds.
    fire: (g, s) => {
      const p = g.player
      const rain = g.weather.id === 'rain'
      const bolts = dm.round(s.duration) * (rain ? 2 : 1)
      const beat = WILDBOLT.beat / (rain ? 1.6 : 1)
      const targets = crowdTargets(g, s.amount, 90, 240)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const o = fromAngle(i * 2.4 + g.time, 80)
        const x = t ? t.x : p.x + o.x
        const y = t ? t.y : p.y + o.y * 0.7
        spawnAttack(g, {
          ...look('nastyPlot', 'electric', 'plotCloud'), x, y: y - 46,
          shape: { kind: 'circle', r: WILDBOLT.cloud }, motion: { kind: 'static' },
          damage: 0, activeFrom: Infinity, ttl: WILDBOLT.fall + bolts * beat + 0.5, flip: rain,
        })
        for (let k = 0; k < bolts; k++) {
          const at = fromAngle(k * 2.39996 + i, WILDBOLT.spread * (0.25 + ((k * 5) % 7) / 9))
          strike(g, s, look('nastyPlot', 'electric', 'plotBolt'), x + at.x, y + at.y * 0.7, WILDBOLT.r * s.area, WILDBOLT.fall + k * beat, 0.24)
        }
      }
      addMoveBuff(g, 'nastyPlot', WILDBOLT.plotTime, { might: WILDBOLT.plot })
      cast(g, 'nastyPlot')
    },
  },

  /* Landorus */
  sandsearStorm: {
    name: 'Sandsear Storm',
    type: 'ground',
    legendary: true,
    base: stats({ damage: 22, cooldown: 2.6, amount: 3, speed: 150, pierce: Infinity, knockback: 40 }),
    status: { kind: 'burn', chance: 0.3, duration: 3, power: 0.35 },
    upgrades: [
      { damage: 6 },
      { amount: 1 },
      { fork: [{ stats: { area: 0.2 } }, { stats: { damage: 4 } }] },
      { cooldown: -0.4, damage: 6 },
    ],
    // Searing sand spirals out from Landorus in arms that turn as they go, burning what they cross; fork B adds shots to each arm.
    fire: (g, s, owned) => {
      const p = g.player
      const shots = tookB(owned) === 1 ? SANDSEAR.more : SANDSEAR.shots
      owned.stacks = ((owned.stacks ?? 0) + 1) % 8
      const base = aimAt(g, 200) + owned.stacks * 0.4
      for (let arm = 0; arm < s.amount; arm++) {
        for (let k = 0; k < shots; k++) {
          const a = base + (arm / s.amount) * TAU + k * SANDSEAR.turn
          const v = fromAngle(a, s.speed)
          spawnAttack(g, {
            ...look('sandsearStorm', 'ground', 'searSand'), x: p.x, y: p.y - 6,
            shape: { kind: 'circle', r: SANDSEAR.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
            damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: SANDSEAR.ttl, age: -k * SANDSEAR.beat, tier: k % 3,
          })
        }
      }
      shakeScreen(g, 1)
      cast(g, 'sandsearStorm')
    },
  },

  /* Enamorus */
  springtideStorm: {
    name: 'Springtide Storm',
    type: 'fairy',
    legendary: true,
    base: stats({ damage: 16, cooldown: 3.2, amount: 8, duration: 2.6, knockback: 30 }),
    // Love's whirl: foes it hits may lose their bearings, charmed.
    status: { kind: 'confuse', chance: 0.25, duration: 2, power: 0 },
    upgrades: [
      { damage: 4 },
      { amount: 4 },
      { fork: [{ stats: { duration: 1 } }, { stats: { damage: 3 } }] },
      { cooldown: -0.4, damage: 4 },
    ],
    // A whirl of petals and hearts spins around Enamorus. Springtide Storm lowers the foes' guard and, by Contrary, raises Enamorus's:
    // each cast while the last one's might holds stacks a little more (up to `max`, `maxB` with fork B).
    fire: (g, s, owned) => {
      const p = g.player
      const r = SPRING.ring * s.area
      const hits = new Map<number, number>()
      for (let i = 0; i < s.amount; i++) {
        const angle = (i / s.amount) * TAU + g.time
        spawnAttack(g, {
          ...look('springtideStorm', 'fairy', 'springPetal'), x: p.x + dm.cos(angle) * r, y: p.y - 8 + dm.sin(angle) * r,
          shape: { kind: 'circle', r: 8 * s.area }, motion: { kind: 'orbit', angle, spin: SPRING.spin, radius: r },
          damage: s.damage, knockback: s.knockback, status: s.status, hitInterval: SPRING.hit, hits, ttl: s.duration, tier: i % 2,
        })
      }
      const held = p.moveBuffs.some((b) => b.move === 'springtideStorm')
      const cap = tookB(owned) === 1 ? SPRING.maxB : SPRING.max
      owned.stacks = held ? Math.min(cap, (owned.stacks ?? 0) + 1) : 1
      addMoveBuff(g, 'springtideStorm', s.duration + s.cooldown, { might: SPRING.might * owned.stacks })
      cast(g, 'springtideStorm')
    },
  },
} as const satisfies Record<string, MoveDef>

export type LegendaryMove6Id = keyof typeof LEGENDARY_MOVES_6
