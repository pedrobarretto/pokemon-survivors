import { dirTo, fromAngle, TAU } from '../engine/math'
import { range } from '../engine/rng'
import * as dm from '../engine/dmath'
import { burst, shakeScreen } from './effects'
import type { DamageBonus } from './kitRules'
import { guard, sweep, walkedSince } from './moveKit'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { clusterSpots } from './moveVerbRules'
import { enemiesInView, nearestEnemy } from './queries'
import { addMoveBuff } from './signatureMoves'
import { spawnAttack } from './spawn'
import type { Enemy, Game, OwnedMove } from './types'

/**
 * TM moves: what the bosses teach (`data/tms.ts` says who drops which), a
 * Move Tutor can teach too. Each one plays its own way: a landslide along a
 * line, a yawn that puts a crowd to sleep, a freezing beam, a discharge you
 * charge by walking, a crescent of heat, electric fangs, lava pools, an
 * aurora sweep, meteors whose charge raises your power, a wind that
 * slows, a head of iron that blocks a hit, and Mewtwo's Psystrike. Like the
 * signatures they're exempt from the evolution rule and grow through forks.
 * Spread at the end of `MOVES`; art in `render/tmFx.ts`.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated while
 * `MOVES` is built), so its few cast helpers are its own.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSfx.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else the way the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, reach)
  const d = e ? dirTo(p.x, p.y, e.x, e.y - e.radius, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Angles spread evenly around `center`, `step` radians apart. */
const fan = (center: number, count: number, step: number) =>
  Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

/** Up to `count` different living foes, nearest first, within `reach`. */
const nearestFoes = (g: Game, count: number, reach: number) => {
  const p = g.player
  const taken = new Set<number>()
  const out: Enemy[] = []
  while (out.length < count) {
    const e = nearestEnemy(g, p.x, p.y, reach, taken)
    if (!e) break
    taken.add(e.id)
    out.push(e)
  }
  return out
}

/* ---------------- Tuning (the renderer reads some) ---------------- */

/** Rock Slide: first rock's distance, the gap between rocks (× area) and the fall's seconds (each rock a beat later). */
export const ROCK_SLIDE = { start: 26, gap: 19, fall: 0.34, beat: 0.07, r: 11 } as const
/** Yawn: seconds the bubble floats before it pops, and its pop radius (× area). */
export const YAWN = { float: 0.9, r: 24 } as const
/** Ice Beam's reach and build, and the spread of extra beams. */
export const ICE_BEAM = { length: 150, segments: 12, r: 6, spread: 0.42 } as const
/** Discharge: px walked for a full charge, and the ring's radius empty and full (× area). */
export const DISCHARGE = { full: 220, r: 30, rFull: 62, open: 0.16 } as const
/** Heat Wave: the crescent's span (rad), its slices and how far it starts out. */
export const HEAT_WAVE = { span: 1.25, slices: 9, start: 14, r: 6, grow: 12, ttl: 1.1, gap: 0.22 } as const
/** Thunder Fang's reach and its bonus on paralyzed foes. */
export const THUNDER_FANG = { reach: 120, r: 12, close: 0.1 } as const
const FANG_BONUS: readonly DamageBonus[] = [{ when: 'paralyzed', mult: 1.6 }]
/** Lava Plume: the ring the geysers burst on, the pools' share of the damage. */
export const LAVA_PLUME = { near: 40, far: 64, r: 13, pool: 11, share: 0.35, erupt: 0.12 } as const
/** Aurora Beam's sweep: arc, reach and build. */
export const AURORA = { arc: 1.5, length: 118, segments: 11, r: 6 } as const
/** Meteor Beam: seconds the meteors charge before they fly, and how long the charge's boost lasts. */
export const METEOR = { charge: 0.3, seconds: 4 } as const
/** Icy Wind's gusts: spread, drag and size (× area). */
export const ICY_WIND = { spread: 0.2, drag: 1.6, r: 9, ttl: 0.9 } as const
/** Iron Head: the iron body's radius (× area), its share of the damage, and the armor it adds while it lasts. */
export const IRON_HEAD = { r: 17, share: 0.4, armor: 2 } as const
/** Psystrike: seconds the orbs hover before they strike, and their hover ring. */
export const PSYSTRIKE = { hover: 0.3, ring: 16, reach: 260 } as const

/** What Meteor Beam's charge adds to the player at `level`: damage (like the games' Sp. Atk) and a little speed. */
export const meteorBoost = (level: number) => ({ might: 0.06 + 0.01 * (level - 1), speed: 4 })

