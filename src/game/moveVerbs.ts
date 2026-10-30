import { dirTo, fromAngle, TAU } from '../engine/math'
import { chance, range } from '../engine/rng'
import * as dm from '../engine/dmath'
import { damageEnemy, healPlayer } from './combat'
import { burst, floatText, shakeScreen } from './effects'
import type { DamageBonus } from './kitRules'
import { returnShot, stacksOf, strike, sweep, throwFoe, took, trailer } from './moveKit'
import { LUNGE_OVERSHOOT, LUNGE_SEEK, lungeLength } from './moveRules'
import type { CastStats } from './moves'
import {
  atLevel, clusterSpots, electroMult, farthest, gyroMult, inArc, mostHurt, nearestPreferring, ringPoints, roostHeal, roostLands, roostSettle,
  selfDestructCost, SHEER_COLD_EXECUTE, STEALTH_RINGS,
} from './moveVerbRules'
import { enemiesInView, nearestEnemy } from './queries'
import { refreshMods } from './mods'
import { spawnAttack } from './spawn'
import { ownAttack } from './players'
import type { Game, OwnedMove } from './types'
import { weatherHere } from './weather'

/**
 * Casts of the "verb" moves: each one adds a way to play rather than a bigger
 * number (walk circles with Flame Wheel, stand still for Roost, finish with
 * Brine, pick your ground with Stealth Rock…). `MOVES` points its `fire` here;
 * the pure rules live in `moveVerbRules.ts`, the art in `render/verbFx.ts`.
 * Every cast is safe to call off-cycle (Metronome fires random moves).
 */

/** What a move's `fire` gets (see `MoveDef.fire`). */
type Cast = (g: Game, s: CastStats, owned: OwnedMove) => void

/** Sounds the verb moves ask the shell for (`moveSound` events, played in `main.ts`). */
export type MoveSound =
  | 'explosion' | 'solarCharge' | 'solarBeam' | 'focusReady' | 'focusPunch' | 'futureSight' | 'bone' | 'stealthRock'
  | 'uTurn' | 'dragonTail' | 'sheerCold' | 'roost' | 'brine' | 'electroBall' | 'suckerPunch'

const sound = (g: Game, s: MoveSound) => g.events.push({ kind: 'moveSound', sound: s })

/** Angle to the nearest foe within `reach`, or the way the player faces. */
const aim = (g: Game, reach: number) => {
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, reach)
  const d = e ? dirTo(p.x, p.y, e.x, e.y - e.radius, p.facing) : p.facing
  return dm.atan2(d.y, d.x)
}

/* ---------------- Flame Wheel ---------------- */

/** Flame Wheel drops a fire patch every `every` px walked, `r` px wide (× area), hitting every `hitInterval`. */
export const FLAME_WHEEL = { every: 11, r: 9, hitInterval: 0.4 } as const

/**
 * A wheel of fire that rolls with the player and leaves burning patches behind,
 * only while walking (`trailer`). One carrier for the whole run: each cast
 * refreshes its numbers, like Whirlpool's aura.
 */
export const flameWheel: Cast = (g, s) => {
  const carrier = g.attacks.find((a) => ownAttack(g, a) && a.move === 'flameWheel' && a.trailer)
  if (carrier?.trailer) {
    carrier.damage = s.damage
    carrier.status = s.status
    carrier.trailer.r = FLAME_WHEEL.r * s.area
    carrier.trailer.ttl = s.duration
    refreshMods(g, carrier)
    return
  }
  const look = { move: 'flameWheel', type: 'fire', visual: 'flameTrail' } as const
  const a = trailer(g, s, look, { every: FLAME_WHEEL.every, r: FLAME_WHEEL.r, ttl: s.duration, hitInterval: FLAME_WHEEL.hitInterval, duration: Infinity })
  a.visual = 'flameWheel'
}

/* ---------------- Solar Beam ---------------- */

/** Seconds of light gathering before the beam (none in harsh sunlight), the sweep's arc and the beam's build. */
export const SOLAR = { charge: 1, arc: Math.PI / 2, length: 120, segments: 12, r: 7 } as const

/**
 * Light gathers at the player's mouth for a second (the charge visual points
 * where the sweep starts), then a beam sweeps 90° across the nearest foe.
 * Extra beams split the circle. In harsh sunlight it fires at once.
 */
