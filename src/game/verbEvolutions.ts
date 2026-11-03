import { dirTo, fromAngle, TAU } from '../engine/math'
import { range } from '../engine/rng'
import * as dm from '../engine/dmath'
import { damageEnemy } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import { hpFraction, returnShot, stacksOf, sweep, throwFoe, trailer } from './moveKit'
import { LUNGE_MIN_COOLDOWN, LUNGE_SEEK, lungeLength } from './moveRules'
import type { CastStats, Look, MoveDef, MoveId, MoveStats } from './moves'
import { clusterSpots, electroMult, farthest, gyroMult, inArc, mostHurt, ringPoints, selfDestructCost } from './moveVerbRules'
import { enemiesInView, nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import type { DamageBonus } from './kitRules'
import { ownAttack, ownerOf } from './players'
import type { Attack, Enemy, Game, OwnedMove } from './types'
import { chainKids, cycle, driftLinks, driftRadius, leadOf, segmentDistance, spoutMult, toughest, zigzagLegs } from './verbEvolvedRules'
import { weatherHere } from './weather'

/**
 * The evolutions of the verb moves (`moveVerbs.ts`), one per wave-1 move, each
 * a new form of the same idea: Flame Wheel's trail becomes Raging Fury's
 * blazing cloak, Solar Beam's sweep a Seed Flare sun, Brine's lob a Water
 * Spout fountain, Self-Destruct an Explosion that chains through the horde…
 * The table is spread at the end of `MOVES`; their per-tick parts (the cloak,
 * the drift links, the sludge tide, the chain) run in `updateVerbEvolved`,
 * called by `game.ts` right after the attacks move; the art lives in
 * `render/verbEvolvedFx.ts`. Deterministic like every move.
 *
 * This module must not import `moves.ts` at runtime (it is evaluated first).
 */

const stats = (s: Partial<MoveStats>): MoveStats => ({
  damage: 0, cooldown: 1, area: 1, amount: 1, speed: 0, duration: 1, pierce: Infinity, knockback: 0, statusChance: 0, statusDamage: 0, ...s,
})

type Cast = (g: Game, s: CastStats, owned: OwnedMove) => void

const look = (move: MoveId, type: Look['type'], visual: Look['visual']): Look => ({ move, type, visual })

/** Lets the shell play the move's own sound (`ui/castSfx.ts`). */
const cast = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/** Angle to the nearest foe within `reach` (aimed at its body), or the way the player faces. */
const aim = (g: Game, reach: number) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, reach)
  const d = e ? dirTo(p.x, p.y - 8, e.x, e.y - e.radius, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Foes in view within `reach`, nearest first (ties to the lower id, the same on every engine). */
const nearestInView = (g: Game, reach: number) => {
  const p = g.player
  const d = (e: Enemy) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y)
  return enemiesInView(g)
    .filter((e) => d(e) < reach * reach)
    .sort((a, b) => d(a) - d(b) || a.id - b.id)
}

/* ---------------- Raging Fury (Flame Wheel + Light Clay) ---------------- */

/**
 * Raging Fury: patches every `every` px (`r` px, × area) hitting every
 * `hitInterval` for `share` of the damage; the cloak around the feet (`cloak`
 * px) hits every `cloakHit` while walking; every `novaEvery` px walked a fire
 * nova bursts out to `nova` px in `novaOpen` s for `novaShare` of the damage.
 */
export const FURY = {
  every: 9, r: 11, hitInterval: 0.35, share: 1, cloak: 15, cloakHit: 0.3, novaEvery: 150, nova: 50, novaOpen: 0.22, novaShare: 1,
} as const

/**
 * The player rampages wreathed in fire: a blazing cloak burns whoever it
 * touches while they walk, the trail is a burning road, and every few steps
 * the fury bursts in a nova of fire. Standing still, it smoulders. One
 * carrier for the run (the cloak itself), refreshed by each cast.
 */
const ragingFury: Cast = (g, s) => {
  const carrier = g.attacks.find((a) => ownAttack(g, a) && a.move === 'ragingFury' && a.trailer)
  if (carrier?.trailer) {
    carrier.damage = s.damage
    carrier.status = s.status
    carrier.knockback = s.knockback
    carrier.shape = { kind: 'circle', r: FURY.cloak * s.area }
    carrier.trailer.r = FURY.r * s.area
    carrier.trailer.ttl = s.duration
    return
  }
  const a = trailer(g, s, look('ragingFury', 'fire', 'furyBlaze'), {
    every: FURY.every, r: FURY.r, ttl: s.duration, hitInterval: FURY.hitInterval, share: FURY.share, duration: Infinity,
  })
  a.visual = 'ragingFury'
  a.shape = { kind: 'circle', r: FURY.cloak * s.area }
  a.hitInterval = FURY.cloakHit
  a.knockback = s.knockback
  // Where the last nova burst (px walked).
  a.memo = g.player.walked
}

/** Per tick: the cloak burns only while walking, and the fury bursts every `novaEvery` px. */
const furyTick = (g: Game, a: Attack) => {
  const p = g.player
  const walking = p.moving && !p.hidden
  a.activeFrom = walking ? 0 : Infinity
  if (!walking) {
    a.memo = Math.max(a.memo, p.walked - FURY.novaEvery * 0.5)
    return
  }
  if (g.rng() < 0.7) {
    g.particles.push({
      x: p.x + range(g.rng, -9, 9), y: p.y - range(g.rng, 0, 14), vx: -p.vx * 0.3 + range(g.rng, -8, 8), vy: -range(g.rng, 20, 50),
      life: 0, ttl: range(g.rng, 0.25, 0.45), color: g.rng() < 0.5 ? '#f8b030' : '#e85818', size: g.rng() < 0.3 ? 2 : 1, gravity: -40, drag: 2,
    })
  }
  if (p.walked - a.memo < FURY.novaEvery) return
  a.memo = p.walked
  const area = a.shape.kind === 'circle' ? a.shape.r / FURY.cloak : 1
  spawnAttack(g, {
    move: 'ragingFury', type: 'fire', visual: 'furyNova', x: p.x, y: p.y - 4,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
    damage: a.damage * FURY.novaShare, knockback: 160, status: a.status,
    ttl: FURY.novaOpen + 0.3, activeUntil: FURY.novaOpen, grow: (FURY.nova * area - 8) / FURY.novaOpen,
  })
  burst(g, p.x, p.y - 8, { colors: ['#fff4b0', '#f8b030', '#e85818', '#a82010'], count: 26, speed: 170, ttl: 0.45, gravity: -60, size: 2 })
  shakeScreen(g, 3)
  cast(g, 'ragingFury')
}

