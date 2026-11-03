import { JUDGMENT_PLATES } from '../data/legendaryMoves'
import { ownAttack } from './players'
import { dirTo, fromAngle, TAU } from '../engine/math'
import { addMoveBuff } from './signatureMoves'
import { aimAt, cast, crowdTargets, fan, look, stats, tookB } from './legendaryMoves'
import { guard, strike } from './moveKit'
import { chainTargets } from './moveRules'
import type { CastStats, MoveDef } from './moves'
import { isAlive } from './queries'
import { spawnAttack } from './spawn'
import type { StatusSpec } from './status'
import type { Enemy, Game } from './types'
import * as dm from '../engine/dmath'
import { shakeScreen } from './effects'

/**
 * Legendary moves, second batch: the capstones of the trio members, Mewtwo
 * and Arceus, so every legendary has one (`LEGENDARY_MOVE_OF` in
 * `data/legendaryMoves.ts`). Same tier and rules as the first batch
 * (`legendaryMoves.ts`): Lv1–5 with a fork at Lv4, `legendary: true`, never
 * evolve. Their per-tick side (a crystal shattering, a field's bolts, a shell
 * erupting, a lifted foe hurled) lives in `legendary2.ts`, their art in
 * `render/legendaryFx2.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

/** The visuals of this batch, drawn by `render/legendaryFx2.ts`. */
export type LegendaryVisual2 =
  | 'snowCrystal' | 'snowShatter' | 'terrainField' | 'terrainBolt' | 'heatFeather' | 'heatNova' | 'clapBolt' | 'clapBurst'
  | 'bulwarkShell' | 'magmaGeyser' | 'aquaRunner' | 'aquaRing' | 'boulderLob' | 'boulderImpact' | 'boulderRoll'
  | 'glaciateDome' | 'glaciateShatter' | 'ironShell' | 'steelShard' | 'psyLift' | 'psySlam' | 'judgmentWheel' | 'judgmentLance'

/** Snowscape: the crystals' rest distance (× area), how long they drift, and their chill on touch (share of damage). */
export const SNOW = { reach: 92, drift: 0.45, drag: 5, chill: 0.25, r: 9, burst: 22 } as const
/** Electric Terrain: the field's radius (× area) and the beat between its bolts. */
export const TERRAIN = { r: 96, beat: 0.2, bolt: 13 } as const
/** Overheat: casts per cycle (the last one overheats), the nova's radius (× area), windup, seconds to full size and damage (× damage); the feathers' flight. */
export const HEAT = { cycle: 3, r: 112, core: 12, windup: 0.35, burst: 0.25, mult: 3, feather: 0.85 } as const
/** Thunderclap: reach of the first jump, of each next one (× area), the beat between jumps, the clap's radius and damage. */
export const CLAP = { reach: 180, jump: 92, beat: 0.035, r: 40, mult: 1.6 } as const
/** Burning Bulwark: the shell's radius and its contact burn (share of damage); the eruption's two rings (× area). */
export const BULWARK = { shell: 22, touch: 0.18, inner: 38, outer: 74, geyser: 17, gap: 0.16 } as const
/** Aqua Ring: the ring's radius (× area), where it starts and how long it takes to widen, Suicune's lap, the ring's share of the damage and its drain. */
export const AQUA = { r: 74, inner: 16, widen: 0.5, lap: 0.55, share: 0.5, drain: 0.12, segment: 11 } as const
/** Rock Wrecker: the boulder's flight, its impact and rolling radius (× area), the roll's share of the damage. */
export const WRECKER = { flight: 0.55, impact: 36, roll: 17, share: 0.55, reach: 230 } as const
/** Glaciate: the dome's radius (× area), the chill ticks' share of the damage, and the shatter's execute. */
export const GLACIATE = { r: 108, chill: 0.12, execute: 0.12, chilledMult: 1.3 } as const
/** Metal Burst: the nova's radius (× area), the boost each hit taken adds, the shards' share of the damage. */
export const METAL = { r: 62, perHit: 0.35, maxHits: 6, shard: 0.55 } as const
/** Telekinesis: the lift's reach, the throw's force, the crash's share of the damage, and the crush on what it can't throw (bosses). */
export const LIFT = { reach: 210, force: 520, crash: 0.6, slam: 22, boss: 1.8 } as const
/** Judgment: when the lances fire, the beat between them, their length (× area) and segments. */
export const JUDGMENT = { fire: 0.45, gap: 0.07, length: 250, segments: 12, r: 9 } as const

