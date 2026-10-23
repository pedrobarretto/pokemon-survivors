import { dirTo, fromAngle } from '../engine/math'
import { chance, range } from '../engine/rng'
import * as dm from '../engine/dmath'
import type { PokeType } from '../data/types'
import { burst, floatText, shakeScreen } from './effects'
import {
  AURA_SHARE, AURA_SPEED, AURA_TTL, biggestFoe, boneHits, curseCost, curseTick, CURSE_EVERY, CURSE_FLOOR, densestFoe, DIG_BLAST, DIG_IFRAMES,
  DIG_REACH, DREAM_BONUS, DREAM_DRAIN, DREAM_WINDUP, ECHO_GROW, ECHO_R, ECHO_TIME, echoMult, flailExtra, flailMult, foulMult,
  FOUL_REACH, FOUL_WINDUP, furyNext, FURY_SEEK, GIGA_DASH, GIGA_R, GIGA_SEEK, GIGA_TIME, HYPNOSIS_R, ICE_GROW, ICE_MAX_R,
  MASH_FALL, mashMult, metronomePick, METRONOME_REF, PUNCH_WINDUP, rampDamage, rampFull, SAND_BLIND, SAND_R, SLAM_CLUSTER,
  SLAM_HOP, SLAM_LEAP, SLAM_R, SLAM_REACH, SNARL_RAMP, SNARL_TIME, splitDarts, strongestFirst, SWORD_ARC, SWORD_TIME,
  TWISTER_PULL, ZEN_HOP, ZEN_SEEK, ZEN_TIME,
} from './eggMoveRules'
import { hpFraction, stacksOf, type DamageBonus } from './kitRules'
import { burrow, sweep, wanderer } from './moveKit'
import { chainTargets, lungeTarget } from './moveRules'
import { maxMoveLevel, MOVE_IDS, MOVES, moveStats, type CastStats, type MoveDef, type MoveId } from './moves'
import { enemiesInView, isAlive, nearestEnemy } from './queries'
import { spawnAttack } from './spawn'
import { applyStatus } from './status'
import { ownAttack } from './players'
import type { Attack, Enemy, EggMoveVisual, Game, OwnedMove } from './types'

/**
 * Casting code of the egg families' signature moves (their data lives in
 * `MOVES`, which calls these). Each one is a different verb: put foes to sleep
 * and eat their dreams, burrow and come up under the biggest foe, roll into a
 * crowd, turn a boss's strength against it, pay HP for a curse… The numbers
 * and target picks are pure rules in `eggMoveRules.ts`; the look is
 * `render/eggMoveFx.ts`. Everything runs on the seeded rng and `dmath`.
 */

const look = (move: MoveId, type: PokeType, visual: EggMoveVisual) => ({ move, type, visual })

/** Angle to the nearest foe within `reach`, or the way the player faces. */
const aimAngle = (g: Game, reach: number) => {
  const p = g.player
  const target = nearestEnemy(g, p.x, p.y, reach)
  const d = target ? dirTo(p.x, p.y, target.x, target.y) : p.facing
  return dm.atan2(d.y, d.x)
}

/** Angles spread evenly around `center`, `step` radians apart. */
const fan = (center: number, count: number, step: number) =>
  Array.from({ length: count }, (_, i) => center + (i - (count - 1) / 2) * step)

/** Offset `dist` px towards `angle`, at body height, for strikes glued to the player. */
const reachOffset = (angle: number, dist: number) => {
  const d = fromAngle(angle, dist)
  return { ox: d.x, oy: d.y - 8 }
}

/** Living foes within `r` of (x, y), nearest first (ties to the lower id). */
const foesWithin = (g: Game, x: number, y: number, r: number) => {
  const out: Array<{ e: Enemy; d: number }> = []
  for (const e of g.enemies) {
    if (!isAlive(e)) continue
    const d = dm.sq(e.x - x) + dm.sq(e.y - y)
    if (d <= r * r) out.push({ e, d })
  }
  return out.sort((a, b) => a.d - b.d || a.e.id - b.e.id).map((o) => o.e)
}

/** The current cast stats of an owned move (the cap of a ramp), or null when it isn't owned. */
const castOf = (g: Game, id: MoveId) => {
  const owned = g.player.moves.find((m) => m.id === id)
  return owned ? moveStats(id, owned.level, g.player.stats) : null
}