/* ---------------- Seed Flare (Solar Beam + Power Herb) ---------------- */

/** Seed Flare: seconds the sun swells first, each ray's build, and the seeds that bloom where the rays end (per ray, `bloom` px, `bloomShare` of the damage). */
export const SEED_FLARE = { charge: 0.4, length: 104, segments: 11, r: 7, blooms: 2, bloom: 16, bloomShare: 0.6 } as const

/**
 * A small sun swells over the player and bursts into `amount` rays that sweep
 * the whole circle between them; where they end, light seeds bloom in small
 * blasts around the player. In harsh sunlight the rays sweep it twice.
 */
const seedFlare: Cast = (g, s) => {
  const p = g.player
  const sun = weatherHere(g) === 'sun'
  const start = aim(g, 240)
  const fx = look('seedFlare', 'grass', 'seedFlare')
  const n = Math.max(1, s.amount)
  const length = SEED_FLARE.length * s.area
  spawnAttack(g, {
    ...fx, visual: 'seedSun', x: p.x, y: p.y - 32,
    shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: -32 },
    damage: 0, ttl: SEED_FLARE.charge + s.duration + 0.25, activeFrom: Infinity,
  })
  for (let i = 0; i < n; i++) {
    const first = g.attacks.length
    sweep(g, s, fx, { from: start + (i / n) * TAU, arc: ((sun ? 2 : 1) * TAU) / n, time: s.duration, length, segments: SEED_FLARE.segments, r: SEED_FLARE.r })
    for (let k = first; k < g.attacks.length; k++) g.attacks[k]!.age = -SEED_FLARE.charge
    g.attacks[g.attacks.length - 1]!.flip = true
  }
  const blooms = n * SEED_FLARE.blooms
  for (let j = 0; j < blooms; j++) {
    const at = fromAngle(start + ((j + 0.5) / blooms) * TAU, length * (0.55 + 0.3 * (j % 2)))
    spawnAttack(g, {
      ...fx, visual: 'seedBloom', x: p.x + at.x, y: p.y + at.y,
      shape: { kind: 'circle', r: SEED_FLARE.bloom * s.area }, motion: { kind: 'follow', ox: at.x, oy: at.y },
      damage: s.damage * SEED_FLARE.bloomShare, knockback: s.knockback, status: s.status,
      ttl: 0.42, activeUntil: 0.06, age: -(SEED_FLARE.charge + s.duration + j * 0.03),
    })
  }
  cast(g, 'seedFlare')
}

/* ---------------- Water Spout (Brine + Loaded Dice) ---------------- */

/** Water Spout's reach, how long the spout rises before the drops fly, their flight and splash (× area), and the scatter of extra drops. */
export const SPOUT = { range: 230, rise: 0.22, flight: 0.5, r: 16, scatter: 22 } as const
/** Like Brine, it hits foes under half HP twice as hard. */
const SPOUT_BONUS: readonly DamageBonus[] = [{ when: 'lowHp', mult: 2 }]

/**
 * A geyser bursts from the player and rains heavy drops onto the most hurt
 * foes in view (extra drops splash around them). The fuller the player's HP,
 * the harder it rains (`spoutMult`); foes under half HP still take double.
 */
const waterSpout: Cast = (g, s) => {
  const p = g.player
  const targets = mostHurt(enemiesInView(g), p, s.amount, SPOUT.range)
  if (targets.length === 0) return
  const damage = s.damage * spoutMult(hpFraction(p))
  spawnAttack(g, {
    move: 'waterSpout', type: 'water', visual: 'waterSpout', x: p.x, y: p.y,
    shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: 0 },
    damage: 0, ttl: SPOUT.rise + 0.5, activeFrom: Infinity,
  })
  cycle(targets, Math.max(s.amount, targets.length)).forEach((e, i) => {
    const extra = i >= targets.length
    const at = leadOf(e, p, SPOUT.rise + SPOUT.flight + i * 0.05)
    const x = at.x + (extra ? range(g.rng, -SPOUT.scatter, SPOUT.scatter) : 0)
    const y = at.y - e.radius + (extra ? range(g.rng, -SPOUT.scatter, SPOUT.scatter) * 0.6 : 0)
    spawnAttack(g, {
      move: 'waterSpout', type: 'water', visual: 'spoutDrop', x, y,
      shape: { kind: 'circle', r: SPOUT.r * s.area }, motion: { kind: 'static' },
      damage, knockback: s.knockback, bonus: SPOUT_BONUS, status: s.status,
      ttl: SPOUT.flight + 0.45, activeFrom: SPOUT.flight, activeUntil: SPOUT.flight + 0.1,
      from: { x: p.x, y: p.y - 30 }, age: -SPOUT.rise - i * 0.05, flip: i % 2 === 1,
    })
  })
  cast(g, 'waterSpout')
}

/* ---------------- Electro Drift (Electro Ball + Choice Scarf) ---------------- */

/** Electro Drift: the spiral's start and end radius (× area), the orb size, the lightning's half width (× area) and its share of the damage. */
export const DRIFT = { from: 14, to: 96, r: 5, link: 5, linkHit: 0.3, linkShare: 0.5 } as const

/**
 * Orbs drift out from the player in a widening spiral, joined by lightning
 * (a loop for three or more) that hurts whoever stands between them. Like
 * Electro Ball, a faster player makes them bigger and harder (`electroMult`).
 * The link is its own hitbox (`driftLink`) whose shape holds the cast's area.
 */
const electroDrift: Cast = (g, s) => {
  const p = g.player
  const mult = electroMult(p.stats.speed)
  const start = aim(g, 260)
  const n = Math.max(2, s.amount)
  const link = spawnAttack(g, {
    move: 'electroDrift', type: 'electric', visual: 'driftLink', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: DRIFT.link * s.area }, motion: { kind: 'static' },
    damage: s.damage * mult * DRIFT.linkShare, status: s.status, ttl: s.duration, activeFrom: Infinity, hitInterval: DRIFT.linkHit, memo: n,
  })
  for (let i = 0; i < n; i++) {
    spawnAttack(g, {
      move: 'electroDrift', type: 'electric', visual: 'electroDrift', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: (DRIFT.r + 2 * mult) * s.area }, motion: { kind: 'orbit', angle: start + (i / n) * TAU, spin: s.speed, radius: DRIFT.from * s.area },
      damage: s.damage * mult, knockback: s.knockback, status: s.status, hitInterval: 0.5, ttl: s.duration, memo: link.id,
    })
  }
  cast(g, 'electroDrift')
}

