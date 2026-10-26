import { areaAt, AREAS, areaStart, FORK, forkOptions, plannedRoute, ROUTE, type BiomeId } from '../data/biomes'
import { isLegend } from '../data/legends'
import { EVENTS, stageStart } from '../data/waves'
import { createRng } from '../engine/rng'
import * as dm from '../engine/dmath'
import { BAG_ITEMS } from './bag'
import { withHaunts } from './halloween'
import { avoidLegend, LEGEND_HORDE } from './legend'
import { withHoney, withOutbreak } from './outbreak'
import { anchorPlayer, standing } from './players'
import { roomOf } from './room'
import { drawRoster, routeWeight, type Roster } from './roster'
import { isOpen } from './terrain'
import type { Game } from './types'

/**
 * Branching routes. A run walks five areas (`data/biomes.ts`, `ROUTE`): Route 1,
 * then at each milestone a fork between the two biomes of the next tier.
 * `FORK.lead` seconds before an area starts, two route gates go up on the map
 * near the team, one per biome (the HUD previews each: name, the types that
 * live there, its likely weather). The first gate a player stands in for
 * `FORK.charge` seconds is the way the run goes; in co-op any teammate's
 * standing counts and a tie goes to the left gate. If nobody picks before
 * `FORK.close`, the run takes the fork's default, drawn from the seed, so
 * everyone on a seed meets the same forks and the same defaults. The biome
 * changes on schedule when the area starts (`game/biomes.ts`). In the endless
 * mode a fork comes every `ENDLESS_LEG` seconds, between any two other biomes.
 *
 * The horde is drawn for the route the run plans (`plannedRoute`: what was
 * picked, then the defaults): taking a gate off the default draws the cast
 * again for the new route and keeps every stage, event and boss already under
 * way (`reroute`). All plain data and seeded, so replays and co-op snapshots
 * follow it with no shell event.
 */

/** A route gate on the map: the biome it leads to, its foot and how long someone has stood in it. */
export type RouteGate = { biome: BiomeId; x: number; y: number; charge: number }

/** The fork standing on the map: the area it leads into, its two gates (the default first), and once taken, which one (-1 before) and by whom (-1 nobody). */
export type RouteFork = { area: number; gates: RouteGate[]; chosen: number; by: number }

export type RouteState = {
  /** The run's seed, which draws the forks' defaults and the horde again on a reroute. */
  seed: number
  /** The biome of each area decided so far, from area 0 (Route 1). */
  path: BiomeId[]
  fork: RouteFork | null
}

export const createRoute = (seed: number): RouteState => ({ seed, path: [ROUTE.start], fork: null })

/** The route the run plans now: what was decided, then the seed's defaults up to the last regular area. */
export const runPlan = (r: RouteState) => plannedRoute(r.seed, r.path)

/** The biome of area `k` as decided (the last one decided holds until the next fork is). */
export const biomeOfArea = (r: RouteState, k: number): BiomeId => r.path[Math.min(k, r.path.length - 1)]!

/**
 * Where a fork's two gates stand around the team's anchor (left gate first):
 * on either side of them, then a little up or down, then further out: the first pair with clear ground.
 */
const SPOTS: readonly (readonly [number, number])[] = [
  [120, 20], [120, -25], [120, 60], [80, 75], [165, 10], [150, -60], [150, 85], [210, -20], [210, 40], [60, 110], [60, -110], [260, 0],
]

/**
 * The first pair of `SPOTS` with clear ground around the anchor player. On a
 * screen held upright (a phone in portrait) the pair turns a quarter, one gate
 * above the team and one below, so both fit on its narrow view.
 */
const gateSpots = (g: Game): readonly [{ x: number; y: number }, { x: number; y: number }] => {
  const p = anchorPlayer(g)
  const upright = g.view.h > g.view.w
  const at = ([dx, dy]: readonly [number, number], side: number) =>
    upright ? { x: dm.round(p.x + dy * 0.6), y: dm.round(p.y + dx * side * 0.6) } : { x: dm.round(p.x + dx * side), y: dm.round(p.y + dy) }
  for (const spot of SPOTS) {
    const left = at(spot, -1)
    const right = at(spot, 1)
    if (isOpen(g, left.x, left.y, FORK.clearance) && isOpen(g, right.x, right.y, FORK.clearance)) return [left, right]
  }
  return [at(SPOTS[0]!, -1), at(SPOTS[0]!, 1)]
}

const openFork = (g: Game, area: number) => {
  const r = g.route
  const options = forkOptions(r.seed, area, biomeOfArea(r, area - 1))
  const [a, b] = gateSpots(g)
  r.fork = { area, gates: [{ biome: options[0], ...a, charge: 0 }, { biome: options[1], ...b, charge: 0 }], chosen: -1, by: -1 }
  g.events.push({ kind: 'fork', area })
}

/** Puts both gates up again near the team, in the same order. */
const replaceGates = (g: Game, fork: RouteFork) => {
  const spots = gateSpots(g)
  fork.gates.forEach((gate, i) => {
    gate.x = spots[i]!.x
    gate.y = spots[i]!.y
    gate.charge = 0
  })
}

/**
 * The cast drawn again for the route the run plans now, keeping what already
 * started: the pools, runners and spitters of every stage that starts before
 * area `from`, the swarms and rings due before it, and every boss slot (the
 * trio, the mythical, the night bosses, a legend's swaps), dressed like
 * `createRun` dresses the first draw.
 */