/** Discharge's charge (0..1) after walking `walked` px. */
export const dischargeCharge = (walked: number) => Math.max(0, Math.min(1, walked / DISCHARGE.full))

/* ---------------- Casts ---------------- */

/** Rocks tumble down one after another along a line toward the nearest foe, each a beat after the last. */
const rockSlide = (g: Game, s: CastStats) => {
  const p = g.player
  const angle = aimAngle(g, 220)
  const l = look('rockSlide', 'rock', 'rockSlide')
  for (let i = 0; i < s.amount; i++) {
    const d = (ROCK_SLIDE.start + i * ROCK_SLIDE.gap) * s.area
    const side = range(g.rng, -6, 6)
    const x = p.x + dm.cos(angle) * d - dm.sin(angle) * side
    const y = p.y - 4 + dm.sin(angle) * d + dm.cos(angle) * side
    const land = ROCK_SLIDE.fall + i * ROCK_SLIDE.beat
    spawnAttack(g, {
      ...l, x, y, shape: { kind: 'circle', r: ROCK_SLIDE.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status,
      activeFrom: land, activeUntil: land + 0.06, ttl: land + 0.45, memo: Math.floor(range(g.rng, 0, 3)),
    })
  }
  cast(g, 'rockSlide')
}

/** Big drowsy bubbles float onto the crowds and pop: whoever's caught falls asleep. Sleepers take ×2 from the next bubble. */
const YAWN_BONUS: readonly DamageBonus[] = [{ when: 'asleep', mult: 2 }]
const yawn = (g: Game, s: CastStats) => {
  const p = g.player
  const spots = clusterSpots(enemiesInView(g), s.amount, YAWN.r * s.area)
  spots.forEach((at, i) => {
    spawnAttack(g, {
      ...look('yawn', 'normal', 'yawn'), x: at.x, y: at.y,
      shape: { kind: 'circle', r: YAWN.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, bonus: YAWN_BONUS,
      activeFrom: YAWN.float, activeUntil: YAWN.float + 0.06, ttl: YAWN.float + 0.45,
      from: { x: p.x, y: p.y - 14 }, age: -i * 0.15,
    })
  })
  if (spots.length > 0) cast(g, 'yawn')
}

/** A straight beam of ice at the nearest foe that may freeze it (the next hit on a frozen foe shatters it ×2). */
const iceBeam = (g: Game, s: CastStats) => {
  const l = look('iceBeam', 'ice', 'iceBeam')
  for (const angle of fan(aimAngle(g, 240), s.amount, ICE_BEAM.spread)) {
    sweep(g, s, l, { from: angle, arc: 0, time: s.duration, length: ICE_BEAM.length * s.area, segments: ICE_BEAM.segments, r: ICE_BEAM.r })
    g.attacks[g.attacks.length - 1]!.flip = true
  }
  cast(g, 'iceBeam')
}

/** Charge builds as you walk; the burst around you grows with it (up to `DISCHARGE.full` px walked). */
const discharge = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const charge = dischargeCharge(walkedSince(owned, p))
  const r = (DISCHARGE.r + (DISCHARGE.rFull - DISCHARGE.r) * charge) * s.area
  spawnAttack(g, {
    ...look('discharge', 'electric', 'discharge'), x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -6 },
    damage: s.damage * (0.7 + 0.8 * charge), knockback: s.knockback, status: s.status,
    grow: (r - 6) / DISCHARGE.open, activeUntil: DISCHARGE.open, ttl: DISCHARGE.open + 0.3, memo: charge,
  })
  if (charge >= 1) shakeScreen(g, 2)
  cast(g, 'discharge')
}

