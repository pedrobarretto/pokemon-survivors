import { VERSUS, type Team } from '../data/versus'
import { MAPS, type MapId, type Rect } from '../data/versusMaps'
import { inPlay } from './players'
import type { VersusSeat } from './versus'
import { goalOpen, mapOf, rivalTeam } from './versusRules'
import type { StepInput } from './game'
import { aimCode, reachCode, type Cast, type Skill } from './versusKit'
import type { Enemy, Game, Player } from './types'
import * as dm from '../engine/dmath'

/**
 * Versus's bots: the seats no human took (and humans away or gone) are played
 * by the simulation itself, so every client drives them the same. Each tick a
 * bot picks where to go (retreat, score, fight, farm its lane, take the
 * objective, push) and walks there through the map's rooms (`route`). Its
 * basic attack fires on its own like anyone's; it casts Move 1 and Move 2 at
 * the foe in front of it once they recharge, and its Unite Move (the special)
 * when a rival is close (`castKit`). It doesn't see rivals hidden in tall grass, and slips into grass
 * itself to shake off a stronger rival. Pure on the game state: no rng, no clock.
 */

const contains = (r: Rect, x: number, y: number) => x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1

/** Where two rooms of the map overlap: the door between them. */
type Door = { x: number; y: number }

/**
 * A map's rooms as a graph: its rects, the door between each pair that
 * overlaps (`doors[a * n + b]`), the rooms between each pair (`hops`: steps
 * from room a to b) and the next room on a shortest way (`next`).
 */
type Routes = { rects: readonly Rect[]; n: number; doors: (Door | null)[]; hops: number[]; next: number[] }

/** Works out a map's routes from its rects. Pure. */
const routesOf = (rects: readonly Rect[]): Routes => {
  const n = rects.length
  const doors = rects.flatMap((a) =>
    rects.map((b) => {
      if (a === b) return null
      const x0 = Math.max(a.x0, b.x0)
      const x1 = Math.min(a.x1, b.x1)
      const y0 = Math.max(a.y0, b.y0)
      const y1 = Math.min(a.y1, b.y1)
      return x0 < x1 && y0 < y1 ? { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } : null
    }),
  )
  const hops = new Array<number>(n * n).fill(Infinity)
  const next = new Array<number>(n * n).fill(-1)
  for (let from = 0; from < n; from++) {
    hops[from * n + from] = 0
    next[from * n + from] = from
    const queue = [from]
    while (queue.length > 0) {
      const at = queue.shift()!
      for (let to = 0; to < n; to++) {
        if (!doors[at * n + to] || hops[from * n + to] !== Infinity) continue
        hops[from * n + to] = hops[from * n + at]! + 1
        next[from * n + to] = at === from ? to : next[from * n + at]!
        queue.push(to)
      }
    }
  }
  return { rects, n, doors, hops, next }
}

/** Each map's routes, worked out the first time a bot walks it: derived from the map's data alone, never part of a match's state. */
const ROUTES = new Map<MapId, Routes>()

const routesFor = (map: MapId) => {
  let r = ROUTES.get(map)
  if (!r) ROUTES.set(map, (r = routesOf(MAPS[map].rects)))
  return r
}

/** The rooms (x, y) stands in. */
const roomsAt = (m: Routes, x: number, y: number) => {
  const out: number[] = []
  for (let i = 0; i < m.n; i++) if (contains(m.rects[i]!, x, y)) out.push(i)
  return out
}