/** Per tick: the link's orbs spiral out, and the lightning between them hurts the foes it crosses. */
const driftTick = (g: Game, link: Attack) => {
  const area = link.shape.kind === 'circle' ? link.shape.r / DRIFT.link : 1
  const orbs = g.attacks.filter((a) => ownAttack(g, a) && a.visual === 'electroDrift' && a.memo === link.id)
  const k = link.age / link.ttl
  for (const o of orbs) if (o.motion.kind === 'orbit') o.motion.radius = driftRadius(k, DRIFT.from, DRIFT.to) * area
  const half = DRIFT.link * area
  for (const [i, j] of driftLinks(orbs.length)) {
    const a = orbs[i]!
    const b = orbs[j]!
    for (const e of g.enemies) {
      if (e.dying >= 0 || (link.hits.get(e.id) ?? -1) > g.now) continue
      if (segmentDistance({ x: e.x, y: e.y - e.radius }, a, b) > half + e.radius) continue
      link.hits.set(e.id, g.now + link.hitInterval)
      link.x = e.x
      link.y = e.y - e.radius
      damageEnemy(g, e, link)
    }
  }
}

/* ---------------- Sludge Wave (Venoshock + Toxic Orb) ---------------- */

/** Sludge Wave: how far a wave rolls (× area) and in how long, the gap between waves, and the geysers poisoned foes burst into. */
export const SLUDGE_WAVE = { r: 92, open: 0.7, gap: 0.32, geyser: 20, geyserShare: 0.5, geysers: 12 } as const
/** Like Venoshock, it hits poisoned foes twice as hard. */
const SLUDGE_BONUS: readonly DamageBonus[] = [{ when: 'poisoned', mult: 2 }]

/**
 * A tide of sludge rolls out from the player, `amount` waves one after the
 * other. Poisoned foes take double and burst in a toxic geyser that poisons
 * the ones around them. The waves hit as their crest passes (`sludgeTick`).
 */
const sludgeWave: Cast = (g, s) => {
  const p = g.player
  for (let i = 0; i < s.amount; i++) {
    spawnAttack(g, {
      move: 'sludgeWave', type: 'poison', visual: 'sludgeWave', x: p.x, y: p.y - 4,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, bonus: SLUDGE_BONUS, status: s.status,
      ttl: SLUDGE_WAVE.open + 0.3, activeFrom: Infinity, grow: (SLUDGE_WAVE.r * s.area - 6) / SLUDGE_WAVE.open, age: -i * SLUDGE_WAVE.gap,
    })
  }
  cast(g, 'sludgeWave')
}

/** Per tick: a rolling wave hits each foe its crest reaches, once; poisoned ones burst (up to `geysers` a wave, counted in `memo`). */
const sludgeTick = (g: Game, a: Attack) => {
  if (a.age > SLUDGE_WAVE.open || a.shape.kind !== 'circle') return
  const r = a.shape.r
  const area = (a.grow * SLUDGE_WAVE.open + 6) / SLUDGE_WAVE.r
  for (const e of g.enemies) {
    if (e.dying >= 0 || a.hits.has(e.id)) continue
    if (dm.sq(e.x - a.x) + dm.sq(e.y - e.radius - a.y) > dm.sq(r + e.radius)) continue
    a.hits.set(e.id, Infinity)
    const poisoned = e.status.poison.time > 0
    damageEnemy(g, e, a)
    if (!poisoned || a.memo >= SLUDGE_WAVE.geysers) continue
    a.memo++
    spawnAttack(g, {
      move: 'sludgeWave', type: 'poison', visual: 'sludgeGeyser', x: e.x, y: e.y - 2,
      shape: { kind: 'circle', r: SLUDGE_WAVE.geyser * area }, motion: { kind: 'static' },
      damage: a.damage * SLUDGE_WAVE.geyserShare, knockback: 40, status: a.status, ttl: 0.5, activeFrom: 0.05, activeUntil: 0.11,
    })
  }
}

/* ---------------- Explosion (Self-Destruct + Assault Vest) ---------------- */

/** Explosion: blast radius (× area), how fast it opens, the i-frames it grants, and the chain: each fainted foe's blast (× area), share and delay. */
export const EXPLOSION = { r: 82, open: 0.24, iframes: 1, chainR: 30, chainShare: 0.5, chainDelay: 0.08 } as const

/**
 * Hits every foe within `r` of (x, y) with `source` and arms a chain blast on
 * up to `chainKids(depth)` of the ones it faints (dormant `explosionChain`
 * markers, set off by `explosionTick`).
 */
const blastAround = (g: Game, source: Attack, x: number, y: number, r: number, depth: number, area: number) => {
  let kids = chainKids(depth)
  for (const e of g.enemies) {
    if (e.dying >= 0 || dm.sq(e.x - x) + dm.sq(e.y - e.radius - y) > dm.sq(r + e.radius)) continue
    damageEnemy(g, e, source)
    if (e.dying < 0 || e.fled || kids <= 0) continue
    kids--
    spawnAttack(g, {
      move: 'explosion', type: 'normal', visual: 'explosionChain', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: EXPLOSION.chainR * area }, motion: { kind: 'static' },
      damage: source.damage * (depth === 0 ? EXPLOSION.chainShare : 1), knockback: source.knockback * 0.6, status: source.status,
      ttl: 0.42, activeFrom: Infinity, age: -EXPLOSION.chainDelay * (1 + (e.id % 3) * 0.3), memo: depth + 1,
    })
  }
}

/**
 * Manual: pays a fifth of the current HP (like Self-Destruct) for a colossal
 * blast, safe inside it; every foe it faints explodes in turn, and those
 * blasts can set off more (`CHAIN_KIDS`).
 */
