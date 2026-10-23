import { fromAngle, TAU } from '../engine/math'
import { spawnAttack } from './spawn'
import type { CastStats, Look, MoveId } from './moves'
import type { DamageSource, Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'
import { wardOpens } from './kitRules'

/**
 * The move kit: building blocks for new move mechanics. A move stays a data
 * entry in `MOVES` whose `fire(g, s, owned)` spawns hitboxes; this file and the
 * Attack/Player fields below are what it can build with. Everything is
 * deterministic (seeded rng, `dmath`) and costs nothing when unused.
 *
 * ON ANY ATTACK (fields of `spawnAttack`'s init, all off by default):
 * - `bonus: [{ when: 'burned', mult: 1.5 }]` multiplies damage on foes that
 *   match (`BonusWhen` in `kitRules.ts`: afflicted, poisoned, burned,
 *   paralyzed, asleep, frozen, marked, chilled, lowHp, flying, elite, boss). Hex uses it.
 * - `execute: 0.15` makes regular foes left at or under 15% HP faint outright,
 *   shattering (a `shatter` event). Bosses never.
 * - `drain: 0.3` heals 30% of the damage dealt, from a budget of 4% max HP per
 *   second (`DRAIN_RATE`); the difficulty's healing applies (Nightmare halves).
 * - `pull: 120` drags the foes it touches toward its center at 120 px/s ÷ mass
 *   (bosses ×0.25 more), never past it. Pair it with `hitInterval` for a vortex.
 * - `status: { kind, chance, duration, power }` with the new kinds in
 *   `status.ts`: `sleep` (a hit wakes it), `freeze` (the next hit ×2 and breaks
 *   it), `mark` (power = +damage per stack, up to 3), `confuse` (wanders and
 *   bumps other foes; bosses immune), `seed` (DoT that heals you and jumps on
 *   death). Use `s.status` in `fire` so items scale it, like every move.
 *
 * MOTIONS (`motion` of an attack):
 * - `{ kind: 'return', vx, vy, out, speed }`: out for `out` s, back to the
 *   player wherever they are, hitting on both legs. `returnShot` below.
 * - `{ kind: 'wander', heading, speed, turn, leash }`: a seeded random walk
 *   leashed to the player. `wanderer` below.
 * - A sweep is a line of `orbit` segments sharing one hit list: `sweep` below.
 * - A delayed strike is a dormant hitbox (`age < 0`) under a `telegraph` ring: `strike`.
 *
 * PER-MOVE STATE (`OwnedMove`, the third argument of `fire`):
 * - `stacks?: StackRule` on the MoveDef, e.g. `{ grow: 'hit', max: 10, reset: 'cast' }`:
 *   grows on the move's hits, its casts, the player getting hurt or each second
 *   standing still; resets on cast, hurt or walking. Read `stacksOf(owned)`.
 * - `walkedSince(owned, g.player)`: px walked since this move last fired.
 * - `took(owned, 4, 0)`: whether it took the first branch of its Lv 4 fork,
 *   for a branch that changes the move itself instead of adding a mod.
 *
 * PLAYER READINGS for cast-time scaling: `hpFraction(p)`, `p.stats.speed`,
 * `p.stats.armor`, `p.level`, `p.items.length`, `p.still` (seconds standing
 * still), `walkedSince(owned, p)`; shape them with `scaleBy(reading, k, max)`.
 *
 * PLAYER WINDOWS, with hooks on the MoveDef:
 * - `guard(g, move, seconds)`: the next hit is negated and calls the move's
 *   `onGuard(g, s, owned, from?)` (Counter's wave, Protect's reflect).
 * - `burrow(g, move, seconds)`: invulnerable and lost to the foes (they
 *   wander) until it ends, then the move's `emerge(g, s, owned)` (Dig, Fly).
 * Both return false when the window doesn't open: windows from different
 * moves don't chain (`wardOpens`), so a move whose point is the window bails.
 *
 * FOES: `throwFoe(e, angle, force, damage, move)` hurls a foe that hurts
 * every foe it crashes into while its knockback is fast (Circle Throw).
 *
 * LOADOUT: at most one manual move (`manual: true`) can be learned (`learnable`).
 */

/**
 * Return: a hitbox that flies `reach` px toward `angle`, then homes back to the
 * player at the same speed and vanishes in their hands (Shadow Bone, boomerangs).
 * Its hit list clears at the turn, so a foe can take both legs.
 */
export const returnShot = (g: Game, s: CastStats, look: Look, angle: number, reach: number, r = 6) => {
  const p = g.player
  const speed = Math.max(60, s.speed)
  const v = fromAngle(angle, speed)
  return spawnAttack(g, {
    ...look, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: r * s.area }, motion: { kind: 'return', vx: v.x, vy: v.y, out: reach / speed, speed },
    damage: s.damage, knockback: s.knockback, pierce: s.pierce, ttl: 6, status: s.status,
  })
}

/**
 * Sweep: a beam of `segments` circles from `inner` to `length` px off the
 * player, rotating from `from` through `arc` radians (negative turns the
 * other way) in `time` seconds. `r` is the circles' base radius: the sweep
 * scales it by area itself (pass `length` already scaled). The segments share one hit list, so a foe is
 * hit once per `hitInterval` by the whole beam however many segments cross it.
 */