/** The first hit of a big landing shakes the screen (and holds the world for a blink). */
const landing = (g: Game, a: Attack, shake: number, hitstop = 0) => {
  if (a.hits.size !== 1) return
  shakeScreen(g, shake)
  g.hitstop = Math.max(g.hitstop, hitstop)
  g.events.push({ kind: 'quake' })
}

const sound = (g: Game, move: MoveId) => g.events.push({ kind: 'cast', move })

/* ---------------- Gastly: Dream Eater ---------------- */

const DREAM: readonly DamageBonus[] = [{ when: 'asleep', mult: DREAM_BONUS }]

/**
 * A Hypnosis wave puts the foes around to sleep, then ghostly maws bite
 * `amount` of them (the sleepers first): ×3 on a sleeper, which wakes up, and
 * the bites drain HP back.
 */
export const dreamEater = (g: Game, s: CastStats) => {
  const p = g.player
  const r = HYPNOSIS_R * s.area
  spawnAttack(g, {
    ...look('dreamEater', 'psychic', 'hypnosis'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: 0, oy: -8 }, damage: 0, ttl: 0.7, activeFrom: Infinity,
  })
  const near = foesWithin(g, p.x, p.y, r)
  if (s.status) for (const e of near) if (chance(g.rng, s.status.chance)) applyStatus(e.status, s.status, s.damage, e.boss, 'dreamEater', g.player.slot)
  const asleep = (e: Enemy) => e.status.sleep.time > 0
  const targets = [...near.filter(asleep), ...near.filter((e) => !asleep(e))].slice(0, s.amount)
  targets.forEach((e, i) => {
    spawnAttack(g, {
      ...look('dreamEater', 'psychic', 'dreamBite'), x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'tether', target: e, every: Infinity, next: DREAM_WINDUP },
      damage: s.damage, knockback: s.knockback, bonus: DREAM, drain: DREAM_DRAIN,
      ttl: DREAM_WINDUP + 0.28, activeFrom: Infinity, age: -i * 0.07,
    })
  })
  sound(g, 'dreamEater')
}

/* ---------------- Riolu: Force Palm ---------------- */

/**
 * An aura palm at the nearest foe (more palms fan out around it): may
 * paralyze, and the aura goes right through a foe that's already paralyzed,
 * bursting out behind it as a wave that hits whoever stands there.
 */
export const forcePalm = (g: Game, s: CastStats) => {
  const p = g.player
  const aim = aimAngle(g, 80)
  for (let i = 0; i < s.amount; i++) {
    const angle = aim + (i === 0 ? 0 : (i % 2 === 1 ? 1 : -1) * 0.55 * Math.ceil(i / 2))
    const off = reachOffset(angle, 16 * s.area)
    const r = 12 * s.area
    const delay = i * 0.12
    spawnAttack(g, {
      ...look('forcePalm', 'fighting', 'forcePalm'), x: p.x + off.ox, y: p.y + off.oy,
      shape: { kind: 'circle', r }, motion: { kind: 'follow', ...off },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.24, activeUntil: 0.1, age: -delay,
    })
    const cx = p.x + off.ox
    const cy = p.y + off.oy
    const v = fromAngle(angle, AURA_SPEED)
    for (const e of g.enemies) {
      if (!isAlive(e) || e.status.paralysis.time <= 0) continue
      if (dm.sq(e.x - cx) + dm.sq(e.y - e.radius - cy) > dm.sq(r + e.radius + 4)) continue
      spawnAttack(g, {
        ...look('forcePalm', 'fighting', 'auraWave'), x: e.x, y: e.y - e.radius,
        shape: { kind: 'circle', r: 9 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
        damage: s.damage * AURA_SHARE, knockback: s.knockback, status: s.status, ttl: AURA_TTL, age: -delay - 0.05,
        // It went through this one: the palm already hit it.
        hits: new Map([[e.id, Infinity]]),
      })
    }
  }
}

/* ---------------- Gible: Dig ---------------- */

/** Manual: burrows for `duration` (no damage, the horde loses you; you can still move), then `digEmerge`. Fails right after another move's protection (`wardOpens`). */
export const dig = (g: Game, s: CastStats) => {
  const p = g.player
  if (!burrow(g, 'dig', s.duration)) return
  spawnAttack(g, {
    ...look('dig', 'ground', 'digMound'), x: p.x, y: p.y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: 0 }, damage: 0, ttl: s.duration, activeFrom: Infinity,
  })
  burst(g, p.x, p.y - 2, { colors: ['#a07840', '#d8b070', '#604020'], count: 16, speed: 90, ttl: 0.45, gravity: 220, size: 2 })
  sound(g, 'dig')
}