/** A crescent of scorching air rolls out toward the foes, widening as it goes, burning all it crosses. */
const heatWave = (g: Game, s: CastStats) => {
  const p = g.player
  const center = aimAngle(g, 220)
  const l = look('heatWave', 'fire', 'heatWave')
  for (let w = 0; w < s.amount; w++) {
    const hits = new Map<number, number>()
    for (let i = 0; i < HEAT_WAVE.slices; i++) {
      const k = i / (HEAT_WAVE.slices - 1)
      const angle = center + (k - 0.5) * HEAT_WAVE.span
      const v = fromAngle(angle, s.speed)
      spawnAttack(g, {
        ...l, x: p.x + dm.cos(angle) * HEAT_WAVE.start, y: p.y - 8 + dm.sin(angle) * HEAT_WAVE.start,
        shape: { kind: 'circle', r: HEAT_WAVE.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
        damage: s.damage, knockback: s.knockback, status: s.status, hits, grow: HEAT_WAVE.grow * s.area,
        ttl: HEAT_WAVE.ttl, age: -w * HEAT_WAVE.gap, memo: k,
      })
    }
  }
  cast(g, 'heatWave')
}

/** Electric fangs snap shut on the nearest foes: may paralyze, ×1.6 on the paralyzed. A bite (Strong Jaw). */
const thunderFang = (g: Game, s: CastStats) => {
  const targets = nearestFoes(g, s.amount, THUNDER_FANG.reach)
  targets.forEach((e, i) => {
    spawnAttack(g, {
      ...look('thunderFang', 'electric', 'thunderFang'), x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: THUNDER_FANG.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, bonus: FANG_BONUS,
      activeFrom: THUNDER_FANG.close, activeUntil: THUNDER_FANG.close + 0.04, ttl: 0.42, age: -i * 0.08,
    })
  })
  if (targets.length > 0) cast(g, 'thunderFang')
}

/** Lava bursts out of the ground in a ring around you and pools where it lands, burning whoever steps in. */
const lavaPlume = (g: Game, s: CastStats) => {
  const p = g.player
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < s.amount; i++) {
    const angle = offset + (i / s.amount) * TAU
    const d = range(g.rng, LAVA_PLUME.near, LAVA_PLUME.far) * s.area
    const x = p.x + dm.cos(angle) * d
    const y = p.y + dm.sin(angle) * d * 0.8
    const delay = -i * 0.06
    spawnAttack(g, {
      ...look('lavaPlume', 'fire', 'lavaPlume'), x, y, shape: { kind: 'circle', r: LAVA_PLUME.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status,
      activeFrom: LAVA_PLUME.erupt, activeUntil: LAVA_PLUME.erupt + 0.08, ttl: 0.7, age: delay,
    })
    spawnAttack(g, {
      ...look('lavaPlume', 'fire', 'lavaPool'), x, y: y + 2, shape: { kind: 'circle', r: LAVA_PLUME.pool * s.area }, motion: { kind: 'static' },
      damage: s.damage * LAVA_PLUME.share, status: s.status, hitInterval: 0.5,
      activeFrom: LAVA_PLUME.erupt + 0.1, ttl: s.duration, age: delay, memo: i,
    })
  }
  cast(g, 'lavaPlume')
}

/** A rainbow beam sweeps the arc in front of you; it may weaken the foes it touches (they hit softer). */
const auroraBeam = (g: Game, s: CastStats) => {
  const center = aimAngle(g, 230)
  const l = look('auroraBeam', 'ice', 'auroraBeam')
  for (let i = 0; i < s.amount; i++) {
    const from = center + (i / s.amount) * TAU - AURORA.arc / 2
    sweep(g, s, l, { from, arc: AURORA.arc, time: s.duration, length: AURORA.length * s.area, segments: AURORA.segments, r: AURORA.r })
    g.attacks[g.attacks.length - 1]!.flip = true
  }
  cast(g, 'auroraBeam')
}

/**
 * Meteors gather around you while it charges, and the charge raises your
 * power (`meteorBoost`, refreshed every cast); then they fly at the foes.
 */
const meteorBeam = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < s.amount; i++) {
    const angle = offset + (i / s.amount) * TAU
    const x = p.x + dm.cos(angle) * 18
    const y = p.y - 4 + dm.sin(angle) * 12
    const delay = -i * 0.05
    spawnAttack(g, {
      ...look('meteorBeam', 'rock', 'meteorRise'), x, y, shape: { kind: 'circle', r: 1 }, motion: { kind: 'static' },
      damage: 0, ttl: METEOR.charge, activeFrom: Infinity, age: delay,
    })
    spawnAttack(g, {
      ...look('meteorBeam', 'rock', 'meteor'), x, y: y - 10,
      shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'homing', vx: 0, vy: -s.speed * 0.5, speed: s.speed, turn: 6, target: null },
      damage: s.damage, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 2.4, age: delay - METEOR.charge,
    })
  }
  addMoveBuff(g, 'meteorBeam', METEOR.seconds * p.stats.duration, meteorBoost(owned.level))
  cast(g, 'meteorBeam')
}