export const sweep = (
  g: Game, s: CastStats, look: Look,
  o: { from: number; arc: number; time: number; length: number; segments: number; r: number; inner?: number; hitInterval?: number },
) => {
  const p = g.player
  const hits = new Map<number, number>()
  const inner = o.inner ?? 12
  const spin = o.arc / o.time
  for (let i = 0; i < o.segments; i++) {
    const radius = inner + ((o.length - inner) * i) / Math.max(1, o.segments - 1)
    spawnAttack(g, {
      ...look, x: p.x + dm.cos(o.from) * radius, y: p.y - 8 + dm.sin(o.from) * radius,
      shape: { kind: 'circle', r: o.r * s.area }, motion: { kind: 'orbit', angle: o.from, spin, radius },
      damage: s.damage, knockback: s.knockback, hitInterval: o.hitInterval ?? Infinity, hits, ttl: o.time, status: s.status,
    })
  }
}

/** Wanderer: a hitbox ambling at random around the player for `ttl` seconds (Fairy Wind motes, Ominous Wind wisps). */
export const wanderer = (g: Game, s: CastStats, look: Look, o: { r: number; speed: number; ttl: number; leash?: number; turn?: number; hitInterval?: number }) => {
  const p = g.player
  return spawnAttack(g, {
    ...look, x: p.x, y: p.y - 8,
    shape: { kind: 'circle', r: o.r * s.area },
    motion: { kind: 'wander', heading: g.rng() * TAU, speed: o.speed, turn: o.turn ?? 5, leash: o.leash ?? 90 },
    damage: s.damage, knockback: s.knockback, hitInterval: o.hitInterval ?? 0.5, ttl: o.ttl, status: s.status,
  })
}

/** How long a delayed strike hurts once it lands. */
export const STRIKE_WINDOW = 0.08

/**
 * Delayed strike: a `telegraph` ring warns on the ground at (x, y) for `delay`
 * seconds, then the hit lands there (Future Sight, Doom Desire, a meteor). The
 * returned hitbox is dormant until then; tweak it (bonus, execute) before it lands.
 * Its visual plays for `linger` seconds after the impact.
 */
export const strike = (g: Game, s: CastStats, look: Look, x: number, y: number, r: number, delay: number, linger = 0.3) => {
  spawnAttack(g, {
    ...look, visual: 'telegraph', x, y,
    shape: { kind: 'circle', r }, motion: { kind: 'static' },
    damage: 0, ttl: delay, activeFrom: Infinity,
  })
  return spawnAttack(g, {
    ...look, x, y,
    shape: { kind: 'circle', r }, motion: { kind: 'static' },
    damage: s.damage, knockback: s.knockback, status: s.status,
    age: -delay, ttl: linger, activeUntil: STRIKE_WINDOW,
  })
}

/**
 * Trailer: for `duration` seconds the player drops a patch every `every` px
 * walked (not while standing), each lasting `ttl` and hitting every
 * `hitInterval` for `share` of the move's damage, with its status (Flame Charge's fire).
 */
export const trailer = (g: Game, s: CastStats, look: Look, o: { every: number; r: number; ttl: number; hitInterval?: number; share?: number; duration: number }) => {
  const p = g.player
  return spawnAttack(g, {
    ...look, x: p.x, y: p.y,
    shape: { kind: 'circle', r: 1 }, motion: { kind: 'follow', ox: 0, oy: 0 },
    damage: s.damage, status: s.status, ttl: o.duration, activeFrom: Infinity,
    trailer: { every: o.every, acc: 0, walked: p.walked, visual: look.visual, r: o.r * s.area, ttl: o.ttl, hitInterval: o.hitInterval ?? 0.4, share: o.share ?? 1 },
  })
}

/** The move whose immunity window is open on the player now (a burrow, else a guard), or null. */
export const wardHolder = (p: Player) => p.hidden?.move ?? p.guard?.move ?? null

/** Stamps the player's ward: `move`'s window stands at `now` (`updateMoveKit` keeps it fresh while it's open). */
export const stampWard = (p: Player, move: MoveId, now: number) => {
  if (p.ward) {
    p.ward.move = move
    p.ward.at = now
  } else p.ward = { move, at: now }
}

/** Claims the player's immunity for `move`, unless another move's window holds it or closed too recently (`wardOpens`). */
const claimWard = (g: Game, move: MoveId) => {
  const p = g.player
  if (!wardOpens(p.ward, wardHolder(p), move, g.now)) return false
  stampWard(p, move, g.now)
  return true
}

/** Opens a guard window: the next hit within `seconds` is negated and calls `move`'s `onGuard`. False when it doesn't open. */
export const guard = (g: Game, move: MoveId, seconds: number) => {
  if (!claimWard(g, move)) return false
  g.player.guard = { left: seconds, move }
  return true
}

/** Burrows the player for `seconds`: no damage, foes lose track; then `move`'s `emerge` runs. False when it doesn't open. */
export const burrow = (g: Game, move: MoveId, seconds: number) => {
  if (!claimWard(g, move)) return false
  g.player.hidden = { left: seconds, move }
  return true
}

/**
 * Hurls `e` toward `angle` with `force` (÷ mass, like knockback). While it flies
 * fast it deals `damage` to each foe it crashes into, once per throw, credited to `move` of the player at slot `by`.
 */
export const throwFoe = (e: Enemy, angle: number, force: number, damage: number, move: DamageSource, by: number) => {
  const v = fromAngle(angle, force / e.mass)
  e.kx += v.x
  e.ky += v.y
  e.thrown = { damage, move, hit: new Set([e.id]), by }
}

export { hpFraction, scaleBy, stacksOf, took, walkedSince } from './kitRules'