const explosion: Cast = (g, s) => {
  const p = g.player
  const cost = selfDestructCost(p.hp)
  if (cost > 0) {
    p.hp -= cost
    floatText(g, p.x, p.y - 28, String(cost), '#ff5040', true)
  }
  p.iframes = Math.max(p.iframes, EXPLOSION.iframes)
  const r = EXPLOSION.r * s.area
  const blast = spawnAttack(g, {
    move: 'explosion', type: 'normal', visual: 'explosion', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.75, activeFrom: Infinity,
  })
  blastAround(g, blast, p.x, p.y - 8, r, 0, s.area)
  burst(g, p.x, p.y - 8, { colors: ['#ffffff', '#fff0a0', '#f8a030', '#d84020', '#584848'], count: 70, speed: 280, ttl: 0.8, gravity: 140, size: 2 })
  shakeScreen(g, 14)
  g.flash = Math.max(g.flash, 0.75)
  g.hitstop = Math.max(g.hitstop, 0.08)
  cast(g, 'explosion')
}

/** Per tick: a chain marker that just went off blasts around itself. */
const explosionTick = (g: Game, a: Attack, dt: number) => {
  if (a.age < 0 || a.age - dt >= 0 || a.shape.kind !== 'circle') return
  const area = a.shape.r / EXPLOSION.chainR
  blastAround(g, a, a.x, a.y, a.shape.r, a.memo, area)
  burst(g, a.x, a.y, { colors: ['#ffffff', '#fff0a0', '#f8a030', '#d84020'], count: 12, speed: 140, ttl: 0.4, gravity: 80 })
  shakeScreen(g, 4)
  g.events.push({ kind: 'moveSound', sound: 'explosion' })
}

/* ---------------- Oblivion Wing (Roost + Leftovers) ---------------- */

/** Oblivion Wing: reach, how long the player must keep still for the full wingspan (twice the beams), and the share of damage drained. */
export const OBLIVION = { range: 210, settle: 0.6, drain: 0.5, open: 0.1 } as const

/**
 * Crimson wings unfold behind the player and fire draining beams at the
 * nearest foes, healing half the damage (within the drain budget). Like Roost,
 * it rewards standing your ground: still for a moment, twice the beams.
 */
const oblivionWing: Cast = (g, s) => {
  const p = g.player
  const settled = p.still >= OBLIVION.settle && !p.hidden
  const targets = nearestInView(g, OBLIVION.range).slice(0, s.amount * (settled ? 2 : 1))
  if (targets.length === 0) return
  spawnAttack(g, {
    move: 'oblivionWing', type: 'flying', visual: 'oblivionWing', x: p.x, y: p.y - 12,
    shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: -12 },
    damage: 0, ttl: 0.6, activeFrom: Infinity, flip: settled,
  })
  targets.forEach((e, i) => {
    spawnAttack(g, {
      move: 'oblivionWing', type: 'flying', visual: 'oblivionBeam', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: 15 * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, drain: OBLIVION.drain, status: s.status,
      ttl: 0.34, activeUntil: 0.05, age: -OBLIVION.open - i * 0.04, flip: i % 2 === 1,
    })
  })
  cast(g, 'oblivionWing')
}

/* ---------------- Sky Uppercut (Focus Punch + Black Belt) ---------------- */

/** Casts (`cooldown` apart) to charge Sky Uppercut, the fist's rise, its hitbox, the shockwave around it (× area) and how near it looks first. */
export const UPPER = { charge: 6, rise: 0.14, r: 18, shock: 46, shockShare: 0.5, gap: 0.1, near: 160 } as const

/**
 * Charges like Focus Punch (a hit resets it), but the punch comes from below:
 * a colossal fist bursts out of the ground under the toughest foes in view
 * (bosses first), with a shockwave flinging the crowd around them.
 */
const skyUppercut: Cast = (g, s, owned) => {
  const stacks = stacksOf(owned)
  if (stacks < UPPER.charge) {
    if (stacks === UPPER.charge - 1) g.events.push({ kind: 'moveSound', sound: 'focusReady' })
    return
  }
  // The toughest foes near the player (any in view when none is near).
  const p = g.player
  const view = enemiesInView(g)
  const near = view.filter((e) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) < UPPER.near * UPPER.near)
  const targets = toughest(near.length > 0 ? near : view, s.amount)
  if (targets.length === 0) return
  owned.stacks = -1
  targets.forEach((e, i) => {
    const lag = -i * UPPER.gap
    spawnAttack(g, {
      move: 'skyUppercut', type: 'fighting', visual: 'skyUppercut', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: UPPER.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, ttl: 0.6, activeFrom: UPPER.rise, activeUntil: UPPER.rise + 0.05, age: lag, flip: i % 2 === 1,
    })
    spawnAttack(g, {
      move: 'skyUppercut', type: 'fighting', visual: 'uppercutShock', x: e.x, y: e.y,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' },
      damage: s.damage * UPPER.shockShare, knockback: s.knockback * 0.8, ttl: 0.34, activeUntil: 0.18,
      grow: (UPPER.shock * s.area - 6) / 0.18, age: lag - UPPER.rise,
    })
  })
}

/* ---------------- Gear Grind (Gyro Ball + Metal Coat) ---------------- */

/** Gear Grind: how far the gears roll out (× area), their size, and how often a gear grinds the same foe. */
export const GEAR_GRIND = { reach: 120, r: 12, hitInterval: 0.18 } as const

/**
 * Two giant gears roll out at the nearest foes, grinding through everything
 * in their way, and roll back to the player. Like Gyro Ball, they're cast
 * harder the slower the player moves (`gyroMult`): stand your ground to throw them.
 */
const gearGrind: Cast = (g, s) => {
  const p = g.player
  const mult = gyroMult(dm.hypot(p.vx, p.vy))
  const fx = look('gearGrind', 'steel', 'gearGrind')
  const start = aim(g, 200)
  const n = Math.max(1, s.amount)
  for (let i = 0; i < n; i++) {
    const shot = returnShot(g, { ...s, damage: s.damage * mult }, fx, start + (i / n) * TAU, GEAR_GRIND.reach * s.area, GEAR_GRIND.r)
    shot.hitInterval = GEAR_GRIND.hitInterval
    shot.memo = mult
    shot.flip = i % 2 === 1
  }
  cast(g, 'gearGrind')
}

/* ---------------- Kowtow Cleave (Sucker Punch + Black Glasses) ---------------- */

/** Kowtow Cleave's reach past the player's body (× area), half its arc, and the poll while nobody is in reach. */
export const KOWTOW = { reach: 36, half: 1.05, poll: 0.05 } as const