export const solarBeam: Cast = (g, s) => {
  const p = g.player
  const charge = weatherHere(g) === 'sun' ? 0 : SOLAR.charge
  const center = aim(g, 240)
  const look = { move: 'solarBeam', type: 'grass', visual: 'solarBeam' } as const
  for (let i = 0; i < s.amount; i++) {
    const from = center + (i / s.amount) * TAU - SOLAR.arc / 2
    if (charge > 0) {
      spawnAttack(g, {
        ...look, visual: 'solarCharge', x: p.x, y: p.y - 8,
        shape: { kind: 'circle', r: 1 }, motion: { kind: 'orbit', angle: from, spin: 0, radius: 10 },
        damage: 0, ttl: charge, activeFrom: Infinity,
      })
    }
    const first = g.attacks.length
    sweep(g, s, look, { from, arc: SOLAR.arc, time: s.duration, length: SOLAR.length * s.area, segments: SOLAR.segments, r: SOLAR.r })
    // The beam waits out the charge; its tip is flagged so the art can flare it.
    for (let k = first; k < g.attacks.length; k++) g.attacks[k]!.age = -charge
    g.attacks[g.attacks.length - 1]!.flip = true
  }
  sound(g, charge > 0 ? 'solarCharge' : 'solarBeam')
}

/* ---------------- Brine ---------------- */

/** Brine's reach, its lob's flight time and the splash's radius (× area). */
export const BRINE = { range: 220, flight: 0.28, r: 15 } as const
/** Brine hits foes under half HP twice as hard. */
const BRINE_BONUS: readonly DamageBonus[] = [{ when: 'lowHp', mult: 2 }]

/** Lobs a ball of brine onto the most hurt foes in view: the finisher. */
export const brine: Cast = (g, s) => {
  const p = g.player
  const targets = mostHurt(enemiesInView(g), p, s.amount, BRINE.range)
  targets.forEach((e, i) => {
    spawnAttack(g, {
      move: 'brine', type: 'water', visual: 'brine', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: BRINE.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, bonus: BRINE_BONUS, status: s.status,
      ttl: BRINE.flight + 0.42, activeFrom: BRINE.flight, activeUntil: BRINE.flight + 0.06,
      from: { x: p.x, y: p.y - 10 }, age: -i * 0.08,
    })
  })
  if (targets.length > 0) sound(g, 'brine')
}

/* ---------------- Electro Ball ---------------- */

/** Electro Ball: an orb whose damage and size grow with the speed stat (`electroMult`). */
export const electroBall: Cast = (g, s) => {
  const p = g.player
  const mult = electroMult(p.stats.speed)
  const center = aim(g, 300)
  for (let i = 0; i < s.amount; i++) {
    const v = fromAngle(center + (i - (s.amount - 1) / 2) * 0.28, s.speed)
    spawnAttack(g, {
      move: 'electroBall', type: 'electric', visual: 'electroBall', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: (3 + 3 * mult) * s.area }, motion: { kind: 'linear', vx: v.x, vy: v.y },
      damage: s.damage * mult, knockback: s.knockback, pierce: s.pierce, status: s.status, ttl: 1.6, age: -i * 0.07,
    })
  }
  sound(g, 'electroBall')
}

/* ---------------- Venoshock ---------------- */

/** Venoshock hits poisoned foes twice as hard. */
const VENOSHOCK_BONUS: readonly DamageBonus[] = [{ when: 'poisoned', mult: 2 }]

/** Homing globs that seek out poisoned foes first: the payoff for Sludge Bomb and Toxic Spikes. */
export const venoshock: Cast = (g, s) => {
  const p = g.player
  const taken = new Set<number>()
  const center = aim(g, 260)
  for (let i = 0; i < s.amount; i++) {
    const target = nearestPreferring(g.enemies, p, 260, (e) => e.status.poison.time > 0, taken)
    if (target) taken.add(target.id)
    const v = fromAngle(center + (i % 2 === 0 ? 1 : -1) * (0.5 + 0.2 * Math.floor(i / 2)), s.speed)
    spawnAttack(g, {
      move: 'venoshock', type: 'poison', visual: 'venoshock', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 5 * s.area }, motion: { kind: 'homing', vx: v.x, vy: v.y, speed: s.speed, turn: 7, target },
      damage: s.damage, knockback: s.knockback, pierce: s.pierce, bonus: VENOSHOCK_BONUS, status: s.status, ttl: 2, age: -i * 0.08,
    })
  }
}