export const rerouteRoster = (g: Game, from: number): Roster => {
  const r = g.route
  const starter = g.players[0]!.starter
  const legend = isLegend(starter)
  const outbreak = legend ? null : g.outbreak
  const honey = g.players[0]!.bag.includes('honey') ? BAG_ITEMS.honey.effect.outbreakWeight : 1
  const raw = drawRoster(createRng(r.seed), { weight: routeWeight(runPlan(r)), ...(legend ? LEGEND_HORDE : {}) })
  const fresh = avoidLegend(withHoney(withOutbreak(withHaunts(raw, g.halloween, r.seed, legend), outbreak), outbreak, honey), starter)
  const old = g.roster
  const cut = areaStart(from)
  const kept = (i: number) => stageStart(i) < cut
  const events = legend ? LEGEND_HORDE.events : EVENTS
  return {
    ...old,
    stages: old.stages.map((pool, i) => (kept(i) ? pool : (fresh.stages[i] ?? pool))),
    runners: old.runners.map((id, i) => (kept(i) ? id : (fresh.runners[i] ?? null))),
    spitters: old.spitters.map((id, i) => (kept(i) ? id : (fresh.spitters[i] ?? null))),
    events: old.events.map((id, i) => {
      const e = events[i]
      return !e || e.kind === 'boss' || e.at < cut ? id : (fresh.events[i] ?? id)
    }),
  }
}

/** Decides the fork into the next area: option `choice` (0 the default) of its gates, taken by player `by` (-1 nobody). */
const decide = (g: Game, choice: number, by: number) => {
  const r = g.route
  const area = r.path.length
  const fork = r.fork?.area === area ? r.fork : null
  const options = fork ? fork.gates.map((gate) => gate.biome) : forkOptions(r.seed, area, biomeOfArea(r, area - 1))
  const biome = options[choice] ?? options[0]!
  const planned = runPlan(r)[area]
  r.path.push(biome)
  if (fork) {
    fork.chosen = choice
    fork.by = by
  }
  // Off the planned route, the horde ahead follows the new one (the endless mode keeps the last stage's).
  if (area < AREAS && biome !== planned) g.roster = rerouteRoster(g, area)
  g.events.push({ kind: 'route', biome, area, by })
}

/** The player standing in `gate` (the first by slot), or -1. */
const standingIn = (g: Game, gate: RouteGate) => {
  for (const p of g.players) if (standing(g, p) && dm.sq(p.x - gate.x) + dm.sq(p.y - gate.y) < dm.sq(FORK.radius)) return p.slot
  return -1
}

/**
 * Follows the route as the run clock goes: puts a fork's gates up when the
 * next area nears (not inside a rift or a place: they open on the way out),
 * charges a gate while a player stands in it, takes the first one charged,
 * takes the default when the fork closes (catching up if the clock jumped),
 * brings the gates back near a team that wandered off, and clears a taken
 * fork once its area begins.
 */
export const updateRoute = (g: Game, dt: number) => {
  const r = g.route
  const last = g.endless !== null ? Infinity : AREAS
  while (r.path.length < last && g.time >= areaStart(r.path.length) - FORK.close) decide(g, 0, -1)
  const fork = r.fork
  if (fork && fork.chosen >= 0 && g.time >= areaStart(fork.area)) r.fork = null
  const next = r.path.length
  if (!r.fork && next < last && g.time >= areaStart(next) - FORK.lead && !roomOf(g)) openFork(g, next)
  const open = r.fork
  if (!open || open.chosen >= 0 || roomOf(g)) return
  let near = Infinity
  for (const p of g.players) for (const gate of open.gates) near = Math.min(near, dm.sq(p.x - gate.x) + dm.sq(p.y - gate.y))
  if (near > dm.sq(FORK.stray)) replaceGates(g, open)
  for (let i = 0; i < open.gates.length; i++) {
    const gate = open.gates[i]!
    const by = standingIn(g, gate)
    gate.charge = by >= 0 ? gate.charge + dt : Math.max(0, gate.charge - dt * 0.5)
    if (gate.charge >= FORK.charge) return decide(g, i, by)
  }
}

/** Opens the next fork now, whatever the clock (the dev console's `ps.route('fork')`); null when one is already up. */
export const forceFork = (g: Game) => {
  const r = g.route
  if (r.fork && r.fork.chosen < 0) return r.fork
  r.fork = null
  openFork(g, r.path.length)
  return r.fork
}

/** Takes gate `choice` of the open fork now (the dev console's `ps.route('take', i)`). */
export const takeFork = (g: Game, choice: number) => {
  const fork = g.route.fork
  if (fork && fork.chosen < 0 && fork.area === g.route.path.length) decide(g, choice, g.player.slot)
}

/** The biome the run will be in `ahead` seconds from now, as far as it's known (the open fork's default while undecided). */
export const biomeSoon = (g: Game, ahead: number): BiomeId => {
  const r = g.route
  const area = areaAt(g.time + ahead, g.endless !== null)
  const open = r.fork && r.fork.chosen < 0 && r.fork.area === area ? r.fork.gates[0]!.biome : undefined
  return r.path[area] ?? open ?? runPlan(r)[area] ?? biomeOfArea(r, area)
}

/** The biomes the run may walk into next: the open fork's two, else the next area's as decided or planned. */
export const biomesAhead = (g: Game): BiomeId[] => {
  const r = g.route
  if (r.fork && r.fork.chosen < 0) return r.fork.gates.map((gate) => gate.biome)
  const next = areaAt(g.time, g.endless !== null) + 1
  const biome = r.path[next] ?? runPlan(r)[next]
  return biome ? [biome] : []
}
