import { dir8, fromAngle, TAU } from '../engine/math'
import { VERSUS_KIT } from '../data/versus'
import type { Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * The Arena's kit, Unite style (`VERSUS_KIT` in `data/versus.ts`): the first
 * move is the basic attack, cast on its own at the auto target (`autoTarget`:
 * the player's lock, else the best rival in reach by their priority); Move 1
 * and Move 2 (the second and third moves) wait for a cast, and so does the
 * Unite Move (the special). A cast comes in as a tick entry with its aim
 * decided on the client (`Cast`: a direction code, a reach and the target it
 * picked), so every client plays it the same.
 *
 * Moves aim through `nearestEnemy` and `p.facing`, dozens of places, so a cast
 * doesn't touch them: it turns the Pokémon to its aim (held a moment,
 * `VersusSeat.hold`) and sets a focus (`VersusSeat.focus`) for the cast's
 * call, which `nearestEnemy` answers from (`focusedEnemy`): the target, or the
 * foe at the aimed point, or nobody, so the move flies along the aim.
 */

/** Directions an aim is sent in (2.8° apart). */
export const AIM_DIRS = 128
/** The farthest reach an aim carries (px): one byte. */
export const MAX_REACH = 255

/** The kit's cast skills, by their index on the wire: Move 1, Move 2 and the Unite Move. */
export const SKILLS = ['move1', 'move2', 'unite'] as const
export type Skill = 0 | 1 | 2

/** A cast as the simulation reads it: the skill, its aim (`aimCode`, the reach in px) and the target the client picked (an enemy id, -1 none). */
export type Cast = { skill: Skill; dir: number; reach: number; target: number }

/** Where a cast is aimed for the moves it fires: a point, and the enemy picked there (-1 none). */
export type Focus = { x: number; y: number; id: number }

/** How the auto basic attack and the assist rank the rivals in reach (`VersusSeat.prio` is the index). */
export const PRIORITIES = ['closest', 'lowestShare', 'lowest'] as const
export type Priority = (typeof PRIORITIES)[number]

/** The direction code (0..`AIM_DIRS` - 1) nearest the way (dx, dy) points; 0 (east) for no way at all. */
export const aimCode = (dx: number, dy: number) => {
  if (dx === 0 && dy === 0) return 0
  const n = dm.round((dm.atan2(dy, dx) / TAU) * AIM_DIRS)
  return ((n % AIM_DIRS) + AIM_DIRS) % AIM_DIRS
}

/** The unit vector a direction code points. */
export const aimVec = (code: number) => fromAngle((code / AIM_DIRS) * TAU)

/** A reach on the wire: whole px, 0..`MAX_REACH`. */
export const reachCode = (px: number) => Math.max(0, Math.min(MAX_REACH, dm.round(px)))

type Candidate = { x: number; y: number; hp: number; maxHp: number }

/**
 * The candidate a priority picks, from (x, y): the closest, the lowest HP share
 * or the lowest HP (ties go to the closer one, then to the first). Pure: the
 * simulation's auto target and the shell's assist share it.
 */
export const rankTarget = <T extends Candidate>(candidates: readonly T[], x: number, y: number, prio: Priority): T | null => {
  let best: T | null = null
  let bestKey = Infinity
  let bestD = Infinity
  for (const c of candidates) {
    const d = dm.sq(c.x - x) + dm.sq(c.y - y)
    const key = prio === 'closest' ? d : prio === 'lowestShare' ? c.hp / Math.max(1, c.maxHp) : c.hp
    if (key < bestKey || (key === bestKey && d < bestD)) {
      best = c
      bestKey = key
      bestD = d
    }
  }
  return best
}

/** The priority a seat ranks by (an index off the list reads as the first). */
export const priorityOf = (index: number): Priority => PRIORITIES[index] ?? 'closest'

/**
 * Whether `e` is something `p` can aim at in a match: a living wild Pokémon,
 * or a rival's body that isn't hidden from `p`'s team in the grass.
 */
export const aimable = (g: Game, p: Player, e: Enemy) => {
  if (e.dying >= 0) return false
  const b = e.behavior
  if (b.kind !== 'avatar') return true
  return b.team !== p.versus?.team && g.players[b.slot]?.versus?.hidden !== true
}

/** Whether `e` is a rival's body. */
const isRival = (p: Player, e: Enemy) => e.behavior.kind === 'avatar' && e.behavior.team !== p.versus?.team

const within = (p: Player, e: Enemy, r: number) => dm.sq(e.x - p.x) + dm.sq(e.y - p.y) <= r * r

/** The enemy with id `id` that `p` can aim at within `r` px, if any. */
export const aimableById = (g: Game, p: Player, id: number, r: number = VERSUS_KIT.reach) => {
  if (id < 0) return null
  for (const e of g.enemies) if (e.id === id) return aimable(g, p, e) && within(p, e, r) ? e : null
  return null
}

/** The rivals' bodies `p` can aim at within `VERSUS_KIT.reach`. */
export const rivalsInReach = (g: Game, p: Player) => g.enemies.filter((e) => isRival(p, e) && aimable(g, p, e) && within(p, e, VERSUS_KIT.reach))

/**
 * What `p`'s basic attack aims at: their lock while it's in reach, else the
 * rival in reach their priority ranks first (rivals before the wild), else
 * null (the move finds the nearest foe on its own).
 */
export const autoTarget = (g: Game, p: Player): Enemy | null => {
  const v = p.versus
  if (!v) return null
  return aimableById(g, p, v.lock) ?? rankTarget(rivalsInReach(g, p), p.x, p.y, priorityOf(v.prio))
}

/** The basic attack's focus: on the auto target, or none. */
export const autoFocus = (g: Game, p: Player): Focus | null => {
  const t = autoTarget(g, p)
  return t ? { x: t.x, y: t.y, id: t.id } : null
}

/** Turns `p` to (dx, dy) and holds them that way for `VERSUS_KIT.hold`, whatever the stick says. */
const turn = (p: Player, dx: number, dy: number) => {
  const len = dm.hypot(dx, dy)
  if (len < 1e-6 || !p.versus) return
  p.facing = { x: dx / len, y: dy / len }
  p.dir = dir8(dx, dy)
  p.versus.hold = VERSUS_KIT.hold
}

/**
 * Aims `p`'s `cast`: at its target while that's still aimable in reach (where
 * it stands now, the cast having traveled), else at the point its direction
 * and reach name. Turns the Pokémon that way and returns the cast's focus.
 */
export const aimCast = (g: Game, p: Player, cast: Cast): Focus => {
  const t = aimableById(g, p, cast.target)
  if (t) {
    turn(p, t.x - p.x, t.y - p.y)
    return { x: t.x, y: t.y, id: t.id }
  }
  const d = aimVec(cast.dir)
  const reach = Math.min(cast.reach, VERSUS_KIT.reach)
  turn(p, d.x, d.y)
  return { x: p.x + d.x * reach, y: p.y + d.y * reach, id: -1 }
}

/** Calls from within this many px of the caster count as the cast aiming (a move's own sub-hits, from elsewhere, find foes as always). */
const FROM_CASTER = 24

/**
 * `nearestEnemy` while the acting player casts with a focus: undefined when
 * the call doesn't come from the caster (the usual answer then); otherwise the
 * focus's target if it's within `maxDist` of (x, y), else the foe nearest the
 * focus's point within `VERSUS_KIT.snap` of it (and `maxDist` of (x, y)),
 * else null, so the move falls back to the way the player faces: the aim.
 */
export const focusedEnemy = (g: Game, x: number, y: number, maxDist: number, exclude?: ReadonlySet<number>): Enemy | null | undefined => {
  const p = g.player
  const f = p.versus?.focus
  if (!f || dm.sq(x - p.x) + dm.sq(y - p.y) > FROM_CASTER * FROM_CASTER) return undefined
  const max = maxDist * maxDist
  let best: Enemy | null = null
  let bestD = VERSUS_KIT.snap * VERSUS_KIT.snap
  for (const e of g.enemies) {
    if (exclude?.has(e.id) || !aimable(g, p, e) || dm.sq(e.x - x) + dm.sq(e.y - y) > max) continue
    if (e.id === f.id) return e
    const d = dm.sq(e.x - f.x) + dm.sq(e.y - f.y)
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  return best
}