/** A freezing gust blows the way you walk: everything it touches slows down and gets pushed back. */
const icyWind = (g: Game, s: CastStats) => {
  const p = g.player
  const center = dm.atan2(p.facing.y, p.facing.x)
  fan(center, s.amount, ICY_WIND.spread).forEach((angle, i) => {
    const v = fromAngle(angle, s.speed * range(g.rng, 0.9, 1.1))
    spawnAttack(g, {
      ...look('icyWind', 'ice', 'icyWind'), x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: ICY_WIND.r * s.area }, motion: { kind: 'drift', vx: v.x, vy: v.y, drag: ICY_WIND.drag },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: ICY_WIND.ttl, age: -Math.abs(i - (s.amount - 1) / 2) * 0.03, memo: i,
    })
  })
  cast(g, 'icyWind')
}

/**
 * Your body turns to iron for `duration` s: foes that touch you take a hit and
 * may flinch, you take less damage, and the first hit you take is blocked and
 * answered with a ring of steel shards (`onGuard`).
 */
const ironHead = (g: Game, s: CastStats) => {
  const p = g.player
  spawnAttack(g, {
    ...look('ironHead', 'steel', 'ironHead'), x: p.x, y: p.y - 6,
    shape: { kind: 'circle', r: IRON_HEAD.r * s.area }, motion: { kind: 'follow', ox: 0, oy: -6 },
    damage: s.damage * IRON_HEAD.share, knockback: s.knockback, status: s.status, hitInterval: 0.5, ttl: s.duration,
  })
  guard(g, 'ironHead', s.duration)
  addMoveBuff(g, 'ironHead', s.duration, { armor: IRON_HEAD.armor })
  cast(g, 'ironHead')
}

/** Iron Head blocked a hit: steel shards fly out all around. */
const ironShards = (g: Game, s: CastStats) => {
  const p = g.player
  const offset = range(g.rng, 0, TAU)
  for (let i = 0; i < s.amount; i++) {
    const v = fromAngle(offset + (i / s.amount) * TAU, s.speed)
    spawnAttack(g, {
      ...look('ironHead', 'steel', 'ironShard'), x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback * 0.5, pierce: 2, ttl: 0.9,
    })
  }
  burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#d8e0f0', '#8890a8'], count: 26, speed: 160, ttl: 0.4, size: 2 })
  shakeScreen(g, 4)
  cast(g, 'ironHead')
}

/** Orbs of psychic power gather around you, then each strikes a different foe, through everything and through wards. */
const psystrike = (g: Game, s: CastStats) => {
  const p = g.player
  const targets = nearestFoes(g, s.amount, PSYSTRIKE.reach)
  const facing = dm.atan2(p.facing.y, p.facing.x)
  for (let i = 0; i < s.amount; i++) {
    const around = g.time * 2 + (i / s.amount) * TAU
    const x = p.x + dm.cos(around) * PSYSTRIKE.ring
    const y = p.y - 10 + dm.sin(around) * PSYSTRIKE.ring * 0.6
    const e = targets[i % Math.max(1, targets.length)]
    const d = e ? dirTo(x, y, e.x, e.y - e.radius) : fromAngle(facing + (i - (s.amount - 1) / 2) * 0.3, 1)
    const delay = -i * 0.05
    spawnAttack(g, {
      ...look('psystrike', 'psychic', 'psyHover'), x, y, shape: { kind: 'circle', r: 1 }, motion: { kind: 'static' },
      damage: 0, ttl: PSYSTRIKE.hover, activeFrom: Infinity, age: delay,
    })
    spawnAttack(g, {
      ...look('psystrike', 'psychic', 'psystrike'), x, y,
      shape: { kind: 'circle', r: 6 * s.area }, motion: { kind: 'linear', vx: d.x * s.speed, vy: d.y * s.speed },
      damage: s.damage, knockback: s.knockback, pierce: s.pierce, ignoreWards: true, ttl: 1.2, age: delay - PSYSTRIKE.hover,
    })
  }
  cast(g, 'psystrike')
}

/* ---------------- Table ---------------- */

