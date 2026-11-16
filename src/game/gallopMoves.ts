import { dirTo, fromAngle } from '../engine/math'
import * as dm from '../engine/dmath'
import { healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { blessing, GALLOP, momentum, sunHeal } from './gallopRules'
import { runMods } from './legend'
import { strike, sweep, walkedSince } from './moveKit'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { nearestEnemy } from './queries'
import { addMoveBuff } from './signatureMoves'
import { densestFoe } from './signatureRules'
import { spawnAttack } from './spawn'
import type { Enemy, Game, OwnedMove } from './types'
import { unseen } from './versusRules'
import { weatherHere } from './weather'

/**
 * The gallop batch: Ponyta's kit from the community's list (`data/seasonOneEggs.ts`),
 * five base moves and their evolutions, built on the move kit. High
 * Horsepower charges up as you run, Low Kick fells the heavy, Horn Drill bores
 * into one foe and finishes it, Morning Sun heals by the run's sky, Bounce
 * lands in a crescendo. Numbers live in `gallopRules.ts`, the look in
 * `render/gallopFx.ts`. Seeded rng and `dmath` only; `moves.ts` is evaluated
 * after this module, so only its types.
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSounds.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Toward the nearest foe within `reach`, else the way the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, reach)
  const d = e ? dirTo(p.x, p.y, e.x, e.y, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

/** The heaviest living foe within `reach` the player can aim at (bosses first, then by mass, then the nearest), or null. */
const heaviestFoe = (g: Game, reach: number): Enemy | null => {
  const p = g.player
  let best: Enemy | null = null
  let bestScore = -Infinity
  for (const e of g.enemies) {
    if (e.dying >= 0 || unseen(g, e)) continue
    const d2 = dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
    if (d2 > reach * reach) continue
    // Weight first, then the nearer of two alike (the tiny distance term never outweighs a unit of mass).
    const score = (e.boss ? 1000 : 0) + e.mass * 10 - d2 / (reach * reach)
    if (score > bestScore) {
      bestScore = score
      best = e
    }
  }
  return best
}

/* ---------------- High Horsepower / Headlong Rush ---------------- */

/**
 * A line of erupting earth rushing out from the hooves toward `angle`: `count`
 * eruptions `gap` px apart, each landing `step` s after the last, every one
 * of them `power` × the move's damage and throwing foes along the line. A
 * `pillar` stays that long and hits again every `hitInterval`.
 */
const quakeLine = (
  g: Game, s: CastStats, l: Look, angle: number, count: number,
  o: { gap: number; step: number; r: number }, power: number, pillar?: { ttl: number; hitInterval: number },
) => {
  const p = g.player
  const along = fromAngle(angle, 1)
  for (let i = 0; i < count; i++) {
    const dist = 14 + i * o.gap
    const a = spawnAttack(g, {
      ...l, x: p.x + along.x * dist, y: p.y + along.y * dist,
      shape: { kind: 'circle', r: o.r * s.area }, motion: { kind: 'static' },
      damage: s.damage * power, knockback: s.knockback * (0.6 + 0.4 * power), status: s.status,
      age: -i * o.step, ttl: pillar?.ttl ?? 0.3, activeUntil: pillar?.ttl ?? 0.09, hitInterval: pillar?.hitInterval ?? Infinity, flip: along.x < 0,
    })
    // How hard it hit, for the look: a full gallop throws up taller dirt.
    a.memo = power
  }
}

/** High Horsepower: the ground the hooves covered since the last cast charges a line of erupting earth ahead. */
const highHorsepower = (g: Game, s: CastStats, owned: OwnedMove) => {
  const o = GALLOP.horsepower
  const power = momentum(walkedSince(owned, g.player), o.full, o.floor)
  quakeLine(g, s, look('highHorsepower', 'ground', 'gallopQuake'), aimAngle(g, 150), 3 + s.amount, o, power)
  if (power >= 0.99) shakeScreen(g, 3)
  cast(g, 'highHorsepower')
}

/** Headlong Rush: three lines fanned ahead, each eruption a stone pillar that stays and hits again; a full charge spurs the gallop. */
const headlongRush = (g: Game, s: CastStats, owned: OwnedMove) => {
  const o = GALLOP.headlong
  const power = momentum(walkedSince(owned, g.player), o.full, o.floor)
  const angle = aimAngle(g, 160)
  for (const turn of [-o.spread, 0, o.spread]) {
    quakeLine(g, { ...s, damage: s.damage * (turn === 0 ? 1 : 0.7) }, look('headlongRush', 'ground', 'gallopPillar'), angle + turn, 3 + s.amount, o, power, { ttl: o.pillar, hitInterval: 0.25 })
  }
  if (power >= 0.99) {
    addMoveBuff(g, 'headlongRush', o.hasteFor, { speed: g.player.stats.speed * o.haste })
    shakeScreen(g, 4)
  }
  cast(g, 'headlongRush')
}

/* ---------------- Low Kick / Axe Kick ---------------- */

/** Heavy foes (`HEAVY_MASS`) take the kick harder, bosses harder still. */
const KICK_BONUS = [{ when: 'heavy', mult: GALLOP.lowKick.heavy }, { when: 'boss', mult: GALLOP.lowKick.boss }] as const

/** Low Kick: a low sweep of the hind legs before the player that trips foes and bites deeper into the heavy ones. */
const lowKick = (g: Game, s: CastStats) => {
  const o = GALLOP.lowKick
  const angle = aimAngle(g, 80)
  const before = g.attacks.length
  sweep(g, s, look('lowKick', 'fighting', 'lowKick'), { from: angle - o.arc / 2, arc: o.arc, time: o.time, length: o.length * s.area, segments: o.segments, r: o.r })
  // On top of what a branch stamped (Hunter).
  for (let i = before; i < g.attacks.length; i++) g.attacks[i]!.bonus = [...g.attacks[i]!.bonus, ...KICK_BONUS]
  cast(g, 'lowKick')
}

/** Axe Kick: the heel comes down on the heaviest foe in reach, a warning ring first; it lands with Low Kick's weight and a shock ring. */
const axeKick = (g: Game, s: CastStats) => {
  const o = GALLOP.axeKick
  const p = g.player
  const target = heaviestFoe(g, o.reach)
  const at = target ?? { x: p.x + p.facing.x * 40, y: p.y + p.facing.y * 40 }
  const heel = strike(g, s, look('axeKick', 'fighting', 'axeKick'), at.x, at.y, o.r * s.area, o.delay, 0.4)
  heel.bonus = [...heel.bonus, ...KICK_BONUS]
  heel.knockback = s.knockback * 1.6
  spawnAttack(g, {
    ...look('axeKick', 'fighting', 'axeRing'), x: at.x, y: at.y,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' }, grow: (o.ring * s.area - 6) / 0.22,
    damage: s.damage * 0.45, knockback: s.knockback, status: s.status, age: -o.delay, ttl: 0.3, activeUntil: 0.22,
  })
  cast(g, 'axeKick')
}

/* ---------------- Horn Drill / Hyper Drill ---------------- */

/**
 * A drill bored into `e`: `bores` small hits riding on its body, `every`
 * apart (each slowing it hard so it can't wriggle off), then the finishing
 * blow, `finish` × the damage, that fells a regular foe at or under `execute`
 * of its HP. Bosses take `boss` × the blow instead.
 */
const bore = (g: Game, s: CastStats, l: Look, e: Enemy, o: { every: number; bores: number; execute: number; finish: number; boss: number }) => {
  const p = g.player
  spawnAttack(g, {
    ...l, visual: 'hornDrill', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'tether', target: e, every: o.every, next: o.every },
    damage: s.damage * 0.35, status: { kind: 'slow', chance: 1, duration: 0.3, power: 0.7 },
    ttl: o.every * (o.bores + 0.5), activeFrom: Infinity, from: { x: p.x, y: p.y - 10 },
  })
  const blow = spawnAttack(g, {
    ...l, visual: 'hornBlow', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: 10 }, motion: { kind: 'tether', target: e, every: 99, next: o.every * o.bores },
    damage: s.damage * o.finish, knockback: s.knockback, status: s.status, ttl: o.every * o.bores + 0.35, activeFrom: Infinity,
  })
  blow.execute = o.execute
  blow.bonus = [...blow.bonus, { when: 'boss', mult: o.boss }]
  return blow
}