/** Dig comes up under the biggest foe near where the player is (a boss first) with a quake, or right there with nobody around. */
export const digEmerge = (g: Game, s: CastStats) => {
  const p = g.player
  const target = biggestFoe(g.enemies, p, DIG_REACH)
  if (target) {
    p.x = target.x
    p.y = target.y + 2
  }
  p.iframes = Math.max(p.iframes, DIG_IFRAMES)
  spawnAttack(g, {
    ...look('dig', 'ground', 'digBurst'), x: p.x, y: p.y,
    shape: { kind: 'circle', r: 10 }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, ttl: 0.42, grow: (DIG_BLAST * s.area - 10) / 0.2, activeUntil: 0.2,
  })
  burst(g, p.x, p.y - 4, { colors: ['#a07840', '#d8b070', '#604020', '#e8d8b0'], count: 26, speed: 150, ttl: 0.6, gravity: 260, size: 2 })
  shakeScreen(g, 5)
  g.events.push({ kind: 'quake' })
}

/* ---------------- Dratini: Twister ---------------- */

/** Tornadoes that wander around the player for `duration`, dragging the foes they touch into their eye. */
export const twister = (g: Game, s: CastStats) => {
  for (let i = 0; i < s.amount; i++) {
    const a = wanderer(g, s, look('twister', 'dragon', 'twister'), { r: 13, speed: s.speed, ttl: s.duration, leash: 90, turn: 2.5, hitInterval: 0.3 })
    a.pull = TWISTER_PULL * s.area
    a.age = -i * 0.15
  }
  sound(g, 'twister')
}

/* ---------------- Larvitar: Sand Tomb ---------------- */

/**
 * A sand vortex around the player for `duration`: chip damage and a slow on
 * the foes caught in it, which miss half their contact hits. Casting again
 * while it spins renews it.
 */
export const sandTomb = (g: Game, s: CastStats) => {
  const p = g.player
  const r = SAND_R * s.area
  const live = g.attacks.find((a) => ownAttack(g, a) && a.move === 'sandTomb')
  if (live) {
    live.ttl = live.age + s.duration
    live.shape = { kind: 'circle', r }
    live.damage = s.damage
    live.status = s.status
    return
  }
  spawnAttack(g, {
    ...look('sandTomb', 'ground', 'sandTomb'), x: p.x, y: p.y - 4,
    shape: { kind: 'circle', r }, motion: { kind: 'follow', ox: 0, oy: -4 },
    damage: s.damage, knockback: s.knockback, hitInterval: 0.45, ttl: s.duration, status: s.status, blind: SAND_BLIND,
  })
  sound(g, 'sandTomb')
}

/* ---------------- Beldum: Meteor Mash ---------------- */

/**
 * Meteor fists fall on the nearest foes, a little ahead of them. Every hit
 * powers the next ones up (`stacks`, see `mashMult`) until the player gets hurt.
 */
export const meteorMash = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const damage = s.damage * mashMult(stacksOf(owned))
  const taken = new Set<number>()
  for (let i = 0; i < s.amount; i++) {
    const t = nearestEnemy(g, p.x, p.y, 200, taken)
    if (t) taken.add(t.id)
    let x = p.x + p.facing.x * 60 + range(g.rng, -24, 24)
    let y = p.y + p.facing.y * 60 + range(g.rng, -18, 18)
    if (t) {
      const d = dirTo(t.x, t.y, p.x, p.y)
      const lead = Math.min(t.speed * MASH_FALL, dm.hypot(t.x - p.x, t.y - p.y) * 0.5)
      x = t.x + d.x * lead
      y = t.y + d.y * lead
    }
    spawnAttack(g, {
      ...look('meteorMash', 'steel', 'meteorMash'), x, y,
      shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'static' },
      damage, knockback: s.knockback, ttl: MASH_FALL + 0.45, activeFrom: MASH_FALL, activeUntil: MASH_FALL + 0.08,
      flip: i % 2 === 1, age: -i * 0.14, tier: stacksOf(owned),
    })
  }
}