export const TM_MOVES = {
  rockSlide: {
    name: 'Rock Slide',
    type: 'rock',
    base: stats({ damage: 16, cooldown: 1.7, amount: 4, knockback: 50 }),
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { amount: 2, damage: -3 }, mods: ['echo'] }] },
      { cooldown: -0.3 },
      { damage: 6 },
      { fork: [{ stats: { area: 0.25 }, mods: ['trail'] }, { stats: { damage: 4 }, mods: ['arc'] }] },
      { amount: 2, damage: 5 },
    ],
    fire: (g, s) => rockSlide(g, s),
  },

  yawn: {
    name: 'Yawn',
    type: 'normal',
    base: stats({ damage: 12, cooldown: 3.4, amount: 1, knockback: 10 }),
    status: { kind: 'sleep', chance: 1, duration: 2.4, power: 0 },
    upgrades: [
      { area: 0.15 },
      { damage: 4 },
      { fork: [{ stats: { damage: 1 }, mods: ['echo'] }, { stats: { area: 0.2, damage: 2 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.4 },
      { damage: 5 },
      { fork: [{ stats: { damage: 4 }, mods: ['arc'] }, { stats: { amount: 1, area: 0.1 }, mods: ['trail'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s) => yawn(g, s),
  },

  iceBeam: {
    name: 'Ice Beam',
    type: 'ice',
    base: stats({ damage: 16, cooldown: 1.8, amount: 1, duration: 0.45, knockback: 30 }),
    status: { kind: 'freeze', chance: 0.2, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 5 },
      { statusChance: 0.1 },
      { fork: [{ stats: { amount: 1, damage: -3 }, mods: ['trail'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { cooldown: -0.2 },
      { damage: 6 },
      { fork: [{ stats: { damage: 4 }, mods: ['arc'] }, { stats: { statusChance: 0.15 }, mods: ['burstOnKill'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s) => iceBeam(g, s),
  },

  discharge: {
    name: 'Discharge',
    type: 'electric',
    base: stats({ damage: 18, cooldown: 1.35, knockback: 70 }),
    status: { kind: 'paralysis', chance: 0.2, duration: 1, power: 0 },
    upgrades: [
      { damage: 6 },
      { area: 0.15 },
      { fork: [{ stats: { statusChance: 0.15 }, mods: ['arc'] }, { stats: { damage: 4 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.15 },
      { damage: 7 },
      { fork: [{ stats: { area: 0.15 }, mods: ['echo'] }, { stats: { damage: 5, statusChance: 0.1 }, mods: ['trail'] }] },
      { damage: 8, area: 0.15 },
    ],
    fire: (g, s, owned) => discharge(g, s, owned),
  },

  heatWave: {
    name: 'Heat Wave',
    type: 'fire',
    base: stats({ damage: 13, cooldown: 2.2, amount: 1, speed: 130, knockback: 60 }),
    status: { kind: 'burn', chance: 0.4, duration: 2.5, power: 0.35 },
    upgrades: [
      { damage: 4 },
      { statusChance: 0.1 },
      { fork: [{ stats: { damage: -2 }, mods: ['split'] }, { stats: { damage: 2 }, mods: ['rear'] }] },
      { cooldown: -0.25 },
      { damage: 5 },
      { fork: [{ stats: { statusDamage: 0.3 }, mods: ['burstOnKill'] }, { stats: { damage: 3 }, mods: ['echo'] }] },
      { amount: 1, damage: 5 },
    ],
    fire: (g, s) => heatWave(g, s),
  },

  thunderFang: {
    name: 'Thunder Fang',
    type: 'electric',
    tags: ['bite'],
    base: stats({ damage: 16, cooldown: 0.9, amount: 1, knockback: 60 }),
    status: { kind: 'paralysis', chance: 0.25, duration: 1.2, power: 0 },
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { statusChance: 0.15 }, mods: ['arc'] }, { stats: { damage: 5 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.1 },
      { damage: 5 },
      { fork: [{ stats: { amount: 1 }, mods: ['echo'] }, { stats: { damage: 6, area: 0.2 }, mods: ['trail'] }] },
      { amount: 1, damage: 4 },
    ],
    fire: (g, s) => thunderFang(g, s),
  },

  lavaPlume: {
    name: 'Lava Plume',
    type: 'fire',
    base: stats({ damage: 14, cooldown: 2.6, amount: 4, duration: 2.4, knockback: 70 }),
    status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.35 },
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { duration: 1.2 }, mods: ['trail'] }, { stats: { damage: 3 }, mods: ['burstOnKill'] }] },
      { cooldown: -0.3 },
      { damage: 5 },
      { fork: [{ stats: { area: 0.25 }, mods: ['echo'] }, { stats: { statusDamage: 0.3, duration: 0.8 }, mods: ['arc'] }] },
      { amount: 2, damage: 4 },
    ],
    fire: (g, s) => lavaPlume(g, s),
  },

  auroraBeam: {
    name: 'Aurora Beam',
    type: 'ice',
    base: stats({ damage: 15, cooldown: 2, amount: 1, duration: 0.45, knockback: 40 }),
    status: { kind: 'weaken', chance: 0.5, duration: 3, power: 0.3 },
    upgrades: [
      { damage: 4 },
      { statusChance: 0.15 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { cooldown: -0.25 },
      { damage: 5 },
      { fork: [{ stats: { damage: 4 }, mods: ['arc'] }, { stats: { duration: 0.2, area: 0.15 }, mods: ['twin'] }] },
      { damage: 6, area: 0.15 },
    ],
    fire: (g, s) => auroraBeam(g, s),
  },

  meteorBeam: {
    name: 'Meteor Beam',
    type: 'rock',
    base: stats({ damage: 12, cooldown: 1.8, amount: 3, speed: 170, pierce: 1, knockback: 50 }),
    // The charge's boost grows by level too (`meteorBoost`).
    upgrades: [
      { amount: 1 },
      { damage: 4 },
      { fork: [{ stats: { damage: 3 }, mods: ['split'] }, { stats: { amount: 1 }, mods: ['bounce'] }] },
      { cooldown: -0.2 },
      { damage: 5 },
      { fork: [{ stats: { amount: 1 }, mods: ['burstOnKill'] }, { stats: { damage: 4 }, mods: ['trail'] }] },
      { amount: 2 },
    ],
    fire: (g, s, owned) => meteorBeam(g, s, owned),
  },

  icyWind: {
    name: 'Icy Wind',
    type: 'ice',
    base: stats({ damage: 7, cooldown: 2.2, amount: 5, speed: 170, knockback: 90 }),
    status: { kind: 'slow', chance: 1, duration: 1.6, power: 0.45 },
    upgrades: [
      { amount: 1 },
      { damage: 3 },
      { fork: [{ stats: { damage: 2 }, mods: ['rear'] }, { stats: { area: 0.3, speed: -20 }, mods: ['split'] }] },
      { cooldown: -0.25 },
      { damage: 3 },
      { fork: [{ stats: { damage: 2 }, mods: ['burstOnKill'] }, { stats: { amount: 2 }, mods: ['echo'] }] },
      { amount: 2, damage: 3 },
    ],
    fire: (g, s) => icyWind(g, s),
  },

  ironHead: {
    name: 'Iron Head',
    type: 'steel',
    base: stats({ damage: 26, cooldown: 4.5, amount: 8, speed: 210, duration: 2.5, knockback: 150 }),
    status: { kind: 'sleep', chance: 0.3, duration: 0.5, power: 0 },
    // The shards fly from `onGuard`, outside the cast: the forks' mods ride on the iron body (and Echo hardens it again).
    upgrades: [
      { damage: 6 },
      { duration: 0.5 },
      { fork: [{ stats: { amount: 4 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.8, damage: -4 }, mods: ['echo'] }] },
      { damage: 8 },
      { duration: 0.5 },
      { fork: [{ stats: { damage: 8, area: 0.2 }, mods: ['arc'] }, { stats: { statusChance: 0.25, amount: 2 }, mods: ['trail'] }] },
      { damage: 10, cooldown: -0.5 },
    ],
    fire: (g, s) => ironHead(g, s),
    onGuard: (g, s) => ironShards(g, s),
  },

  psystrike: {
    name: 'Psystrike',
    type: 'psychic',
    base: stats({ damage: 18, cooldown: 1.5, amount: 2, speed: 280, knockback: 70 }),
    upgrades: [
      { amount: 1 },
      { damage: 5 },
      { fork: [{ stats: { damage: 3 }, mods: ['boomerang'] }, { stats: { amount: 1, damage: -3 }, mods: ['seek'] }] },
      { cooldown: -0.2 },
      { damage: 6 },
      { fork: [{ stats: { amount: 1 }, mods: ['rear'] }, { stats: { damage: 5 }, mods: ['split'] }] },
      { amount: 1, damage: 5 },
    ],
    fire: (g, s) => psystrike(g, s),
  },
} as const satisfies Record<string, MoveDef>

export type TmMoveId = keyof typeof TM_MOVES

/** Every TM move, in table order. */
export const tmMoveIds = () => Object.keys(TM_MOVES) as TmMoveId[]

/** Whether a move is a TM move (exempt from the evolution rule, like the signatures). */
export const isTmMove = (id: MoveId) => Object.hasOwn(TM_MOVES, id)