/** Horn Drill: the horn spins into the toughest foe in reach and, a breath later, finishes it: the weak ones fall outright. */
const hornDrill = (g: Game, s: CastStats) => {
  const o = GALLOP.hornDrill
  const e = heaviestFoe(g, o.reach)
  if (!e) return
  bore(g, s, look('hornDrill', 'normal', 'hornDrill'), e, o)
  cast(g, 'hornDrill')
}

/** Hyper Drill: a faster bore through any ward, then the drill punches on through the foe as a lance that fells the weak it pierces. */
const hyperDrill = (g: Game, s: CastStats) => {
  const o = GALLOP.hyperDrill
  const p = g.player
  const e = heaviestFoe(g, o.reach)
  if (!e) return
  const blow = bore(g, s, look('hyperDrill', 'normal', 'hornDrill'), e, o)
  blow.sure = true
  blow.ignoreWards = true
  const d = dirTo(p.x, p.y, e.x, e.y, p.facing)
  const lance = spawnAttack(g, {
    ...look('hyperDrill', 'normal', 'hyperLance'), x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: d.x * o.speed, vy: d.y * o.speed },
    damage: s.damage * 1.2, knockback: s.knockback, age: -o.every * o.bores, ttl: o.lance / o.speed, flip: d.x < 0,
  })
  lance.execute = o.pierceExecute
  lance.sure = true
  lance.ignoreWards = true
  cast(g, 'hyperDrill')
}