/* ---------------- Self-Destruct ---------------- */

/** Self-Destruct's blast radius (× area), how fast it opens and the i-frames it grants. */
export const SELF_DESTRUCT = { r: 64, open: 0.2, iframes: 0.8 } as const

/** Manual: pays a fifth of the current HP for a huge blast around the player, safe inside it for a moment. */
export const selfDestruct: Cast = (g, s) => {
  const p = g.player
  const cost = selfDestructCost(p.hp)
  if (cost > 0) {
    p.hp -= cost
    floatText(g, p.x, p.y - 28, String(cost), '#ff5040', true)
  }
  p.iframes = Math.max(p.iframes, SELF_DESTRUCT.iframes)
  const r = SELF_DESTRUCT.r * s.area
  spawnAttack(g, {
    move: 'selfDestruct', type: 'normal', visual: 'selfDestruct', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, ttl: 0.55, activeUntil: SELF_DESTRUCT.open, grow: (r - 8) / SELF_DESTRUCT.open,
  })
  burst(g, p.x, p.y - 8, { colors: ['#ffffff', '#fff0a0', '#f8a030', '#d84020', '#584848'], count: 46, speed: 230, ttl: 0.7, gravity: 160, size: 2 })
  shakeScreen(g, 10)
  g.flash = Math.max(g.flash, 0.55)
  g.hitstop = Math.max(g.hitstop, 0.06)
  sound(g, 'explosion')
}

/* ---------------- Roost ---------------- */

/** The gust Roost lands with: radius (× area) and how fast it opens. */
export const ROOST_GUST = { r: 40, open: 0.25 } as const

/**
 * Stand still long enough (`roostSettle`) and the player roosts: a gust of
 * feathers shoves the nearest foes away, then a share of max HP heals every
 * second while they stay put. Walking ends it.
 */
export const roost: Cast = (g, s, owned) => {
  const p = g.player
  const settle = roostSettle(owned)
  if (p.still < settle || p.hidden) return
  if (roostLands(p.still, s.cooldown, settle)) {
    spawnAttack(g, {
      move: 'roost', type: 'flying', visual: 'roostGust', x: p.x, y: p.y - 6,
      shape: { kind: 'circle', r: 6 }, motion: { kind: 'follow', ox: 0, oy: -6 },
      damage: s.damage, knockback: s.knockback, ttl: ROOST_GUST.open + 0.15, activeUntil: ROOST_GUST.open,
      grow: (ROOST_GUST.r * s.area - 6) / ROOST_GUST.open,
    })
    burst(g, p.x, p.y - 10, { colors: ['#ffffff', '#e8e0f8', '#a890f0'], count: 14, speed: 120, ttl: 0.5, gravity: 60, size: 2 })
    sound(g, 'roost')
  }
  const perSecond = p.stats.maxHp * roostHeal(owned)
  const healed = healPlayer(g, perSecond * s.cooldown)
  if (healed <= 0) return
  if (chance(g.rng, 0.6)) {
    g.particles.push({ x: p.x + range(g.rng, -9, 9), y: p.y - range(g.rng, 2, 14), vx: 0, vy: -18, life: 0, ttl: 0.6, color: chance(g.rng, 0.5) ? '#78f878' : '#d8f8c8', size: 1, gravity: -10, drag: 1 })
  }
  // One "+N" a second while it heals.
  if (Math.floor(p.still) > Math.floor(p.still - s.cooldown)) floatText(g, p.x, p.y - 30, `+${Math.max(1, dm.round(perSecond))}`, '#78f878')
}

/* ---------------- Focus Punch ---------------- */

/** Casts (`cooldown` apart) to charge Focus Punch, how near a foe must be for the punch, its shockwave and the i-frames after it. */
export const FOCUS = { charge: 8, reach: 46, shock: 34, shockShare: 0.5, iframes: 0.4 } as const
/** Short Focus (its Lv 7 fork's second branch): charged in this many casts. */
const FOCUS_SHORT = 5

/** Casts Focus Punch needs to charge, after its branches. */
export const focusCharge = (owned: OwnedMove) => (took(owned, 7, 1) ? FOCUS_SHORT : FOCUS.charge)