/* ---------------- Bagon: Zen Headbutt ---------------- */

/** A short psychic hop, head first, into the foe just ahead: a foe it hits flinches (a half-second sleep). Nobody close, no hop. */
export const zenHeadbutt = (g: Game, s: CastStats) => {
  const p = g.player
  const target = lungeTarget(g.enemies, p, p.facing, p.moving, ZEN_SEEK)
  if (!target) return
  const d = dirTo(p.x, p.y, target.x, target.y, p.facing)
  const dist = Math.min(ZEN_HOP, dm.hypot(target.x - p.x, target.y - p.y) + 4)
  p.iframes = Math.max(p.iframes, ZEN_TIME + 0.12)
  spawnAttack(g, {
    ...look('zenHeadbutt', 'psychic', 'zenHeadbutt'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'lunge', vx: (d.x * dist) / ZEN_TIME, vy: (d.y * dist) / ZEN_TIME, left: ZEN_TIME },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: ZEN_TIME + 0.2, activeUntil: ZEN_TIME + 0.04,
  })
}

/* ---------------- Zorua: Foul Play ---------------- */

/** Illusory claws rake the hardest hitters in reach: the harder a foe hits (a boss!), the harder Foul Play hits it back. */
export const foulPlay = (g: Game, s: CastStats) => {
  const p = g.player
  const foes = foesWithin(g, p.x, p.y, FOUL_REACH * s.area)
  // Stable sort: the nearest first among equally strong foes.
  foes.sort((a, b) => b.damage - a.damage)
  foes.slice(0, s.amount).forEach((e, i) => {
    spawnAttack(g, {
      ...look('foulPlay', 'dark', 'foulPlay'), x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: Math.max(8, e.radius) * s.area }, motion: { kind: 'tether', target: e, every: Infinity, next: FOUL_WINDUP },
      damage: s.damage * foulMult(e.damage), knockback: s.knockback, ttl: FOUL_WINDUP + 0.26, activeFrom: Infinity, age: -i * 0.09,
      flip: i % 2 === 1,
    })
  })
}

/* ---------------- Munchlax: Body Slam ---------------- */

/** Manual: a heavy leap onto the thickest crowd nearby (or a hop ahead), landing in a shockwave that may paralyze. */
export const bodySlam = (g: Game, s: CastStats) => {
  const p = g.player
  const target = densestFoe(g.enemies, p, SLAM_REACH, SLAM_CLUSTER)
  const tx = target ? target.x : p.x + p.facing.x * SLAM_HOP
  const ty = target ? target.y : p.y + p.facing.y * SLAM_HOP
  p.iframes = Math.max(p.iframes, SLAM_LEAP + 0.3)
  spawnAttack(g, {
    ...look('bodySlam', 'normal', 'bodySlam'), x: p.x, y: p.y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'lunge', vx: (tx - p.x) / SLAM_LEAP, vy: (ty - p.y) / SLAM_LEAP, left: SLAM_LEAP },
    damage: 0, ttl: SLAM_LEAP, activeFrom: Infinity,
  })
  spawnAttack(g, {
    ...look('bodySlam', 'normal', 'slamWave'), x: tx, y: ty,
    shape: { kind: 'circle', r: 10 }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, status: s.status, ttl: 0.45, grow: (SLAM_R * s.area - 10) / 0.2, activeUntil: 0.2, age: -SLAM_LEAP,
  })
  sound(g, 'bodySlam')
}

export const bodySlamHit = (g: Game, a: Attack) => {
  if (a.visual === 'slamWave') landing(g, a, 6, 0.05)
}

/* ---------------- Machop: Dynamic Punch ---------------- */

/** A slow, huge punch at the nearest foe: an explosion that leaves the foes it hits confused (they stumble into each other). */
export const dynamicPunch = (g: Game, s: CastStats) => {
  const p = g.player
  const off = reachOffset(aimAngle(g, 100), 24 * s.area)
  spawnAttack(g, {
    ...look('dynamicPunch', 'fighting', 'dynamicPunch'), x: p.x + off.ox, y: p.y + off.oy,
    shape: { kind: 'circle', r: 20 * s.area }, motion: { kind: 'follow', ...off },
    damage: s.damage, knockback: s.knockback, status: s.status,
    ttl: PUNCH_WINDUP + 0.42, activeFrom: PUNCH_WINDUP, activeUntil: PUNCH_WINDUP + 0.07,
  })
  sound(g, 'dynamicPunch')
}