/**
 * Like Sucker Punch, it watches the ground around the player; a foe that
 * steps in gets a great blade cleave swept through the whole arc toward it,
 * through wards (it never misses). Nobody in reach, it keeps watching.
 */
const kowtowCleave: Cast = (g, s, owned) => {
  const p = g.player
  const reach = (KOWTOW.reach + p.radius) * s.area
  const from = { x: p.x, y: p.y - 8 }
  const taken = new Set<number>()
  let cleaves = 0
  for (let i = 0; i < s.amount; i++) {
    const e = nearestEnemy(g, p.x, p.y, reach, taken)
    if (!e) break
    const angle = dm.atan2(e.y - e.radius - from.y, e.x - from.x)
    const swing = spawnAttack(g, {
      move: 'kowtowCleave', type: 'dark', visual: 'kowtowCleave', x: from.x, y: from.y,
      shape: { kind: 'circle', r: reach }, motion: { kind: 'follow', ox: 0, oy: -8 },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.32, activeFrom: Infinity,
      ignoreWards: true, memo: angle, flip: cleaves % 2 === 1, age: -cleaves * 0.08,
    })
    for (const f of inArc(g.enemies, from, angle, KOWTOW.half, reach + 6)) {
      taken.add(f.id)
      damageEnemy(g, f, swing)
    }
    taken.add(e.id)
    cleaves++
  }
  // `updateMoves` adds a full cooldown after this: leave only the poll.
  if (cleaves === 0) owned.cooldown -= s.cooldown - KOWTOW.poll
  else cast(g, 'kowtowCleave')
}

/* ---------------- Hyperspace Hole (Future Sight + Twisted Spoon) ---------------- */

/** Hyperspace Hole: the portal's radius (× area), the cluster size it looks for, its pull and chip share, and how much wider it bursts. */
export const HOLE = { r: 26, cluster: 50, pull: 160, chip: 0.12, burst: 1.4, gap: 0.12 } as const

/**
 * Rings open in space over the densest groups in view and drag the foes
 * around into them for `duration`, then each one collapses in a burst.
 */
const hyperspaceHole: Cast = (g, s) => {
  const spots = clusterSpots(enemiesInView(g), s.amount, HOLE.cluster)
  spots.forEach((at, i) => {
    const r = HOLE.r * s.area
    spawnAttack(g, {
      move: 'hyperspaceHole', type: 'psychic', visual: 'hyperspaceHole', x: at.x, y: at.y,
      shape: { kind: 'circle', r }, motion: { kind: 'static' },
      damage: s.damage * HOLE.chip, pull: HOLE.pull, hitInterval: 0.35, ttl: s.duration, age: -i * HOLE.gap,
    })
    spawnAttack(g, {
      move: 'hyperspaceHole', type: 'psychic', visual: 'hyperspaceBurst', x: at.x, y: at.y,
      shape: { kind: 'circle', r: r * HOLE.burst }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.45, activeUntil: 0.06, age: -(s.duration + i * HOLE.gap),
    })
  })
  if (spots.length > 0) g.events.push({ kind: 'moveSound', sound: 'futureSight' })
}

/* ---------------- Thousand Arrows (Bonemerang + Soft Sand) ---------------- */

/** Thousand Arrows: reach (× area), the arrows' flight, their hitbox, the gap between them and the scatter of extra arrows. */
export const ARROWS = { range: 210, flight: 0.45, r: 11, gap: 0.03, scatter: 14 } as const
/** The arrows ground flyers: ×2 on flying foes. */
const ARROWS_BONUS: readonly DamageBonus[] = [{ when: 'flying', mult: 2 }]

/**
 * A volley of arrows rises from the ground around the player and rains on the
 * farthest foes in reach (extra arrows land around them). Flying foes are
 * brought down: they take double.
 */
const thousandArrows: Cast = (g, s) => {
  const p = g.player
  const targets = farthest(enemiesInView(g), p, s.amount, ARROWS.range * s.area)
  if (targets.length === 0) return
  cycle(targets, Math.max(s.amount, targets.length)).forEach((e, i) => {
    const extra = i >= targets.length
    const at = leadOf(e, p, ARROWS.flight + i * ARROWS.gap)
    spawnAttack(g, {
      move: 'thousandArrows', type: 'ground', visual: 'thousandArrows',
      x: at.x + (extra ? range(g.rng, -ARROWS.scatter, ARROWS.scatter) : 0), y: at.y - 3 + (extra ? range(g.rng, -ARROWS.scatter, ARROWS.scatter) * 0.6 : 0),
      shape: { kind: 'circle', r: ARROWS.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, bonus: ARROWS_BONUS, status: s.status,
      ttl: ARROWS.flight + 0.5, activeFrom: ARROWS.flight, activeUntil: ARROWS.flight + 0.1,
      from: { x: p.x + range(g.rng, -10, 10), y: p.y - 4 }, age: -i * ARROWS.gap, flip: i % 2 === 1,
    })
  })
  cast(g, 'thousandArrows')
}

/* ---------------- Stone Axe (Stealth Rock + Hard Stone) ---------------- */

/** Stone Axe: reach, the chop's hitbox and fall time, and the splinters it leaves (ring radius, size, hits, share, how many may stay). */
export const AXE = { range: 110, r: 18, chop: 0.18, ring: 20, stone: 6, hitInterval: 0.6, share: 0.4, keep: 16 } as const

/**
 * A great stone axe chops down on the nearest foe and the impact scatters
 * floating splinters around it, Stealth Rock style: they stay for `duration`
 * and hurt every foe that walks into them (the oldest crumble past `keep`).
 */
const stoneAxe: Cast = (g, s) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, AXE.range * s.area)
  if (!e) return
  const at = { x: e.x, y: e.y - e.radius }
  spawnAttack(g, {
    move: 'stoneAxe', type: 'rock', visual: 'stoneAxe', ...at,
    shape: { kind: 'circle', r: AXE.r * s.area }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: AXE.chop + 0.4, activeFrom: AXE.chop, activeUntil: AXE.chop + 0.05,
    from: { x: p.x, y: p.y - 10 }, flip: at.x < p.x,
  })
  const splinters = g.attacks.filter((a) => ownAttack(g, a) && a.visual === 'axeSplinter')
  const extra = splinters.length + s.amount - AXE.keep
  for (let i = 0; i < extra && i < splinters.length; i++) splinters[i]!.ttl = splinters[i]!.age
  ringPoints({ x: e.x, y: e.y }, s.amount, AXE.ring * s.area, g.rng() * TAU).forEach((pt, i) => {
    spawnAttack(g, {
      move: 'stoneAxe', type: 'rock', visual: 'axeSplinter', x: pt.x, y: pt.y,
      shape: { kind: 'circle', r: AXE.stone * s.area }, motion: { kind: 'static' },
      damage: s.damage * AXE.share, knockback: s.knockback * 0.3, hitInterval: AXE.hitInterval, ttl: s.duration, status: s.status,
      from: { x: e.x, y: e.y }, flip: i % 2 === 0, age: -AXE.chop - i * 0.03,
    })
  })
}

