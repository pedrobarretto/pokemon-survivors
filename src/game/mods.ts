import { TAU } from '../engine/math'
import { range } from '../engine/rng'
import { TYPE_COLORS } from '../data/types'
import { burst, shakeScreen } from './effects'
import { chainTargets } from './moveRules'
import { bonusApplies, type DamageBonus } from './kitRules'
import { dropPatch, spawnAttack } from './spawn'
import type { CastStats } from './moves'
import type { Attack, Enemy, Game, Motion } from './types'
import * as dm from '../engine/dmath'

/**
 * Behavior mods: what a fork branch (`MoveDef.upgrades`) changes in HOW a move
 * plays, on top of its stats. `moveStats` folds the mods of the branches taken
 * into `CastStats.mods` (a bitmask); `updateMoves` stamps them on every hitbox
 * the cast spawns (`Game.castMods`, read by `spawnAttack`) and reshapes the
 * cast right after `fire` (`afterCast`), so the moves' own fire functions never
 * need to know. Hooks: `modHit` (a hit landed), `modKill` (that hit fainted the
 * foe), `modTick` (every tick of a modded hitbox). Hitboxes the mods spawn
 * carry no mods, so nothing chains forever. Deterministic: `g.rng` and `dmath`.
 */

/** Hitbox shapes a mod makes sense on, so a branch never gets a mod that does nothing. */
export type Archetype = 'projectile' | 'orbit' | 'strike'

type ModDef = { bit: number; fits: readonly Archetype[] }

export const MODS = {
  /** A projectile splits in two on its first hit. */
  split: { bit: 1 << 0, fits: ['projectile'] },
  /** A projectile ricochets to the nearest foe it hasn't hit, `MOD.bounce.times` times. */
  bounce: { bit: 1 << 1, fits: ['projectile'] },
  /** Straight shots fly out and come back, hitting on the way back too. */
  boomerang: { bit: 1 << 2, fits: ['projectile'] },
  /** Straight shots home in on the nearest foe. */
  seek: { bit: 1 << 3, fits: ['projectile'] },
  /** Leaves lingering ground of the move's type (and status) along its path, or where it lands. */
  trail: { bit: 1 << 4, fits: ['projectile', 'orbit', 'strike'] },
  /** A foe it faints blows up, hurting the ones around it. */
  burstOnKill: { bit: 1 << 5, fits: ['projectile', 'orbit', 'strike'] },
  /** The move casts again `MOD.echo.delay` s later, at half damage. */
  echo: { bit: 1 << 6, fits: ['projectile', 'orbit', 'strike'] },
  /** Every shot also flies the opposite way. */
  rear: { bit: 1 << 7, fits: ['projectile'] },
  /** Orbiters get a second, wider ring spinning the other way. */
  twin: { bit: 1 << 8, fits: ['orbit'] },
  /** A hit arcs on to nearby foes. */
  arc: { bit: 1 << 9, fits: ['projectile', 'orbit', 'strike'] },
  /** Projectiles circle the player instead of flying off: a ring that keeps turning cast after cast. */
  halo: { bit: 1 << 10, fits: ['projectile'] },
  /** Its hits heal a share of the damage dealt (the kit's drain budget caps it). */
  drain: { bit: 1 << 11, fits: ['projectile', 'orbit', 'strike'] },
  /** Regular foes it leaves at or under `MOD.execute.share` of their HP faint outright. */
  execute: { bit: 1 << 12, fits: ['projectile', 'orbit', 'strike'] },
  /** Its hitboxes drag the foes they touch toward their center. */
  vortex: { bit: 1 << 13, fits: ['orbit', 'strike'] },
  /** Hits elites and bosses harder. */
  hunter: { bit: 1 << 14, fits: ['projectile', 'orbit', 'strike'] },
  /** Hits foes with a status condition harder. */
  cruel: { bit: 1 << 16, fits: ['projectile', 'orbit', 'strike'] },
} as const satisfies Record<string, ModDef>

export type ModId = keyof typeof MODS

export const MOD_IDS = Object.keys(MODS) as ModId[]

/** Not a mod: marks the hitboxes of an Echo re-cast, so they shimmer. */
export const ECHOED = 1 << 15