export const dynamicPunchHit = (g: Game, a: Attack) => landing(g, a, 4, 0.04)

/* ---------------- Geodude: Rollout ---------------- */

/** For `duration` the player rolls along (the stick steers): each consecutive hit doubles the next, up to ×5. */
export const rollout = (g: Game, s: CastStats) => {
  const p = g.player
  if (g.attacks.some((a) => ownAttack(g, a) && a.move === 'rollout' && a.motion.kind === 'roll')) return
  spawnAttack(g, {
    ...look('rollout', 'rock', 'rollout'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'roll', speed: s.speed },
    damage: s.damage, knockback: s.knockback, hitInterval: 0.5, ttl: s.duration,
  })
  sound(g, 'rollout')
}

export const rolloutHit = (g: Game, a: Attack) => {
  const base = castOf(g, 'rollout')?.damage ?? a.damage
  a.damage = rampDamage(a.damage, base)
  a.tier++
}

/* ---------------- Spheal: Ice Ball ---------------- */

/** Snowballs roll through the horde: each hit doubles the next (up to ×5) and grows the ball, and a full-size one freezes. */
export const iceBall = (g: Game, s: CastStats) => {
  const p = g.player
  for (const angle of fan(aimAngle(g, 240), s.amount, 0.4)) {
    const v = fromAngle(angle, s.speed)
    spawnAttack(g, {
      ...look('iceBall', 'ice', 'iceBall'), x: p.x, y: p.y - 6,
      shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage, knockback: s.knockback, status: s.status, ttl: 1.8,
    })
  }
}

const ICE_FREEZE = { kind: 'freeze', chance: 1, duration: 1.2, power: 0 } as const

export const iceBallHit = (g: Game, a: Attack, e: Enemy) => {
  const s = castOf(g, 'iceBall')
  const base = s?.damage ?? a.damage
  if (rampFull(a.damage, base)) applyStatus(e.status, ICE_FREEZE, a.damage, e.boss, 'iceBall', g.player.slot)
  a.damage = rampDamage(a.damage, base)
  a.tier++
  if (a.shape.kind === 'circle') a.shape = { kind: 'circle', r: Math.min(a.shape.r + ICE_GROW * (s?.area ?? 1), ICE_MAX_R * (s?.area ?? 1)) }
}

/* ---------------- Scyther: Fury Cutter ---------------- */

/** How long a Fury Cutter slash is kept after its swing, so the next cast can tell whether it hit. */
const FURY_RECORD = 6

/**
 * A scythe slash at the nearest foe. A slash that hit makes the next one
 * stronger (×1 → ×4, one more crescent each time); one that hit nothing starts
 * the streak over. With nobody in reach it doesn't swing, so the streak waits.
 */
export const furyCutter = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const prev = g.attacks.filter((a) => ownAttack(g, a) && a.move === 'furyCutter')
  if (prev.length > 0) {
    owned.stacks = furyNext(stacksOf(owned), prev.some((a) => a.hits.size > 0))
    for (const a of prev) a.ttl = a.age
  }
  const target = nearestEnemy(g, p.x, p.y, FURY_SEEK)
  if (!target) return
  const stacks = stacksOf(owned)
  const angle = dm.atan2(target.y - target.radius - (p.y - 8), target.x - p.x)
  const off = reachOffset(angle, 16 * s.area)
  spawnAttack(g, {
    ...look('furyCutter', 'bug', 'furyCutter'), x: p.x + off.ox, y: p.y + off.oy,
    shape: { kind: 'circle', r: 16 * s.area }, motion: { kind: 'follow', ...off },
    damage: s.damage * (1 + stacks), knockback: s.knockback, ttl: FURY_RECORD, activeUntil: 0.1, flip: stacks % 2 === 1, tier: stacks,
  })
  // One more crescent per step of the streak, crossing the first: a scissor of light at ×4.
  for (let k = 1; k <= stacks; k++) {
    const echo = reachOffset(angle + (k % 2 === 1 ? 0.35 : -0.35) * Math.ceil(k / 2), (16 + 2 * k) * s.area)
    spawnAttack(g, {
      ...look('furyCutter', 'bug', 'furyCutter'), x: p.x + echo.ox, y: p.y + echo.oy,
      shape: { kind: 'circle', r: (16 + 3 * k) * s.area }, motion: { kind: 'follow', ...echo },
      damage: 0, ttl: 0.3, activeFrom: Infinity, age: -k * 0.04, flip: (stacks + k) % 2 === 1, tier: stacks,
    })
  }
}

