import { retain } from '../engine/math'
import type { FloorPlan, Pt } from '../data/arenas'
import { PLACE, PLACES, type PlaceId } from '../data/places'
import { onFloor } from './arenaFloor'
import { buildCave, updateCave } from './cave'
import { buildGraveyard, updateGraveyard } from './graveyard'
import type { PlaceInterior, PlaceInteriorOf, PlaceOutcome, PlaceStates } from './place'
import { notifyPlace } from './placeKit'
import { bringBack, keepOnFloor, setAside } from './room'
import { buildSky, calmSky, updateSky } from './sky'
import { footOf, type Solid } from './terrain'
import { centerScreen, placeTeam } from './players'
import type { Game } from './types'
import * as dm from '../engine/dmath'

/**
 * The inside of a place: a room (`room.ts`) laid out by the place's rules,
 * with its own spawns and goal. Stepping in sets the world aside; time
 * running out (or the goal's loot window closing) brings the team back out
 * at the entrance's door, with the world exactly as it was.
 */

type Built<K extends PlaceId> = { layout: FloorPlan; solids: Solid[]; start: Pt; state: PlaceStates[K]; intro?: number }

type PlaceRule<K extends PlaceId> = {
  /** Lays the place out around world (x, y): its floor, scenery, where the player starts and its state. */
  build: (g: Game, x: number, y: number) => Built<K>
  /** Every tick inside until the goal is reached: spawns, the goal, the warnings. */
  update: (g: Game, inside: PlaceInteriorOf<K>, dt: number) => void
  /** Walkers keep to the floor too (the cave's walls), not just the player. */
  walls: boolean
  /** Time ran out: how the visit ends (the cave's wind throws the player out, the sky's calm lands them). */
  timeUp: (g: Game, inside: PlaceInteriorOf<K>) => 'done' | 'timeout'
}

const thrownOut = () => 'timeout' as const

const PLACE_RULES: { [K in PlaceId]: PlaceRule<K> } = {
  cave: { build: buildCave, update: updateCave, walls: true, timeUp: thrownOut },
  graveyard: { build: buildGraveyard, update: updateGraveyard, walls: false, timeUp: thrownOut },
  sky: { build: buildSky, update: updateSky, walls: false, timeUp: calmSky },
}

/** How far south of the door the team steps back out, clear of the entrance. */
const EXIT_STEP = 16

/** Sends the team into place `id`, laid out around the entrance's door at (x, y). */
export const enterPlace = <K extends PlaceId>(g: Game, id: K, x: number, y: number) => {
  const rule: PlaceRule<K> = PLACE_RULES[id]
  const stash = setAside(g)
  const built = rule.build(g, x, y)
  placeTeam(g, x + built.start[0], y + built.start[1])
  for (const p of g.players) centerScreen(g, p, p.x, p.y)
  const inside: PlaceInteriorOf<K> = {
    id,
    x,
    y,
    layout: built.layout,
    terrain: { solids: built.solids, lake: null },
    age: 0,
    left: PLACES[id].time,
    intro: built.intro ?? 0,
    loot: null,
    fall: null,
    stash,
    door: { x, y },
    spawnBudget: 0,
    state: built.state,
  }
  // TS can't distribute a generic K over the union; `inside` is exactly the PlaceInteriorOf<K> member.
  g.place.inside = inside as PlaceInterior
  g.place.visited.push(id)
  notifyPlace(g, id, { kind: 'enter' })
  if (inside.intro > 0) notifyPlace(g, id, { kind: 'floor', floor: 0 })
}

/** Brings the team back out at the entrance's door. */
export const exitPlace = (g: Game, outcome: PlaceOutcome) => {
  const inside = g.place.inside
  if (!inside) return
  placeTeam(g, inside.door.x, inside.door.y + EXIT_STEP)
  for (const p of g.players) {
    p.vx = 0
    p.vy = 0
  }
  g.place.inside = null
  bringBack(g, inside.stash)
  g.flash = 0.6
  notifyPlace(g, inside.id, { kind: 'exit', outcome })
}

/**
 * Plays the rescue after a player fainted inside and lands the team at the
 * door, whoever fainted with `PLACE.fallHp` of their HP. True while it plays
 * (the step waits).
 */
export const updatePlaceFall = (g: Game, dt: number) => {
  const inside = g.place.inside
  if (!inside || inside.fall === null) return false
  inside.fall -= dt
  if (inside.fall > 0) return true
  for (const p of g.players) {
    // Solo the one player is the one who fell.
    if (g.players.length > 1 && p.hp > 0) continue
    p.hp = Math.max(1, dm.round(p.stats.maxHp * PLACE.fallHp))
    p.hurt = 0
  }
  exitPlace(g, 'fallen')
  return true
}

/** A title card holds the place still (a dungeon floor's): true while it shows, so the step waits. */
export const updatePlaceIntro = (g: Game, dt: number) => {
  const inside = g.place.inside
  if (!inside || inside.intro <= 0) return false
  inside.intro -= dt
  return true
}

const run = <K extends PlaceId>(g: Game, inside: PlaceInteriorOf<K>, dt: number) => {
  const rule: PlaceRule<K> = PLACE_RULES[inside.id]
  const whole = inside.layout.floor
  for (const p of g.players) keepOnFloor(p, inside, whole, [], footOf(p))
  if (rule.walls) for (const e of g.enemies) if (e.dying < 0) keepOnFloor(e, inside, whole, [], e.radius * 0.8)
  // Shots break where the floor ends.
  retain(g.hazards, (h) => onFloor(whole, h.x - inside.x, h.y - inside.y, 4))
  if (inside.loot !== null) {
    for (const k of g.pickups) k.attracted = true
    inside.loot -= dt
    if (inside.loot <= 0) exitPlace(g, 'done')
    return
  }
  inside.left -= dt
  if (inside.left <= 0) return exitPlace(g, rule.timeUp(g, inside))
  rule.update(g, inside, dt)
}

/** Runs the place the team is in: keeps everyone where they belong, its rules, its clock and the loot window. */
export const updatePlace = (g: Game, dt: number) => {
  const inside = g.place.inside
  if (!inside) return
  inside.age += dt
  run(g, inside, dt)
}