/** Tuning of each mod. */
export const MOD = {
  split: { angle: 0.6, damage: 0.55, ttl: 0.55 },
  bounce: { times: 2, range: 130 },
  boomerang: { pull: 1.8, ttl: 1.35, hitInterval: 0.5 },
  seek: { turn: 5, range: 260 },
  trail: { gap: 15, r: 9, ttl: 1.4, damage: 0.3, hitInterval: 0.5 },
  burstOnKill: { r: 26, damage: 0.6, ttl: 0.34 },
  echo: { delay: 0.3, damage: 0.5 },
  twin: { radius: 1.65, spin: -0.8 },
  arc: { jumps: 2, range: 72, damage: 0.5, perAttack: 3 },
  halo: { radius: 38, spin: 3.6, hitInterval: 0.45 },
  drain: { share: 0.2 },
  execute: { share: 0.12 },
  vortex: { pull: 90 },
  hunter: { mult: 1.5 },
  cruel: { mult: 1.35 },
} as const

// Tagged (`stamp`), so a hitbox tells it already took them by value: a copy restored from a snapshot holds equal entries, not these objects.
const HUNTER: readonly DamageBonus[] = [{ when: 'elite', mult: MOD.hunter.mult, stamp: 'hunter' }, { when: 'boss', mult: MOD.hunter.mult, stamp: 'hunter' }]
const CRUEL: DamageBonus = { when: 'afflicted', mult: MOD.cruel.mult, stamp: 'cruel' }

/** Whether a hitbox's bonuses already hold the mod's own (`stamp`). */
const stamped = (a: Attack, stamp: DamageBonus['stamp']) => a.bonus.some((b) => b.stamp === stamp)

/**
 * Puts the hit-time mods (Drain, Execute, Vortex, Hunter, Cruel) on a hitbox's
 * own kit fields (`spawnAttack` calls it for every modded hitbox). Never
 * lowers what the move set itself, and adds a bonus only once, so calling it
 * again on a refreshed hitbox (an aura, the gears) changes nothing.
 */
export const stampMods = (a: Attack) => {
  const bits = a.mod?.bits ?? 0
  if (bits & MODS.drain.bit) a.drain = Math.max(a.drain, MOD.drain.share)
  if (bits & MODS.execute.bit) a.execute = Math.max(a.execute, MOD.execute.share)
  if (bits & MODS.vortex.bit) a.pull = Math.max(a.pull, MOD.vortex.pull)
  if (bits & MODS.hunter.bit && !stamped(a, 'hunter')) a.bonus = [...a.bonus, ...HUNTER]
  if (bits & MODS.cruel.bit && !stamped(a, 'cruel')) a.bonus = [...a.bonus, CRUEL]
}

/**
 * A long-lived hitbox a cast refreshes instead of spawning anew (Whirlpool's
 * aura, Flame Wheel, Gyro Ball's gears) takes the mods of the cast refreshing it,
 * so a branch picked after it appeared applies at once.
 */
export const refreshMods = (g: Game, a: Attack) => {
  if (g.player.castMods === 0 || (a.mod && a.mod.bits === g.player.castMods)) return
  a.mod = createModState(g.player.castMods)
  stampMods(a)
}

/**
 * What a hitbox spawned later on behalf of another (a Thrash bite, a bubble's
 * pop, a turret's shot, a mine's blast, a trailer's patch) takes from it: its
 * mods, minus `drop`, so the branch reaches the hits that actually land.
 */
export const inheritMods = (a: Attack, drop: readonly ModId[] = []): Pick<Attack, 'mod'> => ({
  mod: a.mod && createModState(a.mod.bits & ~modBits(drop) & ~ECHOED),
})

/** Per-hitbox state of its mods. `tx`/`ty`: where its trail last dropped ground (NaN: not yet). */
export type ModState = { bits: number; bounces: number; arcs: number; tx: number; ty: number }

export const modBits = (ids: readonly ModId[] = []) => ids.reduce((bits, id) => bits | MODS[id].bit, 0)

export const hasMod = (bits: number, id: ModId) => (bits & MODS[id].bit) !== 0

/** The mods in a bitmask, in table order. */
export const modsOf = (bits: number) => MOD_IDS.filter((id) => hasMod(bits, id))

/** State for a hitbox spawned with `bits`, or null when it has none (see `spawnAttack`). */
export const createModState = (bits: number): ModState | null =>
  bits === 0 ? null : { bits, bounces: MOD.bounce.times, arcs: MOD.arc.perAttack, tx: NaN, ty: NaN }