/** Iron Defense, while Metal Burst's shell holds: armor (each hit lands this much lighter). */
export const IRON_DEFENSE = { armor: 2 } as const

/** Snowscape's crystals chill what they touch. */
const CHILL: StatusSpec = { kind: 'slow', chance: 1, duration: 1, power: 0.35 }
/** Glaciate's dome chills harder the longer it holds. */
const DEEP_CHILL: StatusSpec = { kind: 'slow', chance: 1, duration: 1.2, power: 0.5 }
/** Telekinesis holds a lifted foe still (a freeze that draws no ice): the slam lands twice as hard. */
const HELD: StatusSpec = { kind: 'freeze', chance: 1, duration: 1, power: 0 }

/** The plate Judgment takes here: the biome's (`JUDGMENT_PLATES`). */
export const judgmentType = (g: Game) => JUDGMENT_PLATES[g.player.biome]

/**
 * Burning Bulwark's eruption around (x, y): two rings of magma geysers, the
 * outer one a beat later and offset between the inner ones.
 */
export const erupt = (g: Game, s: CastStats, x: number, y: number) => {
  const count = Math.max(4, s.amount)
  for (const [ring, radius] of [[0, BULWARK.inner], [1, BULWARK.outer]] as const) {
    for (let i = 0; i < count; i++) {
      const o = fromAngle(((i + ring * 0.5) / count) * TAU, radius * s.area)
      spawnAttack(g, {
        ...look('burningBulwark', 'fire', 'magmaGeyser'), x: x + o.x, y: y + o.y * 0.7,
        shape: { kind: 'circle', r: BULWARK.geyser * s.area }, motion: { kind: 'static' },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.5, activeUntil: 0.08,
        age: -ring * BULWARK.gap - i * 0.01, flip: (i + ring) % 2 === 1,
      })
    }
  }
  shakeScreen(g, 2.5)
}

/** Foes nearest to (x, y) within `reach`, closest first (ties by id), at most `count`. */
const nearestFoes = (g: Game, x: number, y: number, reach: number, count: number) => {
  const near: Enemy[] = []
  for (const e of g.enemies) if (isAlive(e) && dm.sq(e.x - x) + dm.sq(e.y - y) <= reach * reach) near.push(e)
  near.sort((a, b) => dm.sq(a.x - x) + dm.sq(a.y - y) - (dm.sq(b.x - x) + dm.sq(b.y - y)) || a.id - b.id)
  return near.slice(0, count)
}