/* ---------------- Honedge: Sacred Sword ---------------- */

/** A spectral blade sweeps the arc in front: it cuts through Bronzong wards and lands resisted matchups as neutral. */
export const sacredSword = (g: Game, s: CastStats) => {
  const aim = aimAngle(g, 90)
  for (let i = 0; i < s.amount; i++) {
    const dir = i % 2 === 0 ? 1 : -1
    const first = g.attacks.length
    sweep(g, s, look('sacredSword', 'fighting', 'sacredSword'), { from: aim - (dir * SWORD_ARC) / 2, arc: dir * SWORD_ARC, time: SWORD_TIME, length: 46 * s.area, segments: 5, r: 7, inner: 10 })
    const last = g.attacks.length - 1
    for (let k = first; k <= last; k++) {
      const a = g.attacks[k]!
      a.sure = true
      a.age = -i * 0.28
      // The outer segment draws the whole blade; the others only cut.
      if (k < last) a.visual = 'sacredEdge'
    }
  }
  sound(g, 'sacredSword')
}

/* ---------------- Dreepy: Dragon Darts ---------------- */

/** Darts that home in on the nearest foes: one each while there are enough foes, doubling up on the nearest otherwise. */
export const dragonDarts = (g: Game, s: CastStats) => {
  const p = g.player
  const foes = foesWithin(g, p.x, p.y, 300)
  const counts = splitDarts(s.amount, foes.length)
  const plan = counts.length > 0 ? counts.flatMap((c, i) => Array.from({ length: c }, () => foes[i]!)) : Array.from({ length: s.amount }, () => null)
  const ahead = dm.atan2(p.facing.y, p.facing.x)
  plan.forEach((target, n) => {
    const side = n % 2 === 0 ? -1 : 1
    const toward = target ? dm.atan2(target.y - p.y, target.x - p.x) : ahead
    const v = fromAngle(toward + side * 0.9, s.speed)
    spawnAttack(g, {
      ...look('dragonDarts', 'dragon', 'dragonDart'), x: p.x + side * 4, y: p.y - 10,
      shape: { kind: 'circle', r: 4 * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 9, target },
      damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 1.6, age: -n * 0.07,
    })
  })
  sound(g, 'dragonDarts')
}

/* ---------------- Deino: Snarl ---------------- */

/**
 * Three heads, three waves: the first snarls at the nearest foe, each next one
 * leaps from where the last one hit to the next foe, a little bigger and
 * harder (`SNARL_RAMP`). With no foe left, a wave keeps going the same way.
 */
export const snarl = (g: Game, s: CastStats) => {
  const p = g.player
  const targets = chainTargets(g.enemies, p, s.amount, 170, 110 * s.area)
  let from = { x: p.x, y: p.y - 8 }
  let dir = fromAngle(aimAngle(g, 170))
  for (let i = 0; i < s.amount; i++) {
    const t = targets[i]
    const to = t ? { x: t.x, y: t.y - t.radius } : { x: from.x + dir.x * 56, y: from.y + dir.y * 56 }
    const len = Math.max(1, dm.hypot(to.x - from.x, to.y - from.y))
    dir = { x: (to.x - from.x) / len, y: (to.y - from.y) / len }
    // A little past the foe, so the wave washes over it.
    const speed = (len + 12) / SNARL_TIME
    spawnAttack(g, {
      ...look('snarl', 'dark', 'snarl'), x: from.x, y: from.y, from: { ...from },
      shape: { kind: 'circle', r: (11 + 2 * i) * s.area }, motion: { kind: 'linear', vx: dir.x * speed, vy: dir.y * speed },
      damage: s.damage * dm.pow(SNARL_RAMP, i), knockback: s.knockback, ttl: SNARL_TIME + 0.06, age: -i * SNARL_TIME, tier: i,
    })
    from = to
  }
  sound(g, 'snarl')
}