/* ---------------- First Impression (U-turn + Quick Claw) ---------------- */

/** First Impression: seconds per leg, the pause between legs, how far past each foe a leg runs, and the closing burst (× area). */
export const IMPRESSION = { leg: 0.1, pause: 0.035, overshoot: 14, burst: 40, burstShare: 0.6 } as const

/**
 * Manual: a zigzag of dashes, each one through the next nearest foe
 * (`zigzagLegs`), untouchable throughout, ending in a burst where it lands.
 */
const firstImpression: Cast = (g, s) => {
  const p = g.player
  const legs = zigzagLegs({ x: p.x, y: p.y }, g.enemies, s.amount, {
    length: lungeLength(s.speed), seek: LUNGE_SEEK, overshoot: IMPRESSION.overshoot, facing: p.facing,
  })
  const step = IMPRESSION.leg + IMPRESSION.pause
  p.iframes = Math.max(p.iframes, legs.length * step + 0.2)
  legs.forEach((leg, k) => {
    spawnAttack(g, {
      move: 'firstImpression', type: 'bug', visual: 'firstImpression', x: leg.from.x, y: leg.from.y - 8,
      shape: { kind: 'circle', r: 12 * s.area },
      motion: { kind: 'lunge', vx: (leg.to.x - leg.from.x) / IMPRESSION.leg, vy: (leg.to.y - leg.from.y) / IMPRESSION.leg, left: IMPRESSION.leg },
      damage: s.damage, knockback: s.knockback, ttl: IMPRESSION.leg + 0.18, activeUntil: IMPRESSION.leg,
      from: { x: leg.from.x, y: leg.from.y - 8 }, age: -k * step, flip: k % 2 === 1, memo: k,
    })
  })
  const end = legs[legs.length - 1]!.to
  spawnAttack(g, {
    move: 'firstImpression', type: 'bug', visual: 'impressionBurst', x: end.x, y: end.y - 6,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
    damage: s.damage * IMPRESSION.burstShare, knockback: s.knockback, ttl: 0.36, activeUntil: 0.18,
    grow: (IMPRESSION.burst * s.area - 8) / 0.18, age: -(legs.length * step - IMPRESSION.pause),
  })
  cast(g, 'firstImpression')
}

/* ---------------- Breaking Swipe (Dragon Tail + Dragon Fang) ---------------- */

/** Breaking Swipe: reach (× area), the spin's time and turns, and the throw. */
export const SWIPE = { reach: 54, spin: 0.34, turns: 1.25, force: 560, crash: 0.6 } as const

/**
 * The tail swipes a whole turn and more around the player: every foe in reach
 * is hit, weakened (it hurts less on contact) and flung away; a flung foe
 * hurts the ones it crashes into.
 */
const breakingSwipe: Cast = (g, s) => {
  const p = g.player
  const reach = SWIPE.reach * s.area
  const side = p.facing.x < 0 ? -1 : 1
  const start = dm.atan2(-p.facing.y, -p.facing.x)
  const swing = spawnAttack(g, {
    move: 'breakingSwipe', type: 'dragon', visual: 'breakingSwipe', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: reach }, motion: { kind: 'orbit', angle: start, spin: (side * SWIPE.turns * TAU) / SWIPE.spin, radius: 0 },
    damage: s.damage, knockback: s.knockback, ttl: SWIPE.spin + 0.16, activeFrom: Infinity, status: s.status,
  })
  for (const e of g.enemies) {
    if (e.dying >= 0 || dm.sq(e.x - p.x) + dm.sq(e.y - e.radius - (p.y - 8)) > dm.sq(reach + e.radius)) continue
    damageEnemy(g, e, swing)
    if (e.dying < 0 && !e.boss) throwFoe(g, e, dm.atan2(e.y - p.y, e.x - p.x), SWIPE.force, s.damage * SWIPE.crash, 'breakingSwipe')
  }
  shakeScreen(g, 3)
  cast(g, 'breakingSwipe')
}

/* ---------------- Glacial Lance (Sheer Cold + Never-Melt Ice) ---------------- */

/** Glacial Lance: the lance's hitbox (× area), flight time, the share under which it shatters regular foes, and the frost burst where it ends. */
export const LANCE = { r: 8, ttl: 0.8, execute: 0.25, burst: 34, burstShare: 0.6, spread: 0.32 } as const

/**
 * Colossal lances of ice hurled at the nearest foe, piercing the whole horde
 * in a line: regular foes left under a quarter of their HP shatter, the rest
 * may freeze; at the end of its flight the lance bursts into frost.
 */