/** Per hit of a drill's finishing blow: a heavy jolt, so the moment it lands reads. */
const drillHit = (g: Game, hitstop: number) => {
  g.hitstop = Math.max(g.hitstop, hitstop)
  shakeScreen(g, 4)
}

/* ---------------- Morning Sun / Revival Blessing ---------------- */

/** Morning Sun: a sun rises over the head and heals by the run's sky (the sun the most, rain and the rest a quarter); its halo scorches what's close. */
const morningSun = (g: Game, s: CastStats, owned: OwnedMove) => {
  const o = GALLOP.morningSun
  const p = g.player
  const sky = weatherHere(g)
  const healed = healPlayer(g, p.stats.maxHp * sunHeal(sky, owned.level))
  if (healed >= 1) floatText(g, p.x, p.y - 30, `+${dm.round(healed)}`, '#58e858')
  if (healed > 0) g.events.push({ kind: 'heal' })
  const halo = spawnAttack(g, {
    ...look('morningSun', 'normal', 'morningSun'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: o.r * s.area * (sky === 'sun' ? 1.25 : 1) }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: o.ttl, activeUntil: 0.12,
  })
  halo.tier = sky === 'sun' ? 1 : 0
  burst(g, p.x, p.y - 24, { colors: ['#fff8c0', '#f8d030', '#ffffff'], count: 14, speed: 50, ttl: 0.6, gravity: -50 })
  cast(g, 'morningSun')
}

/** Revival Blessing: a bigger heal by the sky; what doesn't fit under max HP flares out as sunlight, so at full health it's an attack. */
const revivalBlessing = (g: Game, s: CastStats, owned: OwnedMove) => {
  const o = GALLOP.revival
  const p = g.player
  const sky = weatherHere(g)
  const amount = p.stats.maxHp * sunHeal(sky, owned.level + 3) * o.heal
  const { flare } = blessing(amount * runMods(g).healing, p.hp, p.stats.maxHp, o.overflow)
  const healed = healPlayer(g, amount)
  if (healed >= 1) floatText(g, p.x, p.y - 30, `+${dm.round(healed)}`, '#58e858')
  if (healed > 0) g.events.push({ kind: 'heal' })
  const strong = flare > 0
  const halo = spawnAttack(g, {
    ...look('revivalBlessing', 'normal', 'revivalFlare'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: (strong ? o.flare : o.r) * s.area * (sky === 'sun' ? 1.2 : 1) }, motion: { kind: 'follow', ox: 0, oy: -8 },
    damage: s.damage + flare, knockback: s.knockback * (strong ? 1.5 : 1), status: s.status, ttl: o.ttl, activeUntil: 0.14,
  })
  halo.tier = strong ? 1 : 0
  if (strong) shakeScreen(g, 3)
  burst(g, p.x, p.y - 24, { colors: ['#fff8c0', '#f8d030', '#ffffff', '#f8a8c8'], count: strong ? 28 : 16, speed: strong ? 120 : 60, ttl: 0.7, gravity: -40 })
  cast(g, 'revivalBlessing')
}

/* ---------------- Bounce / Sky Drop ---------------- */

/**
 * `count` hops, one landing every `hop` s wherever the player is by then
 * (riding along, so a run spreads them), each ring `crescendo` wider than the
 * last; the first lands one hop after the cast.
 */
