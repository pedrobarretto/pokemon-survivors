import * as dm from '../engine/dmath'
import { ownAttack } from './players'
import { burst, shakeScreen } from './effects'
import { AQUA, erupt, HEAT, LIFT, SNOW, TERRAIN } from './legendaryMoves2'
import { throwFoe } from './moveKit'
import { inheritMods } from './mods'
import { moveStats, type CastStats, type MoveId } from './moves'
import { isAlive } from './queries'
import { spawnAttack } from './spawn'
import type { Attack, Enemy, Game } from './types'

/**
 * Per-tick side of the second batch of legendary moves (`legendaryMoves2.ts`),
 * run by `updateLegendary` before the moves cast: Snowscape's crystals
 * shatter, Electric Terrain's field drops its bolts, Burning Bulwark's shell
 * erupts when it runs out, Telekinesis hurls the foes it held, Aqua Ring
 * widens out from the player and the growing domes stop at their size.
 * A `tier` of 1 marks a crystal, shell or lift done (the field keeps its
 * bolts per beat there).
 */

/** The cast stats of `move` now (player boosts included), or null once it's no longer owned. */
const statsOf = (g: Game, move: MoveId): CastStats | null => {
  const owned = g.player.moves.find((m) => m.id === move)
  return owned ? moveStats(owned.id, owned.level, g.player.stats, owned.path) : null
}

/** Runs `spawn` with `s`'s fork mods stamped on what it spawns, like a cast. */
const withMods = (g: Game, s: CastStats, spawn: () => void) => {
  const before = g.player.castMods
  g.player.castMods = s.mods
  spawn()
  g.player.castMods = before
}

/** Whether a hitbox lives its last moments this tick. */
const ending = (a: Attack) => a.age >= a.ttl - 0.05

/** A crystal shatters: a burst of ice shards that can freeze. */
const shatter = (g: Game, a: Attack) => {
  const s = statsOf(g, 'snowscape')
  spawnAttack(g, {
    move: a.move, type: a.type, visual: 'snowShatter', x: a.x, y: a.y,
    shape: { kind: 'circle', r: SNOW.burst * (a.shape.kind === 'circle' ? a.shape.r / SNOW.r : 1) }, motion: { kind: 'static' },
    damage: a.damage / SNOW.chill, knockback: s?.knockback ?? 60, status: s?.status ?? null, ttl: 0.4, activeUntil: 0.06,
    flip: a.flip, ...inheritMods(a),
  })
  a.tier = 1
  a.ttl = a.age
}

/** Picks up to `count` foes inside the field at random (seeded), none twice. */
const boltTargets = (g: Game, field: Attack, count: number) => {
  const r = field.shape.kind === 'circle' ? field.shape.r : TERRAIN.r
  const inside: Enemy[] = []
  for (const e of g.enemies) if (isAlive(e) && dm.sq(e.x - field.x) + dm.sq((e.y - field.y) / 0.7) <= r * r) inside.push(e)
  const picked: Enemy[] = []
  while (picked.length < count && inside.length > 0) picked.push(inside.splice(Math.floor(g.rng() * inside.length), 1)[0]!)
  return picked
}

/** The field's beat: a bolt on a foe inside it (or on the bare ground, for the look). */
const terrainBeat = (g: Game, field: Attack) => {
  field.memo += TERRAIN.beat
  const r = field.shape.kind === 'circle' ? field.shape.r : TERRAIN.r
  const targets = boltTargets(g, field, Math.max(1, field.tier))
  const hitR = TERRAIN.bolt * (r / TERRAIN.r)
  if (targets.length === 0) {
    const a = g.rng() * Math.PI * 2
    const d = g.rng() * r * 0.8
    spawnAttack(g, {
      move: field.move, type: field.type, visual: 'terrainBolt', x: field.x + dm.cos(a) * d, y: field.y + dm.sin(a) * d * 0.7,
      shape: { kind: 'circle', r: hitR }, motion: { kind: 'static' }, damage: 0, ttl: 0.3, activeFrom: Infinity,
    })
    return
  }
  for (const e of targets) {
    spawnAttack(g, {
      move: field.move, type: field.type, visual: 'terrainBolt', x: e.x, y: e.y,
      shape: { kind: 'circle', r: hitR }, motion: { kind: 'static' },
      damage: field.damage, knockback: field.knockback, status: field.status, ttl: 0.3, activeUntil: 0.05,
      flip: g.rng() < 0.5, ...inheritMods(field),
    })
  }
}

/** Telekinesis lets go: the held foe is hurled away from the player into the crowd, and slammed where it was. */
const hurl = (g: Game, a: Attack) => {
  a.tier = 1
  if (a.motion.kind !== 'tether') return
  const e = a.motion.target
  if (!isAlive(e)) return
  const p = g.player
  const angle = dm.atan2(e.y - p.y, e.x - p.x)
  if (!e.boss) throwFoe(g, e, angle, LIFT.force * e.mass, a.memo * LIFT.crash, 'telekinesis')
  const slam = spawnAttack(g, {
    move: a.move, type: a.type, visual: 'psySlam', x: e.x, y: e.y - e.radius,
    shape: { kind: 'circle', r: Math.max(LIFT.slam, e.radius + 6) }, motion: { kind: 'static' },
    damage: a.memo, knockback: 0, ttl: 0.35, activeUntil: 0.05, memo: angle, ...inheritMods(a),
  })
  // What it can't throw, it crushes.
  slam.bonus = [...slam.bonus, { when: 'boss', mult: LIFT.boss }]
  burst(g, e.x, e.y - e.radius, { colors: ['#f0c8ff', '#b050d8', '#ffffff'], count: 8, speed: 100, ttl: 0.35 })
}

export const updateLegendary2 = (g: Game) => {
  for (const a of g.attacks) {
    // Run as each player: only their own hitboxes (a teammate's shell, field or hold acts as them).
    if (a.age < 0 || a.move === 'special' || a.move === 'ability' || !ownAttack(g, a)) continue
    switch (a.visual) {
      case 'snowCrystal':
        if (a.tier === 0 && a.age >= a.memo) shatter(g, a)
        break
      case 'terrainField':
        while (a.age >= a.memo && a.memo < a.ttl) terrainBeat(g, a)
        break
      case 'bulwarkShell':
        if (a.tier === 0 && ending(a)) {
          a.tier = 1
          const s = statsOf(g, 'burningBulwark')
          if (s) withMods(g, s, () => erupt(g, s, g.player.x, g.player.y))
        }
        break
      case 'psyLift':
        if (a.tier === 0 && ending(a)) hurl(g, a)
        break
      case 'aquaRunner':
      case 'aquaRing':
        // Suicune's lap and its ring widen from the player's body to the ring's radius (`memo`).
        if (a.motion.kind === 'orbit') a.motion.radius = Math.min(a.memo, AQUA.inner + ((a.memo - AQUA.inner) * a.age) / AQUA.widen)
        break
      case 'heatNova':
        // Held at the core through the windup, then out to its size (`memo`).
        if (a.shape.kind === 'circle') a.shape.r = HEAT.core + (a.memo - HEAT.core) * Math.min(1, Math.max(0, a.age - HEAT.windup) / HEAT.burst)
        break
      case 'glaciateDome':
        // The dome grows to its size (`memo`) and holds it.
        if (a.shape.kind === 'circle' && a.shape.r >= a.memo) {
          a.shape.r = a.memo
          a.grow = 0
        }
        break
      case 'boulderImpact':
        if (a.tier === 0) shakeScreen(g, 3)
        a.tier = 1
        break
    }
  }
}