/* ---------------- Slakoth: Giga Impact ---------------- */

/**
 * Manual: a charge into the foe ahead and a colossal impact, then the player
 * can't move for `duration` (its recharge; the duration stat here is that
 * stuck time, read before items stretch it).
 */
export const gigaImpact = (g: Game, s: CastStats) => {
  const p = g.player
  const target = lungeTarget(g.enemies, p, p.facing, p.moving, GIGA_SEEK)
  const d = target ? dirTo(p.x, p.y, target.x, target.y, p.facing) : p.facing
  const dist = target ? Math.min(GIGA_DASH, dm.hypot(target.x - p.x, target.y - p.y) + 6) : GIGA_DASH * 0.5
  const stuck = s.duration / Math.max(0.1, p.stats.duration)
  p.iframes = Math.max(p.iframes, GIGA_TIME + 0.25)
  p.rooted = Math.max(p.rooted, GIGA_TIME + stuck)
  spawnAttack(g, {
    ...look('gigaImpact', 'normal', 'gigaImpact'), x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 12 * s.area }, motion: { kind: 'lunge', vx: (d.x * dist) / GIGA_TIME, vy: (d.y * dist) / GIGA_TIME, left: GIGA_TIME },
    damage: s.damage * 0.35, knockback: s.knockback * 0.3, ttl: GIGA_TIME + 0.12, activeUntil: GIGA_TIME,
  })
  spawnAttack(g, {
    ...look('gigaImpact', 'normal', 'gigaWave'), x: p.x + d.x * dist, y: p.y + d.y * dist - 4,
    shape: { kind: 'circle', r: 12 }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, ttl: 0.55, grow: (GIGA_R * s.area - 12) / 0.18, activeUntil: 0.18, age: -GIGA_TIME,
  })
  sound(g, 'gigaImpact')
}

export const gigaImpactHit = (g: Game, a: Attack) => {
  if (a.visual === 'gigaWave') landing(g, a, 9, 0.09)
}

/* ---------------- Feebas: Flail ---------------- */

/** Wild tail slaps all around: the lower the player's HP, the harder they hit and the more of them. */
export const flail = (g: Game, s: CastStats) => {
  const p = g.player
  const hp = hpFraction(p)
  const damage = s.damage * flailMult(hp)
  const aim = aimAngle(g, 80)
  const whacks = s.amount + flailExtra(hp)
  for (let i = 0; i < whacks; i++) {
    const off = reachOffset(aim + range(g.rng, -1.7, 1.7), 17 * s.area)
    spawnAttack(g, {
      ...look('flail', 'normal', 'flail'), x: p.x + off.ox, y: p.y + off.oy,
      shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'follow', ...off },
      damage, knockback: s.knockback, ttl: 0.18, activeUntil: 0.08, age: -i * 0.075, flip: chance(g.rng, 0.5), tier: flailExtra(hp),
    })
  }
}

/* ---------------- Cubone: Bone Rush ---------------- */

/** A bone club combo at the nearest foe: 2 to 5 swings (more with upgrades), the last one knocking it back hard. */
export const boneRush = (g: Game, s: CastStats) => {
  const p = g.player
  const hits = boneHits(g.rng()) + s.amount
  const aim = aimAngle(g, 80)
  for (let i = 0; i < hits; i++) {
    const side = i % 2 === 0 ? 1 : -1
    const last = i === hits - 1
    const off = reachOffset(aim + side * 0.4, (last ? 20 : 17) * s.area)
    spawnAttack(g, {
      ...look('boneRush', 'ground', 'boneRush'), x: p.x + off.ox, y: p.y + off.oy,
      shape: { kind: 'circle', r: (last ? 13 : 11) * s.area }, motion: { kind: 'follow', ...off },
      damage: s.damage, knockback: last ? s.knockback * 3 : s.knockback * 0.4, ttl: 0.14, activeUntil: 0.07, age: -i * 0.1,
      flip: side < 0, tier: last ? 1 : 0,
    })
  }
}

/* ---------------- Togepi: Metronome ---------------- */