const hops = (g: Game, s: CastStats, l: Look, count: number, o: { hop: number; r: number; crescendo: number }) => {
  const p = g.player
  for (let i = 0; i < count; i++) {
    const a = spawnAttack(g, {
      ...l, x: p.x, y: p.y,
      shape: { kind: 'circle', r: o.r * s.area * (1 + o.crescendo * i) }, motion: { kind: 'follow', ox: 0, oy: 0 },
      damage: s.damage * (1 + 0.15 * i), knockback: s.knockback, status: s.status, age: -o.hop * (i + 1), ttl: 0.32, activeUntil: 0.08,
    })
    a.tier = i
  }
}

/** Bounce: Ponyta springs into a run of hops, each landing a shock ring that may paralyze, wider every time. */
const bounce = (g: Game, s: CastStats) => {
  hops(g, s, look('bounce', 'flying', 'bounceLand'), 1 + s.amount, GALLOP.bounce)
  cast(g, 'bounce')
}

/** Sky Drop: the hops, then a dive from on high onto the thickest crowd in reach that drags it into the impact. */
const skyDrop = (g: Game, s: CastStats) => {
  const o = GALLOP.skyDrop
  const p = g.player
  const count = 1 + s.amount
  hops(g, s, look('skyDrop', 'flying', 'bounceLand'), count, o)
  const crowd = densestFoe(g.enemies.filter((e) => !unseen(g, e)), p.x, p.y, o.reach, o.diveR)
  const at = crowd ?? { x: p.x + p.facing.x * 50, y: p.y + p.facing.y * 50 }
  const dive = strike(g, { ...s, damage: s.damage * o.finish }, look('skyDrop', 'flying', 'skyDive'), at.x, at.y, o.diveR * s.area, o.hop * count + o.dive, 0.45)
  dive.pull = o.pull
  dive.activeUntil = 0.16
  dive.hitInterval = 0.08
  dive.knockback = s.knockback * 0.5
  cast(g, 'skyDrop')
}