/**
 * Charges one stack per cast while the player isn't hurt (a hit resets it,
 * `stacks` rule on the move). Full, it waits for a foe in reach and lands one
 * huge punch with a shockwave around it.
 */
export const focusPunch: Cast = (g, s, owned) => {
  const stacks = stacksOf(owned)
  const charge = focusCharge(owned)
  if (stacks < charge) {
    // This cast's stack fills it.
    if (stacks === charge - 1) sound(g, 'focusReady')
    return
  }
  const p = g.player
  const e = nearestEnemy(g, p.x, p.y, FOCUS.reach * s.area)
  if (!e) return
  // Spent: the cast's own stack (added right after) brings it back to 0.
  owned.stacks = -1
  const at = { x: e.x, y: e.y - e.radius }
  spawnAttack(g, {
    move: 'focusPunch', type: 'fighting', visual: 'focusPunch', ...at,
    shape: { kind: 'circle', r: 14 * s.area }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, ttl: 0.45, activeUntil: 0.05, from: { x: p.x, y: p.y - 10 },
  })
  spawnAttack(g, {
    move: 'focusPunch', type: 'fighting', visual: 'focusShock', ...at,
    shape: { kind: 'circle', r: 6 }, motion: { kind: 'static' },
    damage: s.damage * FOCUS.shockShare, knockback: s.knockback, ttl: 0.32, activeUntil: 0.16,
    grow: (FOCUS.shock * s.area - 6) / 0.16,
  })
  burst(g, at.x, at.y, { colors: ['#ffffff', '#f8d030', '#f87040', '#c03028'], count: 22, speed: 180, ttl: 0.4, size: 2 })
  // The follow-through: a breath of safety while the shockwave clears the crowd.
  p.iframes = Math.max(p.iframes, FOCUS.iframes)
  shakeScreen(g, 6)
  g.hitstop = Math.max(g.hitstop, 0.07)
  sound(g, 'focusPunch')
}

/* ---------------- Gyro Ball ---------------- */

/** Gyro Ball's gears: orbit radius and gear size (× area), and how often a gear can hit the same foe. */
export const GYRO = { radius: 34, r: 9, hitInterval: 0.45 } as const

/**
 * Steel gears orbiting the player for good. Each cast (a quick tick) sets
 * their damage from how fast the player moves right now (`gyroMult`): they
 * grind hardest while the player stands still.
 */
export const gyroBall: Cast = (g, s) => {
  const p = g.player
  const damage = s.damage * gyroMult(dm.hypot(p.vx, p.vy))
  const gears = g.attacks.filter((a) => ownAttack(g, a) && a.move === 'gyroBall')
  if (gears.length === s.amount) {
    for (const a of gears) {
      a.damage = damage
      a.knockback = s.knockback
      a.shape = { kind: 'circle', r: GYRO.r * s.area }
      refreshMods(g, a)
      if (a.motion.kind === 'orbit') {
        a.motion.spin = s.speed
        a.motion.radius = GYRO.radius * s.area
      }
    }
    return
  }
  // A gear more (or fewer): lay them out evenly again from where the first one was.
  const first = gears[0]?.motion
  const start = first?.kind === 'orbit' ? first.angle : dm.atan2(p.facing.y, p.facing.x)
  for (const a of gears) a.ttl = a.age
  for (let i = 0; i < s.amount; i++) {
    spawnAttack(g, {
      move: 'gyroBall', type: 'steel', visual: 'gyroBall', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: GYRO.r * s.area }, motion: { kind: 'orbit', angle: start + (i / s.amount) * TAU, spin: s.speed, radius: GYRO.radius * s.area },
      damage, knockback: s.knockback, hitInterval: GYRO.hitInterval, ttl: Infinity, status: s.status,
    })
  }
}

/* ---------------- Sucker Punch ---------------- */

/** Sucker Punch's reach past the player's body (× area), and how soon it looks again after finding no one. */
export const SUCKER = { reach: 22, poll: 0.05 } as const

/**
 * A shadow jab at each foe that steps within reach, before it can touch the
 * player. Finding no one, it keeps watching (checks again in `poll` seconds)
 * instead of waiting a whole cooldown.
 */