/** The room nearest (x, y) when it stands in none (pushed against a wall). */
const nearestRoom = (m: Routes, x: number, y: number) => {
  let best = 0
  let bestD = Infinity
  m.rects.forEach((r, i) => {
    const d = dm.sq(Math.max(r.x0 - x, 0, x - r.x1)) + dm.sq(Math.max(r.y0 - y, 0, y - r.y1))
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  return best
}

/**
 * The point to walk toward on `map` on the way from (x, y) to (tx, ty): the
 * target itself when one room holds both, else the door to the next room on
 * a shortest way.
 */
export const route = (map: MapId, x: number, y: number, tx: number, ty: number): Door => {
  const m = routesFor(map)
  const from = roomsAt(m, x, y)
  const to = roomsAt(m, tx, ty)
  if (from.length === 0) from.push(nearestRoom(m, x, y))
  if (to.length === 0) to.push(nearestRoom(m, tx, ty))
  let best = -1
  let bestHops = Infinity
  let target = -1
  for (const a of from) {
    for (const b of to) {
      if (a === b) return { x: tx, y: ty }
      const h = m.hops[a * m.n + b]!
      if (h < bestHops) {
        bestHops = h
        best = a
        target = b
      }
    }
  }
  if (best < 0) return { x: tx, y: ty }
  const step = m.next[best * m.n + target]!
  return m.doors[best * m.n + step] ?? { x: tx, y: ty }
}

/** How many rooms apart (x, y) and (tx, ty) are on `map` (0: the same one; Infinity: no way between). */
export const hopsBetween = (map: MapId, x: number, y: number, tx: number, ty: number) => {
  const m = routesFor(map)
  const from = roomsAt(m, x, y)
  const to = roomsAt(m, tx, ty)
  let best = Infinity
  for (const a of from) for (const b of to) best = Math.min(best, m.hops[a * m.n + b]!)
  return best
}

/**
 * What a bot is after, held for a few ticks (`VersusSeat.aim`): a spot, a
 * player or an enemy (followed where they go), standing still within `near`
 * px of it (0 never), and whether to press its special when a rival is close.
 */
export type Aim =
  | { kind: 'spot'; x: number; y: number; near: number }
  | { kind: 'player'; slot: number; near: number }
  | { kind: 'enemy'; id: number; near: number }

const d2 = (a: { x: number; y: number }, b: { x: number; y: number }) => dm.sq(a.x - b.x) + dm.sq(a.y - b.y)

/** HP share left. */
const share = (p: Player) => p.hp / Math.max(1, p.stats.maxHp)

/** The rival in play nearest `p`, within `r` px, that `p`'s team can see (not hidden in the grass). */
const nearestRival = (g: Game, p: Player, team: Team, r: number) => {
  let best: Player | null = null
  let bestD = r * r
  for (const q of g.players) {
    if (q.versus?.team !== rivalTeam(team) || q.versus.hidden || !inPlay(q)) continue
    const d = d2(p, q)
    if (d < bestD) {
      bestD = d
      best = q
    }
  }
  return best
}

/** Whether (x, y) lies in a bot's lane on a map whose lanes start at |y| `lanes`: the north lane, the south one, or the jungle between. */
const inLane = (lane: VersusSeat['lane'], y: number, lanes: number) => (lane === 'north' ? y < -lanes : lane === 'south' ? y > lanes : y >= -lanes && y <= lanes)

/** The camp Pokémon nearest `p` in its lane, or anywhere when its lane is clear. */
const nearestWild = (g: Game, p: Player, lane: VersusSeat['lane']) => {
  const lanes = mapOf(g.versus!).lanes
  let best: Enemy | null = null
  let bestD = Infinity
  let any: Enemy | null = null
  let anyD = Infinity
  for (const e of g.enemies) {
    if (e.dying >= 0 || e.behavior.kind !== 'camp' || e.id === g.versus?.objective?.id) continue
    const d = d2(p, e)
    if (inLane(lane, e.y, lanes) && d < bestD) {
      bestD = d
      best = e
    }
    if (d < anyD) {
      anyD = d
      any = e
    }
  }
  return best ?? any
}

/** The open rival goal nearest `p`, preferring its lane's. */
const rivalGoal = (g: Game, p: Player, team: Team) => {
  const s = g.versus!
  const lanes = mapOf(s).lanes
  let best: { x: number; y: number } | null = null
  let bestD = Infinity
  for (const goal of s.goals) {
    if (goal.team === team || !goalOpen(s, goal)) continue
    const d = d2(p, goal) * (inLane(p.versus!.lane, goal.y, lanes) ? 1 : 1.6)
    if (d < bestD) {
      bestD = d
      best = goal
    }
  }
  return best
}

/** Farthest (px) a bot backing off from a rival looks for tall grass to slip into. */
const COVER = 110

/** The middle of the tall-grass patch nearest `p`, within `COVER` px, or null. */
const nearestCover = (g: Game, p: Player) => {
  let best: { x: number; y: number } | null = null
  let bestD = COVER * COVER
  for (const r of mapOf(g.versus!).grass) {
    const x = (r.x0 + r.x1) / 2
    const y = (r.y0 + r.y1) / 2
    const d = dm.sq(x - p.x) + dm.sq(y - p.y)
    if (d < bestD) {
      bestD = d
      best = { x, y }
    }
  }
  return best
}

/** Energy a bot goes to score with: less near a goal and in the last stretch. */
const scoreWith = (g: Game, near: boolean) => (g.versus!.stretch ? 6 : near ? 8 : 16)

const spot = (x: number, y: number, near = 0): Aim => ({ kind: 'spot', x, y, near })

/** What bot `p` goes after now. */
const decide = (g: Game, p: Player): Aim => {
  const s = g.versus!
  const v = p.versus!
  const pad = mapOf(s).spawn[v.team]
  // Hurt: back to the spawn pad until healed, unless it's about to score.
  if (share(p) < (v.aim?.kind === 'spot' && v.aim.x === pad.x ? 0.9 : 0.32) && v.goal < 0) return spot(pad.x, pad.y, 12)
  // Carrying enough: to the nearest open rival goal, standing in it until the score lands.
  const goal = rivalGoal(g, p, v.team)
  if (goal && v.energy > 0) {
    const near = d2(p, goal) < 220 * 220
    if (v.energy >= scoreWith(g, near) || v.goal >= 0 || v.energy >= VERSUS.energy.cap) return spot(goal.x, goal.y, 10)
  }
  // A rival close: fight it while about as healthy, else back off: into tall grass nearby to lose it, or (seen there, or none near) toward the pad.
  const rival = nearestRival(g, p, v.team, 140)
  if (rival) {
    if (share(p) + 0.15 >= share(rival)) return { kind: 'player', slot: rival.slot, near: 34 }
    const cover = v.grass >= 0 && !v.hidden ? null : nearestCover(g, p)
    return cover ? spot(cover.x, cover.y, 6) : spot(pad.x, pad.y, 12)
  }
  // The objective: the jungler takes it, and everyone in the last stretch.
  const o = s.objective
  if (o && (v.lane === 'jungle' || s.stretch) && g.enemies.some((k) => k.id === o.id && k.dying < 0)) return { kind: 'enemy', id: o.id, near: 30 }
  // Energy lying near: pick it up.
  if (v.energy < VERSUS.energy.cap) {
    for (const orb of s.orbs) if (d2(p, orb) < 140 * 140) return spot(orb.x, orb.y)
  }
  // Farm the lane's camps.
  const wild = nearestWild(g, p, v.lane)
  if (wild) return { kind: 'enemy', id: wild.id, near: 26 }
  // Nothing to do: push toward a rival goal.
  if (goal) return spot(goal.x, goal.y, 10)
  return spot(pad.x, pad.y, 12)
}

/** Where an aim is now, or null when its target is gone. */
const aimAt = (g: Game, aim: Aim): { x: number; y: number } | null => {
  if (aim.kind === 'spot') return aim
  if (aim.kind === 'player') {
    const q = g.players[aim.slot]
    // Gone into the grass: lost.
    return q && inPlay(q) && !q.versus?.hidden ? q : null
  }
  for (const e of g.enemies) if (e.id === aim.id && e.dying < 0) return e
  return null
}

/** Farthest (px) a bot casts Move 1 and Move 2 at a rival it sees, and at the wild Pokémon it's after. */
const CAST_RIVAL = 130
const CAST_WILD = 90

/** A bot's cast of `skill` straight at `e`, picking it as the target. */
const castAt = (p: Player, skill: Skill, e: Enemy): Cast => ({ skill, dir: aimCode(e.x - p.x, e.y - p.y), reach: reachCode(dm.hypot(e.x - p.x, e.y - p.y)), target: e.id })

/**
 * What a bot casts this tick (`versusKit.ts`): Move 1 and Move 2 once
 * recharged, at the nearest rival it sees in reach (its body), else at the
 * wild Pokémon it's after; the Unite Move, when it presses the special, at
 * the same foe. Aimed at the foe itself, so no rng and no lead.
 */
const castKit = (g: Game, p: Player, input: StepInput, aim: Aim) => {
  const rival = nearestRival(g, p, p.versus!.team, CAST_RIVAL)
  const body = rival ? g.enemies.find((e) => e.id === rival.versus!.avatar && e.dying < 0) : undefined
  const wild = aim.kind === 'enemy' ? g.enemies.find((e) => e.id === aim.id && e.dying < 0 && d2(p, e) < CAST_WILD * CAST_WILD) : undefined
  const foe = body ?? wild
  if (!foe) return
  const casts: Cast[] = []
  for (const skill of [0, 1] as const) {
    const owned = p.moves[skill + 1]
    if (owned && owned.cooldown <= 0) casts.push(castAt(p, skill, foe))
  }
  if (input.special) casts.push(castAt(p, 2, foe))
  if (casts.length > 0) input.casts = casts
}

/** Ticks a bot holds an aim before thinking again (a slot's offset spreads the thinking out). */
const THINK = 15

/**
 * Sets the input of every bot in play (and of every human who's away) for
 * this tick: it rethinks its aim every `THINK` ticks or when its target is
 * gone, walks there through the map's rooms and presses its special with a
 * rival close.
 */
export const driveBots = (g: Game, inputs: StepInput[]) => {
  const s = g.versus
  if (!s) return
  for (const p of g.players) {
    const v = p.versus
    const input = inputs[p.slot]
    if (!v || !input || !(v.bot || p.away) || !inPlay(p)) continue
    v.think--
    let at = v.aim ? aimAt(g, v.aim) : null
    if (!v.aim || !at || v.think <= 0) {
      v.aim = decide(g, p)
      v.think = THINK + (p.slot % 4)
      at = aimAt(g, v.aim) ?? p
    }
    const rival = nearestRival(g, p, v.team, 70)
    input.special = rival !== null || (v.aim.kind === 'enemy' && d2(p, at) < 50 * 50)
    castKit(g, p, input, v.aim)
    if (v.aim.near > 0 && d2(p, at) < v.aim.near * v.aim.near) {
      input.move = { x: 0, y: 0 }
      continue
    }
    const to = route(s.map, p.x, p.y, at.x, at.y)
    const dx = to.x - p.x
    const dy = to.y - p.y
    const len = dm.hypot(dx, dy)
    input.move = len < 3 ? { x: 0, y: 0 } : { x: dx / len, y: dy / len }
  }
}