const glacialLance: Cast = (g, s) => {
  const p = g.player
  const center = aim(g, 300)
  const fx = look('glacialLance', 'ice', 'glacialLance')
  for (let i = 0; i < s.amount; i++) {
    const angle = center + (i - (s.amount - 1) / 2) * LANCE.spread
    const v = fromAngle(angle, s.speed)
    const lag = -i * 0.08
    spawnAttack(g, {
      ...fx, x: p.x, y: p.y - 10,
      shape: { kind: 'circle', r: LANCE.r * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, status: s.status, execute: LANCE.execute, ttl: LANCE.ttl, age: lag,
    })
    spawnAttack(g, {
      ...fx, visual: 'lanceBurst', x: p.x + v.x * LANCE.ttl, y: p.y - 10 + v.y * LANCE.ttl,
      shape: { kind: 'circle', r: LANCE.burst * s.area }, motion: { kind: 'static' },
      damage: s.damage * LANCE.burstShare, knockback: s.knockback, status: s.status, execute: LANCE.execute,
      ttl: 0.45, activeUntil: 0.06, age: lag - LANCE.ttl,
    })
  }
  cast(g, 'glacialLance')
}

/* ---------------- Per tick ---------------- */

/** Whether `a` crossed `at` seconds of age this tick (it just landed). */
const crossed = (a: Attack, at: number, dt: number) => a.age >= at && a.age - dt < at

/** Landing touches: shake, dust and the sound of the hits that come down later than their cast. */
const impact = (g: Game, a: Attack) => {
  switch (a.visual) {
    case 'skyUppercut':
      // No hitstop, like Focus Punch: it lands again every second or so.
      shakeScreen(g, 7)
      cast(g, 'skyUppercut')
      return burst(g, a.x, a.y + 6, { colors: ['#ffffff', '#f8d030', '#f87040', '#a07040'], count: 26, speed: 190, ttl: 0.45, gravity: 140, size: 2 })
    case 'hyperspaceBurst':
      shakeScreen(g, 4)
      cast(g, 'hyperspaceHole')
      return burst(g, a.x, a.y, { colors: ['#ffffff', '#ffd0e8', '#f85888', '#f8d860'], count: 22, speed: 170, ttl: 0.45 })
    case 'stoneAxe':
      shakeScreen(g, 5)
      cast(g, 'stoneAxe')
      return burst(g, a.x, a.y + 6, { colors: ['#ece4d4', '#a09888', '#666058', '#d8c080'], count: 20, speed: 150, ttl: 0.45, gravity: 220, size: 2 })
    case 'spoutDrop':
      return burst(g, a.x, a.y + 4, { colors: ['#ffffff', '#88b8f0', '#3868c8'], count: 10, speed: 110, ttl: 0.4, gravity: 200 })
    case 'thousandArrows':
      return burst(g, a.x, a.y + 2, { colors: ['#d8c080', '#a08048', '#58c878'], count: 5, speed: 70, ttl: 0.3, gravity: 200 })
    case 'lanceBurst':
      shakeScreen(g, 2)
      return burst(g, a.x, a.y, { colors: ['#ffffff', '#d8f0ff', '#98d8f8'], count: 18, speed: 130, ttl: 0.45, gravity: 120 })
    case 'seedBloom':
      return burst(g, a.x, a.y - 4, { colors: ['#ffffff', '#f8f8a0', '#78c850'], count: 8, speed: 90, ttl: 0.35 })
    case 'sludgeGeyser':
      return burst(g, a.x, a.y - 6, { colors: ['#d080e0', '#9038a0', '#b8f060'], count: 10, speed: 90, ttl: 0.45, gravity: 160 })
    case 'impressionBurst':
      shakeScreen(g, 3)
      return burst(g, a.x, a.y, { colors: ['#ffffff', '#e0f080', '#a8b820', '#f8d030'], count: 18, speed: 150, ttl: 0.4 })
  }
}

/** Ice motes off a flying lance and sparks off a grinding gear. */
const sparkle = (g: Game, a: Attack) => {
  if (a.visual === 'glacialLance' && g.rng() < 0.8) {
    g.particles.push({ x: a.x + range(g.rng, -3, 3), y: a.y + range(g.rng, -3, 3), vx: range(g.rng, -10, 10), vy: range(g.rng, -10, 10), life: 0, ttl: 0.4, color: g.rng() < 0.5 ? '#ffffff' : '#98d8f8', size: 1, gravity: 20, drag: 3 })
  } else if (a.visual === 'gearGrind' && a.hits.size > 0 && g.rng() < 0.5) {
    g.particles.push({ x: a.x + range(g.rng, -6, 6), y: a.y + range(g.rng, 2, 8), vx: range(g.rng, -60, 60), vy: -range(g.rng, 30, 80), life: 0, ttl: 0.3, color: g.rng() < 0.5 ? '#ffffff' : '#f8d860', size: 1, gravity: 260, drag: 1 })
  }
}

/**
 * The evolved verb moves' per-tick parts, after `updateAttacks` moved the
 * hitboxes this tick: Raging Fury's cloak and novas, Electro Drift's links,
 * the Sludge Wave tide, the Explosion chain and the landing touches. Costs a
 * scan of the attacks and nothing else when none of these moves is out.
 */
export const updateVerbEvolved = (g: Game, dt: number) => {
  const actor = g.player
  for (let i = 0; i < g.attacks.length; i++) {
    const a = g.attacks[i]!
    if (a.age < 0) continue
    // Each hitbox acts as the player who cast it.
    g.player = ownerOf(g, a.owner)
    switch (a.visual) {
      case 'ragingFury':
        furyTick(g, a)
        break
      case 'driftLink':
        driftTick(g, a)
        break
      case 'sludgeWave':
        sludgeTick(g, a)
        break
      case 'explosionChain':
        explosionTick(g, a, dt)
        break
      case 'glacialLance':
      case 'gearGrind':
        sparkle(g, a)
        break
      default:
        if (crossed(a, a.activeFrom === Infinity ? 0 : a.activeFrom, dt)) impact(g, a)
    }
  }
  g.player = actor
}

/* ---------------- The moves ---------------- */

export const VERB_EVOLVED_MOVES = {
  ragingFury: {
    name: 'Raging Fury',
    type: 'fire',
    base: stats({ damage: 18, cooldown: 0.5, duration: 2.2, area: 1.15, knockback: 60 }),
    status: { kind: 'burn', chance: 0.35, duration: 2.5, power: 0.35 },
    upgrades: [{ damage: 4 }, { duration: 0.6, area: 0.15 }, { damage: 5, statusChance: 0.15 }, { area: 0.2, damage: 5 }],
    fire: (g, s, owned) => ragingFury(g, s, owned),
  },
  seedFlare: {
    name: 'Seed Flare',
    type: 'grass',
    base: stats({ damage: 46, cooldown: 3.4, amount: 3, duration: 0.7, area: 1.1, knockback: 60 }),
    upgrades: [{ damage: 10 }, { amount: 1 }, { area: 0.2 }, { damage: 12, cooldown: -0.4 }],
    fire: (g, s, owned) => seedFlare(g, s, owned),
  },
  waterSpout: {
    name: 'Water Spout',
    type: 'water',
    base: stats({ damage: 26, cooldown: 1.5, amount: 6, area: 1.2, knockback: 60 }),
    upgrades: [{ amount: 2 }, { damage: 8 }, { area: 0.25 }, { amount: 2, cooldown: -0.2 }],
    fire: (g, s, owned) => waterSpout(g, s, owned),
  },
  electroDrift: {
    name: 'Electro Drift',
    type: 'electric',
    base: stats({ damage: 22, cooldown: 2, amount: 3, speed: 3.6, duration: 1.7, knockback: 40 }),
    status: { kind: 'paralysis', chance: 0.25, duration: 1.2, power: 0 },
    upgrades: [{ amount: 1 }, { damage: 7 }, { duration: 0.4, area: 0.2 }, { amount: 1, statusChance: 0.15 }],
    fire: (g, s, owned) => electroDrift(g, s, owned),
  },
  sludgeWave: {
    name: 'Sludge Wave',
    type: 'poison',
    base: stats({ damage: 9, cooldown: 2.3, amount: 2, area: 1.1, knockback: 70 }),
    status: { kind: 'poison', chance: 0.5, duration: 3.5, power: 0.3 },
    upgrades: [{ damage: 3 }, { amount: 1 }, { area: 0.2, statusChance: 0.15 }, { damage: 3, cooldown: -0.3 }],
    fire: (g, s, owned) => sludgeWave(g, s, owned),
  },
  explosion: {
    name: 'Explosion',
    type: 'normal',
    base: stats({ damage: 120, cooldown: 9, area: 1.1, knockback: 320 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [{ damage: 25 }, { area: 0.15 }, { cooldown: -1.2 }, { damage: 30, area: 0.15 }],
    fire: (g, s, owned) => explosion(g, s, owned),
  },
  oblivionWing: {
    name: 'Oblivion Wing',
    type: 'flying',
    base: stats({ damage: 36, cooldown: 1.3, amount: 2, knockback: 70 }),
    upgrades: [{ damage: 9 }, { amount: 1 }, { cooldown: -0.2 }, { amount: 1, damage: 9 }],
    fire: (g, s, owned) => oblivionWing(g, s, owned),
  },
  skyUppercut: {
    name: 'Sky Uppercut',
    type: 'fighting',
    base: stats({ damage: 92, cooldown: 0.2, amount: 2, area: 1.1, knockback: 260 }),
    stacks: { grow: 'cast', max: UPPER.charge, reset: 'hurt' },
    tags: ['punch'],
    upgrades: [{ damage: 20 }, { amount: 1 }, { area: 0.2 }, { damage: 24, amount: 1 }],
    fire: (g, s, owned) => skyUppercut(g, s, owned),
  },
  gearGrind: {
    name: 'Gear Grind',
    type: 'steel',
    base: stats({ damage: 24, cooldown: 1.8, amount: 2, speed: 170, area: 1.1, knockback: 50 }),
    upgrades: [{ damage: 6 }, { area: 0.2 }, { amount: 1 }, { damage: 7, cooldown: -0.25 }],
    fire: (g, s, owned) => gearGrind(g, s, owned),
  },
  kowtowCleave: {
    name: 'Kowtow Cleave',
    type: 'dark',
    base: stats({ damage: 44, cooldown: 0.75, amount: 1, area: 1.15, knockback: 150 }),
    tags: ['slice'],
    upgrades: [{ damage: 10 }, { amount: 1 }, { area: 0.2 }, { damage: 11, cooldown: -0.12 }],
    fire: (g, s, owned) => kowtowCleave(g, s, owned),
  },
  hyperspaceHole: {
    name: 'Hyperspace Hole',
    type: 'psychic',
    base: stats({ damage: 58, cooldown: 4.2, amount: 3, duration: 1.2, area: 1.15, knockback: 120 }),
    upgrades: [{ damage: 14 }, { amount: 1 }, { area: 0.2, duration: 0.3 }, { damage: 16, cooldown: -0.5 }],
    fire: (g, s, owned) => hyperspaceHole(g, s, owned),
  },
  thousandArrows: {
    name: 'Thousand Arrows',
    type: 'ground',
    base: stats({ damage: 36, cooldown: 1.4, amount: 12, area: 1.1, knockback: 30 }),
    upgrades: [{ amount: 3 }, { damage: 9 }, { area: 0.25 }, { amount: 3, cooldown: -0.2 }],
    fire: (g, s, owned) => thousandArrows(g, s, owned),
  },
  stoneAxe: {
    name: 'Stone Axe',
    type: 'rock',
    base: stats({ damage: 46, cooldown: 1.4, amount: 3, duration: 10, area: 1.15, knockback: 130 }),
    tags: ['slice'],
    upgrades: [{ damage: 10 }, { amount: 1 }, { duration: 4, area: 0.15 }, { damage: 12, amount: 1 }],
    fire: (g, s, owned) => stoneAxe(g, s, owned),
  },
  firstImpression: {
    name: 'First Impression',
    type: 'bug',
    base: stats({ damage: 38, cooldown: 2.4, amount: 3, speed: 360, area: 1.1, knockback: 120 }),
    minCooldown: LUNGE_MIN_COOLDOWN,
    manual: true,
    upgrades: [{ damage: 9 }, { amount: 1 }, { cooldown: -0.3 }, { damage: 10, amount: 1 }],
    fire: (g, s, owned) => firstImpression(g, s, owned),
  },
  breakingSwipe: {
    name: 'Breaking Swipe',
    type: 'dragon',
    base: stats({ damage: 40, cooldown: 1.6, area: 1.15, knockback: 60 }),
    status: { kind: 'weaken', chance: 1, duration: 3, power: 0.3 },
    upgrades: [{ damage: 8 }, { area: 0.2 }, { cooldown: -0.3 }, { damage: 10, area: 0.15 }],
    fire: (g, s, owned) => breakingSwipe(g, s, owned),
  },
  glacialLance: {
    name: 'Glacial Lance',
    type: 'ice',
    base: stats({ damage: 44, cooldown: 2.1, amount: 2, speed: 290, area: 1.15, knockback: 70 }),
    status: { kind: 'freeze', chance: 0.25, duration: 1.5, power: 0 },
    upgrades: [{ amount: 1 }, { damage: 10 }, { area: 0.2, statusChance: 0.15 }, { amount: 1, cooldown: -0.3 }],
    fire: (g, s, owned) => glacialLance(g, s, owned),
  },
} as const satisfies Record<string, MoveDef>

export type VerbEvolvedMoveId = keyof typeof VERB_EVOLVED_MOVES