export const LEGENDARY_MOVES_2 = {
  /* Articuno */
  snowscape: {
    name: 'Snowscape',
    type: 'ice',
    legendary: true,
    base: stats({ damage: 44, cooldown: 3, amount: 6, duration: 1.3, knockback: 60 }),
    // The shatter can freeze: the next hit on a frozen foe lands twice as hard.
    status: { kind: 'freeze', chance: 0.3, duration: 1.1, power: 0 },
    upgrades: [
      { damage: 10 },
      { amount: 2 },
      { fork: [{ stats: { area: 0.2, statusChance: 0.2 }, mods: ['echo'] }, { stats: { damage: 14 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 10 },
    ],
    // Articuno's wings beat a snowflake of ice crystals out around the player; they hang in the air chilling the foes, then shatter all at once.
    fire: (g, s) => {
      const p = g.player
      const turn = g.time * 0.7
      const reach = SNOW.reach * s.area
      for (let arm = 0; arm < s.amount; arm++) {
        const angle = turn + (arm / s.amount) * TAU
        // Two crystals an arm, the inner one halfway out.
        for (const share of [0.5, 1]) {
          const d = fromAngle(angle, reach * share * SNOW.drag)
          spawnAttack(g, {
            ...look('snowscape', 'ice', 'snowCrystal'), x: p.x, y: p.y - 8,
            shape: { kind: 'circle', r: SNOW.r * s.area }, motion: { kind: 'drift', vx: d.x, vy: d.y * 0.75, drag: SNOW.drag },
            damage: s.damage * SNOW.chill, status: CHILL, hitInterval: 0.5, knockback: 0,
            ttl: SNOW.drift + s.duration + 0.05, memo: SNOW.drift + s.duration, flip: share < 1,
          })
        }
      }
      cast(g, 'snowscape')
    },
  },

  /* Zapdos */
  electricTerrain: {
    name: 'Electric Terrain',
    type: 'electric',
    legendary: true,
    base: stats({ damage: 30, cooldown: 4.2, amount: 1, duration: 2.6, knockback: 30 }),
    status: { kind: 'paralysis', chance: 0.25, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 7 },
      { area: 0.2, duration: 0.4 },
      { fork: [{ stats: { amount: 1, damage: -4 } }, { stats: { damage: 8 }, mods: ['arc'] }] },
      { cooldown: -0.6, damage: 7 },
    ],
    // Zapdos electrifies the ground around the player: a crackling field that follows them, a bolt falling on a foe inside it every beat.
    fire: (g, s) => {
      const p = g.player
      // The field itself never hits: it carries the bolts' damage, status and count for `legendary2.ts`.
      spawnAttack(g, {
        ...look('electricTerrain', 'electric', 'terrainField'), x: p.x, y: p.y,
        shape: { kind: 'circle', r: TERRAIN.r * s.area }, motion: { kind: 'follow', ox: 0, oy: 0 },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: s.duration, activeFrom: Infinity,
        tier: s.amount, memo: 0.1,
      })
      cast(g, 'electricTerrain')
    },
  },

  /* Moltres */
  overheat: {
    name: 'Overheat',
    type: 'fire',
    legendary: true,
    base: stats({ damage: 36, cooldown: 1.9, amount: 5, speed: 270, pierce: 3, knockback: 50 }),
    status: { kind: 'burn', chance: 0.35, duration: 3, power: 0.4 },
    upgrades: [
      { damage: 8 },
      { amount: 2 },
      { fork: [{ stats: { area: 0.25 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.2 }, mods: ['trail'] }] },
      { cooldown: -0.3, damage: 6 },
    ],
    // Moltres's heat builds: two casts throw fans of blazing feathers, the third overheats into a fire nova around the player.
    fire: (g, s, owned) => {
      const p = g.player
      const heat = owned.stacks ?? 0
      owned.stacks = (heat + 1) % HEAT.cycle
      if (heat < HEAT.cycle - 1) {
        for (const angle of fan(aimAt(g, 240), s.amount, 0.16)) {
          const v = fromAngle(angle, s.speed)
          spawnAttack(g, {
            ...look('overheat', 'fire', 'heatFeather'), x: p.x, y: p.y - 10,
            shape: { kind: 'circle', r: 7 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
            damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: HEAT.feather, memo: angle,
          })
        }
      } else {
        // After a short windup the nova bursts from the player's body (`legendary2.ts` grows it), burning everything it reaches.
        spawnAttack(g, {
          ...look('overheat', 'fire', 'heatNova'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: HEAT.core }, motion: { kind: 'follow', ox: 0, oy: -8 },
          damage: s.damage * HEAT.mult, knockback: s.knockback * 3, status: s.status && { ...s.status, chance: 1 },
          ttl: HEAT.windup + HEAT.burst + 0.2, activeFrom: HEAT.windup, memo: HEAT.r * s.area,
        })
        shakeScreen(g, 1)
      }
      cast(g, 'overheat')
    },
  },

  /* Raikou */
  thunderclap: {
    name: 'Thunderclap',
    type: 'electric',
    legendary: true,
    base: stats({ damage: 40, cooldown: 2.1, amount: 7, knockback: 40 }),
    status: { kind: 'paralysis', chance: 0.3, duration: 1, power: 0 },
    upgrades: [
      { damage: 13 },
      { amount: 2, area: 0.1 },
      { fork: [{ stats: { amount: 4, damage: 4 } }, { stats: { damage: 16 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 13 },
    ],
    // Raikou's lightning leaps from foe to foe faster than the eye, and the last one takes a thunderclap that rocks the crowd around it.
    fire: (g, s) => {
      const p = g.player
      const chain = chainTargets(g.enemies, { x: p.x, y: p.y }, s.amount, CLAP.reach, CLAP.jump * s.area)
      let from = { x: p.x, y: p.y - 10 }
      chain.forEach((e, i) => {
        const at = { x: e.x, y: e.y - e.radius }
        spawnAttack(g, {
          ...look('thunderclap', 'electric', 'clapBolt'), x: at.x, y: at.y, from,
          shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'static' },
          damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.5, activeUntil: 0.05,
          age: -i * CLAP.beat, flip: i % 2 === 1,
        })
        from = at
      })
      const last = chain[chain.length - 1]
      if (last) {
        spawnAttack(g, {
          ...look('thunderclap', 'electric', 'clapBurst'), x: last.x, y: last.y - last.radius,
          shape: { kind: 'circle', r: CLAP.r * s.area }, motion: { kind: 'static' },
          damage: s.damage * CLAP.mult, knockback: s.knockback * 4, status: s.status, ttl: 0.4, activeUntil: 0.06,
          age: -chain.length * CLAP.beat,
        })
      }
      cast(g, 'thunderclap')
    },
  },

  /* Entei */
  burningBulwark: {
    name: 'Burning Bulwark',
    type: 'fire',
    legendary: true,
    base: stats({ damage: 64, cooldown: 4, amount: 9, duration: 2.4, knockback: 120 }),
    status: { kind: 'burn', chance: 0.45, duration: 3, power: 0.4 },
    upgrades: [
      { damage: 18 },
      { duration: 0.5, area: 0.15 },
      { fork: [{ stats: { amount: 4 } }, { stats: { damage: 20 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.7, damage: 18 },
    ],
    // Entei's volcanic shell wraps the player: it blocks the next hit and burns what touches it, then erupts into rings of magma.
    fire: (g, s) => {
      const p = g.player
      guard(g, 'burningBulwark', s.duration)
      // The shell erupts when it breaks (`onGuard`) or when it runs out (`legendary2.ts`).
      spawnAttack(g, {
        ...look('burningBulwark', 'fire', 'bulwarkShell'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: BULWARK.shell * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage * BULWARK.touch, knockback: 40, status: s.status, hitInterval: 0.35, ttl: s.duration,
      })
      cast(g, 'burningBulwark')
    },
    onGuard: (g, s) => {
      const p = g.player
      for (const a of g.attacks) {
        if (a.visual !== 'bulwarkShell' || a.tier !== 0 || !ownAttack(g, a)) continue
        a.tier = 1
        a.ttl = Math.min(a.ttl, a.age + 0.2)
      }
      erupt(g, s, p.x, p.y)
    },
  },

  /* Suicune */
  aquaRing: {
    name: 'Aqua Ring',
    type: 'water',
    legendary: true,
    base: stats({ damage: 34, cooldown: 3.6, amount: 14, speed: 0.5, duration: 3, knockback: 150 }),
    upgrades: [
      { damage: 8 },
      { area: 0.15, duration: 0.6 },
      { fork: [{ stats: { amount: 4, duration: 1 }, mods: ['echo'] }, { stats: { damage: 10 }, mods: ['drain'] }] },
      { cooldown: -0.6, damage: 8 },
    ],
    // Suicune spirals out from the player on the north wind, sweeping the foes away; the pure water it runs on stays as a ring that shoves them out and heals a little.
    fire: (g, s) => {
      const r = AQUA.r * s.area
      const from = g.time * 1.7
      const spin = TAU / AQUA.lap
      const p = g.player
      // Both start at the player's body and widen to the ring (`legendary2.ts`), so nothing is left inside.
      spawnAttack(g, {
        ...look('aquaRing', 'water', 'aquaRunner'), x: p.x + dm.cos(from) * AQUA.inner, y: p.y - 8 + dm.sin(from) * AQUA.inner,
        shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'orbit', angle: from, spin, radius: AQUA.inner },
        damage: s.damage, knockback: s.knockback, ttl: AQUA.lap, memo: r,
      })
      const hits = new Map<number, number>()
      for (let i = 0; i < s.amount; i++) {
        const k = i / s.amount
        const angle = from + k * TAU
        spawnAttack(g, {
          ...look('aquaRing', 'water', 'aquaRing'), x: p.x + dm.cos(angle) * AQUA.inner, y: p.y - 8 + dm.sin(angle) * AQUA.inner,
          shape: { kind: 'circle', r: AQUA.segment * s.area }, motion: { kind: 'orbit', angle, spin: s.speed, radius: AQUA.inner },
          damage: s.damage * AQUA.share, knockback: s.knockback * 0.6, hitInterval: 0.5, hits, drain: AQUA.drain,
          ttl: s.duration, age: -k * AQUA.lap * 0.5, flip: i % 2 === 1, memo: r,
        })
      }
      cast(g, 'aquaRing')
    },
  },

  /* Regirock */
  rockWrecker: {
    name: 'Rock Wrecker',
    type: 'rock',
    legendary: true,
    base: stats({ damage: 96, cooldown: 3, amount: 1, speed: 150, duration: 1.3, knockback: 170 }),
    upgrades: [
      { damage: 22 },
      { area: 0.2 },
      { fork: [{ stats: { amount: 1, damage: -10 } }, { stats: { damage: 26, duration: 0.4 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.5, damage: 22 },
    ],
    // Regirock heaves a colossal boulder onto the densest crowd: it lands with a quake and rolls on through them.
    fire: (g, s) => {
      const p = g.player
      const targets = crowdTargets(g, s.amount, 90, WRECKER.reach)
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const fallback = fromAngle(dm.atan2(p.facing.y, p.facing.x) + i * 2.4, 110)
        const at = t ? { x: t.x, y: t.y } : { x: p.x + fallback.x, y: p.y + fallback.y }
        const d = dirTo(p.x, p.y, at.x, at.y, p.facing)
        const delay = WRECKER.flight + i * 0.2
        spawnAttack(g, {
          ...look('rockWrecker', 'rock', 'boulderLob'), x: at.x, y: at.y, from: { x: p.x, y: p.y - 14 },
          shape: { kind: 'circle', r: WRECKER.roll * s.area }, motion: { kind: 'static' },
          damage: 0, ttl: delay, activeFrom: Infinity, age: -i * 0.2,
        })
        strike(g, s, look('rockWrecker', 'rock', 'boulderImpact'), at.x, at.y, WRECKER.impact * s.area, delay, 0.5)
        spawnAttack(g, {
          ...look('rockWrecker', 'rock', 'boulderRoll'), x: at.x, y: at.y,
          shape: { kind: 'circle', r: WRECKER.roll * s.area }, motion: { kind: 'linear', vx: d.x * s.speed, vy: d.y * s.speed },
          damage: s.damage * WRECKER.share, knockback: s.knockback, hitInterval: 0.6, ttl: s.duration, age: -delay,
          memo: dm.atan2(d.y, d.x),
        })
      }
      cast(g, 'rockWrecker')
    },
  },

  /* Regice */
  glaciate: {
    name: 'Glaciate',
    type: 'ice',
    legendary: true,
    base: stats({ damage: 76, cooldown: 4.2, duration: 1.3, knockback: 60 }),
    status: { kind: 'freeze', chance: 0.4, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 22 },
      { area: 0.15 },
      { fork: [{ stats: { cooldown: -0.6, statusChance: 0.2 } }, { stats: { damage: 26 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.6, damage: 22 },
    ],
    // Regice's cold spreads into a dome of frozen air around the player, chilling everything inside, then it drops to absolute zero and shatters them.
    fire: (g, s) => {
      const p = g.player
      const r = GLACIATE.r * s.area
      spawnAttack(g, {
        ...look('glaciate', 'ice', 'glaciateDome'), x: p.x, y: p.y - 6,
        shape: { kind: 'circle', r: 16 }, motion: { kind: 'follow', ox: 0, oy: -6 },
        damage: s.damage * GLACIATE.chill, status: DEEP_CHILL, hitInterval: 0.3, ttl: s.duration,
        grow: (r - 16) / (s.duration * 0.6), memo: r,
      })
      const shatter = spawnAttack(g, {
        ...look('glaciate', 'ice', 'glaciateShatter'), x: p.x, y: p.y - 6,
        shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: 0, oy: -6 },
        damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.5, activeUntil: 0.06, age: -s.duration,
        execute: GLACIATE.execute,
      })
      shatter.bonus = [{ when: 'chilled', mult: GLACIATE.chilledMult }]
      cast(g, 'glaciate')
    },
  },

  /* Registeel */
  metalBurst: {
    name: 'Metal Burst',
    type: 'steel',
    legendary: true,
    base: stats({ damage: 56, cooldown: 3, amount: 8, speed: 280, duration: 2.4, pierce: 2, knockback: 130 }),
    // Every hit the player takes while it recharges feeds the next burst.
    stacks: { grow: 'hurt', max: METAL.maxHits, reset: 'cast' },
    upgrades: [
      { damage: 15 },
      { amount: 4 },
      { fork: [{ stats: { duration: 1.2, amount: 2 } }, { stats: { damage: 16 }, mods: ['arc'] }] },
      { cooldown: -0.5, damage: 15 },
    ],
    // Registeel's Iron Defense hardens the player, then the steel bursts out of them in a nova and a ring of shards, harder for every hit they took.
    fire: (g, s, owned) => {
      const p = g.player
      const taken = owned.stacks ?? 0
      const power = 1 + METAL.perHit * taken
      // The iron branch (Lv4 A) holds Iron Defense twice as hard.
      addMoveBuff(g, 'metalBurst', s.duration, owned.level >= 4 && !tookB(owned) ? { armor: IRON_DEFENSE.armor * 2 } : IRON_DEFENSE)
      spawnAttack(g, {
        ...look('metalBurst', 'steel', 'ironShell'), x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: METAL.r * s.area }, motion: { kind: 'follow', ox: 0, oy: -8 },
        damage: s.damage * power, knockback: s.knockback, ttl: 0.45, activeUntil: 0.06, tier: taken,
      })
      const count = s.amount + taken
      for (let i = 0; i < count; i++) {
        const angle = g.time * 0.5 + (i / count) * TAU
        const v = fromAngle(angle, s.speed)
        spawnAttack(g, {
          ...look('metalBurst', 'steel', 'steelShard'), x: p.x, y: p.y - 8,
          shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
          damage: s.damage * METAL.shard * power, knockback: s.knockback * 0.5, pierce: s.pierce, ttl: 0.9, memo: angle,
        })
      }
      shakeScreen(g, 1 + taken * 0.4)
      cast(g, 'metalBurst')
    },
  },

  /* Mewtwo */
  telekinesis: {
    name: 'Telekinesis',
    type: 'psychic',
    legendary: true,
    base: stats({ damage: 60, cooldown: 3.2, amount: 5, duration: 0.75, knockback: 0 }),
    upgrades: [
      { damage: 12 },
      { amount: 2 },
      { fork: [{ stats: { amount: 3, damage: -8 } }, { stats: { damage: 14 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4, damage: 12 },
    ],
    // Mewtwo's mind grips the nearest foes and lifts them off the ground, holding them still; then it hurls them into the crowd, crashing into whoever they hit.
    fire: (g, s) => {
      const p = g.player
      for (const e of nearestFoes(g, p.x, p.y, LIFT.reach, s.amount)) {
        // The tether holds the foe (a freeze that draws no ice) and, when it lets go, `legendary2.ts` hurls it.
        spawnAttack(g, {
          ...look('telekinesis', 'psychic', 'psyLift'), x: e.x, y: e.y,
          shape: { kind: 'circle', r: e.radius }, motion: { kind: 'tether', target: e, every: s.duration + 1, next: 0 },
          damage: s.damage * 0.2, status: { ...HELD, duration: s.duration + 0.15 }, ttl: s.duration, activeFrom: Infinity,
          memo: s.damage,
        })
      }
      cast(g, 'telekinesis')
    },
  },

  /* Arceus */
  judgment: {
    name: 'Judgment',
    type: 'normal',
    legendary: true,
    base: stats({ damage: 66, cooldown: 2.8, amount: 4, knockback: 90 }),
    upgrades: [
      { damage: 15 },
      { amount: 2 },
      { fork: [{ stats: { area: 0.25 }, mods: ['echo'] }, { stats: { damage: 18 }, mods: ['hunter'] }] },
      { cooldown: -0.4, damage: 15 },
    ],
    // Arceus's golden wheel turns over the player, then each plate fires a lance of light through the foes; Multitype gives them the land's type.
    fire: (g, s) => {
      const p = g.player
      const type = judgmentType(g)
      spawnAttack(g, {
        ...look('judgment', type, 'judgmentWheel'), x: p.x, y: p.y - 30,
        shape: { kind: 'circle', r: 14 }, motion: { kind: 'follow', ox: 0, oy: -30 },
        damage: 0, ttl: JUDGMENT.fire + s.amount * JUDGMENT.gap + 0.15, activeFrom: Infinity, tier: s.amount,
      })
      const targets = crowdTargets(g, s.amount, 50, 260)
      const length = JUDGMENT.length * s.area
      for (let i = 0; i < s.amount; i++) {
        const t = targets[i]
        const angle = t ? dm.atan2(t.y - p.y, t.x - p.x) : g.time + (i / s.amount) * TAU
        const d = fromAngle(angle)
        const delay = JUDGMENT.fire + i * JUDGMENT.gap
        const hits = new Map<number, number>()
        for (let k = 1; k <= JUDGMENT.segments; k++) {
          const dist = (length * k) / JUDGMENT.segments
          spawnAttack(g, {
            ...look('judgment', type, 'hitbox'), x: p.x + d.x * dist, y: p.y - 10 + d.y * dist,
            shape: { kind: 'circle', r: JUDGMENT.r * s.area }, motion: { kind: 'static' },
            damage: s.damage, knockback: s.knockback, hits, ttl: 0.1, age: -delay - k * 0.008,
          })
        }
        spawnAttack(g, {
          ...look('judgment', type, 'judgmentLance'), x: p.x + d.x * length, y: p.y - 10 + d.y * length,
          from: { x: p.x, y: p.y - 30 }, shape: { kind: 'circle', r: JUDGMENT.r * s.area }, motion: { kind: 'static' },
          damage: 0, ttl: 0.36, activeFrom: Infinity, age: -delay, memo: angle,
        })
      }
      cast(g, 'judgment')
    },
  },
} as const satisfies Record<string, MoveDef>

export type LegendaryMove2Id = keyof typeof LEGENDARY_MOVES_2