const has = (a: Attack, id: ModId) => a.mod !== null && hasMod(a.mod.bits, id)

/** A hitbox's velocity, for the motions that have one. */
const velocity = (m: Motion) =>
  m.kind === 'linear' || m.kind === 'homing' || m.kind === 'boomerang' || m.kind === 'drift' ? { x: m.vx, y: m.vy } : null

/** Whether a hitbox flies (the projectile archetype). */
const flies = (a: Attack) => velocity(a.motion) !== null && a.motion.kind !== 'lunge'

/** A copy of a hitbox under a fresh id, with its own hits, motion and mod state. */
const clone = (g: Game, a: Attack, motion: Motion) => {
  const { id: _id, ...rest } = a
  return spawnAttack(g, { ...rest, motion, hits: new Map(), from: { ...a.from }, mod: a.mod && { ...a.mod } })
}

const mirrored = (m: Motion): Motion => {
  switch (m.kind) {
    case 'linear':
      return { ...m, vx: -m.vx, vy: -m.vy }
    case 'homing':
      return { ...m, vx: -m.vx, vy: -m.vy, target: null }
    case 'boomerang':
      return { ...m, vx: -m.vx, vy: -m.vy, ax: -m.ax, ay: -m.ay }
    case 'drift':
      return { ...m, vx: -m.vx, vy: -m.vy }
    default:
      return m
  }
}

/**
 * Reshapes the hitboxes one cast spawned (from index `from` on), right after
 * `fire`: Seek and Boomerang change how shots fly, Halo puts them in orbit,
 * Rear mirrors them, Twin adds the outer ring.
 */
export const afterCast = (g: Game, from: number, s: CastStats) => {
  const bits = s.mods
  if (bits === 0) return
  const end = g.attacks.length
  const cast: Attack[] = []
  for (let i = from; i < end; i++) if (g.attacks[i]!.mod) cast.push(g.attacks[i]!)
  const p = g.player
  cast.forEach((a, i) => {
    const m = a.motion
    if (hasMod(bits, 'halo') && flies(a)) {
      const spin = MOD.halo.spin
      // An echo's ring sits between the stars of the ring it echoes.
      const offset = bits & ECHOED ? Math.PI / cast.length : 0
      a.motion = { kind: 'orbit', angle: g.time * spin + (i / cast.length) * TAU + offset, spin, radius: MOD.halo.radius * s.area }
      a.x = p.x + dm.cos(a.motion.angle) * a.motion.radius
      a.y = p.y - 8 + dm.sin(a.motion.angle) * a.motion.radius
      // One ring hands over to the next without a gap: the angles follow the clock.
      a.ttl = s.cooldown + 0.02
      a.age = 0
      a.pierce = Infinity
      a.hitInterval = MOD.halo.hitInterval
      return
    }
    if (m.kind === 'linear' && hasMod(bits, 'seek')) {
      a.motion = { kind: 'homing', vx: m.vx, vy: m.vy, speed: dm.hypot(m.vx, m.vy), turn: MOD.seek.turn, target: null }
    } else if (m.kind === 'linear' && hasMod(bits, 'boomerang')) {
      a.motion = { kind: 'boomerang', vx: m.vx, vy: m.vy, ax: -m.vx * MOD.boomerang.pull, ay: -m.vy * MOD.boomerang.pull }
      a.ttl = Math.max(a.ttl, MOD.boomerang.ttl)
      a.pierce = Infinity
      a.hitInterval = MOD.boomerang.hitInterval
    }
  })
  if (hasMod(bits, 'rear')) for (const a of cast) if (flies(a)) clone(g, a, mirrored(a.motion))
  if (hasMod(bits, 'twin')) {
    const rings = cast.filter((a) => a.motion.kind === 'orbit')
    rings.forEach((a) => {
      const m = a.motion
      if (m.kind !== 'orbit') return
      clone(g, a, { kind: 'orbit', angle: m.angle + Math.PI / rings.length, spin: m.spin * MOD.twin.spin, radius: m.radius * MOD.twin.radius })
    })
  }
}