/** Moves Metronome can call: base moves, and now and then an evolved one. None that keeps state between casts or hits on its own. */
const METRONOME_COMMON = [
  'ember', 'waterGun', 'razorLeaf', 'thunder', 'sludgeBomb', 'gust', 'psyshock', 'earthquake', 'iceShard',
  'rockTomb', 'pinMissile', 'dragonBreath', 'flashCannon', 'crunch', 'disarmingVoice', 'twister', 'dynamicPunch', 'snarl',
] as const satisfies readonly MoveId[]
const METRONOME_EVOLVED = [
  'flamethrower', 'fireBlast', 'hydroPump', 'surf', 'leafStorm', 'wildboltStorm', 'blizzard', 'stoneEdge',
  'hurricane', 'megahorn', 'outrage', 'triAttack',
] as const satisfies readonly MoveId[]

/**
 * Wags a finger and casts a random move from a curated list (seeded), at the
 * level Metronome has (or that move's max) and scaled by its damage. The move's
 * hitboxes count as Metronome's, and its icon pops over the player in a bubble.
 */
export const metronome = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const id: MoveId = metronomePick(g.rng(), g.rng(), METRONOME_COMMON, METRONOME_EVOLVED)
  const def: MoveDef = MOVES[id]
  const called = moveStats(id, Math.min(owned.level, maxMoveLevel(id)), p.stats)
  const first = g.attacks.length
  def.fire(g, { ...called, damage: called.damage * (s.damage / METRONOME_REF) }, owned)
  for (let k = first; k < g.attacks.length; k++) g.attacks[k]!.move = 'metronome'
  spawnAttack(g, {
    ...look('metronome', 'normal', 'metronome'), x: p.x, y: p.y - 30,
    shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: -30 }, damage: 0, ttl: 0.8, activeFrom: Infinity,
    // The bubble over the finger shows the called move's icon.
    tier: MOVE_IDS.indexOf(id),
  })
  sound(g, 'metronome')
}

/* ---------------- Noibat: Echoed Voice ---------------- */

/** Sound rings around the player that grow with every cast in a row (bigger, harder, more rings), until the player gets hurt. */
export const echoedVoice = (g: Game, s: CastStats, owned: OwnedMove) => {
  const p = g.player
  const k = stacksOf(owned)
  const radius = (ECHO_R + ECHO_GROW * k) * s.area
  const rings = 1 + Math.floor(k / 2)
  for (let i = 0; i < rings; i++) {
    spawnAttack(g, {
      ...look('echoedVoice', 'normal', 'echoedVoice'), x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -8 },
      damage: s.damage * echoMult(k), knockback: s.knockback, ttl: ECHO_TIME, grow: (radius - 6) / ECHO_TIME, age: -i * 0.14, tier: k,
    })
  }
  sound(g, 'echoedVoice')
}

/* ---------------- Shuppet: Curse ---------------- */

/**
 * Pays 15% of the player's current HP to curse the strongest foes in view (a
 * boss first): they lose `damage`% of their max HP per second for `duration`.
 * Sure hits: wards and resistances don't stop it. Nobody in view (or the
 * player under `CURSE_FLOOR` of their HP), no curse and no cost.
 */
export const curse = (g: Game, s: CastStats) => {
  const p = g.player
  const foes = enemiesInView(g).sort(strongestFirst).slice(0, s.amount)
  if (foes.length === 0 || hpFraction(p) < CURSE_FLOOR) return
  const cost = curseCost(p.hp)
  if (cost > 0) {
    p.hp -= cost
    floatText(g, p.x, p.y - 28, String(cost), '#a070d8', true)
    burst(g, p.x, p.y - 12, { colors: ['#705898', '#a070d8', '#281838'], count: 10, speed: 60, ttl: 0.5, gravity: -40 })
  }
  for (const e of foes) {
    // A curse already on it is renewed, not doubled.
    for (const a of g.attacks) if (ownAttack(g, a) && a.move === 'curse' && a.motion.kind === 'tether' && a.motion.target === e) a.ttl = a.age
    spawnAttack(g, {
      ...look('curse', 'ghost', 'curse'), x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'tether', target: e, every: CURSE_EVERY, next: CURSE_EVERY },
      damage: curseTick(e.maxHp, s.damage), sure: true, ttl: s.duration, activeFrom: Infinity,
    })
  }
  sound(g, 'curse')
}
