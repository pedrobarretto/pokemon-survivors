import type { Vec } from '../engine/math'
import { VERSUS_KIT } from '../data/versus'
import { aimable, aimableById, aimCode, autoTarget, rankTarget, reachCode, rivalsInReach, type Cast, type Priority, type Skill } from '../game/versusKit'
import type { Enemy, Game, Player } from '../game/types'

/**
 * The shell's half of the Arena's aim (the simulation's is `game/versusKit.ts`):
 * from the player's preferences (`Settings.aimAssist`, `targetPriority`) and
 * what they touched, the cast each press sends. Runs on the draw copy, so it
 * aims at what the screen shows; the run gets the result as a tick entry.
 */

/** How a cast picks its aim: `assist` snaps to the lock, else the best rival in reach (else the wild); `manual` goes exactly where the mouse, the drag or the right stick says. */
export const AIM_ASSISTS = ['assist', 'manual'] as const
export type AimAssist = (typeof AIM_ASSISTS)[number]

/** How far a cast aimed at no target reaches by default (px): one sent where the Pokémon faces. */
const FACING_REACH = 120

const castAt = (me: Player, skill: Skill, e: Enemy): Cast => ({
  skill,
  dir: aimCode(e.x - me.x, e.y - me.y),
  reach: reachCode(Math.hypot(e.x - me.x, e.y - me.y)),
  target: e.id,
})

/** A cast toward world point `at`, exactly: its target is whatever stands there (the run snaps to it, `VERSUS_KIT.snap`). */
export const castToward = (me: Player, skill: Skill, at: Vec): Cast => {
  const dx = at.x - me.x
  const dy = at.y - me.y
  return { skill, dir: aimCode(dx, dy), reach: reachCode(Math.min(VERSUS_KIT.reach, Math.hypot(dx, dy))), target: -1 }
}

/** A cast the way (dx, dy) points, `share` (0..1) of the way out to `VERSUS_KIT.reach`: a drag or the right stick. */
export const castAlong = (me: Player, skill: Skill, dx: number, dy: number, share: number): Cast => {
  const len = Math.hypot(dx, dy) || 1
  const reach = VERSUS_KIT.reach * Math.max(0, Math.min(1, share))
  return castToward(me, skill, { x: me.x + (dx / len) * reach, y: me.y + (dy / len) * reach })
}

/** The wild Pokémon nearest `me` within `VERSUS_KIT.reach`. */
const nearestWild = (g: Game, me: Player) => {
  let best: Enemy | null = null
  let bestD = VERSUS_KIT.reach * VERSUS_KIT.reach
  for (const e of g.enemies) {
    if (e.behavior.kind === 'avatar' || !aimable(g, me, e)) continue
    const d = (e.x - me.x) ** 2 + (e.y - me.y) ** 2
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/** What an assisted cast aims at: the lock while it's in reach, else the rival in reach the priority ranks first, else the nearest wild Pokémon. */
export const assistTarget = (g: Game, me: Player, lock: number, prio: Priority) =>
  aimableById(g, me, lock) ?? rankTarget(rivalsInReach(g, me), me.x, me.y, prio) ?? nearestWild(g, me)

/**
 * The cast a press sends with no aim of its own (a key, a tap): with
 * `assist`, at `assistTarget`; else, or with nothing to aim at, toward
 * `fallback` (the mouse, the right stick) or the way the Pokémon faces.
 */
export const pressCast = (g: Game, me: Player, skill: Skill, mode: AimAssist, lock: number, prio: Priority, fallback: Vec | null): Cast => {
  const t = mode === 'assist' ? assistTarget(g, me, lock, prio) : null
  if (t) return castAt(me, skill, t)
  if (fallback) return castToward(me, skill, fallback)
  return castAlong(me, skill, me.facing.x, me.facing.y, FACING_REACH / VERSUS_KIT.reach)
}

/** The rival body or wild Pokémon drawn under world point `at` (the nearest one whose body it touches), for a click or a tap. */
export const pickAt = (g: Game, me: Player, at: Vec): Enemy | null => {
  let best: Enemy | null = null
  let bestD = Infinity
  for (const e of g.enemies) {
    if (!aimable(g, me, e) || (e.behavior.kind === 'avatar' && e.behavior.team === me.versus?.team)) continue
    // The sprite stands on (x, y), drawn well past its hitbox (a starter's is 6 px): its middle is about 10 px up.
    const d = (e.x - at.x) ** 2 + (e.y - Math.max(10, e.radius) - at.y) ** 2
    const r = Math.max(18, e.radius + 10)
    if (d < r * r && d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}

/**
 * The target after `lock` (Tab, a tap on the basic attack, the right stick's
 * click): the rivals in reach, nearest first, then around again; the wild
 * ones when no rival is near. -1 when nothing is in reach.
 */
export const cycleTarget = (g: Game, me: Player, lock: number) => {
  const rivals = rivalsInReach(g, me)
  const pool = rivals.length > 0 ? rivals : g.enemies.filter((e) => e.behavior.kind !== 'avatar' && aimable(g, me, e) && (e.x - me.x) ** 2 + (e.y - me.y) ** 2 <= VERSUS_KIT.reach ** 2)
  if (pool.length === 0) return -1
  const order = [...pool].sort((a, b) => (a.x - me.x) ** 2 + (a.y - me.y) ** 2 - ((b.x - me.x) ** 2 + (b.y - me.y) ** 2))
  const at = order.findIndex((e) => e.id === lock)
  return order[(at + 1) % order.length]!.id
}

/** The rival in reach closest to the way (dx, dy) points (a flick of the right stick), or -1. */
export const targetToward = (g: Game, me: Player, dx: number, dy: number) => {
  const len = Math.hypot(dx, dy) || 1
  let best = -1
  let bestDot = Math.cos(Math.PI / 3)
  for (const e of rivalsInReach(g, me)) {
    const ex = e.x - me.x
    const ey = e.y - me.y
    const dot = (ex * dx + ey * dy) / (len * (Math.hypot(ex, ey) || 1))
    if (dot > bestDot) {
      bestDot = dot
      best = e.id
    }
  }
  return best
}

/** What this screen marks: the lock (if it's still aimable in reach) and, without one, the basic attack's own pick. */
export const shownTargets = (g: Game, me: Player, lock: number) => {
  const locked = aimableById(g, me, lock)
  return { locked, auto: locked ? null : autoTarget(g, me) }
}