/** Nearest living foe to the hitbox that it hasn't hit yet. */
const nextFoe = (g: Game, a: Attack, maxDist: number) => {
  let best: Enemy | null = null
  let bestD = maxDist * maxDist
  for (const e of g.enemies) {
    if (e.dying >= 0 || a.hits.has(e.id)) continue
    const d = dm.sq(e.x - a.x) + dm.sq(e.y - e.radius - a.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

const typeColors = (a: Attack) => [TYPE_COLORS[a.type], '#ffffff']

/** Split: two smaller shots fan out from the hit, flying on the parent's way. */
const split = (g: Game, a: Attack, e: Enemy) => {
  const v = velocity(a.motion)
  if (!v) return
  a.mod!.bits &= ~MODS.split.bit
  const speed = Math.max(120, dm.hypot(v.x, v.y))
  const heading = dm.atan2(v.y, v.x)
  const r = a.shape.kind === 'circle' ? a.shape.r * 0.8 : 4
  for (const side of [-1, 1]) {
    const angle = heading + side * MOD.split.angle
    const hits = new Map([[e.id, Infinity]])
    spawnAttack(g, {
      move: a.move, type: a.type, visual: a.visual, x: a.x, y: a.y,
      shape: { kind: 'circle', r }, motion: { kind: 'linear', vx: dm.cos(angle) * speed, vy: dm.sin(angle) * speed },
      damage: a.damage * MOD.split.damage, knockback: a.knockback * 0.5, pierce: 1, status: a.status, ttl: MOD.split.ttl, hits, mod: null,
    })
  }
  burst(g, a.x, a.y, { colors: ['#ffffff', ...typeColors(a)], count: 6, speed: 60, ttl: 0.22 })
}

/** Bounce: a shot about to be spent turns towards the next foe instead. */
const bounce = (g: Game, a: Attack) => {
  const mod = a.mod!
  if (mod.bounces <= 0 || a.pierce > 1) return
  const target = nextFoe(g, a, MOD.bounce.range)
  const v = velocity(a.motion)
  if (!target || !v) return
  mod.bounces--
  a.pierce++
  const speed = Math.max(140, dm.hypot(v.x, v.y))
  const dx = target.x - a.x
  const dy = target.y - target.radius - a.y
  const len = dm.hypot(dx, dy) || 1
  a.motion = a.motion.kind === 'homing' ? { ...a.motion, vx: (dx / len) * speed, vy: (dy / len) * speed, target } : { kind: 'linear', vx: (dx / len) * speed, vy: (dy / len) * speed }
  a.ttl = Math.max(a.ttl, a.age + 1.2)
  burst(g, a.x, a.y, { colors: ['#ffffff', '#fff8a0', TYPE_COLORS[a.type]], count: 7, speed: 80, ttl: 0.2 })
}

/** Arc: jagged sparks of the move's type jump from the foe hit to the nearest others. */
const arc = (g: Game, a: Attack, e: Enemy) => {
  const mod = a.mod!
  if (mod.arcs <= 0) return
  mod.arcs--
  const targets = chainTargets(g.enemies, e, MOD.arc.jumps + 1, 1, MOD.arc.range)
  let from = { x: e.x, y: e.y - e.radius }
  for (const t of targets) {
    if (t === e) continue
    const to = { x: t.x, y: t.y - t.radius }
    spawnAttack(g, {
      move: a.move, type: a.type, visual: 'modArc', ...to, from,
      shape: { kind: 'circle', r: 3 }, motion: { kind: 'static' },
      damage: a.damage * MOD.arc.damage, status: a.status, ttl: 0.26, activeUntil: 0.02,
      hits: new Map([[e.id, Infinity]]), mod: null,
    })
    from = to
  }
}

/** Called after a modded hitbox hits `e` (`collide`). */
export const modHit = (g: Game, a: Attack, e: Enemy) => {
  const bits = a.mod!.bits
  if (bits & MODS.split.bit) split(g, a, e)
  if (bits & MODS.bounce.bit) bounce(g, a)
  if (bits & MODS.arc.bit) arc(g, a, e)
  // Hunter and Cruel flash when their bonus landed: gold on a big foe, violet on an afflicted one.
  if (bits & MODS.hunter.bit && (e.elite || e.boss)) burst(g, e.x, e.y - e.radius * 2, { colors: ['#ffffff', '#f8d030', '#f89800'], count: 6, speed: 70, ttl: 0.3, gravity: -40 })
  if (bits & MODS.cruel.bit && bonusApplies('afflicted', e)) burst(g, e.x, e.y - e.radius, { colors: ['#f8c8f8', '#a040d0', '#582878'], count: 4, speed: 55, ttl: 0.28 })
}

/** Called when a hit from `a` faints `e` (`damageEnemy`): Burst blows the foe up. */
export const modKill = (g: Game, e: Enemy, a: Attack) => {
  if (!has(a, 'burstOnKill')) return
  spawnAttack(g, {
    move: a.move, type: a.type, visual: 'modBurst', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: MOD.burstOnKill.r }, motion: { kind: 'static' },
    damage: a.damage * MOD.burstOnKill.damage, knockback: 60, status: a.status,
    ttl: MOD.burstOnKill.ttl, activeUntil: 0.05, hits: new Map([[e.id, Infinity]]), mod: null,
  })
  shakeScreen(g, 1.5)
}

/** Drops a patch of lingering ground at the hitbox. */
const dropGround = (g: Game, a: Attack) => {
  const mod = a.mod!
  mod.tx = a.x
  mod.ty = a.y
  dropPatch(g, {
    move: a.move, type: a.type, visual: 'modTrail', x: a.x, y: a.y + 4,
    shape: { kind: 'circle', r: MOD.trail.r }, motion: { kind: 'static' },
    damage: a.damage * MOD.trail.damage, status: a.status, ttl: MOD.trail.ttl, hitInterval: MOD.trail.hitInterval,
    flip: a.id % 2 === 0, mod: null,
  })
}

/** Every tick of a modded hitbox (`updateAttacks`): Trail drops ground, an Echo shimmers. */
export const modTick = (g: Game, a: Attack) => {
  const mod = a.mod!
  if (mod.bits & ECHOED && g.rng() < 0.35) {
    g.particles.push({
      x: a.x + range(g.rng, -4, 4), y: a.y + range(g.rng, -4, 4), vx: 0, vy: -14,
      life: 0, ttl: 0.3, color: g.rng() < 0.5 ? '#ffffff' : TYPE_COLORS[a.type], size: 1, gravity: 0, drag: 2,
    })
  }
  // Drain sheds green motes; Vortex draws specks in from its rim.
  if (mod.bits & MODS.drain.bit && g.rng() < 0.12) {
    g.particles.push({
      x: a.x + range(g.rng, -5, 5), y: a.y + range(g.rng, -5, 5), vx: 0, vy: -20,
      life: 0, ttl: 0.4, color: g.rng() < 0.5 ? '#78f878' : '#d8f8c8', size: 1, gravity: -20, drag: 1,
    })
  }
  if (mod.bits & MODS.vortex.bit && a.age >= 0 && g.rng() < 0.45) {
    const r = (a.shape.kind === 'circle' ? a.shape.r : a.shape.w / 2) + 4
    const angle = range(g.rng, 0, TAU)
    const cos = dm.cos(angle)
    const sin = dm.sin(angle)
    // Inward and a little sideways: a swirl.
    g.particles.push({
      x: a.x + cos * r, y: a.y + sin * r * 0.7, vx: (-cos + sin * 0.6) * r * 2.2, vy: (-sin - cos * 0.6) * r * 1.5,
      life: 0, ttl: 0.4, color: g.rng() < 0.5 ? '#ffffff' : TYPE_COLORS[a.type], size: 1, gravity: 0, drag: 3,
    })
  }
  if (!(mod.bits & MODS.trail.bit)) return
  if (a.motion.kind === 'static' || a.motion.kind === 'follow') {
    // Strikes leave their ground once, where they land.
    if (Number.isNaN(mod.tx) && a.age >= (a.activeFrom === Infinity ? 0 : a.activeFrom)) dropGround(g, a)
    return
  }
  if (Number.isNaN(mod.tx)) {
    mod.tx = a.x
    mod.ty = a.y
    return
  }
  if (dm.sq(a.x - mod.tx) + dm.sq(a.y - mod.ty) >= MOD.trail.gap * MOD.trail.gap) dropGround(g, a)
}

/** The echo of a cast: half damage, no echo of its own, and it shimmers. */
export const echoStats = (s: CastStats): CastStats => ({ ...s, damage: s.damage * MOD.echo.damage, mods: (s.mods & ~MODS.echo.bit) | ECHOED })