export const suckerPunch: Cast = (g, s, owned) => {
  const p = g.player
  const reach = (SUCKER.reach + p.radius) * s.area
  const taken = new Set<number>()
  for (let i = 0; i < s.amount; i++) {
    const e = nearestEnemy(g, p.x, p.y, reach, taken)
    if (!e) break
    taken.add(e.id)
    spawnAttack(g, {
      move: 'suckerPunch', type: 'dark', visual: 'suckerPunch', x: e.x, y: e.y - e.radius,
      shape: { kind: 'circle', r: 8 * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, ttl: 0.24, activeUntil: 0.03, from: { x: p.x, y: p.y - 8 }, flip: i % 2 === 1,
    })
  }
  // `updateMoves` adds a full cooldown after this: leave only the poll.
  if (taken.size === 0) owned.cooldown -= s.cooldown - SUCKER.poll
  else sound(g, 'suckerPunch')
}

/* ---------------- Future Sight ---------------- */

/** Future Sight: seconds until the columns land, their radius (× area), the cluster size it looks for and how far ahead of a cluster it aims. */
export const FUTURE = { delay: 2, r: 24, cluster: 44, lead: 45 } as const

/**
 * Marks the densest groups in view; two seconds later psychic columns crash
 * down on the marks. The marks sit a little toward the player, where the
 * horde will have walked by then.
 */
export const futureSight: Cast = (g, s) => {
  const p = g.player
  const spots = clusterSpots(enemiesInView(g), s.amount, FUTURE.cluster)
  spots.forEach((at, i) => {
    const d = dm.hypot(p.x - at.x, p.y - at.y)
    const lead = d > 0 ? Math.min(d * 0.45, FUTURE.lead) / d : 0
    strike(g, s, { move: 'futureSight', type: 'psychic', visual: 'futureSight' }, at.x + (p.x - at.x) * lead, at.y + (p.y - at.y) * lead, FUTURE.r * s.area, FUTURE.delay + i * 0.12, 0.45)
  })
  if (spots.length > 0) sound(g, 'futureSight')
}

/* ---------------- Bonemerang ---------------- */

/** Bonemerang's reach (× area), the bone's hitbox and how far it flies with no foe around. */
export const BONE = { range: 170, r: 7, idle: 110 } as const

/** Bones fly to the farthest foes in reach and come back to wherever the player is now, hitting both ways. */
export const bonemerang: Cast = (g, s) => {
  const p = g.player
  const look = { move: 'bonemerang', type: 'ground', visual: 'bone' } as const
  const targets = farthest(enemiesInView(g), p, s.amount, BONE.range * s.area)
  if (targets.length === 0) returnShot(g, s, look, dm.atan2(p.facing.y, p.facing.x), BONE.idle * s.area, BONE.r)
  targets.forEach((e, i) => {
    const dx = e.x - p.x
    const dy = e.y - e.radius - (p.y - 8)
    returnShot(g, s, look, dm.atan2(dy, dx), dm.hypot(dx, dy) + 12, BONE.r).age = -i * 0.1
  })
  sound(g, 'bone')
}

/* ---------------- Stealth Rock ---------------- */

/** Stealth Rock's ring radius and stone size (× area), and how often a stone can hit the same foe. */
export const STEALTH = { radius: 42, r: 7, hitInterval: 0.6 } as const

/**
 * Sets a ring of floating pointed stones around where the player stands. They
 * stay for `duration`, hurting every foe that walks into them; past
 * `STEALTH_RINGS` rings' worth the oldest crumble.
 */
export const stealthRock: Cast = (g, s) => {
  const p = g.player
  const stones = g.attacks.filter((a) => ownAttack(g, a) && a.move === 'stealthRock')
  // Attacks stay in spawn order: the first ones are the oldest.
  const extra = stones.length + s.amount - s.amount * STEALTH_RINGS
  for (let i = 0; i < extra && i < stones.length; i++) stones[i]!.ttl = stones[i]!.age
  ringPoints(p, s.amount, STEALTH.radius * s.area, g.rng() * TAU).forEach((at, i) => {
    spawnAttack(g, {
      move: 'stealthRock', type: 'rock', visual: 'stealthRock', x: at.x, y: at.y,
      shape: { kind: 'circle', r: STEALTH.r * s.area }, motion: { kind: 'static' },
      damage: s.damage, knockback: s.knockback, hitInterval: STEALTH.hitInterval, ttl: s.duration, status: s.status,
      flip: i % 2 === 0, age: -i * 0.04,
    })
  })
  sound(g, 'stealthRock')
}

/* ---------------- U-turn ---------------- */

/** U-turn: seconds per leg and the pause at the far end. */
export const U_TURN = { leg: 0.13, pause: 0.07 } as const

/**
 * Manual: dashes through the nearest foe and straight back to where it
 * started, hitting on the way out and on the way back, untouchable throughout.
 */
export const uTurn: Cast = (g, s) => {
  const p = g.player
  const length = lungeLength(s.speed)
  const target = nearestEnemy(g, p.x, p.y, length + LUNGE_SEEK)
  const d = target ? dirTo(p.x, p.y, target.x, target.y, p.facing) : p.facing
  const dist = target ? Math.min(length + LUNGE_OVERSHOOT, dm.hypot(target.x - p.x, target.y - p.y) + LUNGE_OVERSHOOT) : length
  const v = dist / U_TURN.leg
  p.iframes = Math.max(p.iframes, U_TURN.leg * 2 + U_TURN.pause + 0.15)
  for (const back of [false, true]) {
    const k = back ? -1 : 1
    spawnAttack(g, {
      move: 'uTurn', type: 'bug', visual: 'uTurn', x: p.x, y: p.y - 8,
      shape: { kind: 'circle', r: 11 * s.area }, motion: { kind: 'lunge', vx: d.x * v * k, vy: d.y * v * k, left: U_TURN.leg },
      damage: s.damage, knockback: s.knockback, ttl: U_TURN.leg + 0.14, activeUntil: U_TURN.leg, flip: back,
      age: back ? -(U_TURN.leg + U_TURN.pause) : 0,
    })
  }
  sound(g, 'uTurn')
}

/* ---------------- Dragon Tail ---------------- */

/** Dragon Tail: reach (× area), half the arc behind the player, the swing's time and the throw. */
export const TAIL = { reach: 48, half: 1.3, swing: 0.18, force: 620, crash: 0.6 } as const

/**
 * Sweeps the arc behind the player (the foes chasing them) and flings every
 * foe it catches away; a flung foe hurts the ones it crashes into.
 */
export const dragonTail: Cast = (g, s) => {
  const p = g.player
  const back = dm.atan2(-p.facing.y, -p.facing.x)
  const reach = TAIL.reach * s.area
  const side = p.facing.x < 0 ? -1 : 1
  // The swing spins around the player (radius 0) so the art can read its angle.
  const swing = spawnAttack(g, {
    move: 'dragonTail', type: 'dragon', visual: 'dragonTail', x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: reach }, motion: { kind: 'orbit', angle: back - side * TAIL.half, spin: (side * 2 * TAIL.half) / TAIL.swing, radius: 0 },
    damage: s.damage, ttl: TAIL.swing + 0.12, activeFrom: Infinity, status: s.status,
  })
  for (const e of inArc(g.enemies, { x: p.x, y: p.y - 8 }, back, TAIL.half, reach)) {
    damageEnemy(g, e, swing)
    if (e.dying < 0 && !e.boss) throwFoe(g, e, dm.atan2(e.y - p.y, e.x - p.x), TAIL.force, s.damage * TAIL.crash, 'dragonTail')
  }
  sound(g, 'dragonTail')
}

/* ---------------- Sheer Cold ---------------- */

/** Sheer Cold's ring: how far it spreads (× area). */
export const SHEER_COLD = { r: 80 } as const

/**
 * An icy ring spreads from the player: it barely scratches, slows, and
 * shatters every regular foe it leaves under its execute share (`SHEER_COLD_EXECUTE`).
 */
export const sheerCold: Cast = (g, s, owned) => {
  const p = g.player
  spawnAttack(g, {
    move: 'sheerCold', type: 'ice', visual: 'sheerCold', x: p.x, y: p.y,
    shape: { kind: 'circle', r: 8 }, motion: { kind: 'follow', ox: 0, oy: -4 },
    damage: s.damage, knockback: s.knockback, ttl: s.duration, grow: (SHEER_COLD.r * s.area - 8) / s.duration,
    status: s.status, execute: atLevel(SHEER_COLD_EXECUTE, owned.level),
  })
  sound(g, 'sheerCold')
}