export const GALLOP_MOVES = {
  /* Ponyta: the more ground covered since the last cast, the harder the line of earth it kicks up ahead. */
  highHorsepower: {
    name: 'High Horsepower',
    type: 'ground',
    base: stats({ damage: 16, cooldown: 2.2, knockback: 130 }),
    upgrades: [
      { damage: 4 },
      { amount: 1 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.3 }, mods: ['trail'] }] },
      { damage: 5 },
      { area: 0.2, cooldown: -0.2 },
      { fork: [{ stats: { damage: 6 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['echo'] }] },
      { damage: 7, amount: 1 },
    ],
    fire: (g, s, owned) => highHorsepower(g, s, owned),
  },

  /* Rapidash: a kick low to the ground before it, tripping foes; the heavier the foe, the harder it lands. */
  lowKick: {
    name: 'Low Kick',
    type: 'fighting',
    base: stats({ damage: 13, cooldown: 1.5, knockback: 60 }),
    status: { kind: 'slow', chance: 0.6, duration: 1.2, power: 0.5 },
    upgrades: [
      { damage: 3 },
      { area: 0.15 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.25 }, mods: ['arc'] }] },
      { damage: 4 },
      { cooldown: -0.2, statusChance: 0.15 },
      { fork: [{ stats: { damage: 5 }, mods: ['hunter'] }, { stats: { area: 0.2 }, mods: ['echo'] }] },
      { damage: 6, area: 0.15 },
    ],
    fire: (g, s) => lowKick(g, s),
  },

  /* Rapidash: the horn bores into the toughest foe in reach and finishes it: what's left weak falls outright. */
  hornDrill: {
    name: 'Horn Drill',
    type: 'normal',
    base: stats({ damage: 14, cooldown: 3.6, knockback: 120 }),
    upgrades: [
      { damage: 4 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 4 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.4 }, mods: ['cruel'] }] },
      { damage: 5 },
      { cooldown: -0.3 },
      { fork: [{ stats: { damage: 7 }, mods: ['hunter'] }, { stats: { damage: 2 }, mods: ['echo'] }] },
      { damage: 7 },
    ],
    fire: (g, s) => hornDrill(g, s),
    onHit: (g, a) => {
      if (a.visual === 'hornBlow') drillHit(g, GALLOP.hornDrill.hitstop)
    },
  },

  /* Ponyta: the sun rises over its head and heals it, most under a sunny sky; the halo scorches what's close. */
  morningSun: {
    name: 'Morning Sun',
    type: 'normal',
    base: stats({ damage: 8, cooldown: 7, knockback: 110 }),
    // The heal grows by level (`sunHeal`) on top of these steps.
    upgrades: [
      { damage: 3 },
      { cooldown: -0.5 },
      { fork: [{ stats: { area: 0.25 }, mods: ['burstOnKill'] }, { stats: { cooldown: -0.8 }, mods: ['drain'] }] },
      { damage: 4 },
      { cooldown: -0.5, area: 0.15 },
      { fork: [{ stats: { damage: 6 }, mods: ['cruel'] }, { stats: { area: 0.2 }, mods: ['arc'] }] },
      { damage: 6, cooldown: -0.4 },
    ],
    fire: (g, s, owned) => morningSun(g, s, owned),
  },

  /* Ponyta: a run of hops, each landing a ring that may paralyze, wider every time. */
  bounce: {
    name: 'Bounce',
    type: 'flying',
    base: stats({ damage: 11, cooldown: 3, knockback: 90 }),
    status: { kind: 'paralysis', chance: 0.3, duration: 1, power: 0 },
    upgrades: [
      { damage: 3 },
      { amount: 1 },
      { fork: [{ stats: { damage: 3 }, mods: ['burstOnKill'] }, { stats: { area: 0.2 }, mods: ['trail'] }] },
      { damage: 4 },
      { cooldown: -0.3, statusChance: 0.1 },
      { fork: [{ stats: { damage: 5 }, mods: ['hunter'] }, { stats: { amount: 1 }, mods: ['arc'] }] },
      { damage: 5, area: 0.15 },
    ],
    fire: (g, s) => bounce(g, s),
  },

  /* ---------- Their evolutions (`EVOLUTIONS`) ---------- */

  headlongRush: {
    name: 'Headlong Rush',
    type: 'ground',
    base: stats({ damage: 30, cooldown: 2, amount: 2, knockback: 150 }),
    upgrades: [{ damage: 7 }, { amount: 1 }, { area: 0.2, cooldown: -0.2 }, { damage: 9, amount: 1 }],
    fire: (g, s, owned) => headlongRush(g, s, owned),
  },
  axeKick: {
    name: 'Axe Kick',
    type: 'fighting',
    base: stats({ damage: 44, cooldown: 1.9, knockback: 110 }),
    status: { kind: 'confuse', chance: 0.3, duration: 2, power: 0 },
    upgrades: [{ damage: 10 }, { area: 0.2 }, { cooldown: -0.3, statusChance: 0.15 }, { damage: 14, area: 0.15 }],
    fire: (g, s) => axeKick(g, s),
  },
  hyperDrill: {
    name: 'Hyper Drill',
    type: 'normal',
    base: stats({ damage: 26, cooldown: 3, knockback: 140 }),
    upgrades: [{ damage: 7 }, { cooldown: -0.3 }, { area: 0.25, damage: 5 }, { damage: 10, cooldown: -0.3 }],
    fire: (g, s) => hyperDrill(g, s),
    onHit: (g, a) => {
      if (a.visual === 'hornBlow') drillHit(g, GALLOP.hyperDrill.hitstop)
    },
  },
  revivalBlessing: {
    name: 'Revival Blessing',
    type: 'normal',
    base: stats({ damage: 18, cooldown: 6.5, knockback: 140 }),
    // The heal grows by level (`sunHeal`, from Morning Sun's top).
    upgrades: [{ damage: 5 }, { cooldown: -0.5 }, { area: 0.2, damage: 4 }, { damage: 8, cooldown: -0.5 }],
    fire: (g, s, owned) => revivalBlessing(g, s, owned),
  },
  skyDrop: {
    name: 'Sky Drop',
    type: 'flying',
    base: stats({ damage: 20, cooldown: 3.2, amount: 2, knockback: 100 }),
    status: { kind: 'paralysis', chance: 0.35, duration: 1.1, power: 0 },
    upgrades: [{ damage: 5 }, { amount: 1 }, { area: 0.2, statusChance: 0.1 }, { damage: 8, cooldown: -0.3 }],
    fire: (g, s) => skyDrop(g, s),
  },
} as const satisfies Record<string, MoveDef>

export type GallopMoveId = keyof typeof GALLOP_MOVES
